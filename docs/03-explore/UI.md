# Explore — UI/UX špecifikácia

*Súčasť [UI_UX.md](../UI_UX.md) · Funkčný spec: [GOAL.md](./GOAL.md)*

---

URL: `/workspace/[id]/explore`

## 1. Table Detail Tab

Otvorí sa kliknutím na tabuľku v schema navigátore. Obsahuje dve hlavné zóny.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📋 orders (warehouse.db)                    [⊕ Profile] [☐ Select]  │
├───────────────────────────────┬──────────────────────────────────────┤
│  COLUMNS (8)         [Filter] │  DATA PREVIEW                        │
│ ─────────────────────────     │  ─────────────────────────────────── │
│  ☐ id        INT PK  [L1]    │                                      │
│  ☐ cust_id   INT FK→ [L1]    │  🔒 LAYER 2 — DEFAULT DENY           │
│  ☐ amount    DEC      [L2]   │                                      │
│  ☐ status    VAR      [L1]   │  Sample dáta tejto tabuľky sú        │
│  ☐ note      TEXT     [?]    │  štandardne nedostupné pre AI.       │
│  ☐ created   TS       [L1]   │                                      │
│                               │  [✓ Mark as Reference Table]         │
│  [Select All] [Add to AI ↗]  │  [Request sample preview →]          │
│                               │                                      │
│ ─────────────────────────     │                                      │
│  PROFILE SUMMARY              │                                      │
│  Rows: ~2.4M                  │                                      │
│  Last profiled: 2h ago        │                                      │
│  [Re-profile]                 │                                      │
└───────────────────────────────┴──────────────────────────────────────┘
```

**Data preview states:**
1. `🔒 LAYER 2 — DEFAULT DENY` — defaultný stav, tabuľka nie je reference
2. `🟡 REFERENCE TABLE — SAMPLES ALLOWED` — tabuľka je flagovaná ako reference, zobrazia sa sample dáta (PII stĺpce sú maskované)
3. `🔒 LAYER 3 — REQUIRES APPROVAL` — query results, zobrazené po user approval

## 2. Reference Table Sample View

Keď tabuľka je referenčná (`[ref]` badge v navigátore):

```
┌──────────────────────────────────────────────────────────────────────┐
│  DATA SAMPLE — media_types (reference table, Layer 2 allowed)        │
│  ⚠ PII columns: none · Showing 10 of 5 rows                          │
├──────────────────────────────────────────────────────────────────────┤
│  id │  name                                                          │
│  1  │  MPEG audio file                                               │
│  2  │  Protected AAC audio file                                      │
│  3  │  Protected MPEG-4 video file                                   │
│  4  │  Purchased AAC audio file                                      │
│  5  │  AAC audio file                                                │
├──────────────────────────────────────────────────────────────────────┤
│  🟡 This data is visible to AI agents.                               │
│  [Remove reference flag]  [Manage column permissions →]              │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Column Profile Detail Tab

Otvorí sa kliknutím na column name alebo cez `→` ikonu.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◍ orders.amount                           [Add to AI context ☐]     │
├────────────────────────┬─────────────────────────────────────────────┤
│  METADATA              │  DISTRIBUTION (approximate)                 │
│                        │                                             │
│  Type:      DECIMAL    │  ▓▓▓▓▓▓▓▓▓▓ $0-100       1,204 rows (42%) │
│  Nullable:  No (0.0%)  │  ▓▓▓▓▓▓░░░░ $100-500       834 rows (29%) │
│  Distinct:  1,847      │  ▓▓▓░░░░░░░ $500-1000      412 rows (14%) │
│  Min:       $0.99      │  ▓▓░░░░░░░░ $1000+          397 rows (14%) │
│  Max:       $9,999.00  │                                             │
│  Mean:      $284.12    │  ~approximate (SAMPLE 10%)                  │
│  Median:    $189.50    │                                             │
│                        ├─────────────────────────────────────────────┤
│  GDPR:      [L2] ⚠     │  TOP VALUES                                 │
│  PII:       None       │  $9.99 → 234 occurrences                   │
│                        │  $14.99 → 198 occurrences                  │
│  [Classify →]          │  $19.99 → 156 occurrences                  │
│                        │  ...                                        │
│  GOVERNANCE            │                                             │
│  Doc: (none)  [+ Add]  │  NULL behavior: 0% nulls                   │
│                        │  String len: N/A (numeric)                 │
└────────────────────────┴─────────────────────────────────────────────┘
```

## 4. Schema Diff Viewer Tab

Zobrazí sa automaticky po re-introspection ak sa schéma zmenila.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⬡ Schema Changes Detected — warehouse.db          [Dismiss] [Review]│
├──────────────────────────────────────────────────────────────────────┤
│ Detected at: 14:35:02  ·  2 changes                                  │
│                                                                      │
│  ✚ orders.discount_pct   DECIMAL  (new column)        [Classify →]  │
│  ✎ customers.phone       VARCHAR(50) → VARCHAR(20) (type changed)   │
│                                                                      │
│ ⚠ Doc records may be stale. [Review documentation →]                │
│                                                                      │
│ [Accept all changes]                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

## 5. PII Candidates Panel

Zobrazí sa po profilovaní ako bottom panel tab alebo inline banner.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 PII CANDIDATES DETECTED (5)                      [Review All]    │
│ Based on column naming heuristics. Confirm or dismiss each.          │
├──────────────────────────────────────────────────────────────────────┤
│  customers.email       → Likely PII · Email      [✓ Confirm] [✗ Dismiss] │
│  customers.phone       → Likely PII · Phone      [✓ Confirm] [✗ Dismiss] │
│  customers.first_name  → Likely PII · Name       [✓ Confirm] [✗ Dismiss] │
│  customers.last_name   → Likely PII · Name       [✓ Confirm] [✗ Dismiss] │
│  orders.billing_addr   → Likely PII · Address    [✓ Confirm] [✗ Dismiss] │
│                                                                           │
│ [Confirm All]  [Dismiss All]                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Empty States

**Explore landing — source pridaný ale ešte nebola spustená introspekcia:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🧭 Explore — warehouse.db                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│          ○  Schema not yet loaded                                    │
│                                                                      │
│          Run schema introspection to see tables, columns,           │
│          and start profiling.                                       │
│                                                                      │
│          [⊕ Introspect schema →]                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Schéma načítaná ale profiling ešte nebehol:**

Na Table Detail Tab v sekcii PROFILE SUMMARY:
```
│ ─────────────────────────                                            │
│  PROFILE SUMMARY                                                     │
│  ○ Not profiled yet                                                  │
│  [⊕ Profile this table]                                             │
│  [⊕ Profile all tables]                                             │
```

Na Column Profile Detail Tab — ak stĺpec nie je profilovaný:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◍ orders.amount                           [Add to AI context ☐]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Type:     DECIMAL                                                   │
│  Nullable: Unknown                                                   │
│                                                                      │
│  ○  No profile data yet.                                             │
│     Profile the table to see distribution, NULL rate,               │
│     and top values.                                                 │
│                                                                      │
│  [⊕ Profile orders table →]                                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Profiling in progress — Table Detail Tab:**

```
│ ─────────────────────────                                            │
│  PROFILE SUMMARY                                                     │
│  ⟳ Profiling...  ████░░ 45%                                         │
│  4/8 columns profiled                                                │
│  [■ Cancel]                                                          │
```
