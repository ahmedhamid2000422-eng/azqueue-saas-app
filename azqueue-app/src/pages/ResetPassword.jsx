import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  muted:  "#60605a",
  border: "rgba(255,255,255,0.07)",
  card:   "#0c0c0b",
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [done,      setDone]      = useState(false);
  const [ready,     setReady]     = useState(false); // true once Supabase parses the token

  // Supabase fires PASSWORD_RECOVERY once the token in the URL hash is parsed
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match.");
    if (password.length < 8)  return setError("Password must be at least 8 characters.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    setDone(true);
    setTimeout(() => navigate("/login", { replace: true }), 2500);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: C.void, fontFamily: "'Inter', system-ui, sans-serif", padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 48 }}>
          <div style={{ width: 26, height: 26, background: C.gold, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.void }}>A</div>
          <span style={{ fontSize: 15, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
        </div>

        <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
          Password reset
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 500, fontFamily: "Georgia, serif", color: C.ink, margin: "0 0 10px" }}>
          Set a new password.
        </h1>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 36 }}>
          Choose something secure — at least 8 characters.
        </p>

        {done ? (
          <div style={{ fontSize: 13, color: "#9bbd9b", background: "rgba(127,163,127,0.08)", border: "1px solid rgba(127,163,127,0.25)", borderRadius: 6, padding: "14px 16px" }}>
            Password updated! Redirecting you to sign in…
          </div>
        ) : !ready ? (
          <div style={{ fontSize: 13, color: C.muted }}>Verifying reset link…</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoFocus />
            <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Same password again" />

            {error && (
              <div style={{ fontSize: 12, color: "#d49185", background: "rgba(181,107,95,0.08)", border: "1px solid rgba(181,107,95,0.25)", borderRadius: 6, padding: "10px 14px" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !password || !confirm}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 7, border: "none",
                cursor: busy ? "not-allowed" : "pointer",
                background: C.gold, color: C.void,
                fontSize: 13, fontWeight: 600, letterSpacing: "0.01em",
                opacity: (busy || !password || !confirm) ? 0.6 : 1,
              }}>
              {busy ? "Saving…" : "Set new password →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, autoFocus }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9, fontWeight: 500 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", boxSizing: "border-box",
          background: C.card, border: `1px solid ${focused ? C.gold : C.border}`,
          borderRadius: 7, outline: "none",
          fontSize: 14, color: C.ink, padding: "12px 16px",
          transition: "border-color 0.2s",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      />
    </div>
  );
}
