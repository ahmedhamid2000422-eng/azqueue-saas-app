import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import LuxeFrame from "../components/LuxeFrame";
import Button from "../components/Button";

/**
 * ConfirmAttendance — public "tap to confirm you're coming" page.
 * Route: /confirm/:bookingId
 *
 * Linked from the pre-class SMS reminder (lib/notify.js sendClassReminder).
 * Lets a student confirm a single tap, no login — directly tackles
 * Mohamed's #1 pain point (no-shows) by making confirmation effortless.
 */
export default function ConfirmAttendance() {
  const { bookingId } = useParams();

  const [booking, setBooking] = useState(null);
  const [branch,  setBranch]  = useState(null);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: b, error: bErr } = await supabase
        .from("bookings")
        .select("id, branch_id, service_id, customer_name, scheduled_at, status, confirmed_at")
        .eq("id", bookingId)
        .maybeSingle();

      if (bErr || !b) {
        if (!cancelled) { setError("We couldn't find that booking — please check the link and try again."); setLoading(false); }
        return;
      }

      const [{ data: br }, { data: svc }] = await Promise.all([
        supabase.from("branches").select("id, name, city").eq("id", b.branch_id).maybeSingle(),
        supabase.from("services").select("id, name").eq("id", b.service_id).maybeSingle(),
      ]);

      if (!cancelled) {
        setBooking(b);
        setBranch(br ?? null);
        setService(svc ?? null);
        setDone(!!b.confirmed_at);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  async function confirm() {
    setBusy(true);
    const { error: upErr } = await supabase
      .from("bookings")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", bookingId);
    setBusy(false);
    if (upErr) { setError("Something went wrong — please try again."); return; }
    setDone(true);
  }

  if (loading) {
    return (
      <Shell>
        <div className="text-center py-20 ovline text-ink-mute">Loading…</div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <LuxeFrame className="p-8 mt-8 text-center">
          <div className="font-display text-xl font-light text-ink mb-2">Hmm.</div>
          <p className="text-ink-soft text-sm">{error}</p>
        </LuxeFrame>
      </Shell>
    );
  }

  const when = new Date(booking.scheduled_at);
  const cancelled = booking.status === "cancelled" || booking.status === "no_show";

  return (
    <Shell>
      <LuxeFrame className="p-8 mt-8 text-center">
        {done ? (
          <>
            <div className="ovline text-[#9bbd9b] mb-3 flex items-center justify-center gap-2">
              <span className="pip breathe" />
              You're confirmed
            </div>
            <h1 className="font-display text-2xl font-light tracking-tightest mb-2">
              See you there, {booking.customer_name?.split(" ")[0] ?? "champ"}
            </h1>
          </>
        ) : (
          <>
            <div className="ovline text-gold-soft mb-3">Confirm your spot</div>
            <h1 className="font-display text-2xl font-light tracking-tightest mb-2">
              {service?.name ?? "Your class"}
            </h1>
          </>
        )}

        <div className="gold-text font-display text-4xl font-light tracking-tightest leading-none my-3">
          {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-ink-soft text-sm">
          {when.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
        </div>
        {branch?.name && <div className="text-[10px] text-ink-mute mt-1 tracking-wide">{branch.name}{branch.city ? ` · ${branch.city}` : ""}</div>}

        <div className="rule-ornament my-6 text-[8px]"><span>✦</span></div>

        {cancelled ? (
          <p className="text-[12px] text-ink-mute leading-relaxed">
            This booking is marked as {booking.status === "cancelled" ? "cancelled" : "missed"}. If that's not right,
            reach out to the gym directly.
          </p>
        ) : done ? (
          <p className="text-[12px] text-ink-soft leading-relaxed">
            Thanks for confirming — your spot is locked in. If your plans change, let the gym know so someone
            on the waitlist can take your place.
          </p>
        ) : (
          <>
            <p className="text-[12px] text-ink-soft leading-relaxed mb-5">
              Tap below to let us know you're coming. Takes two seconds, and helps us plan class size and
              keep the schedule running smoothly for everyone.
            </p>
            <Button onClick={confirm} disabled={busy} className="w-full">
              {busy ? "Confirming…" : "Yes, I'll be there →"}
            </Button>
          </>
        )}
      </LuxeFrame>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(184,149,90,0.07), transparent 70%)" }}
      />
      <header className="relative px-6 py-4 border-b border-line/70 flex items-center gap-2.5 backdrop-blur-sm bg-bg/60">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition">
          <div className="w-7 h-7 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-[10px] shadow-[0_0_24px_rgba(201,168,106,0.3)]">A</div>
          <span className="font-display text-base">AzQueue</span>
        </Link>
      </header>
      <main className="relative flex-1 max-w-md w-full mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
