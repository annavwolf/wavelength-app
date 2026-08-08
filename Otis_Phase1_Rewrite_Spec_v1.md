# Otis Phase 1 — Rewrite Spec (v1)
### Reordered flow, conversational shell, read-aloud, and bug fixes
*Builder doc for Claude Code. This rewrites the Phase 1 member experience: new section order, new/edited copy, a reusable conversational shell (progress bar + chunked bubbles + floating Otis), read-aloud, and three bug fixes. Phase 1 is survey-only (no interview) per the pivot — this spec covers the survey/education experience.*

---

## 0. The four sections (new structure)

Phase 1 is reorganised into three named sections plus a finish, each with its own subtle colour/background treatment and its own labelled segment on a persistent progress bar:

1. **Introduction** — landing + who Otis is + the octopus framing
2. **Personal & team info** — identity confirm → demographics → team purpose → roster/missing → own role → coordination frequency
3. **Psychological safety assessment** — what PS is → privacy choice → questions/FAQ → the ocean → "is PS important to your team?" → the questionnaire
4. **Finish** (small bar segment) — "what happens next" → review/edit/download → goodbye

The progress bar is sectioned and titled with these names. It must start at the true beginning (0%) — **fix the current bug where the survey opens partway along the bar.**

---

## 1. The conversational shell (reusable pattern, applies across Phase 1 and later Otis experiences)

### 1.1 Chunking
Otis's turns are shown **one idea per screen** — the existing `(start)…(end)` blocks in the copy below each represent exactly one screen. The member advances with a **click (arrow/Next)**. Do not stack multiple ideas into a wall of text.

This uses the existing `ChatBubble` + `onAdvance` pattern already in the codebase; the change is that each screen shows fewer bubbles (one idea), navigated by arrow.

### 1.2 Layout
Wider content area than the current narrow vertical column — let the text breathe horizontally. Keep readable line length, but use more of the screen.

### 1.3 Progress bar
Persistent along the top of every Phase 1 screen. Sectioned into the four named parts (§0). Shows current position within the whole flow. Starts at 0%.

### 1.4 The floating Otis icon
- **Introduction section only:** the Otis icon (`octopus_transparent.png` / existing `/octopus-logo.png`) is **large and centered**, with a gentle floating animation, above the bubbles.
- Floating animation (port from the Otis webpage, `otis-ai.html` line 91–92):
  ```css
  animation: float 4s ease-in-out infinite;
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
  ```
- **Personal & team info + PS assessment sections:** the icon stays visible but **much smaller** (e.g. a small header/corner presence), not centered, no large float.
- **Finish / goodbye screen:** bring the **large floating icon back** for Otis's sign-off.

### 1.5 Read-aloud + voice input
- At the **very start** of the experience, ask the member once whether they'd like Otis to read aloud. Store as a preference for the session (the `readAloud` prop already threads through `ChatBubble`).
- When enabled, **auto-read each new bubble** as it appears after the member advances.
- **Do NOT auto-read:** survey items, roster names, button text. Only Otis's conversational bubbles.
- A visible toggle is always present so the member can turn it off/on anytime.
- **Voice-to-text:** in text-input boxes, show a small microphone control for speech-to-text. (`VoiceTextInput` / `VoiceTextarea` already exist — surface the mic affordance.)

---

## 2. Cross-cutting rule: nothing disappears without visibility or interactability

**A stated principle, not two spot-patches.** Any information the member provides or skips must remain visible and editable — both on the page where it's collected AND at the final review screen (§6.2). This fixes:
- **Bug: roster additions vanish.** When a member adds a missing teammate, the addition must remain visible and editable afterward (currently saved to `missing_member_flags` with no UI to see/edit it again).
- **Bug: skipped tenure disappears.** If a member skips "how long on the team," it must remain accessible to fill in later, not vanish.

Applies to every field in Phase 1.

---

## 3. SECTION 1 — Introduction

### 3.1 Landing (rebuild `LandingStep.tsx` — it's currently broken)
**The current file has malformed JSX:** an unclosed "By the way," bubble, a bubble nested inside another, and the "Ideal team sizes… around 8 people" bubble duplicated. Rebuild it clean.

Content (one idea per screen, keep the existing warm copy):
1. "Hello — I'm Otis. My purpose is to help teams understand what's getting in the way of working well together — and to open up honest conversations about how to change that."
2. "Today, I'd like to do that by discussing **psychological safety**, which has many benefits for team performance and well-being."
3. "By the way, in case you're wondering why I'm an octopus: did you know octopuses have 9 brains? One central brain, and eight semi-autonomous mini-brains, one in each arm."
4. "Ideal team sizes happen to be around 8 people. And like octopus arms, each person thinks, feels, and acts independently, yet is interconnected in shaping the collective mind of the team."
5. Then the transition line: **"Here's what I think I know already."** → button advances into Section 2.

*(Fix the "9 brains" duplication and nesting. Each numbered item is one screen.)*

---

## 4. SECTION 2 — Personal & team info

### 4.1 Identity confirm (adapt existing `ProfileStep.tsx` — most of this already exists)
Show: "Your name is **[name]** and you're located in **[location]**, your team role is **[role]** — is that right?" with two buttons: **Yes, that's me** / **No, that's not me**.

- **Yes** → "It's nice to meet you, **[name]**." (same screen)
- **No** → "Sorry about that. What did I get wrong?" → comment box appears. After they submit:
  - **Capture the correction.** If they corrected their **name**, update the name **for the rest of this Otis session** so Otis stops using the old one.
  - **Flag the change in the consultant dashboard** (so the consultant sees the member corrected their info).
  - Then: "It's nice to meet you, **[corrected name]**." (same screen)

`ProfileStep` already saves name/role/location/timezone to `members` — reuse that; the new parts are the in-session name update and the dashboard flag.

### 4.2 Demographics (adapt `PersonalContextStep.tsx`)
Opening: "I'd like to know more about you. It's completely optional to share. Mind telling me…"

Fields (all optional, keep the existing consent note that they're never shared individually):
- "What languages you speak"
- "Your gender identity"
- "Your age"
- "Your ethnicity, nationality, or cultural background"
- "Anything else you'd like me to know" — textbox placeholder: *loved ones, passions, talents, favorite things, etc.*

### 4.3 Team framing + roster
"I also have some information about your team. By the way, I see a team as a group of people with complementary skills, who depend on one another to reach common goals. You might be part of several teams, and here are the members of one of them."

Then show the roster **(names only — remove the role details from each name)**. The roster **stays visible** as the following bubbles appear.

### 4.4 Team purpose (open text, guarded prompting)
"Can you tell me, in your own words, what this team exists to do? What do you work together for — what's your shared goal and purpose? And how does this connect to your organisation more broadly?"

**Prompting guardrail:** only prompt further if the answer is non-descript, partial, or "I don't know." Reuse the `ps_interview_revised.ts` "nudge once only if thin, then accept" discipline. Do not over-probe a good answer.

### 4.5 Missing members
"Thanks for telling me. By the way, do you feel anyone is missing — someone core to the team but not mentioned? When answering, remember you may work closely with people who are members of other teams, not this one."

Buttons + add option. **Per §2: any added member stays visible and editable afterward.**

### 4.6 Own role (open text, guarded prompting)
"And how about your role on the team? What skills, knowledge, or abilities do you contribute?"

Same prompting guardrail as §4.4 (only if needed).

### 4.7 Coordination frequency (reuse `CoordinationStep.tsx`, already works)
"And when it comes to your team members, how frequently do you work with each of them?" → the existing frequency grid.

---

## 5. SECTION 3 — Psychological safety assessment

### 5.1 Why Otis is here
"Thanks, **[name]**. I'd like to tell you more about why I'm here. I help assess and build team **psychological safety: the shared sense that it's safe to be oneself, speak up, and take calculated risks without fearing backlash.**"

"Today, I'd like us to assess what psychological safety currently looks like on your team. And later, once everyone on your team has responded, I'd like to help you build it up."

### 5.2 Privacy choice (adapt `ConsentStep.tsx`, already well-built)
"Before that, please know that everything you tell me can be held private if that's what you want. If you'd like to be anonymous, I won't share your exact words with anyone. Instead, I'll paraphrase and describe patterns I see across your whole team's responses, and replace your name with a random ID."

"Please note that complete anonymity can never be guaranteed, especially with small groups."

"What would you like to do? (You can change this later.)" → the existing private/open choice cards.

### 5.3 Questions + FAQ
"Got it. Do you have any questions for me at this point?" → text box (no extra text under it).
"Take a look at some frequently asked questions, if you like." → FAQ shown as a **dropdown/accordion** (reuse `FaqStep.tsx` content).

Button here reads **"Start the Assessment"** (not "Next"). Crossing into the questionnaire is where the progress bar moves from the Personal/PS-education portion into the assessment portion.

### 5.4 The ocean (adapt `PsIntroStep.tsx` — keep the good scrolling/narration)
Keep the ocean-depth segments and per-segment narration (they're strong). Changes:
- Add a larger heading above the image: **"Think of how safe you'd feel exploring an ocean with your team."**
- The three zone boxes are currently not equidistant — **center Zone 2 between the other two.**
- Remove the segment(s) Anna marked for removal (the standalone reflective-question block that's being replaced by §5.5).

### 5.5 Is PS important to your team? (replaces a removed block)
"Think about your team as a whole, and the times when you're all together — in meetings, project work, group messages, and so on. Based on how I've described psychological safety, do you think it's important for your team? Why or why not?"

**Prompting guardrail:** only prompt if they answer yes/no without getting at the why. Same discipline as §4.4.

### 5.6 The questionnaire (reuse `PsDiagnosticStep.tsx`)
"Thanks. Now, please read the following statements and tell me how much you agree with each."

When the member advances into the items, **this instruction line stays pinned at the top** above the scale.

*(Reverse-scoring note: there is currently only 1 reverse-scored item. This is acceptable for the beta but flagged as a post-beta psychometric refinement — do not add more now.)*

---

## 6. SECTION 4 — Finish

The current close is too abrupt. Soften into a sequence:

### 6.1 What happens next
"Thanks, **[name]**, that's all I need! Here's what happens next. I'm going to speak with everyone on your team and run some analyses. The next time we meet, we'll discuss the results — to pinpoint where psychological safety is lacking, and how to build it up."

### 6.2 Review / edit / download (EXTEND existing `ReviewStep.tsx` — do not build fresh)

"Before we end, take a look to see if there's anything you want to edit. You can download this information, or find it again by logging into your profile."

**`ReviewStep.tsx` already exists and already does most of this** — it displays profile, purpose, roster note, and PS ratings, has a working consent-choice editor, and working `handleDownload`/`handleEmail` via `buildPrintableHTML`. Reuse all of that. **What's missing and needs adding:** everything currently shown as **read-only text** (profile fields, purpose, roster note) needs to become **editable in place**, per §2's principle. Only consent choice is currently editable; extend that pattern to the rest.

**Also fix while touching this file:** `buildPrintableHTML` (in both `ReviewStep.tsx` and the near-duplicate copy in `AlreadyCompleteStep.tsx`) builds its "What we talked through" section from `ps_interview_responses`'s four-bucket fields (`situation_text`, `out_behavior_text`, `outcome_text`, `in_behavior_text`). **These are stale** — Phase 1 no longer collects this data; stories moved to Phase 3. This section will always render empty for anyone going through the rewritten Phase 1. Remove it from both files' output rather than ship dead logic. Consider extracting one shared `buildPrintableHTML` helper instead of maintaining two near-identical copies, low priority, only if time allows.

### 6.3 Goodbye (bring back the large floating Otis)
"Take care, **[name]**." → **Submit & Finish** button.

---

## 7. Section theming

- Three sections get subtly different background/colour schemes + differently-coloured progress-bar segments. **Subtle and classy — not bold or flashy.**
- Finish is a small final bar segment.

---

## 8. Build order (recommended)

1. The conversational shell (progress bar, chunk-per-screen arrow nav, floating-icon component, read-aloud toggle + auto-read, voice-input mic) — this is the reusable foundation everything else sits in.
2. Fix `LandingStep.tsx` (broken JSX) and rebuild Section 1.
3. Reorder/rewire Sections 2 and 3 into the new sequence with the new copy.
4. The §2 "nothing disappears" principle + the final review screen (§6.2), which also fixes the roster and tenure bugs.
5. The softened finish sequence.
6. Section theming + progress-bar starting-point fix.

---

## 9. Screenshot → file map (from Anna's rewrite document)

Every screenshot in the source document is identified below, with the current file it shows and what happens to it. **Governing rule: if a screen, block, or line of copy is not explicitly named in this spec, it is CUT — not carried forward, not "kept as-is by default."** This spec is the complete new flow; absence means removal, not an oversight.

| Screenshot | Shows (current file) | Disposition |
|---|---|---|
| image1.png | `PurposeStep.tsx` — 3 bubbles stacked, narrow column | Rewritten per §4.4. Content changes (new question wording), gets the new chunked shell. |
| image2.png | `ProfileStep.tsx` — identity confirm card | Adapted per §4.1. Mostly reused (`Yes, that's me` / `Let me fix something` already works) — add the in-session name update + consultant-dashboard flag on correction. |
| image3.png | `PersonalContextStep.tsx` — demographics fields | Adapted per §4.2. Field set and copy change slightly; mechanics (optional, consent note, skip) stay. |
| image4.png | `RosterStep.tsx` — roster cards showing role under each name | Adapted per §4.3. **Cut the role line from the display** — names only, per the spec. |
| image5.png | `CoordinationStep.tsx` — frequency grid | Reused as-is per §4.7. No changes. |
| image6.png | `ConsentStep.tsx` — the two radio choice cards | Reused as-is per §5.2. Only the surrounding copy/placement changes. |
| image7.png | `ConsentStep.tsx` — 5 bubbles stacked (the wall-of-text problem) | **This is the core problem the shell fixes.** Same copy, rebuilt into one-idea-per-screen chunks per §1.1. |
| image8.png | `FaqStep.tsx` — accordion | Reused as-is per §5.3. Content unchanged. |
| image9.png | `PsIntroOpenStep.tsx` | **CUT.** Not named anywhere in this spec — its opening line is folded into §5.4's ocean intro instead. Do not keep as a separate screen. |
| image10.png | `PsDescentStep.tsx` — the 3-zone ocean panel | Kept and adapted per §5.4 (add the heading, re-center Zone 2 — it's already close in this screenshot, confirm it's exact). |
| image11.png | `PsIntroCloseStep.tsx` | **CUT.** Not named in this spec. Its content ("Psychological safety is felt at the group level...") does not appear in the new flow — confirm this is intentional; flag to Anna if this feels like a loss (see note below). |
| image12.png | `PsDiagnosticStep.tsx` — Zone 1 questionnaire | Reused as-is per §5.6. Only the pinned instruction line is new. |
| image13.png | `ReviewStep.tsx` — top (profile/purpose/roster) | Extended per §6.2 — same content, made editable in place. |
| image14.png | `ReviewStep.tsx` — bottom (all 12 ratings + consent choice) | Extended per §6.2 — same content, ratings become part of the editable review; consent choice already editable. |

**ForeshadowStep.tsx has no screenshot in the document and is not named anywhere in this spec — it is CUT.** Its "here's what this process looks like" content is not carried forward; the persistent progress bar now does that job.

**Resolved:** image11 (`PsIntroCloseStep`) is CUT, per Anna's confirmation that anything not named in this spec is cut. Its content does not appear anywhere in the new flow.

---

## 10. What NOT to change

- The `ps-ocean.png` depth-slicing and per-segment narration logic in `PsIntroStep` (it's good — only the additions in §5.4).
- The Coordination frequency grid mechanics.
- The Consent choice mechanics (only the copy/placement per §5.2).
- The questionnaire scale and scoring.
- Reverse-scoring (leave at 1 item for beta).
