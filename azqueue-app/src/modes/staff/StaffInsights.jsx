import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useStaffMembership } from "../../hooks/useStaffMembership";
import Card, { CardHeader } from "../../components/Card";
import Stat from "../../components/Stat";
import Button from "../../components/Button";

/**
 * StaffInsights — branch-level queue metrics for staff members.
 *
 * Shows the same high-level numbers as the owner's Insights page,
 * so staff understand the branch's performance context.
 *
 * Deliberately omits per-staff breakdowns, rankings, and comparisons.
 * Uses the get_insights_payload RPC (same as business Insights.jsx).
 * Falls back to a simple client-side fetch if the RPC is unavailable.
 *
 * Stale time: 60 s. Manual refresh button available.
 */

const STALE_MS = 60_000;

export default function StaffInsights() {
  const { primary, loading: membershipLoading } = useStaffMembership();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const timerRef = useRef(null);

  const branchId = primary?.branch_id;

  const fetchData = useCallback(async (force = false) => {
    if (!branchId) return;
    if (!force && fetchedAt && Date.now() - fetchedAt < STALE_MS) return;

    setLoading(true);

    // Try RPC first; fall back to a lightweight client-side aggregate
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_insights_payload", {
      p_branch_id: branchId,
    });

    if (!rpcErr && rpcData) {
      setData(rpcData);
      setFetchedAt(Date.now());
      setLoading(false);
      return;
    }

    // Fallback: compute from raw tickets
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [{ data: active }, { data: done }] = await Promise.all([
      supabase.from("tickets").select("id, status")
        .eq("branch_id", branchId).in("status", ["waiting", "serving"]),
      supabase.from("tickets").select("id, status, called_at, created_at")
        .eq("branch_id", branchId).in("status", ["completed", "cancelled"])
        .gte("created_at", todayStart.toISOString()),
    ]);

    const completed = (done ?? []).filter((t) => t.status === "completed");
    const cancelled = (done ?? []).filter((t) => t.status === "cancelled");
    const waitSamples = completed.filter((t) => t.called_at && t.created_at);
    const avgWaitSec = waitSamples.length
      ? waitSamples.reduce((s, t) => s + (new Date(t.called_at) - new Date(t.created_at)) / 1000, 0) / waitSamples.length
      : null;
    const total = completed.length + cancelled.length;

    setData({
      served_today:       completed.length,
      avg_wait_sec:       avgWaitSec,
      avg_service_sec:    null,
      no_show_rate:       total > 0 ? cancelled.length / total : null,
      booking_conversion: null,
      peak_hour:          null,
      waiting_now:        (active ?? []).filter((t) => t.status === "waiting").length,
      serving_now:        (active ?? []).filter((t) => t.status === "serving").length,
    });
    setFetchedAt(Date.now());
    setLoading(false);
  }, [branchId, fetchedAt]);

  useEffect(() => {
    fetchData(true);
    timerRef.current = setInterval(() => fetchData(true), STALE_MS);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function fmtMin(sec) {
    if (sec == null) return "—";
    const m = Math.round(sec / 60);
    return m < 1 ? "<1 min" : `${m} min`;
  }
  function fmtPct(rate) {
    if (rate == null) return "—";
    return `${Math.round(rate * 100)}%`;
  }

  if (membershipLoading) {
    return <div className="p-8 text-ink-mute ovline">Loading…</div>;
  }

  return (
    <div className="atmosphere-hero p-8 max-w-4xl">
      <header className="mb-6 flex justify-between items-start">
        <div>
          <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
            <span className="pip breathe" /> Branch performance
          </div>
          <h1 className="font-display text-3xl font-light tracking-tightest">Insights</h1>
          <div className="text-xs text-ink-mute mt-1">
            {loading
              ? "Fetching…"
              : fetchedAt
                ? `Updated ${Math.round((Date.now() - fetchedAt) / 1000)}s ago · refreshes every minute`
                : ""}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={loading}>
          ↻ Refresh
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Served today"  value={loading ? "…" : data?.served_today ?? 0}     hint="Completed"       accent />
        <Stat label="Avg wait"      value={loading ? "…" : fmtMin(data?.avg_wait_sec)}   hint="Created → called" />
        <Stat label="No-show rate"  value={loading ? "…" : fmtPct(data?.no_show_rate)}   hint="of today's visits" />
        <Stat label="Avg service"   value={loading ? "…" : fmtMin(data?.avg_service_sec)} hint="Called → done" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Stat label="Waiting now"   value={loading ? "…" : data?.waiting_now ?? 0}       hint="In queue" />
        <Stat label="Serving now"   value={loading ? "…" : data?.serving_now ?? 0}       hint="At counters" />
      </div>

      {/* Context note */}
      <Card luxe>
        <CardHeader
          title="About these numbers"
          subtitle="Branch totals for today"
        />
        <div className="px-5 py-6 text-sm text-ink-soft leading-relaxed space-y-3">
          <p>
            These figures cover the whole branch today — all staff, all counters.
            They help you understand how busy the branch is and whether customers are waiting a long time.
          </p>
          <p className="text-ink-mute text-xs italic">
            Individual staff comparisons are not shown here. The goal is shared context, not rankings.
          </p>
        </div>
      </Card>
    </div>
  );
}
