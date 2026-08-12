# Tier 1 — Data Integrity Bugs (investigate before fixing)

Two data-integrity bugs are making the dashboard untrustworthy. **Please investigate the root cause of each before changing anything, and report back what you find — don't just patch the symptom.** These are the highest priority because everything downstream (Otis's reads, the agreement, the dashboard) is computed from this data, so if it's wrong, everything built on it is wrong.

---

## Bug 1 — Pulse checks are not saved unless the member also leaves a comment

**Symptom (confirmed by testing):** a member presses a pulse-check button (e.g. the 30-day commitment, the synchronicity/"meeting together" check, and the per-zone accuracy checks) but the response does NOT persist unless they also type a comment. In the consultant dashboard, the commitment pulse shows "no responses" from anyone, even though members clicked a button. The member even went back and re-clicked — still not saved.

**What to check:**
- The write path for pulse-check responses. Is the save gated on the comment field being non-empty (e.g. an early-return, a validation guard, or a conditional insert that only fires when comment is truthy)?
- Does this affect ALL pulse checks or only some? The report suggests the per-zone accuracy checks may have the same issue.

**Required behaviour:** the button-press (the forced-choice value) must save on its own, independently, whether or not a comment is entered. The comment is always optional. This should be true for every pulse check in the product — the zone-accuracy checks, the 30-day commitment, and the synchronicity check.

**Report back:** what was gating the save, and confirm the fix covers every pulse-check type, not just the commitment one.

---

## Bug 2 — Phantom denominator ("10 of 20" / "5 of 5" vs. actual team size)

**Symptom (confirmed by testing):** the statistics boxes and Otis's zone read show counts like "10 of 20" for a team that does NOT have 20 members. Example from an actual Otis read: *"Half of all responses in Zone 1 were favorable (10 of 20)..."* The team in question had far fewer than 20 members.

**What to check — this needs real investigation, not a guess:**
- Where does the denominator come from in the zone-favorability computation? Is it counting **responses** (members × statements-in-zone) rather than **members**? If a zone has 4 statements and 5 members, that's 20 responses — which would explain "20." If so, the phrasing "10 of 20" is conflating response-count with member-count.
- Is the denominator correct for the *math* but wrong for the *wording*? I.e. is the favorability percentage itself accurate, and only the "X of Y" label misleading? Or is the denominator actually wrong in the computation too?
- This phantom number is propagating into Otis's LLM read (the read literally says "10 of 20"), so whatever feeds the read is carrying the wrong or confusingly-labelled figure.

**Report back before fixing:**
1. What the denominator actually represents right now (responses vs. members).
2. Whether the favorability percentages are correct or also affected.
3. Your proposed fix for both the statistics boxes AND Otis's read, so the number shown matches the actual team, and the label is unambiguous (if we mean members, say members; if we mean responses, say responses — don't mix them).

**Do not change Otis's read generation until we confirm what the number should be** — I want to see your findings first, because how we phrase this ties into a separate correctness pass on the reads (item-naming, confidence framing) that's coming next.

---

## Why investigate-first

This project has a track record of static checks passing while the rendered/computed output is wrong. Both of these are exactly that class of bug — the code "works," but the numbers it produces are untrustworthy. Please find the actual root cause and report it before patching, so we fix the real thing and not a symptom.
