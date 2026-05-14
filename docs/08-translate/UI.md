# Translate — UI/UX Spec

> **Phase 2 (post-MVP).** Translate UI sa implementuje v TR1. Tento dokument je index; detailné specs sú v GOAL.md a RULES.md §UI a UX.
>
> **Wireframe expansion note:** Rozšírenie wireframov tohto dokumentu sa plánuje na začiatok fázy TR1, nie v rámci P0.

---

## Prehľad komponentov

### Code Panel (embedded v Model)

Záložka "Code" vedľa "SQL" v model detail view. Zobrazí sa po dokončení aspoň jedného snippetu.

| Element | Popis | Ref |
|---|---|---|
| Language selector | Dropdown / tabs, max 5 naraz | LANGUAGES.md §Tier |
| Monaco editor | Read-only default; "Edit" → editable mode | BR-TRN-051 |
| Status badge | ✅ generated / ❌ failed / ℹ️ generating / 📄 stale | BR-TRN-022 |
| Action buttons | [Copy] [Regenerate] [Run & Compare] | GOAL.md §7 |
| Result pane | Row count, duration, equivalence status (DuckDB ground truth) | RULES.md §Execution |

### Translate Standalone Page (`/workspace/[id]/translate`)

Celostránkový view pre správu všetkých snippetov workspace.

| Panel | Obsah |
|---|---|
| Ľavý | Zoznam modelov so status badges per language |
| Pravý | Monaco editor + result pane pre vybraný model × jazyk |
| Header | Language selector + Variant picker |
| Grid view | Workspace Overview: všetky modely × jazyky, status ikony |

**Empty state** (workspace bez modelov): "No models yet — build your first model in Model module." (BR-TRN-050)

**Snippet edits:** Manuálne editovaný snippet = badge "✏️ Custom"; nezmazaný pri Regenerate pokiaľ user neklikne "Discard edits". (BR-TRN-051)

**Language persistence:** Posledný vybraný jazyk + variant per model uložené v `localStorage`. (BR-TRN-052)

---

## Stavové diagramy a wireframy

Detailné wireframy a interakčné vzory: implementovať v Phase TR1 podľa vzoru ostatných module UI.md súborov.

---

## References

- Funkčný spec: [GOAL.md §7](./GOAL.md)
- UX pravidlá: [RULES.md §UI a UX](./RULES.md) (BR-TRN-050 až BR-TRN-052)
- Language catalog: [LANGUAGES.md](./LANGUAGES.md)
- Cross-cutting patterns: [../UI_UX.md](../UI_UX.md) (Approval Gates §17, Streaming §18, GDPR Visual §19)
