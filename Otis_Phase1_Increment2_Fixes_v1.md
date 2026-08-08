# Otis Phase 1 Rewrite — Increment 2 Fixes (v1)
### Issues found reviewing the live build, grounded in Anna's actual screenshots
*Builder doc for Claude Code. Amends `Otis_Phase1_Rewrite_Spec_v1.md`. Increment 2 (reordering into the shell) is visibly in progress — sectioned progress bar and several screens are live. This addendum covers 12 specific issues found reviewing that build, several confirmed directly against screenshots, not just described.*

---

## 1. Navigation: replace back-button-to-start with a clickable progress bar

**Current behaviour (confirmed):** front/back arrows exist in the Introduction section, but disappear in later sections, replaced by a single "← Back" link at the top-left that returns the member all the way to the beginning of the whole flow, not the current section.

**Fix:**
- **Remove the top-left "← Back" link entirely.**
- **Make the progress bar clickable.** Clicking any section jumps to the start of that section.
- **Section names stay visible on the progress bar at all times** (not just the current section, as currently shown, e.g. "Personal & team info" alone).
- **Add forward/backward arrows at the bottom of every screen, throughout the entire flow**, not just Introduction. A backward arrow is always present. A forward arrow is only shown if there is no other way to proceed on that screen — if a "Continue" / "Next" / "Skip this" button already exists, omit the redundant forward arrow.
- **Fixed position:** the forward/backward control location must be identical across every screen, even when the button text differs ("Continue" vs. an arrow icon vs. "Skip this"). Consistent placement, always.

---

## 2. Read-aloud bugs

Three separate bugs, confirmed by Anna's direct testing:

1. **Double narration.** The Landing "Hello — I'm Otis..." text is read aloud twice on one screen. Should read once.
2. **Auto-read stops working after the first screen.** Read-aloud should continue automatically on every subsequent screen once enabled at the start — currently the member has to manually press "Read aloud" again each time.
3. **Navigating doesn't stop current narration.** If Otis is mid-sentence and the member clicks forward/back, the old narration keeps playing instead of stopping and reading the new screen's text. **Fix:** any navigation action must cancel in-flight speech synthesis before starting the new screen's narration (or staying silent if read-aloud would auto-continue there).

---

## 3. Merge the transition line into the identity-confirm screen

**Current (confirmed via screenshot):** "Here's what I think I know already." sits alone as its own screen at the end of Introduction, with a large centered floating Otis and a "Continue" button. The next screen (Personal & team info) separately shows "Your name is **raul**, you're located in **Đà Nẵng**, your team role is **marketer** — is that right?"

**Fix — combine into one screen:**
> "Now that you know a bit about me, I'd like to know more about you. Here's what I think I know already."
>
> [name] · [location] · [role]

- The name/location/role values must render **actually bold** (`<strong>` or equivalent), not literal double-asterisks. **Bug confirmed by screenshot:** the current build shows literal `**raul**`, `**Đà Nẵng**`, `**marketer**` — the markdown syntax is not being parsed/rendered, it's printing as raw text. Fix the rendering, whether via a markdown-aware text component or by using real bold tags instead of `**` in the source string.
- **Button rename:** "No, that's not me" → **"That's not quite right."**

---

## 4. Demographics screen: reorder one field

Move **"Anything else you'd like me to know"** to the very **bottom** of the demographics screen (after gender identity / cultural background / age), not near the top as currently shown.

Change **"Mind telling me a bit about yourself?"** → **"Mind telling me..."**

---

## 5. Chat history must persist visibly; member controls advancement

**This is the most important fix in this batch — confirmed directly by a real, frustrated interaction in Anna's testing.** On the team-purpose question, Otis asked a follow-up ("Can you say a bit more...?"), and the member's actual response was: **"i told you already."** The member's own prior answer was not visible anywhere on screen when the follow-up appeared — it had been silently replaced/lost, so from the member's point of view, Otis appeared to have not listened.

**Fix, two parts:**

1. **Every message — the member's own submitted answers, and Otis's questions/follow-ups — must remain visible on screen as the member moves forward and backward.** Do not let a text input silently overwrite or hide a previous submission. Once submitted, an answer becomes a persistent bubble in the conversation, the same way Otis's bubbles are persistent.
2. **Otis must not auto-advance the page after prompting.** Currently, once Otis finishes a follow-up prompt, the flow auto-advances to the next screen. Instead: Otis can stop actively prompting (i.e., stop asking further follow-up questions), but **the member decides when to move on**, via the same forward control used everywhere else (§1). This applies to every open-text conversational moment in Phase 1, not just the purpose question.

---

## 6. Team purpose: drop organisation-connection prompting; add a team-name question

**Current (confirmed by screenshot):** Otis asks "What do you work together for — what's your shared goal and purpose? And how does this connect to your organisation more broadly?" and, if the answer doesn't address the organisational-connection part, follows up specifically pushing on that ("I'm particularly curious how this team's work connects to the wider organisation").

**Fix:** Remove the organisation-connection question and its follow-up entirely. The only follow-up allowed here is a general one if the member doesn't answer the shared-purpose question at all (reuse the existing thin-answer guardrail, not a topic-specific push).

**New flow for this screen:**
1. Show the roster at the top of the page.
2. Bubble: "For me, a team exists when a group of people have complementary skills and depend on each other to reach common goals."
3. Bubble: "Looking at this team, can you tell me what it exists to do? What do you work together for — what's your shared goal and purpose?"
4. Text box for the response.
5. No topic-specific prompting. If the answer is genuinely thin/absent, use the existing generic "can you say a bit more" guardrail once, then accept.
6. New bubble: "Does your team use a 'team name' to refer to yourselves? If not, what would you name your team?"
7. Text box for the response.

---

## 7. Move "missing member" question to after the purpose/team-name screen

The missing-member check no longer lives in `RosterStep` at its current position. It moves to run **after** the purpose + team-name screen (§6), as its own step:

1. Show the roster at the top of the page (again).
2. Bubble: "Is there anyone you feel is missing from this team list? Someone core to the team? Keep in mind that not everyone you work closely with may be a part of this team — they might belong to other teams."
3. New bubble: "So, thinking of **[team name from §6]** and your shared purpose, is a core member missing?"
4. Buttons: **"No"** / **"I think so"** → if "I think so," reveal the existing add-member fields.

---

## 8. Remove role from every roster display, including Coordination

Anna's original spec (§4.3 of the base document) already said to show names only in the roster. **Confirmed by screenshot: the role is still showing in the Coordination step too** ("Annamaria Wolf · leader", "raul · Finance person", "morii · security"). Apply the "names only, no role" rule everywhere the roster or a member list is displayed, not just the roster-confirmation screen.

---

## 9. PS section opener — exact copy + bold

Change the opening line to:

> "Thanks, [name]. Let's talk now about **Psychological Safety**. I define this as **the shared sense that it's safe to be oneself, speak up, and take calculated risks without fearing backlash.**"

The bolded portions must render as actual bold text.

---

## 10. Consent screen — new bubble split, bold, and correct default

1. Bold this line: **"Before that, please know that everything you tell me can be held private if that's what you want."**
2. Split out a **new separate bubble**: "If you'd like to be anonymous, I won't share your exact words or name. Instead, I'll paraphrase and replace your name with a random ID."
3. **Fix the default.** Confirmed by screenshot: the choice currently defaults to *"I'm comfortable sharing my exact words, and my name..."* (the open/less-private option) pre-selected. **This must default to "Keep my responses fully private"** — defaulting to the less-private option is a real privacy issue, not just a preference.

---

## 11. "Is PS important to your team?" — move after the survey; same persistence/advancement rules

- Apply the same chat-history-visible and member-controls-advancement fixes from §5 to this screen.
- **Move this question to run AFTER the questionnaire (§5.6 of the base spec), not before it.** Currently it runs before.

---

## 12. Questionnaire heading

Add, at the top of the questionnaire screen, **large white text, centered, overlapping the blue ocean background, positioned above "Safe to Belong"**:

> "Think about your team as a whole, not just one or two members. Read the following statements and tell me how much you agree with each."

**Remove the current small dark instruction bar** ("Please read the following statements and tell me how much you agree with each.") that sits above the Zone 1 panel — it's replaced by the new large heading, not kept alongside it.

---

## Priority note for Claude Code

**§5 (chat history persistence + member-controlled advancement) is the highest-priority fix in this batch.** It's not a polish item — it produced a real, confirmed bad experience for a test member ("i told you already"), and the same underlying bug pattern likely affects every open-text conversational moment in the flow (purpose, team name, missing-member reasoning, the PS-importance question), not just the one screen it was caught on. Fix the underlying pattern once, not screen-by-screen.
