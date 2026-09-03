import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * InProgressPanel — everyone currently with a member of staff.
 *
 * WHY
 * The owner reported forgetting people mid-visit, and the data agreed: a
 * ticket sat in "serving" for 45 hours before anyone noticed, and it took
 * someone reading the database from another continent to spot it.
 *
 * The waiting list answers "who is next". Nothing answered "who is with
 * someone right now", so a person taken to a desk left the screen entirely.
 * They were the most likely to be forgotten, because from the queue's point
 * of view they had already been dealt with.
 *
 * COLLAPSIBLE, AND OPEN BY DEFAULT
 * Collapsible because on a busy day it is one line per counter and the queue
 * below matters more. Open by default because the whole point is that these
 * people are otherwise invisible, and a panel that starts closed is a panel
 * that stays closed.
 */

/* Amber past this. Not an alarm — a long visit is normal here; the median is
   half an hour and immigration cases run much longer. This marks "worth a
   glance", not "something is wrong". */
const LONG_MINUTES = 45;

export default function InProgressPanel({ branchId, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(true);
  const [now, setNow]   = useState(Date.now());

  useEffect(() => {
    let off = false;
    if (!branchId) return;

    (async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, token, customer_name, called_at, detail, staff_id")
        .eq("branch_id", branchId)
        .eq("is_test", false)
        .eq("status", "serving")
        .order("called_at", { ascending: true });
      if (!off) setRows(data ?? []);
    })();

    return () => { off = true; };
  }, [branchId, refreshKey]);

  /* Ticking clock so the durations stay honest without a refetch. */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!rows.length) return null;

  const mins = (iso) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  const fmt  = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`);

  return (
    <div className="border border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[rgba(201,168,106,0.03)] transition"
      >
        <div>
          <div className="text-[13px] text-ink">
            With someone now
            <span className="text-ink-mute"> · {rows.length}</span>
          </div>
          {!open && (
            <div className="text-[11px] text-ink-mute mt-0.5 truncate">
              {rows.map((t) => (t.customer_name || t.token)).join(", ")}
            </div>
          )}
        </div>
        <span className="text-[11px] text-ink-mute shrink-0">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="divide-y divide-line border-t border-line">
          {rows.map((t) => {
            const m = t.called_at ? mins(t.called_at) : null;
            const long = m != null && m >= LONG_MINUTES;
            return (
              <div key={t.id} className="px-5 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-ink truncate">
                    {t.customer_name || t.token}
                  </div>
                  {t.detail && (
                    <div className="text-[11px] text-ink-mute mt-0.5 truncate">{t.detail}</div>
                  )}
                </div>
                <div className={`text-[11.5px] shrink-0 ${long ? "text-[#d49185]" : "text-ink-mute"}`}>
                  {m == null ? "—" : fmt(m)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
