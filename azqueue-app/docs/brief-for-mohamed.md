# Az Tax Services — what the queue system is showing

A short summary for Mohamed. October 2026.

Figures come from AzQueue check-ins — every customer who used the kiosk or
their own phone. All times are Denver time. Each section states its own date
range, because they differ.

Where a "per day" figure appears, it says which denominator it uses: every
calendar day, or only days that had check-ins.

---

## Busy days are not spread evenly

Last 90 days (22 July – 20 October 2026), Denver time. Two columns, because
they answer different questions:

- **Per calendar day** — total check-ins divided by every one of that weekday
  in the period, including days with none. This is the planning number.
- **Per active day** — divided only by days that had at least one check-in.
  Higher, because it ignores the quiet days.

| Day | Check-ins | Calendar days | Days with check-ins | Per calendar day | Per active day |
|---|---|---|---|---|---|
| **Monday** | 205 | 13 | 11 | **15.8** | 18.6 |
| Tuesday | 99 | 13 | 8 | 7.6 | 12.4 |
| Wednesday | 90 | 12 | 8 | 7.5 | 11.3 |
| Thursday | 60 | 13 | 8 | 4.6 | 7.5 |
| Saturday | 25 | 13 | 5 | 1.9 | 5.0 |
| Sunday | 12 | 13 | 4 | 0.9 | 3.0 |
| Friday | 11 | 13 | 5 | 0.8 | 2.2 |

Monday is roughly **twice** any other weekday.

**Two things worth noticing.**

Saturday shows more check-ins than Friday — 25 against 11. If that is real, it
changes how the week looks.

And most weekdays had check-ins on only about half the days in the period —
Tuesday 8 of 13, Thursday 8 of 13. We cannot currently tell whether the office
was closed on those days or whether the system simply was not used. That is
worth knowing before planning staffing.

**Monday over different periods:**

| Period | Mondays | Per active day |
|---|---|---|
| Last 3 weeks | 3 | 31 |
| Last 30 days | 5 | 24 |
| Last 90 days | 11 | 19 |

Recent Mondays are higher than the long-term average. That is either real
growth into the season, or earlier weeks recorded fewer check-ins than
happened — the check-in page had faults in August and September that are now
fixed. The numbers alone cannot separate the two.

---

## Mornings are our busiest arrival period

About half of all check-ins happen between **9am and noon**, and 10am is the
busiest single hour. Monday and the midweek days show a similar pattern, with
Monday carrying more people. After 1pm it is quieter.

---

## February is much busier

From the old Qminder records, counting **clients whose last recorded visit**
fell in each month:

| Month | Clients |
|---|---|
| January 2026 | 428 |
| **February 2026** | **977** |
| March 2026 | 850 |

A caution on reading these: someone who came in February and again in March
is counted only in March. So these are a **lower bound on how many different
people came**, not a count of visits.

For comparison, AzQueue recorded about **166 check-ins in the 21 days to 17
October 2026**.

We cannot turn 977 into a reliable per-day figure — we do not know how many
days the office opened that February, and the number undercounts repeat
visits. What is clear is that February runs **several times busier than
October**, and planning should assume that.

February starts in about **15 weeks**.

---

## Half the tickets have no recorded outcome

Out of 502 tickets in three months:

- **202** were finished on the screen
- **237** were closed automatically — about half by a 30-minute timeout
  after being called, the rest by the overnight cleanup
- **57** were marked as left or did not come
- **6** still open

For those 237, **we simply do not know what happened**. About half have no
"call" recorded — but that only means nothing was logged. It does **not** mean
those customers were not helped.

**Why it matters:** without those taps, the system cannot tell how long a
visit takes or how long anyone waits. Those are the questions worth being
able to answer before February.

---

## Two small habits would fix it

1. **Press "Call" when you bring the customer to the desk.**
2. **Press "Done" when they leave.**

Two taps per customer.

What this gives us is an **estimate** of the time a customer spends being
served, assuming the taps happen promptly. Closing missed tickets later
recovers what happened to someone, but it cannot recover how long it took.

There is also a new **"Still open"** list at the top of the queue screen. If
tickets get missed during the day, it takes about thirty seconds at closing
to say what happened to each one.

---

## One tool that is built but not being used

The system can take someone's documents, send them home, and keep the work in
a back list. When it is finished, they get an email to come and collect.

Recorded use has been very limited — a small number of handoffs in three
months. In February this could be the difference between a full waiting room
and a calm one, though the work still has to be done later: it moves the job
rather than removing it.

---

## Questions that would help most

1. **How long does each kind of visit usually take?** A personal tax return,
   an immigration consultation, a document drop-off, a quick question. Even
   rough numbers would help — the system cannot measure this yet.

2. **Who is available between 9am and 11am, especially on Mondays?** That is
   when almost everyone arrives.

3. **How does a visit usually end?** Does the customer leave finished, or go
   away to bring something back, or leave paperwork with you?

4. **Which kinds of visit could be drop-offs?** Where you could take the
   documents and have them come back later, instead of them waiting.

Nothing here is a criticism of how the office runs. The system was built on
assumptions that may simply be wrong, and the fastest way to fix it is to
hear how the work actually happens.
