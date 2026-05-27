import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import usePageMeta from "../lib/usePageMeta";

const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  muted:  "#60605a",
  faint:  "#2a2926",
  border: "rgba(255,255,255,0.07)",
  card:   "#0c0c0b",
  panel:  "#111110",
  dim:    "#3a3835",
};

const T = {
  display: { fontSize: 46, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.1, fontFamily: "Georgia, 'Times New Roman', serif" },
  h2:      { fontSize: 34, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.15, fontFamily: "Georgia, 'Times New Roman', serif" },
  h3:      { fontSize: 20, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3, fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold },
  body:    { fontSize: 15, fontWeight: 400, lineHeight: 1.7, letterSpacing: "-0.005em", color: C.muted },
};

function useInView(threshold = 0.1) {
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

const Ic = {
  Arr: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
};

const INDUSTRIES = [
  {
    name: "Medical clinics",
    tagline: "Designed for high-volume patient flow.",
    body: "Manage general, specialist, lab, and pharmacy queues from one dashboard. Prayer pause keeps the flow respectful and compliant.",
    features: ["Multi-service queues", "Prayer pause scheduling", "Patient WhatsApp updates", "Wait time estimation"],
    stat: { value: "40%", label: "avg. reduction in perceived wait time" },
  },
  {
    name: "Government offices",
    tagline: "Built for public-sector scale.",
    body: "From passport offices to municipal services, AzQueue handles high foot traffic without chaos. Supports Arabic, English, and 4 more languages.",
    features: ["Multilingual interface", "High-volume throughput", "Multi-counter routing", "Real-time occupancy tracking"],
    stat: { value: "6", label: "languages supported out of the box" },
  },
  {
    name: "Banks & finance",
    tagline: "A better experience for your members.",
    body: "Replace the numbered ticket machine with a modern kiosk. Customers check in on their phone and wait comfortably — notified the moment they're next.",
    features: ["Mobile check-in option", "Priority queuing", "Service type routing", "Loyalty punch cards"],
    stat: { value: "92%", label: "customer satisfaction score" },
  },
  {
    name: "Pharmacies",
    tagline: "Keep prescriptions flowing.",
    body: "Separate queues for collection, consultation, and over-the-counter. Staff see the full picture and can manage capacity in real time.",
    features: ["Service-type separation", "Staff dashboard", "SMS notifications", "Queue hold & resume"],
    stat: { value: "3x", label: "faster average service completion" },
  },
  {
    name: "Service centers",
    tagline: "For workshops, showrooms, and repair shops.",
    body: "Check in on arrival, wait in your car, and get called in via WhatsApp. No crowded waiting rooms, no frustration.",
    features: ["Remote wait (wait in car)", "Two-way WhatsApp", "Appointment + walk-in mix", "Multi-bay routing"],
    stat: { value: "8 min", label: "average wait time reduction" },
  },
  {
    name: "Telecom providers",
    tagline: "Match service time to demand.",
    body: "Route customers to the right specialist instantly. Measure queue load per service type and staff accordingly.",
    features: ["Specialist routing", "Peak hour analytics", "Staff allocation insights", "Customer satisfaction tracking"],
    stat: { value: "28%", label: "improvement in staff utilization" },
  },
];

export default function Industries() {
  usePageMeta({
    title: "Industries — Queue Software for Clinics, Banks, Salons & More · AzQueue",
    description: "AzQueue is built for high-traffic service businesses: medical clinics, banks, government offices, pharmacies, service centers, telecom, and salons. See how each industry uses AzQueue.",
    canonical: "/industries",
  });
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <SiteNav solid />
      <PageHero />
      <IndustryGrid />
      <UniversalFeatures />
      <IndustriesCTA />
      <SiteFooter />
    </div>
  );
}

function PageHero() {
  return (
    <section style={{ padding: "160px 48px 100px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ ...T.label, marginBottom: 24 }}>Industries</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 60, flexWrap: "wrap" }}>
          <h1 style={{ ...T.display, color: C.ink, margin: 0, maxWidth: 520 }}>
            Built for businesses<br />
            <em style={{ color: C.gold, fontStyle: "italic" }}>where time matters.</em>
          </h1>
          <p style={{ ...T.body, maxWidth: 360, margin: 0 }}>
            AzQueue adapts to the specific demands of your industry — from the waiting room to the workshop floor.
          </p>
        </div>
      </div>
    </section>
  );
}

function IndustryGrid() {
  const [ref, visible] = useInView(0.06);
  return (
    <section ref={ref} style={{ padding: "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
          {INDUSTRIES.map((ind, i) => (
            <div key={i} style={{
              background: C.card, padding: "48px 40px",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)",
              transition: `all 0.55s ease ${i * 0.08}s`,
              display: "flex", flexDirection: "column",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#101010"}
              onMouseLeave={e => e.currentTarget.style.background = C.card}>
              <div style={{ marginBottom: "auto" }}>
                <h3 style={{ ...T.h3, color: C.ink, margin: "0 0 6px" }}>{ind.name}</h3>
                <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.04em", marginBottom: 20 }}>{ind.tagline}</div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, margin: "0 0 28px" }}>{ind.body}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
                  {ind.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 3, height: 3, borderRadius: "50%", background: C.gold, flexShrink: 0, opacity: 0.6 }} />
                      <span style={{ fontSize: 12, color: C.muted }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, marginTop: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{ind.stat.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{ind.stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UniversalFeatures() {
  const [ref, visible] = useInView();
  const items = [
    { title: "Works in any language", body: "Arabic, English, Malay, Urdu, French, and more. Every customer sees the interface in their language." },
    { title: "Prayer-time aware",     body: "Built-in prayer pause scheduling with automatic resume. Designed for Muslim-majority markets." },
    { title: "No app. No friction.",  body: "Customers check in on the kiosk and get WhatsApp updates. Nothing to download, nothing to sign up for." },
    { title: "One system, any scale", body: "From a single-room clinic to a 50-branch network — the same system, configured for your context." },
  ];
  return (
    <section ref={ref} style={{ padding: "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 72 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Universal capabilities</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>The same system.<br />Adapted to your context.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {items.map((item, i) => (
            <div key={i} style={{ background: C.void, padding: "48px 44px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.5s ease ${i * 0.1}s` }}>
              <div style={{ width: 28, height: 1, background: C.gold, marginBottom: 28, opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 10, letterSpacing: "-0.01em" }}>{item.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{item.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IndustriesCTA() {
  return (
    <section style={{ padding: "120px 48px", background: C.void }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 48px", opacity: 0.35 }} />
        <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>
          Don't see your industry?
        </h2>
        <p style={{ ...T.body, margin: "0 0 40px" }}>
          AzQueue is flexible enough for any service business. If customers wait in line, we can help.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.gold, color: C.void, padding: "12px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all 0.2s ease" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Try for free <Ic.Arr />
          </Link>
          <Link to="/support" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: C.muted, padding: "12px 24px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.border}`, transition: "all 0.2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.dim; e.currentTarget.style.color = C.ink; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
