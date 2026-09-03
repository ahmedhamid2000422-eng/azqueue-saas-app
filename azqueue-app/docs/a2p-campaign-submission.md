# A2P 10DLC campaign — AzQueue

**Every URL here is on `azqueue.io`.**

The customer profile (`BUe4d225bb8ccab6cd78e703db008d9716`, "Aztax", Twilio
Approved) records the website as `https://www.azqueue.io`. The www form
redirects to the apex, so both reach the same site — these use the apex
because that is where a reviewer's browser actually lands.

Both brands — "Aztax" and "AZQUEUE" — sit on that single profile, so this is
the registered website whichever brand the campaign is filed under. That is
also why switching brands would not have helped.

An earlier version of this file put the campaign on aztaxservices.io. That is
what "the provided website URL does not match the Brand and Campaign
registered" was reporting: the profile on record points at azqueue.io, so a
campaign pointing at a customer's own domain could not match it.

AzQueue is a software vendor sending on behalf of the businesses that use it.
That is a normal and permitted arrangement, but the campaign has to state it
plainly, because otherwise the reviewer sees messages signed "Az Tax Services"
under a brand called AzQueue and reads it as an inconsistency. The description
below does that in its first two sentences.

**Before submitting:** open `https://azqueue.io/sms` and confirm it loads. It
is the page a reviewer checks for the call to action, and it is linked from
the footer of azqueue.io under Company.

## Use case — keep Low Volume Mixed

**Low Volume Mixed is correct.** The AZQUEUE brand is registered as Low Volume
Standard, and Low Volume Mixed is the campaign type that pairs with it: lower
throughput, lower monthly fee, multiple message types permitted. It is the
intended option for this brand, not a catch-all chosen by accident, and it is
likely the only one the form offers.

(An earlier draft of this file said to switch to Customer Care. That was
wrong — noted here so nobody acts on it later.)

## Messaging Service — use the existing one

Select **existing**: `MGfb9cd2b29f93447d101a28464e7cd8aa`.

The number +14302136585 is already attached to it. Creating a new service
means re-attaching the number and repointing anything that references it, for
no benefit — the rejected campaign is what needs replacing, not the service.

## Cross-checked against Twilio's rejection codes

From help.twilio.com article 15778026827291. Every code that could apply, and
where this submission stands:

| Code | Reason | Status |
|------|--------|--------|
| 30886 | Description does not explain purpose, or ISV offering not indicated | Description names AzQueue as software sending for its customers |
| 30893 | Samples unclear, no brackets, or missing business name | Samples bracketed; sample 1 carries "via AzQueue" |
| 30892 | Public URL shorteners in samples | No links in any message |
| 30891 | Website not functioning | /sms and /sms/privacy must be deployed BEFORE submitting |
| 30896 | Opt-in insufficient, or website lacks privacy policy and terms | Both now exist as separate documents, opt-in URL given |
| 30887 | Opt-out workflow unclear or missing keywords | Opt-out keywords and message supplied; opt-IN keywords now blank |
| 30890 | HELP reply lacks brand name, phone or email | Help message carries AzQueue and hello@azqueue.io |
| **30909** | **Call to Action could not be verified** | **Confirmed by Twilio support as the actual reason. Caused by declaring opt-in keywords START/UNSTOP and a subscription-confirmation sample while consent is a web checkbox — a text-to-join path that does not exist. Both now blank.** |

Note: from 15 September 2026 Twilio moves to a unified content policy with
more specific rejection codes, so a resubmission after that date may report a
different code for the same underlying problem.

## The confirmed reason

Twilio support (ticket 29333462, 2 September) gave the code for
`CM48e9d650b7c6d5923c6f103962247b1c`: **30909 — Call to Action.** Not the
website mismatch, which had already stopped being reported.

That is worth stating plainly: the domain work, the apex-versus-www question
and the second domain purchase were all fixing an error that was no longer
the one failing. The reviewer could not verify the opt-in, and the reason is
almost certainly that the form declared a keyword opt-in alongside the web
checkbox.

Field-by-field values ready to paste are in `a2p-answers.md`.

## If asking support again

A rejected campaign cannot be edited; Twilio requires a new one. Before paying
for another attempt, ask support for the underlying TCR rejection reason — the
console only ever shows Twilio's paraphrase, and after three rejections the
exact code is worth more than another guess.

Quote:
- Brand: `BN31115d42c205fa6eec2795f773bdaee0` (AZQUEUE, approved)
- Failed campaign: `CM48e9d650b7c6d5923c6f103962247b1c`
- Question: "What was the TCR rejection reason for this campaign?"

The brand stays approved either way, so only the campaign is being redone.

---

## Campaign description

```
AzQueue is queue management software used by small businesses such as tax
preparation offices and clinics. When a customer visits one of these
businesses in person, they can opt in at check-in to receive text
notifications about their place in the queue, so they do not have to wait in
the waiting room.

Messages are sent by AzQueue on behalf of the business the customer is
visiting, and every message names that business so the recipient knows who is
texting them. Messages tell the customer their ticket number, when their turn
is approaching, and when their turn has arrived, and confirm appointments they
have booked.

All messages are transactional and are sent only to customers who ticked the
consent box themselves on that business's check-in form. We do not send
marketing or promotional messages, and phone numbers are never purchased or
imported.
```

## Sample messages

All five are messages the system actually sends. Bracketed fields are filled in
per visit, which error code **30893** requires; the first carries the
registered brand name, which the same code also requires.

```
1. [Business Name] via AzQueue: You're checked in. Ticket [A24] for [Tax Preparation]. We'll message you when you're up. Reply STOP to opt out.

2. [Business Name]: You're up - please come to the counter now. Ticket [A24].

3. [Business Name]: Thanks for visiting! Ticket [A24] is complete. Reply STOP to opt out.

4. [Business Name]: Hi [First Name]! Your booking for [Service] is confirmed for [Day, Date at Time]. Reply STOP to opt out.

5. [Business Name]: Pausing briefly for [Prayer]. Your ticket [A24] keeps its place - service resumes at [1:15 PM].
```

**What changed, and why it matters more than it looks.**

An earlier draft used a subscription confirmation as sample 5: *"AzQueue: You
are subscribed to queue notifications…"* That message only exists if a person
can text a keyword to join. Paired with opt-in keywords START and UNSTOP, the
campaign was declaring a **text-to-join flow that does not exist** — consent
is a checkbox on a web form.

A reviewer verifying the Call to Action would look for that text-to-join path,
fail to find it, and reject on **30909** — which is precisely the code Twilio
support confirmed for `CM48e9d650b7c6d5923c6f103962247b1c`. We were declaring
an opt-in method we do not have, and then being marked down for not having it.

Sample 5 is now the prayer-pause notice, which is a real message. `[Business
Name]` is the business the customer is visiting; "via AzQueue" appears on the
first message of a visit so the recipient knows which platform is texting from
an unfamiliar number.

## Content your messages may contain

Leave **all four unticked**. No links, no phone numbers, no lending content,
nothing age-gated.

## Privacy policy URL

```
https://azqueue.io/sms/privacy
```

## Terms of service URL

```
https://azqueue.io/sms
```

Two different documents, because the two fields are checked for different
things.

**Terms** (/sms) carries the literal checklist Twilio asks for: programme name,
description, message and data rates, message frequency, support contact, and
opt-out instructions with HELP and STOP in bold. The general /legal/terms page
contains none of that, which is why it is not used here.

**Privacy** (/sms/privacy) leads on what is collected, what it is used for, and
the clause the privacy field is really checked for: that mobile opt-in data is
never sold, rented or shared with third parties for marketing. Its absence is
among the most common rejection reasons.

Both describe the opt-in, so a reviewer landing on either finds it.

## How do end-users consent to receive messages?

```
Customers opt in in person, at the premises of the business they are visiting.
On that business's check-in form there is a checkbox, separate from every
other field and unchecked by default, which reads:

"I agree to receive SMS text messages from [business name] about my queue
status and appointment updates. Message frequency varies (typically 1-5 per
visit). Msg & data rates may apply. Reply STOP to cancel, HELP for help."

The business name shown is the business the customer is standing in. The
customer ticks the box themselves, either on the counter tablet or on their
own phone after scanning a QR code at the door. Consent is optional and is
never a condition of service - a customer who does not tick it joins the same
queue and is called in person or notified by email. Numbers are never added to
messaging on a customer's behalf, and never purchased or imported.

A live example of the check-in form is at
https://azqueue.io/q/az-tax-services

The programme is described in full at https://azqueue.io/sms, which is linked
from the footer of every page on azqueue.io.
```

## Opt-in keywords

**Leave blank.** The form says so explicitly: *"If you do not support opt-in
via text, please leave this blank."*

Consent is a checkbox on a web form. Nobody texts a keyword to join, so
declaring START and UNSTOP claimed a flow that does not exist — and a reviewer
who cannot verify a declared opt-in path rejects the campaign. That is the most
likely cause of error 30909.

## Opt-in message

**Leave blank**, for the same reason. There is no keyword opt-in, so there is
no auto-reply confirming one.

## Opt-out keywords

```
STOP,STOPALL,UNSUBSCRIBE,CANCEL,END,QUIT
```

## Opt-out message

```
AzQueue: You are unsubscribed and will receive no further messages. Your place in the queue is not affected. Reply HELP for help.
```

## Help keywords

```
HELP,INFO
```

## Help message

```
AzQueue queue notifications. Email hello@azqueue.io for help. Msg & data rates may apply. Reply STOP to opt out.
```

---

## What each rejection meant

**"Issues verifying the Call to Action."** The consent checkbox linked to
`/sms/privacy`, which was never a route, so a reviewer following it got
nothing — and the only visible opt-in lived at a check-in URL they had no
reason to visit. `/sms` now exists, describes the opt-in in full, and is
linked from the site footer. This error did not recur.

**"Website URL does not match the Brand and Campaign registered."** The
campaign pointed at aztaxservices.io while the registered brand is AzQueue.
Everything is back on azqueue.io.

## Submission log

**3 September 2026** — resubmitted with the values in `a2p-answers.md`.
`/sms` and `/sms/privacy` confirmed loading beforehand. Changes from the
rejected campaign: opt-in keywords left blank, sample 5 replaced with the
prayer-pause notice, description states the ISV arrangement in its opening
sentences.

If this one is rejected too, get the TCR code from support before changing
anything — three of the four theories in this file were wrong, and the only
one that held came from asking.

**Approval does not turn SMS on.** Two things are still outstanding: the
Twilio secrets in Supabase Edge Function config, and `VITE_SMS_PENDING=false`
in Vercel. Until both are done an approved campaign sends nothing.

## What aztaxservices.io is still for

Not wasted. Az Tax Services had no web presence, and the domain now gives
their customers a real page, the check-in link, and their own privacy and
terms. It is also the right foundation if Az Tax ever registers its own brand
and sends from its own number rather than through AzQueue's.
