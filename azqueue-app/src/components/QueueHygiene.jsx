import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * QueueHygiene — a quiet nudge when the screen has stopped matching the room.
 *
 * WHY THIS EXISTS
 * Reading the office's own history day by day showed something no average
 * revealed: on some days the median wait is 18 minutes, on others 209. The bad
 * days are not busier. They are days where nobody pressed Call next or
 * Complete as it happened, and the queue was tidied up at closing time — so
 * every timestamp records data entry rather than what a customer experienced.
 *
 * That single habit is the difference between numbers that mean something and
 * numbers that mean nothing. No dashboard, alert or report built on top of
 * this data works until it is fixed, which makes this small banner more
 * valuable than any analysis sitting on the Insights page.
 *
 * WHAT IT WILL NOT DO
 * It does not nag on a busy day. Someone genuinely with a customer for an hour
 * is working, not forgetting — so the threshold is deliberately generous, it
 * shows at most one message, and it disappears the moment the screen is
 * accurate again. A prompt that fires when nothing is wrong gets ignored, and
 * then the one that matters gets ignored with it.
 */

/* Longer than a real visit at this office by some margin. A ticket still
   marked "serving" past this is almost certainly finished in the room and
   unfinished on the screen. */
const SERVING_STALE_MIN = 75;

/* Waiting far longer than anyone should before being called. Deliberately
   high: this is meant to catch a forgotten person, not a busy morning. */
const WAITING_STALE_MIN = 120;

export default function QueueHygiene({ branchId, refreshKey }) {
  const [stale, setStale] = useState(null);

  useEffect(() => {
    let off = false;
    if (!branchId) return;

    (async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, token, customer_name, status, created_at, called_at")
        .eq("branch_id", branchId)
        .eq("is_test", false)
        .in("status", ["waiting", "serving"]);

      if (off) return;

      const now = Date.now();
      const mins = (t) => (now - new Date(t).getTime()) / 60000;

      /* Someone marked as being served for over an hour and a quarter. Most
         likely they left a while ago and Complete was never pressed. */
      const serving = (data ?? [])
        .filter((t) => t.status === "serving" && t.called_at && mins(t.called_at) > SERVING_STALE_MIN)
        .sort((a, b) => new Date(a.called_at) - new Date(b.called_at));

      /* Nobody called for two hours. Either a genuinely forgotten customer or
         a day being worked without the screen. Both are worth a look. */
      const waiting = (data ?? [])
        .filter((t) => t.status === "waiting" && mins(t.created_at) > WAITING_STALE_MIN)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      setStale(
        serving.length ? { kind: "serving", t: serving[0], n: serving.length, since: serving[0].called_at }
        : waiting.length ? { kind: "waiting", t: waiting[0], n: waiting.length, since: waiting[0].created_at }
        : null
      );
    })();

    return () => { off = true; };
  }, [branchId, refreshKey]);

  if (!stale) return null;

  const who  = stale.t.customer_name || stale.t.token;
  const mins = Math.round((Date.now() - new Date(stale.since).getTime()) / 60000);
  const dur  = mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`;

  return (
    <div className="border border-gold-deep/40 bg-[rgba(201,168,106,0.05)] px-5 py-3">
      {stale.kind === "serving" ? (
        <>
          <div className="text-[12.5px] text-ink leading-snug">
            {who} has been at the counter for {dur}.
            {stale.n > 1 && ` (${stale.n} people are showing as still being served.)`}
          </div>
          <div className="text-[11px] text-ink-mute mt-1 leading-relaxed">
            If they've already finished, press Complete so the next person moves
            up — otherwise the screen shows a queue that isn't really there.
          </div>
        </>
      ) : (
        <>
          <div className="text-[12.5px] text-ink leading-snug">
            {who} has been waiting {dur} and hasn't been called yet.
            {stale.n > 1 && ` (${stale.n} people have been waiting this long.)`}
          </div>
          <div className="text-[11px] text-ink-mute mt-1 leading-relaxed">
            If they were already seen, press Call next and then Complete so the
            record matches what actually happened today.
          </div>
        </>
      )}
    </div>
  );
}
