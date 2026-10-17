# Baseline — 17 October 2026

Supersedes `baseline-2026-09.md`, which described four usable days and about
49 visits. That document is not wrong; it is out of date, and it was measuring
a quieter and much less instrumented business. Keep it for the history of what
went wrong, cite this for anything current.

Everything below is measured against Az Tax Services
(`1238a46d-f101-415e-8b07-8cf99eaefb2a`), `is_test = false`, America/Denver,
over the 21–30 days to 17 October 2026. Queries in
`docs/analysis-october-2026.sql`.

---

## The headline

**Arrival data is now trustworthy. Duration data is not.**

That split matters more than any individual number. `created_at` is written
when a customer types their details at the kiosk, so it records a real event.
Everything else — `called_at`, `started_at`, `completed_at` — is written when
a staff member taps a button, and the evidence says those taps do not happen
at the moments they describe.

Plan staffing from this document. Do not quote a wait time or a service time
from it.

---

## What is solid

### Volume

Roughly 166 arrivals over 16 trading days; 272 completed tickets across the
nine weeks to 17 October. The September baseline's "49 visits" was never the
business's volume — it was the subset that survived a quality filter.

### Monday is a different kind of day

| Day | Arrivals/day | Days observed |
|-----|--------------|---------------|
| Mon | **24.0** | 4 |
| Tue | 10.3 | 4 |
| Thu | 9.2 | 5 |
| Wed | 8.5 | 4 |
| Fri | 1.0 | 2 |
| Sat | 1.5 | 2 |
| Sun | 1.0 | 1 |

Monday carries 2.3–2.8× any other working day. Tuesday to Thursday are
strikingly flat. The week is really "Monday, then three identical days".

n = 4 Mondays. Enough to plan against, not enough to be certain, and tax
season will reshape it.

### Mornings are the peak, every day

Arrivals per day by hour:

| Hour | Monday | Tue–Thu |
|------|--------|---------|
| 9  | 3.8 | 1.8 |
| 10 | **6.5** | **2.5** |
| 11 | 3.3 | 1.7 |
| 12 | 4.0 | 0.9 |
| 13 | 1.5 | 1.2 |
| 14 | 0.8 | 0.8 |
| 15 | 2.3 | 0.4 |

Both curves peak at 10:00. Monday is the same shape, roughly 2.5× taller.
Tuesday–Thursday is proportionally *more* front-loaded (64% before noon
against Monday's 56%); Monday spreads further into the afternoon.

**A first correction to note:** the combined hourly curve looked like a
Monday artefact because Mondays are 43% of arrivals. Splitting it showed the
morning peak is structural across the week. The conclusion changed from "add
someone at 10am" to "the 9–11 pressure is every day, and Monday needs the
most hands".

### Friday is effectively closed

Two arrivals across two Fridays. The working notes call it a short day; the
data calls it empty. If staff are present, that is idle capacity one day a
week while Monday overflows.

---

## What is NOT solid, and why

### Service time cannot currently be measured

After fixing the forged completions (below), real medians came back as:
Consultation 1.5 min (n=31), Document Review 0.7 (n=11), Follow-up 1.0 (n=7),
Immigration 8.7 (n=12), Tax Preparation 9.9 (n=10) — with p90s of 13–21
minutes.

A 1.5-minute consultation is not a consultation. More than half of visits are
closed within a minute or two of being called, with a genuine tail behind it.

The most plausible reading: **staff serve the customer first and tap Call and
Done together afterwards**, to keep the list tidy. The timestamps record when
someone tapped, not when anyone was served.

This also explains **staff attribution of 0–8%, and 0% in the most recent two
weeks** (9 of 272 tickets). Someone tapping through a list never thinks to set
"Served by". A fix making the picker always visible was written on 5 September
and is, as of this writing, still undeployed — the 0% is evidence it never
shipped.

### Total visit time is an upper bound, not a measurement

Medians of 53–142 minutes per day (only 5 of ~16 days clear n≥5). Consistent
with a busy Monday; equally consistent with tickets closed an hour after the
customer left. **We cannot distinguish the two, so neither should be quoted.**

### Completion rate is unexplained

163 arrivals, 91 completions in the same 21 days. The remaining 72 are swept,
cancelled, no-show, or still open. Worth understanding before any rate is
built on top of it.

---

## Two bugs found and fixed on 17 October

### The turn timeout forged completions — migration 0065

`expire_called_tickets()` cancelled a called ticket after 30 minutes and wrote
`completed_at = now()` without setting `expired_at`.

So a ticket nobody served acquired a completion timestamp exactly 30 minutes
after it started, and every query that excluded swept tickets the documented
way let it through. The duration distribution was bimodal — 38 visits under
5 minutes, a thin middle, 32 piled into 30–35 minutes and **nothing beyond
35**. Immigration read median 30.3 / p90 30.9, which is a ceiling, not a
distribution.

Same mistake 0056 fixed for the nightly sweep; the per-minute timeout was
never fixed alongside it. Now sets `expired_at`, leaves `completed_at` alone,
and marks `no_show` rather than `cancelled`.

**32 of ~163 arrivals in 30 days were called and never served.** That is a
real operational signal that was hidden inside a data bug. Roughly one in
five. Whether that is staff not pressing Done, or customers not coming
forward when called, is unknown and worth asking.

### The daily email counted the nightly sweep as abandonment

Abandonment was `cancelled + no_show` with no `expired_at` exclusion, and no
`is_test` filter. `expire_stale_tickets()` closes every unfinished ticket each
night using exactly those statuses — so every ticket left open at closing time
was reported as a customer who gave up. The rate sat permanently high and
never moved, which is why the email stopped being believed.

The prompt also instructed the model that a high abandonment rate "usually
wins" when choosing what to lead with, so even a correct number would have
produced the same email every day.

---

## The one thing that would change everything

**Call pressed when the customer sits down. Done pressed when they leave.**

Not a feature. Two taps at the right moments. Without them, January to April —
the busiest and most informative season of the year — produces another three
months of data that cannot answer a single question about service time,
staffing or staff performance.

Everything queued behind this assumes those timestamps mean something:
checklist readiness, station timings, the capability routing, the Insights
engine, the callback queue, and any per-staff figure at all.

---

## Rules carried forward, unchanged

- State `n` with every statistic.
- Medians, not means.
- Day by day, never pooled.
- `is_test = false` always.
- `expired_at is not null` means swept — never a completion, never an
  abandonment.
- **New, from 0065:** also filter `status = 'completed'` when measuring
  durations. Excluding `expired_at` alone was not enough, and that gap is
  what hid this bug for a month.
- Branch timezone, never the server's and never Ahmed's.
