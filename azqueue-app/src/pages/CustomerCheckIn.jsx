import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { sendConfirmation } from "../lib/notifications";
import { findOrCreateCustomer, logQueueEvent, generatePersona } from "../lib/customers";
import { getEffectiveChecklist, buildChecklistMessage } from "../lib/checklists";
import { sendMessage } from "../lib/messaging";
import Button from "../components/Button";
import LanguagePicker from "../components/LanguagePicker";

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
  const { t } = useTranslation();

  const isKiosk = params.get("kiosk") === "1";

  const [branch, setBranch] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // form state
  const [serviceId, setServiceId] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data: branchRow, error: bErr } = await supabase
        .from("branches")
        .select("id, slug, name, city, timezone, islamic_mode")
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

    if (!serviceId)        return setFormError(t("checkin.errors.pick_service"));
    if (!name.trim())      return setFormError(t("checkin.errors.enter_name"));
    if (!/^\+?\d[\d\s-]{6,}$/.test(phone)) return setFormError(t("checkin.errors.valid_phone"));

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
        source: "walk",
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

    sendConfirmation(ticket.id);

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
      <div className="atmosphere-hero -mx-6 px-6 -mt-8 pt-8 pb-2 text-center">
        <div className="ovline text-gold-soft mb-2">{t("checkin.title")}</div>
        <h1 className={`font-display font-light tracking-tightest leading-tight ${isKiosk ? "text-5xl" : "text-3xl"}`}>
          {branch.name}
        </h1>
        {branch.city && <div className="text-[10px] text-ink-mute mt-2 tracking-wide">{branch.city}</div>}
      </div>

      {/* Step progress — Effectiveness principle: users know where they are */}
      <div className="mt-6 flex items-center">
        {[t("checkin.step_service"), t("checkin.step_details"), t("checkin.step_ticket")].map((label, i) => {
          const done = i === 0 && !!serviceId;
          const active = i === 0 || (i === 1 && !!serviceId);
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-5 h-5 flex items-center justify-center text-[9px] font-mono border transition ${
                  done ? "bg-gold border-gold text-[#141410]" :
                  active ? "border-gold-deep text-gold-soft" :
                  "border-line text-ink-mute"
                }`}>
                  {done ? "✓" : i + 1}
                </div>
                <div className={`text-[8px] tracking-[0.15em] uppercase mt-1 transition ${
                  active ? "text-gold-soft" : "text-ink-mute"
                }`}>{label}</div>
              </div>
              {i < 2 && (
                <div className={`h-px flex-1 mb-4 mx-1 transition ${done ? "bg-gold-deep" : "bg-line"}`} />
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className={`mt-6 ${isKiosk ? "space-y-8" : "space-y-6"}`}>
        {/* Service picker */}
        <div>
          <div className={`ovline mb-3 ${isKiosk ? "text-[12px]" : ""}`}>{t("checkin.service_label")}</div>
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
                  } ${isKiosk ? "px-6 py-5" : "px-4 py-3"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`border ${active ? "border-gold bg-gold" : "border-line-2"} rounded-full ${isKiosk ? "w-5 h-5" : "w-3 h-3"}`} />
                    <span className={`${active ? "text-ink" : "text-ink-soft"} ${isKiosk ? "text-lg" : "text-sm"}`}>{svc.name}</span>
                  </span>
                  <span className={`text-ink-mute font-mono ${isKiosk ? "text-sm" : "text-[10px]"}`}>~{svc.duration_min}m</span>
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label={t("checkin.name_label")}
          value={name}
          onChange={setName}
          placeholder={t("checkin.name_placeholder")}
          autoFocus={!isKiosk}
          isKiosk={isKiosk}
        />
        <Field
          label={t("checkin.phone_label")}
          value={phone}
          onChange={setPhone}
          placeholder={t("checkin.phone_placeholder")}
          type="tel"
          isKiosk={isKiosk}
        />
        <Field
          label={t("checkin.email_label")}
          value={email}
          onChange={setEmail}
          placeholder={t("checkin.email_placeholder")}
          type="email"
          isKiosk={isKiosk}
          optional
        />

        {formError && (
          <div className="text-[12px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
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

        <div className={`text-ink-mute text-center tracking-wide pt-2 ${isKiosk ? "text-sm" : "text-[10px]"}`}>
          {t("checkin.footer")}
        </div>
      </form>
    </Shell>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", autoFocus, isKiosk, optional }) {
  return (
    <div>
      <div className={`ovline mb-1.5 flex items-center gap-2 ${isKiosk ? "text-[11px]" : "text-[9px]"}`}>
        {label}
        {optional && <span className="text-ink-mute font-sans normal-case tracking-normal" style={{ fontSize: "0.65rem" }}>(optional)</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full bg-bg-elev border border-line focus:border-gold-deep outline-none transition text-ink placeholder:text-ink-mute ${
          isKiosk ? "text-lg px-5 py-4" : "text-sm px-4 py-3"
        }`}
      />
    </div>
  );
}


function Shell({ children, isKiosk }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] shadow-[0_0_18px_rgba(201,168,106,0.25)] ${
            isKiosk ? "w-10 h-10 text-sm" : "w-7 h-7 text-[10px]"}`}>
            AQ
          </div>
          <span className={"font-display tracking-tightest text-ink " + (isKiosk ? "text-xl" : "text-sm")}>
            AzQueue
          </span>
        </div>
        <LanguagePicker />
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className={"mx-auto px-6 py-8 " + (isKiosk ? "max-w-2xl" : "max-w-md")}>
          {children}
        </div>
      </main>
    </div>
  );
}
