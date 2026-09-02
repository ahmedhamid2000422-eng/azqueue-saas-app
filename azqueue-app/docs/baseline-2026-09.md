# Baseline — 2 September 2026

Frozen the day the data became trustworthy. Everything before this is mixed
with test check-ins and with a cron job that wrote `completed_at` on tickets
nobody completed, so no earlier AzQueue figure should be quoted.

The point of writing these down is that a "before" number invented after the
fact is worthless. These are measured, dated, and caveated, so that any later
claim of improvement can be checked rather than believed.

---

## Read day by day, not pooled

Pooling every ticket gives a median of 62.1 minutes. That number is wrong,
and the way it is wrong matters more than the number.

| Day | n | Median wait | Worst | Usable? |
|-----|---|-------------|-------|---------|
| 1 Aug  | 8  | 27.4  | 49.3  | yes |
| 16 Aug | 1  | 87.8  | 87.8  | too few |
| 17 Aug | 12 | 18.1  | 62.1  | yes |
| 18 Aug | 16 | 209.1 | 322.8 | no — batch entry |
| 19 Aug | 17 | 47.4  | 103.7 | yes |
| 24 Aug | 13 | 113.4 | 344.3 | no — batch entry |
| 25 Aug | 2  | 0.6   | 1.0   | too few, likely tests |
| 31 Aug | 26 | 87.8  | 352.2 | mixed |
| 1 Sep  | 12 | 41.3  | 127.5 | yes |

**On days the system was used live, the median wait is 18–47 minutes**,
centring near half an hour.

**On batch days it is 90–210 minutes**, because tickets were called in two or
three bursts hours after people arrived. Working backwards from 18 August,
nine customers were "called" within minutes of each other at 16:15 and again
at 17:15. Those people were almost certainly served normally at the time —
only the timestamps are late.

So the honest baseline is **a median of roughly 30 minutes on days the queue
is worked live**, from four days and about 49 visits. Too thin to publish,
enough to plan against.

## The tail is not what it looked like

p90 across all data is 201 minutes and the worst is 352. Both come almost
entirely from batch days. There is no evidence yet of customers being
forgotten for hours — which means the p90 alert this document originally
proposed should NOT be built until there are enough clean days to set a
threshold from.

## The variance is the finding

18.1 minutes on one day, 47.4 on another. Both clean, both ordinary. That is a
2.6x swing with no obvious cause, and it is more interesting than any average:
something makes a good day good, and nobody currently knows what. More clean
days will answer it. More volume will not.

## A provenance problem to resolve

`positioning-evidence.md` states the Qminder export contained *"no per-visit
record. No wait times, no service durations."* It also states mean 94.6 and
median 61.8.

Both cannot be true. If the export had no wait times, those figures came from
somewhere else — a Qminder report, or AzQueue-era data misattributed.

Worth tracing before any of it is used in marketing. It is the same failure as
the break-pattern heatmap: a stated source that may not hold. If the "before"
figure turns out to be AzQueue-era, then the honest before-number is 62.1
measured today, and the doc needs correcting.

## What would make a real comparison

Change one thing at a time and measure the median before and after:

- **Booking link in the check-in email** — live now. Watch measure 4.
- **Drop-off used routinely** — watch measure 6, then whether 1 falls.
- **Slots opened after 4pm only** — watch the share of arrivals after 4pm.

One lever at a time, because two at once means never knowing which worked.

## The alert this baseline enables

p90 is 201 minutes. Someone crossing that has been forgotten, not queued —
and it happens to roughly one customer in ten. An alert at the branch's own
p90 catches exactly those cases without firing on a normal busy hour, which is
the threshold rule from `data-principles.md` applied to the number that
actually costs the business customers.
