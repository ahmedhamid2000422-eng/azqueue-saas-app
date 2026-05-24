import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth, userMode } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import Button from "../components/Button";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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

    // Business path — owners go to /business, staff-only users go to /staff.
    // Owner takes priority if the user is both.
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
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="px-6 py-4 border-b border-line">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs">A</div>
          <span className="font-display text-base">AzQueue</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="ovline mb-3 text-gold-soft">Sign in</div>
            <h1 className="font-display text-4xl font-light tracking-tightest">
              Welcome <em className="not-italic gold-text-soft">back.</em>
            </h1>
            <p className="text-ink-soft text-xs mt-3">We'll route you to the right dashboard automatically.</p>
          </div>

          <div className="luxe-panel border border-line p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required autoFocus />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

              {error && (
                <div className="text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Signing in…" : "Sign in →"}
              </Button>
            </form>

            <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>

            <div className="text-center text-xs text-ink-mute">
              New to AzQueue?{" "}
              <Link to="/signup" className="text-gold-soft hover:underline">Create an account</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-line border border-line mt-3">
            <Link to="/signup?mode=business" className="bg-bg-elev p-4 text-center hover:bg-[rgba(201,168,106,0.04)] transition">
              <div className="ovline text-[8px] text-gold-soft mb-1">For businesses</div>
              <div className="text-xs text-ink">Business signup →</div>
            </Link>
            <Link to="/signup?mode=personal" className="bg-bg-elev p-4 text-center hover:bg-[rgba(201,168,106,0.04)] transition">
              <div className="ovline text-[8px] text-gold-soft mb-1">For individuals</div>
              <div className="text-xs text-ink">Personal signup →</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, required, autoFocus }) {
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
        className="w-full bg-bg border border-line focus:border-gold-deep outline-none text-sm px-4 py-2.5 transition text-ink placeholder:text-ink-mute"
      />
    </div>
  );
}

// Friendlier error copy for the most common Supabase auth errors
function prettifyAuthError(msg = "") {
  if (/invalid login/i.test(msg))           return "That email and password don't match. Try again or reset your password.";
  if (/email not confirmed/i.test(msg))     return "Please click the confirmation link in your email first.";
  if (/email rate limit/i.test(msg))        return "Too many attempts. Wait a minute and try again.";
  return msg;
}
