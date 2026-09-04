import { useState } from "react";
import { supabase } from "../lib/supabase";
import { broadcastToQueue } from "../lib/alerts";

/**
 * QueuePauseControl — stop taking people, and keep saying so.
 *
 * WHY IT NAGS
 * The failure this guards against is not pausing. It is pausing and
 * forgetting: a waiting room filling with people who will never be called
 * because a toggle was flipped at lunchtime and nobody remembered. The pause
 * itself is one click; the banner is the feature.
 *
 * So while paused it renders as a permanent, unmissable bar with the word
 * "until you turn it off" in it, and shows how long it has been paused. A
 * pause that has run for two hours should look wrong, because it is.
 *
 * The state lives on the branch, not in the browser — the counter iPad and
 * the back-office laptop have to agree about whether the office is taking
 * people, and a per-device pause would let them disagree.
 */
export default function QueuePauseControl({ branch, onChange, waiting = [] }) {
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState(null);   // { texted, emailed } after a send
  const [telling, setTelling] = useState(false);
  const pausedAt = branch?.queue_paused_at ? new Date(branch.queue_paused_at) : null;

  async function set(paused) {
    if (!branch?.id) return;
    setBusy(true);
    await supabase
      .from("branches")
      .update({ queue_paused_at: paused ? new Date().toISOString() : null })
      .eq("id", branch.id);
    setBusy(false);
    if (!paused) setTold(null);   // resuming clears the notice state
    onChange?.();
  }

  /* TELLING PEOPLE IS A SEPARATE, DELIBERATE PRESS.
     It would be easy to fire this automatically the moment the queue pauses.
     That would be wrong. A pause flipped by accident, or for ninety seconds
     while someone finds a document, would text everybody in the room — a
     real cost per message, and the kind of notification that teaches people
     to ignore the next one.

     So pausing is instant and silent; telling the room is a second choice,
     made once staff know this pause is long enough to be worth a message. */
  async function tellEveryone() {
    if (!waiting.length) return;
    setTelling(true);
    const res = await broadcastToQueue(
      waiting,
      "We've paused the queue for a short while. Your place is kept - we'll call you as soon as we start again.",
      branch?.name ?? "AzQueue",
    ).catch(() => null);
    setTelling(false);
    if (res) setTold(res);
  }

  if (!pausedAt) {
    return (
      <button
        onClick={() => set(true)}
        disabled={busy}
        className="text-[11.5px] border border-line px-3 py-1.5 text-ink-mute hover:text-ink hover:border-gold-deep transition disabled:opacity-40"
        title="Stop taking new people until you turn this off"
      >
        Pause the queue
      </button>
    );
  }

  const mins = Math.max(0, Math.round((Date.now() - pausedAt.getTime()) / 60000));
  const forHow = mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`;

  return (
    <div className="border border-[#a4614f]/60 bg-[rgba(164,97,79,0.08)] px-5 py-3.5 flex items-start justify-between gap-4">
      <div>
        <div className="text-[13px] text-ink leading-snug">
          The queue is paused — and stays paused until you turn it off.
        </div>
        <div className="text-[11.5px] text-ink-soft mt-1 leading-relaxed">
          Paused {forHow} ago. New customers can still check in, but nobody is
          being called. Anyone already waiting is still waiting.
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Only offered when there is actually somebody to tell, and only
            once — a second press would send the same message twice. */}
        {waiting.length > 0 && !told && (
          <button
            onClick={tellEveryone}
            disabled={telling}
            className="text-[12px] border border-line px-4 py-2 text-ink-mute hover:text-ink hover:border-gold-deep transition disabled:opacity-40"
            title="Send one message to everyone currently waiting"
          >
            {telling ? "Sending…" : `Tell the ${waiting.length} waiting`}
          </button>
        )}
        {told && (
          <span className="text-[11px] text-[#9bbd9b]">
            Told {told.texted + told.emailed} of {told.total} ✓
          </span>
        )}
        <button
          onClick={() => set(false)}
          disabled={busy}
          className="text-[12px] border border-gold-deep px-4 py-2 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-40"
        >
          {busy ? "…" : "Resume"}
        </button>
      </div>
    </div>
  );
}
