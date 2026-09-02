import { useEffect, useState } from "react";
import { loadBackQueue, finishWork, markNotified, categoryLabel } from "../lib/backQueue";
import { sendReadyEmail } from "../lib/notifyEmail";

/**
 * InReviewList — the second line, for work whose customer has gone home.
 *
 * WHY A SEPARATE LINE
 * The waiting queue answers "who is in the room". Once someone hands over
 * documents and leaves, they are no longer in the room but their work is
 * still outstanding — and until now that work vanished the moment Drop-off
 * was pressed. It was recorded and invisible, which is the worst of both:
 * staff couldn't trust the screen, so they kept a paper list, so the screen
 * fell further behind.
 *
 * Keeping it visually separate from the waiting queue matters more than it
 * looks. These people are NOT waiting. If they appeared in the same list they
 * would inflate the queue count, the wait estimate and every arrival figure —
 * the exact mistake the back-queue migration was written to prevent.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * No position numbers, no estimated times. Nobody is standing there, so a
 * position is meaningless and an estimate would be a promise about work that
 * has not started.
 */

/* Past this many days something has been forgotten rather than queued. */
const OVERDUE_DAYS = 3;

export default function InReviewList({ branchId, branchName, branchSlug, onChange }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);

  async function load() {
    setRows(await loadBackQueue(branchId));
  }

  useEffect(() => {
    if (!branchId) return;
    load();
    /* Slower than the queue's own refresh. Nothing here changes minute to
       minute — it is work sitting on a desk, not a room filling up. */
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function markReady(t) {
    setBusy(t.id);
    const res = await finishWork(t.id);

    /* Tell them, then record that we told them. markNotified is only set
       after a successful send, so a failed email is retried rather than
       silently marked done — the customer never learning their documents are
       ready is the one failure this whole flow exists to prevent. */
    if (res?.ok && t.customer_email) {
      try {
        await sendReadyEmail({
          email:      t.customer_email,
          name:       (t.customer_name || "").split(" ")[0] || "there",
          branchName: branchName || "your appointment",
          serviceName: categoryLabel(t.handoff_category),
          branchSlug,
        });
        await markNotified(t.id);
      } catch (e) {
        console.error("[InReviewList] ready email failed", e);
      }
    }

    await load();
    setBusy(null);
    onChange?.();
  }

  if (!rows.length) return null;

  const days = (iso) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

  const age = (iso) => {
    const d = days(iso);
    if (d < 1) {
      const h = Math.round(d * 24);
      return h < 1 ? "just now" : `${h} hr`;
    }
    const n = Math.floor(d);
    return `${n} day${n === 1 ? "" : "s"}`;
  };

  return (
    <div className="border border-line">
      <div className="px-5 py-3 border-b border-line flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[13px] text-ink">In review</div>
          <div className="text-[11px] text-ink-mute mt-0.5">
            Left with us — not waiting in the room
          </div>
        </div>
        <span className="text-[11px] text-ink-mute">{rows.length}</span>
      </div>

      <div className="divide-y divide-line">
        {rows.map((t) => {
          const overdue = days(t.handed_off_at) > OVERDUE_DAYS;
          return (
            <div key={t.id} className="px-5 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-ink truncate">
                  {t.customer_name || t.token}
                </div>
                <div className="text-[11px] text-ink-mute mt-0.5">
                  {categoryLabel(t.handoff_category)} ·{" "}
                  <span className={overdue ? "text-[#d49185]" : ""}>
                    {age(t.handed_off_at)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => markReady(t)}
                disabled={busy === t.id}
                className="text-[11.5px] border border-gold-deep px-3 py-1.5 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-40 shrink-0"
              >
                {busy === t.id ? "…" : "Ready to collect"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-2.5 text-[10.5px] text-ink-mute leading-relaxed border-t border-line">
        Press Ready to collect when the work is finished. Anything older than{" "}
        {OVERDUE_DAYS} days is shown in red.
      </div>
    </div>
  );
}
