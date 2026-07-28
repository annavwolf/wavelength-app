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

### 2.5 Pulse check
**Scope (locked):** asks about Otis's interpretations (zone reads, shared-purpose read), NOT stories (there are no stories yet at this point).

Format: per read, "Does this match your experience?" → Yes / Somewhat / Not really, plus optional free-text note.

Stored to `feedback_responses` (`assumption_resonance`, `assumption_notes`).

---

## 3. Workshop introduction and focus-item announcement (verbatim script)

Otis transitions from the report to the activity. Script as authored (consultant-editable):

> "We've come a long way in understanding what psychological safety looks like in your team and where there's room for improvement. I mentioned before that when it comes to psychological safety, it's impossible to reach deeper levels of the 'ocean' before we feel safe close to the surface.
>
> The next step towards developing your team's psychological safety is to focus on making it a safer place to **[ACTION PHRASE]**, by making sure that **[PS item text]**.
>
> Since this is where your team's scores suggest there's room to grow, this is where we will focus."

**Stretch case (team scored well across the board):**
> "Your team's answers were strong across the board, which is genuinely great to see. Since safety is never really finished, I want to use this time to push a little further, into **[fallback item, default: Innovate items 9 or 11]**."

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

This is the core of Phase 3's pivot. It combines what was previously the Phase 1 interview (stories) with what was previously the Phase 3 pre-work sort (behaviour selection) into ONE step, focused on the team-selected item.

### 4.1 Situation invitation (open, not presumptive)

> "Has there been a moment on your team, recently or a while back, where this came up? Doesn't need to be a big thing, small moments count too."

Uses the existing guardrails for can't-think-of-anything / decline / minimal answers (see §7). After a story, invite one more:

> "Thanks for telling me that. Was there another time this showed up, maybe somewhere different, a different meeting, a different chat?"

Repeat once or twice; member can say "that's all" anytime. Stories are **saved as raw text** tied to the member and the focus item. They are NOT coded into labels during this conversation — situation-tagging happens as a deferred batch pass after Phase 3 submission (see §6).

### 4.2 Bridge into generation (LOCKED — Anna's wording)

> "Thanks for telling me your stories. Now what I want to do is have you think about what you've told me, and think about **[item text]**.
>
> If your team were to behave in a way that made it a safe place to **[ACTION]**, what behaviors would you want to see from your team almost always? And what behaviors would you want to see almost never?
>
> In other words, what behaviors do you feel most get in the way of your team being able to **[ACTION]**, and what behaviors would most help your team **[ACTION]**?
>
> Please add at least two to each. And try to remember, these should be observable — what would you see? What would you hear? What would happen, what would people say or do?
>
> Feel free to chat with me if you want to think it through together."

### 4.3 The board (self-service, member types directly)

Three buckets visible to the member: **NEVER · SOMETIMES · ALWAYS**

The member types their own entries directly into the buckets. **Minimum: 2 NEVER + 2 ALWAYS.** Sometimes is optional — those will be debated as a team in the workshop.

**Otis is available via the existing OtisChatBubble** (the same component already built for the consultant dashboard). Otis's role in chat: brainstorm with the member, help them think, suggest phrasings. **Otis never writes directly to the board.** The member always types their own entries. This keeps authorship unambiguous and avoids new tool-wiring.

### 4.4 Live coaching by Otis (replaces the old post-hoc coding guardrails)

When a member submits an entry, Otis checks it and may gently coach. This is educational, not gatekeeping — the member's autonomy is always respected.

**Observability check:** if an entry is vague, trait-based, or abstract ("be more respectful," "better communication"), Otis nudges once:
> "Can you make that a bit more specific — something you'd actually see or hear?"

**Anonymity check:** if an entry names or clearly implies a specific individual, Otis coaches once:
> "Let's keep this about the team rather than any one person — how would you describe the behavior itself?"

This is framed as adult learning, not correction. If the member insists after one gentle try, Otis accepts the entry and flags it privately for the consultant review step. Never block a submission.

**Absence check:** if an entry is phrased as a negative/absence ("not interrupting," "stop ignoring"), Otis nudges once toward the positive form:
> "What's the positive version of that — what would you want to see instead?"

Again, accept after one try if they insist.

### 4.5 Closing

> "That's it for now. This is exactly what we'll build on together in the workshop. I'll let your facilitator know you're done, and we'll be in touch to get the group session on the calendar."

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
