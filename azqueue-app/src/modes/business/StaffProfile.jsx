import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import Card from "../../components/Card";
import Button from "../../components/Button";

/**
 * StaffProfile — per-staff configuration editor.
 *
 * Owners configure each staff member's:
 *   · which services they handle
 *   · their preference weighting per service (autopilot routing)
 *   · maximum case complexity
 *   · work style (balanced / high-volume / complex)
 *   · expertise tags
 *   · languages with fluency
 *   · estimated time per service
 *   · private notes
 *
 * Route: /business/staff/:id
 */

const COMPLEXITY = [
  { value: 1, name: "Basic",    body: "Quick walk-ins, repeat customers, simple sessions" },
  { value: 2, name: "Simple",   body: "Standard services with predictable timing" },
  { value: 3, name: "Moderate", body: "Multi-step sessions with some judgment calls" },
  { value: 4, name: "Complex",  body: "First-time customers, edge cases, escalations" },
  { value: 5, name: "Expert",   body: "Highest-difficulty work; mentors junior staff" },
];

const WORK_STYLES = [
  { id: "balanced",      name: "Balanced",      body: "A mix of simple and complex sessions through the day" },
  { id: "high_volume",   name: "High volume",   body: "Prefers quick, repeatable services; keeps the queue moving" },
  { id: "complex_cases", name: "Complex cases", body: "Thrives on challenging or unusual sessions; longer per ticket" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ms", name: "Bahasa Malaysia" },
  { code: "ar", name: "Arabic" },
  { code: "ur", name: "Urdu" },
  { code: "fr", name: "French" },
  { code: "zh", name: "Chinese (Mandarin)" },
  { code: "es", name: "Spanish" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "vi", name: "Vietnamese" },
  { code: "ko", name: "Korean" },
  { code: "ja", name: "Japanese" },
  { code: "am", name: "Amharic" },
  { code: "ti", name: "Tigrinya" },
];

const FLUENCY = [
  { id: "fluent",         name: "Fluent" },
  { id: "conversational", name: "Conversational" },
  { id: "basic",          name: "Basic" },
];

const SUGGESTED_TAGS = [
  "Walk-ins", "Regulars", "VIP customers", "First-time customers",
  "Children", "Group bookings", "After-hours", "Weekend shifts",
  "Quiet sessions", "High-energy sessions",
];

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { branch } = useBranch();

  const [staff, setStaff] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Profile state — kept separate so we save in one batch
  const [servicesHandled, setServicesHandled] = useState([]);
  const [servicePrefs, setServicePrefs]       = useState({});
  const [maxComplexity, setMaxComplexity]     = useState(3);
  const [workStyle, setWorkStyle]             = useState("balanced");
  const [expertise, setExpertise]             = useState([]);
  const [languages, setLanguages]             = useState([]);
  const [estimatedTimes, setEstimatedTimes]   = useState({});
  const [notes, setNotes]                     = useState("");

  // Load staff row + services
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: s, error: sErr } = await supabase
        .from("staff").select("*").eq("id", id).single();
      if (sErr || !s) {
        if (!cancelled) { setError("Staff member not found."); setLoading(false); }
        return;
      }

      const { data: svcs } = await supabase
        .from("services").select("id, name, duration_min")
        .eq("branch_id", s.branch_id).eq("active", true).order("name");

      if (cancelled) return;
      setStaff(s);
      setServices(svcs ?? []);

      // Hydrate form state from staff row, fall back to defaults
      setServicesHandled(s.services_handled ?? []);
      setServicePrefs(s.service_preferences ?? {});
      setMaxComplexity(s.max_complexity ?? 3);
      setWorkStyle(s.work_style ?? "balanced");
      setExpertise(s.expertise_areas ?? []);
      setLanguages(s.languages ?? []);
      setEstimatedTimes(s.estimated_times ?? {});
      setNotes(s.notes ?? "");

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── Save ──────────────────────────────────────────────────────
  async function save() {
    if (!staff) return;
    setSaving(true); setError(null); setSaved(false);
    const { error: e } = await supabase
      .from("staff")
      .update({
        services_handled:    servicesHandled,
        service_preferences: servicePrefs,
        max_complexity:      maxComplexity,
        work_style:          workStyle,
        expertise_areas:     expertise,
        languages:           languages,
        estimated_times:     estimatedTimes,
        notes:               notes.trim() || null,
        profile_updated_at:  new Date().toISOString(),
      })
      .eq("id", staff.id);
    setSaving(false);
    if (e) return setError(e.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Handlers ─────────────────────────────────────────────────
  const toggleService = (sid) =>
    setServicesHandled((cur) => cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]);

  const setPref = (sid, value) =>
    setServicePrefs((p) => ({ ...p, [sid]: value }));

  const toggleTag = (tag) =>
    setExpertise((cur) => cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]);

  const addLanguage = (code) => {
    if (!code || languages.some((l) => l.code === code)) return;
    setLanguages((cur) => [...cur, { code, fluency: "fluent" }]);
  };
  const updateLanguageFluency = (code, fluency) =>
    setLanguages((cur) => cur.map((l) => l.code === code ? { ...l, fluency } : l));
  const removeLanguage = (code) =>
    setLanguages((cur) => cur.filter((l) => l.code !== code));

  const setEstimatedTime = (sid, minutes) =>
    setEstimatedTimes((cur) => ({ ...cur, [sid]: parseInt(minutes, 10) || 0 }));

  if (loading) {
    return <div className="p-8 max-w-3xl ovline text-ink-mute">Loading profile…</div>;
  }
  if (!staff) {
    return (
      <div className="p-8 max-w-2xl">
        <p className="text-ink-soft text-sm">{error ?? "Staff member not found."}</p>
        <Link to="/business/settings" className="text-gold-soft text-[11px] uppercase tracking-[0.2em] mt-4 inline-block">
          ← Back to settings
        </Link>
      </div>
    );
  }

  return (
    <div className="atmosphere-hero p-8 max-w-4xl">
      <header className="mb-8 flex justify-between items-start gap-6">
        <div>
          <Link to="/business/settings" className="ovline text-[8px] text-ink-mute hover:text-ink mb-2 inline-block">
            ← Settings · Staff
          </Link>
          <div className="ovline mb-2 text-gold-soft">Staff profile</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">{staff.display_name}</h1>
          <div className="text-xs text-ink-soft mt-2 capitalize">
            {staff.role} · {branch?.name ?? "branch"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && <span className="text-[10px] text-[#9bbd9b]">Profile updated.</span>}
          {error && <span className="text-[10px] text-[#d49185]">{error}</span>}
        </div>
      </header>

      {/* ── Services this staff handles ──────────────────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Services"
          title="Which services this staff handles"
          body="When AI routing is enabled, only these services route to this person. Untick anything outside their scope."
        />
        <div className="space-y-px bg-line border border-line">
          {services.length === 0 ? (
            <div className="bg-bg-elev p-4 text-[11px] text-ink-mute italic">
              No services on this branch yet. Add some in Settings · Services first.
            </div>
          ) : services.map((s) => {
            const on = servicesHandled.includes(s.id);
            return (
              <label key={s.id} className="bg-bg-elev p-4 grid grid-cols-[20px_1fr_60px] gap-3 items-center cursor-pointer hover:bg-[rgba(201,168,106,0.04)] transition">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleService(s.id)}
                  className="accent-gold-deep cursor-pointer"
                />
                <span className={`text-sm ${on ? "text-ink" : "text-ink-soft"}`}>{s.name}</span>
                <span className="text-[10px] text-ink-mute font-mono text-right">~{s.duration_min}m</span>
              </label>
            );
          })}
        </div>
      </Card>

      {/* ── Routing preference (per-service score) ───────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Routing preference"
          title="How strongly to prefer this staff per service"
          body="When AI routing is enabled, higher scores mean autopilot prefers this person for that service. Use 3 as neutral."
        />
        {servicesHandled.length === 0 ? (
          <p className="text-ink-mute text-[11px] italic">Pick services above to set preferences here.</p>
        ) : (
          <div className="space-y-3">
            {services.filter((s) => servicesHandled.includes(s.id)).map((s) => (
              <PreferenceRow
                key={s.id}
                label={s.name}
                value={servicePrefs[s.id] ?? 3}
                onChange={(v) => setPref(s.id, v)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ── Maximum complexity ───────────────────────────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Maximum complexity"
          title="The hardest case this staff should take"
        />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-line border border-line">
          {COMPLEXITY.map((c) => {
            const active = maxComplexity === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setMaxComplexity(c.value)}
                className={`bg-bg-elev p-4 text-left transition ${active ? "ring-1 ring-gold-deep ring-inset" : "hover:bg-bg"}`}
              >
                <div className={`ovline text-[8px] mb-1 ${active ? "text-gold-soft" : ""}`}>{c.value}</div>
                <div className="text-sm">{c.name}</div>
                <div className="text-[10px] text-ink-mute mt-1 leading-relaxed">{c.body}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Work style ───────────────────────────────────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Work style"
          title="How this staff likes to work"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border border-line">
          {WORK_STYLES.map((w) => {
            const active = workStyle === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkStyle(w.id)}
                className={`bg-bg-elev p-5 text-left transition ${active ? "ring-1 ring-gold-deep ring-inset" : "hover:bg-bg"}`}
              >
                <div className={`ovline text-[8px] mb-1 ${active ? "text-gold-soft" : ""}`}>{active ? "Selected" : "Choose"}</div>
                <div className="text-sm">{w.name}</div>
                <div className="text-[10px] text-ink-mute mt-1 leading-relaxed">{w.body}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Expertise ────────────────────────────────────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Expertise"
          title="What this staff is best at"
          body="Pick from suggestions or add your own tags. Used as routing hints when relevant."
        />
        <TagPicker
          value={expertise}
          onToggle={toggleTag}
          suggestions={SUGGESTED_TAGS}
          placeholder="Add a custom tag"
        />
      </Card>

      {/* ── Languages ────────────────────────────────────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Languages"
          title="What this staff speaks"
          body="Customers using the multilingual flow can match with a staff member who shares their language."
        />
        <LanguagePicker
          value={languages}
          onAdd={addLanguage}
          onUpdate={updateLanguageFluency}
          onRemove={removeLanguage}
        />
      </Card>

      {/* ── Estimated times ─────────────────────────────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Estimated service time"
          title="Minutes this staff typically takes per service"
          body="Optional. Autopilot uses this as a starting baseline before learning from real data."
        />
        {servicesHandled.length === 0 ? (
          <p className="text-ink-mute text-[11px] italic">Pick services above first.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {services.filter((s) => servicesHandled.includes(s.id)).map((s) => (
              <div key={s.id} className="border border-line bg-bg-elev p-3 grid grid-cols-[1fr_72px_28px] gap-2 items-center">
                <span className="text-sm text-ink truncate">{s.name}</span>
                <input
                  type="number"
                  min={0}
                  value={estimatedTimes[s.id] ?? ""}
                  onChange={(e) => setEstimatedTime(s.id, e.target.value)}
                  placeholder={String(s.duration_min)}
                  className="bg-bg border border-line focus:border-gold-deep outline-none text-xs px-2 py-1.5 text-ink"
                />
                <span className="text-[10px] text-ink-mute">min</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Notes ───────────────────────────────────────────────── */}
      <Card luxe className="p-7 mb-3">
        <SectionHead
          eyebrow="Notes"
          title="Private notes for the manager"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything you'd like to remember about this staff member — strengths, schedule preferences, customer feedback."
          className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-4 py-3 transition text-ink placeholder:text-ink-mute min-h-[120px] resize-y"
        />
        {staff.profile_updated_at && (
          <div className="text-[10px] text-ink-mute mt-3 tracking-wide">
            Last updated · {new Date(staff.profile_updated_at).toLocaleDateString()}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Saving…" : "Save profile →"}
        </Button>
      </div>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────── */
function SectionHead({ eyebrow, title, body }) {
  return (
    <div className="mb-5">
      <div className="ovline text-gold-soft mb-2">{eyebrow}</div>
      <h2 className="font-display text-2xl font-light tracking-tighter">{title}</h2>
      {body && <p className="text-ink-soft text-[12px] leading-relaxed mt-2 max-w-xl">{body}</p>}
    </div>
  );
}

function PreferenceRow({ label, value, onChange }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`Preference ${n}`}
              className={`w-8 h-8 border text-[11px] font-mono transition ${
                active
                  ? "border-gold-deep bg-[rgba(201,168,106,0.10)] text-gold-soft"
                  : "border-line text-ink-mute hover:border-gold-deep hover:text-ink"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagPicker({ value, onToggle, suggestions, placeholder }) {
  const [draft, setDraft] = useState("");
  function add() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onToggle(trimmed);
    setDraft("");
  }
  const customTags = value.filter((t) => !suggestions.includes(t));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((tag) => {
          const on = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`px-3 py-1.5 border text-[11px] tracking-wide transition ${
                on ? "border-gold-deep bg-[rgba(201,168,106,0.08)] text-gold-soft"
                   : "border-line text-ink-soft hover:border-gold-deep hover:text-ink"
              }`}
            >
              {tag}
            </button>
          );
        })}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className="px-3 py-1.5 border border-gold-deep bg-[rgba(201,168,106,0.08)] text-gold-soft text-[11px] tracking-wide"
            title="Custom tag · click to remove"
          >
            {tag} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 bg-bg-elev border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 text-ink placeholder:text-ink-mute"
        />
        <Button size="sm" onClick={add} disabled={!draft.trim()}>+ Add</Button>
      </div>
    </div>
  );
}

function LanguagePicker({ value, onAdd, onUpdate, onRemove }) {
  const remaining = LANGUAGES.filter((l) => !value.some((v) => v.code === l.code));
  const [picker, setPicker] = useState(remaining[0]?.code ?? "");

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <div className="space-y-px bg-line border border-line">
          {value.map((lang) => {
            const meta = LANGUAGES.find((l) => l.code === lang.code);
            return (
              <div key={lang.code} className="bg-bg-elev p-3 grid grid-cols-[1fr_180px_24px] gap-3 items-center">
                <span className="text-sm text-ink">{meta?.name ?? lang.code}</span>
                <div className="flex gap-1">
                  {FLUENCY.map((f) => {
                    const active = lang.fluency === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onUpdate(lang.code, f.id)}
                        className={`flex-1 px-2 py-1.5 border text-[10px] tracking-wide transition ${
                          active ? "border-gold-deep bg-[rgba(201,168,106,0.08)] text-gold-soft"
                                 : "border-line text-ink-mute hover:border-gold-deep"
                        }`}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(lang.code)}
                  className="text-ink-mute hover:text-[#d49185] text-xs"
                  aria-label="Remove"
                >×</button>
              </div>
            );
          })}
        </div>
      )}
      {remaining.length > 0 && (
        <div className="flex gap-2">
          <select
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
            className="flex-1 bg-bg-elev border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 text-ink"
          >
            {remaining.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <Button size="sm" onClick={() => { onAdd(picker); setPicker(remaining[1]?.code ?? remaining[0]?.code ?? ""); }}>
            + Add language
          </Button>
        </div>
      )}
    </div>
  );
}
