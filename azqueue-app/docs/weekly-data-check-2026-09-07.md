# Weekly data health check — 7 September 2026

**No database figures in this report. The run could not reach the database.**
Everything below is either a code/schema fact verified in the repo, or a
statement about what could not be checked. Nothing is estimated.

---

## Lead: the local `.env` still contains `VITE_TWILIO_*`

`src/lib/notify.js` says at the top that it is dead **only** because
`VITE_TWILIO_*` was deleted from Vercel — `sendSms()` returns early when the
credentials are absent (`notify.js:70`). It is not dead by being unreferenced.
It is still imported by live code:

- `src/hooks/useCheckin.js:4` — `sendCheckinConfirmation`
- `src/hooks/useQueue.js:3` — `sendCalledNotification`, `sendWaitUpdate`
- `src/modes/business/Queue.jsx:18` — `sendWaitUpdate`
- `src/modes/business/Classes.jsx:4` — `sendClassReminder`

The `.env` in the project folder defines all three variables:
`VITE_TWILIO_ACCOUNT_SID`, `VITE_TWILIO_AUTH_TOKEN`, `VITE_TWILIO_PHONE_NUMBER`.

So on this machine the safety catch is off. Any local dev server or any build
produced from this folder would send the five non-compliant message formats to
real numbers on campaign `CM9d4930a3a84ff613446b2ae3155b99af`. The file is
also browser-side, so those credentials land in the public JS bundle of such a
build.

`.env` is gitignored and not tracked, so this has not reached the repo. **What
this check could not verify is whether Vercel production also has these
variables set** — that needs the Vercel dashboard, and confirming it is the
single highest-value thing to do this week. If production is clean, this is a
local-only hazard; if not, it is live.

Two things worth doing, in order: check Vercel's env vars, and remove the
three `VITE_TWILIO_*` lines from the local `.env`. Neither touches deployed
code or the campaign.

## Pause patterns cannot be answered — and not because the week was thin

`branches.queue_paused_at` (migration `0059_pause_and_detail.sql`) is a single
nullable `timestamptz` column. It is overwritten on each pause and cleared on
resume. There is no pause history table anywhere in `supabase/migrations`, and
no other reference to the column outside that migration.

This means the count and duration of pauses is **structurally unrecoverable**,
now and retrospectively — not merely unmeasured this week. No number of future
weeks fixes it without a schema change that records pause start and end as
rows. Flagging it rather than proposing it, since a new table is a migration
and this report is not the place to decide that.

## SMS health and queue quality: not measured

Both need live queries and none ran. Specifically:

- The sandbox has no outbound network — the proxy returns 403 for every host,
  including Supabase.
- The in-app browser was denied navigation, which needs approval this run
  cannot ask for.
- Separately, and independent of the network: `notifications_log` RLS
  (`0016_notifications_log.sql`) only grants `select` to authenticated branch
  staff or the branch owner. The `VITE_SUPABASE_ANON_KEY` in `.env` is
  anonymous, so even with connectivity it would have returned zero rows — and
  a query that silently matches nothing is exactly retraction #10 in
  `statistics-lessons.md`. Any future automated version of this check needs a
  service-role credential held somewhere the run can reach, not the anon key.

I am not going to characterise the week from partial signals. There is no
substitute source in the folder — no exports, no cached figures.

## Is there enough clean data yet?

Unknown, and this run moved that question no further. The bar in
`statistics-lessons.md` is ten or more consecutive clean days — every ticket
completed by a person, no batch entry, `is_test = false`. The baseline was
frozen 2 September; if every day since had been clean, that would be five days
by today, still short of ten. But no day since 2 September has actually been
inspected, here or elsewhere, so even that five is an assumption about the
data rather than an observation of it.

---

### Unrelated inconsistency noticed while reading

`docs/baseline-2026-09.md` contradicts itself on the p90 alert. The section
"The tail is not what it looked like" says the alert "should NOT be built until
there are enough clean days to set a threshold from." The final section, "The
alert this baseline enables," then specifies an alert at p90 = 201 minutes —
the figure the earlier section identifies as coming almost entirely from batch
days. Someone should decide which paragraph survives; as written the document
argues both sides and the last word is the one that contradicts the lesson.
