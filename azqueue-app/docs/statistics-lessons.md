# Statistics, taught by AzQueue's own data

Every number here is measured from Az Tax Services between 1 August and
4 September 2026. Nothing is invented for illustration. That matters,
because the interesting part of this dataset is not what it shows — it is
the number of times it fooled us first.

---

## 1. Mean vs median, and why skew decides

Wait times are **right-skewed**: they cannot go below zero, but one
forgotten customer can sit for six hours. A single extreme value drags the
mean; the median barely moves.

From the 18 August data: median 209.1 minutes, worst 322.8. If you averaged
that day you would get a number no individual customer experienced.

**Rule:** for anything bounded at zero with a long tail — wait times,
service durations, income, response times — report the median. Report the
mean only when you also report the skew, or you are describing a
distribution nobody lives in.

---

## 2. The pooling trap

Pool every ticket in the dataset and the median wait is **62.1 minutes**.

Split by day:

| Day | n | Median wait |
|-----|---|-------------|
| 1 Aug | 8 | 27.4 |
| 17 Aug | 12 | 18.1 |
| 19 Aug | 17 | 47.4 |
| 1 Sep | 12 | 41.3 |

Four clean days, none of them near 62. The pooled figure is not a summary
of these days — it is an artefact of mixing them with days where the data
was recorded differently.

**Rule:** before pooling, check that the groups are measuring the same
thing. A pooled statistic across incomparable groups can sit outside the
range of every group in it. (This is the same family of error as Simpson's
paradox, where a trend reverses when groups are combined.)

---

## 3. Measurement error beats sample size

18 August reads: median 209.1 minutes, worst 322.8. Alarming, until you
look at *when* tickets were called — nine customers "called" within minutes
of each other at 16:15, and again at 17:15.

Those people were almost certainly served normally throughout the day.
Someone entered the tickets in two batches at the end of the day. The
customers' experience was fine; the *timestamps* were late.

Collecting more data on days like this makes the error bigger, not smaller.

**Rule:** a bias in how data is recorded does not average out with volume.
Fix the instrument before you trust the reading.

---

## 4. Contaminated samples

The owner tests the live system using real-looking names and phone numbers.
Those rows sat in the same table every statistic read from.

One consequence: an analysis concluded that the last hour of the day was
being abandoned — six people arriving at 3pm, none called. It was a test
session. The finding was entirely an artefact.

The fix was a boolean (`is_test`) set at check-in, and every analytical
query filtering on it. Not a cleverer model — a cleaner sample.

**Rule:** if you cannot distinguish test data from real data, you do not
have a dataset, you have a mixture of unknown proportion.

---

## 5. Tails need clean data before they mean anything

p90 across the whole dataset is **201 minutes**; the worst case is **352**.

Both come almost entirely from the batch-entry days. Once those are set
aside, there is no evidence of anyone being forgotten for hours.

An alert was proposed to fire when a wait exceeded the p90. It was
cancelled — a threshold set from corrupted data would have fired constantly
on ordinary days.

**Rule:** percentiles are more sensitive to bad data than the median,
because they *are* the extreme values. Never set a threshold from a
distribution you have not audited.

---

## 6. Variance is a finding, not noise

Two clean, ordinary days: **18.1 minutes** and **47.4 minutes**. A 2.6x
swing with no known cause.

The instinct is to average them into "about 30 minutes." But the spread is
the more useful observation: something makes a good day good, and nobody
knows what. Staffing? Case mix? Arrival pattern?

**Rule:** when you report a central value, report the spread with it. A
median with no dispersion measure hides the question worth asking.

---

## 7. Sample size, honestly

Four usable days. Roughly **49 visits**.

That is enough to plan against — you would not schedule staff assuming a
5-minute median when it is 30. It is not enough to publish, claim
improvement, or model. With n≈49 across four days, a confidence interval
around any estimate would be wide enough to include most reasonable values.

**Rule:** state n every time you state a statistic. A number without its
sample size is a claim, not a measurement.

---

## 8. Confounders hide in the calendar

For most of this project, one figure looked bad: a Friday with a single
check-in all day.

Then the owner mentioned that Friday is a short day — the office closes for
around three hours and handles quick walk-ins. One ticket on a Friday and
one ticket on a Tuesday are not the same observation.

Nothing in the database contained this. It came from asking.

**Rule:** the variable that explains your result is often not in your
dataset. Before concluding, ask someone who knows the process.

---

## 9. The base-rate question

A useful habit when a number surprises you: *what would I have expected,
and from what?*

Nobody at Az Tax Services had a pre-AzQueue wait-time figure that could be
verified — one source claimed a median of 61.8 minutes while also stating
the export contained no per-visit records. Both cannot be true.

Without a trustworthy "before", no "after" can demonstrate improvement,
regardless of how good the after looks.

**Rule:** an improvement claim needs a baseline with known provenance.
"Better than before" is unfalsifiable if nobody measured before.

---

## 10. Post-hoc narrative is the most common error here

Across this project, five separate confident conclusions were retracted:
the 3pm cliff, the p90 tail, a "no bookable slots" finding, and two
readings of query results that had silently matched nothing.

Each was a plausible story fitted to data that did not support it. Each
felt like insight at the time.

**Rule:** a finding you cannot state a disconfirming test for is a story,
not a result. Before believing a pattern, write down what would prove it
wrong — then go and check that.

---

## What to do with this

The single most valuable habit in this list is **#3 and #4 together**: fix
the instrument, clean the sample. No amount of statistical sophistication
recovers a corrupted measurement, and almost every wrong conclusion in this
project traced back to data quality rather than to the analysis.

The dataset gets genuinely usable once there are ten or more consecutive
clean days — every ticket completed by a person, no batch entry, test rows
excluded. That is the point at which the questions in #6 and #8 become
answerable.
