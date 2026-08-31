# Back-office work queue — design spec

> **Revised after the owner's correction.** The first draft had the customer
> waiting while the owner reviewed. That was wrong: the staff are data-entry
> capable, and most work does not need the customer present once their
> documents are taken. Making someone sit in a waiting room while paperwork is
> checked is exactly the waste this is supposed to remove.
>
> The model is now **two queues**:
>
> - **Front queue** — people physically present. Unchanged. Everything
>   currently in AzQueue is this.
> - **Back queue** — work that no longer needs the customer. Sits until
>   somebody qualified is free. The customer has already gone home.
>
> Only work genuinely requiring the customer in the room — notarisation,
> signatures, identity checks — stays in the front queue. Everything else is
> taken, assigned, and finished later.
>
> This attacks the bottleneck twice over: the owner's time stops gating the
> front queue, and the waiting room empties faster because cases leave the
> floor at "documents taken" rather than "work complete".

---

## Original framing (kept for reference)

**Status:** not built. Written ahead of time so it can be built properly in one
session rather than improvised.

**Build it after:** the survey pipeline is verified, the Insights alert
thresholds are fixed, and Twilio is approved. This touches the queue's core
state machine — the one part of AzQueue that has to be right — so it should
not be done tired or in parallel with unfinished work.

---

## The problem

Az Tax's owner is the bottleneck. He does the work *and* he is the only person
who can sign off on it. Every case therefore costs his time twice, and his
capacity is the ceiling on the whole office.

The measured shape of this, from the imported history:

- 62% of visits arrive between 10am and 3pm
- queue pressure across the day is 0.38 — roughly twice the capacity needed
- average wait 94.6 minutes; around 40% leave without being seen

The office is not short of hours. It is short of hours *from one person*.

## The idea

Split preparation from approval. Staff prepare the work; the owner reviews and
approves. Reviewing a finished form takes a fraction of the time doing it does,
so the same person can clear far more cases per day.

This is deliberately **a workflow stage, not a judgement**. Nobody presses a
button that says "I needed help". The information falls out of the work moving
through its natural stages.

## What it captures for free

Because the stage exists, these become measurable without asking anyone to
report on themselves:

- who prepared each case, and who reviewed it
- how long review actually takes, per service
- how often a case is sent back, and for what
- how much of the owner's day is review versus preparation

That last one is the number the whole idea rests on, and today it is a guess.

---

## State machine

Current: `waiting → serving → completed`

New, only for services that require review:

```
waiting → serving → awaiting_review → completed
                          │
                          └── sent_back → serving (same preparer)
```

Rules:

1. **Review is per service, not global.** A simple intake should never enter
   review. Which services require it is a setting, defaulting to none.
2. **`awaiting_review` is not "waiting".** It must never appear in the customer
   queue, the TV display, or the wait estimator. A case in review is not a
   person standing in line, and mixing them corrupts every wait figure the app
   produces.
3. **Send back returns to the same preparer**, with a required note. Sending
   work back without saying why is how this feature becomes resented.
4. **A case can be completed without review** by an owner/admin, for the
   inevitable exception. Record that it bypassed review.

## Data

```sql
-- on tickets
review_required     boolean     not null default false
prepared_by         uuid        references staff(id)
reviewed_by         uuid        references staff(id)
review_started_at   timestamptz
review_done_at      timestamptz
sent_back_count     integer     not null default 0

-- on services
requires_review     boolean     not null default false
```

`sent_back_count` rather than a full history: the count is enough for
"which services come back most", and a full audit trail of corrections is
exactly the kind of record that turns into a stick.

## Screens

**Staff — "With Dad" list.** Their own cases in review, with how long each has
been there. Nothing else. No comparison to other staff, no error rate, no
ranking. If a case comes back, they see the note.

**Owner — review queue.** Oldest first: customer, service, who prepared it,
how long it has been waiting. Two actions: **Approve** and **Send back** with a
note. This should be reachable in one tap from anywhere, because it will be
used in gaps between customers.

**Language.** Staff-facing wording is plain and non-judgemental throughout:
"With Dad for review", "Ready to finish", "Dad added a note". Never "rejected",
"failed", "error rate", "rank".

### On the two-audience question

There is a real temptation to show staff a soft version and the owner a sharp
one. Resist it. If staff discover the owner's screen says something harsher
about them than their own screen does, the softness reads as deception and the
trust cost is permanent.

The rule: **same numbers, one framing, different scope.** A staff member can
see their own send-back rate. The owner sees everyone's, and can compare. Nobody
is measured by a figure they are not allowed to see.

---

## The two risks

**1. Review becomes the new bottleneck.** If the owner does not clear the list,
customers now wait on a stage that did not exist before, and staff are blocked
on him for work they used to just finish. This is strictly worse than today.

Mitigations: start with one or two services only; show the review backlog
prominently on the owner's dashboard; alert when anything has been in review
beyond a threshold.

**2. The customer is standing there.** If review cannot happen while they wait,
they need a clear answer. Three options, and the business must pick one per
service before this ships:

- wait a little longer (fine if review is minutes)
- come back later today
- we will email you when it is approved

Option three is the one that unlocks real capacity, and AzQueue already sends
email, so it is mostly wording.

## Success criteria

Judge it after a month on:

- **owner's preparation time falls** while cases completed stays flat or rises
- **average wait falls** — because his time is freed at the peak
- send-back rate is stable or falling per preparer
- staff still use it, i.e. cases are not being quietly completed around it

If the owner's time doesn't move, the stage is ceremony and should be removed.

---

# Revised design — the back queue

## The flow

Staff finish with the person at the counter and choose one of:

- **Done** — nothing further needed. As today.
- **Assign** — documents taken, work continues without them. Pick a category,
  optionally a person, and the customer leaves.

Categories, kept deliberately coarse because staff will pick them fifty times a
day and a long list gets picked wrong:

- **Drop-off** — documents left, nothing started
- **Immigration** — forms and filings
- **Taxes** — returns and related work
- **Notary** — the exception: needs the customer present, so it stays in the
  front queue and is never assignable

Three or four buckets is right. Resist adding a fifth without evidence.

## What each person sees

**Staff, at the counter.** One extra step when finishing: *Assign → which
category*. Two taps. Optionally "who", defaulting to unassigned. Nothing else
changes about their day.

**Staff, their own list.** "Work you've assigned — 4 open." Enough to answer a
customer who rings asking where their papers are. No metrics, no comparisons.

**Owner.** The back queue, oldest first, grouped by category, with who took it
in and when. He picks work up when he has a gap. Nothing forces him to be
present at the counter for any of it.

## Why this is better than a review stage

- The customer leaves at "documents taken", not "work finished". The waiting
  room empties at the front, which is the actual complaint.
- The owner's time is no longer on the critical path for the person in the
  chair.
- Staff aren't blocked. They take the next customer immediately.
- Same data captured: who took it in, who finished it, how long it sat, which
  category is slowest.

## Data

```sql
-- on tickets
handoff_category   text         -- 'dropoff' | 'immigration' | 'taxes' | null
assigned_to        uuid references staff(id)   -- null = anyone
taken_in_by        uuid references staff(id)
handed_off_at      timestamptz
work_started_at    timestamptz
work_done_at       timestamptz

-- on services
customer_must_be_present  boolean not null default false   -- notary = true
```

A ticket in the back queue must have a distinct status — `in_progress` or
similar — that is excluded from `waiting` everywhere. This is the single most
important implementation rule: the wait estimator, the TV display, the queue
count and every insight must treat back-queue work as *not a person waiting*.
Getting this wrong silently corrupts every wait figure the product reports.

## Telling the customer

Because they leave before the work is done, the handoff must set an
expectation. AzQueue already sends email, so this is mostly wording.

**On assign:**
> We have everything we need — you don't need to wait. We'll email you when
> your forms are ready to pick up.

**On completion:**
> Your forms are ready to pick up at Az Tax Services, Aurora.
> We're open 9:00 AM – 6:00 PM.

Without these this feature makes the customer experience worse, not better.
Not optional.

### Turnaround is per category, not global

Drop-offs are worked on at weekends, so that category is genuinely slower than
immigration or taxes. One global promise would be wrong for at least one
category, and a missed promise is worse than a vaguer one.

```sql
-- on branches, or a small per-category settings table
turnaround_days jsonb  -- {"dropoff": 7, "immigration": 3, "taxes": 2}
```

The assign email states the promise for that category — "usually ready within a
week" for a drop-off, "within two days" for taxes. Whatever the office can
actually keep, not the best case.

## Pickup must not queue behind full appointments

**This is the part most likely to be missed.**

Someone returning to collect an envelope needs thirty seconds. If they take a
normal ticket they sit behind three hour-long tax appointments, and the
back-queue feature has simply moved the bad wait rather than removed it — with
the added insult that they were told to come in.

**Resolved: the office will run a separate pickup spot.**

That's the better answer and it removes the hard part. No priority rules, no
queue-jumping to explain to a waiting room, no argument about whether a pickup
outranks an appointment. Two independent lines that happen to share a building.

AzQueue already has Stations, so this is configuration more than construction:

- a **Pickup** station, with its own short queue
- a **Pickup** service, marked short, that only routes to that station
- the completion email carries a link that checks the customer in for pickup
  directly — they arrive already in the right line
- the TV shows both: the main queue, and pickups, clearly separated

Two consequences worth designing for:

1. **Pickup waits must be reported separately.** A two-minute pickup averaged
   in with hour-long appointments makes the headline wait look better than the
   experience actually is. Every wait figure in Insights and AI Assist should
   exclude pickups, or report them as their own line.

2. **The spot needs to be staffed, or at least glanceable.** A separate line
   nobody watches is worse than one queue — the customer stands somewhere
   nobody is looking. Solved by the kiosk flow below.

## Kiosk: "I'm here for a pickup"

The pickup spot is unstaffed most of the time, so the customer needs a way to
announce themselves, and staff need to actually notice. Standing at an empty
desk hoping to be seen is worse than queueing.

**Customer side — one button on the kiosk.** The existing kiosk gets a second
option alongside joining the queue:

> **Collecting paperwork?**  →  I'm here for a pickup

Tapping it asks for **the email address they gave when they dropped off**. That
address is already on their customer record from that visit, so it identifies
them without anyone having to keep a code — and people lose codes constantly,
whereas they know their own email.

The kiosk looks it up and confirms by name: *"Welcome back, Sara. Someone will
be with you shortly."* No ticket number theatre; they're not entering a queue
with a position, they're ringing a bell.

Phone number works as a second option for anyone who gave one instead.

**Staff side — this must be an interruption, not a list.** A pickup waiting is
different from a queue entry: nobody is watching that desk, so a row appearing
quietly in a table is exactly the failure mode to avoid. It needs:

- a **banner at the top of the Queue page**, visible regardless of which page
  staff are on, showing **who it is and what they're collecting** — because the
  email lookup already identified them:

  > **Pickup waiting** · Sara M. · Immigration forms · dropped off 12 Aug · 2 min

  That's enough for staff to walk to the shelf and pick up the right envelope
  before reaching the desk, which is most of what makes a collection fast.
- a **sound**, the same chime the TV uses
- the wait timer visible and climbing, because the whole point is that nobody
  is standing there watching
- one button: **Collected**, which closes it

**Escalate if ignored.** If a pickup goes unacknowledged for a few minutes,
make it louder — repeat the chime, and after longer, email the owner. An
unstaffed desk with someone standing at it is the single worst outcome this
design can produce, and it should be impossible to miss rather than merely
displayed.

**Fallback.** If the email doesn't match anything ready for collection, the
kiosk says plainly to see the main desk. Never leave someone stuck at a
terminal that can't help them. Two cases worth distinguishing:

- *email matches, but the work isn't finished yet* — say so kindly ("it's still
  being worked on, we'll email you as soon as it's ready") rather than sending
  them to a desk to be told the same thing
- *no match at all* — see the main desk

**Privacy note.** The kiosk should confirm a first name only ("Welcome back,
Sara"), never show what someone is collecting or their full details on a screen
in a public waiting room. Immigration and tax work is sensitive, and a kiosk is
visible to whoever is standing behind them. Full detail belongs on the staff
banner, not the customer-facing screen.

### Why not just use the normal queue for this?

Because a pickup isn't a service, it's a collection. Putting it in the queue
would give it a position and an estimated wait, both of which are meaningless
for handing over an envelope, and would drag the branch's wait statistics
toward the floor. Keeping it separate keeps both sets of numbers honest.

## Success criteria

- **front-queue wait falls** — the point of the whole thing
- owner's counter time falls while cases completed holds or rises
- back-queue items don't age: nothing sitting untouched for days
- customers don't ring asking where their papers are — if they do, the email
  isn't doing its job

## Open questions for the owner

1. Which services can be assigned, and which truly need him present? Notary is
   obvious; is anything else?
2. Should staff be able to assign to a *specific* person, or only to a
   category? Specific assignment is more useful and more political.
3. What turnaround should each category promise? Drop-offs are worked at
   weekends so they're slower; immigration and taxes need their own numbers.
   Whatever goes in the email becomes a commitment.
4. ~~Can pickups be served ahead of appointments?~~ **Answered: separate
   pickup spot.** Remaining sub-question — is it staffed continuously, or does
   the main dashboard need to alert when someone is waiting there?

---

---

# The Complete panel

**Problem it solves.** Today, Call next silently completes whoever was being
served. That means Complete is never a deliberate act, so the last customer of
the day is never completed at all — their visit is recorded as lasting
overnight, which quietly poisons the service-time median that everything else
depends on.

**Change.** Pressing Call next while someone is being served opens the Complete
panel for that person first, then calls the next customer. Finishing becomes
the step, and calling the next person becomes its consequence — which is what
it already means in practice.

## The one question it asks

Deliberately minimal. Staff will answer this dozens of times a day; a long list
gets clicked past without reading, and the data becomes worse than none.

> **How did this end?**
>
> - **Done** — finished, nothing outstanding
> - **Needs documents** — can't proceed until they bring something
> - **Drop-off / waiting** — we keep the paperwork, they go home *(→ back queue,
>   then asks for a category)*
> - **Passed to someone else** — another person is picking it up

Four options, one tap, no free text. **Done** is the default and visually
primary; the day should be one button when nothing unusual happened.

Only "Drop-off / waiting" asks a second question (which category), because
that's the one that changes what happens next. The others just record and move
on.

The label is the owner's wording, and deliberately so: it's what staff already
say to each other about these cases. A label people recognise gets pressed
correctly; an invented one gets guessed at.

## Notes on each

- **Needs documents** — worth capturing separately from Done because a visit
  that ends this way is a visit that has to happen again. If this is a large
  share of visits, telling people what to bring *before* they come is the
  highest-value change the business could make, and right now nothing measures
  it.

  **Which documents, without anyone typing.** The obvious objection is that a
  useful email has to name what's missing, and staff won't write that at a
  counter. They don't have to: `src/lib/checklists.js` already holds a
  per-service list of what to bring, and the check-in page already uses it.
  So this option shows that service's checklist and staff TICK what was
  missing. Two or three taps, no free text, and the email composes itself:

  > To continue we still need:
  > • Photo ID
  > • Last year's return

  The customer never has to describe their case, and neither does staff — the
  service already implies the document set.

  Two things fall out of this for free. The email is specific enough to act
  on, which is the difference between someone returning prepared and returning
  empty-handed a second time. And you get counts of WHICH document is most
  often missing, which tells you exactly what to put on the booking page and
  the door sign so it stops happening at all.
- **Drop-off / waiting** — the back-queue handoff. Sets `handed_off_at` and
  asks for Drop-off / Immigration / Taxes.
- **Passed to someone else** — records that the case moved, without any
  judgement attached. Over months this is what shows where work actually flows,
  which is the honest version of the "who can handle what" question.

## Deliberately NOT in the first version

- free-text notes on completion (nobody types them at a counter)
- a reason for *why* documents were missing
- anything resembling a quality or difficulty rating

Add these only if the four buttons prove too coarse in real use. Starting
narrow and widening on evidence is cheaper than starting wide and discovering
nobody fills it in.

## Build note

Do this on an **empty queue**. It changes the call-and-complete path, which is
the one flow that must not break during a working day.

---

## Explicitly not in scope

- skill levels, certifications, "can handle / cannot handle" routing
- automatic assignment of cases to staff by skill
- any staff ranking or leaderboard, anywhere, for anyone

Those need this stage running for months first. Build the record before the
inference.

---

# Later: rotating band on the TV

**Idea (owner's).** A thin band along the bottom of the wall display,
rotating one message at a time — the same paging mechanic already used by
Up Next. There is space for it: the footer strip currently holds only the
AzQueue mark.

**Why service averages belong there eventually.** "Immigration · usually
about 45 minutes" doesn't help the person waiting decide anything — they've
already chosen and joined. Its value is that it EXPLAINS a long wait.
Someone watching a counter for forty minutes thinks the staff are slow; a
board saying that work usually takes forty-five minutes turns suspicion into
patience, at no cost.

**Why not yet.** There are ~13 completed tickets in AzQueue, and the imported
Qminder history has no start/end times — durations weren't in that export.
Any average shown today would be invented, in front of customers, which is
the worst possible audience for a made-up number. It also depends on the
Complete panel: until the last customer of each day is properly completed,
a few "overnight" visits would wreck the median at this sample size.

**Order:** Complete panel → a few weeks of real service times → then add
averages to the rotation, gated on a minimum sample per service.

## What the band can carry NOW

So the band earns its place immediately rather than waiting:

- "Scan the code at the door to join the queue" — the message most likely to
  change behaviour, shown to a captive audience
- "Open 9:00 AM – 6:00 PM · usually quieter after 4pm"
- "Collecting paperwork? Please use the pickup desk"
- prayer time / pause notices, if not already shown elsewhere

Service averages join the same rotation later. Each entry should be
independently switchable off, and anything derived from data must disappear
on its own when the sample is too small — the same rule the rest of the app
follows.
