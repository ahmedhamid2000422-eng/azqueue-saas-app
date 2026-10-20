import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * CloseOutPanel — "these are still open. What happened to them?"
 *
 * WHY THIS EXISTS
 * Over 90 days, 237 of 502 tickets — 47% — were closed by a cron job because
 * nobody closed them by hand. Half of those were never even called. The
 * office has no idea those customers are unaccounted for, because the sweep
 * tidies up silently overnight.
 *
 * The pattern is not explained by how busy the day was. 15 October: ten
 * tickets, all swept. 17 October: ten tickets, none swept. Same volume, two
 * days apart. Whatever drives it, a nightly job quietly erasing the question
 * guarantees nobody ever answers it.
 *
 * WHAT THIS IS NOT
 * It is not auto-closing. Nothing here guesses an outcome. A staff member
 * taps what actually happened, and the outcome is recorded as theirs.
 *
 * THE TIMESTAMP COMPROMISE
 * Closing out at 5pm cannot produce an honest service duration — the visit
 * ended hours earlier. So every ticket closed here is marked
 * `timing_source = 'catch_up'`, which keeps it OUT of every duration
 * statistic while counting fully towards outcome coverage.
 *
 * That split is the whole point: the outcome is trustworthy because a person
 * asserted it; the timing is not, and says so.
 */

const OUTCOMES = [
  { key: "served",     label: "Served",       status: "completed", outcome: "done",
    hint: "We saw them" },
  { key: "left",       label: "Left",         status: "cancelled", outcome: null,
    hint: "Gave up waiting" },
  { key: "never_came", label: "Never came",   status: "no_show",   outcome: null,
    hint: "Called, no answer" },
];

export default function CloseOutPanel({ branchId, onDone }) {
  const [open, setOpen]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError]     = useState(null);

  async function load() {
    if (!branchId) return;
    setLoading(true);
    /* Anything still open and more than two hours old. Two hours because a
       genuine long consultation should not appear here mid-visit and make
       staff think something is wrong. */
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error: e } = await supabase
      .from("tickets")
      .select("id, token, customer_name, service_id, status, created_at, called_at")
      .eq("branch_id", branchId)
      .eq("is_test", false)
      .in("status", ["waiting", "serving"])
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true });
    if (e) setError(e.message);
    setOpen(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [branchId]);

  async function close(ticket, choice) {
    setBusyId(ticket.id);
    setError(null);
    const patch = {
      status: choice.status,
      closed_by: "staff",
      closure_reason: "closed_out",
      closed_at: new Date().toISOString(),
      /* Never a live measurement. See the header. */
      timing_source: "catch_up",
      ...(choice.outcome ? { outcome: choice.outcome } : {}),
    };
    /* completed_at only on a real completion — the 0067 constraint rejects
       it otherwise, which is exactly the protection we want. */
    if (choice.status === "completed") {
      patch.completed_at = new Date().toISOString();
    } else {
      patch.expired_at = new Date().toISOString();
    }

    const { error: e } = await supabase.from("tickets").update(patch).eq("id", ticket.id);
    setBusyId(null);
    if (e) { setError(e.message); return; }
    setOpen((prev) => prev.filter((t) => t.id !== ticket.id));
    onDone?.();
  }

  /* Bulk "all served" exists because the alternative is staff not doing it at
     all. It is still an assertion by a person, and still excluded from
     durations — but it is a weaker assertion than tapping each one, so it is
     the secondary action and it says what it is doing. */
  async function closeAllServed() {
    if (!open.length) return;
    setBulkBusy(true);
    setError(null);
    const now = new Date().toISOString();
    const { error: e } = await supabase
      .from("tickets")
      .update({
        status: "completed",
        completed_at: now,
        closed_at: now,
        closed_by: "staff",
        closure_reason: "closed_out_bulk",
        outcome: "done",
        timing_source: "catch_up",
      })
      .in("id", open.map((t) => t.id));
    setBulkBusy(false);
    if (e) { setError(e.message); return; }
    setOpen([]);
    onDone?.();
  }

  if (loading) return null;
  if (!open.length) return null;

  return (
    <div className="mb-5 border border-gold-deep/60 bg-[rgba(201,168,106,0.06)] px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <div className="font-display text-[21px] font-light tracking-tight text-ink">
          {open.length} still open
        </div>
        <button
          onClick={closeAllServed}
          disabled={bulkBusy}
          className="text-[11px] font-medium tracking-[0.1em] uppercase border border-line hover:border-gold-deep text-ink-soft hover:text-ink px-3 py-1.5 transition disabled:opacity-40"
        >
          {bulkBusy ? "Closing…" : "All were served"}
        </button>
      </div>
      <p className="text-[12px] text-ink-mute leading-relaxed mb-4">
        What happened to these? If you leave them, they'll be closed overnight
        with no record of the outcome.
      </p>

      {error && (
        <div className="text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {open.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-2.5 last:border-b-0">
            <span className="text-[13px] text-ink">
              <span className="font-display text-gold-soft mr-2">{t.token}</span>
              {t.customer_name || "Customer"}
              <span className="text-ink-mute text-[11.5px]">
                {" · "}{new Date(t.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                {!t.called_at && " · never called"}
              </span>
            </span>
            <div className="flex gap-1.5 shrink-0">
              {OUTCOMES.map((o) => (
                <button
                  key={o.key}
                  onClick={() => close(t, o)}
                  disabled={busyId === t.id}
                  title={o.hint}
                  className="text-[11px] font-medium tracking-[0.06em] uppercase border border-line hover:border-gold-deep text-ink-soft hover:text-ink px-2.5 py-1.5 transition disabled:opacity-40"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10.5px] text-ink-mute mt-3.5 leading-relaxed">
        These won't count towards wait or service times — they're recorded as
        closed later, not measured live.
      </p>
    </div>
  );
}
