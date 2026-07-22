# Otis — Canonical Phase 1 Flow (v1)
### The single source of truth for what Otis says and does, from questionnaire framing through the end of the interview
*Supersedes: deadfish-based interview flow, 3-point green/yellow/red scale, old PS item set. Companion to Decisions Log D-042 through D-047.*

---

## 0. What this document is for

This is the canonical script and logic spec for the seam currently occupied by `ps_intro_open → ps_descent → ps_intro_close → ps_frame → ps_diagnostic → deadfish_intro → deadfish → deadfish_open → review`.

Everything in Section 1 (framing) is **unchanged** from the current app, except where marked. Everything from Section 3 onward (post-diagnostic) is **new** and replaces the deadfish steps entirely.

This doc is meant to be handed to a builder (Claude Code) as the literal replacement text and logic. Where a decision is still open, it is marked `OPEN` — do not build that piece until resolved.

---

## 1. Framing steps — UNCHANGED

`ps_intro_open`, `ps_descent`, `ps_intro_close` require **no changes**. Confirmed against current source:

- `PsIntroOpenStep` — ocean metaphor intro. Keep as-is.
- `PsDescentStep` — the three `ZONES` (Safe to Belong / Safe to Speak Freely / Safe to Innovate) already match the canonical zone framing and order. Keep as-is.
- `PsIntroCloseStep` — "How deep into this ocean does your team feel safe going right now?" Keep as-is.

### 1.1 `ps_frame` — CHANGED

Current copy references the old 3-point scale ("Green means... Yellow means... Red means..."). Replace with:

> "As you go through these statements, try to think about your experience on the team broadly — not just with the people you work most closely with. It might help to especially think about how you feel in full team settings: a shared channel, an all-hands meeting, a group call where everyone is present. That's the psychological safety I'm trying to understand."
>
> "For each statement, you'll choose how much you agree, from Strongly Disagree to Strongly Agree."
>
> "There are no right answers. I'm looking for your honest read of how things actually are — not how you'd want them to be."

Button: "Let's begin" (unchanged).

---

## 2. `ps_diagnostic` — CHANGED

### 2.1 The 12 canonical items

Replaces whatever is currently seeded in `ps_statements`. Final wording, per `Otis_analysis_flow.docx`:

| # | Zone | Statement | Reverse-scored |
|---|------|-----------|------|
| 1 | 1 — Safe to Belong | On this team, everyone treats one another with respect | No |
| 2 | 1 — Safe to Belong | Members of this team accept one another for being different | No |
| 3 | 1 — Safe to Belong | Members of this team feel distant, and some people are on the outside | **Yes** |
| 4 | 1 — Safe to Belong | In this team, we understand and value one another's contributions | No |
| 5 | 2 — Safe to Speak Freely | If I need help from members of this team, I feel comfortable reaching out | No |
| 6 | 2 — Safe to Speak Freely | I feel comfortable sharing my ideas and opinions even if they aren't fully formed | No |
| 7 | 2 — Safe to Speak Freely | If I make a mistake or find a problem, I can tell my team without facing criticism or punishment | No |
| 8 | 2 — Safe to Speak Freely | On this team, we give everyone time and attention to express their perspectives | No |
| 9 | 3 — Safe to Innovate | This team takes time to question how we do things and find ways to improve our work processes | No |
| 10 | 3 — Safe to Innovate | When things go wrong, we look at what happened and what we can learn, not who to blame | No |
| 11 | 3 — Safe to Innovate | On this team, disagreeing or seeing things differently is welcomed, not just tolerated | No |
| 12 | 3 — Safe to Innovate | On this team, I feel safe to innovate and take calculated risks, and share the outcome with my team even when something doesn't work | No |

**Build task (separate from script — flag for Claude Code as its own unit):**
- `PsLabel` type: 3 values → 5 values (`strongly_disagree`, `disagree`, `neutral`, `agree`, `strongly_agree`)
- `LABEL_VALUE`: → `{ strongly_disagree: 1, disagree: 2, neutral: 3, agree: 4, strongly_agree: 5 }`
- `RATING_OPTIONS`: 5 buttons, new text/colors (no longer green/yellow/red semantics)
- `ps_statements` table: add `reverse_scored boolean` column, seed per table above
- **Reverse-scoring is applied at READ TIME only.** `ps_responses.response_value` always stores the literal `LABEL_VALUE` of what the member clicked (1–5, unflipped). Any code that computes an "effective score" (item-selection logic, analysis, reporting) must check `statement.reverse_scored` and compute `effective_value = reverse_scored ? (6 - response_value) : response_value`. This is the single flip point — do not flip anywhere else.

### 2.2 Everything else in `PsDiagnosticStep`

Zone grouping, ocean background, resume-prefill logic, upsert-on-existing-row logic: unchanged in structure, just operating on 5 values instead of 3.

---

## 3. Item-selection logic — NEW, deterministic (Tier 1, not LLM)

Runs once, immediately after the last statement is rated, before advancing past `ps_diagnostic`.

```
1. For each of the 12 responses, compute effective_value (apply reverse-score flip per 2.1).
2. eligible = all items where effective_value <= 3 (Neutral or below).
3. If eligible.length == 0 → route to ALL-POSITIVE BRANCH (Section 5). Stop here.
4. Sort eligible by:
     a. zone ascending (1=Belong, 2=Speak, 3=Innovate) — PRIMARY key
     b. effective_value ascending (most negative first) — SECONDARY key
     c. statement_id ascending — TIEBREAKER
5. selected = top 2 from sorted eligible (or top 1, if eligible.length == 1).
6. Store selected item IDs + the member's literal response label for each, for use in Section 4.
```

This is a pure function over already-collected data — no LLM call, fully reproducible.

---

## 4. The interview transition and probe — NEW

Replaces `deadfish_intro → deadfish → deadfish_open` entirely. Proposed step name: **`ps_interview`** (single step, handles both selected items sequentially in one component — simpler resume logic than splitting into two steps). Confirm before build if you'd rather split.

### 4.1 Opening (runs once, before either item)

> "Thank you for filling out the questionnaire. I want to focus on some of your responses."
>
> "Your response was **'[response 1 label, e.g. Disagree]'** to the question **'[item 1 text]'**, and **'[response 2 label]'** to the question **'[item 2 text]'**."
>
> "I'd like you to tell me more about what led you to give this answer. For each item, think about a situation from the recent past that involved at least part of your team. It might have been a moment during a meeting, during a project or task you had to complete, or any other time.
>
> Please describe:
> 1. What was happening, and what was the objective?
> 2. What did people do or say that led you to your response?
> 3. What effect did that have on you, your work, or the team in general?"

*(If only 1 item was eligible, this opening still runs, just referencing the single item.)*

### 4.2 Per-item probe loop

**Implementation note — read before building:** this is an adaptive LLM-driven conversation, not a scripted 4-question form. The four fields in the Section 9 schema (`situation_text`, `out_behavior_text`, `outcome_text`, `in_behavior_text`) are the *distilled output* of that conversation, not four form inputs presented in sequence. The behaviors below (skip if already covered, reflect adjectives back, offer binaries, max 4 turns) require the model to track conversation state across turns and judge, in real time, whether a bucket has already been sufficiently answered. Build this the same way the existing analysis routes work (a dedicated API route driving a live conversation), not as a linear form.

**Safety net, required:** "skip if already covered" is a soft LLM judgment and can misfire (skipping a bucket the user didn't actually address). If a bucket's distilled text ends up empty or too thin after being marked "covered," fall back to asking the bucket's question directly rather than silently leaving the field blank. Do not ship this without that fallback.

Runs once for item 1, then again for item 2. Same structure both times.

**Entry line:**
> "Let's start with **[item text]**. Take a moment to think about a situation when you [felt-phrase for this item — see table in 4.3]."

**Turn 1 — Situation** *(if not already covered by the free-response above)*
> Otis asks clarifying questions only if unclear: "Was this during a meeting? How many people were involved? You don't have to name names — what were you there to achieve, or what was the task or purpose?"
> Max 4 turns. Otis clarifies, does not paraphrase at length.

**Turn 2 — Behavior** *(if not already covered)*
> "What did people do or say that led you to [their response, e.g. 'disagree'] with that statement?"
> If the user answers with a trait/adjective ("was rude," "wasn't listening"), Otis reflects the word back and asks what was observed that led them to it: "When you say [X] — what did you actually see or hear that made you think that? It might be something like body language, or something someone said or didn't say."

**Turn 3 — Outcome** *(if not already covered)*
> "What effect did these behaviors have on you, your work, or the team in general?"

**Turn 4 — Reflection**
> Otis paraphrases the behaviors and outcome at team level: "You told me that you observed ___, and that this led to ___. What could the team have done differently that might have led to a better outcome?"
> Otis may offer a binary to help the user land on a specific answer: "So do you think the team could [X] instead of [Y]?"

**Then advance to the next selected item (repeat 4.2), or to Section 6 (review) if both items are done.**

### 4.3 Per-item "felt" phrases (for the entry line in 4.2)

| # | Felt-phrase |
|---|---|
| 1 | felt that not everyone on your team treated one another with respect |
| 2 | felt that members of your team didn't fully accept one another for being different |
| 3 | felt like some people on your team were distant, or on the outside |
| 4 | felt that your team didn't fully understand or value one another's contributions |
| 5 | felt uncomfortable reaching out to your team for help, even when you needed it |
| 6 | felt uncomfortable sharing an idea or opinion that wasn't fully formed |
| 7 | felt like you couldn't tell your team about a mistake or problem without facing criticism or punishment |
| 8 | felt like you, or someone else, didn't get the time or attention to express your perspective |
| 9 | felt like your team didn't take the time to question how you do things or find ways to improve |
| 10 | felt like your team focused on blame rather than learning, when something went wrong |
| 11 | felt like disagreeing or seeing things differently was merely tolerated, not really welcomed |
| 12 | felt unsafe to take a calculated risk, or unsafe to share the outcome with your team when something didn't work |

---

## 5. All-positive branch — NEW (D-047)

Triggered when `eligible.length == 0` in Section 3.

> "You scored your team well across every question. That's a good sign, and it's worth saying: it sounds like you experience this team as a psychologically safe place to be. I still want to walk through one short reflection with you, because even strong teams have moments they could sharpen.
>
> I believe there's always a little room to grow. So instead of looking for a problem, I want you to think of a moment your team did fine, but might have done something even better with a small change in how you worked together.
>
> Pick whichever of these feels easier to think about:
> - This team takes time to question how we do things and find ways to improve our work processes
> - On this team, disagreeing or seeing things differently is welcomed, not just tolerated"

Member picks one. Then:

> "Good choice. Think of a recent situation connected to that. It doesn't need to have gone wrong — just a moment you think could have gone even better.
>
> Take a moment, then tell me: what was happening, and what was the objective?"

Runs the same Situation → Behavior → Outcome → Reflection loop (Section 4.2), with two wording shifts:
- Behavior question: "What did people do or say in that moment?" (drop "led you to disagree")
- Reflection stays as written in 4.2, Turn 4.

---

## 6. `STEP_ORDER` changes

```diff
  "ps_diagnostic",
- "deadfish_intro",
- "deadfish",
- "deadfish_open",
+ "ps_interview",
  "review",
```

## 7. Resume-ladder update — REQUIRED, not optional

Current resume logic keys off row existence: `fish_responses` with non-null `fish_id` → resume at `deadfish_open`; `ps_responses round 1` → `deadfish_intro`. Since `fish_responses` no longer applies, this must be replaced with something like:

- `ps_responses round 1` complete (all 12 rated) + no interview responses saved yet → resume at `ps_interview`, item 1
- `ps_responses round 1` complete + item 1 interview saved, item 2 not → resume at `ps_interview`, item 2
- Both interview responses saved → resume at `review`

Exact schema for storing interview responses (new table vs. `ps_responses round 2`) is **OPEN** — needs a decision before Claude Code builds this, since it determines the resume query.

## 8. Downstream field swaps — REQUIRED

`ReviewStep` currently reads `teamFish`, `deadfishRatings`, `deadfishCustomText`, `deadfishCustomSeverity`. These must be replaced with whatever fields hold the new interview transcript/responses. `CloseStep` is unaffected (only writes `status`/`completed_at`).

---

## 9. Storage schema and step structure — RESOLVED

Decided by working backward from what Phase 2 coding (per `Otis_analysis_flow.docx`) needs as input: data already split into the four buckets, already linked to the source PS item, so Phase 2 doesn't have to re-parse a conversation blob.

**New table: `ps_interview_responses`** — one row per member, per probed item.

| Field | Purpose |
|---|---|
| `member_id`, `team_id`, `statement_id` | Links this response to the specific PS item — the critical join Phase 2 needs |
| `member_response_label` | The member's original 5-point rating on this item (context for Phase 2 and for the "Your response was X" recap) |
| `situation_text` | Turn 1 answer → feeds Phase 2's SITUATION bucket |
| `out_behavior_text` | Turn 2 answer → feeds Phase 2's OUT-BEHAVIOR bucket |
| `outcome_text` | Turn 3 answer → feeds Phase 2's OUTCOME bucket |
| `in_behavior_text` | Turn 4 (Reflection) answer → feeds Phase 2's IN-BEHAVIOR bucket. *(Renamed from "reflection_text" — the question is framed as reflection, but the content it elicits, "what could the team have done differently," is the IN-behavior data Phase 2 codes it as. Naming the field for what it contains, not how it was asked, avoids ambiguity at the coding step.)* |
| `is_all_positive_branch` | True if this came from the Section 5 reframed script, not the standard probe — Phase 2 needs to know this wasn't triggered by a negative score |

**`multi_member_flag` — removed from this table.** Per `Otis_analysis_flow.docx`, flagging "this might be a private conversation, not a team-level interaction" is explicitly a Phase 2 coding judgment made by reading `situation_text` — it is not something the member self-reports during Phase 1. Moving this to Phase 2 as a derived flag, not a Phase 1 collected field. (Caught this while reconciling against the analysis spec below — see Section 10.)

**Step structure: single `ps_interview` step, confirmed.** Behaves like `PsDiagnosticStep` — one component, loops internally over the 1 or 2 selected items, writes one `ps_interview_responses` row per item as each completes. Resume logic: count existing rows for this member against the number of items selected (0 rows = resume at item 1; 1 row and 2 were selected = resume at item 2; rows == selected count = resume at `review`).

**Item 12 double-barreled issue: deferred, not resolved.** Not blocking build.

## 10. Integration check against Phase 2 / Phase 3 — open reconciliation items

See chat for full discussion. Two real gaps found, not yet resolved:

1. **Two Phase 2 pipeline designs currently coexist.** The v3.1 8-stage fish/STARR pipeline (Decisions Log D-038, Session 2 Assembly Algorithm) and the new PS-item-anchored bucket-coding design in `Otis_analysis_flow.docx` describe overlapping work using different terminology and staging. Fish is retired (D-042), so v3.1's pipeline needs to be explicitly re-mapped onto the new design or marked superseded — not assumed compatible by default.
2. **Two dashboard designs currently coexist.** The existing three-zone consultant dashboard (Recommendation / What to put to the team / Just for you) and the new context/objective/behavior-cluster dashboard described in `Otis_analysis_flow.docx` haven't been reconciled — unclear if the new one replaces the three-zone structure or nests inside it.

Both are pre-existing unreconciled gaps (consistent with the ones already logged in memory), surfaced again here because Phase 1's new schema needs to hand off cleanly to whichever Phase 2 design is canonical. Structurally, `ps_interview_responses` supports either — it's a data question, not a rebuild — but the pipeline itself should be reconciled before Phase 2 is built.
