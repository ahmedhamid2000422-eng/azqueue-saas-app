import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import Card, { CardHeader } from "../../components/Card";

/**
 * OwnerDashboard — bird's-eye view of the whole branch for the owner / manager.
 *
 * Shows:
 *   · Live stats bar   — waiting now, served today, avg wait (min), no-show count
 *   · Stations grid    — each station card with status, assigned staff, current ticket
 *   · Staff roster     — all staff at this branch with their live status + tickets served today
 *
 * Realtime: one subscription on tickets + one on staff changes → re-fetches lightweight
 * aggregates on every change. No per-staff comparisons or leaderboards.
 *
 * Ethics note: staff cards show status + served-today count only.
 * No speed rankings, no percentages vs colleagues, no pressure framing.
 */
export default function OwnerDashboard() {
  const { branch } = useBranch();
  const navigate = useNavigate();

  const [stats,    setStats]    = useState(null);   // { waitingNow, servedToday, avgWaitSec, noShowToday }
  const [stations, setStations] = useState([]);     // rows from stations + current ticket
  const [roster,   setRoster]   = useState([]);     // staff rows + served-today count
  const [queue,    setQueue]    = useState([]);     // active tickets, newest last, with their "problem" if any
  const [loading,  setLoading]  = useState(true);

  /* ── Fetch ────────────────────────────────────────────────────── */
  const reload = useCallback(async () => {
    if (!branch?.id) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [
      { data: activeTickets },
      { data: doneTickets },
      { data: stationRows },
      { data: staffRows },
    ] = await Promise.all([
      // Active tickets (waiting + serving)
      supabase
        .from("tickets")
        .select("id, token, status, customer_name, service_id, staff_id, assigned_station_id, called_at, created_at, detail, escalated_at, escalated_reason")
        .eq("branch_id", branch.id)
        .in("status", ["waiting", "serving"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true }),

      // Completed + cancelled today (for stats)
      supabase
        .from("tickets")
        .select("id, status, staff_id, called_at, created_at, completed_at")
        .eq("branch_id", branch.id)
        .in("status", ["completed", "cancelled"])
        .gte("created_at", todayIso),

      // All stations
      supabase
        .from("stations")
        .select("id, name, window_number, status, staff_id")
        .eq("branch_id", branch.id)
        .order("window_number"),

      // All staff
      supabase
        .from("staff")
        .select("id, display_name, role, status")
        .eq("branch_id", branch.id)
        .order("display_name"),
    ]);

    /* ── Derived stats ────────────────────────────────────────── */
    const waiting = (activeTickets ?? []).filter((t) => t.status === "waiting");
    const serving = (activeTickets ?? []).filter((t) => t.status === "serving");
    const done    = (doneTickets  ?? []).filter((t) => t.status === "completed");
    const noShow  = (doneTickets  ?? []).filter((t) => t.status === "cancelled");

    /* MEDIAN, NOT MEAN. Wait times are right-skewed — they cannot go below
       zero but one forgotten customer sits for hours, and a single outlier
       drags an average to a number nobody experienced. The whole project has
       been bitten by this: a pooled mean of 62 minutes matched none of the
       four clean days, which ranged 18–47. See docs/statistics-lessons.md. */
    const waitSamples = done
      .filter((t) => t.called_at && t.created_at)
      .map((t) => ({
        sec: (new Date(t.called_at) - new Date(t.created_at)) / 1000,
        at:  new Date(t.created_at),
      }));

    const median = (arr) => {
      if (!arr.length) return null;
      const v = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(v.length / 2);
      return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
    };

    const avgWaitSec = median(waitSamples.map((w) => w.sec));

    setStats({
      waitingNow:  waiting.length,
      servingNow:  serving.length,
      servedToday: done.length,
      noShowToday: noShow.length,
      avgWaitSec,
      waitSamples,
    });

    /* Same order the queue itself uses — priority first, then who arrived
       earliest. "Problem" is escalated_reason when someone flagged it for the
       owner, otherwise the free-text detail staff typed in, otherwise blank —
       a ticket with neither is just proceeding normally. */
    setQueue(activeTickets ?? []);

    /* ── Enrich stations with current ticket ─────────────────── */
    const servedMap = {};
    [...done, ...noShow].forEach((t) => {
      if (t.staff_id) servedMap[t.staff_id] = (servedMap[t.staff_id] ?? 0) + (t.status === "completed" ? 1 : 0);
    });

    const servingByStation = {};
    serving.forEach((t) => {
      if (t.assigned_station_id) servingByStation[t.assigned_station_id] = t;
    });

    const staffById = {};
    (staffRows ?? []).forEach((s) => { staffById[s.id] = s; });

    setStations(
      (stationRows ?? []).map((st) => ({
        ...st,
        staffMember:    st.staff_id ? staffById[st.staff_id] ?? null : null,
        currentTicket:  servingByStation[st.id] ?? null,
      }))
    );

    /* ── Enrich roster with served-today count ───────────────── */
    setRoster(
      (staffRows ?? []).map((s) => ({
        ...s,
        servedToday: servedMap[s.id] ?? 0,
        currentTicket: serving.find((t) => t.staff_id === s.id) ?? null,
      }))
    );

    setLoading(false);
  }, [branch?.id]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  /* ── Realtime (tickets + staff) ───────────────────────────── */
  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`owner-dash-${branch.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `branch_id=eq.${branch.id}` },
        () => reload()
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "staff", filter: `branch_id=eq.${branch.id}` },
        () => reload()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch?.id, reload]);

  /* ── Helpers ──────────────────────────────────────────────── */
  function fmtWait(sec) {
    if (sec == null) return "—";
    const m = Math.round(sec / 60);
    return m < 1 ? "<1 min" : `${m} min`;
  }

  const statusLabel = {
    active:   { label: "Active",   dot: "#9bbd9b" },
    serving:  { label: "Serving",  dot: "#c9a86a" },
    on_break: { label: "On break", dot: "#888" },
    off:      { label: "Off",      dot: "#555" },
  };

  if (!branch) {
    return <div className="p-8 text-ink-mute ovline">No branch selected.</div>;
  }

  /* ── LIVE SIGNALS ────────────────────────────────────────────────
     What the owner should be told, computed only from what is true right
     now. No baselines, no "longer than usual", no comparisons to a past
     that has four clean days in it — that is the p90 alert mistake, and
     this project has already retracted five findings of exactly that shape.

     Everything here is a present-tense fact: this person has waited this
     long, this counter has nobody on it. Silent when nothing is wrong,
     which is the point — an insight panel that always has something to say
     is decoration. */
  const LONG_WAIT_MIN = 30;
  const LONG_VISIT_MIN = 45;

  const signals = [];
  if (!loading) {
    const now = Date.now();

    const longWaits = queue.filter(
      (t) => t.status === "waiting" &&
        (now - new Date(t.created_at).getTime()) / 60000 >= LONG_WAIT_MIN,
    );
    if (longWaits.length) {
      const worst = Math.round(
        Math.max(...longWaits.map((t) => (now - new Date(t.created_at).getTime()) / 60000)),
      );
      signals.push({
        tone: "warn",
        text: longWaits.length === 1
          ? `${longWaits[0].customer_name || longWaits[0].token} has been waiting ${worst} minutes.`
          : `${longWaits.length} people have been waiting over ${LONG_WAIT_MIN} minutes — longest is ${worst}.`,
      });
    }

    const longVisits = queue.filter(
      (t) => t.status === "serving" && t.called_at &&
        (now - new Date(t.called_at).getTime()) / 60000 >= LONG_VISIT_MIN,
    );
    if (longVisits.length) {
      signals.push({
        tone: "info",
        text: longVisits.length === 1
          ? `${longVisits[0].customer_name || longVisits[0].token} has been with someone for over ${LONG_VISIT_MIN} minutes.`
          : `${longVisits.length} visits have been running over ${LONG_VISIT_MIN} minutes.`,
      });
    }

    const escalated = queue.filter((t) => t.escalated_at);
    if (escalated.length) {
      signals.push({
        tone: "warn",
        text: `${escalated.length} ${escalated.length === 1 ? "visit needs" : "visits need"} the manager.`,
      });
    }
  }

  const openStations = stations.filter((s) => s.status !== "closed").length;
  const nextUp = queue.find((t) => t.status === "waiting");

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      {/* ── 1. BRANCH HEALTH ──────────────────────────────────────
          One line, not four boxes. "How busy are we, are people waiting too
          long, do we have the counters open" is a single glance, and giving
          each part its own bordered card made the eye stop three times to
          answer one question. */}
      <header className="mb-8">
        <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
          <span className="pip breathe" style={{ background: "#c9a86a" }} />
          {branch.name}
          {branch.city && <span className="text-ink-mute">· {branch.city}</span>}
        </div>
        <div className="flex items-baseline gap-x-8 gap-y-2 flex-wrap font-display font-light tracking-tight">
          <span className="text-4xl">
            {loading ? "…" : stats?.waitingNow ?? 0}
            <span className="text-[13px] font-sans tracking-normal text-ink-mute ml-2">waiting</span>
          </span>
          <span className="text-4xl">
            {loading ? "…" : fmtWait(stats?.avgWaitSec)}
            <span className="text-[13px] font-sans tracking-normal text-ink-mute ml-2">average wait</span>
          </span>
          <span className="text-4xl">
            {loading ? "…" : `${openStations}/${stations.length || 0}`}
            <span className="text-[13px] font-sans tracking-normal text-ink-mute ml-2">counters open</span>
          </span>
          <span className="text-4xl">
            {loading ? "…" : stats?.servedToday ?? 0}
            <span className="text-[13px] font-sans tracking-normal text-ink-mute ml-2">served today</span>
          </span>
        </div>
      </header>

      {/* ── 2. WHAT IS HAPPENING NOW ──────────────────────────────
          Two columns: the queue, and the room. Borders only where they
          separate genuinely different things — the previous version had
          cards inside cards inside a grid, and you started noticing the
          containers instead of the contents. */}
      <div className="grid grid-cols-12 gap-8 mb-8">

        {/* Left — next up, then the rest of the line */}
        <div className="col-span-12 lg:col-span-7">
          {nextUp ? (
            <button
              onClick={() => navigate("..")}
              className="w-full text-left border-2 border-gold-deep bg-[rgba(201,168,106,0.06)] hover:bg-[rgba(201,168,106,0.12)] transition px-6 py-5 mb-4"
            >
              <div className="text-[10px] font-medium tracking-[0.08em] uppercase text-gold-soft mb-1.5">
                Next in line
              </div>
              <div className="font-display text-3xl font-light tracking-tight truncate">
                {nextUp.customer_name || nextUp.token}
              </div>
              <div className="text-[11.5px] text-ink-mute mt-1">
                {nextUp.token}
                {" · waiting "}
                {Math.max(0, Math.round((Date.now() - new Date(nextUp.created_at).getTime()) / 60000))} min
                {nextUp.detail ? ` · ${nextUp.detail}` : ""}
              </div>
              <div className="text-[11px] font-medium tracking-[0.08em] uppercase text-gold-soft mt-3">
                Open the queue →
              </div>
            </button>
          ) : (
            <div className="border border-line px-6 py-8 mb-4 text-center">
              <div className="text-[13px] text-ink-soft">Nobody is waiting.</div>
            </div>
          )}

          {queue.length > 1 && (
            <>
              <div className="ovline text-[9px] text-ink-mute mb-2">
                Also in line · {queue.length - (nextUp ? 1 : 0)}
              </div>
              <div className="divide-y divide-line border-y border-line">
                {queue.filter((t) => t.id !== nextUp?.id).slice(0, 6).map((t) => {
                  const problem = t.escalated_reason || t.detail || null;
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate(`ticket/${t.id}`)}
                      className="w-full px-1 py-2.5 flex items-center gap-3 text-left hover:bg-[rgba(201,168,106,0.03)] transition"
                    >
                      <span className="pip shrink-0" style={{ background: t.status === "serving" ? "#c9a86a" : "#9bbd9b" }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-ink truncate">{t.customer_name || t.token}</div>
                        {problem && (
                          <div className={`text-[11px] mt-0.5 truncate ${t.escalated_reason ? "text-[#d49185]" : "text-ink-mute"}`}>
                            {problem}
                          </div>
                        )}
                      </div>
                      <span className="text-ink-mute shrink-0 text-[12px]">›</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right — the team */}
        <div className="col-span-12 lg:col-span-5">
          <div className="ovline text-[9px] text-ink-mute mb-2">Team</div>
          <div className="divide-y divide-line border-y border-line">
            {roster.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-mute">No staff yet.</div>
            ) : roster.map((s) => {
              const st = statusLabel[s.status] ?? { label: s.status, dot: "#888" };
              const isOff = s.status === "off";
              return (
                <div key={s.id} className={`py-3 flex items-center justify-between gap-3 ${isOff ? "opacity-45" : ""}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="pip shrink-0" style={{ background: st.dot }} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-ink truncate">{s.display_name}</div>
                      <div className="text-[10.5px] text-ink-mute">{st.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.currentTicket && (
                      <span className="text-[11px] text-gold-soft font-display">{s.currentTicket.token}</span>
                    )}
                    {s.status !== "serving" && (
                      <button
                        onClick={async () => {
                          await supabase.from("staff").update({ status: isOff ? "active" : "off" }).eq("id", s.id);
                          reload();
                        }}
                        className="text-[10px] font-medium tracking-[0.08em] uppercase text-ink-mute hover:text-ink transition"
                      >
                        {isOff ? "On" : "Away"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-ink-mute mt-2 italic font-display">
            Who is here — not who is fastest.
          </div>
        </div>
      </div>

      {/* ── 3. WHAT NEEDS A LOOK ──────────────────────────────────
          Silent when nothing is wrong. A panel that always says something is
          a panel people stop reading, and "all quiet" in a large box is the
          most expensive way to say nothing. */}
      {signals.length > 0 && (
        <div className="mb-8 flex flex-col gap-2">
          {signals.slice(0, 3).map((sig, i) => (
            <div
              key={i}
              className={`border-l-2 pl-4 py-2 text-[12.5px] ${
                sig.tone === "warn"
                  ? "border-l-[#b56b5f] text-[#d49185]"
                  : "border-l-gold-deep text-gold-soft"
              }`}
            >
              {sig.text}
            </div>
          ))}
        </div>
      )}

      {/* ── Deeper, underneath ────────────────────────────────────
          Answers "why is this happening", not "what should I do now", so it
          sits below everything operational. */}
      <WaitToday samples={stats?.waitSamples} loading={loading} />

      {/* Counters live behind a link rather than a grid of cards. Configuring
          them is a Settings job, and seeing them is already covered by the
          counters-open figure at the top. */}
      <div className="mt-6">
        <button
          onClick={() => navigate("../stations")}
          className="text-[11px] font-medium tracking-[0.08em] uppercase text-ink-mute hover:text-gold-soft transition"
        >
          Counters and staffing →
        </button>
      </div>
    </div>
  );
}


/* ── WaitToday ───────────────────────────────────────────────────────
   The one chart on this page, full width along the bottom.

   WHY ONLY ONE
   The reference dashboard this was modelled on had three side by side —
   an hourly bar chart, a service-mix donut and a suggestions panel. Three
   charts is three things to interpret before you know whether today is
   going well, and the owner said plainly it was too much. Wait time is the
   number this business actually competes on, so it gets the space and the
   others go away.

   WHY IT REFUSES TO DRAW SOMETIMES
   With fewer than four completed visits an "average wait per hour" is one or
   two people's experience drawn as a trend. This project has already
   retracted five findings that were exactly that — a shape fitted to too
   little data. So under the threshold it states the count instead, which is
   honest and still useful.
*/
const MIN_FOR_CHART = 4;

function WaitToday({ samples, loading }) {
  if (loading) {
    return (
      <Card luxe>
        <CardHeader title="Wait times today" />
        <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
      </Card>
    );
  }

  const list = samples ?? [];

  if (list.length < MIN_FOR_CHART) {
    return (
      <Card luxe>
        <CardHeader title="Wait times today" />
        <div className="px-5 py-8 text-center">
          <div className="text-[13px] text-ink-soft">
            {list.length === 0
              ? "Nobody has been served yet today."
              : `Only ${list.length} ${list.length === 1 ? "visit" : "visits"} so far today.`}
          </div>
          <div className="text-[11px] text-ink-mute mt-1.5">
            A pattern needs at least {MIN_FOR_CHART} to mean anything.
          </div>
        </div>
      </Card>
    );
  }

  /* Bucket by hour of arrival, median within each. Only hours that actually
     had visits are drawn — an empty 8am bar reads as "nobody waited" rather
     than "we were closed". */
  const byHour = {};
  for (const s of list) {
    const h = s.at.getHours();
    (byHour[h] ??= []).push(s.sec);
  }

  const med = (arr) => {
    const v = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  };

  const hours = Object.keys(byHour)
    .map(Number)
    .sort((a, b) => a - b)
    .map((h) => ({ hour: h, min: Math.round(med(byHour[h]) / 60), n: byHour[h].length }));

  const peak = Math.max(...hours.map((h) => h.min), 1);
  const overall = Math.round(med(list.map((s) => s.sec)) / 60);
  const label = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

  return (
    <Card luxe>
      <CardHeader
        title="Wait times today"
        subtitle={`${overall} min on average across ${list.length} visits`}
      />
      <div className="px-5 py-5">
        <div className="flex items-end gap-2 h-32">
          {hours.map((h) => (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
              <div className="text-[10px] text-ink-mute">{h.min}</div>
              <div
                className="w-full bg-gold-deep/70 hover:bg-gold-deep transition"
                style={{ height: `${Math.max(4, (h.min / peak) * 100)}%` }}
                title={`${h.n} ${h.n === 1 ? "visit" : "visits"}, ${h.min} min on average`}
              />
              <div className="text-[9px] font-medium tracking-[0.08em] uppercase text-ink-mute truncate w-full text-center">
                {label(h.hour)}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-ink-mute mt-3 leading-relaxed">
          Minutes from check-in to being called, by the hour people arrived.
          One unusually long visit will not drag the whole day up.
        </div>
      </div>
    </Card>
  );
}
