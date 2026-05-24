import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import Card, { CardHeader } from "../components/Card";
import Stat from "../components/Stat";
import Button from "../components/Button";

/**
 * Platform admin dashboard — for AzQueue's own operators (you).
 *
 * Shows: total users + branches + tickets, signup mode + tier breakdowns,
 * a 30-day signup trend chart, recent signups list, top branches by activity.
 *
 * Backed by the admin-stats edge function which uses the service role
 * after verifying user_metadata.platform_admin === true.
 *
 * Hidden by default; only accessible if the signed-in user is an admin.
 * To flag yourself, run in Supabase SQL:
 *   update auth.users
 *      set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
 *                             || '{"platform_admin": true}'::jsonb
 *    where email = 'you@example.com';
 * Then sign out and back in — the JWT refresh picks up the new metadata.
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick client-side admin check — server enforces this too
  const isAdmin = user?.user_metadata?.platform_admin === true;

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
  }, [isAdmin]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: e } = await supabase.functions.invoke("admin-stats", {
        body: {},
      });
      if (e) throw new Error(e.message);
      if (!result?.ok) throw new Error(result?.error ?? "Request failed");
      setData(result);
    } catch (err) {
      setError(err?.message ?? "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <NotAdmin />;

  const totals = data?.totals ?? { users: 0, branches: 0, tickets: 0, bookings: 0, staff: 0 };
  const modeBreakdown = data?.modeBreakdown ?? { business: 0, personal: 0 };
  const tierBreakdown = data?.tierBreakdown ?? {};
  const trend = data?.signupTrend ?? [];
  const recent = data?.recentSignups ?? [];
  const topBranches = data?.topBranches ?? [];

  return (
    <div className="atmosphere-hero atmosphere-prayer min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-start mb-8">
          <div>
            <div className="ovline mb-2 text-gold-soft">Platform · admin</div>
            <h1 className="font-display text-4xl font-light tracking-tightest">AzQueue Operator</h1>
            <div className="text-xs text-ink-soft mt-2">
              <span className="pip breathe mr-2 inline-block" />
              Signed in as <span className="text-ink">{user.email}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/business"><Button variant="ghost" size="sm">Exit admin</Button></Link>
            <Button variant="ghost" size="sm" onClick={refresh}>↻ Refresh</Button>
          </div>
        </header>

        {error && (
          <div className="mb-3 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
            {error}
          </div>
        )}

        {/* Top KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          <Stat label="Total users"    value={totals.users}    hint="All-time signups" accent />
          <Stat label="Businesses"     value={modeBreakdown.business} hint="Signed up business mode" />
          <Stat label="Personal"       value={modeBreakdown.personal} hint="Signed up personal flow" />
          <Stat label="Branches"       value={totals.branches} hint="Active service locations" />
          <Stat label="Tickets · all"  value={totals.tickets}  hint="Customers served lifetime" />
        </div>

        {/* Tier breakdown + trend chart */}
        <div className="grid grid-cols-12 gap-3 mb-3">
          <Card luxe className="col-span-12 lg:col-span-4 p-6">
            <div className="ovline text-gold-soft mb-3">Plan distribution</div>
            <h2 className="font-display text-2xl font-light tracking-tighter mb-5">Who's on what tier.</h2>
            <div className="space-y-3">
              {[
                ["Essential",    tierBreakdown.essential,    "#8a7246"],
                ["Professional", tierBreakdown.professional, "#c9a86a"],
                ["Executive",    tierBreakdown.executive,    "#e4cb95"],
                ["Manager",      tierBreakdown.manager,      "#9bbd9b"],
              ].map(([label, count = 0, color]) => {
                const total = Math.max(1, modeBreakdown.business);
                const pct = (count / total) * 100;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-ink-soft">{label}</span>
                      <span className="font-mono text-ink">{count}</span>
                    </div>
                    <div className="h-1 bg-line">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
            <div className="text-[10px] text-ink-mute">Personal Flow signups not shown — they don't have tiers yet.</div>
          </Card>

          <Card luxe className="col-span-12 lg:col-span-8 p-6">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="ovline text-gold-soft mb-2">Signup trend · last 30 days</div>
                <h2 className="font-display text-2xl font-light tracking-tighter">
                  {trend.reduce((s, t) => s + t.count, 0)} <em className="not-italic gold-text-soft">new signups</em>
                </h2>
              </div>
              <span className="ovline text-[9px] text-ink-mute">Daily</span>
            </div>
            <SignupChart trend={trend} />
            <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
            <div className="text-[10px] text-ink-mute">Bars represent users created per day. Gold = above average for the period.</div>
          </Card>
        </div>

        {/* Recent signups + top branches */}
        <div className="grid grid-cols-12 gap-3">
          <Card luxe className="col-span-12 lg:col-span-7">
            <CardHeader title="Recent signups" right={<span className="ovline text-[9px]">{recent.length}</span>} />
            {loading ? (
              <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
            ) : recent.length === 0 ? (
              <div className="px-5 py-10 text-center text-ink-mute text-xs">No signups yet.</div>
            ) : recent.map((u) => (
              <div key={u.id} className="px-5 py-3 border-b border-line last:border-b-0 grid grid-cols-[1fr_80px_100px] gap-3 items-center">
                <div>
                  <div className="text-xs text-ink truncate">{u.email}</div>
                  <div className="text-[10px] text-ink-mute mt-0.5 truncate">
                    {u.business_name ?? u.display_name ?? "—"}
                  </div>
                </div>
                <span className={`text-[9px] uppercase tracking-[0.18em] ${u.mode === "personal" ? "text-[#9bbd9b]" : "text-gold-soft"}`}>
                  {u.mode}
                </span>
                <span className="text-[10px] text-ink-mute font-mono text-right">
                  {fmtAgo(u.created_at)}
                </span>
              </div>
            ))}
          </Card>

          <Card luxe className="col-span-12 lg:col-span-5">
            <CardHeader title="Top branches · 30d" subtitle="By tickets served" />
            {topBranches.length === 0 ? (
              <div className="px-5 py-10 text-center text-ink-mute text-xs">No branch activity yet.</div>
            ) : topBranches.map((b, i) => (
              <div key={b.id} className="px-5 py-3 border-b border-line last:border-b-0 grid grid-cols-[24px_1fr_60px] gap-3 items-center">
                <span className="ovline text-[8px] text-ink-mute">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-xs text-ink truncate">{b.name}</div>
                  <div className="text-[10px] text-ink-mute mt-0.5 font-mono">/q/{b.slug}</div>
                </div>
                <span className="font-display text-base text-right gold-text-soft">{b.tickets_30d}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Trend bar chart (no library) ──────────────────────────────────── */
function SignupChart({ trend }) {
  if (!trend.length) return null;
  const max = Math.max(...trend.map((t) => t.count), 1);
  const avg = trend.reduce((s, t) => s + t.count, 0) / trend.length;

  return (
    <div className="grid items-end gap-px" style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))`, height: "120px" }}>
      {trend.map((t) => {
        const h = Math.max(2, (t.count / max) * 100);
        const above = t.count > avg;
        return (
          <div
            key={t.day}
            className="relative group"
            style={{ height: "100%" }}
            title={`${t.day} · ${t.count}`}
          >
            <div
              className="absolute bottom-0 left-0 right-0 transition-all"
              style={{
                height: `${h}%`,
                background: above ? "#c9a86a" : "#8a7246",
                opacity: t.count === 0 ? 0.2 : 1,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function NotAdmin() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-8">
      <Card luxe className="p-10 max-w-md text-center">
        <div className="ovline text-[#d49185] mb-3">Restricted</div>
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">
          Admin only.
        </h1>
        <p className="text-ink-soft text-sm mb-6">
          This area is for AzQueue platform operators. If you're an operator, flag your account in Supabase SQL:
        </p>
        <pre className="bg-bg-elev border border-line p-4 text-[10px] text-gold-soft text-left font-mono whitespace-pre-wrap leading-relaxed">{`update auth.users
   set raw_user_meta_data =
     coalesce(raw_user_meta_data, '{}'::jsonb)
     || '{"platform_admin": true}'::jsonb
 where email = 'you@example.com';`}</pre>
        <div className="text-[10px] text-ink-mute mt-3">Then sign out and back in to refresh your token.</div>
        <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
        <Link to="/"><Button variant="ghost" size="sm">Back to home</Button></Link>
      </Card>
    </div>
  );
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
