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
  h2:      { fontSize: 32, fontWeight: 500, letterSpacing: "-0.01em",  lineHeight: 1.15, fontFamily: "Georgia, 'Times New Roman', serif" },
  h3:      { fontSize: 22, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3,  fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",   textTransform: "uppercase", color: C.gold },
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

// Each card opens the in-site article. No PDFs, no email "send me the link"
// tricks — every link below routes to /resources/<slug> rendered by
// ResourceArticle.jsx.
const GUIDES = [
  { slug: "science-of-waiting", tag: "OPERATIONS · PSYCHOLOGY", title: "The science of waiting in line",        body: "Why a 5-minute wait can feel like 20 — and what 50 years of research tells you about fixing it.", minutes: "12 min read", featured: true },
  { slug: "setup-guide",         tag: "QUICK START",            title: "Deploy AzQueue in under an hour",       body: "Start to finish — branch, services, staff, kiosk, WhatsApp. The setup playbook.", minutes: "10 min read" },
  { slug: "multi-branch",        tag: "OPERATIONS",             title: "Designing queues for multi-branch teams", body: "How to roll AzQueue out across 5, 50, or 500 branches without losing weekends.", minutes: "11 min read" },
  { slug: "prayer-pause",        tag: "ISLAMIC MODE",           title: "Prayer pause scheduling, end to end",    body: "How auto-pause works, what to configure, and how to think about Ramadan.", minutes: "9 min read" },
  { slug: "queue-analytics",     tag: "ANALYTICS",              title: "Reading the Insights dashboard",         body: "The six metrics that matter, what they mean, and what to do about them.", minutes: "8 min read" },
];

const CASE_STUDIES = [
  { slug: "meridian-health", tag: "HEALTHCARE", title: "Meridian Health: 70% drop in wait complaints", body: "Fourteen clinics replaced paper sign-ins with AzQueue.", stat: "70%" },
  { slug: "nordic-bank",     tag: "BANKING",    title: "Nordic Bank: prayer pause was the deal-maker",  body: "Nine branches live in two weeks. No manual pauses since.", stat: "2 wks" },
  { slug: "caelum-salons",   tag: "BEAUTY",     title: "Caelum Salons: digital loyalty lifted repeats 38%", body: "Switched from plastic punch cards. 90 days later, repeat rate up 38%.", stat: "38%" },
];

export default function Resources() {
  usePageMeta({
    title: "Resources — Guides, Case Studies & Docs · AzQueue",
    description: "AzQueue guides on queue setup, multi-branch rollout, prayer pause, analytics, and the science of waiting. Plus real customer case studies. All readable in-site, no downloads.",
    canonical: "/resources",
  });
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <SiteNav solid />
      <PageHero />
      <FeaturedGuide />
      <GuidesGrid />
      <CaseStudiesGrid />
      <IntegrationCTA />
    </div>
  );
}

function PageHero() {
  return (
    <section style={{ padding: "160px 48px 60px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ ...T.label, marginBottom: 24 }}>Resources</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 60, flexWrap: "wrap" }}>
          <h1 style={{ ...T.display, color: C.ink, margin: 0, maxWidth: 620 }}>
            Guides, case studies,{" "}
            <em style={{ color: C.gold, fontStyle: "italic" }}>and the science of waiting.</em>
          </h1>
          <p style={{ ...T.body, maxWidth: 380, margin: 0 }}>
            Everything we've learned about running queues for service businesses — readable in-site, no downloads, written by people who've done it.
          </p>
        </div>
      </div>
    </section>
  );
}

function FeaturedGuide() {
  const featured = GUIDES.find(g => g.featured) ?? GUIDES[0];
  return (
    <section style={{ padding: "80px 48px 40px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <Link to={`/resources/${featured.slug}`} style={{ display: "block", textDecoration: "none", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", background: "linear-gradient(135deg, #131210 0%, #0c0c0b 100%)", transition: "border-color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.dim ?? "#3a3835"}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "stretch" }}>
            <div style={{ padding: "48px 44px" }}>
              <div style={{ ...T.label, marginBottom: 18 }}>Featured · {featured.tag}</div>
              <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>{featured.title}</h2>
              <p style={{ ...T.body, margin: "0 0 28px", maxWidth: 460 }}>{featured.body}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 12, color: C.goldLit, letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}>Read the guide <Arr /></span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.faint }} />
                <span style={{ fontSize: 11, color: C.muted }}>{featured.minutes}</span>
              </div>
            </div>
            <div style={{ position: "relative", background: "#0a0a09", display: "flex", alignItems: "center", justifyContent: "center", padding: 36, overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 50%, rgba(184,149,90,0.12) 0%, transparent 60%)" }} />
              <div style={{ position: "relative", fontSize: 90, fontFamily: "Georgia, serif", color: C.gold, opacity: 0.5, letterSpacing: "-0.04em" }}>{"⏱"}</div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

function GuidesGrid() {
  const [ref, visible] = useInView();
  const items = GUIDES.filter(g => !g.featured);
  return (
    <section ref={ref} style={{ padding: "60px 48px 80px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0, fontSize: 26 }}>How-to guides</h2>
          <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>{GUIDES.length} guides · updated monthly</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden" }}>
          {items.map((g, i) => (
            <Link key={g.slug} to={`/resources/${g.slug}`} style={{
              background: C.card, padding: "32px 30px", textDecoration: "none", display: "flex", flexDirection: "column",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(10px)",
              transition: `all 0.5s ease ${i * 0.06}s`,
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
              onMouseLeave={e => e.currentTarget.style.background = C.card}>
              <div style={{ fontSize: 9, color: C.gold, letterSpacing: "0.16em", marginBottom: 18, fontWeight: 600 }}>{g.tag}</div>
              <div style={{ fontSize: 18, color: C.ink, lineHeight: 1.3, letterSpacing: "-0.005em", marginBottom: 14, fontWeight: 500, fontFamily: "Georgia, serif" }}>{g.title}</div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 22px", flex: 1 }}>{g.body}</p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10.5, color: C.muted, letterSpacing: "0.04em" }}>{g.minutes}</span>
                <span style={{ color: C.gold }}><Arr /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CaseStudiesGrid() {
  const [ref, visible] = useInView();
  return (
    <section ref={ref} id="case-studies" style={{ padding: "100px 48px", background: C.card, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ ...T.label, marginBottom: 18 }}>Case studies</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>Real teams. Real results.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden" }}>
          {CASE_STUDIES.map((s, i) => (
            <Link key={s.slug} to={`/case-studies/${s.slug}`} style={{
              background: C.void, padding: "32px 28px", textDecoration: "none", display: "flex", flexDirection: "column",
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(10px)",
              transition: `all 0.55s ease ${i * 0.08}s`,
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
              onMouseLeave={e => e.currentTarget.style.background = C.void}>
              <div style={{ fontSize: 9, color: C.gold, letterSpacing: "0.16em", marginBottom: 18, fontWeight: 600 }}>{s.tag}</div>
              <div style={{ fontSize: 18, color: C.ink, lineHeight: 1.3, letterSpacing: "-0.005em", marginBottom: 14, fontWeight: 500, fontFamily: "Georgia, serif" }}>{s.title}</div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 22px", flex: 1 }}>{s.body}</p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 22, color: C.gold, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.stat}</span>
                <span style={{ fontSize: 11, color: C.goldLit, letterSpacing: "0.02em" }}>Read →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationCTA() {
  return (
    <section style={{ padding: "100px 48px", background: C.void, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 36px", opacity: 0.35 }} />
        <div style={{ ...T.label, marginBottom: 20 }}>Custom integration</div>
        <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 16px" }}>
          Need help connecting AzQueue to your stack?
        </h2>
        <p style={{ ...T.body, margin: "0 0 32px" }}>
          From booking systems to BI dashboards, our team can scope and ship custom integrations on Enterprise plans.
        </p>
        <Link to="/support" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em" }}>
          Talk to our team <Arr />
        </Link>
      </div>
    </section>
  );
}
