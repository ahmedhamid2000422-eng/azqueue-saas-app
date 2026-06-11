import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import LanguagePicker from "../components/LanguagePicker";
import Button from "../components/Button";
import LuxeFrame from "../components/LuxeFrame";

/**
 * Public booking page — /b/:slug
 *
 * Customer flow:
 *   1. Pick a service
 *   2. Pick a day (next 7)
 *   3. Pick an available time slot (from get_available_slots RPC)
 *   4. Enter name + phone
 *   5. Submit → confirmation screen with the booked time
 *
 * The slot picker calls a Postgres function, so customers never see other
 * people's bookings — only the open time slots.
 */
export default function BookingPage() {
  const { slug } = useParams();
  const { t } = useTranslation();

  const [branch, setBranch] = useState(null);
  const [services, setServices] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  // form state
  const [serviceId, setServiceId] = useState(null);
  const [levelFilter, setLevelFilter] = useState("all"); // gym mode only
  const [dayOffset, setDayOffset] = useState(0);
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // booking row after success
  const [error, setError] = useState(null);

  // Slots for the chosen day + service
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Initial load — branch + services
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: b, error: bErr } = await supabase
        .from("branches").select("id, slug, name, city, timezone, islamic_mode, business_type, booking_faq, brand_color")
        .eq("slug", slug).single();
      if (bErr || !b) {
        if (!cancelled) { setLoadError(t("checkin.invalid")); setLoading(false); }
        return;
      }
      const { data: svcs } = await supabase
        .from("services").select("id, name, duration_min, level")
        .eq("branch_id", b.id).eq("active", true).order("name");
      if (!cancelled) {
        setBranch(b);
        setServices(svcs ?? []);
        if (svcs?.length) setServiceId(svcs[0].id);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, t]);

  // Reload slots when service or day changes
  useEffect(() => {
    if (!branch?.id || !serviceId) return;
    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      const day = addDays(new Date(), dayOffset).toISOString().slice(0, 10);
      const { data } = await supabase.rpc("get_available_slots", {
        p_branch_id: branch.id,
        p_day: day,
        p_service_id: serviceId,
      });
      if (!cancelled) {
        setSlots((data ?? []).map((r) => r.slot_at));
        setSlot(null); // reset when service/day changes
        setSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branch?.id, serviceId, dayOffset]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!serviceId) return setError(t("checkin.errors.pick_service"));
    if (!slot)      return setError(t("booking.pick_time"));
    if (!name.trim()) return setError(t("checkin.errors.enter_name"));
    if (!/^\+?\d[\d\s-]{6,}$/.test(phone)) return setError(t("checkin.errors.valid_phone"));

    setSubmitting(true);
    const { data, error: insErr } = await supabase
      .from("bookings")
      .insert({
        branch_id: branch.id,
        service_id: serviceId,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        scheduled_at: slot,
        status: "confirmed",
      })
      .select("*")
      .single();
    setSubmitting(false);
    if (insErr || !data) return setError(insErr?.message ?? t("common.error"));

    setConfirmed(data);
  }

  if (loading)   return <Shell brandColor={branch?.brand_color}><div className="text-center py-20 ovline text-ink-mute">{t("common.loading")}</div></Shell>;
  if (loadError) return <Shell brandColor={branch?.brand_color}><div className="text-center py-12 text-ink-soft text-sm">{loadError}</div></Shell>;

  if (confirmed) return <Confirmed branch={branch} booking={confirmed} services={services} />;

  const isGym = branch.business_type === "gym";
  const visibleServices = isGym && levelFilter !== "all"
    ? services.filter((s) => (s.level ?? "all_levels") === levelFilter)
    : services;
  const faqItems = Array.isArray(branch.booking_faq) ? branch.booking_faq : [];

  return (
    <Shell brandColor={branch?.brand_color}>
      {/* Branch header */}
      <div className="atmosphere-hero -mx-6 px-6 -mt-8 pt-8 pb-2 text-center">
        <div className="ovline text-gold-soft mb-2">{t("booking.title")}</div>
        <h1 className="font-display text-3xl font-light tracking-tightest leading-tight">{branch.name}</h1>
        {branch.city && <div className="text-[10px] text-ink-mute mt-2 tracking-wide">{branch.city}</div>}
        <p className="text-ink-soft text-xs mt-3 max-w-xs mx-auto">{t("booking.subtitle")}</p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-6">
        {/* Service */}
        <div>
          <div className="ovline mb-3">{isGym ? "Pick a class" : t("booking.pick_service")}</div>

          {/* Level filter — gym mode only, and only when classes have levels set */}
          {isGym && services.some((s) => s.level) && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {LEVEL_FILTERS.map((l) => {
                const active = levelFilter === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setLevelFilter(l.id); setServiceId(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] tracking-wide transition ${
                      active ? "border-gold bg-[rgba(201,168,106,0.08)] text-gold-soft" : "border-line text-ink-soft hover:border-[#3a3a3f]"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${l.dot}`} />
                    {l.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-px bg-line border border-line">
            {visibleServices.length === 0 && (
              <div className="bg-bg-elev p-4 text-[11px] text-ink-mute italic">
                {isGym ? "No classes at this level right now — try a different filter." : t("checkin.no_services")}
              </div>
            )}
            {visibleServices.map((s) => {
              const active = serviceId === s.id;
              const lvl = isGym ? levelMeta(s.level) : null;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  className={`w-full text-left px-4 py-3 transition flex items-center justify-between ${
                    active ? "bg-[rgba(201,168,106,0.08)]" : "bg-bg-elev hover:bg-[rgba(201,168,106,0.04)]"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`w-3 h-3 border ${active ? "border-gold bg-gold" : "border-line-2"} rounded-full shrink-0`} />
                    <span className={`text-sm truncate ${active ? "text-ink" : "text-ink-soft"}`}>{s.name}</span>
                    {lvl && (
                      <span className="flex items-center gap-1 text-[9px] text-ink-mute border border-line px-1.5 py-0.5 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${lvl.dot}`} />
                        {lvl.label}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-ink-mute font-mono shrink-0 ml-2">~{s.duration_min}m</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day strip */}
        <div>
          <div className="ovline mb-3">Day</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = addDays(new Date(), i);
              const active = dayOffset === i;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setDayOffset(i)}
                  className={`p-2 border transition text-center ${
                    active ? "border-gold-deep bg-[rgba(201,168,106,0.06)] text-gold-soft" : "border-line text-ink-mute hover:text-ink hover:border-gold-deep"
                  }`}
                >
                  <div className="text-[8px] uppercase tracking-[0.18em]">{d.toLocaleDateString([], { weekday: "short" })}</div>
                  <div className="font-display text-base mt-1">{d.getDate()}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot picker */}
        <div>
          <div className="ovline mb-3">{t("booking.pick_time")}</div>
          {slotsLoading ? (
            <div className="px-4 py-6 text-center text-ink-mute text-xs">{t("common.loading")}</div>
          ) : slots.length === 0 ? (
            <div className="px-4 py-6 text-center text-ink-mute text-xs italic">{t("booking.no_slots")}</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
              {slots.map((s) => {
                const d = new Date(s);
                const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const active = slot === s;
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`p-3 border transition font-mono text-sm ${
                      active
                        ? "border-gold-deep bg-[rgba(201,168,106,0.10)] text-gold"
                        : "border-line text-ink-soft hover:text-ink hover:border-gold-deep"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Name + phone — only show once a slot is picked */}
        {slot && (
          <>
            <Field label={t("checkin.name_label")} value={name} onChange={setName} placeholder={t("checkin.name_placeholder")} />
            <Field label={t("checkin.phone_label")} value={phone} onChange={setPhone} placeholder={t("checkin.phone_placeholder")} type="tel" />

            {error && <FormError message={error} />}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t("booking.submitting") : `${t("booking.submit")} →`}
            </Button>

            <div className="text-[10px] text-ink-mute text-center tracking-wide pt-2">
              {t("checkin.footer")}
            </div>
          </>
        )}
      </form>

      {/* FAQ — owner-editable, replaces ad-hoc WhatsApp Q&A */}
      {faqItems.length > 0 && (
        <div className="mt-10">
          <div className="ovline mb-3">Good to know</div>
          <div className="space-y-px bg-line border border-line">
            {faqItems.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ── FAQ accordion item ───────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  if (!q) return null;
  return (
    <div className="bg-bg-elev">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-[rgba(201,168,106,0.04)] transition"
      >
        <span className="text-sm text-ink-soft">{q}</span>
        <span className={`text-ink-mute text-xs shrink-0 transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && a && (
        <div className="px-4 pb-3 text-[12px] text-ink-mute leading-relaxed">{a}</div>
      )}
    </div>
  );
}

/* ── Confirmation screen ───────────────────────────────────────────── */
function Confirmed({ branch, booking, services }) {
  const { t } = useTranslation();
  const svc = services.find((s) => s.id === booking.service_id);
  const when = new Date(booking.scheduled_at);
  return (
    <Shell brandColor={branch?.brand_color}>
      <LuxeFrame className="p-8 mt-8 text-center">
        <div className="ovline text-[#9bbd9b] mb-3 flex items-center justify-center gap-2">
          <span className="pip breathe" />
          {t("booking.confirmed")}
        </div>
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">
          {when.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
        </h1>
        <div className="gold-text font-display text-6xl font-light tracking-tightest leading-none mb-3">
          {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>

        <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>

        <div className="grid grid-cols-2 gap-px bg-line border border-line">
          <div className="bg-bg-elev p-4">
            <div className="ovline text-[8px]">Service</div>
            <div className="text-sm mt-1">{svc?.name ?? "—"}</div>
          </div>
          <div className="bg-bg-elev p-4">
            <div className="ovline text-[8px]">Branch</div>
            <div className="text-sm mt-1">{branch.name}</div>
          </div>
        </div>

        <p className="text-[11px] text-ink-soft leading-relaxed mt-5">
          {t("booking.confirmed_body", { phone: booking.customer_phone })}
        </p>

        <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>

        <Link to={`/q/${branch.slug}`} className="text-[10px] tracking-[0.2em] uppercase text-gold-soft hover:text-gold">
          {t("ticket.checkin_again")} →
        </Link>
      </LuxeFrame>
    </Shell>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Gym-mode class levels — mirrors src/modes/business/Classes.jsx
const LEVEL_FILTERS = [
  { id: "all",          label: "All levels",   dot: "bg-ink-mute" },
  { id: "beginner",     label: "Beginner",     dot: "bg-[#9bbd9b]" },
  { id: "advanced",     label: "Advanced",     dot: "bg-[#d49185]" },
  { id: "conditioning", label: "Conditioning", dot: "bg-[#74b9e8]" },
  { id: "all_levels",   label: "Open level",   dot: "bg-gold" },
];
function levelMeta(level) {
  return LEVEL_FILTERS.find((l) => l.id === (level ?? "all_levels")) ?? { label: level, dot: "bg-ink-mute" };
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <div className="ovline mb-1.5 text-[9px]">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-4 py-3 transition text-ink placeholder:text-ink-mute"
      />
    </div>
  );
}

function FormError({ message }) {
  return (
    <div className="text-[12px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
      {message}
    </div>
  );
}

function Shell({ children, brandColor }) {
  const { t } = useTranslation();
  const color = brandColor || "#b8955a";
  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  const mix = (v,t2,a) => Math.round(v+(t2-v)*a).toString(16).padStart(2,"0");
  const soft = `#${mix(r,255,0.25)}${mix(g,255,0.25)}${mix(b,255,0.25)}`;
  const deep = `#${mix(r,0,0.22)}${mix(g,0,0.22)}${mix(b,0,0.22)}`;
  return (
    <div
      className="min-h-screen bg-bg text-ink flex flex-col relative overflow-hidden"
      style={{ "--aq-brand": color, "--aq-brand-soft": soft, "--aq-brand-deep": deep }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, rgba(184,149,90,0.07), transparent 70%)",
        }}
      />
      <header className="relative px-6 py-4 border-b border-line/70 flex items-center justify-between backdrop-blur-sm bg-bg/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-[10px] shadow-[0_0_24px_rgba(201,168,106,0.3)]">AQ</div>
          <span className="font-display text-base tracking-tightest">AzQueue</span>
        </div>
        <LanguagePicker />
      </header>
      <main className="relative flex-1 max-w-md w-full mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="relative px-6 py-4 border-t border-line/70 text-[9px] text-ink-mute tracking-[0.2em] uppercase text-center bg-bg/60">
        {t("common.powered_by", { defaultValue: "Powered by" })} · azqueue.io · secured by 256-bit encryption
      </footer>
    </div>
  );
}
