// Supabase Edge Function — Claude API proxy for Personal Flow's AI Assist.
//
// Deploy:   supabase functions deploy ai-assist
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Body:     { messages: [{ role: "user"|"assistant", content: string }, ...] }
// Returns:  { ok, content, dryRun? }
//
// Without ANTHROPIC_API_KEY, returns a friendly dry-run response so the UI
// is testable before you set the secret.

const SYSTEM_PROMPT =
  "You are AzQueue's AI Assist — a calm, focused, on-brand co-pilot inside the user's Personal Flow workspace. " +
  "Help with: drafting emails, summarising docs, planning the day, answering quick questions. " +
  "Be brief by default. Use plain prose. Never use emojis unless asked. Never invent meetings, contacts, or facts you weren't told. " +
  "If asked for something requiring tools you don't have access to (calendar, browsing, files), say so and offer the closest alternative.";

const MODEL = "claude-sonnet-4-6";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) return json({ error: "messages required" }, 400);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    // Dry-run — useful while developing
    const last = messages[messages.length - 1]?.content ?? "";
    return json({
      ok: true,
      dryRun: true,
      content:
        "AI Assist is wired but not yet authenticated. Set ANTHROPIC_API_KEY in Supabase secrets to start real responses.\n\n" +
        `(You asked: "${last.slice(0, 200)}")`,
    });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data?.error?.message ?? `Anthropic ${res.status}` }, 500);
    const content = data?.content?.[0]?.text ?? "";
    return json({ ok: true, content });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status,
  });
}
