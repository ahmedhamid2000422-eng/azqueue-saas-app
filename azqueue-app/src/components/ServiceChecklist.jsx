import { useState } from "react";
import { getEffectiveChecklist } from "../lib/checklists";
import { sendChecklistEmail } from "../lib/notifyEmail";

/**
 * ServiceChecklist — "here's what you'll need", shown BEFORE joining the queue.
 *
 * WHY THE TIMING IS THE WHOLE POINT
 * Walk-ins don't know what to bring until someone tells them. Today that
 * happens at the counter — after a ninety-minute wait — and the entire visit
 * is wasted for both sides. The customer goes home, comes back another day,
 * and occupies a second slot in a queue that is already the business's biggest
 * problem.
 *
 * Shown at check-in instead, that ninety-minute wait stops being the problem
 * and becomes the solution. Someone missing a document at 11am can drive home,
 * ring their spouse, or come back in the afternoon — and still be seen today.
 *
 * (There was already a checklist message in the codebase, but it sent AFTER
 * joining and only when a phone number was present. Since SMS was switched
 * off the phone field is hidden, so it had quietly stopped reaching anyone.)
 *
 * It never blocks. "I have these" is the primary action and the queue is
 * always joinable — this is information, not a gate.
 */
export default function ServiceChecklist({ branch, serviceName, quietPhrase, email }) {
  const [dismissed, setDismissed] = useState(false);
  const [fetching, setFetching]   = useState(false);   // "I need to get something"
  const [mailTo, setMailTo]       = useState(email ?? "");
  const [sent, setSent]           = useState(false);
  const [sending, setSending]     = useState(false);

  if (!branch?.id || !serviceName || dismissed) return null;

  const checklist = getEffectiveChecklist(branch.id, serviceName);
  const known = !!checklist?.needsChecklist && checklist.items?.length > 0;

  /* No checklist for this service — ask the general question anyway.
     Silence here is the expensive option: someone who walks in without their
     paperwork and finds out ninety minutes later has wasted the visit for
     both sides. A vague prompt they can answer beats a precise one we don't
     have. And "ask us" is always a safe answer, because staff are right
     there and a thirty-second question at the desk is far cheaper than a
     wasted appointment. */

  async function emailList() {
    const to = mailTo.trim();
    if (!to) return;
    setSending(true);
    try {
      await sendChecklistEmail({
        email: to,
        serviceName,
        items: checklist.items,
        reminder: checklist.reminder ?? null,
        branchName: branch.name,
        quietPhrase: quietPhrase ?? null,
      });
      setSent(true);
    } catch (e) {
      console.error("[ServiceChecklist] email failed", e);
      setSent(true);   // don't trap them in a failed state at a kiosk
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border border-gold-deep/50 bg-[rgba(201,168,106,0.04)] p-4 mb-5">
      <div className="ovline text-[9px] text-gold-soft mb-2">Before you join</div>
      {known ? (
        <>
          <div className="text-[13px] text-ink leading-snug mb-2.5">
            For {serviceName.toLowerCase()}, please have these with you:
          </div>

          <ul className="mb-3">
            {checklist.items.map((item) => (
              <li key={item} className="flex gap-2 text-[12.5px] text-ink-soft leading-relaxed mb-1">
                <span className="text-gold-soft shrink-0">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {checklist.reminder && (
            <p className="text-[11px] text-ink-mute leading-relaxed mb-3 border-l border-gold-deep/50 pl-2.5">
              {checklist.reminder}
            </p>
          )}
        </>
      ) : (
        <div className="text-[13px] text-ink leading-snug mb-3">
          Do you have your paperwork with you?
          <div className="text-[11.5px] text-ink-mute mt-1.5 leading-relaxed">
            Most visits need photo ID and any documents about your case. If
            you're not sure what's needed, ask at the desk before you join —
            it takes a moment and saves a wasted wait.
          </div>
        </div>
      )}

      {/* ── Missing something ─────────────────────────────────────── */}
      {fetching ? (
        sent ? (
          <div className="text-[12px] text-ink-soft leading-relaxed">
            Sent — the list is in your inbox.
            {quietPhrase && <> We're usually quieter {quietPhrase}, so that's a good time to come back.</>}
            <div className="text-[11px] text-ink-mute mt-1.5">
              You're welcome to join the queue anyway if you'd rather wait.
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[12px] text-ink-soft leading-relaxed mb-2.5">
              No problem — we'll email the list so you have it.
              {quietPhrase && <> We're usually quieter {quietPhrase} if you can come back then.</>}
            </p>
            <div className="flex gap-2">
              <input
                value={mailTo}
                onChange={(e) => setMailTo(e.target.value)}
                placeholder="you@example.com"
                inputMode="email"
                className="flex-1 bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-mute"
              />
              <button
                type="button"
                onClick={emailList}
                disabled={sending || !mailTo.trim()}
                className="ovline text-[10px] border border-gold-deep px-3 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send it"}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ovline text-[10px] border border-gold-deep px-3 py-2 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition"
          >
            {known ? "I have these" : "Yes, I have it"}
          </button>
          <button
            type="button"
            onClick={() => (known ? setFetching(true) : setDismissed(true))}
            className="ovline text-[10px] border border-line px-3 py-2 text-ink-mute hover:text-ink transition"
          >
            {known ? "I need to get something" : "Not sure — I'll ask"}
          </button>
        </div>
      )}
    </div>
  );
}
