# Who can do what — Az Tax Services

Fill this in with your dad, then send it back. It becomes the routing rules:
which visits can go to whom, and what the screen should stop offering.

Leave anything blank rather than guessing. A wrong rule sends a customer to
someone who cannot help them, which is worse than no rule at all.

---

## 1. The people

| Name | Role | Notes |
|------|------|-------|
| | Senior advisor | |
| | Associate advisor | |
| | | |

Two roles is enough to start. More can be added once these are working.

## 2. What each service needs

List every service you offer. For each one, say whether it needs the senior
advisor specifically, or anyone can do it.

| Service | Who can do it | Hard requirement? |
|---------|---------------|-------------------|
| Notarisation | Senior only | Yes — legal |
| Tax preparation | | |
| Immigration case | | |
| Document drop-off | | |
| Collection / pickup | | |
| | | |

**"Hard requirement"** matters more than it looks. A legal or licensing
constraint (notarisation) must never be routed around. A preference ("Dad is
better at complex immigration") should bend when he is busy and someone has
been waiting an hour — so the two need marking differently.

## 3. What the associate should not be offered

Not permissions — there is one shared login, so nothing can be truly blocked
yet. This is about what the screen shows, so time is not wasted finding out
mid-visit that someone cannot help.

- [ ] Notarisation
- [ ] ...
- [ ] ...

## 4. Two questions worth answering while you are both there

**Which services take longest?** Rank them roughly. Combined with the timings
now being recorded, this shows whether the slow work is also the work only one
person can do — which would be the real constraint on the whole office.

**What happens today when the wrong person takes a visit?** Does it get handed
over, does the customer wait, or does the work happen anyway? The answer
decides whether routing should prevent it or just warn.

---

## What is recording now, so this can be built on evidence

Since 2 September:

- **Who served each visit** — a "Serving from this device" picker on the Queue
  page, remembered per browser. The counter iPad is one person, the back desk
  another. Before this, `staff_id` was never written and every visit in the
  history has no owner.
- **How each visit ended** — done, needs documents, drop-off, passed on.
- **How long each visit took** — real service times, now that the nightly
  sweep no longer overwrites them.

In a few weeks that answers, from your own office rather than from this list:
who actually handles what, how long each takes, and how often work has to move
from one person to another. The list above says what *should* happen; the data
will say what *does*. Where they disagree is the interesting part.
