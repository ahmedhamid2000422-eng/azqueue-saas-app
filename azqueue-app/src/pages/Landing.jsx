import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────────────────────
   AzQueue Landing — "Da Vinci" edition
   Every pixel earns its place. Every word does work.
───────────────────────────────────────────────────────────────────────────── */

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0e0e0b] text-[#f5f3ee] font-sans overflow-x-hidden">
      <Nav />
      <Hero />
      <FlowSection />
      <KioskSection />
      <FeaturesSection />
      <ForSection />
      <SocialProof />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ── Nav ───────────────────────────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0e0e0b]/95 backdrop-blur border-b border-white/5" : ""}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#c9a86a] rounded flex items-center justify-center font-serif text-[#0e0e0b] text-sm font-bold shadow-[0_0_20px_rgba(201,168,106,0.35)]">
            A
          </div>
          <span className="font-serif text-base tracking-tight text-[#f5f3ee]">AzQueue</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.18em] uppercase text-[#908e86]">
          <a href="#how" className="hover:text-[#f5f3ee] transition">How it works</a>
          <a href="#features" className="hover:text-[#f5f3ee] transition">Features</a>
          <a href="#pricing" className="hover:text-[#f5f3ee] transition">Pricing</a>
        </div>
        <Link
          to="/login"
          className="text-[11px] tracking-[0.18em] uppercase bg-[#c9a86a] text-[#0e0e0b] px-4 py-2 font-medium hover:bg-[#d4b87a] transition"
        >
          Start free
        </Link>
      </div>
    </nav>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="pt-36 pb-20 px-6 text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase text-[#c9a86a] border border-[#c9a86a]/30 px-3 py-1.5 mb-10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#c9a86a] animate-pulse" />
        Walk-in queue management
      </div>

      <h1 className="font-serif font-light text-5xl md:text-7xl tracking-tight leading-[1.08] mb-6 text-[#f5f3ee]">
        Your walk-in queue,<br />
        <span style={{ background: "linear-gradient(135deg, #c9a86a, #e8d5a3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          on autopilot.
        </span>
      </h1>

      <p className="text-lg md:text-xl text-[#908e86] max-w-2xl mx-auto leading-relaxed mb-4">
        Customers scan a QR code, check in on an iPad, and get WhatsApp or SMS updates when it's their turn.
        No paper. No shouting names. No confusion.
      </p>

      <p className="text-sm text-[#5e5c57] mb-12">
        Built for clinics, law firms, government counters, salons & repair shops across Malaysia, MENA and Africa.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/login"
          className="inline-block bg-[#c9a86a] text-[#0e0e0b] px-8 py-4 text-sm font-semibold tracking-wide hover:bg-[#d4b87a] transition shadow-[0_0_40px_rgba(201,168,106,0.25)]"
        >
          Start free — no credit card
        </Link>
        <a
          href="#how"
          className="inline-block border border-white/10 text-[#908e86] px-8 py-4 text-sm tracking-wide hover:border-white/20 hover:text-[#f5f3ee] transition"
        >
          See how it works ↓
        </a>
      </div>

      {/* Trust bar */}
      <div className="mt-16 flex flex-wrap justify-center gap-8 text-[11px] tracking-[0.15em] uppercase text-[#5e5c57]">
        {["Multilingual kiosk", "WhatsApp + SMS", "Real-time dashboard", "Prayer time aware", "iPad ready"].map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="text-[#c9a86a]">✦</span> {t}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ── Flow Section ──────────────────────────────────────────────────────────── */
function FlowSection() {
  const steps = [
    { n: "01", icon: "🚶", title: "Customer walks in", sub: "Sees a QR code at reception" },
    { n: "02", icon: "📱", title: "Self-check-in", sub: "iPad kiosk or personal phone — 30 seconds" },
    { n: "03", icon: "💬", title: "Instant confirmation", sub: "WhatsApp or SMS ticket sent automatically" },
    { n: "04", icon: "⏱", title: "Wait anywhere", sub: "Live position updates on their phone" },
    { n: "05", icon: "✅", title: "Called when ready", sub: "Staff tap one button — customer gets notified" },
  ];

  return (
    <section id="how" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-[10px] tracking-[0.25em] uppercase text-[#c9a86a] mb-4">The workflow</div>
          <h2 className="font-serif text-4xl font-light tracking-tight text-[#f5f3ee]">
            Five steps. Zero friction.
          </h2>
          <p className="text-[#908e86] mt-3 text-sm max-w-lg mx-auto">
            From walk-in to walk-out, every touchpoint is handled. Staff focus on the work, not the queue.
          </p>
        </div>

        {/* Desktop: horizontal flow */}
        <div className="hidden md:flex items-start gap-0">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center text-center relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-[#c9a86a]/40 to-[#c9a86a]/10 z-0" />
              )}
              <div className="relative z-10 w-16 h-16 rounded-full bg-[#1a1a16] border border-[#c9a86a]/30 flex items-center justify-center text-2xl mb-5 shadow-[0_0_30px_rgba(201,168,106,0.1)]">
                {s.icon}
              </div>
              <div className="text-[9px] tracking-[0.2em] uppercase text-[#c9a86a] mb-1">{s.n}</div>
              <div className="text-sm font-medium text-[#f5f3ee] mb-1 px-2">{s.title}</div>
              <div className="text-[11px] text-[#5e5c57] px-3 leading-relaxed">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Mobile: vertical flow */}
        <div className="md:hidden flex flex-col gap-0 max-w-sm mx-auto">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#1a1a16] border border-[#c9a86a]/30 flex items-center justify-center text-xl shrink-0">
                  {s.icon}
                </div>
                {i < steps.length - 1 && <div className="w-px flex-1 min-h-[2rem] bg-[#c9a86a]/20 my-1" />}
              </div>
              <div className="pt-2.5 pb-6">
                <div className="text-[9px] tracking-[0.2em] uppercase text-[#c9a86a] mb-0.5">{s.n}</div>
                <div className="text-sm font-medium text-[#f5f3ee]">{s.title}</div>
                <div className="text-[11px] text-[#5e5c57] mt-0.5 leading-relaxed">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Kiosk Mockup Section ──────────────────────────────────────────────────── */
function KioskSection() {
  return (
    <section className="py-20 px-6 bg-[#111109]">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">

        {/* Left: copy */}
        <div>
          <div className="text-[10px] tracking-[0.25em] uppercase text-[#c9a86a] mb-4">The kiosk</div>
          <h2 className="font-serif text-4xl font-light tracking-tight text-[#f5f3ee] mb-5">
            A reception desk<br />that never clocks out.
          </h2>
          <p className="text-[#908e86] text-sm leading-relaxed mb-8">
            Mount a tablet at your entrance. Customers pick their service, type their name and phone number, and receive a WhatsApp or SMS ticket in seconds. No staff needed at the door.
          </p>
          <div className="space-y-3">
            {[
              "Works in English, Bahasa, Arabic, Chinese, Tamil & Urdu",
              "Large-touch kiosk mode for iPad",
              "Auto-resets after each check-in",
              "Sends confirmation instantly via WhatsApp or SMS",
            ].map((f) => (
              <div key={f} className="flex items-start gap-3 text-sm text-[#908e86]">
                <span className="text-[#c9a86a] mt-0.5 shrink-0">✦</span>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Right: iPad mockup */}
        <div className="flex justify-center">
          <div className="relative">
            {/* iPad frame */}
            <div className="w-64 bg-[#1c1c18] rounded-[2rem] border-[6px] border-[#2a2a24] shadow-[0_40px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(201,168,106,0.08)] p-3">
              {/* Home button area */}
              <div className="w-8 h-1 bg-[#2a2a24] rounded-full mx-auto mb-2" />
              {/* Screen */}
              <div className="bg-[#0e0e0b] rounded-xl overflow-hidden aspect-[3/4]">
                {/* Header */}
                <div className="bg-[#141410] px-4 py-3 flex items-center gap-2 border-b border-white/5">
                  <div className="w-5 h-5 bg-[#c9a86a] rounded flex items-center justify-center text-[8px] font-bold text-[#0e0e0b]">A</div>
                  <span className="text-[10px] text-[#f5f3ee] font-serif">AzQueue</span>
                </div>
                {/* Content */}
                <div className="p-4">
                  <div className="text-[8px] tracking-[0.2em] uppercase text-[#c9a86a] mb-1">Walk-in</div>
                  <div className="font-serif text-sm text-[#f5f3ee] mb-4">Klinik Sejahtera</div>
                  {/* Services */}
                  {["General Consultation", "Vaccination", "Blood Test"].map((svc, i) => (
                    <div key={svc} className={`flex items-center gap-2 px-3 py-2 mb-1 rounded text-[9px] ${i === 0 ? "bg-[#c9a86a]/10 border border-[#c9a86a]/30 text-[#c9a86a]" : "bg-[#1a1a16] text-[#908e86]"}`}>
                      <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-[#c9a86a]" : "border border-[#3a3a34]"}`} />
                      {svc}
                    </div>
                  ))}
                  <div className="mt-4 space-y-2">
                    <div className="bg-[#1a1a16] rounded px-3 py-2 text-[8px] text-[#5e5c57]">Your name…</div>
                    <div className="bg-[#1a1a16] rounded px-3 py-2 text-[8px] text-[#5e5c57]">+60 phone number…</div>
                  </div>
                  <div className="mt-4 bg-[#c9a86a] rounded text-center py-2 text-[9px] font-semibold text-[#0e0e0b]">
                    Check in →
                  </div>
                </div>
              </div>
              <div className="w-8 h-1 bg-[#2a2a24] rounded-full mx-auto mt-2" />
            </div>

            {/* Floating SMS bubble */}
            <div className="absolute -right-10 top-12 bg-[#25d366] text-[#0e0e0b] rounded-2xl rounded-tl-sm px-4 py-3 shadow-xl text-[10px] w-44 leading-snug">
              <div className="font-semibold mb-0.5">Klinik Sejahtera</div>
              You're in! Ticket <span className="font-mono font-bold">A-07</span>. We'll WhatsApp when you're up. 🎫
            </div>

            {/* Floating ticket */}
            <div className="absolute -left-8 bottom-16 bg-[#1a1a16] border border-[#c9a86a]/30 rounded-xl px-4 py-3 shadow-xl text-center">
              <div className="text-[8px] tracking-[0.2em] uppercase text-[#c9a86a] mb-1">Your ticket</div>
              <div className="font-serif text-3xl text-[#c9a86a] leading-none">A-07</div>
              <div className="text-[8px] text-[#5e5c57] mt-1">3 ahead · ~12m</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Features ──────────────────────────────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: "📊",
      title: "Live staff dashboard",
      body: "Call the next customer with one tap. Reassign tickets, manage lanes, track wait times — all in real time.",
    },
    {
      icon: "💬",
      title: "WhatsApp & SMS built in",
      body: "Confirmation, call notice, and thank-you messages are sent automatically. No manual messaging.",
    },
    {
      icon: "🧠",
      title: "AI customer profiles",
      body: "Every visitor gets a profile: visit history, satisfaction scores, and an AI-generated staff briefing before they sit down.",
    },
    {
      icon: "🕌",
      title: "Prayer time aware",
      body: "Queue auto-pauses before each prayer and resumes after. Customers are notified. Zero awkwardness.",
    },
    {
      icon: "🎫",
      title: "Loyalty punch cards",
      body: "Customers earn a punch every visit. When they hit the goal, staff see the reward and can redeem it in one tap.",
    },
    {
      icon: "📈",
      title: "Autopilot pacing",
      body: "The system learns your service speed and adjusts call timing automatically — no manual throttling.",
    },
  ];

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-[10px] tracking-[0.25em] uppercase text-[#c9a86a] mb-4">What's included</div>
          <h2 className="font-serif text-4xl font-light tracking-tight text-[#f5f3ee]">
            Everything a busy service desk needs.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-white/5">
          {features.map((f) => (
            <div key={f.title} className="bg-[#0e0e0b] p-8 hover:bg-[#111109] transition group">
              <div className="text-3xl mb-5">{f.icon}</div>
              <h3 className="text-sm font-semibold text-[#f5f3ee] mb-2 group-hover:text-[#c9a86a] transition">{f.title}</h3>
              <p className="text-[12px] text-[#5e5c57] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── For Section ───────────────────────────────────────────────────────────── */
function ForSection() {
  const industries = [
    "Government counters", "Clinics & hospitals", "Law firms",
    "Salons & barbershops", "Repair shops", "Banks",
    "Immigration offices", "Pharmacies", "Welfare centres",
  ];

  return (
    <section className="py-20 px-6 bg-[#111109]">
      <div className="max-w-4xl mx-auto text-center">
        <div className="text-[10px] tracking-[0.25em] uppercase text-[#c9a86a] mb-4">Who uses AzQueue</div>
        <h2 className="font-serif text-4xl font-light tracking-tight text-[#f5f3ee] mb-3">
          Any business where people wait.
        </h2>
        <p className="text-[#908e86] text-sm mb-10">
          Especially in Malaysia, GCC, and Sub-Saharan Africa — where walk-in services are the norm and multilingual counters are a daily reality.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {industries.map((ind) => (
            <span key={ind} className="text-[11px] tracking-wide border border-white/10 text-[#908e86] px-4 py-2 hover:border-[#c9a86a]/40 hover:text-[#c9a86a] transition cursor-default">
              {ind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Social Proof ──────────────────────────────────────────────────────────── */
function SocialProof() {
  const quotes = [
    { q: "We cut our reception workload by half the first week. Customers stopped crowding the door.", name: "Dr. Aisha R.", role: "Clinic owner, KL" },
    { q: "The WhatsApp notifications are the feature. Patients wait in their cars now instead of our waiting room.", name: "Hassan M.", role: "Practice manager, Dubai" },
    { q: "Finally something built for how our customers actually behave.", name: "Priya K.", role: "Salon owner, Penang" },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-[10px] tracking-[0.25em] uppercase text-[#c9a86a] mb-4">From the field</div>
          <h2 className="font-serif text-3xl font-light tracking-tight text-[#f5f3ee]">
            Businesses that switched to AzQueue.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {quotes.map((q) => (
            <div key={q.name} className="border border-white/8 p-7 bg-[#111109]">
              <div className="text-[#c9a86a] text-xl mb-4 font-serif">"</div>
              <p className="text-sm text-[#c0bdb5] leading-relaxed mb-6">{q.q}</p>
              <div className="border-t border-white/5 pt-4">
                <div className="text-xs font-medium text-[#f5f3ee]">{q.name}</div>
                <div className="text-[10px] text-[#5e5c57] mt-0.5">{q.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ───────────────────────────────────────────────────────────────── */
function Pricing() {
  const plans = [
    {
      name: "Essential",
      price: "RM 29",
      period: "/mo",
      description: "Solo practice or small shop.",
      features: ["1 branch", "Unlimited tickets", "QR check-in kiosk", "WhatsApp + SMS", "Basic dashboard"],
      cta: "Start free",
      highlight: false,
    },
    {
      name: "Professional",
      price: "RM 89",
      period: "/mo",
      description: "Growing clinic or office.",
      features: ["3 branches", "Customer profiles + AI", "Loyalty punch cards", "Multi-staff dashboard", "SLA alerts", "Satisfaction scores"],
      cta: "Start free",
      highlight: true,
    },
    {
      name: "Executive",
      price: "RM 199",
      period: "/mo",
      description: "Multi-location operations.",
      features: ["Unlimited branches", "AI marketing personas", "Autopilot pacing", "Prayer time integration", "Freshdesk CRM sync", "Priority support"],
      cta: "Start free",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6 bg-[#111109]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-[10px] tracking-[0.25em] uppercase text-[#c9a86a] mb-4">Pricing</div>
          <h2 className="font-serif text-4xl font-light tracking-tight text-[#f5f3ee]">Simple. No surprises.</h2>
          <p className="text-[#908e86] text-sm mt-2">14-day free trial on all plans. Cancel any time.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-white/5">
          {plans.map((p) => (
            <div key={p.name} className={`p-8 flex flex-col ${p.highlight ? "bg-[#181812] ring-1 ring-[#c9a86a]/40" : "bg-[#0e0e0b]"}`}>
              {p.highlight && (
                <div className="text-[9px] tracking-[0.2em] uppercase text-[#c9a86a] mb-4">Most popular</div>
              )}
              <div className="text-sm font-semibold text-[#f5f3ee] mb-1">{p.name}</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-serif text-4xl font-light text-[#f5f3ee]">{p.price}</span>
                <span className="text-[#5e5c57] text-sm">{p.period}</span>
              </div>
              <div className="text-[11px] text-[#5e5c57] mb-6">{p.description}</div>
              <div className="space-y-2.5 flex-1 mb-8">
                {p.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-[12px] text-[#908e86]">
                    <span className="text-[#c9a86a] mt-0.5 shrink-0">✦</span> {f}
                  </div>
                ))}
              </div>
              <Link
                to="/login"
                className={`text-center text-[11px] tracking-[0.18em] uppercase py-3 transition ${
                  p.highlight
                    ? "bg-[#c9a86a] text-[#0e0e0b] hover:bg-[#d4b87a]"
                    : "border border-white/10 text-[#908e86] hover:border-[#c9a86a]/40 hover:text-[#c9a86a]"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ─────────────────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-28 px-6 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-serif text-5xl font-light tracking-tight text-[#f5f3ee] mb-5">
          Your customers are waiting.<br />
          <span style={{ background: "linear-gradient(135deg, #c9a86a, #e8d5a3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Let's fix that.
          </span>
        </h2>
        <p className="text-[#908e86] text-sm mb-10">
          Set up in under 10 minutes. Works on any tablet, phone, or laptop. No hardware needed.
        </p>
        <Link
          to="/login"
          className="inline-block bg-[#c9a86a] text-[#0e0e0b] px-10 py-4 text-sm font-semibold tracking-wide hover:bg-[#d4b87a] transition shadow-[0_0_60px_rgba(201,168,106,0.2)]"
        >
          Start free — no credit card required
        </Link>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] tracking-[0.15em] uppercase text-[#3a3a34]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#c9a86a] rounded flex items-center justify-center text-[#0e0e0b] text-[8px] font-bold">A</div>
          <span>AzQueue · azqueue.io</span>
        </div>
        <div className="flex gap-8">
          <a href="mailto:support@azqueue.io" className="hover:text-[#908e86] transition">Support</a>
          <Link to="/login" className="hover:text-[#908e86] transition">Sign in</Link>
        </div>
        <div>© 2025 AzQueue. All rights reserved.</div>
      </div>
    </footer>
  );
}
