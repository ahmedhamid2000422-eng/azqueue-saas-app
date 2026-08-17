import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { fetchPrayerTimes, getPauseStatus, getNextPrayer } from "../lib/prayerTimes";
import { announceTicket, unlockAudio, isAudioReady, getAudioDiagnostics, testSpeak, playChime } from "../lib/tts";

/**
 * Public TV display — full-screen wall surface in the waiting area.
 * Route: /display/:slug    (public, no auth)
 *
 * Layouts (selected by ?layout= or auto):
 *   · "auto"   (default) — switches to multi when 2+ are serving
 *   · "single" — one big Now Serving token (legacy / single-staff branches)
 *   · "multi"  — grid of cards, one per active staff/counter
 *
 * URL flags:
 *   ?demo=1     — render with mock data (used by the in-dashboard preview)
 *   ?layout=    — force a layout
 *   ?lang=      — force a language
 *   ?branded=0  — hide the AzQueue footer mark for clean white-label use
 */
export default function TvDisplay() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();

  const isDemo       = params.get("demo") === "1";
  const layoutParam  = params.get("layout") ?? "auto";
  const langOverride = params.get("lang");
  const branded      = params.get("branded") !== "0";

  const [branch, setBranch] = useState(null);
  const [tickets, setTickets] = useState([]);     // serving + waiting
  const [staff, setStaff]     = useState([]);
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (langOverride && langOverride !== i18n.language) i18n.changeLanguage(langOverride);
  }, [langOverride, i18n]);

  // ── Demo data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isDemo) return;
    setBranch({ name: "KL Downtown", city: "Bukit Bintang", lat: 3.149, lng: 101.713 });
    setStaff([
      { id: "s1", display_name: "Yusuf",   role: "Senior",  status: "serving" },
      { id: "s2", display_name: "Sara",    role: "Stylist", status: "serving" },
      { id: "s3", display_name: "Mohammad",role: "Stylist", status: "active"  },
    ]);
    setTickets([
      { id: "t1", token: "A102", customer_name: "Ali Khan",   service_id: "s1", staff_id: "s1", status: "serving", started_at: new Date(Date.now() - 7 * 60_000).toISOString() },
      { id: "t2", token: "T04",  customer_name: "Khalid (4)", service_id: "s2", staff_id: "s2", status: "serving", started_at: new Date(Date.now() - 18 * 60_000).toISOString() },
      { id: "t3", token: "A103", customer_name: "Sara Ahmed",  service_id: "s1", status: "waiting" },
      { id: "t4", token: "P012", customer_name: "Yusuf K.",    service_id: "s3", status: "waiting" },
      { id: "t5", token: "A105", customer_name: "Mohammad U.", service_id: "s1", status: "waiting" },
      { id: "t6", token: "A106", customer_name: "Zainab F.",   service_id: "s4", status: "waiting" },
    ]);
    setServices({ s1: "Haircut", s2: "Table for 4", s3: "Consultation", s4: "Spa" });
    setLoading(false);
  }, [isDemo]);

  // ── Real load ─────────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: branchRow, error: bErr } = await supabase
        .from("branches")
        .select("id, slug, name, city, timezone, lat, lng, islamic_mode")
        .eq("slug", slug).single();
      if (bErr || !branchRow) {
        if (!cancelled) { setError("display.invalid"); setLoading(false); }
        return;
      }

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const [{ data: tk }, { data: stRows }, { data: svcRows }] = await Promise.all([
        supabase.from("tickets")
          .select("id, token, status, customer_name, service_id, staff_id, created_at, started_at, called_at, branch_id")
          .eq("branch_id", branchRow.id)
          .in("status", ["waiting", "serving"])
          .gte("created_at", todayStart.toISOString())
          .order("created_at"),
        supabase.from("staff")
          .select("id, display_name, role, status")
          .eq("branch_id", branchRow.id),
        supabase.from("services").select("id, name").eq("branch_id", branchRow.id),
      ]);

      if (cancelled) return;
      setBranch(branchRow);
      setTickets(tk ?? []);
      setStaff(stRows ?? []);
      setServices(Object.fromEntries((svcRows ?? []).map((s) => [s.id, s.name])));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug, isDemo]);

  // Realtime — with auto-reconnect for Apple TV / AirPlay / long sessions
  useEffect(() => {
    if (isDemo || !branch?.id) return;

    let ch = null;
    let reconnectTimer = null;
    let alive = true;

    async function fetchTickets() {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: tk } = await supabase.from("tickets")
        .select("id, token, status, customer_name, service_id, staff_id, created_at, started_at, called_at, branch_id")
        .eq("branch_id", branch.id)
        .in("status", ["waiting", "serving"])
        .gte("created_at", todayStart.toISOString())
        .order("created_at");
      if (alive) setTickets(tk ?? []);
    }

    function connect() {
      if (!alive) return;
      ch = supabase
        .channel(`display-${branch.id}-${Date.now()}`)   // unique name so re-sub doesn't conflict
        .on("postgres_changes",
          { event: "*", schema: "public", table: "tickets", filter: `branch_id=eq.${branch.id}` },
          () => fetchTickets())
        .subscribe((status) => {
          // If the channel errors or closes unexpectedly, schedule a reconnect.
          // This covers: AirPlay pause, iPad sleep, Wi-Fi handoff, Supabase restart.
          if ((status === "CHANNEL_ERROR" || status === "CLOSED") && alive) {
            reconnectTimer = setTimeout(() => {
              if (!alive) return;
              supabase.removeChannel(ch).catch(() => {});
              fetchTickets();  // pull fresh data while reconnecting
              connect();
            }, 3_000);
          }
        });
    }

    connect();
    // Safety-net poll. Realtime should deliver changes within ~1s; this only
    // covers the case where the socket is down (flaky TV wifi, Supabase
    // restart). 10s keeps the worst case tolerable on a wall display while
    // staying cheap — one small indexed query per branch.
    const pollId = setInterval(fetchTickets, 10_000);

    // Reconnect when the tab/app comes back to the foreground (iPad Home Screen / AirPlay resume)
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        supabase.removeChannel(ch).catch(() => {});
        fetchTickets();
        connect();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      supabase.removeChannel(ch).catch(() => {});
    };
  }, [branch?.id, isDemo]);

  // Prayer
  const [prayerTimes, setPrayerTimes] = useState(null);
  useEffect(() => {
    if (!branch?.lat || !branch?.lng) return;
    let cancelled = false;
    (async () => {
      const pt = await fetchPrayerTimes({ lat: branch.lat, lng: branch.lng });
      if (!cancelled) setPrayerTimes(pt);
    })();
    return () => { cancelled = true; };
  }, [branch?.lat, branch?.lng]);

  const pauseStatus = useMemo(() => prayerTimes ? getPauseStatus(prayerTimes, {}, now) : null, [prayerTimes, now]);
  const nextPrayer  = useMemo(() => prayerTimes ? getNextPrayer(prayerTimes, now) : null, [prayerTimes, now]);

  // Derived: serving + waiting + per-counter view
  const serving = useMemo(() => tickets.filter((tk) => tk.status === "serving"), [tickets]);
  const waiting = useMemo(() => tickets.filter((tk) => tk.status === "waiting"), [tickets]);

  // Each "counter" is one currently-serving ticket. Pair with staff record if known.
  const counters = useMemo(() => {
    return serving.map((tk) => ({
      ticket: tk,
      staff: staff.find((s) => s.id === tk.staff_id),
      service: services[tk.service_id],
    }));
  }, [serving, staff, services]);

  const layout = layoutParam === "auto"
    ? (counters.length >= 2 ? "multi" : "single")
    : layoutParam;

  // ── Announce newly-called tickets on the TV display ──────────
  // Track called_at per ticket; when it changes the ticket was just called.
  const prevCalledAt = useRef({});
  const [flashing, setFlashing] = useState({}); // ticketId → true while flashing
  const flashTimers = useRef({});

  useEffect(() => {
    serving.forEach((tk) => {
      const prev = prevCalledAt.current[tk.id];
      const isFirstSight = prev === undefined;
      if (tk.called_at && tk.called_at !== prev) {
        // Don't announce/flash the tickets already on screen when the display
        // first loads — only genuinely new calls.
        if (!isFirstSight) {
          const staffName = staff.find((s) => s.id === tk.staff_id)?.display_name;
          const counter   = staffName ? `${staffName}'s counter` : "the counter";
          announceTicket({
            token:        tk.token,
            customerName: tk.customer_name,
            counter,
            branchId:     branch?.id,
          });

          setFlashing((f) => ({ ...f, [tk.id]: true }));
          clearTimeout(flashTimers.current[tk.id]);
          flashTimers.current[tk.id] = setTimeout(() => {
            setFlashing((f) => {
              const next = { ...f };
              delete next[tk.id];
              return next;
            });
          }, 12000); // flash for 12s — long enough to cross a waiting room
        }
      }
      prevCalledAt.current[tk.id] = tk.called_at;
    });
  }, [serving, staff, branch?.id]);

  // Clear any pending flash timers on unmount
  useEffect(() => () => {
    Object.values(flashTimers.current).forEach(clearTimeout);
  }, []);

  // ── Audio unlock ─────────────────────────────────────────────
  // Browsers (and TV Bro especially) refuse to play audio until the page has
  // received a real user gesture. Show a one-time overlay so staff can arm it
  // when setting the TV up; after that the chime and voice work unattended.
  const [audioArmed, setAudioArmed] = useState(true); // assume fine until checked
  useEffect(() => {
    setAudioArmed(isAudioReady());
    const t = setInterval(() => setAudioArmed(isAudioReady()), 4000);
    return () => clearInterval(t);
  }, []);

  async function armAudio() {
    await unlockAudio();
    setAudioArmed(isAudioReady());
  }

  // ── Audio diagnostics (?debug=audio) ─────────────────────────
  const debugAudio = params.get("debug") === "audio";
  const [diag, setDiag] = useState(null);
  useEffect(() => {
    if (!debugAudio) return;
    const refresh = () => setDiag(getAudioDiagnostics());
    refresh();
    // Android/Chrome populate the voice list asynchronously
    window.speechSynthesis?.addEventListener?.("voiceschanged", refresh);
    const t = setInterval(refresh, 2000);
    return () => {
      clearInterval(t);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", refresh);
    };
  }, [debugAudio]);

  // ── Render ───────────────────────────────────────────────────
  if (loading) return (
    <TvShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ color: "#6b6a64", fontSize: "2vw", letterSpacing: "0.2em", textTransform: "uppercase" }}>Loading…</div>
      </div>
    </TvShell>
  );
  if (error || !branch) return (
    <TvShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ color: "#d49185", fontSize: "2vw" }}>Display not found</div>
      </div>
    </TvShell>
  );

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isPaused = pauseStatus?.state === "paused";

  return (
    <TvShell>
      {/* Subtle ambient glow */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: isPaused
          ? "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(127,163,127,0.15), transparent 65%)"
          : "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,168,106,0.12), transparent 65%)",
      }} />

      <div style={{ position: "relative", height: "100vh", display: "flex", flexDirection: "column", padding: "3vh 4vw" }}>

        {/* ── Header ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "2vh", marginBottom: "3vh",
        }}>
          <div>
            <div style={{ color: "#c9a86a", fontSize: "1.6vw", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {branch.name}
            </div>
            {branch.city && (
              <div style={{ color: "#6b6a64", fontSize: "1vw", marginTop: "0.3vh", letterSpacing: "0.1em" }}>
                {branch.city}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "3vw" }}>
            {/* Prayer / approaching indicator */}
            {isPaused ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.8vw" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#9bbd9b", display: "inline-block", animation: "breathe 2s ease-in-out infinite" }} />
                <span style={{ color: "#9bbd9b", fontSize: "1.1vw", letterSpacing: "0.1em" }}>
                  {pauseStatus.prayer} · Paused
                </span>
              </div>
            ) : pauseStatus?.state === "approaching" ? (
              <span style={{ color: "#9bbd9b", fontSize: "1.1vw", letterSpacing: "0.08em" }}>
                {pauseStatus.prayer} in {Math.round(pauseStatus.msUntil / 60000)}m
              </span>
            ) : nextPrayer ? (
              <span style={{ color: "#6b6a64", fontSize: "1vw" }}>
                {nextPrayer.name} · {nextPrayer.time}
              </span>
            ) : null}

            {/* Clock */}
            <div style={{ fontFamily: "monospace", fontSize: "3.5vw", color: "#f0ede6", fontWeight: 300, letterSpacing: "0.05em" }}>
              {time}
            </div>

            {/* Live pip */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6vw" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "breathe 2s ease-in-out infinite" }} />
              <span style={{ color: "#4ade80", fontSize: "0.9vw", letterSpacing: "0.2em", textTransform: "uppercase" }}>Live</span>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 36%", gap: "4vw", minHeight: 0 }}>

          {/* Left: Now Serving */}
          {isPaused ? (
            <TvPausedHero pauseStatus={pauseStatus} />
          ) : layout === "multi" && counters.length >= 1 ? (
            <TvMultiCounters counters={counters} flashing={flashing} />
          ) : (
            <TvSingleServing counter={counters[0]} flashing={flashing} />
          )}

          {/* Right: Up Next */}
          <TvUpNext waiting={waiting} services={services} branded={branded} branchSlug={branch.slug} />
        </main>
      </div>

      {/* One-time audio arming. Browsers and TV Bro block sound until the page
          has had a real tap; without this the chime and voice stay silent. */}
      {!audioArmed && (
        <div
          onClick={armAudio}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") armAudio(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 90,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(10,10,9,0.92)", cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "6vw", marginBottom: "3vh" }}>🔊</div>
          <div style={{ color: "#c9a86a", fontSize: "2.2vw", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>
            Tap to enable sound
          </div>
          <div style={{ color: "#6b6a64", fontSize: "1.2vw", textAlign: "center", maxWidth: "60vw", lineHeight: 1.6 }}>
            Press OK on the remote, or tap the screen. Only needed once each time
            the display is opened — announcements then play automatically.
          </div>
        </div>
      )}

      {/* Audio diagnostics — open the display with ?debug=audio */}
      {debugAudio && diag && (
        <div style={{
          position: "fixed", top: "2vh", right: "2vw", zIndex: 95,
          background: "rgba(10,10,9,0.94)", border: "1px solid #2a2a25",
          padding: "1.5vh 1.5vw", maxWidth: "30vw",
          fontFamily: "monospace", fontSize: "0.85vw", color: "#b8b3a8", lineHeight: 1.8,
        }}>
          <div style={{ color: "#c9a86a", marginBottom: "0.8vh", letterSpacing: "0.15em" }}>AUDIO DIAGNOSTICS</div>
          <div>WebAudio: <b style={{ color: diag.webAudio ? "#9bbd9b" : "#d49185" }}>{diag.webAudio ? "yes" : "no"}</b></div>
          <div>Audio state: <b style={{ color: diag.audioState === "running" ? "#9bbd9b" : "#d49185" }}>{diag.audioState}</b></div>
          <div>Speech API: <b style={{ color: diag.speechSupported ? "#9bbd9b" : "#d49185" }}>{diag.speechSupported ? "present" : "MISSING"}</b></div>
          <div>Voices: <b style={{ color: diag.voiceCount > 0 ? "#9bbd9b" : "#d49185" }}>{diag.voiceCount}</b></div>
          {diag.voiceNames.length > 0 && (
            <div style={{ color: "#6b6a64", fontSize: "0.7vw" }}>{diag.voiceNames.join(", ")}</div>
          )}
          {diag.speechSupported && diag.voiceCount === 0 && (
            <div style={{ color: "#d49185", marginTop: "0.8vh", fontSize: "0.75vw", lineHeight: 1.5 }}>
              Speech API exists but no voices installed. On Android TV: Settings →
              Accessibility → Text-to-speech → install/enable Google Speech Services.
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6vw", marginTop: "1vh" }}>
            <button onClick={() => playChime()} style={diagBtn}>Test chime</button>
            <button onClick={() => testSpeak()} style={diagBtn}>Test voice</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes tvSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tvFlashName {
          0%, 100% { color: #f0ede6; text-shadow: none; }
          50%      { color: #ffffff; text-shadow: 0 0 40px rgba(201,168,106,0.9); }
        }
        @keyframes tvFlashToken {
          0%, 100% { color: #c9a86a; text-shadow: 0 0 80px rgba(201,168,106,0.25); }
          50%      { color: #ffe9b0; text-shadow: 0 0 120px rgba(201,168,106,0.85); }
        }
        @keyframes tvFlashCard {
          0%, 100% { background: rgba(201,168,106,0.03); box-shadow: none; }
          50%      { background: rgba(201,168,106,0.16); box-shadow: 0 0 60px rgba(201,168,106,0.35); }
        }
      `}</style>
    </TvShell>
  );
}

/* ── Full dark shell ────────────────────────────────────────── */
const diagBtn = {
  background: "transparent",
  border: "1px solid #c9a86a",
  color: "#c9a86a",
  padding: "0.4vh 0.8vw",
  fontSize: "0.75vw",
  fontFamily: "monospace",
  cursor: "pointer",
};

function TvShell({ children }) {
  return (
    <div style={{
      position: "relative",
      background: "#0d0c0a",
      color: "#f0ede6",
      minHeight: "100vh",
      overflow: "hidden",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    }}>
      {children}
    </div>
  );
}

/* ── Single large "Now Serving" ─────────────────────────────── */
function TvSingleServing({ counter, flashing = {} }) {
  const isFlashing = !!(counter?.ticket && flashing[counter.ticket.id]);
  if (!counter) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
        <div style={{ color: "#6b6a64", fontSize: "1.2vw", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "3vh" }}>
          Now Serving
        </div>
        <div style={{ color: "#3a3830", fontSize: "18vw", fontWeight: 200, lineHeight: 1, letterSpacing: "-0.02em" }}>
          —
        </div>
        <div style={{ color: "#6b6a64", fontSize: "2vw", marginTop: "3vh", fontStyle: "italic" }}>
          No one serving yet
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", animation: "tvSlideIn 0.4s ease-out" }}>
      {/* Label */}
      <div style={{ color: "#6b6a64", fontSize: "1.2vw", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "2vh" }}>
        Now Serving
      </div>

      {/* Big token */}
      <div
        key={counter.ticket.token}
        style={{
          fontSize: "clamp(120px, 20vw, 380px)",
          fontWeight: 200,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "#c9a86a",
          textShadow: "0 0 80px rgba(201,168,106,0.25)",
          animation: isFlashing ? "tvFlashToken 1s ease-in-out infinite" : undefined,
        }}
      >
        {counter.ticket.token}
      </div>

      {/* Divider */}
      <div style={{ width: "8vw", height: 2, background: "linear-gradient(90deg, #c9a86a, transparent)", margin: "3vh 0" }} />

      {/* Customer name */}
      <div
        style={{
          fontSize: isFlashing ? "4.6vw" : "3.5vw",
          color: "#f0ede6",
          fontWeight: 300,
          marginBottom: "1.5vh",
          transition: "font-size 0.3s ease-out",
          animation: isFlashing ? "tvFlashName 1s ease-in-out infinite" : undefined,
        }}
      >
        {counter.ticket.customer_name}
      </div>

      {/* Service + staff */}
      <div style={{ fontSize: "1.4vw", color: "#6b6a64", letterSpacing: "0.05em" }}>
        {counter.service && <span>{counter.service}</span>}
        {counter.service && counter.staff && <span style={{ margin: "0 0.8vw", color: "#3a3830" }}>·</span>}
        {counter.staff && <span style={{ color: "#9bbd9b" }}>with {counter.staff.display_name}</span>}
      </div>
    </div>
  );
}

/* ── Multi-counter grid ──────────────────────────────────────── */
function TvMultiCounters({ counters, flashing = {} }) {
  const cols = counters.length <= 2 ? 1 : 2;
  const tokenSize = counters.length <= 2 ? "14vw" : counters.length <= 4 ? "9vw" : "7vw";
  const nameSize  = counters.length <= 2 ? "2.5vw" : "1.8vw";

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "1.5vw", height: "100%", alignContent: "start" }}>
      {counters.map((c, i) => (
        <div key={c.ticket.id} style={{
          border: flashing[c.ticket.id]
            ? "2px solid rgba(201,168,106,0.9)"
            : "1px solid rgba(201,168,106,0.15)",
          background: "rgba(201,168,106,0.03)",
          padding: "2.5vh 2vw",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          animation: flashing[c.ticket.id]
            ? "tvFlashCard 1s ease-in-out infinite"
            : "tvSlideIn 0.4s ease-out",
        }}>
          {/* Counter label */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1vh" }}>
            <span style={{ color: "#c9a86a", fontSize: "0.9vw", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Counter {String(i + 1).padStart(2, "0")}
              {c.staff && <span style={{ color: "#6b6a64", margin: "0 0.5vw" }}>·</span>}
              {c.staff && <span style={{ color: "#f0ede6" }}>{c.staff.display_name}</span>}
            </span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", animation: "breathe 2s ease-in-out infinite", display: "inline-block" }} />
          </div>

          {/* Now Serving label */}
          <div style={{ color: "#6b6a64", fontSize: "0.85vw", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.5vh" }}>
            Now Serving
          </div>

          {/* Token */}
          <div key={c.ticket.token} style={{ fontSize: tokenSize, fontWeight: 200, color: "#c9a86a", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {c.ticket.token}
          </div>

          {/* Divider */}
          <div style={{ width: "4vw", height: 1, background: "rgba(201,168,106,0.3)", margin: "1.5vh 0" }} />

          {/* Name + service */}
          <div style={{
            fontSize: nameSize,
            color: "#f0ede6",
            fontWeight: 300,
            marginBottom: "0.5vh",
            animation: flashing[c.ticket.id] ? "tvFlashName 1s ease-in-out infinite" : undefined,
          }}>
            {c.ticket.customer_name}
          </div>
          <div style={{ fontSize: "0.9vw", color: "#6b6a64" }}>{c.service ?? ""}</div>

          {/* Elapsed */}
          <TvElapsed startedAt={c.ticket.started_at} />
        </div>
      ))}
    </div>
  );
}

function TvElapsed({ startedAt }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return null;
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt)) / 1000));
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.8vw", color: "#3a3830", marginTop: "1vh", letterSpacing: "0.1em" }}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")} elapsed
    </div>
  );
}

/* ── Prayer pause hero ────────────────────────────────────────── */
function TvPausedHero({ pauseStatus }) {
  const minLeft = Math.max(0, Math.round(pauseStatus.msLeft / 60000));
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
      <div style={{ color: "#9bbd9b", fontSize: "1.2vw", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "2vh" }}>
        Paused for Prayer
      </div>
      <div style={{ fontSize: "clamp(80px, 14vw, 260px)", fontWeight: 200, color: "#9bbd9b", lineHeight: 1, textShadow: "0 0 60px rgba(127,163,127,0.2)" }}>
        {pauseStatus.prayer}
      </div>
      <div style={{ width: "8vw", height: 2, background: "linear-gradient(90deg, #9bbd9b, transparent)", margin: "3vh 0" }} />
      <div style={{ fontSize: "2vw", color: "#9bbd9b", fontWeight: 300 }}>
        Resumes in {minLeft} min
      </div>
    </div>
  );
}

/* ── Up Next right column ─────────────────────────────────────── */
function TvUpNext({ waiting, services, branded, branchSlug }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: "3vw" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "2.5vh" }}>
        <div style={{ color: "#6b6a64", fontSize: "1.1vw", letterSpacing: "0.25em", textTransform: "uppercase" }}>
          Up Next
        </div>
        <div style={{ fontFamily: "monospace", fontSize: "1.4vw", color: "#3a3830" }}>
          {waiting.length}
        </div>
      </div>

      {/* Queue list */}
      <div style={{ flex: 1, overflowY: "hidden" }}>
        {waiting.length === 0 ? (
          <div style={{ color: "#3a3830", fontSize: "1.5vw", fontStyle: "italic", marginTop: "2vh" }}>
            Queue is empty
          </div>
        ) : (
          waiting.slice(0, 7).map((tk, i) => (
            <div
              key={tk.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "1.5vw",
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                padding: "1.8vh 0",
                opacity: Math.max(0.25, 1 - i * 0.1),
              }}
            >
              {/* Token */}
              <div style={{
                fontSize: i === 0 ? "4vw" : "3vw",
                fontWeight: 200,
                color: i === 0 ? "#c9a86a" : "#8a8880",
                lineHeight: 1,
                minWidth: "6vw",
                letterSpacing: "-0.02em",
              }}>
                {(tk.priority ?? 0) > 0 && <span style={{ fontSize: "1.2vw", color: "#c9a86a", marginRight: "0.2vw" }}>★</span>}
                {tk.token}
              </div>

              {/* Name + service */}
              <div>
                <div style={{ fontSize: i === 0 ? "1.8vw" : "1.4vw", color: i === 0 ? "#f0ede6" : "#9a9890", fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tk.customer_name}
                </div>
                {services[tk.service_id] && (
                  <div style={{ fontSize: "0.85vw", color: "#4a4840", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.2vh" }}>
                    {services[tk.service_id]}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {branded && (
        <div style={{ marginTop: "auto", paddingTop: "2vh", borderTop: "1px solid rgba(255,255,255,0.04)", color: "#2a2820", fontSize: "0.75vw", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          azqueue.io
        </div>
      )}
    </div>
  );
}
