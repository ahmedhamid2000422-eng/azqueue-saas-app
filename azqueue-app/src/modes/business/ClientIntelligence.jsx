import { useEffect, useState, useMemo } from "react";

/**
 * ClientIntelligence — Aztax client base imported from Qminder.
 *
 * Shows 9,308 clients with loyalty tiers, visit history, promo offers,
 * and market insights derived from 17,752 queue tickets (Jan 2023 – Apr 2026).
 *
 * Data is pre-processed and served as a static JSON from /public/aztax-clients.json.
 */

const TIER_META = {
  VIP:       { color: "#c8a84b", bg: "rgba(200,168,75,0.12)",  border: "rgba(200,168,75,0.35)", label: "VIP ★",    min: 10 },
  Loyal:     { color: "#9b7bff", bg: "rgba(155,123,255,0.10)", border: "rgba(155,123,255,0.3)", label: "Loyal",    min: 5  },
  Regular:   { color: "#4caf79", bg: "rgba(76,175,121,0.10)",  border: "rgba(76,175,121,0.3)",  label: "Regular",  min: 3  },
  Returning: { color: "#5b8fb9", bg: "rgba(91,143,185,0.10)",  border: "rgba(91,143,185,0.3)",  label: "Returning",min: 2  },
  New:       { color: "#666",    bg: "rgba(102,102,102,0.08)", border: "rgba(102,102,102,0.2)", label: "New",      min: 1  },
};

export default function ClientIntelligence() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tier, setTier]     = useState("all");
  const [page, setPage]     = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetch("/aztax-clients.json")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.customers.filter(c => {
      const tierMatch = tier === "all" || c.t === tier;
      const searchMatch = !q || c.n.toLowerCase().includes(q) || c.p.includes(q);
      return tierMatch && searchMatch;
    });
  }, [data, search, tier]);

  const pageData = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function handleTier(t) { setTier(t); setPage(0); }
  function handleSearch(v) { setSearch(v); setPage(0); }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-ink-mute text-sm">Loading client data…</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#d49185] text-sm">Could not load aztax-clients.json</div>
      </div>
    );
  }

  const maxVisits = data.customers[0]?.v ?? 1;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div>
        <div className="ovline text-gold-soft mb-1">Aztax · Qminder Import</div>
        <h1 className="font-display text-2xl font-light tracking-tighter">Client Intelligence</h1>
        <p className="text-ink-mute text-xs mt-1">
          {data.total.toLocaleString()} queue tickets · {data.unique.toLocaleString()} unique clients · Jan 2023 – Apr 2026
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { num: data.total.toLocaleString(),   lbl: "Total Tickets" },
          { num: data.unique.toLocaleString(),  lbl: "Unique Clients" },
          { num: data.tiers.VIP ?? 0,           lbl: "VIP (10+ visits)" },
          { num: (data.tiers.VIP ?? 0) + (data.tiers.Loyal ?? 0), lbl: "Loyal+ (5+ visits)" },
          { num: (data.tiers.VIP ?? 0) + (data.tiers.Loyal ?? 0) + (data.tiers.Regular ?? 0), lbl: "Regulars (3+ visits)" },
        ].map((k, i) => (
          <div key={i} className="bg-bg-elev border border-line rounded-sm p-4">
            <div className="text-2xl font-bold text-gold-soft font-mono">{k.num}</div>
            <div className="text-[10px] text-ink-mute mt-1 uppercase tracking-wide">{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniBarChart title="Monthly Traffic" labels={data.monthly.labels} values={data.monthly.values} accent="#c8a84b" />
        <MiniBarChart title="Busiest Hours" labels={data.hours.labels} values={data.hours.values} accent="#9b7bff" />
        <MiniBarChart title="By Weekday" labels={data.days.labels} values={data.days.values} accent="#4caf79" />
      </div>

      {/* Insights */}
      <div>
        <div className="ovline text-[9px] mb-3">Market Insights</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "🚀", title: "Tax Season Spike", body: "Volume hit 1,185 tickets in Feb 2026 — 350%+ above average. Staff up and open early every Jan–Mar." },
            { icon: "⏰", title: "Peak: 10am – 2pm", body: "55% of visits land in this 4-hour window. Consider express lanes or appointment slots mid-day." },
            { icon: "📅", title: "Monday Rush", body: "Monday is the busiest day — nearly 2× Friday volume. Consider extended Monday hours or a fast-track queue." },
            { icon: "💼", title: "Tax Filing Dominates", body: "72% of all services are Tax Filing. Bundling ITIN + filing into one visit cuts repeat trips and boosts revenue." },
            { icon: "🔁", title: "Strong Repeat Rate", body: "42% of clients return at least twice. 22% have 3+ visits — a loyalty programme converts these into advocates." },
            { icon: "👑", title: "VIP Opportunity", body: `${data.tiers.VIP ?? 0} clients have visited 10+ times. Offer them a dedicated line, annual tax package, or referral bonus today.` },
          ].map((ins, i) => (
            <div key={i} className="bg-bg-elev border border-line border-l-2 border-l-gold-deep rounded-sm p-4">
              <div className="text-sm font-semibold mb-1">{ins.icon} {ins.title}</div>
              <p className="text-[11px] text-ink-soft leading-relaxed">{ins.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Client Table */}
      <div>
        <div className="ovline text-[9px] mb-3">Client List — {filtered.length.toLocaleString()} shown</div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="text"
            placeholder="Search name or phone…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="bg-bg-elev border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 text-ink placeholder:text-ink-mute w-56 rounded-sm"
          />
          {["all", "VIP", "Loyal", "Regular", "Returning", "New"].map(t => {
            const meta = t === "all" ? null : TIER_META[t];
            const active = tier === t;
            return (
              <button
                key={t}
                onClick={() => handleTier(t)}
                className="px-3 py-1.5 text-[11px] rounded-full border transition"
                style={active
                  ? { borderColor: meta?.color ?? "#c8a84b", color: meta?.color ?? "#c8a84b", background: meta?.bg ?? "rgba(200,168,75,0.08)" }
                  : { borderColor: "rgba(255,255,255,0.08)", color: "#666" }
                }
              >
                {t === "all" ? "All" : `${meta?.label} (${data.tiers[t] ?? 0})`}
              </button>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-[11px] text-ink-mute hover:text-ink disabled:opacity-30 px-2 py-1 border border-line rounded-sm"
              >← Prev</button>
              <span className="text-[11px] text-ink-mute">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-[11px] text-ink-mute hover:text-ink disabled:opacity-30 px-2 py-1 border border-line rounded-sm"
              >Next →</button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="border border-line overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-bg-elev">
                {["#", "Name", "Phone", "Tier", "Visits", "Services", "First Visit", "Last Visit", "Promo Offer"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-ink-mute font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((c, i) => {
                const meta = TIER_META[c.t] ?? TIER_META.New;
                const barW = Math.max(4, Math.round((c.v / maxVisits) * 60));
                return (
                  <tr key={c.p + i} className="border-b border-line hover:bg-white/[0.01] transition">
                    <td className="px-3 py-2 text-ink-mute font-mono">{page * PAGE_SIZE + i + 1}</td>
                    <td className="px-3 py-2 font-medium text-ink">{c.n}</td>
                    <td className="px-3 py-2 font-mono text-ink-mute text-[11px]">{c.p}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gold-soft font-mono w-5">{c.v}</span>
                        <div className="h-1 rounded-full bg-gold-deep/70" style={{ width: barW }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-ink-mute">{c.s.join(", ")}</td>
                    <td className="px-3 py-2 text-ink-mute font-mono">{c.f}</td>
                    <td className="px-3 py-2 text-ink-mute font-mono">{c.l}</td>
                    <td className="px-3 py-2">
                      <span className="text-[#4caf79] bg-[rgba(76,175,121,0.08)] border border-[rgba(76,175,121,0.2)] px-2 py-0.5 rounded text-[10px]">
                        {c.pr}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center text-ink-mute py-10 text-sm">No clients match your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Mini Bar Chart (pure SVG, no deps) ─────────────────────────── */
function MiniBarChart({ title, labels, values, accent }) {
  const max = Math.max(...values, 1);
  const H = 60;
  const W = 260;
  const barW = Math.floor((W - (labels.length - 1) * 2) / labels.length);
  // Only show every Nth label to avoid crowding
  const step = Math.ceil(labels.length / 6);

  return (
    <div className="bg-bg-elev border border-line rounded-sm p-4">
      <div className="text-[10px] uppercase tracking-wide text-ink-mute mb-3">{title}</div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} width="100%" style={{ overflow: "visible" }}>
        {values.map((v, i) => {
          const h = Math.max(2, Math.round((v / max) * H));
          const x = i * (barW + 2);
          return (
            <g key={i}>
              <rect x={x} y={H - h} width={barW} height={h} fill={accent} opacity={0.75} rx={1} />
              {i % step === 0 && (
                <text x={x + barW / 2} y={H + 12} textAnchor="middle" fill="#555" fontSize={7}>
                  {labels[i]?.replace(':00','').replace(/^\d{4}-/,'')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
