/**
 * seed.js — Insert test data into the channel-api tables.
 *
 * Run: node db/seed.js
 * Requires: .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *           A valid branch_id from your Supabase `branches` table
 *
 * What it creates:
 *   - 3 test customers (email, phone, and WhatsApp-only)
 *   - 5 customer_events across different channels
 *   - 1 enrich_cache entry (pre-expired so /enrich will re-generate it)
 */

import "dotenv/config";
import { db } from "../src/db.js";

// ─────────────────────────────────────────────────────────────────────
// ⬇  Set this to any existing branch_id in your Supabase project
const BRANCH_ID = process.env.SEED_BRANCH_ID ?? "00000000-0000-0000-0000-000000000000";
// ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding channel-api test data...\n");

  // ── 1. Customers ────────────────────────────────────────────────────
  const { data: customers, error: cErr } = await db
    .from("customers")
    .upsert([
      {
        branch_id:    BRANCH_ID,
        display_name: "Ahmed Hamid",
        email:        "ahmed@example.com",
        phone:        "+15551234567",
        last_seen_at: new Date().toISOString(),
      },
      {
        branch_id:    BRANCH_ID,
        display_name: "Sara Al-Mansoori",
        whatsapp_id:  "+966501234567",
        last_seen_at: new Date(Date.now() - 86_400_000).toISOString(), // yesterday
      },
      {
        branch_id:    BRANCH_ID,
        display_name: "Test Facebook User",
        facebook_id:  "fb_psid_12345678",
        last_seen_at: new Date(Date.now() - 3_600_000).toISOString(),  // 1h ago
      },
    ], { onConflict: "branch_id,email", ignoreDuplicates: false })
    .select("id, display_name");

  if (cErr) { console.error("Customer seed error:", cErr.message); process.exit(1); }
  console.log("✓ Customers:", customers.map((c) => c.display_name).join(", "));

  const [ahmed, sara, fbUser] = customers;

  // ── 2. Events ───────────────────────────────────────────────────────
  const events = [
    {
      customer_id: ahmed.id,
      branch_id:   BRANCH_ID,
      channel:     "queue",
      event_type:  "queue_join",
      direction:   "inbound",
      content:     "Joined queue — ticket #A001",
      external_id: "ticket_A001_join",
    },
    {
      customer_id: ahmed.id,
      branch_id:   BRANCH_ID,
      channel:     "email",
      event_type:  "message",
      direction:   "inbound",
      content:     "Hi, I'd like to know the status of my application.",
      external_id: "email_msg_001",
    },
    {
      customer_id: ahmed.id,
      branch_id:   BRANCH_ID,
      channel:     "email",
      event_type:  "message",
      direction:   "outbound",
      content:     "Hello Ahmed, your application is under review. We'll contact you within 2 business days.",
      external_id: "email_msg_002",
    },
    {
      customer_id: sara.id,
      branch_id:   BRANCH_ID,
      channel:     "whatsapp",
      event_type:  "message",
      direction:   "inbound",
      content:     "Hello, is the service available on weekends?",
      external_id: "wa_msg_001",
    },
    {
      customer_id: fbUser.id,
      branch_id:   BRANCH_ID,
      channel:     "facebook",
      event_type:  "message",
      direction:   "inbound",
      content:     "What are your opening hours?",
      external_id: "fb_msg_001",
    },
  ];

  const { error: eErr } = await db
    .from("customer_events")
    .upsert(events, { onConflict: "branch_id,channel,external_id", ignoreDuplicates: true });

  if (eErr) { console.error("Events seed error:", eErr.message); process.exit(1); }
  console.log(`✓ Events: ${events.length} inserted`);

  // ── 3. Pre-expired cache entry (to test /enrich regeneration) ───────
  const { error: cachErr } = await db
    .from("enrich_cache")
    .upsert({
      customer_id:        ahmed.id,
      summary:            "Ahmed is a returning customer who joined the queue and followed up via email.",
      sentiment:          "neutral",
      key_issues:         ["queue status", "email follow-up"],
      recommended_action: "Check application status and update Ahmed proactively.",
      model:              "claude-haiku-4-5-20251001",
      generated_at:       new Date(Date.now() - 25 * 3_600_000).toISOString(), // 25h ago
      expires_at:         new Date(Date.now() - 3_600_000).toISOString(),       // expired 1h ago
    }, { onConflict: "customer_id" });

  if (cachErr) console.warn("Cache seed warning:", cachErr.message);
  else         console.log("✓ Enrich cache: 1 pre-expired entry for Ahmed");

  console.log("\n✅ Seed complete. Try:\n");
  console.log(`  curl -X POST http://localhost:3001/enrich/${ahmed.id} \\`);
  console.log(`    -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json"\n`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
