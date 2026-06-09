import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import Card, { CardHeader } from "../../components/Card";
import Badge from "../../components/Badge";

/**
 * Leads — WhatsApp AI Receptionist lead inbox.
 *
 * Shows every customer acquired via the WhatsApp bot, sorted by lead score.
 * Accessible to all business types (queue/tax, gym, design) via the "Leads" nav item.
 */

const SCORE_ORDER = { HOT: 0, WARM: 1, COLD: 2, null: 3 };

const SCORE_META = {
  HOT:  { label: "🔥 Hot",  tone: "text-[#e8845a]",  border: "border-[#c05a32]/40", bg: "bg-[#c05a32]/10" },
  WARM: { label: "🌡 Warm", tone: "text-[#d4a959]",  border: "border-[#b8893d]/40", bg: "bg-[#b8893d]/10" },
  COLD: { label: "❄️ Cold", tone: "text-[#74b9e8]",  border: "border-[#4a8ab5]/40", bg: "bg-[#4a8ab5]/10" },
};

const ACTION_TONE = {
  "Book consultation": "text-[#9bbd9b]",
  "Send estimate":     "text-gold-soft",
  "Follow up":         "text-[#d4a959]",
  "Nurture":           "text-ink-mute",
};

const FILTERS = ["All", "HOT", "WARM", "COLD"];

export default function Leads() {
  const { branch } = useBranch();
  const [customers, setCustomers] = useState([]);
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null); // customer id for detail panel

  async function load() {
    if (!branch?.id) return;
    setLoading(true);

    const [{ data: custs }, { data: convRows }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone, lead_score, lead_source, lead_data, created_at")
        .eq("branch_id", branch.id)
        .eq("lead_source", "whatsapp")
        .order("created_at", { ascending: false }),
      supabase
        .from("wa_conversations")
        .select("id, wa_from, state, context, lead_score, completed, created_at, updated_at")
        .eq("branch_id", branch.id)
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);

    setCustomers(custs ?? []);
    setConvs(convRows ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [branch?.id]);

  // Realtime — refresh when new conversations come in
  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`leads-${branch.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations", filter: `branch_id=eq.${branch.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers",        filter: `branch_id=eq.${branch.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [branch?.id]);

  const sorted = useMemo(() => {
    return [...customers]
      .filter(c => filter === "All" || c.lead_score === filter)
      .sort((a, b) => (SCORE_ORDER[a.lead_score] ?? 3) - (SCORE_ORDER[b.lead_score] ?? 3));
  }, [customers, filter]);

  const counts = useMemo(() => {
    const out = { HOT: 0, WARM: 0, COLD: 0 };
    for (const c of customers) if (c.lead_score) out[c.lead_score] = (out[c.lead_score] ?? 0) + 1;
    return out;
  }, [customers]);

  const selectedCustomer = selected ? customers.find(c => c.id === selected) : null;
  const customerConvs = selected
    ? convs.filter(c => c.wa_from === selectedCustomer?.phone)
    : [];

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-light tracking-tightest gold-text mb-1">WhatsApp Leads</h1>
          <p className="text-ink-mute text-xs">
            {branch?.name} · AI-qualified leads from your WhatsApp receptionist
          </p>
        </div>

        {/* Score summary pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {["HOT", "WARM", "COLD"].map(s => {
            const m = SCORE_META[s];
            return (
              <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] ${m.border} ${m.bg}`}>
                <span className={`font-display ${m.tone}`}>{m.label}</span>
                <span className="text-ink-mute">({counts[s] ?? 0})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 border text-[10px] tracking-wide transition ${
                active ? "border-gold bg-[rgba(201,168,106,0.08)] text-gold-soft" : "border-line text-ink-soft hover:border-[#3a3a3f]"
              }`}
            >
              {f === "All" ? `All leads (${customers.length})` : `${SCORE_META[f].label} (${counts[f] ?? 0})`}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-ink-mute text-xs py-12 text-center">Loading leads…</div>
      ) : customers.length === 0 ? (
        <EmptyState branch={branch} />
      ) : (
        <div className="flex gap-5">
          {/* Lead list */}
          <div className="flex-1 min-w-0 space-y-2">
            {sorted.length === 0 ? (
              <div className="text-ink-mute text-xs py-8 text-center">No leads in this category yet.</div>
            ) : sorted.map(c => (
              <LeadCard
                key={c.id}
                customer={c}
                active={selected === c.id}
                onClick={() => setSelected(selected === c.id ? null : c.id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selectedCustomer && (
            <div className="w-80 shrink-0">
              <LeadDetail customer={selectedCustomer} convs={customerConvs} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({ customer: c, active, onClick }) {
  const score = c.lead_score;
  const meta  = SCORE_META[score] ?? { label: "—", tone: "text-ink-mute", border: "border-line", bg: "" };
  const data  = c.lead_data ?? {};
  const actionTone = ACTION_TONE[data.next_action] ?? "text-ink-mute";
  const when = new Date(c.created_at).toLocaleDateString([], { day: "numeric", month: "short" });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border transition ${
        active ? "border-gold/50 bg-[rgba(201,168,106,0.04)]" : "border-line hover:border-[#3a3a3f]"
      }`}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Score badge */}
        <div className={`mt-0.5 shrink-0 px-2 py-0.5 border text-[9px] tracking-wide ${meta.border} ${meta.bg} ${meta.tone}`}>
          {meta.label}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-display text-sm font-light text-ink truncate">{c.name || c.phone}</span>
            <span className="text-[10px] text-ink-mute shrink-0">{when}</span>
          </div>

          {data.service_category && (
            <div className="text-[11px] text-ink-soft mt-0.5 truncate">{data.service_category}</div>
          )}

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {data.location && (
              <span className="text-[10px] text-ink-mute">📍 {data.location}</span>
            )}
            {data.budget_range && (
              <span className="text-[10px] text-ink-mute">💰 {data.budget_range}</span>
            )}
            {data.timeline && (
              <span className="text-[10px] text-ink-mute">⏱ {data.timeline}</span>
            )}
          </div>

          {data.next_action && (
            <div className={`text-[9px] mt-1.5 tracking-wide uppercase ${actionTone}`}>
              → {data.next_action}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Lead detail panel ─────────────────────────────────────────────────────────

function LeadDetail({ customer: c, convs, onClose }) {
  const data  = c.lead_data ?? {};
  const score = c.lead_score;
  const meta  = SCORE_META[score] ?? { label: "—", tone: "text-ink-mute", border: "border-line", bg: "" };

  return (
    <Card luxe className="p-0 sticky top-6 overflow-hidden">
      <CardHeader
        title={c.name || c.phone}
        subtitle={c.phone}
        right={
          <button onClick={onClose} className="text-ink-mute hover:text-ink text-sm transition">✕</button>
        }
      />
      <div className="p-5 space-y-4">
        {/* Score */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] ${meta.border} ${meta.bg} ${meta.tone}`}>
          {meta.label}
          {data.next_action && <span className="text-ink-mute">· {data.next_action}</span>}
        </div>

        {/* Lead data grid */}
        <div className="space-y-2">
          {[
            ["Service",    data.service_category],
            ["Property",   data.property_type],
            ["Location",   data.location],
            ["Budget",     data.budget_range],
            ["Timeline",   data.timeline],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-[10px] text-ink-mute w-16 shrink-0 pt-0.5">{label}</span>
              <span className="text-[11px] text-ink-soft">{value}</span>
            </div>
          ))}
        </div>

        {/* Requirements */}
        {data.requirements && data.requirements.toLowerCase() !== "skip" && (
          <div className="border border-line p-3">
            <div className="ovline text-[9px] mb-1">Requirements</div>
            <p className="text-[11px] text-ink-soft leading-relaxed">{data.requirements}</p>
          </div>
        )}

        {/* AI summary */}
        {data.summary && (
          <div className="border border-gold/20 bg-[rgba(201,168,106,0.04)] p-3">
            <div className="ovline text-[9px] text-gold-soft mb-1">AI summary</div>
            <p className="text-[11px] text-ink-soft leading-relaxed">{data.summary}</p>
          </div>
        )}

        {/* Conversation history */}
        {convs.length > 0 && (
          <div>
            <div className="ovline text-[9px] mb-2">Conversation history</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {convs.map(conv => (
                <div key={conv.id} className="border border-line px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] uppercase tracking-wide ${conv.completed ? "text-[#9bbd9b]" : "text-[#d4a959]"}`}>
                      {conv.completed ? "Completed" : "Active"}
                    </span>
                    <span className="text-[9px] text-ink-mute">
                      {new Date(conv.updated_at).toLocaleDateString([], { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  {conv.lead_score && (
                    <div className={`text-[9px] mt-0.5 ${SCORE_META[conv.lead_score]?.tone ?? "text-ink-mute"}`}>
                      {conv.lead_score} lead
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <a
          href={`https://wa.me/${(c.phone ?? "").replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center py-2.5 border border-[#25d366]/40 text-[11px] text-[#25d366] hover:bg-[#25d366]/10 transition"
        >
          Open in WhatsApp ↗
        </a>
      </div>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ branch }) {
  return (
    <Card luxe className="p-10 text-center max-w-lg mx-auto">
      <div className="font-display text-5xl mb-4 opacity-30">💬</div>
      <div className="ovline text-gold-soft mb-2">No leads yet</div>
      <h2 className="font-display text-xl font-light text-ink mb-3">
        Your WhatsApp receptionist is ready
      </h2>
      <p className="text-ink-soft text-sm leading-relaxed mb-5">
        Once you enable WhatsApp in Settings and share your number, every incoming
        message will be automatically qualified and appear here.
      </p>
      <div className="text-left border border-line p-4 space-y-2 text-[11px] text-ink-mute">
        <div>1. Go to <span className="text-gold-soft">Settings → WhatsApp</span></div>
        <div>2. Enable the receptionist and enter your WhatsApp number</div>
        <div>3. Set your Twilio webhook to your Supabase Edge Function URL</div>
        <div>4. Share your WhatsApp number with clients</div>
      </div>
    </Card>
  );
}
