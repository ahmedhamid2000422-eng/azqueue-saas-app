import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";

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
  dim:    "#3a3835",
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

const PILLARS = [
  { title: "Mission",  body: "Make queues feel fair, transparent, and efficient — for every customer, in every market." },
  { title: "Vision",   body: "Bring queue intelligence to service teams across Southeast Asia, the Middle East, and beyond." },
  { title: "Values",   body: "Trust, speed, respect, and a premium experience — for both staff and customers." },
];

const STATS = [
  { value: "200+",    label: "Branches live" },
  { value: "12",      label: "Countries served" },
  { value: "6",       label: "Languages built-in" },
  { value: "99.9%",   label: "Production uptime" },
];

const ROLES = [
  { role: "Product Operations Lead",       loc: "Remote · Full-time" },
  { role: "Customer Success Specialist",   loc: "Kuala Lumpur · Full-time" },
  { role: "Senior Frontend Engineer",      loc: "Remote · Full-time" },
  { role: "Enterprise Account Executive",  loc: "Dubai · Full-time" },
];

export default function Company() {
  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <SiteNav solid />
      <PageHero />
      <StatBand />
      <Pillars />
      <AboutSplit />
      <Careers />
      <PageCTA />
    </div>
  );
}

function PageHero() {
  return (
    <section style={{ padding: "160px 48px 100px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ ...T.label, marginBottom: 24 }}>Company</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 60, flexWrap: "wrap" }}>
          <h1 style={{ ...T.display, color: C.ink, margin: 0, maxWidth: 560 }}>
            Built for the live world.{" "}
            <em style={{ color: C.gold, fontStyle: "italic" }}>For people who wait.</em>
          </h1>
          <p style={{ ...T.body, maxWidth: 380, margin: 0 }}>
            AzQueue is a service operations platform for clinics, banks, public-sector offices, and halal-first brands that need clear, calm customer flow at scale.
          </p>
        </div>
      </div>
    </section>
  );
}

function StatBand() {
  return (
    <section style={{ padding: "80px 48px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          {STATS.map(s => (
            <div key={s.label} style={{ background: C.void, padding: "36px 28px", textAlign: "center" }}>
              <div style={{ fontSize: 38, fontWeight: 400, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 10 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const [ref, visible] = useInView();
  return (
    <section ref={ref} style={{ padding: "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ ...T.label, marginBottom: 20 }}>What we stand for</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>Three principles.<br />Every decision, every day.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 14, overflow: "hidden" }}>
          {PILLARS.map((p, i) => (
            <div key={p.title} style={{ background: C.card, padding: "44px 36px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: `all 0.55s ease ${i * 0.08}s` }}>
              <div style={{ width: 28, height: 1, background: C.gold, marginBottom: 28, opacity: 0.5 }} />
              <div style={{ ...T.h3, color: C.ink, marginBottom: 12 }}>{p.title}</div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSplit() {
  return (
    <section style={{ padding: "120px 48px", background: C.card }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        <div>
          <div style={{ ...T.label, marginBottom: 20 }}>The story</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 24px" }}>
            We started with one question:<br />
            <em style={{ color: C.gold, fontStyle: "italic" }}>why two systems?</em>
          </h2>
          <p style={{ ...T.body, margin: "0 0 16px" }}>
            Every service business runs two queues — paper for walk-ins, a calendar for bookings — and pays the cost in confused staff and customers waiting twice.
          </p>
          <p style={{ ...T.body, margin: "0 0 32px" }}>
            AzQueue blends real-world service flow with digital readiness. We give managers the tools to keep customers moving — without sacrificing calm.
          </p>
          <Link to="/resources" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.goldLit, fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Read the docs <Arr />
          </Link>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", background: C.void }}>
          {[
            ["Founded",     "2024 · Kuala Lumpur"],
            ["Customers",   "200+ branches in 12 countries"],
            ["Investors",   "Bootstrapped · founder-led"],
            ["Languages",   "EN · MS · AR · UR · FR · ID"],
            ["Headcount",   "Small, senior, distributed"],
            ["Office hours","Sun–Thu · 09:00–18:00 MYT"],
          ].map(([label, value], i, arr) => (
            <div key={label} style={{ padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i === arr.length - 1 ? "none" : `1px solid ${C.border}` }}>
              <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</span>
              <span style={{ fontSize: 13, color: C.ink, letterSpacing: "-0.005em" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Careers() {
  const [ref, visible] = useInView();
  return (
    <section ref={ref} style={{ padding: "120px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48, gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...T.label, marginBottom: 20 }}>Careers</div>
            <h2 style={{ ...T.h2, color: C.ink, margin: 0 }}>Join the team.</h2>
          </div>
          <p style={{ ...T.body, maxWidth: 360, margin: 0 }}>
            Hiring senior engineers, product operators, and customer success partners to scale queues that work for businesses and people.
          </p>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", background: C.card }}>
          {ROLES.map((r, i) => (
            <a key={r.role} href="mailto:careers@azqueue.io" style={{
              display: "grid", gridTemplateColumns: "1fr 220px 32px", padding: "26px 32px",
              alignItems: "center", textDecoration: "none",
              borderBottom: i === ROLES.length - 1 ? "none" : `1px solid ${C.border}`,
              opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(8px)",
              transition: `all 0.4s ease ${i * 0.06}s`,
              background: C.card,
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
              onMouseLeave={e => e.currentTarget.style.background = C.card}>
              <div style={{ fontSize: 15, color: C.ink, letterSpacing: "-0.005em" }}>{r.role}</div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>{r.loc}</div>
              <div style={{ color: C.gold, display: "flex", justifyContent: "flex-end" }}><Arr /></div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function PageCTA() {
  return (
    <section style={{ padding: "120px 48px", background: C.void, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 48px", opacity: 0.35 }} />
        <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>Partner with us.</h2>
        <p style={{ ...T.body, margin: "0 0 40px" }}>Partners, customers, and collaborators are welcome. Get in touch — we read every email.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="mailto:hello@azqueue.io" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em", transition: "all 0.2s ease" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Contact us <Arr />
          </a>
          <Link to="/support" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "transparent", color: C.ink, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.borderL}`, letterSpacing: "0.01em", transition: "all 0.2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.goldLit; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderL; e.currentTarget.style.color = C.ink; }}>
            See support options
          </Link>
        </div>
      </div>
    </section>
  );
}
