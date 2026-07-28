# Otis — Pivot Handoff: Delete / Keep / Build
### What Claude Code needs to know about the architectural pivot
*Read alongside: the rewritten Phase 3 spec, the lightly-edited Phase 4 spec, and the updated Decisions Log. Previous versions archived in archive_v1/.*

---

## What happened

Phase 1 is now survey-only. Stories and behaviour generation moved to Phase 3, focused on the team-selected item (D-051). The heavy 5-stream coding/clustering pipeline for stories is replaced by: (a) Otis coaching members live as they type behaviors directly, and (b) a light deferred situation-tagger. The Phase 4 workshop is almost entirely unchanged — it already consumed "member-submitted behaviors in Never/Always/Sometimes buckets," which is exactly what Phase 3 now produces.

---

## DELETE (subtraction)

| What | Files / code | Why |
|---|---|---|
| The 4-bucket interview loop | `prompts/ps_interview.ts` — the BUCKETS, DIRECT_QUESTIONS, and the interview system prompt's 4-bucket flow (Situation→Behavior→Outcome→Reflection) | Phase 1 no longer collects stories. The FELT_PHRASES table and ALL_POSITIVE_ITEM_IDS may still be useful for Phase 3's situation invitation; check before deleting. |
| The full coding pass | `prompts/part2_coding.ts`, `lib/coding.ts`, the `interview_labels` table and its migration | Replaced by Otis's live coaching + light deferred tagger. No more primary_code / gerund extraction / absence-reframing pipeline. |
| The 5-stream clustering for stories | The story-processing paths in `lib/clustering.ts` (the `STREAM_KEYS`, `streamOf`, the full `clusterTeamLabels` flow that reads `interview_labels`) | Clustering MAY still be useful for lightweight dedup of member-submitted behaviors in the Phase 4 pool, but the 5-stream story-coding pipeline is gone. |
| Team Stories narrative template | `lib/narratives.ts`, the `Otis_TeamStories_Narrative_Template_v1.md` guide | No team stories are assembled from coded buckets anymore. Stories are raw text saved per member. |
| Team Stories dashboard panel | `components/dashboard/TeamStoriesPanel.tsx` and its bucket-boxes sub-components | The Analytics tab no longer has a "Team Stories" section at this stage (stories now happen in Phase 3, not Phase 2). |
| The Coding & Clustering Redesign spec | `Otis_Phase2_Coding_Clustering_Redesign_v1.md` | Superseded by the pivot before it was implemented. |
| The old Coding Spec | `Otis_Phase2_Coding_Spec_v1.md` | Superseded. |
| The old `ps_interview_responses` 4-field structure | The `situation_text`, `out_behavior_text`, `outcome_text`, `in_behavior_text` columns | Phase 1 no longer fills these. Phase 3's story storage is a simpler shape (see BUILD below). |
| `interpret`'s team_stories assembly | The `buildTeamStories` call in `app/api/analysis/interpret/route.ts` and the `team_stories` field in `tier2_json` | No team stories at this stage. The `interpret` route still produces zone reads, shared-purpose read, and focus hypothesis. |

---

## KEEP (untouched or nearly so)

| What | Why |
|---|---|
| **Member auth + profiles** (Stage A) | Foundational, unaffected. |
| **The 12-item PS diagnostic** (`PsDiagnosticStep`, `ps_statements`, `ps_responses`) | Phase 1's core, unchanged. |
| **Purpose + coordination collection** | Still collected in Phase 1, consumed by Phase 2. |
| **Phase 2 compute: zone favorability, shared-purpose, networks** | None of this ever depended on stories. Keep as-is. |
| **Phase 2 interpret: zone reads, shared-purpose read, focus hypothesis** | Keep, minus the `team_stories` and `buildTeamStories` call. The `tier2_json` shape loses the `team_stories` field; everything else stays. |
| **Zone-Read and Shared-Purpose generation guides** | Still the canonical source for those reads. |
| **The dashboard's Analytics tab** (minus TeamStoriesPanel) | SharedPurposePanel, PsSafetyPanel, TeamConnectivityPanel, OtisChatBubble — all stay. |
| **The entire Phase 4 workshop mechanics** | Pairs, convergence ladder, size-adaptive structure, round-robin, fist-of-five, agreement assembly, Reinforcement Library placeholder. ALL KEPT. The workshop consumes behaviors from `workshop_seed`, which Phase 3 now populates directly. |
| **The conversational engine infrastructure** | The turn-taking loop, tool-call pattern, and ALL guardrails (decline/stall, off-topic, troll, harm disclosure). These transfer to Phase 3's conversation. |
| **The OtisChatBubble component** | Reused in Phase 3 as the member's "chat with Otis" assistant. |
| **The PreworkReview component** (with modifications) | Becomes the consultant review of member-submitted behaviors. Needs edits but the shell survives. |
| **`workshop_seed` table** | Still the bridge between consultant review and the workshop. Same purpose, same shape. |
| **D-051 team-level item selection** | Now the ONLY item-selection mechanism (D-043 individual retired). |
| **The 12 action-phrase pairs** (new, Phase 3 §3.5) | Used in the bridge script. |
| **The revised interview guardrails** (`ps_interview_revised.ts`) | The guardrail sections transfer to Phase 3's prompt, even though the old interview flow is deleted. |

---

## BUILD (new)

| What | Where | Notes |
|---|---|---|
| **Phase 3 merged reflection + generation conversation** | New prompt (reuses the conversation engine). | See Phase 3 Spec §4. Otis invites stories about the team-selected item, then bridges into the generation activity. Uses the 12 action-phrase pairs. |
| **Phase 3 self-service board UI** | New component, member-facing. | Three buckets (NEVER / SOMETIMES / ALWAYS). Member types entries directly. Min 2 Never + 2 Always. Otis coaches via OtisChatBubble (existing component). |
| **Otis's live coaching checks** | In the Phase 3 conversation/board logic. | Observability check, anonymity check, absence check — all as gentle one-try nudges, not blocking. Flag entries the member insists on. |
| **Story storage** | New simple table/record. | `member_id`, `team_id`, `statement_id`, `story_text`, `story_order`. Raw text, no coding fields. |
| **Member behavior storage** | New simple table/record. | `member_id`, `team_id`, `statement_id`, `bucket` (never/always/sometimes), `text`, `source` (member/consultant), `flagged` (boolean). |
| **Deferred situation-tagger** | New lightweight LLM pass, runs after Phase 3 submission. | Reads story text, tags with context category (meeting/chat/email/etc.). One tag per story. Stored on the story record. |
| **Updated consultant review in PreworkReview** | Modify existing component. | Now reviews member-written behaviors (not AI-generated clusters). Shows flagged entries, situation-context summary, edit controls, release gate. |
| **Phase 1 trimmed to survey-only** | Remove the interview steps from Phase 1's flow. | Keep the diagnostic, purpose, coordination. Remove the 4-bucket interview and its prompt. Possibly add more PS education content (Anna to supply). |
| **Remove `team_stories` from `tier2_json`** | Edit `interpret` route and prompt. | Keep zone reads, shared-purpose read, focus hypothesis. Drop `buildTeamStories` call and `team_stories` field. |
| **Remove TeamStoriesPanel from dashboard** | Delete the component and its import in `page.tsx`. | The Analytics tab becomes: Shared Purpose → PS Safety → Team Connectivity. Cleaner. |

---

## Build order (recommended)

1. **Phase 1 trim** — remove the interview steps, confirm survey-only flow still works end to end. Quick, subtractive.
2. **Phase 2 trim** — remove `buildTeamStories` from interpret, `team_stories` from `tier2_json`, TeamStoriesPanel from dashboard. Subtractive.
3. **Phase 3 build** — the new conversation prompt, the board UI, the story/behavior storage, the live coaching, and the updated PreworkReview. This is the real new work.
4. **Deferred situation-tagger** — the light batch LLM pass. Can be a separate small increment after Phase 3's core is working.
5. **Phase 4 light edits** — update the seed source references, update M1's framing text, confirm the pool still renders correctly from `workshop_seed`. Should be minimal.
6. **End-to-end test** — survey → analysis → member report → stories → behaviors → consultant review → release → workshop. The first full-arc run.

---

## What's explicitly NOT changing

- The Phase 4 workshop choreography (pairs → team → agreement → commitment).
- The zone/purpose/network analysis.
- The generation guides for zone reads and shared-purpose reads.
- Member auth + profiles.
- The architectural rules (no real-time sync, reverse-score at read time, zones from DB).
- The Reinforcement Library placeholder.
