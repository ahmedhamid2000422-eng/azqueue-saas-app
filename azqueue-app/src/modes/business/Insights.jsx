import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import { downloadCSV, exportFilename } from "../../lib/export";
import { downloadXLSX } from "../../lib/exportXlsx";
import ExportMenu from "../../components/ExportMenu";
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

  /* Which day is being shown. null = today. Yesterday was previously
     unreachable — the moment the clock rolled over, the day was gone. */
  const [day, setDay] = useState(null);

  /* What normal looks like here: the branch's own median and 75th-percentile
     wait, from its own completed visits. Null until loaded, and null forever
     if there isn't enough history — in which case the alerts fall back to
     only the ones that need no baseline at all. */
  const [baseline, setBaseline] = useState(null);
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
    /* A past day's numbers never change, so the 60s auto-refresh is pointless
       there — but the fetch itself must still happen when the day changes. */

    setLoading(true);
    const { data: payload, error } = await supabase.rpc("get_insights_payload", {
      p_branch_id: branch.id,
      p_day: day,
    });

    if (error) {
      console.error("[Insights] RPC error:", error);
      setLoading(false);
      return;
    }

    setData(payload ?? null);
    setFetchedAt(Date.now());
    setLoading(false);
  }, [branch?.id, fetchedAt, day]);

  /* Fetch on branch or day change. The 60s auto-refresh only runs for today —
     a past day's numbers are settled, so polling them is pure noise. */
  useEffect(() => {
    fetch(true);
    if (day) return;                       // past day: no polling
    timerRef.current = setInterval(() => fetch(true), STALE_MS);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id, day]);

  /* Baseline: this branch's own wait distribution. Loaded once — it moves
     over weeks, not minutes. */
  useEffect(() => {
    let off = false;
    if (!branch?.id) return;
    (async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const { data: rows } = await supabase
        .from("tickets")
        .select("created_at, called_at, status")
        .eq("branch_id", branch.id)
        .eq("status", "completed")
        .not("called_at", "is", null)
        .gte("created_at", since)
        .limit(5000);

      if (off) return;
      const waits = (rows ?? [])
        .map((t) => (new Date(t.called_at) - new Date(t.created_at)) / 60000)
        .filter((m) => m >= 0 && m < 480)
        .sort((a, b) => a - b);

      /* Below this there is no meaningful "normal" yet, and inventing one is
         how the old thresholds went wrong. */
      if (waits.length < 30) { setBaseline(null); return; }
      setBaseline({
        n: waits.length,
        median: waits[Math.floor(waits.length * 0.5)],
        p75:    waits[Math.floor(waits.length * 0.75)],
        p90:    waits[Math.floor(waits.length * 0.9)],
      });
    })();
    return () => { off = true; };
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

  /* ── Build alert cards from thresholds ─────────────────────────
     Thresholds come from this branch's OWN history, not fixed numbers. A
     15-minute wait is a crisis at a coffee counter and a normal Tuesday at a
     tax office — the old hardcoded limits meant "wait times are elevated"
     had been showing permanently since day one, which trains staff to ignore
     the whole panel. */
  const alerts = buildAlerts(data, baseline);

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
            <span className="pip breathe" />
            Live · {branch.name}
          </div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Insights</h1>
          <DayPicker day={day} setDay={setDay} tz={data?.timezone} />
          <div className="text-xs text-ink-mute mt-2">
            {loading
              ? "Fetching…"
              : fetchedAt
                ? `Updated ${Math.round((Date.now() - fetchedAt) / 1000)}s ago · refreshes every minute`
                : "Not yet loaded"}
          </div>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            disabled={!data}
            onCsv={()  => exportInsights(data, branch, "csv")}
            onXlsx={() => exportInsights(data, branch, "xlsx")}
          />
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
          Signals are measured against this branch's own history, not generic
          benchmarks. Alerts that need history stay hidden until there's enough
          of it.
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

/* ── Alert builder ────────────────────────────────────────────────────
 * Every threshold here is RELATIVE TO THIS BRANCH, computed from its own
 * completed visits (see `baseline` above). That is not a detail — the
 * previous version used fixed numbers (wait > 15 min, no-show > 20%), and at
 * a tax office where a normal wait is an hour, "wait times are elevated" was
 * lit permanently from the first day. An alert that is always on is
 * wallpaper: it teaches staff to ignore the panel, including the alerts that
 * matter.
 *
 * Alerts that need no baseline (nobody serving, queue building) always run.
 * Alerts that need one are simply omitted until there is enough history —
 * silence rather than a guess.
 */
function buildAlerts(data, baseline) {
  if (!data) return [];
  const alerts = [];

  const avgWaitMin = data.avg_wait_sec != null ? data.avg_wait_sec / 60 : null;
  const noShowPct  = data.no_show_rate != null ? data.no_show_rate * 100 : null;

  /* ── Needs no baseline: true at any business, any day ── */

  // Someone is waiting and nobody is serving. Almost always an oversight,
  // and the most expensive minute in the queue.
  if (data.serving_now === 0 && data.waiting_now > 0) {
    alerts.push({
      level: "warn", icon: "⚠",
      title: "No one is being served",
      body: "Customers are waiting but no counter is active. Call the next person, or check staff status.",
      value: `${data.waiting_now}`, valueLabel: "waiting",
    });
  }

  /* ── Needs the branch's own history ── */

  if (baseline && avgWaitMin != null) {
    // "Unusual for you" = beyond the 75th percentile of this branch's own
    // waits. By construction that fires on roughly the worst quarter of days,
    // not every day.
    if (avgWaitMin > baseline.p75) {
      const over = Math.round(((avgWaitMin - baseline.median) / Math.max(baseline.median, 1)) * 100);
      alerts.push({
        level: avgWaitMin > baseline.p90 ? "warn" : "info",
        icon: avgWaitMin > baseline.p90 ? "⚠" : "◈",
        title: "Waits are longer than usual here",
        body:
          `Today's average is about ${over}% above your normal ${Math.round(baseline.median)} minutes. ` +
          `Measured from ${baseline.n.toLocaleString()} of your own completed visits.`,
        value: `${Math.round(avgWaitMin)}m`, valueLabel: `usually ${Math.round(baseline.median)}m`,
      });
    }

    // A queue that is long relative to how fast this branch actually moves.
    if (data.waiting_now != null && baseline.median > 0) {
      const projected = data.waiting_now * (baseline.median / 4);
      if (data.waiting_now >= 5 && projected > baseline.p90) {
        alerts.push({
          level: "warn", icon: "⚠",
          title: "Queue is building faster than you're clearing it",
          body: `${data.waiting_now} people are waiting. At your usual pace the back of the queue is looking at a long wait.`,
          value: `${data.waiting_now}`, valueLabel: "waiting",
        });
      }
    }
  }

  /* No-show rate: compared to this branch's own recent rate rather than a
     fixed 20%. Without a baseline we say nothing — a first-day 50% from two
     tickets is noise, not a finding. */
  if (baseline && noShowPct != null && data.served_today >= 10 && noShowPct > 35) {
    alerts.push({
      level: "info", icon: "◈",
      title: "More people than usual didn't show",
      body: "Worth checking whether reminders are reaching people, or whether the wait is long enough that they gave up.",
      value: `${Math.round(noShowPct)}%`, valueLabel: "no-show",
    });
  }

  return alerts;
}

/* ── CSV export ─────────────────────────────────────────────────────── */
function exportInsights(data, branch, format = "csv") {
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
  const columns = [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }];

  if (format === "xlsx") {
    return downloadXLSX(exportFilename(branch?.slug, "insights", "xlsx"), rows, columns, {
      sheetName: "Insights",
      title: `Insights — ${branch?.name ?? "AzQueue"}`,
    });
  }
  downloadCSV(exportFilename(branch?.slug, "insights"), rows, columns);
}

/* ── Day picker ───────────────────────────────────────────────────────
   Yesterday used to be unreachable: the numbers were computed for "today"
   only, so a day disappeared the moment the clock rolled over. A day nobody
   can review is a day nobody can learn from. */
function DayPicker({ day, setDay, tz }) {
  const shift = (n) => {
    const base = day ? new Date(`${day}T12:00:00`) : new Date();
    base.setDate(base.getDate() + n);
    const iso = base.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    setDay(iso >= todayIso ? null : iso);   // never go past today
  };

  const label = !day
    ? "Today"
    : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short", day: "numeric", month: "short",
      });

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <button
        onClick={() => shift(-1)}
        title="Previous day"
        className="ovline text-[10px] border border-line px-2 py-1 text-ink-mute hover:text-ink transition"
      >
        ←
      </button>
      <span className="ovline text-[10px] text-gold-soft px-1 min-w-[86px] text-center">
        {label}
      </span>
      <button
        onClick={() => shift(1)}
        disabled={!day}
        title="Next day"
        className="ovline text-[10px] border border-line px-2 py-1 text-ink-mute hover:text-ink transition disabled:opacity-30"
      >
        →
      </button>
      {day && (
        <button
          onClick={() => setDay(null)}
          className="ovline text-[10px] border border-gold-deep px-2 py-1 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition ml-1"
        >
          Back to today
        </button>
      )}
      {tz && (
        <span className="text-[9px] text-ink-mute ml-1.5">
          {tz.split("/").pop().replace(/_/g, " ")} time
        </span>
      )}
    </div>
  );
}
