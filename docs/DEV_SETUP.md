# AInderstanding — Developer Setup

> **Scope:** Lokálne vývojové prostredie od nuly po fungujúci dev server.

---

## Prerequisites

| Tool | Verzia | Inštalácia |
|------|--------|-----------|
| Node.js | 20 LTS | `brew install node` alebo `nvm install 20` |
| npm | 10+ | Dodávaný s Node.js |
| Git | akákoľvek | `brew install git` |

**Nie je potrebné pre základný dev:** Docker, DuckDB CLI — DuckDB beží embedded cez `duckdb-async` npm package.

**Python + uv** je potrebné iba pre Translate modul (full-exec tier: `uv run --isolated` pre Python snippety). Inštalácia: `brew install uv`. **Docker** je potrebné iba pre PySpark sandbox tier v Translate (voliteľné, nie v MVP scope).

---

## 1. Klonovanie a inštalácia závislostí

```bash
git clone <repo-url> aibio
cd aibio
npm install
```

`better-sqlite3` a `duckdb-async` sú native addons — `npm install` ich kompiluje automaticky. Vyžadujú `node-gyp` (dodávané s Xcode Command Line Tools na macOS).

Ak inštalácia zlyhá na native addons:

```bash
xcode-select --install   # macOS
npm install
```

---

## 2. Environment variables

Skopíruj template a vyplň hodnoty:

```bash
cp .env.example .env.local
```

Obsah `.env.local`:

```bash
# Povinné
ANTHROPIC_API_KEY=sk-ant-...        # Claude API key z console.anthropic.com
AIBIO_ENCRYPTION_KEY=               # 32-byte base64 key — generovať: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Voliteľné — defaults fungujú pre lokálny vývoj
AIBIO_DB_PATH=./aibio.db            # SQLite database lokácia
NODE_ENV=development
```

**Nikdy necommituj `.env.local`** — je v `.gitignore`.

---

## 3. Databáza

Drizzle migrácie sa spúšťajú automaticky pri štarte dev servera (`core/db/migrate.ts` je volaný v `app/layout.tsx` server component).

**Workflow pri zmene schémy** (v `{module}/db/schema.ts`):

```bash
npm run db:generate   # Drizzle Kit vygeneruje SQL migráciu do core/db/migrations/
npm run db:migrate    # Aplikuje migrácie na aibio.db
```

Pre manuálne spustenie migrácií bez zmeny schémy:

```bash
npm run db:migrate
```

Pre reset databázy (zmaže všetky dáta):

```bash
rm -f aibio.db
npm run db:migrate
```

DuckDB datamart databázy sú per-workspace: `workspaces/{workspaceId}/datamart.duckdb`. Vytvárajú sa automaticky pri prvej materializácii. Pre reset konkrétneho workspace:

```bash
rm workspaces/{workspaceId}/datamart.duckdb
```

---

## 4. Demo dataset (Chinook)

Pre rýchly štart bez vlastného dátového zdroja je k dispozícii Chinook demo dataset — štandardná hudobná databáza s 11 tabuľkami (~4 000 riadkov), vhodná na testovanie všetkých modulov.

**Postup bootstrapu:**

```bash
npm run db:migrate    # Aplikuje migrácie (vytvorí workspaces tabuľku)
npm run seed          # Stiahne Chinook SQLite, vloží ho ako workspace_id='demo' data source
npm run dev           # Spustí app s predpripraveným workspace 'demo'
```

Skript `scripts/load-chinook.ts` vykoná:
1. Stiahne `chinook.db` (SQLite, ~1 MB) do `scripts/fixtures/chinook.db` ak ešte neexistuje
2. Vytvorí workspace s `id='demo'`, `name='Chinook Demo'`
3. Zaregistruje DuckDB data source pointujúci na `scripts/fixtures/chinook.db`

Po `npm run seed` otvor `http://localhost:3000` — workspace "Chinook Demo" bude dostupný bez ďalšej konfigurácie.

**Reset demo dát:**

```bash
rm -f aibio.db scripts/fixtures/chinook.db
npm run db:migrate && npm run seed
```

---

## 5. Spustenie dev servera (bez demo datasetu)

```bash
npm run dev
```

Aplikácia beží na `http://localhost:3000`.

Next.js dev server sa automaticky reštartuje pri zmenách v `app/` a `modules/`. Zmeny v `core/db/schema` si vyžadujú manuálnu migráciu.

---

## 6. Štruktúra workspaces

Workspace-scoped súbory (SQL modely, test YAML, lineage) sú uložené v:

```
workspaces/
└── {workspaceId}/
    ├── models/
    │   ├── staging/
    │   ├── intermediate/
    │   └── marts/
    ├── tests/
    │   ├── generic/
    │   └── custom/
    ├── sources.yml
    ├── lineage.json
    └── datamart.duckdb
```

Tento priečinok je v `.gitignore` (runtime dáta). Pre verziovanie modelov a testov existuje Export feature (dbt-compatible `.zip`).

---

## 7. Testovanie jednotlivých modulov

### Connect — test source connection

```bash
# V UI: Workspace → Connect → Add Source → Test Connection
# Lokálne testovacie DB (DuckDB súbor):
# v Add Source wizarde zvoľ DuckDB a zadaj absolútnu cestu k .duckdb súboru
```

### Explore — manuálny trigger schema introspect

```bash
# Po pridaní source sa Explore spustí automaticky.
# Pre re-trigger: v UI Explore tab → "Refresh Schema" tlačidlo
```

### Model — test materializácie bez AI

```bash
# Vytvor SQL súbor manuálne v workspaces/{id}/models/staging/test.sql
# V UI Model tab → "Build all" alebo "Build selected"
```

---

## 8. Nástroje pre vývoj

### Drizzle Studio (DB GUI)

```bash
npm run db:studio
# Otvorí Drizzle Studio na http://localhost:4983
```

### Linting

```bash
npm run lint        # ESLint
npm run type-check  # TypeScript strict check bez buildu
```

### Testy

```bash
npm run test            # Vitest (unit + integration)
npm run test:e2e        # Playwright (vyžaduje bežiaci dev server)
npm run test:watch      # Vitest watch mode
```

---

## 9. Časté problémy

### `better-sqlite3` alebo `duckdb-async` sa nepodarilo skompilovať

```bash
# Skontroluj Node.js verziu — musí byť 20 LTS
node --version

# Vyčisti a reinštaluj
rm -rf node_modules
npm install
```

### `ANTHROPIC_API_KEY` nie je nastavený

App vyhodí `Error: ANTHROPIC_API_KEY is required` pri prvom volaní AI. Skontroluj `.env.local`.

### SQLite "database is locked"

Stáva sa ak beží viac instances dev servera (napr. po crash). Zastaviť všetky Node.js procesy:

```bash
pkill -f "next dev"
npm run dev
```

### Port 3000 obsadený

```bash
npm run dev -- -p 3001
```

---

## 10. Pridanie nového sub-modulu (referencia)

1. Vytvor `modules/ainderstanding/{module}/` s rovnakou štruktúrou ako existujúce moduly
2. Definuj Drizzle schema v `{module}/db/schema.ts`
3. Importuj schema v `core/db/client.ts`
4. Registruj MCP tools v `{module}/lib/mcp-tools.ts`
5. Pridaj route v `app/workspace/[workspaceId]/{module}/page.tsx`
6. Aktualizuj `ARCHITECTURE.md` a vytvor docs súbory pre nový modul
