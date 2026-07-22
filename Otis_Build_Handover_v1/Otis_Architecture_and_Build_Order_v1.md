# Otis — Architecture & Build Order (v1)
### What exists, what's new, what depends on what, and the order to build it
*Read this FIRST, before the phase specs. It exists to prevent architectural choices that create expensive rework.*

---

## 1. The full document set (hand these over together)

| Doc | Covers | Status |
|---|---|---|
| **This doc** | Architecture, dependencies, build order | Read first |
| `Wavelength_Session4_Decisions_Log.md` | All decisions D-042 → D-053 in full | Reference |
| `Otis_CarriedForward_Decisions_Reference.md` | D-027 → D-041 (earlier decisions the specs cite) | Reference |
| `Decisions_D048_D049_draft.md` | D-048 (pipeline reconciliation) + D-049 (direct voice) | Reference |
| `Otis_Phase1_Canonical_Flow_v1.md` | The individual interview | **Already built**, plus recent observability edits |
| `Otis_Phase2_Coding_Spec_v1.md` | Free text → coded labels | To build |
| `Otis_Phase2_Analytics_Spec_v1.md` | compute → interpret → consultant dashboard | To build |
| `Otis_ZoneRead_Generation_Guide_v1.md` | How Otis writes the PS zone read | Input to Phase 2 |
| `Otis_SharedPurpose_Read_Guide_v1.md` | How Otis writes the purpose read | Input to Phase 2 |
| `Otis_TeamStories_Narrative_Template_v1.md` | How Otis writes story narratives | Input to Phase 2 |
| `Otis_Phase3_MemberReport_Spec_v1.md` | Member report + pre-work sort | To build |
| `Otis_Phase4_Workshop_Spec_v1.md` | The live workshop | To build |
| Phase 5 (follow-up) | Not yet written | **Gap — do not build** |

**Phase numbering (locked):** 1 = interview · 2 = analysis + dashboard · 3 = member report + pre-work · 4 = live workshop · 5 = follow-up.

---

## 2. What already exists vs. what is genuinely new

### Exists and is being RE-ANCHORED (not rebuilt)
- `app/api/analysis/compute/route.ts` — deterministic metrics, currently stale (fish + 3-point)
- `app/api/analysis/interpret/route.ts` — the LLM read
- `prompts/part2_analytics.ts` — still fish-anchored
- `app/teams/[team_id]/page.tsx` — consultant dashboard; **will break on real 5-point data**
- `analysis` table (`tier1_json` / `tier2_json`) — the report store; only these two JSON blobs are actually used
- `members`, `ps_responses`, `ps_interview_responses`, `purpose_responses`, `coordination_ratings` — all live and populated

### Exists but is INERT (types only, nothing reads or writes them)
- `feedback_responses` — shaped for the pulse-check + more/less-of; **Phase 3 will start using it**
- `code_of_conduct` — shaped for the agreement; **Phase 4 will start using it**
- `followups` — shaped for the revisit; **Phase 5 will use it**
- `prompts/part3_analytics.ts` — STEP 4/5 narrative spec, imported nowhere. Its STEP 4 (assumption pulse-check) maps to Phase 3's pulse check; STEP 5 (in/out activity) maps to Phase 3's sort + Phase 4's workshop. **Treat as background context, not as the spec** — the Phase 3/4 docs supersede it.

### Genuinely NEW infrastructure (nothing like it exists in the repo)
1. **Embeddings + clustering** — no embedding SDK, no vector column, no similarity code. Net-new dependency and logic.
2. **Member authentication + member profiles** — members currently have no login. Foundational for Phases 3–5.
3. **Workshop room + facilitator session control** — live phase broadcast, submission trackers.
4. **Drag-and-drop UI** — no drag-drop library installed. Needed for the sort (Phase 3) and the pair sheet (Phase 4).
5. **Pooled board with per-member colour coding and toggles.**

---

## 3. Dependency map (what blocks what)

```
Member auth + profiles ──────┬──> Phase 3 (member report + sort)
                             └──> Phase 4 (workshop room)

Phase 2 Coding (text→labels) ──> Phase 2 Clustering ──┬──> Consultant dashboard (cluster labels + counts)
                                                       └──> Phase 3 sort circles (EXPLODED behaviours)

Phase 2 item-selection ──> Phase 3 focus item/situation ──> Phase 4 agreement

Phase 3 sorts ──> Phase 4 pooled board ──> pair sheets ──> agreement ──> code_of_conduct ──> Phase 5
```

**The critical path:** member auth → Phase 2 (coding → clustering → dashboard) → Phase 3 → Phase 4.

---

## 4. Recommended build order

**Stage A — Foundations (build first, confirm before proceeding)**
1. **Member authentication + member profiles.** Built on existing `members` records. Low-friction login. Everything in Phases 3–5 sits on this. Must honour `share_verbatim_with_team` / `share_name_with_team` in all member-facing views.
2. **Embeddings infrastructure.** Choose the model/provider and where vectors live. Required before any clustering.

**Stage B — Phase 2 (the analysis re-anchor)**
3. **Coding Spec** — free text → labels with member_id + statement_id + flags.
4. **Clustering** — group labels, count by member convergence, preserve source labels (mandatory: Phase 3 needs the exploded behaviours).
5. **compute rewrite** — fix the zone-math bug (read zones from `ps_statements`, never hard-code), 5-point favorability scoring, shared-purpose alignment, both networks, drop fish.
6. **interpret rewrite** — re-anchor the prompt from fish to PS items, plug in the three generation guides, direct-voice hypothesis.
7. **Consultant dashboard re-anchor** — two tabs (Analytics + Workshop), new shapes, persistent Otis chat bubble, delete fish panels.

**Stage C — Phase 3**
8. Member report (ordering and scripts per the Phase 3 spec), pulse check, the sorting activity (drag-drop), Finish tracking, scheduling field + reminder emails.

**Stage D — Phase 4**
9. Workshop room + facilitator session control panel.
10. Pooled board (colour-coded, toggles), pair sheets with inline vagueness nudge, convergence ladder + voting, capture sheet, agreement assembly, save to `code_of_conduct` + `followups`.

**Stage E — deferred**
11. Phase 5 (follow-up) — **spec not written; do not build.**

---

## 5. Architectural rules that must not be violated

1. **No real-time collaborative editing.** Everything is submit-then-display, plus facilitator-triggered phase broadcast. If a requirement seems to need live multiplayer sync, stop and check.
2. **Reverse-scoring happens at READ time, in one function.** The DB always stores the literal click (1–5, unflipped). Never flip on write.
3. **Zones are read from `ps_statements`, never hard-coded.** The current compute route hard-codes the OLD split and is wrong.
4. **Clusters preserve their source labels.** Cluster labels are for the consultant (counting/ranking); exploded source behaviours are what members see and drag. Clustering abstracts away observability, so members must never sort cluster headings.
5. **Members never see the consultant dashboard.** Their access: the Phase 3 report, workshop decisions, their own Phase 1 data.
6. **No recording or transcription of the workshop.** Only deliberately-entered decisions are captured.
7. **Facilitation content is editable content, not hard-code.** Scripts, prompts, and the Reinforcement Library must be updatable without a rebuild — they will change often.
8. **Otis names clusters but never decides counts.** Counts come from deterministic embedding+threshold grouping.

---

## 6. Known open items (flag, don't silently resolve)

| Item | Where | Status |
|---|---|---|
| Embedding model + similarity threshold | Analytics Spec §6A | Choose at build |
| Agreement statistic (rWG vs SD) for "high variability" | Analytics Spec §6B | Choose at build |
| interpret model / token budget (three reads now) | Analytics Spec §6D | Re-evaluate |
| Small-n display rules (<5 members) | Analytics Spec §6E | Confirm thresholds |
| Coded-label storage (new table vs JSON) | Coding Spec §6 | Decide at build |
| **Reinforcement Library contents** | Phase 4 §6.5 | **Placeholder — Anna authoring** |
| Facilitation scripts refinement | Phase 4 §11 | Anna refining; keep editable |
| Smarter pairing logic | Phase 4 §11 | Beta = random |
| Phase 5 spec | — | **Not written** |
| Two-workshop merge | Phase 4 §10 | Deferred post-beta |
| Report download format | Phase 3 §8 | Confirm at build |

---

## 7. Known bugs to fix in passing

- **Zone math:** `compute` hard-codes zones as 1:[1-5], 2:[6-9], 3:[10-12]. The Phase 1 migration reseeded them as 1:[1-4], 2:[5-8], 3:[9-12]. Read from the DB.
- **Dashboard 3-point math:** the statement breakdown computes `green*3+yellow*2+red*1` and uses a local `"green"|"yellow"|"red"` type. It compiles but will mis-render 5-point data.
- **Stale shims:** `compute/route.ts` and `PsReflectStep.tsx` are `@ts-nocheck`'d with TODO banners. `PsReflectStep.tsx` and the orphaned `Deadfish*` files are dead and deletable.
- **`otis-analysis-skill-v31.zip`** is stale (fish + 3-point). Do not load as reference.
