# Otis Phase 4 — Self-Serve Path (v1)
### Generated insights, team agreement, and the 30-day game plan, with no live facilitator
*Builder doc for Claude Code. This is the NO-WORKSHOP path: the team receives their agreement and a game plan, and runs the meeting themselves. The facilitated live workshop (`Otis_Phase4_Workshop_Spec_v1.md`) remains the deeper alternative, not built for beta.*

---

## 0. What this is

After all members finish Phase 3, the consultant presses **Generate insights**. Otis produces: a behaviour board, a drafted Team Behaviour Agreement, a clarity assessment, and a roadmap. Members receive a final correspondence (the "exit interview") with the agreement, what to do next, and downloadable guides.

**The team then runs their own meeting** using the provided artifacts. Otis does not facilitate live.

**Access note:** for the beta, the consultant (Anna or the design partner) presses the button and holds the dashboard. Handing this to a team leader later requires no architectural change — the consultant role already exists.

---

## 1. New Phase 3 questions (add to the existing flow)

### 1.1 After storytelling, before the never/always activity

**Impact (open response):**
> "What impact do you think incidents like this have on the quality of the team's work, or on the welfare of the team?"

Otis follows up once if the member answers only one of the two dimensions.

**Frequency (single select):**
> "How often do you experience things like this happening?"
- Several times a day
- Several times a week
- Several times a month
- Several times a year

### 1.2 Right before the end of Phase 3

**Commitment (single select + conditional comment):**
> "Would you be open to a 30-day game plan where your team puts new behaviours into practice?"
- Yes
- It depends
- I don't think so

If "It depends" or "I don't think so": *"Can you tell me more?"* (open text)

**Synchronicity (single select):**
> "How easy is it for your team to meet synchronously on a weekly or bi-weekly basis, including [list all roster names Otis knows]?"
- Easy, we do it regularly
- It happens occasionally
- Easier with some people, but not everyone
- Not easy, we rarely do this

**Storage:** all four to a new `phase3_context_responses` table (member_id, team_id, impact_text, frequency, commitment, commitment_comment, synchronicity).

---

## 2. Behaviour grouping — two-pass example-bucket classification

**This supersedes the earlier D-044/D-050 centroid method described in previous versions of this spec.** The old approach (embed → cluster by cosine → pick centroid-closest wording) had a known concern: with small teams, one member's exact phrasing could become the team's agreement text. This section replaces it with a two-pass LLM classification into a fixed set of pre-authored example behaviours (from Phase 3 spec §4.8), preserving Anna's expertise in the surfaced wording and eliminating "one member's words win" as a failure mode.

**Deliberate tradeoff, worth being explicit about:** this approach replaces members' own wording with Anna's pre-authored bucket labels in the final agreement. This is a considered change from the earlier fidelity-to-member-voice design. Members still generate behaviours in their own words in Phase 3; the substitution happens at analysis time, and the exit-interview copy must frame this as translation-into-standard-form, not selection of one member's words over another's (see also §6 wording).

### 2.1 The bucket universe

The 36 ALWAYS example behaviours and 36 NEVER example behaviours from Phase 3 spec §4.8 (across all 12 PS items) form the fixed bucket set. **The item each example originally belonged to is preserved in metadata but is not used as a constraint** — a member behaviour submitted for item 5 may bucket into an example that was originally authored under item 1. Cross-item bucketing is the whole point: it reveals patterns that transcend the specific item the team is currently focused on.

The bucket set is separated by valence: ALWAYS submissions can only bucket into ALWAYS examples, NEVER into NEVER, SOMETIMES into either (see §2.5). No cross-valence bucketing.

### 2.2 Pass 1 — Initial classification (independent, per-submission)

For each member-submitted behaviour, an LLM call proposes exactly one bucket, or `unbucketed`. Rules:

- **One bucket per submission, maximum.** No multi-labelling.
- The prompt receives: the submitted behaviour, its valence (never / sometimes / always), and the full valence-appropriate bucket set with labels.
- **Bias toward `unbucketed`.** The prompt explicitly instructs: *"if none of the buckets clearly fits, return `unbucketed`. Do not stretch a bucket to fit. Do not force-fit near-matches. A behaviour that doesn't cleanly belong in a bucket is more useful surfaced as unbucketed than mislabelled."*
- Return structured output: `{ submission_id, proposed_bucket_id | null, confidence: "high" | "medium" | "low", one_line_reason }`.

Independent calls per submission — no batch classification, so each behaviour is judged on its own merits without the model being biased by patterns it's already seen in this run.

### 2.3 Pass 2 — Critical review (second independent brain)

A separate LLM call reviews Pass 1's outputs. This is the "critical brain," and its job is explicitly framed as *skeptical*, not confirmatory.

The Pass 2 prompt receives, for each submission:
- The original submitted behaviour
- Pass 1's proposed bucket (or `unbucketed`)
- Pass 1's one-line reason
- The full valence-appropriate bucket set

Pass 2 does three jobs, in this order:

1. **Challenge Pass 1's assignments.** For each bucketed submission, ask: "Is this really the best fit, or is there a better bucket? Or does it not fit any bucket well enough to be assigned?" Pass 2 may **move** a submission to a different bucket, or **demote** it to `unbucketed`.
2. **Rescue Pass 1's `unbucketed` submissions.** For each submission Pass 1 left unbucketed, look again: is there actually a reasonable fit that Pass 1 missed? Pass 2 may **place** an unbucketed submission into a bucket, but with the same "don't force-fit" bias as Pass 1.
3. **Never override a high-confidence Pass 1 assignment casually.** If Pass 1 was high-confidence and Pass 2 wants to move it, Pass 2's reason must be genuinely stronger than Pass 1's, not just an alternative preference.

Output: `{ submission_id, final_bucket_id | null, pass2_action: "confirmed" | "moved" | "demoted" | "rescued", pass2_reason }`.

**One bucket per submission, still.** No multi-labelling, and Pass 2 cannot split a submission across buckets.

### 2.4 Counting and ranking

After Pass 2, count **distinct members per bucket** (D-040's convergence rule — three members' submissions bucketing to the same example = 3 members' worth of support, not 3 counts). Rank buckets within each valence by that count. Ties broken by criticality per §3.

### 2.5 SOMETIMES submissions

SOMETIMES-tagged submissions run through the same two-pass process but against the union of ALWAYS and NEVER buckets. Whichever valence they bucket into is recorded, but they are excluded from the top-N selection in §3 (SOMETIMES is for team discussion, not the drafted agreement, per D-052-adjacent).

### 2.6 Unbucketed submissions

Anything that comes out of Pass 2 still unbucketed goes into a separate "Members said this, but it didn't fit standard patterns" panel in the consultant's pre-release review (§5). These are NOT force-fitted, not silently dropped, and not blended into other buckets. They are visible to the consultant as their own group, with a note that they may still be workshop-worthy — an unbucketed submission is often the most idiosyncratic and specific thing the team said, which can be exactly what the workshop needs to discuss.

### 2.7 What the consultant sees for each bucket

- The bucket label (from §4.8)
- The count of distinct members whose submissions landed here
- Each contributing submission verbatim, with member identifier and its Pass 1/Pass 2 trajectory (proposed → final, plus reasons)
- Ability to move a submission between buckets or to `unbucketed` if the consultant disagrees with the classification

### 2.8 What NOT to do

- Do **not** synthesise new bucket wording. The bucket labels are fixed at Anna's authored phrasing from §4.8.
- Do **not** use embeddings/clustering (`lib/embeddings.ts`/`lib/clustering.ts`) for this classification. Those were the previous approach and can be retired or repurposed for other tasks — this section replaces them.
- Do **not** batch the LLM calls across submissions in a way that leaks context between them within a single pass. Each submission's Pass 1 judgment must be independent; Pass 2 sees all Pass 1 outputs together, which is intentional.
- Do **not** allow Pass 2 to invent new buckets. Its options are: the fixed §4.8 set, or `unbucketed`.

---

## 3. The Team Behaviour Agreement (generated)

**Template:**
> "In order to make this team a place where **[PS item]**, especially during/when **[max 2 situations]**, members will aim to ALWAYS **[top 2–3 behaviours]** and NEVER **[top 2–3 behaviours]**."

**Situation selection:** (1) member-convergence frequency, (2) team-level situations over 1:1 situations, (3) reported frequency from §1.1.

**Behaviour selection:** (1) member-convergence frequency, (2) criticality — the LLM ranks severity where counts tie ("yell and insult" outranks "roll eyes" as a NEVER).

---

## 4. Clarity assessment (NEW — drives the roadmap)

Three signals, computed from data already available:

**Signal 1 — Convergence**
- Strong: top 2 NEVER and top 2 ALWAYS each have ≥50% of members
- Moderate: each has ≥2 members
- Weak: top behaviours are single-member

**Signal 2 — Bucket disagreement**
- For each behaviour group, check whether members placed it in different buckets (one says NEVER, another SOMETIMES)
- Any top-4 behaviour with a split = disagreement flag

**Signal 3 — Situation convergence**
- Strong: 2+ members named the same context
- Weak: every member described a different context

**Combined state:**

| State | Condition | What Otis says |
|---|---|---|
| **Clear** | Strong convergence, no bucket splits, situations converge | "Your team converged strongly. Use the meeting to confirm, then move to the game plan." |
| **Mixed** | Moderate convergence OR one bucket split | "Mostly aligned. Discuss [specific behaviour] where members placed it differently." |
| **Unclear** | Weak convergence, multiple splits, or scattered situations | "Your team hasn't converged yet. Spend most of your meeting agreeing on the agreement itself before the game plan." |

**Surfaced disagreements are the most useful meeting material.** A bucket split is a gift: "half of you said never, half said sometimes — let's talk about that." Always name the specific behaviour, not just the state.

---

## 5. Consultant dashboard additions

**Generate insights** button (enabled once all members complete Phase 3) produces:

1. **Behaviour board** — Miro-style, all NEVER/SOMETIMES/ALWAYS behaviours pooled, **member links removed**. Grouped by cluster with convergence counts.
2. **Drafted agreement** + the clarity state and its specific flags.
3. **Commitment distribution** — bar chart of the §1.2 responses plus a factual summary. If commitment is broadly low, note for the consultant only: *low commitment may limit how effective behaviour-change strategies are; building commitment may need to come first.* **This is not shown to members.**
4. **Touchpoint distribution** — bar chart of the synchronicity responses, compared against the geographic network from Phase 2. Otis notes whether meeting synchronously is realistic or whether alternative structures are needed, deduced from timezone spread.
5. **Roadmap** — what Otis recommends the team does next.

**Delete protection (required):** deleting member behaviours must be multi-step with explicit confirmation. Currently too easy to delete accidentally.

---

## 6. The member exit interview (deliberately minimal)

### 6.0 Review, release, and delivery (how members actually receive it)

This mirrors the Phase 3 report pattern that already exists — reuse it rather than inventing a second mechanism.

**Consultant review screen.** After pressing Generate insights, the consultant sees the full exit interview as members will see it, with every text element editable: the agreement, the "what to do next" script, and any Otis-written summaries. Otis's original is preserved and viewable. Same editing pattern as the Phase 3 report review.

**Release action.** A single **"Release to team"** button that:
- Locks the (possibly edited) exit-interview content
- Generates the three artifacts with the team's data filled in (§7.1)
- Writes them to team storage and to each member's profile
- Notifies members by email that their results are ready, with a link

**Where it lives:** a member-facing route alongside the existing Phase 3 route (Phase 3 is at `/me/phase3`; this should follow the same pattern, e.g. `/me/results`), behind the existing member-auth middleware. Members must be logged in.

**Persistence:** the exit interview and its artifacts remain accessible from the member's profile indefinitely. A member returning in week 3 finds everything without the original email.

**Nothing is visible to members until release.** Same as Phase 3.

---

Members see three things only. Everything else lives in downloadable artifacts. This solves the nesting problem: without it, the interview would contain a meeting agenda, containing a game plan, containing a second meeting agenda — four levels deep.

### 6.1 The team's agreement
The final agreement, displayed clearly.

**Framing note (add above the agreement):** because the bucketed classification approach in §2 replaces members' verbatim wording with standardised bucket labels, the agreement should be introduced with one honest line, not presented as "your team's own words." Suggested wording:

> "Otis grouped what your team said into common behavioural patterns. Here's your team's agreement, in that standard form."

### 6.2 What to do next (verbatim script)

> "The Team Agreement I've drawn up is probably not perfect. It'll be much better if your team discusses it, tweaks it, and finalises it together. That's why I'd suggest holding a team meeting for this.
>
> Forming the agreement is half the challenge. The other half is a game plan to see it through — how you'll respond when NEVER and ALWAYS behaviours come up, and how you'll check in as a team. I'd suggest building that together, and committing to it for 30 days."

### 6.3 The roadmap infographic

A horizontal visual timeline. Structure (from Anna's sketch):

```
┌─────────────────────────┐      W1        W2        W3        W4         W4/end
│     TEAM MEETING        │   ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐  ┌──────────┐
│ ┌──────────┐ ┌────────┐ │   │ TEAM  │ │ TEAM  │ │ TEAM  │ │ TEAM  │  │   OTIS   │
│ │ FINALISE │ │  GAME  │ │──▶│CHECK-IN│ │CHECK-IN│ │CHECK-IN│ │CHECK-IN│  │ RE-VISIT │
│ │AGREEMENT │ │  PLAN  │ │   └───────┘ └───────┘ └───────┘ └───────┘  └──────────┘
│ └──────────┘ └────────┘ │       │         │         │         │
└─────────────────────────┘   ┌───┴─────────┴─────────┴─────────┴───┐
                              │  NEVER / ALWAYS BEHAVIOUR           │
                              │  REINFORCEMENT (continuous)         │
                              └─────────────────────────────────────┘
```

- **Team Meeting** is one block containing two sub-steps (Finalise Agreement, Game Plan). It feeds both the check-in sequence and the continuous reinforcement band.
- **Four weekly check-ins**, W1 through W4.
- **Otis re-visit** at the end. Label it as a future step — it is NOT built for the beta (see §8). Present it as "your team will check back in with Otis" without implying it's available now.
- **NEVER/ALWAYS reinforcement** runs as a continuous band beneath the check-ins, connected back to the Game Plan block, because reinforcement happens in the moment throughout, not only at check-ins.

**Interaction:** hovering any element shows a short plain-language summary of what happens at that step. Clicking downloads the relevant artifact (Team Meeting → meeting agenda + game plan; check-ins → check-in protocol; reinforcement band → the strategy sections). The re-visit block has a summary but no download.

**Build as an inline SVG or component**, not a static image, so labels can carry the team's actual check-in cadence if they've set one.

### 6.4 Downloads

Three artifacts (see §7). **Also auto-added to each member's profile** so they can find them again — the profile already exists and this is what it's for.

### 6.5 Closing note

One soft line, at the very end, not a pitch:
> "If your team would like a facilitator to run this with you, Wavelength offers that."

**Editability:** the consultant can edit any part of the exit interview before release, same as the Phase 3 report.

---

## 7. The artifacts (content is written; pre-filled per team at generation time)

| File | Purpose |
|---|---|
| `Game_Plan_Template.md` | The fillable document teams complete during their meeting. Agreement, NEVER response strategies, ALWAYS response strategies, check-in decisions, commitment. |
| `Team_Meeting_Agenda.md` | How to run the one-time meeting that finalises the agreement and builds the game plan. Includes "if your whole team can't meet" adaptations. |
| `Weekly_Check_In_Protocol.md` | The recurring 10–15 min check-in. Fixed questions, fixed order, plus the private-collection adaptation and sync/async variants. |

**The wording of these artifacts is final — do not paraphrase or restructure the guidance text.** But they are NOT served as static files. Each is generated per team at release time with the team's own data filled in.

### 7.1 What gets pre-filled (required)

**Game_Plan_Template:**
| Field | Source |
|---|---|
| Team name | `teams.team_name` |
| Review date (30 days) | Release date + 30 days |
| §1 agreement: PS item | The focus item text |
| §1 agreement: situations | The selected situations (§3) |
| §1 agreement: ALWAYS 1–3 | Top ALWAYS behaviours (§3), representative wording |
| §1 agreement: NEVER 1–3 | Top NEVER behaviours (§3) |
| §6 review date | Same as above |

Sections 2, 3, 4 and 5 stay blank — those are the team's decisions to make live. **Do not pre-tick any strategy checkboxes.**

**Async tailoring (uses the synchronicity data from §1.2).** If the team's responses skew toward *"easier with some people, but not everyone"* or *"not easy, we rarely do this"*, then in both the Team Meeting Agenda and the Weekly Check-In Protocol, **promote the relevant adaptation section to directly after the main protocol rather than leaving it at the end**, and add one line at the top: *"Based on what your team told us about meeting together, the adaptations below are likely to matter for you."*

Teams that meet easily see the artifacts as written. This is the one place the synchronicity answers change what a team actually receives, otherwise that question is only informing the consultant's dashboard.

**Weekly_Check_In_Protocol:**
| Field | Source |
|---|---|
| Step 1's agreement text | The full generated agreement, so the facilitator reads the team's actual agreement, not a placeholder |

**Team_Meeting_Agenda:**
| Field | Source |
|---|---|
| The clarity conditional in Part 1 | **Resolve to the team's actual state.** The artifact currently reads "if Otis flagged that your team didn't converge… / if Otis flagged strong agreement…". Replace with only the branch that applies, and name the specific behaviours or situations that split (from §4's flags). A team should not have to work out which branch is theirs. |

### 7.2 Format

The Game Plan is meant to be **filled in by the team during their meeting**, so it needs to be writable — either a form-fillable PDF or an editable document, not a flat PDF. The other two are read-only reference and can be flat PDFs.

Confirm the chosen approach before building; flag if a form-fillable format is impractical, in which case a print-and-write layout is acceptable.

### 7.3 Storage

Generated artifacts are stored per team and linked from both the exit interview and each member's profile. They must remain retrievable later — a member returning in week 3 should find them in their profile without needing the original email.

---

## 8. Scope for the beta

**Build:**
- The four new Phase 3 questions
- Behaviour grouping (single-stream reuse of existing clustering)
- Generated agreement + clarity assessment
- Generate insights button and dashboard additions
- Delete protection
- Exit interview (minimal, per §6)
- The three artifacts as downloads + profile auto-population

**Do NOT build:**
- Phase 5 / the Otis revisit (mentioned in the roadmap as a future step, not implemented)
- Live Otis facilitation of the team meeting
- Uploading revised agreements back into the profile
- Fully-designed pathways for each sync/async scenario (the artifacts carry lightweight guidance instead)
