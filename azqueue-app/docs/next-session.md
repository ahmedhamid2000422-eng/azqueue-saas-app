# Picking up — written 5 September 2026, ~4:35am Malaysia

## Tomorrow's order — set by Ahmed, 5 September

**Customer and staff first. Schema changes last.**

The reason is the 4 September outage: a migration added a column the deployed
code already read and took check-in down during office hours. Anything that
only moves UI can go out safely; anything that touches the database waits
until the visible work is done and the office is closed.

1. **No-show recovery survives a refresh.** Today's strip lives in React state
   only, so closing the tab loses everyone marked no-show. Fix by loading
   today's `status = 'no_show'` tickets on mount instead of remembering them.
   Read-only query, no migration.
2. **Page split** — move things onto the page whose question they answer, per
   the division in `CLAUDE.md`. Thirty-day numbers off Overview. Sort out the
   overlap between `Insights.jsx` and `ClientIntelligence.jsx`, and decide
   whether `Manager.jsx` still has a reason to exist now Overview replaced it.
### Language bugs Ahmed hit, 5 September — diagnosed, mostly not fixed

**1. Picking Arabic flips the staff screens too, and it sticks.**
`i18n.js` `applyDir()` sets `document.documentElement.dir = "rtl"` on the
whole document, and the detector caches the choice in `localStorage` under
`azq.lang`. So a customer choosing Arabic on the kiosk flips the entire app
on that device — Queue page included — and it stays flipped after they walk
away, because nothing resets it.

Two things to decide, and they are separate:
- Should the *staff* UI ever go RTL? Almost certainly not: one shared login,
  and the people using it read the interface in English.
- The kiosk should reset to English after a check-in completes. Right now
  the next customer inherits the last one's language.

Likely fix: scope `dir` to the customer-facing subtree instead of `<html>`,
and clear `azq.lang` when the kiosk returns to its idle screen.

**2. Some screens still render English in every language.**
Not an i18n wiring fault — `i18n.js` loads all six locales correctly and each
file has all 75 keys. The cause is that only 31 strings on the check-in page
go through `t()` at all; the rest are literal English in the JSX, so they can
never translate. The step flow added on 5 September is the main offender.

Fixed already: `common.next` was used by the new step buttons and did not
exist in any of the six locales. Added to all six.

Still to do: audit the check-in and booking pages for hardcoded strings and
move them into the locale files. Tedious, no risk, no schema.

**3. Nobody has checked the Amharic or Tigrinya wording.** Machine-produced
and unreviewed. A native speaker should read both before this is treated as
shipped.

3. **Then, and only then, schema.** The customer `language` column for
   translated emails, and anything else needing a migration. Migration first,
   deploy second — never the reverse.

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
