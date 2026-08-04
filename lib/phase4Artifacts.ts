// Phase 4 self-serve §7 — per-team artifact generation.
//
// The artifact WORDING is final (spec §7 — do not paraphrase or restructure the
// guidance text). These builders transcribe that wording verbatim and only fill
// the placeholders (§7.1), resolve the Meeting-Agenda clarity conditional to the
// team's actual state, and apply the async tailoring (promote the adaptation
// section + add one line at the top) when the synchronicity answers skew.
//
// The Game Plan is delivered as the in-app editable form (spec §7.2 decision),
// so only the two read-only reference artifacts are generated here as markdown.
// The Game Plan form reads its pre-fill straight from phase4_selfserve_json.agreement.

import type { Phase4Agreement, Phase4Artifact, Phase4Clarity } from "@/types/database";

export type ArtifactFill = {
  agreement: Phase4Agreement;
  agreementText: string;    // full generated agreement sentence (Check-In step 1)
  clarity: Phase4Clarity;
  asyncSkew: boolean;
};

const ASYNC_TOP_LINE =
  "*Based on what your team told us about meeting together, the adaptations below are likely to matter for you.*";

function quoteList(xs: string[]): string {
  const q = xs.map((x) => `"${x}"`);
  return q.length <= 1 ? (q[0] ?? "") : `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}`;
}

// Resolve the Part-1 clarity conditional to the ONE branch that applies (§7.1),
// naming the specific behaviours/situations that split.
function resolveClarityBranch(clarity: Phase4Clarity): string {
  if (clarity.state === "clear") {
    return "**Otis flagged strong agreement.** Your team already converged, so confirm the agreement quickly and move on to Part 2.";
  }

  const specifics: string[] = [];
  if (clarity.split_behaviours.length) {
    specifics.push(`members placed ${quoteList(clarity.split_behaviours)} in different buckets (a never, a sometimes, or an always)`);
  }
  if (clarity.scattered_situations) {
    specifics.push("members described different situations rather than one shared context");
  }
  const specificLine = specifics.length ? ` Specifically, ${specifics.join(", and ")}.` : "";

  if (clarity.state === "unclear") {
    return `**Otis flagged that your team hasn't converged yet.** Spend most of your time here.${specificLine} Those disagreements are the most useful conversation you can have today, don't rush past them.`;
  }
  // mixed
  return `**Otis flagged that your team is mostly aligned.** Confirm the agreement, then give a little extra time to where you differ.${specificLine}`;
}

// ── Team Meeting Agenda (Team_Meeting_Agenda.md) ─────────────────────────────
function buildMeetingAgenda(fill: ArtifactFill): string {
  const clarityBranch = resolveClarityBranch(fill.clarity);
  const topLine = fill.asyncSkew ? `${ASYNC_TOP_LINE}\n\n` : "";

  return `# Your Team Meeting: Finalise the Agreement, Build the Game Plan

${topLine}**Length:** 45 to 60 minutes. **What you need:** your Team Behaviour Agreement from Otis, and the Game Plan template.

**Outcome:** a finalised agreement your team actually agrees with, and a game plan for the next 30 days.

---

## Before you start (5 min)

**One person volunteers to facilitate.** It should not default to the manager.

**Speaking order:** least senior to most senior, or quietest to loudest. The leader and the loud voices go last. This is a rule, not a suggestion, and it applies to every round today.

**Optional warm-up:** go around, each person shares one recent moment where a teammate did something you appreciated.

---

## Part 1: Finalise the agreement (10 to 25 min)

**Start here, this question comes first:**

> **"Does the situation Otis picked match where this actually shows up for us?"**

If Otis says "during update meetings" but your real problem is in Slack, or during handovers, or in one-to-ones, change it now. Everything else depends on getting this right.

**Then work through:**

1. **The situations.** Agree on the one or two situations where these behaviours matter most.
2. **The ALWAYS behaviours.** Agree on 2 to 3 your team will commit to.
3. **The NEVER behaviours.** Agree on 2 to 3.

${clarityBranch}

**Write the final version into the Game Plan document as you go.**

---

## Part 2: Build the game plan (20 to 30 min)

Forming the agreement is half the challenge. The other half is deciding how you'll actually live it.

Work through the Game Plan document together:

**1. How we respond to a NEVER behaviour.** Pick 2 to 4 strategies. Then run the comfort check, everyone holds up 1 to 5 fingers for how comfortable they'd be actually using it. Anyone under 3 says what would make it easier. Adjust.

**2. How we respond to an ALWAYS behaviour.** Pick 2 to 4.

**3. Our team check-in.** Decide how often, when, where, who facilitates, and whether you'll collect observations privately beforehand.

*Anchor the check-in to a meeting you already have. New meetings get cancelled; existing ones survive.*

---

## Part 3: Commit and close (5 min)

**Go around:** hold up 1 to 5 fingers for how easy this will be to follow over the next 30 days.

**Anyone under 3:** what would make it easier? Adjust the plan.

**Then:**
- Decide who keeps the Game Plan document
- Decide where it lives so everyone sees it (pin it in your chat channel)
- Put the 30-day review date in the calendar

---

## If your whole team can't meet

**Someone missed it.** Send them the agreement and game plan, ask for their input within a couple of days, and confirm they can commit. Don't finalise until you've heard from them. A plan someone didn't agree to won't hold.

**You need two smaller meetings.** Run the same agenda in both. After the second, share both outcomes with everyone and resolve any differences in writing before finalising. Someone needs to own bridging the two.

**You can't meet at all.** Work through the same questions in a shared document or thread. Two rules make this work: give everyone a deadline to respond, and ask the leader to hold their comments until others have posted. Otherwise the first senior voice anchors everything.

---

*Once your game plan is filled in, keep it somewhere everyone can see it. You'll use it at every check-in.*
`;
}

// ── Weekly Check-In Protocol (Weekly_Check_In_Protocol.md) ───────────────────
function buildCheckIn(fill: ArtifactFill): string {
  const topLine = fill.asyncSkew ? `${ASYNC_TOP_LINE}\n\n` : "";

  const protocol = `## The protocol

### 1. Read the agreement aloud (1 min)

The facilitator reads it: *"${fill.agreementText}"*

Then: *"The purpose of this check-in is to help us live up to that."*

### 2. Appreciation round (4 min)

Going in order: **"What's one moment where someone modelled one of our ALWAYS behaviours?"**

Fine to pass, but everyone is asked. Always start here.

*Example: "I want to recognise [name] for [behaviour]. That's one of our ALWAYS behaviours, and it helped [outcome]."*

### 3. What went well when something slipped (3 min)

Going in order: **"Was there a moment where a NEVER behaviour came up and was handled well?"** Just one each.

*Examples: "I did [behaviour], and [name] pointed it out, and I'm becoming more aware." Or: "I noticed [behaviour] and used [our strategy] to flag it. That helped."*

This step matters more than it looks. It reinforces the *response*, not just the behaviour, which is the part teams usually forget.

### 4. Unresolved patterns (4 min)

Going in order: **"Without naming anyone, was there a NEVER behaviour that didn't get addressed, or something you noticed but didn't say at the time?"** Just one each.

Describe the behaviour and its effect. Never the person.

*"Or something you noticed but didn't say" is deliberate. It gives permission to raise the thing you held back, which is usually the most useful thing in the room.*

### 5. One improvement (2 min)

Together: **"Is there one thing we could try before next time to live up to our agreement?"**

Just one. Phrase it as *"if ___ happens, we'll ___."*

The facilitator invites anyone who's been quiet.

*This might be: a different way of responding to NEVER or ALWAYS behaviours, adding a situation you hadn't thought of, or adjusting a behaviour in the agreement (though try not to change the agreement too early).*

### 6. Close (1 min)

Facilitator summarises: what we're trying this week, and any action items. Done.`;

  const step4 = `## Making step 4 work when people stay quiet

On a team that's still building safety, step 4 can land in silence. The fix:

**Collect privately beforehand.** Each member submits, in advance, anything unresolved they noticed. Pool the responses, remove the names, and the facilitator reads the patterns aloud to open step 4.

Now nobody has to be the first brave person, they're reacting to something already on the table. This also means anyone who can't attend still contributes.

If your team is finding step 4 hard, do this. It's the single most useful adjustment available.`;

  const adapting = `## Adapting it

**Someone's missing.** Share the summary afterwards and ask for their input on the one improvement. Better: use the private collection above so their observations are in the room even when they aren't.

**Two smaller meetings.** Run the same protocol in both. Afterwards, share both summaries with everyone. Someone owns making sure the two groups end up aligned on the one improvement, otherwise you get two teams.

**Fully asynchronous.** Post the five questions in a thread with a deadline. Two rules: everyone responds before reading others' answers if your tool allows, and the leader posts last. Then the facilitator summarises the patterns and proposes the one improvement for the team to confirm. Slower, but it holds.

**Keep a record.** Post the summary where everyone can see it. Pin the agreement in your channel. Visibility is most of what keeps this alive.`;

  // Async tailoring: promote "Adapting it" (sync/async variants) to directly
  // after the protocol; otherwise keep the template order.
  const body = fill.asyncSkew
    ? `${protocol}\n\n---\n\n${adapting}\n\n---\n\n${step4}`
    : `${protocol}\n\n---\n\n${step4}\n\n---\n\n${adapting}`;

  return `# The Team Check-In

${topLine}**10 to 15 minutes. Same steps, same order, every time.**

Add this to the end of a meeting you already have. Same questions each time, so nobody has to decide what to raise or how to raise it. The structure does that work.

---

## The rules

**Rotate the facilitator.** Not the manager by default.

**Speaking order: quietest to loudest, or least to most senior. The leader always goes last.** Every round.

**Describe behaviours, not people.** *"I noticed a pattern of…"* not *"Anna did X."*

**Everyone gets asked every question.** Passing is fine. Not being asked is not.

---

${body}

---

*Run this for 30 days, then check back in with Otis to see what moved.*
`;
}

// Build the two read-only reference artifacts, filled for this team.
export function buildArtifacts(fill: ArtifactFill): Phase4Artifact[] {
  return [
    { slug: "meeting_agenda", title: "Your Team Meeting Agenda", content: buildMeetingAgenda(fill) },
    { slug: "check_in", title: "The Team Check-In", content: buildCheckIn(fill) },
  ];
}
