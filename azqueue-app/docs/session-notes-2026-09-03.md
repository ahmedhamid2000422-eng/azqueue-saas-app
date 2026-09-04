# Session notes — 3 September 2026

Roughly 5am to midnight Malaysia time. What actually shipped, what's still
open, and the one thing that needs attention before anything else.

## Needs attention right now

**`tickets` table is still readable by anyone, unfiltered.** Migration
`0060_fix_public_pii_exposure.sql` fixed `bookings` and added the
`get_ticket_public` / `get_booking_public` RPCs, but the `drop policy` for
`tickets_public_select_own` didn't take — the table still returns every
customer's name, phone and email to an unauthenticated request with no
filter. Next step: open Supabase → Database → tickets → Policies, list what
actually exists there, and drop the real one by its real name. Don't
re-run `0060` — everything else in it is confirmed working.

## Fixed today

- **Check-in was down.** `branches.queue_paused_at` was read by
  `CustomerCheckIn.jsx` before the column existed — the exact page Twilio
  needed to review for the A2P resubmission. Fixed; confirmed loading with
  the consent checkbox live.
- **Stations couldn't be created.** `stations.staff_id` was missing;
  Stations page showed nothing to configure. Column added.
- **Staff picker in Stations was 400ing** — querying `full_name`, `name`,
  `email` columns that never existed on `staff` (only `display_name` does).
  Fixed; failures also no longer fail silently.
- **12 real tickets from 2 September were stuck in `waiting`** up to 20
  hours old, never called or completed. Cleared, marked `expired_at` (not
  `completed_at`) so no fake service time was written into the history.
- **The nightly sweep (`expire_stale_tickets`) was still corrupting service
  times** — writing `completed_at` on tickets nobody completed. Replaced
  with the version that uses `expired_at` instead, before its next
  scheduled run.
- **Station assignment was split across two incompatible columns.**
  `OwnerDashboard.jsx`, `Display.jsx`, `useStaff.js` and `useDisplay.js` all
  wrote to `stations.preparer_id`, which foreign-keys to `profiles` — a
  table with zero rows for anyone. It had never worked for a single person,
  not just Benyamin, who has no login at all (shared account). All four
  files now use `stations.staff_id`, which references `staff` directly.
- **Manager page was showing a false wellness alert** — "Benyamin needs a
  break" — computed from a fallback (hours since `status_since` last
  changed) rather than any real break event. Same failure shape as the p90
  alert and the "3pm cliff" from earlier this month: a plausible number
  built on too little data. Hidden behind `MANAGER_ENABLED` (off by
  default) until there's real history to compute from.
- **SLA breach/bounce panel** hidden behind `SLA_ENABLED` — a call-centre
  control that didn't belong on a two-person office's Stations page; the
  owner himself couldn't tell what it meant.

## Built today

- **Overview now shows who's actually in line**, not just a count — name,
  status, and their escalation reason or detail note if they have one.
  Click through to `TicketDetail.jsx` for the full picture on one visit:
  timing, service, escalation, who's handling it, contact info. Read-only —
  acting on a ticket still happens on the Queue page.
- **Escalation reasons simplified** to four words — Notarize, Complex case,
  Question, Unknown — matching what Ahmed described his father actually
  needs: a fast handoff, not a legal-category dropdown.
- **Staff capability doc filled in** (`docs/staff-capabilities-template.md`)
  with what's known about Mohamed and Benyamin's coverage — marked as
  secondhand, not yet confirmed with Mohamed directly.
- **Check-in poster** designed and saved as a print-ready PDF
  (`docs/signage/checkin-sign.pdf`) — large type, QR code generated fully
  offline, bold amber banner (a louder version of the existing brand gold,
  not an unrelated color) so it's actually noticed at the front desk.
- **Appointment/no-appointment check-in flow** — mocked up as a clickable
  preview only, not built into the live check-in page yet.

## Found, not yet acted on

- **`get_available_slots` hardcodes 9am–6pm closing**, ignoring
  `branches.hours` — which now says Az Tax closes at 5pm. Only matters once
  the self-serve booking picker is actually relied on instead of manual
  entry, which is where things stand for now.
- **`normalisePhone` in `send-notification`** doesn't infer a country code —
  a bare 10-digit US number becomes `+3035550142`-shaped, read as Greece.
  Matters before SMS actually goes live, not before.
- **3 September's real data: one ticket, all day.** Mohammed Sabor, 10:30am
  Denver, checked in on his own phone — and as of writing, still sitting in
  `waiting`, uncalled, over 13 hours later. Worth a look once the office
  reopens.
- **Monetisation section on Product.jsx** still advertises deposits,
  priority-queue payments and no-show fees — none of which exist anywhere
  in the codebase. Recommended cutting it; not yet done.

## A2P / Twilio

Resubmitted the existing campaign (`CM48e9d650b7c6d5923c6f103962247b1c`)
with the website corrected to azqueue.io and opt-in keywords left blank —
the earlier rejection (30909, Call to Action) most likely came from
declaring a text-to-join path (START/UNSTOP keywords) that doesn't exist,
since consent is a web checkbox only. Support's later read on rejection
causes matched the two problems already being fixed. Outcome pending.

## Roadmap doc received

A 23-point strategy document (data persistence, brand consistency, unproven
marketing claims, loyalty mechanics, multilingual kiosk, workflow stages,
onboarding philosophy, demo business testing, go-to-market sequencing) —
not yet saved as its own file. Worth its own pass with a clear head, not
appended here.
