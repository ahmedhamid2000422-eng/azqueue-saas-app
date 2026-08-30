// Supabase Edge Function — turns pre-computed queue statistics into
// plain-English insights with recommended actions.
//
// SETUP
//   Deploy as `ai-insights`, Verify JWT OFF (called from the dashboard).
//   Secret needed: OPENAI_API_KEY  (already set for tts-speak)
//
// Body:    { facts: string[], businessName?: string, sampleSize?: number }
// Returns: { ok, insights: [{ title, detail, action, severity }] }
//
// IMPORTANT
//   The model is given finished numbers and told not to invent any. All
//   arithmetic happens client-side in src/lib/insightsEngine.js. Letting an
//   LLM compute statistics from raw rows produces confident, wrong numbers —
//   which is the last thing you want informing staffing decisions.

const MODEL = Deno.env.get("OPENAI_INSIGHTS_MODEL") ?? "gpt-4o-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...cors } });

const SYSTEM = `
You are an operations analyst for a service business that manages a customer queue.

You will be given a list of FACTS. Each fact is a finished statistic that has
already been calculated from the business's own data.

Rules — these are absolute:
1. Never invent, estimate, or extrapolate a number. Only use figures that
   appear verbatim in the FACTS.
2. If the facts do not support an observation, do not make it. If a fact says
   something is NOT MEASURED or NOT significant, respect that and never fill
   the gap with a guess.
3. Do not describe a correlation as a cause. Say "coincides with", not
   "causes", unless the facts establish it.
4. Prefer findings the owner can act on this week over abstract observations.
5. If the sample is small, say so plainly rather than overstating confidence.

Priority — the FACTS are ordered deliberately. These six are the core
operating metrics and should dominate your insights:

  1. AVERAGE WAIT          how long people wait
  2. WAIT VARIABILITY      whether that average is trustworthy or hides chaos
  3. SERVICE RATE          throughput per server per hour
  4. ARRIVAL RATE          demand per operating hour
  5. QUEUE PRESSURE (rho)  demand vs capacity — the strongest congestion signal
  6. CANCELLATION RATE     customers lost

Lead with whichever of these is most out of line. Queue pressure at or above
1.0, or an abandonment tipping point, almost always outranks everything else.
Use the supporting facts (significance tests, per-service breakdowns, demand
peaks) as evidence inside an insight rather than as insights of their own.

Write for a busy business owner, not a statistician. Quote the number and the
confidence interval where one is given, but explain what it means for the
business in plain words.

Return between 2 and 5 insights as strict JSON:

{"insights":[{"title":"...","detail":"...","action":"...","severity":"high|medium|low"}]}

- title: under 60 characters, states the finding
- detail: 1-2 sentences quoting the relevant numbers from the FACTS
- action: one concrete thing to try
- severity: high if it is costing customers or money now, low if informational

Return only the JSON object, no markdown fencing.
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405 });

  let body: { facts?: string[]; businessName?: string; sampleSize?: number };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const facts = (body.facts ?? []).filter((f) => typeof f === "string" && f.trim());
  if (facts.length === 0) {
    return json({ ok: false, error: "no facts supplied" }, 400);
  }

  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ ok: true, dryRun: true, insights: [] });

  const userMsg =
    `Business: ${body.businessName ?? "this business"}\n` +
    `Sample size: ${body.sampleSize ?? "unknown"} tickets\n\n` +
    `FACTS:\n` + facts.map((f, i) => `${i + 1}. ${f}`).join("\n");

  let content = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,          // low — we want faithful reporting, not flair
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: userMsg },
        ],
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

  let insights: unknown[] = [];
  try {
    const parsed = JSON.parse(content);
    insights = Array.isArray(parsed?.insights) ? parsed.insights : [];
  } catch {
    console.error("[ai-insights] unparseable model output", content.slice(0, 300));
    return json({ ok: false, error: "could not parse AI response" }, 502);
  }

  return json({ ok: true, insights });
});
