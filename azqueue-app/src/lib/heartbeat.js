import { useEffect } from "react";
import { supabase } from "./supabase";

/**
 * heartbeat.js — records that a screen was open.
 *
 * WHY
 * The database knows what was clicked and nothing about whether anyone was
 * looking. That gap has blocked two separate questions:
 *
 *   15 Oct: 10 tickets, all closed by cron. 17 Oct: 10 tickets, none.
 *   Tuesday had check-ins on 8 of 13 calendar Tuesdays — closed, or unused?
 *
 * Both are unanswerable from tickets alone, and the second decides whether
 * Monday is 15.8 or 18.6 per day, which propagates into every staffing
 * scenario.
 *
 * WHAT IS RECORDED
 * Branch, which screen, an anonymous per-browser key, and a timestamp. No
 * user, no keystrokes, no idle detection. This answers "was the tool in use",
 * not "was a person working" — the second would be surveillance of two named
 * people, and is not something this product should collect.
 */

const KEY = "azq.deviceKey";
const INTERVAL_MS = 60_000;

/** Stable per browser, random, meaningless on its own. */
function deviceKey() {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 18);
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return "no-storage";
  }
}

async function beat(branchId, surface) {
  if (!branchId) return;
  /* Failure is silent and harmless. A missed heartbeat makes the record
     slightly incomplete; an error banner over the queue during a busy
     Monday would be worse than the gap. */
  try {
    await supabase.from("screen_heartbeats").insert({
      branch_id: branchId,
      surface,
      device_key: deviceKey(),
    });
  } catch {
    /* ignore */
  }
}

/**
 * Beat once a minute while this screen is open AND visible.
 *
 * Visibility matters: a forgotten background tab would otherwise report the
 * screen as open all night and make the data say the opposite of the truth.
 */
export function useHeartbeat(branchId, surface) {
  useEffect(() => {
    if (!branchId) return;

    let timer = null;

    const tick = () => {
      if (document.visibilityState === "visible") beat(branchId, surface);
    };

    tick();                                   // record immediately, not in 60s
    timer = setInterval(tick, INTERVAL_MS);

    /* Returning to the tab should register at once — otherwise a screen
       reopened at 9am looks like it opened at 9:01. */
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [branchId, surface]);
}
