// Supabase Edge Function — end-of-day summary email with insights.
//
// SETUP
//   1. Deploy as `daily-report`, Verify JWT OFF
//   2. Secrets: RESEND_API_KEY, REPORT_EMAIL, REPORT_SECRET
//      Optional: OPENAI_API_KEY — adds a short written summary
//   3. Schedule with migration 0043
//
// Body (all optional): { secret, to, branchId, date, days }
//   date = "YYYY-MM-DD" day to report on (defaults to today)
//   days = trailing window for the trend metrics (default 30)
//
// The six core operating metrics are computed here in TypeScript, mirroring
// src/lib/insightsEngine.js. The AI, when configured, only writes prose about
// these finished numbers — it is never asked to derive statistics itself.

const FROM_EMAIL    = "AzQueue <noreply@azqueue.io>";
const FALLBACK_FROM = "AzQueue <onboarding@resend.dev>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...cors } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SB_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function q(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    console.error("[daily-report] query failed", path, res.status, (await res.text()).slice(0, 200));
    return [];
  }
  return await res.json();
}

/* ── Small stats helpers (mirror src/lib/stats.js) ─────────────────── */
const MIN = 60_000;
const mins = (a?: string, b?: string) => {
  if (!a || !b) return null;
  const m = (new Date(b).getTime() - new Date(a).getTime()) / MIN;
  return m >= 0 && m < 720 ? m : null;
};
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sd = (v: number[]) => {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
};
const pctile = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Max number of visits overlapping in time — stands in for counters open. */
function concurrency(rows: any[]) {
  const ev: [number, number][] = [];
  rows.forEach((t) => {
    if (!t.started_at || !t.completed_at) return;
    ev.push([+new Date(t.started_at), 1], [+new Date(t.completed_at), -1]);
  });
  if (!ev.length) return 1;
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, max = 0;
  for (const [, d] of ev) { cur += d; max = Math.max(max, cur); }
  return Math.max(1, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405 });

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const expected = Deno.env.get("REPORT_SECRET");
  if (expected && body.secret !== expected) {
    console.warn("[daily-report] secret mismatch — check REPORT_SECRET matches the cron job");
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const to = body.to ?? Deno.env.get("REPORT_EMAIL");
  if (!to) return json({ ok: false, error: "no recipient — set REPORT_EMAIL" }, 400);

  const day    = body.date ?? new Date().toISOString().slice(0, 10);
  const from   = `${day}T00:00:00.000Z`;
  const until  = `${day}T23:59:59.999Z`;
  const window = Number(body.days ?? 30);
  const since  = new Date(Date.now() - window * 86_400_000).toISOString();

  const branches = body.branchId
    ? await q(`branches?select=id,name&id=eq.${body.branchId}`)
    : await q(`branches?select=id,name&order=created_at`);
  if (branches.length === 0) return json({ ok: false, error: "no branches" }, 404);

  const sections: string[] = [];
  const allFacts: string[] = [];
  const summary: Record<string, unknown>[] = [];

  for (const b of branches) {
    const [today, trend, bookings, surveys] = await Promise.all([
      q(`tickets?select=id,status,created_at,called_at,started_at,completed_at&branch_id=eq.${b.id}&created_at=gte.${from}&created_at=lte.${until}`),
      q(`tickets?select=id,status,created_at,called_at,started_at,completed_at&branch_id=eq.${b.id}&created_at=gte.${since}&limit=3000`),
      q(`bookings?select=id,status&branch_id=eq.${b.id}&scheduled_at=gte.${from}&scheduled_at=lte.${until}`),
      q(`surveys?select=rating&branch_id=eq.${b.id}&created_at=gte.${from}&created_at=lte.${until}`),
    ]);

    /* ── Today's headline counts ─────────────────────────────────── */
    const served    = today.filter((t) => t.status === "completed");
    const cancelled = today.filter((t) => t.status === "cancelled");
    const noShow    = today.filter((t) => t.status === "no_show");
    const open      = today.filter((t) => t.status === "waiting" || t.status === "serving");

    const waitsToday = today.map((t) => mins(t.created_at, t.called_at)).filter((m): m is number => m != null);
    const svcToday   = served.map((t) => mins(t.started_at, t.completed_at)).filter((m): m is number => m != null);
    const ratings    = surveys.map((s) => Number(s.rating)).filter((n) => Number.isFinite(n));

    const stats = {
      branch: b.name,
      checkedIn: today.length,
      served: served.length,
      cancelled: cancelled.length,
      noShow: noShow.length,
      stillOpen: open.length,
      bookings: bookings.length,
      avgWaitMin:    waitsToday.length ? Math.round(mean(waitsToday)) : null,
      medWaitMin:    waitsToday.length ? Math.round(median(waitsToday)) : null,
      medServiceMin: svcToday.length ? Math.round(median(svcToday)) : null,
      avgRating: ratings.length ? (mean(ratings)).toFixed(1) : null,
      reviews: ratings.length,
    };
    summary.push(stats);
    sections.push(renderBranch(stats));

    /* ── Six core metrics over the trailing window ────────────────── */
    if (trend.length >= 30) {
      const waits = trend.map((t) => mins(t.created_at, t.called_at ?? t.completed_at))
                         .filter((m): m is number => m != null);
      const durs  = trend.filter((t) => t.status === "completed")
                         .map((t) => mins(t.started_at, t.completed_at))
                         .filter((m): m is number => m != null);
      const lost  = trend.filter((t) => t.status === "cancelled" || t.status === "no_show").length;
      const canc  = trend.filter((t) => t.status === "cancelled").length;

      const hours = new Set(trend.map((t) => {
        const d = new Date(t.created_at);
        return `${d.toISOString().slice(0, 10)}#${d.getUTCHours()}`;
      })).size;

      const f: string[] = [`Branch: ${b.name} — last ${window} days, ${trend.length} tickets.`];

      if (waits.length >= 10) {
        f.push(`AVERAGE WAIT: ${r1(mean(waits))} min. MEDIAN: ${r1(median(waits))} min. ` +
               `SD ${r1(sd(waits))} min, 90th percentile ${r1(pctile(waits, 0.9))} min.`);
      }
      let mu: number | null = null, servers = 1;
      if (durs.length >= 10) {
        mu = 60 / mean(durs);
        servers = concurrency(trend.filter((t) => t.status === "completed"));
        f.push(`SERVICE RATE: ${r1(mu)} customers/hour per server; up to ${servers} served at once ` +
               `(capacity ≈ ${r1(mu * servers)}/hr). Median visit ${r1(median(durs))} min, SD ${r1(sd(durs))} min.`);
      }
      let lambda: number | null = null;
      if (hours >= 5) {
        lambda = trend.length / hours;
        f.push(`ARRIVAL RATE: ${r1(lambda)} customers per operating hour (${hours} active hours).`);
      }
      if (lambda != null && mu != null) {
        const rho = Number((lambda / (mu * servers)).toFixed(2));
        f.push(`QUEUE PRESSURE: rho = ${rho.toFixed(2)}. ` +
               (rho >= 1 ? "At or above 1.0 — demand meets or exceeds capacity; waits grow without limit."
                : rho > 0.85 ? "Above 0.85 — congested; waits rise steeply with small demand spikes."
                : rho > 0.6 ? "Healthy working range."
                : "Comfortable slack."));
      }
      f.push(`CANCELLATION RATE: ${Math.round((canc / trend.length) * 100)}%. ` +
             `ABANDONMENT (cancelled + no-show): ${Math.round((lost / trend.length) * 100)}%.`);

      allFacts.push(...f);
    }
  }

  /* ── Optional AI summary, strictly grounded ──────────────────────── */
  let narrative = "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey && allFacts.length) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: Deno.env.get("OPENAI_INSIGHTS_MODEL") ?? "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You write a short daily operations note for the owner of a service business.\n" +
                "You are given VERIFIED STATISTICS already calculated from their data.\n" +
                "Rules: never invent, estimate or extrapolate a number; only quote figures given. " +
                "Never use industry averages or example data. If something is not in the statistics, " +
                "do not mention it. No correlation-as-causation.\n" +
                "Write 2-4 sentences of plain prose. Lead with whatever most needs attention " +
                "(queue pressure at or above 1.0, or a high abandonment rate, usually wins). " +
                "End with one concrete suggestion tied to a specific number. No markdown, no lists.",
            },
            { role: "user", content: "VERIFIED STATISTICS:\n" + allFacts.join("\n") },
          ],
        }),
      });
      if (res.ok) {
        const d = await res.json();
        narrative = (d?.choices?.[0]?.message?.content ?? "").trim();
      } else {
        console.error("[daily-report] OpenAI", res.status, (await res.text()).slice(0, 200));
      }
    } catch (e) {
      console.error("[daily-report] AI summary failed", e);
    }
  }

  /* ── Send ────────────────────────────────────────────────────────── */
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.log("[daily-report] dry-run — no RESEND_API_KEY", summary);
    return json({ ok: true, dryRun: true, stats: summary, narrative });
  }

  const prettyDay = new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });

  const html = shell(prettyDay, narrative, sections.join(""), window);
  const text = (narrative ? narrative + "\n\n" : "") + summary.map((s) => JSON.stringify(s)).join("\n");

  const send = (fromAddr: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddr, to: [to],
        subject: `AzQueue daily report — ${prettyDay}`,
        html, text,
      }),
    });

  let res  = await send(FROM_EMAIL);
  let data = await res.json() as Record<string, unknown>;
  if (!res.ok && String(data?.message ?? "").toLowerCase().includes("domain")) {
    res  = await send(FALLBACK_FROM);
    data = await res.json() as Record<string, unknown>;
  }
  if (!res.ok) {
    console.error("[daily-report] Resend error", data);
    return json({ ok: false, error: data?.message ?? "send failed" }, 502);
  }

  return json({ ok: true, sent: to, messageId: data?.id, stats: summary, narrative });
});

/* ── Rendering ─────────────────────────────────────────────────────── */

function stat(label: string, value: string | number | null, hint = "") {
  return `
    <td style="padding:14px 10px;text-align:center;border:1px solid #e5e0d5;">
      <div style="font-size:22px;font-weight:600;color:#1a1a17;">${value ?? "—"}</div>
      <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8a857c;margin-top:4px;">${label}</div>
      ${hint ? `<div style="font-size:10px;color:#b0aba1;margin-top:2px;">${hint}</div>` : ""}
    </td>`;
}

function renderBranch(s: any) {
  return `
    <div style="margin:0 0 26px;">
      <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#c9a86a;margin-bottom:10px;">${esc(s.branch)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          ${stat("Checked in", s.checkedIn)}
          ${stat("Served", s.served)}
          ${stat("Bookings", s.bookings)}
        </tr>
        <tr>
          ${stat("Avg wait", s.avgWaitMin != null ? s.avgWaitMin + "m" : null)}
          ${stat("Median wait", s.medWaitMin != null ? s.medWaitMin + "m" : null, "typical customer")}
          ${stat("Median visit", s.medServiceMin != null ? s.medServiceMin + "m" : null)}
        </tr>
        <tr>
          ${stat("Cancelled", s.cancelled)}
          ${stat("No-shows", s.noShow)}
          ${stat("Rating", s.avgRating ?? null, s.reviews ? `${s.reviews} review${s.reviews === 1 ? "" : "s"}` : "")}
        </tr>
      </table>
    </div>`;
}

function shell(day: string, narrative: string, inner: string, window: number) {
  const note = narrative
    ? `<tr><td style="padding:0 30px 22px;">
         <div style="border-left:3px solid #c9a86a;background:#faf8f4;padding:14px 16px;">
           <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#c9a86a;margin-bottom:6px;">What stands out</div>
           <div style="font-size:14px;color:#3a3833;line-height:1.65;">${esc(narrative)}</div>
           <div style="font-size:10px;color:#a8a49b;margin-top:8px;">Based on the last ${window} days of your own data.</div>
         </div>
       </td></tr>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f2ed;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ed;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #e5e0d5;">
        <tr><td style="padding:30px 30px 6px;">
          <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#c9a86a;">AzQueue</div>
          <h1 style="margin:8px 0 4px;font-size:24px;font-weight:400;color:#1a1a17;">Daily report</h1>
          <div style="font-size:13px;color:#8a857c;margin-bottom:20px;">${esc(day)}</div>
        </td></tr>
        ${note}
        <tr><td style="padding:0 30px 20px;">${inner}</td></tr>
        <tr><td style="padding:18px 30px 28px;border-top:1px solid #efece4;">
          <p style="margin:0;color:#8a857c;font-size:11px;line-height:1.6;">
            Sent automatically by AzQueue. Every figure is calculated from your own
            data; day boundaries are UTC-based.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
