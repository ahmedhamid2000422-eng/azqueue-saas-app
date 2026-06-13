import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import { downloadCSV, exportFilename } from "../../lib/export";
import Card, { CardHeader } from "../../components/Card";
import Stat from "../../components/Stat";
import Button from "../../components/Button";

/**
 * Reviews — owner-side view of customer survey submissions.
 * Reads from public.surveys (RLS-scoped to branch members).
 *
 * Computed metrics (last 30 days):
 *   · count, average rating
 *   · 1-5 star distribution
 *   · trend (this week vs last week)
 *   · recent feedback list with full text
 */
export default function Reviews() {
  const { branch, dbReady } = useBranch();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  async function load() {
    if (!branch?.id) return;
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate() - days);
    const { data } = await supabase
      .from("surveys")
      .select("*")
      .eq("branch_id", branch.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    setSurveys(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [branch?.id, days]);

  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`reviews-${branch.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "surveys", filter: `branch_id=eq.${branch.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch?.id]);

  /* ── Derived metrics ──────────────────────────────────────── */
  const total = surveys.length;
  const avgRating = useMemo(() => {
    if (!surveys.length) return null;
    return surveys.reduce((s, r) => s + (r.rating || 0), 0) / surveys.length;
  }, [surveys]);

  const distribution = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of surveys) {
      if (s.rating >= 1 && s.rating <= 5) dist[s.rating]++;
    }
    return dist;
  }, [surveys]);

  // Week-over-week trend
  const weekDelta = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const recent = surveys.filter((s) => new Date(s.created_at).getTime() > now - week);
    const prior  = surveys.filter((s) => {
      const t = new Date(s.created_at).getTime();
      return t <= now - week && t > now - 2 * week;
    });
    const avg = (arr) => arr.length ? arr.reduce((s, r) => s + r.rating, 0) / arr.length : null;
    const a = avg(recent), b = avg(prior);
    if (a == null || b == null) return null;
    return a - b;
  }, [surveys]);

  if (!dbReady) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Reviews</h1>
        <p className="text-ink-soft text-sm">Run the database migrations to enable reviews.</p>
      </div>
    );
  }
  if (!branch) return <div className="p-8 text-ink-mute ovline">Select a branch.</div>;

  const surveyUrl = `${window.location.origin}/survey/${branch.slug}`;

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="flex justify-between items-start mb-8 gap-4">
        <div>
          <div className="ovline mb-2 text-gold-soft">Live · customer feedback</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Reviews</h1>
          <div className="text-xs text-ink-soft mt-2">
            <span className="pip breathe mr-2 inline-block" />
            {loading ? "Loading…" : `${total} submission${total === 1 ? "" : "s"} in last ${days} days`}
            <span className="text-ink-mute"> · {branch.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="bg-bg-elev border border-line text-xs px-3 py-1.5 outline-none focus:border-gold-deep"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => exportReviews(surveys, branch)} disabled={total === 0}>
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={load}>↻ Refresh</Button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat
          label="Average"
          value={avgRating != null ? `${avgRating.toFixed(2)} ★` : "—"}
          hint={weekDelta != null ? `${weekDelta >= 0 ? "+" : ""}${weekDelta.toFixed(2)} vs last week` : "Need more data"}
          accent
        />
        <Stat label="Total"       value={total} hint={`Last ${days} days`} />
        <Stat label="5-star"      value={distribution[5]} hint={total ? `${Math.round(distribution[5] / total * 100)}% of all` : "—"} />
        <Stat label="1 or 2 star" value={distribution[1] + distribution[2]} hint="Needs attention" />
      </div>

      {/* Distribution + share */}
      <div className="grid grid-cols-12 gap-3 mb-3">
        <Card luxe className="col-span-12 lg:col-span-7 p-6">
          <div className="ovline text-gold-soft mb-3">Rating distribution</div>
          <h2 className="font-display text-2xl font-light tracking-tighter mb-5">
            How customers are <em className="not-italic gold-text-soft">rating you.</em>
          </h2>
          {total === 0 ? (
            <div className="text-ink-mute text-xs italic">No submissions yet — share your survey link below.</div>
          ) : (
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = distribution[stars];
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <div key={stars} className="grid grid-cols-[60px_1fr_60px] gap-3 items-center">
                    <span className="text-gold-soft font-mono text-sm">{stars} ★</span>
                    <div className="h-2 bg-line">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: stars >= 4 ? "#c9a86a" : stars === 3 ? "#8a7246" : "#b56b5f",
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-ink-mute font-mono text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card luxe variant="sage" className="col-span-12 lg:col-span-5 p-6">
          <div className="ovline text-[#9bbd9b] mb-3">Share your survey</div>
          <h2 className="font-display text-2xl font-light tracking-tighter mb-4">
            Ask for feedback.
          </h2>
          <p className="text-ink-soft text-xs leading-relaxed mb-4">
            Customers automatically see a rating prompt after each visit. Share this link to collect more feedback anytime.
          </p>
          <div className="bg-bg border border-line p-3 font-mono text-[10px] text-gold-soft break-all mb-4">
            {surveyUrl}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigator.clipboard?.writeText(surveyUrl)}>Copy link</Button>
            <a href="/business/display" className="text-[10px] tracking-[0.18em] uppercase text-[#9bbd9b] hover:text-ink self-center">
              Print QR poster →
            </a>
          </div>
        </Card>
      </div>

      {/* Feed */}
      <Card luxe>
        <CardHeader
          title="Recent feedback"
          subtitle="Newest first · anonymous submissions show no phone"
          right={<span className="ovline text-[9px]">{surveys.length}</span>}
        />
        {loading ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
        ) : surveys.length === 0 ? (
          <div className="px-5 py-12 text-center text-ink-mute text-xs">
            No survey submissions in this window. Share your link to collect feedback.
          </div>
        ) : surveys.map((s) => <ReviewRow key={s.id} survey={s} />)}
      </Card>
    </div>
  );
}

function ReviewRow({ survey }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < survey.rating);
  return (
    <div className="px-5 py-4 border-b border-line last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="text-base tracking-wider" style={{ color: "#e4cb95" }}>
            {stars.map((on, i) => (
              <span key={i} style={{ color: on ? "#e4cb95" : "#3a3a3a" }}>★</span>
            ))}
          </div>
          <span className="text-[10px] text-ink-mute uppercase tracking-[0.18em]">
            {survey.is_anonymous ? "Anonymous" : (survey.customer_phone ?? "—")}
          </span>
        </div>
        <span className="text-[10px] text-ink-mute font-mono">
          {fmtAgo(survey.created_at)}
        </span>
      </div>
      {survey.feedback && (
        <p className="text-sm text-ink-soft leading-relaxed">{survey.feedback}</p>
      )}
    </div>
  );
}

function exportReviews(surveys, branch) {
  const rows = surveys.map((s) => ({
    date: new Date(s.created_at).toLocaleString(),
    rating: s.rating,
    feedback: s.feedback ?? "",
    phone: s.is_anonymous ? "(anonymous)" : (s.customer_phone ?? ""),
  }));
  downloadCSV(exportFilename(branch?.slug, "reviews"), rows, [
    { key: "date",    label: "Date" },
    { key: "rating",  label: "Rating" },
    { key: "feedback", label: "Feedback" },
    { key: "phone",    label: "Phone" },
  ]);
}

function fmtAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
