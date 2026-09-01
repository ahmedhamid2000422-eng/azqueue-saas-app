# AzQueue data principles

Rules for what AzQueue collects, what it shows, and what it says about it.
Written after a session where three separate features turned out to be making
claims the data couldn't support — the point is to make that harder to repeat.

Each rule exists because something broke.

---

## 1. Collect byproducts freely. Anything that costs someone, only with a use.

**Byproducts of work already happening** — ticket timestamps, which service
was chosen, when someone was called and completed. Nobody does anything
extra, nobody is the subject of it. Collect these even with no use in mind:
they're the raw material for everything later, and they can't be gathered
retroactively.

**Anything that costs effort, or is about a person** — a status someone must
set, a form they must fill, a break pattern, a performance record. These need
a **named use before being built**, and the person described should know.

*Why:* the break-pattern heatmap failed this test. It required staff to
maintain a status nobody had a reason to maintain, it was about them, and
nobody could say what decision it would change. The table had zero rows and
the panel still rendered a grid captioned "built from your real
status-change history".

## 2. Never show a metric nobody will act on.

An unused number isn't neutral. It occupies space, implies importance, and
when it's wrong nobody notices — because nobody was using it.

The test: *what would someone do differently because of this?* If there's no
answer, it doesn't belong on the screen.

## 3. Silence beats a guess.

Every derived figure has a minimum sample, and below it the feature shows
**nothing** — not a caveat, not a greyed-out number. Nothing.

Current floors: wait estimates need 30 completed visits; quiet hours need 200
arrivals; client facts need 30 people; alert baselines need 30 waits;
benchmarks need 20 businesses.

*Why:* a plausible-sounding invented statistic is the single worst thing this
product can produce. An owner acts on it.

## 4. Thresholds come from this business, never from a fixed number.

A 15-minute wait is a crisis at a coffee counter and a normal Tuesday at a
tax office.

*Why:* the Insights alerts used fixed limits, so "wait times are elevated"
had been lit permanently since launch at a branch whose normal wait is an
hour. An alert that is always on is wallpaper — it teaches staff to ignore
the panel, including the alerts that matter.

## 5. Never claim a source you don't have.

If a caption says "measured from your own history", that must be true right
then, for that business, with data that exists. Not aspirational, not true
for some other customer.

## 6. Same numbers, one framing, different scope.

Where staff are measured, they see their own figures in full. Managers see
everyone's and can compare. Nobody is measured by a number they aren't
allowed to see.

*Why:* the tempting design is a soft staff view and a sharp manager view. The
moment staff discover the other screen exists, the softness reads as
deception and the trust cost is permanent.

## 7. Ask, don't infer, anything about a person.

A prompt someone answers is a tool they operate. Deducing the same fact from
their behaviour is monitoring they didn't agree to — and they work it out.

Applies to: availability, breaks, effort, competence. Never infer these
silently, however easy the inference is.

## 8. Tenant data never leaves its own walls — except by choice, in aggregate.

The default is absolute: one business sees only its own data. Row-level
security enforces it, and nothing tenant-scoped ever goes in `public/`.

**Cross-business benchmarks are the single exception**, and only under all of:

- **Opt-in, default off.** Recorded with a date, so the choice can be shown
  back to them.
- **Aggregates only.** Never a figure traceable to one business.
- **Minimum group size of 20.** A benchmark drawn from three offices
  identifies all three, especially in one city where the owner can name every
  competitor. Below the floor it isn't shown at all.
- **Like compared with like.** A tax office against a barber is worse than no
  comparison — the wait that means "struggling" in one is a normal day in the
  other.
- **Revocable**, effective immediately.
- **Reciprocal.** Contributors get benchmarks back. That's what makes it an
  exchange rather than extraction.

### The cold-start carve-out

Reciprocity has one deliberate exception: **a business in its first weeks can
see benchmarks before it has contributed anything.**

Every confidence gate in rule 3 is closed on day one, so a new customer's
first weeks are mostly empty panels saying "not enough history yet". That is
correct, and it is also exactly when they're most likely to give up. A
benchmark is the only thing that can help them, because it doesn't depend on
their data at all.

So: new joiners get benchmarks free for an introductory period, and
contribute once they have something to contribute. Locking them out would
deny the feature to the people it helps most.

---

## Where these are enforced

| Rule | Enforced in |
| --- | --- |
| Sample floors | `waitEstimator.js`, `quietHours.js`, `clientSegments.js`, `Insights.jsx` |
| Per-branch thresholds | `Insights.jsx` `buildAlerts()` |
| No claimed source | `Manager.jsx` (break panel gated on `totalBreaks > 0`) |
| Tenant isolation | RLS on all 37 tables; `ClientIntelligence.jsx` reads via Supabase |
| Benchmark consent | `branches.benchmark_opt_in`, `MIN_BENCHMARK_BRANCHES` |

When adding a feature that shows a number, check it against rules 2, 3 and 5
before writing the query.
