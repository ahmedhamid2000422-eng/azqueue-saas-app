import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { decide, getAvgServiceSeconds } from "../lib/autopilot";
import { fetchPrayerTimes, getPauseStatus } from "../lib/prayerTimes";

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
export function useAutopilot({ branch, serving, waiting, onCallNext }) {
  const [avgServiceSec, setAvgServiceSec] = useState(null);
  const [tick, setTick] = useState(0);
  const [decision, setDecision] = useState({ action: "wait", reason: "starting…" });
  const [activeStaffCount] = useState(1); // Phase 3 will wire this from staff table
  const [times, setTimes] = useState(null);

  const lastCallRef = useRef(0); // throttle: never call twice within 5s

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
    if (!branch?.autopilot || !times) return;

    const pauseStatus = getPauseStatus(times);
    const d = decide({
      serving,
      waiting,
      activeStaffCount,
      avgServiceSec,
      pauseStatus,
    });
    setDecision(d);

    if (d.action === "call") {
      const now = Date.now();
      if (now - lastCallRef.current > 5000) {
        lastCallRef.current = now;
        onCallNext?.();
      }
    }
  }, [tick, branch?.autopilot, serving?.id, waiting.length, avgServiceSec, times, activeStaffCount]);

  return {
    enabled: !!branch?.autopilot,
    decision,
    avgServiceSec,
    paused: decision.action === "halt",
    pausedReason: decision.action === "halt" ? decision.reason : null,
    secondsUntilNext: decision.secondsUntilNext ?? null,
    targetIntervalSec: decision.targetIntervalSec ?? null,
  };
}
