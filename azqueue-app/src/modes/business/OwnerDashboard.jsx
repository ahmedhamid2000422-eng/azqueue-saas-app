import { useCallback, useEffect, useMemo, useState } from "react";
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

  const [stats,    setStats]    = useState(null);   // { waitingNow, servedToday, avgWaitSec, noShowToday }
  const [stations, setStations] = useState([]);     // rows from stations + current ticket
  const [roster,   setRoster]   = useState([]);     // staff rows + served-today count
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
        .select("id, token, status, customer_name, service_id, staff_id, assigned_station_id, called_at, created_at")
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
        .select("id, name, window_number, status, preparer_id")
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

    // Average wait: time from created_at → called_at, for completed tickets with both timestamps
    const waitSamples = done.filter((t) => t.called_at && t.created_at);
    const avgWaitSec = waitSamples.length
      ? waitSamples.reduce((sum, t) =>
          sum + (new Date(t.called_at) - new Date(t.created_at)) / 1000, 0
        ) / waitSamples.length
      : null;

    setStats({
      waitingNow:  waiting.length,
      servingNow:  serving.length,
      servedToday: done.length,
      noShowToday: noShow.length,
      avgWaitSec,
    });

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
        staffMember:    st.preparer_id ? staffById[st.preparer_id] ?? null : null,
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
      <header className="mb-8">
        <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
          <span className="pip breathe" style={{ background: "#c9a86a" }} />
          Live · branch overview
        </div>
        <h1 className="font-display text-4xl font-light tracking-tightest">
          {branch.name}
        </h1>
        <div className="text-xs text-ink-mute mt-1">{branch.city}</div>
      </header>

      {/* ── Stats bar ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Waiting now"
          value={loading ? "…" : stats?.waitingNow ?? 0}
          hint="In queue"
          accent={stats?.waitingNow > 0}
        />
        <Stat
          label="Serving now"
          value={loading ? "…" : stats?.servingNow ?? 0}
          hint="At counters"
        />
        <Stat
          label="Served today"
          value={loading ? "…" : stats?.servedToday ?? 0}
          hint="Completed"
        />
        <Stat
          label="Avg wait"
          value={loading ? "…" : fmtWait(stats?.avgWaitSec)}
          hint="Created → called"
        />
      </div>

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

                  {/* Assigned staff */}
                  <div className="text-[10px] text-ink-mute border-t border-line pt-2 mt-auto">
                    {staff
                      ? <span>{staff.display_name} · <span style={{ color: statusLabel[staff.status]?.dot ?? "#888" }}>{statusLabel[staff.status]?.label ?? staff.status}</span></span>
                      : <span className="italic">Unassigned</span>
                    }
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
          subtitle="Status and today's completed visits"
        />
        {roster.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-ink-mute">
            No staff records found for this branch.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {roster.map((s) => {
              const st = statusLabel[s.status] ?? { label: s.status, dot: "#888" };
              return (
                <div
                  key={s.id}
                  className="px-5 py-4 flex items-center justify-between hover:bg-[rgba(201,168,106,0.02)] transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="pip"
                      style={{ background: st.dot, opacity: s.status === "off" ? 0.35 : 1 }}
                    />
                    <div>
                      <div className="text-sm text-ink">{s.display_name}</div>
                      <div className="ovline text-[8px] text-ink-mute mt-0.5">{s.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
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
    </div>
  );
}
