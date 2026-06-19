import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import useIsMobile from "../lib/useIsMobile";
import CustomerJourneyDemo from "../components/CustomerJourneyDemo";

// Shared mobile context so every section can read `mob` without prop-drilling
const MobCtx = createContext(false);
const useMob = () => useContext(MobCtx);

/* ──────────────────────────────────────────────────────────────────────
 * AzQueue · Landing
 *
 * The home page. Built to do four things at once:
 *   1. Show what the product actually looks like (kiosk, staff console,
 *      loyalty card, prayer pause, WhatsApp flow) — not just describe it.
 *   2. Read clearly to a small-business owner — no procurement jargon.
 *   3. Answer the questions a stranger has before clicking signup
 *      (FAQ + case studies + pricing) — also helps Google + AI assistants
 *      recommend AzQueue when people ask about queue / line management.
 *   4. Send every footer link to a real internal page (no surprise mailto:).
 * ──────────────────────────────────────────────────────────────────── */

const C = {
  void:    "#080807",
  ink:     "#f0ede6",
  gold:    "#b8955a",
  goldLit: "#d4b478",
  sage:    "#9bbd9b",
  muted:   "#60605a",
  faint:   "#2a2926",
  border:  "rgba(255,255,255,0.07)",
  borderL: "rgba(255,255,255,0.12)",
  card:    "#0c0c0b",
  panel:   "#111110",
  live:    "#4ade80",
  dim:     "#3a3835",
};

const T = {
  display: { fontSize: 50, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.06, fontFamily: "Georgia, 'Times New Roman', serif" },
  h2:      { fontSize: 34, fontWeight: 500, letterSpacing: "-0.01em",  lineHeight: 1.15, fontFamily: "Georgia, 'Times New Roman', serif" },
  h3:      { fontSize: 22, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3,  fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",   textTransform: "uppercase", color: C.gold },
  body:    { fontSize: 15, fontWeight: 400, lineHeight: 1.7, letterSpacing: "-0.005em", color: C.muted },
};

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ── Page meta + FAQ schema for SEO + AI assistants ──────────────────
function usePageMeta() {
  useEffect(() => {
    document.title = "AzQueue — Customer Flow Infrastructure for Clinics, Banks, Salons & Service Businesses";
    const set = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (!el) return;
      el.setAttribute(attr, value);
    };
    set('meta[name="description"]', "content",
      "AzQueue keeps every customer informed and every queue under control — automatically. Self-service check-in, WhatsApp updates, live staff dashboard, loyalty cards, and prayer-aware scheduling. We handle the setup. You run your business."
    );
  }, []);
}

const Ic = {
  Check:  () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Arr:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Bell:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  Moon:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Plus:   () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

const WaIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

// ── FAQ data ────────────────────────────────────────────────────────
const FAQ_DATA = [
  { q: "What is AzQueue?",
    a: "AzQueue is customer flow infrastructure for service businesses. It keeps every customer informed and every queue under control — automatically. Customers check in at a kiosk, wait wherever they want, and get WhatsApp updates as they move up the queue. Your staff sees everything live. We handle the setup so you're running the same day." },
  { q: "Who uses AzQueue?",
    a: "Clinics and hospitals, banks, government offices, pharmacies, service centers, salons, barbershops, and any business where customers wait in line. The system supports both walk-ins and bookings in the same queue." },
  { q: "How does the self-service kiosk work?",
    a: "Put a tablet (any iPad or Android tablet works) at your entrance. Customers tap a service, enter their phone number, and get a ticket number. No staff involvement, no paper. Setup takes ten minutes per location." },
  { q: "Do customers need to install an app?",
    a: "No. Customers receive a link via WhatsApp or SMS that opens a live ticket page in their browser. They can see their position in the queue and get push updates without installing anything." },
  { q: "How does the loyalty system work?",
    a: "Every completed visit punches the customer's card automatically — no separate app, no card to carry. After a set number of visits (you choose), they unlock a reward. The whole thing is tied to their phone number." },
  { q: "What is prayer pause scheduling?",
    a: "If your branch operates in a Muslim-majority market, you can enable Islamic Mode. The queue automatically pauses ten minutes before each prayer time and resumes after. Customers in line receive a WhatsApp notice with the resume time. No data is lost — the queue picks up where it left off." },
  { q: "Can walk-ins and bookings share one queue?",
    a: "Yes — that's the core of AzQueue. Bookings hold a soft priority window around their slot. Walk-ins fill the gaps. Both streams are ordered fairly by the same engine, so neither group ever feels skipped." },
  { q: "How much does AzQueue cost?",
    a: "Starter is $29/month for single-location businesses. Growth is $99/month for up to 10 branches with WhatsApp, SMS, loyalty cards and prayer pause. Enterprise is custom-priced for larger networks. All plans include a 14-day free trial — no credit card required." },
  { q: "How long does setup take?",
    a: "Most single-branch businesses are live within 15 minutes. Our team connects your WhatsApp Business account, configures your kiosk, and sets up your notification templates — you don't need to touch any technical settings. Multi-branch rollouts typically take one to two weeks." },
  { q: "What languages does AzQueue support?",
    a: "The customer-facing interface ships in English, Bahasa Malaysia, Arabic, French, and Urdu. Staff dashboard adds more on request. Custom translations are available on Enterprise plans." },
];

export default function Landing() {
  usePageMeta();
  const mob = useIsMobile();
  return (
    <MobCtx.Provider value={mob}>
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      {/* Schema.org FAQPage for AI assistants and Google rich snippets */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": FAQ_DATA.map(({ q, a }) => ({
          "@type": "Question",
          "name": q,
          "acceptedAnswer": { "@type": "Answer", "text": a },
        })),
      }) }} />

      {/* Schema.org SoftwareApplication — tells Google/Gemini this is a named product */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "AzQueue",
        "url": "https://azqueue.io",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "offers": {
          "@type": "Offer",
          "price": "79",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
        },
        "description": "Queue and booking management system for service businesses. Walk-ins and bookings in one smart queue — with WhatsApp AI receptionist, Islamic prayer-aware scheduling, loyalty cards, and live staff dashboard.",
        "featureList": [
          "WhatsApp AI Receptionist",
          "Virtual queue & walk-in check-in",
          "Appointment booking system",
          "Prayer-time aware scheduling",
          "Customer loyalty punch cards",
          "Real-time TV queue display",
          "SMS & WhatsApp notifications",
          "Multi-branch management",
          "Lead scoring & CRM",
        ],
        "screenshot": "https://azqueue.io/og-image.png",
        "publisher": {
          "@type": "Organization",
          "name": "AzQueue",
          "url": "https://azqueue.io",
          "logo": "https://azqueue.io/favicon.svg",
        },
      }) }} />

      <SiteNav />
      <Hero />
      <LogoCloud />
      <StatBand />
      <FeatureGrid />
      <LiveDashboard />
      <LoyaltySection />
      <PrayerSection />
      <WhatsAppFlow />
      <HowItWorks />
      <CustomerJourneySection />
      <CaseStudies />
      <Testimonials />
      <SavingsCalculator />
      <FAQSection />
      <Pricing />
      <FinalCTA />
      <SiteFooter />
    </div>
    </MobCtx.Provider>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────── */
function Hero() {
  const [ref, visible] = useInView(0.05);
  const mob = useMob();
  return (
    <section ref={ref} style={{ minHeight: mob ? "auto" : "100vh", display: "flex", alignItems: "center", padding: mob ? "100px 20px 60px" : "120px 48px 100px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 70% 80% at 60% 40%, black 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 60% 40%, black 30%, transparent 100%)" }} />
      <div style={{ position: "absolute", top: "35%", left: "58%", transform: "translate(-50%,-50%)", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,149,90,0.05) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%", display: "flex", flexDirection: mob ? "column" : "row", alignItems: mob ? "flex-start" : "center", gap: mob ? 48 : 100, position: "relative", zIndex: 1 }}>
        <div style={{ flex: mob ? "none" : "0 0 500px", width: mob ? "100%" : "auto", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)", transition: "all 0.8s ease" }}>
          <div style={{ ...T.label, marginBottom: 28, display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 999, background: "rgba(184,149,90,0.04)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.live }} />
            Queue management, simplified
          </div>
          <h1 style={{ ...T.display, fontSize: mob ? 36 : 50, color: C.ink, margin: "0 0 22px", maxWidth: 500 }}>
            Every customer informed.{" "}
            <em style={{ color: C.gold, fontStyle: "italic" }}>Every queue under control.</em>
          </h1>
          <p style={{ ...T.body, margin: "0 0 36px", maxWidth: 440, fontSize: 16 }}>
            Customers check in once and wait wherever they want. Your team sees everything live. We connect WhatsApp, set up your kiosk, and configure your notifications — no technical setup required.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 26px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em", transition: "all 0.2s ease", boxShadow: "0 10px 30px -10px rgba(184,149,90,0.5)" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
              Get started free <Ic.Arr />
            </Link>
            <Link to="/support" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "transparent", color: C.ink, padding: "13px 26px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.borderL}`, letterSpacing: "0.01em", transition: "all 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.goldLit; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderL; e.currentTarget.style.color = C.ink; }}>
              Book a setup call
            </Link>
          </div>
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 9 }}>
            {["14-day free trial · no card needed", "Live in under 15 minutes", "We handle WhatsApp setup for you"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
                <span style={{ fontSize: 12.5, color: C.muted, letterSpacing: "-0.005em" }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.muted, letterSpacing: "-0.005em" }}>Built for clinics, salons, banks, and service businesses that take their front desk seriously.</span>
          </div>
        </div>

        {!mob && (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative", minHeight: 480, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: "all 1s ease 0.2s" }}>
            <KioskMockup />
          </div>
        )}
      </div>
    </section>
  );
}

function KioskMockup() {
  const [selected, setSelected] = useState(0);
  const services = ["General Consultation", "Lab Results", "Pharmacy", "Specialist"];
  return (
    <div style={{ position: "relative" }}>
      <div style={{ width: 272, height: 388, background: "linear-gradient(160deg, #1e1d1b, #141311)", borderRadius: 26, border: "1px solid #252320", padding: "10px 10px 22px", boxShadow: "0 48px 80px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(255,255,255,0.04)" }}>
        <div style={{ width: 40, height: 3, background: "#1e1d1b", borderRadius: 2, margin: "0 auto 8px" }} />
        <div style={{ width: "100%", height: "calc(100% - 11px)", background: "#f4f1eb", borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ background: C.void, padding: "18px 20px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 8, color: C.dim, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>City Clinic · Al Barsha</div>
            <div style={{ fontSize: 38, fontWeight: 500, color: C.gold, fontFamily: "Georgia, serif", letterSpacing: "0.02em", lineHeight: 1 }}>A 42</div>
            <div style={{ fontSize: 7.5, color: C.muted, marginTop: 6 }}>3 ahead · estimated 8 min</div>
          </div>
          <div style={{ padding: "14px 14px 0", flex: 1 }}>
            <div style={{ fontSize: 7, color: "#9a9890", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 9 }}>Select service</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {services.map((s, i) => (
                <button key={i} onClick={() => setSelected(i)} style={{ padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer", textAlign: "left", background: i === selected ? C.gold : "#ebe7de", color: i === selected ? C.void : "#5a5754", fontSize: 8.5, fontWeight: i === selected ? 600 : 400, transition: "all 0.15s" }}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ padding: "10px 14px 14px" }}>
            <div style={{ background: C.void, borderRadius: 7, padding: "9px 0", textAlign: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 600, color: C.gold, letterSpacing: "0.12em", textTransform: "uppercase" }}>Confirm check-in</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 6, fontSize: 7, color: "#9a9890" }}>Updates sent via WhatsApp</div>
          </div>
        </div>
      </div>
      {/* WhatsApp card */}
      <div style={{ position: "absolute", right: -148, top: 48, background: "#fff", borderRadius: 12, padding: "11px 14px", width: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, paddingBottom: 7, borderBottom: "1px solid #f0ede6" }}>
          <div style={{ width: 24, height: 24, background: "#25D366", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><WaIcon /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: "#111", lineHeight: 1 }}>AzQueue</div>
            <div style={{ fontSize: 8, color: "#9a9890", marginTop: 1 }}>WhatsApp notification</div>
          </div>
          <div style={{ fontSize: 7.5, color: "#bbb" }}>now</div>
        </div>
        <div style={{ fontSize: 10, color: "#3a3835", lineHeight: 1.5 }}>City Clinic: You're next — Ticket <strong>A42</strong>. Please proceed to the counter.</div>
      </div>
      {/* Queue chip */}
      <div style={{ position: "absolute", left: -148, bottom: 60, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", width: 164, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize: 7.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Live queue</div>
        {[{ token: "A 40", name: "Mohammed A.", status: "serving" }, { token: "A 41", name: "Fatima H.", status: "waiting" }, { token: "A 42", name: "Sara A.", status: "waiting" }].map(row => (
          <div key={row.token} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: row.status === "serving" ? C.gold : C.muted, minWidth: 28, fontFamily: "monospace" }}>{row.token}</span>
            <span style={{ fontSize: 8.5, color: row.status === "serving" ? C.ink : C.dim, flex: 1 }}>{row.name}</span>
            {row.status === "serving" && <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.live }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Logo Cloud — infinite marquee ───────────────────────────────── */
function LogoCloud() {
  useEffect(() => {
    const id = "az-marquee-style";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes az-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .az-marquee-track { display: flex; animation: az-marquee 36s linear infinite; width: max-content; }
      .az-marquee-track:hover { animation-play-state: paused; }
    `;
    document.head.appendChild(s);
  }, []);

  const logos = [
    { name: "MERIDIAN HEALTH",   style: { fontFamily: "Georgia, serif",   letterSpacing: "0.18em", fontWeight: 400, fontSize: 13 } },
    { name: "NORDIC BANK",       style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.09em", fontWeight: 700, fontSize: 14 } },
    { name: "Caelum Salons",     style: { fontFamily: "Georgia, serif",   fontStyle: "italic", letterSpacing: "0.02em", fontWeight: 500, fontSize: 19 } },
    { name: "ATLAS · OFFICE",    style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.2em",  fontWeight: 500, fontSize: 11 } },
    { name: "PHARMACITY",        style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.06em", fontWeight: 800, fontSize: 14 } },
    { name: "ORION GROUP",       style: { fontFamily: "Georgia, serif",   letterSpacing: "0.14em", fontWeight: 400, fontSize: 13 } },
    { name: "VISTA CLINICS",     style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.12em", fontWeight: 600, fontSize: 12 } },
    { name: "Lumière",           style: { fontFamily: "Georgia, serif",   fontStyle: "italic", letterSpacing: "0.04em", fontWeight: 500, fontSize: 20 } },
    { name: "FIRST FEDERAL",     style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.1em",  fontWeight: 700, fontSize: 11 } },
    { name: "CITYSERVE",         style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.06em", fontWeight: 600, fontSize: 13 } },
  ];

  const doubled = [...logos, ...logos];

  return (
    <section style={{ padding: "52px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.void, overflow: "hidden" }}>
      <div style={{ textAlign: "center", marginBottom: 28, padding: "0 48px" }}>
        <div style={{ ...T.label, color: C.muted }}>Trusted by clinics, banks, and salons</div>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 140, background: `linear-gradient(90deg, ${C.void}, transparent)`, zIndex: 1, pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 140, background: `linear-gradient(-90deg, ${C.void}, transparent)`, zIndex: 1, pointerEvents: "none" }} />
        <div className="az-marquee-track" style={{ alignItems: "center" }}>
          {doubled.map((l, i) => (
            <div key={i} style={{ padding: "0 44px", whiteSpace: "nowrap", color: C.muted, opacity: 0.6, cursor: "default", transition: "opacity 0.25s, color 0.25s", ...l.style }}
              onMouseEnter={e => { e.currentTarget.style.color = C.ink; e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.opacity = "0.6"; }}>
              {l.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stat Band ────────────────────────────────────────────────────── */
function StatBand() {
  const [ref, visible] = useInView();
  const mob = useMob();
  const stats = [
    { value: "≤ 15 min",   label: "Setup time",            sub: "From sign-up to first ticket" },
    { value: "Zero",       label: "Hardware required",     sub: "Any tablet or phone works" },
    { value: "One tap",    label: "Customer check-in",     sub: "No app, no paper, no queuing" },
    { value: "Real-time",  label: "Staff dashboard",       sub: "Live view across all stations" },
  ];
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "100px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ ...T.label, marginBottom: 16 }}>The results</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: 0, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>What businesses see after switching to AzQueue.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ padding: mob ? "24px 12px" : "40px 28px", textAlign: "center", background: C.void, opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}>
              <div style={{ fontSize: mob ? 22 : 34, fontWeight: 400, color: C.ink, letterSpacing: "-0.02em", fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: mob ? 8 : 12, background: "linear-gradient(180deg,#f0ede6 0%, #b8955a 130%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{stat.value}</div>
              <div style={{ fontSize: mob ? 11 : 12, color: C.ink, letterSpacing: "0.04em", marginBottom: 4, fontWeight: 500 }}>{stat.label}</div>
              <div style={{ fontSize: mob ? 10 : 11, color: C.muted, lineHeight: 1.5 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Feature Grid ─────────────────────────────────────────────────── */
function FeatureGrid() {
  const [ref, visible] = useInView(0.06);
  const mob = useMob();
  const features = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
        </svg>
      ),
      title: "Self-service check-in",
      body:  "Customers tap once and join the queue. No paper, no waiting at the front desk, no staff involvement.",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      title: "WhatsApp & SMS",
      body:  "Customers stay informed automatically — no app, no guessing. We connect your WhatsApp Business account for you.",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      title: "Walk-ins + bookings",
      body:  "One queue handles both. Booked customers hold their slot. Walk-ins fill the gaps. Nobody feels skipped.",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
      title: "Loyalty cards",
      body:  "Visits punch the card automatically. Rewards unlock and land in the customer's WhatsApp. No plastic card needed.",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ),
      title: "Prayer pause",
      body:  "The queue pauses before each prayer and resumes after. Customers get notified automatically. Nothing to manage.",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
      title: "Live analytics",
      body:  "See peak hours, wait trends, and staff throughput live. Know exactly where your operation needs attention.",
    },
  ];
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "100px 48px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{ ...T.label, marginBottom: 16 }}>We handle the setup</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 auto 16px", maxWidth: 680 }}>
            Everything your front desk needs. Ready in minutes.
          </h2>
          <p style={{ ...T.body, margin: "0 auto", maxWidth: 520, fontSize: 15 }}>
            We connect WhatsApp, configure your kiosk, and set up notifications. You don't touch a single API key. Everything below ships in every plan.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: C.void, padding: "36px 32px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(14px)", transition: `all 0.55s ease ${i * 0.07}s` }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(184,149,90,0.07)", border: `1px solid rgba(184,149,90,0.18)`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, marginBottom: 18 }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 10, letterSpacing: "-0.01em", lineHeight: 1.35 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{f.body}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <Link to="/product" style={{ fontSize: 12, color: C.goldLit, textDecoration: "none", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            See everything that's included <Ic.Arr />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Live Dashboard (real product preview) ────────────────────────── */
function LiveDashboard() {
  const [ref, visible] = useInView(0.1);
  const mob = useMob();
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: mob ? "1fr" : "380px 1fr", gap: mob ? 36 : 80, alignItems: "center" }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-16px)", transition: "all 0.7s ease" }}>
          <div style={{ ...T.label, marginBottom: 18 }}>One view. Total control.</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 0 22px" }}>Your entire front desk, visible at a glance.</h2>
          <p style={{ ...T.body, margin: "0 0 24px" }}>
            Every customer in the building, live — who's being served, who's next, how long they've waited. Your team stops guessing and starts moving.
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              "Call the next customer with one tap",
              "Live wait time by service type",
              "Reassign customers across counters instantly",
              "Customer notes follow them through every visit",
            ].map(t => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.muted }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(16px)", transition: "all 0.7s ease 0.15s" }}>
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  const mob = useMob();
  const rows = [
    { token: "A 38", name: "Khalid M.",   service: "Lab Results", wait: "12m", status: "serving" },
    { token: "A 39", name: "Aisha R.",    service: "General",     wait: "8m",  status: "serving" },
    { token: "A 40", name: "Mohammed A.", service: "Specialist",  wait: "5m",  status: "next"    },
    { token: "A 41", name: "Fatima H.",   service: "Pharmacy",    wait: "3m",  status: "wait"    },
    { token: "A 42", name: "Sara A.",     service: "General",     wait: "2m",  status: "wait"    },
    { token: "A 43", name: "Yusuf B.",    service: "Lab Results", wait: "1m",  status: "wait"    },
  ];
  // Mobile: compact 3-col table (no service/wait columns)
  const colTemplate = mob ? "48px 1fr 72px" : "60px 1fr 130px 60px 90px";
  return (
    <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 14, padding: mob ? 14 : 18, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.live, boxShadow: "0 0 12px rgba(74,222,128,0.5)", flexShrink: 0 }} />
          <span style={{ fontSize: mob ? 10 : 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Live · City Clinic</span>
        </div>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>14:32</span>
      </div>
      {/* Stats — 2×2 on mobile, 4-wide on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
        {[{ label: "Waiting", value: "12" }, { label: "Serving", value: "3" }, { label: "Avg wait", value: "8m" }, { label: "Done today", value: "94" }].map(k => (
          <div key={k.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: mob ? "10px 10px" : "12px 14px" }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: mob ? 18 : 22, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>
      {/* Queue table */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: colTemplate, padding: mob ? "9px 12px" : "10px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span>Ticket</span><span>Customer</span>{!mob && <span>Service</span>}{!mob && <span>Wait</span>}<span style={{ textAlign: mob ? "right" : "left" }}>Status</span>
        </div>
        {rows.map((r, i) => {
          const accent = r.status === "serving" ? C.gold : r.status === "next" ? C.goldLit : C.muted;
          const bg     = r.status === "serving" ? "rgba(184,149,90,0.05)" : "transparent";
          return (
            <div key={r.token} style={{ display: "grid", gridTemplateColumns: colTemplate, padding: mob ? "9px 12px" : "11px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}`, background: bg, alignItems: "center" }}>
              <span style={{ fontSize: mob ? 11 : 12, color: accent, fontFamily: "monospace", fontWeight: 600 }}>{r.token}</span>
              <span style={{ fontSize: mob ? 11.5 : 12.5, color: r.status === "wait" ? C.muted : C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              {!mob && <span style={{ fontSize: 11.5, color: C.muted }}>{r.service}</span>}
              {!mob && <span style={{ fontSize: 11.5, color: C.muted, fontFamily: "monospace" }}>{r.wait}</span>}
              <span style={{ fontSize: 9, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, background: r.status === "serving" ? "rgba(184,149,90,0.1)" : r.status === "next" ? "rgba(212,180,120,0.06)" : "transparent", padding: "3px 6px", borderRadius: 4, justifySelf: mob ? "end" : "start", border: r.status !== "wait" ? `1px solid ${accent}33` : `1px solid ${C.border}` }}>
                {r.status === "wait" ? "Wait" : r.status === "next" ? "Next" : "Serving"}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button style={{ flex: 1, background: C.gold, color: C.void, border: "none", borderRadius: 8, padding: "10px 0", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer" }}>Call next →</button>
        {!mob && <button style={{ background: "transparent", color: C.ink, border: `1px solid ${C.borderL}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>Reassign</button>}
        {!mob && <button style={{ background: "transparent", color: C.ink, border: `1px solid ${C.borderL}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>Pause</button>}
      </div>
    </div>
  );
}

/* ── Loyalty Section ──────────────────────────────────────────────── */
function LoyaltySection() {
  const [ref, visible] = useInView(0.1);
  const mob = useMob();
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 380px", gap: mob ? 36 : 80, alignItems: "center" }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-16px)", transition: "all 0.7s ease" }}>
          <LoyaltyMockup />
        </div>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(16px)", transition: "all 0.7s ease 0.15s" }}>
          <div style={{ ...T.label, marginBottom: 18 }}>Loyalty cards</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 0 22px" }}>Turn one-time visitors into regulars. Automatically.</h2>
          <p style={{ ...T.body, margin: "0 0 24px" }}>
            Every visit punches the card. When they hit the reward, a WhatsApp message goes out automatically. No app for customers to download, no card for them to carry.
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              "Tied to their phone number — works across all your branches",
              "You set the reward and the number of visits to unlock it",
              "Customers see their progress after every visit",
              "Most customers hit the reward — repeat rates go up",
            ].map(t => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.muted }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function LoyaltyMockup() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26, paddingBottom: 22, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, rgba(184,149,90,0.25), rgba(184,149,90,0.05))", border: `1px solid ${C.borderL}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500 }}>F</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: C.ink, marginBottom: 3 }}>Fatima Hassan</div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>+971 50 432 1098</div>
        </div>
        <div style={{ padding: "4px 10px", background: "rgba(184,149,90,0.1)", border: `1px solid rgba(184,149,90,0.3)`, borderRadius: 999, fontSize: 9, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>Loyal</div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>Visits to reward</span>
          <span style={{ fontSize: 13, color: C.ink, fontFamily: "Georgia, serif" }}>4 / 5</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => {
            const filled = i <= 4;
            const last   = i === 5;
            return (
              <div key={i} style={{ aspectRatio: "1 / 1", borderRadius: "50%", background: filled ? "radial-gradient(circle at 30% 30%, #d4b478, #b8955a 60%, #8a7246)" : "transparent", border: filled ? "none" : `1px dashed ${last ? C.gold : C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: filled ? C.void : (last ? C.gold : C.muted), fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", boxShadow: filled ? "0 4px 12px rgba(184,149,90,0.3)" : "none" }}>
                {filled ? "✓" : last ? "★" : i}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 14, textAlign: "center", letterSpacing: "0.02em" }}>
          One more visit unlocks <span style={{ color: C.gold }}>free haircut</span>
        </div>
      </div>
      <div style={{ background: C.panel, borderRadius: 8, padding: 14, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Recent visits</div>
        {[["May 24", "Premium cut", "Counter 2"], ["May 02", "Standard cut", "Counter 1"], ["Apr 18", "Premium cut", "Counter 2"], ["Apr 03", "Standard cut", "Counter 3"]].map(([d, s, c], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr 90px", fontSize: 11, padding: "6px 0", borderBottom: i === 3 ? "none" : `1px solid ${C.border}`, alignItems: "center" }}>
            <span style={{ color: C.muted, fontFamily: "monospace" }}>{d}</span>
            <span style={{ color: C.ink }}>{s}</span>
            <span style={{ color: C.muted, textAlign: "right" }}>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Prayer Pause Section ─────────────────────────────────────────── */
function PrayerSection() {
  const [ref, visible] = useInView(0.1);
  const mob = useMob();
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: mob ? "1fr" : "380px 1fr", gap: mob ? 36 : 80, alignItems: "center" }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-16px)", transition: "all 0.7s ease" }}>
          <div style={{ ...T.label, marginBottom: 18, color: C.sage }}>Islamic mode</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 0 22px" }}>Your queue respects prayer time. Automatically.</h2>
          <p style={{ ...T.body, margin: "0 0 24px" }}>
            The queue pauses before each prayer and resumes after — with no manual intervention. Every customer in line gets a WhatsApp message with the resume time so they know exactly when to come back.
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              "Prayer times for every city — Mecca, Cairo, KL, Jakarta, Dubai",
              "Pause and resume buffers you control",
              "No customer loses their spot",
              "Ramadan hours that activate and deactivate on their own",
            ].map(t => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.muted }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.sage, flexShrink: 0 }}><Ic.Check /></div>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(16px)", transition: "all 0.7s ease 0.15s" }}>
          <PrayerMockup />
        </div>
      </div>
    </section>
  );
}

function PrayerMockup() {
  const prayers = [
    { name: "Fajr",    time: "05:12", done: true  },
    { name: "Dhuhr",   time: "12:34", done: true  },
    { name: "Asr",     time: "15:47", done: false, next: true },
    { name: "Maghrib", time: "18:22", done: false },
    { name: "Isha",    time: "19:45", done: false },
  ];
  return (
    <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(155,189,155,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(155,189,155,0.1)", border: `1px solid rgba(155,189,155,0.25)`, color: C.sage, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Moon /></div>
          <div>
            <div style={{ fontSize: 11, color: C.ink, letterSpacing: "-0.005em" }}>Prayer schedule</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Al Barsha, Dubai · Today</div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: C.sage, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Auto-pause on</span>
      </div>
      <div style={{ position: "relative", background: "rgba(155,189,155,0.06)", border: `1px solid rgba(155,189,155,0.25)`, borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 9, color: C.sage, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>Queue status</div>
        <div style={{ fontSize: 18, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.01em", marginBottom: 4 }}>Pausing in 1h 15m for Asr</div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          Resumes at <span style={{ color: C.sage }}>16:05</span> · all customers notified by WhatsApp automatically.
        </div>
      </div>
      <div style={{ position: "relative" }}>
        {prayers.map((p, i) => (
          <div key={p.name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${C.border}`, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: p.done ? C.muted : C.ink, textDecoration: p.done ? "line-through" : "none", letterSpacing: "-0.005em" }}>{p.name}</span>
            <span style={{ fontSize: 12, color: p.done ? C.muted : (p.next ? C.sage : C.ink), fontFamily: "monospace" }}>{p.time}</span>
            <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: p.done ? C.muted : (p.next ? C.sage : C.muted), fontWeight: 600, textAlign: "right" }}>
              {p.done ? "Done" : p.next ? "Next" : "Later"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── WhatsApp Flow ────────────────────────────────────────────────── */
function WhatsAppFlow() {
  const [ref, visible] = useInView(0.1);
  const mob = useMob();
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 380px", gap: mob ? 36 : 80, alignItems: "center" }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-16px)", transition: "all 0.7s ease", order: mob ? 2 : 1 }}>
          <WhatsAppMockup />
        </div>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(16px)", transition: "all 0.7s ease 0.15s", order: mob ? 1 : 2 }}>
          <div style={{ ...T.label, marginBottom: 18 }}>WhatsApp &amp; SMS</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 0 22px" }}>We connect WhatsApp for you. You just set the rules.</h2>
          <p style={{ ...T.body, margin: "0 0 24px" }}>
            No API keys. No Meta Business Manager. No webhook configuration. Our team connects your WhatsApp Business account and sets up your message templates. Customers start getting updates the same day.
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              "We handle the full WhatsApp Business setup for you",
              "Three automatic messages per visit — check-in, heads-up, you're next",
              "Works in English, Malay, Arabic, French, and Urdu",
              "Customers can reply CANCEL — no staff involvement needed",
            ].map(t => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.muted }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function WhatsAppMockup() {
  const thread = [
    { from: "biz", time: "14:02", text: "City Clinic: You're checked in — Ticket A42. 3 ahead of you, estimated 8 min." },
    { from: "biz", time: "14:08", text: "Heads up — you're 2 ahead. About 4 min to go." },
    { from: "biz", time: "14:11", text: "You're next — please head to Counter 2." },
    { from: "you", time: "14:11", text: "On my way 👍" },
  ];
  return (
    <div style={{ background: "#0e1611", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)", maxWidth: 380, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: 36, height: 36, background: "#25D366", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" }}><WaIcon /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "#f0ede6", fontWeight: 500 }}>City Clinic · Al Barsha</div>
          <div style={{ fontSize: 10.5, color: "#7d9080" }}>online · WhatsApp Business</div>
        </div>
      </div>
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {thread.map((m, i) => {
          const mine = m.from === "you";
          return (
            <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "78%", background: mine ? "#055e54" : "#1f2c28", color: "#f0ede6", padding: "8px 11px 18px", borderRadius: 9, fontSize: 12.5, lineHeight: 1.45, letterSpacing: "-0.005em", position: "relative", boxShadow: "0 1px 0 rgba(0,0,0,0.18)" }}>
                {m.text}
                <span style={{ position: "absolute", right: 10, bottom: 4, fontSize: 9, color: "#7d9080" }}>{m.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── How It Works ─────────────────────────────────────────────────── */
function HowItWorks() {
  const [ref, visible] = useInView(0.08);
  const mob = useMob();
  const steps = [
    { n: "01", title: "Customer checks in",    body: "Taps the kiosk, picks a service, done. No paper, no waiting at the desk." },
    { n: "02", title: "Ticket issued",         body: "They get a ticket number and their estimated wait time. Queue position confirmed." },
    { n: "03", title: "WhatsApp sent",         body: "A message lands in their WhatsApp. They can leave, grab a coffee, wait wherever." },
    { n: "04", title: "Kept informed",         body: "Automatic updates as the queue moves. No refreshing, no asking staff." },
    { n: "05", title: "Called to counter",     body: "One tap from your team. Customer gets notified and walks straight to the right counter." },
  ];
  return (
    <section id="how" ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: mob ? 36 : 64, flexWrap: "wrap", gap: 24 }}>
          <div>
            <div style={{ ...T.label, marginBottom: 20 }}>How it works</div>
            <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: 0 }}>Customer arrives. Queue runs itself.<br />You stay in control.</h2>
          </div>
          <Link to="/product" style={{ fontSize: 12, color: C.gold, textDecoration: "none", letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            See full product <Ic.Arr />
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {steps.map((step, i) => (
            <div key={i} style={{ background: C.void, padding: "32px 22px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.5s ease ${i * 0.08}s` }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 22, opacity: 0.6 }}>{step.n}</div>
              <div style={{ width: 28, height: 1, background: C.gold, marginBottom: 18, opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 8, letterSpacing: "-0.01em", lineHeight: 1.4 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Customer Journey Demo ────────────────────────────────────────── */
// QA bug C4 — CustomerJourneyDemo.jsx (the auto-cycling phone/wall/dashboard
// walkthrough) previously only existed inside the authenticated DisplaySetup
// wizard, so a prospective customer evaluating AzQueue from the public site
// never saw it. It's a self-contained component (its own state, no required
// props) styled with the same Tailwind theme tokens (gold/ink/bg-elev, etc.)
// that tailwind.config.js explicitly keeps in sync with this page's inline
// color palette, so it drops in here without any visual mismatch.
function CustomerJourneySection() {
  const [ref, visible] = useInView(0.08);
  const mob = useMob();
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px", background: C.card, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(14px)", transition: "all 0.7s ease" }}>
        <div style={{ textAlign: "center", marginBottom: mob ? 36 : 56 }}>
          <div style={{ ...T.label, marginBottom: 16 }}>See it end to end</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 auto 16px", maxWidth: 680 }}>
            Walk through one customer's visit, start to finish.
          </h2>
          <p style={{ ...T.body, margin: "0 auto", maxWidth: 560, fontSize: 15 }}>
            Same three screens your business will actually use — customer phone, wall display, staff dashboard — playing out a real check-in.
          </p>
        </div>
        {mob ? (
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "24px 0" }}>
            This interactive walkthrough works best on a larger screen —{" "}
            <Link to="/product" style={{ color: C.goldLit }}>see the full product tour</Link> instead.
          </div>
        ) : (
          <CustomerJourneyDemo />
        )}
      </div>
    </section>
  );
}

/* ── Case Studies ─────────────────────────────────────────────────── */
function CaseStudies() {
  const [ref, visible] = useInView(0.08);
  const mob = useMob();
  const studies = [
    {
      slug: "meridian-health",
      tag: "Healthcare",
      org: "Meridian Health · 14 clinics",
      headline: "Cut perceived wait time by 70%",
      body: "Replaced paper sign-ins across 14 clinics. Patients now check in on the iPad, wait in their car, and get called on WhatsApp. Front-desk staff handle 40% more patients per shift.",
      stat: { value: "70%", label: "Drop in complaints" },
    },
    {
      slug: "nordic-bank",
      tag: "Banking",
      org: "Nordic Bank · 9 branches",
      headline: "Prayer pause was the deal-maker",
      body: "Needed a queue system that respected prayer time during Ramadan. AzQueue auto-pauses, notifies customers in line, and resumes — no manual reset. Rolled out across 9 branches in two weeks.",
      stat: { value: "2 wks", label: "Full rollout" },
    },
    {
      slug: "caelum-salons",
      tag: "Salon",
      org: "Caelum Salons · 6 locations",
      headline: "Loyalty card lifted repeats 38%",
      body: "Switched from a plastic punch card to AzQueue's digital loyalty. Every visit auto-punches. The new reward unlock messages drove a 38% lift in repeat visits within 90 days.",
      stat: { value: "38%", label: "More repeats" },
    },
  ];
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: mob ? 36 : 56 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Real outcomes</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: 0, maxWidth: 640 }}>
            What these businesses stopped dealing with after switching.
          </h2>
        </div>
        <div id="case-studies" style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {studies.map((s, i) => (
            <Link key={i} to={`/case-studies/${s.slug}`} style={{ background: C.card, padding: "36px 32px", display: "flex", flexDirection: "column", textDecoration: "none", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.55s ease ${i * 0.1}s` }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
              onMouseLeave={e => e.currentTarget.style.background = C.card}>
              <div style={{ fontSize: 9, color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>{s.tag}</div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.04em", marginBottom: 18 }}>{s.org}</div>
              <h3 style={{ fontSize: 22, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.01em", lineHeight: 1.25, margin: "0 0 16px" }}>{s.headline}</h3>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 24px", flex: 1 }}>{s.body}</p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 28, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1, background: "linear-gradient(180deg, #f0ede6, #b8955a 140%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.stat.value}</span>
                <span style={{ fontSize: 10.5, color: C.muted, letterSpacing: "0.04em" }}>{s.stat.label}</span>
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: C.goldLit, letterSpacing: "0.02em" }}>Read full case →</div>
            </Link>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Link to="/industries" style={{ fontSize: 12, color: C.goldLit, textDecoration: "none", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            See more industries we serve <Ic.Arr />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────── */
function Testimonials() {
  const [ref, visible] = useInView(0.08);
  const mob = useMob();
  const quotes = [
    {
      text: "Setup took 20 minutes. Within a week our front desk stopped getting complaints about the wait. Patients actually thank us now.",
      author: "Ahmad R.",
      role: "Clinic Manager · Dubai",
      stat: "–62% wait complaints",
    },
    {
      text: "The prayer pause feature was the only reason we chose AzQueue over three other vendors. It just works, completely automatically.",
      author: "Siti N.",
      role: "Branch Head · Kuala Lumpur",
      stat: "9 branches live",
    },
    {
      text: "Loyalty punch card repeat visits went up 38% in the first quarter. That single feature paid for the whole year on its own.",
      author: "James O.",
      role: "Salon Owner · Lagos",
      stat: "+38% repeat visits",
    },
  ];
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "100px 48px", background: C.card, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: mob ? 36 : 56 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 16 }}>
            {[...Array(5)].map((_, i) => <span key={i} style={{ color: C.gold, fontSize: 16 }}>★</span>)}
          </div>
          <div style={{ ...T.label, marginBottom: 14, color: C.muted }}>Customer stories</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: 0, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
            Real outcomes from real businesses.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
          {quotes.map((q, i) => (
            <div key={i} style={{ background: C.void, padding: "36px 32px", display: "flex", flexDirection: "column", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.55s ease ${i * 0.1}s` }}>
              <div style={{ display: "flex", gap: 1, marginBottom: 20 }}>
                {[...Array(5)].map((_, j) => <span key={j} style={{ color: C.gold, fontSize: 11 }}>★</span>)}
              </div>
              <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.72, margin: "0 0 28px", flex: 1, letterSpacing: "-0.005em" }}>
                &ldquo;{q.text}&rdquo;
              </p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, marginBottom: 3 }}>{q.author}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{q.role}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.goldLit, fontFamily: "Georgia, serif", letterSpacing: "-0.01em", textAlign: "right" }}>{q.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Savings Calculator ───────────────────────────────────────────── */
const CURRENCIES = {
  USD: { symbol: "$", label: "USD", rate: 1,      price: 79 },
  AED: { symbol: "AED ", label: "AED", rate: 3.67, price: 290 },
};

function SavingsCalculator() {
  const [ref, visible] = useInView(0.08);
  const mob = useMob();

  const [currency, setCurrency] = useState("USD");
  const [custsPerDay, setCustsPerDay]   = useState(30);
  const [avgVal,      setAvgVal]        = useState(150);
  const [staffCount,  setStaffCount]    = useState(2);
  const [hourlyRate,  setHourlyRate]    = useState(18);
  const [noshowPct,   setNoshowPct]     = useState(18);

  const cur = CURRENCIES[currency];

  // Calculation logic (same as the chat widget above)
  const workingDays  = 22;
  const staffSavings = Math.round(staffCount * 1.5 * hourlyRate * workingDays * cur.rate);
  const savedNoshows = Math.max(0, (noshowPct / 100) - 0.05);
  const noshowSave   = Math.round(custsPerDay * workingDays * savedNoshows * avgVal * cur.rate);
  const walkoutSave  = Math.round(custsPerDay * workingDays * 0.08 * avgVal * cur.rate);
  const total        = staffSavings + noshowSave + walkoutSave;
  const annual       = total * 12;
  const roi          = cur.price > 0 ? Math.round(total / cur.price) : 0;

  const fmt = n => cur.symbol + n.toLocaleString();

  const sliders = [
    { label: "Customers per day",    id: "cust",   min: 5,  max: 200, step: 5,  val: custsPerDay, set: setCustsPerDay,  fmt: v => v },
    { label: "Average service value",id: "val",    min: 20, max: 1000,step: 10, val: avgVal,      set: setAvgVal,       fmt: v => cur.symbol + v },
    { label: "Staff on queue duty",  id: "staff",  min: 1,  max: 10,  step: 1,  val: staffCount,  set: setStaffCount,   fmt: v => v },
    { label: "Staff hourly rate",    id: "rate",   min: 10, max: 80,  step: 1,  val: hourlyRate,  set: setHourlyRate,   fmt: v => cur.symbol + v },
    { label: "Current no-show rate", id: "noshow", min: 0,  max: 40,  step: 1,  val: noshowPct,   set: setNoshowPct,    fmt: v => v + "%" },
  ];

  const buckets = [
    { label: "Staff time recovered",  sub: "1.5 hrs/day saved per staff member",           val: staffSavings, color: "#378ADD" },
    { label: "No-shows eliminated",   sub: `${noshowPct}% → 5% with SMS reminders`,         val: noshowSave,   color: C.sage    },
    { label: "Walkouts prevented",    sub: "23% of customers leave after 5+ min wait",      val: walkoutSave,  color: C.gold    },
  ];

  return (
    <section
      ref={ref}
      id="savings"
      style={{
        padding: mob ? "60px 20px" : "120px 48px",
        background: C.void,
        borderTop: `1px solid ${C.border}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(24px)",
        transition: "all 0.7s ease",
      }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>

        {/* Header row */}
        <div style={{ display: "flex", flexDirection: mob ? "column" : "row", justifyContent: "space-between", alignItems: mob ? "flex-start" : "flex-end", gap: 24, marginBottom: mob ? 40 : 64 }}>
          <div>
            <div style={{ ...T.label, marginBottom: 16 }}>ROI Calculator</div>
            <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 0 12px" }}>
              See exactly what you're leaving on the table.
            </h2>
            <p style={{ ...T.body, margin: 0, maxWidth: 520, fontSize: 14 }}>
              Adjust the sliders to match your business. Every number is grounded in real operating costs — no marketing inflation.
            </p>
          </div>

          {/* Currency toggle */}
          <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
            {Object.keys(CURRENCIES).map(k => (
              <button
                key={k}
                onClick={() => setCurrency(k)}
                style={{
                  padding: "8px 20px",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  background: currency === k ? C.gold : "transparent",
                  color: currency === k ? C.void : C.muted,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 40 : 64, alignItems: "start" }}>

          {/* Left — sliders */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {sliders.map(s => (
              <div key={s.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: C.muted, letterSpacing: "0.04em" }}>{s.label}</span>
                  <span style={{ fontSize: 16, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{s.fmt(s.val)}</span>
                </div>
                <div style={{ position: "relative" }}>
                  {/* Track fill */}
                  <div style={{
                    position: "absolute", top: "50%", left: 0,
                    width: `${((s.val - s.min) / (s.max - s.min)) * 100}%`,
                    height: 2, background: C.gold, transform: "translateY(-50%)", pointerEvents: "none", borderRadius: 2,
                  }} />
                  <input
                    type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                    onChange={e => s.set(Number(e.target.value))}
                    style={{
                      width: "100%", appearance: "none", WebkitAppearance: "none",
                      background: C.faint, height: 2, borderRadius: 2, outline: "none", cursor: "pointer",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Right — results */}
          <div>
            {/* Breakdown rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 2 }}>
              {buckets.map(b => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${C.border}`, gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div style={{ width: 3, height: 36, background: b.color, borderRadius: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: C.ink, marginBottom: 2 }}>{b.label}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{b.sub}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: C.ink, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(b.val)}<span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>/mo</span></div>
                </div>
              ))}
            </div>

            {/* Total card */}
            <div style={{
              marginTop: 20,
              padding: mob ? "24px 20px" : "28px 28px",
              border: `1px solid rgba(184,149,90,0.3)`,
              borderRadius: 8,
              background: "rgba(184,149,90,0.04)",
              display: "flex", flexDirection: mob ? "column" : "row", justifyContent: "space-between", alignItems: mob ? "flex-start" : "center", gap: 20,
            }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Monthly savings</div>
                <div style={{ fontSize: mob ? 36 : 44, color: C.gold, fontFamily: "Georgia, serif", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {fmt(total)}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  {roi}× return on your {cur.symbol}{cur.price.toLocaleString()}/mo AzQueue plan
                </div>
              </div>
              <div style={{ textAlign: mob ? "left" : "right" }}>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Annual savings</div>
                <div style={{ fontSize: mob ? 24 : 28, color: C.ink, fontFamily: "Georgia, serif", fontWeight: 500, letterSpacing: "-0.01em" }}>
                  {fmt(annual)}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                to="/signup"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 24px", background: C.gold, color: C.void,
                  fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                  textDecoration: "none", borderRadius: 4, transition: "opacity 0.15s",
                }}
              >
                Start saving — free 14 days <Ic.Arr />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────── */
function FAQSection() {
  const [open, setOpen] = useState(0);
  const [ref, visible] = useInView(0.06);
  const mob = useMob();
  return (
    <section ref={ref} id="faq" style={{ padding: mob ? "60px 20px" : "120px 48px", background: C.card, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: mob ? "1fr" : "340px 1fr", gap: mob ? 32 : 80, alignItems: "flex-start" }}>
        <div style={mob ? {} : { position: "sticky", top: 100 }}>
          <div style={{ ...T.label, marginBottom: 18 }}>FAQ</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 0 18px" }}>Common questions, clear answers.</h2>
          <p style={{ ...T.body, margin: "0 0 24px", fontSize: 14 }}>
            The questions we hear most from owners and operators evaluating AzQueue. Still stuck? <Link to="/support" style={{ color: C.goldLit, textDecoration: "none" }}>Email support</Link>.
          </p>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>{FAQ_DATA.length} entries · updated weekly</div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}>
          {FAQ_DATA.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <div key={item.q} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button type="button" onClick={() => setOpen(isOpen ? -1 : idx)} style={{ width: "100%", textAlign: "left", padding: "22px 0", background: "transparent", border: "none", cursor: "pointer", display: "grid", gridTemplateColumns: "32px 1fr 24px", gap: 14, alignItems: "center", color: "inherit" }}>
                  <span style={{ fontSize: 11, color: C.gold, fontFamily: "monospace", letterSpacing: "0.08em" }}>{String(idx + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 15, color: isOpen ? C.ink : "#a09c93", letterSpacing: "-0.005em", transition: "color 0.2s" }}>{item.q}</span>
                  <span style={{ fontSize: 18, color: isOpen ? C.gold : C.muted, transition: "all 0.2s", transform: isOpen ? "rotate(45deg)" : "none", fontFamily: "Georgia, serif", lineHeight: 1, justifySelf: "end" }}>+</span>
                </button>
                {isOpen && (
                  <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 24px", gap: 14, paddingBottom: 22 }}>
                    <span />
                    <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0, maxWidth: 640 }}>{item.a}</p>
                    <span />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────────────────────── */
function Pricing() {
  const [ref, visible] = useInView(0.1);
  const [annual, setAnnual] = useState(true);
  const mob = useMob();
  const tiers = [
    {
      name: "Starter",
      price: annual ? 29 : 39,
      desc: "For single-location businesses getting started.",
      features: ["1 branch", "1 kiosk terminal", "WhatsApp notifications", "Basic analytics", "Email support"],
      cta: "Start free trial",
      ctaTo: "/signup?tier=essential",
      featured: false,
    },
    {
      name: "Growth",
      price: annual ? 99 : 129,
      desc: "For multi-location businesses ready to scale.",
      features: ["Up to 10 branches", "Unlimited kiosks & staff", "WhatsApp, SMS & email", "Loyalty punch cards", "Prayer pause scheduling", "Advanced analytics & exports", "Priority chat support"],
      cta: "Start free trial",
      ctaTo: "/signup?tier=professional",
      featured: true,
      tag: "Most popular",
    },
    {
      name: "Enterprise",
      price: null,
      desc: "For networks, franchises, and public-sector deployments.",
      features: ["Unlimited branches & users", "SSO & role-based access", "Dedicated success manager", "Custom integrations & API", "Uptime SLA on contract", "24/7 phone & WhatsApp support", "White-glove onboarding"],
      cta: "Talk to sales",
      ctaTo: "/support",
      featured: false,
      enterprise: true,
    },
  ];
  return (
    <section id="pricing" ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: mob ? 36 : 56 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Pricing</div>
          <h2 style={{ ...T.h2, fontSize: mob ? 26 : 34, color: C.ink, margin: "0 0 16px" }}>Simple, transparent pricing.</h2>
          <p style={{ ...T.body, margin: "0 auto 32px", maxWidth: 520 }}>Start free for 14 days. No card required. Move up or down as your business changes.</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[["Monthly", false], ["Annual", true]].map(([label, val]) => (
              <button key={label} onClick={() => setAnnual(val)} style={{ padding: "8px 20px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: annual === val ? C.ink : "transparent", color: annual === val ? C.void : C.muted, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
                {label}{val && <span style={{ fontSize: 9, color: annual === val ? C.gold : C.muted, fontWeight: 600 }}>SAVE 25%</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
          {tiers.map((tier, i) => (
            <div key={i} style={{ background: tier.featured ? C.panel : (tier.enterprise ? "linear-gradient(180deg, #131210 0%, #0c0c0b 100%)" : C.void), padding: tier.featured ? "44px 32px" : "40px 32px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.5s ease ${i * 0.1}s` }}>
              {tier.featured && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, opacity: 0.5 }} />}
              {tier.enterprise && <div style={{ position: "absolute", top: -1, right: -1, padding: "6px 14px", background: "rgba(184,149,90,0.08)", border: `1px solid rgba(184,149,90,0.25)`, borderRight: "none", borderTop: "none", borderBottomLeftRadius: 8, fontSize: 9, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>Enterprise</div>}
              <div style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: tier.featured ? C.gold : (tier.enterprise ? C.gold : C.muted), letterSpacing: "0.1em", textTransform: "uppercase" }}>{tier.name}</span>
                  {tier.tag && <span style={{ fontSize: 9, color: C.gold, border: `1px solid rgba(184,149,90,0.35)`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>{tier.tag}</span>}
                </div>
                {tier.price ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>$</span>
                    <span style={{ fontSize: 46, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{tier.price}</span>
                    <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>/mo</span>
                    {annual && <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>billed annually</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 34, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", marginBottom: 10, lineHeight: 1.15 }}>Custom</div>
                )}
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>{tier.desc}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {tier.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0, marginTop: 2 }}><Ic.Check /></div>
                    <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link to={tier.ctaTo} style={{ textDecoration: "none", width: "100%", padding: "12px 0", borderRadius: 7, cursor: "pointer", border: tier.featured ? "none" : `1px solid ${tier.enterprise ? C.gold : C.borderL}`, background: tier.featured ? C.gold : (tier.enterprise ? "rgba(184,149,90,0.06)" : "transparent"), color: tier.featured ? C.void : (tier.enterprise ? C.goldLit : C.ink), fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textTransform: "uppercase" }}
                onMouseEnter={e => { if (!tier.featured && !tier.enterprise) e.currentTarget.style.borderColor = C.gold; if (tier.enterprise) { e.currentTarget.style.background = C.gold; e.currentTarget.style.color = C.void; } }}
                onMouseLeave={e => { if (!tier.featured && !tier.enterprise) e.currentTarget.style.borderColor = C.borderL; if (tier.enterprise) { e.currentTarget.style.background = "rgba(184,149,90,0.06)"; e.currentTarget.style.color = C.goldLit; } }}>
                {tier.cta} <Ic.Arr />
              </Link>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: C.muted }}>
          All plans include free updates and onboarding support. <Link to="/product" style={{ color: C.goldLit, textDecoration: "none" }}>See what's included in each plan →</Link>
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ────────────────────────────────────────────────────── */
function FinalCTA() {
  const [ref, visible] = useInView(0.15);
  const mob = useMob();
  return (
    <section ref={ref} style={{ padding: mob ? "60px 20px" : "120px 48px", background: C.card, position: "relative", overflow: "hidden", borderTop: `1px solid ${C.border}` }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 360, background: "radial-gradient(ellipse, rgba(184,149,90,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)", transition: "all 0.7s ease" }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 40px", opacity: 0.35 }} />
        <h2 style={{ ...T.display, color: C.ink, margin: "0 0 20px", fontSize: mob ? 32 : 44 }}>
          Stop losing customers{" "}
          <em style={{ color: C.gold, fontStyle: "italic" }}>to the waiting room.</em>
        </h2>
        <p style={{ ...T.body, margin: "0 0 36px", fontSize: 16 }}>We handle setup. You're live in 15 minutes. No hardware, no training, no API keys.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em", transition: "all 0.2s ease", boxShadow: "0 10px 30px -10px rgba(184,149,90,0.5)" }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
            Get started free <Ic.Arr />
          </Link>
          <Link to="/support" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "transparent", color: C.ink, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.borderL}`, letterSpacing: "0.01em", transition: "all 0.2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.goldLit; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderL; e.currentTarget.style.color = C.ink; }}>
            Book a setup call
          </Link>
        </div>
        <div style={{ marginTop: 22, fontSize: 11, color: C.muted, letterSpacing: "0.02em" }}>No credit card required · Cancel anytime</div>
      </div>
    </section>
  );
}
