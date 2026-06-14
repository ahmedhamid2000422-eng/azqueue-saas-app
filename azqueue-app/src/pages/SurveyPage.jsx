import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import Button from "../components/Button";
import LuxeFrame from "../components/LuxeFrame";
import LanguagePicker from "../components/LanguagePicker";

/**
 * Public survey page — customers leave a rating + optional feedback.
 *
 * Route:
 *   /survey/:slug              — generic branch survey (walk-ins, social link)
 *   /survey/:slug?ticket=ID    — post-service survey for a specific ticket
 *
 * Server-side guards (migration 0009):
 *   · one survey per ticket
 *   · max 5 per phone per branch per hour
 *   · 1..5 rating only
 *   · feedback capped at 1000 chars
 *
 * No auth. The branch is read by slug, the rating is written by anon.
 */
export default function SurveyPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const ticketId = params.get("ticket");
  const { t } = useTranslation();

  const [branch, setBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // No slug → friendly "ask the business for the link" landing
  if (!slug) return <NoSlugLanding />;

  const [rating, setRating] = useState(0);
  const [hover, setHover]   = useState(0);
  const [feedback, setFeedback] = useState("");
  const [phone, setPhone] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState(null);

  // Load branch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("branches").select("id, name, city, slug").eq("slug", slug).single();
      if (cancelled) return;
      if (error || !data) {
        setLoadError("This survey link isn't valid.");
        setLoading(false);
        return;
      }
      setBranch(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  async function submit(e) {
    e.preventDefault();
    setFormError(null);
    if (rating < 1) return setFormError("Please pick a rating.");
    if (feedback.length > 1000) return setFormError("Feedback too long.");

    setSubmitting(true);
    const payload = {
      branch_id:    branch.id,
      ticket_id:    ticketId || null,
      customer_phone: anonymous ? null : (phone.trim() || null),
      rating,
      feedback:     feedback.trim() || null,
      is_anonymous: anonymous,
    };
    const { error } = await supabase.from("surveys").insert(payload);
    setSubmitting(false);
    if (error) return setFormError(prettifyError(error.message));
    setSubmitted(true);
  }

  if (loading)   return <Shell><div className="text-center py-20 ovline text-ink-mute">Loading…</div></Shell>;
  if (loadError) return <Shell><div className="text-center py-12 text-ink-soft text-sm">{loadError}</div></Shell>;

  if (submitted) {
    return (
      <Shell>
        <LuxeFrame className="p-9 mt-8 text-center">
          <div className="ovline mb-3 text-[#9bbd9b] flex items-center justify-center gap-2">
            <span className="pip breathe" />
            Thank you
          </div>
          <h1 className="font-display text-3xl font-light tracking-tightest mb-3">
            Your feedback <em className="not-italic gold-text-soft">matters.</em>
          </h1>
          <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
          <p className="text-ink-soft text-sm leading-relaxed max-w-xs mx-auto">
            We've passed your rating to the team at <span className="text-ink">{branch.name}</span>. You can close this page.
          </p>
        </LuxeFrame>
      </Shell>
    );
  }

  const shown = hover || rating;

  return (
    <Shell>
      <div className="atmosphere-hero -mx-6 px-6 -mt-8 pt-8 pb-2 text-center">
        <div className="ovline text-gold-soft mb-2">Rate your visit</div>
        <h1 className="font-display text-3xl font-light tracking-tightest leading-tight">{branch.name}</h1>
        {branch.city && <div className="text-[10px] text-ink-mute mt-2 tracking-wide">{branch.city}</div>}
      </div>

      <form onSubmit={submit} className="mt-10 space-y-7">
        {/* Star picker — huge tap targets on phones */}
        <div>
          <div className="ovline mb-3 text-center">How was it?</div>
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= shown;
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                  className="text-5xl transition-transform hover:scale-110 active:scale-95 leading-none"
                  style={{
                    color: filled ? "#e4cb95" : "#3a3a3a",
                    textShadow: filled ? "0 0 14px rgba(228, 203, 149, 0.3)" : "none",
                  }}
                >
                  ★
                </button>
              );
            })}
          </div>
          <div className="text-center text-[11px] text-ink-mute mt-3 tracking-wide min-h-[16px]">
            {shown === 0 ? "Tap a star" : RATING_LABELS[shown - 1]}
          </div>
        </div>

        {/* Optional feedback */}
        <div>
          <div className="ovline mb-2 text-[9px]">Anything to share? (optional)</div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value.slice(0, 1000))}
            placeholder="What stood out, good or bad."
            className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-4 py-3 transition text-ink placeholder:text-ink-mute min-h-[120px] resize-y"
          />
          <div className="text-[9px] text-ink-mute text-right mt-1 font-mono">
            {feedback.length} / 1000
          </div>
        </div>

        {/* Anonymity toggle */}
        <div className="border border-line p-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="accent-gold-deep"
            />
            <div>
              <div className="text-xs text-ink">Submit anonymously</div>
              <div className="text-[10px] text-ink-mute mt-0.5">
                The team won't see your number. They'll just see the rating and what you wrote.
              </div>
            </div>
          </label>

          {!anonymous && (
            <div>
              <div className="ovline mb-1.5 text-[9px]">Your phone (optional)</div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+60 12 345 6789"
                className="w-full bg-bg border border-line focus:border-gold-deep outline-none text-sm px-3 py-2 text-ink placeholder:text-ink-mute"
              />
              <div className="text-[10px] text-ink-mute mt-1">
                Lets the team thank you personally or follow up if needed.
              </div>
            </div>
          )}
        </div>

        {formError && (
          <div className="text-[12px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
            {formError}
          </div>
        )}

        <Button type="submit" disabled={submitting || rating < 1} className="w-full">
          {submitting ? "Sending…" : "Submit feedback →"}
        </Button>

        <div className="text-[10px] text-ink-mute text-center tracking-wide pt-2">
          Anonymous by default. Your feedback goes straight to {branch.name}'s manager.
        </div>
      </form>
    </Shell>
  );
}

const RATING_LABELS = [
  "Disappointing",
  "Below expectations",
  "Good",
  "Great",
  "Exceptional",
];

function prettifyError(msg = "") {
  if (/duplicate.*ticket/i.test(msg)) return "You've already rated this visit.";
  if (/too many surveys/i.test(msg))   return "Too many submissions. Try again later.";
  if (/check constraint/i.test(msg))   return "Some fields are out of range.";
  return msg;
}

/* ── /survey (no slug) — friendly fallback ─────────────────────── */
function NoSlugLanding() {
  const [slug, setSlug] = useState("");
  return (
    <Shell>
      <div className="atmosphere-hero -mx-6 px-6 -mt-8 pt-10 pb-2 text-center">
        <div className="ovline text-gold-soft mb-2">Customer feedback</div>
        <h1 className="font-display text-3xl font-light tracking-tightest leading-tight">
          Rate <em className="not-italic gold-text-soft">your visit.</em>
        </h1>
        <p className="text-ink-soft text-xs mt-3 max-w-xs mx-auto leading-relaxed">
          Scan the QR poster at the business you visited, or enter their code below.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (slug.trim()) window.location.href = `/survey/${slug.trim()}`; }}
        className="mt-8 space-y-4"
      >
        <div>
          <div className="ovline mb-1.5 text-[9px]">Branch code</div>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder="e.g. kl-downtown"
            autoFocus
            className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-4 py-3 transition text-ink placeholder:text-ink-mute"
          />
          <div className="text-[10px] text-ink-mute mt-2">
            The code is the last part of the URL on the printed poster — usually a short, lowercase name.
          </div>
        </div>
        <Button type="submit" disabled={!slug.trim()} className="w-full">
          Continue →
        </Button>
      </form>

      <div className="rule-ornament my-8 text-[8px]"><span>·</span></div>

      <div className="text-[11px] text-ink-mute text-center leading-relaxed">
        Surveys are anonymous by default. Your rating goes straight to the manager — never shared, never sold.
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs shadow-[0_0_18px_rgba(201,168,106,0.25)]">A</div>
          <span className="font-display text-base">AzQueue</span>
        </div>
        <LanguagePicker />
      </header>
      <main className="flex-1 max-w-md w-full mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="px-6 py-5 border-t border-line text-[9px] text-ink-mute tracking-[0.2em] uppercase text-center">
        {t("common.powered_by")} · azqueue.app
      </footer>
    </div>
  );
}
