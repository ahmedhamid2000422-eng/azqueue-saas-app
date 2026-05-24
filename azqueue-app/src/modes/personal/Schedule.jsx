import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { fetchPrayerTimes } from "../../lib/prayerTimes";
import Card, { CardHeader } from "../../components/Card";

/**
 * Personal Schedule — your tasks + your prayer times in a single calm timeline.
 * Reads tasks (today's list) and personal_prefs (location for prayer times).
 */
export default function Schedule() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [dbReady, setDbReady] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: t, error: tErr } = await supabase
        .from("tasks").select("*").eq("done", false).order("created_at");
      if (tErr && /relation .* does not exist/i.test(tErr.message || "")) {
        setDbReady(false); return;
      }
      setTasks(t ?? []);

      const { data: p } = await supabase
        .from("personal_prefs").select("*").eq("owner_id", user.id).maybeSingle();
      setPrefs(p);
    })();
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lat = prefs?.lat;
      const lng = prefs?.lng;
      const t = await fetchPrayerTimes({ lat, lng });
      if (!cancelled) setPrayerTimes(t);
    })();
    return () => { cancelled = true; };
  }, [prefs?.lat, prefs?.lng]);

  if (!dbReady) {
    return <div className="p-8 max-w-xl"><h1 className="font-display text-3xl font-light tracking-tightest mb-3">Schedule</h1><p className="text-ink-soft text-sm">Run the personal tables migration (0005) to enable schedule.</p></div>;
  }

  // Build a single timeline: prayer times + tasks (tasks bucketed by due_label)
  const timeline = buildTimeline({ prayerTimes, tasks });

  return (
    <div className="atmosphere-hero p-8 max-w-3xl">
      <header className="mb-8">
        <div className="ovline mb-2 text-gold-soft">Today · personal flow</div>
        <h1 className="font-display text-4xl font-light tracking-tightest">Schedule</h1>
        <div className="text-xs text-ink-soft mt-2">
          {tasks.length} task{tasks.length !== 1 && "s"} <span className="text-ink-mute">·</span> prayer-aware
        </div>
      </header>

      <Card luxe>
        <CardHeader title="Today" />
        {timeline.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">Nothing planned. Add tasks to fill your day.</div>
        ) : timeline.map((row, i) => (
          <div key={i} className="px-5 py-3 border-b border-line last:border-b-0 grid grid-cols-[60px_1fr_80px] gap-3 items-center">
            <span className="font-mono text-[11px] text-gold-soft">{row.time}</span>
            <div>
              <div className={`text-sm ${row.kind === "prayer" ? "text-[#9bbd9b]" : "text-ink"}`}>{row.title}</div>
              {row.sub && <div className="text-[10px] text-ink-mute mt-0.5">{row.sub}</div>}
            </div>
            <span className={`text-[9px] uppercase tracking-[0.18em] text-right ${
              row.kind === "prayer" ? "text-[#9bbd9b]" :
              row.kind === "priority" ? "text-gold-soft" :
              "text-ink-mute"
            }`}>{row.kindLabel}</span>
          </div>
        ))}
      </Card>

      <div className="text-[10px] text-ink-mute mt-4 text-center tracking-wide">
        Prayer times pulled live for your location. Set lat/lng in Personal preferences.
      </div>
    </div>
  );
}

function buildTimeline({ prayerTimes, tasks }) {
  const rows = [];

  // Prayers
  if (prayerTimes) {
    const day = new Date().getDay() === 5 ? "jumah" : null;
    for (const name of ["fajr","dhuhr","asr","maghrib","isha"]) {
      rows.push({
        time: prayerTimes[name],
        title: name === "dhuhr" && day === "jumah" ? "Jumu'ah" : capitalise(name),
        sub: "Prayer · auto-pause",
        kind: "prayer",
        kindLabel: "Pause",
      });
    }
  }

  // Tasks — bucketed by due label, ordered after prayer timing for now
  const todays = tasks.filter((t) => (t.due_label ?? "Today") === "Today");
  const upcoming = tasks.filter((t) => (t.due_label ?? "Today") !== "Today");

  todays.forEach((t, i) => {
    rows.push({
      time: ["09:30", "11:00", "14:00", "16:00", "17:30"][i] || "—",
      title: t.title,
      sub: t.priority ? "Priority" : "Task",
      kind: t.priority ? "priority" : "task",
      kindLabel: t.priority ? "Priority" : "Task",
    });
  });

  upcoming.forEach((t) => {
    rows.push({
      time: t.due_label ?? "—",
      title: t.title,
      sub: "Upcoming",
      kind: "task",
      kindLabel: "Later",
    });
  });

  // Sort prayer-then-task by HH:MM where applicable
  return rows.sort((a, b) => {
    const va = parseTime(a.time);
    const vb = parseTime(b.time);
    if (va == null) return 1;
    if (vb == null) return -1;
    return va - vb;
  });
}

function parseTime(s) {
  if (!s || !/^\d{2}:\d{2}/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
