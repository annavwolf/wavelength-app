# Otis — Carried-Forward Decisions Reference (D-027 → D-041)
### Full text of the earlier decisions that the phase specs cite
*Companion reference. The phase specs reference these by ID; this file is where they resolve. Originally recorded in `Wavelength_Decisions_Log_Session3.docx` (not part of this handover set), summarised here so every reference in the build docs is answerable without external files.*

**Important context:** these decisions were made when the methodology used a "stinky fish" taxonomy and a 3-point green/yellow/red scale. Both were retired (D-042, D-043). D-048 split these earlier decisions into *retired* vs. *carried forward*. This file gives the carried-forward ones in usable form, re-anchored to the current PS-item model.

---

## RETIRED — do not implement (listed only so references resolve)

- **D-027 — Fish set (7 items).** Retired with the fish taxonomy (D-042).
- **D-029 — Fish-specific situation/future prompts.** Retired. The *principle* survives as the Phase 1 felt-phrase table (Phase 1 Canonical Flow §4.3), re-anchored to PS items.
- **D-032 — Fish decoupling rule.** Retired. It prevented fish severity from covertly driving the analysis; with PS items as the direct analytic construct there is no separate index layer to decouple from.
- **D-028 — STARR collapsed to one question with hidden fields.** Superseded. Phase 1 now asks four explicit questions (Situation / Behaviour / Outcome / Reflection). Interview burden accepted for richer per-bucket data.
- **D-034 — Hedged PS hypothesis phrasing.** Superseded by D-049 (direct voice).
- **D-038 — v3.1 eight-stage pipeline.** Superseded in structure by the Phase 2 Coding + Analytics specs; its safeguards survive as D-030/D-031/D-033 below.

---

## CARRIED FORWARD — these still apply

### D-030 — Pipeline order lock
The analysis stages run in a fixed order and must not be reordered: **collect → code → cluster/aggregate → derive scenario → select → interpret.** Originally locked because scenario selection had once been moved *before* clustering, which introduced bias (the scenario got chosen from a vivid single case rather than from convergent data). Stage *names* have been updated (STARR-collection → interview-collection), but the ordering lock itself stands.

**In current terms:** Coding Spec runs before Analytics Spec §2.4 clustering; clustering runs before item-selection; interpretation runs last.

### D-031 — The scenario is derived, never selected
The situation/context a recommendation is anchored to must be **derived from convergent clustering across members**, never picked from a single member's incident, however compelling that incident is.

**Enforcement:** a hard **≥2-member convergence floor** on anything surfaced as a team pattern. Anything supported by only one member may inform the consultant's private view but must not become the team-facing scenario.

### D-033 — Interpretation boundary
Only the **final interpretation stage** produces user-facing interpretive language. Earlier stages (coding, clustering, aggregation) must produce data and structure only — no "this suggests," no risk labels, no flags with meaning attached.

**Why:** premature interpretation at an early stage biases everything downstream and can't be audited. This is the same principle that governs the Phase 2 Analytics Spec (compute is deterministic; interpret does the reading).

### D-036 — Four-test behaviour elicitation
When eliciting a behaviour from a member, the response must pass four tests before it is accepted as a coded behaviour. It must be:
1. **Observable** — someone could see or hear it happen
2. **Specific** — a particular action, not a category or trait
3. **Team-level** — about how the team operates, not a personal attack on an individual
4. **Actionable** — something that could plausibly change

If a member gives a trait or adjective ("was rude," "wasn't listening," "should be more respectful"), Otis reflects the word back and asks what was actually observed. **Do not accept trait words as behaviours.**

**Where this is implemented:** Phase 1 Canonical Flow Turn 2 (out-behaviours) and Turn 4 (in-behaviours, the observability push); Phase 3 sort preview; Phase 4 pair-sheet inline nudge. It is the same discipline applied at four points in the product.

### D-037 — Behavioural Agreement template
The team's agreement follows a fixed structure: **Challenge → Goal → When → We will → We won't → Why this matters.**

**Current implementation:** the Phase 4 agreement (Phase 4 Spec §7.1) is this template expressed in plain language — the situation (objective + context) carries Challenge/Goal/When; "We will" / "We will avoid" carry the behaviours; the observability lines and reinforcement mechanisms carry Why-this-matters and make it enforceable. Build to the Phase 4 §7.1 shape; this decision explains where that shape came from.

### D-039 — Phased codebook (emergent first)
**Phase 1 (now, pilot):** no pre-supplied behaviour codebook. Labels emerge from what members actually say. Otis is *not* handed a list of expected behaviours to match against.

**Phase 2 (post-pilot):** after roughly 3–5 pilot teams, build the codebook *from* the labels that actually emerged, then use it for axial coding.

**Why this matters for the build:** pre-supplying examples causes the model to pattern-match real member input toward the examples, quietly replacing members' words. For a cross-industry tool this is fatal — no fixed list can anticipate a nurse's, a soldier's, or a construction PM's vocabulary. See Coding Spec §3.

### D-040 — Member-convergence counting
Aggregate counts are of **distinct members**, not raw incidents. If one member mentions the same behaviour three times, that is **1**, not 3.

**Why:** incident-counting lets a single vocal member manufacture an apparent team pattern. Member-counting measures how *widely shared* something is, which is what a team-level diagnostic needs.

**Current implementation:** D-044/D-050's embedding+threshold clustering, counting distinct `member_id`s per cluster (Analytics Spec §2.4).

### D-041 — Interview data is a hard pipeline prerequisite
The qualitative interview data is required for the analysis pipeline to run meaningfully. If interview data is too sparse (too few members completed, or responses too thin), the system falls back to **survey-only output** — scores and zone reads — and must say so plainly rather than manufacturing behaviour clusters from insufficient material.

**Current implementation:** the ≥3 completed members gate in `compute`; plus a data-quality note when interview coverage is thin.

---

## How these map to the current build

| Decision | Where it lives now |
|---|---|
| D-030 pipeline order | Coding Spec → Analytics Spec §2.4 → item selection → interpret |
| D-031 derived scenario, ≥2-member floor | Analytics Spec §2.4 |
| D-033 interpretation boundary | Analytics Spec: compute is deterministic, interpret reads |
| D-036 four-test elicitation | Phase 1 Turns 2 & 4; Phase 3 preview; Phase 4 pair sheet nudge |
| D-037 agreement template | Phase 4 Spec §7.1 |
| D-039 emergent codebook | Coding Spec §3 |
| D-040 member-convergence counting | Analytics Spec §2.4 |
| D-041 data sufficiency | `compute` gate + data-quality note |
