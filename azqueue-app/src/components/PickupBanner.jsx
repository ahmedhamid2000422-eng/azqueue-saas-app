import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBranch } from "../lib/BranchContext";
import { loadOpenPickups, acknowledgePickup, markCollected, categoryLabel } from "../lib/backQueue";
import { playChime } from "../lib/tts";

/**
 * PickupBanner — someone is standing at the pickup spot.
 *
 * WHY THIS IS AN INTERRUPTION AND NOT A LIST
 * The pickup spot is unstaffed. That is the whole point of it — it means a
 * collection doesn't consume a counter. But it also means nobody is looking
 * at the person standing there, so a row appearing quietly in a table is
 * exactly the failure this design must not produce. Someone waiting at an
 * unattended desk, being ignored, is worse than the queue they were spared.
 *
 * So: a banner across the top of whatever page staff are on, a chime, a timer
 * that keeps climbing, and escalation if it's ignored.
 *
 * It shows who and what, because the kiosk already identified them by email —
 * staff can collect the right envelope on the way to the desk, which is most
 * of what makes a collection fast.
 */

/* Chime again if nobody has acknowledged. Escalating intervals: attentive
   without becoming an alarm nobody can think through. */
const RECHIME_SECONDS = [30, 90, 180, 300];

export default function PickupBanner() {
  const { branch } = useBranch();
  const [pickups, setPickups] = useState([]);
  const [now, setNow] = useState(Date.now());
  const chimedAt = useRef({});   // pickupId → how many chimes so far

  /* Poll as well as subscribe. Realtime is usually instant, but this is the
     one screen where a missed event means a person standing unattended, so a
     cheap safety net is worth it. */
  useEffect(() => {
    if (!branch?.id) return;
    let alive = true;

    const refresh = () => loadOpenPickups(branch.id).then((p) => { if (alive) setPickups(p); });
    refresh();

    const ch = supabase
      .channel(`pickups-${branch.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pickup_waits", filter: `branch_id=eq.${branch.id}` },
        refresh)
      .subscribe();

    const poll = setInterval(refresh, 15_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);

    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
      supabase.removeChannel(ch).catch(() => {});
    };
  }, [branch?.id]);

  /* Chime on arrival, then again at widening intervals until acknowledged. */
  useEffect(() => {
    for (const p of pickups) {
      if (p.acknowledged_at) continue;
      const waited = (now - new Date(p.announced_at).getTime()) / 1000;
      const already = chimedAt.current[p.id] ?? 0;
      const due = RECHIME_SECONDS.filter((s) => waited >= s).length + 1;

      if (already < due) {
        chimedAt.current[p.id] = due;
        // playChime is synchronous and returns undefined when audio isn't
        // unlocked yet, so no promise to catch — but it can throw on some
        // WebViews, and a failed chime must never break the banner.
        try { playChime(); } catch { /* silent screen is still better than none */ }
      }
    }
  }, [pickups, now]);

  if (!branch?.id || pickups.length === 0) return null;

  const mins = (iso) => Math.floor((now - new Date(iso).getTime()) / 60000);

  async function collect(p) {
    if (p.ticket_id) await markCollected(p.ticket_id);
    else await supabase.from("pickup_waits").update({ collected_at: new Date().toISOString() }).eq("id", p.id);
    setPickups((list) => list.filter((x) => x.id !== p.id));
  }

  async function ack(p) {
    await acknowledgePickup(p.id);
    setPickups((list) => list.map((x) => (x.id === p.id ? { ...x, acknowledged_at: new Date().toISOString() } : x)));
  }

  return (
    <div className="sticky top-0 z-30">
      {pickups.map((p) => {
        const waited = mins(p.announced_at);
        /* After five minutes this stops being a notification and becomes a
           problem. The styling should say so. */
        const urgent = waited >= 5;

        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 px-5 py-3 border-b ${
              urgent
                ? "border-[#b56b5f] bg-[#b56b5f]/15"
                : "border-gold-deep bg-[rgba(201,168,106,0.12)]"
            }`}
          >
            <span className={`pip ${p.acknowledged_at ? "" : "breathe"}`}
                  style={{ background: urgent ? "#d49185" : "#c9a86a" }} />

            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-ink leading-snug">
                <span className="ovline text-[9px] text-gold-soft mr-2">Pickup waiting</span>
                {p.display_name ?? p.tickets?.customer_name ?? "Someone"}
                {p.tickets?.handoff_category && (
                  <span className="text-ink-soft"> · {categoryLabel(p.tickets.handoff_category)}</span>
                )}
              </div>
              <div className="text-[10.5px] text-ink-mute mt-0.5">
                waiting {waited < 1 ? "less than a minute" : `${waited} min`}
                {p.tickets?.handed_off_at &&
                  ` · dropped off ${new Date(p.tickets.handed_off_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                {urgent && <span className="text-[#d49185]"> · nobody has been over yet</span>}
              </div>
            </div>

            {!p.acknowledged_at && (
              <button
                onClick={() => ack(p)}
                title="Stops the chime — the pickup stays open"
                className="ovline text-[9px] border border-line px-2.5 py-1.5 text-ink-mute hover:text-ink transition shrink-0"
              >
                On my way
              </button>
            )}

            <button
              onClick={() => collect(p)}
              className="ovline text-[9px] border border-gold-deep px-3 py-1.5 text-gold-soft hover:bg-[rgba(201,168,106,0.15)] transition shrink-0"
            >
              Collected
            </button>
          </div>
        );
      })}
    </div>
  );
}
