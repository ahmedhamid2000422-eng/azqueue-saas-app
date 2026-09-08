import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getEffectiveChecklist, primeChecklists } from "../lib/checklists";
import { sendChecklistEmail } from "../lib/notifyEmail";
import Button from "../components/Button";

/**
 * WhatToBring — "what do I need for my case?", answered without coming in.
 * Route: /q/:slug/what-to-bring   (public, no auth)
 *
 * WHY THIS IS A PAGE AND NOT A BOT FLOW
 * The same checklist already existed in two places: inside the kiosk once a
 * service is chosen, and behind a staff menu on the Queue page. Both require
 * being at the office. The case this is for is the opposite one — somebody who
 * has not come in yet, or who was turned away without their paperwork and is
 * standing on the pavement with a phone.
 *
 * A page works from any channel. Staff can paste the link into WhatsApp, a
 * text or an email; it can be printed as a QR code by the door; search engines
 * can index it. A bot flow would work in exactly one channel, and which
 * channel that is depends on an unresolved question about whether the
 * WhatsApp sender sits with Meta or with Twilio.
 *
 * THE ENDING MATTERS AS MUCH AS THE LIST
 * Every path finishes by offering the queue or a booking. Someone reading a
 * document checklist is a customer deciding whether to come in, and leaving
 * them at the bottom of a list with no next step wastes the moment they were
 * most likely to act.
 *
 * CUSTOM LISTS COME FROM THE DATABASE
 * Branch overrides live in `service_checklists` (migration 0062), primed into
 * a cache before first paint. They were in localStorage until this page
 * needed them: a customer's phone has no localStorage from the office, so
 * every edit Mohamed made would have been invisible here. That was the
 * limitation that forced the table.
 */
export default function WhatToBring() {
  const { slug } = useParams();

  const [branch, setBranch]     = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [picked, setPicked] = useState(null);   // service row
  const [email, setEmail]   = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: branchRow, error: bErr } = await supabase
        .from("branches")
        .select("id, slug, name, city")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;
      if (bErr || !branchRow) { setNotFound(true); setLoading(false); return; }
      setBranch(branchRow);
      /* Branch overrides before the list renders — otherwise the first
         paint shows a built-in list that a later paint replaces. */
      await primeChecklists(branchRow.id);

      const { data: svc } = await supabase
        .from("services")
        .select("id, name")
        .eq("branch_id", branchRow.id)
        .eq("active", true)
        .order("name");

      if (cancelled) return;
      /* Only this branch's own services, never the full built-in catalogue.
         A tax office should not offer "Oil Change" as a case type just
         because a checklist for one exists in the library. */
      setServices(svc ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const checklist = picked ? getEffectiveChecklist(branch?.id, picked.name) : null;
  const hasList   = !!checklist?.items?.length;

  async function emailList(e) {
    e.preventDefault();
    if (!email.trim() || !hasList) return;
    setSending(true);
    setError(null);
    try {
      await sendChecklistEmail({
        email:       email.trim(),
        serviceName: picked.name,
        items:       checklist.items,
        reminder:    checklist.reminder ?? null,
        branchName:  branch?.name ?? "AzQueue",
        quietPhrase: null,
      });
      setSent(true);
    } catch (err) {
      console.error("[WhatToBring] email failed", err);
      setError("We couldn't send that. Check the address and try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <Shell><p className="text-ink-mute text-sm">Loading…</p></Shell>;
  }

  if (notFound) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">
          Page not found
        </h1>
        <p className="text-ink-soft text-sm">
          That link doesn't match a business. Check it and try again.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="ovline text-[9px] text-gold-soft mb-2">{branch.name}</div>
      <h1 className="font-display text-4xl font-light tracking-tightest leading-tight mb-2">
        What to bring
      </h1>
      <p className="text-ink-soft text-[13.5px] leading-relaxed mb-7">
        Pick what you're coming in for and we'll show you exactly what to have
        with you. Bringing the right documents the first time is the difference
        between one visit and three.
      </p>

      {/* ── Step 1: pick the case ─────────────────────────────────── */}
      {!picked && (
        services.length === 0 ? (
          <p className="text-ink-mute text-sm">
            No services are listed for this branch yet. Please call the office.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => { setPicked(s); setSent(false); setError(null); }}
                className="text-left border border-line hover:border-gold-deep hover:bg-[rgba(201,168,106,0.05)] transition px-5 py-4"
              >
                <div className="font-display text-[19px] font-light tracking-tight text-ink">
                  {s.name}
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── Step 2: the list ──────────────────────────────────────── */}
      {picked && (
        <div>
          <button
            onClick={() => { setPicked(null); setSent(false); setError(null); }}
            className="text-[11px] tracking-[0.1em] uppercase text-ink-mute hover:text-ink mb-4"
          >
            ← Choose something else
          </button>

          <div className="border border-gold-deep/50 bg-[rgba(201,168,106,0.04)] p-5 mb-6">
            <div className="ovline text-[9px] text-gold-soft mb-2">
              {picked.name}
            </div>

            {hasList ? (
              <>
                <ul className="mb-1">
                  {checklist.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[13.5px] text-ink-soft leading-relaxed mb-2">
                      <span className="text-gold-soft shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {checklist.reminder && (
                  <p className="text-[12px] text-ink-mute leading-relaxed mt-3 border-l border-gold-deep/50 pl-3">
                    {checklist.reminder}
                  </p>
                )}
              </>
            ) : (
              /* No list for this service. Say so plainly rather than showing
                 an empty box — and give the answer that is always true, which
                 is that staff can tell them in thirty seconds. */
              <div className="text-[13.5px] text-ink leading-relaxed">
                We don't have a document list for this one.
                <div className="text-[12px] text-ink-mute mt-2 leading-relaxed">
                  Most visits need photo ID and any paperwork about your case.
                  If you're not sure, ask at the desk before you join the line —
                  it takes a moment and saves a wasted wait.
                </div>
              </div>
            )}
          </div>

          {/* ── Email it to me ─────────────────────────────────────── */}
          {hasList && (
            sent ? (
              <div className="border border-[#506b50] bg-[#2f4a2f]/10 px-4 py-3 text-[13px] text-[#a8c9a8] mb-6">
                Sent — the list is in your inbox.
              </div>
            ) : (
              <form onSubmit={emailList} className="mb-6">
                <label className="block text-[11px] tracking-[0.1em] uppercase text-ink-mute mb-2">
                  Email it to me
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 min-w-[200px] bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2.5 text-[13px] text-ink"
                  />
                  <Button type="submit" disabled={sending}>
                    {sending ? "Sending…" : "Send the list"}
                  </Button>
                </div>
                {error && (
                  <p className="text-[12px] text-[#d49185] mt-2">{error}</p>
                )}
                <p className="text-[11px] text-ink-mute mt-2 leading-relaxed">
                  We'll only use this to send you the list.
                </p>
              </form>
            )
          )}

          {/* ── Still need help ────────────────────────────────────── */}
          {/* The point of the page. Somebody who has just read what to bring
              is deciding whether to come in — this is the moment to make that
              easy, not the bottom of a list with nowhere to go. */}
          <div className="border-t border-line pt-6">
            <div className="font-display text-[21px] font-light tracking-tight text-ink mb-1">
              Still need help?
            </div>
            <p className="text-[12.5px] text-ink-soft leading-relaxed mb-4">
              Join the line and someone will see you, or book a time that suits you.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/q/${branch.slug}`}
                className="bg-gold-deep text-[#141410] px-6 py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase"
              >
                Join the line
              </Link>
              <Link
                to={`/b/${branch.slug}`}
                className="border border-line hover:border-gold-deep text-ink px-6 py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition"
              >
                Book a time
              </Link>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-ink antialiased">
      <div className="max-w-xl mx-auto px-5 py-12">{children}</div>
    </div>
  );
}
