# AIBIo — Database Schema

*Verzia 0.4. Podklad pre Drizzle ORM implementáciu (Phase P0a). Pozri [ARCHITECTURE.md](./ARCHITECTURE.md) sekcia 12 pre ownership overview.*

---

## Changelog

| Verzia | Zmeny |
|---|---|
| 0.5 | +`models.materialization`, +`models.status`; +`model_runs.session_id/models_total/succeeded/failed`; +Document extra fields (table/column/relationship/convention); +`tests.is_enabled/test_name/table_name`; +`test_runs.session_id`; +`translate_snippets.is_custom/custom_note/updated_at`; +`translate_test_results.tier`; +`workspace_settings.max_session_tokens`; +explicitné composite indexy |
| 0.4 | +`translate_snippets`, +`translate_test_results` (Translate sub-modul), celkový počet tabuliek 24→26, ERD rozšírené |
| 0.3 | `column_profiles.table_name` vrátený (denorm), `models.last_run_status`+`last_run_at`, `model_runs.parent_run_id FK`, `chat_messages.active_module`, `workspace_settings` +5 stĺpcov, `schema_changes.column_name` nullable note |
| 0.2 | +`workspace_settings` (Shell), `workspaces.ai_mode`, split `connection_config_json`, `tests.model_id FK`, `column_profiles.table_profile_id FK`, `model_runs.triggering_model_id FK`, `audit_entries.session_id`, UNIQUE constraints na `test_results` + `lineage_edges`, nullable clarifications |
| 0.1 | Prvá verzia |

---

## Obsah

1. [Prehľad vlastníctva tabuliek](#1-prehľad-vlastníctva-tabuliek)
2. [Cross-module entity diagram](#2-cross-module-entity-diagram)
3. [Connect — workspaces, data_sources](#3-connect)
4. [Shell — workspace_settings](#4-shell)
5. [Explore — schema snapshots + profiling](#5-explore)
6. [Govern — permissions + audit](#6-govern)
7. [Model — models, runs, lineage](#7-model)
8. [Test — tests, runs, results](#8-test)
9. [Document — docs + chat](#9-document)
10. [Translate — snippets + test results](#10-translate)
11. [Konvencie](#11-konvencie)

---

## 1. Prehľad vlastníctva tabuliek

**26 tabuliek celkom.**

| Tabuľka | Vlastník | Závisí od |
|---|---|---|
| `workspaces` | Connect | — |
| `data_sources` | Connect | `workspaces` |
| `workspace_settings` | Shell | `workspaces` |
| `schema_snapshots` | Explore | `data_sources` |
| `schema_changes` | Explore | `data_sources`, `schema_snapshots` |
| `table_profiles` | Explore | `data_sources` |
| `column_profiles` | Explore | `data_sources`, `table_profiles` |
| `source_permissions` | Govern | `data_sources` |
| `table_permissions` | Govern | `data_sources` |
| `column_metadata` | Govern | `data_sources` |
| `approval_settings` | Govern | `workspaces` |
| `audit_entries` | Govern | `workspaces`, `data_sources` |
| `models` | Model | `workspaces` |
| `model_runs` | Model | `workspaces`, `models` |
| `lineage_edges` | Model | `workspaces`, `models` |
| `tests` | Test | `workspaces`, `models` |
| `test_runs` | Test | `workspaces`, `model_runs` |
| `test_results` | Test | `test_runs`, `tests` |
| `table_descriptions` | Document | `data_sources` |
| `column_descriptions` | Document | `data_sources` |
| `business_terms` | Document | `workspaces` |
| `relationships` | Document | `workspaces`, `data_sources` |
| `conventions` | Document | `workspaces` |
| `chat_messages` | Document | `workspaces` |
| `translate_snippets` | Translate | `workspaces`, `models` |
| `translate_test_results` | Translate | `translate_snippets` |

---

## 2. Cross-module entity diagram

Len entity mená + FK línie — bez stĺpcov. Pre detailné schémy pozri sekcie 3–9.

```mermaid
erDiagram
    workspaces ||--o{ data_sources : "has"
    workspaces ||--o| workspace_settings : "has"
    workspaces ||--o| approval_settings : "has"
    workspaces ||--o{ models : "has"
    workspaces ||--o{ model_runs : "has"
    workspaces ||--o{ tests : "has"
    workspaces ||--o{ test_runs : "has"
    workspaces ||--o{ business_terms : "has"
    workspaces ||--o{ relationships : "has"
    workspaces ||--o{ conventions : "has"
    workspaces ||--o{ chat_messages : "has"
    workspaces ||--o{ audit_entries : "has"

    data_sources ||--o{ schema_snapshots : "has"
    data_sources ||--o{ schema_changes : "has"
    data_sources ||--o{ table_profiles : "has"
    data_sources ||--o{ column_profiles : "has"
    data_sources ||--o| source_permissions : "has"
    data_sources ||--o{ table_permissions : "has"
    data_sources ||--o{ column_metadata : "has"
    data_sources ||--o{ audit_entries : "involves"
    data_sources ||--o{ table_descriptions : "has"
    data_sources ||--o{ column_descriptions : "has"
    data_sources ||--o{ relationships : "from"
    data_sources ||--o{ relationships : "to"

    schema_snapshots ||--o{ schema_changes : "from"
    schema_snapshots ||--o{ schema_changes : "to"

    table_profiles ||--o{ column_profiles : "has"

    models ||--o{ lineage_edges : "from"
    models ||--o{ lineage_edges : "to"
    models ||--o{ model_runs : "triggers"
    models ||--o{ tests : "has"

    model_runs ||--o{ test_runs : "triggers"

    test_runs ||--o{ test_results : "has"
    tests ||--o{ test_results : "has"

    models ||--o{ translate_snippets : "has"
    workspaces ||--o{ translate_snippets : "has"
    translate_snippets ||--o{ translate_test_results : "has"
```

---

## 3. Connect

```mermaid
erDiagram
    workspaces {
        TEXT id PK
        TEXT name
        TEXT description
        TEXT ai_mode
        INTEGER is_archived
        TEXT created_at
        TEXT updated_at
    }

    data_sources {
        TEXT id PK
        TEXT workspace_id FK
        TEXT name
        TEXT db_type
        TEXT connection_mode
        TEXT connection_credentials_encrypted
        TEXT connection_settings_json
        TEXT status
        TEXT last_tested_at
        TEXT created_at
        TEXT updated_at
    }

    workspaces ||--o{ data_sources : "has"
```

### Enum values

| Stĺpec | Hodnoty |
|---|---|
| `workspaces.ai_mode` | `auto` / `documentation` / `queries` / `manual` — default `auto` |
| `data_sources.db_type` | `postgres` / `mssql` / `mysql` / `duckdb` |
| `data_sources.connection_mode` | `form` / `connection_string` |
| `data_sources.status` | `active` / `error` / `pending` |

### connection_credentials_encrypted shape

Uložené ako base64-encoded AES-256-GCM ciphertext (`AIBIO_ENCRYPTION_KEY`). Desifrovanie prebieha in-memory v Connect adapter factory — nikdy nie je uložené v plaintext forme. Nikdy sa neloguje, nikdy nejde do LLM kontextu.

Plaintext pred šifrovaním:

```json
// form mode
{
  "host": "localhost",
  "port": 5432,
  "user": "readonly",
  "password": "...",
  "database": "northwind"
}

// connection_string mode
{
  "connection_string": "postgresql://readonly:...@localhost:5432/northwind"
}
```

### connection_settings_json shape

Behaviorálne nastavenia per source. Bezpečné pre logging.

```json
{
  "ssl_mode": "prefer",
  "query_timeout_sec": 30,
  "max_connections": 5
}
```

`query_timeout_sec: null` = zdedí `workspace_settings.query_timeout_sec`. `ssl_mode` hodnoty: `disable` / `allow` / `prefer` / `require`.

---

## 4. Shell

Shell nevlastní žiadne business-logic tabuľky — len `workspace_settings` pre perzistentné workspace-level nastavenia naprieč všetkými sub-modulmi.

```mermaid
erDiagram
    workspaces {
        TEXT id PK
    }

    workspace_settings {
        TEXT id PK
        TEXT workspace_id FK
        INTEGER query_timeout_sec
        INTEGER auto_profile_on_source_add
        INTEGER profile_sample_threshold_rows
        INTEGER top_values_per_column
        INTEGER schema_change_auto_detect
        INTEGER pii_heuristics_enabled
        INTEGER self_heal_max_retries
        INTEGER parallel_build_concurrency
        INTEGER auto_run_tests_after_materialize
        INTEGER ai_test_generation_enabled
        INTEGER test_execution_timeout_sec
        INTEGER failing_pk_samples_count
        INTEGER auto_write_docs
        TEXT doc_verbosity
        TEXT doc_confidence_threshold
        INTEGER show_tool_calls
        INTEGER max_supervisor_turns
        INTEGER session_timeout_min
        INTEGER chat_history_retention_count
        INTEGER test_parallel_concurrency
        INTEGER include_sample_data_in_docs
        INTEGER max_session_tokens
        TEXT updated_at
    }

    workspaces ||--o| workspace_settings : "has"
```

### Defaults

| Stĺpec | Default | Modul-owner nastavenia | Tier |
|---|---|---|---|
| `query_timeout_sec` | `30` | Connect | Core |
| `auto_profile_on_source_add` | `1` | Explore | Core |
| `profile_sample_threshold_rows` | `1000000` | Explore | Polish |
| `top_values_per_column` | `10` | Explore | Polish |
| `schema_change_auto_detect` | `1` | Explore | Core |
| `pii_heuristics_enabled` | `1` | Explore | Core |
| `self_heal_max_retries` | `3` | Model | Core |
| `parallel_build_concurrency` | `4` | Model | Core |
| `auto_run_tests_after_materialize` | `1` | Test | Core |
| `ai_test_generation_enabled` | `1` | Test | Core |
| `test_execution_timeout_sec` | `30` | Test | Polish |
| `failing_pk_samples_count` | `5` | Test | Polish |
| `auto_write_docs` | `1` | Document | Core |
| `doc_verbosity` | `standard` | Document | Core |
| `doc_confidence_threshold` | `high` | Document | Core |
| `show_tool_calls` | `1` | Shell | Core |
| `max_supervisor_turns` | `20` | Shell | Polish |
| `session_timeout_min` | `60` | Shell | Polish |
| `chat_history_retention_count` | `100` | Shell | Polish |
| `test_parallel_concurrency` | `8` | Test | Polish |
| `include_sample_data_in_docs` | `0` | Document | Core |
| `max_session_tokens` | `100000` | Core | Polish |

### Unique constraints

- `workspace_id` — 1:1 per workspace, record vzniká pri vytvorení workspace s defaultnými hodnotami.

### Poznámky

- `doc_verbosity` ovplyvňuje ako detailne `interviewer` formuluje otázky. Hodnoty: `minimal` / `standard` / `detailed`.
- `max_session_tokens` — token budget per supervisor session (input + output kumulatívne). Pri 80% sa emituje `budget_warning` SSE event; pri 100% supervisor zastaví dispatch. Konfigurovateľné per-workspace. Default `100_000`.
- `doc_confidence_threshold` — minimálna confidence úroveň pre automatický zápis bez approval gate. Záznamy s confidence *pod* touto hranicou triggrujú `write_to_docs` approval gate. Default `high`: záznamy s `confidence='medium'` alebo `'low'` vyžadujú approval; len `'high'` sa zapisuje automaticky. Nastavením na `medium` = approval len pre `low`-confidence; `low` = approval nikdy.
- `profile_sample_threshold_rows` — tabuľky s počtom riadkov nad touto hodnotou sú profilované cez `SAMPLE 10%` namiesto full scan; ovplyvňuje čo sa ukladá do `column_profiles`.
- `top_values_per_column` — maximálny počet hodnôt ukladaných do `column_profiles.top_values_json`.
- `failing_pk_samples_count` — maximálny počet PK hodnôt ukladaných do `test_results.failing_pk_samples_json`.
- Per-source `query_timeout_sec` override žije v `data_sources.connection_settings_json.query_timeout_sec` — ak je `null`, fallback na `workspace_settings.query_timeout_sec`.

---

## 5. Explore

```mermaid
erDiagram
    data_sources {
        TEXT id PK
    }

    schema_snapshots {
        TEXT id PK
        TEXT data_source_id FK
        TEXT snapshot_json
        INTEGER table_count
        INTEGER column_count
        TEXT taken_at
        TEXT created_at
    }

    schema_changes {
        TEXT id PK
        TEXT data_source_id FK
        TEXT from_snapshot_id FK
        TEXT to_snapshot_id FK
        TEXT change_type
        TEXT table_name
        TEXT column_name
        TEXT detail_json
        TEXT detected_at
    }

    table_profiles {
        TEXT id PK
        TEXT data_source_id FK
        TEXT table_name
        INTEGER row_count
        INTEGER is_reference_table
        TEXT sample_permission_override
        TEXT profiled_at
        TEXT created_at
        TEXT updated_at
    }

    column_profiles {
        TEXT id PK
        TEXT table_profile_id FK
        TEXT data_source_id FK
        TEXT table_name
        TEXT column_name
        TEXT data_type
        INTEGER null_count
        REAL null_rate
        INTEGER distinct_count
        TEXT top_values_json
        TEXT min_value
        TEXT max_value
        REAL mean_value
        TEXT percentiles_json
        TEXT string_length_distribution_json
        TEXT profiled_at
    }

    data_sources ||--o{ schema_snapshots : "has"
    data_sources ||--o{ schema_changes : "has"
    data_sources ||--o{ table_profiles : "has"
    data_sources ||--o{ column_profiles : "has"
    table_profiles ||--o{ column_profiles : "has"
    schema_snapshots ||--o{ schema_changes : "from"
    schema_snapshots ||--o{ schema_changes : "to"
```

### Enum values

| Stĺpec | Hodnoty |
|---|---|
| `schema_changes.change_type` | `table_added` / `table_removed` / `column_added` / `column_removed` / `column_type_changed` / `column_nullability_changed` |
| `table_profiles.sample_permission_override` | `NULL` (inherit source tier) / `allow` / `deny` |

### snapshot_json shape

```json
{
  "tables": [
    {
      "name": "invoices",
      "native_comment": "...",
      "columns": [
        { "name": "InvoiceId", "type": "INTEGER", "nullable": false, "is_pk": true }
      ],
      "foreign_keys": [
        { "column": "CustomerId", "ref_table": "customers", "ref_column": "CustomerId" }
      ]
    }
  ]
}
```

### Unique constraints

- `(data_source_id, table_name)` na `table_profiles`
- `(table_profile_id, column_name)` na `column_profiles`

### Poznámky

- `schema_changes.from_snapshot_id` je **nullable** — pri prvej introspekcii source-u neexistuje predchádzajúci snapshot.
- `schema_changes.column_name` je **nullable** — pre `change_type=table_added` / `table_removed` sa zmena netýka konkrétneho stĺpca.
- `column_profiles.data_source_id` a `column_profiles.table_name` sú redundantné (dostupné cez `table_profile_id → table_profiles`), ale ponechané pre efektivitu priamych dotazov bez JOIN (napr. "všetky profily pre tabuľku X v source Y").

---

## 6. Govern

```mermaid
erDiagram
    workspaces {
        TEXT id PK
    }

    data_sources {
        TEXT id PK
    }

    source_permissions {
        TEXT id PK
        TEXT data_source_id FK
        TEXT permission_tier
        TEXT created_at
        TEXT updated_at
    }

    table_permissions {
        TEXT id PK
        TEXT data_source_id FK
        TEXT table_name
        TEXT permission_override
        TEXT created_at
        TEXT updated_at
    }

    column_metadata {
        TEXT id PK
        TEXT data_source_id FK
        TEXT table_name
        TEXT column_name
        INTEGER pii_candidate
        TEXT pii_candidate_reason
        TEXT pii_classification
        TEXT pii_subtype
        TEXT set_by
        TEXT created_at
        TEXT updated_at
    }

    approval_settings {
        TEXT id PK
        TEXT workspace_id FK
        TEXT default_permission_tier_new_source
        TEXT policy_execute_query
        TEXT policy_share_results
        TEXT policy_write_to_docs
        TEXT policy_schema_introspect
        INTEGER approval_timeout_sec
        TEXT created_at
        TEXT updated_at
    }

    audit_entries {
        TEXT id PK
        TEXT workspace_id FK
        TEXT data_source_id FK
        TEXT session_id
        TEXT agent_name
        TEXT action_type
        TEXT table_name
        TEXT column_names_json
        TEXT outcome
        TEXT detail_json
        TEXT created_at
    }

    data_sources ||--o| source_permissions : "has"
    data_sources ||--o{ table_permissions : "has"
    data_sources ||--o{ column_metadata : "has"
    data_sources ||--o{ audit_entries : "involves"
    workspaces ||--o| approval_settings : "has"
    workspaces ||--o{ audit_entries : "has"
```

### Enum values

| Stĺpec | Hodnoty |
|---|---|
| `source_permissions.permission_tier` | `metadata_only` / `with_reference_samples` / `with_full_samples` / `with_query_results` |
| `table_permissions.permission_override` | rovnaké ako `permission_tier` |
| `column_metadata.pii_classification` | `none` / `pii` / `sensitive` / `NULL` (unclassified) |
| `column_metadata.pii_subtype` | `email` / `phone` / `national_id` / `address` / `ip` / `name` / `date_of_birth` / `iban` / `other` / `NULL` |
| `column_metadata.set_by` | `user` / `heuristic` |
| `approval_settings.default_permission_tier_new_source` | `metadata_only` / `with_reference_samples` / `with_full_samples` / `with_query_results` |
| `approval_settings.policy_execute_query` | `always_ask` / `never_ask` / `threshold_based` |
| `approval_settings.policy_share_results` | `always_ask` / `never_ask` / `auto_reference` |
| `approval_settings.policy_write_to_docs` | `always_ask` / `threshold_based` / `never_ask` |
| `approval_settings.policy_schema_introspect` | `never_ask` / `always_ask` |
| `audit_entries.action_type` | `read_schema` / `read_sample` / `run_query` / `share_results` / `write_doc` / `write_model` / `write_test` |
| `audit_entries.outcome` | `allowed` / `blocked` / `approval_granted` / `approval_denied` / `timeout` |

### Defaults — approval_settings

| Stĺpec | Default | Tier |
|---|---|---|
| `default_permission_tier_new_source` | `metadata_only` | Core |
| `policy_execute_query` | `always_ask` | Core |
| `policy_share_results` | `always_ask` | Core |
| `policy_write_to_docs` | `threshold_based` | Core |
| `policy_schema_introspect` | `never_ask` | Polish |
| `approval_timeout_sec` | `300` | Polish |

### Unique constraints

- `data_source_id` na `source_permissions` (1:1 per source)
- `workspace_id` na `approval_settings` (1:1 per workspace)
- `(data_source_id, table_name)` na `table_permissions`
- `(data_source_id, table_name, column_name)` na `column_metadata`

### Poznámky

- `audit_entries.data_source_id` je **nullable** — niektoré akcie (napr. `write_doc` pre `business_terms`) sa netýkajú konkrétneho source.
- `audit_entries.session_id` odkazuje na `session_id` z `chat_messages` (nie FK — sessions sú in-memory, `session_id` je len korelačný string). Umožňuje AuditLogViewer filtrovať "čo sa stalo počas tejto session".
- **Query result cache** — `guarded_run_select_query` cachuje výsledky in-memory (`Map<string, QueryResult>` v server procese) pod `query_result_id`. Nie je perzistovaný do SQLite — zámerom je GDPR: raw query výsledky sa neukladajú dlhšie ako je nevyhnutné. Cache expiruje pri reštarte servera. `guarded_share_results` číta z tejto cache; volanie je obmedzené na rovnakú session. **Known limitation:** reštart servera medzi `run_query` a `share_results` zmaže cache → user dostane `results_expired` error.
- **Permission resolution pre `guarded_sample_data()`** — pri rozhodnutí či poskytnúť sample dáta platí táto prioritná hierarchia (vyššie = silnejšie):
  1. **PII columns** (`column_metadata.pii_classification != 'none'`) — daný stĺpec sa vždy maskuje alebo vylúčí, bez ohľadu na čokoľvek iné
  2. **Govern per-table override** (`table_permissions.permission_override IS NOT NULL`) — prepisuje source tier pre danú tabuľku (Govern je enforcement layer)
  3. **Explore reference flag** (`table_profiles.sample_permission_override IS NOT NULL`) — per-table `allow`/`deny` nastavený keď user označí tabuľku ako reference; aplikuje sa iba ak Govern nemá explicitný override pre túto tabuľku
  4. **Source tier** (`source_permissions.permission_tier`) — source-level default, uplatní sa ak ani Govern ani Explore nemajú override

  Teda: `table_permissions.permission_override` (Govern) a `table_profiles.sample_permission_override` (Explore) nie sú duplikáty — sú to dve vrstvy so Govern majúcim prednosť. Explore nastavuje `sample_permission_override` automaticky keď user flaguje reference table; Govern môže túto hodnotu nezávisle prepísať.
- **Audit log retention** — `audit_entries` sú retention 1 rok od `created_at`. Mesačná rotácia (archívácia starých záznamov) sa riadi background jobom (implementovaný v Phase G1). GDPR delete request flow: keď user zmaže workspace, všetky `audit_entries.workspace_id = X` sú tombstone-marked (soft delete cez `deleted_at` timestamp) a fyzicky vymazané po 30 dňoch archívu. Raw query výsledky (`guarded_run_select_query` cache) nie sú perzistované — GDPR compliance pre query data je riešená in-memory TTL.

---

## 7. Model

```mermaid
erDiagram
    workspaces {
        TEXT id PK
    }

    models {
        TEXT id PK
        TEXT workspace_id FK
        TEXT name
        TEXT layer
        TEXT materialization
        TEXT status
        TEXT file_path
        TEXT description
        INTEGER is_dirty
        TEXT last_run_status
        TEXT last_run_at
        TEXT created_at
        TEXT updated_at
    }

    model_runs {
        TEXT id PK
        TEXT workspace_id FK
        TEXT triggering_model_id FK
        TEXT parent_run_id FK
        TEXT session_id
        TEXT run_scope
        TEXT status
        TEXT models_affected_json
        TEXT started_at
        TEXT finished_at
        TEXT error_message
        INTEGER self_heal_attempt
        INTEGER models_total
        INTEGER models_succeeded
        INTEGER models_failed
    }

    lineage_edges {
        TEXT id PK
        TEXT workspace_id FK
        TEXT from_model_id FK
        TEXT to_model_id FK
        TEXT from_source_ref
        TEXT ref_type
        TEXT created_at
    }

    workspaces ||--o{ models : "has"
    workspaces ||--o{ model_runs : "has"
    workspaces ||--o{ lineage_edges : "has"
    models ||--o{ lineage_edges : "from"
    models ||--o{ lineage_edges : "to"
    models ||--o{ model_runs : "triggers"
```

### Enum values

| Stĺpec | Hodnoty |
|---|---|
| `models.layer` | `staging` / `intermediate` / `marts` |
| `models.materialization` | `table` / `view` / `incremental` — default `table` |
| `models.status` | `draft` / `active` / `archived` — default `draft` |
| `models.last_run_status` | `NULL` (nikdy nebežal) / `success` / `failed` / `approval_denied` |
| `model_runs.run_scope` | `single` / `all` |
| `model_runs.status` | `pending` / `running` / `success` / `failed` / `approval_denied` |
| `lineage_edges.ref_type` | `model_ref` / `source_ref` |

### Unique constraints

- `(workspace_id, name)` na `models`

### Poznámky

- `models.last_run_status` + `models.last_run_at` — denormalizované polia pre ModelExplorer tree view. Aktualizujú sa po každom `model_run` completion bez JOIN na `model_runs`. `NULL` = model ešte nikdy nebol materializovaný.
- `model_runs.triggering_model_id` je **nullable** — pre `run_scope=all` nie je jeden triggering model. Pre `run_scope=single` ukazuje na konkrétny model, čo umožňuje query "všetky runs pre model X" bez JSON parsovania.
- `model_runs.session_id` — korelačný string z `chat_messages.session_id`; nullable (NULL pre programmaticky spustené runy bez chat kontextu).
- `model_runs.models_total/succeeded/failed` — nullable; vyplňajú sa postupne počas behu. Po dokončení: `models_total = models_succeeded + models_failed`.
- `model_runs.parent_run_id` je **nullable self-referential FK** — pre self-heal retry runs odkazuje na pôvodný run (`self_heal_attempt=0`). Umožňuje zobraziť reťazec `original → retry 1 → retry 2` v run history paneli. Pôvodné runs (`parent_run_id IS NULL`) sú vždy koreňom reťazca.
- `model_runs.self_heal_attempt` — číslo pokusu: `0` = pôvodný run, `1/2/3` = retry N po SQL chybe.
- `model_runs.workspace_id` — redundantné (dostupné cez `triggering_model_id → models.workspace_id`), ale ponechané pre efektivitu: pri `run_scope=all` je `triggering_model_id` NULL a JOIN by bol zbytočný.
- `lineage_edges.from_model_id` je **nullable** — pre `ref_type=source_ref` neexistuje from model; v tom prípade `from_source_ref` obsahuje `"src.table_name"`.
- `lineage_edges` nemá UNIQUE constraint — lineage je vždy plne rebuildovaná (`parse_lineage` tool: DELETE WHERE workspace_id + INSERT all). Duplikáty nemôžu vzniknúť.
- `models.is_dirty = 1` — súbor bol manuálne editovaný od posledného AI write. AI neprepíše bez explicit potvrdzenia.

### models_affected_json shape

```json
["stg_invoices", "stg_customers", "dim_customer"]
```

---

## 8. Test

```mermaid
erDiagram
    workspaces {
        TEXT id PK
    }

    models {
        TEXT id PK
        TEXT name
    }

    model_runs {
        TEXT id PK
    }

    tests {
        TEXT id PK
        TEXT workspace_id FK
        TEXT model_id FK
        TEXT test_type
        TEXT test_name
        TEXT table_name
        TEXT column_names_json
        TEXT config_json
        TEXT file_path
        TEXT severity
        TEXT created_by
        INTEGER is_enabled
        TEXT created_at
        TEXT updated_at
    }

    test_runs {
        TEXT id PK
        TEXT workspace_id FK
        TEXT model_run_id FK
        TEXT session_id
        TEXT triggered_by
        TEXT status
        INTEGER total_count
        INTEGER passed_count
        INTEGER failed_count
        INTEGER errored_count
        TEXT started_at
        TEXT finished_at
    }

    test_results {
        TEXT id PK
        TEXT test_run_id FK
        TEXT test_id FK
        TEXT status
        INTEGER failing_row_count
        TEXT failing_pk_samples_json
        TEXT error_message
        TEXT executed_at
    }

    workspaces ||--o{ tests : "has"
    workspaces ||--o{ test_runs : "has"
    models ||--o{ tests : "has"
    model_runs ||--o{ test_runs : "triggers"
    test_runs ||--o{ test_results : "has"
    tests ||--o{ test_results : "has"
```

### Enum values

| Stĺpec | Hodnoty |
|---|---|
| `tests.test_type` | `unique` / `not_null` / `foreign_key` / `accepted_values` / `custom` |
| `tests.severity` | `error` / `warn` |
| `tests.created_by` | `user` / `ai_generated` |
| `test_runs.triggered_by` | `post_materialize` / `manual` / `self_heal` |
| `test_runs.status` | `pending` / `running` / `passed` / `failed` / `errored` |
| `test_results.status` | `passed` / `failed` / `errored` |

### Unique constraints

- `(test_run_id, test_id)` na `test_results` — jeden test môže byť v rámci jedného runu len raz.

### Poznámky

- `tests.test_name` — nullable; human-readable názov (napr. `"stg_orders unique InvoiceId"`). Ak NULL, UI generuje z `test_type + table_name + column_names_json`.
- `tests.table_name` — nullable; denormalizovaný pre rýchle dotazy "všetky testy pre tabuľku X" bez JSON parsovania `column_names_json`.
- `tests.is_enabled` — boolean, default `1`; umožňuje dočasne zakázať test bez jeho zmazania.
- `test_runs.session_id` — nullable; korelačný string z `chat_messages.session_id`; pre filtrovanie v AuditLog "čo sa testovalo v tejto session".
- `tests.model_id FK` → `models.id` s **ON DELETE CASCADE** — keď sa model zmaže, jeho testy sa zmažú tiež. Zabraňuje orphaned test records.
- `tests.workspace_id` je redundantný (dostupný cez `model_id → models.workspace_id`), ale ponechaný pre efektivitu dotazov "všetky testy pre workspace" bez JOIN.
- `test_runs.model_run_id` je **nullable** — pri `triggered_by=manual` nie je parent model_run.

### config_json shapes per test_type

```json
// unique — žiadna config
{}

// not_null — žiadna config
{}

// foreign_key
{ "ref_model": "dim_customer", "ref_column": "customer_id" }

// accepted_values
{ "values": ["Active", "Inactive", "Pending"] }

// custom — SQL je v file_path, config_json nie je použitý
{}
```

### failing_pk_samples_json shape

```json
["1042", "1087", "1103"]
```

Max 5 hodnôt. GDPR-aware: len PK, nie full row.

---

## 9. Document

```mermaid
erDiagram
    workspaces {
        TEXT id PK
    }

    data_sources {
        TEXT id PK
    }

    table_descriptions {
        TEXT id PK
        TEXT data_source_id FK
        TEXT table_name
        TEXT description
        TEXT business_definition
        TEXT owner
        TEXT classification
        TEXT domain
        TEXT tags_json
        TEXT usage_notes
        TEXT update_frequency
        TEXT confidence
        TEXT source_attribution
        TEXT created_at
        TEXT updated_at
    }

    column_descriptions {
        TEXT id PK
        TEXT data_source_id FK
        TEXT table_name
        TEXT column_name
        TEXT description
        TEXT business_definition
        TEXT business_name
        TEXT logical_type
        TEXT unit_of_measure
        TEXT pii_classification
        TEXT valid_values_json
        TEXT calculation
        TEXT example_values
        TEXT format_notes
        INTEGER is_nullable_expected
        TEXT confidence
        TEXT source_attribution
        TEXT created_at
        TEXT updated_at
    }

    business_terms {
        TEXT id PK
        TEXT workspace_id FK
        TEXT term
        TEXT definition
        TEXT synonyms_json
        TEXT domain
        TEXT examples_json
        TEXT confidence
        TEXT source_attribution
        TEXT created_at
        TEXT updated_at
    }

    relationships {
        TEXT id PK
        TEXT workspace_id FK
        TEXT from_data_source_id FK
        TEXT from_table_name
        TEXT from_column_name
        TEXT to_data_source_id FK
        TEXT to_table_name
        TEXT to_column_name
        TEXT rel_type
        TEXT description
        TEXT cardinality
        TEXT confidence
        TEXT source_attribution
        TEXT created_at
        TEXT updated_at
    }

    conventions {
        TEXT id PK
        TEXT workspace_id FK
        TEXT title
        TEXT description
        TEXT category
        TEXT examples_json
        TEXT confidence
        TEXT source_attribution
        TEXT created_at
        TEXT updated_at
    }

    chat_messages {
        TEXT id PK
        TEXT workspace_id FK
        TEXT session_id
        TEXT role
        TEXT content
        TEXT agent_name
        TEXT active_module
        TEXT created_at
    }

    data_sources ||--o{ table_descriptions : "has"
    data_sources ||--o{ column_descriptions : "has"
    data_sources ||--o{ relationships : "from"
    data_sources ||--o{ relationships : "to"
    workspaces ||--o{ business_terms : "has"
    workspaces ||--o{ relationships : "has"
    workspaces ||--o{ conventions : "has"
    workspaces ||--o{ chat_messages : "has"
```

### Enum values

| Stĺpec | Hodnoty |
|---|---|
| `table_descriptions.classification` | `public` / `internal` / `restricted` / `pii` |
| `*.confidence` | `high` / `medium` / `low` |
| `*.source_attribution` | `db_native` / `ai_generated` / `user_authored` / `user_confirmed` |
| `column_descriptions.logical_type` | `identifier` / `date` / `currency` / `text` / `enum` / `count` / `ratio` / `flag` / `other` |
| `column_descriptions.pii_classification` | `none` / `pii` / `sensitive` |
| `relationships.rel_type` | `fk` / `logical` / `cross_source_logical` |
| `relationships.cardinality` | `1:1` / `1:N` / `N:M` |
| `conventions.category` | `naming` / `transformation` / `modeling` / `testing` / `documentation` / `other` |
| `chat_messages.role` | `user` / `assistant` |
| `chat_messages.active_module` | `connect` / `explore` / `govern` / `model` / `document` / `test` / `translate` / `export` / `NULL` |

### Unique constraints

- `(data_source_id, table_name)` na `table_descriptions`
- `(data_source_id, table_name, column_name)` na `column_descriptions`
- `(workspace_id, term)` na `business_terms`

### Poznámky

- `chat_messages.active_module` — URL sub-modul aktívny v čase odoslania správy. Supervisor ho berie do úvahy pri intent classification; persist-ovanie umožňuje rekonštruovať session kontext a zobraziť modul-badge pri správach v histórii. Nullable: `NULL` pre staré správy pred migráciou.
- `chat_messages.agent_name` — nullable pre `role=user` správy.

### PII zrkadlenie

`column_descriptions.pii_classification` je mirror z `column_metadata.pii_classification`. Govern je source of truth — `docs-keeper` číta z `column_metadata` a kopíruje hodnotu pri `write_doc_record`. Nikdy nenastavuje unilaterálne.

---

## 10. Translate

```mermaid
erDiagram
    workspaces {
        TEXT id PK
    }

    models {
        TEXT id PK
    }

    translate_snippets {
        TEXT id PK
        TEXT workspace_id FK
        TEXT model_id FK
        TEXT language_id
        TEXT variant
        TEXT code
        TEXT confidence
        TEXT limitations_json
        INTEGER stale
        INTEGER is_custom
        TEXT custom_note
        TEXT generated_at
        TEXT updated_at
        TEXT generator_version
        INTEGER version
        TEXT deleted_at
    }

    translate_test_results {
        TEXT id PK
        TEXT snippet_id FK
        TEXT tier
        TEXT status
        INTEGER ground_truth_row_count
        TEXT ground_truth_schema_json
        INTEGER generated_row_count
        TEXT generated_schema_json
        INTEGER schema_match
        INTEGER row_count_match
        INTEGER data_equivalent
        TEXT column_diffs_json
        TEXT row_diffs_json
        TEXT error
        INTEGER duration_ms
        TEXT tested_at
    }

    workspaces ||--o{ translate_snippets : "has"
    models ||--o{ translate_snippets : "has"
    translate_snippets ||--o{ translate_test_results : "has"
```

### Enum values

| Stĺpec | Hodnoty |
|---|---|
| `translate_snippets.language_id` | LanguageId z Language Registry (napr. `sql:duckdb`, `python:pandas`, `bi:dax`, `kql:adx`, ...) |
| `translate_snippets.confidence` | `high` / `medium` / `low` |
| `translate_snippets.is_custom` | `0` (AI-generated) / `1` (user manually edited) |
| `translate_test_results.tier` | `full_exec` / `sandbox` / `syntax_only` / `gen_only` — z Language Registry |
| `translate_test_results.status` | `passed` / `failed` / `syntax_ok` / `syntax_error` / `runtime_error` / `timeout` / `generated_only` |

### Poznámky

- `translate_snippets.is_custom` — `1` ak user manuálne editoval snippet. UI zobrazí badge "Custom". Regenerácia prepíše custom snippet bez upozornenia iba ak user potvrdí.
- `translate_snippets.custom_note` — nullable; voľný text poznámky pri custom snippete (napr. "Adapted for Power BI Embedded").
- `translate_snippets.updated_at` — timestamp poslednej aktualizácie (buď AI generácia alebo user edit). Líši sa od `generated_at` (len čas AI generácie).
- `translate_snippets.stale` — `1` ak model SQL bol zmenený po generácii snippetu. Snippet je stále dostupný na kopírovanie, ale UI zobrazí warning. Nastavené na `1` v `model/lib/model-service.ts` — funkcia `updateModelSql()` po každom úspešnom `write_model_file` volá `UPDATE translate_snippets SET stale = 1 WHERE model_id = ? AND deleted_at IS NULL`.
- `translate_snippets.version` — história: posledných 5 verzií per `(model_id, language_id)` je zachovaných. Staršie sú soft-deleted: `deleted_at` je nastavené na aktuálny ISO timestamp; `NULL` = aktívny záznam. Soft-delete prebieha v `generate_snippet` handleri — po uložení novej verzie sa záznamy s `version <= (current - 5)` pre daný `(model_id, language_id)` soft-deletujú.
- `translate_snippets.limitations_json` — JSON array stringov: limitácie ktoré agent zaznamenal pri generácii (napr. `["QUALIFY clause not available in target dialect — used CTE workaround"]`).
- `translate_test_results.column_diffs_json` — JSON array `ColumnDiff` objektov, max 50 položiek.
- `translate_test_results.row_diffs_json` — JSON array `RowDiff` objektov, max 10 (prvých 10 rozdielov v sampled porovnaní).

### GDPR

Snippety neobsahujú dáta — iba generovaný kód. `translate_test_results` obsahuje schema info (column names + types) a row diffs (hodnoty z DuckDB execúcie). Row diffs môžu obsahovať non-PII hodnoty zo staging modelov. PII columns sú vylúčené z execution výsledkov — `translate-validator` stripuje PII columns pred uložením do `row_diffs_json`.

---

## 11. Konvencie

### ID generácia
Všetky PK sú `TEXT` UUID v4, generované na aplikačnej vrstve (`crypto.randomUUID()`). SQLite `INTEGER PRIMARY KEY AUTOINCREMENT` sa nepoužíva — UUIDs sú portable a nevyzrádzajú sekvenciu záznamov.

### Timestamps
Všetky timestamp stĺpce sú `TEXT` vo formáte ISO 8601 UTC: `2026-05-13T10:00:00.000Z`. Drizzle `.$defaultFn(() => new Date().toISOString())`.

### Boolean
SQLite nemá boolean — `INTEGER` s hodnotami `0` / `1`. Drizzle `.integer({ mode: 'boolean' })` mapuje transparentne na TypeScript `boolean`.

### JSON stĺpce
JSON je uložený ako `TEXT`. Drizzle custom type pre type-safe serialize/deserialize. Konvencia názvu: vždy suffix `_json` (napr. `top_values_json`, `tags_json`). Nikdy `null` — prázdne pole ako `"[]"`, prázdny objekt ako `"{}"`.

### Enum stĺpce
SQLite nemá native enums — `TEXT` s aplikačnou validáciou cez Zod schema na boundary. Zoznam hodnôt je definovaný ako TypeScript `as const` union v `core/types/`.

### Nullable FK stĺpce
Explicitne dokumentované v sekciách vyššie. Drizzle štandardne generuje nullable stĺpce (bez `.notNull()`). Nullable FK nemajú ON DELETE CASCADE — NULL zostáva NULL po zmazaní parent recordu.

### ON DELETE CASCADE
Explicitne len tam kde je to správanie žiaduce:
- `tests.model_id → models.id` — zmazanie modelu maže jeho testy
- `column_profiles.table_profile_id → table_profiles.id` — zmazanie table profile maže stĺpcové profily

Ostatné FK sú bez CASCADE — aplikačná vrstva zodpovedá za čistenie (napr. zmazanie data_source → aplikácia vyčistí downstream tabuľky).

### Singleton DB
Jeden `better-sqlite3` inštancia v procese, cez `globalThis.__aibio_db` guard pri Next.js hot reload. Pozri [core/GOAL.md](./00-core/GOAL.md).

### Composite indexy

Explicitne definované composite indexy pre najčastejšie dotazy. Drizzle ich generuje cez `.index()` v schéme.

| Tabuľka | Index | Dôvod |
|---|---|---|
| `audit_entries` | `(workspace_id, created_at DESC)` | AuditLogViewer — chronologický filter per workspace |
| `chat_messages` | `(workspace_id, session_id, created_at)` | Chat history reload po SSE reconnecte |
| `column_metadata` | `(data_source_id, table_name, pii_classification)` | PII Inventory panel — rýchly filter PII stĺpcov per source |
| `translate_snippets` | `(model_id, language_id)` | Snippet cache lookup — najčastejší prístupový vzor |
| `models` | `(workspace_id, layer)` | ModelExplorer tree view — groupBy layer |

---

## References

- Architektúra a ownership overview: [ARCHITECTURE.md](./ARCHITECTURE.md) — sekcia 12
- Drizzle implementácia: `core/db/client.ts` (Phase P0a)
- Per-modul schémy: `modules/ainderstanding/{module}/db/schema.ts`
- Typy: `core/types/` (Phase P0a)
