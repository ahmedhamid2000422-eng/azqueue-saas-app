# Weekly data health check — 29 September 2026

**No database figures for the third week running.** The shell worked this time,
but the sandbox proxy refused the Supabase host (`403 blocked-by-allowlist`).
I did not try to get around that. Everything below was checked in the repo this
run. Nothing is estimated.

---

## Lead 1: the `VITE_TWILIO_*` hazard is still there (third week)

Re-checked this run:

- The local `.env` still defines `VITE_TWILIO_ACCOUNT_SID`, `VITE_TWILIO_AUTH_TOKEN`
  and `VITE_TWILIO_PHONE_NUMBER`.
- `src/lib/notify.js` is still imported by `useCheckin.js:4`, `useQueue.js:3`,
  `Classes.jsx:4` and `Queue.jsx:18`. `sendSms()` only returns early if the
  credentials are missing (`notify.js:67`).

Nothing has changed. A build or dev server started from this folder would send
the non-compliant formats, and the token would end up in the public bundle.
Deleting those three lines from the local `.env` is still safe: it touches no
deployed code and not the campaign. We still haven't confirmed whether Vercel
production has these variables, and this run had no way to check.

## Lead 2: last week's report was wrong about the anon key

The 26 September report said the anon key in `.env` could read every ticket,
because of `tickets_public_select_own ... using (true)` in `0001_init.sql`. That
is out of date. **`0060_fix_public_pii_exposure.sql:81` drops that policy.** It
replaces it with a lookup that needs the exact ticket id, so nobody can page
through the table. If 0060 is applied in production (its purpose suggests it is),
the anon key cannot answer section 2 either.

So sections 1 and 2 need the same fix: a credential that can read branch data
(service role, or an authenticated staff session), plus a network path the
scheduled run is allowed to use. Right now this run has neither.

Last week's report didn't check later migrations before drawing its conclusion,
and this correction exists because of it. It's a small instance of lesson #10.

## 1. SMS delivery health — not measured

Not measured. `notifications_log` is readable only by branch staff or the owner
under RLS, and the host was unreachable anyway.

## 2. Queue data quality — not measured

Not measured. No ticket counts, medians or sweep-vs-person splits for
22–28 September.

## 3. Pause patterns — still impossible with the current schema

Same as before. `branches.queue_paused_at` (`0059`) is a single column that is
overwritten on each pause and cleared on resume. There is no history table
(migrations run up to `0064`, and none adds one). Pause counts and durations
cannot be recovered at all, for any past period. Querying the database will not
change that. Only a schema change would, and that decision belongs to Ahmed, not
to this report.

## Is there enough clean data yet?

**We still don't know.** It is 27 days since the 2 September baseline. The bar
is ten or more consecutive *clean* days, and none of those 27 days has been
inspected. Counting days that passed without checking as clean days is exactly
the mistake the lessons doc warns about. The variance question (baseline #6) and
the Friday question (#8) may already be answerable. One successful query run
would tell us.

**To get real numbers next week,** one of these needs to happen: allow the
Supabase host in the sandbox network settings, or approve the in-app browser for
it ahead of time. Section 1 also needs a read credential the run can use that
does not live in a `VITE_*` variable.

### Still open

`baseline-2026-09.md` still contradicts itself on the p90 alert. Line 47 says
don't build it; the "alert this baseline enables" section (line 82) specifies it
at p90 = 201. That figure comes from the batch days.
