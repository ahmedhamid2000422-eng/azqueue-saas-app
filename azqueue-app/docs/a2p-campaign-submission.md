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

The business name at the start of each message is filled in from whichever
business the customer visited. "Az Tax Services" below is a live example.

```
1. Az Tax Services: You're checked in. Ticket A24 for Tax Preparation. We'll message you when you're up. Reply STOP to opt out.

2. Az Tax Services: You're up - please come to the counter now. Ticket A24.

3. Az Tax Services: Thanks for visiting! Ticket A24 is complete. Reply STOP to opt out.

4. Az Tax Services: Hi Maria! Your booking for Tax Preparation is confirmed for Tue, Feb 3 at 4:15 PM. Reply STOP to opt out.

5. Az Tax Services: Pausing briefly for Dhuhr. Your ticket A24 keeps its place - service resumes at 1:15 PM.
```

## Content your messages may contain

Leave **all four unticked**. No links, no phone numbers, no lending content,
nothing age-gated.

## Privacy policy URL

```
https://azqueue.io/sms
```

## Terms of service URL

```
https://azqueue.io/legal/terms
```

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

No spaces. Twilio validates each keyword as alphanumeric and a space after the
comma fails. If the field still objects, enter them one at a time.

```
START,UNSTOP
```

## Opt-in message

```
AzQueue: You are subscribed to queue notifications. Message frequency varies, typically 1-5 per visit. Msg & data rates may apply. Reply STOP to opt out, HELP for help.
```

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

## What aztaxservices.io is still for

Not wasted. Az Tax Services had no web presence, and the domain now gives
their customers a real page, the check-in link, and their own privacy and
terms. It is also the right foundation if Az Tax ever registers its own brand
and sends from its own number rather than through AzQueue's.
