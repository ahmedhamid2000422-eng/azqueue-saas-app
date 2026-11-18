# Working rules for AzQueue

## Hard constraint — deployment risk

**Anything that could disrupt live queue work or A2P compliance waits for a
safe window. Everything else can ship when ready.**

Set by Ahmed on 4 September 2026, after a day where a schema change took
customer check-in down during office hours.

### What counts as risky

- **Queue page** (`src/modes/business/Queue.jsx`) — this is the screen staff
  use while customers are physically standing there. A broken render or a
  changed button means someone is not being served.
- **Check-in page** (`src/pages/CustomerCheckIn.jsx`) — public, and also the
  page Twilio reviewers open to verify the opt-in. Breaking it breaks both
  the business and the campaign.
- **TV display** (`src/pages/Display.jsx`) — visible in the waiting room.
- **Any migration adding a column the deployed code already reads** — this
  is what took check-in down. Migration first, then deploy; never the
  reverse.
- **Anything touching SMS templates or the A2P campaign** — the campaign is
  approved after four rejections. Do not edit an approved campaign without a
  specific reason and a support answer first.

### The safe window

Az Tax Services is in Aurora, Colorado (America/Denver). Ahmed is in
Malaysia (UTC+8), roughly 14 hours ahead. **Deploy risky changes when Denver
is outside office hours** — which is most of Ahmed's working day, so this is
rarely a real constraint. Check the clock before pushing, not after.

Friday is a short day: the office closes for around three hours and handles
quick walk-ins.

### What is always safe

Docs, migrations that only add nullable columns nothing reads yet, feature
flags defaulting to off, and anything behind a flag that is off.

## What each page is for

Ahmed's division, 5 September. Anything new goes on the page whose question it
answers — not wherever it happens to fit.

- **Overview** (`OwnerDashboard.jsx`) — **what is going on right now.** Present
  tense only. Who is waiting, who is being served, which counters are open.
  Nothing historical, nothing speculative.
- **Insights** (`Insights.jsx`) — **what we could do better.** Patterns worth
  acting on, phrased as something to change. Subject to the data rules below:
  no advice the measured data cannot support.
- **Client Intelligence** (`ClientIntelligence.jsx`) — **past history, customer
  data, and suggestions.** Who has been in before, what they came for, what
  that implies about the next visit.

A number that describes the last thirty days does not belong on Overview. A
live count does not belong on Insights.

## Check-in must be tested as an anonymous visitor

**After any change to RLS, to the check-in code path, or to a public page,
open the check-in page in a private window and complete a check-in.**

Customer check-in has broken in production twice, and both times the first
people to notice were customers standing in the office. Mohamed heard about
it from them, in front of clients. That is worse than either bug.

Both were invisible to anyone signed in:

- **September** — `tickets.source` gained `kiosk` / `own_device` (0054) but
  the anonymous INSERT policy still demanded `source = 'walk'`. Staff
  unaffected, every customer blocked.
- **November** — 0060 removed anonymous SELECT to close a PII leak, and the
  check-in code used `.insert().select()`, whose RETURNING clause needs
  SELECT. The row was written and the read-back refused, so customers were
  told it failed for a ticket that existed.

Testing while authenticated cannot see this class of bug. That is the whole
reason it reached the office twice.

### The health-check function and the app must stay in step

`supabase/functions/health-check` runs every five minutes and checks the
site, the bundle, and an anonymous ticket insert. It protects against this
happening a third time — but only while it mirrors what the app actually
does.

It deliberately inserts **without** a read-back, because `CustomerCheckIn.jsx`
no longer uses one. **If the check-in code ever changes shape — a read-back,
a new column, a new RPC — the health check must change with it.** A monitor
that tests a path the app no longer takes is worse than no monitor, because
it reports green while customers fail.

As written today it would have caught September's outage and NOT November's.

## Data rules

**Only use real data from the business. No invented figures, no
extrapolation, no plausible-sounding numbers to fill a gap.** If the data
cannot answer a question, say so.

This project has retracted five confident conclusions that were stories
fitted to data that did not support them. See `docs/statistics-lessons.md`
for what went wrong each time.

**The current baseline is `docs/baseline-2026-10.md`.** `baseline-2026-09.md`
is kept for history and should not be cited — it describes a quieter, less
instrumented business.

The headline from October: **arrival data is trustworthy, duration data is
not.** `created_at` is written by the customer at the kiosk. `called_at`,
`started_at` and `completed_at` are written when a staff member taps a
button, and those taps do not happen at the moments they describe — median
"service time" for a consultation reads as 1.5 minutes. Plan staffing from
arrivals. Do not quote a wait or service time until Call and Done are being
pressed as things happen.

Practical rules that follow from those mistakes:

- State `n` with every statistic.
- Medians, not means — wait times are right-skewed.
- Report day by day, never pooled. The pooled median (62.1 min) matches no
  individual clean day (18–47 min).
- Always filter `is_test = false`.
- A ticket with `expired_at` set was swept by a cron job, not served.
  Never count it as a completion, and never as an abandonment either.
- **Also filter `status = 'completed'` when measuring durations.** Excluding
  `expired_at` alone is not enough: until migration 0065 the 30-minute turn
  timeout wrote `completed_at` on tickets nobody served while leaving
  `expired_at` null, which forged a month of 30-minute visits. See
  `docs/baseline-2026-10.md`.

## Secrets

Twilio and OpenAI credentials live **only** in Supabase Edge Function
secrets. Never in Vercel `VITE_*` variables — those are baked into the
public JS bundle and readable by anyone.

**Do not re-add `VITE_TWILIO_*`.** `src/lib/notify.js` is dead on purpose;
re-arming it would start sending five message formats that do not match the
approved campaign samples. See `docs/sms-compliance-audit.md`.

## Key facts

- Branch: Az Tax Services, `1238a46d-f101-415e-8b07-8cf99eaefb2a`, slug
  `az-tax-services`
- Staff: Mohamed (owner, senior advisor — notary, divorce, specialised tax),
  Benyamin (associate — general tax, general immigration, consultancy),
  Nuredin. One shared login.
- **Do not reopen the A2P campaign.** Approved after four rejections; editing
  an approved campaign may trigger re-review and nobody has confirmed
  whether it does. SMS templates stay English even though the interface is
  translated — see `docs/sms-compliance-audit.md`.
- A2P campaign `CM9d4930a3a84ff613446b2ae3155b99af`, approved 4 Sept.
  Registered website is `https://www.azqueue.io` — **with www**. A mismatch
  on that string caused repeated rejections.
