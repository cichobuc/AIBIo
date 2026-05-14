# Explore Sub-module — Business Rules

*BR-XPL = Explore Business Rules. Verzia 0.1. Pozri [GOAL](./GOAL.md) pre kontext.*

---

## Data exposure (GDPR)

**BR-XPL-001** — Schema metadata je vždy povolená  
Condition: Akákoľvek schema introspection operácia  
Rule: Table names, column names, types, FK, native comments sú Govern Vrstva 1 (default ALLOW). Explore nepotrebuje approval gate na ich čítanie.

**BR-XPL-002** — Sample dáta vyžadujú explicit permission  
Condition: Akýkoľvek request na sample rows z tabuľky  
Rule: Sample fetch je povolený len ak: (a) tabuľka má `is_reference_table = true`, ALEBO (b) user explicitne udelil per-query approval cez Govern. Default = DENY.

**BR-XPL-003** — PII heuristics sú name-based, nie content-based  
Condition: `detect_pii_candidates` tool call  
Rule: Heuristika matchuje iba column names (keyword list: `email`, `phone`, `ssn`, `birthdate`, atď.). Content-based detekcia (regex na sample values) je zakázaná v MVP — porušila by GDPR-first princíp.

**BR-XPL-004** — PII candidate je suggestion, nie enforcement  
Condition: `detect_pii_candidates` označí column  
Rule: Output je `pii_candidate = true` — iba flag. PII enforcement (masking, access control) vykonáva Govern, nie Explore. Explore len reportuje.

---

## Profiling rules

**BR-XPL-010** — Profiling ide cez guarded tools  
Condition: Každý `run_profile_query` call  
Rule: Volá sa cez Govern guarded wrapper, nie priamo cez Connect adapter. Govern permission check sa aplikuje.

**BR-XPL-011** — Sampling threshold pre veľké tabuľky  
Condition: Tabuľka má viac riadkov ako `profile_sample_threshold` (default 1 000 000)  
Rule: Profiler použije SAMPLE 10% namiesto full table scan. UI zobrazí *"approximate"* indicator pri affected column stats.

**BR-XPL-012** — Paralelný profiling per tabuľka je povinný  
Condition: `data-profiler` bežiaci na source s N tabuľkami  
Rule: `data-profiler` invokuje paralelné inštancie per tabuľka (nie sequential). Toto je key demo pattern architektúry — nie optimalizácia ktorú možno preskočiť.

**BR-XPL-013** — `top_values` je bounded  
Condition: `column_profiles.top_values` field  
Rule: DB stĺpec `top_values_json` uchováva max 20 hodnôt (hard DB limit). Počet zbieraných hodnôt riadi `top_values_count` setting (default 10, max 20). Viac sa nezbiera — tradeoff storage vs utility.

**BR-XPL-014** — Profile freshness je trackovaný  
Condition: `table_profiles` záznam  
Rule: Každý záznam má `profiled_at` timestamp. UI zobrazí *"profiled X ago"* indicator. Profil nie je automaticky invalidovaný — user inicializuje re-profil.

---

## Schema diff rules

**BR-XPL-020** — Schema diff je detekovaný pri re-introspection  
Condition: User spustí schema re-introspection  
Rule: Nový snapshot sa porovná s posledným. Rozdiely sú uložené ako `schema_changes` entries s `change_type` enum hodnotami: `table_added`, `table_removed`, `column_added`, `column_removed`, `column_type_changed`, `column_nullable_changed`.

**BR-XPL-021** — Schema diff triggeruje doc stale warning  
Condition: `schema_changes` obsahuje pridané alebo odebrané stĺpce/tabuľky  
Rule: Document sub-modul je notifikovaný. UI zobrazí *"Schema changed — review docs"* prompt.

---

## Reference table rules

**BR-XPL-030** — `is_reference_table` je user-controlled  
Condition: Reference table flag  
Rule: Source of truth je `table_profiles.is_reference_table`. Len user (alebo agent s explicit user approval) môže nastaviť tento flag. `data-profiler` môže len navrhnúť — nie zapísať priamo.

**BR-XPL-031** — Reference table suggestion je podmienená  
Condition: `suggest_reference_table_flags` tool call  
Rule: Tabuľka je navrhnutá ako reference ak sú splnené všetky tri podmienky: (a) row count < 10 000, AND (b) low cardinality distribúcia stĺpcov, AND (c) žiadne PII candidate columns.

---

## Automatické triggery

**BR-XPL-040** — Auto-profiling po pridaní source  
Condition: User pridá novú data source (`auto_profile_on_source_add = true`, default)  
Rule: `data-profiler` sa spustí automaticky po úspešnom uložení data source — bez nutnosti manuálneho triggeru. User môže auto-profiling vypnúť cez setting.

**BR-XPL-041** — Auto schema change detection pri otvorení workspace  
Condition: Workspace je otvorený (`schema_change_auto_detect = true`, default)  
Rule: `schema-explorer` automaticky spustí re-introspekciu a porovná s posledným snapshotom. Ak sú zistené zmeny, zobrazí sa diff v UI.

---

## PII candidate review

**BR-XPL-050** — PII kandidáti čakajú na user review pred Govern enforcement  
Condition: `data-profiler` označí column ako `pii_candidate = true`  
Rule: Column sa zobrazí v `PIICandidatesPanel` v Explore UI. User musí explicitne potvrdiť alebo zamietnuť každý kandidát. Až po potvrdení v Explore sa `column_permissions.pii_classification` nastaví v Govern (user-set flag). Bez user review = žiadna enforcement.
