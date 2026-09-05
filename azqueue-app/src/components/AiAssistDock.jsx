import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBranch } from "../lib/BranchContext";
import { buildFacts } from "../lib/insightsEngine";
import { buildPeople, buildClientFacts } from "../lib/clientSegments";

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


const KEY = (branchId) => `azq.assist.${branchId ?? "none"}`;
const LEVEL_KEY = "azq.assist.level";
const DAYS = 90;

/* Simple is the default: the person at the counter is often not the person
   who asked for the statistics, and a number nobody understands changes no
   decisions. Stored in localStorage, not sessionStorage, so the choice
   survives closing the browser — it's a preference, not part of a chat. */
function loadLevel() {
  try { return localStorage.getItem(LEVEL_KEY) === "detailed" ? "detailed" : "simple"; }
  catch { return "simple"; }
}

/* ── First-run tutorial ─────────────────────────────────────────────
   Shown once, the first time someone opens the dock. Deliberately three
   short points and a button — nobody reads a tour, so this has to be
   skimmable in about five seconds. Reopenable from the "?" in the header
   for anyone who dismissed it and later wondered what the thing does. */
const TOUR_KEY = "azq.assist.tour.seen";

const TOUR = [
  {
    icon: "①",
    title: "Ask it anything about your queue",
    body: "Type a normal question, the way you'd say it out loud — \"how busy are we right now\", \"why do people leave\", \"do I need more staff\". Tap one of the examples below to start.",
  },
  {
    icon: "②",
    title: "Every number comes from your own branch",
    body: "It reads your real check-ins and visits. It is not allowed to guess or use figures from other businesses. If it doesn't know, it says so.",
  },
  {
    icon: "③",
    title: "Simple or Detail, up to you",
    body: "Simple gives plain answers with no jargon. Detail gives the full statistics. Switch any time using the buttons at the top.",
  },
];

export default function AiAssistDock() {
  const { branch } = useBranch();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState(null);
  const [ctx, setCtx]           = useState(null);
  const [unread, setUnread]     = useState(false);
  const [level, setLevel]       = useState(loadLevel);
  const [tour, setTour]         = useState(false);
  /* Which timeframe the person tapped on the opening screen, or null before
     they have. Deliberately not persisted — every new conversation starts
     from the same one short question. */
  const [askTopic, setAskTopic] = useState(null);
  const [neverOpened, setNeverOpened] = useState(() => {
    try { return !localStorage.getItem(TOUR_KEY); } catch { return false; }
  });
  const scrollRef = useRef(null);

  /* Show the tutorial the first time the panel is ever opened. */
  useEffect(() => {
    if (!open) return;
    try { if (!localStorage.getItem(TOUR_KEY)) setTour(true); } catch { /* private mode */ }
  }, [open]);

  function dismissTour() {
    setTour(false);
    setNeverOpened(false);
    try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* private mode */ }
  }

  useEffect(() => {
    try { localStorage.setItem(LEVEL_KEY, level); } catch { /* private mode */ }
  }, [level]);

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

    /* allSettled, not all. These five queries answer different questions, and
       one failing is no reason to silence the other four — the previous
       version told the owner there were no tickets in 90 days when what had
       actually happened was that a single query errored. Reporting absence
       when the truth is "could not load" is the worst possible failure for
       something that answers questions about data. */
    const settled = await Promise.allSettled([
        supabase.from("tickets")
          .select("id, status, created_at, called_at, started_at, completed_at, service_id, source, customer_email, customer_phone")
          .eq("branch_id", branch.id).gte("created_at", since).limit(5000),
        supabase.from("services").select("id, name").eq("branch_id", branch.id),
        supabase.from("bookings").select("id, status").eq("branch_id", branch.id)
          .gte("scheduled_at", since).limit(5000),
        /* The client base is a different question from queue performance, and
           needs the WHOLE history, not the trailing window — "hasn't been back
           in a year" is unanswerable from 90 days of data. */
        supabase.from("tickets")
          .select("id, customer_id, customer_name, customer_phone, created_at")
          .eq("branch_id", branch.id).limit(50_000),
        supabase.from("customers")
          .select("id, display_name, phone, last_seen_at, imported_visits, first_seen_at")
          .eq("branch_id", branch.id).limit(50_000),
      ]);

    /* Unpack, logging any that failed. A rejected query yields undefined and
       the rest carry on — the assistant then answers what it can and its
       grounding rules make it say what it doesn't know. */
    const pick = (i, label) => {
      const r = settled[i];
      if (r.status === "fulfilled" && !r.value?.error) return r.value?.data;
      console.error(`[AiAssist] context query failed: ${label}`,
        r.status === "rejected" ? r.reason : r.value?.error);
      return undefined;
    };
    const tickets    = pick(0, "tickets (90d)");
    const services   = pick(1, "services");
    const bookings   = pick(2, "bookings");
    const allTickets = pick(3, "tickets (all)");
    const customers  = pick(4, "customers");

    const nameMap = Object.fromEntries((services ?? []).map((s) => [s.id, s.name]));
    const built = buildFacts(tickets ?? [], nameMap, {
      bookingsTotal: bookings?.length ?? 0,
      bookingsCompleted: (bookings ?? []).filter((b) => b.status === "completed").length,
    });

    /* Client-base facts, appended after the queue facts. Returns an empty
       array below 30 people, so a new branch gets no client claims at all
       rather than percentages computed from a handful of rows. */
    const people = buildPeople(allTickets ?? [], customers ?? []);
    const merged = { ...built, facts: [...built.facts, ...buildClientFacts(people)] };

    setCtx(merged);
    return merged;
  }

  /**
   * A snapshot of the queue as it stands RIGHT NOW, plus today's totals.
   *
   * The 90-day statistics answer "how does this business run"; they cannot
   * answer "how are we doing this morning", which is what someone standing
   * at the counter actually wants to know. This is deliberately NOT cached —
   * a stale live number is worse than no live number.
   *
   * Only aggregates leave the browser. No names, no emails, no phone
   * numbers: the assistant never needs to identify an individual customer,
   * so it is never given the means to.
   */
  async function loadLiveSnapshot() {
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

      const [{ data: open }, { data: today }] = await Promise.all([
        supabase.from("tickets")
          .select("id, status, created_at, called_at")
          .eq("branch_id", branch.id)
          .in("status", ["waiting", "serving"])
          .limit(500),
        supabase.from("tickets")
          .select("id, status")
          .eq("branch_id", branch.id)
          .gte("created_at", startOfDay.toISOString())
          .limit(2000),
      ]);

      const now     = Date.now();
      const waiting = (open ?? []).filter((t) => t.status === "waiting");
      const serving = (open ?? []).filter((t) => t.status === "serving");
      const mins    = (t) => Math.round((now - new Date(t.created_at).getTime()) / 60000);
      const longest = waiting.length ? Math.max(...waiting.map(mins)) : 0;
      const count   = (s) => (today ?? []).filter((t) => t.status === s).length;

      return {
        waitingNow:      waiting.length,
        beingServedNow:  serving.length,
        longestWaitMins: longest,
        todayCheckedIn:  today?.length ?? 0,
        todayCompleted:  count("completed"),
        todayCancelled:  count("cancelled") + count("expired"),
      };
    } catch {
      return null;   // live data is a bonus; never block the answer on it
    }
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
      const live  = await loadLiveSnapshot();   // always fresh — never cached
      const { data, error: fErr } = await supabase.functions.invoke("ai-insights", {
        body: {
          facts: built.facts,
          sampleSize: built.sampleSize,
          businessName: branch.name,
          days: DAYS,
          level,
          live,
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
          title="Ask a question about your queue"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full border border-gold-deep bg-bg pl-2.5 pr-5 py-2.5 shadow-xl hover:bg-[rgba(201,168,106,0.08)] transition"
        >
          <span className="w-7 h-7 rounded-full bg-gold flex items-center justify-center shrink-0">
            <span className="text-[#141410] font-display text-[11px] font-semibold">AQ</span>
          </span>
          {/* Sentence case, ordinary words, and the size of a thing meant to
              be read rather than decoded. "AI Assist" in tracked capitals
              looked like a feature name; this looks like an offer of help. */}
          <span className="text-[12.5px] text-gold-soft">Ask a question</span>
          {/* "New" until they've seen the tutorial — a quiet nudge to open it once. */}
          {neverOpened && (
            <span className="ovline text-[7px] border border-gold-deep/60 text-gold-soft px-1 py-0.5">
              New
            </span>
          )}
          {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#9bbd9b]" />}
        </button>
      )}

      {/* ── Panel ────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[380px] max-w-[calc(100vw-2.5rem)] border border-gold-deep/50 bg-bg shadow-2xl flex flex-col max-h-[min(620px,calc(100vh-3rem))]">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gold-deep/25 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-gold flex items-center justify-center shrink-0">
                <span className="text-[#141410] font-display text-[11px] font-semibold">AQ</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm text-ink tracking-tight">Ask AzQueue</span>
                </div>
                <div className="text-[9px] text-ink-mute">{branch.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* The Simple/Detail toggle used to sit here, in the header, on
                  by default and visible before a single question had been
                  asked. Two controls and a mode switch above a greeting is
                  not a friendly assistant, it is a settings panel.

                  It still exists and still works — it moved to the "?" panel,
                  which is where somebody goes when they want to know what the
                  thing can do. Simple remains the default, because the person
                  at the counter is usually not the one who asked for
                  statistics. */}
              <button
                onClick={() => setTour(true)}
                title="What is this?"
                className="text-[10px] border border-line w-[22px] h-[22px] text-ink-mute hover:text-gold-soft hover:border-gold-deep transition leading-none"
              >
                ?
              </button>
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
            {/* First-run tutorial. Replaces the message area entirely so it
                can't be scrolled past or missed. */}
            {tour && (
              <div className="mb-1">
                <div className="text-[13px] text-ink mb-3">
                  Hello — here is what I can do
                </div>

                {TOUR.map((t) => (
                  <div key={t.title} className="flex gap-2.5 mb-3.5">
                    <span className="text-gold-soft text-[13px] leading-none mt-0.5 shrink-0">
                      {t.icon}
                    </span>
                    <div>
                      <div className="text-[12px] text-ink leading-snug mb-0.5">{t.title}</div>
                      <p className="text-[11px] text-ink-mute leading-relaxed">{t.body}</p>
                    </div>
                  </div>
                ))}

                {/* Reading level lives here now rather than in the header —
                    it is a preference, and preferences belong where someone
                    goes to look, not above the greeting. */}
                <div className="border-t border-line pt-3 mb-3">
                  <div className="text-[10px] font-medium tracking-[0.08em] uppercase text-ink-mute mb-2">
                    Answers
                  </div>
                  <div className="flex gap-2">
                    {["simple", "detailed"].map((l) => (
                      <button
                        key={l}
                        onClick={() => setLevel(l)}
                        className={`text-[11px] font-medium tracking-[0.08em] uppercase rounded-full px-3.5 py-1.5 border transition ${
                          level === l
                            ? "border-gold-deep text-gold-soft bg-[rgba(201,168,106,0.1)]"
                            : "border-line text-ink-mute hover:text-ink"
                        }`}
                      >
                        {l === "simple" ? "Plain" : "Detailed"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={dismissTour}
                  className="text-[11px] font-medium tracking-[0.08em] uppercase border border-gold-deep px-3 py-2 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition w-full"
                >
                  Got it
                </button>
              </div>
            )}

            {/* ONE QUESTION AT A TIME, NOT A MENU.
                This used to open with a paragraph, a stack of three full
                sentences, and another paragraph — everything the assistant
                could do, all at once, before the person had asked anything.
                That reads as homework.

                Now it asks one short question and offers three taps. Choose a
                timeframe, then choose what about it. The harder capabilities
                are still there and still answer, they are just not advertised
                on the first screen: someone who discovers later that it will
                explain WHY a day was slow is pleased. Someone shown eight
                options on arrival is tired. */}
            {!tour && messages.length === 0 && (
              <div className="text-[12.5px] text-ink-soft leading-relaxed">
                {!askTopic ? (
                  <>
                    <p className="mb-3">
                      Hello. What would you like to look at?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: "now",  label: "Right now" },
                        { key: "day",  label: "Today" },
                        { key: "week", label: "This week" },
                      ].map((o) => (
                        <button
                          key={o.key}
                          onClick={() => setAskTopic(o.key)}
                          className="text-[11px] font-medium tracking-[0.08em] uppercase border border-gold-deep rounded-full px-4 py-2 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-3">
                      {askTopic === "now"  && "What about right now?"}
                      {askTopic === "day"  && "What about today?"}
                      {askTopic === "week" && "What about this week?"}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {{
                        now: [
                          "How busy are we right now?",
                          "Is anyone waiting too long?",
                        ],
                        day: [
                          "How busy were we today?",
                          "How long did people wait?",
                        ],
                        week: [
                          "How many people came in this week?",
                          "What time of day is busiest?",
                        ],
                      }[askTopic].map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="text-[11px] font-medium tracking-[0.08em] uppercase border border-gold-deep rounded-full px-4 py-2 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setAskTopic(null)}
                      className="text-[11px] text-ink-mute hover:text-ink transition"
                    >
                      ‹ Back
                    </button>
                  </>
                )}
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

          {/* An eight-question suggestion strip used to sit here, below the
              opening message. With the two-step pills above it, the empty
              state showed one friendly question AND a wall of eight — the
              exact thing the pills were added to replace. Removed. The
              harder questions still work when typed; they are simply not
              advertised before anyone has asked for anything. */}

          <div className="px-4 py-3 border-t border-gold-deep/25 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type your question here…"
              disabled={busy}
              className="flex-1 bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2 text-[12px] text-ink placeholder:text-ink-mute disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="text-[12px] border border-gold-deep px-4 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
