/**
 * wa-bot/support.ts — Free-form AI customer service turn handler.
 *
 * This is the "general inquiry" upgrade: instead of dropping a static
 * handoff message the moment a customer picks "General Inquiry" from the
 * menu, wa_conversations moves into a `support_ai` state (see index.ts)
 * and every subsequent customer message is routed through runSupportTurn()
 * here. The AI:
 *   1. answers directly when it reasonably can, OR
 *   2. decides the conversation needs a human, and picks WHICH team
 *      (support / sales / billing / ...) based on its own judgement of
 *      the conversation — not keyword rules.
 *
 * This matches the two scope decisions the business owner made:
 *   - "Full auto-reply, then handoff" — no human approves replies before
 *     they're sent; the AI replies immediately, and only loops a human in
 *     once it decides to.
 *   - "AI classifies + routes" — the AI reads the conversation and picks
 *     the team itself from whatever teams exist on `staff.team` for this
 *     branch, rather than a fixed keyword→team mapping.
 *
 * Uses Anthropic's forced tool-use (`tool_choice: {type:"tool", ...}`)
 * instead of parsing free text, because this decision (handoff: yes/no,
 * which team) drives real system behavior — unlike claudeSummary() in
 * index.ts, which just produces a CRM note and can tolerate free text.
 */

// deno-lint-ignore-file no-explicit-any

type SupabaseClient = any;

export type SupportResult = {
  reply: string;
  handoff: boolean;
  team: string | null;
  reason: string | null;
};

type BranchLike = { id: string; name: string };
type ConvLike = { id: string };

const FALLBACK_REPLY =
  "Thanks for your message — let me get a team member to help with that.";

export async function runSupportTurn(
  supabase: SupabaseClient,
  anthropicKey: string | undefined,
  branch: BranchLike,
  conv: ConvLike,
  userText: string,
): Promise<SupportResult> {
  // Log the customer's message first, regardless of what happens next —
  // the transcript should be complete even if the AI call below fails.
  await supabase.from("wa_messages").insert({
    conversation_id: conv.id,
    branch_id: branch.id,
    direction: "in",
    sender: "customer",
    body: userText,
  });

  // Pull recent transcript for context (customer + ai + staff turns).
  const { data: history } = await supabase
    .from("wa_messages")
    .select("sender, body")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true })
    .limit(30);

  // Teams this branch has actually defined (staff.team, added in 0029).
  // The AI can only route to a team that exists — no guessing department
  // names that aren't real.
  const { data: teamRows } = await supabase
    .from("staff")
    .select("team")
    .eq("branch_id", branch.id)
    .not("team", "is", null);
  const teams = Array.from(
    new Set((teamRows ?? []).map((r: { team: string | null }) => r.team).filter(Boolean)),
  ) as string[];

  if (!anthropicKey) {
    // No ANTHROPIC_API_KEY secret set — can't run free-form AI replies,
    // so fail safe to an immediate handoff rather than going silent.
    const reply = FALLBACK_REPLY;
    await supabase.from("wa_messages").insert({
      conversation_id: conv.id,
      branch_id: branch.id,
      direction: "out",
      sender: "ai",
      body: reply,
    });
    return { reply, handoff: true, team: teams[0] ?? null, reason: "AI not configured (ANTHROPIC_API_KEY missing)" };
  }

  const transcript = (history ?? [])
    .map((m: { sender: string; body: string }) => {
      const label = m.sender === "customer" ? "Customer" : m.sender === "staff" ? "Staff" : "AI";
      return `${label}: ${m.body}`;
    })
    .join("\n");

  const teamList = teams.length ? teams.join(", ") : "(no teams configured yet)";

  const tool = {
    name: "respond_or_handoff",
    description:
      "Decide how to respond to the customer's latest WhatsApp message: reply directly, or hand off to a human team.",
    input_schema: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description:
            "The message to send back to the customer right now. Always provide one, even when handing off — never leave the customer without a response.",
        },
        handoff: {
          type: "boolean",
          description: "true if a human team member needs to take over this conversation.",
        },
        team: {
          type: ["string", "null"],
          description: `If handoff is true, which team should handle it. Pick the best match from exactly these existing teams: ${teamList}. Use null if handoff is false, or if no teams exist.`,
        },
        reason: {
          type: ["string", "null"],
          description:
            "One short sentence for staff explaining why this was (or wasn't) handed off. Null if handoff is false.",
        },
      },
      required: ["reply", "handoff"],
    },
  };

  const system = `You are a helpful, concise WhatsApp customer-service assistant for "${branch.name}". Answer questions about the business — orders, products, hours, pricing, policies, general help — using good judgement. Keep replies short (1-4 sentences), warm, and professional, suitable for a WhatsApp chat.

Hand off to a human team when, and only when:
- the customer explicitly asks for a human, staff member, or manager
- the request needs an account-specific or sensitive action you can't actually perform (refunds, payment changes, order cancellations, complaints)
- the customer seems frustrated or upset in a way that needs a person, not a bot
- you don't actually know the answer and guessing would be misleading

When you do hand off, still write a short, warm reply letting the customer know a team member will follow up shortly — never go silent. Available teams: ${teamList}. If handoff is needed but no teams are configured, set handoff true and team null.

Always respond using the respond_or_handoff tool.`;

  let result: Partial<SupportResult> & { reply?: string } = {};
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system,
        messages: [
          {
            role: "user",
            content: `Conversation so far:\n${transcript}\n\nRespond to the customer's latest message using the respond_or_handoff tool.`,
          },
        ],
        tools: [tool],
        tool_choice: { type: "tool", name: "respond_or_handoff" },
      }),
    });
    const data = await res.json();
    const toolUse = (data?.content ?? []).find((c: any) => c.type === "tool_use");
    result = toolUse?.input ?? {};
  } catch (err) {
    console.error("[wa-bot/support] Anthropic call failed:", err);
  }

  const handoff = !!result.handoff;
  const reply = (result.reply ?? "").trim() || FALLBACK_REPLY;
  const team = handoff ? (result.team ?? teams[0] ?? null) : null;
  const reason = handoff ? (result.reason ?? null) : null;

  await supabase.from("wa_messages").insert({
    conversation_id: conv.id,
    branch_id: branch.id,
    direction: "out",
    sender: "ai",
    body: reply,
  });

  return { reply, handoff, team, reason };
}
