// Supabase Edge Function — AzQueue AI Assist.
//
// Two modes, one function (so there's only one thing to deploy):
//
//   { facts, ... }            → returns { insights: [...] }   (report mode)
//   { facts, messages, ... }  → returns { reply: "..." }      (chat mode)
//
// SETUP
//   Deploy as `ai-insights`, Verify JWT OFF (called from the dashboard).
//   Secret needed: OPENAI_API_KEY (already set for tts-speak).
//
// IMPORTANT
//   `facts` are finished statistics computed client-side in
//   src/lib/insightsEngine.js. The model is told never to invent figures.
//   Letting an LLM compute statistics from raw rows produces confident,
//   wrong numbers — the last thing that should inform staffing decisions.

const MODEL = Deno.env.get("OPENAI_INSIGHTS_MODEL") ?? "gpt-4o-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...cors } });

/* ── Shared grounding rules ────────────────────────────────────────── */
const GROUNDING = `
You are AzQueue's assistant, helping the owner or manager of a service
business that runs a customer queue.

You will be given VERIFIED STATISTICS: finished figures already calculated
from this business's own data.

Absolute rules — these override everything else:

1. Every number you state must appear in the VERIFIED STATISTICS. Never
   invent, estimate, extrapolate, round differently, or combine figures to
   produce a new one. If a number is not in the list, you do not have it.

2. Never use example data, illustrative figures, industry averages, or
   numbers from other businesses. This owner will act on what you say. A
   plausible-sounding invented statistic is the single worst thing you can
   produce here.

3. Every actionable recommendation must be traceable to a specific verified
   statistic, and you should name that statistic when giving it. If you want
   to suggest something the data does not support, you may — but say
   explicitly that it is general practice, not a finding from their data.

4. If a statistic says something is NOT MEASURED, or reports that a result
   was not statistically significant, respect it completely. Say you cannot
   tell from the available data. Do not fill the gap.

5. If there are no verified statistics at all, do not describe their business
   numerically in any way. Answer generally and say plainly that you don't
   have enough of their history yet.

6. Never present correlation as causation. Say "coincides with" unless the
   statistics establish cause.

The six core operating metrics, in order of importance:
  1. Average wait          how long people wait
  2. Wait variability      whether that average is trustworthy
  3. Service rate          throughput per server per hour
  4. Arrival rate          demand per operating hour
  5. Queue pressure (rho)  demand vs capacity — strongest congestion signal
  6. Cancellation rate     customers lost
Queue pressure at or above 1.0, or an abandonment tipping point, usually
outranks everything else.
`.trim();

const REPORT_RULES = `
Return between 2 and 5 insights as strict JSON:

{"insights":[{"title":"...","detail":"...","action":"...","severity":"high|medium|low"}]}

- title: under 60 characters, states the finding
- detail: 1-2 sentences quoting the relevant numbers
- action: one concrete thing to try
- severity: high if costing customers or money now, low if informational

Lead with whichever core metric is most out of line. Use the supporting
statistics as evidence inside an insight, not as insights of their own.
Write for a busy owner, not a statistician.

Return only the JSON object, no markdown fencing.
`.trim();

const CHAT_RULES = `
You are answering questions conversationally.

Style:
- Warm and direct. Two or three short paragraphs at most, usually less.
- Plain language. Explain any statistic you quote in business terms.
- Happy to answer statistical questions properly if asked — confidence
  intervals, significance, what a p-value means here, why rho matters.
- Happy to give practical suggestions (staffing, scheduling, reducing
  walk-outs), but separate "your data shows X" from "in general, Y".
- If they ask something unrelated to the queue, answer helpfully and briefly.
- No markdown headers or bullet lists unless genuinely clearer. No emoji.
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405 });

  let body: {
    facts?: string[];
    messages?: { role: string; content: string }[];
    businessName?: string;
    sampleSize?: number;
    days?: number;
  };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const facts = (body.facts ?? []).filter((f) => typeof f === "string" && f.trim());
  const chat  = Array.isArray(body.messages) && body.messages.length > 0;

  if (!chat && facts.length === 0) {
    return json({ ok: false, error: "no facts supplied" }, 400);
  }

  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ ok: true, dryRun: true, insights: [], reply: null });

  const context =
    facts.length
      ? `VERIFIED STATISTICS for ${body.businessName ?? "this business"} ` +
        `(${body.sampleSize ?? "?"} tickets over the last ${body.days ?? 90} days):\n` +
        facts.map((f, i) => `${i + 1}. ${f}`).join("\n")
      : `NO VERIFIED STATISTICS ARE AVAILABLE. This business has too little history ` +
        `to compute anything reliable. You must not state any figure about their ` +
        `operation — not a wait time, not a rate, not a volume, not an estimate. ` +
        `Say plainly that there isn't enough data yet, and answer generally.`;

  const messages = chat
    ? [
        { role: "system", content: `${GROUNDING}\n\n${CHAT_RULES}\n\n${context}` },
        ...body.messages!.slice(-12).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content ?? "").slice(0, 4000),
        })),
      ]
    : [
        { role: "system", content: `${GROUNDING}\n\n${REPORT_RULES}` },
        { role: "user",   content: context },
      ];

  let content = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: chat ? 0.4 : 0.2,
        ...(chat ? {} : { response_format: { type: "json_object" } }),
        messages,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[ai-insights] OpenAI error", res.status, detail.slice(0, 300));
      return json({ ok: false, error: `AI provider ${res.status}` }, 502);
    }
    const data = await res.json();
    content = data?.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    console.error("[ai-insights] request failed", e);
    return json({ ok: false, error: "AI request failed" }, 502);
  }

  if (chat) return json({ ok: true, reply: content.trim() });

  try {
    const parsed = JSON.parse(content);
    return json({ ok: true, insights: Array.isArray(parsed?.insights) ? parsed.insights : [] });
  } catch {
    console.error("[ai-insights] unparseable output", content.slice(0, 300));
    return json({ ok: false, error: "could not parse AI response" }, 502);
  }
});
