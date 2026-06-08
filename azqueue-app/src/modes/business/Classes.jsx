import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import { sendClassReminder } from "../../lib/notify";
import Card, { CardHeader } from "../../components/Card";
import Badge from "../../components/Badge";

// Reminder window — send once a booking is 2-3 hours out, never twice.
const REMINDER_MIN_MS = 2 * 60 * 60 * 1000;
const REMINDER_MAX_MS = 3 * 60 * 60 * 1000;

/**
 * Classes — gym-mode home screen.
 *
 * Replaces "Queue" for branches with business_type === 'gym'. Shows the
 * coming week's classes as a day-by-day timetable (pain point #7 — schedule
 * confusion), with a level filter (#5 — beginner/advanced mismatch) and an
 * expandable roster per class where the instructor can see who's confirmed
 * and mark attendance / no-shows (#1 — no-shows + student tracking #6).
 */

const LEVELS = [
  { id: "all",          label: "All levels",  dot: "bg-ink-mute" },
  { id: "beginner",     label: "Beginner",    dot: "bg-[#9bbd9b]" },
  { id: "advanced",     label: "Advanced",    dot: "bg-[#d49185]" },
  { id: "conditioning", label: "Conditioning",dot: "bg-[#74b9e8]" },
  { id: "all_levels",   label: "Open level",  dot: "bg-gold" },
];

function levelMeta(level) {
  return LEVELS.find((l) => l.id === level) ?? { id: level, label: level ?? "—", dot: "bg-ink-mute" };
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

export default function Classes() {
  const { branch, dbReady } = useBranch();
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("all");
  const [openSlot, setOpenSlot] = useState(null); // key of expanded class slot
  const [busyId, setBusyId] = useState(null);

  const days = useMemo(() => {
    const arr = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  async function load() {
    if (!branch?.id) return;
    setLoading(true);

    const rangeStart = days[0];
    const rangeEnd = new Date(days[6]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

    const [{ data: bRows }, { data: sRows }] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, service_id, staff_id, customer_name, customer_phone, scheduled_at, status, confirmed_at, reminder_sent_at, customer:customer_id(id, sessions_attended, no_show_strikes)")
        .eq("branch_id", branch.id)
        .gte("scheduled_at", rangeStart.toISOString())
        .lt("scheduled_at", rangeEnd.toISOString())
        .order("scheduled_at"),
      supabase
        .from("services")
        .select("id, name, duration_min, level")
        .eq("branch_id", branch.id)
        .eq("active", true)
        .order("name"),
    ]);

    setBookings(bRows ?? []);
    setServices(sRows ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [branch?.id]);

  // Realtime — keep the roster fresh as students book / get confirmed
  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`gym-classes-${branch.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `branch_id=eq.${branch.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [branch?.id]);

  // Best-effort auto-reminder — fires while a staff member has Classes open.
  // Checks for confirmed bookings 2-3 hrs out that haven't been reminded yet,
  // texts the student, and stamps reminder_sent_at so it never repeats.
  // (A true server-side cron would be the production-grade version of this —
  // see the note in lib/notify.js about moving SMS sends to an Edge Function.)
  useEffect(() => {
    if (!branch?.id) return;

    async function checkReminders() {
      const now = Date.now();
      const windowStart = new Date(now + REMINDER_MIN_MS).toISOString();
      const windowEnd   = new Date(now + REMINDER_MAX_MS).toISOString();

      const { data: due } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_phone, scheduled_at, service:service_id(name)")
        .eq("branch_id", branch.id)
        .eq("status", "confirmed")
        .is("reminder_sent_at", null)
        .gte("scheduled_at", windowStart)
        .lte("scheduled_at", windowEnd)
        .not("customer_phone", "is", null);

      for (const b of due ?? []) {
        const svcName = b.service?.name ?? "your class";
        try {
          await sendClassReminder(b.customer_phone, b.customer_name, svcName, b.scheduled_at, branch.name);
        } catch { /* never block on SMS failures */ }
        await supabase.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
      }
      if (due?.length) load();
    }

    checkReminders();
    const interval = setInterval(checkReminders, 5 * 60 * 1000); // re-check every 5 min
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [branch?.id]);

  const serviceById = useMemo(() => {
    const m = {};
    for (const s of services) m[s.id] = s;
    return m;
  }, [services]);

  // Group bookings into "class slots" — same service + same start time
  const slotsByDay = useMemo(() => {
    const byDay = {};
    for (const d of days) byDay[dayKey(d)] = {};

    for (const b of bookings) {
      const svc = serviceById[b.service_id];
      if (levelFilter !== "all" && (svc?.level ?? "all_levels") !== levelFilter) continue;

      const dt = new Date(b.scheduled_at);
      const dKey = dayKey(dt);
      if (!byDay[dKey]) continue;

      const slotKey = `${b.service_id}__${dt.toISOString()}`;
      if (!byDay[dKey][slotKey]) {
        byDay[dKey][slotKey] = {
          key: slotKey,
          time: dt,
          service: svc,
          roster: [],
        };
      }
      byDay[dKey][slotKey].roster.push(b);
    }

    const out = {};
    for (const d of days) {
      const dKey = dayKey(d);
      out[dKey] = Object.values(byDay[dKey]).sort((a, b) => a.time - b.time);
    }
    return out;
  }, [bookings, days, levelFilter, serviceById]);

  async function confirmAttendance(bookingId) {
    setBusyId(bookingId);
    await supabase.from("bookings").update({ confirmed_at: new Date().toISOString() }).eq("id", bookingId);
    await load();
    setBusyId(null);
  }

  async function markAttendance(booking, attended) {
    setBusyId(booking.id);
    const status = attended ? "arrived" : "no_show";
    await supabase.from("bookings").update({ status }).eq("id", booking.id);

    // Bump the student's session/strike counters if we can resolve their customer record
    const cust = booking.customer;
    if (cust?.id) {
      if (attended) {
        await supabase.from("customers").update({ sessions_attended: (cust.sessions_attended ?? 0) + 1 }).eq("id", cust.id);
      } else {
        await supabase.from("customers").update({ no_show_strikes: (cust.no_show_strikes ?? 0) + 1 }).eq("id", cust.id);
      }
    }
    await load();
    setBusyId(null);
  }

  if (!dbReady) {
    return (
      <div className="p-8">
        <Card luxe className="p-10 text-center max-w-lg mx-auto">
          <div className="ovline text-ink-mute mb-2">Database not ready</div>
          <p className="text-ink-soft text-sm">Run the latest migrations to enable Classes.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-light tracking-tightest gold-text mb-1">This week's classes</h1>
          <p className="text-ink-mute text-xs">
            {branch?.name ?? "—"} · {days[0].toLocaleDateString([], { month: "short", day: "numeric" })} – {days[6].toLocaleDateString([], { month: "short", day: "numeric" })}
          </p>
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {LEVELS.map((l) => {
            const active = levelFilter === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setLevelFilter(l.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] tracking-wide transition ${
                  active ? "border-gold bg-[rgba(201,168,106,0.08)] text-gold-soft" : "border-line text-ink-soft hover:border-[#3a3a3f]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${l.dot}`} />
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="text-ink-mute text-xs py-12 text-center">Loading classes…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {days.map((d) => {
            const dKey = dayKey(d);
            const slots = slotsByDay[dKey] ?? [];
            const isToday = dKey === dayKey(new Date());
            return (
              <Card key={dKey} luxe={isToday} className={`p-0 overflow-hidden ${isToday ? "" : "border-line"}`}>
                <CardHeader
                  title={d.toLocaleDateString([], { weekday: "long" })}
                  subtitle={d.toLocaleDateString([], { month: "short", day: "numeric" })}
                  right={isToday && <Badge tone="gold">Today</Badge>}
                />
                <div className="p-4 space-y-2.5">
                  {slots.length === 0 ? (
                    <div className="text-ink-mute text-[11px] py-4 text-center">No classes scheduled</div>
                  ) : (
                    slots.map((slot) => {
                      const lvl = levelMeta(slot.service?.level ?? "all_levels");
                      const isOpen = openSlot === slot.key;
                      const confirmedCount = slot.roster.filter((r) => r.confirmed_at).length;
                      return (
                        <div key={slot.key} className="border border-line">
                          <button
                            onClick={() => setOpenSlot(isOpen ? null : slot.key)}
                            className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-white/[0.02] transition"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-display text-sm font-light text-ink truncate">
                                  {slot.service?.name ?? "Class"}
                                </span>
                                <span className="flex items-center gap-1 text-[9px] text-ink-mute border border-line px-1.5 py-0.5 shrink-0">
                                  <span className={`w-1.5 h-1.5 rounded-full ${lvl.dot}`} />
                                  {lvl.label}
                                </span>
                              </div>
                              <div className="text-[10px] text-ink-mute mt-0.5">
                                {slot.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {slot.service?.duration_min ? ` · ${slot.service.duration_min} min` : ""}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs text-ink">{slot.roster.length} booked</div>
                              <div className="text-[9px] text-ink-mute">{confirmedCount} confirmed</div>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-line divide-y divide-line">
                              {slot.roster.map((b) => (
                                <RosterRow
                                  key={b.id}
                                  booking={b}
                                  busy={busyId === b.id}
                                  onConfirm={() => confirmAttendance(b.id)}
                                  onMark={(attended) => markAttendance(b, attended)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RosterRow({ booking: b, busy, onConfirm, onMark }) {
  const cust = b.customer;
  const strikes = cust?.no_show_strikes ?? 0;
  const sessions = cust?.sessions_attended ?? 0;
  const decided = b.status === "arrived" || b.status === "no_show";

  return (
    <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-ink truncate">{b.customer_name}</span>
          {sessions > 0 && (
            <span className="text-[9px] text-gold-soft border border-gold/30 px-1 shrink-0">
              {sessions} session{sessions === 1 ? "" : "s"}
            </span>
          )}
          {strikes > 0 && (
            <span className="text-[9px] text-[#d49185] border border-[#b56b5f]/30 px-1 shrink-0">
              ⚠ {strikes} strike{strikes === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="text-[10px] text-ink-mute mt-0.5">
          {b.confirmed_at ? (
            <span className="text-[#9bbd9b]">✓ Confirmed attendance</span>
          ) : (
            <span>Awaiting confirmation</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {!b.confirmed_at && (
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-2.5 py-1 border border-line text-[9px] tracking-wide uppercase text-ink-soft hover:border-gold-deep hover:text-gold-soft transition disabled:opacity-40"
          >
            Confirm
          </button>
        )}
        {decided ? (
          <span className={`text-[9px] uppercase tracking-wide px-2 py-1 border ${
            b.status === "arrived" ? "border-[#9bbd9b]/40 text-[#9bbd9b]" : "border-[#b56b5f]/40 text-[#d49185]"
          }`}>
            {b.status === "arrived" ? "Attended" : "No-show"}
          </span>
        ) : (
          <>
            <button
              onClick={() => onMark(true)}
              disabled={busy}
              className="px-2.5 py-1 border border-[#9bbd9b]/40 text-[9px] tracking-wide uppercase text-[#9bbd9b] hover:bg-[#9bbd9b]/10 transition disabled:opacity-40"
            >
              Attended
            </button>
            <button
              onClick={() => onMark(false)}
              disabled={busy}
              className="px-2.5 py-1 border border-[#b56b5f]/40 text-[9px] tracking-wide uppercase text-[#d49185] hover:bg-[#b56b5f]/10 transition disabled:opacity-40"
            >
              No-show
            </button>
          </>
        )}
      </div>
    </div>
  );
}
