# Privacy Verification Checklist
## Otis Pilot — Identity Split (migrations 0020–0022)

Run these checks in the **Supabase SQL editor** (`mthjdglspaazirrswsgz`).  
All checks must pass before Keith's pilot begins.

---

## Step 1 — Confirm identity is separated from responses

### 1a. email does not exist on any response table

```sql
-- These should all return errors: "column email does not exist"
SELECT email FROM public.ps_responses LIMIT 1;
SELECT email FROM public.purpose_responses LIMIT 1;
SELECT email FROM public.ps_interview_responses LIMIT 1;
SELECT email FROM public.member_stories LIMIT 1;
SELECT email FROM public.member_behaviors LIMIT 1;
```

**Expected:** Each query errors with `column "email" does not exist`.  
If any succeeds, the contract migration (0021) did not fully apply — stop and investigate.

---

### 1b. email does not exist on the members table

```sql
SELECT email FROM public.members LIMIT 1;
```

**Expected:** Errors with `column "email" does not exist`.  
This confirms migration 0021 ran successfully.

---

### 1c. email lives only in member_identity

```sql
SELECT member_id, email, display_name FROM public.member_identity LIMIT 5;
```

**Expected:** Returns rows with email addresses.  
Check that the count matches the number of members in your team.

```sql
SELECT count(*) FROM public.member_identity;
SELECT count(*) FROM public.members;
-- Both counts should be equal (one identity row per member).
```

---

## Step 2 — Confirm pseudonymised views are working

### 2a. PS responses view returns participant codes, not emails or UUIDs

```sql
SELECT participant_code, team_id, zone, label, response_value
FROM public.consultant_view_ps_responses
LIMIT 10;
```

**Expected:** Rows where `participant_code` is like `P101`, `P102` — never an email or raw UUID.  
The `member_id` column should be absent entirely.

---

### 2b. Purpose responses view

```sql
SELECT participant_code, purpose_text
FROM public.consultant_view_purpose_responses
LIMIT 5;
```

**Expected:** Rows with codes like `P101`, free-text purpose statements. No email column.

---

### 2c. Behaviours view

```sql
SELECT participant_code, bucket, text
FROM public.consultant_view_behaviors
LIMIT 5;
```

**Expected:** Rows with codes and behaviour text. No email column.

---

### 2d. Stories view

```sql
SELECT participant_code, story_text
FROM public.consultant_view_stories
LIMIT 5;
```

**Expected:** Rows with codes and story text. No email column.

---

## Step 3 — Confirm audit logging works

### 3a. lookup_participant function writes to the audit log

Replace `'<paste-a-real-member-id-uuid-here>'` with any member_id from your team:

```sql
-- First, find a member_id to use:
SELECT member_id, private_code FROM public.members LIMIT 3;

-- Then call the lookup function (substitute the uuid from above):
SELECT * FROM public.lookup_participant(
  '<paste-a-real-member-id-uuid-here>'::uuid,
  'verification check — pre-pilot'
);
```

**Expected:** Returns one row with `member_id`, `team_id`, `email`, `display_name`.

---

### 3b. Confirm the audit log recorded it

```sql
SELECT * FROM public.identity_lookup_log
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** The top row should have:
- `looked_up_by` = `lookup_participant_fn`
- `purpose` = `verification check — pre-pilot`
- `created_at` within the last few seconds

---

### 3c. Confirm existing route lookups are logged

The following routes write to `identity_lookup_log` automatically.  
After a test sign-in (using a member magic link), run:

```sql
SELECT looked_up_by, purpose, created_at
FROM public.identity_lookup_log
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** You should see rows with `looked_up_by` values including:
- `auth_request` — when the magic link was requested
- `auth_verify` — when the link was clicked and the session was set
- `member_me` — when the member's profile page loaded
- `roster_get` — when you viewed the team members list
- `invite_send` — when an invite email was sent

---

## Step 4 — Confirm member_identity is not accessible without service role

This check confirms that the anon key (used by browser clients) cannot read the identity table.

In the SQL editor, temporarily switch to the **anon role** to simulate a browser client:

```sql
SET ROLE anon;
SELECT * FROM public.member_identity LIMIT 1;
RESET ROLE;
```

**Expected:** The `SET ROLE anon` query returns nothing or an error, and the `SELECT` returns zero rows or `permission denied`.  
If it returns email addresses, RLS on `member_identity` is not working — investigate immediately.

---

## Step 5 — Confirm no new members bypass identity split

After adding a test member via the app (consultant adds a new member in `/teams/[team_id]/members`):

```sql
-- The newest member should appear in BOTH tables:
SELECT m.member_id, m.private_code, mi.email, mi.display_name
FROM public.members m
JOIN public.member_identity mi USING (member_id)
ORDER BY m.created_at DESC
LIMIT 3;
```

**Expected:** The new member appears in this join with their email in `member_identity` and a `private_code` on the `members` row. If the join returns nothing for the new member, the POST `/api/teams/[team_id]/members` route is not writing to `member_identity` correctly.

---

## All checks passed?

If every query above returned the expected result:
- Identity is separated from responses ✅
- Pseudonymised views are in place ✅
- Audit log is working ✅
- Browser clients cannot read identity ✅
- New member creation writes to both tables correctly ✅

The system is ready for Keith's pilot.

---

## What to do if something fails

| Failure | Likely cause | Action |
|---------|-------------|--------|
| `SELECT email FROM ps_responses` succeeds | Migration 0021 did not apply | Re-run 0021 in SQL editor |
| Views return no rows | Migrations 0020/0022 not applied | Check migration history |
| Audit log is empty after lookup | `auditLog.ts` not deployed | Check Vercel deployment |
| `member_identity` readable as anon | RLS policy issue | Check that `ALTER TABLE member_identity ENABLE ROW LEVEL SECURITY` ran (migration 0020) |
| New member missing from join | POST route not writing identity | Check server logs for errors in `/api/teams/[team_id]/members` |
