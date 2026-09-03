# Message to send Twilio support

Paste into the support ticket. Written to get one specific thing back — the
TCR rejection reason — rather than a general "please help", which invites a
link to the documentation we have already read.

Keep the subject narrow. A ticket that asks one answerable question gets
answered; one that asks for help with A2P gets a knowledge-base article.

---

**Subject:** A2P Campaign CM48e9d650b7c6d5923c6f103962247b1c — request TCR rejection reason

---

```
Hello,

Our A2P 10DLC campaign has now been rejected three times and the console only
shows Twilio's summarised reason. Could you retrieve the underlying TCR
rejection reason and error code for us?

Brand:            BN31115d42c205fa6eec2795f773bdaee0 (AZQUEUE) - approved,
                  Low Volume Standard
Failed campaign:  CM48e9d650b7c6d5923c6f103962247b1c (Low Volume Mixed)
Messaging Service: MGfb9cd2b29f93447d101a28464e7cd8aa
Number:           +1 430 213 6585

The console has shown us two reasons across the three attempts:
  1. "Issues verifying the Call to Action"
  2. "The provided website URL does not match the Brand and Campaign
      registered"

We have addressed both, and would like to confirm we are fixing the right
thing before submitting a fourth time:

- The website on the customer profile is https://www.azqueue.io. Earlier
  submissions pointed at a customer's own domain; every URL is now on
  azqueue.io.
- Messaging terms: https://azqueue.io/sms - programme name, description,
  message frequency, message and data rates, support contact, and STOP/HELP
  instructions in bold.
- Privacy: https://azqueue.io/sms/privacy - includes the statement that mobile
  opt-in information is never sold, rented or shared with third parties for
  marketing.
- Live opt-in: https://azqueue.io/q/az-tax-services - a checkbox, separate
  from every other field and unchecked by default, on the in-person check-in
  form.

Context that may matter for the review: AzQueue is queue management software.
Messages are sent on behalf of the businesses that use it, and each message
names that business rather than AzQueue, so the recipient knows who is texting
them. Our campaign description states this.

Specifically, we would like to know:

1. What was the exact TCR rejection reason and error code for
   CM48e9d650b7c6d5923c6f103962247b1c?
2. Does anything above still fall short of what the reviewer is checking?

Thank you.
```

---

## What to expect

Twilio support cannot appeal on your behalf or overturn a TCR decision. What
they can do is read you the code, which is the thing the console withholds and
the thing three attempts have been guessing at.

If the reply names a code already covered in
`a2p-campaign-submission.md`, submit the new campaign with confidence. If it
names something else, that is the first hard information in this process and
worth more than any of our inferences.

## Do not send

Screenshots of the app, the source code, or the analysis documents. The
reviewer checks live public URLs and the form fields. Anything else is noise
and slows the reply.
