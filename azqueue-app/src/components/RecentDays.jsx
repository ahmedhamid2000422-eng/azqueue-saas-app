import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Card, { CardHeader } from "./Card";

/**
 * RecentDays — the last two weeks, one line per day.
 *
 * WHY A DAY LIST RATHER THAN AN AVERAGE
 * Pooling every visit gave a typical wait of 62 minutes. Read day by day the
 * same data says 18 minutes on one day and 209 on another. The pooled figure
 * describes no day that ever happened, and it hides the only thing worth
 * knowing: some days go well and nobody knows why.
 *
 * Medians, not averages, for the reason the whole product uses medians — one
 * person forgotten for an afternoon moves an average and doesn't move a
 * median. What the owner wants is what a normal customer experienced.
 *
 * The quiet second purpose: a day worked live and a day tidied up afterwards
 * look completely different here. Seeing "3 hr" next to a day he remembers as
 * ordinary is the clearest possible explanation of why pressing Call next and
 * Complete as it happens matters — better than any amount of training.
 */

const DAYS = 14;
/* Fewer visits than this and a median is noise. Shown as a count only. */
const MIN_FOR_MEDIAN = 4;

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function RecentDays({ branchId, timezone }) {
  const [days, setDays] = useState(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let off = false;
    if (!branchId) return;
    setBusy(true);

    (async () => {
      const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("tickets")
        .select("created_at, called_at, status")
        .eq("branch_id", branchId)
        .eq("is_test", false)
        .gte("created_at", since);

      if (off) return;
      if (error) { setDays(null); setBusy(false); return; }

      /* Bucket by the BRANCH's calendar day, not the viewer's. The owner's
         son reads this from Malaysia, fourteen hours ahead — bucketing by the
         browser's date would split every Denver day across two rows. */
      const tz = timezone || "UTC";
      const buckets = new Map();

      for (const t of data ?? []) {
        const key = new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: tz });
        if (!buckets.has(key)) buckets.set(key, { arrivals: 0, waits: [], served: 0 });
        const b = buckets.get(key);
        b.arrivals += 1;
        if (t.status === "completed") b.served += 1;
        if (t.called_at) {
          const mins = (new Date(t.called_at) - new Date(t.created_at)) / 60000;
          if (mins >= 0 && mins < 720) b.waits.push(mins);
        }
      }

      setDays(
        [...buckets.entries()]
          .map(([date, b]) => ({
            date,
            arrivals: b.arrivals,
            served:   b.served,
            wait:     b.waits.length >= MIN_FOR_MEDIAN ? median(b.waits) : null,
          }))
          .sort((a, b) => (a.date < b.date ? 1 : -1))
      );
      setBusy(false);
    })();

    return () => { off = true; };
  }, [branchId, timezone]);

  if (busy || !days) {
    return (
      <Card luxe>
        <CardHeader title="Your last two weeks" subtitle="One line per day" />
        <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
      </Card>
    );
  }

  if (!days.length) {
    return (
      <Card luxe>
        <CardHeader title="Your last two weeks" subtitle="One line per day" />
        <div className="px-5 py-8 text-center text-ink-mute text-[11px]">
          No visits recorded in the last {DAYS} days.
        </div>
      </Card>
    );
  }

  const worst = Math.max(...days.map((d) => d.wait ?? 0), 1);

  const label = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short", day: "numeric", month: "short",
    });

  return (
    <Card luxe>
      <CardHeader
        title="Your last two weeks"
        subtitle="Typical wait each day — the middle customer, not the average"
      />

      <div className="px-5 py-4 space-y-2">
        {days.map((d) => (
          <div key={d.date} className="flex items-center gap-3">
            <div className="w-24 text-[11px] text-ink-soft shrink-0">{label(d.date)}</div>

            <div className="w-16 text-[11px] text-ink-mute shrink-0">
              {d.arrivals} {d.arrivals === 1 ? "person" : "people"}
            </div>

            <div className="flex-1 h-[6px] bg-line/60 relative overflow-hidden">
              {d.wait != null && (
                <div
                  /* Red past an hour. Not a judgement of the staff — usually
                     it means the day was written up afterwards rather than
                     worked live, and that is exactly what this should surface. */
                  className={`absolute inset-y-0 left-0 ${d.wait > 60 ? "bg-[#a4614f]/70" : "bg-gold-soft/60"}`}
                  style={{ width: `${Math.max(2, (d.wait / worst) * 100)}%` }}
                />
              )}
            </div>

            <div className="w-20 text-right text-[11px] shrink-0">
              {d.wait == null ? (
                <span className="text-ink-mute">—</span>
              ) : (
                <span className={d.wait > 60 ? "text-[#d49185]" : "text-ink"}>
                  {d.wait >= 60
                    ? `${Math.floor(d.wait / 60)}h ${Math.round(d.wait % 60)}m`
                    : `${Math.round(d.wait)} min`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-4 text-[10.5px] text-ink-mute leading-relaxed">
        A dash means too few visits that day to say anything useful. Days that
        look far worse than the rest are usually days the queue was tidied up
        at closing time rather than worked through as people arrived — the
        wait shown is measured from check-in to when Call next was pressed.
      </div>
    </Card>
  );
}
