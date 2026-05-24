import { useEffect, useState } from "react";
import { useBranch } from "../../lib/BranchContext";
import { computeManagerIntel } from "../../lib/managerIntel";
import Card, { CardHeader } from "../../components/Card";
import Stat from "../../components/Stat";
import Button from "../../components/Button";
import TierGate from "../../components/TierGate";
import BreakPatternHeatmap, { HeatmapLegend } from "../../components/BreakPatternHeatmap";

export default function Manager() {
  return (
    <TierGate
      requires="manager"
      feature="Manager Mode"
      reason="People intelligence — break-pattern learning, anomaly detection, wellness signals, weekly performance digests. Surfaces gently, never punitively."
    >
      <ManagerInner />
    </TierGate>
  );
}

function ManagerInner() {
  const { branch, dbReady } = useBranch();
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!branch?.id) return;
    setLoading(true);
    setIntel(await computeManagerIntel({ branchId: branch.id }));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    if (!branch?.id) return;
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [branch?.id]);

  if (!dbReady) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Manager</h1>
        <p className="text-ink-soft text-sm">Run the database migration to enable Manager Mode.</p>
      </div>
    );
  }

  if (!branch) {
    return <div className="p-8 text-ink-mute ovline">Select a branch to see Manager Mode.</div>;
  }

  const counts = intel?.counts ?? { active: 0, onBreak: 0, alerts: 0 };
  const alerts = intel?.alerts ?? [];
  const roster = intel?.roster ?? [];
  const heatmap = intel?.heatmap ?? [];
  const weekly = intel?.weekly ?? [];
  const wellness = intel?.wellness ?? [];

  return (
    <div className="atmosphere-hero atmosphere-prayer p-8 max-w-6xl">
      <header className="flex justify-between items-start mb-8">
        <div>
          <div className="ovline mb-2 text-[#9bbd9b]">Manager · people intelligence</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Manager</h1>
          <div className="text-xs text-ink-soft mt-2">
            <span className="pip breathe mr-2 inline-block" />
            {loading ? "Computing…" : `Watching ${roster.length} staff · ${counts.alerts} active signals`}
            <span className="text-ink-mute"> · {branch.name}</span>
          </div>
        </div>
        <div className="text-right">
          <Button variant="ghost" size="sm" onClick={refresh}>↻ Refresh</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat label="Active"   value={counts.active}  hint="In service" live />
        <Stat label="On break" value={counts.onBreak} hint="Right now" />
        <Stat label="Signals"  value={counts.alerts}  hint="Need a glance" accent />
        <Stat label="Served · 7d" value={weekly.reduce((s, w) => s + (w.served || 0), 0)} hint="Across team" />
      </div>

      <div className="grid grid-cols-12 gap-3 mb-3">
        {/* Live signals feed */}
        <Card luxe variant="sage" className="col-span-12 lg:col-span-7">
          <CardHeader
            title="Live signals"
            subtitle="Anomalies, learned per person"
            right={<span className="ovline text-[9px] text-[#9bbd9b]">{alerts.length} today</span>}
          />
          {alerts.length === 0 ? (
            <div className="px-5 py-10 text-center text-ink-mute text-xs">
              All quiet. Everyone's within their own baseline.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {alerts.map((a, i) => (
                <div key={i} className="px-5 py-4 grid grid-cols-[80px_1fr_auto] gap-3 items-baseline">
                  <div className={`ovline text-[8px] ${a.severity === "warn" ? "text-gold-soft" : "text-[#9bbd9b]"}`}>
                    {a.tag}
                  </div>
                  <div>
                    <div className="text-[12px] text-ink">{a.who}</div>
                    <div className="text-[10px] text-ink-mute mt-0.5">{a.body}</div>
                  </div>
                  <div className="text-[9px] text-ink-mute font-mono">{a.t}</div>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic font-display">
            Insights surface gently. Nothing punitive.
          </div>
        </Card>

        {/* Roster */}
        <Card luxe className="col-span-12 lg:col-span-5">
          <CardHeader title="Staff roster" right={<span className="ovline text-[9px]">{roster.length}</span>} />
          {roster.length === 0 ? (
            <div className="px-5 py-10 text-center text-ink-mute text-xs">No staff yet — invite them in Settings.</div>
          ) : (
            roster.map((s) => (
              <div
                key={s.id}
                className="px-5 py-3 border-b border-line last:border-b-0 grid grid-cols-[1fr_auto_auto] gap-3 items-center"
              >
                <div>
                  <div className="text-xs text-ink flex items-center gap-2">
                    {s.name}
                    {s.flag === "long" && <span className="text-[8px] text-gold uppercase tracking-[0.2em]">long</span>}
                    {s.flag === "wellness" && <span className="text-[8px] text-[#d49185] uppercase tracking-[0.2em]">wellness</span>}
                  </div>
                  <div className="text-[10px] text-ink-mute mt-0.5">
                    {s.role} <span className="text-line-2">·</span> for {s.since}
                  </div>
                </div>
                <span className="font-display text-gold-soft text-xs">{s.served}</span>
                <span className={`text-[9px] uppercase tracking-[0.18em] ${
                  s.status === "serving" ? "text-gold" :
                  s.status === "on_break" ? "text-[#74b9e8]" :
                  s.status === "active" ? "text-[#9bbd9b]" :
                  "text-ink-mute"
                }`}>
                  {s.flag === "long" && <span className="pip breathe mr-1.5 inline-block" />}
                  {s.status ?? "off"}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Break-pattern heatmap (computed from staff_status_log) */}
      <Card luxe className="p-6 mb-3">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="ovline text-[9px] text-gold-soft">Break-pattern map · last 14 days</div>
            <h2 className="font-display text-xl font-light tracking-tighter mt-1">Each rhythm, learned.</h2>
          </div>
          <span className="ovline text-[9px] text-ink-mute">12am — 11pm</span>
        </div>

        <BreakPatternHeatmap rows={heatmap} startHour={9} endHour={18} />

        <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
        <HeatmapLegend />
        <div className="text-[10px] text-ink-mute text-center mt-3 tracking-wide">
          <span className="text-gold-soft">Built from your real status-change history.</span>
        </div>
      </Card>

      {/* Weekly digest + Wellness */}
      <div className="grid grid-cols-12 gap-3">
        <Card luxe className="col-span-12 lg:col-span-6 p-6">
          <div className="ovline text-gold-soft mb-3">Weekly digest</div>
          <h2 className="font-display text-2xl font-light tracking-tighter mb-5">
            Performance, <em className="not-italic gold-text-soft">measured by data.</em>
          </h2>
          {weekly.length === 0 ? (
            <div className="text-center text-ink-mute text-xs py-6">No data yet.</div>
          ) : (
            <div className="divide-y divide-line border-t border-b border-line">
              {weekly.map((w) => (
                <div key={w.id} className="py-3 grid grid-cols-[1fr_auto_60px] gap-3 items-baseline">
                  <div>
                    <div className="text-sm text-ink">{w.name}</div>
                    <div className="text-[10px] text-ink-mute uppercase tracking-[0.15em]">{w.role}</div>
                  </div>
                  <div className="text-[10px] text-ink-mute">{w.note}</div>
                  <div className={`font-display text-base text-right ${
                    w.direction === "up" ? "text-[#9bbd9b]" :
                    w.direction === "down" ? "text-[#d49185]" :
                    "text-ink-mute"
                  }`}>
                    {w.delta}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card luxe variant="sage" className="col-span-12 lg:col-span-6 p-6">
          <div className="ovline text-[#9bbd9b] mb-3">Wellness signals</div>
          <h2 className="font-display text-2xl font-light tracking-tighter mb-5">
            Who needs a moment.
          </h2>
          {wellness.length === 0 ? (
            <div className="text-ink-soft text-sm">Everyone's within their healthy break rhythm today.</div>
          ) : (
            <ul className="space-y-4 text-sm">
              {wellness.map((w, i) => (
                <li key={i} className="grid grid-cols-[16px_1fr] gap-3">
                  <span className="pip mt-2" style={{ background: "#d49185" }} />
                  <div>
                    <div className="text-ink">{w.who}</div>
                    <div className="text-ink-mute text-xs mt-0.5">{w.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
          <div className="text-[10px] text-ink-mute italic font-display text-center">
            Quiet intelligence — never surveillance.
          </div>
        </Card>
      </div>
    </div>
  );
}

// Heatmap moved to src/components/BreakPatternHeatmap.jsx
