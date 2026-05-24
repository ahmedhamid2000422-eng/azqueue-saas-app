import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { useBranch } from "../../lib/BranchContext";
import { getLimits, getTier, TIER_INFO } from "../../lib/tier";
import Card, { CardHeader } from "../../components/Card";
import Button from "../../components/Button";
import {
  DEFAULT_CHECKLISTS,
  getChecklist,
  buildChecklistMessage,
  loadCustomChecklists,
  saveCustomChecklist,
  resetCustomChecklist,
  getEffectiveChecklist,
} from "../../lib/checklists";
import {
  getFreshdeskConfig,
  saveFreshdeskConfig,
  disconnectFreshdesk,
  testFreshdeskCredentials,
} from "../../lib/freshdesk";

export default function Settings() {
  const { user } = useAuth();
  const { branch, branches, select, dbReady, reload } = useBranch();
  const [tab, setTab] = useState("general");

  if (!dbReady) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Settings</h1>
        <p className="text-ink-soft text-sm">
          Run <span className="font-mono text-gold-soft">supabase/migrations/0001_init.sql</span> in your Supabase SQL editor to enable settings.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: "general",  label: "General" },
    { id: "branches", label: "Branches" },
    { id: "services", label: "Services" },
    { id: "staff",    label: "Staff" },
    { id: "modes",    label: "Modes" },
    { id: "checklists",   label: "Checklists" },
    { id: "integrations", label: "Integrations" },
    { id: "billing",      label: "Billing" },
  ];

  return (
    <div className="atmosphere-hero p-8 max-w-5xl">
      <header className="mb-6">
        <div className="ovline mb-2 text-gold-soft">Configuration</div>
        <h1 className="font-display text-4xl font-light tracking-tightest">Settings</h1>
        <div className="text-xs text-ink-soft mt-2">
          {branch ? <>Editing <span className="text-ink">{branch.name}</span></> : "No branch selected"}
        </div>
      </header>

      {/* Tab strip */}
      <div className="flex border-b border-line mb-6">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-5 py-3 text-[10px] tracking-[0.22em] uppercase transition ${
                active ? "text-gold" : "text-ink-mute hover:text-ink"
              }`}
            >
              {t.label}
              {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-gold" />}
            </button>
          );
        })}
      </div>

      {tab === "general"  && <GeneralTab branch={branch} reload={reload} />}
      {tab === "branches" && <BranchesTab branches={branches} currentId={branch?.id} select={select} reload={reload} userId={user?.id} />}
      {tab === "services" && <ServicesTab branch={branch} />}
      {tab === "staff"    && <StaffTab branch={branch} />}
      {tab === "modes"    && <ModesTab branch={branch} reload={reload} />}
      {tab === "checklists"   && <ChecklistsTab branch={branch} />}
      {tab === "integrations" && <IntegrationsTab branch={branch} />}
      {tab === "billing"      && <BillingTab />}
    </div>
  );
}

/* ── BILLING ──────────────────────────────────────────────────────── */
function BillingTab() {
  const { user } = useAuth();
  const tier = getTier(user);
  const tierInfo = TIER_INFO[tier];
  const [busy, setBusy] = useState(null); // tier id while opening checkout
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
      if (!cancelled) setSub(data);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Read ?upgraded=1 query param to show a one-time success banner
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("upgraded") === "1") setInfo("Welcome aboard. Your new tier may take a few seconds to activate — try refreshing if buttons feel stale.");
    if (q.get("upgraded") === "0") setInfo("Checkout cancelled. No charge was made.");
  }, []);

  async function startCheckout(targetTier) {
    setBusy(targetTier); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { tier: targetTier },
      });
      if (error) throw new Error(error.message);
      if (data?.dryRun) { setError(data.message ?? "Stripe not configured."); setBusy(null); return; }
      if (!data?.url) throw new Error("No checkout URL returned.");
      window.location.href = data.url;
    } catch (e) {
      setError(e?.message ?? "Could not start checkout.");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal"); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal-session", {
        body: {},
      });
      if (error) throw new Error(error.message);
      if (data?.dryRun) { setError(data.message ?? "Stripe not configured."); setBusy(null); return; }
      if (!data?.url) throw new Error("No portal URL returned.");
      window.location.href = data.url;
    } catch (e) {
      setError(e?.message ?? "Could not open billing portal.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {info && (
        <Card luxe variant="sage" className="p-4">
          <div className="text-[12px] text-[#9bbd9b]">{info}</div>
        </Card>
      )}
      {error && (
        <div className="text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
          {error}
        </div>
      )}

      {/* Current plan */}
      <Card luxe className="p-7">
        <div className="ovline text-gold-soft mb-2">Current plan</div>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-3xl font-light tracking-tighter">
            {tierInfo?.name ?? "Essential"}
          </h2>
          <div className="flex items-baseline gap-1">
            <span className="text-ink-mute text-[10px]">RM</span>
            <span className="font-display text-3xl gold-text">{tierInfo?.price ?? 29}</span>
            <span className="text-ink-mute text-[10px]">/mo</span>
          </div>
        </div>

        {sub?.status && sub.status !== "inactive" && (
          <div className="grid grid-cols-2 gap-px bg-line border border-line text-[11px]">
            <div className="bg-bg-elev p-3">
              <div className="ovline text-[8px]">Status</div>
              <div className="text-ink mt-1 capitalize">{sub.status.replace(/_/g, " ")}</div>
            </div>
            <div className="bg-bg-elev p-3">
              <div className="ovline text-[8px]">{sub.cancel_at_period_end ? "Ends" : "Renews"}</div>
              <div className="text-ink mt-1">
                {sub.current_period_end
                  ? new Date(sub.current_period_end).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
                  : "—"}
              </div>
            </div>
          </div>
        )}

        <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={openPortal} disabled={busy !== null || !sub?.stripe_customer_id}>
            {busy === "portal" ? "Opening…" : "Manage billing →"}
          </Button>
          <span className="text-[10px] text-ink-mute">
            Update card, view invoices, or cancel anytime.
          </span>
        </div>
      </Card>

      {/* Upgrade options */}
      <Card luxe className="p-7">
        <div className="ovline text-gold-soft mb-2">Switch plan</div>
        <h2 className="font-display text-2xl font-light tracking-tighter mb-5">
          Pick the plan that <em className="not-italic gold-text-soft">fits.</em>
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {Object.entries(TIER_INFO).map(([id, info]) => {
            const isCurrent = id === tier;
            return (
              <div key={id} className="relative bg-bg-elev p-5">
                {isCurrent && (
                  <div className="absolute -top-px left-3 bg-gold text-[#141410] px-2 py-0.5 text-[8px] tracking-[0.18em] uppercase font-bold">
                    Current
                  </div>
                )}
                <div className="ovline text-[9px] mb-2">{info.name}</div>
                <div className="flex items-baseline gap-0.5 mb-3">
                  <span className="text-ink-mute text-[10px]">RM</span>
                  <span className="font-display text-3xl text-gold font-light">{info.price}</span>
                  <span className="text-ink-mute text-[10px]">/mo</span>
                </div>
                <Button
                  variant={isCurrent ? "ghost" : "default"}
                  size="sm"
                  className="w-full"
                  disabled={isCurrent || busy !== null}
                  onClick={() => startCheckout(id)}
                >
                  {isCurrent ? "Current" : busy === id ? "Opening…" : info.rank > (TIER_INFO[tier]?.rank ?? 0) ? "Upgrade →" : "Switch"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
        <div className="text-[10px] text-ink-mute leading-relaxed">
          Card on file is required for paid plans. Switching plans is prorated automatically — no migration, no downtime, no data lost.
        </div>
      </Card>
    </div>
  );
}

/* ── GENERAL ───────────────────────────────────────────────────────── */
function GeneralTab({ branch, reload }) {
  const [name, setName] = useState(branch?.name ?? "");
  const [city, setCity] = useState(branch?.city ?? "");
  const [tz,   setTz]   = useState(branch?.timezone ?? "Asia/Kuala_Lumpur");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(branch?.name ?? "");
    setCity(branch?.city ?? "");
    setTz(branch?.timezone ?? "Asia/Kuala_Lumpur");
  }, [branch?.id]);

  if (!branch) return <Empty hint="Select or create a branch first." />;

  async function save() {
    setBusy(true);
    setSaved(false);
    await supabase
      .from("branches")
      .update({ name, city, timezone: tz })
      .eq("id", branch.id);
    await reload();
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card luxe className="p-7">
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Branch name" value={name} onChange={setName} />
        <Field label="City"        value={city} onChange={setCity} />
        <Field label="Timezone"    value={tz}   onChange={setTz} />
        <Field label="Slug"        value={branch.slug ?? ""} onChange={() => {}} readOnly />
      </div>
      <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
      <div className="flex gap-3 items-center">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        {saved && <span className="text-[10px] text-[#9bbd9b]">Saved.</span>}
      </div>
    </Card>
  );
}

/* ── BRANCHES (CRUD) ───────────────────────────────────────────────── */
function CopyBookingLink({ slug }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://azqueue.io";
  const url = `${origin}/b/${slug}`;
  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      onClick={copy}
      title={url}
      className="text-[9px] font-mono text-gold-soft hover:text-gold border border-line hover:border-gold-deep px-2 py-1 transition whitespace-nowrap"
    >
      {copied ? "Copied ✓" : `/b/${slug}`}
    </button>
  );
}

function BranchesTab({ branches, currentId, select, reload, userId }) {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const limits = getLimits(user);
  const tierName = TIER_INFO[getTier(user)]?.name ?? "Essential";
  const atLimit = branches.length >= limits.maxBranches;

  async function addBranch() {
    if (!name.trim() || !userId) return;
    setBusy(true);
    setError(null);
    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 5);
    const { error: e, data } = await supabase
      .from("branches")
      .insert({ owner_id: userId, slug, name: name.trim(), city: city.trim() || null })
      .select("*")
      .single();
    setBusy(false);
    if (e) return setError(e.message);
    setName(""); setCity(""); setAdding(false);
    await reload();
    if (data) select(data.id);
  }

  return (
    <div className="space-y-3">
      <Card luxe>
        <CardHeader title="Your branches" right={<span className="ovline text-[9px]">{branches.length} total</span>} />
        {branches.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">No branches yet.</div>
        ) : (
          branches.map((b) => (
            <div
              key={b.id}
              className={`px-5 py-4 border-b border-line last:border-b-0 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center ${
                currentId === b.id ? "bg-[rgba(201,168,106,0.04)]" : ""
              }`}
            >
              <div>
                <div className="text-sm text-ink flex items-center gap-2">
                  {b.name}
                  {currentId === b.id && <span className="ovline text-[7px] text-gold-soft">selected</span>}
                </div>
                <div className="text-[10px] text-ink-mute mt-0.5">
                  {b.city ?? "—"} <span className="text-line-2">·</span> /q/{b.slug}
                </div>
              </div>
              <CopyBookingLink slug={b.slug} />
              <Button variant="ghost" size="sm" onClick={() => select(b.id)} disabled={currentId === b.id}>
                {currentId === b.id ? "Active" : "Switch"}
              </Button>
              <DeleteBranchButton branch={b} reload={reload} disabled={branches.length === 1} />
            </div>
          ))
        )}
      </Card>

      <Card luxe className="p-7">
        <div className="flex items-baseline justify-between mb-3">
          <div className="ovline text-gold-soft">Branches</div>
          <span className="text-[10px] text-ink-mute">
            {branches.length} of {limits.maxBranches === 999 ? "∞" : limits.maxBranches} on <span className="text-ink">{tierName}</span>
          </span>
        </div>
        {atLimit && !adding ? (
          <div className="border border-[#506b50] bg-[rgba(80,107,80,0.06)] p-5">
            <div className="ovline text-[#9bbd9b] mb-2">Branch limit reached</div>
            <p className="text-[12px] text-ink-soft leading-relaxed mb-3">
              {tierName} allows {limits.maxBranches} {limits.maxBranches === 1 ? "branch" : "branches"}. Upgrade to add more locations.
            </p>
            <Link to="/#pricing"><Button size="sm">Compare tiers →</Button></Link>
          </div>
        ) : !adding ? (
          <Button onClick={() => setAdding(true)}>+ Add a new branch</Button>
        ) : (
          <div className="space-y-4">
            <div className="ovline text-gold-soft mb-2">New branch</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name" value={name} onChange={setName} placeholder="Bangsar Studio" autoFocus />
              <Field label="City" value={city} onChange={setCity} placeholder="Bangsar" />
            </div>
            {error && <div className="text-[11px] text-[#d49185]">{error}</div>}
            <div className="flex gap-3">
              <Button onClick={addBranch} disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add branch"}</Button>
              <Button variant="ghost" onClick={() => { setAdding(false); setName(""); setCity(""); }}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DeleteBranchButton({ branch, reload, disabled }) {
  const [confirming, setConfirming] = useState(false);
  async function del() {
    await supabase.from("branches").delete().eq("id", branch.id);
    await reload();
  }
  if (disabled) return <span className="text-[9px] text-ink-mute">Last branch</span>;
  return confirming
    ? (
      <div className="flex gap-1">
        <Button size="sm" onClick={del}>Confirm</Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    )
    : <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>Remove</Button>;
}

/* ── SERVICES (per-branch CRUD) ────────────────────────────────────── */
function ServicesTab({ branch }) {
  const [services, setServices] = useState([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("20");

  async function load() {
    if (!branch?.id) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("branch_id", branch.id)
      .order("name");
    setServices(data ?? []);
  }
  useEffect(() => { load(); }, [branch?.id]);

  if (!branch) return <Empty hint="Select or create a branch first." />;

  async function add() {
    if (!name.trim()) return;
    await supabase.from("services").insert({
      branch_id: branch.id,
      name: name.trim(),
      duration_min: parseInt(duration, 10) || 20,
    });
    setName(""); setDuration("20");
    load();
  }

  async function toggleActive(svc) {
    await supabase.from("services").update({ active: !svc.active }).eq("id", svc.id);
    load();
  }

  async function remove(svc) {
    await supabase.from("services").delete().eq("id", svc.id);
    load();
  }

  return (
    <div className="space-y-3">
      <Card luxe>
        <CardHeader
          title="Services"
          subtitle={`What ${branch.name} offers — customers pick from this list at check-in`}
          right={<span className="ovline text-[9px]">{services.length} total</span>}
        />
        {services.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">No services yet.</div>
        ) : (
          services.map((s) => (
            <div key={s.id} className="px-5 py-4 border-b border-line last:border-b-0 grid grid-cols-[1fr_80px_80px_80px] gap-3 items-center">
              <div className="text-sm text-ink">{s.name}</div>
              <div className="text-[10px] text-ink-mute font-mono text-right">~{s.duration_min}m</div>
              <Button variant="ghost" size="sm" onClick={() => toggleActive(s)}>
                {s.active ? "Active" : "Hidden"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(s)}>Remove</Button>
            </div>
          ))
        )}
      </Card>

      <Card luxe className="p-7">
        <div className="ovline text-gold-soft mb-3">Add a service</div>
        <div className="grid sm:grid-cols-[1fr_120px_120px] gap-3 items-end">
          <Field label="Name" value={name} onChange={setName} placeholder="Haircut" />
          <Field label="Duration (min)" value={duration} onChange={setDuration} type="number" />
          <Button onClick={add} disabled={!name.trim()}>Add</Button>
        </div>
      </Card>
    </div>
  );
}

/* ── STAFF (invite by email + role) ────────────────────────────────── */
function StaffTab({ branch }) {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const limits = getLimits(user);
  const tierName = TIER_INFO[getTier(user)]?.name ?? "Essential";

  async function load() {
    if (!branch?.id) return;
    const { data } = await supabase
      .from("staff")
      .select("*")
      .eq("branch_id", branch.id)
      .order("created_at");
    setStaff(data ?? []);
  }
  useEffect(() => { load(); }, [branch?.id]);

  if (!branch) return <Empty hint="Select or create a branch first." />;

  async function invite() {
    if (!name.trim() || !email.trim()) return;
    // Insert a pending staff row. The 0002 migration trigger will link user_id
    // automatically the moment this email signs up.
    const payload = {
      branch_id: branch.id,
      display_name: name.trim(),
      role,
      invite_email: email.trim().toLowerCase(),
    };
    const { error } = await supabase.from("staff").insert(payload);
    // If the column doesn't exist (0002 not run yet), retry without invite_email
    if (error && /invite_email/.test(error.message || "")) {
      await supabase.from("staff").insert({
        branch_id: branch.id,
        display_name: `${name.trim()} (${email.trim()})`,
        role,
      });
    }
    setName(""); setEmail(""); setRole("staff");
    load();
  }

  async function changeRole(s, newRole) {
    await supabase.from("staff").update({ role: newRole }).eq("id", s.id);
    load();
  }
  async function remove(s) {
    await supabase.from("staff").delete().eq("id", s.id);
    load();
  }

  return (
    <div className="space-y-3">
      <Card luxe>
        <CardHeader title="Staff" subtitle={`People who can sign in to ${branch.name}`} right={<span className="ovline text-[9px]">{staff.length}</span>} />
        {staff.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">No staff yet.</div>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="px-5 py-4 border-b border-line last:border-b-0 grid grid-cols-[1fr_100px_100px_80px] gap-3 items-center">
              <div>
                <div className="text-sm text-ink">{s.display_name}</div>
                <div className="text-[10px] text-ink-mute mt-0.5">
                  {s.user_id
                    ? "linked · can sign in"
                    : s.invite_email
                      ? <>pending · <span className="text-gold-soft">{s.invite_email}</span></>
                      : "pending"}
                </div>
              </div>
              <RoleSelect value={s.role} onChange={(v) => changeRole(s, v)} />
              <span className={`text-[9px] uppercase tracking-[0.18em] ${
                s.status === "serving" ? "text-gold-soft" :
                s.status === "active" ? "text-[#9bbd9b]" :
                s.status === "on_break" ? "text-[#74b9e8]" :
                "text-ink-mute"
              }`}>
                {s.status ?? "off"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(s)}>Remove</Button>
            </div>
          ))
        )}
      </Card>

      <Card luxe className="p-7">
        <div className="flex items-baseline justify-between mb-3">
          <div className="ovline text-gold-soft">Invite teammate</div>
          <span className="text-[10px] text-ink-mute">
            {staff.length} of {limits.maxStaff === 999 ? "∞" : limits.maxStaff} seats used · <span className="text-ink">{tierName}</span>
          </span>
        </div>

        {staff.length >= limits.maxStaff ? (
          <div className="border border-[#506b50] bg-[rgba(80,107,80,0.06)] p-5">
            <div className="ovline text-[#9bbd9b] mb-2">Seat limit reached</div>
            <p className="text-[12px] text-ink-soft leading-relaxed mb-3">
              Your <span className="text-ink">{tierName}</span> plan allows {limits.maxStaff} staff per branch. To invite more,
              upgrade — every higher tier raises the cap.
            </p>
            <Link to="/#pricing"><Button size="sm">Compare tiers →</Button></Link>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-[1fr_1fr_120px_100px] gap-3 items-end">
              <Field label="Name" value={name} onChange={setName} placeholder="Yusuf K." />
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="yusuf@example.com" />
              <RoleField value={role} onChange={setRole} />
              <Button onClick={invite} disabled={!name.trim() || !email.trim()}>Add</Button>
            </div>
            <div className="rule-ornament my-4 text-[8px]"><span>·</span></div>
            <div className="text-[10px] text-ink-mute">
              They'll appear here as <em>pending</em> until they sign up with the same email — then they're linked automatically and routed to the staff dashboard.
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function RoleSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg-elev border border-line text-xs px-2 py-1.5 outline-none focus:border-gold-deep"
    >
      <option value="owner">Owner</option>
      <option value="manager">Manager</option>
      <option value="staff">Staff</option>
    </select>
  );
}
function RoleField({ value, onChange }) {
  return (
    <div>
      <div className="ovline mb-1.5 text-[9px]">Role</div>
      <RoleSelect value={value} onChange={onChange} />
    </div>
  );
}

/* ── MODES (toggles) ───────────────────────────────────────────────── */
function ModesTab({ branch, reload }) {
  if (!branch) return <Empty hint="Select or create a branch first." />;

  async function toggle(field, value) {
    await supabase.from("branches").update({ [field]: value }).eq("id", branch.id);
    await reload();
  }

  return (
    <Card luxe className="p-7 space-y-5">
      <Toggle
        label="Autopilot"
        desc="Auto-call next customer at adaptive pace"
        on={!!branch.autopilot}
        setOn={(v) => toggle("autopilot", v)}
      />
      <Toggle
        label="Islamic Mode"
        desc="Prayer-aware queue with auto-pause"
        on={!!branch.islamic_mode}
        setOn={(v) => toggle("islamic_mode", v)}
        green
      />
    </Card>
  );
}

function Toggle({ label, desc, on, setOn, green }) {
  const onColor = green ? "bg-[#506b50]" : "bg-gold-deep";
  return (
    <div className="flex items-center justify-between cursor-pointer" onClick={() => setOn(!on)}>
      <div>
        <div className="text-sm">{label}</div>
        <div className="text-[10px] text-ink-mute mt-0.5">{desc}</div>
      </div>
      <div className={`relative w-9 h-5 rounded-full transition ${on ? onColor : "bg-line"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-ink transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function Empty({ hint }) {
  return (
    <Card luxe className="p-10 text-center">
      <div className="ovline text-ink-mute mb-2">Nothing to show</div>
      <p className="text-ink-soft text-sm">{hint}</p>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", readOnly, autoFocus }) {
  return (
    <div>
      <div className="ovline mb-1.5 text-[9px]">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        autoFocus={autoFocus}
        className={`w-full bg-bg-elev border outline-none text-sm px-3 py-2 transition text-ink placeholder:text-ink-mute ${
          readOnly ? "border-line text-ink-mute" : "border-line focus:border-gold-deep"
        }`}
      />
    </div>
  );
}


/* ── CHECKLISTS ───────────────────────────────────────────────────── */

function ChecklistsTab({ branch }) {
  const [services, setServices]       = useState([]);
  const [selected, setSelected]       = useState(null); // service name
  const [customItems, setCustomItems] = useState([]);
  const [reminder, setReminder]       = useState("");
  const [dirty, setDirty]             = useState(false);
  const [saved, setSaved]             = useState(false);
  const [preview, setPreview]         = useState(false);
  const [newItem, setNewItem]         = useState("");

  // Load branch services + any existing custom checklists
  useEffect(() => {
    if (!branch?.id) return;
    supabase
      .from("services")
      .select("id, name")
      .eq("branch_id", branch.id)
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        const svcs = data ?? [];
        setServices(svcs);
        if (svcs.length && !selected) pickService(svcs[0].name, branch.id);
      });
  }, [branch?.id]);

  function pickService(name, branchId) {
    setSelected(name);
    setDirty(false);
    setSaved(false);
    setPreview(false);
    const effective = getEffectiveChecklist(branchId ?? branch?.id, name);
    setCustomItems(effective?.items ? [...effective.items] : []);
    setReminder(effective?.reminder ?? "");
  }

  function handleSave() {
    if (!branch?.id || !selected) return;
    const base = getChecklist(selected);
    saveCustomChecklist(branch.id, base?.key ?? selected.toLowerCase(), {
      items: customItems,
      reminder: reminder.trim() || undefined,
    });
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    if (!branch?.id || !selected) return;
    const base = getChecklist(selected);
    resetCustomChecklist(branch.id, base?.key ?? selected.toLowerCase());
    pickService(selected, branch.id);
  }

  function addItem(e) {
    e.preventDefault();
    if (!newItem.trim()) return;
    setCustomItems((prev) => [...prev, newItem.trim()]);
    setNewItem("");
    setDirty(true);
    setSaved(false);
  }

  function removeItem(i) {
    setCustomItems((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
    setSaved(false);
  }

  function moveItem(i, dir) {
    setCustomItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
    setSaved(false);
  }

  const baseChecklist  = selected ? getChecklist(selected) : null;
  const needsChecklist = baseChecklist?.needsChecklist !== false;

  // Sample message preview
  const previewMsg = selected && branch
    ? buildChecklistMessage({
        customerName: "Alex",
        businessName: branch.name,
        serviceName:  selected,
        token: "42",
        checklist: { items: customItems, reminder: reminder.trim() || undefined },
      })
    : "";

  return (
    <div className="max-w-3xl">
      <p className="text-xs text-ink-soft mb-6">
        When a customer joins the queue or confirms a booking, they will automatically
        receive a WhatsApp message listing what to bring. Edit the checklist per service
        below. Changes are saved per branch and take effect immediately.
      </p>

      <div className="flex gap-6">

        {/* Left: service selector */}
        <aside className="w-48 shrink-0">
          <div className="ovline text-[9px] text-gold-soft mb-2">Services</div>
          {services.length === 0 ? (
            <p className="text-xs text-ink-mute">No active services. Add them in the Services tab first.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {services.map((s) => {
                const cl = getChecklist(s.name);
                const isActive = selected === s.name;
                return (
                  <button
                    key={s.id}
                    onClick={() => pickService(s.name, branch?.id)}
                    className={"w-full text-left px-3 py-2 text-xs border-l-2 transition " + (
                      isActive ? "border-gold-deep text-ink bg-white/[0.03]" : "border-transparent text-ink-mute hover:text-ink hover:border-line"
                    )}
                  >
                    <div className="truncate">{s.name}</div>
                    <div className={"text-[9px] mt-0.5 " + (cl?.needsChecklist ? "text-[#9bbd9b]" : "text-ink-mute")}>
                      {cl?.needsChecklist ? "Checklist required" : "No checklist"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Also allow editing the built-in service defaults */}
          <div className="mt-4 pt-4 border-t border-line">
            <div className="ovline text-[9px] text-ink-mute mb-2">Built-in services</div>
            {["Immigration", "Tax Preparation", "Notary", "Medical", "Dental", "General"].map((name) => (
              <button
                key={name}
                onClick={() => pickService(name, branch?.id)}
                className={"w-full text-left px-3 py-1.5 text-[10px] border-l-2 transition " + (
                  selected === name ? "border-gold-deep text-ink" : "border-transparent text-ink-mute hover:text-ink hover:border-line"
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </aside>

        {/* Right: editor */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <p className="text-xs text-ink-mute">Select a service to edit its checklist.</p>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="ovline text-[9px] text-gold-soft">{selected}</div>
                  <div className={"text-[10px] mt-0.5 " + (needsChecklist ? "text-[#9bbd9b]" : "text-ink-mute")}>
                    {needsChecklist ? "Checklist will be sent automatically" : "No checklist sent for this service type"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreview((x) => !x)}
                    className="text-[10px] border border-line px-2.5 py-1 text-ink-mute hover:text-ink transition"
                  >
                    {preview ? "Edit" : "Preview message"}
                  </button>
                  <button
                    onClick={handleReset}
                    className="text-[10px] border border-line px-2.5 py-1 text-ink-mute hover:text-red-400 transition"
                  >
                    Reset to default
                  </button>
                  <Button size="sm" onClick={handleSave} disabled={!dirty}>
                    {saved ? "Saved!" : "Save"}
                  </Button>
                </div>
              </div>

              {preview ? (
                /* Message preview */
                <div className="border border-line bg-bg-elev p-4">
                  <div className="ovline text-[9px] text-ink-mute mb-3">WhatsApp / SMS preview</div>
                  <pre className="text-xs text-ink-soft whitespace-pre-wrap leading-relaxed font-sans">{previewMsg}</pre>
                </div>
              ) : (
                /* Editor */
                <div>
                  {/* Checklist items */}
                  <div className="mb-4">
                    <div className="ovline text-[9px] text-ink-mute mb-2">Items to bring</div>
                    {customItems.length === 0 ? (
                      <p className="text-xs text-ink-mute mb-3">No items yet — add one below.</p>
                    ) : (
                      <div className="flex flex-col gap-1 mb-3">
                        {customItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 group border border-line/50 bg-bg-elev px-3 py-2">
                            <span className="text-ink-mute text-[10px] w-4 shrink-0 mt-0.5">{i + 1}.</span>
                            <span className="text-xs text-ink-soft flex-1 leading-relaxed">{item}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button onClick={() => moveItem(i, -1)} className="text-[10px] text-ink-mute hover:text-ink px-1" title="Move up">↑</button>
                              <button onClick={() => moveItem(i,  1)} className="text-[10px] text-ink-mute hover:text-ink px-1" title="Move down">↓</button>
                              <button onClick={() => removeItem(i)}   className="text-[10px] text-ink-mute hover:text-red-400 px-1" title="Remove">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add item */}
                    <form onSubmit={addItem} className="flex gap-2">
                      <input
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Add an item (e.g. Government-issued photo ID)"
                        className="flex-1 bg-transparent border border-line text-xs px-3 py-2 focus:outline-none focus:border-gold-deep placeholder:text-ink-mute"
                      />
                      <Button size="sm" type="submit" disabled={!newItem.trim()}>+ Add</Button>
                    </form>
                  </div>

                  {/* Reminder note */}
                  <div>
                    <div className="ovline text-[9px] text-ink-mute mb-2">Reminder note (optional)</div>
                    <input
                      value={reminder}
                      onChange={(e) => { setReminder(e.target.value); setDirty(true); setSaved(false); }}
                      placeholder="e.g. Bring originals AND photocopies of every document."
                      className="w-full bg-transparent border border-line text-xs px-3 py-2 focus:outline-none focus:border-gold-deep placeholder:text-ink-mute"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── INTEGRATIONS ─────────────────────────────────────────────────── */

function IntegrationsTab({ branch }) {
  const [apiKey, setApiKey]       = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [status, setStatus]       = useState("idle"); // idle | testing | connected | error
  const [errorMsg, setErrorMsg]   = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!branch?.id) return;
    getFreshdeskConfig(branch.id).then((cfg) => {
      if (cfg) {
        setConnected(true);
        setSubdomain(cfg.subdomain);
        // Don't pre-fill API key for security — show masked placeholder
      }
    });
  }, [branch?.id]);

  async function handleSave() {
    if (!apiKey.trim() || !subdomain.trim()) return;
    setStatus("testing");
    setErrorMsg("");
    try {
      await saveFreshdeskConfig(branch.id, {
        apiKey: apiKey.trim(),
        subdomain: subdomain.trim().replace(/\.freshdesk\.com.*/, ""),
      });
      setStatus("connected");
      setConnected(true);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message ?? "Connection failed.");
    }
  }

  async function handleDisconnect() {
    await disconnectFreshdesk(branch.id);
    setConnected(false);
    setApiKey("");
    setSubdomain("");
    setStatus("idle");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Freshdesk */}
      <Card luxe className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="ovline text-[9px] text-gold-soft mb-1">Freshdesk</div>
            <h3 className="text-sm font-medium text-ink">Support history for customer personas</h3>
            <p className="text-[11px] text-ink-soft mt-1 max-w-md leading-relaxed">
              Connect Freshdesk to pull each customer's support tickets into their AI persona.
              Staff see a richer profile — recent issues, ticket priority, resolution history.
            </p>
          </div>
          {connected && (
            <span className="flex items-center gap-1.5 text-[10px] text-[#9bbd9b] border border-[#506b50] px-2 py-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9bbd9b]" /> Connected
            </span>
          )}
        </div>

        {/* How to find your API key */}
        <div className="bg-[rgba(201,168,106,0.05)] border border-[rgba(201,168,106,0.15)] px-4 py-3 mb-5 text-[11px] text-ink-soft leading-relaxed">
          <span className="text-gold-soft font-medium">Finding your API key: </span>
          Log in to Freshdesk → click your avatar (top-right corner) →{" "}
          <strong className="text-ink">Profile Settings</strong> → scroll down to the right side.
          Your API key is shown there. Your subdomain is the part before{" "}
          <span className="font-mono text-ink">.freshdesk.com</span> in your URL.
        </div>

        <div className="space-y-3">
          <div>
            <div className="ovline text-[9px] text-ink-mute mb-1">Subdomain</div>
            <input
              type="text"
              value={subdomain}
              onChange={(e) => { setSubdomain(e.target.value); setStatus("idle"); }}
              placeholder="yourcompany  (from yourcompany.freshdesk.com)"
              className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-3 py-2 text-ink placeholder:text-ink-mute"
            />
          </div>
          <div>
            <div className="ovline text-[9px] text-ink-mute mb-1">
              API Key{connected ? " (enter new key to update)" : ""}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setStatus("idle"); }}
              placeholder={connected ? "••••••••••••••••" : "Paste your API key here"}
              className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-3 py-2 text-ink placeholder:text-ink-mute font-mono"
            />
          </div>
        </div>

        {status === "error" && (
          <div className="mt-3 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
            {errorMsg}
          </div>
        )}
        {status === "connected" && (
          <div className="mt-3 text-[11px] text-[#9bbd9b] bg-[#506b50]/10 border border-[#506b50]/30 px-3 py-2">
            ✓ Connected successfully. Freshdesk data will enrich customer personas automatically.
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <Button
            onClick={handleSave}
            disabled={status === "testing" || (!apiKey.trim() && !connected)}
          >
            {status === "testing" ? "Testing connection…" : connected ? "Update credentials" : "Connect Freshdesk"}
          </Button>
          {connected && (
            <Button variant="ghost" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </Card>

      {/* Placeholder for future integrations */}
      <Card className="p-6 opacity-50">
        <div className="ovline text-[9px] text-ink-mute mb-1">Coming soon</div>
        <h3 className="text-sm text-ink-soft">WhatsApp Business · Facebook · Instagram · HubSpot</h3>
        <p className="text-[11px] text-ink-mute mt-1">More integrations are on the roadmap.</p>
      </Card>
    </div>
  );
}
