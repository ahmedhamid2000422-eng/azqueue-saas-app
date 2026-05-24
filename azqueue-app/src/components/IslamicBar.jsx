import { useEffect, useState } from "react";
import { useBranch } from "../hooks/useBranch";
import {
  fetchPrayerTimes,
  getNextPrayer,
  getPauseStatus,
  minutesUntilLabel,
} from "../lib/prayerTimes";

/**
 * IslamicBar — top-of-app strip showing the next prayer + auto-pause status.
 * Real-time: fetches today's times from Aladhan based on the current branch's
 * lat/lng, recomputes status every 30 seconds.
 *
 * Props:
 *   enabled  — boolean, whether to show at all
 */
export default function IslamicBar({ enabled = true }) {
  const { branch } = useBranch();
  const [times, setTimes] = useState(null);
  const [now, setNow] = useState(new Date());

  // Fetch today's prayer times for this branch's location (or default)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await fetchPrayerTimes({
        lat: branch?.lat,
        lng: branch?.lng,
      });
      if (!cancelled) setTimes(t);
    })();
    return () => { cancelled = true; };
  }, [branch?.lat, branch?.lng]);

  // Tick every 30s so the countdown stays fresh
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!enabled || !times) return null;

  const next = getNextPrayer(times, now);
  const status = getPauseStatus(times, {}, now);

  // Three states drive the bar's appearance:
  //   · paused      → solid sage tint, "paused for prayer"
  //   · approaching → softer sage with breathing pip, "auto-pausing in X min"
  //   · clear       → calm strip with the next prayer countdown
  if (status.state === "paused") {
    return (
      <div className="px-5 py-2.5 border-b border-[#506b50] bg-gradient-to-r from-[rgba(80,107,80,0.18)] to-[rgba(80,107,80,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="pip breathe" style={{ background: "#9bbd9b" }} />
          <span className="text-xs text-[#9bbd9b] font-medium">
            Paused for {status.prayer}
          </span>
          <span className="text-[10px] text-ink-mute">— queue will resume automatically</span>
        </div>
        <span className="text-[10px] text-ink-mute font-mono">
          resumes {minutesUntilLabel(status.msLeft).replace("in ", "in ")}
        </span>
      </div>
    );
  }

  if (status.state === "approaching") {
    return (
      <div className="px-5 py-2.5 border-b border-[#506b50] bg-gradient-to-r from-[rgba(80,107,80,0.10)] to-[rgba(80,107,80,0.02)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="pip breathe" />
          <span className="text-xs text-[#9bbd9b]">
            {status.prayer} in {Math.max(1, Math.round(status.msUntil / 60000))} min
          </span>
          <span className="text-[10px] text-ink-mute">— queue will auto-pause</span>
        </div>
        <span className="text-[10px] text-ink-mute font-mono">
          {next.time}
        </span>
      </div>
    );
  }

  return (
    <div className="px-5 py-2.5 border-b border-[#506b50] bg-gradient-to-r from-[rgba(80,107,80,0.08)] to-[rgba(80,107,80,0.02)] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="pip" />
        <span className="text-xs text-[#9bbd9b]">
          Next prayer: <span className="font-medium">{next.name}</span>
          {" · "}
          <span className="font-mono">{next.time}</span>
        </span>
        <span className="text-[10px] text-ink-mute">— auto-pause enabled</span>
      </div>
      <span className="text-[10px] text-ink-mute font-mono">{minutesUntilLabel(next.msUntil)}</span>
    </div>
  );
}
