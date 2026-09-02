import { useEffect, useRef, useState } from "react";

/**
 * CompleteReminder — a short prompt the moment someone is called.
 *
 * WHY AT THIS MOMENT
 * The habit that has to form is pressing Complete when a customer leaves. The
 * only reliable time to ask for it is the instant the previous action
 * finishes, while the person is still thinking about this customer — not an
 * hour later, by which time the visit is over and the screen is stale.
 *
 * WHY IT REMOVES ITSELF
 * An always-on prompt is wallpaper. Insights already had a permanently-lit
 * "wait times are elevated" alert that taught staff to ignore the whole
 * panel, and repeating that mistake here would cost the one message that
 * matters. So this is scaffolding: it appears after each call, disappears on
 * its own after a few seconds, and stops appearing entirely once the habit is
 * evidently formed.
 *
 * It counts appearances per browser rather than per account, because the
 * owner and staff share one login — a count on the account would silence it
 * for whoever hadn't learned it yet.
 */

/* After this many calls it stops. Roughly a fortnight of ordinary days at
   this office — long enough to become automatic, short enough not to nag. */
const SHOW_FOR_CALLS = 40;
const VISIBLE_MS = 12_000;
const KEY = "azq.completeReminder.count";

function seen() {
  try { return Number(localStorage.getItem(KEY) ?? 0); } catch { return 0; }
}
function bump(n) {
  try { localStorage.setItem(KEY, String(n)); } catch { /* private mode */ }
}

export default function CompleteReminder({ serving }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const lastId = useRef(null);
  const timer  = useRef(null);

  useEffect(() => {
    const id = serving?.id ?? null;

    /* Only on a NEW person being served. Re-renders, refreshes and polling
       must not re-trigger it, or it becomes the nagging thing it is designed
       not to be. */
    if (!id || id === lastId.current) return;
    lastId.current = id;

    const count = seen();
    if (count >= SHOW_FOR_CALLS) return;
    bump(count + 1);

    setName((serving.customer_name || "").split(" ")[0] || serving.token || "");
    setShow(true);

    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), VISIBLE_MS);
    return () => clearTimeout(timer.current);
  }, [serving?.id, serving?.customer_name, serving?.token]);

  if (!show) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(430px,calc(100vw-2.5rem))] rounded-xl border border-gold-deep/50 bg-bg shadow-2xl">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13.5px] text-ink leading-snug">
              {name ? `${name} is at the counter.` : "Customer called."}
            </div>
            <div className="text-[12px] text-ink-soft leading-relaxed mt-1">
              Press <span className="text-gold-soft">Complete</span> when
              they're finished — that's what records the visit and calls the
              next person.
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            title="Dismiss"
            className="text-ink-mute hover:text-ink leading-none text-sm px-1 shrink-0"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
