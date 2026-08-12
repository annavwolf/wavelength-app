# Otis — Full Remaining Push (Tiers 2–4)
### Sequenced instructions. Work top to bottom. Dependencies flagged inline.
*Tier 1 (data-integrity bugs: pulse-check save, phantom denominator) was handed over separately and should be done FIRST. This document covers everything after that. Where a task depends on Tier 1's findings, it says so.*

---

# TIER 2 — Otis's reasoning & scientific integrity
*These fix how Otis interprets and phrases things. Small-to-medium. Do after Tier 1 because two of them touch the same read-generation code as Tier 1's Bug 2.*

## 2.1 — Remove item-number references from all Otis reads
**Problem:** Otis's zone reads reference survey items by number/position, e.g. *"statement 4 drew mostly neutral responses."* Members never see the survey items, so a number is meaningless to them.

**Fix:** in the read-generation prompts (zone reads and any other read that can cite a specific item), instruct Otis to **name the behaviour/item directly** instead of by number. E.g. instead of "statement 4," say "the item about understanding and valuing each other's contributions" (or a natural short paraphrase of that item's content). Never "statement N," "item N," or "question N" in any member- or consultant-facing text.

## 2.2 — Replace survey-side "confidence" with a plain participation note
**Problem:** the dashboard header shows "Moderate confidence — 5 of 5 completed… treat these as hypotheses because the group is small." This is scientifically muddled: if 5 is the team's actual size, then 5 of 5 is a **census, not a sample** — there is no larger population to be uncertain about, so "treat as hypotheses because small" misapplies inferential-statistics logic.

**Fix — the caveat is about PARTICIPATION, not team size:**
- **If everyone responded** (e.g. 5 of 5): show NO size-based hedging. State participation plainly: *"All 5 team members responded."* Treat it as complete data.
- **If not everyone responded** (e.g. 3 of 5): THIS is the real, legitimate caveat — about missing voices, not sample size: *"2 of 5 members haven't responded yet, so this reflects part of the team, not all of it."*
- Remove the "treat as hypotheses because the group is small" language entirely. A fully-participating small team is complete data and should not be hedged.

Apply this both to the dashboard header/badge and anywhere Otis's reads echo a confidence caveat.

## 2.3 — Make Otis read like an applied behavioural scientist
**Context for the read prompts:** when interpreting zone results, Otis should reason like a careful applied scientist working with complete team data, not like someone extrapolating from a small sample to a population. Concretely: describe what the team's data actually shows, use plain hedges only where genuinely warranted (e.g. genuine ambiguity in what a neutral response means), and avoid manufactured statistical uncertainty. This is a tone/framing instruction for the read-generation prompt, consistent with 2.1 and 2.2.

**⚠ DEPENDENCY:** 2.1–2.3 all edit read-generation. Do them in the SAME pass as fixing how the denominator is phrased in Otis's read (Tier 1, Bug 2) so the read is corrected once, coherently, rather than twice.

---

# TIER 3 — Navigation & flow bugs
*User-facing, mostly independent, cheap. Each improves the test experience immediately. No cross-dependencies unless noted.*

## 3.1 — "My teams" button throws a session-expired error
**Problem:** logged in as a member viewing a team, clicking "My teams" shows *"Your sign-in has expired. Please request a new link."* instead of returning to the teams list.

**Fix:** "My teams" should navigate back to the member's teams list using the existing valid session — it should not trigger a re-auth/expired-session path. Investigate why this navigation is hitting an auth failure (likely routing to something that re-validates a token incorrectly, or a link built without the session context) and make it simply return to the teams list.

## 3.2 — No way back to the team page from inside a survey/activity
**Problem:** a member who clicks into a survey (or any activity) by mistake has no way to get back to the team page.

**Fix:** add a clear, consistent "back to team" navigation affordance available from within surveys/activities. It should return the member to the team page without losing any already-saved progress. Placement should be consistent with the navigation conventions established in the Phase 1 rewrite (fixed position, predictable).

## 3.3 — After editing a response at the end, return to the end
**Problem:** at the end of a session (Phase 1 or Phase 3), clicking "edit" on a response takes the member back to that portion of the assessment, but after they edit it there's no way to jump straight back to the end/summary — they have to walk forward through everything again.

**Fix:** when a member enters an edit from the end-of-session summary, after they save/confirm the edit, give them a direct "return to summary" (or "back to the end") action. Track that they came from the summary so the return goes straight back there, not step-by-step.

## 3.4 — Otis doesn't end the story conversation; it runs straight into the behaviour activity
**Problem (confirmed by transcript):** after the member finishes their story(ies), Otis does not cleanly close the story portion. It rolls the wrap-up AND the entire ALWAYS/NEVER activity intro into one massive run-on turn. Actual example:

> "That's fine — one good example is plenty. Let me move us forward. Thanks for telling me your stories. Now what I want to do is have you think about… [entire behaviour-activity instructions dumped in the same breath]"

**Fix:** the story conversation must **end as its own step** with a clean stop. The transition into the behaviour-generation activity (the §4.4 educational bridge from the Phase 3 spec) should be its **own screen/step**, reached by the member advancing — not concatenated onto the end of the last story turn. Otis wraps up the stories, the member advances, THEN the behaviour-activity framing appears. This is the "one idea per screen / member controls advancement" principle from the Phase 1 rewrite applied to the Phase 3 story→activity seam.

---

# TIER 4 — Dashboard redesign
*Largest scope. This is a restructure of the results dashboard into clear sections, plus the agreement interaction. Do this LAST.*

**⚠ DEPENDENCY:** Tier 4 sits on top of trustworthy data and corrected reads. Do NOT start Tier 4 until Tier 1 (data bugs) and Tier 2 (reads) are done and confirmed — otherwise you'll be laying out numbers and reads that are still wrong.

## 4.0 — Global dashboard principles
Apply the same human-factors, text-visibility, and colour principles used in the Phase 1 member assessment rewrite to the ENTIRE dashboard: readable contrast, no cramped walls of text, consistent colour meaning, friendly and transparent navigation. The dashboard should feel like one coherent, integrated product with the member-facing side, not a separate raw-data tool. Reuse the survey/zone colour palette consistently (see 4.3 and 4.4).

## 4.1 — Header
Make the "Analytics & Insights" banner larger and placed at the top of the dashboard.

## 4.2 — New section order (top to bottom)
Restructure the results dashboard into these clearly-distinguished sections, in this order:
1. Pulse Check Results
2. Team Stories
3. Always & Never Behaviour Board
4. Otis's Team Agreement (with Clarity Assessment)
5. Roadmap

Each section visually distinct from the next.

## 4.3 — Section: Pulse Check Results
Distinguish clearly from the sections that follow. Contains:
- The feedback on the zones (and shared purpose, if included).
- Otis shows the **survey results from the zone ratings**, plus a **short, to-the-point summary of the comments** — highlighting members' feelings and reactions. Keep it tight, not verbose.
- **Verbatim quotes may be shown ONLY for members who opted in to sharing** (`share_verbatim_with_team`). Everyone else's input is summarised/anonymised.
- **⚠ DEPENDENCY:** this displays the zone stats and reads corrected in Tier 1/Tier 2. Must come after those.

## 4.4 — Section: Team Stories
Two parts:
- **Situations** — a short, to-the-point summary (bullet points fine) of the situations/contexts members discussed. **DO NOT show members' chats or raw story text at all.** Summarise only, e.g. *"Team members discussed difficulty raising issues during planning meetings, and feeling they shouldn't share ideas during meetings."* This summary comes from the deferred situation-tagging (Phase 3 spec §6), not from exposing story transcripts.
- **Anonymised "how often it happens" ratings** — the frequency data from the Phase 3 frequency question (§1.1), aggregated/anonymised.

## 4.5 — Section: Always & Never Behaviour Board
- Open with a brief reminder of what members were asked to think about (e.g. *"If the team's goal is to be a safe place to [PS item]…"*).
- Show members' **RAW submissions**.
- **Order: ALWAYS, then SOMETIMES, then NEVER.**
- **Use the same colour coding as the surveys** (the diverging agree/disagree ramp — align always/sometimes/never to that palette so colour meaning is consistent across the product).

## 4.6 — Section: Otis's Team Agreement (+ Clarity Assessment)

### 4.6.1 Heads-up note
Before the agreement, tell the consultant plainly: **Otis has categorised the ALWAYS & NEVER behaviours the team submitted into a pre-existing standard list of behaviours**, which are used to build the agreement. **Hyperlink to the full standard behaviour lists** (the §4.8 example tables) so they can read them.

### 4.6.2 Double-counting note (REQUIRED — this is a deliberate change)
The two-pass bucketing (self-serve spec §2) now **allows a behaviour to appear in more than one bucket** when the two LLM passes disagree about which bucket fits best. This is intentional — it can build support for a standardised bucket. **Flag this plainly to the consultant:** *"Some behaviours appear in more than one category because Otis wasn't certain which fit best. This can increase the apparent support for a standardised behaviour."*

**Integrity guardrail (REQUIRED):** double-counting lets a behaviour appear in two buckets, but a **single member's submission may add at most 1 to any given bucket's support count.** One member can never count as two members of support within the same bucket, even via double-counting. This keeps support counts honest.

*(This updates self-serve spec §2, which previously enforced strictly one bucket per submission. Please update that behaviour: Pass 2 may now assign a submission to a second bucket when it genuinely disagrees with Pass 1, rather than only moving/demoting it. Record both assignments. Apply the per-member-per-bucket cap.)*

### 4.6.3 Clarity Assessment
Place the Clarity Assessment here (it gives the consultant a heads-up of how confident Otis is about which behaviours the team agrees are NEVER/ALWAYS).

**How clarity is computed (make this explicit and defensible — plain rule, not a black box):**
Clarity is driven by **how concentrated the team's support is across buckets:**
- **High clarity:** most member submissions funnel into a small number of shared buckets (strong overlap — the team largely agrees on what matters).
- **Moderate clarity:** support is somewhat concentrated but spread across several buckets, or one or two behaviours had split/ambiguous bucketing.
- **Low clarity:** submissions scatter across many buckets with little overlap, and/or a notable share ended up unbucketed (the team's ideas are spread out — worth discussing to align).

Show the clarity level with a **one-line plain-language explanation of why** ("Your team's behaviours concentrated into 3 shared patterns — strong agreement" vs. "Your team's behaviours spread across 9 patterns with little overlap — worth aligning"). Never present clarity as an opaque score.

**Unbucketed behaviours:** surface them here in the clarity section — *"Otis couldn't confidently fit these behaviours into a standard pattern:"* followed by the raw submissions. Do not force-fit them, do not drop them.

### 4.6.4 The agreement itself
Below the clarity section, show **"The team agreement Otis proposes for your team, [team name]."**
- An **ALWAYS** section and a **NEVER** section, each with **2 behaviours locked in by default** — defaulting to the behaviours that received the **most support** (highest distinct-member count) from Otis's categorisation.
- Each locked-in behaviour is **clickable but NOT freely editable like a text box.** Clicking expands a **dropdown of the other standardised behaviours, ordered by how much team support each received.** Selecting a different one swaps it into the agreement.
- Within a selected behaviour, an expandable **"team support"** view shows the **verbatim behaviours members submitted** that were bucketed here (respecting opt-in for showing names/verbatim; double-counting reflected but capped per 4.6.2).
- **Below the interactive picker, show the actual formal team agreement**, which **updates live** when someone locks in a different behaviour from a dropdown. It should look **formal and readable.**
- Colours for NEVER and ALWAYS should **match the app theme** (consistent with the survey palette).
- **Situations:** auto-select the most common/most-cited situations (from the Team Stories situation data, 4.4) into the agreement. The consultant can **edit the situation portion by hovering over it** in the agreement.

## 4.7 — Section: Roadmap
- **Open with a summary of commitment:** how members responded to the 30-day-trial commitment question (§1.2), and their comments about the impact they expected — summarised by Otis, and shown verbatim for members who opted in.
- Show the **standard Otis roadmap.**
- **Flag async need:** if many members indicated the team does NOT meet easily (synchronicity question, §1.2), flag that **asynchronous alternatives may be needed** — surface the async adaptations from the artifacts (self-serve spec §7.1 async tailoring).
- **Fix broken guide links:** the downloadable guides (check-in protocol, reinforcement/behaviour guides, meeting agenda) are currently NOT available when clicked from the dashboard. Wire these up so the guides actually open/download.

## 4.8 — Partial-data flag: NO NAMES
**Problem:** the "partial data" flag currently names who is missing (e.g. "Annamaria").
**Fix:** never name individuals in the partial-data flag. Say *"2 of 5 members haven't responded yet,"* never who. (Consistent with 2.2's participation framing.)

---

# Recommended working order
1. **Tier 1** (already handed over) — data bugs. Everything depends on this.
2. **Tier 2** — reads (bundle 2.1–2.3 with Tier 1's Bug-2 read fix, one coherent pass).
3. **Tier 3** — nav/flow bugs (independent; can be done any time, but good to clear before the dashboard work).
4. **Tier 4** — dashboard redesign (last; depends on 1 and 2 being correct first).

Please produce a short plan for each Tier before building it, and flag any place where what's described conflicts with what's already built so we can resolve it before you proceed.
