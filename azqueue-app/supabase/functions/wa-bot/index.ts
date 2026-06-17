/**
 * wa-bot/index.ts — WhatsApp AI Receptionist
 *
 * Supabase Edge Function (Deno runtime).
 * Registered as a Twilio WhatsApp webhook: POST /functions/v1/wa-bot
 *
 * HOW IT WORKS
 * ─────────────
 * 1. Twilio calls this endpoint every time a customer sends a WhatsApp message.
 * 2. We look up (or create) an active wa_conversation for this phone + branch.
 * 3. We run a state machine to decide what to ask / do next.
 * 4. We use Claude (claude-haiku) for natural language understanding when needed.
 * 5. We reply with a Twilio TwiML response (or REST API call).
 * 6. On completion we score the lead and upsert the customer record.
 *
 * REQUIRED SUPABASE SECRETS (set with `supabase secrets set`):
 *   SUPABASE_URL               (auto-set by Supabase)
 *   SUPABASE_SERVICE_ROLE_KEY  (auto-set by Supabase)
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   ANTHROPIC_API_KEY          (for Claude lead scoring summary)
 *
 * TWILIO SETUP
 *   In Twilio Console → Messaging → WhatsApp Senders
 *   Set the "A MESSAGE COMES IN" webhook to:
 *   https://<project>.supabase.co/functions/v1/wa-bot
 *   Method: HTTP POST
 *
 * ROUTING BY BRANCH
 *   The "To" field in the Twilio payload is the WhatsApp number.
 *   We match it against branches.wa_phone to find which branch this belongs to.
 */

import { createClient }  from "https://esm.sh/@supabase/supabase-js@2";
import { resolveFlow }   from "./flows.ts";
import { scoreContext, buildSummary } from "./score.ts";
import { runSupportTurn } from "./support.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const TWILIO_SID    = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Twilio helper ─────────────────────────────────────────────────────────────

async function sendWhatsApp(to: string, from: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const params = new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${from}`, Body: body });
  const encoded = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

// ── Slack helper ──────────────────────────────────────────────────────────────
// Outbound-only: looks up the branch's Slack Incoming Webhook URL (saved by the
// owner himself via Settings → Integrations → Slack) and posts a plain message.
// No-ops silently if Slack isn't connected, same as the frontend's sendSlackNotification
// in src/lib/slack.js — this is the server-side equivalent for use inside Edge Functions.
async function notifySlack(branchId: string, text: string) {
  try {
    const { data } = await supabase
      .from("channel_connections")
      .select("config")
      .eq("branch_id", branchId)
      .eq("channel", "slack")
      .maybeSingle();
    const webhookUrl = data?.config?.webhookUrl;
    if (!webhookUrl) return;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("[wa-bot] Slack notification failed:", e);
  }
}

// Twilio expects an empty 200 or TwiML 200 — we reply via REST API above, so return empty 204.
function ok() { return new Response("", { status: 204 }); }

// ── Claude helper ─────────────────────────────────────────────────────────────

async function claudeSummary(
  context: Record<string, unknown>,
  branchName: string,
  tone: string,
): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        system: `You write concise CRM lead summaries in 1–2 sentences. Tone: ${tone}. Be factual.`,
        messages: [{
          role: "user",
          content: `Write a CRM summary for this lead at ${branchName}:\n${JSON.stringify(context, null, 2)}`,
        }],
      }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── State machine ─────────────────────────────────────────────────────────────

type ConvRow = {
  id: string;
  branch_id: string;
  wa_from: string;
  state: string;
  context: Record<string, unknown>;
  lead_score: string | null;
  customer_id: string | null;
  completed: boolean;
  needs_human: boolean;
  assigned_team: string | null;
};

type BranchRow = {
  id: string;
  name: string;
  business_type: string;
  wa_phone: string;
  wa_flow_config: Record<string, unknown>;
};

async function processMessage(
  branch: BranchRow,
  conv: ConvRow | null,
  fromPhone: string,
  userText: string,
): Promise<string> {
  const flow = resolveFlow(branch.business_type, branch.wa_flow_config as any);
  const branchName = branch.name;

  // ── NEW CONVERSATION ───────────────────────────────────────
  if (!conv || conv.completed) {
    // Create a fresh session
    const { data: newConv } = await supabase
      .from("wa_conversations")
      .insert({ branch_id: branch.id, wa_from: fromPhone, state: "menu", context: {} })
      .select()
      .single();

    // Build numbered menu
    const menu = flow.menu_items
      .map((m, i) => `${i + 1}. ${m.label}`)
      .join("\n");

    const welcome = flow.welcome.replace("{{branch}}", branchName);
    return `${welcome}\n\nPlease choose one:\n${menu}`;
  }

  const ctx = conv.context;
  let state = conv.state;

  // ── HANDLE "restart" / "hi" / "hello" at any point ────────
  const lower = userText.toLowerCase().trim();
  if (["hi", "hello", "hey", "start", "menu", "restart"].includes(lower)) {
    await supabase
      .from("wa_conversations")
      .update({ completed: true })
      .eq("id", conv.id);

    const menu = flow.menu_items.map((m, i) => `${i + 1}. ${m.label}`).join("\n");
    const welcome = flow.welcome.replace("{{branch}}", branchName);

    // Insert fresh conversation
    await supabase
      .from("wa_conversations")
      .insert({ branch_id: branch.id, wa_from: fromPhone, state: "menu", context: {} });

    return `${welcome}\n\nPlease choose one:\n${menu}`;
  }

  // ── MENU STATE ─────────────────────────────────────────────
  if (state === "menu") {
    // Parse numeric choice or keyword match
    const num = parseInt(userText.trim(), 10);
    let chosen = flow.menu_items[num - 1];
    if (!chosen) {
      // Fuzzy match on label
      chosen = flow.menu_items.find(
        (m) => m.label.toLowerCase().includes(lower) || m.id === lower
      ) ?? flow.menu_items[0];
    }

    // Booking shortcut
    if (chosen.id === "booking") {
      await supabase.from("wa_conversations").update({
        state: "booking_date",
        context: { ...ctx, service_category: "Consultation Booking" },
      }).eq("id", conv.id);

      return `📅 Great! Let's book your consultation.\n\nWhat date works for you?\n_(e.g. "Monday 16 June" or "this Friday")_`;
    }

    // General inquiry → hand over to free-form AI customer service instead
    // of a static "our team will reach out" message. The conversation stays
    // open (not completed) — every following message from this customer
    // routes through the support_ai branch below until the AI itself
    // decides a human is needed.
    if (chosen.id === "general") {
      await supabase.from("wa_conversations").update({
        state: "support_ai",
        context: { ...ctx, service_category: "General Inquiry" },
      }).eq("id", conv.id);

      const transitionMsg =
        "Sure thing — what can I help you with? Ask me anything and I'll do my best to help right away.";

      await supabase.from("wa_messages").insert([
        { conversation_id: conv.id, branch_id: branch.id, direction: "in", sender: "customer", body: userText },
        { conversation_id: conv.id, branch_id: branch.id, direction: "out", sender: "ai", body: transitionMsg },
      ]);

      return transitionMsg;
    }

    // All other services → start qualification questions
    await supabase.from("wa_conversations").update({
      state: "qualifying_0",
      context: { ...ctx, service_category: chosen.label },
    }).eq("id", conv.id);

    return flow.questions[0].ask;
  }

  // ── QUALIFYING QUESTIONS ───────────────────────────────────
  if (state.startsWith("qualifying_")) {
    const idx = parseInt(state.split("_")[1], 10);
    const question = flow.questions[idx];

    // Save this answer
    const newCtx = { ...ctx, [question.key]: userText.trim() };
    const nextIdx = idx + 1;

    if (nextIdx < flow.questions.length) {
      const nextQ = flow.questions[nextIdx];
      await supabase.from("wa_conversations").update({
        state: `qualifying_${nextIdx}`,
        context: newCtx,
      }).eq("id", conv.id);

      return nextQ.ask;
    }

    // All questions answered — score the lead
    const { score, next_action } = scoreContext(newCtx as any);
    const aiSummary = await claudeSummary(newCtx, branchName, flow.brand_tone);
    const summary = aiSummary ?? buildSummary(newCtx as any, score);

    // Upsert customer record
    const customerResult = await upsertLeadCustomer(branch.id, fromPhone, newCtx, score, next_action, summary);

    await supabase.from("wa_conversations").update({
      state: "done",
      context: { ...newCtx, next_action, summary },
      lead_score: score,
      customer_id: customerResult?.id ?? null,
      completed: true,
    }).eq("id", conv.id);

    return flow.handoff_msg;
  }

  // ── FREE-FORM AI CUSTOMER SERVICE ───────────────────────────
  // Entered from the "General Inquiry" menu choice above. Stays in this
  // state indefinitely — there's no "done" for an open-ended support
  // chat. Two phases:
  //   1. needs_human === false → AI answers directly, deciding for
  //      itself (via support.ts) whether/which team to hand off to.
  //   2. needs_human === true  → a human already owns this conversation.
  //      We still log the customer's message (so staff see it in the
  //      transcript) but suppress further auto-replies — replying from
  //      here on is the assigned team's job, via the wa-reply function.
  if (state === "support_ai") {
    if (conv.needs_human) {
      await supabase.from("wa_messages").insert({
        conversation_id: conv.id,
        branch_id: branch.id,
        direction: "in",
        sender: "customer",
        body: userText,
      });
      return ""; // no auto-reply — a human owns this conversation now
    }

    const result = await runSupportTurn(supabase, ANTHROPIC_KEY, branch, conv, userText);

    if (result.handoff) {
      await supabase.from("wa_conversations").update({
        needs_human: true,
        assigned_team: result.team,
        context: { ...ctx, handoff_reason: result.reason },
      }).eq("id", conv.id);

      const teamLabel = result.team ? `*${result.team}*` : "a team member";
      notifySlack(
        branch.id,
        `🤝 WhatsApp AI handed off a conversation from ${conv.wa_from} to ${teamLabel}` +
          (result.reason ? `\n_Reason: ${result.reason}_` : "")
      ).catch(() => {});
    }

    return result.reply;
  }

  // ── BOOKING FLOW ───────────────────────────────────────────
  if (state === "booking_date") {
    await supabase.from("wa_conversations").update({
      state: "booking_time",
      context: { ...ctx, preferred_date: userText.trim() },
    }).eq("id", conv.id);

    return `⏰ And what time works best?\n_(e.g. "10am", "2pm", "morning")_`;
  }

  if (state === "booking_time") {
    await supabase.from("wa_conversations").update({
      state: "booking_purpose",
      context: { ...ctx, preferred_time: userText.trim() },
    }).eq("id", conv.id);

    return `What is the purpose of your visit?\n1. 🗣 Consultation / planning\n2. 🔍 Materials / showroom viewing\n3. 💰 Quotation discussion`;
  }

  if (state === "booking_purpose") {
    const newCtx = { ...ctx, booking_purpose: userText.trim() };

    // Score as HOT (they self-selected booking)
    const score = "HOT" as const;
    const next_action = "Book consultation" as const;
    const summary = `Booking request: ${newCtx.preferred_date} at ${newCtx.preferred_time}. Purpose: ${newCtx.booking_purpose}.`;

    await upsertLeadCustomer(branch.id, fromPhone, newCtx, score, next_action, summary);

    await supabase.from("wa_conversations").update({
      state: "done",
      context: newCtx,
      lead_score: score,
      completed: true,
    }).eq("id", conv.id);

    return `✅ Your appointment request has been received!\n\n📅 *Date:* ${newCtx.preferred_date}\n⏰ *Time:* ${newCtx.preferred_time}\n\nOur team will confirm shortly. Thank you! 😊`;
  }

  // Fallback for completed sessions
  const menu = flow.menu_items.map((m, i) => `${i + 1}. ${m.label}`).join("\n");
  return `Hi again! 👋 How can I help?\n\n${menu}`;
}

// ── Customer upsert ───────────────────────────────────────────────────────────

async function upsertLeadCustomer(
  branchId: string,
  phone: string,
  ctx: Record<string, unknown>,
  score: string,
  next_action: string,
  summary: string,
) {
  const name = (ctx.name as string) ?? phone;

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("branch_id", branchId)
    .eq("phone", phone)
    .maybeSingle();

  const payload = {
    branch_id:   branchId,
    name,
    phone,
    lead_score:  score,
    lead_source: "whatsapp",
    lead_data: {
      service_category: ctx.service_category,
      property_type:    ctx.property_type,
      location:         ctx.location,
      budget_range:     ctx.budget_range,
      timeline:         ctx.timeline,
      requirements:     ctx.requirements,
      next_action,
      summary,
    },
  };

  if (existing) {
    const { data } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    return data;
  } else {
    const { data } = await supabase
      .from("customers")
      .insert(payload)
      .select("id")
      .single();
    return data;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Parse Twilio form body
    const text = await req.text();
    const params = new URLSearchParams(text);

    const fromRaw = params.get("From") ?? "";         // e.g. "whatsapp:+60123456789"
    const toRaw   = params.get("To")   ?? "";         // e.g. "whatsapp:+60198765432"
    const body    = (params.get("Body") ?? "").trim();

    const fromPhone = fromRaw.replace("whatsapp:", "");
    const toPhone   = toRaw.replace("whatsapp:",   "");

    if (!fromPhone || !body) return ok();

    // Look up branch by their WA number
    const { data: branch } = await supabase
      .from("branches")
      .select("id, name, business_type, wa_phone, wa_flow_config")
      .eq("wa_phone", toPhone)
      .eq("wa_enabled", true)
      .maybeSingle();

    if (!branch) {
      console.warn("[wa-bot] No active branch found for", toPhone);
      return ok();
    }

    // Fetch active (non-completed) conversation for this phone
    const { data: conv } = await supabase
      .from("wa_conversations")
      .select("*")
      .eq("branch_id", branch.id)
      .eq("wa_from", fromPhone)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Run state machine
    const reply = await processMessage(branch, conv, fromPhone, body);

    // Empty reply means "stay silent" — used once a human has taken over
    // a support_ai conversation (needs_human), so the AI doesn't talk over
    // whichever staff member is now handling it.
    if (reply) {
      await sendWhatsApp(fromPhone, toPhone, reply);
    }

    return ok();

  } catch (err) {
    console.error("[wa-bot] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
