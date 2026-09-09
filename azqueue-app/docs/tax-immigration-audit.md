# Tax & Immigration workflow — audit and proposal

Written 5 September 2026, against the codebase as it stands. Nothing built.
Az Tax Services is the pilot.

---

## 1. Executive summary

**Most of this already exists.** The audit's main finding is that the tax and
immigration workflow described was largely built between migrations 0044 and
0061, and much of it is either unused or unreachable from the interface rather
than missing.

Already there: walk-ins and appointments in one queue, four arrival channels,
document drop-off, a back-office work queue, a pickup kiosk, ready-to-collect
emails, escalation with a reason, staff capability fields, station-to-service
routing, 52 built-in document checklists, and a per-branch checklist override
table added today.

**One thing is genuinely missing, and it is the important one.** Checklists are
*informational*. The system tells a customer what to bring and never records
what they actually brought. So there is no readiness figure, no "6 of 8
prepared", no missing-item history, and no way to answer the question the whole
template exists for — *does preparation change how long service takes?*

That single gap blocks roughly half the statistics requested, and closing it is
one table and one component.

**The second finding is about trust in the data.** Several capability fields —
`expertise_areas`, `max_complexity`, `services_handled`, `estimated_times` —
exist, are read by the routing code, and have almost certainly never been
populated. Features that read empty configuration behave like features that do
not exist, but they fail silently rather than visibly. Each is marked *needs
verification* below and should be checked against live rows before anything is
built on top.

**Recommendation:** do not build a tax product. Build the readiness loop, wire
up what is already there, and let the existing statuses carry the workflow. The
architecture is right; the wiring and the data are what is thin.

---

## 2. Existing-capability inventory

### 2.1 Queue and appointment workflow — **Working now**

`tickets` carries walk-ins and appointments in one table.
`source` is constrained to `walk | book | kiosk | own_device` (0054), so
arrival channel is recorded per visit. Bookings live in `bookings` with their
own lifecycle and link back via `bookings.ticket_id`.

Files: `src/modes/business/Queue.jsx`, `src/pages/CustomerCheckIn.jsx`,
`src/pages/BookingPage.jsx`, `src/hooks/useQueue.js`.

*Caveat:* `walk` is legacy and means "device unknown". Any channel breakdown
must report it as *route not recorded* rather than folding it into kiosk.

### 2.2 Ticket statuses — **Working now**

`waiting | serving | completed | no_show | cancelled`, plus `expired_at` for
tickets swept by the nightly job.

The model is better than it looks, because 0048 deliberately kept back-office
progress **out** of `status` and expressed it as timestamps instead:
`handed_off_at`, `work_started_at`, `work_done_at`, `ready_notified_at`,
`collected_at`.

That is the right separation and it already answers Phase 2's central question.
Live queue position is `status`. Today's visit stage is the timestamp set.
They are not mixed, and 0048's comment says explicitly why: *"Back-queue work
is NOT someone waiting in line. Every wait figure, the TV display, the queue
count and every insight must exclude it."*

**Do not add `in_review`, `awaiting_documents` or `processing` to `status`.**
The state machine is the one part that has to be right, and the current design
already has room.

### 2.3 Service catalogue — **Working now**, one flag unused

`services` has name, duration, active, and `is_pickup` (0048) marking a service
as a collection rather than a consultation.

*Needs verification:* whether any Az Tax service has `is_pickup = true`. The
pickup flow depends on it.

### 2.4 Checklists — **Partially implemented** (the main gap)

**Exists:** 52 built-in lists in `src/lib/checklists.js` keyed by service
keyword, covering N-400, I-485, I-130, DACA, asylum, and the tax variants.
Per-branch overrides in `service_checklists` (0062, today). Surfaced in three
places: the kiosk (`ServiceChecklist.jsx`), a staff send from the Queue menu,
and the public page `/q/:slug/what-to-bring`.

**Missing:** any record of what a customer actually has. The checklist is read
and sent; nothing is stored per ticket. There is no `ticket_checklist_items`
table, no readiness count, and no missing-item history.

This is the gap. Everything in Phase 3 beyond "show the list" is unbuilt.

### 2.5 Customer notes and history — **Working now**

`customers` deduped on `(branch_id, phone)` and `(branch_id, email)`.
`tickets.notes`, `tickets.detail`, `tickets.outcome`, and a per-visit history
view in `Customers.jsx` reading escalation reason, handoff category, station
and staff.

### 2.6 Drop-off and pickup — **Present but unused** *(needs verification)*

Fully built in 0048 and wired: `handoff_category` (`dropoff | immigration |
taxes`), the back-queue index, `PickupKiosk.jsx` at `/q/:slug/pickup`,
`PickupBanner.jsx`, `InReviewList.jsx`, `src/lib/backQueue.js`, and
`sendReadyEmail` firing on completion.

*Needs verification:* whether a single ticket has ever had `handed_off_at` set.
The feature is complete; the question is whether the office uses it. If it has
never been used, that — not any missing feature — is the largest available win,
because it is the mechanism that empties the waiting room.

### 2.7 Staff assignment and reassignment — **Working now**, attribution fragile

Assignment via `tickets.staff_id`, set from the per-device "Served by" picker.
Reassignment through `ReassignMenu` and the ticket actions menu.
`bounce_count` counts returns to the queue.

**Known defect, fixed today but not deployed:** the device picker was hidden
unless the branch had more than one staff row, which is also the state a branch
is in when its staff records are broken. Every visit then recorded with
`staff_id` null — which is why `with_staff` was 0 across the entire history.

*Any per-staff statistic is unreliable until this has been deployed and used
for a period.*

### 2.8 Resource matching — **Present but unused** *(needs verification)*

`staff.services_handled`, `service_preferences`, `max_complexity`,
`work_style`, `expertise_areas`, `languages`, `estimated_times`,
`is_senior_advisor`. Plus `station_services` (0061) and
`branches.manager_only_reasons`.

`analyzeQueue` and `enrichStaffLoad` read these. If the arrays are empty — and
`station_services` certainly is, since 0061 ran today — routing silently falls
back to "anyone can do anything".

That fallback is correct and deliberate (0061: *"a station with no rows is
UNRESTRICTED, not incapable"*), but it means the capability system is
configuration that has never been filled in, not code that needs writing.

### 2.9 Messaging — **Working now**, with a hard constraint

Email via `queue-email` — seven templates, no regulatory constraint.
SMS via `send-notification` — five templates matching the five approved A2P
samples, word for word.
WhatsApp — `wa-bot` / `wa-reply` exist, assume Twilio as the provider, and the
verified sender is currently with Meta. Unresolved.

**Constraint that shapes every proposal below:** campaign
`CM9d4930a3a84ff613446b2ae3155b99af` is approved after four rejections and is
not to be reopened. Any *new* customer message in this template must be email,
or must wait for a written answer from Twilio about whether adding a sample
triggers re-review.

`src/lib/notify.js` — **Duplicated.** A second, non-compliant SMS path, inert
only because its credentials were removed. Five callers. Should be deleted.

`sendYourTurn` in `Queue.jsx` — **Present but unused** as of today; both
callers were removed or repointed. Same hazard class.

### 2.10 Analytics and timestamps — **Working now**, thin data

Captured per ticket: `created_at`, `called_at`, `started_at`, `completed_at`,
`expired_at`, `scheduled_at`, plus the six back-office timestamps, plus
`escalated_at`, `survey_sent_at`, `near_front_notified_at`, `turn_expires_at`.

That is a rich event trail — richer than most of the requested statistics need.

Engines: `src/lib/insights.js`, `insightsEngine.js`, `stations.js`
(`loadStationTimings`, `MIN_VISITS_FOR_TIMING = 5`), `insights_cache`.

**The limiting factor is data volume, not instrumentation.** Per
`docs/baseline-2026-09.md`: four usable days, ~49 visits, median 18–47 minutes
on days worked live, 90–210 on batch-entry days. Pooling gives 62.1, which
matches no individual day.

### 2.11 Incomplete or disconnected

| Thing | State | Note |
|---|---|---|
| `src/pages/Display.jsx` | **Duplicated** | Dead route `/display-tv/:branchId`. `TvDisplay.jsx` is live. Tombstoned today. |
| `src/lib/notify.js` | **Duplicated** | Non-compliant SMS path, inert by accident. |
| `Manager.jsx` | **Needs verification** | Behind `MANAGER_ENABLED`; Overview replaced it. |
| `shadow_slots` | **Missing** | `ShadowSlots.jsx` queries a table that does not exist. |
| `upsert_walk_in_customer` | **Missing** | RPC 404, open since the QA backlog. |
| Reviews / Leads pages | **Present but unused** | Marked SOON in nav. |
| `business_type` picker | Removed today | Column still read; choice belongs in onboarding. |
| Tests | **Missing** | No vitest, no jest, no lint, no typecheck. |

---

## 3. Current workflow

```
                      ┌──────────────┐
   kiosk / QR ───────►│              │
   own phone ────────►│   waiting    │──► serving ──► completed
   booking ──────────►│              │        │
   staff entry ──────►└──────────────┘        │
                             │                ├──► no_show   (expired_at)
                             │                ├──► cancelled
                             ▼                │
                      turn_expires_at         ▼
                      (30-min sweep)   handed_off_at ──► work_started_at
                                              │              │
                                              │              ▼
                                              │        work_done_at
                                              │              │
                                              │              ▼
                                              │      ready_notified_at ──► collected_at
                                              │         (email)            (pickup kiosk)
                                              └── customer has gone home ──┘
```

Two independent axes, and that is the design's strength:
**where the person is** (`status`) and **where the work is** (timestamps).

---

## 4. Proposed tax / immigration workflow

The twelve steps map onto what exists, with **one new axis** — readiness.

```
1  Enquiry              contact_requests | phone | walk-up
2  Service selected     tickets.service_id
3  Checklist sent       ✅ /q/:slug/what-to-bring, kiosk, staff menu
                        ➕ NEW: customer ticks what they have
4  Registered           source: walk | book | kiosk | own_device
                        handoff_category = 'dropoff' for a drop-off
5  Check in             status = waiting
6  Documents reviewed   ➕ NEW: staff confirm / reject / mark missing
                        ➕ readiness = confirmed ÷ required
7  Waits for the        priority, staff_id, assigned_station_id,
   right person         station_services (0061)
8  Consultation         status = serving, started_at
9  More info needed     escalated_at + escalated_reason  ✅ exists
10 Documents retained   handed_off_at + handoff_category ✅ exists
11 Notified / pickup    work_done_at → ready_notified_at → collected_at ✅
12 Complete             completed_at
```

**Three axes, kept apart:**

| Axis | Field | Question |
|---|---|---|
| Live queue status | `tickets.status` | Where is this person right now? |
| Work stage | the six 0048 timestamps | Where is their paperwork? |
| Readiness | **new** | Do they have what we need? |

Readiness must be its own axis. Folding it into `status` would create
`awaiting_documents`, which reads as a queue position and would then have to be
excluded from every wait calculation — the exact mistake 0048 was written to
avoid.

**Multiple services in one visit** is the one case the model does not handle:
one ticket, one `service_id`. Options are a linked-tickets approach or a
join table. **Recommend deferring** — it is rare, and the honest workaround is
a second ticket. Do not reshape the core table for it now.

---

## 5. Data model changes

Two tables. No changes to `tickets`.

**`checklist_requirements`** — what a service needs, as rows rather than a text
array, so items can be counted and compared across visits.

```
id, branch_id, service_key, item_label, item_code, required (bool),
sort_order, created_at
```

`item_code` matters more than it looks: *"Passport"* and *"Valid passport"*
must aggregate as one thing or the "most commonly missing item" figure is
noise.

**`ticket_checklist_items`** — what happened on one visit.

```
id, branch_id, ticket_id, requirement_id, item_code,
customer_state  ('has' | 'not_sure' | 'missing')      -- customer's claim
staff_state     ('confirmed' | 'rejected' | 'missing' | null)
noted_at, noted_by
```

Two state columns, deliberately. A customer saying they have their W-2 and a
staff member confirming it are different facts, and the gap between them is
itself worth measuring — if customers routinely claim readiness they do not
have, the reminder wording is wrong.

**Explicitly not storing documents.** No uploads, no scans. There is no
access-controlled upload system in this codebase, and building one for tax and
immigration paperwork means SSNs and passports at rest. A checklist confirming
possession is a different product from a document store, and out of scope.

---

## 6. Checklist design

**Customer side** — the existing `/q/:slug/what-to-bring` page gains a tick
box per item and a "these are the ones I have" submit. Anonymous until they
join the queue, so it is keyed to the ticket at check-in, or to a short-lived
token if they fill it in beforehand.

Visually: the list already renders as gold-bulleted rows on the dark card. Each
gains a tap target on the left — an empty square that fills gold when ticked.
No red for unticked; someone who has three of eight items should not be shown a
screen of failure. Below the list, a quiet line: *"You have 3 of 8. You can
still come in — we'll tell you what's missing."*

**Staff side** — inside the existing serving card, above the tiles. A compact
row per item with three small controls: confirm, reject, still missing.
Confirmed items collapse away; only unresolved ones stay visible, so a
well-prepared customer shows almost nothing and a difficult one shows exactly
what to ask for.

**Readiness summary** — one line, in the same small-caps label style already
used for TICKET and SERVICE:

```
READINESS
6 of 8 confirmed · missing: proof of address, prior-year return
```

Not a progress bar and not a percentage ring. This screen is read while a
customer is mid-sentence, and a number plus the two missing item names is
faster than any graphic.

**Reminders** — email only, using the existing `checklist` template. An SMS
reminder is a sixth message type and is blocked.

---

## 7. Statistics

Sample-size column assumes the project's existing rule: state `n`, prefer
medians, report day by day, never pool.

### Essential

| Metric | Question | Data | Calculation | Min n | Visual | Action |
|---|---|---|---|---|---|---|
| Customers served | How much did we do? | `completed_at`, `is_test=false`, `expired_at is null` | Count per local day | 1 | Number, Overview | None — context |
| Queue length | Who is waiting now? | `status='waiting'` | Count, excluding `handed_off_at` | — | Number, Overview | Open a counter |
| Median wait | How long do people wait? | `created_at`→`called_at` | Median per day | 5/day | Bar per day | Staffing |
| Median service time | How long does the work take? | `started_at`→`completed_at` | Median per service | 5/service | Table | Slot length |
| Total visit time | How long were they here? | `created_at`→`completed_at` | Median | 5/day | Number | — |
| No-show rate | Do bookings turn up? | `bookings.status='no_show'` | ÷ total booked | 20 | Percent | Reminder timing |
| Walk-in vs appointment | What is the mix? | `tickets.source` | Share; `walk` = *not recorded* | 20 | Split bar | Booking promotion |
| Drop-off volume | Is the back queue used? | `handoff_category='dropoff'` | Count per day | 5 | Number | Encourage drop-off |
| Reassignment rate | Is routing wrong? | `bounce_count > 0` | ÷ total | 20 | Percent | Fix default staff |
| Needs follow-up | Who is unresolved? | `escalated_at`, `work_done_at is null` | Count | — | List | Work the list |
| **Arrived prepared** | Do reminders work? | **new** readiness | readiness = 1.0 ÷ total | 20 | Percent | Reword reminder |
| **Median readiness** | How prepared, typically? | **new** | Median of confirmed ÷ required | 20 | Number | — |
| **Most-missing item** | What do we chase? | **new** `item_code` | Count by code, missing only | 30 | Ranked list | Add to reminder |
| Demand by hour | When are we busy? | `created_at` | Count by local hour | 5/cell | Heatmap | Staffing, quiet-hour nudge |

### Diagnostic

| Metric | Question | Calculation | Min n | Note |
|---|---|---|---|---|
| Wait by service | Which service backs up? | Median wait grouped by service | 5/service | — |
| **Readiness vs duration** | Does preparation save time? | Median service time, readiness = 1.0 vs < 1.0 | 15/group | The headline claim. Do not report below 15 per group. |
| **Missing docs vs repeat visits** | Do gaps cause second visits? | Repeat rate within 30 days, by readiness | 30 | Confounded by service type — segment or say so |
| Punctuality vs visit length | Do late arrivals cost time? | `scheduled_at`→`created_at` vs total | 20 | — |
| Reassignment by service | Which service is misrouted? | `bounce_count>0` grouped | 10/service | — |
| Time per stage | Where is time lost? | Deltas across the six timestamps | 10 | Stacked bar |
| Drop-off turnaround | How fast is the back queue? | `handed_off_at`→`work_done_at` | 10 | Median, not mean |
| Waiting on us vs them | Whose delay is it? | Escalated/awaiting-docs time ÷ total | 15 | The most useful diagnostic here |
| Walkaway rate | Who gives up? | `cancelled` before `called_at` | 20 | Distinct from `expired_at` sweeps |

### Recommendations, and their rules

Each fires only above its sample threshold and states `n` in the sentence.

- *"Proof of address was missing in 31% of immigration consultations (n=42).
  Add it to the first reminder."* — needs 30 visits with a checklist.
- *"Customers who arrived fully prepared were served 18 minutes faster
  (n=17 vs 23)."* — needs 15 per group. **Correlation, not proof:** simple
  cases are both easier to prepare for and faster to serve. Word it as an
  observation.
- *"Tuesday walk-ins exceed capacity between 11am and 1pm (n=6 Tuesdays)."* —
  needs 4 same-weekday samples.
- *"Most pickups take under 5 minutes (n=22). Consider an express lane."*
- *"This service was reassigned 4 times in 10 visits. Update its default
  staff."*

**And the rule this project learned the hard way:** below threshold, show
*"Not enough data yet — 11 of 30 visits."* Five conclusions have already been
retracted for being stories fitted to data that could not support them. See
`docs/statistics-lessons.md`.

---

## 8. MVP versus later

**MVP** — reuses almost everything:

1. `checklist_requirements` + `ticket_checklist_items`
2. Customer ticks items on the existing what-to-bring page
3. Staff confirm/reject inside the existing serving card
4. Readiness line on the ticket and in the waiting row
5. Verify drop-off/pickup is actually used; fix if not
6. Six statistics: served, median wait, median service time, drop-off volume,
   arrived-prepared, most-missing item
7. Two recommendations: most-missing item, readiness-versus-duration

**Later:** multiple services per visit, per-staff capability routing (needs the
config filled in first), automated reminder scheduling, SMS anything, document
upload — or more likely never, for upload.

**Not at all:** a separate tax product, case management, AI document review.

---

## 9. Files that would change

| File | Change |
|---|---|
| `supabase/migrations/0063_*.sql` | Two tables, RLS via `user_belongs_to_branch` |
| `src/lib/checklists.js` | Requirement rows alongside the built-in arrays |
| `src/lib/readiness.js` | **new** — compute and format readiness |
| `src/pages/WhatToBring.jsx` | Tick boxes, submit |
| `src/pages/CustomerCheckIn.jsx` | Carry ticks into the ticket |
| `src/components/ServiceChecklist.jsx` | Same, at the kiosk |
| `src/modes/business/Queue.jsx` | Staff confirm/reject; readiness line |
| `src/modes/business/Insights.jsx` | The new metrics |
| `src/lib/insightsEngine.js` | Readiness aggregates, thresholds |
| `src/modes/business/Settings.jsx` | Requirements editor replacing the text list |

---

## 10. Risks, privacy, edge cases

**Privacy.** A checklist row records that someone was asked for a passport and
did not have it. That is not the document, but it is still information about a
person's immigration situation, and it should never appear in an SMS, in a
public page, or in a log line. RLS on both tables from the first migration,
never anon-readable — unlike `service_checklists`, which is genuinely public.

**Do not store documents.** No upload system exists. Building one for this
office means SSNs and passports at rest, and that is a different product with
different obligations.

**The readiness-versus-speed claim is the most likely thing to be wrong.**
Prepared customers are probably also the simpler cases. Report it as an
observation with both `n` values, never as a causal claim.

**Staff attribution is unreliable until the "Served by" fix has been deployed
and used.** Any per-staff figure before then is measuring a bug.

**Edge cases:** a customer who ticks everything and brings nothing; a service
with no checklist; a checklist edited between the reminder and the visit
(snapshot `item_code` on the ticket row rather than pointing only at the
requirement); a drop-off where the customer never returns; a ticket swept by
the nightly job with a half-filled checklist.

**Timezone.** Every "today" is Denver. Ahmed is in Malaysia and every boundary
will look right to him and be wrong.

---

## 11. Implementation plan

1. **Verify before building** — has `handed_off_at` ever been set? Does any
   service have `is_pickup`? Are `expertise_areas` / `services_handled`
   populated? Three queries, and they may change the plan.
2. **Migration 0063** — the two tables, RLS, indexes. Nothing reads them yet.
3. **Seed requirements** from the built-in lists for Az Tax's own services.
4. **Customer ticks** on the what-to-bring page. Still nothing reads it.
5. **Staff confirm/reject** in the serving card, and the readiness line.
6. **Aggregates** in `insightsEngine` with thresholds and `n` in every string.
7. **Two recommendations**, once thresholds are actually met.

Each stage is deployable alone and none changes the queue state machine.

---

## 12. Questions that need a product decision

1. **Is the drop-off flow being used?** If not, why — and is that a training
   problem or a design problem? This is the biggest single lever in the
   product and it is already built.
2. **Should customers be able to fill in the checklist before they have a
   ticket?** Cleaner if it starts at check-in; more useful if it starts at the
   reminder. The second needs a token scheme.
3. **Who reviews the documents — the person at the counter, or the advisor?**
   Decides whether the staff controls belong in the front queue or the back.
4. **Does a rejected item block starting service, or only warn?** Blocking is
   safer and will be worked around within a week.
5. **Multiple services per visit — accept two tickets for now?** Recommended,
   but it is a product call.
6. **Add vitest?** Readiness maths and timezone boundaries are exactly the
   silent-failure class this project keeps getting caught by.
