import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Card, { CardHeader } from "./Card";

/**
 * ArrivalChannels — how people are actually getting into the queue.
 *
 * WHY THIS RATHER THAN THE CROSS-PLATFORM CARD
 * The existing platform card reports WhatsApp conversations and Google
 * Analytics sessions. WhatsApp isn't live, so it reads zero, and GA4 counts
 * website visitors — people who looked at a page, most of whom never set foot
 * in the office. Neither changes a decision, which is rule 2.
 *
 * This uses `tickets.source`, which is already written on every ticket and
 * describes real customers of this business. It answers a question the owner
 * actually has: are people booking ahead, or is everyone still arriving
 * unannounced? That share is the single number the whole distribution problem
 * turns on — 62% of visits landing between 10am and 3pm is what creates
 * 90-minute waits at an office with twice the capacity it needs.
 *
 * WINDOW
 * 30 days, not the selected day. A single day at this office is around 18
 * visits, and an arrival mix computed from 18 tickets swings wildly for
 * reasons that have nothing to do with behaviour. This is a trend question,
 * so it gets a trend-sized window.
 */

/* Below this the mix is noise. Rule 3: silence beats a guess. */
const MIN_TICKETS = 30;
const DAYS = 30;

/* "walk" is kept as its own row rather than merged into kiosk or QR. Every
   ticket before the channels were split carries it, and quietly folding
   history into one of the new buckets would invent a fact — the honest
   statement is that those visits were walk-ins of unknown route. It empties
   itself as older tickets fall outside the window. */
const LABELS = {
  book:       "Booked ahead",
  kiosk:      "Counter iPad",
  own_device: "Their own phone",
  walk:       "Walked in (route not recorded)",
};

export default function ArrivalChannels({ branchId }) {
  const [rows,  setRows]  = useState(null);
  const [busy,  setBusy]  = useState(true);

  useEffect(() => {
    let off = false;
    if (!branchId) return;
    setBusy(true);

    (async () => {
      const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("tickets")
        .select("source")
        .eq("branch_id", branchId)
        .eq("is_test", false)
        .gte("created_at", since);

      if (off) return;
      if (error) { setRows(null); setBusy(false); return; }

      const counts = new Map();
      for (const t of data ?? []) {
        const key = t.source && LABELS[t.source] ? t.source : "other";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      const total = data?.length ?? 0;
      setRows(
        total < MIN_TICKETS
          ? { total, thin: true, items: [] }
          : {
              total,
              thin: false,
              items: [...counts.entries()]
                .map(([k, n]) => ({
                  key:   k,
                  label: LABELS[k] ?? "Not recorded",
                  n,
                  share: n / total,
                }))
                .sort((a, b) => b.n - a.n),
            }
      );
      setBusy(false);
    })();

    return () => { off = true; };
  }, [branchId]);

  if (busy) {
    return (
      <Card luxe>
        <CardHeader title="How people arrive" subtitle={`Last ${DAYS} days`} />
        <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
      </Card>
    );
  }

  if (!rows) return null;

  /* Not enough history is a fact worth stating plainly — it tells the owner
     the panel is working and will fill, rather than looking broken. */
  if (rows.thin) {
    return (
      <Card luxe>
        <CardHeader title="How people arrive" subtitle={`Last ${DAYS} days`} />
        <div className="px-5 py-8 text-center text-ink-mute text-[11px] leading-relaxed">
          Not enough visits yet — this needs {MIN_TICKETS} in the last {DAYS} days
          and there are {rows.total}.
        </div>
      </Card>
    );
  }

  /* One channel is not a mix. A bar sitting at 100% looks like a chart and
     carries no information — and worse, it implies a comparison that doesn't
     exist. State the fact in a sentence instead, because the fact itself is
     the finding: at Az Tax, 117 visits with not one booking means the booking
     page may as well not exist. That is worth reading, a 100% bar is not. */
  if (rows.items.length < 2) {
    const only = rows.items[0];
    return (
      <Card luxe>
        <CardHeader
          title="How people arrive"
          subtitle={`Last ${DAYS} days · ${rows.total.toLocaleString()} visits`}
        />
        <div className="px-5 py-6 text-[11.5px] text-ink leading-relaxed">
          Every one of your last {rows.total.toLocaleString()} visits was{" "}
          {only?.key === "book" ? "booked ahead" : "a walk-in"}.
          {only?.key !== "book" && (
            <span className="block text-ink-mute mt-1.5">
              Nobody has used the booking page. Until some visits are booked,
              there is no way to move arrivals out of your busiest hours —
              worth checking that the booking link is somewhere people
              actually see it.
            </span>
          )}
        </div>
      </Card>
    );
  }

  const booked = rows.items.find((i) => i.key === "book");

  return (
    <Card luxe>
      <CardHeader
        title="How people arrive"
        subtitle={`Last ${DAYS} days · ${rows.total.toLocaleString()} visits`}
      />

      <div className="px-5 py-4 space-y-3">
        {rows.items.map((i) => (
          <div key={i.key} className="flex items-center gap-3">
            <div className="w-28 text-[11px] text-ink-soft shrink-0">{i.label}</div>
            <div className="flex-1 h-[6px] bg-line/60 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gold-soft/60"
                style={{ width: `${Math.max(2, i.share * 100)}%` }}
              />
            </div>
            <div className="w-20 text-right text-[11px] text-ink shrink-0">
              {Math.round(i.share * 100)}%
              <span className="text-ink-mute"> · {i.n}</span>
            </div>
          </div>
        ))}
      </div>

      {/* One sentence of meaning, stated as arithmetic rather than advice.
          The number is only worth showing because it is the lever. */}
      {booked && (
        <div className="px-5 pb-4 text-[11px] text-ink-mute leading-relaxed">
          {Math.round(booked.share * 100)}% booked before arriving. Every visit
          booked ahead is one that can be placed in a quieter hour instead of
          landing in the middle of the day.
        </div>
      )}
    </Card>
  );
}
