import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { decide, getAvgServiceSeconds } from "../lib/autopilot";
import { fetchPrayerTimes, getPauseStatus } from "../lib/prayerTimes";
import { AUTOPILOT_ENABLED } from "../lib/features";

/**
 * useAutopilot — runs the autopilot loop on the dashboard.
 *
 * Inputs:
 *   branch         — the current branch row (must have id, autopilot, lat, lng)
 *   serving        — currently-serving ticket
 *   waiting        — array of waiting tickets, oldest first
 *   onCallNext     — async function that calls the next customer (your existing callNext)
 *
 * Returns:
 *   { paused, pausedReason, secondsUntilNext, targetIntervalSec, avgServiceSec }
 *   so the dashboard can show a live countdown + status pill.
 */
export function useAutopilot({ branch, serving, waiting, onCallNext, paused = false }) {
  const [avgServiceSec, setAvgServiceSec] = useState(null);
  const [tick, setTick] = useState(0);
  const [decision, setDecision] = useState({ action: "wait", reason: "starting…" });
  const [activeStaffCount] = useState(1); // Phase 3 will wire this from staff table
  const [times, setTimes] = useState(null);

  // Double-call guards.
  //
  //   lastCallRef       — wall-clock throttle
  //   lastCalledIdRef   — which ticket we last asked to be called
  //   inFlightRef       — true while onCallNext() is still running
  //
  // The decide-effect re-runs every second. onCallNext() is async: it writes
  // to the database and waits for a reload, which can easily take longer than
  // a tick. Without these guards `decide()` keeps seeing the pre-call state
  // and fires again, so two customers get called at once.
  const lastCallRef     = useRef(0);
  const lastCalledIdRef = useRef(null);
  const inFlightRef     = useRef(false);

  const CALL_THROTTLE_MS = 15_000;

  // Refresh the rolling average when serving changes (different service may apply)
  useEffect(() => {
    if (!branch?.id) return;
    let cancelled = false;
    (async () => {
      const avg = await getAvgServiceSeconds({
        branchId: branch.id,
        serviceId: serving?.service_id ?? null,
      });
      if (!cancelled) setAvgServiceSec(avg);
    })();
    return () => { cancelled = true; };
  }, [branch?.id, serving?.service_id]);

  // Load prayer times once per branch coords
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await fetchPrayerTimes({ lat: branch?.lat, lng: branch?.lng });
      if (!cancelled) setTimes(t);
    })();
    return () => { cancelled = true; };
  }, [branch?.lat, branch?.lng]);

  // Tick once per second
  useEffect(() => {
    if (!branch?.autopilot) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [branch?.autopilot]);

  // Decide on every tick
  useEffect(() => {
    if (!AUTOPILOT_ENABLED || !branch?.autopilot || !times) return;

    if (paused) {
      setDecision({ action: "halt", reason: "paused by staff" });
      return;
    }

    const pauseStatus = getPauseStatus(times);
    const d = decide({
      serving,
      waiting,
      activeStaffCount,
      avgServiceSec,
      pauseStatus,
    });
    setDecision(d);

    if (d.action !== "call") return;

    const next = waiting[0];
    if (!next) return;

    // Already calling — wait for it to finish rather than stacking another.
    if (inFlightRef.current) return;

    // Same head-of-queue ticket we just called: the update hasn't landed
    // yet. Calling again here is exactly what double-announces a customer.
    if (lastCalledIdRef.current === next.id) return;

    if (Date.now() - lastCallRef.current < CALL_THROTTLE_MS) return;

    lastCallRef.current     = Date.now();
    lastCalledIdRef.current = next.id;
    inFlightRef.current     = true;

    Promise.resolve(onCallNext?.())
      .catch((e) => console.warn("[autopilot] call failed", e))
      .finally(() => { inFlightRef.current = false; });
  }, [tick, branch?.autopilot, paused, serving?.id, waiting, avgServiceSec, times, activeStaffCount]);

  return {
    enabled: AUTOPILOT_ENABLED && !!branch?.autopilot && !paused,
    decision,
    avgServiceSec,
    paused: paused || decision.action === "halt",
    pausedReason: paused ? "paused by staff"
                 : decision.action === "halt" ? decision.reason
                 : null,
    secondsUntilNext: decision.secondsUntilNext ?? null,
    targetIntervalSec: decision.targetIntervalSec ?? null,
  };
}
