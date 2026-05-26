import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
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
const Book = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
const Code = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const Flag = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;

const CHANNELS = [
  { icon: <Book />, title: "Documentation", body: "Step-by-step setup, staff onboarding playbooks, and operational checklists for every plan tier.", cta: "Browse docs" },
  { icon: <Code />, title: "API reference",  body: "Queue webhooks, branch data, reporting payloads. Build custom dashboards and integrations.", cta: "Read API docs" },
  { icon: <Flag />, title: "Release notes",  body: "Every shipped feature, fix, and service improvement — versioned and timestamped.", cta: "See changelog" },
];

const GUIDES = [
  { tag: "QUICK START",   title: "Deploy AzQueue in under an hour",         body: "Set up your first branch, kiosk, and WhatsApp notifications.", minutes: "12 min read" },
  { tag: "INTEGRATIONS",  title: "Connect AzQueue to your existing stack",   body: "Webhooks for booking systems, accounting, and BI dashboards.",   minutes: "8 min read" },
  { tag: "OPERATIONS",    title: "Designing a queue for multi-branch teams", body: "Routing, priority, and staffing for networks of 5+ locations.",  minutes: "15 min read" },
  { tag: "ISLAMIC MODE",  title: "Prayer pause scheduling, end to end",       body: "How auto-pause works, how to customize windows, and edge cases.", minutes: "10 min read" },
  { tag: "ANALYTICS",     title: "Reading the Insights dashboard",            body: "Wait time, throughput, satisfaction — what the numbers mean.",   minutes: "9 min read" },
  { tag: "SECURITY",      title: "Roles, audit logs, and SSO",                 body: "How RBAC, audit trails, and SAML/Google SSO work end-to-end.",  minutes: "11 min read" },
];

export default function Resources() {
  usePageMeta({
    title: "Resources — AzQueue Documentation, Guides & API",
    description: "Setup guides, API reference, integration playbooks, and operations resources for AzQueue. Deploy in under an hour. Connect AzQueue to your booking system, BI tools, or accounting stack.",
    canonical: "/resources",
  });
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <SiteNav solid />
      <PageHero />
      <Channels />
      <Library />
      <IntegrationCTA />
    </div>
  );
}

function PageHero() {
  return (
    <section style={{ padding: "160px 48px 100px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ ...T.label, marginBottom: 24 }}>Resources</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 60, flexWrap: "wrap" }}>
          <h1 style={{ ...T.display, color: C.ink, margin: 0, maxWidth: 560 }}>
            Learn faster.{" "}
            <em style={{ color: C.gold, fontStyle: "italic" }}>Ship sooner.</em>
          </h1>
          <p style={{ ...T.body, maxWidth: 380, margin: 0 }}>
            Built for busy operators: quick setup, clean integration, and a clear path from launch to reliable, daily service.
          </p>
        </div>
      </div>
    </section>
  );
}

function Channels() {
  const [ref, visible] = useInView();
  return (
    <section ref={ref} style={{ padding: "100px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {CHANNELS.map((c, i) => (
            <div key={c.title} style={{ background: C.card, padding: "44px 36px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.55s ease ${i * 0.08}s`, display: "flex", flexDirection: "column" }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: "rgba(184,149,90,0.08)", border: `1px solid rgba(184,149,90,0.2)`, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26 }}>{c.icon}</div>
              <div style={{ ...T.h3, color: C.ink, marginBottom: 12 }}>{c.title}</div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, margin: "0 0 28px", flex: 1 }}>{c.body}</p>
              <a href="#library" style={{ fontSize: 12, color: C.goldLit, textDecoration: "none", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                {c.cta} <Arr />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Library() {
  const [ref, visible] = useInView();
  return (
    <section id="library" ref={ref} style={{ padding: "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>Library</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>The guides operators read first.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {GUIDES.map((g, i) => (
            <a key={g.title} href="mailto:support@azqueue.io" style={{
              background: C.void, padding: "32px 28px", textDecoration: "none",
              display: "flex", flexDirection: "column",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(10px)",
              transition: `all 0.5s ease ${i * 0.06}s`,
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
              onMouseLeave={e => e.currentTarget.style.background = C.void}>
              <div style={{ fontSize: 9, color: C.gold, letterSpacing: "0.16em", marginBottom: 18, fontWeight: 600 }}>{g.tag}</div>
              <div style={{ fontSize: 16, color: C.ink, lineHeight: 1.35, letterSpacing: "-0.005em", marginBottom: 12, fontWeight: 500 }}>{g.title}</div>
              <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, margin: "0 0 24px", flex: 1 }}>{g.body}</p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10.5, color: C.muted, letterSpacing: "0.04em" }}>{g.minutes}</span>
                <span style={{ color: C.gold }}><Arr /></span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationCTA() {
  return (
    <section style={{ padding: "120px 48px", background: C.void, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 48px", opacity: 0.35 }} />
        <div style={{ ...T.label, marginBottom: 20 }}>Custom integration</div>
        <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>
          Connect AzQueue to your stack.{" "}
          <em style={{ color: C.gold, fontStyle: "italic" }}>We'll help.</em>
        </h2>
        <p style={{ ...T.body, margin: "0 0 40px" }}>
          From booking systems to internal BI dashboards, our team can scope and ship a custom integration on Enterprise plans.
        </p>
        <a href="mailto:integrations@azqueue.io?subject=Custom%20integration%20request" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em", transition: "all 0.2s ease" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          Request integration support <Arr />
        </a>
      </div>
    </section>
  );
}
