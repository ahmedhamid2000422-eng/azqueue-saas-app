import { useState } from "react";

/**
 * WhatsNewBanner — a short "here's what changed" notice after a release.
 *
 * VISIBILITY, and why it works this way
 * Az Tax's owner and staff share one login, so there is no per-user record to
 * hang "has seen this" on. Two consequences shaped the design:
 *
 *   1. The window is a DATE RANGE, not a per-account flag. Anyone who signs
 *      in during the seven days sees it, whichever person they are. If it
 *      were marked seen on the account, whoever logged in first would hide it
 *      from everyone else.
 *   2. Dismissal is per browser (localStorage), so closing it on the counter
 *      iPad doesn't hide it from the laptop in the back office. Same shared
 *      account, different device, still sees it once.
 *
 * It disappears on its own after the window. Nobody has to remember to
 * remove it, which is how these things end up sitting on a dashboard for a
 * year.
 */

/* Set on release day. The banner shows for DAYS_VISIBLE days after this. */
const RELEASED_ON  = "2026-08-31";
const DAYS_VISIBLE = 7;

/* Bumping this key brings the banner back for everyone on the next release,
   including browsers that dismissed the previous one. */
const SEEN_KEY = "azq.whatsnew.2026-08-31";

const ITEMS = [
  {
    title: "Text messages are back on",
    body: "Customers who give a phone number and tick the box now get a text when it's their turn, as well as the email.",
  },
  {
    title: "The screen shows your hours, and everyone waiting",
    body: "Opening times sit under your name, and if more than seven people are waiting the list scrolls through all of them so nobody is left off.",
  },
  {
    title: "People are told what to bring before they wait",
    body: "The check-in page now lists what's needed for that service, so someone missing a document finds out at the door instead of an hour later.",
  },
  {
    title: "Finishing a customer asks how it went",
    body: "Call next now asks whether the visit was done, needs documents, or is a drop-off. One tap, then it calls the next person as usual.",
  },
  {
    title: "Insights can show past days",
    body: "Arrows at the top move back through previous days. The daily numbers were also six hours out and are now correct.",
  },
];

export default function WhatsNewBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(SEEN_KEY); } catch { return false; }
  });
  const [open, setOpen] = useState(false);

  /* Outside the window it renders nothing and needs no cleanup later. */
  const released = new Date(`${RELEASED_ON}T00:00:00`);
  const expired  = Date.now() > +released + DAYS_VISIBLE * 86_400_000;
  if (expired || dismissed) return null;

  function close() {
    setDismissed(true);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode */ }
  }

  return (
    <div className="border-b border-gold-deep/40 bg-[rgba(201,168,106,0.07)]">
      <div className="px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="ovline text-[9px] text-gold-soft shrink-0">New</span>
            <span className="text-[12.5px] text-ink leading-snug">
              Text messages are switched on, and a few things changed on the
              screens.
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setOpen((o) => !o)}
              className="ovline text-[9px] border border-gold-deep px-2.5 py-1 text-gold-soft hover:bg-[rgba(201,168,106,0.12)] transition"
            >
              {open ? "Hide" : "What changed"}
            </button>
            <button
              onClick={close}
              title="Dismiss"
              className="text-ink-mute hover:text-ink leading-none text-sm px-1"
            >
              ✕
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-3 space-y-2.5 max-w-2xl">
            {ITEMS.map((it) => (
              <div key={it.title} className="flex gap-2.5">
                <span className="text-gold-soft text-[10px] leading-5 shrink-0">—</span>
                <div>
                  <div className="text-[12px] text-ink leading-snug">{it.title}</div>
                  <p className="text-[11px] text-ink-mute leading-relaxed mt-0.5">
                    {it.body}
                  </p>
                </div>
              </div>
            ))}
            <p className="text-[10.5px] text-ink-mute leading-relaxed pt-1">
              Nothing you already do has changed. This notice disappears on its
              own in a few days.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
