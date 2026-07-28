# Otis — Architecture & Build Order (v1)
### What exists, what's new, what depends on what, and the order to build it
*Read this FIRST, before the phase specs. It exists to prevent architectural choices that create expensive rework.*

---

## 1. The full document set (hand these over together)

| Doc | Covers | Status |
|---|---|---|
| **This doc** | Architecture, dependencies, build order | Read first |
| `Otis_Pivot_Handoff_v1.md` | Delete / Keep / Build for the pivot | **Read second** |
| `Wavelength_Session4_Decisions_Log.md` | All decisions D-042 → D-053 + pivot decisions | Reference |
| `Otis_CarriedForward_Decisions_Reference.md` | D-027 → D-041 (earlier decisions the specs cite) | Reference |
| `Decisions_D048_D049_draft.md` | D-048 (pipeline reconciliation) + D-049 (direct voice) | Reference |
| `Otis_Phase1_Canonical_Flow_v1.md` | Phase 1 (survey-only after pivot; interview removed) | **Already built**, needs trimming |
| `Otis_Phase2_Analytics_Spec_v1.md` | compute → interpret → consultant dashboard | **Partly built**, needs trimming (remove team stories) |
| `Otis_ZoneRead_Generation_Guide_v1.md` | How Otis writes the PS zone read | Input to Phase 2 |
| `Otis_SharedPurpose_Read_Guide_v1.md` | How Otis writes the purpose read | Input to Phase 2 |
| `Otis_Phase3_MemberReport_Spec_v1.md` | Member report + merged reflection/generation | **To build (PIVOT — rewritten)** |
| `Otis_Phase4_Workshop_Spec_v1.md` | The live workshop | **Partly built**, light edits only |
| `ps_interview_revised.ts` | Conversational guardrails (transfer to Phase 3 prompt) | Reference for prompt writing |
| Phase 5 (follow-up) | Not yet written | **Gap — do not build** |

**SUPERSEDED docs (archived in archive_v1/, do not use):**
- `Otis_Phase2_Coding_Spec_v1.md` — full coding pipeline retired
- `Otis_Phase2_Coding_Clustering_Redesign_v1.md` — superseded before implementation
- `Otis_TeamStories_Narrative_Template_v1.md` — team stories no longer assembled from coded buckets

**Phase numbering (locked):** 1 = survey + PS education · 2 = light analysis + dashboard · 3 = member report + merged reflection/generation · 4 = live workshop · 5 = follow-up.

---

## 2. What already exists vs. what is genuinely new (POST-PIVOT)

### Already built and KEPT
- Member auth + profiles (Stage A) — foundational, unaffected
- The 12-item PS diagnostic, purpose collection, coordination ratings
- Phase 2 compute (zone favorability, shared-purpose, networks) — none depended on stories
- Phase 2 interpret (zone reads, shared-purpose read, focus hypothesis) — **minus `team_stories`**
- Consultant dashboard Analytics tab (SharedPurposePanel, PsSafetyPanel, TeamConnectivityPanel, OtisChatBubble) — **minus TeamStoriesPanel**
- Phase 4 workshop mechanics (pairs, convergence ladder, fist-of-five, agreement, facilitator panel)
- The conversational engine + all guardrails (ps_interview_revised.ts)
- PreworkReview component shell (needs modification)
- `workshop_seed` table

### Already built and NEEDS TRIMMING
- Phase 1 flow — remove the 4-bucket interview steps, keep survey + education
- `interpret` route — remove `buildTeamStories` call, remove `team_stories` from `tier2_json`
- Dashboard page — remove TeamStoriesPanel import and render

### Already built and DELETE
- `prompts/part2_coding.ts`, `lib/coding.ts` — full coding pipeline
- `lib/narratives.ts` — deterministic story assembly
- `lib/clustering.ts` story-processing paths (MAY retain for lightweight behavior dedup)
- `interview_labels` table usage
- `components/dashboard/TeamStoriesPanel.tsx`

### Genuinely NEW (the pivot's real new work)
1. **Phase 3 conversation prompt** — merged reflection + generation, using the conversational engine
2. **Phase 3 self-service board UI** — NEVER/SOMETIMES/ALWAYS buckets, member types directly
3. **Otis's live coaching checks** — observability, anonymity, absence nudges during entry
4. **Story storage** — simple table (member_id, team_id, statement_id, story_text, story_order)
5. **Member behavior storage** — simple table (member_id, team_id, statement_id, bucket, text, source, flagged)
6. **Deferred situation-tagger** — lightweight batch LLM pass, one context tag per story
7. **Updated PreworkReview** — reviews member-written behaviors instead of AI-generated clusters

### Infrastructure that was built but is now SUPERSEDED
- `interview_labels` table and migration — coding pipeline retired
- `lib/embeddings.ts` and Voyage AI integration — MAY still be useful for behavior dedup, but the 5-stream story-coding use case is gone. Decide at build whether to retain for dedup or cut entirely.

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
