# Customer journey intelligence — captured 5 September 2026

Ahmed's idea, from a voice conversation. Recorded here so it survives, with
the parts that need thinking-through marked as such. **Not built. Not
scheduled.**

## The idea

Stop measuring only how long people wait, and start measuring what eats the
time inside a visit — then turn that into a process suggestion rather than a
verdict on a person.

The example he gave: if staff spend a large share of an appointment
explaining the same rules, the system should say *"consider signage, or a
short guide before check-in"* — not *"staff member is slow"*.

## The rule that makes it work

**Only collect data that enables a better action. Every metric must resolve
to a decision, not a scoreboard.**

- "John is slow" → useless and corrosive
- "New customers need about five minutes of explanation; add a pre-visit
  guide" → the same underlying data, pointed at the process

**No conversation recording.** Staff tap a reason instead. The system then
says something like *"62% of questions are about required documents — send a
checklist before arrival."*

## This is already the codebase's principle

Worth noting, because it means this is an extension rather than a new
direction. The existing code says the same thing in several places, written
before this conversation happened:

- `station_events` is keyed on station, never on a person — migration 0008
  states "RETENTION RULE: aggregate only at station/shift level. Do NOT join
  back to staff to build a per-person history."
- `bounce_count` lives on the ticket, not on a staff member: "a high bounce
  count signals a service-flow problem or a complex case, not a person to
  blame."
- Manager mode's footer: "Insights surface gently. Nothing punitive."
- The staff roster: "Staff counts show completed visits today — not relative
  comparisons."

So the ethic is consistent and already load-bearing. Keep it.

## The loop

Revised 5 September, after working out that sub-visit timing is expensive and
that the original phrasing stored something it should not.

1. **Before the visit** — the customer gets the checklist for their service.
2. **They tick what they have with them.** Positive framing throughout: the
   question is "what do you have", never "what are you missing".
3. **Staff see the snapshot on arrival** — "has ID, has last year's return" —
   so the visit starts from what is ready rather than discovering it cold.
4. **The visit happens.**
5. **One tap at Complete: what took the time?** Explaining · Documents · The
   work itself. A category, not a stopwatch.
6. **Anonymous counters increment; the per-person ticks are cleared.**
7. **The insight comes from the counters** — "documents came up in most
   visits this month" → put up a sign, or send the checklist earlier.
8. Back to step 1, with a better checklist.

This closes two circles rather than one. The original went
customer-prepares → staff-save-time. This also goes what-took-the-time →
change-the-process → fewer visits need that explanation at all.

### Why "tick what you have" is not enough on its own

If a list has six items and the customer ticks four, the missing two are
derivable by subtraction. Positive phrasing alone does not protect anyone —
it has to be paired with not keeping the record.

So: ticked items live on the ticket for the duration of the visit and are
cleared when it closes. The nightly sweep already runs and can do it. At
close, an anonymous counter increments with no link back to the person.

The insight survives — "proof of address was ready in 12 of 40 visits" —
while it becomes impossible to look up what any one customer lacked. For an
office serving immigration clients that distinction is the whole point.

### One phrase that must not ship

*"Upload these two documents to save ten minutes of your appointment."*

There is no measurement behind ten minutes. That is an invented figure in a
customer-facing message, and it breaks the same rule as everything removed
from the marketing site this week. Say *"so we can get started straight
away"* — true, useful, and claims nothing that cannot be defended.

### What was given up, and why it does not matter

The original idea included "staff spent 40% of the appointment explaining
rules". Producing that number needs staff tapping segment markers *during* a
visit — several taps per customer, on the screen we spent a session
simplifying because it was too complex for the owner to use. It would not
get used.

The action taken on "explaining came up in most visits" and on "explaining
was 40% of the time" is identical: put up a sign, move the checklist earlier.
The sentence is the only casualty.

## What already exists to build on

- `src/lib/checklists.js` — per-service document lists, already written,
  already customisable per branch
- `ServiceChecklist.jsx` — shows the list before joining the queue and can
  email it
- `tickets.detail` — free text describing the specific work
- `tickets.escalated_reason` — why a visit needed the manager
- `station_services` (migration 0061) — what each counter can handle

The tick-box version is a genuinely small step from what is already there:
the list exists, the email exists, what is missing is storing which items the
customer confirmed.

## Four things to resolve before building

**1. Sub-visit timing — DECIDED AGAINST.** Tickets record `called_at` and
`completed_at` only. Real in-visit timing needs staff tapping segment markers
throughout a visit, which will not happen on this screen with these users.
Replaced by a single category tap at Complete. See "What was given up" above.

**2. Every reason button is a tap at the counter.** We just spent a session
removing taps from that screen because the queue was too complex for the
owner to use. A reason picker earns its place only if it is one tap on a
short list, and only if the resulting insight is genuinely acted on. If it is
not, it is data collection for its own sake — exactly what the rule forbids.

**3. There is not enough data for any of this yet.** Four clean days, about
49 visits. An insight like "62% of questions are about documents" needs
hundreds of visits before the percentage means anything. Shipping the
suggestion engine early would produce confident nonsense — the same failure
as the p90 alert and the "3pm cliff". See `docs/statistics-lessons.md`.

**4. The sensitive part — RESOLVED, see "The loop" above.** A record of what
an immigrant client lacks is more sensitive than anything AzQueue currently
stores. Settled on: positive framing, cleared at visit close, anonymous
counters only. Build it that way from the start rather than adding the
deletion later.

## The name

"Customer journey intelligence" is right for describing it internally.
Whatever it is called in the product should avoid sounding like surveillance
— the whole point is that it watches the process, not the people.
