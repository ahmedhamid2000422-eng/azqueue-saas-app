import { useEffect, useRef, useState } from "react";

/**
 * usePrayerCountdown — drives a "pause around prayer" state machine.
 *
 * Given a target prayer time as "HH:MM" (today), this hook:
 *   1. Fires `onApproaching` and flips paused → true exactly `warnMinutes`
 *      before the prayer time.
 *   2. Holds paused = true through the prayer window (`pauseMinutes` long).
 *   3. Fires `onResume` and flips paused → false when the window ends.
 *
 * Re-evaluates every `tickMs` (default 30s) so it's resilient to tab focus
 * changes — even if the page was backgrounded, the next tick recomputes.
 *
 * @example
 *   const { paused, msUntilStart, msUntilResume } = usePrayerCountdown({
 *     targetTime: "13:10",
 *     warnMinutes: 5,
 *     pauseMinutes: 20,
 *     onApproaching: () => playSoftBell(),
 *     onResume:      () => refreshQueue(),
 *   });
 *   useEffect(() => { setIsPaused(paused); }, [paused]);
 */
export function usePrayerCountdown({
  targetTime,                 // "HH:MM" (24h) — required
  warnMinutes  = 5,           // how many minutes before the prayer to pause
  pauseMinutes = 20,          // how long to stay paused
  tickMs       = 30_000,
  onApproaching,
  onResume,
} = {}) {
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Latest callbacks — captured in refs so we don't re-run effects when they change
  const onApproachingRef = useRef(onApproaching);
  const onResumeRef      = useRef(onResume);
  useEffect(() => { onApproachingRef.current = onApproaching; }, [onApproaching]);
  useEffect(() => { onResumeRef.current      = onResume;      }, [onResume]);

  // Track which transitions we've already fired so we don't fire twice per cycle
  const firedApproachRef = useRef(false);
  const firedResumeRef   = useRef(true); // start in "already resumed" state

  // Tick clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  // Recompute pause state each tick + fire transition callbacks once
  useEffect(() => {
    if (!targetTime || !/^\d{1,2}:\d{2}$/.test(targetTime)) return;

    const [h, m] = targetTime.split(":").map(Number);
    const start = new Date(now); start.setHours(h, m, 0, 0);
    const pauseStart = new Date(start.getTime() - warnMinutes  * 60_000);
    const pauseEnd   = new Date(start.getTime() + pauseMinutes * 60_000);

    const inWindow = now >= pauseStart && now < pauseEnd;
    if (inWindow !== paused) setPaused(inWindow);

    if (inWindow && !firedApproachRef.current) {
      firedApproachRef.current = true;
      firedResumeRef.current   = false;
      onApproachingRef.current?.({ at: start, msUntilStart: start - now });
    }
    if (!inWindow && !firedResumeRef.current) {
      firedResumeRef.current   = true;
      firedApproachRef.current = false;
      onResumeRef.current?.({ at: pauseEnd });
    }
  }, [now, targetTime, warnMinutes, pauseMinutes, paused]);

  // Recompute timestamps for return values
  const [h = 0, m = 0] = (targetTime ?? "").split(":").map(Number);
  const start    = new Date(now); start.setHours(h, m, 0, 0);
  const pauseEnd = new Date(start.getTime() + pauseMinutes * 60_000);

  return {
    paused,
    msUntilStart:  start    - now,
    msUntilResume: pauseEnd - now,
    targetAt:      start,
  };
}

/**
 * Convenience for the AzQueue-specific use case: given a full prayer-times
 * object (the one fetched from Aladhan in lib/prayerTimes.js), returns a
 * single countdown to whichever prayer is happening or coming next.
 */
export function useNextPrayerCountdown({ times, ...options } = {}) {
  // Pick today's next prayer
  const next = pickNextPrayer(times, new Date());
  return usePrayerCountdown({ targetTime: next?.time ?? null, ...options });
}

function pickNextPrayer(times, now) {
  if (!times) return null;
  const order = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  for (const name of order) {
    const t = times[name];
    if (!t) continue;
    const [h, m] = t.split(":").map(Number);
    const at = new Date(now); at.setHours(h, m, 0, 0);
    if (at >= now) return { name, time: t };
  }
  // All passed — return tomorrow's Fajr
  return { name: "fajr", time: times.fajr };
}
