import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import { SEGMENTS, TIER_ORDER, tierFor, segmentCounts, clientVitals } from "../../lib/clientSegments";

/**
 * ClientIntelligence — your client base, built from your own records.
 *
 * HISTORY, worth knowing before changing this file:
 * This page previously fetched a static file, /aztax-clients.json, that was
 * committed into public/. Two things were wrong with that:
 *
 *   1. Anything in public/ is served to the open internet with no auth. That
 *      file held 9,308 real client names and phone numbers, downloadable by
 *      anyone who guessed the URL. For a tax and immigration practice, that
 *      is about as sensitive as a customer list gets.
 *   2. The filename was hardcoded, so every branch on AzQueue would have been
 *      shown the same firm's clients.
 *
 * It now reads `customers` and `tickets` for the CURRENT branch through the
 * normal Supabase client, so row-level security applies and each business
 * sees only its own people. Please don't reintroduce a bundled data file —
 * if a large history needs importing, it belongs in the database.
 *
 * All figures below are counted, not modelled. Nothing here is an estimate.
 */

/* Loyalty tiers. These are BUSINESS RULES chosen for readability, not
   findings from the data — a "VIP" is anyone with 10+ recorded visits, which
   is a definition, not a discovery. Kept explicit so nobody mistakes the
   labels for analysis. */
const TIER_META = {
  VIP:       { color: "#c8a84b", bg: "rgba(200,168,75,0.12)",  border: "rgba(200,168,75,0.35)", label: "VIP ★",     min: 10 },
  Loyal:     { color: "#9b7bff", bg: "rgba(155,123,255,0.10)", border: "rgba(155,123,255,0.3)", label: "Loyal",     min: 5  },
  Regular:   { color: "#4caf79", bg: "rgba(76,175,121,0.10)",  border: "rgba(76,175,121,0.3)",  label: "Regular",   min: 3  },
  Returning: { color: "#5b8fb9", bg: "rgba(91,143,185,0.10)",  border: "rgba(91,143,185,0.3)",  label: "Returning", min: 2  },
  New:       { color: "#666",    bg: "rgba(102,102,102,0.08)", border: "rgba(102,102,102,0.2)", label: "New",       min: 1  },
};


const DAY_LABELS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* A weekday with almost no trading isn't a quiet day, it's a closed one.
   Showing "Sunday is 0.02% of visits" invites a conclusion about Sundays
   that the data cannot support, so days below this are marked as closed
   rather than compared. */
const MIN_FOR_DAY_COMPARISON = 20;


export default function ClientIntelligence() {
  const { branch } = useBranch();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState("");
  const [tier, setTier]       = useState("all");
  const [segment, setSegment] = useState(null);   // one of SEGMENTS[].key
  const [page, setPage]       = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    let cancelled = false;
    if (!branch?.id) return;
    setLoading(true); setError(null); setPage(0);

    (async () => {
      /* Tickets carry the visit history; customers carry the identity. Both
         are branch-scoped and behind RLS. */
      const [{ data: tickets, error: tErr }, { data: customers, error: cErr }, { data: summary }] =
        await Promise.all([
          supabase.from("tickets")
            .select("id, customer_id, customer_name, customer_phone, created_at, started_at, called_at, completed_at, status")
            .eq("branch_id", branch.id)
            .limit(50_000),
          supabase.from("customers")
            .select("id, display_name, phone, created_at, last_seen_at, imported_visits, first_seen_at, import_source")
            .eq("branch_id", branch.id)
            .limit(50_000),
          /* Aggregates from a previous system, where the individual visits
             don't exist as rows to count. Absent for branches that started
             on AzQueue — the page works fine without it. */
          supabase.from("branch_history_summary")
            .select("source, total_visits, unique_people, hours, days, months, range_from, range_to")
            .eq("branch_id", branch.id)
            .maybeSingle(),
        ]);

      if (cancelled) return;
      if (tErr || cErr) { setError((tErr ?? cErr).message); setLoading(false); return; }

      const rows = tickets ?? [];

      /* Group visits per person. Prefer customer_id; fall back to phone, then
         name, so walk-ins recorded before the customers table existed still
         collapse into one person instead of inflating the client count. */
      const byKey = new Map();
      for (const t of rows) {
        const key = t.customer_id ?? t.customer_phone ?? t.customer_name;
        if (!key) continue;
        const at = new Date(t.created_at);
        const cur = byKey.get(key);
        if (cur) {
          cur.v += 1;
          if (at < cur.f) cur.f = at;
          if (at > cur.l) cur.l = at;
        } else {
          byKey.set(key, { key, n: t.customer_name ?? "—", p: t.customer_phone ?? "", v: 1, f: at, l: at, mins: [] });
        }

        /* How long the visit actually took, in minutes. Only AzQueue visits
           have this — the start and end of a visit weren't recorded in the
           imported history, so a client's average length is based on the
           visits since the move, and only those. Anything over 8 hours is
           dropped: that's a ticket someone forgot to close, not a visit. */
        const rec = byKey.get(key);
        const from = t.started_at ?? t.called_at;
        if (from && t.completed_at) {
          const m = (new Date(t.completed_at) - new Date(from)) / 60000;
          if (m > 0 && m < 480) rec.mins.push(m);
        }
      }

      /* Fill in names for anyone matched by customer_id. */
      const custById = new Map((customers ?? []).map((c) => [c.id, c]));
      for (const rec of byKey.values()) {
        const c = custById.get(rec.key);
        if (c) {
          rec.n = c.display_name ?? rec.n;
          rec.p = c.phone ?? rec.p;
        }
      }

      /* ── Fold in imported history ──────────────────────────────────
         Someone with 9 visits on the old system who came in again last week
         should read as 10, not as two separate people. Matching is on
         normalised phone, which is the only field typed consistently across
         two systems — names get spelled differently every visit. */
      const norm = (p) => (p ?? "").replace(/[^\d+]/g, "");
      const byPhone = new Map();
      for (const rec of byKey.values()) if (norm(rec.p)) byPhone.set(norm(rec.p), rec);

      let importedTotal = 0;
      for (const c of customers ?? []) {
        const prior = c.imported_visits ?? 0;
        if (!prior) continue;
        importedTotal += prior;

        const key = norm(c.phone);
        const live = key ? byPhone.get(key) : null;
        const firstSeen = c.first_seen_at ? new Date(c.first_seen_at) : null;

        if (live) {
          live.v += prior;                                   // one person, two systems
          live.prior = prior;
          if (firstSeen && firstSeen < live.f) live.f = firstSeen;
        } else {
          // Known only from the old system — hasn't been back since the move.
          const last = c.last_seen_at ? new Date(c.last_seen_at) : firstSeen;
          byKey.set(`imp:${c.id}`, {
            key: `imp:${c.id}`,
            n: c.display_name ?? "—",
            p: c.phone ?? "",
            v: prior,
            prior,
            f: firstSeen ?? last,
            l: last,
          });
        }
      }

      for (const rec of byKey.values()) {
        rec.t = tierFor(rec.v);
        /* Median, not mean: a single 3-hour appointment shouldn't redefine
           what a normal visit with this client looks like. */
        if (rec.mins?.length) {
          const sorted = [...rec.mins].sort((a, b) => a - b);
          rec.medMins = sorted[Math.floor(sorted.length / 2)];
          rec.timedVisits = sorted.length;
        }
      }

      const people = [...byKey.values()].sort((a, b) => b.v - a.v || b.l - a.l);

      /* Distributions — plain counts of what happened. */
      const hourCounts = new Array(24).fill(0);
      const dayCounts  = new Array(7).fill(0);
      const monthMap   = new Map();
      for (const t of rows) {
        const d = new Date(t.created_at);
        hourCounts[d.getHours()] += 1;
        dayCounts[(d.getDay() + 6) % 7] += 1;          // Monday-first
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
      }

      const activeHours = hourCounts
        .map((v, h) => ({ h, v }))
        .filter((x) => x.v > 0);

      const months = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const tiers = Object.fromEntries(TIER_ORDER.map((t) => [t, 0]));
      for (const p of people) tiers[p.t] += 1;

      /* Charts: prefer the imported distributions when they exist, because
         they cover far more visits than AzQueue has recorded so far. Live
         hours are used once this branch has its own history. Never summed —
         the two sources cover different periods, and adding them would
         double-count the overlap. */
      const useImportedCharts = !!summary && rows.length < (summary.total_visits ?? 0);

      setData({
        total:  rows.length,
        imported: importedTotal,
        summary,
        chartSource: useImportedCharts ? (summary.source ?? "previous system") : "azqueue",
        unique: people.length,
        customers: people,
        tiers,
        hours: useImportedCharts && summary.hours
          ? summary.hours
          : {
              labels: activeHours.map((x) => `${x.h}:00`),
              values: activeHours.map((x) => x.v),
            },
        days: useImportedCharts && summary.days
          ? {
              ...summary.days,
              closed: (summary.days.values ?? []).map((v) => v < MIN_FOR_DAY_COMPARISON),
            }
          : {
              labels: DAY_LABELS,
              values: dayCounts,
              closed: dayCounts.map((v) => v < MIN_FOR_DAY_COMPARISON),
            },
        months: {
          labels: months.map((m) => m[0]),
          values: months.map((m) => m[1]),
        },
        range: rows.length
          ? {
              from: new Date(Math.min(...rows.map((t) => +new Date(t.created_at)))),
              to:   new Date(Math.max(...rows.map((t) => +new Date(t.created_at)))),
            }
          : null,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [branch?.id]);

  /* Segment counts. Computed once over everyone, so the cards and the
     filtered list can never disagree — they run the same predicate. */
  const segments = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return segmentCounts(data.customers, now);
  }, [data]);

  const vitals = useMemo(
    () => (data ? clientVitals(data.customers) : null),
    [data]
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    const now = Date.now();
    const seg = SEGMENTS.find((s) => s.key === segment);
    return data.customers.filter((c) => {
      const tierMatch = tier === "all" || c.t === tier;
      const segMatch = !seg || seg.match(c, now);
      const searchMatch = !q || c.n.toLowerCase().includes(q) || (c.p ?? "").includes(q);
      return tierMatch && segMatch && searchMatch;
    });
  }, [data, search, tier, segment]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  const fmtDate = (d) => d?.toLocaleDateString(undefined, { month: "short", year: "numeric" }) ?? "—";

  /* ── States ─────────────────────────────────────────────────────── */
  if (loading) {
    return <div className="p-8 text-ink-mute ovline">Reading your client history…</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-[#d49185] text-sm mb-2">Couldn't load your clients</div>
        <div className="text-ink-mute text-xs">{error}</div>
      </div>
    );
  }

  if (!data || data.unique === 0) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Clients</h1>
        <p className="text-ink-soft text-sm leading-relaxed mb-2">
          Nothing to show yet. Every person who checks in or books appears here
          automatically, with how many times they've visited.
        </p>
        <p className="text-ink-mute text-xs leading-relaxed">
          If you have history from a previous system, it needs importing into
          AzQueue before it will show up on this page.
        </p>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-light tracking-tightest">Clients</h1>
        <p className="text-ink-mute text-[11px] mt-1.5 leading-relaxed">
          {data.unique.toLocaleString()} people ·{" "}
          {(data.total + data.imported).toLocaleString()} visits
          {data.imported > 0 && (
            <span className="opacity-70">
              {" "}({data.imported.toLocaleString()} from {data.summary?.source ?? "your previous system"},
              {" "}{data.total.toLocaleString()} on AzQueue)
            </span>
          )}
          <span className="mx-1.5 opacity-50">·</span>
          your branch only, updated as people check in
        </p>
        <p className="text-ink-mute text-[10.5px] mt-1 leading-relaxed">
          Who your clients are over the years. For how the queue is running
          right now, see Insights.
        </p>
      </header>

      {/* ── Headline client stats ────────────────────────────────────
          Four numbers, each a division of two counted values. Deliberately
          no retention curve: that needs every individual visit date, which
          imported history doesn't carry. */}
      {vitals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
          <Vital
            label="Return rate"
            value={`${Math.round(vitals.returnRate * 100)}%`}
            hint={`${vitals.returnedCount.toLocaleString()} came back at least once`}
            accent
          />
          <Vital
            label="Still active"
            value={`${Math.round(vitals.activeRate * 100)}%`}
            hint="visited in the last 12 months"
          />
          <Vital
            label="Visits per client"
            value={vitals.visitsPerClient.toFixed(1)}
            hint="across their whole history"
          />
          <Vital
            label="Typical visit"
            value={vitals.medianVisitMins != null ? `${Math.round(vitals.medianVisitMins)}m` : "—"}
            hint={vitals.timedPeople
              ? `on average, from ${vitals.timedPeople.toLocaleString()} timed visits`
              : "no timed visits yet"}
          />
          <Vital
            label="Typical gap"
            value={vitals.medianGapDays != null
              ? vitals.medianGapDays >= 60
                ? `${Math.round(vitals.medianGapDays / 30)} mo`
                : `${Math.round(vitals.medianGapDays)} d`
              : "—"}
            hint="on average, people who came back"
          />
        </div>
      )}

      {/* ── Worth acting on ──────────────────────────────────────────
          Counts of people matching a stated rule. Clicking one filters the
          list below to exactly those people, so the number and the names can
          never drift apart. */}
      <div className="mb-6">
        <div className="ovline text-[9px] text-ink-mute mb-2.5">Worth acting on</div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {segments.map((s) => {
            const active = segment === s.key;
            return (
              <button
                key={s.key}
                onClick={() => { setSegment(active ? null : s.key); setPage(0); }}
                disabled={s.count === 0}
                className={`text-left border p-3.5 transition disabled:opacity-40 ${
                  active
                    ? "border-gold-deep bg-[rgba(201,168,106,0.06)]"
                    : "border-line hover:border-gold-deep/50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-[12px] text-ink leading-snug">{s.label}</span>
                  <span className="font-display text-lg text-gold-soft leading-none shrink-0">
                    {s.count.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10.5px] text-ink-mute leading-relaxed">
                  {s.note(s.count, data.unique)}
                </p>
                <p className="text-[10.5px] text-ink-soft leading-relaxed mt-1.5">{s.action}</p>
                {s.count > 0 && (
                  <span className="ovline text-[8px] text-gold-soft mt-2 inline-block">
                    {active ? "Showing these ✕" : "Show these →"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier counts */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => { setTier("all"); setPage(0); }}
          className={`text-[10px] ovline border px-2.5 py-1.5 transition ${
            tier === "all" ? "border-gold-deep text-gold-soft" : "border-line text-ink-mute hover:text-ink"
          }`}
        >
          All · {data.unique.toLocaleString()}
        </button>
        {TIER_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => { setTier(t); setPage(0); }}
            className="text-[10px] ovline border px-2.5 py-1.5 transition"
            style={{
              borderColor: tier === t ? TIER_META[t].color : "rgba(255,255,255,0.08)",
              color: tier === t ? TIER_META[t].color : "#8a8880",
              background: tier === t ? TIER_META[t].bg : "transparent",
            }}
          >
            {TIER_META[t].label} · {(data.tiers[t] ?? 0).toLocaleString()}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        placeholder="Search by name or phone"
        className="w-full max-w-sm bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2 text-xs text-ink placeholder:text-ink-mute mb-5"
      />

      {/* Client list */}
      <div className="border border-line mb-4">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-line ovline text-[8px] text-ink-mute">
          <span>Name</span><span>Visits</span><span>Time</span><span>First</span><span>Last</span>
        </div>
        {pageData.map((c) => (
          <div
            key={c.key}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-line last:border-b-0 items-center hover:bg-[rgba(201,168,106,0.03)] transition"
          >
            <div className="min-w-0">
              <div className="text-xs text-ink truncate">{c.n}</div>
              {c.p && <div className="text-[10px] text-ink-mute font-mono mt-0.5">{c.p}</div>}
            </div>
            <span
              className="text-[10px] px-2 py-0.5 border"
              style={{ color: TIER_META[c.t].color, borderColor: TIER_META[c.t].border, background: TIER_META[c.t].bg }}
            >
              {c.v}
            </span>
            {/* Blank rather than zero when a client has no timed visits —
                an em dash says "not recorded", a 0 would say "instant". */}
            <span className="text-[10px] text-ink-mute font-mono" title={c.timedVisits ? `average of ${c.timedVisits} timed visit${c.timedVisits === 1 ? "" : "s"}` : "no timed visits yet"}>
              {c.medMins != null ? `${Math.round(c.medMins)}m` : "—"}
            </span>
            <span className="text-[10px] text-ink-mute font-mono">{fmtDate(c.f)}</span>
            <span className="text-[10px] text-ink-mute font-mono">{fmtDate(c.l)}</span>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-[10px] ovline border border-line px-2.5 py-1.5 text-ink-mute hover:text-ink transition disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-[11px] text-ink-mute">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-[10px] ovline border border-line px-2.5 py-1.5 text-ink-mute hover:text-ink transition disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {/* Distributions */}
      <div className="grid md:grid-cols-2 gap-6">
        <MiniBarChart title="Busiest hours" labels={data.hours.labels} values={data.hours.values} accent="#9b7bff" />
        <MiniBarChart title="Busiest days" labels={data.days.labels} values={data.days.values} closed={data.days.closed} accent="#4caf79" />
      </div>
    </div>
  );
}

/* ── Bar chart ────────────────────────────────────────────────────────
   Days marked `closed` are drawn faintly and excluded from the scale, so a
   day the business doesn't trade can't masquerade as a quiet trading day. */
function MiniBarChart({ title, labels, values, closed, accent }) {
  const W = 320, H = 90;
  const considered = values.filter((_, i) => !closed?.[i]);
  const max = Math.max(...considered, 1);
  const barW = Math.floor((W - (labels.length - 1) * 2) / labels.length);
  const step = Math.ceil(labels.length / 6);

  return (
    <div className="border border-line p-4">
      <div className="ovline text-[9px] text-ink-mute mb-3">{title}</div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
        {values.map((v, i) => {
          const isClosed = closed?.[i];
          const h = isClosed ? 2 : Math.max(2, Math.round((v / max) * H));
          const x = i * (barW + 2);
          return (
            <g key={i}>
              <rect x={x} y={H - h} width={barW} height={h} fill={accent} opacity={isClosed ? 0.15 : 0.75} />
              {i % step === 0 && (
                <text x={x + barW / 2} y={H + 12} textAnchor="middle" fill="#555" fontSize={7}>
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {closed?.some(Boolean) && (
        <div className="text-[9px] text-ink-mute mt-2 leading-relaxed">
          Faded days had too few visits to compare — treated as closed rather
          than quiet.
        </div>
      )}
    </div>
  );
}

/* One headline number. Flat and bordered like the rest of the page — these
   are reference figures, not a dashboard demanding attention. */
function Vital({ label, value, hint, accent }) {
  return (
    <div className="border border-line p-3.5">
      <div className="ovline text-[8px] text-ink-mute mb-1.5">{label}</div>
      <div className={`font-display text-2xl font-light leading-none ${accent ? "text-gold-soft" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-[10px] text-ink-mute mt-1.5 leading-relaxed">{hint}</div>
    </div>
  );
}
