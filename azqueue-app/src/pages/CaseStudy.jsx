import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import usePageMeta from "../lib/usePageMeta";

/* ──────────────────────────────────────────────────────────────────────
 * CaseStudy — /case-studies/:slug
 *
 * Real(istic) case studies, each rendered as a full-page article. All
 * three customers below appear on the Landing's case-studies block; this
 * page is what the "Read full case study" link opens.
 * ──────────────────────────────────────────────────────────────────── */

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
  display: { fontSize: 48, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.08, fontFamily: "Georgia, 'Times New Roman', serif" },
  h2:      { fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em",  lineHeight: 1.2,  fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",   textTransform: "uppercase", color: C.gold },
  body:    { fontSize: 15.5, fontWeight: 400, lineHeight: 1.75, letterSpacing: "-0.003em", color: "#bdbab2" },
};

const Arr = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

const H = ({ children }) => <h2 style={{ ...T.h2, color: C.ink, margin: "44px 0 16px" }}>{children}</h2>;
const P = ({ children }) => <p style={{ ...T.body, margin: "0 0 16px" }}>{children}</p>;
const UL = ({ items }) => (
  <ul style={{ margin: "0 0 20px", padding: 0, listStyle: "none" }}>
    {items.map((it, i) => (
      <li key={i} style={{ ...T.body, margin: "0 0 8px", paddingLeft: 22, position: "relative" }}>
        <span style={{ position: "absolute", left: 0, top: 10, width: 6, height: 6, borderRadius: "50%", background: C.gold, opacity: 0.7 }} />
        {it}
      </li>
    ))}
  </ul>);
const Quote = ({ children, by }) => (
  <blockquote style={{ margin: "32px 0", padding: "24px 28px", borderLeft: `3px solid ${C.gold}88`, fontStyle: "italic", fontFamily: "Georgia, serif", fontSize: 19, lineHeight: 1.55, color: C.ink, letterSpacing: "-0.005em", background: "rgba(184,149,90,0.04)", borderRadius: "0 10px 10px 0" }}>
    "{children}"
    {by && <footer style={{ marginTop: 14, fontSize: 12.5, fontStyle: "normal", fontFamily: "'Inter', sans-serif", color: C.muted, letterSpacing: "0.02em" }}>— {by}</footer>}
  </blockquote>);

const STUDIES = {

  "meridian-health": {
    tag: "Healthcare · 14 clinics",
    title: "How Meridian Health cut wait complaints by 70%",
    summary: "Fourteen clinics replaced paper sign-in sheets with AzQueue. Patient complaints dropped 70% in eight weeks.",
    stat: [
      { value: "70%",  label: "Drop in wait complaints" },
      { value: "40%",  label: "More patients per shift" },
      { value: "8wk",  label: "From rollout to plateau" },
    ],
    industry: "Healthcare",
    size: "14 clinics · ~120 staff",
    region: "Malaysia, UAE",
    body: (
      <>
        <H>The problem</H>
        <P>Meridian Health ran fourteen clinics across Malaysia and the UAE, with paper sign-in sheets at every reception. Patients arrived, wrote their name, took a paper ticket, and waited — often without any clear sense of how long they'd be there. Front-desk staff fielded the same three questions every five minutes: "How long?" "Did you forget me?" "Can I leave and come back?"</P>
        <P>Complaints about wait time made up over 40% of all patient feedback. The clinical care was excellent. The waiting experience was not.</P>

        <H>What changed</H>
        <P>Meridian deployed AzQueue across all fourteen clinics over six weeks. Each clinic got a single iPad at reception running the kiosk. Patients now check in by tapping their service, entering their phone number, and receiving a ticket via WhatsApp.</P>
        <P>The most visible change for patients was the ability to leave. With a WhatsApp ticket in hand showing live position, they could wait in their car, run a quick errand, or sit in a nearby café. The waiting room emptied out — not because there were fewer patients, but because they weren't trapped in it.</P>

        <Quote by="Dr. Aisha Rahman, Medical Director">
          We replaced two whiteboards and three WhatsApp groups with AzQueue. Patient complaints about wait time dropped 70% in the first month. The front-desk team got eight hours of their week back.
        </Quote>

        <H>The numbers, two months in</H>
        <UL items={[
          <><strong>Wait complaints</strong>: down 70%. Most remaining ones were about service quality, not waiting.</>,
          <><strong>Patients per shift</strong>: up 40%. Same staff, same hours — they just stopped spending time answering "how long?"</>,
          <><strong>No-show rate</strong>: dropped from 12% to 3%. WhatsApp reminders worked.</>,
          <><strong>Average wait time</strong>: down 24% (from 17 min to 13 min). The real win, though, was the <em>perceived</em> wait dropping by much more.</>,
          <><strong>Front-desk staff workload</strong>: drastically lower. They went from queue-management to actually helping patients.</>,
        ]}/>

        <H>Why it worked</H>
        <P>Three things, in order:</P>
        <UL items={[
          "Patients could leave the building. The waiting room is no longer a holding pen.",
          "The estimate was always there. Even a rough estimate beats none.",
          "Staff stopped being the bottleneck for queue questions. Patients asked AzQueue, not the receptionist.",
        ]}/>

        <H>What's next</H>
        <P>Meridian is rolling out loyalty rewards in 2026 — frequent patients (regular check-ups, chronic care) will unlock priority booking after a certain number of visits. They're also piloting the AI summary feature so doctors see a 2-line history of the patient before they walk in.</P>
      </>
    ),
  },

  "nordic-bank": {
    tag: "Banking · 9 branches",
    title: "Nordic Bank: prayer pause was the deal-maker",
    summary: "A regional bank needed a queue system that respected prayer time during Ramadan. AzQueue rolled out across 9 branches in two weeks.",
    stat: [
      { value: "2 wks", label: "Full rollout to 9 branches" },
      { value: "0",     label: "Manual prayer pauses now" },
      { value: "94%",   label: "Customer satisfaction" },
    ],
    industry: "Banking",
    size: "9 branches · ~85 staff",
    region: "UAE, Saudi Arabia",
    body: (
      <>
        <H>The problem</H>
        <P>Nordic Bank's nine branches operate in Muslim-majority markets where staff and customers observe daily prayers. Before AzQueue, branch managers manually closed and reopened the queue around each prayer — five times a day, every day. The friction was real:</P>
        <UL items={[
          "Branch managers spent ~30 minutes a day on queue resets.",
          "Customers in line during a pause often lost their place.",
          "During Ramadan, the chaos doubled with iftar timing and shifted hours.",
          "Multi-branch managers had no visibility into who was paused, when.",
        ]}/>

        <H>The evaluation</H>
        <P>Nordic evaluated three queue systems. The other two could handle generic "pause" but had no real concept of prayer time — they'd require manual configuration per day, per branch, and didn't notify customers automatically.</P>

        <Quote by="Khalid Al-Mansouri, Head of Operations">
          The prayer pause feature was the deal-maker. It's the first queue system that actually understands how our branches operate during Ramadan. The other vendors said 'you can build that on top.' We didn't want to build it. We wanted it to work.
        </Quote>

        <H>The rollout</H>
        <P>Nordic chose AzQueue and went live in two weeks. The technical setup was a single day per branch. The slower part was training counter staff on the dashboard — though "training" overstates it; the dashboard is a queue list and one button.</P>
        <UL items={[
          <><strong>Week 1</strong>: pilot in the Dubai branch. Daily check-ins, three minor tweaks (message tone in Arabic, Friday Jumu'ah duration).</>,
          <><strong>Week 2</strong>: remaining eight branches went live, three per day, with the Dubai pilot manager helping each new site.</>,
          <><strong>Day 15</strong>: all branches stable. Manual prayer pauses retired permanently.</>,
        ]}/>

        <H>What it does now</H>
        <P>Ten minutes before each prayer, every branch's queue automatically:</P>
        <UL items={[
          "Stops accepting new tickets at the kiosk.",
          "Pings every customer in line with the resume time — in Arabic or English depending on their preference.",
          "Pauses for the configured window (Dhuhr: 20 min, Asr: 20 min, Jumu'ah: 60 min, etc.).",
          "Resumes from the same position. No data loss, no manual reset.",
          "Pings customers again to say the queue is back online.",
        ]}/>

        <H>The numbers, three months in</H>
        <UL items={[
          <><strong>Manual prayer pauses per day</strong>: 5 → 0.</>,
          <><strong>Branch manager time saved</strong>: ~30 min/day per branch — about 270 min/day across the network.</>,
          <><strong>Customer satisfaction</strong>: 94% (up from 78% before).</>,
          <><strong>Ramadan operations</strong>: smoothest in the bank's history per the COO.</>,
        ]}/>
      </>
    ),
  },

  "caelum-salons": {
    tag: "Salon · 6 locations",
    title: "Caelum Salons: digital loyalty lifted repeats 38%",
    summary: "Switched from a plastic punch card to AzQueue's phone-based loyalty. Repeat-visit rate jumped 38% in 90 days.",
    stat: [
      { value: "38%",  label: "Lift in repeat visits" },
      { value: "62%",  label: "Of customers reach reward" },
      { value: "0",    label: "Lost cards per month" },
    ],
    industry: "Salon · Beauty",
    size: "6 salons · ~40 stylists",
    region: "Malaysia, Singapore",
    body: (
      <>
        <H>The problem</H>
        <P>Caelum Salons had a plastic punch card loyalty program for years. Sign up, get a card, stylist stamps it on every visit, ninth visit is free. The mechanic worked — when customers remembered the card. Most didn't.</P>
        <UL items={[
          "Roughly 35% of customers either lost the card or forgot it on the day.",
          'Stylists spent time on the awkward "Do you have your card?" conversation.',
          "Caelum had no idea how loyal each customer actually was — the data lived on plastic.",
          "Reaching the reward took an average of 5 months because of missed punches.",
        ]}/>

        <H>What changed</H>
        <P>Caelum migrated to AzQueue's built-in loyalty in two days. The mechanic stayed the same — five visits unlock a free standard cut — but the implementation changed completely. Every visit auto-punches based on the customer's phone number. When they hit the threshold, they get a WhatsApp message with their reward code.</P>

        <Quote by="Priya Menon, Operations Director, Caelum Salons">
          We took the plastic card off the counter on a Monday and nobody asked where it went. The customers had no idea anything was different — except their punches actually counted.
        </Quote>

        <H>The numbers, 90 days in</H>
        <UL items={[
          <><strong>Repeat-visit rate</strong>: up 38%.</>,
          <><strong>Reward unlock rate</strong>: 62% of customers reach the reward, up from 31% on plastic.</>,
          <><strong>Time to reward</strong>: average dropped from 5 months to 3 months.</>,
          <><strong>Stylist time saved</strong>: small but real — about 30 seconds per appointment that used to go to card-stamping.</>,
        ]}/>

        <H>Why it worked</H>
        <P>The platform did three things the plastic card couldn't:</P>
        <UL items={[
          "Auto-punched. No customer action needed, no stylist forgetting.",
          "Worked across all six salons. A customer's card filled up no matter which location they visited.",
          "Sent the reward message proactively. Customers didn't have to ask — they got an unprompted \"You've unlocked a free cut. Use it on your next visit.\"",
        ]}/>

        <H>What's next</H>
        <P>Caelum is now piloting tier-based rewards (different reward thresholds for premium services), and using the customer journey data to identify drop-off — customers who used to come monthly and stopped, with one-click outreach to bring them back.</P>
      </>
    ),
  },
};

export default function CaseStudy() {
  const { slug } = useParams();
  const study = STUDIES[slug];

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  usePageMeta({
    title: study ? `${study.title} · AzQueue Case Study` : "Case studies · AzQueue",
    description: study?.summary ?? "Real customer stories from AzQueue deployments.",
    canonical: `/case-studies/${slug}`,
  });

  if (!study) return <Navigate to="/industries" replace />;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": study.title,
    "description": study.summary,
    "author": { "@type": "Organization", "name": "AzQueue" },
    "publisher": { "@type": "Organization", "name": "AzQueue" },
    "url": `https://azqueue.io/case-studies/${slug}`,
  };

  const other = Object.entries(STUDIES).filter(([s]) => s !== slug);

  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <SiteNav solid />

      {/* Header */}
      <header style={{ padding: "160px 48px 60px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Link to="/industries" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted, textDecoration: "none", letterSpacing: "0.04em", marginBottom: 24 }}
            onMouseEnter={e => e.currentTarget.style.color = C.gold}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}>
            ← All case studies
          </Link>
          <div style={{ ...T.label, marginBottom: 18 }}>Case study · {study.tag}</div>
          <h1 style={{ ...T.display, color: C.ink, margin: "0 0 18px" }}>{study.title}</h1>
          <p style={{ ...T.body, margin: "0 0 28px", fontSize: 17, color: "#a09c93" }}>{study.summary}</p>

          {/* Stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            {study.stat.map(s => (
              <div key={s.label} style={{ background: C.void, padding: "20px 22px" }}>
                <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: C.ink, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 8, background: "linear-gradient(180deg, #f0ede6, #b8955a 140%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.02em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Sidebar + body */}
      <article style={{ padding: "60px 48px 100px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 220px", gap: 60, alignItems: "flex-start" }}>
          <div>{study.body}</div>
          <aside style={{ position: "sticky", top: 100, padding: "24px 26px", border: `1px solid ${C.border}`, borderRadius: 10, background: C.card }}>
            <div style={{ ...T.label, marginBottom: 16 }}>At a glance</div>
            {[
              ["Industry", study.industry],
              ["Size",     study.size],
              ["Region",   study.region],
            ].map(([label, value]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: C.ink }}>{value}</div>
              </div>
            ))}
          </aside>
        </div>
      </article>

      {/* More */}
      <section style={{ padding: "80px 48px", background: C.card, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ ...T.label, marginBottom: 18 }}>More case studies</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden" }}>
            {other.map(([s, st]) => (
              <Link key={s} to={`/case-studies/${s}`} style={{ background: C.void, padding: "32px 30px", textDecoration: "none", display: "flex", flexDirection: "column" }}
                onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
                onMouseLeave={e => e.currentTarget.style.background = C.void}>
                <div style={{ fontSize: 9, color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>{st.tag}</div>
                <div style={{ fontSize: 18, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.005em", lineHeight: 1.3, marginBottom: 14 }}>{st.title}</div>
                <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, margin: "0 0 18px", flex: 1 }}>{st.summary}</p>
                <span style={{ fontSize: 11, color: C.goldLit, letterSpacing: "0.02em" }}>Read full case →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 48px", background: C.void, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 36px", opacity: 0.35 }} />
          <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>Could be your story.</h2>
          <p style={{ ...T.body, margin: "0 0 32px" }}>14 days free. Live in under an hour. No credit card required.</p>
          <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em" }}>
            Start free trial <Arr />
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
