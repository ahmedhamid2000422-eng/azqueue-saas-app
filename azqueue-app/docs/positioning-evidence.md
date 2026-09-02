# Positioning evidence

Real findings from building AzQueue against a live business, kept because
they're the raw material for marketing that isn't feature-list marketing.

Everything here is measured from Az Tax Services (Aurora, CO — tax and
immigration, ~9,300 clients, 17,752 recorded visits). Nothing is illustrative.

---

## The finding that reframes the category

**The office had roughly twice the capacity it needed and still had
90-minute waits.**

- queue pressure ρ = 0.38 — arrivals ÷ capacity across the full day
- average wait 94.6 minutes, median 61.8 — **provenance unresolved, see below**
- ~40% of people left without being seen
- 62% of all visits arrive between 10am and 3pm; 6% after 5pm
- busiest hour 11am; by 4pm it drops to 61% of peak

Read together these say something specific: **this is not a staffing problem,
it is a distribution problem.** Every competitor sells the ability to measure
a queue. Measuring told this owner his waits were long, which he knew. What
he didn't know was that his own capacity was already sufficient and the fix
was to move arrivals, not add people.

That is the difference between analytics and an answer, and it's a positioning
line nobody can copy without doing the same work.

**Caveat added 2 September.** The wait figures above sit uneasily with the
section below stating the Qminder export contained no per-visit records. If
there were no wait times in the export, these cannot have come from it. Trace
the source before using either number publicly — the arrival-shape findings
(62% between 10am and 3pm, ρ = 0.38) are computed from arrival counts and are
unaffected either way.

## What was actually wrong with the software (ours)

Worth keeping because it's the honest version of "why we built it this way",
and because every one of these is probably present in competitors too.

**1. Insights were computed in UTC.** "Today" began at 6pm the previous
evening for a Colorado business. Every daily figure had been wrong since
launch — the completed count read 3 when the true number was 18.

**2. Alert thresholds were fixed numbers.** "Wait times are elevated" fired
above 15 minutes. At an office whose normal wait is an hour, that alert had
been lit permanently since day one. An always-on alert is wallpaper: it
teaches staff to ignore the panel, including the alerts that matter.

**3. A panel claimed a data source it didn't have.** A break-pattern heatmap
captioned "built from your real status-change history", rendering a grid from
a table with zero rows.

**4. Client data was in a file served to the open internet.** 9,308 names and
phone numbers, downloadable by anyone who guessed the URL, because it had
been committed to `public/` as a convenient way to load a demo.

**5. Wait estimates used the mean.** Mean 94.6 vs median 61.8 — a 33-minute
gap caused by a few very long files. The number shown was higher than nearly
anyone actually experienced.

**6. The last customer of every day was never completed.** Completion was a
side effect of calling the next person, so whoever was being served at
closing time was recorded as a visit lasting overnight.

## The position this argues for

Not "better analytics". Something closer to:

> Most queue software shows you every number it can calculate. AzQueue
> refuses to show numbers it can't stand behind — and tells you which lever
> actually moves your wait.

Two concrete commitments underneath it, both already enforced in code:

- **Silence over guessing.** Every derived figure has a minimum sample and
  disappears below it. No caveated numbers, no greyed-out placeholders.
- **Thresholds from your business, not the industry.** What counts as a long
  wait is measured from your own history, because 15 minutes is a crisis at a
  coffee counter and a normal Tuesday at a tax office.

See `docs/data-principles.md` for the full set.

## Az Tax switched FROM Qminder

Not a hypothetical competitor — a churn that already happened, and the
migration file is the evidence.

**What the Qminder export contained** (17,752 visits, 9,308 clients, Nov 2024
– Apr 2026):

- per client: name, phone, visit count, first visit, last visit
- aggregates: arrivals per hour, per weekday, per month

**What it did not contain:** any per-visit record. No wait times, no service
durations, no start or end per visit.

So after two years and seventeen thousand visits, that data could not answer
either of the two questions the business most needs — *how long do people
wait* and *how long does a tax return actually take*. Az Tax's visit-length
column is empty for everything before the switch because the data doesn't
exist to import.

**Caveat worth keeping honest:** an export is not necessarily everything a
product stores. Qminder may compute wait times internally and simply not
export them. But for the owner the effect is the same — the numbers don't
leave with you.

The usable line, specific and checkable rather than "their analytics are bad":

> We imported 17,752 visits from Qminder. The export had visit counts and
> dates — no wait times, no service durations. Two years of history that
> couldn't answer how long anyone waited.

**Do not claim a wait-time improvement yet.** It is tempting, and it would be
unsupported. As of 2 September none of the levers that could shorten a queue
are running: nobody has ever used the booking page, the quiet-hour nudge has
never had a slot to offer, and drop-off began recording the day before. There
is no mechanism by which a wait could have fallen, so any figure showing one
would be measurement noise or an artefact — and this is exactly the claim a
prospect would ask us to explain.

See `baseline-2026-09.md` for what is measured today. The comparison becomes
available roughly a month after one lever goes live, and it will be worth far
more then because it will survive being questioned.

**The claim that IS true today**, and is stronger than a queue-length number
because it is about the product rather than one customer:

> In a single week of looking properly we found five figures that had been
> wrong since launch: daily counts computed in the wrong timezone, alerts
> firing on fixed thresholds that were permanently lit, a booking rate
> filtering on a value the app never writes, service times inflated by a
> nightly cron job, and an abandonment rate that counted our own housekeeping
> as customers walking out. Every one is fixed, and every fix is in a
> migration you can read.

Most queue software has the same class of error and no way to notice. That is
a defensible difference, and unlike a wait-time claim it cannot be contested —
the migrations are the evidence.

## Price is a segment boundary, not a discount

Checked August 2026: Qminder Basic **$429/month**, Business $869, Premium
$1,149. Texting extra. iPad/Apple TV hardware.

AzQueue Starter is $29.

This is not undercutting — it's a different market. At $429/month a
single-location tax office is not a customer Qminder is trying to win; that
pricing is built for multi-location enterprises with procurement budgets. Az
Tax could not have afforded it.

The structural point: **Qminder cannot drop to $29 without breaking its own
model.** So the gap isn't a price war, it's an unserved segment — small
businesses with real queue problems and no enterprise budget. Our TV runs in
a browser rather than requiring Apple hardware, which compounds the same
difference.

## Against Qminder / Waitwhile / QLess

Checked August 2026: all three offer wait-time and service-duration
analytics; Waitwhile is noted for forecasting. No evidence found of
cross-business benchmarking in any of them — though that was drawn from
marketing pages, which is weak evidence. **Worth verifying with a trial
account before making any comparative claim in public.**

The honest differentiators, in order of how defensible they are:

1. **Restraint** — showing nothing rather than a number you can't support.
   Uncommon because empty screens look like broken software. Hard to copy
   because it requires deciding against a default everyone else follows.
2. **The distribution insight** — telling an owner their problem is *when*
   people arrive, not *how many* staff they have. Requires the analysis, not
   just the dashboard.
3. **Prayer-aware scheduling** — genuinely absent from the majors.
4. **Cross-business benchmarks** — not novel as a mechanism (common in HR
   and restaurant software), possibly novel in this category, unverified.

## Open questions worth answering with data later

- Does the check-in nudge actually move afternoon arrivals? Measure the share
  of check-ins after 4pm before and after.
- What share of visits end in "needs documents"? If it's high, telling people
  what to bring in advance is a bigger lever than anything in the queue.
- Does the back queue reduce front-queue waits, and by how much?
- Do the confidence gates frustrate new customers, or do they read as
  trustworthy? This is the biggest open risk in the whole position.
