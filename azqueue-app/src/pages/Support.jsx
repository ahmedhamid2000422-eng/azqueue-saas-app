import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import usePageMeta from "../lib/usePageMeta";

const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  goldLit:"#d4b478",
  muted:  "#60605a",
  faint:  "#2a2926",
  border: "rgba(255,255,255,0.07)",
  borderL:"rgba(255,255,255,0.12)",
  card:   "#0c0c0b",
  panel:  "#111110",
};

const T = {
  display: { fontSize: 52, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.05, fontFamily: "Georgia, 'Times New Roman', serif" },
  h2:      { fontSize: 36, fontWeight: 500, letterSpacing: "-0.01em",  lineHeight: 1.12, fontFamily: "Georgia, 'Times New Roman', serif" },
  h3:      { fontSize: 22, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3,  fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 500, letterSpacing: "0.16em",   textTransform: "uppercase", color: C.gold },
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

const Arr = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

const FAQ = [
  { q: "How do I add a new branch?",
    a: "Open Settings · Branches in the business dashboard, choose Add branch, and assign staff. Each branch gets its own queue, hours and prayer schedule. Setup takes under two minutes per location." },
  { q: "What happens to my queue during prayer time?",
    a: "Islamic Mode auto-pauses the queue ten minutes before each prayer. Customers in line receive an automatic WhatsApp note with the resume time. The queue restarts from the same position — no data lost, no manual reset." },
  { q: "How are customers notified?",
    a: "By WhatsApp, by default. Customers receive three messages: ticket confirmation, a five-minutes-out heads-up, and a you're-next call. SMS and email are available as fallbacks. No app install required." },
  { q: "Can walk-ins and bookings really share one queue?",
    a: "Yes — that's the core of AzQueue. Bookings hold a soft priority window around their slot. Walk-ins fill the gaps. Both streams are ordered fairly by the same engine, so neither group ever feels skipped." },
  { q: "Does Autopilot replace my staff?",
    a: "No. Autopilot just calls the next customer at the right pace. Your staff still serve, greet and decide. Autopilot watches real service time and slows down when you fall behind, speeds up when the queue grows." },
  { q: "Can I export my queue and revenue data?",
    a: "Yes. Insights exports to CSV and PDF on any plan. Growth and Enterprise include API access for custom dashboards and accounting integrations." },
  { q: "What's included in the 14-day trial?",
    a: "Every Growth-tier feature, no card required. You'll be live in under an hour. If you don't choose a plan by day 14 the workspace pauses — your data stays for thirty days." },
  { q: "Do you support multiple languages?",
    a: "The customer-facing flow ships in English, Bahasa Malaysia and Arabic. Staff dashboard adds French and Urdu. Custom translations available on Enterprise." },
  { q: "What SLA do you offer?",
    a: "99.9% production uptime is written into the Enterprise contract, with a 24/7 incident response channel. Starter and Growth tiers run on the same infrastructure but without a contractual guarantee." },
];

const CHANNELS = [
  { tag: "Email",    value: "support@azqueue.io",       sub: "Avg. first response: under 2 hours" },
  { tag: "WhatsApp", value: "+60 12-345 6789",          sub: "Sun–Fri · 09:00–19:00 MYT" },
  { tag: "Sales",    value: "sales@azqueue.io",         sub: "Enterprise & multi-branch inquiries" },
  { tag: "Security", value: "security@azqueue.io",      sub: "Docs, audits, vulnerability reports" },
];

export default function Support() {
  const [openIndex, setOpenIndex] = useState(0);
  usePageMeta({
    title: "Support — Help & Contact · AzQueue",
    description: "Get help with AzQueue. Browse the FAQ, reach support, sales, or security teams directly. Average first response under 2 hours, Monday–Friday MYT.",
    canonical: "/support",
  });
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <SiteNav solid />
      <PageHero />
      <ChannelGrid />
      <FAQSection openIndex={openIndex} setOpenIndex={setOpenIndex} />
      <ContactCTA />
      <SiteFooter />
    </div>
  );
}

function PageHero() {
  return (
    <section style={{ padding: "160px 48px 100px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ ...T.label, marginBottom: 24 }}>Support</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 60, flexWrap: "wrap" }}>
          <h1 style={{ ...T.display, color: C.ink, margin: 0, maxWidth: 560 }}>
            Help, when you need it.{" "}
            <em style={{ color: C.gold, fontStyle: "italic" }}>By people who run AzQueue.</em>
          </h1>
          <p style={{ ...T.body, maxWidth: 380, margin: 0 }}>
            Browse the answers below, reach the right team directly, or open a dedicated support thread from your dashboard.
          </p>
        </div>
      </div>
    </section>
  );
}

function ChannelGrid() {
  const [ref, visible] = useInView();
  return (
    <section ref={ref} style={{ padding: "80px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          {CHANNELS.map((c, i) => (
            <a key={c.tag} href={c.value.includes("@") ? `mailto:${c.value}` : `https://wa.me/${c.value.replace(/\D/g, "")}`} style={{
              background: C.card, padding: "32px 28px", textDecoration: "none",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(10px)",
              transition: `all 0.5s ease ${i * 0.07}s`, display: "block",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
              onMouseLeave={e => e.currentTarget.style.background = C.card}>
              <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.16em", marginBottom: 14, fontWeight: 600, textTransform: "uppercase" }}>{c.tag}</div>
              <div style={{ fontSize: 15, color: C.ink, marginBottom: 6, letterSpacing: "-0.005em" }}>{c.value}</div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.02em" }}>{c.sub}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection({ openIndex, setOpenIndex }) {
  const [ref, visible] = useInView(0.06);
  return (
    <section ref={ref} style={{ padding: "100px 48px 120px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "320px 1fr", gap: 80, alignItems: "flex-start" }}>
        <div style={{ position: "sticky", top: 100 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Frequently asked</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>Questions, answered.</h2>
          <p style={{ ...T.body, margin: "0 0 28px", fontSize: 14 }}>
            The most common questions from owners, managers, and operators evaluating AzQueue.
          </p>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>{FAQ.length} entries · updated weekly</div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}>
          {FAQ.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={item.q} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                  style={{
                    width: "100%", textAlign: "left", padding: "24px 0",
                    background: "transparent", border: "none", cursor: "pointer",
                    display: "grid", gridTemplateColumns: "32px 1fr 24px", gap: 16,
                    alignItems: "center", color: "inherit",
                  }}>
                  <span style={{ fontSize: 11, color: C.gold, fontFamily: "monospace", letterSpacing: "0.08em" }}>{String(idx + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 15, color: isOpen ? C.ink : "#a09c93", letterSpacing: "-0.005em", transition: "color 0.2s" }}>{item.q}</span>
                  <span style={{ fontSize: 18, color: isOpen ? C.gold : C.muted, transition: "all 0.2s", transform: isOpen ? "rotate(45deg)" : "none", fontFamily: "Georgia, serif", lineHeight: 1, justifySelf: "end" }}>+</span>
                </button>
                {isOpen && (
                  <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 24px", gap: 16, paddingBottom: 24 }}>
                    <span />
                    <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0, maxWidth: 620 }}>{item.a}</p>
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

function ContactCTA() {
  return (
    <section style={{ padding: "120px 48px", background: C.void, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 48px", opacity: 0.35 }} />
        <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>Still stuck?</h2>
        <p style={{ ...T.body, margin: "0 0 40px" }}>Open a support ticket from your dashboard, or drop us a line. We read every message.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/select" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em", transition: "all 0.2s ease" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Open support ticket <Arr />
          </Link>
          <a href="mailto:support@azqueue.io" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "transparent", color: C.ink, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.borderL}`, letterSpacing: "0.01em", transition: "all 0.2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.goldLit; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderL; e.currentTarget.style.color = C.ink; }}>
            Email support
          </a>
        </div>
      </div>
    </section>
  );
}
