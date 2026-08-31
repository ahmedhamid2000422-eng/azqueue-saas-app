import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { estimateWaitFor, formatWait } from "../lib/waitEstimator";
import { loadHourShape, findQuietHour, quietPhrase } from "../lib/quietHours";
import { CHECKIN_NUDGE_ENABLED } from "../lib/features";

/**
 * QuietSlotNudge — offers an appointment instead of a long wait.
 *
 * WHY THIS EXISTS
 * Az Tax takes 62% of its visits between 10am and 3pm and 6% after 5pm. The
 * queue pressure across the full day is 0.38, meaning there is roughly twice
 * the capacity needed — it's simply all wanted at once. The result is
 * 90-minute waits and around 40% of people leaving without being seen.
 *
 * Hiring doesn't fix a distribution problem. Moving arrivals does. This
 * catches someone at the exact moment they're deciding to join a long queue
 * and offers them a specific time this afternoon instead.
 *
 * RULES IT FOLLOWS
 * 1. Only appears when the wait is genuinely long. Nudging someone who'd be
 *    seen in ten minutes is an obstacle, not a service.
 * 2. Only offers real slots, from the same RPC the booking page uses. An
 *    offered time that isn't available is worse than no offer.
 * 3. Never blocks joining the queue. Walking in stays the default and the
 *    button stays exactly where it was — this sits alongside it.
 * 4. Shows the honest wait either way. People who choose a 90-minute wait
 *    are far less angry than people who discover it after 60.
 * 5. PROMISES NOTHING IT CANNOT KEEP. The queue is strictly first-come,
 *    first-served by created_at — a booking does not currently jump ahead of
 *    walk-ins, and there is no one on the floor to enforce an appointment
 *    time. So this offers a QUIETER TIME, never a guaranteed time. Wording
 *    like "you'll be seen at 4:15" would be a promise the software cannot
 *    honour, and a broken promise costs more loyalty than a long wait.
 */

/* Below this, waiting is the better experience and we say nothing. */
const NUDGE_ABOVE_MINUTES = 35;

/**
 * Turn an estimate into a phrase that reality will usually beat.
 *
 * A precise figure becomes a promise. "About 1 hr 20" that runs to two hours
 * manufactures a grievance the business then has to absorb at the counter,
 * with nobody there to explain that the estimate had a confidence interval.
 *
 * So: take the UPPER end of the estimate, round it UP to a coarse band, and
 * say "up to". Someone told "up to an hour and a half" who waits 70 minutes
 * feels well treated. Someone told "about 80 minutes" who waits 70 feels
 * they were told wrong. Same wait, opposite feeling — this is the oldest
 * finding in queue psychology and it costs nothing to apply.
 */
function conservativeWait(est) {
  const mins = est?.high ?? est?.centre;
  if (!mins || !Number.isFinite(mins)) return null;
  if (mins <= 45)  return "up to about 45 minutes";
  if (mins <= 60)  return "up to about an hour";
  if (mins <= 90)  return "up to about an hour and a half";
  if (mins <= 120) return "up to about two hours";
  return "over two hours";
}

export default function QuietSlotNudge({ branch, serviceId, waitingCount, onBook }) {
  const [wait, setWait]   = useState(null);
  const [slots, setSlots] = useState([]);
  const [quiet, setQuiet] = useState(null);   // e.g. "after 4pm"
  const [busy, setBusy]   = useState(true);

  useEffect(() => {
    let off = false;
    if (!branch?.id || !CHECKIN_NUDGE_ENABLED) { setBusy(false); return; }
    setBusy(true);

    (async () => {
      /* What joining now actually costs. Position is the number already
         waiting plus this person. */
      const est = await estimateWaitFor({
        branchId: branch.id,
        position: (waitingCount ?? 0) + 1,
        serviceId,
      }).catch(() => null);

      if (off) return;
      setWait(est);

      /* Only look for slots if the wait is bad enough to be worth avoiding.
         formatWait returns null when confidence is low, and a nudge built on
         a number we don't trust is worse than staying quiet. */
      const text = est ? formatWait(est) : null;
      if (!text || (est?.centre ?? 0) < NUDGE_ABOVE_MINUTES) { setBusy(false); return; }

      /* When this branch is genuinely quieter, from its own arrivals. This
         is the honest message — it needs nobody on the floor to make it
         true, unlike an appointment time. */
      const shape = await loadHourShape(supabase, branch.id).catch(() => null);
      if (off) return;
      const q = findQuietHour(shape);
      /* Only worth saying if that hour hasn't already passed. */
      setQuiet(q && new Date().getHours() < q.hour ? quietPhrase(q) : null);

      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.rpc("get_available_slots", {
        p_branch_id: branch.id,
        p_day: today,
        p_service_id: serviceId ?? null,
      });

      if (off) return;

      /* Only slots far enough ahead to be a real alternative, and only the
         next few — a wall of times is a decision, not an offer. */
      const cutoff = Date.now() + 45 * 60_000;
      setSlots(
        (data ?? [])
          .map((s) => new Date(s.slot_at))
          .filter((d) => +d > cutoff)
          .slice(0, 3)
      );
      setBusy(false);
    })();

    return () => { off = true; };
  }, [branch?.id, serviceId, waitingCount]);

  if (!CHECKIN_NUDGE_ENABLED) return null;
  if (busy || !wait) return null;

  /* formatWait still gates on confidence — if it won't produce a figure, we
     show nothing rather than a band built on a number we don't trust. */
  if (!formatWait(wait)) return null;
  const waitText = conservativeWait(wait);
  if (!waitText) return null;

  const fmt = (d) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  /* Long wait but nothing free today — still tell them the truth about the
     wait. Honesty here is the part that protects the relationship. */
  if (!slots.length) {
    if ((wait.centre ?? 0) < NUDGE_ABOVE_MINUTES) return null;
    return (
      <div className="border border-line px-4 py-3 mb-4">
        <div className="text-[12px] text-ink leading-relaxed">
          It's busy right now — {waitText} if you join the queue.
        </div>
        <div className="text-[11px] text-ink-mute mt-1 leading-relaxed">
          {quiet
            ? `You're welcome to wait. It's usually much quieter ${quiet} if you'd rather come back later.`
            : "You're welcome to wait, or come back later in the day when it's usually quieter."}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gold-deep/50 bg-[rgba(201,168,106,0.04)] px-4 py-3.5 mb-4">
      <div className="text-[12px] text-ink leading-relaxed mb-1">
        It's busy right now — {waitText} if you join the queue.
      </div>
      <div className="text-[11px] text-ink-soft leading-relaxed mb-2.5">
        {quiet
          ? `It's usually much quieter ${quiet} — a shorter wait if you can come back then.`
          : "It's usually much quieter later in the day — a shorter wait if you can come back then."}
        {" "}You can reserve a time now if that helps.
      </div>

      <div className="flex flex-wrap gap-1.5">
        {slots.map((d) => (
          <button
            key={+d}
            type="button"
            onClick={() => onBook?.(d)}
            className="text-[12px] border border-gold-deep px-3 py-1.5 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition"
          >
            {fmt(d)}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-ink-mute mt-2.5 leading-relaxed">
        Or carry on below to join the queue now.
      </div>
    </div>
  );
}
