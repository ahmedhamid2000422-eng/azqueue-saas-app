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

  /* GOOD DAY OR BAD DAY, NOT A CHART.
     The owner said his father would not understand this, and he was right.
     A row of thin bars with "1h 28m" beside them asks the reader to hold a
     scale in their head, compare seven bars, and decide what counts as bad.
     Nobody does that between customers.

     So each day says what kind of day it was, in words, with a colour. The
     threshold is the measured baseline: clean days at this office run
     18–47 minutes, so under 30 is a good day, under an hour is a normal one,
     and past that something happened. Those numbers come from
     docs/baseline-2026-09.md, not from a guess. */
  const verdict = (min) => {
    if (min == null) return { word: "Too few visits", tone: "text-ink-mute", dot: "#4a4a46" };
    if (min <= 30)   return { word: "Good day",       tone: "text-[#9bbd9b]", dot: "#7fa37f" };
    if (min <= 60)   return { word: "Normal",         tone: "text-gold-soft", dot: "#c9a86a" };
    return { word: "Slow day", tone: "text-[#d49185]", dot: "#a4614f" };
  };

  const human = (min) =>
    min == null ? "" :
    min >= 60 ? `about ${Math.round(min / 60)} hour${min >= 90 ? "s" : ""} of waiting`
              : `about ${Math.round(min)} minutes of waiting`;

  return (
    <Card luxe>
      <CardHeader
        title="Your last two weeks"
        subtitle="How long a typical person waited each day"
      />

      <div className="divide-y divide-line">
        {days.map((d) => {
          const v = verdict(d.wait);
          return (
            <div key={d.date} className="px-5 py-3.5 flex items-center gap-4">
              <span className="pip shrink-0" style={{ background: v.dot }} />
              <div className="w-28 shrink-0 text-[12px] text-ink-soft">{label(d.date)}</div>
              <div className="min-w-0 flex-1">
                <div className={`text-[13px] ${v.tone}`}>{v.word}</div>
                <div className="text-[11px] text-ink-mute mt-0.5">
                  {d.arrivals} {d.arrivals === 1 ? "person" : "people"}
                  {d.wait != null && ` · ${human(d.wait)}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3.5 text-[11px] text-ink-mute leading-relaxed border-t border-line">
        A slow day usually means the queue was tidied up at closing time rather
        than worked through as people arrived — not that anyone was slow. Days
        with only one or two visits are left blank because a single person is
        not a pattern.
      </div>
    </Card>
  );
}
