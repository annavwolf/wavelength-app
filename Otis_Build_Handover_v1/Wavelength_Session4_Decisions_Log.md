# Wavelength / Otis — Session 4 Decisions Log
### Full text of all decisions made this session, so every reference in the specs resolves
*Append to `Wavelength_Decisions_Log_Session3.docx`. D-048 and D-049 are in the separate `Decisions_D048_D049_draft.md`; this file captures D-042 through D-047 (Phase 1) and the dashboard decisions D-050 through D-053 (renumbered from the working labels "Decision 1–4" used mid-session).*

---

## Phase 1 decisions (D-042 – D-047)

**D-042 — Stinky fish removed from the interactive/interview layer.** The 7-fish taxonomy is removed from the workshop and deep-probe interview. The 12 PS items, grouped into three developmental zones (Belong, Speak Freely, Innovate), are the sole anchor for both the diagnostic and the follow-up interview. The interview triggers on negatively-scored PS items, not fish. Supersedes fish-anchored STARR and all fish-decoupling logic from v3.1. Deadfish steps removed from `STEP_ORDER`. **LOCKED.**

**D-043 — Canonical scale, zones, reverse-scoring, item-selection rule.** 5-point agreement Likert (Strongly Disagree=1 → Strongly Agree=5), replacing green/yellow/red. Three zones: Safe to Belong, Safe to Speak Freely, Safe to Innovate. "Members of this team feel distant, and some people are on the outside" is reverse-scored. Interview item-selection (per member): eligible if effective score ≤ Neutral(3); sort zone-first (Belong→Speak→Innovate), then most-negative within zone; take top 2; if 1 eligible probe 1; if 0 run the all-positive script (D-047). **LOCKED.**

**D-044 — Clustering method: embeddings + fixed threshold, no codebook yet.** Label grouping (the count-bearing step in Phase 2 coding) uses embedding similarity with a fixed cutoff, not LLM judgment, so counts are reproducible run-to-run. The LLM only names groups after the math forms them. No codebook yet — the phased codebook plan (D-039: emergent first, axial post-pilot) stands, applied on top of this grouping method. **LOCKED.** *(Extended by D-050 to apply uniformly across all five buckets.)*

**D-045 — Cross-item behavior borrowing: no mixing by default, consultant-gated.** IN/OUT behavior recommendations for a given PS item use only behaviors tagged to that item. If fewer than 4 IN or 4 OUT exist for the item, Otis flags it and surfaces candidate behaviors from other PS items, each labeled with its source item, for the consultant to optionally pull in. **LOCKED.** *(Extended by D-052: the consultant may pull from the full cross-item library at any time, not only on shortfall.)*

**D-046 — Multi-member flag: flag-and-keep, with dashboard exclude/recompute toggle.** Responses describing an interaction that may not involve multiple team members are flagged but retained in all counts and clusters. The dashboard includes a toggle to exclude flagged responses and recompute. The flag is a Phase 2 coding judgment made by reading the situation text, NOT self-reported by the member during Phase 1. **LOCKED.**

**D-047 — All-positive edge case: reframed "even better" script.** If 0 items are eligible for interview (all scored above Neutral), Otis acknowledges the strong scores, then runs the same four-bucket interview flow reframed around improvement rather than deficit. Member picks between two offered Innovate-zone items. Wording anchors on "a moment that went fine but could have gone even better." Keeps data structure identical across all interview outcomes. **LOCKED.** Full script in the Phase 1 Canonical Flow, Section 5.

---

## Dashboard / Phase 2 decisions (D-050 – D-053)

*(These were labeled "Decision 1–4" while we worked; renumbered here for the permanent log.)*

**D-050 — Clustering applies uniformly across all five buckets (extends D-044).** Uniform embeddings + fixed similarity threshold for all five bucket streams: context, objective, out-behavior, outcome, in-behavior. The LLM names clusters only (does not affect counts), with an instruction to prefer short, canonical, reused names over near-duplicates. Rejected: a mixed approach using fixed pick-lists for context/objective and embeddings only for behaviors (added complexity of two methods outweighed the small naming-consistency gain; embeddings are also more forgiving of unanticipated categories). Exact threshold and embedding model set at build time. **LOCKED.**

**D-051 — Workshop focus-item selection: zone-first, one item.** The single item the workshop's Team Agreement centers on is selected by aggregating across the team: for each item, count members who scored it Neutral-or-below (on effective value), then sort zone-first (Belong→Speak→Innovate), then most-negative within zone. One focus item per workshop. This mirrors the personal-interview selection rule (D-043) at team level. Rejected: count-first sorting (would ignore the developmental sequencing the zones encode). **LOCKED.**

**D-052 — Item override, behavior library, cluster granularity, editing.** In the workshop dashboard:
- Item selection = automatic primary (D-051) + manual override offering the next 1–2 ranked items *that have story data*. Override repopulates the whole workshop panel; the primary is always restorable.
- Behavior pool = seeded from the selected item (D-045) + a full cross-item library the consultant can add from at **any** time (extends D-045 beyond shortfall-only).
- Cluster granularity = the consultant can use the cluster label OR explode it into its individual contributing behaviors (subset allowed). Requires clusters to preserve their source labels as addressable parts.
- Editing = the consultant can edit any member-facing text Otis generates (situation sentence, framing, behaviors); Otis's original is always preserved and viewable. Provenance ("who set this": Otis / member / consultant) is tracked per element. The situation text is editable too.
- The Team Agreement itself is built jointly by the team in Phase 3 and is deliberately NOT wired to the dashboard override (it may produce new labels in Phase 3).
- Not tracking consultant-override frequency for now.
**LOCKED.**

**D-053 — Otis's generated reads: three artifacts, grounded and disciplined.**
- **Zone read (≤200 words):** generated via the Zone-Read Generation Guide. Scores-only, ocean spine, four conditions per zone (uniform high / uniform low / mixed / high-variability), cross-zone depth logic, affirm-and-stretch for healthy teams (the one sanctioned comfort→learning nudge). Strict humility: no causal leaps, no standards/history/team-type inference. Grounded in Anna's PS articles + the app's ocean metaphor.
- **Shared-purpose read (~100 words):** generated via the Shared-Purpose Read Guide. Five conditions (aligned / broadly-aligned / fuzzy / fragmented / bifurcated), computed from embedding spread + individual statement clarity. Distinguishes alignment/coordination gaps from meaning/motivation gaps. Grounded in team-science research (SMM→performance well-evidenced; purpose→motivation held more tentatively).
- **Team Stories narratives:** generated via the Team Stories Narrative Template. Mechanical verbatim assembly of coded buckets, NOT interpretation. Anti-contamination fidelity discipline lives at the coding step (Coding Spec §3), not the template.
**LOCKED.**

---

## Supporting decisions locked this session (not separately numbered)

- **Display banding (percentages):** headline is **% favorable** (effective 4–5 / Agree+Strongly Agree), always shown with plain-English explanation and counts alongside; mean available underneath; RYG display band = 1–2 red, 3 yellow, 4–5 green, computed on effective value. Agreement statistic (rWG or SD, build-time) drives the "high variability" condition. Small-n caution under ~5 members (lean on counts, flag low-n).
- **Dashboard structure:** ONE page, TWO tabs — "Analytics & Insights" and "Workshop." Existing panels re-anchored into Analytics. Otis present as a persistent chat bubble in both tabs. New content nests into the existing three-zone structure; the dashboard is not rebuilt from scratch.
- **Team connectivity:** two toggleable networks (coordination + geographic). Non-responders get a symbolic unconnected node in the geographic view. Minimal plain-English text; density language dropped for the beta.
- **Reverse-scoring:** applied at READ TIME only, in one central function; the DB always stores the literal click.
- **Coding-step placement:** free-text → labels happens as a Phase 2 pass (Coding Spec), not during the Phase 1 interview.
