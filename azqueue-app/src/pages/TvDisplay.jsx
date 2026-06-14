import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { fetchPrayerTimes, getPauseStatus, getNextPrayer } from "../lib/prayerTimes";

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
    // Also poll every 60 s as a safety net — TV displays must never go stale
    const pollId = setInterval(fetchTickets, 60_000);

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

  // ── Render ───────────────────────────────────────────────────
  if (loading) return <FullScreenShell><div className="ovline text-ink-mute">{t("common.loading")}</div></FullScreenShell>;
  if (error || !branch) return <FullScreenShell><div className="ovline text-[#d49185]">{t("common.error")}</div></FullScreenShell>;

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <FullScreenShell variant={pauseStatus?.state === "paused" ? "sage" : "gold"}>
      <Atmosphere variant={pauseStatus?.state === "paused" ? "sage" : "gold"} />

      <div className="relative h-screen flex flex-col p-12">
        <DisplayHeader
          branch={branch}
          time={time}
          pauseStatus={pauseStatus}
          nextPrayer={nextPrayer}
          t={t}
        />

        <main className="flex-1 grid grid-cols-[1fr_minmax(280px,420px)] gap-10 items-start min-h-0">
          {pauseStatus?.state === "paused" ? (
            <PausedHero pauseStatus={pauseStatus} t={t} />
          ) : layout === "multi" && counters.length >= 1 ? (
            <CounterGrid counters={counters} t={t} />
          ) : (
            <SingleNowServing
              counter={counters[0]}
              t={t}
            />
          )}

          <UpNextPanel waiting={waiting} services={services} t={t} branchSlug={branch.slug} branded={branded} />
        </main>
      </div>
    </FullScreenShell>
  );
}

/* ── Header strip ─────────────────────────────────────────────── */
function DisplayHeader({ branch, time, pauseStatus, nextPrayer, t }) {
  return (
    <header className="flex items-center justify-between mb-10">
      <div>
        <div className="ovline text-[12px] text-gold-soft mb-1">{branch.name}</div>
        <div className="text-[11px] text-ink-mute tracking-wide">{branch.city}</div>
      </div>

      <div className="flex items-center gap-8">
        {pauseStatus?.state === "paused" ? (
          <div className="flex items-center gap-2">
            <span className="pip breathe" style={{ background: "#9bbd9b" }} />
            <span className="text-[14px] text-[#9bbd9b]">
              {t("display.paused", { prayer: pauseStatus.prayer })}
            </span>
          </div>
        ) : pauseStatus?.state === "approaching" ? (
          <div className="flex items-center gap-2">
            <span className="pip breathe" />
            <span className="text-[14px] text-[#9bbd9b]">
              {pauseStatus.prayer} · {Math.round(pauseStatus.msUntil / 60000)}m
            </span>
          </div>
        ) : nextPrayer ? (
          <span className="text-[12px] text-ink-mute">
            {nextPrayer.name} · <span className="font-mono">{nextPrayer.time}</span>
          </span>
        ) : null}

        <div className="font-mono text-[14px] text-ink">{time}</div>

        <div className="flex items-center gap-2">
          <span className="pip breathe" />
          <span className="text-[12px] text-[#9bbd9b] uppercase tracking-[0.22em]">{t("display.live")}</span>
        </div>
      </div>
    </header>
  );
}

/* ── Single big "Now Serving" (legacy / single-counter branches) ─ */
function SingleNowServing({ counter, t }) {
  if (!counter) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="ovline text-[14px] mb-6">{t("display.now_serving")}</div>
          <div className="text-[28px] text-ink-mute font-display italic">
            {t("display.no_one_serving")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center h-full">
      <div className="ovline text-[14px] mb-6">{t("display.now_serving")}</div>
      <div
        key={counter.ticket.token}
        className="drift-up gold-text font-display font-light tracking-tightest leading-none"
        style={{ fontSize: "clamp(180px, 22vw, 360px)" }}
      >
        {counter.ticket.token}
      </div>
      <div className="rule-ornament my-8 text-[12px]"><span>✦</span></div>
      <div className="text-[24px] text-ink mb-2">{counter.ticket.customer_name}</div>
      <div className="text-[14px] text-ink-mute tracking-wide">
        {counter.service ?? ""}
        {counter.staff && <span className="text-line-2 mx-2">·</span>}
        {counter.staff && <span className="text-gold-soft">with {counter.staff.display_name}</span>}
      </div>
    </div>
  );
}

/* ── Multi-counter grid (2+ staff serving simultaneously) ──────── */
function CounterGrid({ counters, t }) {
  // Up to 4 counters fit elegantly; beyond that we get a tighter grid
  const cols = counters.length <= 2 ? 1 : 2;
  const fontSize = counters.length <= 2
    ? "clamp(120px, 16vw, 220px)"
    : counters.length <= 4
      ? "clamp(80px, 10vw, 160px)"
      : "clamp(60px, 7vw, 120px)";

  return (
    <div
      className="grid gap-4 h-full"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {counters.map((c, i) => (
        <CounterCard key={c.ticket.id} counter={c} fontSize={fontSize} index={i} t={t} />
      ))}
    </div>
  );
}

function CounterCard({ counter, fontSize, index, t }) {
  return (
    <div className="relative corner-marks luxe-panel border border-line p-7 flex flex-col justify-between">
      <span className="cm cm-tl" /><span className="cm cm-tr" /><span className="cm cm-bl" /><span className="cm cm-br" />
      <div className="flex items-center justify-between">
        <span className="ovline text-[11px] text-gold-soft">
          Counter {String(index + 1).padStart(2, "0")}
          {counter.staff && <span className="text-ink-mute mx-2">·</span>}
          {counter.staff && <span className="text-ink">{counter.staff.display_name}</span>}
        </span>
        <span className="ovline text-[10px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1.5" /> {t("display.live")}
        </span>
      </div>

      <div className="text-center my-4">
        <div className="ovline text-[10px] mb-3">{t("display.now_serving")}</div>
        <div
          key={counter.ticket.token}
          className="drift-up gold-text font-display font-light tracking-tightest leading-none"
          style={{ fontSize }}
        >
          {counter.ticket.token}
        </div>
        <div className="rule-ornament my-4 text-[8px]"><span>✦</span></div>
        <div className="text-[16px] text-ink mb-1 truncate">{counter.ticket.customer_name}</div>
        <div className="text-[10px] text-ink-mute tracking-wide truncate">{counter.service}</div>
      </div>

      <ElapsedTime startedAt={counter.ticket.started_at} />
    </div>
  );
}

function ElapsedTime({ startedAt }) {
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
    <div className="text-center text-[9px] text-ink-mute font-mono tracking-wide">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")} elapsed
    </div>
  );
}

/* ── Up Next column ──────────────────────────────────────────── */
function UpNextPanel({ waiting, services, t, branchSlug, branded }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-6">
        <div className="ovline text-[14px]">{t("display.up_next")}</div>
        <span className="text-[12px] text-ink-mute font-mono">{waiting.length}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-hidden">
        {waiting.length === 0 ? (
          <div className="text-[14px] text-ink-mute italic">—</div>
        ) : waiting.slice(0, 8).map((tk, i) => (
          <div
            key={tk.id}
            className="grid grid-cols-[100px_1fr] gap-4 items-baseline border-b border-line py-3"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <div className="font-display text-gold-soft" style={{ fontSize: "clamp(28px, 3vw, 42px)" }}>
              {(tk.priority ?? 0) > 0 && <span className="text-[16px] text-gold mr-1">★</span>}
              {tk.token}
            </div>
            <div>
              <div className="text-[18px] text-ink truncate">{tk.customer_name}</div>
              <div className="text-[11px] text-ink-mute uppercase tracking-[0.18em]">
                {services[tk.service_id] ?? ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rule-ornament mt-6 text-[10px]"><span>·</span></div>
      {branded && (
        <div className="text-[10px] text-ink-mute uppercase tracking-[0.22em] text-center mt-3">
          azqueue.io · {branchSlug}
        </div>
      )}
    </div>
  );
}

/* ── Paused-for-prayer hero (replaces center area) ────────────── */
function PausedHero({ pauseStatus, t }) {
  const minLeft = Math.max(0, Math.round(pauseStatus.msLeft / 60000));
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="ovline text-[14px] mb-6 text-[#9bbd9b]">{t("display.paused", { prayer: pauseStatus.prayer })}</div>
      <div
        className="font-display sage-text font-light tracking-tightest leading-none"
        style={{ fontSize: "clamp(120px, 14vw, 240px)" }}
      >
        {pauseStatus.prayer}
      </div>
      <div className="rule-ornament my-8 text-[12px]"><span>✦</span></div>
      <div className="text-[20px] text-[#9bbd9b]">{t("display.paused", { prayer: pauseStatus.prayer })}</div>
      <div className="text-[14px] text-ink-mute mt-3 tracking-wide">
        Resumes in {minLeft} min
      </div>
    </div>
  );
}

function Atmosphere({ variant }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: variant === "sage"
          ? "radial-gradient(60% 80% at 50% 0%, rgba(127,163,127,0.12), transparent 70%), radial-gradient(40% 60% at 20% 80%, rgba(127,163,127,0.05), transparent 70%)"
          : "radial-gradient(60% 80% at 50% 0%, rgba(201,168,106,0.08), transparent 70%), radial-gradient(40% 60% at 20% 80%, rgba(201,168,106,0.04), transparent 70%)",
      }}
    />
  );
}

function FullScreenShell({ children, variant = "gold" }) {
  return (
    <div
      className="relative bg-bg text-ink min-h-screen overflow-hidden"
      style={variant === "sage" ? { background: "linear-gradient(180deg, #0c100d 0%, #0a0d0a 100%)" } : undefined}
    >
      {children}
    </div>
  );
}
