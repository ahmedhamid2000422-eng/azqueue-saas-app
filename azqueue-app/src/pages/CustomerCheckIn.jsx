import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { sendConfirmationSms } from "../lib/notifications";
import { sendCheckinEmail } from "../lib/notifyEmail";
import { SMS_ENABLED, SMS_PENDING } from "../lib/features";
import { estimateWaitFor, formatWait } from "../lib/waitEstimator";
import QuietSlotNudge from "../components/QuietSlotNudge";
import ServiceChecklist from "../components/ServiceChecklist";
import { loadHourShape, findQuietHour, quietPhrase } from "../lib/quietHours";
import { isOpenNow, minutesUntilClose, hoursForToday } from "../lib/openingHours";
import { findOrCreateCustomer, logQueueEvent, generatePersona } from "../lib/customers";
import { getCustomerCard, punchDots, hasUnclaimedReward } from "../lib/loyalty";
import { getEffectiveChecklist, buildChecklistMessage } from "../lib/checklists";
import { sendMessage } from "../lib/messaging";
import Button from "../components/Button";
import LanguagePicker from "../components/LanguagePicker";
import { LANGUAGES } from "../lib/i18n";
import { loadStationServices, stationsForService } from "../lib/stations";

/**
 * Public customer check-in page — the "scan QR → enter the queue" surface.
 * Route: /q/:slug
 *
 * Also serves as the iPad kiosk (?kiosk=1 enables larger touch targets +
 * auto-reset after submit). No auth required.
 */
export default function CustomerCheckIn() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();

  /* Which device this check-in came from.
     ?kiosk=1 already exists — it switches the page to large touch targets and
     is on the counter iPad's bookmark — so it doubles as the device marker.
     Reusing it rather than adding ?via= means nothing has to be re-bookmarked
     and the split starts working the moment this deploys.
     Anything else is someone on their own phone, whether they scanned the
     door code or typed the address. */

  const isKiosk = params.get("kiosk") === "1";
  const arrivalSource = isKiosk ? "kiosk" : "own_device";

  /* ?test=1 marks the ticket so it never reaches a statistic. The owner tests
     this page daily, sometimes with realistic names and numbers, and those
     rows are otherwise indistinguishable from customers — they have already
     produced one wrong conclusion about a day's trading. */
  const isTest = params.get("test") === "1";

  const [branch, setBranch] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // form state
  const [serviceId, setServiceId] = useState(null);
  /* ONE THING PER SCREEN.
     Everything used to be on a single page: five services, three fields, a
     consent paragraph, a checklist and a booking nudge — all visible at
     once on a tablet held by somebody who may not read English well. The
     complaint was that it needed scrolling; the deeper problem is that it
     asked for six decisions simultaneously.

     Now: language, then what you need, then how to reach you. Each step
     fits without scrolling and asks for exactly one thing. */
  const [step, setStep] = useState("lang");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  /* How many are already waiting — the nudge needs it to work out what
     joining now would actually cost. Refreshed when the service changes,
     since the estimate is per-service. */
  const [waitingCount, setWaitingCount] = useState(null);

  /* When this branch is genuinely quieter, from its own arrivals. Used to
     tell someone who has to fetch a document when it's worth coming back. */
  const [quiet, setQuiet] = useState(null);
  useEffect(() => {
    let off = false;
    if (!branch?.id) return;
    loadHourShape(supabase, branch.id)
      .then((shape) => {
        const q = findQuietHour(shape);
        if (!off) setQuiet(q && new Date().getHours() < q.hour ? quietPhrase(q) : null);
      })
      .catch(() => {});
    return () => { off = true; };
  }, [branch?.id]);

  /* Which counter takes which service. Used only to tell the customer where
     to go — it does not gate anything. A restriction that stops someone
     joining the queue would turn a helpful hint into a locked door, and the
     person who most needs to be seen is the one whose case does not fit a
     category. */
  const [stationRouting, setStationRouting] = useState({ stations: [], map: {} });
  useEffect(() => {
    let off = false;
    if (!branch?.id) return;
    (async () => {
      const [{ data: sts }, map] = await Promise.all([
        supabase.from("stations").select("id, name, status").eq("branch_id", branch.id),
        loadStationServices(branch.id),
      ]);
      if (!off) setStationRouting({ stations: sts ?? [], map });
    })().catch(() => {});
    return () => { off = true; };
  }, [branch?.id]);

  useEffect(() => {
    let off = false;
    if (!branch?.id) return;
    supabase.from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branch.id)
      .eq("status", "waiting")
      .then(({ count }) => { if (!off) setWaitingCount(count ?? 0); });
    return () => { off = true; };
  }, [branch?.id, serviceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data: branchRow, error: bErr } = await supabase
        .from("branches")
        .select("id, slug, name, city, timezone, islamic_mode, hours, queue_paused_at")
        .eq("slug", slug)
        .single();

      if (bErr || !branchRow) {
        if (!cancelled) {
          setLoadError(t("checkin.invalid"));
          setLoading(false);
        }
        return;
      }

      const { data: svcRows } = await supabase
        .from("services")
        .select("id, name, duration_min")
        .eq("branch_id", branchRow.id)
        .eq("active", true)
        .order("name");

      if (!cancelled) {
        setBranch(branchRow);
        setServices(svcRows || []);
        // No auto-selection — let the customer choose
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, t]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    /* Closed means closed. Someone joining a queue at 5:40pm will not be
       seen today, and letting them take a ticket is a worse experience than
       telling them at the door — they wait, nobody comes, and the office gets
       the blame for a screen that said yes. */
    if (branch?.hours && !isOpenNow(branch.hours)) {
      const today = hoursForToday(branch.hours);
      return setFormError(
        today?.closed
          ? "We're closed today. Please come back during opening hours."
          : `We've stopped taking new check-ins for today. We're open again ${today?.openPretty ?? "tomorrow"}.`
      );
    }

    if (!serviceId)        return setFormError(t("checkin.errors.pick_service"));
    if (!name.trim())      return setFormError(t("checkin.errors.enter_name"));
    // Phone is only required while SMS is a live channel.
    if (SMS_ENABLED && (phone.replace(/\D/g, "").length) < 7) {
      return setFormError(t("checkin.errors.valid_phone"));
    }
    /* Email is only compulsory when it's the ONLY way to reach them. With SMS
       live the phone is already required, so demanding both is friction at a
       counter with people waiting behind. A typo'd address is still rejected —
       an address that's wrong is worse than one that's absent, because the
       ticket silently goes nowhere. */
    if (!SMS_ENABLED && !email.trim()) {
      return setFormError("Please enter an email address — we'll send your ticket there.");
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setFormError("That email address doesn't look right — please check it.");
    }

    setSubmitting(true);

    const { data: tokenData, error: tErr } = await supabase
      .rpc("generate_ticket_token", { b_id: branch.id, src: "walk" });
    if (tErr) {
      setSubmitting(false);
      return setFormError(t("checkin.errors.could_not_token"));
    }

    const { data: ticket, error: insErr } = await supabase
      .from("tickets")
      .insert({
        branch_id: branch.id,
        service_id: serviceId,
        token: tokenData,
        /* "kiosk" (counter iPad) or "own_device". Both load this same route,
           so the ?kiosk=1 flag on the iPad's bookmark is the only thing that
           tells them apart. Tickets from before this split keep "walk" and
           are reported as an unknown route rather than being folded into
           either — back-dating history into a category it was never recorded
           in would answer the question this exists to ask. */
        source: arrivalSource,
        is_test: isTest,
        status: "waiting",
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        ...(email.trim() ? { customer_email: email.trim() } : {}),
      })
      .select("id")
      .single();

    if (insErr || !ticket) {
      setSubmitting(false);
      return setFormError(t("checkin.errors.could_not_checkin"));
    }

    // Confirmation notifications (non-blocking). Email is the primary channel —
    // transactional, no carrier registration needed. SMS only if opted in.
    if (email.trim() || (smsConsent && phone.trim())) {
      const notify = async (ahead) => {
        // Real ETA from this branch's own service-time history, rather than a
        // flat guess per person. Returns null when there's too little data,
        // in which case the messages simply omit the estimate.
        let etaText = null;
        try {
          const est = await estimateWaitFor({
            branchId: branch.id,
            position: (ahead ?? 0) + 1,
            serviceId,
          });
          etaText = formatWait(est);
        } catch { /* no estimate — messages omit the line */ }

        if (email.trim()) {
          sendCheckinEmail({
            email:      email.trim(),
            name:       name.trim(),
            token:      tokenData,
            position:   ahead,
            branchName: branch.name,
            ticketId:   ticket.id,
            branchSlug: branch.slug,
          });
        }
        /* Routed through the send-notification edge function, not Twilio
           directly. The old path called api.twilio.com from the browser,
           which the browser blocks outright — Twilio sends no CORS headers —
           so no text has ever left this page. It also required the Twilio
           auth token to be in the frontend bundle.

           The function takes a ticket id and picks the number and wording
           itself. That matters because this page is unauthenticated: an
           endpoint that accepted a destination and a body from here would be
           an open SMS relay billed to the business. */
        if (smsConsent && phone.trim()) {
          sendConfirmationSms(ticket.id);
        }
      };

      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branch.id)
        .eq("status", "waiting")
        .neq("id", ticket.id)
        .then(({ count }) => notify(count ?? 0))
        .catch(() => notify(0));
    }

    // Create / update the customer profile so they appear in the Customers page.
    // Non-blocking — a failure here never prevents the customer from getting their ticket.
    const serviceName = services.find((s) => s.id === serviceId)?.name ?? "General";
    findOrCreateCustomer(branch.id, { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined })
      .then(async (customer) => {
        await logQueueEvent(customer.id, branch.id, "queue_join", {
          ticketId: ticket.id,
          token: tokenData,
          service: serviceName,
        });
        // Auto-generate/refresh persona so staff see a profile when the customer arrives
        generatePersona(customer.id, branch.id).catch(() => {});
        // Load loyalty card so it can be shown on the ticket page
        getCustomerCard(branch.id, customer.id).then(card => {
          if (card) sessionStorage.setItem("loyalty_card", JSON.stringify(card));
        }).catch(() => {});
        // Auto-send document checklist if this service requires one
        const checklist = getEffectiveChecklist(branch.id, serviceName);
        if (checklist?.needsChecklist && checklist.items.length > 0 && phone.trim()) {
          const msg = buildChecklistMessage({
            customerName: name.trim(),
            businessName:  branch.name,
            serviceName,
            token: tokenData,
            checklist,
          });
          // Non-blocking — send via WhatsApp or log it if not connected
          sendMessage(branch.id, { ...customer, phone: phone.trim() }, "whatsapp", msg, null)
            .catch(() => {});
        }
      })
      .catch(() => {}); // non-fatal

    if (isKiosk) {
      // In kiosk mode, briefly show the issued ticket then auto-reset
      navigate(`/t/${ticket.id}?kiosk=1`, { replace: true });
    } else {
      navigate(`/t/${ticket.id}`, { replace: true });
    }
  }

  if (loading) {
    return <Shell isKiosk={isKiosk}><div className="text-center py-20 ovline text-ink-mute">{t("common.loading")}</div></Shell>;
  }

  if (loadError) {
    return (
      <Shell isKiosk={isKiosk}>
        <div className="text-center py-12">
          <div className="ovline text-[#d49185] mb-4">{t("common.error")}</div>
          <p className="text-ink-soft text-sm max-w-xs mx-auto">{loadError}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell isKiosk={isKiosk}>
      <div className={`atmosphere-hero -mx-6 px-6 text-center ${isKiosk ? "-mt-4 pt-4 pb-1" : "-mt-8 pt-8 pb-2"}`}>
        <div className="ovline text-gold-soft mb-2">{t("checkin.title")}</div>
        <h1 className={`font-display font-light tracking-tightest leading-tight ${isKiosk ? "text-4xl" : "text-3xl"}`}>
          {branch.name}
        </h1>
        {branch.city && <div className="text-[10px] text-ink-mute mt-2 tracking-wide">{branch.city}</div>}
      </div>

      {/* ── Step 1 · Language ───────────────────────────────────
          First, because a customer who cannot read the next screen cannot
          get past it. The picker existed only in the header, which is the
          last place someone looks when they are trying to work out what the
          machine wants. */}
      {step === "lang" && (
        <div className="mt-6">
          <div className={`text-ink-soft mb-4 ${isKiosk ? "text-lg" : "text-sm"}`}>
            {t("common.language")}
          </div>
          <div className="space-y-px bg-line border border-line">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => { i18n.changeLanguage(l.code); setStep("service"); }}
                className={`w-full text-left bg-bg-elev hover:bg-[rgba(201,168,106,0.06)] transition flex items-center justify-between ${
                  isKiosk ? "px-6 py-5" : "px-4 py-3.5"
                }`}
              >
                <span className={`text-ink ${isKiosk ? "text-2xl" : "text-base"}`} dir={l.rtl ? "rtl" : "ltr"}>
                  {l.native}
                </span>
                <span className="text-[11px] text-ink-mute uppercase tracking-[0.18em]">{l.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step dots — only from step 2, since choosing a language is not
          progress through the form, it is the thing that makes the form
          readable. */}
      {step !== "lang" && (
        <div className="mt-6 flex items-center gap-2">
          {["service", "details"].map((sKey, i) => (
            <div
              key={sKey}
              className={`h-[3px] flex-1 transition ${
                step === sKey || (step === "details" && i === 0) ? "bg-gold-deep" : "bg-line"
              }`}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`mt-4 ${isKiosk ? "space-y-4" : "space-y-6"}`}>
        {/* ── Step 2 · What you need ─────────────────────────── */}
        <div className={step === "service" ? "" : "hidden"}>
          <div className={`ovline mb-3 ${isKiosk ? "text-[15px]" : ""}`}>{t("checkin.service_label")}</div>
          <div className="space-y-px bg-line border border-line">
            {services.length === 0 && (
              <div className="bg-bg-elev p-4 text-[11px] text-ink-mute italic">
                {t("checkin.no_services")}
              </div>
            )}
            {services.map((svc) => {
              const active = serviceId === svc.id;
              return (
                <button
                  type="button"
                  key={svc.id}
                  onClick={() => setServiceId(active ? null : svc.id)}
                  className={`w-full text-left transition flex items-center justify-between ${
                    active ? "bg-[rgba(201,168,106,0.08)]" : "bg-bg-elev hover:bg-[rgba(201,168,106,0.04)]"
                  } ${isKiosk ? "px-5 py-3.5" : "px-4 py-3"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`border ${active ? "border-gold bg-gold" : "border-line-2"} rounded-full ${isKiosk ? "w-5 h-5" : "w-3 h-3"}`} />
                    <span className={`${active ? "text-ink" : "text-ink-soft"} ${isKiosk ? "text-lg" : "text-sm"}`}>{svc.name}</span>
                  </span>
                  <span className={`text-ink-mute font-mono ${isKiosk ? "text-sm" : "text-[10px]"}`}>~{svc.duration_min}m</span>
                </button>
              );
            })}

            {/* Where to go, once a service is chosen. Shown only when the
                office has actually narrowed it down — with no restrictions
                set, every counter takes everything and naming them all would
                be noise. Never blocks: this is a signpost, not a gate. */}
            {serviceId && (() => {
              const named = stationsForService(
                stationRouting.stations,
                stationRouting.map,
                serviceId,
              );
              const allStations = stationRouting.stations.length;
              const narrowed = allStations > 0 && named.length > 0 && named.length < allStations;
              if (!narrowed) return null;
              return (
                <div className={`bg-bg-elev border-l-2 border-gold-deep mt-2 ${isKiosk ? "px-5 py-3" : "px-4 py-2.5"}`}>
                  <div className={`text-gold-soft ${isKiosk ? "text-[13px]" : "text-[11.5px]"}`}>
                    {named.length === 1
                      ? `This is handled at ${named[0].name}.`
                      : `Handled at ${named.map((n) => n.name).join(" or ")}.`}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* What to bring, once they have chosen. Sits here rather than at
              the top of the page because it is meaningless before a service
              is picked, and a checklist for the wrong service is noise. */}
          <ServiceChecklist
            branch={branch}
            serviceName={services.find((s) => s.id === serviceId)?.name}
            quietPhrase={quiet}
            email={email}
          />

          {/* "Come back at 3, it's quieter" — only when the queue is
              genuinely long and a slot is genuinely free, so on most days it
              renders nothing at all. Kept because on the days it does appear
              it saves somebody an hour. */}
          <QuietSlotNudge
            branch={branch}
            serviceId={serviceId}
            waitingCount={waitingCount}
            onBook={(when) =>
              navigate(`/b/${branch.slug}?at=${encodeURIComponent(when.toISOString())}` +
                       (serviceId ? `&service=${serviceId}` : ""))
            }
          />

          <button
            type="button"
            disabled={!serviceId}
            onClick={() => setStep("details")}
            className={`w-full bg-gold-deep/90 hover:bg-gold-deep text-[#f5efe2] transition disabled:opacity-25 mt-4 ${
              isKiosk ? "text-xl px-6 py-4" : "text-sm px-4 py-3"
            }`}
          >
            {t("common.next", { defaultValue: "Continue" })} →
          </button>
        </div>

        {/* ── Step 3 · How to reach you ──────────────────────── */}
        <div className={step === "details" ? "space-y-4" : "hidden"}>
        <button
          type="button"
          onClick={() => setStep("service")}
          className="text-[12px] text-ink-mute hover:text-ink transition"
        >
          ‹ {t("common.back")}
        </button>

        <Field
          label={t("checkin.name_label")}
          value={name}
          onChange={setName}
          placeholder={t("checkin.name_placeholder")}
          autoFocus={!isKiosk}
          isKiosk={isKiosk}
        />
        {SMS_ENABLED && (
          <Field
            label={t("checkin.phone_label")}
            value={phone}
            onChange={setPhone}
            placeholder={t("checkin.phone_placeholder")}
            type="tel"
            isKiosk={isKiosk}
          />
        )}
        <Field
          label={t("checkin.email_label")}
          value={email}
          onChange={setEmail}
          placeholder={t("checkin.email_placeholder")}
          type="email"
          isKiosk={isKiosk}
          optional={SMS_ENABLED}
        />

        {/* While texting is unavailable, say so rather than showing nothing.
            An absent feature is invisible; a named one that is coming reads as
            a product being built. It also pre-empts the reasonable question of
            why an office with a screen and a queue is emailing rather than
            texting. */}
        {(!SMS_ENABLED || SMS_PENDING) && (
          <div className={`border border-line px-3 py-2.5 ${isKiosk ? "text-[13px]" : "text-[11px]"}`}>
            <span className="text-ink-soft">Text message updates</span>
            <span className="text-gold-soft"> · coming soon</span>
            <div className="text-ink-mute mt-0.5 leading-relaxed">
              {SMS_ENABLED
                ? "Texts start shortly — we're waiting on carrier approval. Until then we'll email your ticket and let you know when it's your turn."
                : "For now we'll email your ticket and let you know when it's your turn."}
            </div>
          </div>
        )}

        {/* SMS consent — separate optional checkbox, unchecked by default (A2P 10DLC requirement).
            Hidden entirely while SMS is unavailable; flip VITE_SMS_ENABLED=true to restore. */}
        {SMS_ENABLED && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={e => setSmsConsent(e.target.checked)}
              className={`mt-0.5 shrink-0 accent-[#c9a86a] ${isKiosk ? "w-5 h-5" : ""}`}
            />
            <span className={`text-ink-mute leading-relaxed ${isKiosk ? "text-[13px]" : "text-[11px]"}`}>
              {/* The BUSINESS's name, not ours. The customer is standing in
                  their office and the texts arrive from their number, so
                  "AzQueue" named a company they've never heard of. It also
                  broke the A2P campaign: carriers require the consent text,
                  the sample messages, the website and the registered brand to
                  all name the same entity. */}
              I agree to receive SMS text messages from {branch?.name ?? "this business"} about my queue status and appointment updates.
              Message frequency varies (typically 1–5 per visit). Msg &amp; data rates may apply.
              Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help.{" "}
              <a href={`/b/${slug}/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">Privacy Policy</a>
              {" · "}
              <a href="/sms/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">Terms</a>
            </span>
          </label>
        )}

        {formError && (
          <div className={`text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 ${isKiosk ? "text-lg px-5 py-4" : "text-[12px] px-3 py-2"}`}>
            {formError}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting || services.length === 0}
          className="w-full"
          size={isKiosk ? "lg" : undefined}
        >
          {submitting ? t("checkin.submitting") : `${t("checkin.submit")} →`}
        </Button>

        <div className={`text-ink-mute text-center tracking-wide pt-2 ${isKiosk ? "text-base" : "text-[10px]"}`}>
          {t("checkin.footer")}
        </div>
        </div>
      </form>
    </Shell>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", autoFocus, isKiosk, optional }) {
  return (
    <div>
      <div className={`ovline mb-2 flex items-center gap-2 ${isKiosk ? "text-[15px]" : "text-[9px]"}`}>
        {label}
        {optional && (
          <span
            className="text-ink-mute font-sans normal-case tracking-normal"
            style={{ fontSize: isKiosk ? "0.9rem" : "0.65rem" }}
          >
            (optional)
          </span>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full bg-bg-elev border border-line focus:border-gold-deep outline-none transition text-ink placeholder:text-ink-mute ${
          isKiosk ? "text-xl px-6 py-4" : "text-sm px-4 py-3"
        }`}
      />
    </div>
  );
}


function Shell({ children, isKiosk }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col relative overflow-hidden">
      {/* Premium atmospheric wash — gold radial glow at top */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, rgba(184,149,90,0.07), transparent 70%)",
        }}
      />
      <header className="relative px-6 py-2.5 border-b border-line/70 flex items-center justify-between backdrop-blur-sm bg-bg/60">
        <div className="flex items-center gap-2.5">
          <div className={`bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] shadow-[0_0_24px_rgba(201,168,106,0.3)] ${
            isKiosk ? "w-10 h-10 text-sm" : "w-7 h-7 text-[10px]"}`}>
            AQ
          </div>
          <span className={"font-display tracking-tightest text-ink " + (isKiosk ? "text-xl" : "text-sm")}>
            AzQueue
          </span>
        </div>
        <LanguagePicker />
      </header>
      <main className="relative flex-1 overflow-y-auto">
        <div className={"mx-auto px-6 " + (isKiosk ? "py-4 max-w-2xl" : "py-8 max-w-md")}>
          {children}
        </div>
      </main>
      <footer className="relative px-6 py-2 border-t border-line/70 text-[9px] text-ink-mute tracking-[0.2em] uppercase text-center bg-bg/60">
        {t("common.powered_by", { defaultValue: "Powered by" })} · azqueue.io · secured by 256-bit encryption
      </footer>
    </div>
  );
}
