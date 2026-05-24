import { useCallback, useEffect, useRef, useState } from "react";
import { useBranch } from "../../lib/BranchContext";
import { useAuth } from "../../lib/AuthContext";
import { supabase } from "../../lib/supabase";
import { getLimits } from "../../lib/tier";
import TierGate from "../../components/TierGate";
import Button from "../../components/Button";
import Card from "../../components/Card";
import {
  loadStations,
  createStation,
  renameStation,
  setStationStatus,
  deleteStation,
  routeNextTicket,
  reassignTicket,
  isCoverageLow,
} from "../../lib/stations";
import {
  loadPolicy,
  savePolicy,
  loadOpenEscalations,
  resolveEscalation,
  runSweep,
  fmtElapsed,
} from "../../lib/sla";

/**
 * Stations board — live view of every station's status and load.
 *
 * Ethics contract:
 *   - Cards show station load (task count), never a person's speed or score.
 *   - Pausing is a station action — it is current operational state, not a
 *     break log. pause_reason is displayed live and forgotten when resumed.
 *   - Coverage warning nudges the manager to open a station; it never blocks
 *     or pressures the worker who is pausing.
 *   - No leaderboard, no ranking, no per-person history. Ever.
 */
export default function Stations() {
  return (
    <TierGate
      requires="professional"
      feature="Stations & Routing"
      reason="Balance workload across service counters. Route tasks to the least-loaded active station automatically. Pause a station for prayer or break — coverage is the system's responsibility, not the worker's."
    >
      <StationsInner />
    </TierGate>
  );
}

// ── Status helpers ────────────────────────────────────────────────────

const STATUS_LABEL = {
  active:  "Active",
  paused:  "On break",
  offline: "Offline",
};

const PAUSE_REASONS = [
  { value: "break",       label: "Break" },
  { value: "prayer",      label: "Prayer" },
  { value: "maintenance", label: "Maintenance" },
];

function statusColor(status) {
  if (status === "active")  return "text-[#9bbd9b] border-[#506b50]";
  if (status === "paused")  return "text-gold-soft border-gold-deep";
  return "text-ink-mute border-line";
}

function statusPip(status) {
  if (status === "active") return "bg-[#7fa37f] breathe";
  if (status === "paused") return "bg-gold";
  return "bg-ink-mute";
}

// ── Inner component ───────────────────────────────────────────────────

function StationsInner() {
  const { branch, dbReady } = useBranch();
  const { user } = useAuth();
  const limits = getLimits(user);
  const slaEnabled = limits.opsSla;

  const [stations,    setStations]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState(null);
  const [coverageLow, setCoverageLow] = useState(false);

  // New-station form state
  const [creating,   setCreating]   = useState(false);
  const [newName,    setNewName]    = useState("");

  // Rename state
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal,  setRenameVal]  = useState("");

  // Pause-reason picker
  const [pausingId,  setPausingId]  = useState(null);

  // Reassign picker
  const [reassignTicketId,  setReassignTicketId]  = useState(null);
  const [reassignStationId, setReassignStationId] = useState(null);
  const [branchTickets,     setBranchTickets]     = useState([]);

  // ── SLA state ─────────────────────────────────────────────────────
  const [policy,       setPolicy]       = useState(null);
  const [escalations,  setEscalations]  = useState([]);
  const [slaEditOpen,  setSlaEditOpen]  = useState(false);
  const [slaForm,      setSlaForm]      = useState({ targetSecs: 600, breachSecs: 900, enabled: false, bounceWarnCount: 2, bounceBreachCount: 3 });
  const sweepRef = useRef(null);

  // ── Data ──────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    if (!branch?.id) return;
    setLoading(true);
    try {
      const [data, pol, escs] = await Promise.all([
        loadStations(branch.id),
        slaEnabled ? loadPolicy(branch.id) : Promise.resolve(null),
        slaEnabled ? loadOpenEscalations(branch.id) : Promise.resolve([]),
      ]);
      setStations(data);
      setCoverageLow(isCoverageLow(data));
      if (pol) { setPolicy(pol); setSlaForm({ targetSecs: pol.target_secs, breachSecs: pol.breach_secs, enabled: pol.enabled, bounceWarnCount: pol.bounce_warn_count ?? 2, bounceBreachCount: pol.bounce_breach_count ?? 3 }); }
      setEscalations(escs);
    } finally {
      setLoading(false);
    }
  }, [branch?.id, slaEnabled]);

  useEffect(() => { reload(); }, [reload]);

  // SLA sweep — one query per branch every 60s, only when policy is enabled
  useEffect(() => {
    if (!slaEnabled || !branch?.id) return;
    sweepRef.current = setInterval(async () => {
      const pol = await loadPolicy(branch.id);
      if (!pol?.enabled) return;
      await runSweep(branch.id, pol);
      // Escalations refresh comes via realtime subscription below
    }, 60_000);
    return () => clearInterval(sweepRef.current);
  }, [slaEnabled, branch?.id]);

  // Realtime: re-derive load whenever stations or tickets change
  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`stations-board-${branch.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "stations",
          filter: `branch_id=eq.${branch.id}` },
        () => reload()
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tickets",
          filter: `branch_id=eq.${branch.id}` },
        () => reload()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch?.id, reload]);

  // Realtime: refresh escalations when new ones are inserted/resolved
  useEffect(() => {
    if (!slaEnabled || !branch?.id) return;
    const ch = supabase
      .channel(`escalations-${branch.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "escalations" },
        async () => {
          const escs = await loadOpenEscalations(branch.id);
          setEscalations(escs);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slaEnabled, branch?.id]);

  // ── SLA actions ───────────────────────────────────────────────────

  async function handleSaveSlaPolicy() {
    if (!branch?.id) return;
    setBusy(true); setError(null);
    try {
      const saved = await savePolicy(branch.id, slaForm);
      setPolicy(saved);
      setSlaEditOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(escalationId) {
    setBusy(true); setError(null);
    try {
      await resolveEscalation(escalationId);
      setEscalations((prev) => prev.filter((e) => e.id !== escalationId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim() || !branch?.id) return;
    setBusy(true);
    setError(null);
    try {
      const station = await createStation(branch.id, newName);
      setStations((prev) => [...prev, station]);
      setNewName("");
      setCreating(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(stationId) {
    if (!renameVal.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await renameStation(stationId, renameVal);
      setRenamingId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetStatus(stationId, status, reason = null) {
    setBusy(true);
    setError(null);
    try {
      await setStationStatus(stationId, status, reason);
      setPausingId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(stationId) {
    if (!confirm("Remove this station? Assigned tasks will become unrouted.")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteStation(stationId);
      setStations((prev) => prev.filter((s) => s.id !== stationId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRouteNext() {
    if (!branch?.id) return;
    setBusy(true);
    setError(null);
    try {
      const ticketId = await routeNextTicket(branch.id);
      if (!ticketId) setError("No unrouted tickets, or no active stations.");
      else await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openReassign(ticketId) {
    setReassignTicketId(ticketId);
    setReassignStationId(null);
    // Load the branch's active tickets for context
    const { data } = await supabase
      .from("tickets")
      .select("id, token, customer_name, assigned_station_id")
      .eq("branch_id", branch.id)
      .in("status", ["waiting", "serving"]);
    setBranchTickets(data ?? []);
  }

  async function handleReassign() {
    if (!reassignTicketId || !reassignStationId) return;
    setBusy(true);
    setError(null);
    try {
      await reassignTicket(reassignTicketId, reassignStationId);
      setReassignTicketId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────

  if (!dbReady) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Stations</h1>
        <p className="text-ink-soft text-sm">Run the database migration to enable Stations.</p>
      </div>
    );
  }

  if (!branch) {
    return <div className="p-8 text-ink-mute ovline">Select a branch to manage stations.</div>;
  }

  // ── Render ────────────────────────────────────────────────────────

  const activeCount  = stations.filter((s) => s.status === "active").length;
  const pausedCount  = stations.filter((s) => s.status === "paused").length;
  const offlineCount = stations.filter((s) => s.status === "offline").length;

  return (
    <div className="atmosphere-hero p-6 sm:p-8 max-w-6xl">

      {/* ── Header ── */}
      <header className="flex justify-between items-start mb-8 gap-4 flex-wrap">
        <div>
          <div className="ovline mb-2 text-gold-soft">Ops · Station board</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Stations</h1>
          <div className="text-xs text-ink-soft mt-2 flex items-center gap-3">
            <span className="pip breathe inline-block" />
            {loading ? "Loading…" : (
              <>
                <span className="text-[#9bbd9b]">{activeCount} active</span>
                {pausedCount  > 0 && <span className="text-gold-soft">· {pausedCount} on break</span>}
                {offlineCount > 0 && <span className="text-ink-mute">· {offlineCount} offline</span>}
                <span className="text-ink-mute">· {branch.name}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost" size="sm"
            onClick={handleRouteNext}
            disabled={busy || activeCount === 0}
            title="Assign next unrouted task to the least-loaded active station"
          >
            Route next →
          </Button>
          <Button size="sm" onClick={() => setCreating(true)} disabled={busy}>
            + Add station
          </Button>
        </div>
      </header>

      {/* ── Coverage warning — nudge for manager, never a pressure on worker ── */}
      {coverageLow && (
        <div className="mb-6 border border-gold-deep bg-[rgba(201,168,106,0.06)] px-4 py-3 text-xs text-gold-soft flex items-start gap-2">
          <span className="pip bg-gold mt-0.5 shrink-0" />
          <span>
            Coverage low — only {activeCount} station{activeCount !== 1 ? "s" : ""} active.
            Consider opening another station to keep the queue moving.
          </span>
        </div>
      )}

      {/* ── SLA policy panel ── */}
      {slaEnabled && (
        <div className="mb-6 border border-line bg-bg-elev p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="ovline text-[9px] mb-1 text-gold-soft">SLA · Breach &amp; Bounce tracking</div>
              <div className="text-xs text-ink-soft">
                {policy?.enabled
                  ? `⏱ warn ${fmtElapsed(policy.target_secs)} · breach ${fmtElapsed(policy.breach_secs)}  ·  ↩ warn ${policy.bounce_warn_count ?? 2}× · breach ${policy.bounce_breach_count ?? 3}×`
                  : "Disabled — enable to track task time and bounce counts"}
              </div>
            </div>
            <button
              onClick={() => setSlaEditOpen((o) => !o)}
              className="text-[10px] text-ink-mute hover:text-ink border border-line px-2.5 py-1 transition shrink-0"
            >
              {slaEditOpen ? "Close" : "Configure"}
            </button>
          </div>

          {slaEditOpen && (
            <div className="mt-4 border-t border-line pt-4 flex flex-col gap-4">
              <label className="flex items-center gap-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={slaForm.enabled}
                  onChange={(e) => setSlaForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="accent-gold-deep"
                />
                <span>Enable SLA sweep (runs every 60 seconds)</span>
              </label>
              <div className="flex gap-6 flex-wrap">
                <div className="flex flex-col gap-2">
                  <div className="ovline text-[9px] text-ink-mute">⏱ Time thresholds</div>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex flex-col gap-1 text-xs text-ink-soft">
                      Warn after (min)
                      <input
                        type="number" min="1" max="120"
                        value={Math.round(slaForm.targetSecs / 60)}
                        onChange={(e) => setSlaForm((f) => ({ ...f, targetSecs: Number(e.target.value) * 60 }))}
                        className="mt-1 w-20 bg-transparent border-b border-line px-1 py-0.5 text-ink focus:outline-none focus:border-gold-deep"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-ink-soft">
                      Breach after (min)
                      <input
                        type="number" min="1" max="180"
                        value={Math.round(slaForm.breachSecs / 60)}
                        onChange={(e) => setSlaForm((f) => ({ ...f, breachSecs: Number(e.target.value) * 60 }))}
                        className="mt-1 w-20 bg-transparent border-b border-line px-1 py-0.5 text-ink focus:outline-none focus:border-gold-deep"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="ovline text-[9px] text-ink-mute">↩ Bounce thresholds</div>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex flex-col gap-1 text-xs text-ink-soft">
                      Warn after (parks)
                      <input
                        type="number" min="1" max="10"
                        value={slaForm.bounceWarnCount}
                        onChange={(e) => setSlaForm((f) => ({ ...f, bounceWarnCount: Number(e.target.value) }))}
                        className="mt-1 w-20 bg-transparent border-b border-line px-1 py-0.5 text-ink focus:outline-none focus:border-gold-deep"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-ink-soft">
                      Breach after (parks)
                      <input
                        type="number" min="2" max="20"
                        value={slaForm.bounceBreachCount}
                        onChange={(e) => setSlaForm((f) => ({ ...f, bounceBreachCount: Number(e.target.value) }))}
                        className="mt-1 w-20 bg-transparent border-b border-line px-1 py-0.5 text-ink focus:outline-none focus:border-gold-deep"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveSlaPolicy} disabled={busy}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setSlaEditOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Open escalations — station-level only, never per-person ── */}
      {slaEnabled && escalations.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          <div className="ovline text-[9px] mb-2">Open escalations</div>
          {escalations.map((esc) => {
            const station  = stations.find((s) => s.id === esc.station_id);
            const isBreach = esc.level === "breach";
            const isBounce = esc.reason === "bounce_excessive";
            const icon     = isBounce ? "↩" : "⏱";

            // Message differs by reason type so managers know what action to take
            const description = isBounce
              ? isBreach
                ? `A customer has been parked back 3+ times${station ? ` at ${station.name}` : ""} — direct manager attention needed.`
                : `A customer has been parked back repeatedly${station ? ` at ${station.name}` : ""} — consider a dedicated counter.`
              : isBreach
                ? `${station ? station.name : "A station"} has a task past the breach threshold — consider reassigning or opening another counter.`
                : `${station ? station.name : "A station"} has a task approaching the time limit — keep an eye on it.`;

            return (
              <div
                key={esc.id}
                className={`border px-4 py-3 flex items-center gap-3 text-xs ${
                  isBreach
                    ? "border-red-900/40 bg-red-950/10 text-red-400"
                    : "border-gold-deep bg-[rgba(201,168,106,0.06)] text-gold-soft"
                }`}
              >
                <span className={`shrink-0 text-sm leading-none ${isBreach ? "text-red-400" : "text-gold"}`}>
                  {icon}
                </span>
                <span className="flex-1">
                  <span className="font-medium">
                    {isBounce
                      ? (isBreach ? "Bounce breach" : "Bounce warning")
                      : (isBreach ? "Time breach"  : "Time warning")}
                  </span>
                  {" · "}
                  {description}
                </span>
                <button
                  onClick={() => handleResolve(esc.id)}
                  disabled={busy}
                  className="text-[10px] border border-current px-2.5 py-1 opacity-60 hover:opacity-100 transition disabled:opacity-30 shrink-0"
                >
                  Resolve
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ── New-station form ── */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-6 border border-line bg-bg-elev p-4 flex gap-3 items-center"
        >
          <input
            autoFocus
            className="flex-1 bg-transparent border-b border-line text-sm px-1 py-1 focus:outline-none focus:border-gold-deep"
            placeholder="Station name — e.g. Counter 1, Register A, Bay 3"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
          />
          <Button size="sm" type="submit" disabled={busy || !newName.trim()}>
            Create
          </Button>
          <Button
            size="sm" variant="ghost" type="button"
            onClick={() => { setCreating(false); setNewName(""); }}
          >
            Cancel
          </Button>
        </form>
      )}

      {/* ── Station cards ── */}
      {loading ? (
        <div className="text-ink-mute text-xs ovline py-10 text-center">Loading stations…</div>
      ) : stations.length === 0 ? (
        <div className="border border-line p-10 text-center">
          <div className="ovline text-[9px] mb-3">No stations yet</div>
          <p className="text-ink-soft text-sm max-w-sm mx-auto mb-5">
            Add stations to start routing tasks automatically. Each station is a counter, bay, or role — not a person.
          </p>
          <Button size="sm" onClick={() => setCreating(true)}>+ Add first station</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              busy={busy}
              escalations={escalations}
              renamingId={renamingId}
              renameVal={renameVal}
              pausingId={pausingId}
              onStartRename={() => { setRenamingId(station.id); setRenameVal(station.name); }}
              onRename={() => handleRename(station.id)}
              onRenameChange={setRenameVal}
              onCancelRename={() => setRenamingId(null)}
              onStartPause={() => setPausingId(station.id)}
              onCancelPause={() => setPausingId(null)}
              onSetStatus={(status, reason) => handleSetStatus(station.id, status, reason)}
              onDelete={() => handleDelete(station.id)}
              onReassign={() => openReassign(null)}
            />
          ))}
        </div>
      )}

      {/* ── Reassign modal ── */}
      {reassignTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg border border-line p-6 w-full max-w-sm">
            <div className="ovline text-[9px] mb-4">Reassign task</div>
            <select
              className="w-full bg-bg border border-line text-sm px-3 py-2 mb-4"
              value={reassignStationId ?? ""}
              onChange={(e) => setReassignStationId(e.target.value || null)}
            >
              <option value="">Select station…</option>
              {stations.filter((s) => s.status === "active").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.load} task{s.load !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button size="sm" disabled={!reassignStationId || busy} onClick={handleReassign}>
                Reassign
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReassignTicketId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Station card ──────────────────────────────────────────────────────

function StationCard({
  station, busy, escalations = [],
  renamingId, renameVal,
  pausingId,
  onStartRename, onRename, onRenameChange, onCancelRename,
  onStartPause, onCancelPause, onSetStatus, onDelete,
}) {
  const isRenaming = renamingId === station.id;
  const isPausing  = pausingId  === station.id;

  // SLA indicators — station-level only, never surfaced as a person metric
  const stationEscs = escalations.filter((e) => e.station_id === station.id);
  const hasBreach   = stationEscs.some((e) => e.level === "breach");
  const hasWarning  = !hasBreach && stationEscs.some((e) => e.level === "warning");

  // Border override when SLA alert is active
  const borderClass =
    hasBreach   ? "border-red-800" :
    hasWarning  ? "border-gold-deep" :
    station.status === "active"  ? "border-[#506b50]" :
    station.status === "paused"  ? "border-gold-deep/50" :
    "border-line opacity-60";

  return (
    <div className={`relative border bg-bg-elev p-5 flex flex-col gap-4 ${borderClass}`}>

      {/* Status pip + SLA dot */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        {hasBreach  && <span className="pip bg-red-500 animate-pulse" title="Breach — task past time limit" />}
        {hasWarning && <span className="pip bg-gold animate-pulse" title="Warning — task approaching limit" />}
        <span className={`pip ${statusPip(station.status)}`} />
      </div>

      {/* Name */}
      {isRenaming ? (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            className="flex-1 bg-transparent border-b border-line text-sm px-1 py-0.5 focus:outline-none focus:border-gold-deep"
            value={renameVal}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onRename(); if (e.key === "Escape") onCancelRename(); }}
            maxLength={60}
          />
          <button onClick={onRename} className="text-[10px] text-gold-soft hover:text-gold">Save</button>
          <button onClick={onCancelRename} className="text-[10px] text-ink-mute hover:text-ink">✕</button>
        </div>
      ) : (
        <button
          onClick={onStartRename}
          className="font-display text-xl font-light tracking-tight text-left hover:text-gold-soft transition pr-6"
          title="Click to rename"
        >
          {station.name}
        </button>
      )}

      {/* Load — task count, never a person score */}
      <div className="flex items-end gap-3">
        <div>
          <div className={`font-display text-5xl font-light tracking-tightest leading-none ${
            station.status === "active" ? "text-[#9bbd9b]" :
            station.status === "paused" ? "gold-text-soft" :
            "text-ink-mute"
          }`}>
            {station.load}
          </div>
          <div className="ovline text-[9px] mt-1">
            task{station.load !== 1 ? "s" : ""} assigned
          </div>
        </div>

        {/* Status pill */}
        <span className={`ml-auto text-[10px] tracking-[0.18em] uppercase border px-2 py-1 ${statusColor(station.status)}`}>
          {STATUS_LABEL[station.status]}
          {station.pause_reason ? " · " + station.pause_reason : ""}
        </span>
      </div>

      {/* ── Pause confirmation ── */}
      {isPausing && (
        <div className="border-t border-line pt-4">
          <div className="ovline text-[9px] mb-3">Select reason</div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PAUSE_REASONS.map((r) => (
              <button
                key={r.value}
                disabled={busy}
                onClick={() => onSetStatus("paused", r.value)}
                className="text-[10px] tracking-[0.12em] uppercase border border-line px-2 py-1.5 hover:border-gold-soft hover:text-gold-soft transition"
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={onCancelPause}
            className="text-[10px] text-ink-mute hover:text-ink transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Actions ── */}
      {!isPausing && (
        <div className="flex gap-2 mt-auto pt-3 border-t border-line">
          {station.status !== "active" ? (
            <button
              onClick={() => onSetStatus("active", null)}
              disabled={busy}
              className="text-[10px] tracking-[0.12em] uppercase text-ink-mute hover:text-[#9bbd9b] border border-line px-3 py-1 hover:border-[#506b50] transition"
            >
              Resume
            </button>
          ) : (
            <button
              onClick={onStartPause}
              disabled={busy}
              className="text-[10px] tracking-[0.12em] uppercase text-ink-mute hover:text-gold-soft border border-line px-3 py-1 hover:border-gold-soft transition"
            >
              Pause
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            className="ml-auto text-[10px] tracking-[0.12em] uppercase text-ink-mute hover:text-red-400 border border-line px-3 py-1 hover:border-red-400/50 transition"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
