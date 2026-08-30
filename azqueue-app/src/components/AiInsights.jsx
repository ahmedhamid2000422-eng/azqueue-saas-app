import { useState } from "react";
import { supabase } from "../lib/supabase";
import { buildFacts } from "../lib/insightsEngine";

/**
 * AiInsights — the "AzQueue AI Assist" panel.
 *
 * Reports on the branch's own queue history: average and median wait, wait
 * variability, service rate, arrival rate, queue pressure, cancellation and
 * abandonment, repeat rate and booking conversion.
 *
 * The statistics are computed locally by insightsEngine.buildFacts(); the AI
 * only phrases and ranks them. That split is deliberate — a model asked to
 * compute figures from raw rows produces confident wrong ones, and these
 * numbers are meant to inform staffing decisions.
 */
export default function AiInsights({ branch, days = 90 }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [insights, setInsights] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  async function generate() {
    if (!branch?.id) return;
    setState("loading");
    setError(null);

    try {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();

      const [{ data: tickets, error: tErr }, { data: services }, { data: bookings }] =
        await Promise.all([
          supabase
            .from("tickets")
            .select("id, status, created_at, called_at, started_at, completed_at, service_id, source, customer_email, customer_phone")
            .eq("branch_id", branch.id)
            .gte("created_at", since)
            .limit(5000),
          supabase.from("services").select("id, name").eq("branch_id", branch.id),
          supabase
            .from("bookings")
            .select("id, status")
            .eq("branch_id", branch.id)
            .gte("scheduled_at", since)
            .limit(5000),
        ]);
      if (tErr) throw tErr;

      const nameMap = Object.fromEntries((services ?? []).map((s) => [s.id, s.name]));
      const { facts, sampleSize, tooLittleData } = buildFacts(tickets ?? [], nameMap, {
        bookingsTotal: bookings?.length ?? 0,
        bookingsCompleted: (bookings ?? []).filter((b) => b.status === "completed").length,
      });

      if (tooLittleData) {
        setMeta({ sampleSize });
        setInsights([]);
        setState("done");
        return;
      }

      const { data, error: fErr } = await supabase.functions.invoke("ai-insights", {
        body: { facts, businessName: branch.name, sampleSize },
      });
      if (fErr) throw fErr;
      if (data?.dryRun) throw new Error("AI is not configured (missing OPENAI_API_KEY)");
      if (!data?.ok) throw new Error(data?.error ?? "Could not generate insights");

      setInsights(data.insights ?? []);
      setMeta({ sampleSize, factCount: facts.length });
      setState("done");
    } catch (e) {
      console.error("[AiInsights]", e);
      setError(e.message ?? "Something went wrong");
      setState("error");
    }
  }

  const sev = (s) =>
    s === "high"   ? { border: "#b56b5f", text: "#d49185", label: "Act now" } :
    s === "medium" ? { border: "#c9a86a", text: "#e4cb95", label: "Worth a look" } :
                     { border: "#506b50", text: "#9bbd9b", label: "FYI" };

  return (
    <div className="border border-gold-deep/40 bg-[rgba(201,168,106,0.03)]">
      {/* ── Header: AzQueue mark + AI ASSIST label ────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-gold-deep/25">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gold flex items-center justify-center shrink-0">
            <span className="text-[#141410] font-display text-[11px] font-semibold">AQ</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-ink tracking-tight">AzQueue</span>
              <span className="ovline text-[8px] border border-gold-deep/50 text-gold-soft px-1.5 py-0.5">
                AI Assist
              </span>
            </div>
            <div className="text-[10px] text-ink-mute mt-0.5">
              Reads your queue data and tells you what matters
            </div>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={state === "loading"}
          className="ovline text-[9px] border border-gold-deep px-3 py-1.5 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-40 whitespace-nowrap"
        >
          {state === "loading" ? "Analysing…" : insights.length ? "Refresh" : "Analyse"}
        </button>
      </div>

      <div className="px-5 py-4">
        {state === "idle" && (
          <div className="text-[12px] text-ink-soft leading-relaxed max-w-2xl">
            <p className="mb-2">Ask me to look at the last {days} days and I'll report on:</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-ink-mute">
              <li>· Average &amp; median wait time</li>
              <li>· How consistent those waits are</li>
              <li>· Service rate per hour</li>
              <li>· Arrival rate per hour</li>
              <li>· Queue pressure (demand vs capacity)</li>
              <li>· Cancellation &amp; abandonment</li>
            </ul>
            <p className="mt-3 text-[11px] text-ink-mute">
              Including the wait length at which customers start giving up — if the
              data supports one.
            </p>
          </div>
        )}

        {state === "loading" && (
          <div className="flex items-center gap-2 text-[12px] text-ink-mute">
            <span className="pip breathe" style={{ background: "#c9a86a" }} />
            Crunching {days} days of tickets…
          </div>
        )}

        {state === "error" && (
          <div className="text-[12px] text-[#d49185] border border-[#b56b5f]/30 bg-[#b56b5f]/10 px-3 py-2">
            {error}
          </div>
        )}

        {state === "done" && insights.length === 0 && (
          <p className="text-[12px] text-ink-mute leading-relaxed">
            Not enough history yet — {meta?.sampleSize ?? 0} tickets in the last {days} days.
            Below about 30, the margins of error are so wide that any finding would be
            guesswork. I'd rather say nothing than mislead you.
          </p>
        )}

        {insights.length > 0 && (
          <>
            <div className="space-y-3.5">
              {insights.map((ins, i) => {
                const c = sev(ins.severity);
                return (
                  <div key={i} className="border-l-2 pl-4 py-0.5" style={{ borderColor: c.border }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm text-ink font-medium">{ins.title}</span>
                      <span className="text-[9px] ovline" style={{ color: c.text }}>{c.label}</span>
                    </div>
                    <p className="text-[12px] text-ink-soft leading-relaxed mt-1">{ins.detail}</p>
                    {ins.action && (
                      <p className="text-[11px] text-gold-soft mt-1.5">→ {ins.action}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-ink-mute mt-4 pt-3 border-t border-line leading-relaxed">
              {meta?.sampleSize} tickets · last {days} days. Every figure is calculated from
              your own data (Wilson confidence intervals, chi-square and z-tests,
              Little's Law); the AI only explains and ranks them. Significance at p &lt; 0.05.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
