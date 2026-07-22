# Otis Phase 2 — Analytics Spec (v1)
### Re-anchoring the existing analysis pipeline onto interview data, and specifying the Analytics tab
*Builder doc for Claude Code. Companion to: the three generation guides (zone-read, shared-purpose, narrative), the Phase 1 canonical flow, and Decisions D-042 through D-049 + Session-4 Decisions 1–4. Covers the ANALYTICS tab only. The WORKSHOP tab (item-selection surfacing + RYG activity) is a separate spec.*

---

## 0. Orientation — what this is and what already exists

A complete analysis pipeline already exists in the repo, but it is wired to the **retired** fish + 3-point green/yellow/red model and reads the old tables. This spec **guts and re-anchors** that pipeline onto the new interview data; it is not a greenfield build.

**The existing pipeline shape (keep this shape):**
```
compute  (deterministic Tier 1, no LLM)   → analysis.tier1_json
   → interpret (1 LLM call, PART2 prompt) → analysis.tier2_json
   → chat      (ephemeral consultant Q&A over same package)
   → dashboard renders tier1_json + tier2_json
```

**Files this spec rewrites:**
- `app/api/analysis/compute/route.ts` — deterministic metrics (currently @ts-nocheck stale)
- `app/api/analysis/interpret/route.ts` — the LLM interpretation call
- `prompts/part2_analytics.ts` — the `PART2_SYSTEM_PROMPT` (still fish-anchored)
- `app/teams/[team_id]/page.tsx` — the consultant dashboard (renders stale shapes)

**The central data shift:** the rich interview data now lives in `ps_interview_responses` (situation / out-behavior / outcome / in-behavior per member per item). Nothing reads it yet. compute/interpret/chat all still read `ps_responses` + `fish_responses`. This spec makes `ps_interview_responses` the primary qualitative input and removes fish entirely from the analytic path.

**New infrastructure required (flagged loudly, see §6):** there is **no embedding or clustering code anywhere** in the repo, and no embeddings dependency in `package.json`. The clustering method (Decision 1 / D-044) is net-new infrastructure, not just new logic.

---

## 1. Scope of this spec

**In scope (the Analytics tab, top to bottom):**
1. Banner (keep, enlarge — no logic)
2. Shared Purpose section
3. Team Connectivity section (two toggleable networks)
4. Psychological Safety section (zone scores + item breakdown + Otis's zone read)
5. Team Stories section (clustered buckets + narratives)
6. The compute + interpret rewrites that feed all of the above

**Out of scope (separate Workshop Spec):** item-selection for the workshop, the RYG activity, drag/pool/behavior-sizing, code-of-conduct assembly. Where this spec produces data the workshop consumes (e.g. clustered behaviors per item), it notes the handoff but does not design the workshop UI.

**Also out of scope:** Phase 3 feedback round (`part3_analytics.ts`, `feedback_responses`), Phase 4 (`followups`). Noted only where the output contract must feed them.

---

## 2. STAGE 1 — `compute` rewrite (deterministic Tier 1)

Pure deterministic aggregation, no LLM, **except** the embedding/clustering sub-step (§2.4), which uses an embedding model but no generative reasoning. Output upserts to `analysis.tier1_json`.

Input: `POST { team_id }`. Gate unchanged: **< 3 completed members → `insufficient_responses`.**

### 2.1 Fix the zone math (BUG — must fix)
The current file hardcodes the **old** zone split `{1:[1..5], 2:[6..9], 3:[10..12]}`. The Phase 1 migration reseeded zones as **`{1:[1,2,3,4], 2:[5,6,7,8], 3:[9,10,11,12]}`**. Do not hardcode; **read `zone` from `ps_statements`** so this can never drift again. Any per-zone computation groups by the statement's actual `zone` value.

### 2.2 PS zone scoring (5-point, favorability)
Replaces the green/yellow/red logic. Per Decision 4 (percentages) and the zone-read guide's data needs.

For each zone, from `ps_responses` (round 1), computing on **effective value** (apply reverse-scoring per statement — `effective = reverse_scored ? 6 - response_value : response_value`; this is the same single flip point defined in Phase 1, reuse `effectiveValue`):
- **% favorable** = proportion of responses that are effective 4 or 5 (Agree / Strongly Agree). This is the headline number.
- **Counts** = n favorable / n neutral / n unfavorable, and total n. Always carry counts (for small-team display).
- **Mean** = mean effective value (1–5).
- **Agreement** = within-zone agreement across members (rWG or SD — see §6 build note). Drives the "high variability" condition in the zone read.
- **Band** for display = per the RYG display banding: unfavorable (effective 1–2) red, neutral (3) yellow, favorable (4–5) green. **Display-only**, computed from effective value.

### 2.3 Per-statement distribution (5-point)
Replaces the hardcoded 3-point `green*3+yellow*2+red*1` math. For each of the 12 statements: distribution across the 5 response points (count at each), the favorable/neutral/unfavorable split, mean effective value, and per-member `{private_code, effective_value, label}`. This feeds the "Survey Item Breakdown" expanded view (§4.2).

### 2.4 Clustering of interview buckets (NET-NEW — the load-bearing step)
Per **Decision 1 (uniform embeddings + fixed threshold, all buckets)** and D-044/D-040/D-031.

Source: `ps_interview_responses`. Each member×item row contributes coded labels — but note: **the bucket texts are free text** (`situation_text`, etc.), not labels. The **Coding Spec** (companion doc) defines the step that turns that free text into coded labels; it runs FIRST, before this clustering step. Clustering operates on the labels the Coding Spec produces, each already carrying its `member_id` and source `statement_id`.

For each bucket type (context, objective, out-behavior, outcome, in-behavior — five streams):
1. **Embed** each label.
2. **Cluster** by fixed similarity threshold (deterministic — same data, same clusters).
3. **Count** by **member convergence** (D-040): count *distinct members* contributing to a cluster, not raw incident count.
4. **Preserve source labels** under each cluster (Decision 3 — clusters must be explodable back to their contributing labels; never discard the parts). Track which member and which PS item each source label came from (member IDs tracked, not displayed).

**CRITICAL — clusters are for counting, not for display to members.** Clustering is a *generalizing* operation: it takes specific behaviors ("cutting someone off," "talking over people," "not letting people finish") and produces an abstraction ("interrupting"). That abstraction is LESS observable than its parts, and observability is exactly what the workshop needs.

Therefore:
- **Cluster labels** are used for the consultant dashboard (counting, ranking, prioritising) — they answer "how many members raised this?"
- **The source behaviors (exploded, specific, in members' own words)** are what populate the workshop's NEVER/MAYBE/ALWAYS circles — because members must drag around concrete, observable behaviors, not abstract headings.
- Where two source behaviors are near-identical, **dedupe by selecting the clearest phrasing** — do NOT merge them into a more abstract label.

This is why source-label preservation (point 4) is mandatory rather than nice-to-have: the workshop depends on it.
5. **Name** each cluster with a single LLM call per bucket stream (naming only — does not affect counts). Instruction: short, canonical, reused names over near-duplicates.

Bias safeguard (D-031): scenarios/contexts are derived from convergent clustering, **never** from a single incident. Enforce a **≥2-member convergence floor** on anything surfaced as a team pattern.

Fidelity (Team Stories Narrative Template §4): if coding happens here, honor the coding-fidelity rules — no pre-supplied codebook (D-039, emergent-first), preserve members' own words, prefer under-coding, flag domain terms rather than normalize.

### 2.5 Shared-purpose alignment (NET-NEW)
Per the Shared-Purpose Read Guide. Source: `purpose_responses`. Embed each member's purpose statement; assess (a) relationship between statements (converge / two-clumps / scattered) and (b) individual statement clarity. Produce the condition classification (aligned / broadly-aligned / fuzzy / fragmented / bifurcated) and carry the underlying similarity stats. The 100-word read itself is written in `interpret` (§3), not here — compute only produces the structured inputs.

### 2.6 Team connectivity (two networks)
Per this session's decision: **two toggleable networks.**
- **Coordination network** (exists today): directed pairs from `coordination_ratings`, line thickness = coordination strength/frequency, plus peripheral members (>50% low-freq incoming) and asymmetric pairs (one side daily/weekly, other rarely). Keep this computation.
- **Geographic network** (new): node positions/distance from member `location`/`timezone`. **Missing-data rule:** a member with no location entry gets a symbolic unconnected node shown to the side (not placed in the network). Carry this flag.
- **Text under the networks (revised):** drop the density language entirely for the beta. Emit only minimal plain-English facts (e.g. "these two members coordinate most closely," "these two work together but at very different frequencies," "N members share a location; M are in distinct time zones"). No interpretation of density in v1.

### 2.7 Purpose passthrough & raw responses
Carry each member's purpose text plus their `share_verbatim_with_team` flag, so the dashboard's "Raw Responses" dropdown (§4.1) can show anonymized verbatim **only** for members who permitted sharing.

### 2.8 Output — new `tier1_json` shape
Replaces the fish-bearing shape. Contains: per-zone favorability block (§2.2), per-statement distributions (§2.3), the five clustered bucket streams with member-convergence counts and preserved source labels (§2.4), shared-purpose classification + stats (§2.5), both networks' data + missing-node flags (§2.6), purpose passthrough (§2.7). **Remove** all fish fields. Upsert to `analysis.tier1_json` (onConflict team_id), unchanged mechanism.

---

## 3. STAGE 2 — `interpret` rewrite (the LLM reads)

One LLM call (keep the single-call shape) that produces the written reads, reading `tier1_json`. Requires `tier1_json` to exist first (unchanged gate). Output → `analysis.tier2_json`.

### 3.1 Re-anchor `PART2_SYSTEM_PROMPT` (fish → PS items)
The current prompt treats "fish" as first-class evidence throughout. **Remove all fish.** Re-anchor every reference to PS items and the interview buckets. Adopt the **direct-voice hypothesis** (D-049): "Several members gave a low score to [item], discussed in the context of [context]…" — replacing the old hedged phrasing.

### 3.2 Plug in the three generation guides
The interpret prompt must incorporate:
- **Zone-Read Generation Guide** → produces the ≤200-word per-zone-informed PS read (scores-only, ocean spine, four conditions, cross-zone depth logic, affirm-and-stretch healthy case, strict no-causal-leaps humility).
- **Shared-Purpose Read Guide** → produces the ~100-word purpose read from the §2.5 classification (five conditions, alignment-vs-meaning distinction, humility).
- **Team Stories Narrative Template** → produces the per-item narrative sentences from clustered buckets (mechanical assembly, verbatim, reflow variants, one narrative per member per item).

These are large; consider whether they live inline in the prompt or as retrieved reference. **Model/budget note:** interpret currently runs `claude-sonnet-4-6` at `max_tokens: 4000`. This spec asks it to do more (three distinct reads). Re-evaluate token budget and whether one call or a few scoped calls is better (see §6 open item D). Keep observational vs. evaluative reasoning cleanly separated if split.

### 3.3 Privacy (unchanged, keep)
Members who didn't opt into `share_verbatim_with_team` are included for reasoning but must never be quoted or attributed. Preserve the existing kept_private handling.

### 3.4 Output — new `tier2_json` shape
Contains: the three PS zone reads, the shared-purpose read, the Team Stories narratives, the direct-voice focus hypothesis, and the member-facing summary draft. **Remove** fish-derived fields. Note: item-selection *reasoning* and the workshop suggestion belong to the Workshop Spec, not here — but the focus hypothesis this stage emits is the seed the workshop consumes. Save to `analysis.tier2_json` (unchanged mechanism, keep the `_save_warning` fallback).

---

## 4. STAGE 3 — Analytics tab (dashboard re-anchor)

The dashboard is **one page, two tabs** (Decision, locked): **Analytics & Insights** and **Workshop**. Otis is a persistent chat bubble (octopus) available in both tabs, reading over the page with the consultant. This spec covers the Analytics tab; the Workshop tab is the separate spec. Both tabs read from the same `tier1_json`/`tier2_json`.

Existing panels are **re-anchored**, not rebuilt. Order, top to bottom:

### 4.0 Banner
Keep; make larger. No logic.

### 4.1 Shared Purpose
- The ~100-word Otis purpose read (from `tier2_json`).
- A **"Raw Responses" dropdown**: anonymized member purpose statements, shown **only** for members who permitted sharing.
- Delete the old "Otis's purpose alignment read" element at the bottom of the legacy panel.
- Held out of Phase 3; retained in memory for later.

### 4.2 Psychological Safety
- **Zone overview:** the three zones with % favorable, counts alongside (for small teams), band, and a clear legend stating what favorable/neutral/unfavorable mean in agree/disagree terms (the doc explicitly flagged that "0%" was unclear — fix by always labeling what the percentage is *of*: "% of responses that were favorable (Agree/Strongly Agree)").
- **"Survey Item Breakdown" dropdown:** per-zone accordions over the 12 statements; each statement shows its 5-point distribution + favorable/neutral/unfavorable split + mean (§2.3). No interpretation.
- **"Otis's read":** the three zone reads (§3.2), split by zone, each ≤200 words, rendered over the ocean image (per the doc's layout intent).

### 4.3 Team Connectivity
- **Two networks, user-toggleable:** Coordination and Geographic (§2.6).
- Non-responders in the geographic view: symbolic unconnected node to the side.
- Minimal plain-English text only; no density interpretation in v1.

### 4.4 Team Stories
- Intro line explaining Otis asked members to tell stories about their lowest-scoring items and imagine better outcomes.
- **"Lowest scoring items":** PS items that stories were told about, ordered by (1) how many members told stories about the item, then (2) zone depth (shallower first). Show **top 3, expandable** to all. Make each item's zone clear.
- **Expand an item** → the narrative sentence(s) for that item (§3.2 narrative template); one narrative per member per item.
- **Below:** the bucket boxes (Situation[context+objective], Out-Behavior, Outcome, In-Behavior), each showing its clustered labels with member-convergence counts, expandable to the contributing source labels (Decision 3 transparency).

### 4.5 Delete
Remove the legacy fish panel and the sections the flow doc marks for deletion.

---

## 5. Data contract notes (handoffs)

- **To the Workshop Spec:** the per-item behaviors (out/in) — **as exploded source labels, not cluster headings** (see §2.4) — plus the focus hypothesis (direct voice) and the shared-purpose classification are the inputs the workshop consumes. This spec produces them; the workshop surfaces and manipulates them. The cluster labels and their member-convergence counts go to the consultant dashboard; the exploded specific behaviors go to the workshop circles.
- **To Phase 3 (`feedback_responses`, `code_of_conduct`) and Phase 4 (`followups`):** these tables already exist. This spec doesn't populate them, but the `tier2_json` focus hypothesis and clustered behaviors are what eventually seed them. Don't design them away.
- **`analysis` table:** only `tier1_json` and `tier2_json` are actually used; the flat text columns are mostly-empty pre-carved slots. Continue using the two JSON blobs as the source of truth; don't rely on the flat columns.

---

## 6. Open items requiring a decision before/at build

- **A — Embedding model + similarity threshold.** Net-new infrastructure. Which embedding model/provider, stored where (a vector column / pgvector, or computed in-request), and the exact similarity threshold per bucket. Also the light-clustering method for shared-purpose bifurcation detection. All deferred to build, but must be chosen before Stage 1 §2.4/§2.5 can be built.
- **B — Agreement statistic.** rWG vs SD for the "high variability" zone condition, with the small-n caveat (<5 members) from the zone-read guide. Track the statistic regardless.
- **C — RESOLVED.** Interview-bucket coding (free text → labels) happens in a dedicated Phase 2 coding pass, NOT during the Phase 1 interview. Fully specified in the **Coding Spec** companion doc, which runs before §2.4 clustering.
- **D — interpret model/token budget.** Sonnet 4-6 @ 4000 tokens currently. With three reads now, confirm budget, and whether to keep one call or split into scoped calls (keeping observational vs. evaluative separate if split).
- **E — Small-n display rules.** Under ~5 members, lean on counts over percentages and flag low-n; confirm the exact threshold and copy.

---

## 7. What to tell Claude Code (handoff summary)

This spec supersedes the fish/3-point analytic path. Net of it:
1. `compute` — fix zone math (read zones from `ps_statements`), rewrite scoring to 5-point favorability, add embedding-based clustering of interview buckets with member-convergence counts and preserved source labels, add shared-purpose alignment, add the second (geographic) network, drop all fish. New `tier1_json` shape.
2. `interpret` — re-anchor `PART2_SYSTEM_PROMPT` from fish to PS items, plug in the three generation guides (attached), emit direct-voice hypothesis, drop fish. New `tier2_json` shape.
3. dashboard — make it two tabs (Analytics + Workshop), re-anchor the Analytics panels onto the new shapes, add the persistent Otis chat bubble, delete fish + flagged legacy panels.
4. Do NOT build the Workshop tab from this spec — it's a separate doc.
5. Flag but don't silently resolve the §6 open items; bring them back for decision.
