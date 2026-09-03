# A2P campaign — answers to paste

Every field in form order. Values only, no commentary — the reasoning lives in
`a2p-campaign-submission.md`.

**Before you start:** open `https://azqueue.io/sms` and
`https://azqueue.io/sms/privacy` in a browser. If either 404s, push first.
Error 30891 fails a campaign for a non-functioning website, and both pages are
cited below.

---

### Messaging Service

Select existing → `MGfb9cd2b29f93447d101a28464e7cd8aa`

### Use case

`Low Volume Mixed`

### Campaign description

```
AzQueue is queue management software used by small businesses such as tax preparation offices and immigration services. When a customer visits one of these businesses in person, they can opt in at check-in to receive text notifications about their place in the queue, so they do not have to wait in the waiting room.

Messages are sent by AzQueue on behalf of the business the customer is visiting, and each message names that business so the recipient knows who is texting them. Messages tell the customer their ticket number, when their turn is approaching, and when their turn has arrived, and confirm appointments they have booked.

All messages are transactional and are sent only to customers who ticked the consent box themselves on that business's check-in form. Consent is collected in person on a public web form. We do not send marketing or promotional messages, and phone numbers are never purchased, imported or uploaded.
```

### Sample message 1

```
[Business Name] via AzQueue: You're checked in. Ticket [A24] for [Tax Preparation]. We'll message you when you're up. Reply STOP to opt out.
```

### Sample message 2

```
[Business Name]: You're up - please come to the counter now. Ticket [A24].
```

### Sample message 3

```
[Business Name]: Thanks for visiting! Ticket [A24] is complete. Reply STOP to opt out.
```

### Sample message 4

```
[Business Name]: Hi [First Name]! Your booking for [Service] is confirmed for [Day, Date at Time]. Reply STOP to opt out.
```

### Sample message 5

```
[Business Name]: Pausing briefly for [Prayer]. Your ticket [A24] keeps its place - service resumes at [1:15 PM].
```

### Message contents

Leave all four **unticked**:
- Embedded links — no
- Phone numbers — no
- Direct lending — no
- Age-gated content — no

### How do end-users consent to receive messages?

```
Consent is collected in person, on a public web form, at the business the customer is physically visiting. No login is required and the form can be viewed directly at https://azqueue.io/q/az-tax-services

On that form, below the name, phone and email fields, there is a checkbox. It is unchecked by default and separate from every other field. It reads:

"I agree to receive SMS text messages from [business name] about my queue status and appointment updates. Message frequency varies (typically 1-5 per visit). Msg & data rates may apply. Reply STOP to cancel, HELP for help."

The business name shown is filled in from whichever business the customer is visiting.

Consent is optional and is never a condition of service. A customer who leaves the box unticked joins the same queue, is served in the same order, and is notified by email or called in person instead.

Phone numbers are only ever entered by the person they belong to, on that form. We do not purchase, import or upload numbers, and there is no other opt-in method.

Full programme terms: https://azqueue.io/sms
Privacy policy: https://azqueue.io/sms/privacy
Both are linked from the footer of every page on azqueue.io.
```

### Privacy Policy URL

```
https://azqueue.io/sms/privacy
```

### Terms and Conditions URL

```
https://azqueue.io/sms
```

### Opt-in keywords

**Leave blank.** There is no text-to-join. Declaring keywords for an opt-in
path that does not exist is the most likely cause of the CTA rejection
(error 30909) on the previous campaign.

### Opt-in message

**Leave blank**, for the same reason.

### Opt-out keywords

```
STOP,STOPALL,UNSUBSCRIBE,CANCEL,END,QUIT
```

### Opt-out message

```
AzQueue: You are unsubscribed and will receive no further messages. Your place in the queue is not affected. Reply HELP for help.
```

### Help keywords

```
HELP,INFO
```

### Help message

```
AzQueue queue notifications. Email hello@azqueue.io for help. Msg & data rates may apply. Reply STOP to opt out.
```

---

## Deploy checklist before submitting

- [ ] `git push` — /sms and /sms/privacy must be live
- [ ] `supabase functions deploy send-notification --no-verify-jwt` — so the real message matches sample 1
- [ ] Open `https://azqueue.io/sms` — loads
- [ ] Open `https://azqueue.io/sms/privacy` — loads
- [ ] Open `https://azqueue.io/q/az-tax-services` — the consent checkbox is visible
