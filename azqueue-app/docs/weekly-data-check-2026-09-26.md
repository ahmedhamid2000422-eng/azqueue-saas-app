# Weekly data health check — 26 September 2026

**No database figures in this report, for the second week running.** The run
could not reach the database. Everything below is either a code/config fact
verified in the repo this run, or a statement about what could not be checked.
Nothing is estimated.

---

## Lead: the `VITE_TWILIO_*` hazard flagged on 7 September is unchanged

Re-checked this run, both halves still true:

- The local `.env` still defines all three variables — `VITE_TWILIO_ACCOUNT_SID`,
  `VITE_TWILIO_AUTH_TOKEN`, `VITE_TWILIO_PHONE_NUMBER`.
- `src/lib/notify.js` is still imported by live code: `src/hooks/useCheckin.js:4`,
  `src/hooks/useQueue.js:3`, `src/modes/business/Classes.jsx:4`,
  `src/modes/business/Queue.jsx:18`.

`sendSms()` is dead only because the credentials are absent, and on this machine
they are present. So any local dev server or any build produced from this folder
would send the five non-compliant formats to real numbers on campaign
`CM9d4930a3a84ff613446b2ae3155b99af`, and would bake the Twilio credentials into
a public JS bundle. `.env` is gitignored, so this has not reached the repo.

Two weeks ago this report said the single highest-value action was to check
whether Vercel production also has these variables set. That still has not been
confirmed here — it needs the Vercel dashboard. Removing the three lines from
the local `.env` remains a zero-risk change that touches neither deployed code
nor the campaign.

Because the auth token is sitting in a plaintext file that has now been read by
two automated runs, rotating it is worth considering alongside removing it. That
is a Twilio console action, not a campaign edit, so it does not touch the
approved campaign.

## Why no figures — and one thing that changed

Two independent blockers, both hit this run:

- The sandbox shell did not start at all (a Windows mount failure), so no script
  could run and there was no outbound network.
- The in-app browser was denied access to the Supabase host. A scheduled run
  cannot ask for that approval.

**What did change:** last week's report assumed the anon key would be useless
for queue data. Reading the policies this run, that is wrong for tickets.
`0001_init.sql:253` creates `tickets_public_select_own ... for select to anon
using (true)` — the anon role can select every ticket row. So section 2 of this
check (ticket counts, medians, sweep-vs-person completions, batch-entry
detection) **is answerable with the credentials already in `.env`**, and needs
only a network path, not a new secret.

`notifications_log` is the genuine exception: RLS
(`0016_notifications_log.sql`) grants select only to authenticated branch staff
or the owner, so SMS delivery health does need a service-role credential held
somewhere a scheduled run can reach. Correcting last week's blanket statement
matters, because it makes the two sections have different fixes rather than one.

## Pause patterns: still structurally unanswerable

Unchanged and worth restating so it is not re-investigated each week.
`branches.queue_paused_at` (`0059_pause_and_detail.sql`) is a single nullable
`timestamptz`, overwritten on each pause and cleared on resume. No pause history
table exists in `supabase/migrations`. Pause count and duration are
unrecoverable retrospectively, not merely unmeasured — no number of future weeks
fixes it without a schema change that records pause start and end as rows.
Flagging, not proposing; a new table is a migration.

## Is there enough clean data yet?

Still unknown, and this run again moved it no further. The bar in
`statistics-lessons.md` is ten or more consecutive clean days. The baseline was
frozen 2 September; if every day since had been clean that would be 24 days by
today, comfortably past the bar — but **not one of those days has been
inspected**, here or anywhere else in the folder. Clean days are the bar, not
elapsed days, and batch entry is exactly the failure that elapsed time does not
reveal. Treating 24 days of silence as 24 clean days would be retraction #10 in
the lessons doc, committed by a report whose job is to prevent it.

The honest status: the dataset may well have crossed the threshold that makes
the variance question in baseline #6 answerable, and nobody can tell yet. One
successful query run would settle it.

---

### Still open from 7 September

`docs/baseline-2026-09.md` contradicts itself on the p90 alert — "The tail is
not what it looked like" says it should not be built; "The alert this baseline
enables" then specifies it at p90 = 201 minutes, the figure the earlier section
attributes to batch days. Unresolved a week later. As written the document
argues both sides and the last word contradicts the lesson.
