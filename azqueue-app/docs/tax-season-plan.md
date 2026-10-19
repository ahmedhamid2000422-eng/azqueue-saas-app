# Ten weeks to tax season — plan

Written 19 October 2026. Season starts late January; February is the peak.

## The number this is built on

**February 2026: 977 clients. March: 850. January: 428.**
October 2026: ~166 arrivals in 16 trading days — about 10 a day, peaking at
24 on a Monday.

February is roughly **49 clients a day**, and since Fridays are effectively
closed, **60+ on the days that matter**. That is twice the busiest day on
record, sustained for eight weeks.

Source: the Qminder import (9,308 clients, Jan 2023 – Apr 2026). Read the
caveats in `docs/baseline-2026-10.md` — it is "clients last seen in month X",
so years cannot be compared. The 2026 figures are the usable ones.

## The principle

**Everything fragile gets multiplied by six.** At 10 visits a day, a kiosk
that loses its flag is an annoyance. At 60, with a full waiting room, it is
the business failing. Nothing new gets built that is not load-bearing for
February.

---

## Phase 0 — this week. Ship what is already written.

Every fix from September and October is sitting local. This is the whole
phase, and it is the highest-value week of the ten.

- [ ] **Run migrations 0064, 0065, 0066** — in that order, before deploying.
      0064 fixes anonymous check-in, 0065 stops the turn timeout forging
      completions, 0066 adds `timing_source`.
- [ ] **Push and deploy.** Carries: sticky kiosk flag, English-only check-in,
      the GPS prompt fix, the "Served by" picker fix, one-tap Done with undo,
      the Customers pagination, the branch-load guard, the Meta tag.
- [ ] **Deploy `daily-report`** — it has been counting swept tickets as
      abandonment.
- [ ] **Re-point the iPad** at `/q/az-tax-services?kiosk=1` once, and re-save
      the bookmark. The flag is sticky after that.
- [ ] **Set "Served by" on each device** — office desktop to Mohamed, counter
      to whoever sits there. One time, remembered.
- [ ] **Turn on Guided Access** on the iPad so the kiosk cannot be navigated
      away from.

Verify with: check-in from a private window, a no-show and a bring-back, one
Done with the undo strip.

---

## Phase 1 — weeks 1–2. Make it survive 60 a day.

- [ ] **Load-test the queue page.** Everything has been exercised at 10–24
      tickets a day. Seed a test branch with 60 waiting and look at what
      breaks: the waiting list renders 8 rows then stops, realtime
      subscriptions fire per ticket, `Customers` loads 50 at a time.
- [ ] **Token collisions.** `generate_ticket_token` at 60/day across eight
      weeks — confirm it does not wrap or repeat within a day.
- [ ] **The 30-minute turn timeout.** Sensible at low volume. At 60 a day with
      a queue, people genuinely wait past it. Decide: raise it, or scope it to
      tickets called but never started.
- [ ] **Device pairing** (replaces the localStorage flags). A `devices` table
      with role, station and a pairing code. The kiosk, TV and counter stop
      depending on a query string nobody can see. Do this if Phase 0 and the
      load test leave time; it is the sturdiest version of a problem already
      half-fixed.

---

## Phase 2 — weeks 3–5. Drop-off. The single biggest lever.

Built in 0048, complete, and as far as anyone knows never used. At 60 people
a day it is the difference between a manageable morning and a waiting room
that overflows: documents taken, customer goes home, work finished later.

- [ ] **Confirm whether it has ever been used** — query 7 in
      `docs/analysis-october-2026.sql`.
- [ ] **Watch your dad work a morning.** Twenty minutes. Whether drop-off is
      unused because it is hidden, because it is not trusted, or because
      nobody was shown, decides everything below.
- [ ] **Make it the obvious path for the right services.** Document Review and
      Follow-up have a median under 2 minutes of counter time. Those should
      default to drop-off.
- [ ] **Practise the pickup flow before February**, not during it. The
      ready-to-collect email and the pickup kiosk are built and untested in
      anger.

**This phase is mostly not code.** It is adoption. A feature nobody uses is
worth exactly nothing, however well built.

---

## Phase 3 — weeks 6–8. Flatten the peak.

- [ ] **Move work off Monday.** Monday runs 2.3–2.8× every other day while
      Tuesday to Thursday sit flat at 8–10 and Friday is empty. In February
      that gap is the difference between 60 and 100.
- [ ] **Turn on the quiet-hour nudge.** `QuietSlotNudge` exists in the
      check-in flow and has never had trustworthy data behind it. It does now.
- [ ] **Push appointments for February.** A booking is a customer who arrives
      when you have capacity rather than at 10am on a Monday.
- [ ] **Decide about Friday.** Two arrivals across two Fridays. If staff are
      in, that is idle capacity one day a week while Monday overflows.
- [ ] **Staff the mornings.** 9–11 is the peak every single day, Monday worst.

---

## Phase 4 — weeks 9–10. Freeze.

- [ ] **Stop shipping features by mid-January.** Fixes only from then until
      May. A change that breaks check-in in February is unrecoverable in a way
      it simply is not in October.
- [ ] **Write the one-page fallback** — what staff do if the system is down.
      Paper numbers and a phone. Tape it inside a drawer.
- [ ] **Check the A2P campaign and Twilio balance** before volume climbs.
- [ ] **Re-run the baseline queries** so January has a real "before".

---

## Explicitly NOT in these ten weeks

- The native staff app. No deadline, and it competes with work that has one.
- Checklist readiness (0063). Good feature, wrong quarter — it adds taps at
  the counter in the busiest season of the year.
- The missed-calls callback queue. Blocked on telephony anyway.
- Discounts, loyalty, marketing from client data. Also blocked on the §7216
  question.
- Anything requiring a new A2P campaign sample.

---

## The one thing that is not on any list

**Call pressed when the customer sits down. Done when they leave.**

Not a feature. Two taps at the right moments. Without them February produces
eight weeks of the busiest, most informative data this business will ever
generate — and none of it answerable.

The one-tap Done and the "were you with them just now?" prompt make the right
thing cheap. They do not make it happen. That is a conversation with Mohamed
and Benyamin, and it is worth more than anything in Phase 1.
