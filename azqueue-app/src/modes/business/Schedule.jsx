import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import { fetchPrayerTimes, getPauseStatus } from "../../lib/prayerTimes";
import { getComplexity, buildDurationStats } from "../../lib/complexity";
import { scheduleReflow, autoFixSchedule, enrichStaffLoad, pickBestStaff } from "../../lib/autoAssign";
import { findOrCreateCustomer, generatePersona } from "../../lib/customers";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ShadowSlots from "./ShadowSlots";

const SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

export default function Schedule() {
  const { branch, dbReady } = useBranch();
  const [staff, setStaff] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [date, setDate] = useState(() => new Date());
  const [durationStats, setDurationStats] = useState({});
  const [activeTickets, setActiveTickets] = useState([]);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);

  async function load() {
    if (!branch?.id) return;
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    const [{ data: stf }, { data: bks }, { data: svcs }, { data: recent }, { data: active }] = await Promise.all([
      supabase.from("staff").select("id, display_name, role, status").eq("branch_id", branch.id).order("display_name"),
      supabase.from("bookings")
        .select("*")
        .eq("branch_id", branch.id)
        .gte("scheduled_at", dayStart.toISOString())
        .lt("scheduled_at",  dayEnd.toISOString()),
      supabase.from("services").select("id, name").eq("branch_id", branch.id),
      // Recent completed tickets for real duration stats
      supabase.from("tickets")
        .select("service_id, started_at, completed_at")
        .eq("branch_id", branch.id)
        .eq("status", "completed")
        .not("started_at", "is", null)
        .not("completed_at", "is", null)
        .gte("completed_at", thirtyAgo.toISOString())
        .order("completed_at", { ascending: false })
        .limit(200),
      // Today's active tickets for staff load calculation
      supabase.from("tickets")
        .select("id, staff_id, status")
        .eq("branch_id", branch.id)
        .in("status", ["waiting", "serving"])
        .gte("created_at", dayStart.toISOString()),
    ]);

    const svcNameMap = Object.fromEntries((svcs ?? []).map((s) => [s.id, s.name]));
    setStaff(stf ?? []);
    setBookings(bks ?? []);
    setServices(svcs ?? []);
    setDurationStats(buildDurationStats(recent ?? [], svcNameMap));
    setActiveTickets(active ?? []);
    setFixApplied(false);

    // Auto-prepare customer personas for today's scheduled visits (background, non-blocking).
    // This means when a booked customer arrives, staff already have a full profile ready.
    if (bks?.length && branch?.id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      bks
        .filter((bk) => {
          // Only process bookings for today or the currently viewed date
          const at = new Date(bk.scheduled_at);
          return at >= today && at < tomorrow;
        })
        .forEach((bk) => {
          if (bk.customer_name || bk.customer_phone) {
            findOrCreateCustomer(branch.id, {
              name: bk.customer_name,
              phone: bk.customer_phone,
            })
              .then((cust) => cust && generatePersona(cust.id, branch.id))
              .catch(() => {});
          }
        });
    }
  }

  useEffect(() => { load(); }, [branch?.id, date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await fetchPrayerTimes({ lat: branch?.lat, lng: branch?.lng });
      if (!cancelled) setPrayerTimes(t);
    })();
    return () => { cancelled = true; };
  }, [branch?.lat, branch?.lng]);

  if (!dbReady) {
    return <div className="p-8 max-w-xl"><h1 className="font-display text-3xl font-light tracking-tightest mb-3">Schedule</h1><p className="text-ink-soft text-sm">Run the database migration to enable scheduling.</p></div>;
  }
  if (!branch) return <div className="p-8 text-ink-mute ovline">Select a branch.</div>;

  // ── Derived: service name map, staff load, reflow issues ─────────────
  const serviceNameMap = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s.name])),
    [services]
  );
  const enrichedStaff = useMemo(
    () => enrichStaffLoad(staff, activeTickets),
    [staff, activeTickets]
  );
  const reflowIssues = useMemo(
    () => scheduleReflow(bookings, serviceNameMap, durationStats, staff),
    [bookings, serviceNameMap, durationStats, staff]
  );
  const pendingFixes = useMemo(
    () => autoFixSchedule(bookings, serviceNameMap, durationStats, staff),
    [bookings, serviceNameMap, durationStats, staff]
  );

  // Auto-assign: for each booking that has no staff_id and is complex/extended,
  // pick the best available staff member and update the booking in DB
  async function autoAssignUnassigned() {
    const unassigned = bookings.filter((b) => {
      if (b.staff_id) return false;
      const name = serviceNameMap[b.service_id] ?? "";
      const tier = getComplexity(name).tier;
      return tier === "complex" || tier === "extended";
    });
    if (!unassigned.length || !enrichedStaff.length) return;
    setFixBusy(true);
    let currentStaff = [...enrichedStaff];
    for (const b of unassigned) {
      const name = serviceNameMap[b.service_id] ?? "";
      const pick = pickBestStaff(name, currentStaff);
      if (pick.staffId) {
        await supabase.from("bookings").update({ staff_id: pick.staffId }).eq("id", b.id);
        currentStaff = currentStaff.map((s) =>
          s.id === pick.staffId ? { ...s, currentLoad: (s.currentLoad ?? 0) + 1 } : s
        );
      }
    }
    await load();
    setFixBusy(false);
  }

  // Apply auto-fix: push back overlapping bookings by the computed shift
  async function applyScheduleFix() {
    if (!pendingFixes.length) return;
    setFixBusy(true);
    for (const fix of pendingFixes) {
      await supabase.from("bookings").update({ scheduled_at: fix.newTime }).eq("id", fix.bookingId);
    }
    await load();
    setFixApplied(true);
    setFixBusy(false);
  }

  // Display: staff columns (or "Any" if none)
  const cols = staff.length ? staff : [{ id: "any", display_name: "Any" }];

  // Bookings indexed by `${HH:00}-staffId|any`
  const bookingMap = {};
  for (const b of bookings) {
    const d = new Date(b.scheduled_at);
    const key = `${String(d.getHours()).padStart(2, "0")}:00-${b.staff_id ?? "any"}`;
    bookingMap[key] = b;
  }

  function isPrayerSlot(slot) {
    if (!prayerTimes) return null;
    // Check if any prayer falls within this hour-long slot
    const [h] = slot.split(":").map(Number);
    const hour = h;
    const hourEnd = h + 1;
    for (const name of ["fajr","dhuhr","asr","maghrib","isha"]) {
      const [ph] = prayerTimes[name].split(":").map(Number);
      if (ph >= hour && ph < hourEnd) {
        return { name, time: prayerTimes[name] };
      }
    }
    return null;
  }

  const todayLabel = date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  const isToday = sameDay(date, new Date());

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="flex justify-between items-start mb-8">
        <div>
          <div className="ovline mb-2 text-gold-soft">Live · staff schedule</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Schedule</h1>
          <div className="text-xs text-ink-soft mt-2">
            {todayLabel} <span className="text-ink-mute">·</span> {staff.length || "no"} staff <span className="text-ink-mute">·</span> {bookings.length} bookings
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {bookings.some((b) => !b.staff_id && (() => {
            const tier = getComplexity(serviceNameMap[b.service_id] ?? "").tier;
            return tier === "complex" || tier === "extended";
          })()) && enrichedStaff.length > 0 && (
            <Button variant="ghost" size="sm" onClick={autoAssignUnassigned} disabled={fixBusy}>
              Auto-assign complex
            </Button>
          )}
          {pendingFixes.length > 0 && !fixApplied && (
            <Button variant="ghost" size="sm" onClick={applyScheduleFix} disabled={fixBusy}>
              Fix {pendingFixes.length} collision{pendingFixes.length !== 1 ? "s" : ""} →
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setDate(addDays(date, -1))}>‹ Prev</Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date())} disabled={isToday}>Today</Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(addDays(date,  1))}>Next ›</Button>
        </div>
      </header>

      <Card luxe>
        <div className={`grid border-b border-line`} style={{ gridTemplateColumns: `80px repeat(${cols.length}, minmax(0, 1fr))` }}>
          <div className="px-3 py-3 ovline text-[8px] border-r border-line bg-[rgba(201,168,106,0.03)]" />
          {cols.map((s, i) => (
            <div key={s.id} className={`px-3 py-3 ovline text-[8px] bg-[rgba(201,168,106,0.03)] ${i < cols.length - 1 ? "border-r border-line" : ""}`}>
              {s.display_name}
              {s.role && <span className="text-ink-mute ml-1">· {s.role}</span>}
            </div>
          ))}
        </div>

        {SLOTS.map((t) => {
          const prayer = isPrayerSlot(t);
          return (
            <div key={t} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: `80px repeat(${cols.length}, minmax(0, 1fr))` }}>
              <div className="px-3 py-4 font-mono text-[10px] text-ink-mute border-r border-line">{t}</div>
              {cols.map((s, i) => {
                const cell = bookingMap[`${t}-${s.id}`];
                const border = i < cols.length - 1 ? "border-r border-line" : "";
                if (prayer) {
                  return (
                    <div key={s.id} className={`px-3 py-4 ${border} bg-[rgba(80,107,80,0.10)]`}>
                      <div className="text-[10px] text-[#9bbd9b] flex items-center gap-1.5">
                        <span className="pip" />
                        Prayer · {capitalise(prayer.name)}
                      </div>
                      <div className="text-[9px] text-ink-mute mt-1">Auto-pause · {prayer.time}</div>
                    </div>
                  );
                }
                if (cell) {
                  const svcName   = serviceNameMap[cell.service_id] ?? services.find((x) => x.id === cell.service_id)?.name ?? "—";
                  const cx        = getComplexity(svcName);
                  const stats     = durationStats[svcName];
                  const hasReal   = (stats?.count ?? 0) >= 5;
                  const durMin    = hasReal ? stats.avg : cx.estimatedMin;
                  const isComplex = cx.tier === "complex" || cx.tier === "extended";
                  const isUnassigned = !cell.staff_id;
                  const assignedStaff = staff.find((x) => x.id === cell.staff_id);
                  const suggestion = isUnassigned && isComplex && enrichedStaff.length
                    ? pickBestStaff(svcName, enrichedStaff)
                    : null;
                  const hasCollision = reflowIssues.some((iss) => iss.bookingId === cell.id && iss.type === "collision");
                  const hasOverrun   = reflowIssues.some((iss) => iss.bookingId === cell.id && iss.type === "overrun");
                  const cellBg = hasCollision
                    ? "bg-red-950/20 border-l-2 border-l-red-700"
                    : hasOverrun
                      ? "bg-amber-950/15 border-l-2 border-l-amber-700"
                      : isComplex && isUnassigned
                        ? "bg-amber-950/10"
                        : "bg-[rgba(116,185,232,0.06)]";
                  return (
                    <div key={s.id} className={`px-3 py-3 ${border} ${cellBg}`}>
                      <div className="text-[10px] text-gold-soft truncate">{cell.customer_name}</div>
                      <div className="text-[9px] text-ink-mute mt-0.5 truncate">{svcName}</div>
                      <div className={"text-[8px] mt-1 flex items-center gap-1 " + cx.color}>
                        <span>{cx.label}</span>
                        <span className="text-ink-mute">·</span>
                        <span>{durMin}m{hasReal ? " ✓" : ""}</span>
                      </div>
                      {assignedStaff ? (
                        <div className="text-[8px] text-[#9bbd9b] mt-0.5 truncate">{assignedStaff.display_name}</div>
                      ) : suggestion ? (
                        <div className="text-[8px] text-amber-400 mt-0.5 truncate">→ {suggestion.staffName}</div>
                      ) : null}
                      {hasCollision && <div className="text-[8px] text-red-400 mt-0.5">⚠ Overlap</div>}
                      {hasOverrun && !hasCollision && <div className="text-[8px] text-amber-400 mt-0.5">⏱ Runs over</div>}
                    </div>
                  );
                }
                return <div key={s.id} className={`px-3 py-4 ${border}`} />;
              })}
            </div>
          );
        })}
      </Card>

      {(reflowIssues.length > 0 || Object.values(durationStats).some((s) => s.count >= 5)) && (
        <div className="mt-4 border border-line bg-bg-elev">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="ovline text-[9px] text-gold-soft">Schedule Intelligence</div>
              {Object.values(durationStats).some((s) => s.count >= 5) && (
                <span className="text-[9px] text-emerald-400 border border-emerald-800/40 px-2 py-0.5">
                  Real-case data active
                </span>
              )}
            </div>
            {reflowIssues.length > 0 && (
              <span className={"text-[9px] border px-2 py-0.5 " + (
                reflowIssues.some((iss) => iss.severity === "high")
                  ? "border-red-800 text-red-400"
                  : "border-amber-800 text-amber-400"
              )}>
                {reflowIssues.length} issue{reflowIssues.length !== 1 ? "s" : ""} detected
              </span>
            )}
          </div>

          {Object.entries(durationStats).filter(([, s]) => s.count >= 5).length > 0 && (
            <div className="px-5 py-3 border-b border-line">
              <div className="ovline text-[9px] text-ink-mute mb-2">Real Duration Averages</div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(durationStats)
                  .filter(([, s]) => s.count >= 5)
                  .sort((a, b) => b[1].avg - a[1].avg)
                  .slice(0, 6)
                  .map(([name, s]) => {
                    const cx = getComplexity(name);
                    const delta = s.avg - cx.estimatedMin;
                    return (
                      <div key={name} className={"border px-3 py-2 " + cx.border}>
                        <div className={"text-[9px] ovline " + cx.color}>{name}</div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-sm font-light text-ink">{s.avg}m</span>
                          {Math.abs(delta) > 2 && (
                            <span className={"text-[9px] " + (delta > 0 ? "text-red-400" : "text-emerald-400")}>
                              {delta > 0 ? "+" : ""}{Math.round(delta)}m vs est.
                            </span>
                          )}
                        </div>
                        <div className="text-[8px] text-ink-mute mt-0.5">{s.count} cases · {s.min}–{s.max}m range</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {reflowIssues.length > 0 && (
            <Card luxe className="mt-4">
              <div className="px-5 py-3">
                <div className="flex items-center justify-between mb-2 gap-3">
                  <div className="ovline text-[9px] text-ink-mute">Issues</div>
                  {pendingFixes.length > 0 && !fixApplied && (
                    <button
                      onClick={applyScheduleFix}
                      disabled={fixBusy}
                      className="text-[9px] border border-sky-800/50 text-sky-400 px-2 py-0.5 ovline hover:bg-sky-900/20 transition disabled:opacity-40"
                    >
                      Auto-fix {pendingFixes.length} collision{pendingFixes.length !== 1 ? "s" : ""} →
                    </button>
                  )}
                  {fixApplied && (
                    <span className="text-[9px] text-emerald-400">Schedule updated</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {reflowIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={"border px-4 py-3 flex items-start gap-3 " + (
                        issue.severity === "high"
                          ? "border-red-800/50 bg-red-950/10"
                          : "border-amber-800/40 bg-amber-950/10"
                      )}
                    >
                      <span className={"text-base " + (issue.severity === "high" ? "text-red-400" : "text-amber-400")}>
                        {issue.type === "collision" ? "⏱" : "◈"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-ink flex items-center gap-2 flex-wrap">
                          <span className="font-display text-gold-soft">{fmtSlot(issue.scheduledAt)}</span>
                          <span>{issue.staffName}</span>
                          <span className={"text-[9px] border px-1.5 py-0.5 " + (
                            issue.severity === "high"
                              ? "border-red-800 text-red-400"
                              : "border-amber-800 text-amber-400"
                          )}>
                            {issue.severity === "high" ? "Collision" : "Warning"}
                          </span>
                        </div>
                        <div className="text-[10px] text-ink-mute mt-0.5">{issue.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Shadow Slots — walk-in buffer manager */}
      <ShadowSlots />
    </div>
  );
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function fmtSlot(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
