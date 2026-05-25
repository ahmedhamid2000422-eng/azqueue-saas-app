import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/*
 * AzQueue Landing — Refined edition
 * Aesthetic reference: Amex · Stripe · Linear
 * Restrained · Spacious · Typographically precise
 */

/* ── Palette ── */
const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  muted:  "#60605a",
  faint:  "#2a2926",
  border: "rgba(255,255,255,0.07)",
  card:   "#0c0c0b",
  panel:  "#111110",
  live:   "#4ade80",
  dim:    "#3a3835",
};

/* ── Type scale ── */
const T = {
  display: { fontSize: 46, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.1, fontFamily: "Georgia, 'Times New Roman', serif" },
  h2:      { fontSize: 34, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.15, fontFamily: "Georgia, 'Times New Roman', serif" },
  h3:      { fontSize: 24, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.25, fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold },
  body:    { fontSize: 15, fontWeight: 400, lineHeight: 1.7, letterSpacing: "-0.005em", color: C.muted },
  small:   { fontSize: 12, fontWeight: 400, lineHeight: 1.6, color: C.muted },
};

/* ── Hooks ── */
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

/* ── SVG Icons (minimal, 1.5px stroke) ── */
const Ic = {
  Queue:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/></svg>,
  Msg:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Moon:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Star:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Chart:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Branch: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Check:  () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Arr:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
};

const WaIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

/* ═══════════════════════════════════════════
   ROOT
═══════════════════════════════════════════ */
export default function Landing() {
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <Nav />
      <Hero />
      <TrustBar />
      <StatRow />
      <HowItWorks />
      <ProductShowcase />
      <FeaturesGrid />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════
   NAV
═══════════════════════════════════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: 58, padding: "0 40px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: scrolled ? "rgba(8,8,7,0.9)" : "transparent",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      transition: "all 0.4s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 22, height: 22, background: C.gold, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.void }}>A</div>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {[["#how", "How it works"], ["#features", "Features"], ["#pricing", "Pricing"]].map(([href, label]) => (
          <a key={label} href={href} style={{ fontSize: 13, fontWeight: 400, color: C.muted, textDecoration: "none", letterSpacing: "-0.005em", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color = C.ink}
            onMouseLeave={e => e.target.style.color = C.muted}>{label}</a>
        ))}
        <Link to="/login" style={{ fontSize: 13, fontWeight: 500, color: C.ink, textDecoration: "none", padding: "6px 16px", border: `1px solid ${C.border}`, borderRadius: 6, letterSpacing: "-0.005em", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.dim; e.currentTarget.style.color = C.ink; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}>
          Sign in
        </Link>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════
   HERO
═══════════════════════════════════════════ */
function Hero() {
  const [ref, visible] = useInView(0.05);

  return (
    <section ref={ref} style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      padding: "120px 40px 100px", position: "relative", overflow: "hidden",
    }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        maskImage: "radial-gradient(ellipse 70% 80% at 60% 40%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 60% 40%, black 30%, transparent 100%)",
      }} />
      {/* Ambient glow — very subtle */}
      <div style={{ position: "absolute", top: "35%", left: "58%", transform: "translate(-50%,-50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,149,90,0.04) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: 1160, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 100, position: "relative", zIndex: 1 }}>

        {/* Left */}
        <div style={{ flex: "0 0 460px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)", transition: "all 0.8s ease" }}>
          <div style={{ ...T.label, marginBottom: 32, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.live }} />
            Early access open
          </div>

          <h1 style={{ ...T.display, color: C.ink, margin: "0 0 22px", maxWidth: 420 }}>
            The queue system your customers{" "}
            <em style={{ color: C.gold, fontStyle: "italic" }}>actually enjoy.</em>
          </h1>

          <p style={{ ...T.body, margin: "0 0 44px", maxWidth: 380, fontSize: 16 }}>
            Replace paper sign-in sheets with a smart kiosk, real-time WhatsApp updates, and a live staff dashboard.
          </p>

          <Link to="/register" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: C.gold, color: C.void,
            padding: "12px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            textDecoration: "none", letterSpacing: "0.01em",
            transition: "all 0.2s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
            Request early access
            <Ic.Arr />
          </Link>

          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 10 }}>
            {["WhatsApp & SMS notification ready", "Set up in under 10 minutes", "Supports prayer pause scheduling"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}>
                  <Ic.Check />
                </div>
                <span style={{ fontSize: 12.5, color: C.muted, letterSpacing: "-0.005em" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — product visual */}
        <div style={{
          flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
          position: "relative", minHeight: 480,
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
          transition: "all 1s ease 0.2s",
        }}>
          <KioskMockup />
        </div>
      </div>
    </section>
  );
}

/* ── Kiosk Mockup ── */
function KioskMockup() {
  const [selected, setSelected] = useState(0);
  const services = ["General Consultation", "Lab Results", "Pharmacy", "Specialist"];

  return (
    <div style={{ position: "relative" }}>
      {/* iPad frame */}
      <div style={{
        width: 272, height: 388,
        background: "linear-gradient(160deg, #1e1d1b, #141311)",
        borderRadius: 26, border: "1px solid #252320",
        padding: "10px 10px 22px",
        boxShadow: "0 48px 80px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(255,255,255,0.04)",
      }}>
        <div style={{ width: 40, height: 3, background: "#1e1d1b", borderRadius: 2, margin: "0 auto 8px" }} />
        {/* Screen */}
        <div style={{ width: "100%", height: "calc(100% - 11px)", background: "#f4f1eb", borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ background: C.void, padding: "18px 20px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 8, color: C.dim, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>City Clinic · Al Barsha</div>
            <div style={{ fontSize: 38, fontWeight: 500, color: C.gold, fontFamily: "Georgia, serif", letterSpacing: "0.02em", lineHeight: 1 }}>A 42</div>
            <div style={{ fontSize: 7.5, color: C.muted, marginTop: 6 }}>3 ahead · estimated 8 min</div>
          </div>
          {/* Services */}
          <div style={{ padding: "14px 14px 0", flex: 1 }}>
            <div style={{ fontSize: 7, color: "#9a9890", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 9 }}>Select service</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {services.map((s, i) => (
                <button key={i} onClick={() => setSelected(i)} style={{
                  padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer", textAlign: "left",
                  background: i === selected ? C.gold : "#ebe7de",
                  color: i === selected ? C.void : "#5a5754",
                  fontSize: 8.5, fontWeight: i === selected ? 600 : 400,
                  transition: "all 0.15s",
                }}>{s}</button>
              ))}
            </div>
          </div>
          {/* CTA */}
          <div style={{ padding: "10px 14px 14px" }}>
            <div style={{ background: C.void, borderRadius: 7, padding: "9px 0", textAlign: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 600, color: C.gold, letterSpacing: "0.12em", textTransform: "uppercase" }}>Confirm check-in</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 6, fontSize: 7, color: "#9a9890" }}>Updates sent via WhatsApp</div>
          </div>
        </div>
      </div>

      {/* WhatsApp card — static, no bounce */}
      <div style={{
        position: "absolute", right: -148, top: 48,
        background: "#fff", borderRadius: 12, padding: "11px 14px", width: 200,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, paddingBottom: 7, borderBottom: "1px solid #f0ede6" }}>
          <div style={{ width: 24, height: 24, background: "#25D366", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><WaIcon /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: "#111", lineHeight: 1 }}>AzQueue</div>
            <div style={{ fontSize: 8, color: "#9a9890", marginTop: 1 }}>WhatsApp notification</div>
          </div>
          <div style={{ fontSize: 7.5, color: "#bbb" }}>now</div>
        </div>
        <div style={{ fontSize: 10, color: "#3a3835", lineHeight: 1.5 }}>
          City Clinic: You're next — Ticket <strong>A42</strong>. Please proceed to the counter.
        </div>
      </div>

      {/* Queue chip */}
      <div style={{
        position: "absolute", left: -148, bottom: 60,
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", width: 164,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: 7.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Live queue</div>
        {[
          { token: "A 40", name: "Mohammed A.", status: "serving" },
          { token: "A 41", name: "Fatima H.",   status: "waiting" },
          { token: "A 42", name: "Sara A.",      status: "waiting" },
        ].map(row => (
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

/* ═══════════════════════════════════════════
   TRUST BAR
═══════════════════════════════════════════ */
function TrustBar() {
  const items = ["Clinics", "Government offices", "Service centers", "Pharmacies", "Banks", "Hospitals", "High-traffic environments", "Prayer-aware scheduling", "Multi-branch operations", "WhatsApp & SMS ready"];
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "14px 0", overflow: "hidden" }}>
      <style>{`@keyframes tick { from{transform:translateX(0)} to{transform:translateX(-50%)} }`}</style>
      <div style={{ display: "flex", animation: "tick 32s linear infinite", width: "max-content" }}>
        {[...items, ...items].map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 48, whiteSpace: "nowrap" }}>
            <div style={{ width: 2, height: 2, borderRadius: 1, background: C.gold, opacity: 0.6 }} />
            <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.03em" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STAT ROW
═══════════════════════════════════════════ */
function StatRow() {
  const [ref, visible] = useInView();
  const tickets = useCounter(50000, visible, 2000);
  const mins    = useCounter(8, visible, 1200);
  const langs   = useCounter(6, visible, 900);

  return (
    <section ref={ref} style={{ padding: "80px 40px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr 1px 1fr", alignItems: "center", gap: 0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          {[
            { value: visible ? tickets.toLocaleString() + "+" : "—", label: "Tickets served" },
            { value: visible ? mins + " min" : "—",                  label: "Average wait time" },
            { value: visible ? langs : "—",                           label: "Languages supported" },
          ].reduce((acc, stat, i) => {
            if (i > 0) acc.push(<div key={`div${i}`} style={{ width: 1, height: 60, background: C.border, alignSelf: "center" }} />);
            acc.push(
              <div key={stat.label} style={{ padding: "40px 48px", textAlign: "center" }}>
                <div style={{ fontSize: 38, fontWeight: 400, color: C.ink, letterSpacing: "-0.02em", fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 8 }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>{stat.label}</div>
              </div>
            );
            return acc;
          }, [])}
          <div style={{ width: 1, height: 60, background: C.border, alignSelf: "center" }} />
          {/* Live pill */}
          <div style={{ padding: "40px 40px", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.live }} />
              <span style={{ fontSize: 13, color: C.ink, fontWeight: 400 }}>System live</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6, letterSpacing: "0.02em" }}>Updated continuously</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   HOW IT WORKS
═══════════════════════════════════════════ */
function HowItWorks() {
  const [ref, visible] = useInView(0.08);
  const steps = [
    { n: "01", title: "Customer arrives",       body: "Walks up to your branded kiosk. Selects a service. No paper, no staff involvement." },
    { n: "02", title: "Ticket assigned",         body: "A unique ticket number is issued instantly. Queue position is confirmed." },
    { n: "03", title: "WhatsApp confirmation",   body: "The customer receives their number and an estimated wait time on WhatsApp." },
    { n: "04", title: "Live position updates",   body: "Automatic messages keep them informed as the queue moves." },
    { n: "05", title: "Called to counter",       body: "Staff tap once on the dashboard. Customer is notified immediately." },
  ];

  return (
    <section id="how" ref={ref} style={{ padding: "120px 40px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 80 }}>
          <div>
            <div style={{ ...T.label, marginBottom: 20 }}>How it works</div>
            <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>
              From arrival to done.<br />Entirely automatic.
            </h2>
          </div>
          <Link to="/register" style={{ fontSize: 12, color: C.gold, textDecoration: "none", letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Get started <Ic.Arr />
          </Link>
        </div>

        {/* Steps */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              background: C.void, padding: "36px 24px",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)",
              transition: `all 0.5s ease ${i * 0.08}s`,
            }}>
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

/* ═══════════════════════════════════════════
   PRODUCT SHOWCASE
═══════════════════════════════════════════ */
function ProductShowcase() {
  return (
    <>
      <KioskSection />
      <DashboardSection />
      <WhatsAppSection />
    </>
  );
}

function KioskSection() {
  const [ref, visible] = useInView(0.1);
  return (
    <section ref={ref} style={{ padding: "120px 40px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 100 }}>
        <div style={{ flex: 1, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-16px)", transition: "all 0.7s ease" }}>
          <KioskScreenFull />
        </div>
        <div style={{ flex: "0 0 360px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(16px)", transition: "all 0.7s ease 0.1s" }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Self-service kiosk</div>
          <h3 style={{ ...T.h3, color: C.ink, margin: "0 0 18px" }}>Check in under 30 seconds. No app required.</h3>
          <p style={{ ...T.body, margin: "0 0 32px" }}>Deploy on any tablet. Your brand, your colors. Customers tap their service, enter their number, and get a ticket instantly.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["Compatible with any Android or iPad tablet", "Arabic, English, and 4 additional languages", "Configurable per branch and service type"].map(t => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0, marginTop: 1 }}><Ic.Check /></div>
                <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function KioskScreenFull() {
  return (
    <div style={{ position: "relative", maxWidth: 440 }}>
      <div style={{ background: "linear-gradient(150deg, #1c1b19, #131210)", borderRadius: 22, border: "1px solid #222120", padding: "4px 4px 18px", boxShadow: "0 32px 64px rgba(0,0,0,0.55)" }}>
        <div style={{ borderRadius: 19, overflow: "hidden", background: "#f3f0ea" }}>
          <div style={{ background: C.void, padding: "24px 28px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>Al Noor Medical Center</div>
            <div style={{ fontSize: 48, fontWeight: 400, color: C.gold, fontFamily: "Georgia, serif", letterSpacing: "0.03em", lineHeight: 1 }}>A 43</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>2 ahead · estimated 6 minutes</div>
          </div>
          <div style={{ padding: "22px 24px" }}>
            <div style={{ fontSize: 8.5, color: "#9a9890", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Choose your service</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["General", true], ["Specialist", false], ["Lab Results", false], ["Pharmacy", false]].map(([s, active]) => (
                <div key={s} style={{ padding: "14px 12px", borderRadius: 9, background: active ? C.gold : "#e8e4da", color: active ? C.void : "#5a5754", fontSize: 11, fontWeight: active ? 600 : 400, textAlign: "center" }}>{s}</div>
              ))}
            </div>
            <div style={{ marginTop: 16, background: C.void, borderRadius: 9, padding: "13px 0", textAlign: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>Confirm check-in</span>
            </div>
          </div>
        </div>
        <div style={{ height: 3, background: "#1a1917", borderRadius: 2, margin: "8px 56px 0" }} />
      </div>
    </div>
  );
}

function DashboardSection() {
  const [ref, visible] = useInView(0.1);
  const rows = [
    { token: "A 40", name: "Mohammed Al-Farsi",  service: "General",    wait: "12m", status: "serving" },
    { token: "A 41", name: "Fatima Hassan",       service: "Lab",        wait: "18m", status: "waiting" },
    { token: "A 42", name: "Sara Al-Amin",        service: "Pharmacy",   wait: "22m", status: "waiting" },
    { token: "A 43", name: "Ahmed Khalil",        service: "General",    wait: "27m", status: "waiting" },
    { token: "A 44", name: "Noura Bint Rashid",   service: "Specialist", wait: "31m", status: "waiting" },
  ];

  return (
    <section ref={ref} style={{ padding: "120px 40px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 100 }}>
        <div style={{ flex: "0 0 360px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-16px)", transition: "all 0.7s ease" }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Staff dashboard</div>
          <h3 style={{ ...T.h3, color: C.ink, margin: "0 0 18px" }}>Complete queue visibility from one screen.</h3>
          <p style={{ ...T.body, margin: "0 0 32px" }}>See every ticket, call the next customer, track wait times, and manage your team — all updated in real time.</p>
          {["One-tap call to next in line", "Live wait time tracking per customer", "Prayer pause with automatic resume", "Satisfaction score collection on completion"].map(t => (
            <div key={t} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
              <span style={{ fontSize: 13, color: C.muted }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(16px)", transition: "all 0.7s ease 0.1s" }}>
          {/* Dashboard */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 48px rgba(0,0,0,0.45)" }}>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.live }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>Queue Dashboard</span>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                {[["Serving", "A 40", C.gold], ["In queue", "5", C.ink], ["Avg wait", "22m", C.ink]].map(([l, v, col]) => (
                  <span key={l} style={{ fontSize: 11, color: C.muted }}>{l}: <strong style={{ color: col, fontWeight: 500 }}>{v}</strong></span>
                ))}
              </div>
            </div>
            <div style={{ padding: "8px 20px", display: "grid", gridTemplateColumns: "60px 1fr 90px 52px 88px", gap: 12, borderBottom: `1px solid ${C.border}` }}>
              {["Ticket", "Customer", "Service", "Wait", "Status"].map(h => (
                <div key={h} style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {rows.map((r, i) => (
              <div key={i} style={{
                padding: "11px 20px", display: "grid", gridTemplateColumns: "60px 1fr 90px 52px 88px", gap: 12, alignItems: "center",
                borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
                background: r.status === "serving" ? "rgba(74,222,128,0.02)" : "transparent",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: r.status === "serving" ? C.gold : C.ink, fontFamily: "monospace" }}>{r.token}</div>
                <div style={{ fontSize: 12, color: r.status === "serving" ? C.ink : C.muted }}>{r.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{r.service}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{r.wait}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: r.status === "serving" ? C.live : C.faint }} />
                  <span style={{ fontSize: 11, color: r.status === "serving" ? C.live : C.muted, textTransform: "capitalize" }}>{r.status}</span>
                </div>
              </div>
            ))}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
              <button style={{ background: C.gold, color: C.void, border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Call next</button>
              <button style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>Prayer pause</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsAppSection() {
  const [ref, visible] = useInView(0.1);
  const msgs = [
    { from: "sys", text: "Al Noor Clinic: You're checked in. Ticket A42 for General Consultation. We'll notify you when you're next.", time: "10:22" },
    { from: "cus", text: "How many people ahead of me?", time: "10:31" },
    { from: "sys", text: "Al Noor Clinic: 2 people ahead. Estimated wait: 8 minutes.", time: "10:31" },
    { from: "sys", text: "Al Noor Clinic: You're next. Please proceed to counter 3. Ticket A42.", time: "10:39" },
    { from: "sys", text: "Al Noor Clinic: Thank you for visiting. We hope to see you soon.", time: "10:52" },
  ];

  return (
    <section ref={ref} style={{ padding: "120px 40px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 100 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-16px)", transition: "all 0.7s ease" }}>
          <div style={{ background: "#0b130e", border: "1px solid #1a2119", borderRadius: 18, overflow: "hidden", width: 340, boxShadow: "0 20px 48px rgba(0,0,0,0.4)" }}>
            <div style={{ background: "#075E54", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, background: C.gold, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: C.void }}>A</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>AzQueue · Al Noor Clinic</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.65)" }}>Official business account</div>
              </div>
            </div>
            <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.from === "cus" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", padding: "8px 11px", borderRadius: m.from === "cus" ? "11px 11px 2px 11px" : "11px 11px 11px 2px", background: m.from === "cus" ? "#005C4B" : "#1e2b20", fontSize: 11, color: "rgba(255,255,255,0.88)", lineHeight: 1.5 }}>
                    {m.text}
                    <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.3)", marginTop: 3, textAlign: "right" }}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ flex: "0 0 380px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(16px)", transition: "all 0.7s ease 0.1s" }}>
          <div style={{ ...T.label, marginBottom: 20 }}>WhatsApp & SMS</div>
          <h3 style={{ ...T.h3, color: C.ink, margin: "0 0 18px" }}>Every customer, always informed.</h3>
          <p style={{ ...T.body, margin: "0 0 32px" }}>Automatic messages at every stage of their visit. No app download. No registration. Works on any phone.</p>
          {["Confirmation on check-in", "Alert when called to counter", "Thank-you on completion", "Prayer pause notice with resume time"].map(t => (
            <div key={t} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
              <span style={{ fontSize: 13, color: C.muted }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FEATURES GRID
═══════════════════════════════════════════ */
function FeaturesGrid() {
  const [ref, visible] = useInView(0.08);

  const features = [
    {
      icon: <Ic.Queue />, title: "Smart queue management",
      desc: "Auto-assign tickets, track wait times, and serve customers in order.",
      mini: (
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {["A40", "A41", "A42"].map((t, i) => (
            <div key={t} style={{ flex: 1, background: i === 0 ? "rgba(184,149,90,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 ? "rgba(184,149,90,0.2)" : C.border}`, borderRadius: 5, padding: "5px 0", textAlign: "center", fontSize: 8.5, fontWeight: 600, color: i === 0 ? C.gold : C.muted, fontFamily: "monospace" }}>{t}</div>
          ))}
        </div>
      ),
    },
    {
      icon: <Ic.Msg />, title: "WhatsApp & SMS",
      desc: "Instant notifications at check-in, when called, and after service.",
      mini: (
        <div style={{ marginTop: 14, background: "#0b130e", borderRadius: 7, padding: "8px 10px" }}>
          <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>AzQueue · just now</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", lineHeight: 1.45 }}>You're next — Ticket A42, counter 3.</div>
        </div>
      ),
    },
    {
      icon: <Ic.Moon />, title: "Prayer pause",
      desc: "Scheduled pauses for prayer times. Queue resumes automatically.",
      mini: (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 2, background: C.faint, borderRadius: 1 }} />
          <span style={{ fontSize: 9, color: C.gold, fontWeight: 500 }}>Paused · Asr</span>
        </div>
      ),
    },
    {
      icon: <Ic.Star />, title: "Loyalty punch cards",
      desc: "Reward returning customers. A punch earned on every completed visit.",
      mini: (
        <div style={{ marginTop: 14, display: "flex", gap: 4 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: i < 5 ? C.gold : "transparent", border: `1px solid ${i < 5 ? "transparent" : C.faint}` }} />
          ))}
        </div>
      ),
    },
    {
      icon: <Ic.Chart />, title: "Analytics & insights",
      desc: "Peak hours, wait time trends, and service performance in real time.",
      mini: (
        <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", gap: 3, height: 24 }}>
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 5 ? C.gold : "rgba(184,149,90,0.15)", borderRadius: "2px 2px 0 0" }} />
          ))}
        </div>
      ),
    },
    {
      icon: <Ic.Branch />, title: "Multi-branch",
      desc: "One account, many locations. Each branch with its own configuration.",
      mini: (
        <div style={{ marginTop: 14, display: "flex", gap: 5 }}>
          {["Main", "North", "Mall"].map(b => (
            <div key={b} style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 0", textAlign: "center", fontSize: 8, color: C.muted }}>{b}</div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section id="features" ref={ref} style={{ padding: "120px 40px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 72 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Features</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>
            Everything you need.<br />Nothing you don't.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: C.void, padding: "32px 28px",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)",
              transition: `all 0.5s ease ${i * 0.06}s`,
              cursor: "default",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0d0d0c"}
              onMouseLeave={e => e.currentTarget.style.background = C.void}>
              <div style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, marginBottom: 18 }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 7, letterSpacing: "-0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
              {f.mini}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   PRICING
═══════════════════════════════════════════ */
function Pricing() {
  const [ref, visible] = useInView(0.1);
  const [annual, setAnnual] = useState(false);

  const tiers = [
    {
      name: "Starter",
      price: annual ? 29 : 39,
      desc: "For single-location businesses.",
      features: ["1 branch", "1 kiosk terminal", "WhatsApp notifications", "Basic analytics", "Email support"],
      cta: "Get started",
      featured: false,
    },
    {
      name: "Growth",
      price: annual ? 79 : 99,
      desc: "For businesses ready to scale.",
      features: ["Up to 5 branches", "Unlimited kiosks", "WhatsApp & SMS", "Loyalty punch cards", "Prayer pause scheduling", "Advanced analytics", "Priority support"],
      cta: "Request early access",
      featured: true,
    },
    {
      name: "Enterprise",
      price: null,
      desc: "For large networks and government.",
      features: ["Unlimited branches", "Custom integrations", "Dedicated onboarding", "SLA guarantee", "Multilingual UI", "24/7 support"],
      cta: "Contact us",
      featured: false,
    },
  ];

  return (
    <section id="pricing" ref={ref} style={{ padding: "120px 40px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Pricing</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 36px" }}>Simple, transparent pricing.</h2>
          {/* Toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[["Monthly", false], ["Annual", true]].map(([label, val]) => (
              <button key={label} onClick={() => setAnnual(val)} style={{
                padding: "7px 18px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                background: annual === val ? C.ink : "transparent",
                color: annual === val ? C.void : C.muted,
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {label}
                {val && <span style={{ fontSize: 9, color: annual ? C.gold : C.muted, fontWeight: 600 }}>–25%</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden", alignItems: "stretch" }}>
          {tiers.map((tier, i) => (
            <div key={i} style={{
              background: tier.featured ? C.panel : C.void,
              padding: "40px 32px",
              display: "flex", flexDirection: "column",
              position: "relative", overflow: "hidden",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)",
              transition: `all 0.5s ease ${i * 0.1}s`,
            }}>
              {tier.featured && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: C.gold, opacity: 0.4 }} />
              )}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: tier.featured ? C.gold : C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tier.name}</span>
                  {tier.featured && <span style={{ fontSize: 9, color: C.gold, border: `1px solid rgba(184,149,90,0.3)`, borderRadius: 4, padding: "2px 7px", letterSpacing: "0.08em" }}>Popular</span>}
                </div>
                {tier.price ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>$</span>
                    <span style={{ fontSize: 44, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{tier.price}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>/mo</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 36, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", marginBottom: 8, lineHeight: 1.15 }}>Custom</div>
                )}
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{tier.desc}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, marginBottom: 28 }}>
                {tier.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 9, alignItems: "center" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Ic.Check /></div>
                    <span style={{ fontSize: 12.5, color: C.muted }}>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{
                width: "100%", padding: "11px 0", borderRadius: 7, cursor: "pointer",
                border: tier.featured ? "none" : `1px solid ${C.border}`,
                background: tier.featured ? C.gold : "transparent",
                color: tier.featured ? C.void : C.muted,
                fontSize: 12, fontWeight: 600, letterSpacing: "0.01em",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.82"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FINAL CTA
═══════════════════════════════════════════ */
function FinalCTA() {
  const [ref, visible] = useInView(0.15);
  return (
    <section ref={ref} style={{ padding: "140px 40px", background: C.card, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(184,149,90,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{
        maxWidth: 600, margin: "0 auto", textAlign: "center",
        position: "relative", zIndex: 1,
        opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)",
        transition: "all 0.7s ease",
      }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 48px", opacity: 0.35 }} />
        <h2 style={{ ...T.display, color: C.ink, margin: "0 0 20px" }}>
          Your customers are waiting.{" "}
          <em style={{ color: C.gold, fontStyle: "italic" }}>Let's fix that.</em>
        </h2>
        <p style={{ ...T.body, margin: "0 0 48px", fontSize: 16 }}>
          10 minutes to deploy. No hardware required. No training needed.
        </p>
        <Link to="/register" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: C.gold, color: C.void,
          padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          textDecoration: "none", letterSpacing: "0.01em",
          transition: "all 0.2s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
          Request early access
          <Ic.Arr />
        </Link>
        <div style={{ marginTop: 18, fontSize: 11, color: C.muted, letterSpacing: "0.02em" }}>No credit card required · Cancel any time</div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════ */
function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "36px 40px", background: C.void }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, background: C.gold, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: C.void }}>A</div>
          <span style={{ fontSize: 12, color: C.dim, letterSpacing: "-0.005em" }}>AzQueue · azqueue.io</span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {[["mailto:support@azqueue.io", "Support"], ["#pricing", "Pricing"], ["/login", "Sign in"]].map(([href, label]) => (
            href.startsWith("/") ? (
              <Link key={label} to={href} style={{ fontSize: 12, color: C.muted, textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = C.ink}
                onMouseLeave={e => e.target.style.color = C.muted}>{label}</Link>
            ) : (
              <a key={label} href={href} style={{ fontSize: 12, color: C.muted, textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = C.ink}
                onMouseLeave={e => e.target.style.color = C.muted}>{label}</a>
            )
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#252320" }}>© 2025 AzQueue. All rights reserved.</div>
      </div>
    </footer>
  );
}
