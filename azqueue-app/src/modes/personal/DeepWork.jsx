import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import Button from "../../components/Button";

/**
 * Deep Work — real timer that persists each session to deep_work_sessions.
 * On mount: loads any in-progress session for this user (so closing the tab
 * doesn't lose state). On complete/end: writes ended_at + duration_sec.
 */
export default function DeepWork() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);    // current open session row
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [title, setTitle] = useState("Ship the pricing page");
  const [target, setTarget] = useState(90);        // target minutes
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ todayMin: 0, weekMin: 0, streak: 0 });
  const [dbReady, setDbReady] = useState(true);
  const tickRef = useRef(null);

  /* ── Load any existing in-progress session + history stats ─────── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: existing, error } = await supabase
        .from("deep_work_sessions")
        .select("*")
        .eq("owner_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && /relation .* does not exist/i.test(error.message || "")) {
        setDbReady(false);
        return;
      }

      if (existing) {
        setSession(existing);
        setTitle(existing.title);
        setTarget(existing.target_min);
        const elapsed = Math.floor((Date.now() - new Date(existing.started_at).getTime()) / 1000);
        setSeconds(elapsed);
        setRunning(true);
      }

      // Recent completed sessions (history)
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
      const { data: recent } = await supabase
        .from("deep_work_sessions")
        .select("duration_sec, completed, started_at")
        .eq("owner_id", user.id)
        .gte("started_at", sevenAgo.toISOString())
        .order("started_at", { ascending: false });
      setHistory(recent ?? []);
      setStats(deriveStats(recent ?? []));
    })();
  }, [user?.id]);

  /* ── Tick ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  async function start() {
    if (!user || !dbReady) return;
    const { data } = await supabase.from("deep_work_sessions").insert({
      owner_id: user.id,
      title: title.trim() || "Untitled session",
      target_min: target,
    }).select("*").single();
    if (data) {
      setSession(data);
      setSeconds(0);
      setRunning(true);
    }
  }

  async function complete() {
    if (!session) { resetUI(); return; }
    setRunning(false);
    await supabase.from("deep_work_sessions").update({
      ended_at: new Date().toISOString(),
      duration_sec: seconds,
      completed: true,
    }).eq("id", session.id);
    resetUI();
    refreshHistory();
  }

  async function endEarly() {
    if (!session) { resetUI(); return; }
    setRunning(false);
    await supabase.from("deep_work_sessions").update({
      ended_at: new Date().toISOString(),
      duration_sec: seconds,
      completed: false,
    }).eq("id", session.id);
    resetUI();
    refreshHistory();
  }

  function resetUI() {
    setSession(null);
    setSeconds(0);
    setRunning(false);
  }

  async function refreshHistory() {
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    const { data: recent } = await supabase
      .from("deep_work_sessions")
      .select("duration_sec, completed, started_at")
      .eq("owner_id", user.id)
      .gte("started_at", sevenAgo.toISOString())
      .order("started_at", { ascending: false });
    setHistory(recent ?? []);
    setStats(deriveStats(recent ?? []));
  }

  if (!dbReady) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Deep Work</h1>
        <p className="text-ink-soft text-sm">Run the personal tables migration (0005) to persist sessions.</p>
      </div>
    );
  }

  const targetSec = target * 60;
  const progress = targetSec ? Math.min(seconds / targetSec, 1) : 0;
  const circ = 2 * Math.PI * 130;
  const offset = circ * (1 - progress);
  const remainingMin = Math.max(0, target - Math.floor(seconds / 60));

  return (
    <div className="atmosphere-hero min-h-[calc(100vh-44px)] flex items-center justify-center px-6 py-12">
      <div className="relative max-w-2xl w-full">
        <div className="relative corner-marks luxe-panel border border-line p-12 sm:p-16">
          <span className="cm cm-tl" />
          <span className="cm cm-tr" />
          <span className="cm cm-bl" />
          <span className="cm cm-br" />

          <div className="text-center">
            <div className="ovline mb-4 text-[#9bbd9b] flex items-center justify-center gap-2">
              <span className="pip breathe" />
              {running ? "In deep work" : session ? "Paused" : "Ready"}
            </div>

            {!session ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you working on?"
                  className="bg-transparent border-none outline-none font-display text-2xl font-light tracking-tighter text-center text-ink w-full placeholder:text-ink-mute"
                />
                <div className="flex items-center justify-center gap-3 text-xs">
                  <span className="ovline text-[9px]">Target</span>
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(parseInt(e.target.value, 10) || 90)}
                    className="bg-bg-elev border border-line px-3 py-1 w-20 text-center text-ink text-xs"
                  />
                  <span className="text-ink-mute">min</span>
                </div>
              </div>
            ) : (
              <h1 className="font-display text-3xl sm:text-4xl font-light tracking-tighter mb-2 leading-tight">
                {title}
              </h1>
            )}

            {session && (
              <div className="text-xs text-ink-mute mb-10 tracking-wide">
                Founder mode · {target} min session
              </div>
            )}

            {/* Timer with progress ring (only while a session is running) */}
            {session && (
              <div className="relative w-72 h-72 mx-auto my-4">
                <svg viewBox="0 0 280 280" className="absolute inset-0 w-full h-full -rotate-90">
                  <defs>
                    <linearGradient id="dw-ring" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#c9a86a" />
                      <stop offset="100%" stopColor="#f5e3b9" />
                    </linearGradient>
                  </defs>
                  <circle cx="140" cy="140" r="130" fill="none" stroke="#26262a" strokeWidth="2" />
                  <circle
                    cx="140" cy="140" r="130"
                    fill="none"
                    stroke="url(#dw-ring)"
                    strokeWidth="2"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="ovline text-[9px] mb-2">Elapsed</div>
                  <div className="gold-text font-display text-6xl sm:text-7xl font-light tracking-tightest leading-none">
                    {fmt(seconds)}
                  </div>
                  <div className="rule-ornament mt-3 text-[7px] w-32"><span>·</span></div>
                  <div className="text-[10px] text-ink-mute tracking-wide mt-2">
                    {remainingMin} min remaining
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              {!session ? (
                <Button onClick={start} size="lg">Start session →</Button>
              ) : (
                <>
                  <Button onClick={complete} size="lg">Complete session</Button>
                  <Button variant="ghost" onClick={endEarly}>End early</Button>
                </>
              )}
            </div>

            <div className="rule-ornament mt-10 text-[8px]"><span>✦</span></div>

            <div className="grid grid-cols-3 gap-px bg-line border border-line mt-6">
              {[
                ["Today",  fmtMin(stats.todayMin)],
                ["Week",   fmtMin(stats.weekMin)],
                ["Streak", `${stats.streak}d`],
              ].map(([l, v]) => (
                <div key={l} className="bg-bg-elev p-3 text-center">
                  <div className="ovline text-[8px]">{l}</div>
                  <div className="font-display text-base mt-1 gold-text-soft">{v}</div>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-ink-mute mt-6 tracking-wide">
              {session ? "Notifications muted · session in progress" : "Notifications unmuted"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}
function fmtMin(min) {
  if (!min) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function deriveStats(rows) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  let todaySec = 0, weekSec = 0;
  const dayHas = new Set();
  for (const r of rows) {
    const sec = r.duration_sec ?? 0;
    weekSec += sec;
    if (new Date(r.started_at) >= todayStart) todaySec += sec;
    dayHas.add(new Date(r.started_at).toDateString());
  }
  // Streak — consecutive days back from today with at least one session
  let streak = 0;
  const cursor = new Date();
  while (true) {
    if (dayHas.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return {
    todayMin: Math.floor(todaySec / 60),
    weekMin:  Math.floor(weekSec / 60),
    streak,
  };
}
