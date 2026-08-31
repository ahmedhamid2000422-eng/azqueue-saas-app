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
      "Everyone waiting shows up here, oldest first. There are only four buttons you " +
      "need all day: Call next takes the person at the front, Complete finishes them, " +
      "Return puts someone back in line if they stepped away, and No-show removes them " +
      "if they've gone. That's the whole job.",
    tip:
      "Prefer Return over No-show when you're not sure — someone in the toilet keeps " +
      "their place, and nobody has to argue about it at the counter.",
    ask: ["How busy are we right now?", "How long has the first person been waiting?"],
    why: "Calling people from here is what puts their number on the TV and sends their email. Calling out names by hand skips all of it.",
  },
  {
    path: "display",
    label: "The TV",
    title: "The screen in your waiting room",
    body:
      "Set up the TV from here. It shows who is being served, who is next, your opening " +
      "hours, and it reads each name out loud when you call them. If more than seven " +
      "people are waiting it scrolls through the whole list, so everyone sees themselves.",
    tip: "Open it once on the TV and leave it. It reconnects on its own after a power cut or a sleep.",
    why:
      "People get restless when they can't tell whether they've been forgotten. A screen " +
      "showing their number answers that without anyone having to ask your staff.",
    ask: ["What should the TV show when we're closed?"],
  },
  {
    path: "bookings",
    label: "Bookings",
    title: "Appointments booked in advance",
    body:
      "Anyone who booked a time online appears here. They join the queue automatically " +
      "when they arrive, so you don't have to add them by hand.",
    tip: "Share your booking link and people can reserve a slot instead of waiting.",
    ask: ["How many people booked for today?", "Do people who book actually show up?"],
    why: "Bookings spread the day out. Every person who books instead of walking in is one fewer person standing in your waiting room at 2pm.",
  },
  {
    path: "customers",
    label: "Customers",
    title: "Everyone who has ever come in",
    body:
      "Every walk-in and booking is saved here with how many times they've visited. " +
      "Useful when a returning client calls and you want their history before they arrive.",
    tip: "You can export the whole list to Excel whenever you need it.",
    ask: ["How many people come back a second time?", "How many new people came in this week?"],
    why: "This is your client list, built by itself. No one has to type anything for it to stay current.",
  },
  {
    path: "insights",
    label: "Insights",
    title: "How the business is actually doing",
    body:
      "How long people wait today and this week, how many you serve, when your busy " +
      "hours are, and how many give up and leave. All measured from your own branch — " +
      "nothing is estimated, and anything that can't be measured says so.",
    tip: "Worth a look once a week. The busy-hours chart is the one that usually changes minds about staffing.",
    ask: ["Explain this page in simple words", "Why do people leave without being seen?", "What should I fix first?"],
    why: "Most decisions about staff and hours get made on a hunch. This is the page that tells you whether the hunch is right.",
  },
  {
    path: "intelligence",
    label: "Clients",
    title: "Who your clients are, over the years",
    body:
      "Everyone who has ever come in, with how many visits, how long they usually " +
      "take, and when they were last here. Your history from before AzQueue is in " +
      "here too, added to the new visits rather than kept separate.",
    tip:
      "The four boxes at the top are the ones to act on. “Regulars who stopped coming” " +
      "is a call list — tap it and the names appear below.",
    why:
      "Insights tells you about today. This tells you whether people come back, which " +
      "is the thing that decides whether the business grows.",
    ask: [
      "Which clients should I be calling?",
      "How many people never came back?",
      "Who is due back around now?",
    ],
  },
  {
    path: "schedule",
    label: "Schedule",
    title: "Who is working, and when",
    body:
      "Set your opening hours and mark staff as away or closed. The booking page only " +
      "offers times you're actually open, so nobody books an empty chair.",
    tip: "Prayer pauses are set here too — the queue holds itself automatically.",
    ask: ["Which day of the week is busiest?", "Do I need more staff?"],
    why: "What you set here decides which times the booking page offers. Wrong hours here means people booking when you are closed.",
  },
  {
    path: "settings",
    label: "Settings",
    title: "Your details and preferences",
    body:
      "Your business name, services, how many bookings you take a day, and the link and " +
      "QR code customers scan to join the queue.",
    tip: "Print the QR code and put it at the door — most walk-ins join themselves that way.",
    why: "The QR code is how walk-ins add themselves. Every person who scans it is a person your staff did not have to check in by hand.",
  },
  {
    path: "",
    label: "AI Assist",
    title: "Ask instead of hunting for it",
    body:
      "See the AI Assist button in the bottom-right corner? Tap it and ask a question " +
      "in your own words. It reads your real numbers and answers in plain language — " +
      "and it answers in Arabic if you write in Arabic.",
    tip:
      "Use the Simple / Detail switch at the top of the panel. Simple avoids all the " +
      "technical words; Detail gives the full statistics.",
    ask: [
      "How busy are we right now?",
      "How long are people waiting today?",
      "Do I need more staff?",
      "Explain my Insights page in simple words",
    ],
    /* Honest framing. The assistant does NOT learn from being used — it has no
       memory between conversations. What genuinely improves is the DATA: every
       visit makes the statistics more reliable, which makes the answers better.
       Saying "it learns from you" would be a pleasant lie, and the whole point
       of this feature is that it doesn't tell those. */
    note:
      "It gets more useful over time — not because it learns from you, but because " +
      "every customer you serve adds to the history it reads. The longer you use " +
      "AzQueue, the more certain its answers become.",
  },
  {
    path: "",
    label: "Done",
    title: "That's everything",
    body:
      "You've now seen every part of AzQueue. If you ever want to run through it " +
      "again, click your name at the top right and choose Take the tour.",
    tip: "Nothing here can break anything. Click around — that's the fastest way to learn it.",
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

          {/* Why it's worth caring. Stated separately from what the page does,
              because "here is a list of your customers" and "you will never
              have to type this list" are different sentences and the second
              one is the reason anybody opens the page twice. */}
          {stop.why && (
            <p className="text-[11.5px] text-ink-soft leading-relaxed mt-2.5">
              <span className="ovline text-[8px] text-gold-soft mr-1.5">Why it helps</span>
              {stop.why}
            </p>
          )}

          {stop.tip && (
            <p className="text-[11px] text-ink-mute leading-relaxed mt-2 border-l border-gold-deep/50 pl-2.5">
              {stop.tip}
            </p>
          )}

          {/* What you could ask AI Assist from this page. Concrete examples
              beat any amount of explaining what an assistant "can do". */}
          {stop.ask?.length > 0 && (
            <div className="mt-3">
              <div className="ovline text-[8px] text-ink-mute mb-1.5">
                Try asking AI Assist
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stop.ask.map((q) => (
                  <span
                    key={q}
                    className="text-[10px] border border-line px-2 py-1 text-ink-soft"
                  >
                    “{q}”
                  </span>
                ))}
              </div>
            </div>
          )}

          {stop.note && (
            <p className="text-[10.5px] text-ink-mute leading-relaxed mt-3 italic font-display">
              {stop.note}
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
          A few short stops, about three minutes. You'll see what each page is for
          and why it's worth using, on your own branch — and you can stop any time.
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
