# Otis Phase 3 — Member Report, Reflection & Behaviour Generation (v1, PIVOT)
### What each member sees after team analysis, including the merged story + activity step
*Builder doc for Claude Code. SUPERSEDES the previous Phase 3 spec (archived in archive_v1/). This is the pivot version: stories and behaviour generation happen HERE, not in Phase 1. Phase 1 is now survey-only.*

*Companion to: Phase 4 Workshop Spec, Phase 2 Analytics Spec (trimmed), Session 4 Decisions Log, Architecture & Build Order doc.*

---

## 0. Purpose and what changed

**Phase numbering (locked):** 1 = survey + PS education · 2 = light analysis + consultant dashboard · **3 = member report + merged reflection/generation (THIS DOC)** · 4 = live workshop · 5 = follow-up.

**The pivot:** Phase 1 no longer collects stories or runs the 4-bucket interview. Members take the 12-item PS survey, the purpose question, and the coordination ratings — that's it. Team-level item selection happens in Phase 2 (D-051). Stories and behaviour generation now happen here in Phase 3, focused on the team-selected item(s), so every member reflects on the SAME thing and cross-member convergence is possible by design.

**Access:** members reach this through their member profile. It persists — they can return after the workshop.

---

## 1. What members see vs. what consultants see

Members see a REDUCED version of the dashboard. They do NOT see the consultant dashboard.

| Content | Consultant dashboard | Member report |
|---|---|---|
| Networks | ✅ full | ✅ shown |
| Shared-purpose read | ✅ | ✅ |
| Zone stats + reads | ✅ full detail | ✅ headline stats + reads |
| Survey item breakdown | ✅ full | ❌ |
| Team stories / coded buckets | ❌ (no longer exist at this stage) | ❌ |
| Otis's assumptions/hypothesis | ✅ | ❌ |
| Their own Phase 1 responses | ❌ | ✅ (own only) |

**Privacy rule (carry throughout):** any member-facing view must honour `share_verbatim_with_team` / `share_name_with_team`. Verbatim content and names appear only for members who granted permission; others are anonymised.

**Consultant editability:** the consultant can edit any part of this script/report in the dashboard before release. For the beta, Otis does NOT auto-adapt the script; the consultant adapts it.

---

## 2. Report contents, in display order

### 2.1 The two networks
Shown first — they orient members to WHO the team is before any findings.

Order: geographic network first, then collaboration-frequency network.

- Names shown for members who granted `share_name_with_team`; anonymised symbols otherwise.
- **Text rule (locked):** descriptive only, no interpretation, no "density" language. Provide a legend and at most one factual sentence.

### 2.2 Shared-purpose read
The ~100-word read from the Shared-Purpose Read Guide.

### 2.3 Zone statistics
Headline zone numbers mirroring the dashboard: % favorable per zone with counts, and the RYG display band. Every number must be self-explaining — never a bare percentage.

### 2.4 Zone reads
The ≤200-word zone reads (overall_shape + zone1/2/3) from the Zone-Read Generation Guide, rendered over the ocean image.

### 2.5 Pulse checks (per-zone and per-purpose, inline)

**Design change from earlier draft:** the single end-of-report pulse check is replaced by **inline pulse checks beside each summary**. This turns each summary into a mini-conversation (read → react → optionally comment) rather than one big end-of-report survey.

**One pulse check per zone read (three total) + one for the shared-purpose read.**

Each pulse check has TWO parts:

1. **Forced-choice question, always visible directly beside/beneath the read:**
   > "How accurate do you feel Otis's conclusions are?"
   Choices: **Not at all accurate · Somewhat accurate · Very accurate · Don't know · Decline to answer**

2. **Optional comment box, collapsed by default with an expander ("Share a comment"):**
   > "Share a comment (optional) — this stays private to your consultant."
   The privacy line is REQUIRED so members know their words are not going to the team unless they said so.

Stored to `feedback_responses`, **but note the schema needs to change**: the existing table has singular `assumption_resonance` / `assumption_notes` columns (built for one pulse check). The new design needs ONE ROW PER read (4 rows per member: zone1, zone2, zone3, purpose), each carrying: `read_key` (which read it refers to), `accuracy_rating` (one of Not at all accurate / Somewhat accurate / Very accurate / Don't know / Decline to answer), and `comment` (nullable). This likely means either a new table (`phase3_pulse_checks`) or altering `feedback_responses` to be one-row-per-read instead of one-row-per-member. Decide at build; flag which was chosen.

### 2.6 Zone read framing — hypothesis posture (guide amendment)

The Zone-Read Generation Guide is being amended (small change) to prefer **hypothesis framing** over consulting-posture recommendations, so that the pulse checks are meaningful (members react to a claim they can agree or disagree with, not to vague hedges).

Hypothesis framing extrapolates one visible step from what the data shows, using humble language ("likely," "we'd expect," "this pattern suggests"), and closes with an implicit or explicit invitation to react.

- **Old style (consulting):** "Addressing candor first is the right sequence."
- **New style (hypothesis):** "Low innovation likely follows from the candor gap rather than standing on its own — we'd expect risk-taking to be hard when speaking up itself feels hard."

This does NOT undo the humility discipline in the Zone-Read Guide (no causal leaps, no team-type inferences). It just prefers a specific hypothesis to a vague recommendation. See the amended Zone-Read Guide for the full rule + one worked example.

### 2.7 Visual layout — ocean depth (member report)

The member report's PS section renders with an **ocean-depth background** running behind the three zones: light surface water at Zone 1, mid-water at Zone 2, deep water at Zone 3. Each zone's summary card + statistics + pulse check sits inside its own visual band.

The zone statistics from the Analytics dashboard (% favorable, counts, mean, band, agreement SD) render in the member report too, one card per zone, inside the ocean-depth bands. Do not simplify away the numbers — members can handle them if they're labeled.

---

## 3. Focus-item announcement — SUPERSEDED BY §4.2, stretch-case fallback kept

**This section is superseded.** The original "we've come a long way..." script below is REPLACED by §4.2's "The goal today is to make your team a psychologically safer place..." wording. Do NOT implement both — that would have Otis explain "why this item" twice, in two different scripts, back to back. §4.2 is the one to build.

The stretch-case fallback below is still needed (§4.2 doesn't restate it) — use it when the team scored well across the board:

> "Your team's answers were strong across the board, which is genuinely great to see. Since safety is never really finished, I want to use this time to push a little further, into **[fallback item, default: Innovate items 9 or 11]**."

This fallback line slots into §4.2 in place of the normal focus-item framing when the stretch case applies.

---

## 3.5 The 12 action-phrase pairs (LOCKED)

Used in the bridge script's [ACTION] slot. Item 3 is inverted since it's reverse-scored.

| # | Action phrase |
|---|---|
| 1 | treat one another with respect |
| 2 | accept one another for being different |
| 3 | feel like everyone belongs, not left on the outside |
| 4 | understand and value one another's contributions |
| 5 | reach out to one another for help |
| 6 | share ideas and opinions even before they're fully formed |
| 7 | admit a mistake or flag a problem without fear of criticism or punishment |
| 8 | give one another time and attention to express their perspectives |
| 9 | question how things are done and look for ways to improve |
| 10 | look at what went wrong and learn from it, rather than assign blame |
| 11 | welcome disagreement and different points of view |
| 12 | take calculated risks and be honest about the outcome, even when it doesn't work |

---

## 3.6 Consultant report review & release (NEW — closes a second spec gap, see note below)

**Gap note:** §1 states the consultant can edit any part of the report before release, but the actual screen was left as an unspecified "build detail." This section fixes that. This is a DIFFERENT screen from §5 (which reviews member-submitted behaviors, and only has content once members finish Phase 3). This screen runs BEFORE any member sees anything, right after analysis completes.

### What the consultant sees and can edit

1. **The three zone reads** (overall_shape + zone1/2/3) — editable text, Otis's original preserved and viewable.
2. **The shared-purpose read** — editable text.
3. **The focus item + focus hypothesis** — the item Otis selected (D-051), with an override control showing the next-ranked alternative(s); selecting one repopulates the hypothesis. Primary always restorable.
4. **The workshop-introduction script** (§3) — the "we've come a long way..." text, with the item/zone/action-phrase already slotted in — editable, since it's consultant-facing copy the team will read.
5. **The networks section text** — the plain-English factual lines — editable.

### Release action

A single **"Release to team"** action that:
- Locks in the (possibly edited) report content
- Sends the Phase 3 invite/link to all members (email, per the reminder pattern in §9)
- Moves `teams.status` to reflect "in Phase 3"
- Cannot be undone by re-editing after members have started — if the consultant needs to change something after release, that's a manual re-send, not automatic re-notification (consistent with the same "no automatic re-notification" principle used in §5).

### Relationship to §5

This screen (report content) runs once, before any member sees Phase 3. Section 5 (behavior review) runs once, after all members finish Phase 3. They are sequential, not the same screen — do not conflate them.

---
## 4. The merged reflection + behaviour generation activity

This is the core of Phase 3's pivot. Combines the reflection (stories) with the behaviour generation into ONE arc, focused on the team-selected item. The arc is deliberately **educational** — members are adult learners being introduced to psychological-safety concepts through reflection and activity, not being surveyed.

### 4.0 Overall arc (member's experience, high level)

**Full page/screen sequence, top to bottom (this is the one authoritative order — §2 and §4 describe pieces of it, this list is how they combine):**

1. §4.1 Welcome + orient (Otis, conversational)
2. §2.1–2.4 Report reads: networks → shared-purpose read → zone stats → zone reads, each zone/purpose read followed immediately by its §2.5 pulse check (forced-choice + optional comment)
3. §4.2 Transition into story — WHY this item (Otis, conversational)
4. §4.3 Story 1, then live context-reflection + invitation for another story in a different context (repeat up to 3 stories total)
5. §4.4 Transition to the behaviours activity — educational (Otis, conversational; own screen, before the board)
6. §4.5 The behaviour board (NEVER/SOMETIMES/ALWAYS, min 2+2, collapsed examples, OtisChatBubble available)
7. §4.6 Live coaching happens inline as entries are submitted on the board (not a separate screen)
8. §4.7 Close

**Navigation:** Back and Forward buttons must be present between each of these stages. A member may go back to review or edit their stories after starting the board, and may leave the board and come back. Do NOT gate progression on strict completeness beyond the minimum-entry rule at the board (§4.5).

### 4.1 Welcome + orient (before diving into results)

Otis opens with a warm welcome that sets up what today is FOR. This is not a report reveal — it is the beginning of an educational activity.

> "Welcome back, [name]. Before we get started, here's what today is about.
>
> Building psychological safety on a team happens one small step at a time. Today I want to help you take one of those steps.
>
> First we'll look at where your team is right now — what's going well, where there's room to grow. Then we'll focus in on **one** thing your team could work on together, and I'll ask you to think through some ideas about it. Your ideas will feed into a workshop your team will do together soon.
>
> Ready?"

The report reads (§2) then unfold, with pulse checks inline as members go.

### 4.2 Transition into the story — WHY this item

After the reads and pulse checks, Otis introduces today's focus item explicitly, tying it to the goal.

> "The goal today is to make your team a psychologically safer place, one small step at a time. And today I'd like us to do that by looking at how we can make your team a safer place to **[ACTION PHRASE]**.
>
> To get there, I'd first like to understand more about why your team might have scored this item the way it did. Has there been a situation in the recent past that comes to mind where you noticed something around **[ACTION PHRASE]** on your team?
>
> Doesn't need to be a big thing — small moments count too. Try to describe what was happening, who was there, and what happened."

The story-eliciting prompt should reuse the discipline from the original Phase 1 interview scripts: encourage description of the situation, the behaviours, and the outcome. Otis should let the member describe things in their own way — no strict bucket prompts.

### 4.3 Live context reflection + invitation to another story

**This replaces the old shallow "was there another time" prompt.** After the first story, Otis:

1. Names the context back in one short phrase (e.g. "a planning meeting," "a Slack thread," "during onboarding," "a project handover"). This shows the member Otis is listening and gives the follow-up a real pivot.
2. Invites a story in a **different** context, not just "another time":

> "Thanks for telling me that. Your story took place in **[context]**. Have there been other moments on your team, in a different setting — a different meeting, a chat, an email exchange, a project — where you noticed something around **[ACTION PHRASE]**?"

The member may say "no, that was the main one" and that is fine. If they offer a second story, Otis may (optionally) invite a third, following the same pattern — name the new context back, invite a different one. Cap at 3 stories total to prevent fatigue.

### 4.4 Transition to the behaviours activity — educational

**This is where the previous build fell short and where the most work goes.** Members should not encounter a bare "add behaviours to columns" screen. They should first be brought into WHAT a behaviour is, WHY the team is doing this, and WHAT will happen with what they type.

Otis says (as a distinct step, on its own screen before the board appears):

> "Thank you for sharing those. Now I'd like to move into an activity that will feed into the workshop your team does together.
>
> Here's the goal: **think about the situations you just told me about — the moments when the team was NOT a safe place to [ACTION PHRASE] — and try to pinpoint what behaviours were working against psychological safety at those times. At the same time, think about what behaviours would make the team a safer place to [ACTION PHRASE].**
>
> I'd like you to land on:
> - **NEVER** behaviours — things you would never want to see if we want the team to be a safe place to [ACTION PHRASE]
> - **ALWAYS** behaviours — things you would always want to see
> - **SOMETIMES** — behaviours that might depend on the situation. You'll debate these together as a team.
>
> One thing to keep in mind: **a behaviour is something you can see or hear.** It's observable. It might be a subtle bit of body language, a specific phrase someone uses, a small ritual the whole team does — the key is that it's an action, not a feeling or a general attitude."

Then Otis previews the examples format:

> "To give you a sense of the range, here are some behaviour examples for **[item text]**. You don't have to use these — the point is just to show the kind of thing a behaviour can be. Your team's specific behaviours will be different."

Show the item-specific example table (§4.8) — three ALWAYS and three NEVER, briefly. Then a "Continue" button that reveals the board.

### 4.5 The behaviour board (self-service, member types directly)

Three buckets visible to the member: **NEVER · SOMETIMES · ALWAYS**

The member types their own entries directly into the buckets. **Minimum: 2 NEVER + 2 ALWAYS.** SOMETIMES is optional.

**Above the board, short standing reminders visible at all times (compact — one line each):**
- *You're doing this for the item: [item text]*
- *A behaviour is something you can see or hear on your team*

**Below or beside the buckets, a collapsed "See examples" element** which, when expanded, shows the same item-specific examples from §4.4/§4.8. Collapsed by default so members generate their own; available if they get stuck.

**Otis is available via the OtisChatBubble** (existing component). Otis in chat may brainstorm with the member, help them think, suggest phrasings. **Otis NEVER writes directly to the board.** The member always types.

### 4.6 Live coaching on each entry

When a member submits an entry, Otis runs three independent checks and may gently coach. This is educational, not gatekeeping. If the member insists after one gentle try, accept and flag privately for the consultant.

**Build note:** this coaching mechanism already exists as `/api/phase3/behaviors/route.ts` (three independent LLM checks per submit; if a check fails and `nudge_dismissed = false`, return the nudge without saving; if `nudge_dismissed = true`, save with `flagged = true`). Extend/reuse that endpoint — do not rebuild it. Confirm it currently implements all three checks (observability, anonymity, absence); if only some are wired up, add the missing ones there.

- **Observability check:** vague / trait-based / abstract? → "Can you make that a bit more specific — something you'd actually see or hear?"
- **Anonymity check:** names or clearly implies a specific individual? → "Let's keep this about the team rather than any one person — how would you describe the behaviour itself?"
- **Absence check:** phrased as a negative/absence ("not interrupting," "stop ignoring")? → "What's the positive version of that — what would you want to see instead?"

Nudge once each. Never block.

### 4.7 Close

> "That's it for now. This is exactly what we'll build on together in the workshop. I'll let your facilitator know you're done, and we'll be in touch to get the group session on the calendar."

### 4.8 Item-specific example table (LOCKED)

Keyed by statement_id, three ALWAYS and three NEVER per item, shown during §4.4 and behind the collapsed expander in §4.5.

| # | Item action phrase | ALWAYS | NEVER |
|---|---|---|---|
| 1 | treat one another with respect | Listen without interrupting · Speak respectfully, even when disagreeing · Thank people for their contributions | Interrupt or talk over people · Mock, insult or belittle others · Roll your eyes, scoff, or speak dismissively |
| 2 | accept one another for being different | Ask for different perspectives · Invite someone with a different viewpoint to share · Ask questions to understand rather than judge | Dismiss someone's perspective because they're "different" · Make jokes about someone's background or differences · Stereotype or label people |
| 3 | feel like everyone belongs, not left on the outside | Invite quieter people into discussions · Include everyone in conversations and activities · Learn and use people's names | Leave people out of conversations or decisions · Form cliques that exclude others · Ignore quieter team members |
| 4 | understand and value one another's contributions | Give credit where it's due · Thank people for their help · Build on another person's idea | Take credit for someone else's work · Ignore someone's contribution · Dismiss an idea without considering it |
| 5 | reach out to one another for help | Ask for help when you need it · Offer help when someone is struggling · Share your knowledge when someone asks | Struggle in silence · Refuse to help others · Make people feel stupid for asking for help |
| 6 | share ideas and opinions even before they're fully formed | Share ideas before they're fully worked out · Think out loud · Build on unfinished ideas instead of judging them | Shoot ideas down immediately · Wait until an idea is "perfect" before sharing · Laugh at unfinished ideas |
| 7 | admit a mistake or flag a problem without fear of criticism or punishment | Admit mistakes openly · Raise concerns as soon as you notice them · Thank people for speaking up | Hide mistakes · Blame others for problems · Criticize or punish people for admitting mistakes |
| 8 | give one another time and attention to express their perspectives | Listen without interrupting · Ask "Tell me more" · Give people time to finish speaking | Interrupt people · Change the subject before someone finishes · Ignore what someone is trying to say |
| 9 | question how things are done and look for ways to improve | Ask "Is there a better way?" · Suggest improvements · Ask for feedback on how things could be improved | Shut down questions · Say "We've always done it this way" to end discussion · Reject suggestions without discussion |
| 10 | look at what went wrong and learn from it, rather than assign blame | Ask "What can we learn?" · Share what you learned from a mistake · Discuss what happened before deciding who was responsible | Look for someone to blame first · Shame people for mistakes · Stop people talking about failures |
| 11 | welcome disagreement and different points of view | Ask "Does anyone see this differently?" · Thank people who disagree respectfully · Explore opposing viewpoints before deciding | Attack people for disagreeing · Pressure everyone to agree · Dismiss a different opinion without discussion |
| 12 | take calculated risks and be honest about the outcome, even when it doesn't work | Try new approaches when appropriate · Be honest when something doesn't work · Share what you learned from a failed attempt | Avoid trying anything new because it might fail · Hide unsuccessful attempts · Criticize people for trying something new |
---

## 5. Consultant pre-release review (relocated from old §3.5)

**Timing (changed by this pivot):** the consultant review now sits between "all members have finished Phase 3" and "the workshop is scheduled." It is a TEAM-LEVEL gate, not a per-member gate. The member's closing message ("we'll be in touch") goes out BEFORE review. The consultant can edit entries, but the member won't see their original changed — this is accepted.

### What the consultant sees

1. **The focus item** (per D-051, zone-first team-level selection). Override control to pick an alternative that scored poorly.
2. **Pooled member submissions** — all members' NEVER / SOMETIMES / ALWAYS entries for the focus item, colour-coded by member with toggles, de-duplicated visually (same as the old pooled board design).
3. **Otis-flagged entries** — any entries where live coaching was attempted but the member insisted (anonymity concerns, vagueness, absences). Visually marked so the consultant can prioritise reviewing them.
4. **Edit controls:** remove, reword, re-bucket (move from Never to Sometimes, etc.), add a new entry typed by the consultant. Provenance tracked (member / consultant).
5. **The situation-context summary** — the deferred tags (§6) showing which situations/contexts members described (e.g. "during meetings," "in chat," "during handovers"). This helps the consultant frame the workshop.
6. **Release:** locks the reviewed set as the workshop input. Written to `workshop_seed`.

### What's different from the old review

The consultant is no longer reviewing AI-generated abstractions. They're reviewing **member-written behaviors** that Otis already coached for observability and anonymity. The review burden is lighter: mostly checking for things Otis's live coaching missed, removing duplicates, and confirming the set is workshop-ready.

---

## 6. Deferred situation-tagging (light, batch, after Phase 3 submission)

After a member finishes Phase 3, a lightweight LLM pass reads their saved story text(s) and tags each with a **context category** (meeting, chat, email, handover, in-person, etc.) — just enough to support the facilitator saying "people discussed this in the context of meetings and chat" during the workshop.

**This is NOT full coding.** No primary_code judgment, no gerund extraction, no absence-reframing, no clustering. Just: read story text → tag one context word/phrase per story.

Stored as a simple tag on the story record. Surfaced to the consultant in the review step (§5) and available for the workshop framing.

**Why deferred, not live:** asking Otis to simultaneously coach behavior quality AND extract structured tags during the conversation makes it feel mechanical (the exact problem the old interview had). One job at a time.

---

## 7. Conversational guardrails (transferred from Phase 1, apply here)

All guardrails from the revised `ps_interview.ts` prompt apply to Phase 3's conversation, since it uses the same conversational engine:

- **Decline / can't answer:** one gentle reframe, then graceful acceptance.
- **Off-topic:** warm redirect to the task.
- **Asks for advice/opinion:** warm deflection back to their experience.
- **Trolling / prompt injection:** unflappable calm redirect.
- **Names individuals:** gentle steer to the pattern/behavior.
- **Genuine distress / harm disclosure:** warm acknowledgment, no counseling, surfaced to consultant via welfare note.
- **Tiring / progressively shorter answers:** sense it and wrap up gracefully.

See the revised interview prompt for full text of each.

---

## 8. The Finish button and what it triggers

Pressing **Finish** records that this member has completed Phase 3 (report read + stories told + behaviors submitted).

**What the consultant dashboard shows after release:** who has finished (a readiness tracker), and the pooled behaviors once everyone is done.

---

## 9. Scheduling and reminders

**Locked (beta):** the consultant manually enters the workshop date in the dashboard. No calendar integrations in v1.

**Reminder emails** keyed off that date, sent to members who have NOT pressed Finish:
- 2 days before
- 1 day before

Each reminder must state: complete the pre-work before the session; you'll need access to a computer or phone during the workshop; a link to log in.

---

## 10. Data written in Phase 3

| Data | Destination |
|---|---|
| Story text(s) per member, raw | new: member story record (member_id, team_id, statement_id, story_text, story_order) |
| Deferred situation tags per story | tag field on the story record |
| Member-submitted behaviors (≥2 Never, ≥2 Always, optional Sometimes) | new: member behavior record (member_id, team_id, statement_id, bucket: never/always/sometimes, text, source: member/consultant, flagged: boolean) |
| Otis-flagged entries (anonymity/vagueness concerns) | flagged field on behavior record |
| Pulse-check responses | `feedback_responses` |
| Finish state + timestamp | member record |
| Workshop date | team record |
| Consultant-reviewed approved set | `workshop_seed` (written at Release) |

---

## 11. Open / placeholder items

- **Consultant script editing UI** — confirmed in scope; the editing surface is a build detail.
- **Otis auto-adapting for high-scoring teams** — NOT in the beta; consultant edits manually.
- **Report download format** — PDF assumed; confirm at build.
- **Reinforcement Library contents** — placeholder (Anna authoring); see Phase 4 §6.5.
