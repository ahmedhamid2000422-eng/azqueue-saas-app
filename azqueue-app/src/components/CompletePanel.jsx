import { useState } from "react";
import { CATEGORIES } from "../lib/backQueue";

/**
 * CompletePanel — one question when a visit ends.
 *
 * WHY IT EXISTS
 * Completing used to be a side effect of pressing Call next, which meant two
 * things went wrong. The last customer of the day was never completed at all
 * — their visit recorded as lasting overnight, quietly poisoning the
 * service-time median everything else depends on. And nothing anywhere
 * recorded WHY a visit ended, so "we saw them" and "they have to come back
 * with a document" looked identical in the data.
 *
 * DESIGN RULES
 * 1. Four options, one tap, no free text. Staff answer this dozens of times a
 *    day; a longer list gets clicked past without reading and the data
 *    becomes worse than none.
 * 2. "Done" is default and visually primary. A normal day should be one
 *    button.
 * 3. Only the handoff asks a second question, because it's the only one that
 *    changes what happens next.
 * 4. Labels are the office's own words. "Drop-off / waiting" is what staff
 *    already say; a label people recognise gets pressed correctly, an
 *    invented one gets guessed at.
 */

const OUTCOMES = [
  {
    key: "done",
    label: "Done",
    hint: "Finished, nothing outstanding",
    primary: true,
  },
  {
    key: "needs_docs",
    label: "Needs documents",
    hint: "Can't continue until they bring something",
  },
  {
    key: "handoff",
    label: "Drop-off / waiting",
    hint: "We keep the paperwork, they go home",
  },
  {
    key: "passed_on",
    label: "Passed to someone else",
    hint: "Another person is picking it up",
  },
];

export default function CompletePanel({ ticket, busy, onResolve, onCancel }) {
  const [outcome, setOutcome] = useState(null);

  if (!ticket) return null;

  /* The handoff is the only branch that needs more information. */
  if (outcome === "handoff") {
    return (
      <Shell ticket={ticket} onCancel={() => setOutcome(null)} cancelLabel="Back">
        <div className="text-[12px] text-ink-soft leading-relaxed mb-3">
          What kind of work is it? They'll get an email when it's ready to
          collect.
        </div>
        <div className="space-y-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              disabled={busy}
              onClick={() => onResolve({ outcome: "handoff", category: c.key })}
              className="w-full text-left border border-line hover:border-gold-deep px-4 py-3 transition disabled:opacity-40"
            >
              <div className="text-[13px] text-ink">{c.label}</div>
              <div className="text-[10.5px] text-ink-mute mt-0.5">{c.hint}</div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell ticket={ticket} onCancel={onCancel} cancelLabel="Cancel">
      <div className="text-[12px] text-ink-soft leading-relaxed mb-3">
        How did this end?
      </div>
      <div className="space-y-2">
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            disabled={busy}
            onClick={() =>
              o.key === "handoff" ? setOutcome("handoff") : onResolve({ outcome: o.key })
            }
            className={`w-full text-left px-4 py-3 border transition disabled:opacity-40 ${
              o.primary
                ? "border-gold-deep bg-[rgba(201,168,106,0.06)] hover:bg-[rgba(201,168,106,0.12)]"
                : "border-line hover:border-gold-deep/60"
            }`}
          >
            <div className={`text-[13px] ${o.primary ? "text-gold-soft" : "text-ink"}`}>
              {o.label}
            </div>
            <div className="text-[10.5px] text-ink-mute mt-0.5">{o.hint}</div>
          </button>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ ticket, children, onCancel, cancelLabel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60">
      <div className="w-full max-w-sm border border-gold-deep/50 bg-bg shadow-2xl">
        <div className="px-5 py-3.5 border-b border-gold-deep/25">
          <div className="ovline text-[9px] text-gold-soft mb-1">Finishing</div>
          <div className="font-display text-xl text-ink tracking-tight leading-none">
            {ticket.token}
          </div>
          {ticket.customer_name && (
            <div className="text-[11px] text-ink-mute mt-1">{ticket.customer_name}</div>
          )}
        </div>

        <div className="px-5 py-4">{children}</div>

        <div className="px-5 py-3 border-t border-line">
          <button
            onClick={onCancel}
            className="ovline text-[9px] text-ink-mute hover:text-ink transition"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
