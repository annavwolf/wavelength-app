# Otis Phase 3 — Member Report & Pre-Work Spec (v1)
### What each team member sees before the workshop, and the sorting task they complete
*Builder doc for Claude Code. Follows Phase 2 (analysis). Precedes Phase 4 (the live workshop). Companion to: Phase 2 Analytics Spec, the three generation guides, Session 4 Decisions Log, Architecture & Build Order doc.*

---

## 0. Purpose and naming

**Phase numbering (locked, use consistently):**
- Phase 1 = the individual interview (built)
- Phase 2 = analysis + consultant dashboard
- **Phase 3 = the member-facing report + pre-work (THIS DOC)**
- Phase 4 = the live workshop
- Phase 5 = the follow-up / drift check

Phase 3 delivers the team results to each member individually and asynchronously, and has them complete the behaviour-sorting task **before** the workshop. Its job: everyone arrives at the workshop informed, oriented, and having already done the solitary thinking — so live time is spent on discussion, not silent sorting.

**Access:** members reach this through their **member profile** (see Architecture doc). It persists — they can return to it after the workshop.

---

## 1. What members see vs. what consultants see

Members see a **reduced** version of the dashboard. They do NOT get the consultant dashboard.

| Content | Consultant dashboard | Member report |
|---|---|---|
| Networks | ✅ full | ✅ shown |
| Shared-purpose read | ✅ | ✅ |
| Zone stats + reads | ✅ full detail | ✅ headline stats + reads |
| Survey item breakdown | ✅ full | ❌ |
| Team stories | ✅ all items | ✅ top 3 lowest-scoring only |
| Cluster counts / buckets | ✅ | ❌ |
| Otis's assumptions/hypothesis | ✅ | ❌ |
| Their own Phase 1 responses | ❌ | ✅ (own only) |

**Privacy rule (carry throughout):** any member-facing view must honour `share_verbatim_with_team` and `share_name_with_team`. Verbatim content and names appear only for members who granted permission; others are anonymised.

**Consultant editability:** the consultant can edit any part of this script/report in the dashboard before release. For the beta, Otis does NOT auto-adapt the script (except where noted); the consultant adapts it.

---

## 2. Report contents, in display order

### 2.1 The two networks
Shown first, deliberately — they orient members to *who* the team is before any findings.

Order: **geographic network first**, then **collaboration-frequency network**.

- Names shown for members who granted `share_name_with_team`; anonymised symbols otherwise.
- **Text rule (locked):** descriptive only, no interpretation, no "density" language. Provide a legend (e.g. "line colour = how often people reported working together") and at most one factual sentence (e.g. "Most of your team is based in [location], with [N] working remotely").
- Do not compute or display density scores in v1.

### 2.2 Shared-purpose read
The ~100-word read from the Shared-Purpose Read Guide.

### 2.3 Zone statistics
The headline zone numbers, mirroring the dashboard: % favorable per zone with counts, and the RYG display band (1–2 red, 3 yellow, 4–5 green on effective value).

**Every number must be self-explaining.** Never a bare percentage. Write "% of responses that were favourable (Agree or Strongly Agree)" or "7 of 10 members responded favourably." A member who has never seen the dashboard must understand it unaided.

### 2.4 Zone reads
The three ≤200-word zone reads from the Zone-Read Generation Guide, displayed **alongside or beneath the statistics for each zone**, rendered over the psychological-safety ocean image.

### 2.5 Team stories — transition and reveal
**Visual transition (specified by Anna):** as the report moves from zone reads to team stories, the zone statistics and reads **disappear**, but the **zone titles stay in place** and the **ocean background stays**. Then the PS items appear, positioned in the zone they belong to.

At this point show **only the items**, not the stories. Otis introduces:

> "Otis asked every member of your team why they scored their lowest-scoring items the way they did, by telling a story about past situations. Otis also asked members to imagine what a better outcome would look like."

Then: the **3 lowest-scoring items** (the same 3 shown on the dashboard's Team Stories section) are revealed **one at a time via click-through** — each expands to show its narrative sentences (from the Team Stories Narrative Template). This handles the case where all 3 items sit in one zone and can't be displayed at once.

### 2.6 Pulse check
**Locked scope:** the pulse check asks about **Otis's interpretations** (the zone reads, the shared-purpose read, and any assumptions), NOT about the team stories. Stories come from members and are data, not claims — questioning them would feel invalidating.

Format: per read, "Does this match your experience?" → **Yes / Somewhat / Not really**, plus an optional free-text note.

Stored to `feedback_responses` (`assumption_resonance`, `assumption_notes`).

---

## 3. Workshop introduction (verbatim script)

Otis then transitions to the workshop preview. Script as authored (consultant-editable):

> "We've come a long way in understanding what psychological safety looks like in your team and where there's room for improvement. I mentioned before that when it comes to psychological safety, it's impossible to reach deeper levels of the 'ocean' before we feel safe close to the surface.
>
> The next step towards developing your team's psychological safety is to focus on making it a safer place to **[zone: belong / speak freely / innovate]**, by making sure that **[PS item text]**.
>
> Since members of your team discussed this topic with me in the context of **[objective and context]**, this is where we will focus."

*(Builder note: the [objective and context] insertion must read grammatically — Otis assembles this sentence, don't concatenate raw fragments.)*

> "What's great is your team has already flagged behaviours that might be working against psychological safety, and made suggestions for behaviours that might be better. Please complete the following activity — it's what you'll build on during the workshop."

---

## 3.5 Consultant pre-release review (NEW — closes a spec gap, see note below)

**Gap note:** D-052 locked that the consultant can override Otis's item selection and edit the seeded behaviors before members see them. Earlier drafts of this spec referenced that decision but never fully specified the screen that does it — this section fixes that.

**This screen sits between Phase 2 (analysis) and Phase 3 (member release).** The consultant reaches it from the dashboard, before pressing "release to team." Nothing in §1–3 above (what members see) exists until the consultant completes this step and releases.

### What the consultant sees

1. **Otis's primary recommendation:**
   - The focus PS item (per D-051's zone-first team-level selection)
   - The situation (context + objective) derived from clustering
   - The direct-voice focus hypothesis (D-049) from `tier2_json`
   - The seeded behaviours for the sorting activity: candidate NEVER (out-behaviours) and ALWAYS (in-behaviours) for this item, **as exploded specific source labels** (Analytics Spec §2.4 — never cluster headings)

2. **Item override control:** "Use a different focus item" — shows the next 1–2 ranked alternatives *that have story data* (D-052). Selecting one repopulates the situation and seeded behaviours for that item. The primary is always restorable via a visible toggle/back control — this is not a one-way switch.

3. **Behaviour editing, per D-052:**
   - Remove any seeded behaviour
   - Add a behaviour typed by the consultant
   - **Pull from the cross-item library:** browse behaviours surfaced under other PS items (each labelled with its source item) and add them to this item's NEVER/ALWAYS set — available at any time, not gated on a shortfall (D-052 extends D-045)
   - Edit the wording of any seeded behaviour directly; Otis's original is preserved and viewable (provenance tracked per D-052: Otis / member / consultant)
   - Edit the situation (context + objective) sentence itself

4. **Review the rest of the member-facing report** (the reads, the networks, the pulse-check questions) with the same edit-in-place capability already specified in §1's "consultant editability" rule.

5. **Release:** a single action that locks in the reviewed item, situation, and behaviour set, and makes the member report (§1–4 of this document) available. This is what the member sees in §4.2's circles — the consultant's final, reviewed version, not Otis's raw output.

### Data implication

The behaviours a member drags in §4.2 must be read from the **consultant-approved, possibly-edited set**, not directly from `tier2_json`'s raw clustering output. This requires a small persisted "approved workshop seed" record (item, situation, final behaviour list with provenance) written at release time — this is the missing data contract Claude Code needs.

### What's still open

- Exact UI layout of this screen (cards vs. table, how the cross-item library is browsed) — a build detail, not a design question.
- Whether re-running compute/interpret after a consultant has already reviewed/edited should warn before overwriting their edits. Flag for Claude Code to raise if it becomes relevant.

---

**Decision (locked, changed from earlier draft):** the individual sort happens **here, in pre-work**, NOT live in the workshop. Rationale: solitary sorting produces no interaction and would waste scarce live time; nothing is *decided* by one person sorting, so nothing is pre-empted. All decisions still happen live, together.

### 4.1 Title above the circles
> "In order to make your team a place where **[PS item]** — what behaviours do you **never want to see**, **maybe want to see**, and **always want to see** when **[objective & context]**?"

### 4.2 The circles
Three circles: **NEVER · MAYBE · ALWAYS**

Behaviours float above, unsorted, and are dragged in.

**Which behaviours appear (critical — see Analytics Spec §2.4):** the **exploded, specific source behaviours** in members' own words — NOT cluster labels. Members must sort concrete, observable behaviours ("cutting people off before they finish"), never abstractions ("interrupting"). Near-duplicates deduped by clearest phrasing.

Behaviours are drawn from the OUT-behaviours and IN-behaviours members surfaced for this PS item in Phase 1 (D-045: item-anchored; consultant may have added from the cross-item library, D-052).

Framing: present them as **the team's own words** — "these came from what people on your team shared" — not as Otis's suggestions.

### 4.3 Instructions
> "1. Please drag and drop the behaviours into the circles you think they belong.
> 2. AND add at least **one behaviour in your own words** to the **Never** category and **one** to the **Always** category."

**Locked:** minimum 1 own behaviour to Never and 1 to Always (Maybe optional).

### 4.4 The preview (do not omit — it primes the pair work)
After sorting, Otis previews what's coming, so members arrive having already thought about observability:

> "Here's what happens next, so you can start thinking about it:
>
> In the workshop, you'll be paired with a teammate. Together you'll compare what you each chose and agree on the **2 behaviours you most want to see** and the **2 you least want to see** in this situation.
>
> You'll also start answering: **how would we actually know we're doing this — what would someone see or hear?**
>
> You don't need answers now. Just know that's where we're heading."

**Why the "see or hear" phrasing is mandatory here:** "how would we know" alone is too abstract and produces vague answers. Anchoring it to *observable evidence* is what makes the workshop's agreement enforceable.

### 4.5 Closing
> "Your workshop facilitator will guide you to discuss your selection, first in pairs and then with the whole team, to agree on 2 behaviours your team will ALWAYS demonstrate and 2 your team will NEVER demonstrate in this situation. Your team will also discuss any barriers that might stand in the way, and commit to this Team Behaviour Agreement."

> "That's all for now! I'm looking forward to continuing this work with you during the workshop. I want to thank you for being part of this process to make your team a safer, better place!"

**Then:** [Download the report] and [**Finish**].

---

## 5. The Finish button and what it triggers

Pressing **Finish** records that this member has read the report and completed the sort. This matters because the workshop cannot run well if people arrive without having sorted.

**What the consultant dashboard shows after release:** only two new things —
1. Who has pressed **Finish** (a readiness tracker: "6 of 8 members complete")
2. The pulse-check responses

Nothing else about the dashboard changes at this stage.

---

## 6. Scheduling and reminders

**Locked (beta):** the consultant/leader **manually enters the workshop date** in the dashboard. No calendar integrations (Google Calendar, Doodle etc.) in v1 — they add OAuth and integration cost for marginal benefit. Revisit post-beta.

**Reminder emails**, keyed off that date, sent to members who have NOT pressed Finish:
- 2 days before
- 1 day before

Each reminder must state:
- That they need to complete the pre-work before the session
- That they will need **access to a computer or phone during the workshop** to complete the activity
- A link to log in (to their member profile / the workshop room)

---

## 7. Data written in Phase 3

| Data | Destination |
|---|---|
| Individual behaviour sort (each behaviour → NEVER/MAYBE/ALWAYS) | new: member sort record, keyed to member + team + PS item |
| Member-added behaviours (≥1 Never, ≥1 Always) | same record, flagged as member-authored |
| Pulse-check responses | `feedback_responses.assumption_resonance` / `assumption_notes` |
| Finish state | member record (read/completed flag + timestamp) |
| Workshop date | team record |

The sorts are the direct input to the Phase 4 pooled board.

---

## 8. Open / placeholder items

- **Consultant script editing UI** — confirmed in scope conceptually; the editing surface itself is a dashboard build detail.
- **Otis auto-adapting the script for high-scoring teams** — explicitly NOT in the beta. Consultant edits manually if the team has no major problems.
- **Report download format** — PDF assumed; confirm at build.
