import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";

/* ──────────────────────────────────────────────────────────────────────
 * AzQueue · Landing
 * Refined dark + gold marketing page. Built for service businesses
 * evaluating AzQueue at the executive / procurement level.
 *
 * Sections (top → bottom):
 *   Hero            — concise pitch + live kiosk mockup
 *   LogoCloud       — "Trusted by leading service businesses"
 *   StatBand        — four headline metrics
 *   HowItWorks      — five-step explainer
 *   ProductTeaser   — six feature tiles
 *   Testimonials    — three quoted customers
 *   Enterprise      — compliance, SLA, dedicated support
 *   Pricing         — three tiers with prominent Enterprise CTA
 *   FinalCTA        — sign-up + talk-to-sales
 *   Footer
 * ──────────────────────────────────────────────────────────────────── */

const C = {
  void:    "#080807",
  ink:     "#f0ede6",
  gold:    "#b8955a",
  goldLit: "#d4b478",
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
  display: { fontSize: 52, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.05, fontFamily: "Georgia, 'Times New Roman', serif" },
  h2:      { fontSize: 36, fontWeight: 500, letterSpacing: "-0.01em",  lineHeight: 1.12, fontFamily: "Georgia, 'Times New Roman', serif" },
  h3:      { fontSize: 22, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3,  fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 500, letterSpacing: "0.16em",   textTransform: "uppercase", color: C.gold },
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

function useCounter(target, active, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return val;
}

const Ic = {
  Check:  () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Arr:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Shield: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Lock:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Bolt:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Globe:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Quote:  () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V18h6.83v-6.83H5.17A2 2 0 0 1 7.17 9V6zm10 0A5.17 5.17 0 0 0 12 11.17V18h6.83v-6.83h-3.66A2 2 0 0 1 17.17 9V6z"/></svg>,
};

const WaIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

export default function Landing() {
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <SiteNav />
      <Hero />
      <LogoCloud />
      <StatBand />
      <HowItWorks />
      <ProductTeaser />
      <Testimonials />
      <Enterprise />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────── */
function Hero() {
  const [ref, visible] = useInView(0.05);
  return (
    <section ref={ref} style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "120px 48px 100px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 70% 80% at 60% 40%, black 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 60% 40%, black 30%, transparent 100%)" }} />
      <div style={{ position: "absolute", top: "35%", left: "58%", transform: "translate(-50%,-50%)", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,149,90,0.05) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 100, position: "relative", zIndex: 1 }}>
        <div style={{ flex: "0 0 500px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)", transition: "all 0.8s ease" }}>
          <div style={{ ...T.label, marginBottom: 28, display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 999, background: "rgba(184,149,90,0.04)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.live }} />
            Now serving 200+ businesses
          </div>
          <h1 style={{ ...T.display, color: C.ink, margin: "0 0 22px", maxWidth: 480 }}>
            Enterprise queue management.{" "}
            <em style={{ color: C.gold, fontStyle: "italic" }}>Effortless service.</em>
          </h1>
          <p style={{ ...T.body, margin: "0 0 40px", maxWidth: 420, fontSize: 16 }}>
            One platform for walk-ins and bookings — with a live staff console, WhatsApp notifications, and the operational depth large service businesses demand.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 26px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em", transition: "all 0.2s ease", boxShadow: "0 10px 30px -10px rgba(184,149,90,0.5)" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
              Start free trial <Ic.Arr />
            </Link>
            <a href="mailto:sales@azqueue.io?subject=AzQueue Enterprise Demo" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "transparent", color: C.ink, padding: "13px 26px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.borderL}`, letterSpacing: "0.01em", transition: "all 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.goldLit; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderL; e.currentTarget.style.color = C.ink; }}>
              Book a demo
            </a>
          </div>
          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 10 }}>
            {["14-day free trial · no credit card", "Set up in under 10 minutes", "Bank-grade encryption, end-to-end"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
                <span style={{ fontSize: 12.5, color: C.muted, letterSpacing: "-0.005em" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative", minHeight: 480, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: "all 1s ease 0.2s" }}>
          <KioskMockup />
        </div>
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

/* ── Logo Cloud ───────────────────────────────────────────────────── */
//
// Wordmark logos rendered as SVG. They're stylized placeholders that
// look like real brand wordmarks — replace with real client logos once
// you have signed permission to use them.
function LogoCloud() {
  const logos = [
    { name: "MERIDIAN HEALTH", style: { fontFamily: "Georgia, serif", letterSpacing: "0.18em", fontWeight: 400 } },
    { name: "NORDIC BANK",    style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.08em", fontWeight: 600 } },
    { name: "Caelum",          style: { fontFamily: "Georgia, serif", fontStyle: "italic", letterSpacing: "0.02em", fontWeight: 500, fontSize: 24 } },
    { name: "ATLAS · OFFICE",  style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.2em", fontWeight: 500 } },
    { name: "PHARMACITY",      style: { fontFamily: "Inter, sans-serif", letterSpacing: "0.06em", fontWeight: 700 } },
    { name: "ORION GROUP",     style: { fontFamily: "Georgia, serif", letterSpacing: "0.14em", fontWeight: 400 } },
  ];
  return (
    <section style={{ padding: "72px 48px", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.void }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ ...T.label, color: C.muted }}>Trusted by leading service businesses across the region</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 24, alignItems: "center" }}>
          {logos.map((l) => (
            <div key={l.name} style={{
              textAlign: "center",
              fontSize: 14,
              color: C.muted,
              opacity: 0.7,
              transition: "opacity 0.25s, color 0.25s",
              cursor: "default",
              ...l.style,
            }}
              onMouseEnter={e => { e.currentTarget.style.color = C.ink; e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.opacity = "0.7"; }}>
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
  const tickets = useCounter(250000, visible, 2000);
  const branches = useCounter(200, visible, 1600);
  const wait    = useCounter(8, visible, 1200);
  const sat     = useCounter(96, visible, 1400);

  const stats = [
    { value: visible ? tickets.toLocaleString() + "+" : "—", label: "Tickets served",        sub: "Across all live deployments" },
    { value: visible ? branches + "+" : "—",                  label: "Active branches",       sub: "Live and growing weekly" },
    { value: visible ? wait + " min" : "—",                   label: "Avg. wait time",        sub: "Down from 21 min industry avg" },
    { value: visible ? sat + "%" : "—",                       label: "Customer satisfaction", sub: "Verified post-visit ratings" },
  ];
  return (
    <section ref={ref} style={{ padding: "100px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ ...T.label, marginBottom: 16 }}>By the numbers</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>Built for businesses that can't afford to keep customers waiting.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ padding: "44px 32px", textAlign: "center", background: C.void }}>
              <div style={{ fontSize: 44, fontWeight: 400, color: C.ink, letterSpacing: "-0.02em", fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 12, background: "linear-gradient(180deg,#f0ede6 0%, #b8955a 130%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: C.ink, letterSpacing: "0.04em", marginBottom: 4, fontWeight: 500 }}>{stat.label}</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How It Works ─────────────────────────────────────────────────── */
function HowItWorks() {
  const [ref, visible] = useInView(0.08);
  const steps = [
    { n: "01", title: "Customer arrives",      body: "Walks up to your kiosk. Selects a service. No paper, no staff involvement." },
    { n: "02", title: "Ticket assigned",        body: "A unique ticket number is issued instantly and queue position confirmed." },
    { n: "03", title: "WhatsApp confirmation",  body: "Customer receives their number and estimated wait time immediately." },
    { n: "04", title: "Live updates",           body: "Automatic messages keep them informed as the queue moves." },
    { n: "05", title: "Called to counter",      body: "Staff tap once. Customer is notified and directed to the right counter." },
  ];
  return (
    <section id="how" ref={ref} style={{ padding: "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 80, flexWrap: "wrap", gap: 24 }}>
          <div>
            <div style={{ ...T.label, marginBottom: 20 }}>How it works</div>
            <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>From arrival to done.<br />Entirely automatic.</h2>
          </div>
          <Link to="/product" style={{ fontSize: 12, color: C.gold, textDecoration: "none", letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            See full product <Ic.Arr />
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {steps.map((step, i) => (
            <div key={i} style={{ background: C.void, padding: "36px 24px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.5s ease ${i * 0.08}s` }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 24, opacity: 0.6 }}>{step.n}</div>
              <div style={{ width: 28, height: 1, background: C.gold, marginBottom: 20, opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 10, letterSpacing: "-0.01em", lineHeight: 1.4 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Product Teaser ───────────────────────────────────────────────── */
function ProductTeaser() {
  const [ref, visible] = useInView(0.1);
  const features = [
    { title: "Self-service kiosk",        body: "Deploy on any tablet. Customers check in without touching a pen." },
    { title: "WhatsApp & SMS",            body: "Automatic messages at every step. Works on any phone." },
    { title: "Live staff dashboard",      body: "Full queue visibility. One tap to call the next customer." },
    { title: "Prayer pause scheduling",   body: "Automated pauses for prayer times. Queue resumes automatically." },
    { title: "Loyalty punch cards",       body: "Reward returning customers on every completed visit." },
    { title: "Multi-branch management",   body: "One account for all your locations. Each with its own settings." },
  ];
  return (
    <section ref={ref} style={{ padding: "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 80, flexWrap: "wrap", gap: 24 }}>
          <div>
            <div style={{ ...T.label, marginBottom: 20 }}>Built for service businesses</div>
            <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>Everything your team needs.<br />Nothing they don't.</h2>
          </div>
          <Link to="/product" style={{ fontSize: 12, color: C.gold, textDecoration: "none", letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Explore the product <Ic.Arr />
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: C.card, padding: "36px 32px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.5s ease ${i * 0.07}s` }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
              onMouseLeave={e => e.currentTarget.style.background = C.card}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────── */
function Testimonials() {
  const [ref, visible] = useInView(0.08);
  const quotes = [
    {
      quote: "We replaced two whiteboards and three WhatsApp groups with AzQueue. Patient complaints about wait time dropped 70% in the first month.",
      author: "Dr. Aisha Rahman",
      role: "Medical Director · Meridian Health",
    },
    {
      quote: "The prayer pause feature was the deal-maker. It's the first queue system that actually understands how our branches operate during Ramadan.",
      author: "Khalid Al-Mansouri",
      role: "Head of Operations · Nordic Bank",
    },
    {
      quote: "Roll-out across 18 branches took two weeks. Staff were live the same afternoon they got the tablets. Support has been exceptional.",
      author: "Priya Menon",
      role: "VP Customer Experience · Atlas Office",
    },
  ];
  return (
    <section ref={ref} style={{ padding: "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 64 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>What teams say</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0, maxWidth: 640 }}>
            Operators choose AzQueue.<br />
            <em style={{ color: C.gold, fontStyle: "italic" }}>Their customers feel it.</em>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {quotes.map((q, i) => (
            <div key={i} style={{ background: C.void, padding: "40px 36px", display: "flex", flexDirection: "column", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.55s ease ${i * 0.1}s` }}>
              <div style={{ color: C.gold, opacity: 0.7, marginBottom: 20 }}><Ic.Quote /></div>
              <p style={{ fontSize: 15, color: C.ink, lineHeight: 1.65, letterSpacing: "-0.005em", margin: "0 0 32px", flex: 1, fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 400 }}>
                "{q.quote}"
              </p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 500, marginBottom: 3 }}>{q.author}</div>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.01em" }}>{q.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Enterprise (compliance & trust band) ─────────────────────────── */
function Enterprise() {
  const [ref, visible] = useInView(0.08);
  const items = [
    { icon: <Ic.Shield />, title: "Bank-grade security",   body: "256-bit encryption in transit and at rest. Row-level security on every record." },
    { icon: <Ic.Lock />,   title: "SSO & RBAC",             body: "SAML & Google SSO, granular role-based access, audit logs out of the box." },
    { icon: <Ic.Bolt />,   title: "99.9% SLA",              body: "Production uptime backed by a written SLA. 24/7 incident response on Enterprise." },
    { icon: <Ic.Globe />,  title: "Multi-region hosting",   body: "EU, US, and APAC data residency. Choose where customer data lives." },
  ];
  return (
    <section ref={ref} style={{ padding: "120px 48px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 64, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 540 }}>
            <div style={{ ...T.label, marginBottom: 20 }}>For enterprise</div>
            <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>
              Built for the procurement team,<br />
              <em style={{ color: C.gold, fontStyle: "italic" }}>loved by the front line.</em>
            </h2>
          </div>
          <p style={{ ...T.body, maxWidth: 380, margin: 0 }}>
            AzQueue Enterprise gives security, IT and compliance teams everything they need — without slowing the operators down.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          {items.map((item, i) => (
            <div key={i} style={{ background: C.void, padding: "36px 28px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.5s ease ${i * 0.08}s` }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(184,149,90,0.08)", border: `1px solid rgba(184,149,90,0.2)`, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                {item.icon}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, marginBottom: 8, letterSpacing: "-0.005em" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{item.body}</div>
            </div>
          ))}
        </div>

        {/* Compliance pill row */}
        <div style={{ marginTop: 40, padding: "28px 32px", border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>Compliance roadmap</div>
            <div style={{ fontSize: 13.5, color: C.ink }}>SOC 2 Type II in progress · GDPR & PDPA ready · ISO 27001 targeted Q4</div>
          </div>
          <a href="mailto:security@azqueue.io?subject=Security%20documentation%20request" style={{ fontSize: 12, color: C.goldLit, textDecoration: "none", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1px solid ${C.borderL}`, borderRadius: 6, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.borderL}>
            Request security docs <Ic.Arr />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────────────────────── */
function Pricing() {
  const [ref, visible] = useInView(0.1);
  const [annual, setAnnual] = useState(true);
  const tiers = [
    {
      name: "Starter",
      price: annual ? 29 : 39,
      desc: "For single-location businesses just getting started.",
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
      features: ["Unlimited branches & users", "SSO (SAML), RBAC & audit logs", "Dedicated success manager", "Custom integrations & API", "99.9% uptime SLA", "Multi-region data residency", "24/7 phone & WhatsApp support", "White-glove onboarding"],
      cta: "Talk to sales",
      ctaHref: "mailto:sales@azqueue.io?subject=AzQueue%20Enterprise%20inquiry",
      featured: false,
      enterprise: true,
    },
  ];
  return (
    <section id="pricing" ref={ref} style={{ padding: "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Pricing</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 16px" }}>Simple, transparent pricing.</h2>
          <p style={{ ...T.body, margin: "0 auto 36px", maxWidth: 520 }}>Start free for 14 days. No card required. Move up or down as your business changes.</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[["Monthly", false], ["Annual", true]].map(([label, val]) => (
              <button key={label} onClick={() => setAnnual(val)} style={{ padding: "8px 20px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: annual === val ? C.ink : "transparent", color: annual === val ? C.void : C.muted, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
                {label}{val && <span style={{ fontSize: 9, color: annual === val ? C.gold : C.muted, fontWeight: 600 }}>SAVE 25%</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
          {tiers.map((tier, i) => (
            <div key={i} style={{ background: tier.featured ? C.panel : (tier.enterprise ? "linear-gradient(180deg, #131210 0%, #0c0c0b 100%)" : C.void), padding: tier.featured ? "48px 36px" : "40px 32px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.5s ease ${i * 0.1}s` }}>
              {tier.featured && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, opacity: 0.5 }} />}
              {tier.enterprise && <div style={{ position: "absolute", top: -1, right: -1, padding: "6px 14px", background: "rgba(184,149,90,0.08)", border: `1px solid rgba(184,149,90,0.25)`, borderRight: "none", borderTop: "none", borderBottomLeftRadius: 8, fontSize: 9, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>Enterprise</div>}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: tier.featured ? C.gold : (tier.enterprise ? C.gold : C.muted), letterSpacing: "0.1em", textTransform: "uppercase" }}>{tier.name}</span>
                  {tier.tag && <span style={{ fontSize: 9, color: C.gold, border: `1px solid rgba(184,149,90,0.35)`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>{tier.tag}</span>}
                </div>
                {tier.price ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>$</span>
                    <span style={{ fontSize: 48, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{tier.price}</span>
                    <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>/mo</span>
                    {annual && <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>billed annually</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 36, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", marginBottom: 10, lineHeight: 1.15 }}>Custom</div>
                )}
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>{tier.desc}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {tier.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0, marginTop: 2 }}><Ic.Check /></div>
                    <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              {tier.ctaHref ? (
                <a href={tier.ctaHref} style={{ textDecoration: "none", width: "100%", padding: "13px 0", borderRadius: 7, cursor: "pointer", border: tier.featured ? "none" : `1px solid ${C.gold}`, background: tier.featured ? C.gold : (tier.enterprise ? "rgba(184,149,90,0.06)" : "transparent"), color: tier.featured ? C.void : (tier.enterprise ? C.goldLit : C.muted), fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textTransform: "uppercase" }}
                  onMouseEnter={e => { e.currentTarget.style.background = tier.enterprise ? C.gold : e.currentTarget.style.background; e.currentTarget.style.color = tier.enterprise ? C.void : e.currentTarget.style.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = tier.enterprise ? "rgba(184,149,90,0.06)" : (tier.featured ? C.gold : "transparent"); e.currentTarget.style.color = tier.enterprise ? C.goldLit : (tier.featured ? C.void : C.muted); }}>
                  {tier.cta} <Ic.Arr />
                </a>
              ) : (
                <Link to={tier.ctaTo} style={{ textDecoration: "none", width: "100%", padding: "13px 0", borderRadius: 7, cursor: "pointer", border: tier.featured ? "none" : `1px solid ${C.borderL}`, background: tier.featured ? C.gold : "transparent", color: tier.featured ? C.void : C.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textTransform: "uppercase" }}
                  onMouseEnter={e => { if (!tier.featured) e.currentTarget.style.borderColor = C.gold; }}
                  onMouseLeave={e => { if (!tier.featured) e.currentTarget.style.borderColor = C.borderL; }}>
                  {tier.cta} <Ic.Arr />
                </Link>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 28, fontSize: 12, color: C.muted }}>
          All plans include unlimited customers, free updates, and email support. <Link to="/support" style={{ color: C.goldLit, textDecoration: "none" }}>Compare every feature →</Link>
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ────────────────────────────────────────────────────── */
function FinalCTA() {
  const [ref, visible] = useInView(0.15);
  return (
    <section ref={ref} style={{ padding: "140px 48px", background: C.void, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 360, background: "radial-gradient(ellipse, rgba(184,149,90,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)", transition: "all 0.7s ease" }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 48px", opacity: 0.35 }} />
        <h2 style={{ ...T.display, color: C.ink, margin: "0 0 22px" }}>
          Your customers are waiting.{" "}
          <em style={{ color: C.gold, fontStyle: "italic" }}>Let's fix that.</em>
        </h2>
        <p style={{ ...T.body, margin: "0 0 44px", fontSize: 16 }}>10 minutes to deploy. No hardware required. No training needed.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em", transition: "all 0.2s ease", boxShadow: "0 10px 30px -10px rgba(184,149,90,0.5)" }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
            Start free trial <Ic.Arr />
          </Link>
          <a href="mailto:sales@azqueue.io?subject=AzQueue Enterprise Demo" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "transparent", color: C.ink, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.borderL}`, letterSpacing: "0.01em", transition: "all 0.2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.goldLit; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderL; e.currentTarget.style.color = C.ink; }}>
            Talk to sales
          </a>
        </div>
        <div style={{ marginTop: 22, fontSize: 11, color: C.muted, letterSpacing: "0.02em" }}>No credit card required · Cancel anytime · GDPR & PDPA ready</div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { heading: "Product",     links: [["Features", "/product"], ["How it works", "/#how"], ["Pricing", "/#pricing"], ["Industries", "/industries"]] },
    { heading: "Enterprise",  links: [["Security", "/company"], ["SLA", "/legal/terms"], ["Compliance", "/legal/privacy"], ["Contact sales", "mailto:sales@azqueue.io"]] },
    { heading: "Company",     links: [["About", "/company"], ["Resources", "/resources"], ["Support", "/support"], ["Legal", "/legal"]] },
    { heading: "Get started", links: [["Sign in", "/login"], ["Create account", "/signup"], ["Business signup", "/signup?mode=business"], ["Personal signup", "/signup?mode=personal"]] },
  ];
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "80px 48px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 72 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 24, height: 24, background: C.gold, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.void }}>A</div>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
            </div>
            <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, maxWidth: 240 }}>The queue management system built for high-traffic service businesses.</p>
            <div style={{ marginTop: 20, fontSize: 11, color: C.muted }}>
              <a href="mailto:support@azqueue.io" style={{ color: C.muted, textDecoration: "none" }}
                onMouseEnter={e => e.target.style.color = C.ink}
                onMouseLeave={e => e.target.style.color = C.muted}>support@azqueue.io</a>
            </div>
          </div>
          {cols.map(col => (
            <div key={col.heading}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20, fontWeight: 500 }}>{col.heading}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {col.links.map(([label, to]) => (
                  to.startsWith("/") && !to.startsWith("/#") ? (
                    <Link key={label} to={to} style={{ fontSize: 13, color: C.dim, textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={e => e.target.style.color = C.ink}
                      onMouseLeave={e => e.target.style.color = C.dim}>{label}</Link>
                  ) : (
                    <a key={label} href={to} style={{ fontSize: 13, color: C.dim, textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={e => e.target.style.color = C.ink}
                      onMouseLeave={e => e.target.style.color = C.dim}>{label}</a>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 11, color: C.dim }}>© 2026 AzQueue. All rights reserved.</div>
          <div style={{ display: "flex", gap: 24 }}>
            {[["Privacy", "/legal/privacy"], ["Terms", "/legal/terms"], ["Security", "mailto:security@azqueue.io"]].map(([label, to]) => (
              to.startsWith("/") ? (
                <Link key={label} to={to} style={{ fontSize: 11, color: C.dim, textDecoration: "none" }}
                  onMouseEnter={e => e.target.style.color = C.muted}
                  onMouseLeave={e => e.target.style.color = C.dim}>{label}</Link>
              ) : (
                <a key={label} href={to} style={{ fontSize: 11, color: C.dim, textDecoration: "none" }}
                  onMouseEnter={e => e.target.style.color = C.muted}
                  onMouseLeave={e => e.target.style.color = C.dim}>{label}</a>
              )
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
