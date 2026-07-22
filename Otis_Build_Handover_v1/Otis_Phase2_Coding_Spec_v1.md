# Otis Phase 2 — Coding Spec (v1)
### Turning free-text interview answers into coded labels, the bridge between Phase 1 and clustering
*Builder doc for Claude Code. This stage runs FIRST in Phase 2, before the clustering in the Analytics Spec §2.4. It captures the coding stage that was previously described only in source material outside this document set; this spec is now the canonical definition. Companion to: Phase 2 Analytics Spec, Team Stories Narrative Template (fidelity rules), Decisions D-039/D-040/D-031/D-044.*

---

## 0. Why this stage exists (the gap it fills)

Phase 1 stores each member's interview as **four free-text fields** per probed item in `ps_interview_responses`: `situation_text`, `out_behavior_text`, `outcome_text`, `in_behavior_text`. These are paragraphs, the distilled output of the adaptive probe conversation.

Everything downstream (clustering, counts, narratives, the dashboard) operates on **discrete coded labels**, not paragraphs. The clustering step in the Analytics Spec assumes labels already exist. The narrative template assumes "Otis has already coded each member's interview into buckets."

**This spec defines the step that produces those labels.** Without it, clustering has nothing to cluster. It is the first operation in Phase 2, before any aggregation or clustering.

Resolves Analytics Spec **open item C**: coding happens here, as a Phase 2 pass over the stored free text — NOT during the Phase 1 interview (Phase 1 stays a clean conversation that captures raw text; coding is an analysis concern).

---

## 1. Where it runs

- **Trigger:** part of the `compute` pipeline (Analytics Spec Stage 1), running before clustering (§2.4 there). It may be a distinct LLM pass whose output feeds the deterministic clustering.
- **Input:** all `ps_interview_responses` rows for the team's completed members.
- **Output:** a set of coded labels, each carrying: its bucket (primary code), its secondary label(s), the anonymized member ID it came from, and the PS `statement_id` it was generated from. These labels are the input to clustering.
- **Level:** per member, per item, line-by-line within each of the four free-text fields. One field can yield multiple labels.

---

## 2. The four buckets and their codes

Each free-text field maps to one **primary code** (its bucket). Within each, Otis goes **line-by-line** to apply **secondary label(s)**. Both the primary and secondary labels are stored on every coded unit.

### 2.1 SITUATION bucket (from `situation_text`)
Primary code: `situation`. Apply **two** kinds of secondary label:
- **Context** — where/how it happened: e.g. meeting, chat group, email chain, during group work, DM, or other specific contexts.
- **Objective** — what the person/team was trying to do: often tied to a PS item (reaching out for help, sharing opinions, taking risks) but can be broader (getting to know each other, socializing, onboarding, planning).

Store so the dataset can be queried by the primary `situation` label OR by the `context` sub-label OR by the `objective` sub-label across all members.

**Multi-member flag (D-046):** if the situation appears to describe an interaction that may **not** involve multiple team members (e.g. a private one-on-one), flag it. This is a coding judgment made here by reading the text, NOT something the member self-reported. The flag travels with the label; downstream the dashboard can exclude flagged labels and recompute (per D-046).

### 2.2 OUT-BEHAVIOR bucket (from `out_behavior_text`)
Primary code: `out_behavior`. Secondary labels **as gerunds** (‑ing action words), e.g. *not inviting responses, glaring, not reciprocating interest, not helping, criticizing mistakes, cutting someone off, ignoring opinions, withholding, blaming.* Go line-by-line; one field may yield several. **Stay close to the ground truth of what was said; do not over-infer.**

### 2.3 OUTCOME bucket (from `outcome_text`)
Primary code: `outcome`. Secondary labels capture effects at the team or individual level, e.g. *project delayed, deadline missed, confusion, arguing, personal attacks, frustration.* Wide range; read the context.

### 2.4 IN-BEHAVIOR bucket (from `in_behavior_text`)
Primary code: `in_behavior`. Secondary labels **as gerunds**, e.g. *openly discussing, seeking feedback, nodding, showing interest, offering help, reflecting on opinions, responding kindly, taking turns talking, experimenting, being curious.*
**Note:** this field can contain BOTH in-behaviors and out-behaviors (a member describing what to do differently often names the bad behavior too). Otis may apply either primary code here as appropriate — the field name is the *source*, not a guarantee of the code.

---

## 3. Fidelity rules (LOCKED — the anti-contamination discipline)

These are the rules the Team Stories Narrative Template flagged as belonging here. They are the reason downstream narratives stay faithful.

- **No pre-supplied behavior codebook in the pilot (D-039, emergent-first).** Otis generates labels from what members actually said. It is NOT handed a list of expected behaviors to match against. Pre-supplying examples would make Otis pattern-match real input toward the examples, quietly replacing members' words. This matters especially for a cross-industry tool: no fixed list can anticipate a nurse's, a soldier's, or a construction PM's vocabulary.
- **Preserve the member's own words and terminology.** Code labels stay close to actual phrasing. Do not normalize domain/industry terms into generic ones.
- **Prefer under-coding to over-inferring.** If it's ambiguous whether a behavior was present, don't invent it. Line-by-line exists precisely to keep Otis close to the text.
- **Flag, don't normalize, unfamiliar terms.** If a member uses a term Otis doesn't recognize, preserve it verbatim rather than mapping it to the nearest familiar concept.
- **The gerund examples in Section 2 are format guides, not a vocabulary to match against.** They show the *shape* of a good label (‑ing, specific, observable), not the set of allowed labels. Real labels will be far more varied and domain-specific.

---

## 4. What each coded label carries (data model)

Every coded label stores, at minimum:
- `primary_code` — situation / out_behavior / outcome / in_behavior
- `secondary_label` — the actual coded text (gerund, context, objective, or outcome)
- `sub_type` (situation only) — context vs. objective
- `member_id` (anonymized, tracked, not displayed)
- `statement_id` — which PS item this label was generated from (D-040 requires this so convergence and item-anchoring work)
- `multi_member_flag` (situation only) — per §2.1

These labels are the **input to clustering** (Analytics Spec §2.4). Clustering then groups them, counts by member convergence, preserves the source labels under each cluster, and names each cluster. Coding produces the labels; clustering groups them. Two distinct steps.

---

## 5. Handoff to clustering (the boundary)

Coding STOPS at producing labels. It does not group, count, or name clusters, that is the clustering step. The one thing coding does that clustering relies on: it attaches `member_id` and `statement_id` to every label, so clustering can (a) count distinct members per cluster (D-040) and (b) keep clusters anchored to their source PS items (needed for item-anchored recommendations and cross-item borrowing, D-045).

After coding: **"we move away from the transcript and just work across the labels"** — all subsequent steps operate on labels only, never re-reading the raw text. This is a deliberate boundary: it keeps the transcript's raw content from leaking into aggregate interpretation, and it's why fidelity must be won here, at coding, because nothing downstream re-checks the original words.

---

## 6. Open items

- **Model/pass structure:** coding is an LLM task (line-by-line semantic labeling). Confirm at build whether it's one call per member-item, one batched call, or folded into a broader compute LLM pass. Keep it separate from the *interpretation* call (Analytics Spec Stage 2) — coding is extraction, not interpretation, and mixing the two risks contaminating labels with conclusions.
- **Storage:** where coded labels live (a new `interview_labels` table vs. a JSON structure inside `tier1_json`). They must persist with member_id + statement_id + flags, and remain queryable by primary and secondary label. Decide at build.
