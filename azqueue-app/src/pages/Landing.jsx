import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────────────────────────
   AzQueue Landing — Premium Rebuild v2
   Dark · Gold · Precise · Spacious
   No emojis · Inline SVGs · Single CTA
───────────────────────────────────────────── */

/* ── Palette ── */
const C = {
  void:    "#080807",
  ink:     "#f0ede6",
  gold:    "#c9a86a",
  goldDim: "#9a7d4a",
  muted:   "#5a5854",
  border:  "rgba(255,255,255,0.06)",
  card:    "#0f0f0e",
  panel:   "#141412",
  live:    "#4ade80",
};

/* ── Hooks ── */
function useInView(threshold = 0.15) {
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
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return val;
}

/* ── Inline SVG Icons ── */
const Icon = {
  Queue: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3" cy="6" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="3" cy="12" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="3" cy="18" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Msg: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Moon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  Star: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Branch: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Globe: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
};

/* ── WhatsApp SVG ── */
const WaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

/* ═══════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════ */
export default function Landing() {
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <Nav />
      <Hero />
      <TrustBar />
      <LiveWidget />
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
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "0 32px",
      height: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: scrolled ? "rgba(8,8,7,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      transition: "all 0.3s ease",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 24, height: 24, background: C.gold, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.void, letterSpacing: "-0.02em" }}>A</div>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: C.ink }}>AzQueue</span>
      </div>
      {/* Links */}
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {[["#how", "How it works"], ["#features", "Features"], ["#pricing", "Pricing"]].map(([href, label]) => (
          <a key={label} href={href} style={{ fontSize: 13, color: C.muted, textDecoration: "none", letterSpacing: "-0.01em", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color = C.ink}
            onMouseLeave={e => e.target.style.color = C.muted}>
            {label}
          </a>
        ))}
        <Link to="/login" style={{
          fontSize: 13, fontWeight: 600, color: C.void,
          background: C.gold, padding: "7px 18px", borderRadius: 7,
          textDecoration: "none", letterSpacing: "-0.01em",
          transition: "opacity 0.15s",
        }}
          onMouseEnter={e => e.target.style.opacity = "0.85"}
          onMouseLeave={e => e.target.style.opacity = "1"}>
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
      minHeight: "100vh",
      display: "flex", alignItems: "center",
      position: "relative", overflow: "hidden",
      padding: "120px 32px 80px",
    }}>
      {/* Dot grid background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "radial-gradient(circle, rgba(201,168,106,0.12) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)",
      }} />
      {/* Gold glow */}
      <div style={{
        position: "absolute", top: "30%", left: "52%", transform: "translate(-50%,-50%)",
        width: 600, height: 600, borderRadius: "50%", zIndex: 0,
        background: "radial-gradient(circle, rgba(201,168,106,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{ maxWidth: 1160, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 80, position: "relative", zIndex: 1 }}>

        {/* Left — text */}
        <div style={{ flex: "0 0 480px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(24px)", transition: "all 0.7s ease" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(201,168,106,0.08)", border: `1px solid rgba(201,168,106,0.2)`, borderRadius: 20, padding: "5px 12px", marginBottom: 32 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: C.live }} />
            <span style={{ fontSize: 11, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Now accepting early access</span>
          </div>

          <h1 style={{
            fontSize: 58, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.035em",
            color: C.ink, margin: "0 0 24px",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}>
            The queue system your customers{" "}
            <span style={{ color: C.gold }}>actually enjoy.</span>
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.65, color: C.muted, margin: "0 0 40px", maxWidth: 400, letterSpacing: "-0.01em" }}>
            Replace paper sign-in sheets and shouting names with a smart kiosk, instant WhatsApp updates, and a live dashboard.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Link to="/register" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: C.gold, color: C.void,
              padding: "14px 28px", borderRadius: 10, fontSize: 15, fontWeight: 700,
              textDecoration: "none", letterSpacing: "-0.02em",
              boxShadow: "0 0 0 0 rgba(201,168,106,0)",
              transition: "all 0.2s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(201,168,106,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
              Get early access
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
            <span style={{ fontSize: 12, color: C.muted, letterSpacing: "-0.01em" }}>No credit card required</span>
          </div>

          {/* Trust micro-signals */}
          <div style={{ marginTop: 48, display: "flex", gap: 24 }}>
            {["WhatsApp & SMS ready", "10-min setup", "Prayer pause support"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(201,168,106,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold }}>
                  <Icon.Check />
                </div>
                <span style={{ fontSize: 11, color: C.muted, letterSpacing: "-0.01em" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — product visual */}
        <div style={{
          flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
          position: "relative", minHeight: 520,
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(32px)",
          transition: "all 0.9s ease 0.15s",
        }}>
          <KioskMockup />
        </div>
      </div>
    </section>
  );
}

/* ── iPad Kiosk Mockup ── */
function KioskMockup() {
  const [selected, setSelected] = useState(0);
  const services = ["General Consultation", "Lab Results", "Pharmacy", "Blood Pressure Check"];

  return (
    <div style={{ position: "relative" }}>
      {/* iPad frame */}
      <div style={{
        width: 288, height: 400,
        background: "linear-gradient(145deg, #232220, #181715)",
        borderRadius: 28, border: "1.5px solid #2e2c29",
        padding: 10,
        boxShadow: "0 40px 80px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>
        {/* Home bar */}
        <div style={{ width: 60, height: 3, background: "#2e2c29", borderRadius: 2, margin: "0 auto 8px" }} />
        {/* Screen */}
        <div style={{
          width: "100%", height: "calc(100% - 11px)",
          background: "#f5f2ec", borderRadius: 20, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{ background: C.void, padding: "16px 20px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 8.5, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>City Clinic · Al Barsha</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.gold, fontFamily: "Georgia, serif", letterSpacing: "-0.03em" }}>A 42</div>
            <div style={{ fontSize: 7.5, color: "#5a5854", marginTop: 2 }}>Your ticket · 3 ahead · ~8 min</div>
          </div>
          {/* Services */}
          <div style={{ padding: "14px 14px 0", flex: 1 }}>
            <div style={{ fontSize: 7.5, color: "#9a9890", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Select service</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {services.map((s, i) => (
                <button key={i} onClick={() => setSelected(i)} style={{
                  padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer", textAlign: "left",
                  background: i === selected ? C.gold : "#ede9e1",
                  color: i === selected ? C.void : "#4a4845",
                  fontSize: 9, fontWeight: i === selected ? 700 : 500,
                  transition: "all 0.15s",
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* Confirm */}
          <div style={{ padding: "12px 14px 14px" }}>
            <div style={{ background: C.void, color: C.gold, borderRadius: 7, padding: "9px 0", textAlign: "center", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>
              CONFIRM CHECK-IN
            </div>
            <div style={{ textAlign: "center", marginTop: 6, fontSize: 7, color: "#9a9890" }}>
              We'll send updates via WhatsApp
            </div>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp notification */}
      <FloatingWaCard />

      {/* Dashboard chip */}
      <DashboardChip />
    </div>
  );
}

function FloatingWaCard() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots(d => d < 3 ? d + 1 : 1), 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: "absolute", right: -140, top: 60,
      background: "#fff", borderRadius: 14, padding: "12px 16px", width: 210,
      boxShadow: "0 16px 48px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(0,0,0,0.08)",
      animation: "floatY 3s ease-in-out infinite",
    }}>
      <style>{`@keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, background: "#25D366", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <WaIcon />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a", lineHeight: 1 }}>AzQueue</div>
          <div style={{ fontSize: 8.5, color: "#9a9890", marginTop: 1 }}>WhatsApp notification</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 8, color: "#9a9890" }}>now</div>
      </div>
      <div style={{ fontSize: 10.5, color: "#2a2927", lineHeight: 1.5, borderTop: "1px solid #f0ede6", paddingTop: 8 }}>
        City Clinic: You're next! Ticket <strong>A42</strong> — please make your way to the counter.
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 6, justifyContent: "flex-end" }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: 2.5, background: i <= dots ? "#25D366" : "#e0ddd8", transition: "background 0.3s" }} />
        ))}
      </div>
    </div>
  );
}

function DashboardChip() {
  return (
    <div style={{
      position: "absolute", left: -130, bottom: 70,
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", width: 170,
      boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontSize: 8.5, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Live queue</div>
      {[
        { token: "A 40", name: "Mohammed Al-Farsi", status: "serving", color: C.gold },
        { token: "A 41", name: "Fatima Hassan",      status: "waiting", color: C.muted },
        { token: "A 42", name: "Sara Al-Amin",       status: "waiting", color: C.muted },
      ].map(row => (
        <div key={row.token} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: row.color, minWidth: 28, fontFamily: "monospace" }}>{row.token}</div>
          <div style={{ fontSize: 8.5, color: row.status === "serving" ? C.ink : C.muted, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</div>
          {row.status === "serving" && <div style={{ width: 6, height: 6, borderRadius: 3, background: C.live, flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TRUST BAR
═══════════════════════════════════════════ */
function TrustBar() {
  const tags = [
    "Built for clinics & hospitals",
    "Government offices",
    "Service centers",
    "Pharmacies",
    "Banks",
    "High-traffic environments",
    "WhatsApp & SMS integration ready",
    "Prayer pause support",
    "Multi-language",
    "Multi-branch",
  ];

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "18px 0", overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
      <div style={{ display: "flex", animation: "ticker 28s linear infinite", width: "max-content" }}>
        {[...tags, ...tags].map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 40, whiteSpace: "nowrap" }}>
            <div style={{ width: 3, height: 3, borderRadius: 1.5, background: C.gold, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: C.muted, letterSpacing: "0.04em" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LIVE WIDGET — "feel of a live system"
═══════════════════════════════════════════ */
function LiveWidget() {
  const [ref, visible] = useInView();
  const tickets  = useCounter(50000, visible, 2200);
  const wait     = useCounter(8,     visible, 1400);
  const langs    = useCounter(6,     visible, 1000);

  const [ts, setTs] = useState("just now");
  useEffect(() => {
    const t = setInterval(() => {
      const secs = Math.floor(Math.random() * 15) + 1;
      setTs(secs === 1 ? "just now" : `${secs}s ago`);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section ref={ref} style={{ padding: "80px 32px", maxWidth: 1160, margin: "0 auto" }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: "48px 64px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 32,
      }}>
        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 10, height: 10 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 5, background: C.live, animation: "ping 1.5s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 5, background: C.live }} />
          </div>
          <style>{`@keyframes ping { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0;transform:scale(2.2)} }`}</style>
          <div>
            <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, letterSpacing: "-0.01em" }}>System is live</div>
            <div style={{ fontSize: 11, color: C.muted }}>Last update: {ts}</div>
          </div>
        </div>

        <div style={{ width: 1, height: 40, background: C.border }} />

        {[
          { value: tickets.toLocaleString() + "+", label: "Tickets served" },
          { value: wait + " min",                  label: "Avg. wait time" },
          { value: langs,                           label: "Languages" },
        ].map(({ value, label }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.gold, letterSpacing: "-0.04em", fontFamily: "Georgia, serif", lineHeight: 1 }}>{visible ? value : "—"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, letterSpacing: "0.02em" }}>{label}</div>
          </div>
        ))}

        <div style={{ width: 1, height: 40, background: C.border }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 13, color: C.live, fontWeight: 700 }}>12 people in queue now</div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   HOW IT WORKS
═══════════════════════════════════════════ */
function HowItWorks() {
  const [ref, visible] = useInView(0.1);
  const steps = [
    { n: "01", title: "Customer arrives",       desc: "Walks up to your branded kiosk. Selects service. Done.", icon: "→" },
    { n: "02", title: "Ticket assigned",         desc: "System issues a unique ticket token instantly.", icon: "→" },
    { n: "03", title: "WhatsApp confirmation",   desc: "Customer receives their number with wait time estimate.", icon: "→" },
    { n: "04", title: "Real-time updates",       desc: "Automatic messages when they're next in line.", icon: "→" },
    { n: "05", title: "Staff calls them",        desc: "One tap on the dashboard. Customer is notified again.", icon: null },
  ];

  return (
    <section id="how" ref={ref} style={{ padding: "120px 32px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>How it works</div>
          <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", color: C.ink, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.1 }}>
            Zero chaos. Zero paper.<br />Zero shouting.
          </h2>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-start", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: `all 0.5s ease ${i * 0.1}s` }}>
              <div style={{ flex: 1 }}>
                {/* Number */}
                <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12, fontFamily: "monospace" }}>{step.n}</div>
                {/* Step card */}
                <div style={{
                  background: C.void, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: "24px 20px", marginRight: 0,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 8, letterSpacing: "-0.02em" }}>{step.title}</div>
                  <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>{step.desc}</div>
                </div>
              </div>
              {/* Arrow connector */}
              {step.icon && (
                <div style={{ color: C.gold, fontSize: 16, padding: "48px 6px 0", flexShrink: 0, opacity: 0.5 }}>›</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   PRODUCT SHOWCASE — alternating sections
═══════════════════════════════════════════ */
function ProductShowcase() {
  return (
    <>
      {/* Section A — Kiosk (dark) */}
      <KioskSection />
      {/* Section B — Dashboard (slightly lighter) */}
      <DashboardSection />
      {/* Section C — WhatsApp thread (dark) */}
      <WhatsAppSection />
    </>
  );
}

function KioskSection() {
  const [ref, visible] = useInView(0.1);
  return (
    <section ref={ref} style={{ padding: "120px 32px", background: C.void }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 80 }}>
        {/* Visual — kiosk screen */}
        <div style={{ flex: 1, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-24px)", transition: "all 0.7s ease" }}>
          <KioskScreenMockup />
        </div>
        {/* Text */}
        <div style={{ flex: "0 0 400px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(24px)", transition: "all 0.7s ease 0.1s" }}>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 20 }}>Self-service kiosk</div>
          <h3 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: C.ink, margin: "0 0 20px", fontFamily: "Georgia, serif", lineHeight: 1.15 }}>
            Check in under 30 seconds. No app needed.
          </h3>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65, margin: "0 0 32px", letterSpacing: "-0.01em" }}>
            Deploy on any tablet. Your brand, your colors. Customers tap their service, enter their number, and get a ticket instantly.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["Works on any Android or iPad tablet", "Supports Arabic, English, and 4 more languages", "Customizable per branch and service"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: "rgba(201,168,106,0.1)", border: `1px solid rgba(201,168,106,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0, marginTop: 1 }}>
                  <Icon.Check />
                </div>
                <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* Kiosk Screen Mockup */
function KioskScreenMockup() {
  return (
    <div style={{ position: "relative", maxWidth: 460 }}>
      {/* Screen frame */}
      <div style={{
        background: "linear-gradient(145deg, #1e1c1a, #141210)",
        borderRadius: 24, border: "1.5px solid #2a2825",
        padding: "4px 4px 20px",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ borderRadius: 20, overflow: "hidden", background: "#f5f2ec" }}>
          {/* Kiosk header */}
          <div style={{ background: C.void, padding: "28px 32px 20px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Al Noor Medical Center</div>
            <div style={{ fontSize: 52, fontWeight: 800, color: C.gold, fontFamily: "Georgia, serif", letterSpacing: "-0.04em", lineHeight: 1 }}>A 43</div>
            <div style={{ fontSize: 11, color: "#5a5854", marginTop: 8 }}>2 ahead · est. 6 minutes</div>
          </div>
          {/* Services */}
          <div style={{ padding: "24px 28px" }}>
            <div style={{ fontSize: 10, color: "#9a9890", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Choose your service</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["General", true], ["Specialist", false], ["Lab Results", false], ["Pharmacy", false]].map(([s, active]) => (
                <div key={s} style={{
                  padding: "16px 14px", borderRadius: 10,
                  background: active ? C.gold : "#ede9e1",
                  color: active ? C.void : "#5a5854",
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  textAlign: "center", cursor: "pointer",
                }}>
                  {s}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, background: C.void, borderRadius: 10, padding: "14px 0", textAlign: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: "0.06em" }}>CONFIRM CHECK-IN</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: "#9a9890" }}>
              WhatsApp updates to your number
            </div>
          </div>
        </div>
        {/* Bottom bar */}
        <div style={{ height: 4, background: "#1a1815", borderRadius: 2, margin: "10px 60px 0" }} />
      </div>
    </div>
  );
}

function DashboardSection() {
  const [ref, visible] = useInView(0.1);
  return (
    <section ref={ref} style={{ padding: "120px 32px", background: "#0a0a09" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 80 }}>
        {/* Text */}
        <div style={{ flex: "0 0 380px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-24px)", transition: "all 0.7s ease" }}>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 20 }}>Staff dashboard</div>
          <h3 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: C.ink, margin: "0 0 20px", fontFamily: "Georgia, serif", lineHeight: 1.15 }}>
            Full control from one screen.
          </h3>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65, margin: "0 0 32px" }}>
            See every ticket, call the next customer, track wait times, and manage staff — all in real time.
          </p>
          {[
            "One-tap call to next in line",
            "Live wait time tracking",
            "Satisfaction score per visit",
            "Prayer pause with auto-resume",
          ].map(t => (
            <div key={t} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: "rgba(201,168,106,0.1)", border: "1px solid rgba(201,168,106,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}>
                <Icon.Check />
              </div>
              <span style={{ fontSize: 13.5, color: C.muted }}>{t}</span>
            </div>
          ))}
        </div>
        {/* Dashboard visual */}
        <div style={{ flex: 1, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(24px)", transition: "all 0.7s ease 0.1s" }}>
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  const rows = [
    { token: "A 40", name: "Mohammed Al-Farsi",   service: "General",   wait: "12m", status: "serving" },
    { token: "A 41", name: "Fatima Hassan",         service: "Lab",       wait: "18m", status: "waiting" },
    { token: "A 42", name: "Sara Al-Amin",          service: "Pharmacy",  wait: "22m", status: "waiting" },
    { token: "A 43", name: "Ahmed Khalil",          service: "General",   wait: "26m", status: "waiting" },
    { token: "A 44", name: "Noura Bint Rashid",     service: "Specialist",wait: "30m", status: "waiting" },
  ];
  const statusColor = { serving: "#4ade80", waiting: C.muted };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
      {/* Top bar */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: C.live }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>Queue Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 11, color: C.muted }}>Serving: <strong style={{ color: C.gold }}>A 40</strong></span>
          <span style={{ fontSize: 11, color: C.muted }}>In queue: <strong style={{ color: C.ink }}>5</strong></span>
          <span style={{ fontSize: 11, color: C.muted }}>Avg wait: <strong style={{ color: C.ink }}>22m</strong></span>
        </div>
      </div>
      {/* Table header */}
      <div style={{ padding: "8px 20px", display: "grid", gridTemplateColumns: "64px 1fr 100px 60px 90px", gap: 12, borderBottom: `1px solid ${C.border}` }}>
        {["Ticket", "Customer", "Service", "Wait", "Status"].map(h => (
          <div key={h} style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>
      {/* Rows */}
      {rows.map((r, i) => (
        <div key={i} style={{
          padding: "12px 20px", display: "grid", gridTemplateColumns: "64px 1fr 100px 60px 90px", gap: 12, alignItems: "center",
          borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
          background: r.status === "serving" ? "rgba(74,222,128,0.03)" : "transparent",
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: r.status === "serving" ? C.gold : C.ink, fontFamily: "monospace", letterSpacing: "0.04em" }}>{r.token}</div>
          <div style={{ fontSize: 12, color: r.status === "serving" ? C.ink : C.muted }}>{r.name}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{r.service}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{r.wait}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: statusColor[r.status] }} />
            <span style={{ fontSize: 11, color: statusColor[r.status], fontWeight: 600, textTransform: "capitalize" }}>{r.status}</span>
          </div>
        </div>
      ))}
      {/* Action bar */}
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
        <button style={{ background: C.gold, color: C.void, border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}>
          Call next
        </button>
        <button style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
          Prayer pause
        </button>
      </div>
    </div>
  );
}

function WhatsAppSection() {
  const [ref, visible] = useInView(0.1);
  const messages = [
    { from: "system", text: "Al Noor Clinic: You're checked in. Ticket A42 for General Consultation. We'll message when you're next.", time: "10:22" },
    { from: "customer", text: "How many people ahead of me?", time: "10:31" },
    { from: "system", text: "Al Noor Clinic: 2 people ahead. Estimated wait: 8 minutes.", time: "10:31" },
    { from: "system", text: "Al Noor Clinic: You're next! Please make your way to counter 3. Ticket A42.", time: "10:39" },
    { from: "system", text: "Al Noor Clinic: Thanks for visiting! We hope to see you again soon.", time: "10:52" },
  ];

  return (
    <section ref={ref} style={{ padding: "120px 32px", background: C.void }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 80 }}>
        {/* WhatsApp chat mockup */}
        <div style={{ flex: 1, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-24px)", transition: "all 0.7s ease" }}>
          <div style={{ background: "#0a0d0b", border: "1.5px solid #1a2119", borderRadius: 20, overflow: "hidden", maxWidth: 360, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            {/* WA header */}
            <div style={{ background: "#128C7E", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, background: C.gold, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.void }}>A</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>AzQueue · Al Noor Clinic</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)" }}>Official business account</div>
              </div>
            </div>
            {/* Messages */}
            <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8, background: "#0b130e" }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.from === "customer" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "85%", padding: "8px 12px", borderRadius: m.from === "customer" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: m.from === "customer" ? "#005C4B" : "#1e2b20",
                    fontSize: 11.5, color: "rgba(255,255,255,0.92)", lineHeight: 1.5,
                  }}>
                    {m.text}
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textAlign: "right" }}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Text */}
        <div style={{ flex: "0 0 400px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(24px)", transition: "all 0.7s ease 0.1s" }}>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 20 }}>WhatsApp & SMS</div>
          <h3 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: C.ink, margin: "0 0 20px", fontFamily: "Georgia, serif", lineHeight: 1.15 }}>
            Every customer, always informed.
          </h3>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65, margin: "0 0 32px" }}>
            Automatic WhatsApp messages at every step. No app download. No registration. Works on any phone.
          </p>
          {["Check-in confirmation sent instantly", "Called-to-counter alert when it's their turn", "Thank-you message on completion", "Prayer pause notices with resume time"].map(t => (
            <div key={t} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: "rgba(201,168,106,0.1)", border: "1px solid rgba(201,168,106,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}>
                <Icon.Check />
              </div>
              <span style={{ fontSize: 13.5, color: C.muted }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FEATURES GRID — cards with mini UI
═══════════════════════════════════════════ */
function FeaturesGrid() {
  const [ref, visible] = useInView(0.08);

  const features = [
    {
      icon: <Icon.Queue />,
      title: "Smart queue management",
      desc: "Auto-assign tickets, track wait times, and serve customers in order. Zero manual tracking.",
      mini: (
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {["A40", "A41", "A42"].map((t, i) => (
            <div key={t} style={{ flex: 1, background: i === 0 ? "rgba(201,168,106,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 0 ? "rgba(201,168,106,0.3)" : C.border}`, borderRadius: 6, padding: "5px 0", textAlign: "center", fontSize: 9, fontWeight: 700, color: i === 0 ? C.gold : C.muted, fontFamily: "monospace" }}>{t}</div>
          ))}
        </div>
      ),
    },
    {
      icon: <Icon.Msg />,
      title: "WhatsApp & SMS",
      desc: "Instant notifications at check-in, when called, and after service. No app needed.",
      mini: (
        <div style={{ marginTop: 12, background: "#0b130e", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>AzQueue · just now</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>You're next! Ticket A42 — counter 3.</div>
        </div>
      ),
    },
    {
      icon: <Icon.Moon />,
      title: "Prayer pause",
      desc: "Schedule automatic pauses for prayer times. Queue resumes automatically — no ticket lost.",
      mini: (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 2 }}>
            <div style={{ width: "0%", height: "100%", background: C.gold, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 9, color: C.gold, fontWeight: 600, whiteSpace: "nowrap" }}>Paused · Asr</span>
        </div>
      ),
    },
    {
      icon: <Icon.Star />,
      title: "Loyalty punch cards",
      desc: "Reward returning customers automatically. Punch earned on every completed visit.",
      mini: (
        <div style={{ marginTop: 12, display: "flex", gap: 4 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: i < 5 ? C.gold : "rgba(255,255,255,0.06)", border: `1px solid ${i < 5 ? "transparent" : C.border}` }} />
          ))}
        </div>
      ),
    },
    {
      icon: <Icon.Chart />,
      title: "Analytics & insights",
      desc: "Peak hours, wait time trends, and service performance — updated in real time.",
      mini: (
        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 5 ? C.gold : "rgba(201,168,106,0.2)", borderRadius: "2px 2px 0 0" }} />
          ))}
        </div>
      ),
    },
    {
      icon: <Icon.Branch />,
      title: "Multi-branch ready",
      desc: "One account, many locations. Each branch has its own queue, staff, and settings.",
      mini: (
        <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
          {["Main", "North", "Mall"].map(b => (
            <div key={b} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 0", textAlign: "center", fontSize: 8.5, color: C.muted }}>{b}</div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section id="features" ref={ref} style={{ padding: "120px 32px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>Features</div>
          <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", color: C.ink, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.1 }}>
            Everything you need.<br />Nothing you don't.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: C.void, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 24px",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
              transition: `all 0.5s ease ${i * 0.07}s`,
              cursor: "default",
            }}
              onMouseEnter={e => { e.currentTarget.style.border = `1px solid rgba(201,168,106,0.2)`; e.currentTarget.style.background = "#0d0d0c"; }}
              onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${C.border}`; e.currentTarget.style.background = C.void; }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(201,168,106,0.08)", border: "1px solid rgba(201,168,106,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, marginBottom: 16 }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8, letterSpacing: "-0.02em" }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, letterSpacing: "-0.005em" }}>{f.desc}</div>
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
      desc: "For single-location businesses getting started.",
      features: ["1 branch", "1 kiosk terminal", "WhatsApp notifications", "Basic analytics", "Email support"],
      cta: "Get started",
      highlight: false,
    },
    {
      name: "Growth",
      price: annual ? 79 : 99,
      desc: "For businesses ready to scale their operations.",
      features: ["Up to 5 branches", "Unlimited kiosks", "WhatsApp + SMS", "Loyalty punch cards", "Prayer pause scheduling", "Advanced analytics", "Priority support"],
      cta: "Get early access",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: null,
      desc: "For large networks and government entities.",
      features: ["Unlimited branches", "Custom integrations", "Dedicated onboarding", "SLA guarantee", "Arabic + multilingual UI", "24/7 support"],
      cta: "Contact us",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" ref={ref} style={{ padding: "120px 32px", background: C.void }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>Pricing</div>
          <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", color: C.ink, margin: "0 0 32px", fontFamily: "Georgia, serif", lineHeight: 1.1 }}>
            Simple, transparent pricing.
          </h2>
          {/* Toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 8px" }}>
            <button onClick={() => setAnnual(false)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: !annual ? C.ink : "transparent", color: !annual ? C.void : C.muted, transition: "all 0.15s" }}>Monthly</button>
            <button onClick={() => setAnnual(true)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: annual ? C.ink : "transparent", color: annual ? C.void : C.muted, transition: "all 0.15s" }}>Annual
              <span style={{ marginLeft: 6, fontSize: 9.5, color: C.gold, fontWeight: 700 }}>-25%</span>
            </button>
          </div>
        </div>

        {/* Tiers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "stretch" }}>
          {tiers.map((tier, i) => (
            <div key={i} style={{
              background: tier.highlight ? "transparent" : C.panel,
              border: tier.highlight ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`,
              borderRadius: 18, padding: "36px 28px",
              position: "relative", overflow: "hidden",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
              transition: `all 0.5s ease ${i * 0.1}s`,
              display: "flex", flexDirection: "column",
            }}>
              {tier.highlight && (
                <>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
                  <div style={{ position: "absolute", top: 16, right: 20, background: C.gold, color: C.void, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4 }}>POPULAR</div>
                </>
              )}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tier.highlight ? C.gold : C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{tier.name}</div>
                {tier.price ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>$</span>
                    <span style={{ fontSize: 48, fontWeight: 800, color: C.ink, letterSpacing: "-0.04em", fontFamily: "Georgia, serif", lineHeight: 1 }}>{tier.price}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>/mo</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em", fontFamily: "Georgia, serif", marginBottom: 8, lineHeight: 1.2 }}>Custom</div>
                )}
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{tier.desc}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {tier.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: tier.highlight ? "rgba(201,168,106,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", color: tier.highlight ? C.gold : C.muted, flexShrink: 0, marginTop: 1 }}>
                      <Icon.Check />
                    </div>
                    <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{
                width: "100%", padding: "13px 0", borderRadius: 10, border: "none", cursor: "pointer",
                background: tier.highlight ? C.gold : "rgba(255,255,255,0.06)",
                color: tier.highlight ? C.void : C.muted,
                fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
                transition: "all 0.2s ease",
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
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
    <section ref={ref} style={{ padding: "120px 32px", background: C.card, position: "relative", overflow: "hidden" }}>
      {/* Radial glow */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 400, background: "radial-gradient(ellipse, rgba(201,168,106,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{
        maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1,
        opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(24px)", transition: "all 0.7s ease",
      }}>
        <div style={{ width: 48, height: 1, background: C.gold, margin: "0 auto 40px", opacity: 0.5 }} />
        <h2 style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.035em", color: C.ink, margin: "0 0 20px", fontFamily: "Georgia, serif", lineHeight: 1.1 }}>
          Your customers are waiting.<br />
          <span style={{ color: C.gold }}>Let's fix that.</span>
        </h2>
        <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.65, margin: "0 0 48px", letterSpacing: "-0.01em" }}>
          10 minutes to set up. No hardware to buy. No training needed.
        </p>
        <Link to="/register" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: C.gold, color: C.void,
          padding: "16px 36px", borderRadius: 12, fontSize: 16, fontWeight: 700,
          textDecoration: "none", letterSpacing: "-0.02em",
          transition: "all 0.2s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(201,168,106,0.35)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
          Get early access — it's free
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </Link>
        <div style={{ marginTop: 24, fontSize: 12, color: C.muted }}>No credit card · Cancel any time</div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════ */
function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "40px 32px", background: C.void }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 22, height: 22, background: C.gold, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: C.void }}>A</div>
          <span style={{ fontSize: 13, color: "#3a3835", letterSpacing: "-0.01em" }}>AzQueue · azqueue.io</span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {[["mailto:support@azqueue.io", "Support"], ["#pricing", "Pricing"], ["/login", "Sign in"]].map(([href, label]) => (
            href.startsWith("/") ? (
              <Link key={label} to={href} style={{ fontSize: 12, color: C.muted, textDecoration: "none", letterSpacing: "-0.01em", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = C.ink}
                onMouseLeave={e => e.target.style.color = C.muted}>{label}</Link>
            ) : (
              <a key={label} href={href} style={{ fontSize: 12, color: C.muted, textDecoration: "none", letterSpacing: "-0.01em", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = C.ink}
                onMouseLeave={e => e.target.style.color = C.muted}>{label}</a>
            )
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#2a2a25" }}>© 2025 AzQueue. All rights reserved.</div>
      </div>
    </footer>
  );
}
