import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const C = {
  void:    "#080807",
  ink:     "#f0ede6",
  gold:    "#b8955a",
  goldLit: "#d4b478",
  sage:    "#9bbd9b",
  muted:   "#60605a",
  faint:   "#2a2926",
  border:  "rgba(255,255,255,0.07)",
  borderL: "rgba(255,255,255,0.12)",
  card:    "#0c0c0b",
  panel:   "#111110",
  bad:     "#d49185",
};

const TIERS = [
  { id: "essential",    name: "Starter",    price: 29,  tag: "Single location",       feats: ["1 branch", "1 kiosk", "WhatsApp notifications", "Basic analytics"] },
  { id: "professional", name: "Growth",     price: 99,  tag: "Most popular",          feats: ["Up to 10 branches", "Unlimited kiosks", "Loyalty cards", "Prayer pause"], gold: true },
  { id: "executive",    name: "Scale",      price: 199, tag: "Multi-region teams",    feats: ["Up to 25 branches", "API access", "Advanced analytics", "Priority support"] },
  { id: "manager",      name: "Enterprise", price: null, tag: "Custom",               feats: ["Unlimited branches", "SSO & audit logs", "99.9% SLA", "Dedicated CSM"], sage: true },
];

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialMode = useMemo(() => {
    const m = params.get("mode");
    if (m === "personal" || m === "business") return m;
    return "business";
  }, [params]);

  const initialTier = useMemo(() => {
    const t = params.get("tier");
    return TIERS.find((x) => x.id === t)?.id ?? "professional";
  }, [params]);

  const [mode, setMode] = useState(initialMode);
  const [tier, setTier] = useState(initialTier);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 8)        return setError("Password must be at least 8 characters.");
    if (!/[a-zA-Z]/.test(password))  return setError("Password must include at least one letter.");
    if (!/\d/.test(password))        return setError("Password must include at least one number.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Please enter a valid email.");
    if (mode === "business" && !businessName.trim()) return setError("Please enter your business name.");
    if (mode === "personal" && !displayName.trim()) return setError("Please enter your name.");

    setBusy(true);
    const payload = mode === "business"
      ? { mode: "business", email, password, businessName, tier }
      : { mode: "personal", email, password, displayName };

    const { data, error } = await signUp(payload);
    setBusy(false);

    if (error) return setError(error.message);

    if (!data?.session) {
      setPendingConfirm(true);
      return;
    }

    navigate(mode === "personal" ? "/personal" : "/business", { replace: true });
  }

  if (pendingConfirm) return <PendingConfirm email={email} mode={mode} />;

  const selected = TIERS.find((t) => t.id === tier) ?? TIERS[1];

  return (
    <div style={{ minHeight: "100vh", background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Top bar */}
      <header style={{ padding: "20px 48px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <div style={{ width: 24, height: 24, background: C.gold, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.void }}>A</div>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
        </Link>
        <div style={{ fontSize: 12, color: C.muted }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: C.goldLit, textDecoration: "none" }}>Sign in</Link>
        </div>
      </header>

      <main style={{ padding: "64px 48px 96px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>

          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500, marginBottom: 18 }}>Create account</div>
            <h1 style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.1, fontFamily: "Georgia, 'Times New Roman', serif", margin: "0 0 14px" }}>
              Start your <em style={{ color: C.gold, fontStyle: "italic" }}>free trial.</em>
            </h1>
            <p style={{ fontSize: 14, color: C.muted, margin: 0, letterSpacing: "-0.005em" }}>14 days · no credit card required · cancel anytime.</p>
          </div>

          {/* Mode toggle */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", maxWidth: 540, margin: "0 auto 40px" }}>
            <ModeButton
              label="Business"
              caption="Queue + bookings for your shop or branch network"
              active={mode === "business"}
              onClick={() => setMode("business")}
            />
            <ModeButton
              label="Personal"
              caption="Deep work + tasks for your own day"
              active={mode === "personal"}
              onClick={() => setMode("personal")}
              variant="sage"
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ maxWidth: 440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {mode === "business" ? (
              <Field label="Business name"  value={businessName} onChange={setBusinessName} placeholder="Khalifa Premier Services" required autoFocus />
            ) : (
              <Field label="Your name"      value={displayName}  onChange={setDisplayName}  placeholder="Ahmed" required autoFocus />
            )}
            <Field label="Email address" type="email"    value={email}    onChange={setEmail}    placeholder="you@example.com"     required />
            <Field label="Password"      type="password" value={password} onChange={setPassword} placeholder="8+ chars · letters & numbers" required />

            {error && (
              <div style={{ fontSize: 12, color: C.bad, background: "rgba(181,107,95,0.08)", border: "1px solid rgba(181,107,95,0.25)", borderRadius: 6, padding: "10px 14px", lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 7, border: "none",
                cursor: busy ? "not-allowed" : "pointer",
                background: C.gold, color: C.void,
                fontSize: 13, fontWeight: 600, letterSpacing: "0.02em",
                opacity: busy ? 0.7 : 1, transition: "all 0.2s ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 10px 30px -10px rgba(184,149,90,0.4)",
                textTransform: "uppercase",
              }}>
              {busy ? "Creating account…" : `Create ${mode === "business" ? "business" : "personal"} account`}
              {!busy && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
            </button>

            <div style={{ fontSize: 10.5, color: C.muted, textAlign: "center", letterSpacing: "0.02em" }}>
              By continuing you agree to our{" "}
              <Link to="/legal/terms" style={{ color: C.muted, textDecoration: "underline", textUnderlineOffset: 2 }}>Terms</Link>
              {" "}and{" "}
              <Link to="/legal/privacy" style={{ color: C.muted, textDecoration: "underline", textUnderlineOffset: 2 }}>Privacy Policy</Link>.
            </div>
          </form>

          {/* Tier picker (business only) */}
          {mode === "business" && (
            <div style={{ marginTop: 80 }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500, marginBottom: 12 }}>Choose your plan</div>
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                  Currently selecting <span style={{ color: C.ink }}>{selected.name}</span>
                  {selected.price ? ` · $${selected.price}/mo` : " · Custom pricing"} · change anytime.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                {TIERS.map((t) => {
                  const isActive = tier === t.id;
                  const accent = t.sage ? C.sage : C.gold;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTier(t.id)}
                      style={{
                        position: "relative", background: isActive ? C.panel : C.card,
                        padding: "28px 22px", textAlign: "left", border: "none", cursor: "pointer",
                        color: "inherit", transition: "all 0.2s",
                        boxShadow: isActive ? `inset 0 0 0 1px ${accent}55` : "none",
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#0f0f0e"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = C.card; }}>
                      {t.gold && (
                        <div style={{ position: "absolute", top: -1, left: 16, background: C.gold, color: C.void, fontSize: 8, padding: "2px 8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
                          Most popular
                        </div>
                      )}
                      {t.sage && (
                        <div style={{ position: "absolute", top: -1, left: 16, background: "#506b50", color: "#e4f0e4", fontSize: 8, padding: "2px 8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
                          Enterprise
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: isActive ? accent : C.muted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500, marginTop: t.gold || t.sage ? 14 : 0, marginBottom: 10 }}>{t.tag}</div>
                      <div style={{ fontSize: 16, color: C.ink, fontFamily: "Georgia, serif", marginBottom: 10 }}>{t.name}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 14 }}>
                        {t.price ? (
                          <>
                            <span style={{ fontSize: 10, color: C.muted }}>$</span>
                            <span style={{ fontSize: 26, fontWeight: 400, color: isActive ? accent : C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em" }}>{t.price}</span>
                            <span style={{ fontSize: 10, color: C.muted, marginLeft: 2 }}>/mo</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 18, color: isActive ? accent : C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.01em" }}>Custom</span>
                        )}
                      </div>
                      <div style={{ height: 1, background: C.border, margin: "0 0 12px" }} />
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 11, color: C.muted, display: "flex", flexDirection: "column", gap: 6 }}>
                        {t.feats.map(f => <li key={f} style={{ lineHeight: 1.5 }}>✓ {f}</li>)}
                      </ul>
                      <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 16, color: isActive ? accent : C.muted, fontWeight: 600 }}>
                        {isActive ? "Selected ✓" : "Select"}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 16, letterSpacing: "0.02em" }}>
                Enterprise requires a quick chat — pick it here and we'll reach out, or{" "}
                <a href="mailto:sales@azqueue.io?subject=AzQueue%20Enterprise%20inquiry" style={{ color: C.goldLit, textDecoration: "none" }}>email sales directly</a>.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ModeButton({ label, caption, active, onClick, variant = "gold" }) {
  const accent = variant === "sage" ? C.sage : C.gold;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? C.panel : C.card, padding: "26px 28px",
        border: "none", cursor: "pointer", textAlign: "left", color: "inherit",
        transition: "all 0.2s",
        boxShadow: active ? `inset 0 0 0 1px ${accent}55` : "none",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#0f0f0e"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = C.card; }}>
      <div style={{ fontSize: 9, color: active ? accent : C.muted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
        {active ? "Selected ✓" : "Choose"}
      </div>
      <div style={{ fontSize: 18, color: C.ink, fontFamily: "Georgia, serif", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{caption}</div>
    </button>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, required, autoFocus }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", boxSizing: "border-box",
          background: C.card,
          border: `1px solid ${focused ? C.gold : C.border}`,
          borderRadius: 7, outline: "none",
          fontSize: 14, color: C.ink,
          padding: "12px 16px",
          transition: "border-color 0.2s",
          fontFamily: "'Inter', system-ui, sans-serif",
          letterSpacing: "-0.005em",
        }}
      />
    </div>
  );
}

/* ── Email confirmation pending screen ─────────────────────────────── */
function PendingConfirm({ email, mode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "20px 48px", borderBottom: `1px solid ${C.border}` }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", width: "fit-content" }}>
          <div style={{ width: 24, height: 24, background: C.gold, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.void }}>A</div>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
        </Link>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ maxWidth: 460, width: "100%", textAlign: "center", padding: "48px 40px", border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, boxShadow: "0 40px 80px -40px rgba(0,0,0,0.7)" }}>
          <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500, marginBottom: 18 }}>Almost there</div>
          <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15, fontFamily: "Georgia, 'Times New Roman', serif", margin: "0 0 18px" }}>
            Confirm your <em style={{ color: C.gold, fontStyle: "italic" }}>email.</em>
          </h1>
          <p style={{ fontSize: 14, color: C.muted, margin: "0 0 8px", lineHeight: 1.65 }}>
            We sent a confirmation link to <span style={{ color: C.ink }}>{email}</span>.
          </p>
          <p style={{ fontSize: 12.5, color: C.muted, margin: 0, lineHeight: 1.65 }}>
            Click the link in your inbox, then sign in. Once confirmed, you'll land in the {mode === "personal" ? "Personal Flow" : "Business"} dashboard.
          </p>

          <div style={{ height: 1, background: C.border, margin: "32px 0" }} />

          <Link to="/login" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: C.gold, color: C.void, padding: "12px 28px", borderRadius: 7,
            fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", textDecoration: "none",
            textTransform: "uppercase", width: "100%",
          }}>
            Go to sign in →
          </Link>

          <p style={{ fontSize: 10.5, color: C.muted, marginTop: 24, lineHeight: 1.6 }}>
            Didn't get the email? Check your spam folder, or contact{" "}
            <a href="mailto:support@azqueue.io" style={{ color: C.goldLit, textDecoration: "none" }}>support@azqueue.io</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
