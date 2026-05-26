import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth, userMode } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";

const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  muted:  "#60605a",
  faint:  "#2a2926",
  border: "rgba(255,255,255,0.07)",
  card:   "#0c0c0b",
  panel:  "#111110",
};

export default function Login() {
  const { signIn, sendPasswordReset } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleForgot(e) {
    e.preventDefault();
    if (!email) return setError("Enter your email above first, then click 'Forgot password?'");
    setError(null);
    const { error } = await sendPasswordReset(email);
    if (error) return setError(prettifyAuthError(error.message));
    setResetSent(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await signIn({ email, password });
    setBusy(false);
    if (error) return setError(prettifyAuthError(error.message));

    const redirectTo = location.state?.from?.pathname;
    if (redirectTo) return navigate(redirectTo, { replace: true });

    const mode = userMode(data?.user);
    if (mode === "personal") return navigate("/personal", { replace: true });

    const userId = data?.user?.id;
    if (userId) {
      const [{ count: ownsCount }, { count: staffCount }] = await Promise.all([
        supabase.from("branches").select("id", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("staff")   .select("id", { count: "exact", head: true }).eq("user_id",  userId),
      ]);
      if ((ownsCount ?? 0) === 0 && (staffCount ?? 0) > 0) {
        return navigate("/staff", { replace: true });
      }
    }
    navigate("/business", { replace: true });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: C.void, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Left panel */}
      <div style={{
        flex: "0 0 460px", background: C.card,
        borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        padding: "48px 56px",
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, background: C.gold, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.void }}>A</div>
          <span style={{ fontSize: 15, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
        </Link>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 60 }}>
          <div style={{ width: 28, height: 1, background: C.gold, marginBottom: 40, opacity: 0.4 }} />

          <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500, marginBottom: 24 }}>
            Welcome back
          </div>

          <h1 style={{
            fontSize: 36, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15,
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: C.ink, margin: "0 0 18px",
          }}>
            The smarter way<br />to manage your queue.
          </h1>

          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: "0 0 52px", maxWidth: 300 }}>
            Sign in to access your dashboard, live queue, and customer notifications.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              "Real-time queue management",
              "WhatsApp & SMS notifications",
              "Prayer pause scheduling",
              "Loyalty punch cards",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.gold, flexShrink: 0, opacity: 0.5 }} />
                <span style={{ fontSize: 13, color: C.muted, letterSpacing: "-0.005em" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.muted }}>
          New to AzQueue?{" "}
          <Link to="/signup" style={{ color: C.gold, textDecoration: "none" }}>Create an account</Link>
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 40px",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          <div style={{ marginBottom: 52 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>Sign in</div>
            <h2 style={{
              fontSize: 30, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.2,
              fontFamily: "Georgia, 'Times New Roman', serif", color: C.ink, margin: "0 0 10px",
            }}>
              Welcome{" "}
              <em style={{ fontStyle: "italic", color: C.gold }}>back.</em>
            </h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              We'll route you to the right dashboard automatically.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required autoFocus />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" required />

            {error && (
              <div style={{
                fontSize: 12, color: "#d49185",
                background: "rgba(181,107,95,0.08)",
                border: "1px solid rgba(181,107,95,0.25)",
                borderRadius: 6, padding: "10px 14px", lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            {resetSent && (
              <div style={{
                fontSize: 12, color: "#9bbd9b",
                background: "rgba(127,163,127,0.08)",
                border: "1px solid rgba(127,163,127,0.25)",
                borderRadius: 6, padding: "10px 14px", lineHeight: 1.5,
              }}>
                Check your inbox — we've sent a password reset link to <strong>{email}</strong>.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -8 }}>
              <button
                type="button"
                onClick={handleForgot}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  fontSize: 11.5, color: C.muted, letterSpacing: "0.01em",
                  textDecoration: "none", transition: "color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = C.gold}
                onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 7, border: "none",
                cursor: busy ? "not-allowed" : "pointer",
                background: C.gold, color: C.void,
                fontSize: 13, fontWeight: 600, letterSpacing: "0.01em",
                opacity: busy ? 0.7 : 1, transition: "all 0.2s ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {busy ? "Signing in..." : "Sign in"}
              {!busy && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              )}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "36px 0" }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 10, color: C.faint, letterSpacing: "0.1em" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { to: "/signup?mode=business", label: "Business signup", sub: "Clinics, offices, centers" },
              { to: "/signup?mode=personal", label: "Personal signup", sub: "For individuals" },
            ].map(({ to, label, sub }) => (
              <Link key={to} to={to} style={{
                textDecoration: "none",
                background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "14px 16px", display: "block", transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 10.5, color: C.muted }}>{sub}</div>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 32, textAlign: "center" }}>
            <Link to="/" style={{ fontSize: 11, color: C.muted, textDecoration: "none", letterSpacing: "-0.005em" }}>
              Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, required, autoFocus }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9, fontWeight: 500 }}>{label}</div>
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

function prettifyAuthError(msg = "") {
  if (/invalid login/i.test(msg))       return "That email and password don't match. Try again.";
  if (/email not confirmed/i.test(msg)) return "Please click the confirmation link in your email first.";
  if (/email rate limit/i.test(msg))    return "Too many attempts. Please wait a moment and try again.";
  return msg;
}
