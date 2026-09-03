# Reply to ticket #29333462 — error 30909

Abhay gave us the code and then invited exactly this: *"If you feel the
rejection doesn't match your submission, please explain how your campaign is
already compliant and why it doesn't fit the error code provided."* The case
has also been passed to the 10DLC Onboarding team, so this reply lands in
front of people who can actually assess it.

**30909 is Call to Action** — the reviewer could not verify where consent is
collected. Not the website mismatch. Every domain change we made was fixing an
error that had already stopped being reported.

## Send only after deploying

The reply below points at `azqueue.io/sms` and `azqueue.io/sms/privacy`. If a
reviewer opens either before the deploy and gets a 404, the case is worse than
if we had said nothing. **Open both in a browser first.**

---

```
Hi Abhay,

Thank you — error code 30909 is exactly what we needed, and it changes what we
were working on. We had been addressing the website URL error from an earlier
attempt; knowing the current rejection is Call to Action tells us where to
focus.

We believe the campaign is compliant, and I would be grateful if the
onboarding team could tell us which part of the CTA is not verifiable, because
we cannot see it from our side.

WHERE CONSENT IS COLLECTED

Consent is collected in person, on a public web form at the business the
customer is physically visiting. It requires no login and can be opened
directly:

  https://azqueue.io/q/az-tax-services

Scrolling down that page, below the name, phone and email fields, there is a
checkbox — unchecked by default and separate from every other field — reading:

  "I agree to receive SMS text messages from Az Tax Services about my queue
   status and appointment updates. Message frequency varies (typically 1-5 per
   visit). Msg & data rates may apply. Reply STOP to cancel, HELP for help."

The business name in that sentence is filled in from whichever business the
customer is visiting. Az Tax Services is a live example.

Consent is optional. A customer who leaves the box unticked joins the same
queue, is served in the same order, and is notified by email or called in
person instead. Nothing is withheld from anyone who declines.

Phone numbers are only ever entered by the person they belong to, on that
form. We never purchase, import or upload numbers.

SUPPORTING DOCUMENTS

  Messaging terms:  https://azqueue.io/sms
  Messaging privacy: https://azqueue.io/sms/privacy

Both are linked from the footer of every page on azqueue.io, under "Company".
The terms page lists the programme name, description, message frequency,
message and data rates, support contact, and STOP/HELP instructions. The
privacy page states that mobile opt-in information is never sold, rented or
shared with third parties or affiliates for marketing.

WHY OUR MESSAGES NAME A DIFFERENT COMPANY

AzQueue is queue management software. Messages are sent by AzQueue on behalf
of the businesses that use it, and each message names that business rather
than AzQueue, so the recipient knows which office is texting them. If the
reviewer has read that as an inconsistency between the brand and the message
content, that would explain the rejection — and we would be glad to word the
campaign description differently if there is a preferred way for an ISV to
declare this.

WHAT WOULD HELP US MOST

  1. Which specific element of the CTA could not be verified — the opt-in
     page, the wording of the consent, the disclosure documents, or something
     else?
  2. If the opt-in page itself was not reachable during review, we would like
     to know, as it is publicly accessible and we can confirm it is live.

Brand:             BN31115d42c205fa6eec2795f773bdaee0 (AZQUEUE)
Rejected campaign: CM48e9d650b7c6d5923c6f103962247b1c
Messaging Service: MGfb9cd2b29f93447d101a28464e7cd8aa

Thank you for your help.
```

---

## If they come back with the standard answer

Some reviewers want a **hosted screenshot** of the opt-in rather than a live
URL — that is what the guidance means by "provide a hosted link to the image
of opt-in" when consent is behind a login or on paper. Ours is a public page,
so a link should suffice. If they ask for an image anyway: screenshot the
check-in form with the checkbox visible, host it somewhere public, and send
the link.

## What this changes about the resubmission

The CTA is the live problem, so the parts of `a2p-campaign-submission.md`
worth most attention are the consent description and the two disclosure URLs.
The bracketed sample messages and the use-case notes still stand — they were
never the reported failure, but they are correct now either way.
