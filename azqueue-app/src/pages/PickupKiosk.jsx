import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { findPickup, announcePickup } from "../lib/backQueue";

/**
 * PickupKiosk — "I'm here to collect my paperwork."
 *
 * Route: /q/:slug/pickup   (public, no auth — it's a kiosk)
 *
 * The customer identifies themselves with the email they gave when they
 * dropped off. Not a code: people lose codes, and we already have the email
 * on their record from that visit.
 *
 * PRIVACY
 * This screen is visible to whoever is standing behind them. It confirms a
 * first name and nothing else — never what someone is collecting. Immigration
 * and tax work is not something to display in a waiting room. The lookup
 * function enforces this too, so it isn't only a UI decision.
 */

const CONTACT_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$|^[\d\s()+-]{7,}$/;

export default function PickupKiosk() {
  const { slug } = useParams();
  const [contact, setContact] = useState("");
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(null);   // 'ready' | 'in_progress' | 'none'
  const [name, setName]       = useState(null);
  const [error, setError]     = useState(null);

  async function submit(e) {
    e.preventDefault();
    const value = contact.trim();
    if (!value) return setError("Please enter the email you gave us.");
    if (!CONTACT_RE.test(value)) return setError("That doesn't look like an email address or phone number.");

    setError(null);
    setBusy(true);

    try {
      const found = await findPickup({ branchSlug: slug, contact: value });

      if (found.status === "ready" && found.ticket_id) {
        await announcePickup({
          branchId: found.branch_id,
          ticketId: found.ticket_id,
          displayName: found.first_name ?? null,
        });
        setName(found.first_name ?? null);
        setResult("ready");
      } else {
        setResult(found.status ?? "none");
      }
    } catch (err) {
      console.error("[PickupKiosk]", err);
      setError("Something went wrong. Please see the main desk.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Announced ──────────────────────────────────────────────────── */
  if (result === "ready") {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-[64px] leading-none mb-6 text-gold-soft">✓</div>
          <h1 className="font-display text-4xl font-light tracking-tightest mb-4">
            {name ? `Welcome back, ${name}` : "Thank you"}
          </h1>
          <p className="text-xl text-ink-soft leading-relaxed">
            Someone will be with you shortly.
          </p>
          <p className="text-base text-ink-mute leading-relaxed mt-6">
            Please wait here at the pickup desk.
          </p>
        </div>
      </Shell>
    );
  }

  /* ── Not finished yet ───────────────────────────────────────────── */
  if (result === "in_progress") {
    return (
      <Shell>
        <div className="text-center max-w-lg">
          <h1 className="font-display text-3xl font-light tracking-tightest mb-4">
            Still being worked on
          </h1>
          <p className="text-lg text-ink-soft leading-relaxed">
            Your paperwork isn't quite ready yet. We'll email you as soon as it
            is — you don't need to wait.
          </p>
          <p className="text-base text-ink-mute leading-relaxed mt-6">
            If you'd like to check on it, please see the main desk.
          </p>
          <Retry onClick={() => { setResult(null); setContact(""); }} />
        </div>
      </Shell>
    );
  }

  /* ── Nothing found ──────────────────────────────────────────────── */
  if (result === "none") {
    return (
      <Shell>
        <div className="text-center max-w-lg">
          <h1 className="font-display text-3xl font-light tracking-tightest mb-4">
            We couldn't find that
          </h1>
          <p className="text-lg text-ink-soft leading-relaxed">
            Please see the main desk and someone will help you.
          </p>
          <Retry onClick={() => { setResult(null); setContact(""); }} />
        </div>
      </Shell>
    );
  }

  /* ── Ask ────────────────────────────────────────────────────────── */
  return (
    <Shell>
      <div className="w-full max-w-lg">
        <div className="ovline text-[11px] text-gold-soft mb-3">Collecting paperwork</div>
        <h1 className="font-display text-4xl font-light tracking-tightest mb-3">
          Let us know you're here
        </h1>
        <p className="text-lg text-ink-soft leading-relaxed mb-8">
          Enter the email address you gave us when you dropped your documents off.
        </p>

        <form onSubmit={submit}>
          <input
            value={contact}
            onChange={(e) => { setContact(e.target.value); setError(null); }}
            placeholder="you@example.com"
            inputMode="email"
            autoFocus
            autoComplete="off"
            className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none px-5 py-5 text-2xl text-ink placeholder:text-ink-mute mb-3"
          />

          {error && (
            <p className="text-[15px] text-[#d49185] mb-3 leading-relaxed">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full ovline text-[13px] border border-gold-deep px-6 py-5 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-40"
          >
            {busy ? "Checking…" : "I'm here"}
          </button>
        </form>

        <p className="text-[13px] text-ink-mute leading-relaxed mt-8">
          No email? Enter the phone number you gave us instead, or see the main
          desk.
        </p>

        <Link
          to={`/q/${slug}`}
          className="inline-block ovline text-[11px] text-ink-mute hover:text-ink transition mt-8"
        >
          ← I'm here for something else
        </Link>
      </div>
    </Shell>
  );
}

function Retry({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="ovline text-[11px] border border-line px-4 py-3 text-ink-mute hover:text-ink transition mt-8"
    >
      Try a different address
    </button>
  );
}

/* Kiosk type sizes throughout: this is read standing up, often by someone
   older, on a screen at arm's length. */
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-8">
      {children}
    </div>
  );
}
