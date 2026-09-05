import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import Card, { CardHeader } from "../../components/Card";
import Stat from "../../components/Stat";

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

  const stationStatus = {
    open:   { label: "Open",   border: "border-[#506b50]/60", bg: "bg-[rgba(80,107,80,0.05)]" },
    busy:   { label: "Busy",   border: "border-[#c9a86a]/50", bg: "bg-[rgba(201,168,106,0.05)]" },
    closed: { label: "Closed", border: "border-line",         bg: ""                            },
  };

  if (!branch) {
    return <div className="p-8 text-ink-mute ovline">No branch selected.</div>;
  }

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="mb-6">
        <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
          <span className="pip breathe" style={{ background: "#c9a86a" }} />
          Live · branch overview
        </div>
        <h1 className="font-display text-4xl font-light tracking-tightest">
          {branch.name}
        </h1>
        <div className="text-xs text-ink-mute mt-1">{branch.city}</div>
      </header>

      {/* ── Who is next, and the one thing to do about it ────────
          Modelled on the reference dashboard's hero card, with one
          deliberate difference: it does NOT put a Call Next button here.

          Calling and completing happen on the Queue page. Two screens with
          the same action is how this project already broke station
          assignment — Overview wrote preparer_id, Stations wrote staff_id,
          and neither knew about the other for months. So this says who is
          next and hands you to the place that does the work. */}
      {!loading && queue.length > 0 && (() => {
        const next = queue.find((t) => t.status === "waiting");
        if (!next) return null;
        const waitedMin = Math.max(
          0,
          Math.round((Date.now() - new Date(next.created_at).getTime()) / 60000),
        );
        return (
          <button
            onClick={() => navigate("..")}
            className="w-full text-left mb-6 border-2 border-gold-deep bg-[rgba(201,168,106,0.06)] hover:bg-[rgba(201,168,106,0.12)] transition px-6 py-5 flex items-center justify-between gap-6 flex-wrap"
          >
            <div className="min-w-0">
              <div className="text-[10px] font-medium tracking-[0.08em] uppercase text-gold-soft mb-1.5">
                Next in line
              </div>
              <div className="font-display text-3xl font-light tracking-tight truncate">
                {next.customer_name || next.token}
              </div>
              <div className="text-[11.5px] text-ink-mute mt-1">
                {next.token} · waiting {waitedMin} min
                {next.detail ? ` · ${next.detail}` : ""}
              </div>
            </div>
            <div className="text-[11px] font-medium tracking-[0.08em] uppercase text-gold-soft shrink-0">
              Open the queue →
            </div>
          </button>
        );
      })()}

      {/* ── Stats bar ────────────────────────────────────────────
          Three, not four. "Serving now" was the weakest of the four — it is
          already visible in the stations grid below and on the queue page,
          and a number that repeats something two inches away is a number
          people stop reading. Wait is a MEDIAN now, and says so: the label
          used to read "Avg wait" while the hint said "Created → called",
          which described the calculation but not the statistic. */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat
          label="Waiting now"
          value={loading ? "…" : stats?.waitingNow ?? 0}
          hint="In queue"
          accent={stats?.waitingNow > 0}
        />
        <Stat
          label="Served today"
          value={loading ? "…" : stats?.servedToday ?? 0}
          hint="Completed"
        />
        {/* Says "average", computes a median — on purpose, and do not
            "fix" it to a mean. "Median" is a word for a statistics class,
            not for someone glancing at a screen between customers, and in
            everyday English "average" means "typical", which is exactly
            what a median is. A mean here would be the wrong number
            wearing the right word. */}
        <Stat
          label="Average wait"
          value={loading ? "…" : fmtWait(stats?.avgWaitSec)}
          hint="Today, check-in to called"
        />
      </div>

      {/* ── Who's in line right now ───────────────────────────────
          The stats bar says how many. This says who, and whether anything
          about their visit needs a look — a ticket with detail or an
          escalation reason is one the owner would otherwise only discover
          by asking. Click through for the full picture on that one visit. */}
      {queue.length > 0 && (
        <Card luxe className="mb-6">
          <CardHeader
            title="In line"
            subtitle="Tap anyone for the full picture"
            right={<span className="ovline text-[9px] text-ink-mute">{queue.length}</span>}
          />
          <div className="divide-y divide-line">
            {queue.map((t) => {
              const problem = t.escalated_reason || t.detail || null;
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`ticket/${t.id}`)}
                  className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-[rgba(201,168,106,0.03)] transition"
                >
                  <span
                    className="pip shrink-0"
                    style={{ background: t.status === "serving" ? "#c9a86a" : "#9bbd9b" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink truncate">
                      {t.customer_name || t.token}
                    </div>
                    {problem && (
                      <div className={`text-[11px] mt-0.5 truncate ${t.escalated_reason ? "text-[#d49185]" : "text-ink-mute"}`}>
                        {t.escalated_reason ? `Escalated · ${problem}` : problem}
                      </div>
                    )}
                  </div>
                  <span className="ovline text-[9px] text-ink-mute shrink-0">
                    {t.status === "serving" ? "Serving" : "Waiting"}
                  </span>
                  <span className="text-ink-mute shrink-0">›</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Stations grid ──────────────────────────────────────── */}
      <Card luxe className="mb-6">
        <CardHeader
          title="Stations"
          subtitle="Live counter status"
          right={
            <span className="ovline text-[9px] text-ink-mute">
              {stations.filter((s) => s.status !== "closed").length} of {stations.length} open
            </span>
          }
        />
        {stations.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-ink-mute">
            No stations configured. Add them in Settings → Stations.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
            {stations.map((st) => {
              const s = stationStatus[st.status] ?? stationStatus.open;
              const ticket = st.currentTicket;
              const staff  = st.staffMember;
              return (
                <div
                  key={st.id}
                  className={`border ${s.border} ${s.bg} p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="ovline text-[9px] text-ink-mute">
                        Counter {st.window_number}
                      </div>
                      <div className="text-sm font-medium text-ink mt-0.5">
                        {st.name || `Window ${st.window_number}`}
                      </div>
                    </div>
                    <span className={`ovline text-[8px] px-2 py-0.5 border ${s.border}`}>
                      {s.label}
                    </span>
                  </div>

                  {/* Current token */}
                  {ticket ? (
                    <div className="mb-3">
                      <div className="font-display text-3xl font-light tracking-tightest gold-text">
                        {ticket.token}
                      </div>
                      <div className="text-xs text-ink-soft mt-0.5 truncate">
                        {ticket.customer_name}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 font-display text-3xl font-light text-ink-mute tracking-tightest">
                      —
                    </div>
                  )}

                  {/* Assigned staff — with dropdown to reassign */}
                  <div className="border-t border-line pt-2 mt-auto">
                    {staff ? (
                      <div className="text-[10px] text-ink-mute mb-1.5">
                        {staff.display_name} · <span style={{ color: statusLabel[staff.status]?.dot ?? "#888" }}>{statusLabel[staff.status]?.label ?? staff.status}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-ink-mute italic mb-1.5">Unassigned</div>
                    )}
                    <AssignStaffSelect
                      stationId={st.id}
                      currentStaffId={st.staff_id}
                      roster={roster}
                      onAssigned={reload}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Staff roster ──────────────────────────────────────── */}
      <Card luxe>
        <CardHeader
          title="Staff on shift"
          subtitle="Toggle availability for today"
        />
        {roster.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-ink-mute">
            No staff records found for this branch.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {roster.map((s) => {
              const st = statusLabel[s.status] ?? { label: s.status, dot: "#888" };
              const isOff = s.status === "off";
              return (
                <div
                  key={s.id}
                  className={`px-5 py-4 flex items-center justify-between transition ${isOff ? "opacity-50" : "hover:bg-[rgba(201,168,106,0.02)]"}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="pip"
                      style={{ background: st.dot, opacity: isOff ? 0.35 : 1 }}
                    />
                    <div>
                      <div className="text-sm text-ink">{s.display_name}</div>
                      <div className="ovline text-[8px] text-ink-mute mt-0.5">{s.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {s.currentTicket && (
                      <span className="text-xs text-gold-soft font-display">
                        {s.currentTicket.token}
                      </span>
                    )}
                    <div className="text-right">
                      <div className="text-sm text-ink">{s.servedToday}</div>
                      <div className="ovline text-[8px] text-ink-mute">served today</div>
                    </div>
                    <span className="ovline text-[9px]" style={{ color: st.dot }}>{st.label}</span>
                    {/* Available / Away toggle — only toggle off↔active, never override serving */}
                    {s.status !== "serving" && (
                      <button
                        onClick={async () => {
                          const next = isOff ? "active" : "off";
                          await supabase.from("staff").update({ status: next }).eq("id", s.id);
                          reload();
                        }}
                        className={`text-[8px] ovline border px-2 py-0.5 transition whitespace-nowrap ${
                          isOff
                            ? "border-[#506b50]/60 text-[#9bbd9b]/80 hover:border-[#506b50] hover:text-[#9bbd9b]"
                            : "border-line text-ink-mute hover:border-[#b56b5f]/60 hover:text-[#d49185]"
                        }`}
                        title={isOff ? "Mark as available" : "Mark as away today"}
                      >
                        {isOff ? "Mark available" : "Mark away"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic font-display">
          Staff counts show completed visits today — not relative comparisons.
        </div>
      </Card>

      {/* The one chart, full width along the bottom. See WaitToday. */}
      <div className="mt-6">
        <WaitToday samples={stats?.waitSamples} loading={loading} />
      </div>
    </div>
  );
}

/* ── Assign staff to a station ──────────────────────────────────────── */
function AssignStaffSelect({ stationId, currentStaffId, roster, onAssigned }) {
  const [busy, setBusy] = useState(false);

  async function assign(staffId) {
    setBusy(true);
    await supabase
      .from("stations")
      .update({ staff_id: staffId || null })
      .eq("id", stationId);
    setBusy(false);
    onAssigned();
  }

  return (
    <select
      value={currentStaffId ?? ""}
      onChange={(e) => assign(e.target.value)}
      disabled={busy}
      className="w-full text-[9px] ovline bg-transparent border border-line text-ink-mute px-2 py-1 hover:border-gold-deep/50 focus:outline-none focus:border-gold-deep transition disabled:opacity-40"
    >
      <option value="">Unassigned</option>
      {roster.map((s) => (
        <option key={s.id} value={s.id} disabled={s.status === "off"}>
          {s.display_name}{s.status === "off" ? " (away)" : ""}
        </option>
      ))}
    </select>
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
