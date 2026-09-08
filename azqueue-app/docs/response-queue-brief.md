# Missed Calls & Callback Queue — implementation brief

Written 5 September 2026. Status: **not started, blocked on one external check.**

---

## The idea in one line

AzQueue tracks people waiting *in the room*. This tracks people waiting *for a
reply*. Same product, second kind of queue.

## Why it matters at Az Tax

Staff are with a customer at the counter. The phone rings. Nobody picks up.
The caller tries again later, gets the same result, and eventually stops
trying — and nobody in the office ever knew that person called. There is no
list, no owner, and no way to tell afterwards how many were lost.

The measure of success is not a dashboard. It is that a person who called on
Tuesday gets called back on Tuesday.

---

## The blocker, and why it is not code

Twilio can only see calls on numbers Twilio controls. It cannot observe
traffic on a line another carrier owns. Adding the office number as a Twilio
"verified caller ID" allows outbound calls to *display* that number and gives
no inbound visibility whatsoever.

So the calls have to reach Twilio. Three ways, in order of preference:

**1. Conditional forwarding — recommended.**
Comcast Business Voice supports *Call Forwarding No Answer*: unanswered calls
forward to an external number. Point it at a Twilio number and Twilio sees
only the missed calls. Customers keep dialling the number they know, the desk
phone is untouched, and it is reversible in a minute.

It also removes the hardest part of the spec. Every call arriving at Twilio is
by definition unanswered, so there is no need to inspect child dial results to
work out whether a human picked up.

**Confirm before building:** is the office on *Comcast Business* Voice,
residential Xfinity Voice, or Business VoiceEdge? The feature set differs.
Configure it in the portal, not with `*72` — that is Call Forwarding **Always**
and would route every call away from the desk, including the ones staff would
have answered.

**2. New published number.** Buy a Twilio number, forward it to the office,
publish it on the website and Google Business Profile. No carrier features
needed. Coverage grows as old customers migrate. Good fallback if (1) is
unavailable.

**3. Port the office number in.** Cleanest end state, worst first step. Once
ported, Twilio owns the number and the desk phone needs a *different* one —
you cannot forward a number to itself. The business line then depends
permanently on a webhook. Two to four weeks, needs an LOA signed by Mohamed
matching the carrier's records exactly.

Never cancel the old service before a port completes. That releases the
number and it can be lost permanently.

Timing note: tax season is January to April. September is the right end of the
year to be changing telephony.

---

## Phasing

### Phase 1 — inspect and plan
Done. Findings in "Architecture as it actually is" below.

### Phase 2 — callback queue, no SMS
The whole product value, and it needs no messaging approval at all.

- Migration `0062_callbacks.sql`
- Edge function `twilio-call-status` with signature validation
- Missed-call detection, duplicate merging, idempotency
- `Callbacks.jsx` page, nav entry, staff actions, activity timeline
- The four headline metrics

### Phase 3 — automatic SMS — **gated, see below**

### Phase 4 — settings and integration status
Manager-only config, connection state, A2P state.

---

## The A2P problem with Phase 3

The missed-call acknowledgment would be a **sixth** message type. Campaign
`CM9d4930a3a84ff613446b2ae3155b99af` is approved with **five** samples, after
four rejections. Ahmed's standing instruction: do not reopen it.

Sending an undeclared sixth message on an approved campaign risks carrier
filtering, which is harder to undo than a rejection.

**A second campaign does not solve this.** A phone number belongs to one
campaign at a time. A second campaign needs a second number, so the "sorry we
missed your call" text would arrive from a number the customer never dialled
while they are looking at their call log showing the one they did. That is the
pattern carriers filter, and it makes the message less trustworthy than
sending nothing.

**Therefore:** Phase 3 ships with the template written and the send path
throwing, exactly like `sendChecklistSms`. It turns on only if Twilio support
confirms in writing that adding a sample to an approved campaign does not
trigger re-review.

Worth checking in the console: if the registered use-case description already
mentions callback acknowledgments, adding a matching sample is a much smaller
change than adding a new category.

---

## Architecture as it actually is

- **Tenancy is `branches`**, not "businesses". Every table gets `branch_id`
  and RLS through `user_belongs_to_branch(branch_id)`.
- **Roles** are `owner | manager | staff` on `public.staff`.
- **Backend is Supabase Edge Functions** (Deno/TypeScript). `send-notification`
  owns Twilio and holds the credentials as function secrets. Never `VITE_*`.
- **Frontend is plain JSX.** No TypeScript in `src/`.
- **Routing** nests under `Dashboard.jsx` via the `QUEUE_NAV` array.
- **Components:** `Card` (with `luxe`), `Button`, `Badge`, `Section`.
- **Phone normalisation already exists** in `send-notification` —
  `normalisePhone()` derives the country code from `branches.timezone`.
  Extract and reuse; do not write a second one.
- **Customers** already have a unique index on `(branch_id, phone)`, so
  caller matching has an index ready.

### There is no test framework
`package.json` has `dev`, `build`, `preview`. No vitest, no jest, no lint, no
typecheck. The spec asks for tests "consistent with the existing setup" and
there is nothing to be consistent with.

Webhook signature validation and idempotency are exactly where silent bugs
live, so this is the one place tests are worth adding a tool for. Decision
needed: add vitest, or ship Phase 2 untested.

### Twilio's Node helper will not import cleanly into Deno
Signature validation is HMAC-SHA1 over the URL plus sorted POST params —
roughly fifteen lines with Web Crypto. Implement directly.

---

## Data model

Channel-neutral naming where it costs nothing, because email and WhatsApp are
meant to enter the same queue later.

**`phone_integrations`** — branch_id, provider, twilio number, forwarding
number, messaging service sid, sms_enabled, auto_message_enabled,
callback_overdue_minutes, timestamps.

**`call_events`** — branch_id, integration_id, call sid, parent call sid,
caller/called E.164, direction, provider status, answered, started/ended,
duration, callback_task_id, idempotency key. Unique on call sid plus status.

**`callback_tasks`** — branch_id, customer_id (nullable), caller number,
status, assigned_staff_id, first/last missed at, incoming_call_count, first/
last callback attempt at, attempt count, resolved at/by, outcome,
appointment_id, internal note.

Partial unique index enforcing **one unresolved task per branch per caller**.

**`callback_activity`** — append-only timeline. Timestamp, actor, event type,
minimal metadata.

Statuses: `waiting`, `attempted`, `resolved`, `appointment_booked`,
`dismissed`. Only the first two are active.

---

## Rules that follow from this project's history

- **Migration first, deploy second.** Reading a column before it exists took
  check-in down on 4 September.
- **State `n` with every metric.** Average callback time from three tasks is
  not an average.
- **Use the branch timezone**, never the server's. Aurora is Denver; Ahmed is
  in Malaysia and every date boundary will look correct to him and be wrong.
- **Mask numbers in list views.** Reveal on demand, to authorised staff.
- **Never put tax, immigration or document detail in an SMS.**
- **Do not count webhook retries as calls.** Idempotency is a metric
  correctness issue, not just a data hygiene one.

---

## Open decisions

1. Confirm the Comcast product and whether Call Forwarding No Answer is
   available. **Everything else waits on this.**
2. Add vitest, or ship Phase 2 untested.
3. Ask Twilio support whether adding a campaign sample triggers re-review.
   Costs nothing, runs in the background, unblocks Phase 3.

## Explicitly out of scope for v1

Full CRM, call recording, transcription, browser softphone, staff leaderboards,
revenue attribution, sentiment scoring, bulk SMS, automated outbound calling,
a new appointment engine.
