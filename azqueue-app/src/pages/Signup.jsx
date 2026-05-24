import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import Button from "../components/Button";

const TIERS = [
  { id: "essential",    name: "Essential",    price: 29,  tag: "For getting started",   feats: ["Queue management", "Basic scheduling", "Up to 3 staff", "Email support"] },
  { id: "professional", name: "Professional", price: 59,  tag: "Most chosen",            feats: ["Everything in Essential", "Advanced analytics", "Islamic Mode", "Autopilot", "Priority support"], gold: true },
  { id: "executive",    name: "Executive",    price: 99,  tag: "For growing businesses", feats: ["Everything in Pro", "AI insights", "Dedicated concierge", "SSO & security", "White-glove setup"] },
  { id: "manager",      name: "Manager",      price: 149, tag: "People intelligence",    feats: ["Everything in Executive", "Manager dashboard", "Break-pattern insights", "Anomaly & wellness alerts", "Performance reviews"], sage: true },
];

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Inline mode toggle — defaults to whatever's in ?mode= or ?tier=, else business
  const initialMode = useMemo(() => {
    const m = params.get("mode");
    if (m === "personal" || m === "business") return m;
    if (params.get("tier")) return "business";
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

    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "business" && !businessName.trim()) return setError("Please enter your business name.");
    if (mode === "personal" && !displayName.trim()) return setError("Please enter your name.");

    setBusy(true);
    const payload = mode === "business"
      ? { mode: "business", email, password, businessName, tier }
      : { mode: "personal", email, password, displayName };

    const { data, error } = await signUp(payload);
    setBusy(false);

    if (error) return setError(error.message);

    // If Supabase has email-confirmation enabled, no session yet → show pending screen
    if (!data?.session) {
      setPendingConfirm(true);
      return;
    }

    navigate(mode === "personal" ? "/personal" : "/business", { replace: true });
  }

  if (pendingConfirm) return <PendingConfirm email={email} mode={mode} />;

  const selected = TIERS.find((t) => t.id === tier) ?? TIERS[1];

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="px-6 py-4 border-b border-line">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs">A</div>
          <span className="font-display text-base">AzQueue</span>
        </Link>
      </header>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Heading */}
          <div className="text-center mb-10">
            <div className="ovline mb-3 text-gold-soft">Create account</div>
            <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tightest">
              Start your <em className="not-italic gold-text-soft">free trial.</em>
            </h1>
            <p className="text-ink-soft text-xs mt-3">14 days · no card required.</p>
          </div>

          {/* Mode toggle — the inline switch the user asked for */}
          <div className="grid grid-cols-2 gap-px bg-line border border-line mb-8 max-w-md mx-auto">
            <ModeButton
              label="Business"
              caption="Queue + bookings for your shop"
              active={mode === "business"}
              onClick={() => setMode("business")}
            />
            <ModeButton
              label="Personal"
              caption="Deep work + tasks for you"
              active={mode === "personal"}
              onClick={() => setMode("personal")}
              variant="sage"
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-5">
            {mode === "business" ? (
              <Field label="Business name" value={businessName} onChange={setBusinessName} placeholder="Khalifa Premier Services" required autoFocus />
            ) : (
              <Field label="Your name" value={displayName} onChange={setDisplayName} placeholder="Ahmed" required autoFocus />
            )}

            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" required />

            {error && (
              <div className="text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Creating account…" : `Create ${mode === "business" ? "business" : "personal"} account →`}
            </Button>

            <div className="text-[10px] text-ink-mute text-center">
              By continuing you agree to our terms and privacy policy.
            </div>
          </form>

          {/* Tier picker shows only for business */}
          {mode === "business" && (
            <div className="max-w-3xl mx-auto mt-12">
              <div className="text-center mb-5">
                <div className="ovline text-gold-soft mb-2">Choose your plan</div>
                <p className="text-ink-soft text-xs">Selecting <span className="text-ink">{selected.name}</span> · RM{selected.price}/mo · change anytime.</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
                {TIERS.map((t) => {
                  const isActive = tier === t.id;
                  const ringColor = t.sage ? "ring-[#506b50]" : "ring-gold-deep";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTier(t.id)}
                      className={`relative bg-bg-elev p-5 text-left transition ${
                        isActive ? `ring-1 ${ringColor} ring-inset` : "hover:bg-bg"
                      }`}
                    >
                      {t.gold && (
                        <div className="absolute -top-px left-3 bg-gold text-[#141410] px-2 py-0.5 text-[8px] tracking-[0.18em] uppercase font-bold">
                          Most popular
                        </div>
                      )}
                      {t.sage && (
                        <div className="absolute -top-px left-3 bg-[#506b50] text-[#e4f0e4] px-2 py-0.5 text-[8px] tracking-[0.18em] uppercase font-bold">
                          People intel
                        </div>
                      )}
                      <div className={`ovline text-[9px] mb-2 ${isActive ? (t.sage ? "text-[#9bbd9b]" : "text-gold-soft") : ""}`}>{t.tag}</div>
                      <div className="font-display text-base">{t.name}</div>
                      <div className="flex items-baseline gap-0.5 mt-2 mb-3">
                        <span className="text-ink-mute text-[9px]">RM</span>
                        <span className={`font-display text-2xl font-light ${isActive ? "text-gold" : "text-ink"}`}>{t.price}</span>
                        <span className="text-ink-mute text-[9px]">/mo</span>
                      </div>
                      <div className="h-px bg-line mb-2" />
                      <ul className="text-[10px] text-ink-soft space-y-1">
                        {t.feats.slice(0, 4).map((f) => <li key={f}>✓ {f}</li>)}
                      </ul>
                      <div className={`text-[9px] tracking-[0.2em] uppercase mt-3 ${isActive ? (t.sage ? "text-[#9bbd9b]" : "text-gold-soft") : "text-ink-mute"}`}>
                        {isActive ? "Selected ✓" : "Select"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-center mt-8 text-xs text-ink-mute">
            Already have an account?{" "}
            <Link to="/login" className="text-gold-soft hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ label, caption, active, onClick, variant = "gold" }) {
  const accent = variant === "sage" ? "text-[#9bbd9b]" : "text-gold-soft";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-bg-elev p-5 text-left transition ${
        active ? "ring-1 ring-inset ring-gold-deep" : "hover:bg-bg"
      }`}
    >
      <div className={`ovline text-[9px] mb-1 ${active ? accent : ""}`}>
        {active ? "Selected" : "Choose"}
      </div>
      <div className="font-display text-lg">{label}</div>
      <div className="text-[10px] text-ink-mute mt-1">{caption}</div>
    </button>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, required, autoFocus }) {
  return (
    <div>
      <div className="ovline mb-1.5 text-[9px]">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-4 py-2.5 transition text-ink placeholder:text-ink-mute"
      />
    </div>
  );
}

/* ── Email confirmation pending screen ─────────────────────────────── */
function PendingConfirm({ email, mode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="px-6 py-4 border-b border-line">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs">A</div>
          <span className="font-display text-base">AzQueue</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center luxe-panel border border-line p-10">
          <div className="ovline mb-3 text-gold-soft">Almost there</div>
          <h1 className="font-display text-3xl font-light tracking-tightest mb-4">
            Confirm your <em className="not-italic gold-text-soft">email.</em>
          </h1>
          <p className="text-ink-soft text-sm mb-2">
            We sent a confirmation link to <span className="text-ink">{email}</span>.
          </p>
          <p className="text-ink-mute text-xs leading-relaxed">
            Click the link in your inbox, then come back and sign in. Once confirmed, you'll land in the {mode === "personal" ? "Personal Flow" : "Business"} dashboard.
          </p>

          <div className="rule-ornament my-6 text-[8px]"><span>·</span></div>

          <Link to="/login">
            <Button className="w-full">Go to sign in</Button>
          </Link>

          <div className="text-[10px] text-ink-mute mt-6 leading-relaxed">
            Didn't get it? Check your spam folder. Or{" "}
            <span className="text-gold-soft">turn off email confirmation</span> in Supabase
            Dashboard → Authentication → Providers → Email → "Confirm email" off — for instant sign-up.
          </div>
        </div>
      </div>
    </div>
  );
}
