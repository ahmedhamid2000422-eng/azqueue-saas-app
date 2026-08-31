import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * ProductTour — a short guided walk through AzQueue.
 *
 * WHY A PAGE TOUR AND NOT A SLIDESHOW
 * People don't remember screenshots. They remember having been somewhere.
 * This actually navigates the app, so at every stop the person is looking at
 * their own branch's real screen with their own real data, and the card just
 * explains what they are looking at. When it finishes, they have already
 * visited every page once — which is most of the battle for the pages nobody
 * opens, like Insights and Customers.
 *
 * DESIGN NOTES
 * - Deliberately no dimming overlay or element highlighting. Spotlight tours
 *   anchor to specific DOM nodes and break silently every time a layout
 *   changes; this survives any redesign because it only knows about routes.
 * - The card is fixed to the bottom-centre and never blocks the page, so
 *   people can click around mid-tour without losing their place.
 * - Plain language throughout. The person being onboarded is often not the
 *   person who bought the software.
 * - Offered once per user, then never again unless they ask. Nothing is more
 *   irritating than a tour that reappears.
 */

/* Two different kinds of "no", stored deliberately differently:
   - FINISHED (localStorage, permanent): they actually went through the tour.
     Never offer it again.
   - SNOOZED (sessionStorage, this visit only): they closed the invite. It
     comes back next time they sign in. Someone who is busy right now is not
     someone who has learned the app — so a single X shouldn't cost them the
     offer forever. */
const SEEN_KEY  = "azq.tour.product.seen";
const SNOOZE_KEY = "azq.tour.product.snoozed";

export function hasSeenTour() {
  try { return !!localStorage.getItem(SEEN_KEY); } catch { return true; }
}
export function markTourSeen() {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode */ }
}
export function isSnoozed() {
  try { return !!sessionStorage.getItem(SNOOZE_KEY); } catch { return false; }
}
export function snoozeTour() {
  try { sessionStorage.setItem(SNOOZE_KEY, "1"); } catch { /* private mode */ }
}

/* Each stop: where to go, and what to say once you're there. Ordered by how
   often it gets used day to day, not by how impressive it is. */
const STOPS = [
  {
    path: "",
    label: "The queue",
    title: "This is where the day happens",
    body:
      "Everyone waiting shows up here, oldest first. Press Call next to take the " +
      "person at the front, and their number appears on the TV and is read out loud.",
    tip: "If someone steps away, use Return instead of No-show — it puts them back in line.",
  },
  {
    path: "bookings",
    label: "Bookings",
    title: "Appointments booked in advance",
    body:
      "Anyone who booked a time online appears here. They join the queue automatically " +
      "when they arrive, so you don't have to add them by hand.",
    tip: "Share your booking link and people can reserve a slot instead of waiting.",
  },
  {
    path: "customers",
    label: "Customers",
    title: "Everyone who has ever come in",
    body:
      "Every walk-in and booking is saved here with how many times they've visited. " +
      "Useful when a returning client calls and you want their history before they arrive.",
    tip: "You can export the whole list to Excel whenever you need it.",
  },
  {
    path: "insights",
    label: "Insights",
    title: "How the business is actually doing",
    body:
      "How long people wait, how many you serve, when your busy hours are, and how many " +
      "give up and leave. All measured from your own branch — nothing is estimated.",
    tip: "Worth a look once a week. The busy-hours chart is the one that usually changes minds about staffing.",
  },
  {
    path: "schedule",
    label: "Schedule",
    title: "Who is working, and when",
    body:
      "Set your opening hours and mark staff as away or closed. The booking page only " +
      "offers times you're actually open, so nobody books an empty chair.",
    tip: "Prayer pauses are set here too — the queue holds itself automatically.",
  },
  {
    path: "settings",
    label: "Settings",
    title: "Your details and preferences",
    body:
      "Your business name, services, how many bookings you take a day, and the link and " +
      "QR code customers scan to join the queue.",
    tip: "Print the QR code and put it at the door — most walk-ins join themselves that way.",
  },
  {
    path: "",
    label: "Done",
    title: "That's everything",
    body:
      "You've now seen every part of AzQueue. If you ever want to run through it " +
      "again, click your name at the top right and choose Take the tour.",
    tip: "The AI Assist button in the bottom corner answers questions about any of this in plain language.",
    last: true,
  },
];

const BASE = "/business";

export default function ProductTour({ open, onClose }) {
  const [i, setI] = useState(0);
  const navigate  = useNavigate();
  const location  = useLocation();

  /* Navigate to the stop whenever the step changes. */
  useEffect(() => {
    if (!open) return;
    const target = `${BASE}${STOPS[i].path ? `/${STOPS[i].path}` : ""}`;
    if (location.pathname !== target) navigate(target);
    // location is intentionally not a dependency: we only want to move the
    // page when the STEP changes, otherwise a manual click mid-tour would be
    // yanked back immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, open]);

  useEffect(() => { if (open) setI(0); }, [open]);

  if (!open) return null;

  const stop  = STOPS[i];
  const first = i === 0;

  /* Only reaching the end counts as "seen". Skipping mid-way just snoozes,
     so the offer returns next sign-in — the point is that they eventually
     learn the app, not that we tick a box. */
  function finish(completed = true) {
    if (completed) markTourSeen();
    else snoozeTour();
    onClose?.();
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none px-4 pb-5">
      <div className="pointer-events-auto w-full max-w-[560px] border border-gold-deep/60 bg-bg shadow-2xl">
        {/* Progress */}
        <div className="flex gap-1 px-5 pt-4">
          {STOPS.map((s, n) => (
            <div
              key={s.label + n}
              className={`h-[2px] flex-1 transition ${n <= i ? "bg-gold" : "bg-line"}`}
            />
          ))}
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="ovline text-[9px] text-gold-soft">
              {stop.label} · {i + 1} of {STOPS.length}
            </span>
            <button
              onClick={() => finish(false)}
              className="ovline text-[9px] text-ink-mute hover:text-ink transition"
            >
              Skip ✕
            </button>
          </div>

          <div className="font-display text-lg text-ink tracking-tight leading-snug mb-1.5">
            {stop.title}
          </div>
          <p className="text-[12.5px] text-ink-soft leading-relaxed">{stop.body}</p>

          {stop.tip && (
            <p className="text-[11px] text-ink-mute leading-relaxed mt-2 border-l border-gold-deep/50 pl-2.5">
              {stop.tip}
            </p>
          )}

          <div className="flex items-center gap-2 mt-4">
            {!first && (
              <button
                onClick={() => setI((n) => n - 1)}
                className="ovline text-[9px] border border-line px-3 py-2 text-ink-mute hover:text-ink transition"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (stop.last ? finish(true) : setI((n) => n + 1))}
              className="ovline text-[9px] border border-gold-deep px-4 py-2 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition flex-1"
            >
              {stop.last ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TourInvite — the one-time offer to take the tour.
 *
 * Shown instead of launching straight into it: dropping someone into a
 * six-stop walkthrough the second they log in, when they came to do a job,
 * is how tours get skipped on reflex.
 */
export function TourInvite({ onStart, onDismiss }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(460px,calc(100vw-2.5rem))] border border-gold-deep/60 bg-bg shadow-2xl">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <span className="ovline text-[9px] text-gold-soft">New here?</span>
          <button
            onClick={onDismiss}
            title="Close"
            className="text-ink-mute hover:text-ink leading-none text-sm -mt-1"
          >
            ✕
          </button>
        </div>
        <div className="font-display text-base text-ink tracking-tight mb-1">
          Take a quick look around AzQueue
        </div>
        <p className="text-[12px] text-ink-soft leading-relaxed">
          Six short stops, about three minutes. You'll see what each page is for,
          using your own branch — and you can stop at any point.
        </p>
        <div className="flex items-center gap-2 mt-3.5">
          <button
            onClick={onStart}
            className="ovline text-[9px] border border-gold-deep px-4 py-2 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition flex-1"
          >
            Show me around
          </button>
          <button
            onClick={onDismiss}
            className="ovline text-[9px] border border-line px-3 py-2 text-ink-mute hover:text-ink transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
