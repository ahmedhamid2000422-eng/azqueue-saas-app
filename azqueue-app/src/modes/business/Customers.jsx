import { useCallback, useEffect, useState } from "react";
import { useBranch } from "../../lib/BranchContext";
import { useAuth } from "../../lib/AuthContext";
import { supabase } from "../../lib/supabase";
import { getLimits } from "../../lib/tier";
import TierGate from "../../components/TierGate";
import Button from "../../components/Button";
import {
  loadCustomers,
  loadCustomerProfile,
  addNote,
  deleteNote,
  updateCustomer,
  deleteCustomer,
  generateSummary,
  generatePersona,
  freshdeskUrl,
  findOrCreateCustomer,
} from "../../lib/customers";
import {
  loadChannelConnections,
  sendMessage,
  generateAiReply,
} from "../../lib/messaging";
import { scoreEmoji, scoreColour } from "../../lib/satisfaction";
import {
  getCustomerCard,
  getCardEvents,
  addBonusPunch,
  redeemReward,
  punchDots,
  hasUnclaimedReward,
  getLoyaltyProgram,
} from "../../lib/loyalty";

/**
 * Customers — unified identity + conversation timeline.
 *
 * Left panel:  searchable customer list, most recently seen first.
 * Right panel: selected customer — AI summary card, full event timeline,
 *              internal notes, Freshworks deep-link.
 *
 * Channel events are normalized — staff see one thread regardless of
 * whether a customer walked in, messaged on Facebook, or sent a WhatsApp.
 */
export default function Customers() {
  return (
    <TierGate
      requires="professional"
      feature="Customer Profiles"
      reason="Build a unified profile for every customer — queue history, channel conversations, AI summaries, and staff notes in one place."
    >
      <CustomersInner />
    </TierGate>
  );
}

// ── Channel helpers ───────────────────────────────────────────────────

const CHANNEL_LABEL = {
  queue:     "Queue",
  facebook:  "Facebook",
  instagram: "Instagram",
  whatsapp:  "WhatsApp",
  email:     "Email",
  freshdesk: "Freshdesk",
  manual:    "Manual",
};

const CHANNEL_COLOR = {
  queue:     "text-[#9bbd9b] border-[#506b50]",
  facebook:  "text-blue-400 border-blue-800",
  instagram: "text-pink-400 border-pink-800",
  whatsapp:  "text-emerald-400 border-emerald-800",
  email:     "text-sky-400 border-sky-800",
  freshdesk: "text-orange-400 border-orange-800",
  manual:    "text-ink-mute border-line",
};

const EVENT_ICON = {
  queue_join:     "→",
  queue_serve:    "◎",
  queue_complete: "✓",
  message:        "✉",
  ticket_open:    "⚑",
  ticket_resolve: "✓",
  note:           "✎",
};

const SENTIMENT_COLOR = {
  positive:   "text-[#9bbd9b]",
  neutral:    "text-ink-soft",
  negative:   "text-orange-400",
  frustrated: "text-red-400",
};

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


// ── Marketing insights derived from event history ─────────────────────

/**
 * Compute visit-level marketing insights from a customer's event array.
 * All pure computation — no extra Supabase calls needed.
 */
function customerInsights(events = []) {
  if (!events.length) return null;

  // Only count real queue visits (join + complete)
  const visits = events.filter(
    (e) => e.channel === "queue" && (e.event_type === "queue_join" || e.event_type === "queue_complete")
  );

  const now = new Date();

  // ── Visit frequency ──────────────────────────────────────────────────
  const visitDates = [
    ...new Set(
      visits.map((e) => new Date(e.created_at).toLocaleDateString())
    ),
  ].sort();
  const totalVisits = visitDates.length;

  // Days since first and last visit
  const firstVisit = visits.length ? new Date(visits[visits.length - 1].created_at) : null;
  const lastVisit  = visits.length ? new Date(visits[0].created_at) : null;
  const daysSinceLast = lastVisit ? Math.round((now - lastVisit) / 86400000) : null;
  const spanDays = (firstVisit && lastVisit) ? Math.round((lastVisit - firstVisit) / 86400000) + 1 : 1;

  // Avg visits per month
  const avgPerMonth = spanDays >= 7
    ? parseFloat(((totalVisits / spanDays) * 30).toFixed(1))
    : null;

  // ── Service breakdown ────────────────────────────────────────────────
  const serviceCounts = {};
  for (const e of visits) {
    // Service is in content like "Joined queue — ticket #3 · Immigration"
    const match = e.content?.match(/·\s*(.+)$/);
    const svc = match ? match[1].trim() : (e.metadata?.service ?? "General");
    serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
  }
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // ── Wait time stats (from imported metadata) ─────────────────────────
  const waitSamples = events
    .map((e) => e.metadata?.wait_seconds)
    .filter((v) => typeof v === "number" && v >= 0);
  const avgWaitMin = waitSamples.length
    ? Math.round(waitSamples.reduce((a, b) => a + b, 0) / waitSamples.length / 60)
    : null;
  const maxWaitMin = waitSamples.length
    ? Math.round(Math.max(...waitSamples) / 60)
    : null;

  // ── Retention risk ───────────────────────────────────────────────────
  let retentionRisk = "low";
  let riskReason = "";

  if (daysSinceLast === null) {
    retentionRisk = "unknown";
  } else if (daysSinceLast > 90) {
    retentionRisk = "high";
    riskReason = `No visit in ${daysSinceLast} days`;
  } else if (daysSinceLast > 45) {
    retentionRisk = "medium";
    riskReason = `Last seen ${daysSinceLast} days ago`;
  } else if (totalVisits === 1) {
    retentionRisk = "medium";
    riskReason = "One-time visitor — no repeat yet";
  } else {
    retentionRisk = "low";
    riskReason = `Active — visited ${daysSinceLast}d ago`;
  }

  return {
    totalVisits,
    daysSinceLast,
    avgPerMonth,
    topServices,
    avgWaitMin,
    maxWaitMin,
    retentionRisk,
    riskReason,
    firstVisit,
    lastVisit,
  };
}

// ── CSV export ────────────────────────────────────────────────────────

function downloadCustomersCSV(customers, branch) {
  if (!customers?.length) return;
  const headers = ["Name", "Phone", "Email", "Tags", "VIP", "Last Visit", "Member Since"];
  const rows = customers.map((c) => [
    c.display_name ?? "",
    c.phone ?? "",
    c.email ?? "",
    (c.tags ?? []).join("; "),
    c.vip ? "Yes" : "No",
    c.last_seen_at ? new Date(c.last_seen_at).toLocaleDateString() : "",
    c.created_at   ? new Date(c.created_at).toLocaleDateString()   : "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${branch?.name ?? "customers"}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Inner component ───────────────────────────────────────────────────

function CustomersInner() {
  const { branch } = useBranch();
  const { user }   = useAuth();
  const limits     = getLimits(user);
  const aiEnabled  = limits.customerAi;

  // List state
  const [customers,   setCustomers]   = useState([]);
  const [search,      setSearch]      = useState("");
  const [listLoading, setListLoading] = useState(true);

  // Profile state
  const [selected,    setSelected]    = useState(null); // customer id
  const [profile,     setProfile]     = useState(null); // full profile object
  const [profLoading, setProfLoading] = useState(false);

  // Note form
  const [noteText,   setNoteText]   = useState("");
  const [noteBusy,   setNoteBusy]   = useState(false);

  // AI
  const [aiBusy,     setAiBusy]     = useState(false);
  const [personaBusy, setPersonaBusy] = useState(false);

  // Composer
  const [composeChannel,  setComposeChannel]  = useState("manual");
  const [composeText,     setComposeText]     = useState("");
  const [composeBusy,     setComposeBusy]     = useState(false);
  const [composeResult,   setComposeResult]   = useState(null); // { sent, manual }
  const [connections,     setConnections]     = useState({});   // channel → { status }
  const [aiDraftBusy,     setAiDraftBusy]     = useState(false);

  const [error,      setError]      = useState(null);

  // Loyalty card
  const [loyaltyCard,   setLoyaltyCard]   = useState(null);
  const [loyaltyEvents, setLoyaltyEvents] = useState([]);
  const [loyaltyBusy,   setLoyaltyBusy]  = useState(false);

  // Add-customer form
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [addName,      setAddName]      = useState("");
  const [addPhone,     setAddPhone]     = useState("");
  const [addEmail,     setAddEmail]     = useState("");
  const [addBusy,      setAddBusy]      = useState(false);
  const [addError,     setAddError]     = useState(null);

  // Tag filter (left panel) + tag editor (profile)
  const [tagFilter,  setTagFilter]  = useState(null);  // null = all
  const [tagDraft,   setTagDraft]   = useState("");

  // Gym mode — student attendance history
  const [studentBookings, setStudentBookings] = useState([]);

  // ── Load student bookings (gym mode) ───────────────────────────────

  useEffect(() => {
    if (!selected || branch?.business_type !== "gym") {
      setStudentBookings([]);
      return;
    }
    supabase
      .from("bookings")
      .select("id, service_name, scheduled_at, status, confirmed_at")
      .eq("customer_id", selected)
      .order("scheduled_at", { ascending: false })
      .limit(40)
      .then(({ data }) => setStudentBookings(data ?? []));
  }, [selected, branch?.business_type]);

  // ── Load list ───────────────────────────────────────────────────────

  const reloadList = useCallback(async () => {
    if (!branch?.id) return;
    setListLoading(true);
    try {
      const data = await loadCustomers(branch.id, { search });
      setCustomers(data);
    } finally {
      setListLoading(false);
    }
  }, [branch?.id, search]);

  useEffect(() => { reloadList(); }, [reloadList]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(reloadList, 300);
    return () => clearTimeout(t);
  }, [search, reloadList]);

  // ── Load profile ────────────────────────────────────────────────────

  useEffect(() => {
    if (!selected) { setProfile(null); setLoyaltyCard(null); setLoyaltyEvents([]); return; }
    setProfLoading(true);
    setComposeText("");
    setComposeResult(null);
    setLoyaltyCard(null);
    setLoyaltyEvents([]);
    Promise.all([
      loadCustomerProfile(selected),
      loadChannelConnections(branch?.id),
    ]).then(([prof, conns]) => {
      setProfile(prof);
      setConnections(conns);
      // Load loyalty card non-blocking
      if (branch?.id) {
        getCustomerCard(branch.id, selected).then(async (card) => {
          setLoyaltyCard(card);
          if (card?.id) {
            const evs = await getCardEvents(card.id);
            setLoyaltyEvents(evs);
          }
        }).catch(() => {});
      }
    }).finally(() => setProfLoading(false));
  }, [selected, branch?.id]);

  // Realtime — refresh profile when new events arrive
  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`customers-rt-${branch.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "customer_events",
          filter: `branch_id=eq.${branch.id}` },
        () => {
          reloadList();
          if (selected) {
            loadCustomerProfile(selected).then(setProfile);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch?.id, selected, reloadList]);

  // ── Actions ─────────────────────────────────────────────────────────

  async function handleAiDraft() {
    if (!profile?.events?.length) return;
    setAiDraftBusy(true); setError(null);
    try {
      const draft = await generateAiReply(profile.events, composeChannel);
      if (draft) setComposeText(draft);
      else setError("No API key — add VITE_OPENAI_API_KEY to .env.local");
    } catch (err) {
      setError(err.message);
    } finally {
      setAiDraftBusy(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!composeText.trim() || !profile || !branch?.id) return;
    setComposeBusy(true); setError(null); setComposeResult(null);
    try {
      const result = await sendMessage(branch.id, profile, composeChannel, composeText.trim(), null);
      setComposeResult(result);
      setComposeText("");
      // Refresh timeline so the outbound message appears immediately
      const updated = await loadCustomerProfile(profile.id);
      setProfile(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setComposeBusy(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim() || !selected || !branch?.id) return;
    setNoteBusy(true); setError(null);
    try {
      const note = await addNote(selected, branch.id, null, noteText.trim());
      setProfile((p) => p ? { ...p, notes: [note, ...p.notes] } : p);
      setNoteText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setNoteBusy(false);
    }
  }

  async function handleDeleteNote(noteId) {
    try {
      await deleteNote(noteId);
      setProfile((p) => p ? { ...p, notes: p.notes.filter((n) => n.id !== noteId) } : p);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateSummary() {
    if (!selected || !branch?.id) return;
    setAiBusy(true); setError(null);
    try {
      const summary = await generateSummary(selected, branch.id);
      if (summary) setProfile((p) => p ? { ...p, summary } : p);
      else setError("No API key set — add VITE_OPENAI_API_KEY to .env.local");
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function handleGeneratePersona() {
    if (!selected || !branch?.id) return;
    setPersonaBusy(true); setError(null);
    try {
      const persona = await generatePersona(selected, branch.id);
      if (persona) {
        setProfile((p) => p ? { ...p, summary: { ...(p.summary ?? {}), persona } } : p);
      } else {
        setError("No API key set -- add VITE_OPENAI_API_KEY to .env.local");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPersonaBusy(false);
    }
  }

  async function handleToggleVip() {
    if (!profile) return;
    const updated = await updateCustomer(profile.id, { vip: !profile.vip });
    setProfile((p) => p ? { ...p, vip: updated.vip } : p);
    setCustomers((prev) =>
      prev.map((c) => c.id === profile.id ? { ...c, vip: updated.vip } : c)
    );
  }

  async function handleDelete() {
    if (!profile) return;
    if (!confirm(`Remove ${profile.display_name ?? "this customer"} and all their history?`)) return;
    await deleteCustomer(profile.id);
    setCustomers((prev) => prev.filter((c) => c.id !== profile.id));
    setSelected(null);
    setProfile(null);
  }

  async function handleAddCustomer(e) {
    e.preventDefault();
    setAddError(null);
    if (!addName.trim() && !addPhone.trim() && !addEmail.trim()) {
      return setAddError("Enter at least a name, phone, or email.");
    }
    setAddBusy(true);
    try {
      const customer = await findOrCreateCustomer(branch.id, {
        name:  addName.trim()  || undefined,
        phone: addPhone.trim() || undefined,
        email: addEmail.trim() || undefined,
      });
      // Reset form
      setAddName(""); setAddPhone(""); setAddEmail("");
      setShowAddForm(false);
      // Reload list and open the new (or found) customer
      await reloadList();
      setSelected(customer.id);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
  }

  async function handleTagToggle(tag) {
    if (!profile) return;
    const current = profile.tags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    const updated = await updateCustomer(profile.id, { tags: next });
    setProfile((p) => p ? { ...p, tags: updated.tags } : p);
    setCustomers((prev) =>
      prev.map((c) => c.id === profile.id ? { ...c, tags: updated.tags } : c)
    );
  }

  async function handleAddCustomTag(e) {
    e.preventDefault();
    const tag = tagDraft.trim().toLowerCase();
    if (!tag || !profile) return;
    setTagDraft("");
    await handleTagToggle(tag);
  }

  // ── Loyalty handlers ──────────────────────────────────────────────
  async function handleBonusPunch() {
    if (!selected || !branch?.id || loyaltyBusy) return;
    setLoyaltyBusy(true);
    try {
      await addBonusPunch(branch.id, selected, null, user?.id ?? null);
      const card = await getCustomerCard(branch.id, selected);
      setLoyaltyCard(card);
      if (card?.id) {
        const evs = await getCardEvents(card.id);
        setLoyaltyEvents(evs);
      }
    } catch {}
    setLoyaltyBusy(false);
  }

  async function handleRedeemReward() {
    if (!selected || !branch?.id || loyaltyBusy) return;
    setLoyaltyBusy(true);
    try {
      await redeemReward(branch.id, selected, user?.id ?? null);
      const card = await getCustomerCard(branch.id, selected);
      setLoyaltyCard(card);
      if (card?.id) {
        const evs = await getCardEvents(card.id);
        setLoyaltyEvents(evs);
      }
    } catch {}
    setLoyaltyBusy(false);
  }

  // Collect all unique tags across the loaded customer list for the filter bar
  const allTags = [...new Set(customers.flatMap((c) => c.tags ?? []))].sort();

  // ── Render ──────────────────────────────────────────────────────────

  if (!branch) {
    return <div className="p-8 text-ink-mute ovline">Select a branch to view customers.</div>;
  }

  return (
    <div className="atmosphere-hero flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Left: customer list ── */}
      <aside className="w-72 shrink-0 border-r border-line flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-line">
          <div className="flex items-center justify-between mb-2">
            <div className="ovline text-[9px] text-gold-soft">Customers · {branch.name}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadCustomersCSV(customers, branch)}
                className="text-[9px] tracking-[0.12em] uppercase border border-line px-2 py-0.5 text-ink-mute hover:border-gold-deep hover:text-gold-soft transition"
                title="Download all customers as CSV"
              >
                ↓ CSV
              </button>
              <button
                onClick={() => { setShowAddForm((x) => !x); setAddError(null); }}
                className="text-[9px] tracking-[0.12em] uppercase border border-line px-2 py-0.5 text-ink-mute hover:border-gold-deep hover:text-gold-soft transition"
              >
                {showAddForm ? "✕ Cancel" : "+ Add"}
              </button>
            </div>
          </div>

          {/* Add-customer form */}
          {showAddForm && (
            <form onSubmit={handleAddCustomer} className="mb-3 flex flex-col gap-2">
              <input
                type="text"
                placeholder="Name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full bg-transparent border border-line text-xs px-3 py-2 focus:outline-none focus:border-gold-deep placeholder:text-ink-mute"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="w-full bg-transparent border border-line text-xs px-3 py-2 focus:outline-none focus:border-gold-deep placeholder:text-ink-mute"
              />
              <input
                type="email"
                placeholder="Email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="w-full bg-transparent border border-line text-xs px-3 py-2 focus:outline-none focus:border-gold-deep placeholder:text-ink-mute"
              />
              {addError && (
                <div className="text-[10px] text-[#d49185]">{addError}</div>
              )}
              <Button size="sm" type="submit" disabled={addBusy} className="w-full">
                {addBusy ? "Saving…" : "Save customer"}
              </Button>
            </form>
          )}

          <input
            type="search"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border border-line text-xs px-3 py-2 focus:outline-none focus:border-gold-deep placeholder:text-ink-mute"
          />

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <button
                onClick={() => setTagFilter(null)}
                className={`text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 border transition ${
                  tagFilter === null ? "border-gold-deep text-gold-soft" : "border-line text-ink-mute hover:border-line-2"
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={`text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 border transition ${
                    tagFilter === tag ? "border-gold-deep text-gold-soft" : "border-line text-ink-mute hover:border-line-2"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="p-4 text-xs text-ink-mute ovline text-center">Loading…</div>
          ) : customers.filter((c) => !tagFilter || (c.tags ?? []).includes(tagFilter)).length === 0 ? (
            <div className="p-6 text-center">
              <div className="ovline text-[9px] mb-2">No customers yet</div>
              <p className="text-xs text-ink-mute">
                Customers appear here when they join the queue or are added manually.
              </p>
            </div>
          ) : (
            customers
            .filter((c) => !tagFilter || (c.tags ?? []).includes(tagFilter))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-line/50 transition hover:bg-white/[0.02] ${
                  selected === c.id ? "bg-white/[0.04] border-l-2 border-l-gold-deep" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate flex-1">
                    {c.display_name ?? <span className="text-ink-mute italic">Unknown</span>}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateCustomer(c.id, { vip: !c.vip }).then((updated) => {
                        setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, vip: updated.vip } : x));
                        if (profile?.id === c.id) setProfile((p) => p ? { ...p, vip: updated.vip } : p);
                      });
                    }}
                    className={"text-[13px] shrink-0 leading-none transition " + (c.vip ? "text-gold-soft" : "text-ink-mute/40 hover:text-gold-soft/60")}
                    title={c.vip ? "Remove VIP" : "Mark as VIP"}
                  >
                    {c.vip ? "★" : "☆"}
                  </button>
                </div>
                <div className="text-[10px] text-ink-mute truncate">
                  {c.email ?? c.phone ?? "No contact info"}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {c.last_seen_at && (
                    <span className="text-[9px] text-ink-mute">{fmtDate(c.last_seen_at)}</span>
                  )}
                  {branch?.business_type === "gym" ? (
                    <>
                      {c.student_track && (
                        <span className="text-[8px] text-gold-soft ovline capitalize">{c.student_track}</span>
                      )}
                      {(c.sessions_attended ?? 0) > 0 && (
                        <span className="text-[8px] text-[#9bbd9b] ovline">{c.sessions_attended} sessions</span>
                      )}
                      {(c.no_show_strikes ?? 0) >= 2 && (
                        <span className="text-[8px] text-[#d49185] ovline">{c.no_show_strikes} strikes</span>
                      )}
                    </>
                  ) : (
                    <>
                      {(c.visit_count ?? 0) <= 1 && (
                        <span className="text-[8px] text-[#74b9e8] ovline">New</span>
                      )}
                      {(c.visit_count ?? 0) > 1 && (
                        <span className="text-[8px] text-[#9bbd9b] ovline">{c.visit_count} visits</span>
                      )}
                    </>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Right: profile ── */}
      <main className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-ink-mute text-sm">
            Select a customer to view their profile
          </div>
        ) : profLoading ? (
          <div className="flex items-center justify-center h-full text-ink-mute text-xs ovline">
            Loading profile…
          </div>
        ) : !profile ? (
          <div className="flex items-center justify-center h-full text-ink-mute text-sm">
            Customer not found
          </div>
        ) : (
          <div className="p-6 max-w-3xl">

            {/* ── Profile header ── */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="ovline text-[9px] mb-1 text-gold-soft">
                  {branch?.business_type === "gym" ? "Student profile" : "Customer profile"}
                </div>
                <h1 className="font-display text-3xl font-light tracking-tightest">
                  {profile.display_name ?? <span className="text-ink-mute">Unknown customer</span>}
                </h1>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-soft">
                  {profile.email && <span>{profile.email}</span>}
                  {profile.phone && <span>{profile.phone}</span>}
                  {profile.created_at && (
                    <span className="text-ink-mute">Since {new Date(profile.created_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap shrink-0">
                <button
                  onClick={handleToggleVip}
                  className={`text-[10px] border px-2.5 py-1 transition ${
                    profile.vip
                      ? "text-gold-soft border-gold-deep"
                      : "text-ink-mute border-line hover:border-gold-deep hover:text-gold-soft"
                  }`}
                >
                  {profile.vip ? "★ VIP" : "Mark VIP"}
                </button>
                {branch.freshdesk_subdomain && (
                  <a
                    href={freshdeskUrl(branch.freshdesk_subdomain, profile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-orange-400 border border-orange-800 px-2.5 py-1 hover:text-orange-300 transition"
                  >
                    Open in Freshworks ↗
                  </a>
                )}
                <button
                  onClick={handleDelete}
                  className="text-[10px] text-ink-mute hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* ── CRM quick actions ── */}
            <div className="flex flex-wrap gap-2 mb-5">
              {["immigration", "tax", "follow-up", "lapsed", "high-value"].map((tag) => {
                const active = (profile.tags ?? []).includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={"text-[10px] border px-2.5 py-1 transition capitalize " + (active ? "border-gold-deep/60 text-gold-soft/80" : "text-ink-mute border-line hover:border-line-2")}
                  >
                    {active ? "- " : "+ "}{tag}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mb-4 border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* ── AI summary card ── */}
            <div className="mb-6 border border-line bg-bg-elev p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="ovline text-[9px] text-gold-soft">AI summary</div>
                {aiEnabled && (
                  <button
                    onClick={handleGenerateSummary}
                    disabled={aiBusy}
                    className="text-[10px] text-ink-mute hover:text-ink border border-line px-2.5 py-1 transition disabled:opacity-40"
                  >
                    {aiBusy ? "Generating…" : profile.summary ? "Refresh" : "Generate"}
                  </button>
                )}
              </div>

              {profile.summary ? (
                <div className="flex flex-col gap-3">
                  {/* Mood + action */}
                  <div className="flex items-center gap-4 text-xs">
                    <span className={`font-medium capitalize ${SENTIMENT_COLOR[profile.summary.sentiment] ?? "text-ink-soft"}`}>
                      {profile.summary.sentiment ?? "—"}
                    </span>
                    {profile.summary.recommended_action && (
                      <span className="text-ink-soft flex-1">{profile.summary.recommended_action}</span>
                    )}
                  </div>
                  {/* Summary text */}
                  <p className="text-xs text-ink-soft leading-relaxed">{profile.summary.summary}</p>
                  {/* Key issues */}
                  {profile.summary.key_issues?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.summary.key_issues.map((issue, i) => (
                        <span key={i} className="text-[9px] border border-line px-2 py-0.5 text-ink-mute">
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-[9px] text-ink-mute">
                    Generated {fmtDate(profile.summary.generated_at)}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-mute">
                  {aiEnabled
                    ? "No summary yet — click Generate to create one from this customer's history."
                    : "AI summaries are available on the Executive plan."}
                </p>
              )}
            </div>

            {/* ── Marketing persona ── */}
            <div className="mb-6 border border-line bg-bg-elev p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="ovline text-[9px] text-gold-soft">Marketing Persona</div>
                {aiEnabled && (
                  <button
                    onClick={handleGeneratePersona}
                    disabled={personaBusy}
                    className="text-[10px] text-ink-mute hover:text-ink border border-line px-2.5 py-1 transition disabled:opacity-40"
                  >
                    {personaBusy ? "Generating..." : profile.summary?.persona ? "Refresh" : "Generate"}
                  </button>
                )}
              </div>
              {profile.summary?.persona ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-sm text-gold-soft">
                      {profile.summary.persona.archetype}
                    </span>
                    {profile.summary.persona.lifetime_value && (
                      <span className={"text-[9px] border px-2 py-0.5 uppercase tracking-widest " + (
                        profile.summary.persona.lifetime_value === "vip"  ? "border-gold-deep text-gold-soft" :
                        profile.summary.persona.lifetime_value === "high" ? "border-emerald-700 text-emerald-400" :
                        "border-line text-ink-mute"
                      )}>
                        {profile.summary.persona.lifetime_value}
                      </span>
                    )}
                  </div>
                  {profile.summary.persona.description && (
                    <p className="text-xs text-ink-soft leading-relaxed">{profile.summary.persona.description}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {profile.summary.persona.best_channel && (
                      <span className="text-[9px] border border-[#506b50] text-[#9bbd9b] px-2 py-0.5">
                        Best channel: {profile.summary.persona.best_channel}
                      </span>
                    )}
                    {profile.summary.persona.communication_style && (
                      <span className="text-[9px] border border-line text-ink-mute px-2 py-0.5">
                        Style: {profile.summary.persona.communication_style}
                      </span>
                    )}
                  </div>
                  {profile.summary.persona.marketing_angle && (
                    <div className="border-l-2 border-gold-deep pl-3 text-xs text-ink-soft italic">
                      {profile.summary.persona.marketing_angle}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {profile.summary.persona.do_list?.length > 0 && (
                      <div>
                        <div className="text-[9px] text-[#9bbd9b] ovline mb-1.5">Do</div>
                        {profile.summary.persona.do_list.map((item, i) => (
                          <div key={i} className="text-[10px] text-ink-soft mb-0.5">+ {item}</div>
                        ))}
                      </div>
                    )}
                    {profile.summary.persona.avoid_list?.length > 0 && (
                      <div>
                        <div className="text-[9px] text-red-400 ovline mb-1.5">Avoid</div>
                        {profile.summary.persona.avoid_list.map((item, i) => (
                          <div key={i} className="text-[10px] text-ink-soft mb-0.5">- {item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-mute">
                  {aiEnabled
                    ? "Generate a persona to understand how to communicate with and market to this customer."
                    : "Marketing personas are available on the Executive plan."}
                </p>
              )}
            </div>

            {/* ── Tags ── */}
            <div className="mb-6 border border-line bg-bg-elev p-4">
              <div className="ovline text-[9px] mb-3 text-gold-soft">Tags</div>

              {/* Current tags — click to remove */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(profile.tags ?? []).length === 0 && (
                  <span className="text-[10px] text-ink-mute">No tags yet.</span>
                )}
                {(profile.tags ?? []).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    title="Click to remove"
                    className="text-[9px] border border-gold-deep text-gold-soft px-2 py-0.5 hover:border-red-800 hover:text-red-400 transition"
                  >
                    {tag} ✕
                  </button>
                ))}
              </div>

              {/* Preset quick-add chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(branch?.business_type === "gym"
                  ? ["active", "vip", "lapsed", "injury", "competitor", "drop-off", "follow-up", "new"]
                  : ["immigration", "tax", "vip", "lapsed", "high-value", "drop-off", "follow-up", "new"]
                ).map((preset) => {
                  const active = (profile.tags ?? []).includes(preset);
                  return !active ? (
                    <button
                      key={preset}
                      onClick={() => handleTagToggle(preset)}
                      className="text-[9px] border border-line text-ink-mute px-2 py-0.5 hover:border-gold-deep hover:text-gold-soft transition"
                    >
                      + {preset}
                    </button>
                  ) : null;
                })}
              </div>

              {/* Custom tag input */}
              <form onSubmit={handleAddCustomTag} className="flex gap-2">
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  placeholder="Custom tag…"
                  className="flex-1 bg-transparent border border-line text-xs px-3 py-1.5 focus:outline-none focus:border-gold-deep placeholder:text-ink-mute"
                />
                <Button size="sm" type="submit" disabled={!tagDraft.trim()}>Add</Button>
              </form>
            </div>

            {/* ── Student tracking (gym mode only) ── */}
            {branch?.business_type === "gym" && (
              <StudentPanel
                key={profile.id}
                profile={profile}
                bookings={studentBookings}
                onTrackChange={(t) =>
                  setProfile((p) => (p ? { ...p, student_track: t } : p))
                }
              />
            )}

            {/* ── Marketing Insights ── */}
            {(() => {
              const ins = customerInsights(profile.events);
              if (!ins) return null;
              const riskColor = {
                high:    "text-red-400 border-red-900",
                medium:  "text-orange-400 border-orange-800",
                low:     "text-[#9bbd9b] border-[#506b50]",
                unknown: "text-ink-mute border-line",
              }[ins.retentionRisk] ?? "text-ink-mute border-line";
              const totalPct = (svc) => ins.totalVisits > 0
                ? Math.round((svc[1] / ins.totalVisits) * 100)
                : 0;
              return (
                <div className="mb-6 border border-line bg-bg-elev p-4">
                  <div className="ovline text-[9px] mb-4 text-gold-soft">Customer Insights</div>

                  {/* Top row — visit stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="border border-line p-3 text-center">
                      <div className="text-2xl font-light text-ink">{ins.totalVisits}</div>
                      <div className="text-[9px] text-ink-mute ovline mt-0.5">Total visits</div>
                    </div>
                    <div className="border border-line p-3 text-center">
                      <div className="text-2xl font-light text-ink">
                        {ins.daysSinceLast !== null ? ins.daysSinceLast + "d" : "--"}
                      </div>
                      <div className="text-[9px] text-ink-mute ovline mt-0.5">Since last visit</div>
                    </div>
                    <div className="border border-line p-3 text-center">
                      <div className="text-2xl font-light text-ink">
                        {ins.avgPerMonth !== null ? ins.avgPerMonth + "x" : "--"}
                      </div>
                      <div className="text-[9px] text-ink-mute ovline mt-0.5">Per month</div>
                    </div>
                  </div>

                  {/* Retention risk badge */}
                  <div className={"inline-flex items-center gap-2 border px-3 py-1.5 mb-4 " + riskColor}>
                    <span className="text-[9px] ovline uppercase">
                      {ins.retentionRisk === "high" ? "High retention risk" :
                       ins.retentionRisk === "medium" ? "Medium retention risk" :
                       ins.retentionRisk === "low" ? "Low retention risk" : "Insufficient data"}
                    </span>
                    {ins.riskReason && (
                      <span className="text-[10px] opacity-80">{ins.riskReason}</span>
                    )}
                  </div>

                  {/* Service breakdown */}
                  {ins.topServices.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[9px] ovline text-ink-mute mb-2">Services used</div>
                      <div className="flex flex-col gap-1.5">
                        {ins.topServices.map(([svc, count]) => (
                          <div key={svc} className="flex items-center gap-2">
                            <span className="text-[10px] text-ink-soft w-28 truncate">{svc}</span>
                            <div className="flex-1 h-1 bg-white/5 rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-gold-deep/60 rounded-sm"
                                style={{ width: totalPct([svc, count]) + "%" }}
                              />
                            </div>
                            <span className="text-[9px] text-ink-mute w-8 text-right">{count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wait time */}
                  {ins.avgWaitMin !== null && (
                    <div className="flex gap-4 text-xs">
                      <div>
                        <span className="text-ink-mute">Avg wait </span>
                        <span className="text-ink">{ins.avgWaitMin}m</span>
                      </div>
                      {ins.maxWaitMin !== null && (
                        <div>
                          <span className="text-ink-mute">Longest wait </span>
                          <span className={ins.maxWaitMin > 30 ? "text-orange-400" : "text-ink"}>
                            {ins.maxWaitMin}m
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Satisfaction scores ── */}
            {(profile.scores?.length > 0 || profile.avgScore) && (
              <div className="mb-6">
                <div className="ovline text-[9px] mb-3 text-gold-soft">
                  Satisfaction · {profile.scores?.length ?? 0} ratings
                  {profile.avgScore && (
                    <span className={"ml-2 " + scoreColour(profile.avgScore)}>
                      avg {profile.avgScore}★
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {(profile.scores ?? []).map((s) => (
                    <div key={s.id} className="flex items-start gap-3 py-2 border-b border-line last:border-b-0">
                      <span className={"text-xl leading-none " + scoreColour(s.score)}>
                        {scoreEmoji(s.score)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={"text-xs font-mono " + scoreColour(s.score)}>
                            {"★".repeat(s.score)}{"☆".repeat(5 - s.score)}
                          </span>
                          <span className="text-[10px] text-ink-mute">
                            {new Date(s.created_at).toLocaleDateString([], { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {s.note && (
                          <p className="text-[11px] text-ink-soft mt-0.5 leading-snug">{s.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Loyalty card ── */}
            {loyaltyCard && (
              <div className="mb-6 border border-line bg-bg-elev p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="ovline text-[9px] text-gold-soft">
                    {loyaltyCard.program?.name ?? "Loyalty Card"}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUnclaimedReward(loyaltyCard) && (
                      <button
                        onClick={handleRedeemReward}
                        disabled={loyaltyBusy}
                        className="text-[9px] tracking-wide bg-gold text-[#141410] px-2 py-0.5 font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        🎁 Redeem reward
                      </button>
                    )}
                    <button
                      onClick={handleBonusPunch}
                      disabled={loyaltyBusy}
                      className="text-[9px] ovline border border-gold-deep text-gold-soft px-2 py-0.5 hover:bg-[rgba(201,168,106,0.08)] disabled:opacity-50"
                    >
                      + Bonus punch
                    </button>
                  </div>
                </div>

                {/* Punch dots */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {punchDots(loyaltyCard, loyaltyCard.program).map((filled, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border transition ${
                        filled
                          ? "bg-gold border-gold shadow-[0_0_5px_rgba(201,168,106,0.4)]"
                          : "border-line-2 bg-bg"
                      }`}
                    />
                  ))}
                </div>

                <div className="text-[11px] text-ink-soft mb-3">
                  {hasUnclaimedReward(loyaltyCard)
                    ? `Reward ready: ${loyaltyCard.program?.reward_description}`
                    : `${loyaltyCard.program?.punches_required - loyaltyCard.current_punches} more visit${(loyaltyCard.program?.punches_required - loyaltyCard.current_punches) === 1 ? "" : "s"} to earn: ${loyaltyCard.program?.reward_description}`}
                </div>

                <div className="text-[10px] text-ink-mute flex gap-4">
                  <span>{loyaltyCard.lifetime_punches} lifetime visits</span>
                  <span>{loyaltyCard.rewards_earned} reward{loyaltyCard.rewards_earned !== 1 ? "s" : ""} earned</span>
                  {loyaltyCard.last_punch_at && (
                    <span>Last: {new Date(loyaltyCard.last_punch_at).toLocaleDateString()}</span>
                  )}
                </div>

                {loyaltyEvents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line flex flex-col gap-1">
                    {loyaltyEvents.slice(0, 5).map((ev) => (
                      <div key={ev.id} className="flex items-center gap-2 text-[10px] text-ink-mute">
                        <span>{ev.event_type === "punch" ? "★" : ev.event_type === "bonus_punch" ? "✦" : ev.event_type === "reward_earned" ? "🎁" : "✓"}</span>
                        <span className="capitalize">{ev.event_type.replace("_", " ")}</span>
                        {ev.note && <span className="text-ink-soft">— {ev.note}</span>}
                        <span className="ml-auto">{new Date(ev.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Timeline ── */}
            <div className="mb-6">
              <div className="ovline text-[9px] mb-3 text-gold-soft">
                Timeline · {profile.events.length} events
              </div>

              {profile.events.length === 0 ? (
                <p className="text-xs text-ink-mute">No events recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {profile.events.map((ev, i) => (
                    <div
                      key={ev.id}
                      className={`flex gap-3 py-3 text-xs ${
                        i < profile.events.length - 1 ? "border-b border-line/50" : ""
                      }`}
                    >
                      {/* Icon */}
                      <span className="text-ink-mute w-4 text-center shrink-0 mt-0.5">
                        {EVENT_ICON[ev.event_type] ?? "·"}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] tracking-[0.15em] uppercase border px-1.5 py-0.5 ${
                            CHANNEL_COLOR[ev.channel] ?? "text-ink-mute border-line"
                          }`}>
                            {CHANNEL_LABEL[ev.channel] ?? ev.channel}
                          </span>
                          {ev.direction === "outbound" && (
                            <span className="text-[9px] text-ink-mute border border-line px-1.5 py-0.5">
                              sent
                            </span>
                          )}
                          <span className={`truncate flex-1 ${ev.direction === "outbound" ? "text-ink" : "text-ink-soft"}`}>
                            {ev.content ?? ev.event_type}
                          </span>
                        </div>
                      </div>

                      {/* Time */}
                      <span className="text-ink-mute shrink-0">{fmtDate(ev.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Message composer ── */}
            <div className="mb-6 border border-line bg-bg-elev">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 border-b border-line">
                <div className="ovline text-[9px] text-gold-soft">Send message</div>
                {/* Channel selector */}
                <div className="flex gap-1.5 flex-wrap">
                  {["manual","whatsapp","facebook","instagram","email"].map((ch) => {
                    const conn      = connections[ch];
                    const active    = composeChannel === ch;
                    const connected = ch === "manual" || conn?.status === "connected";
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setComposeChannel(ch)}
                        disabled={!connected}
                        className={`text-[9px] tracking-[0.12em] uppercase px-2 py-1 border transition ${
                          active
                            ? "border-gold text-gold"
                            : connected
                              ? "border-line text-ink-soft hover:border-gold-deep hover:text-ink"
                              : "border-line/40 text-ink-mute/50 cursor-not-allowed"
                        }`}
                        title={connected ? undefined : ch + " not connected"}
                      >
                        {ch === "manual" ? "Note" : ch}
                        {connected && ch !== "manual" && (
                          <span className="ml-1 text-[#9bbd9b] text-[8px]">●</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 py-3">
                <textarea
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder={
                    composeChannel === "manual"
                      ? "Add a staff note…"
                      : `Type a message to send via ${composeChannel}…`
                  }
                  rows={3}
                  className="w-full bg-bg border border-line focus:border-gold-deep outline-none text-sm px-3 py-2 text-ink placeholder:text-ink-mute resize-none transition"
                />
              </div>

              <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={composeBusy || !composeText.trim()}
                >
                  {composeBusy ? "Sending…" : composeChannel === "manual" ? "Save note" : "Send"}
                </Button>
                {composeChannel !== "manual" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAiDraft}
                    disabled={aiDraftBusy || !profile.events?.length}
                  >
                    {aiDraftBusy ? "Drafting…" : "AI draft"}
                  </Button>
                )}
                {composeResult && (
                  <span className={`text-[10px] ${composeResult.sent ? "text-[#9bbd9b]" : "text-ink-mute"}`}>
                    {composeResult.sent ? "Sent ✓" : composeResult.manual ? "Saved as note" : "Delivered"}
                  </span>
                )}
              </div>
            </div>

            {/* ── Delete zone ── */}
            <div className="mt-8 pt-6 border-t border-line/50 flex justify-end">
              <button
                onClick={handleDelete}
                className="text-[10px] text-ink-mute hover:text-red-400 transition tracking-wide"
              >
                Delete {branch?.business_type === "gym" ? "student" : "customer"} record
              </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

// ── Student tracking panel (gym mode only) ───────────────────────────────────

const TRACK_META = {
  beginner:     { label: "🥋 Beginner",     tone: "text-[#74b9e8]",  border: "border-[#4a8ab5]/40" },
  intermediate: { label: "⚔️ Intermediate", tone: "text-[#d4a959]",  border: "border-[#b8893d]/40" },
  fighter:      { label: "🏆 Fighter",      tone: "text-[#9bbd9b]",  border: "border-[#506b50]/40" },
};

function StudentPanel({ profile, bookings = [], onTrackChange }) {
  const [track,  setTrack]  = useState(profile.student_track ?? "");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const dirty = track !== (profile.student_track ?? "");

  async function save() {
    setSaving(true);
    try {
      await updateCustomer(profile.id, { student_track: track || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onTrackChange) onTrackChange(track || null);
    } finally {
      setSaving(false);
    }
  }

  const strikes = profile.no_show_strikes ?? 0;
  const attended = profile.sessions_attended ?? 0;

  return (
    <div className="mb-6 border border-line bg-bg-elev p-4">
      <div className="ovline text-[9px] mb-4 text-gold-soft">Student Profile</div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="border border-line p-3 text-center">
          <div className="text-2xl font-light text-ink">{attended}</div>
          <div className="text-[9px] text-ink-mute ovline mt-0.5">Sessions</div>
        </div>
        <div className="border border-line p-3 text-center">
          <div className={`text-2xl font-light ${strikes >= 3 ? "text-[#d49185]" : strikes >= 1 ? "text-[#d4a959]" : "text-ink"}`}>
            {strikes}
          </div>
          <div className="text-[9px] text-ink-mute ovline mt-0.5">No-show strikes</div>
        </div>
        <div className="border border-line p-3 text-center">
          <div className="text-2xl font-light text-ink">{bookings.length}</div>
          <div className="text-[9px] text-ink-mute ovline mt-0.5">Total bookings</div>
        </div>
      </div>

      {/* Strike warning */}
      {strikes >= 3 && (
        <div className="mb-4 border border-[#b56b5f]/40 bg-[#b56b5f]/10 px-3 py-2 text-[11px] text-[#d49185]">
          ⚠️ {strikes} no-show strikes — consider reaching out before their next class.
        </div>
      )}

      {/* Track assignment */}
      <div className="mb-5">
        <div className="text-[9px] ovline text-ink-mute mb-2">Training track</div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(TRACK_META).map(([t, meta]) => (
            <button
              key={t}
              onClick={() => { setTrack(t); setSaved(false); }}
              className={`text-[10px] border px-3 py-1.5 transition ${
                track === t
                  ? `${meta.border} ${meta.tone} bg-[rgba(255,255,255,0.03)]`
                  : "border-line text-ink-mute hover:border-[#3a3a3f]"
              }`}
            >
              {meta.label}
            </button>
          ))}
          {track && (
            <button
              onClick={() => { setTrack(""); setSaved(false); }}
              className="text-[9px] text-ink-mute hover:text-red-400 transition px-1"
            >
              ✕ clear
            </button>
          )}
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save track"}
          </Button>
        </div>
      </div>

      {/* Class attendance history */}
      {bookings.length > 0 && (
        <div>
          <div className="text-[9px] ovline text-ink-mute mb-2">
            Class history · {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-col max-h-52 overflow-y-auto">
            {bookings.slice(0, 25).map((b, i) => {
              const noShow   = b.status === "no_show";
              const confirmed = !!b.confirmed_at;
              const served   = b.status === "served" || b.status === "completed";
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-3 py-2.5 text-xs ${
                    i < bookings.length - 1 ? "border-b border-line/40" : ""
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    noShow   ? "bg-[#d49185]" :
                    served   ? "bg-[#9bbd9b]" :
                    confirmed ? "bg-[#d4a959]" :
                    "bg-ink-mute/30"
                  }`} />
                  <span className="text-ink-soft flex-1 truncate text-[11px]">
                    {b.service_name ?? "Class"}
                  </span>
                  <span className={`text-[9px] shrink-0 ${
                    noShow   ? "text-[#d49185]" :
                    served   ? "text-[#9bbd9b]" :
                    confirmed ? "text-[#d4a959]" :
                    "text-ink-mute"
                  }`}>
                    {noShow ? "No-show" : served ? "Attended" : confirmed ? "Confirmed" : "Booked"}
                  </span>
                  <span className="text-[9px] text-ink-mute shrink-0 w-16 text-right">
                    {b.scheduled_at
                      ? new Date(b.scheduled_at).toLocaleDateString([], { day: "numeric", month: "short" })
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bookings.length === 0 && (
        <p className="text-[11px] text-ink-mute">No class bookings linked to this student yet.</p>
      )}
    </div>
  );
}
