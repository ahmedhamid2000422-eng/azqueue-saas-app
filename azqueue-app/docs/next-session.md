# Picking up — written 5 September 2026, ~4:35am Malaysia

Everything below is **built locally and not deployed**. Nothing is broken in
production; nothing here is urgent.

## First thing: deploy the backlog

The office is closed. This is the window. Two separate steps:

```
git add -A && git commit -m "Queue simplification, phone fix, marketing cleanup" && git push
supabase functions deploy send-notification --no-verify-jwt
```

The edge function deploy is separate from git and easy to forget — it carries
the CORS fix, the country-code phone fix, and the generic `breakName`
template.

## What is waiting in that push

- **Queue page**: three solid colour-coded tiles (gold Done, amber No show,
  green Hand over), config moved off the counter screen, Clear queue behind
  "More", `detail` and Drop-off badge on the waiting list
- **InProgressPanel** — still never deployed, missed in two pushes now
- **InReviewList** collapsed by default with overdue count in the header
- **Kiosk** sized to fit one screen without scrolling
- **Assistant** opens with one question and three pills instead of a menu
- **Phone numbers** now use the branch's timezone for the country code
- **Marketing pages** — ten pieces of fabricated content removed
- **CLAUDE.md** — the deployment and data rules

## The workflow redesign — do this first tomorrow

Described by Ahmed at the very end of 5 Sept. It ties together three things
that have been circling each other all week: the second queue tile, the
"is this actually finished?" question, and the manager-versus-staff split.

### The tile behaviour

Tile 2 is currently always "No show". That is wrong when nobody has been
called yet — you cannot no-show someone who was never summoned.

- **Nobody called** → tile reads "In progress", greyed out, not pressable
- **Someone called** → tile becomes active

"No show" only makes sense in the window between calling someone and them
arriving, so it belongs inside that state rather than sitting there all day.

### Complete becomes a question, not an assumption

Pressing Complete currently assumes the visit ended. It often has not — the
customer is waiting on a document, or needs Mohamed specifically. So:

1. Press **Complete**
2. Ask: **"Are they finished?"** — Yes / No
3. **Yes** → close the ticket as today
4. **No** → ask **why not**, and keep the ticket open in an "in progress"
   state rather than closing it

### The "why not" list

These are the reasons, and they are the same vocabulary as escalation:

- Waiting for documents
- Needs notarisation
- Speak to Mohamed
- Escalate (general)

`ESCALATION_REASONS` in `src/lib/workTypes.js` already holds four similar
values (Notarize / Complex case / Question / Unknown) and is not yet read by
any component. Reconcile the two lists rather than creating a third.

### Why this matters more than it looks

**The reasons map onto the station capability toggles.** Once a station
declares what it can handle, the system finally knows which reasons a
regular staff member can resolve and which must go to a manager — the
distinction Ahmed pointed out has never existed in this product.

That makes three previously separate items one piece of work:

- station capabilities (below)
- escalation reasons
- who a ticket should route to

Doing them together is much less work than doing them in sequence, and doing
them separately risks a third competing vocabulary.

### Open question to settle before building

What happens to a ticket marked "not finished"? Options: it returns to the
waiting queue with a flag, it moves to the existing In review / back-queue
list, or it becomes a new state. The In review list already exists and is
built for exactly this — work whose customer has gone home — so that is
probably the answer, but confirm with Ahmed before wiring it.

## Two things needing a schema change

Both were scoped but not started, deliberately.

**1. Customer language in texts and emails.** The picker exists on check-in;
the choice is not stored on the ticket, so notifications go out in English
whatever the customer picked. Needs a `language` column on `tickets`, plus
localised templates. Note the A2P wrinkle: the five SMS templates are the
approved campaign samples, so translating them is a compliance question, not
just a code change — ask Twilio support before sending non-English SMS.

**2. Station capabilities from a list.** The most valuable item on the list.
Each station declares which services it can handle; check-in then routes
people to the right line, and wait estimates finally mean something. Needs
somewhere to store the mapping (a column on `stations`, or a small join
table), a Settings UI to pick from the service list, and check-in changes to
use it.

## Still open from earlier

- Monetisation section on `/product` advertises deposits, priority-queue
  payments and no-show fees that exist nowhere in the codebase
- `src/lib/notify.js` is dead but still imported by five callers — repoint
  them at `lib/notifications.js` and delete it
- Pre-rendering: every page serves identical raw HTML until JS runs
- Weekly data check runs Mondays 10am; expect "not enough data" for a while

## The one rule

`CLAUDE.md` has it: anything touching the queue page, check-in, the TV
display, or A2P waits for a window when Denver is closed. Everything else
ships when ready.
