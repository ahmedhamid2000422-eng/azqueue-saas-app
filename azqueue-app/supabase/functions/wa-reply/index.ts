/**
 * wa-reply/index.ts — Staff-side actions on a handed-off WhatsApp conversation.
 *
 * The wa-bot function (separate Edge Function) handles inbound customer
 * messages and AI replies. This function is the other half: it's what
 * AzQueue's own frontend calls when a staff member opens the WhatsApp
 * Support Inbox (Settings → Support Inbox) and claims, replies to, or
 * resolves a conversation that the AI handed off.
 *
 * Always called with the signed-in staff member's Supabase access token
 * (Authorization: Bearer <token>) — never with the service role key from
 * the browser. We verify the token ourselves, then look up their staff
 * row to confirm they actually belong to the branch that owns the
 * conversation before doing anything.
 *
 * POST body: { conversationId: string, action: "claim" | "reply" | "resolve", body?: string }
 *
 * REQUIRED SUPABASE SECRETS (same as wa-bot):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY       = Deno.env.get("SUPABASE_ANON_KEY")!;
const TWILIO_SID    = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Verify the calling user via their own access token ──────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!accessToken) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const { data: staffRow } = await admin
      .from("staff")
      .select("id, branch_id, display_name, team")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!staffRow) return json({ error: "No staff profile for this account" }, 403);

    const { conversationId, action, body } = await req.json();
    if (!conversationId || !action) return json({ error: "conversationId and action are required" }, 400);

    const { data: conv } = await admin
      .from("wa_conversations")
      .select("id, branch_id, wa_from, needs_human, claimed_by, assigned_team")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return json({ error: "Conversation not found" }, 404);
    if (conv.branch_id !== staffRow.branch_id) {
      return json({ error: "This conversation belongs to a different branch" }, 403);
    }

    const { data: branch } = await admin
      .from("branches")
      .select("id, name, wa_phone")
      .eq("id", conv.branch_id)
      .maybeSingle();
    if (!branch?.wa_phone) return json({ error: "Branch has no WhatsApp number configured" }, 400);

    // ── Actions ───────────────────────────────────────────────────
    if (action === "claim") {
      await admin.from("wa_conversations").update({
        claimed_by: staffRow.id,
        claimed_at: new Date().toISOString(),
      }).eq("id", conv.id);
      return json({ ok: true });
    }

    if (action === "reply") {
      const text = (body ?? "").trim();
      if (!text) return json({ error: "body is required for a reply" }, 400);

      await admin.from("wa_messages").insert({
        conversation_id: conv.id,
        branch_id: conv.branch_id,
        direction: "out",
        sender: "staff",
        staff_id: staffRow.id,
        body: text,
      });

      // Replying implicitly claims the conversation if nobody has yet.
      const updates: Record<string, unknown> = {};
      if (!conv.claimed_by) {
        updates.claimed_by = staffRow.id;
        updates.claimed_at = new Date().toISOString();
      }
      if (Object.keys(updates).length) {
        await admin.from("wa_conversations").update(updates).eq("id", conv.id);
      }

      await sendWhatsApp(conv.wa_from, branch.wa_phone, text);
      return json({ ok: true });
    }

    if (action === "resolve") {
      // Hands the conversation back to the AI — clears needs_human so the
      // next customer message routes through runSupportTurn() again,
      // instead of staying silently parked on a human forever.
      await admin.from("wa_conversations").update({
        needs_human: false,
        assigned_team: null,
        claimed_by: null,
        claimed_at: null,
      }).eq("id", conv.id);
      return json({ ok: true });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (err) {
    console.error("[wa-reply] Error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
