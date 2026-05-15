# AIBIo — Deployment Guide

> **Scope:** Produkčné nasadenie AIBIo pomocou Dockeru a Kubernetes (GKE). Lokálny dev setup → [DEV_SETUP.md](./DEV_SETUP.md).
>
> **Helm chart a Terraform sú post-MVP.** MVP deploy používa raw `kubectl apply` s YAML manifestmi z priečinka `k8s/`. Helm templating a Terraform IaC pre GKE cluster sa plánujú po MVP.

---

## Obsah

1. [Prehľad a obmedzenia](#1-prehľad-a-obmedzenia)
2. [Dockerfile](#2-dockerfile)
3. [Docker Compose — lokálny container test](#3-docker-compose--lokálny-container-test)
4. [Kubernetes — GKE nasadenie](#4-kubernetes--gke-nasadenie)
5. [Ingress — Traefik](#5-ingress--traefik)
6. [CI/CD — GitHub Actions](#6-cicd--github-actions)
7. [Authentication — Claude Code OAuth (produkcia / headless)](#7-authentication--claude-code-oauth-produkcia--headless)
8. [Environment variables referencia](#8-environment-variables-referencia)
9. [Operácie](#9-operácie)

---

## 1. Prehľad a obmedzenia

| Stratégia | Kedy použiť |
|---|---|
| `npm run dev` | Lokálny vývoj | 
| Docker Compose | Testovanie produkčného buildu lokálne |
| **Kubernetes / GKE** | **Produkčné nasadenie** |
| Tauri desktop app | Plánované post-MVP |

### Kritické obmedzenia

**SQLite + DuckDB = maximálne 1 replika.** Oba storage systémy sú file-based. Súbežný write prístup dvoch procesov k rovnakému `.db` súboru je undefined behavior. Horizontal scaling nie je možný bez migrácie na PostgreSQL (mimo MVP scope).

**Native Node.js addons.** `better-sqlite3` a `duckdb-async` sa kompilujú pri `npm install`. Docker image musí mať rovnakú OS/architektúru ako cieľový runtime. Alpine Linux (musl libc) nie je kompatibilný — používaj Debian-slim.

**Python + uv.** Translate modul spúšťa Python snippety cez `uv run --isolated`. Runtime image musí mať nainštalovaný Python 3 a `uv`.

**Súborový systém.** `workspaces/` adresár (SQL modely, YAML testy, DuckDB súbory) musí byť na perzistentnom volume. Nastavuje sa cez `AIBIO_WORKSPACES_PATH`.

> **Poznámka:** `AIBIO_WORKSPACES_PATH` je definovaný v `ARCHITECTURE.md §17` ako required env var. Bez neho app defaultuje na `./workspaces/` relatívne k cwd — v kontajneri musí byť nastavený na cestu k persistent volume.

---

## 2. Dockerfile

Umiestni do rootu projektu.

```dockerfile
# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-bookworm AS builder

WORKDIR /app

# Build tools pre native addons (better-sqlite3, duckdb-async)
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Odsekni dev dependencies
RUN npm prune --production

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

# Python + uv pre Translate full-exec tier
RUN apt-get update && apt-get install -y \
    python3 python3-pip curl \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.local/bin:$PATH"

# Skopíruj produkčný build a závislosti
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# /data bude mountnutý ako PersistentVolume
RUN mkdir -p /data/workspaces

ENV NODE_ENV=production
ENV AIBIO_DB_PATH=/data/aibio.db
ENV AIBIO_WORKSPACES_PATH=/data/workspaces

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health',r=>process.exit(r.statusCode===200?0:1))"

CMD ["node_modules/.bin/next", "start"]
```

`.dockerignore`:

```
.git
.next
node_modules
workspaces
*.db
.env*
!.env.example
```

Build a push do registry:

```bash
docker build -t ghcr.io/{owner}/aibio:latest .
docker push ghcr.io/{owner}/aibio:latest
```

---

## 3. Docker Compose — lokálny container test

Slúži na overenie produkčného buildu pred deploymentom na K8s. Nie je určený pre produkciu.

```yaml
# docker-compose.yml
services:
  aibio:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      NODE_ENV: production
      AIBIO_DB_PATH: /data/aibio.db
      AIBIO_WORKSPACES_PATH: /data/workspaces
    volumes:
      - aibio-data:/data

volumes:
  aibio-data:
```

```bash
docker compose up --build
# Dostupné na http://localhost:3000
```

---

## 4. Kubernetes — GKE nasadenie

Všetky K8s manifesty daj do `k8s/` adresára v roote projektu.

### 4.1 Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: aibio
```

### 4.2 Secrets

Nikdy necommituj hodnoty do gitu. Použij `kubectl create secret` alebo External Secrets Operator.

```bash
kubectl create secret generic aibio-secrets \
  --namespace=aibio \
  --from-literal=CLAUDE_CODE_OAUTH_TOKEN=<token> \
  --from-literal=AIBIO_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

Alternatívne cez manifest (hodnoty v base64, **nikdy do gitu**):

```yaml
# k8s/secret.yaml  — NEPRIDÁVAJ DO GITU
apiVersion: v1
kind: Secret
metadata:
  name: aibio-secrets
  namespace: aibio
type: Opaque
stringData:
  CLAUDE_CODE_OAUTH_TOKEN: "<token>"
  AIBIO_ENCRYPTION_KEY: "..."
```

### 4.3 ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aibio-config
  namespace: aibio
data:
  NODE_ENV: "production"
  AIBIO_DB_PATH: "/data/aibio.db"
  AIBIO_WORKSPACES_PATH: "/data/workspaces"
```

### 4.4 PersistentVolumeClaim

```yaml
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: aibio-data
  namespace: aibio
spec:
  accessModes:
    - ReadWriteOnce        # RWO — jeden node naraz, dostatočné pre 1 repliku
  storageClassName: standard-rwo  # GKE SSD persistent disk
  resources:
    requests:
      storage: 20Gi        # SQLite metadata + DuckDB datamarty per workspace
```

**GKE storage classes:** `standard-rwo` (SSD), `standard` (HDD). Pre DuckDB query performance odporúčam SSD.

### 4.5 Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aibio
  namespace: aibio
  labels:
    app: aibio
spec:
  replicas: 1             # HARD LIMIT — SQLite file locking, nikdy > 1
  strategy:
    type: Recreate        # Nie RollingUpdate — PVC je ReadWriteOnce, druhý pod by sa nezačal
  selector:
    matchLabels:
      app: aibio
  template:
    metadata:
      labels:
        app: aibio
    spec:
      containers:
        - name: aibio
          image: ghcr.io/{owner}/aibio:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: aibio-config
            - secretRef:
                name: aibio-secrets
          volumeMounts:
            - name: data
              mountPath: /data
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "4Gi"   # DuckDB môže skonzumovať viac RAM pri query-heavy workloadoch
              cpu: "2000m"    # Burst pre paralelný data profiling (N data-profiler agentov)
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 20
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 40
            periodSeconds: 30
            failureThreshold: 3
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: aibio-data
      imagePullSecrets:
        - name: ghcr-credentials   # ak je registry private
```

> **Health endpoint:** Implementovaný v `app/api/health/route.ts` — vracia `200 OK` + JSON `{ status: 'ok' }`. Overuje prítomnosť required env vars. SQLite connectivity check sa doplní po implementácii `core/db/client.ts`.

### 4.6 Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: aibio
  namespace: aibio
spec:
  selector:
    app: aibio
  ports:
    - name: http
      port: 80
      targetPort: 3000
  type: ClusterIP
```

### 4.7 Nasadenie

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml     # ak používaš súborový prístup
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Overiť stav
kubectl get pods -n aibio
kubectl logs -n aibio deployment/aibio --follow
```

---

## 5. Ingress — Traefik

Predpokladá nainštalovaný Traefik ingress controller v clusteri a cert-manager alebo Traefik Let's Encrypt resolver.

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aibio
  namespace: aibio
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
    traefik.ingress.kubernetes.io/router.middlewares: aibio-strip-prefix@kubernetescrd
spec:
  ingressClassName: traefik
  rules:
    - host: aibio.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: aibio
                port:
                  number: 80
  tls:
    - hosts:
        - aibio.yourdomain.com
      secretName: aibio-tls-cert
```

### SSE a timeouty

Traefik má defaultný timeout 60s na response. SSE stream (`/api/stream/{workspaceId}`) je long-lived connection — musíš ho predĺžiť:

```yaml
# k8s/traefik-middleware.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: aibio-sse-timeout
  namespace: aibio
spec:
  headers:
    customResponseHeaders:
      X-Accel-Buffering: "no"   # vypne nginx/traefik buffering pre SSE
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: aibio-sse
  namespace: aibio
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`aibio.yourdomain.com`) && PathPrefix(`/api/stream`)
      kind: Rule
      services:
        - name: aibio
          port: 80
          responseForwarding:
            flushInterval: 1ms   # okamžité flushovanie SSE eventov
      middlewares:
        - name: aibio-sse-timeout
```

---

## 6. CI/CD — GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GKE
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_CREDENTIALS }}

      - name: Set up gke-gcloud-auth-plugin
        uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: ${{ secrets.GKE_CLUSTER }}
          location: ${{ secrets.GKE_REGION }}

      - name: Deploy to GKE
        run: |
          kubectl set image deployment/aibio \
            aibio=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            -n aibio
          kubectl rollout status deployment/aibio -n aibio --timeout=120s
```

**GitHub Secrets potrebné:**
- `GCP_CREDENTIALS` — GCP service account JSON s `container.developer` rolou
- `GKE_CLUSTER` — názov clustera
- `GKE_REGION` — napr. `europe-west1`

---

## 7. Authentication — Claude Code OAuth (produkcia / headless)

V produkčnom nasadení (headless/container) Claude Agent SDK vyžaduje OAuth token.

### CI/CD / Kubernetes

Namiesto API key nastav OAuth credentials pre headless prostredie:
- Premenná `CLAUDE_CODE_OAUTH_TOKEN` — nastav ako K8s secret (viď sekcia 4.2) alebo CI/CD secret
- Alternatíva: `claude login --token <token>` ako init container krok pred spustením app

> Poznámka: Overiť v claude.ai/settings ako exportovať OAuth token pre headless nasadenie.

---

## 8. Environment variables referencia

| Premenná | Povinná | Default | Popis |
|---|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | ✅ (prod) | — | OAuth token pre Claude Code (headless/container). V lokálnom vývoji nie je potrebný — `claude login` uloží token automaticky. |
| `AIBIO_ENCRYPTION_KEY` | ✅ | — | 32-byte base64 kľúč pre AES-256-GCM šifrovanie DB credentials. Generovanie: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AIBIO_DB_PATH` | ❌ | `./aibio.db` | Cesta k SQLite metadata databáze. V kontajneri: `/data/aibio.db` |
| `AIBIO_WORKSPACES_PATH` | ❌ | `./workspaces` | Root adresár pre workspace súbory (SQL modely, YAML testy, DuckDB). V kontajneri: `/data/workspaces` |
| `NODE_ENV` | ❌ | `development` | Nastaviť na `production` pre produkčný build. |
| `PORT` | ❌ | `3000` | Next.js port. |

---

## 9. Operácie

### Zálohovanie

SQLite a DuckDB súbory sú na PVC `/data`. Zálohovanie cez GKE Volume Snapshot:

```bash
# Vytvor VolumeSnapshot (vyžaduje VolumeSnapshot CRD + CSI driver)
kubectl apply -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: aibio-backup-$(date +%Y%m%d)
  namespace: aibio
spec:
  volumeSnapshotClassName: pd-backup
  source:
    persistentVolumeClaimName: aibio-data
EOF
```

Alternatíva — kopírovanie súborov z podu:

```bash
# Záloha SQLite metadata DB
kubectl cp aibio/{pod-name}:/data/aibio.db ./backups/aibio-$(date +%Y%m%d).db -n aibio

# Záloha celého /data adresára
kubectl exec -n aibio deployment/aibio -- tar czf - /data \
  | gzip > ./backups/aibio-data-$(date +%Y%m%d).tar.gz
```

**Odporúčané:** denná záloha pomocou CronJob v clusteri, výstup do GCS bucket.

### Update / redeployment

Keďže stratégia je `Recreate`, deployment spôsobí krátkodobý výpadok (~10-20s). Plán:

1. Push nový image do registry
2. `kubectl set image deployment/aibio aibio={new-image} -n aibio`
3. K8s zabije existujúci pod, spustí nový
4. Monitoruj: `kubectl rollout status deployment/aibio -n aibio`

**SSE UX dopad:** Všetci aktívni SSE klienti stratia spojenie počas výpadku. Browser `EventSource` sa automaticky reconnectuje po ~3s. Server po reštarte emituje `stream_end` pre sessions kde workflow medzitým skončilo; aktívne sessions sú stratené (agentic run sa musí opakovať). Toto je akceptovateľné pre MVP. Pre nulový downtime je potrebné migrovať storage na PostgreSQL + S3 (mimo MVP scope).

### Monitoring

```bash
# Logy v reálnom čase
kubectl logs -n aibio deployment/aibio --follow

# Resource utilization
kubectl top pod -n aibio

# Popis podu (events, probes)
kubectl describe pod -n aibio -l app=aibio
```

Pre produkciu odporúčam Google Cloud Monitoring (automaticky integrovaný s GKE) alebo Grafana + Prometheus.

### Rollback

```bash
# Vráť sa na predchádzajúcu verziu
kubectl rollout undo deployment/aibio -n aibio

# Vráť sa na konkrétnu revíziu
kubectl rollout history deployment/aibio -n aibio
kubectl rollout undo deployment/aibio --to-revision=2 -n aibio
```

### Škálovanie (obmedzené)

Vertikálne škálovanie (viac CPU/RAM pre jeden pod) je možné úpravou `resources.limits` v Deployment. Horizontálne škálovanie (viac replík) **nie je podporované** bez migrácie na externý DB.

---

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture, tech stack, security model
- [DEV_SETUP.md](./DEV_SETUP.md) — Lokálny vývoj
- [core/GOAL.md](./00-core/GOAL.md) — Foundation layer, env vars, DB singleton

---

*Doc owner: Lukáš. Verzia 0.1.*
