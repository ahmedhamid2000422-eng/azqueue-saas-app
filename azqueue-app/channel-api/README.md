# AzQueue Channel API

Node.js/Express webhook receiver and customer identity API for AzQueue.

Runs alongside the main React + Supabase app. Its job:

1. **Receive** inbound webhooks from WhatsApp, Facebook Messenger, Instagram, etc.
2. **Normalize** phone numbers, emails, and social IDs into canonical form.
3. **Match** the sender to an existing customer (or create one) in Supabase.
4. **Log** every touchpoint to the `customer_events` timeline.
5. **Enrich** customer profiles on demand via Claude claude-haiku-4-5-20251001 (cached 24 h).

---

## Quick start

```bash
cd channel-api
cp .env.example .env       # fill in your values
npm install
npm run dev                # starts on http://localhost:3001
```

Apply the supplemental schema (after running Supabase migrations 0001–0012):

```bash
# In Supabase SQL editor — paste contents of db/schema.sql
```

Seed test data:

```bash
SEED_BRANCH_ID=your-branch-uuid npm run seed
```

---

## Project layout

```
channel-api/
├── db/
│   ├── schema.sql          ← enrich_cache + webhook_log tables (run in Supabase)
│   └── seed.js             ← test data
├── src/
│   ├── db.js               ← Supabase service-role client
│   ├── lib/
│   │   ├── normalize.js    ← phone/email/name canonicalization
│   │   └── match.js        ← find-or-create customer, log events
│   └── routes/
│       ├── identify.js     ← POST /identify   (core ingestion endpoint)
│       ├── customers.js    ← GET/PATCH/DELETE /customers
│       └── enrich.js       ← POST /enrich/:id (LLM, cached)
├── server.js               ← Express app
├── package.json
└── .env.example
```

---

## API reference

### `POST /identify`

Find or create a customer. Optionally log an event in the same request.

```json
{
  "branchId": "uuid",
  "name": "Ahmed Hamid",
  "email": "ahmed@example.com",
  "phone": "+1 555 123 4567",
  "country": "US",
  "event": {
    "channel": "whatsapp",
    "eventType": "message",
    "direction": "inbound",
    "content": "Hello, I need help.",
    "externalId": "wa_msg_xyz"
  }
}
```

Response `201` (new) or `200` (existing):

```json
{
  "customer": { "id": "...", "display_name": "Ahmed Hamid", ... },
  "created": true,
  "event": { "id": "...", "channel": "whatsapp", ... }
}
```

---

### `GET /customers?branch_id=&search=&limit=&offset=`

List customers for a branch.

### `GET /customers/:id`

Single customer with full timeline + enrichment (if cached and valid).

### `PATCH /customers/:id`

Update customer fields. Allowed: `display_name email phone tags vip facebook_id instagram_id whatsapp_id freshdesk_id avatar_url`.

### `DELETE /customers/:id`

Deletes the customer and all their events (cascade).

### `GET /customers/:id/events?limit=&offset=&direction=inbound|outbound`

Paginated event timeline.

### `POST /customers/:id/events`

Manually log an event:

```json
{
  "channel": "email",
  "eventType": "message",
  "direction": "inbound",
  "content": "Customer sent a follow-up email",
  "externalId": "email_msg_007"
}
```

---

### `POST /enrich/:customerId`

Generate (or return cached) LLM summary.

```bash
curl -X POST http://localhost:3001/enrich/CUSTOMER_ID \
  -H "x-api-key: $CHANNEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

Response:

```json
{
  "customerId": "...",
  "summary": "Ahmed is a repeat customer who joined the queue and followed up by email.",
  "sentiment": "neutral",
  "key_issues": ["queue status", "email follow-up"],
  "recommended_action": "Proactively update Ahmed on his application status.",
  "generated_at": "2026-05-22T10:00:00.000Z",
  "cached": false
}
```

Pass `"force": true` to bypass the 24-hour cache.

---

## Authentication

Every request must include the header:

```
x-api-key: YOUR_CHANNEL_API_KEY
```

Set `CHANNEL_API_KEY` in `.env`. Leave it empty to disable auth in development.

The service uses the Supabase **service_role** key internally — this bypasses RLS. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

---

## Adding a new channel webhook

1. Add the channel to the `check` constraint in `0012_messaging.sql` (already done for fb/ig/wa/email/freshdesk).
2. Create `src/routes/webhooks/<channel>.js` with:
   - `GET /<channel>` — verification handshake (Meta requires this)
   - `POST /<channel>` — extract sender ID + message, call `POST /identify`, done.
3. Mount it in `server.js` before `express.json()` (raw body for signature check).

That's the whole integration. Everything else — identity resolution, timeline logging, UI display — already works.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role key (server-side only) |
| `PORT` | — | HTTP port (default: 3001) |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |
| `CHANNEL_API_KEY` | — | Shared secret for x-api-key header |
| `ANTHROPIC_API_KEY` | — | Required for `/enrich` route |
| `ENRICH_MODEL` | — | Claude model (default: claude-haiku-4-5-20251001) |
| `ENRICH_CACHE_HOURS` | — | Cache TTL in hours (default: 24) |
| `META_VERIFY_TOKEN` | — | For Facebook/Instagram webhook verification |
| `META_APP_SECRET` | — | For webhook payload signature verification |
