import { useEffect, useState } from "react";
import { useBranch } from "../../lib/BranchContext";
import { computeInsights, fmtMin, fmtPct } from "../../lib/insights";
import { downloadCSV, exportFilename } from "../../lib/export";
import Card, { CardHeader } from "../../components/Card";
import Stat from "../../components/Stat";
import Button from "../../components/Button";

export default function Insights() {
  const { branch, dbReady } = useBranch();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!branch?.id) return;
    setLoading(true);
    const result = await computeInsights({ branchId: branch.id });
    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    if (!branch?.id) return;
    // Re-compute every 60s — cheap enough for a single branch
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [branch?.id]);

  if (!dbReady) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Insights</h1>
        <p className="text-ink-soft text-sm">Run the database migration to enable insights.</p>
      </div>
    );
  }

  if (!branch) {
    return <div className="p-8 text-ink-mute ovline">Select a branch to see insights.</div>;
  }

  const alerts = data?.alerts ?? [];

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <div className="ovline mb-2 text-gold-soft">Live · live data</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Insights</h1>
          <div className="text-xs text-ink-soft mt-2">
            <span className="pip breathe mr-2 inline-block" />
            {loading ? "Computing…" : "Recalculated every minute"}
            <span className="text-ink-mute"> · {branch.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => exportInsights(data, branch)} disabled={!data}>
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh}>↻ Refresh</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat label="Served today"   value={data?.servedToday ?? 0} hint="Completed" accent />
        <Stat label="Avg wait"       value={fmtMin(data?.avgWaitSec)} hint="Created → called" />
        <Stat label="No-show rate"   value={fmtPct(data?.noShowRate)} hint="of today's tickets" />
        <Stat label="Booking fill"   value={fmtPct(data?.bookingConversion)} hint="of today's bookings" />
      </div>

      <Card luxe>
        <CardHeader
          title="Active insights"
          subtitle="Anomalies, idle alerts, and customer-experience drift — computed live"
          right={<span className="ovline text-[9px] text-gold-soft">{alerts.length} active</span>}
        />
        {alerts.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">
            All quiet. The queue is operating within its baselines.
          </div>
        ) : (
          alerts.map((a, i) => (
            <div
              key={i}
              className="px-5 py-4 border-b border-line last:border-b-0 grid grid-cols-[28px_1fr_72px] gap-3 items-baseline hover:bg-[rgba(201,168,106,0.03)] transition"
            >
              <div className={`text-[14px] leading-none ${a.severity === "warn" ? "text-[#d49185]" : "text-gold-soft"}`}>
                {a.mark}
              </div>
              <div>
                <div className="text-sm text-ink leading-tight">{a.title}</div>
                <p className="text-ink-mute text-[11px] mt-1 leading-relaxed">{a.body}</p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-baseline gap-1 font-display text-base ${
                  a.direction === "up" && a.severity !== "warn" ? "text-[#9bbd9b]" :
                  a.direction === "down" || a.severity === "warn" ? "text-[#d49185]" :
                  "text-ink"
                }`}>
                  <span className="text-[10px]">
                    {a.severity === "warn" ? "▲" : a.direction === "up" ? "▲" : "▼"}
                  </span>
                  <span>{a.impact}</span>
                </div>
                <div className="ovline text-[8px] text-ink-mute mt-0.5">{a.impactLabel}</div>
              </div>
            </div>
          ))
        )}
        <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic font-display">
          Recommendations are computed from your real queue history — not generic benchmarks.
        </div>
      </Card>
    </div>
  );
}

function exportInsights(data, branch) {
  if (!data) return;
  const summary = [
    { metric: "Served today",      value: data.servedToday ?? 0 },
    { metric: "Avg wait (min)",    value: data.avgWaitSec ? Math.round(data.avgWaitSec / 60) : "—" },
    { metric: "No-show rate",      value: data.noShowRate != null ? (data.noShowRate * 100).toFixed(1) + "%" : "—" },
    { metric: "Booking conv.",     value: data.bookingConversion != null ? (data.bookingConversion * 100).toFixed(1) + "%" : "—" },
    { metric: "Waiting now",       value: data.waitingNow ?? 0 },
  ];
  const alerts = (data.alerts ?? []).map((a) => ({
    metric: `Alert · ${a.title}`,
    value:  `${a.body} (${a.impact} ${a.impactLabel})`,
  }));
  downloadCSV(
    exportFilename(branch?.slug, "insights"),
    [...summary, ...alerts],
    [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }]
  );
}
