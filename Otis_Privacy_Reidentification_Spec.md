# Otis — Privacy & Re-identification Protection (v1)
### Two-tier content protection + identity/response schema separation
*Builder doc for Claude Code. Self-contained — assumes no prior context. This implements privacy commitments tied to a signed NDA with the pilot design partner. Two independent workstreams: (A) how member content is displayed to prevent re-identification, and (B) backend separation of identity from response data. Do A and B as separate passes. Both are important; A is more urgent for the pilot.*

---

## Background (why this exists)

The consultant dashboard currently shows, for a small team, several pieces of information that are individually pseudonymous but **collectively re-identifying**: pseudonymous member IDs (P101, P102…), geographic location, team roles, and verbatim quotes — all linkable to the same ID. For a small team whose consultant knows the members, combining location + role + a distinctive quote under a shared ID makes it trivial to identify who said what. This undermines the pseudonymization commitment even though no single field is a name.

The fix has two parts: reduce what's linkable in the display (Workstream A), and separate identity from responses in the database (Workstream B).

---

# WORKSTREAM A — Display-level re-identification protection

## A.0 The core principle: two content tiers

Member-generated content splits into two tiers with **different** protection rules. Do not apply a single blanket rule.

**Tier 1 — Low-identifying, intervention-critical: the behaviour board (ALWAYS / SOMETIMES / NEVER submissions).**
These are short behavioural statements ("listen without interrupting"). They carry little personal fingerprint, and keeping them visible verbatim is central to the psychological-safety intervention (in a live workshop these are shared aloud with the whole team).
Rule: **show verbatim, but remove all member IDs.** Display as an unattributed pool. No minimum-n suppression. No per-member linkage.

**Tier 2 — High-identifying: stories, pulse-check comments, impact statements, and any free-text narrative.**
These describe specific incidents, often in a distinctive personal voice, and are the main re-identification risk.
Rule: **remove member IDs, apply minimum-n suppression, and gate any verbatim display behind unanimous opt-in** (see A.2, A.3). Where verbatim can't be shown, show an Otis-written summary instead.

## A.1 Remove member IDs from content display

Across the consultant dashboard, **remove the per-item pseudonymous member IDs (P101, P102, etc.) from displayed content** — both the behaviour board (Tier 1) and the high-identifying content (Tier 2).

The reason: the ID is the *linking key*. It's what lets someone cross-reference one person's location, role, and quote as belonging to the same individual. Removing it means each quote/behaviour becomes a free-floating, unlinked statement — you can no longer combine attributes to identify a person.

- The behaviour board becomes an unattributed pool of statements.
- High-identifying content, where shown at all (per A.2/A.3), is shown without an ID.
- **Member-count / convergence numbers stay** (e.g. "4 members submitted a behaviour that grouped here") — those are aggregate counts, not per-statement identifiers, and they don't enable cross-referencing.
- This is a deliberate, accepted trade-off: the consultant loses the ability to see patterns *within* a single person (e.g. "the person who rated belonging low also said X"). That's fine — this product is about team-level patterns, not individual profiles.

**Where IDs may remain:** aggregate structural views that carry no free-text and no cross-linkable attributes — e.g. the coordination network graph, if it needs node labels, may use neutral labels, but must NOT be shown on the same view/page as verbatim quotes or location (see A.4).

## A.2 Minimum-n suppression (Tier 2 only)

**Threshold: n = 5.** This is the standard minimum-reporting threshold in HR analytics (Culture Amp, Viva Glint, Peakon) and aligns with statistical-disclosure-control practice (cells < 5 treated as identifying). Use 5 so the choice is defensible by convention, not arbitrary.

**Applied per-slice, not per-team.** The threshold is about *how many members responded to the specific section being displayed*, not the team's total size. Example: if only 3 members answered the "impact on the team's work" question, that slice is n=3 and its verbatim content is suppressed — even if the team has 8 people total.

**Behaviour when a Tier-2 slice has fewer than 5 responses:**
- Do NOT show any verbatim quotes from that slice.
- Show only an Otis-generated summary that describes patterns without reproducing individual wording (paraphrase, don't quote).
- The summary must not reconstruct an identifiable quote through detailed paraphrase — genuinely aggregate.

## A.3 Unanimous opt-in gate for verbatim (Tier 2)

Even when a Tier-2 slice has n ≥ 5, verbatim quotes may be shown **only if 100% of the responding members in that slice opted in** to sharing their exact words.

- The gate is **unanimous among respondents in that slice**, not majority. One member who did not opt in means the entire slice is shown as summary only (no verbatim from anyone in that slice) — because revealing everyone else's verbatim makes the one non-opted-in person's response inferable by elimination.
- Opt-in status comes from the existing `share_verbatim_with_team` consent (collected in Phase 1 and adjustable, and the Phase 3 consent segments). If the existing consent data isn't granular enough per-slice, use the most specific consent available and treat any ambiguity as "not opted in" (fail safe toward privacy).
- Names are never shown regardless (the product already never displays names); this gate is strictly about *verbatim wording*, not identity labels.

## A.4 Never combine location with verbatim in the same view

Do not display geographic/location data on the same page or linked view as verbatim quotes. Location + a distinctive quote is a strong re-identifier even without an ID. Either:
- keep the geographic network on its own view, separate from any free-text content, or
- if they must coexist, show location only in aggregate (e.g. "members span 2 time zones") rather than per-member pins alongside quotes.

## A.5 Summary of A, as a table

| Content type | Tier | IDs | Verbatim allowed? | Min-n? |
|---|---|---|---|---|
| Behaviour board (always/sometimes/never) | 1 | Removed | Yes, always (unattributed) | No |
| Stories / situations | 2 | Removed | Only if n≥5 AND unanimous opt-in; else summary | Yes (n=5) |
| Pulse-check comments | 2 | Removed | Only if n≥5 AND unanimous opt-in; else summary | Yes (n=5) |
| Impact statements | 2 | Removed | Only if n≥5 AND unanimous opt-in; else summary | Yes (n=5) |
| Aggregate counts / convergence numbers | — | N/A | N/A (not free-text) | Shown |
| Location / geographic | — | N/A | Never on same view as verbatim (A.4) | — |

---

# WORKSTREAM B — Backend: separate identity from responses

*Do this as its own pass, AFTER Workstream A, and NOT concurrently with any other database-touching work (e.g. the dashboard rebuild). It's a schema change and needs isolation. Build it as two increments: a dry-run against a copy first, then the real migration, so the pilot's existing data is never at risk.*

## B.0 The goal in plain terms

Right now, email/identity and response data can be reached together, and RLS (row-level security) is disabled, so anyone with database access can query identity linked to responses. Two constraints must both be satisfied:
1. **Anna (admin) must retain the ability to link a person to their session** — for password/tech support. This capability cannot be fully removed.
2. **Everyone else — the app's normal operations, any future developer or collaborator — must NOT see that link by default.**

This is the standard "separation of identity from response data" pattern used in research and health-data platforms.

## B.1 Split the schema

- **Identity table** (e.g. `participants`): holds email, name, session/member ID, and any human-identifying fields.
- **Response tables** (existing response/story/behaviour/pulse tables): keyed only by an internal member/session ID. **No email, no name columns.**
- Connecting a response back to a human requires an explicit join across both tables — which can then be access-restricted.
- **The single highest-value change:** ensure email/name lives in NO table that also contains response content on the same row. If any currently do, that's the first migration.

## B.2 Enable RLS with a minimal policy set

RLS is currently disabled on all tables. Turn it on with these policies (default deny — nobody sees anything unless a policy allows it):
- A participant can read/write only their own responses.
- The identity table (`participants`) is readable only by the admin role.
- The consultant dashboard reads only from an aggregated/pseudonymized view that never touches the identity table.

**Note on prior RLS trouble:** this project previously disabled RLS repeatedly because new tables kept hitting "new row violates row-level security policy" errors during inserts. Those errors happened because RLS was enabled with no matching INSERT policy. This time, enable RLS *with* correct policies (including INSERT/UPDATE policies for the app's service role where it legitimately needs to write), rather than the previous pattern of disabling it wholesale. Test every write path after enabling.

## B.3 Two (or three) roles

- **Admin role (Anna):** can see everything, for support.
- **Service role (the app):** normal operations, but cannot query the identity table directly.
- **(Future) developer role:** scoped tighter, or works against a schema copy with fake data.

## B.4 Audit logging on identity lookups

Every time the identity↔response link is used (someone looks up who a session belongs to), write an audit log entry. This converts "I could look but I don't" into "I can look, and there's a record when I do" — which is what GDPR-style pseudonymization actually requires. Anna can review the log.

## B.5 Sequencing within B

1. **Increment 1:** dry-run the schema split against a copy of the database; confirm nothing breaks, confirm the join still works for admin, confirm the app still reads/writes through the service role.
2. **Increment 2:** run the real migration on production, preserving the pilot's existing data.
3. Then RLS policies (B.2), then roles (B.3), then audit logging (B.4).

---

# Overall sequencing (both workstreams)

1. **Workstream A** first — it's the urgent pilot-facing exposure and it's display-only (lower risk to build).
2. **Workstream B** second, as its own isolated database pass, two increments, not concurrent with the dashboard rebuild or any other DB work.

Please produce a plan for Workstream A before building it, and a separate plan for Workstream B before building that. Flag any conflict with existing consent-data structure (A.3 depends on the existing `share_verbatim_with_team` consent — if it's not granular enough, tell me before proceeding rather than guessing).
