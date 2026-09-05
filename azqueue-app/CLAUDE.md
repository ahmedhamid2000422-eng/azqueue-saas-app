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

## Data rules

**Only use real data from the business. No invented figures, no
extrapolation, no plausible-sounding numbers to fill a gap.** If the data
cannot answer a question, say so.

This project has retracted five confident conclusions that were stories
fitted to data that did not support them. See `docs/statistics-lessons.md`
for what went wrong each time, and `docs/baseline-2026-09.md` for the
measured baseline.

Practical rules that follow from those mistakes:

- State `n` with every statistic.
- Medians, not means — wait times are right-skewed.
- Report day by day, never pooled. The pooled median (62.1 min) matches no
  individual clean day (18–47 min).
- Always filter `is_test = false`.
- A ticket with `expired_at` set was swept by the nightly job, not served.
  Never count it as a completion.

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
