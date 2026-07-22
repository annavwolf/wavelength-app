# Otis Phase 4 — Live Workshop Spec (v1)
### The facilitated session that turns individual sorts into a committed Team Behaviour Agreement
*Builder doc for Claude Code. Follows Phase 3 (member report + pre-work sort). Precedes Phase 5 (follow-up). Companion to: Phase 3 Spec, Phase 2 Analytics Spec, Session 4 Decisions Log, Architecture & Build Order doc.*

---

## 0. Design principle (read first — it governs every build decision here)

**Otis prepares and scribes. The facilitator conducts. The team decides.**

This was a deliberate cost-and-risk decision. A fully real-time multiplayer workshop (live collaborative drag-drop, continuous sync, app-managed breakouts) is the single most expensive and fragile thing we could build, and it would fail *loudly* in front of a live team. Instead:

- Everything members do is **submit-then-display**, not live-sync. Members act individually; the app saves; the facilitator advances the phase; the app then *displays* what was submitted.
- The only "live" mechanic is **phase state broadcast**: when the facilitator advances the session, members' screens change. That is a handful of state flips per session, not continuous collaborative editing.
- Human conversation (pairs, whole-team discussion) happens **by voice**, in the room or on the call. The app holds the artefacts, not the dialogue.

Do not build real-time collaborative editing. If a requirement seems to need it, it's probably wrong — check with Anna.

---

## 1. Architectural prerequisites

### 1.1 Member profiles (NEW — foundational)
Members get a persistent, low-friction login tied to their **existing** `members` record. This is not new data architecture: every member's Phase 1 data is already keyed to `member_id`. The profile is a *front door* to records that already exist.

From their profile a member can see:
- Their own Phase 1 responses and interview
- The Phase 3 team report
- The workshop room (when live)
- The final Team Agreement (after the workshop), and later the Phase 5 follow-up

**Members never see the consultant dashboard.** Their view is limited to: what was sent in Phase 3, what is decided in the workshop, and their own Phase 1 data.

**Privacy:** member-facing views must honour `share_verbatim_with_team` / `share_name_with_team` throughout.

### 1.2 The workshop room
A live "room" inside the team, entered from a member's profile when the workshop is active. Its state (which phase the session is in) is controlled by the facilitator and broadcast to members.

### 1.3 Facilitator session control panel (NEW — named build component)
The facilitator (from their consultant login) needs a control surface that:
- **Starts** the workshop (opens the room)
- **Advances phases** (individual → pairs → whole team → agreement) — this is how Otis "knows" what phase everyone is in; it is facilitator-triggered, not inferred
- Shows a **live submission tracker** ("3 of 4 pairs submitted") so they know when to call the room back
- Shows **their private script** for the current movement
- Gives them **Otis access** (members do not have Otis access during the live session)
- Has a **"suggest options"** button to break stalls on demand

---

## 2. Before the session starts

Members have already (Phase 3): read the report, completed their individual sort, added ≥1 own behaviour to Never and Always, and pressed Finish. The facilitator can see who has and hasn't.

Facilitator opens the session; members enter the workshop room from their profiles.

**Team size note:** max supported 12. Otis computes the structure from team size and tells the facilitator what to run (see §4).

---

## 3. M1 — ORIENT (~6 min)

**Members' shared view:** the focus frame only — the PS item, the situation (objective + context), one line of why ("several of you described moments like this"). No scores, no individual data.

**Facilitator's panel** shows the same plus their private script:
> *Welcome everyone. Remind them: this is a starting point, not a verdict. Everything we look at came from them.*
> *Read the norms aloud: open mind · everyone speaks · don't interrupt · we'll revisit this.*
> *Warm-up round: one word each — how are you arriving today?*
> *Team size: [N] → [structure Otis computed].*

The one-word round exists to get **every voice into the room in the first five minutes**. This is itself a psychological-safety intervention; do not cut it.

---

## 4. M2 — PAIRS (~12 min)

### 4.1 Pairing
**Otis assigns pairs** and displays the list on the facilitator's panel. For odd numbers, Otis makes one trio. (Beta: random pairing. Smarter pairing — e.g. by interdependence or divergent sorts — is a later enhancement.)

- **Remote:** facilitator creates breakout rooms matching Otis's pairs. Otis presents the list in a form that's easy to copy.
- **In person:** members turn to their partner.

The app does NOT manage breakout rooms. It manages the pairing *data*; the facilitator manages the room logistics.

### 4.2 What the member sees
> **Otis:** "You're paired with **[name]**."

**The pooled board:** all members' submitted sorts, colour-coded by member, with toggles to show/hide individuals. The member's own and their partner's are highlighted; everyone else dimmed by default.

> "Toggle to just you and [partner]. Compare where you agreed and where you differed."

Duplicate entries are not shown twice — dedupe by clearest phrasing (see Analytics Spec §2.4).

### 4.3 The pair task (two parts)
> **1.** Agree on the **2 behaviours you most want to see (ALWAYS)** and the **2 you least want to see (NEVER)** in this situation.
> **2.** For each one you pick: **how would we actually know we're doing it — what would someone see or hear?**

### 4.4 The pair sheet (KEY ARTEFACT — this is what makes M4/M5 possible)
A structured form, not a blank page. Pairs drag their chosen behaviours in and type the observability line:

| Behaviour | We'd know we're doing it because someone would see or hear… |
|---|---|
| *[chosen ALWAYS 1]* | *[type]* |
| *[chosen ALWAYS 2]* | *[type]* |
| *[chosen NEVER 1]* | *[type]* |
| *[chosen NEVER 2]* | *[type]* |

**Otis's inline vagueness nudge (required):** if a pair types something vague or trait-based ("we listen better," "be more respectful"), Otis flags it gently on their screen:
> *"Could you make that something someone could see or hear? For example: 'we let each person finish before responding.'"*

This is the same observability discipline as the Phase 1 interview (Turn 4) and the Phase 3 preview, applied at the point of writing. Nudge at most twice, then accept.

Pair presses **Submit**. Facilitator's tracker updates.

### 4.5 REMOVED: the "fours" stage
An earlier draft had teams of ≥9 consolidate pairs into fours before the whole-team share. **Cut.** It consolidates away information before the team hears it, and the round-robin handles 6 pairs fine (~6 minutes of sharing). Pairs → whole team at **all** sizes up to 12.

---

## 5. M3 — WHOLE TEAM: SHARE & SELECT (~15 min)

### 5.1 Round-robin share
**Facilitator script:**
> *Go pair by pair. Ask each: "Which two did you pick, and why did you choose those as behaviours we should always show when [objective] during [context]?"*
> *One pair at a time. Hold reactions until all have spoken. Then open it up.*

**Round-robin in practice** (the facilitator holds the structure):
> "Sam and Jo, you're first. Which two, and why?" *(they answer)*
> "Thanks — hold reactions for a moment. Ali and Mo, yours?" *(…all pairs…)*
> "Okay, now it's open. What are you noticing?"

The discipline: **everyone contributes before anyone debates.** This prevents the loudest pair from framing the discussion.

Other round-robin variants Otis can offer:
- *"Let's go round, one sentence each: which of these matters most to you?"*
- *"I want to hear from anyone who hasn't spoken yet before we decide."*
- *"Quick round — thumbs up or down on this one, then we'll talk."*

### 5.2 The convergence ladder (Otis's decision rules — covers every scenario)

Each pair submits 2 ALWAYS + 2 NEVER. Otis computes, **for each behaviour, how many pairs picked it**, and expresses results as *proportion of pairs* so the logic is size-independent (works for 4 people / 2 pairs through 12 people / 6 pairs).

Handled separately for ALWAYS and NEVER.

| Scenario | Otis's prompt to the facilitator | Action |
|---|---|---|
| **Clear top 2** — two behaviours picked by more pairs than any others, no tie at the boundary | *"Clear result: [A] chosen by 5 of 6 pairs, [B] by 4 of 6. Next highest is [C] at 2. Recommend taking A and B — no vote needed."* | Take them, move on |
| **Tie at the second slot** | *"[A] leads with 5 of 6. [B] and [C] are tied at 3 each for the second slot. Recommend a quick vote between B and C."* | Individual vote between tied items only |
| **Wide scatter** — nothing above roughly half the pairs | *"No clear front-runners — picks are spread across 5 behaviours. Recommend a vote across all of them."* | Individual vote, all candidates |
| **Vote still tied** | *"[B] and [C] tied again at 4 votes each. Recommend including both — the agreement can hold three."* | Include both; cap at 3 |
| **Multiple ties would exceed 3** | *"Multiple ties. Recommend a second vote between just the tied items."* | Runoff vote; hard cap 3 |

**Voting mechanic:** members tap to allocate 2 votes for ALWAYS and 2 for NEVER on their own screens. Submit-then-reveal (not live-streaming tallies).

**Hard cap: 3 ALWAYS and 3 NEVER maximum.** The flex to 3 exists so a genuine tie isn't resolved arbitrarily; the cap exists so the agreement doesn't sprawl.

The facilitator is never stranded: every scenario has a rule.

---

## 6. M4 — REINFORCEMENT & ACCOUNTABILITY (~12 min)

**This movement is facilitator-led and mostly pre-prepared. It is NOT an open brainstorm.**

Rationale: asking a tired team at minute 45 to invent behavioural-change infrastructure produces vague results ("we'll remind each other"). The expert (the facilitator/consultant) brings well-designed options; **the team owns the choice and the adaptation, not the invention.** This is also the most *universalisable* part of the product — the diagnosis is bespoke, but reinforcement mechanics are general.

### 6.1 Facilitator framing (script)
> "We're not going to be perfect at this. People will slip, and we'll all forget sometimes. So rather than hope, let's put something in place to keep this alive."

### 6.2 The three mechanisms (Otis displays; facilitator explains; team selects)

**Mechanism 1 — Scheduled reflection (a recurring check-in)**
Must be **cue-based, not meeting-based** — many teams have no all-hands, and some situations leave no room for reflection. Anchor it to *their* situation: "at the end of [the situation], or the next time you're together after it."
Short script for the check:
> *"Quick check: did we [ALWAYS behaviour] this time? Anything we'd do differently next time?"*
Works in a meeting, a handover, a Slack thread, or a project debrief.

**Mechanism 2 — In-the-moment interrupt** (when a NEVER behaviour happens live)
Options for the team to choose from:
- **A neutral signal** — an agreed hand raise, emoji, or code word. Low-confrontation, works remotely.
- **A short scripted phrase, naming the behaviour not the person** — *"Can we pause — I think we're talking over each other."* Note the collective "we"; this is the key linguistic move and it is teachable.
- **Defer to the reflection** — note it, raise it at the check-in. For teams not yet ready for in-the-moment.

**Mechanism 3 — Positive reinforcement** (the one teams forget; behaviourally the most powerful)
Script rule: **name the specific behaviour, not a generic compliment.**
> *"I noticed you paused so [name] could finish — that's exactly the thing."*
Explicitly: **everyone has the authority to do this, not only the leader.**

**On the leader's role (locked framing):** *everyone has the authority; the leader has the responsibility to go first.* Leaders carry outsized signalling power (culture is what gets rewarded and punished), but if only the leader may call things out, you've built a hierarchy rather than psychological safety.

### 6.3 Otis's capture sheet (structured, on the shared screen)
The facilitator types as the team talks; the team sees their words appear and can correct live.

| | |
|---|---|
| **When someone slips, we will…** | *[the chosen in-the-moment mechanism, in their words]* |
| **We'll check how we're doing…** | *[trigger: when + where]* |
| **When someone does it well, we'll…** | *[the appreciation practice]* |
| **Anything else we're agreeing to?** | *[optional]* |

**Stall-breaker:** the facilitator can press **"suggest options"** and Otis offers common answers (e.g. *"at the end of an existing recurring meeting · added to your retro · a short async check-in message · at the start of the next [context]"*). This converts an open-ended stall into a quick pick-from-options.

**Do NOT prescribe extra norms** (e.g. "anyone can raise it," "assume good intent"). Otis may *offer* them if the team stalls — *"Some teams also agree on who can raise it, and how to do it kindly — worth deciding?"* — and they go in the "anything else" cell if the team wants them. Prescribing makes it Otis's agreement; offering makes it theirs.

### 6.4 Roleplay (10–30 seconds, high value)
> *Facilitator: "Let's try it once. [Name], pretend [name] just talked over you — use the signal."*

Rehearsing once makes the mechanism dramatically more likely to be used. Costs nothing.

### 6.5 ⚠ PLACEHOLDER — the Reinforcement Library
The three mechanisms above are the **structure**, and are locked. The **specific scripts, signals, and strategies within them are a placeholder for the beta.** Anna will research and author a proper Reinforcement Library (scripts for calling out, for appreciation, for judgment-free learning-oriented conversations, alternatives to retros, etc.).

Build the *slot* — a content library Otis draws from, editable without a rebuild. Do not hard-code the current examples as if final.

---

## 7. M5 — THE AGREEMENT & COMMITMENT (~10 min)

### 7.1 Otis assembles the draft (never a blank page)
On the shared screen:

> **In this team, when we want to [objective] during [context]:**
> **We will:** [ALWAYS behaviours]
> **We will avoid:** [NEVER behaviours]
> **We'll know we're doing this because:** [observability lines, already written by the pairs in M2]
> **When someone slips:** [from the capture sheet]
> **When someone does it well:** [appreciation practice]
> **We'll check in:** [trigger]
> **We'll revisit this properly on:** [date]

Note how much is **pre-filled from earlier movements** — the observability lines come from the pair sheets, which is why M2's structured sheet matters and why this movement fits in 10 minutes.

### 7.2 Team edits
**Facilitator script:** *"Read it aloud. Then: does this sound like us? Change anything that doesn't."*

The facilitator holds the pen (one hand on the keyboard avoids edit chaos); the team calls out changes; Otis may tighten wording **on request** but never overrides. The team's authentic language wins.

### 7.3 Fist-of-five — the commitment gate
**Placement (locked):** at the very end, **after** everything is decided including reinforcement and check-in trigger. Testing commitment before the accountability mechanism exists would test an incomplete thing.

> **Facilitator:** "On three, hold up one to five fingers. Five means I'm fully behind this. One means I can't commit. Anything below three — I want to hear from you."

If anyone is below 3: *"What would get you to a three?"* This is bounded and actionable — it converts "is everyone happy?" (sprawls) into "who isn't, and what specifically do they need?" Adjust, re-check.

Fist-of-five is both the commitment ritual **and** the stall-breaker for endless wordsmithing.

### 7.4 Lock
- Agreement saved to `code_of_conduct` (v1, `is_current = true`, `focus_zone` set)
- Appears in **every member's profile**
- Revisit date written to `followups.scheduled_for`

**Otis's closing on every screen:**
> "Your agreement is saved and is now in your profile. You'll check in [trigger], and I'll come back to you on [date] to see how it's going. Thank you — this is real work, and your team did it together."

---

## 8. Size-adaptive structure (Otis tells the facilitator what to run)

| Team size | Structure |
|---|---|
| ≤5 | Pairs (one trio if odd) → whole team. No extra structure needed. |
| 6–8 | Pairs → whole team, with round-robin enforced at every sharing moment. |
| 9–12 | Same: pairs → whole team with round-robin. Sub-groups may be used for M4 if discussion is unwieldy (facilitator's call): "in your group, agree on one proposal, then we'll hear each group." |

Max supported: 12.

---

## 9. Data written in Phase 4

| Data | Destination |
|---|---|
| Pair selections (2 ALWAYS + 2 NEVER per pair) | new: pair submission record |
| Observability lines per behaviour | same record |
| Individual votes (if a vote occurs) | new: vote record |
| Final agreement text + all capture-sheet fields | `code_of_conduct` |
| Revisit date | `followups.scheduled_for` |
| Session phase progression (audit) | optional |

**No recording or transcription of the session.** Otis captures *decisions* that people deliberately enter, not the conversation. This is deliberate and privacy-protecting.

---

## 10. After the workshop

- The agreement appears in every member's profile.
- The consultant may need to reconcile details afterwards (e.g. inputs from absent members).
- **Two-workshop merge case** (a team split across two sessions, agreements to merge) is **explicitly deferred — post-beta.**
- Phase 5 (follow-up) is a separate spec: a short team-run loop (their own trigger, decided in M4) plus a long Otis-run loop (the revisit date, re-checking movement on that PS item).

---

## 11. Open / placeholder items

- **⚠ Reinforcement Library contents** (§6.5) — structure locked, content to be authored by Anna. Build as editable content, not hard-coded.
- **Facilitation scripts** — the current scripts are workable but Anna will refine. Keep them as editable content.
- **Smarter pairing** (by interdependence or divergent sorts) — beta uses random; enhancement later.
- **Phase 5 spec** — not yet written.
- **Member auth mechanism** — see Architecture & Build Order doc; must be built first.
