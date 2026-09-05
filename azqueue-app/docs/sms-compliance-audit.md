# SMS compliance audit — 4 September 2026

Campaign `CM9d4930a3a84ff613446b2ae3155b99af` is approved. Carriers compare
real traffic against the five sample messages declared on it. This is an
audit of what the code actually sends versus what was registered.

## The five approved samples

```
1. [Business Name] via AzQueue: You're checked in. Ticket [A24] for [Tax Preparation]. We'll message you when you're up. Reply STOP to opt out.
2. [Business Name]: You're up - please come to the counter now. Ticket [A24].
3. [Business Name]: Thanks for visiting! Ticket [A24] is complete. Reply STOP to opt out.
4. [Business Name]: Hi [First Name]! Your booking for [Service] is confirmed for [Day, Date at Time]. Reply STOP to opt out.
5. [Business Name]: Pausing briefly for [Prayer]. Your ticket [A24] keeps its place - service resumes at [1:15 PM].
```

Also declared: **no embedded links**, **no embedded phone numbers**.

## There are two SMS systems, not one

### `supabase/functions/send-notification` — COMPLIANT

Server-side, uses the Twilio secrets. Its five templates match the five
approved samples word for word, because the samples were written from these
templates. This is the path that should be the only one.

### `src/lib/notify.js` — NOT COMPLIANT, and still wired in

Client-side, uses the `VITE_TWILIO_*` variables that were **deleted from
Vercel** during the security cleanup. Its `sendSms` returns early when
credentials are missing, so **nothing here currently sends.**

That is the only reason this is not a live compliance problem. It is
accidental safety, not designed safety: re-add those environment variables
and five undeclared message formats start going out immediately.

| Function | Problem |
|---|---|
| `sendCheckinConfirmation` | Opens "AzQueue: Hi [name], you joined the queue at…" — sample 1 opens with the *business* name, and the wording differs throughout |
| `sendCalledNotification` | "AzQueue: [name], it's your turn!" — sample 2 opens with the business name and reads differently |
| `sendWaitUpdate` | "you're still #N in line" — **no matching sample exists** |
| `sendBroadcastAlert` | Sends whatever free text staff typed — **unmatchable by definition** |
| `sendClassReminder` | **Contains a link** (`/confirm/[id]`), and the campaign declares no embedded links |

Still-live callers: `useCheckin.js`, `useQueue.js`, `Queue.jsx` (line ~822),
`alerts.js`, `Classes.jsx`.

## The pause broadcast added today

The "Tell the N waiting" button on the pause banner routes through
`broadcastToQueue` → `sendBroadcastAlert` → the dead client path. So in
practice it currently sends **email only**, and no SMS.

That is the right outcome for now, but by accident. Two things are true:

1. Its text — "We've paused the queue for a short while. Your place is
   kept…" — is not one of the five samples. Sample 5 is a *prayer* pause
   with a named prayer and a resume time; this is a manual pause with
   neither.
2. Free-text staff broadcasts can never match a declared sample.

**Before enabling SMS for either, a sample has to be added to the campaign.**
A registered campaign's samples can be edited; that is cheaper than a
rejection or, worse, carrier filtering after approval.

## What should happen

1. **Delete `src/lib/notify.js`** and repoint its five callers at
   `lib/notifications.js`, which invokes the compliant edge function. This
   removes the loaded gun rather than trusting that nobody reloads it.
2. **Keep broadcasts email-only** unless a generic-alert sample is added to
   the campaign.
3. **Fix `sendClassReminder`'s link** or stop using it — links are declared
   off, and gym mode is not in use at Az Tax Services anyway.
4. **Add a pause sample** to the campaign if pause-by-SMS is wanted:
   `[Business Name]: We've paused the queue briefly. Your ticket [A24] keeps
   its place - we'll message you when we start again. Reply STOP to opt out.`

## What is safe right now

Every message that actually reaches a phone today goes through
`send-notification`, and every one of those matches an approved sample. The
non-compliant code exists but is inert.

The risk is not today. It is the day someone re-adds `VITE_TWILIO_ACCOUNT_SID`
to Vercel to "fix SMS" without knowing this file exists.

## Multilingual — screens yes, texts no

Added 5 September, when the check-in flow gained Amharic, Tigrinya, Spanish
and Chinese alongside English and Arabic.

**The interface is translated. The SMS templates are not, and must not be.**

Campaign `CM9d4930a3a84ff613446b2ae3155b99af` was approved with five English
sample messages. `send-notification` sends exactly those five, in English,
whatever language the customer picked at the kiosk. That mismatch is
deliberate and it is what keeps the campaign compliant.

Translating the templates would mean real traffic no longer matches the
declared samples — undeclared traffic on a registered campaign, the same
category as the checklist SMS that is gated off above. It is how carriers
start filtering, and filtering is far harder to undo than a rejection.

So a customer reads the kiosk in Tigrinya and receives an English
confirmation. Imperfect, and worth fixing eventually — but it works today,
and it costs nothing.

**Do not open the campaign to add translated samples.** Ahmed's position, 5
September: the campaign took four rejections to approve, editing an approved
campaign may trigger re-review, and nobody has confirmed either way. The
approval is worth more than multilingual texts.

If this is ever revisited, the sequence is: ask Twilio support whether
editing samples on an approved campaign triggers re-review, get an answer in
writing, and only then decide. Not before.

**Email has no such constraint** and is already the primary channel — that
is the place to add languages if the messages need translating.
