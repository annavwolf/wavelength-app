**D-048 — Session 3→4 pipeline reconciliation: fish retired, architecture carried forward**

**Decision:** The v3.1 8-stage fish/STARR pipeline (D-030) is not declared obsolete wholesale. Split by fate:

- **Retired (fish-specific content):** D-027 (7-fish set), D-029 (fish-specific situation/future prompts — principle survives as the Phase 1 felt-phrase table, re-anchored to PS items), D-032 (fish decoupling rule — the risk it guarded against is structurally resolved now that PS items are the analytic construct directly, no separate index layer to decouple from).
- **Carried forward as-is, re-anchored to PS items and the Phase 1 schema (`ps_interview_responses`):** D-030 (pipeline order lock — stage names update from STARR-collection etc. to interview-collection etc., the lock itself stands), D-031 (scenario is derived from convergent clustering, never selected from a single incident), D-033 (interpretation boundary — only the final assembly stage produces user-facing interpretation), D-036 (four-test behavior elicitation — already reflected in the Phase 1 probe's adjective-to-behavior redirect), D-037 (Behavioral Agreement template), D-039 (phased codebook), D-040 (member-convergence counting — same principle now implemented via D-044's embedding+threshold method), D-041 (interview data as hard pipeline prerequisite, survey-only fallback if too sparse).
- **Resolved, not carried over unchanged:**
  - **D-028** (STARR collapsed to one question, two hidden fields) — superseded. Phase 1's canonical design (this session) uses four separate explicit questions (Situation, Behavior, Outcome, Reflection) instead, per the canonical Phase 1 script. Interview burden is accepted as a tradeoff for richer, more explicit per-bucket data.
  - **D-034** (PS hypothesis standard format, hedged voice) — superseded by D-049 below.

**Rationale:** Fish removal changed the trigger mechanism, not the underlying qualitative-analysis rigor. Declaring the whole log obsolete would silently discard safeguards (bias prevention in scenario selection, deterministic counting, staged interpretation) that took real iteration to lock down, for no reason connected to why fish was removed.

**Rejected:** Declaring all of D-027 through D-041 obsolete and starting the methodology fresh.

**Status:** LOCKED.

---

**D-049 — PS hypothesis phrasing: adopt direct voice**

**Decision:** Replace D-034's hedged template ("One possible explanation is that... may be lower than it needs to be... We'd like to test this together") with the direct voice: **"Several members gave a low score to [item], discussed in the context of [context/situation]..."**

**Rationale:** Matches Anna's preferred tone (direct, non-hedged, evidence-forward) and ties the hypothesis statement directly to the convergence data already computed, rather than wrapping it in epistemic softening.

**Rejected:** D-034's original hedged format.

**Status:** LOCKED. Supersedes D-034.
