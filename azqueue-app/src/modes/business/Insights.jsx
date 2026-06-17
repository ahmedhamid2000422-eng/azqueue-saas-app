import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import { downloadCSV, exportFilename } from "../../lib/export";
import { fetchPlatformOverview, CHANNEL_LABELS } from "../../lib/platformOverview";
import { getGAConfig, fetchGAMetrics } from "../../lib/googleAnalytics";
import Card, { CardHeader } from "../../components/Card";
import Stat from "../../components/Stat";
import Button from "../../components/Button";

/**
 * Insights — branch-level metrics pulled from the get_insights_payload RPC.
 *
 * Data contract (JSONB returned by the RPC):
 *   {
 *     served_today:        int,      -- completed tickets today
 *     avg_wait_sec:        float,    -- created_at → called_at (completed tickets)
 *     avg_service_sec:     float,    -- called_at → completed_at (completed tickets)
 *     no_show_rate:        float,    -- cancelled / (completed + cancelled), 0–1
 *     booking_conversion:  float,    -- tickets with source='booking' completed / total bookings today
 *     peak_hour:           int,      -- 0–23, hour with most completions today (null if none)
 *     waiting_now:         int,      -- tickets currently in waiting status
 *     serving_now:         int,      -- tickets currently in serving status
 *   }
 *
 * Stale time: 60 s.  A manual "Refresh" button forces an immediate re-fetch.
 *
 * SQL to deploy in Supabase SQL editor (B5):
 * ─────────────────────────────────────────────────────────────────────────
 * CREATE OR REPLACE FUNCTION get_insights_payload(p_branch_id uuid)
 * RETURNS jsonb
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * AS $$
 * DECLARE
 *   v_today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC');
 *   v_result      jsonb;
 * BEGIN
 *   SELECT jsonb_build_object(
 *     'served_today',
 *       COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= v_today_start),
 *     'avg_wait_sec',
 *       AVG(EXTRACT(EPOCH FROM (called_at - created_at)))
 *         FILTER (WHERE status = 'completed' AND called_at IS NOT NULL AND created_at >= v_today_start),
 *     'avg_service_sec',
 *       AVG(EXTRACT(EPOCH FROM (completed_at - called_at)))
 *         FILTER (WHERE status = 'completed' AND called_at IS NOT NULL AND completed_at IS NOT NULL AND created_at >= v_today_start),
 *     'no_show_rate',
 *       CASE WHEN COUNT(*) FILTER (WHERE status IN ('completed','cancelled') AND created_at >= v_today_start) = 0 THEN NULL
 *            ELSE COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at >= v_today_start)::float
 *               / COUNT(*) FILTER (WHERE status IN ('completed','cancelled') AND created_at >= v_today_start)
 *       END,
 *     'booking_conversion',
 *       CASE WHEN COUNT(*) FILTER (WHERE source = 'booking' AND created_at >= v_today_start) = 0 THEN NULL
 *            ELSE COUNT(*) FILTER (WHERE source = 'booking' AND status = 'completed' AND created_at >= v_today_start)::float
 *               / COUNT(*) FILTER (WHERE source = 'booking' AND created_at >= v_today_start)
 *       END,
 *     'peak_hour',
 *       (SELECT EXTRACT(HOUR FROM completed_at AT TIME ZONE 'UTC')::int
 *        FROM tickets
 *        WHERE branch_id = p_branch_id AND status = 'completed' AND created_at >= v_today_start
 *        GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1),
 *     'waiting_now',
 *       COUNT(*) FILTER (WHERE status = 'waiting'),
 *     'serving_now',
 *       COUNT(*) FILTER (WHERE status = 'serving')
 *   ) INTO v_result
 *   FROM tickets
 *   WHERE branch_id = p_branch_id;
 *
 *   RETURN v_result;
 * END;
 * $$;
 * ─────────────────────────────────────────────────────────────────────────
 */

const STALE_MS = 60_000; // 60 s

export default function Insights() {
  const { branch, dbReady } = useBranch();

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const timerRef = useRef(null);

  // Cross-platform rollup (customer_events / wa_conversations / channel_connections)
  // and Google Analytics — these don't change minute-to-minute like queue
  // metrics do, so they're fetched once per branch rather than on the 60s timer.
  const [platform,        setPlatform]        = useState(null);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [gaConnected,     setGaConnected]     = useState(false);
  const [gaMetrics,       setGaMetrics]       = useState(null);

  const fetch = useCallback(async (force = false) => {
    if (!branch?.id) return;
    // Honour stale time unless forced
    if (!force && fetchedAt && Date.now() - fetchedAt < STALE_MS) return;

    setLoading(true);
    const { data: payload, error } = await supabase.rpc("get_insights_payload", {
      p_branch_id: branch.id,
    });

    if (error) {
      console.error("[Insights] RPC error:", error);
      setLoading(false);
      return;
    }

    setData(payload ?? null);
    setFetchedAt(Date.now());
    setLoading(false);
  }, [branch?.id, fetchedAt]);

  // Initial fetch + 60 s interval
  useEffect(() => {
    fetch(true);
    timerRef.current = setInterval(() => fetch(true), STALE_MS);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id]);

  // Cross-platform rollup + Google Analytics — fetched once per branch.
  useEffect(() => {
    if (!branch?.id) return;
    let cancelled = false;

    (async () => {
      setPlatformLoading(true);
      const [overview, gaConfig] = await Promise.all([
        fetchPlatformOverview(branch.id, 30),
        getGAConfig(branch.id),
      ]);
      const metrics = gaConfig ? await fetchGAMetrics(branch.id, 30) : null;

      if (cancelled) return;
      setPlatform(overview);
      setGaConnected(!!gaConfig);
      setGaMetrics(metrics);
      setPlatformLoading(false);
    })();

    return () => { cancelled = true; };
  }, [branch?.id]);

  /* ── Format helpers ─────────────────────────────────────────── */
  function fmtMin(sec) {
    if (sec == null) return "—";
    const m = Math.round(sec / 60);
    return m < 1 ? "<1 min" : `${m} min`;
  }
  function fmtPct(rate) {
    if (rate == null) return "—";
    return `${Math.round(rate * 100)}%`;
  }
  function fmtHour(h) {
    if (h == null) return "—";
    const ampm = h >= 12 ? "pm" : "am";
    return `${h % 12 || 12}${ampm}`;
  }

  /* ── Guard: DB not ready ─────────────────────────────────────── */
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

  /* ── Build alert cards from thresholds ───────────────────────── */
  const alerts = buildAlerts(data);

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
            <span className="pip breathe" />
            Live · {branch.name}
          </div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Insights</h1>
          <div className="text-xs text-ink-mute mt-2">
            {loading
              ? "Fetching…"
              : fetchedAt
                ? `Updated ${Math.round((Date.now() - fetchedAt) / 1000)}s ago · refreshes every minute`
                : "Not yet loaded"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => exportInsights(data, branch)} disabled={!data}>
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fetch(true)} disabled={loading}>
            ↻ Refresh
          </Button>
        </div>
      </header>

      {/* ── Primary metrics ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat label="Served today"   value={loading ? "…" : data?.served_today ?? 0}       hint="Completed visits"     accent />
        <Stat label="Avg wait"       value={loading ? "…" : fmtMin(data?.avg_wait_sec)}     hint="Created → called" />
        <Stat label="Avg service"    value={loading ? "…" : fmtMin(data?.avg_service_sec)}  hint="Called → completed" />
        <Stat label="No-show rate"   value={loading ? "…" : fmtPct(data?.no_show_rate)}     hint="of today's visits" />
      </div>

      {/* ── Secondary metrics ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Booking fill"   value={loading ? "…" : fmtPct(data?.booking_conversion)} hint="Bookings completed" />
        <Stat label="Peak hour"      value={loading ? "…" : fmtHour(data?.peak_hour)}          hint="Most completions" />
        <Stat label="Waiting now"    value={loading ? "…" : data?.waiting_now ?? 0}            hint="In queue" />
        <Stat label="Serving now"    value={loading ? "…" : data?.serving_now ?? 0}            hint="At counters" />
      </div>

      {/* ── Alerts ──────────────────────────────────────────────── */}
      <Card luxe>
        <CardHeader
          title="Operational alerts"
          subtitle="Threshold-based signals from today's data"
          right={<span className="ovline text-[9px] text-gold-soft">{alerts.length} active</span>}
        />
        {alerts.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">
            All within normal range. No alerts right now.
          </div>
        ) : (
          alerts.map((a, i) => (
            <div
              key={i}
              className="px-5 py-4 border-b border-line last:border-b-0 grid grid-cols-[28px_1fr_72px] gap-3 items-baseline hover:bg-[rgba(201,168,106,0.03)] transition"
            >
              <div className={`text-[14px] leading-none ${a.level === "warn" ? "text-[#d49185]" : "text-gold-soft"}`}>
                {a.icon}
              </div>
              <div>
                <div className="text-sm text-ink leading-tight">{a.title}</div>
                <p className="text-ink-mute text-[11px] mt-1 leading-relaxed">{a.body}</p>
              </div>
              <div className="text-right">
                <div className={`font-display text-base ${a.level === "warn" ? "text-[#d49185]" : "text-gold-soft"}`}>
                  {a.value}
                </div>
                <div className="ovline text-[8px] text-ink-mute mt-0.5">{a.valueLabel}</div>
              </div>
            </div>
          ))
        )}
        <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic font-display">
          Signals are computed from your branch's own history — not generic industry benchmarks.
        </div>
      </Card>

      {/* ── Cross-platform activity ──────────────────────────────── */}
      <div className="mt-6">
        <PlatformActivityCard loading={platformLoading} platform={platform} />
      </div>

      {/* ── Website traffic (Google Analytics) ───────────────────── */}
      {gaConnected && (
        <div className="mt-6">
          <WebsiteTrafficCard loading={platformLoading} metrics={gaMetrics} />
        </div>
      )}
    </div>
  );
}

/* ── Cross-platform activity card ─────────────────────────────────────
 * Rolls up everything already flowing into AzQueue from separately-built
 * features — Freshdesk/Zid/Shopify imports, WhatsApp AI conversations,
 * queue activity — into one place, plus which platforms are connected
 * right now. Pulled from customer_events / wa_conversations /
 * channel_connections via fetchPlatformOverview (src/lib/platformOverview.js).
 */
function PlatformActivityCard({ loading, platform }) {
  const maxCount = platform?.channelActivity?.length
    ? Math.max(...platform.channelActivity.map((c) => c.count))
    : 0;

  return (
    <Card luxe>
      <CardHeader
        title="Cross-platform activity"
        subtitle={`Last ${platform?.days ?? 30} days · across every connected channel`}
        right={
          !loading && platform ? (
            <span className="ovline text-[9px] text-gold-soft">{platform.totalEvents} events</span>
          ) : null
        }
      />

      {loading ? (
        <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
      ) : (
        <>
          {/* Connected platforms */}
          <div className="px-5 py-4 border-b border-line flex flex-wrap gap-2">
            {Object.keys(CHANNEL_LABELS).map((channel) => {
              const conn = platform?.connectionMap?.[channel];
              const connected = conn?.status === "connected";
              return (
                <span
                  key={channel}
                  className={`flex items-center gap-1.5 text-[10px] px-2 py-1 border ${
                    connected
                      ? "border-[#506b50] text-[#9bbd9b]"
                      : "border-line text-ink-mute"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#9bbd9b]" : "bg-ink-mute/40"}`}
                  />
                  {CHANNEL_LABELS[channel]}
                </span>
              );
            })}
          </div>

          {/* Event volume per channel */}
          {platform?.channelActivity?.length ? (
            <div className="px-5 py-4 border-b border-line space-y-2.5">
              {platform.channelActivity.map((c) => (
                <div key={c.channel} className="flex items-center gap-3">
                  <div className="w-24 text-[11px] text-ink-soft shrink-0">{c.label}</div>
                  <div className="flex-1 h-[6px] bg-line/60 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gold-soft/60"
                      style={{ width: `${maxCount ? Math.max(4, (c.count / maxCount) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-[11px] text-ink font-display">{c.count}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-ink-mute text-xs">
              No cross-platform activity logged yet in this window.
            </div>
          )}

          {/* WhatsApp AI conversations */}
          <div className="grid grid-cols-3 gap-3 px-5 py-4">
            <Stat label="WhatsApp chats"  value={platform?.waStats?.total ?? 0}      hint="last 30 days" />
            <Stat label="Needs a human"   value={platform?.waStats?.needsHuman ?? 0} hint="awaiting handoff" accent />
            <Stat label="Completed"       value={platform?.waStats?.completed ?? 0}  hint="resolved by AI" />
          </div>

          <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic font-display">
            Connect more channels in Settings → Integrations to bring more activity in here.
          </div>
        </>
      )}
    </Card>
  );
}

/* ── Website traffic card (Google Analytics) ──────────────────────────
 * Only rendered once GA4 is connected. Fetched live on each page load via
 * the ga4-metrics Edge Function (src/lib/googleAnalytics.js) — nothing
 * Google-side is cached or stored.
 */
function WebsiteTrafficCard({ loading, metrics }) {
  const rows = metrics?.rows ?? [];
  const maxSessions = rows.length ? Math.max(...rows.map((r) => r.sessions)) : 0;

  return (
    <Card luxe>
      <CardHeader
        title="Website traffic"
        subtitle="From Google Analytics (GA4) · last 30 days"
        right={<span className="ovline text-[9px] text-gold-soft">live</span>}
      />

      {loading ? (
        <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
      ) : !metrics ? (
        <div className="px-5 py-6 text-center text-ink-mute text-xs">
          Couldn't load Google Analytics data right now. Check the connection in Settings → Integrations.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-line">
            <Stat label="Sessions"    value={metrics.totals?.sessions ?? 0}    hint="last 30 days" accent />
            <Stat label="Users"       value={metrics.totals?.activeUsers ?? 0} hint="last 30 days" />
            <Stat label="Conversions" value={metrics.totals?.conversions ?? 0} hint="last 30 days" />
          </div>

          {rows.length > 0 && (
            <div className="px-5 py-4">
              <div className="ovline text-[9px] text-ink-mute mb-3">Daily sessions</div>
              <div className="flex items-end gap-[2px] h-16">
                {rows.map((r) => (
                  <div
                    key={r.date}
                    title={`${r.date}: ${r.sessions} sessions`}
                    className="flex-1 bg-gold-soft/50 hover:bg-gold-soft transition"
                    style={{ height: `${maxSessions ? Math.max(4, (r.sessions / maxSessions) * 100) : 4}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic font-display">
            Read-only — AzQueue never writes anything back to Google Analytics.
          </div>
        </>
      )}
    </Card>
  );
}

/* ── Alert builder ──────────────────────────────────────────────────── */
function buildAlerts(data) {
  if (!data) return [];
  const alerts = [];

  const avgWaitMin = data.avg_wait_sec != null ? data.avg_wait_sec / 60 : null;
  const noShowPct  = data.no_show_rate  != null ? data.no_show_rate * 100 : null;
  const bookingPct = data.booking_conversion != null ? data.booking_conversion * 100 : null;

  if (avgWaitMin != null && avgWaitMin > 15) {
    alerts.push({
      level: "warn",
      icon: "⚠",
      title: "Wait times are elevated",
      body:  "Average wait has exceeded 15 minutes today. Consider opening an additional counter or re-routing walk-ins.",
      value: `${Math.round(avgWaitMin)} min`,
      valueLabel: "avg wait",
    });
  }

  if (noShowPct != null && noShowPct > 20) {
    alerts.push({
      level: "warn",
      icon: "⚠",
      title: "High no-show rate",
      body:  "More than 20% of today's called customers didn't show up. Check your SMS reminders or shorten the call window.",
      value: `${Math.round(noShowPct)}%`,
      valueLabel: "no-show",
    });
  }

  if (bookingPct != null && bookingPct < 50) {
    alerts.push({
      level: "info",
      icon: "◈",
      title: "Low booking conversion",
      body:  "Fewer than half of today's pre-booked appointments were completed. Confirm bookings 30 min before their slot.",
      value: `${Math.round(bookingPct)}%`,
      valueLabel: "filled",
    });
  }

  if (data.waiting_now != null && data.waiting_now > 10) {
    alerts.push({
      level: "warn",
      icon: "⚠",
      title: "Queue is building up",
      body:  `${data.waiting_now} customers are currently waiting. If this persists, open another counter or pause new arrivals temporarily.`,
      value: `${data.waiting_now}`,
      valueLabel: "waiting",
    });
  }

  if (data.serving_now === 0 && data.waiting_now > 0) {
    alerts.push({
      level: "warn",
      icon: "⚠",
      title: "No staff currently serving",
      body:  "Customers are waiting but no counter is active. Check staff status or reopen a counter.",
      value: "0",
      valueLabel: "serving",
    });
  }

  return alerts;
}

/* ── CSV export ─────────────────────────────────────────────────────── */
function exportInsights(data, branch) {
  if (!data) return;
  const rows = [
    { metric: "Served today",       value: data.served_today ?? 0 },
    { metric: "Avg wait (min)",     value: data.avg_wait_sec != null ? Math.round(data.avg_wait_sec / 60) : "—" },
    { metric: "Avg service (min)",  value: data.avg_service_sec != null ? Math.round(data.avg_service_sec / 60) : "—" },
    { metric: "No-show rate",       value: data.no_show_rate != null ? `${Math.round(data.no_show_rate * 100)}%` : "—" },
    { metric: "Booking conversion", value: data.booking_conversion != null ? `${Math.round(data.booking_conversion * 100)}%` : "—" },
    { metric: "Peak hour",          value: data.peak_hour != null ? `${data.peak_hour}:00` : "—" },
    { metric: "Waiting now",        value: data.waiting_now ?? 0 },
    { metric: "Serving now",        value: data.serving_now ?? 0 },
  ];
  downloadCSV(
    exportFilename(branch?.slug, "insights"),
    rows,
    [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }]
  );
}
