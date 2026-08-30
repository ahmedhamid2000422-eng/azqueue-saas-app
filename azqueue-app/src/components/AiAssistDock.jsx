import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBranch } from "../lib/BranchContext";
import { buildFacts } from "../lib/insightsEngine";

/**
 * AiAssistDock — the AzQueue AI Assist launcher, available on every page.
 *
 * Mounted once in the business Dashboard shell, OUTSIDE <Routes>. That
 * placement is the whole point: a component rendered inside a route unmounts
 * the moment you navigate, taking the conversation with it. Living above the
 * router means the chat survives moving between Queue, Bookings, Insights and
 * so on.
 *
 * The transcript is also mirrored to sessionStorage so a page refresh doesn't
 * lose it either. Statistics are cached per branch for the session, so only
 * the first question pays the cost of loading history.
 */

const SUGGESTIONS = [
  "How are my wait times?",
  "Should I add more staff?",
  "Why are customers leaving?",
  "What should I fix first?",
];

const KEY = (branchId) => `azq.assist.${branchId ?? "none"}`;
const DAYS = 90;

export default function AiAssistDock() {
  const { branch } = useBranch();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState(null);
  const [ctx, setCtx]           = useState(null);
  const [unread, setUnread]     = useState(false);
  const scrollRef = useRef(null);

  /* Restore the transcript for this branch (survives navigation AND reload) */
  useEffect(() => {
    if (!branch?.id) return;
    setCtx(null); setError(null);
    try {
      const raw = sessionStorage.getItem(KEY(branch.id));
      setMessages(raw ? JSON.parse(raw) : []);
    } catch { setMessages([]); }
  }, [branch?.id]);

  useEffect(() => {
    if (!branch?.id) return;
    try { sessionStorage.setItem(KEY(branch.id), JSON.stringify(messages.slice(-40))); } catch {}
  }, [messages, branch?.id]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  useEffect(() => { if (open) setUnread(false); }, [open]);

  async function loadContext() {
    if (ctx) return ctx;
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

    const [{ data: tickets }, { data: services }, { data: bookings }] = await Promise.all([
      supabase.from("tickets")
        .select("id, status, created_at, called_at, started_at, completed_at, service_id, source, customer_email, customer_phone")
        .eq("branch_id", branch.id).gte("created_at", since).limit(5000),
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

    setInput(""); setError(null);
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
          days: DAYS,
          messages: next,
        },
      });
      if (fErr) {
        throw new Error(
          "Couldn't reach the AI service. Check that the `ai-insights` Edge Function " +
          "is deployed in Supabase with Verify JWT switched off."
        );
      }
      if (data?.dryRun) throw new Error("AI isn't configured yet — OPENAI_API_KEY is missing.");
      if (!data?.ok)    throw new Error(data?.error ?? "Could not get a reply");

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (!open) setUnread(true);
    } catch (e) {
      console.error("[AiAssist]", e);
      setError(e.message ?? "Something went wrong");
      setMessages((m) => m.slice(0, -1));
      setInput(question);
    } finally {
      setBusy(false);
    }
  }

  if (!branch?.id) return null;

  return (
    <>
      {/* ── Launcher ─────────────────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="AzQueue AI Assist"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 border border-gold-deep bg-bg pl-2.5 pr-4 py-2.5 shadow-xl hover:bg-[rgba(201,168,106,0.08)] transition"
        >
          <span className="w-7 h-7 bg-gold flex items-center justify-center shrink-0">
            <span className="text-[#141410] font-display text-[10px] font-semibold">AQ</span>
          </span>
          <span className="ovline text-[9px] text-gold-soft">AI Assist</span>
          {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#9bbd9b]" />}
        </button>
      )}

      {/* ── Panel ────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[380px] max-w-[calc(100vw-2.5rem)] border border-gold-deep/50 bg-bg shadow-2xl flex flex-col max-h-[min(620px,calc(100vh-3rem))]">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gold-deep/25 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 bg-gold flex items-center justify-center shrink-0">
                <span className="text-[#141410] font-display text-[10px] font-semibold">AQ</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm text-ink tracking-tight">AzQueue</span>
                  <span className="ovline text-[7px] border border-gold-deep/50 text-gold-soft px-1 py-0.5">
                    AI Assist
                  </span>
                </div>
                <div className="text-[9px] text-ink-mute">{branch.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setError(null); }}
                  title="Clear conversation"
                  className="text-[9px] ovline border border-line px-2 py-1 text-ink-mute hover:text-ink transition"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                title="Minimise"
                className="text-ink-mute hover:text-ink px-2 py-1 leading-none text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3.5">
            {messages.length === 0 && (
              <div className="text-[12px] text-ink-soft leading-relaxed">
                <p className="mb-1">
                  Ask me about your queue — wait times, how busy you really are, why people
                  leave, whether you need more cover.
                </p>
                <p className="text-[11px] text-ink-mute">
                  Every figure I quote is calculated from your own data over the last {DAYS} days.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`mb-3 ${m.role === "user" ? "flex justify-end" : ""}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] bg-bg-elev border border-line px-3 py-2 text-[12px] text-ink">
                    {m.content}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <span className="w-4 h-4 bg-gold flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[#141410] text-[6px] font-semibold">AQ</span>
                    </span>
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
              <div className="text-[11px] text-[#d49185] border border-[#b56b5f]/30 bg-[#b56b5f]/10 px-3 py-2 mt-2 leading-relaxed">
                {error}
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="px-4 pb-2.5 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy}
                  className="text-[10px] border border-line px-2 py-1 text-ink-mute hover:border-gold-deep hover:text-gold-soft transition disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-gold-deep/25 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything…"
              disabled={busy}
              className="flex-1 bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2 text-[12px] text-ink placeholder:text-ink-mute disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="ovline text-[9px] border border-gold-deep px-3 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-30"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </>
  );
}
