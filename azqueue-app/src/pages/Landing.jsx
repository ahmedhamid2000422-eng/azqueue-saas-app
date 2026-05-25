import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";

/*
 * AzQueue Landing — Premium edition
 * Positioning: "The operating system for walk-in service businesses."
 * Direction: Stripe / Linear / Ramp — dark, gold, precise, spacious.
 */

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#080807] text-[#f0ede6] overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Nav />
      <Hero />
      <TrustBar />
      <ProblemSolution />
      <WorkflowSection />
      <ProductShowcase />
      <FeaturesGrid />
      <StatBar />
      <IndustriesSection />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ── Helpers ── */
function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function useCounter(target, duration = 1200, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return count;
}

/* ══════════════════════════════════════════════════════════════════════
   NAV
══════════════════════════════════════════════════════════════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      transition: "background 0.3s, border-color 0.3s",
      background: scrolled ? "rgba(8,8,7,0.96)" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
    }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 28px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, background: "#c9a86a", borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 700, color: "#080807",
            boxShadow: "0 0 24px rgba(201,168,106,0.4)",
          }}>A</div>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 15, letterSpacing: "-0.01em", color: "#f0ede6" }}>AzQueue</span>
        </div>

        <div style={{ display: "flex", gap: 36, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#5a5852" }}>
          {[["#workflow", "How it works"], ["#features", "Features"], ["#pricing", "Pricing"]].map(([href, label]) => (
            <a key={label} href={href} style={{ color: "#5a5852", textDecoration: "none", transition: "color 0.15s" }}
               onMouseEnter={e => e.target.style.color = "#f0ede6"}
               onMouseLeave={e => e.target.style.color = "#5a5852"}>
              {label}
            </a>
          ))}
        </div>

        <Link to="/login" style={{
          fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
          background: "#c9a86a", color: "#080807", padding: "10px 20px",
          textDecoration: "none", fontWeight: 600,
          transition: "background 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#d4b87a"}
          onMouseLeave={e => e.currentTarget.style.background = "#c9a86a"}
        >
          Start free
        </Link>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════════════ */
function TickerAnimation() {
  const [token, setToken] = useState("A-01");
  const [state, setState] = useState("waiting");
  useEffect(() => {
    const tokens = ["A-07","B-12","A-03","C-21","B-08"];
    let i = 0;
    const cycle = () => {
      setState("serving");
      setTimeout(() => {
        i = (i + 1) % tokens.length;
        setToken(tokens[i]);
        setState("waiting");
      }, 1800);
    };
    const id = setInterval(cycle, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: "#111109", border: `1px solid ${state === "serving" ? "rgba(155,189,155,0.4)" : "rgba(201,168,106,0.25)"}`,
      padding: "12px 20px", display: "inline-flex", alignItems: "center", gap: 12,
      transition: "border-color 0.5s",
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: state === "serving" ? "#9bbd9b" : "#c9a86a",
        boxShadow: `0 0 8px ${state === "serving" ? "#9bbd9b" : "#c9a86a"}`,
        animation: "breathe 2s ease-in-out infinite",
      }} />
      <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.15em", color: "#908e86" }}>
        {state === "serving" ? "NOW SERVING" : "NEXT UP"}
      </span>
      <span style={{ fontFamily: "Georgia, serif", fontSize: 22, color: state === "serving" ? "#9bbd9b" : "#c9a86a", letterSpacing: "-0.01em", transition: "color 0.4s" }}>
        {token}
      </span>
    </div>
  );
}

function Hero() {
  return (
    <section style={{ paddingTop: 160, paddingBottom: 120, textAlign: "center", padding: "160px 28px 120px", position: "relative" }}>
      {/* Subtle radial glow behind headline */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: 600, height: 400, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(201,168,106,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 840, margin: "0 auto", position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase",
          color: "#c9a86a", border: "1px solid rgba(201,168,106,0.25)",
          padding: "7px 16px", marginBottom: 48,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c9a86a", display: "inline-block", animation: "breathe 2s ease-in-out infinite" }} />
          Customer flow infrastructure
        </div>

        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(40px, 6vw, 72px)",
          fontWeight: 300, letterSpacing: "-0.025em", lineHeight: 1.08,
          color: "#f0ede6", marginBottom: 28,
        }}>
          The operating system<br />
          <span style={{ background: "linear-gradient(135deg, #c9a86a 0%, #e8d5a3 50%, #c9a86a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            for walk-in service businesses.
          </span>
        </h1>

        <p style={{ fontSize: 18, color: "#6a6760", maxWidth: 580, margin: "0 auto 16px", lineHeight: 1.75 }}>
          Customers check in on a kiosk. Staff see every ticket live. Customers get WhatsApp or SMS updates when they're up. No paper. No shouting. No chaos.
        </p>
        <p style={{ fontSize: 13, color: "#3a3835", marginBottom: 52 }}>
          Built for clinics, law firms, immigration offices, and service centers across Malaysia, MENA and Africa.
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 64 }}>
          <Link to="/login" style={{
            background: "#c9a86a", color: "#080807", padding: "16px 36px",
            fontSize: 13, fontWeight: 600, letterSpacing: "0.05em",
            textDecoration: "none", transition: "all 0.2s",
            boxShadow: "0 0 48px rgba(201,168,106,0.2)",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#d4b87a"; e.currentTarget.style.boxShadow = "0 0 64px rgba(201,168,106,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#c9a86a"; e.currentTarget.style.boxShadow = "0 0 48px rgba(201,168,106,0.2)"; }}
          >
            Start free — no credit card
          </Link>
          <a href="#workflow" style={{
            border: "1px solid rgba(255,255,255,0.1)", color: "#908e86",
            padding: "16px 36px", fontSize: 13, letterSpacing: "0.05em",
            textDecoration: "none", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,106,0.3)"; e.currentTarget.style.color = "#f0ede6"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#908e86"; }}
          >
            See how it works ↓
          </a>
        </div>

        {/* Live ticket ticker */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
          <TickerAnimation />
        </div>

        {/* Trust pills */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3a3835" }}>
          {["WhatsApp + SMS", "6 languages", "Prayer time aware", "iPad kiosk", "AI-powered", "14-day free trial"].map(t => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#c9a86a" }}>✦</span> {t}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes breathe { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.85)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TRUST BAR
══════════════════════════════════════════════════════════════════════ */
function TrustBar() {
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "28px 28px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#3a3835" }}>Trusted by businesses in</span>
        {["Kuala Lumpur", "Dubai", "Riyadh", "Lagos", "Nairobi", "Karachi"].map(city => (
          <span key={city} style={{ fontSize: 11, letterSpacing: "0.12em", color: "#5a5852" }}>{city}</span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PROBLEM → SOLUTION
══════════════════════════════════════════════════════════════════════ */
function ProblemSolution() {
  const [ref, inView] = useInView(0.15);
  const before = [
    "Customers crowd the entrance, not knowing their position",
    "Staff shout names and numbers across the room",
    "No-shows back up the queue for everyone",
    "Walk-ins and appointments collide with no system",
    "Zero visibility into wait times or staff performance",
  ];
  const after = [
    "Customers check in on a kiosk and wait anywhere they like",
    "WhatsApp or SMS tells each customer exactly when to come",
    "Live queue updates eliminate confusion and no-shows",
    "Walk-ins and bookings merge into one intelligent dashboard",
    "Real-time analytics — wait times, SLA alerts, staff metrics",
  ];

  return (
    <section style={{ padding: "120px 28px", background: "#0a0a08" }}>
      <div ref={ref} style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>The transformation</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.02em", color: "#f0ede6" }}>
            Every walk-in service business<br />lives in one of two worlds.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "rgba(255,255,255,0.04)" }}>
          {/* Before */}
          <div style={{
            background: "#0a0a08", padding: 48,
            opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#6b3535", marginBottom: 16 }}>Without AzQueue</div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 300, color: "#8a7070", marginBottom: 32, letterSpacing: "-0.01em" }}>Controlled chaos.</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {before.map(item => (
                <div key={item} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ color: "#6b3535", fontSize: 12, marginTop: 2, flexShrink: 0 }}>✕</span>
                  <span style={{ fontSize: 13, color: "#4a3a3a", lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* After */}
          <div style={{
            background: "#0c0d0a", padding: 48,
            borderLeft: "1px solid rgba(201,168,106,0.15)",
            opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>With AzQueue</div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 300, color: "#c9a86a", marginBottom: 32, letterSpacing: "-0.01em" }}>Operational calm.</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {after.map(item => (
                <div key={item} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ color: "#9bbd9b", fontSize: 12, marginTop: 2, flexShrink: 0 }}>✦</span>
                  <span style={{ fontSize: 13, color: "#908e86", lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   WORKFLOW — 5 STEPS
══════════════════════════════════════════════════════════════════════ */
function WorkflowSection() {
  const [ref, inView] = useInView(0.1);

  const steps = [
    { n: "01", icon: "🚶", title: "Walk in", sub: "Customer arrives and sees the QR code or kiosk at reception" },
    { n: "02", icon: "📲", title: "Self check-in", sub: "Picks service, enters name and phone — 30 seconds on any device" },
    { n: "03", icon: "💬", title: "Instant notification", sub: "Receives WhatsApp or SMS ticket with live position link" },
    { n: "04", icon: "☕", title: "Wait anywhere", sub: "Monitors their position in real time from their own phone" },
    { n: "05", icon: "✅", title: "Called when ready", sub: "One tap from staff sends the call notification automatically" },
  ];

  return (
    <section id="workflow" style={{ padding: "120px 28px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>The workflow</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.02em", color: "#f0ede6", marginBottom: 12 }}>
            Five steps. Zero friction.
          </h2>
          <p style={{ fontSize: 15, color: "#5a5852", maxWidth: 480, margin: "0 auto" }}>
            Every touchpoint handled automatically. Staff focus on the work — not the queue.
          </p>
        </div>

        <div ref={ref} style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
          {/* Connecting line */}
          <div style={{
            position: "absolute", top: 36, left: "10%", right: "10%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(201,168,106,0.2) 20%, rgba(201,168,106,0.2) 80%, transparent)",
            transition: "opacity 0.8s",
            opacity: inView ? 1 : 0,
          }} />

          {steps.map((s, i) => (
            <div key={i} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(32px)",
              transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "#111109", border: "1px solid rgba(201,168,106,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, marginBottom: 20, position: "relative", zIndex: 1,
                boxShadow: "0 0 32px rgba(201,168,106,0.08)",
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 6 }}>{s.n}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#f0ede6", marginBottom: 8, padding: "0 8px" }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "#4a4845", lineHeight: 1.6, padding: "0 12px" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PRODUCT SHOWCASE — Kiosk + Dashboard
══════════════════════════════════════════════════════════════════════ */
function WhatsAppBubble() {
  const [typed, setTyped] = useState("");
  const msg = "Klinik Sejahtera: You're checked in. Ticket A-07 for General Consultation. We'll WhatsApp you when you're up.";
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(msg.slice(0, i));
      if (i >= msg.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: "absolute", right: -20, top: 24,
      background: "#25d366", borderRadius: "16px 16px 4px 16px",
      padding: "12px 16px", maxWidth: 200,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#075e54", marginBottom: 4 }}>Klinik Sejahtera</div>
      <div style={{ fontSize: 10, color: "#064e45", lineHeight: 1.55 }}>{typed}<span style={{ opacity: typed.length < msg.length ? 1 : 0 }}>|</span></div>
    </div>
  );
}

function KioskMockup() {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* iPad frame */}
      <div style={{
        width: 280, background: "#1a1a16", borderRadius: 28,
        border: "7px solid #252520", padding: 12,
        boxShadow: "0 48px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
      }}>
        <div style={{ width: 32, height: 4, background: "#252520", borderRadius: 2, margin: "0 auto 10px" }} />
        <div style={{ background: "#080807", borderRadius: 14, overflow: "hidden" }}>
          {/* Kiosk screen */}
          <div style={{ background: "#0a0a08", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 22, height: 22, background: "#c9a86a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#080807" }}>A</div>
              <span style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#f0ede6" }}>AzQueue</span>
            </div>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 4 }}>Walk-in check-in</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "#f0ede6", marginBottom: 16 }}>Klinik Sejahtera</div>
            {/* Services */}
            {[["General Consultation", true], ["Vaccination", false], ["Blood Test", false]].map(([svc, active]) => (
              <div key={svc} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", marginBottom: 4,
                background: active ? "rgba(201,168,106,0.1)" : "#111109",
                border: `1px solid ${active ? "rgba(201,168,106,0.3)" : "rgba(255,255,255,0.04)"}`,
                borderRadius: 6,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: active ? "#c9a86a" : "transparent",
                  border: active ? "none" : "1px solid #3a3835",
                }} />
                <span style={{ fontSize: 10, color: active ? "#c9a86a" : "#5a5852" }}>{svc}</span>
              </div>
            ))}
            {/* Fields */}
            <div style={{ marginTop: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: "#111109", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "9px 12px", fontSize: 10, color: "#3a3835" }}>Ahmad bin Razali</div>
              <div style={{ background: "#111109", border: "1px solid rgba(201,168,106,0.3)", borderRadius: 4, padding: "9px 12px", fontSize: 10, color: "#c9a86a" }}>+60 12-345 6789</div>
            </div>
            <div style={{ background: "#c9a86a", borderRadius: 4, padding: "11px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#080807" }}>Check in →</div>
          </div>
        </div>
        <div style={{ width: 32, height: 4, background: "#252520", borderRadius: 2, margin: "10px auto 0" }} />
      </div>
      {/* WhatsApp bubble */}
      <WhatsAppBubble />
      {/* Ticket chip */}
      <div style={{
        position: "absolute", bottom: 40, left: -24,
        background: "#111109", border: "1px solid rgba(201,168,106,0.3)",
        borderRadius: 12, padding: "12px 18px", textAlign: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 4 }}>Ticket</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#c9a86a", lineHeight: 1 }}>A-07</div>
        <div style={{ fontSize: 9, color: "#3a3835", marginTop: 4, fontFamily: "monospace" }}>3 ahead · ~12m</div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  const tickets = [
    { token: "A-04", name: "Siti Rahimah", service: "General", wait: "18m", status: "waiting" },
    { token: "A-05", name: "Rajiv Kumar", service: "Blood Test", wait: "12m", status: "waiting" },
    { token: "A-06", name: "Fatimah Hassan", service: "Vaccination", wait: "6m", status: "serving" },
    { token: "A-07", name: "Ahmad Razali", service: "General", wait: "1m", status: "waiting" },
  ];

  return (
    <div style={{
      background: "#0c0c0a", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 48px 100px rgba(0,0,0,0.6)",
    }}>
      {/* Dashboard header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#9bbd9b", boxShadow: "0 0 6px #9bbd9b" }} />
          <span style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#908e86" }}>Live Queue · Klinik Sejahtera</span>
        </div>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#3a3835" }}>4 waiting</span>
      </div>
      {/* Tickets */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {tickets.map((t, i) => (
          <div key={t.token} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 16px",
            background: t.status === "serving" ? "rgba(155,189,155,0.06)" : "#111109",
            border: `1px solid ${t.status === "serving" ? "rgba(155,189,155,0.2)" : "rgba(255,255,255,0.04)"}`,
            borderRadius: 6,
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, color: t.status === "serving" ? "#9bbd9b" : "#c9a86a", width: 36 }}>{t.token}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: t.status === "serving" ? "#d0cdc6" : "#908e86", marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 9, color: "#3a3835", letterSpacing: "0.1em" }}>{t.service}</div>
            </div>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "#3a3835" }}>{t.wait}</span>
            {t.status === "serving" ? (
              <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9bbd9b", border: "1px solid rgba(155,189,155,0.3)", padding: "3px 8px" }}>Serving</div>
            ) : (
              <div style={{
                fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "#080807", background: "#c9a86a",
                padding: "4px 10px", cursor: "pointer",
              }}>Call</div>
            )}
          </div>
        ))}
      </div>
      {/* Stats footer */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 24 }}>
        {[["Avg wait", "14m"], ["Served today", "23"], ["Satisfaction", "4.8★"]].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3a3835", marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 13, fontFamily: "monospace", color: "#c9a86a" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductShowcase() {
  const [ref, inView] = useInView(0.1);
  return (
    <section style={{ padding: "80px 28px 120px", background: "#080807" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>The product</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.02em", color: "#f0ede6" }}>
            A reception desk that never clocks out.<br />A staff dashboard built for speed.
          </h2>
        </div>
        <div ref={ref} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center",
          opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(32px)",
          transition: "opacity 0.7s ease, transform 0.7s ease" }}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40, paddingBottom: 40 }}>
            <KioskMockup />
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>Staff dashboard</div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 300, color: "#f0ede6", marginBottom: 20, letterSpacing: "-0.01em" }}>
              Every ticket. One view.<br />Real time.
            </h3>
            <p style={{ fontSize: 13, color: "#5a5852", lineHeight: 1.8, marginBottom: 32 }}>
              Call the next customer with one tap. See who's waiting, who's being served, and who hasn't arrived yet — all updating live without a refresh.
            </p>
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   FEATURES GRID
══════════════════════════════════════════════════════════════════════ */
function FeaturesGrid() {
  const [ref, inView] = useInView(0.1);
  const features = [
    { icon: "🧠", title: "AI customer intelligence", body: "Every visitor gets a profile. Staff see visit history, satisfaction scores, and a plain-language AI briefing before the conversation starts." },
    { icon: "💬", title: "WhatsApp + SMS built in", body: "Check-in confirmation, call notice, and thank-you messages send automatically via Twilio. No integrations to wire up." },
    { icon: "🕌", title: "Prayer time aware", body: "The queue pauses before each prayer and resumes after. Customers on the list are notified. Designed for where you actually operate." },
    { icon: "⚡", title: "Autopilot pacing", body: "The system learns your real service speed and adjusts call timing automatically. No manual throttling. No guessing." },
    { icon: "🎫", title: "Loyalty punch cards", body: "Customers earn a punch every visit. Staff see when a reward is due and redeem it in one tap. Retention, built in." },
    { icon: "📊", title: "SLA & escalation engine", body: "Set wait time thresholds. Get alerted when a customer has been waiting too long. The system escalates before it becomes a complaint." },
  ];

  return (
    <section id="features" style={{ padding: "120px 28px", background: "#0a0a08" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>Operational depth</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.02em", color: "#f0ede6", marginBottom: 12 }}>
            Everything a serious service desk needs.
          </h2>
          <p style={{ fontSize: 14, color: "#4a4845", maxWidth: 480, margin: "0 auto" }}>
            Not a feature checklist — an operational system. Every capability connects to the next.
          </p>
        </div>
        <div ref={ref} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.04)" }}>
          {features.map((f, i) => (
            <div key={f.title} style={{
              background: "#0a0a08", padding: "36px 32px",
              transition: "background 0.2s",
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(24px)",
              transitionDelay: `${i * 0.08}s`,
              transitionProperty: "opacity, transform, background",
              transitionDuration: "0.5s, 0.5s, 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0c"}
              onMouseLeave={e => e.currentTarget.style.background = "#0a0a08"}
            >
              <div style={{ fontSize: 28, marginBottom: 20 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#d0cdc6", marginBottom: 10, letterSpacing: "0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 12, color: "#4a4845", lineHeight: 1.7 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STAT BAR
══════════════════════════════════════════════════════════════════════ */
function StatBar() {
  const [ref, inView] = useInView(0.3);
  const langs = useCounter(6, 1000, inView);
  const setup = useCounter(10, 800, inView);
  const tickets = useCounter(50000, 1400, inView);

  return (
    <section style={{ padding: "80px 28px", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div ref={ref} style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.04)" }}>
        {[
          { value: langs, suffix: "", label: "Languages at the kiosk", note: "EN · BM · AR · ZH · TA · UR" },
          { value: setup, suffix: "min", label: "Average setup time", note: "From signup to first ticket" },
          { value: tickets.toLocaleString(), suffix: "+", label: "Tickets managed", note: "Across all branches" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#080807", padding: "48px 40px", textAlign: "center" }}>
            <div style={{
              fontFamily: "monospace", fontSize: "clamp(40px, 5vw, 64px)",
              color: "#c9a86a", letterSpacing: "-0.02em", lineHeight: 1,
              marginBottom: 12,
            }}>
              {s.value}{s.suffix}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#908e86", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: "#3a3835", letterSpacing: "0.1em" }}>{s.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   INDUSTRIES
══════════════════════════════════════════════════════════════════════ */
function IndustriesSection() {
  const industries = [
    "Clinics & hospitals", "Government counters", "Law firms",
    "Immigration offices", "Banks & finance", "Salons & barbershops",
    "Repair shops", "Pharmacies", "Welfare centres",
    "Embassies", "Telco service centres", "University registries",
  ];

  return (
    <section style={{ padding: "100px 28px", background: "#0a0a08" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>Who it's for</div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 300, letterSpacing: "-0.02em", color: "#f0ede6", marginBottom: 12 }}>
          Any business where people wait.
        </h2>
        <p style={{ fontSize: 14, color: "#4a4845", marginBottom: 52, maxWidth: 500, margin: "0 auto 52px" }}>
          Especially in markets where walk-in services dominate and multilingual counters are the daily reality.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          {industries.map(ind => (
            <span key={ind} style={{
              fontSize: 11, letterSpacing: "0.08em", color: "#5a5852",
              border: "1px solid rgba(255,255,255,0.07)", padding: "9px 18px",
              cursor: "default", transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,106,0.3)"; e.currentTarget.style.color = "#c9a86a"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#5a5852"; }}
            >
              {ind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TESTIMONIALS
══════════════════════════════════════════════════════════════════════ */
function Testimonials() {
  const quotes = [
    { q: "We cut reception workload by half in the first week. Customers stopped crowding the entrance the moment we put up the kiosk.", name: "Dr. Aisha R.", role: "Clinic owner, Kuala Lumpur" },
    { q: "The WhatsApp notification is the feature. Patients wait in their cars now instead of our waiting room. Complaints dropped to zero.", name: "Hassan M.", role: "Practice manager, Dubai" },
    { q: "Finally something designed for how our customers actually behave. The Arabic kiosk alone was worth the switch.", name: "Ibrahim Al-K.", role: "Legal firm director, Riyadh" },
  ];

  return (
    <section style={{ padding: "120px 28px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>From the field</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 300, letterSpacing: "-0.02em", color: "#f0ede6" }}>
            Businesses that made the switch.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.04)" }}>
          {quotes.map((q, i) => (
            <div key={i} style={{ background: "#080807", padding: "40px 36px" }}
              onMouseEnter={e => e.currentTarget.style.background = "#0c0c0a"}
              onMouseLeave={e => e.currentTarget.style.background = "#080807"}
            >
              <div style={{ fontFamily: "Georgia, serif", fontSize: 32, color: "#c9a86a", marginBottom: 20, lineHeight: 1 }}>"</div>
              <p style={{ fontSize: 14, color: "#908e86", lineHeight: 1.8, marginBottom: 32, fontStyle: "italic" }}>{q.q}</p>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#d0cdc6" }}>{q.name}</div>
                <div style={{ fontSize: 10, color: "#3a3835", marginTop: 4, letterSpacing: "0.05em" }}>{q.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PRICING
══════════════════════════════════════════════════════════════════════ */
function Pricing() {
  const plans = [
    {
      name: "Essential", price: "RM 29", period: "/mo",
      description: "Solo practice or small shop.",
      features: ["1 branch", "Unlimited tickets", "QR kiosk check-in", "WhatsApp + SMS notifications", "Live queue dashboard", "Basic analytics"],
      highlight: false,
    },
    {
      name: "Professional", price: "RM 89", period: "/mo",
      description: "Growing clinic or multi-staff office.",
      features: ["3 branches", "Customer profiles + AI summaries", "Loyalty punch cards", "SLA alerts + escalation", "Satisfaction scores", "Multi-staff assignment", "Prayer time integration"],
      highlight: true,
    },
    {
      name: "Executive", price: "RM 199", period: "/mo",
      description: "Multi-location enterprise operations.",
      features: ["Unlimited branches", "AI marketing personas", "Autopilot queue pacing", "Freshdesk CRM integration", "Custom document checklists", "Manager intelligence", "Priority support"],
      highlight: false,
    },
  ];

  return (
    <section id="pricing" style={{ padding: "120px 28px", background: "#080807" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 16 }}>Pricing</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.02em", color: "#f0ede6", marginBottom: 12 }}>
            Simple. No surprises.
          </h2>
          <p style={{ fontSize: 14, color: "#4a4845" }}>14-day free trial on every plan. Cancel any time. No card required to start.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.04)" }}>
          {plans.map((p) => (
            <div key={p.name} style={{
              background: p.highlight ? "#0f0e0b" : "#080807",
              padding: "40px 36px",
              display: "flex", flexDirection: "column",
              outline: p.highlight ? "1px solid rgba(201,168,106,0.25)" : "none",
              position: "relative",
            }}>
              {p.highlight && (
                <div style={{
                  position: "absolute", top: 0, left: "50%", transform: "translate(-50%, -50%)",
                  background: "#c9a86a", color: "#080807",
                  fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                  padding: "4px 14px", fontWeight: 600,
                }}>Most popular</div>
              )}

              <div style={{ fontSize: 12, fontWeight: 500, color: "#908e86", marginBottom: 6, letterSpacing: "0.05em" }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 44, fontWeight: 300, color: "#f0ede6", letterSpacing: "-0.02em" }}>{p.price}</span>
                <span style={{ fontSize: 13, color: "#3a3835" }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 11, color: "#3a3835", marginBottom: 32 }}>{p.description}</div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, color: "#6a6760" }}>
                    <span style={{ color: "#c9a86a", flexShrink: 0, marginTop: 1 }}>✦</span> {f}
                  </div>
                ))}
              </div>

              <Link to="/login" style={{
                display: "block", textAlign: "center",
                padding: "14px 0", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                textDecoration: "none", fontWeight: 600, transition: "all 0.15s",
                background: p.highlight ? "#c9a86a" : "transparent",
                color: p.highlight ? "#080807" : "#5a5852",
                border: p.highlight ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
                onMouseEnter={e => {
                  if (p.highlight) { e.currentTarget.style.background = "#d4b87a"; }
                  else { e.currentTarget.style.borderColor = "rgba(201,168,106,0.3)"; e.currentTarget.style.color = "#c9a86a"; }
                }}
                onMouseLeave={e => {
                  if (p.highlight) { e.currentTarget.style.background = "#c9a86a"; }
                  else { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#5a5852"; }
                }}
              >
                Start free
              </Link>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: "#3a3835" }}>
          Customer data stays in your Supabase instance. We never sell or share it.
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   FINAL CTA
══════════════════════════════════════════════════════════════════════ */
function FinalCTA() {
  return (
    <section style={{ padding: "140px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 800, height: 500, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(201,168,106,0.05) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: 680, margin: "0 auto", position: "relative" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a86a", marginBottom: 24 }}>Ready?</div>
        <h2 style={{
          fontFamily: "Georgia, serif",
          fontSize: "clamp(36px, 5vw, 64px)",
          fontWeight: 300, letterSpacing: "-0.025em", lineHeight: 1.1,
          color: "#f0ede6", marginBottom: 20,
        }}>
          Your customers are waiting.<br />
          <span style={{ background: "linear-gradient(135deg, #c9a86a, #e8d5a3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Let's fix that.
          </span>
        </h2>
        <p style={{ fontSize: 15, color: "#4a4845", marginBottom: 52, lineHeight: 1.7 }}>
          Set up in under 10 minutes. Works on any tablet, phone, or laptop.<br />No hardware to buy. No IT team needed.
        </p>
        <Link to="/login" style={{
          display: "inline-block",
          background: "#c9a86a", color: "#080807",
          padding: "18px 48px", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em",
          textDecoration: "none", transition: "all 0.2s",
          boxShadow: "0 0 80px rgba(201,168,106,0.2)",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "#d4b87a"; e.currentTarget.style.boxShadow = "0 0 100px rgba(201,168,106,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#c9a86a"; e.currentTarget.style.boxShadow = "0 0 80px rgba(201,168,106,0.2)"; }}
        >
          Start free — no credit card required
        </Link>
        <div style={{ marginTop: 20, fontSize: 11, color: "#2a2a25" }}>
          14-day trial · Cancel any time · Setup in 10 minutes
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "40px 28px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, background: "#c9a86a", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#080807" }}>A</div>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#3a3835" }}>AzQueue · azqueue.io</span>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          {[["mailto:support@azqueue.io", "Support"], ["#pricing", "Pricing"], ["/login", "Sign in"]].map(([href, label]) => (
            href.startsWith("/") ? (
              <Link key={label} to={href} style={{ color: "#2a2a25", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = "#908e86"}
                onMouseLeave={e => e.target.style.color = "#2a2a25"}>
                {label}
              </Link>
            ) : (
              <a key={label} href={href} style={{ color: "#2a2a25", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = "#908e86"}
                onMouseLeave={e => e.target.style.color = "#2a2a25"}>
                {label}
              </a>
            )
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#2a2a25", letterSpacing: "0.1em" }}>© 2025 AzQueue. All rights reserved.</div>
      </div>
    </footer>
  );
}
