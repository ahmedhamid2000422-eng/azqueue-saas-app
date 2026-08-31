import { useEffect, useState } from "react";
import { postBranchAlert, loadActiveAlert, clearBranchAlert } from "../lib/alerts";
import { loadServiceStats } from "../lib/waitEstimator";

/**
 * QueueNudge — a small suggestion in the corner of the Queue page.
 *
 * WHY THIS EXISTS
 * The Insights page tells you what happened last quarter. That is the wrong
 * timescale for someone standing at a counter. This watches the queue as it
 * actually is, and when something is off, it says so once and offers the one
 * button that fixes it.
 *
 * DESIGN RULES, learned the hard way from the old alert thresholds:
 *
 * 1. Compare against THIS branch's own history, never a fixed number. A
 *    15-minute wait is a crisis at a coffee counter and a normal Tuesday at
 *    a tax office. The trigger is "today is unusual FOR YOU" — busier than
 *    three quarters of this branch's own recorded visits.
 *
 * 2. One suggestion at a time, highest priority only. A list of five
 *    suggestions is a list nobody reads.
 *
 * 3. Dismissable, and it stays dismissed for the rest of the day. Being
 *    nagged about a queue you have already decided to live with is how
 *    staff learn to ignore the whole panel.
 *
 * 4. Never acts on its own. Every suggestion needs a click. Software that
 *    silently messages a business's customers is software nobody trusts.
 */

const DISMISS_KEY = (branchId) =>
  `azq.nudge.dismissed.${branchId}.${new Date().toISOString().slice(0, 10)}`;

/* Wording is deliberately plain and non-alarming — customers see this. */
const BUSY_MESSAGE =
  "We're busier than usual today, so waits are longer than normal. " +
  "Thank you for your patience — we're getting to everyone as fast as we can.";

export default function QueueNudge({ branch, waiting = [], serving = null }) {
  const [p75, setP75]         = useState(null);   // this branch's own "unusual" line
  const [dismissed, setDism]  = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted]   = useState(false);
  const [alertUp, setAlertUp] = useState(false);

  /* What counts as a long wait HERE. Falls back to nothing rather than to a
     guessed default — no threshold is better than a wrong one. */
  useEffect(() => {
    let off = false;
    if (!branch?.id) return;
    loadServiceStats(branch.id)
      .then((s) => { if (!off) setP75(s?.overall?.p75 ?? s?.overall?.median ?? null); })
      .catch(() => {});
    return () => { off = true; };
  }, [branch?.id]);

  useEffect(() => {
    if (!branch?.id) return;
    try { setDism(localStorage.getItem(DISMISS_KEY(branch.id)) === "1"); } catch {}
    loadActiveAlert(branch.id).then((a) => setAlertUp(!!a)).catch(() => {});
  }, [branch?.id]);

  function dismiss() {
    setDism(true);
    try { localStorage.setItem(DISMISS_KEY(branch.id), "1"); } catch {}
  }

  async function postNotice() {
    setPosting(true);
    try {
      // 12 hours, not the default 15 minutes — this is a "today is busy"
      // notice that should sit there until someone decides to take it down.
      await postBranchAlert(branch.id, BUSY_MESSAGE, { minutes: 720, speak: false });
      setPosted(true);
      setAlertUp(true);
    } catch (e) {
      console.error("[QueueNudge] post failed", e);
    } finally {
      setPosting(false);
    }
  }

  async function takeDown() {
    try { await clearBranchAlert(branch.id); setAlertUp(false); setPosted(false); }
    catch (e) { console.error("[QueueNudge] clear failed", e); }
  }

  /* ── Decide whether to say anything ─────────────────────────────── */
  const now = Date.now();
  const longestMin = waiting.length
    ? Math.max(...waiting.map((t) => (now - new Date(t.created_at).getTime()) / 60000))
    : 0;

  let nudge = null;

  // Highest priority: people waiting, nobody serving. Always worth saying,
  // needs no history to be sure about, and is nearly always an oversight.
  if (waiting.length > 0 && !serving) {
    nudge = {
      tone: "warn",
      title: "Nobody is being served",
      body: `${waiting.length} ${waiting.length === 1 ? "person is" : "people are"} waiting and no one has been called. Call the next person when you're ready.`,
    };
  }
  // Otherwise: is today genuinely unusual for this branch?
  else if (p75 && longestMin > p75 * 1.5) {
    nudge = {
      tone: "warn",
      title: "Today is running long",
      body: `Someone has been waiting ${Math.round(longestMin)} minutes — longer than a normal visit here. Put a note on the screen so people know.`,
      action: { label: "Post a notice", run: postNotice },
    };
  }

  if (!branch?.id || dismissed || !nudge) return null;

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="fixed bottom-5 left-5 z-30 w-[320px] max-w-[calc(100vw-2.5rem)] border border-[#c9a86a]/45 bg-bg shadow-xl">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[#e0b96a] text-[12px] leading-none">▲</span>
            <span className="ovline text-[9px] text-gold-soft">Suggestion</span>
          </div>
          <button
            onClick={dismiss}
            title="Hide until tomorrow"
            className="text-ink-mute hover:text-ink leading-none text-xs -mt-0.5"
          >
            ✕
          </button>
        </div>

        <div className="text-[12px] text-ink leading-snug mb-1">{nudge.title}</div>
        <p className="text-[11px] text-ink-mute leading-relaxed">{nudge.body}</p>

        {posted && (
          <p className="text-[10px] text-[#9bbd9b] mt-2 leading-relaxed">
            Notice is now showing on the TV and the customer pages. It stays up
            until you take it down.
          </p>
        )}

        {nudge.action && !posted && !alertUp && (
          <button
            onClick={nudge.action.run}
            disabled={posting}
            className="ovline text-[9px] border border-gold-deep px-3 py-1.5 mt-2.5 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-40 w-full"
          >
            {posting ? "Posting…" : nudge.action.label}
          </button>
        )}

        {(posted || alertUp) && (
          <button
            onClick={takeDown}
            className="ovline text-[9px] border border-line px-3 py-1.5 mt-2 text-ink-mute hover:text-ink transition w-full"
          >
            Take the notice down
          </button>
        )}
      </div>
    </div>
  );
}
