import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { buildFacts } from "../lib/insightsEngine";

/**
 * AzQueue AI Assist — a conversational assistant grounded in the branch's
 * own queue statistics.
 *
 * Answers general questions, gives operational suggestions, and will go into
 * the statistics properly if asked (confidence intervals, significance, why
 * queue pressure matters).
 *
 * The figures it quotes are computed locally by insightsEngine.buildFacts()
 * and passed to the model as verified context. The model is instructed never
 * to invent numbers — asking an LLM to derive statistics from raw rows yields
 * confident wrong ones, and these inform staffing decisions.
 */

const SUGGESTIONS = [
  "How are my wait times?",
  "Should I add more staff?",
  "Why are customers leaving?",
  "What should I fix first?",
];

export default function AiInsights({ branch, days = 90 }) {
  const [messages, setMessages] = useState([]);   // { role, content }
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState(null);
  const [ctx, setCtx]           = useState(null); // { facts, sampleSize, tooLittleData }
  const scrollRef = useRef(null);

  // Reset the conversation when the branch changes — the grounding facts
  // would otherwise belong to a different business.
  useEffect(() => {
    setMessages([]); setCtx(null); setError(null);
  }, [branch?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  /** Load and cache the statistics once per session. */
  async function loadContext() {
    if (ctx) return ctx;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const [{ data: tickets }, { data: services }, { data: bookings }] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, status, created_at, called_at, started_at, completed_at, service_id, source, customer_email, customer_phone")
        .eq("branch_id", branch.id)
        .gte("created_at", since)
        .limit(5000),
      supabase.from("services").select("id, name").eq("branch_id", branch.id),
      supabase.from("bookings").select("id, status").eq("branch_id", branch.id)
        .gte("scheduled_at", since).limit(5000),
    ]);

    const nameMap = Object.fromEntries((services ?? []).map((s) => [s.id, s.name]));
    const built = buildFacts(tickets ?? [], nameMap, {
      bookingsTotal: bookings?.length ?? 0,
      bookingsCompleted: (bookings ?? []).filter((b) => b.status === "completed").length,
    });
    setCtx(built);
    return built;
  }

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || busy || !branch?.id) return;

    setInput("");
    setError(null);
    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    setBusy(true);

    try {
      const built = await loadContext();
      const { data, error: fErr } = await supabase.functions.invoke("ai-insights", {
        body: {
          facts: built.facts,
          sampleSize: built.sampleSize,
          businessName: branch.name,
          days,
          messages: next,
        },
      });
      if (fErr) throw fErr;
      if (data?.dryRun) throw new Error("AI isn't configured yet (missing OPENAI_API_KEY).");
      if (!data?.ok)    throw new Error(data?.error ?? "Could not get a reply");

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      console.error("[AiAssist]", e);
      setError(e.message ?? "Something went wrong");
      setMessages((m) => m.slice(0, -1));   // put the question back
      setInput(question);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-gold-deep/40 bg-[rgba(201,168,106,0.03)]">
      {/* ── Header ────────────────────────────────────────────────── */}
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
              Ask about your queue, your numbers, or what to do next
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null); }}
            className="ovline text-[9px] border border-line px-2.5 py-1 text-ink-mute hover:text-ink hover:border-line-2 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Conversation ──────────────────────────────────────────── */}
      <div ref={scrollRef} className="px-5 py-4 max-h-[420px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-[12px] text-ink-soft leading-relaxed">
            <p className="mb-1">
              I can look at the last {days} days of your queue and answer questions about it —
              wait times, how busy you really are, why people leave, whether you need more cover.
            </p>
            <p className="text-[11px] text-ink-mute">
              Ask plainly or get technical; I'll go into confidence intervals and significance
              if that's useful. Every figure I quote is calculated from your own data.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`mb-3.5 ${m.role === "user" ? "flex justify-end" : ""}`}>
            {m.role === "user" ? (
              <div className="max-w-[80%] bg-bg-elev border border-line px-3.5 py-2 text-[12px] text-ink">
                {m.content}
              </div>
            ) : (
              <div className="flex gap-2.5">
                <div className="w-5 h-5 bg-gold flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[#141410] text-[7px] font-semibold">AQ</span>
                </div>
                <div className="text-[12px] text-ink-soft leading-relaxed whitespace-pre-wrap flex-1">
                  {m.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-[11px] text-ink-mute">
            <span className="pip breathe" style={{ background: "#c9a86a" }} />
            {ctx ? "Thinking…" : "Reading your queue data…"}
          </div>
        )}

        {error && (
          <div className="text-[11px] text-[#d49185] border border-[#b56b5f]/30 bg-[#b56b5f]/10 px-3 py-2 mt-2">
            {error}
          </div>
        )}
      </div>

      {/* ── Suggestions ───────────────────────────────────────────── */}
      {messages.length === 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="text-[11px] border border-line px-2.5 py-1.5 text-ink-mute hover:border-gold-deep hover:text-gold-soft transition disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Composer ──────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gold-deep/25 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask anything about your queue…"
          disabled={busy}
          className="flex-1 bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2 text-[12px] text-ink placeholder:text-ink-mute disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="ovline text-[9px] border border-gold-deep px-3.5 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-30"
        >
          Ask
        </button>
      </div>

      {ctx && !ctx.tooLittleData && (
        <div className="px-5 pb-3 text-[10px] text-ink-mute">
          Grounded in {ctx.sampleSize} tickets from the last {days} days.
        </div>
      )}
      {ctx?.tooLittleData && (
        <div className="px-5 pb-3 text-[10px] text-ink-mute">
          Only {ctx.sampleSize} tickets so far — I'll answer generally until there's
          enough history (about 30) to say anything reliable about your numbers.
        </div>
      )}
    </div>
  );
}
