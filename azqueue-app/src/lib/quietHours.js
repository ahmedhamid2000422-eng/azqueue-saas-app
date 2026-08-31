/**
 * quietHours — when this branch is genuinely less busy.
 *
 * Derived from the branch's own arrival distribution, never assumed. Two
 * businesses with identical opening hours can have opposite shapes, and a
 * hardcoded "come after 4pm" would be wrong for most of them.
 *
 * The rule: find the busiest hour, then the first hour AFTER it where
 * arrivals fall to a clearly lower level. That's the earliest point someone
 * can be told, truthfully, that it tends to be quieter.
 *
 * Az Tax, for reference: peak 11:00 with 2,288 arrivals; 15:00 still runs at
 * 77% of peak, 16:00 drops to 61%. So the honest answer there is "after 4",
 * which is also what the owner expected — a good sign the threshold is set
 * somewhere sensible rather than somewhere convenient.
 */

/* An hour has to be meaningfully quieter to be worth recommending, not
   marginally so. At 80% of peak the room still feels full. */
const QUIET_RATIO = 0.65;

/* Below this many recorded arrivals the shape is noise, and we say nothing
   rather than sending someone across town on the strength of six visits. */
const MIN_ARRIVALS = 200;

/**
 * @param hours {{labels:string[], values:number[]}} arrivals per hour label
 * @returns {{ hour:number, label:string, share:number } | null}
 */
export function findQuietHour(hours) {
  if (!hours?.values?.length || !hours?.labels?.length) return null;

  const values = hours.values;
  const total = values.reduce((a, b) => a + b, 0);
  if (total < MIN_ARRIVALS) return null;

  const peak = Math.max(...values);
  if (!peak) return null;
  const peakIdx = values.indexOf(peak);

  /* Only look later in the day. Telling someone the morning was quieter is
     useless at 11am, and the whole point is to move demand forward into
     unused capacity. */
  for (let i = peakIdx + 1; i < values.length; i++) {
    if (values[i] <= peak * QUIET_RATIO) {
      /* Ignore an hour that's quiet because they're nearly closed — an hour
         with almost nothing in it is closing time, not an opportunity. */
      if (values[i] < total * 0.02) continue;

      const hour = parseInt(String(hours.labels[i]), 10);
      if (Number.isNaN(hour)) return null;
      return { hour, label: hours.labels[i], share: values[i] / peak };
    }
  }
  return null;
}

/** "after 4pm" — phrased the way a person would say it out loud. */
export function quietPhrase(quiet) {
  if (!quiet) return null;
  const h = quiet.hour;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `after ${h12}${period}`;
}

/** Arrivals per hour for a branch, preferring imported history when it's larger. */
export async function loadHourShape(supabase, branchId) {
  if (!branchId) return null;

  const [{ data: summary }, { data: tickets }] = await Promise.all([
    supabase.from("branch_history_summary").select("hours, total_visits")
      .eq("branch_id", branchId).maybeSingle(),
    supabase.from("tickets").select("created_at")
      .eq("branch_id", branchId).limit(20_000),
  ]);

  const live = new Array(24).fill(0);
  for (const t of tickets ?? []) live[new Date(t.created_at).getHours()] += 1;
  const liveTotal = live.reduce((a, b) => a + b, 0);

  /* Whichever covers more visits wins. Never summed: the two sources cover
     overlapping periods and adding them would double-count. */
  if (summary?.hours && (summary.total_visits ?? 0) > liveTotal) return summary.hours;

  const labels = [], values = [];
  for (let h = 0; h < 24; h++) if (live[h] > 0) { labels.push(String(h)); values.push(live[h]); }
  return values.length ? { labels, values } : null;
}
