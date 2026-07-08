# U of A SearchStax — Suggested Promotion Rules (v2 re-run)

Re-run of the SearchStax suggested promotion rules (source: `U_of_A_SearchStax_Update_7_7`)
applying two new rules to the promotion targets.

> **v3 (`U_of_A_SearchStax_Promotion_Rules_v3_multi.csv`) is the current recommended sheet.**
> It changes head-term handling from a single hub link to **multiple promotions** (the full
> degree family). See the "v3 — multi-promotion" section at the bottom. v2 files are kept for
> reference.

## Rules applied

1. **Generic major/degree terms → Degree Search home.**
   A trigger that is just a bare field/major name — no degree-level word (ba, bs, ms, ma,
   mba, phd, gc, bachelor, master, doctorate, …) and no emphasis/track/concentration — is
   promoted to the Degree Search hub: `https://www.arizona.edu/degree-search`.
   This also fixes generic head terms that were previously mapped to a single specific
   program (e.g. `computer science` → `computer-science-dp` → now the hub).

2. **Specific degree terms → UG / Grad / PhD entity.**
   A trigger that names a level or a concentration keeps a level-specific program page
   (undergraduate `-ba/-bs/-bsba/…`, graduate `-ma/-ms/-mba/-gc/-psm/…`, or PhD `-dp`,
   emphasis, or track). Specific terms already pointing at such a page are kept as-is;
   specific terms still pointing at a bare base page are flagged for a level-specific target.

## Files

| File | Contents |
|------|----------|
| `U_of_A_SearchStax_Promotion_Rules_v2.csv` | All 1,011 rows, ready to use. Original columns preserved; `promote_url` holds the new target. |
| `U_of_A_SearchStax_Promotion_Rules_v2_NEEDS_REVIEW.csv` | The 75 rows that need a human decision. |
| `transform.py` | The transformation script (reproducible). |

### Added audit columns (in the full file)

- `previous_promote_url` — the target before this re-run.
- `url_level_original` — level bucket of the original target (BASE / UG / GRAD / PHD / EMPHASIS / TRACK / NAV).
- `rule_applied` — which rule fired for the row.
- `change_note` — details / suggestion for flagged rows.

## Outcome (1,011 rows)

| rule_applied | rows |
|---|---|
| Rule 2 — specific entity (kept) | 539 |
| Rule 1 — generic term → DS home | 390 |
| REVIEW: base-page mapping (verify generic vs keep) | 53 |
| Rule 2 — REVIEW: specific term on base page | 22 |
| Unchanged — navigational/non-major | 7 |

### The two REVIEW buckets

- **Rule 2 — specific term on base page (22):** the trigger names a level (e.g.
  `phd in cancer biology`, `master in russian`) but the current target is a level-less base
  page. No matching level page exists in the dataset, so each needs a verified UG/Grad/PhD URL.
- **Base-page mapping (53):** bare-ish triggers whose text doesn't cleanly match the target
  major — a mix of generic terms with extra words / synonyms (e.g. `botany degree` →
  `plant-sciences`, `civil engineering subjects`) that likely belong on the hub, and genuine
  informational/question queries (e.g. `can a nurse practitioner diagnose autism`) that should
  keep their specific target. Left unchanged pending review.

> Note: for Rule 1 rows the target is now the hub, so the original `priority`,
> `target_current_rank`, and `promotion_needed` values (which described the previous target)
> are retained but no longer describe the new target.

---

## v3 — multi-promotion (recommended)

`U_of_A_SearchStax_Promotion_Rules_v3_multi.csv` refines the head-term handling: instead of
sending a generic term to a single hub link, it pins the whole **degree family** as multiple
promoted results. Specific terms are unchanged (one entity each).

**Model**
- **Head/generic term → the full degree family (multi-promote)** when the major has ≥2
  degree-level pages. Example — `accounting` promotes: `accounting` (base), `accounting-bsba`
  (UG), `accounting-ma` + `accounting-ms` (Grad), `accounting-gc` (cert).
- **Head term with no real family → DS home** (single link). Applies to single-program or
  emphasis-only majors (e.g. a lone nurse-practitioner track, `applied physics`).
- **Specific term → its single UG/Grad/PhD entity** (unchanged from v2).

**Scope:** family = degree levels only (base + UG + Grad + PhD + cert). Emphasis/concentration
pages are excluded (including them would convert only 33 of the 238 hub-fallbacks — 205 majors
are genuinely single-program).

**Format:** long — one row per promoted URL. `promote_rank` gives pin order
(base → UG → Grad → cert → PhD); `promote_level` labels each; families derive from the major of
the row's original target, so a trigger only expands when it genuinely matches that major.

**Outcome:** 1,011 triggers → 1,340 rows.

| outcome | triggers |
|---|---|
| head term → family multi-promote (avg 3.2, max 5 results) | 152 |
| head term → DS home (no family) | 238 |
| specific / review / navigational (single promotion) | 621 |

`transform_v3.py` builds v3 from the v2 sheet + the original catalog. To include emphasis pages
in families, add emphasis/track slugs when building `fam`.
