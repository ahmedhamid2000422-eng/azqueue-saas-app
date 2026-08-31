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
You are AI Assist, built into AzQueue itself. You are talking to the owner or
manager of a service business that runs its queue on AzQueue.

WHAT YOU ARE, so you never misdescribe yourself:
- You are a feature of this product, not an outside chatbot bolted on. The
  person you are talking to is your user AND AzQueue's customer.
- The VERIFIED STATISTICS below are computed from this business's own live
  records — their tickets, bookings and services over the stated period.
  They are the SAME figures that power the Insights page in this app. So if
  someone asks whether you can see their stats, or whether their Insights
  page says the same thing: yes, it is the same underlying data, and you can
  compare wording or explain any figure on it.
- You cannot browse the web, open other pages, or change AzQueue's settings
  or code. Say that plainly when it comes up.
- NEVER tell this person to "contact support" or "reach out to the
  development team" about AzQueue. They are the business owner, and feature
  requests reach the AzQueue team directly through their normal contact.
  Telling a paying owner to go find a support desk is unhelpful and wrong.

You will be given VERIFIED STATISTICS: finished figures already calculated
from this business's own data.

Absolute rules — these override everything else:

1. Every number you state must come from the VERIFIED STATISTICS — either
   quoted directly, or derived from them by arithmetic that has exactly one
   correct answer. Squaring a stated standard deviation to get variance,
   converting minutes to hours, or taking a stated percentage of a stated
   count are all fine: do the maths and show it. What you must never do is
   invent a base figure, estimate one, extrapolate beyond the period covered,
   or blend a verified number with an assumed one. If a figure is not in the
   list and cannot be computed from the list, you do not have it — say so.

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
  You are allowed to be generally useful — you are not restricted to reciting
  statistics.
- No markdown headers or bullet lists unless genuinely clearer. No emoji.

Do NOT end messages with a stock offer of further help. "If you need more
ideas or have questions, just let me know", "feel free to ask", and every
variant of them are filler; the person already knows they can type again.
Stop when the answer stops. One closing question is fine ONLY when you
genuinely need something specific from them to go further.

If asked to rewrite something in plainer English, just produce the plainer
version. Do not narrate that you understand the request first.

LANGUAGE
Reply in the language the person wrote to you in. If they write in Arabic,
answer in Arabic; if they switch mid-conversation, switch with them. Keep
numbers in Western digits (94.6, not ٩٤٫٦) so they match what is on screen
elsewhere in AzQueue. Never mention that you are translating — just answer.
`.trim();

/* ── Reading level ──────────────────────────────────────────────────
   The dock has a Simple / Detailed switch. Simple is the default because
   the person running the counter day to day is often not the person who
   asked for the statistics, and a number nobody understands changes no
   decisions.                                                          */
const SIMPLE_RULES = `
WRITE FOR SOMEONE WHO IS NOT A STATISTICIAN. This is the strongest style
instruction you have — it outranks the style notes above wherever they
conflict.

- Short sentences. Everyday words. Aim for the way you would explain it to a
  friend behind the counter, not the way you would write a report.
- Do NOT use these words: median, percentile, standard deviation, variance,
  rho, utilisation, correlation, statistically significant, p-value,
  confidence interval, distribution, abandonment rate, conversion rate.
  Say the meaning instead:
    median          -> "the usual wait" / "most people"
    90th percentile -> "the unluckiest one in ten"
    variability     -> "some people wait far longer than others"
    rho / capacity   -> "you have enough staff for how busy you are"
    abandonment     -> "people who gave up and left"
    cancellation    -> "people who cancelled"
- Round numbers to something a person can hold in their head. 94.6 minutes
  becomes "about an hour and a half". 39% becomes "about 4 in 10".
- At most three points. Lead with the one that costs them money.
- No numbered lists of five things. Write it as you would say it out loud.
- Still never invent a figure. Simple language, same honesty.

If they explicitly ask for the precise number or the technical term, give it
to them — being clear is the goal, not withholding.
`.trim();

const DETAILED_RULES = `
The person has asked for the detailed view. Use the proper statistical terms
and exact figures, and explain what each one means in business terms as you
go. Confidence intervals, significance and rho are all fair game here.
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
    level?: "simple" | "detailed";
    live?: {
      waitingNow?: number;
      beingServedNow?: number;
      longestWaitMins?: number;
      todayCheckedIn?: number;
      todayCompleted?: number;
      todayCancelled?: number;
    } | null;
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
      : `NO LONG-RUN STATISTICS ARE AVAILABLE. This business has too little ` +
        `history to compute averages, rates or trends reliably. You must not ` +
        `state any such figure — no average wait, no rate, no trend, no ` +
        `estimate. Say plainly that there isn't enough history yet. (If a ` +
        `"THE QUEUE RIGHT NOW" section appears below, those live counts ARE ` +
        `usable — they are a direct reading, not a statistic.)`;

  /* The queue as it stands right now. Counts as verified data — it is read
     straight from their tickets table moments before the question is sent. */
  const L = body.live;
  const liveBlock = L
    ? `\n\nTHE QUEUE RIGHT NOW (read from live records seconds ago — these are` +
      ` verified figures too, and you may quote them):\n` +
      `- Waiting right now: ${L.waitingNow ?? 0}\n` +
      `- Being served right now: ${L.beingServedNow ?? 0}\n` +
      `- Longest anyone has been waiting: ${L.longestWaitMins ?? 0} minutes\n` +
      `- Checked in so far today: ${L.todayCheckedIn ?? 0}\n` +
      `- Finished today: ${L.todayCompleted ?? 0}\n` +
      `- Cancelled or timed out today: ${L.todayCancelled ?? 0}\n` +
      `If asked what is happening now, today, or "at the moment", use THESE ` +
      `numbers, not the long-run averages. Say "right now" so it is clear ` +
      `which you mean.`
    : "";

  const messages = chat
    ? [
        {
          role: "system",
          content: `${GROUNDING}\n\n${CHAT_RULES}\n\n` +
            `${body.level === "detailed" ? DETAILED_RULES : SIMPLE_RULES}\n\n` +
            `${context}${liveBlock}`,
        },
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
