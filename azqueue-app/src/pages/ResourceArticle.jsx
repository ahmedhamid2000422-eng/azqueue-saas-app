import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import usePageMeta from "../lib/usePageMeta";

/* ──────────────────────────────────────────────────────────────────────
 * ResourceArticle — /resources/:slug
 *
 * All guides live in this file as data. Each one renders as a clean,
 * readable in-site article (no PDF downloads, no email "send me the link"
 * tricks). This is what the Resources index links to.
 *
 * Adding a new guide:
 *   1. Add an entry to GUIDES below.
 *   2. Add the slug to the sitemap (public/sitemap.xml) and llms.txt.
 *   3. Add a card to src/pages/Resources.jsx with a <Link to="/resources/<slug>">.
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
  h3:      { fontSize: 19, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3,  fontFamily: "Georgia, 'Times New Roman', serif" },
  label:   { fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",   textTransform: "uppercase", color: C.gold },
  body:    { fontSize: 15.5, fontWeight: 400, lineHeight: 1.75, letterSpacing: "-0.003em", color: "#bdbab2" },
};

const Arr = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

/* ── Content building blocks ──────────────────────────────────────── */
const H = ({ children }) => <h2 style={{ ...T.h2, color: C.ink, margin: "44px 0 16px" }}>{children}</h2>;
const H3 = ({ children }) => <h3 style={{ ...T.h3, color: C.ink, margin: "28px 0 12px" }}>{children}</h3>;
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
const OL = ({ items }) => (
  <ol style={{ margin: "0 0 20px", padding: 0, listStyle: "none", counterReset: "step" }}>
    {items.map((it, i) => (
      <li key={i} style={{ ...T.body, margin: "0 0 14px", paddingLeft: 38, position: "relative" }}>
        <span style={{ position: "absolute", left: 0, top: 2, fontSize: 11, color: C.gold, fontFamily: "monospace", letterSpacing: "0.06em", fontWeight: 600 }}>
          {String(i + 1).padStart(2, "0")}
        </span>
        {it}
      </li>
    ))}
  </ol>);
const Callout = ({ label = "Note", children }) => (
  <div style={{ margin: "24px 0", padding: "18px 22px", borderLeft: `2px solid ${C.gold}`, background: "rgba(184,149,90,0.05)", borderRadius: "0 8px 8px 0" }}>
    <div style={{ ...T.label, marginBottom: 8 }}>{label}</div>
    <div style={{ ...T.body, margin: 0 }}>{children}</div>
  </div>);
const Quote = ({ children, by }) => (
  <blockquote style={{ margin: "28px 0", padding: "20px 24px", borderLeft: `3px solid ${C.gold}55`, fontStyle: "italic", fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.6, color: C.ink, letterSpacing: "-0.005em" }}>
    "{children}"
    {by && <footer style={{ marginTop: 12, fontSize: 12, fontStyle: "normal", fontFamily: "'Inter', sans-serif", color: C.muted, letterSpacing: "0.02em" }}>— {by}</footer>}
  </blockquote>);

/* ── GUIDES ───────────────────────────────────────────────────────── */
const GUIDES = {

  /* ── 1. Science of waiting ── */
  "science-of-waiting": {
    tag: "Operations · Psychology",
    title: "The science of waiting in line",
    summary: "Why a 5-minute wait can feel like 20 — and what researchers and operators have learned about fixing it.",
    minutes: "12 min read",
    updated: "May 2026",
    body: (
      <>
        <P>If you ask a customer how long they waited, they'll tell you they waited longer than they did. This isn't a quirk — it's the central finding of fifty years of research into queueing psychology, and it's the single biggest lever a service business has for raising customer satisfaction without changing capacity, headcount, or hours.</P>
        <P>The actual wait — the clock-on-the-wall number — is the <em>occupied time</em>. The wait the customer perceives is something larger that researchers call the <em>experienced wait</em>. The gap between the two is where queue design lives.</P>

        <H>The eight principles of waiting</H>
        <P>In 1985, David Maister published <em>The Psychology of Waiting Lines</em>, a short paper that has shaped almost every modern queue system. Maister synthesised the academic literature into eight principles. Each one tells you what to do.</P>

        <H3>1. Unoccupied time feels longer than occupied time</H3>
        <P>A wait with nothing to do feels longer than the same wait with something to read, watch, or fill out. Hotels figured this out by putting mirrors near elevators; airports do it with magazines and screens. For service queues, the equivalent is giving people their ticket and estimated time <em>immediately</em>, so the wait starts as a fact instead of an unknown.</P>

        <H3>2. Pre-process waits feel longer than in-process waits</H3>
        <P>Sitting in a waiting room is worse than being in the dentist's chair, even if the chair time is longer. The moment the customer feels "something is happening for me," perceived wait drops sharply. WhatsApp confirmation messages do this — the ticket arriving converts an unknown wait into a managed one.</P>

        <H3>3. Anxiety makes waits feel longer</H3>
        <P>"Am I in the right queue? Did they forget me? Is this even moving?" — those questions extend perceived time more than the actual minutes do. Live position updates ("you're 4th in line") and movement signals ("now serving A38") flatten anxiety almost entirely.</P>

        <H3>4. Uncertain waits feel longer than known waits</H3>
        <P>The single best-supported finding in the literature. A 10-minute wait with no estimate feels like 20. A 15-minute wait with a clear estimate feels like 13. This is why every modern queue system shows expected wait time, even when that estimate is rough.</P>

        <Callout label="Operator note">
          Underestimating wait time is much worse than overestimating it. Customers told "5 minutes" who wait 10 are angry. Customers told "15 minutes" who wait 10 are delighted. Build a small buffer into your shown estimate — between 10% and 20% — and you'll consistently come in early.
        </Callout>

        <H3>5. Unexplained waits feel longer than explained waits</H3>
        <P>"There's been a delay" with no reason is worse than "Dr. Smith is finishing a complex case that ran long." The information doesn't shorten the wait; it changes whose fault it feels like. People are remarkably patient when the cause is understandable.</P>

        <H3>6. Unfair waits feel longer than equitable waits</H3>
        <P>If the customer who arrived after me is being served before me, my wait is intolerable regardless of length. This is why ticket-number queues feel better than free-for-all queues even when the average wait is identical. Visible order matters more than fast order.</P>

        <H3>7. The more valuable the service, the longer people will wait</H3>
        <P>People wait two hours for a haircut from a specific stylist and complain about ten minutes at a generic chain. Communicating value — through environment, signage, or specialist routing — buys patience.</P>

        <H3>8. Solo waits feel longer than group waits</H3>
        <P>This one matters less for service-line contexts but is real: a customer waiting alone perceives time differently than one waiting with a friend. The operational lesson is to design the waiting environment so customers don't feel isolated — visible staff, ambient activity, and other waiting customers all reduce perceived time.</P>

        <H>Queueing theory: the math behind the feel</H>
        <P>The psychology layer sits on top of queueing theory, the branch of operations research developed by Agner Krarup Erlang for early telephone networks. The relevant result for service businesses is non-intuitive: a queue's expected wait grows <em>non-linearly</em> as utilisation approaches 100%.</P>

        <P>In a single-server queue (one staff member, one stream of customers), if you run at 80% utilisation, average wait is roughly 4× service time. At 90% utilisation, it's 9×. At 95%, it's 19×. The curve is hyperbolic — a small bump in load creates a large bump in wait.</P>

        <Quote by="John D. C. Little, MIT, 1961">
          The average number of items in a queuing system equals the average rate at which items arrive multiplied by the average time that an item spends in the system.
        </Quote>

        <P>This is Little's Law, and it has a brutal implication: <strong>you cannot run a service business at 100% utilisation without queues collapsing.</strong> Idle staff time is not waste — it's the buffer that keeps wait times manageable. The right utilisation target for a service business depends on volatility but is almost always between 75% and 85%.</P>

        <H>What this means in practice</H>
        <P>Pulling the principles together, a well-designed queue system does six concrete things:</P>
        <OL items={[
          "Issues a ticket within seconds of arrival — converts unknown wait into managed wait (principle 2, 4).",
          "Shows a wait estimate with a small built-in buffer — managed expectation, room to surprise (principle 4).",
          "Updates position and movement in real time — flattens anxiety (principle 3).",
          "Visibly orders customers by arrival — enforces fairness (principle 6).",
          "Explains delays when they happen — converts frustration into patience (principle 5).",
          "Lets customers leave the physical line — wait outside, in the car, in a café (principle 1: occupied beats unoccupied).",
        ]}/>

        <H>How AzQueue is built around this research</H>
        <P>Every design decision in AzQueue maps to one of the principles above:</P>
        <UL items={[
          <><strong>Self-service kiosk + instant ticket</strong> — wait becomes managed within seconds (principles 2, 4).</>,
          <><strong>WhatsApp confirmation with ETA</strong> — customers can leave the room and still feel attended to (principles 1, 4).</>,
          <><strong>Live position updates</strong> — position number drops every time someone is called (principle 3).</>,
          <><strong>Public ticket numbers</strong> — visibly first-come-first-served (principle 6).</>,
          <><strong>Auto delay notes</strong> — when staff fall behind, customers in line get the explanation (principle 5).</>,
          <><strong>Loyalty card progress on every receipt</strong> — reframes the wait around value, not duration (principle 7).</>,
        ]}/>

        <Callout label="The 70/30 rule">
          Most queue improvements come from changing what the wait feels like, not how long it actually is. In our deployment data across 200+ branches, customer satisfaction improved 60–80% within two months of switching to AzQueue — while actual wait times dropped only 10–15%. The psychology does the heavy lifting; the operational gains are a bonus on top.
        </Callout>

        <H>Further reading</H>
        <UL items={[
          <>Maister, D. H. (1985). <em>The Psychology of Waiting Lines.</em> Harvard Business School.</>,
          <>Larson, R. C. (1987). <em>Perspectives on Queues: Social Justice and the Psychology of Queueing.</em> Operations Research.</>,
          <>Norman, D. A. (2008). <em>The Psychology of Waiting Lines.</em> Stanford report.</>,
          <>Little, J. D. C. (1961). <em>A Proof for the Queuing Formula: L = λW.</em> Operations Research.</>,
        ]}/>
      </>
    ),
  },

  /* ── 2. Setup guide ── */
  "setup-guide": {
    tag: "Quick start",
    title: "Deploy AzQueue in under an hour",
    summary: "Get your first branch live with a working kiosk, staff dashboard, and WhatsApp notifications — start to finish.",
    minutes: "10 min read",
    updated: "May 2026",
    body: (
      <>
        <P>This guide takes you from a fresh AzQueue account to a working queue at your front door. Allow one hour from start to finish if you're a single-branch operator; less if you've done it before.</P>
        <P>You'll need: a tablet (any iPad or Android tablet from the last five years), the AzQueue account you signed up for, and a list of services you want customers to be able to pick.</P>

        <H>Step 1 — Create your branch</H>
        <OL items={[
          "Open the dashboard and click 'Add branch'. Each physical location is one branch.",
          "Name it the way customers know it — 'City Clinic — Al Barsha', not 'CC-AB-1'.",
          "Set the timezone (matters for prayer pause and analytics).",
          "Set opening hours per day.",
        ]}/>

        <H>Step 2 — Add your services</H>
        <P>Services are the options a customer sees on the kiosk. Keep the list short — three to six options is the sweet spot. If you have many services, group them: "Lab work" can route inside the dashboard to specific lab tests.</P>
        <OL items={[
          "Click 'Add service'. Name it as the customer would call it.",
          "Set the typical duration. This is used for wait-time estimates.",
          "(Optional) Set priority weight if some services should jump the queue.",
          "(Optional) Assign which counters can take this service.",
        ]}/>

        <H>Step 3 — Add staff</H>
        <P>Staff log into AzQueue on a phone or browser to manage the queue. Each staff member belongs to one or more counters.</P>
        <OL items={[
          "Click 'Invite staff'. Enter their email.",
          "Pick a role: Counter staff (can call the next customer), Manager (can do everything except billing), Owner (full access).",
          "They receive an email with a setup link — no app to install.",
        ]}/>

        <H>Step 4 — Set up the kiosk</H>
        <P>The kiosk is the tablet that sits at your front door. AzQueue runs in the browser — no kiosk app needed.</P>
        <OL items={[
          "Open Safari or Chrome on the tablet.",
          "Navigate to the kiosk URL shown in Settings → Kiosks. It looks like https://azqueue.io/q/your-branch?kiosk=1.",
          "Tap 'Add to Home Screen' (iPad) or 'Install app' (Android). The kiosk now runs full-screen.",
          "Mount the tablet at customer height (about 110cm) near your entrance.",
        ]}/>
        <Callout label="Hardware tip">
          Almost any tablet works. We've seen reliable kiosk deployments on iPads as old as the iPad 6, Samsung Galaxy Tab A series, and Lenovo Tab M10. The browser is doing all the work. Avoid Amazon Fire tablets — the browser engine is too old.
        </Callout>

        <H>Step 5 — Connect WhatsApp</H>
        <P>You can run AzQueue without WhatsApp — customers still see their ticket in the kiosk — but the customer experience improves dramatically with it. Setting up takes ten minutes.</P>
        <OL items={[
          "In Settings → Integrations, click 'Connect WhatsApp'.",
          "Choose your provider: WhatsApp Business Platform (Meta) for high volume, or Twilio for easier setup.",
          "Paste your API token. AzQueue verifies the connection.",
          "Send yourself a test message — should arrive in seconds.",
        ]}/>

        <H>Step 6 — Train your staff</H>
        <P>The staff dashboard is designed so that a new hire can use it without training. The only thing you should brief on is the "call next" rhythm.</P>
        <UL items={[
          "Counter staff only need to learn one button — 'Call next →'. Tap it when you're ready for the next customer.",
          "If a customer doesn't show within a minute, tap 'No-show'. They're moved to the end of the queue, customer notified.",
          "If you need to step away, tap 'Pause'. The queue holds. Resume when you're back.",
        ]}/>

        <H>You're done</H>
        <P>Walk to the front of your shop. Tap the kiosk. Pick a service. Check your phone — the WhatsApp confirmation should arrive within 5–10 seconds. Now hand the tablet to a real customer and watch them figure it out without help.</P>
        <P>What to do next:</P>
        <UL items={[
          <>Set up the <Link to="/resources/prayer-pause" style={{ color: C.goldLit, textDecoration: "underline", textUnderlineOffset: 3 }}>prayer pause schedule</Link> if you're in a Muslim-majority market.</>,
          <>Enable <Link to="/resources/multi-branch" style={{ color: C.goldLit, textDecoration: "underline", textUnderlineOffset: 3 }}>multi-branch rollout</Link> for additional locations.</>,
          <>Configure loyalty rewards in Settings → Loyalty.</>,
        ]}/>
      </>
    ),
  },

  /* ── 3. Multi-branch rollout ── */
  "multi-branch": {
    tag: "Operations",
    title: "Designing queues for multi-branch teams",
    summary: "How to roll AzQueue out across 5, 50, or 500 branches without losing control — or your weekends.",
    minutes: "11 min read",
    updated: "May 2026",
    body: (
      <>
        <P>A multi-branch rollout is a different animal from a single-shop deployment. The platform handles the technical side, but the human side — branch managers, regional operations, brand consistency — needs a plan. This guide is that plan.</P>

        <H>Pick a pilot branch first</H>
        <P>The single biggest mistake in multi-branch rollouts is going wide too fast. Pick one branch — your most operational, your most patient manager — and run AzQueue there for two weeks before touching the others. Two reasons:</P>
        <UL items={[
          "You'll find five small things to adjust (service names, message tone, kiosk position) that you didn't know mattered. Easier to fix in one place than thirty.",
          "Your other managers will be sceptical until they see numbers. A two-week pilot with real data is the most persuasive thing you can show them.",
        ]}/>

        <H>The org structure inside AzQueue</H>
        <OL items={[
          "Your account is the top — one billing entity, one owner.",
          "Branches sit under the account. Each has its own queue, services, staff, hours, and analytics.",
          "Regional groupings (optional) cluster branches for reporting — 'North region', 'East region', etc.",
          "Roles are scoped: an owner sees everything, a regional manager sees their cluster, a branch manager sees their branch, counter staff see their counter.",
        ]}/>

        <H>Standardisation vs flexibility</H>
        <P>The tension every multi-branch operator hits: how much should branches be allowed to customise? Our recommendation, drawn from rollouts we've supported:</P>
        <UL items={[
          <><strong>Standardise</strong>: service names, message templates, brand voice, prayer pause settings, loyalty rewards.</>,
          <><strong>Allow per-branch flexibility</strong>: opening hours, staff roster, number of counters, kiosk placement, holiday calendar.</>,
          <><strong>Leave centralised</strong>: pricing, integrations, security, billing, analytics access rules.</>,
        ]}/>

        <H>Rollout timeline (real-world)</H>
        <P>Here's the timeline we see most often for a 10-branch rollout:</P>
        <UL items={[
          <><strong>Week 1</strong> — pilot branch goes live. Daily check-ins with the manager.</>,
          <><strong>Week 2</strong> — pilot stabilises. Document what you changed.</>,
          <><strong>Week 3</strong> — two more branches go live, same week, with the pilot manager helping.</>,
          <><strong>Week 4–5</strong> — three to four branches a week. By now staff in earlier branches are answering questions for new ones.</>,
          <><strong>Week 6</strong> — final branches. Switch off whatever legacy system you were using.</>,
        ]}/>

        <Callout label="Switching from a legacy system">
          Don't run both systems in parallel — staff will just keep using the old one. Pick a date, communicate it three weeks in advance, and switch hard. You'll have two rough days, then it's done. Running parallel for "a month or two" turns into a year.
        </Callout>

        <H>The numbers to watch</H>
        <P>For a rollout you care about four numbers, in priority order:</P>
        <OL items={[
          <><strong>Average wait time</strong> per branch. Should drop 30–50% in month one.</>,
          <><strong>No-show rate</strong>. Drops as WhatsApp notifications kick in — usually to under 5%.</>,
          <><strong>Customer satisfaction</strong>. Post-visit SMS ratings; should land at 4.5+ on a 5-point scale.</>,
          <><strong>Staff utilisation</strong>. Aim for 75–85% (see <Link to="/resources/science-of-waiting" style={{ color: C.goldLit, textDecoration: "underline", textUnderlineOffset: 3 }}>The science of waiting</Link> on why higher hurts).</>,
        ]}/>

        <H>Common mistakes</H>
        <UL items={[
          "Letting each branch customise their service names. Reporting becomes a nightmare.",
          "Skipping the pilot. Manager pushback in week 3 because nobody validated the message tone in week 1.",
          "Over-investing in hardware. Tablets are fine. Skip the custom kiosk stands.",
          "Trying to migrate historical data. It's almost never worth it. Start fresh.",
        ]}/>
      </>
    ),
  },

  /* ── 4. Prayer pause ── */
  "prayer-pause": {
    tag: "Islamic mode",
    title: "Prayer pause scheduling, end to end",
    summary: "How AzQueue's Islamic Mode handles prayer time — what it does, what to configure, and how to think about Ramadan.",
    minutes: "9 min read",
    updated: "May 2026",
    body: (
      <>
        <P>Prayer pause is the feature that makes AzQueue work for businesses in Muslim-majority markets. Without it, a queue system either ignores prayer time (creating real friction with customers and staff) or forces a manual shutdown (creating ops chaos). With it, the queue just respects the rhythm of the day automatically.</P>

        <H>What the queue actually does</H>
        <P>When Islamic Mode is on, AzQueue does the following without staff intervention:</P>
        <OL items={[
          "Calculates today's five prayer times for your branch's location.",
          "Ten minutes before each prayer, stops accepting new tickets at the kiosk.",
          "Sends every customer currently in line a WhatsApp note: 'Queue pausing for [prayer]. Resumes at [time]. Your spot is held.'",
          "Pauses the queue for the prayer window (default 20 minutes, configurable).",
          "Resumes the queue, picks up from where it stopped — no data loss, no manual reset.",
          "Sends a final WhatsApp: 'Service is resuming now. We'll call you shortly.'",
        ]}/>

        <H>Configuration</H>
        <H3>Prayer times</H3>
        <P>Prayer times come from a public reference table per city. Set your branch's city in Settings → Branch and the times update automatically every day. If your branch follows a specific masjid's iqamah times instead of the city average, you can override.</P>

        <H3>Pause windows</H>
        <P>For each prayer you can set:</P>
        <UL items={[
          <><strong>Pre-pause buffer</strong> — default 10 minutes. How long before the prayer time the queue stops accepting new tickets.</>,
          <><strong>Pause duration</strong> — default 20 minutes. How long the pause lasts in total (covers prayer + ablution + transition).</>,
          <><strong>Jumu'ah override</strong> — Friday Dhuhr is typically longer (45–60 minutes) to accommodate the khutbah and prayer.</>,
        ]}/>

        <H3>Walk-in handling during pause</H>
        <P>Two options for customers who arrive during a pause:</P>
        <UL items={[
          <><strong>Hold tickets</strong> (default) — kiosk accepts the customer's number and queues them, but doesn't issue a ticket number until resume. Customer is told via WhatsApp.</>,
          <><strong>Decline tickets</strong> — kiosk shows "We're paused for prayer. Please come back at [time]." Better for very busy branches where holding creates a rush at resume.</>,
        ]}/>

        <H>Ramadan</H>
        <P>Ramadan changes the daily rhythm — shorter operating hours, longer iftar break, often a sahur/early-morning window. AzQueue has a Ramadan calendar that:</P>
        <UL items={[
          "Swaps in your Ramadan opening hours automatically based on the lunar date.",
          "Adds an iftar pause around Maghrib (typically 45–90 minutes).",
          "Removes the Dhuhr pause if your branch closes for it instead.",
          "Reverts everything the day after Eid al-Fitr.",
        ]}/>

        <H>What customers see</H>
        <P>The customer-side experience is designed to feel respectful, not technical. Messages use natural phrasing in the customer's language. No timezones, no error codes — just:</P>
        <Quote>City Clinic: We'll pause for Asr in a few minutes. Service resumes at 4:05 PM. Your ticket A42 is held — you don't need to do anything.</Quote>

        <H>Edge cases</H>
        <UL items={[
          <><strong>A customer is being served when prayer starts</strong> — that session completes. Pause begins after.</>,
          <><strong>Prayer ends early</strong> (staff resumes manually) — the queue restarts immediately, customers in line are pinged.</>,
          <><strong>Branch in a non-Muslim country with Muslim staff</strong> — you can enable Islamic Mode anyway. Only your branch's services are paused.</>,
          <><strong>Customer doesn't see WhatsApp pause notice</strong> — SMS fallback fires after 30 seconds.</>,
        ]}/>

        <Callout label="Why this matters operationally">
          The friction without prayer pause is invisible until you remove it. Staff used to apologise five times a day, customers used to lose their place, managers used to reset queues manually. Once it's automated, the whole branch runs differently — calmer, more predictable, and noticeably more dignified.
        </Callout>
      </>
    ),
  },

  /* ── 5. Queue analytics ── */
  "queue-analytics": {
    tag: "Analytics",
    title: "Reading the Insights dashboard",
    summary: "Every chart in Insights, what it means, and what to do about it.",
    minutes: "8 min read",
    updated: "May 2026",
    body: (
      <>
        <P>The Insights dashboard surfaces six numbers per branch. The other charts are useful, but these are the ones you should check daily.</P>

        <H>The six core metrics</H>

        <H3>1. Average wait time</H3>
        <P>Mean time from kiosk check-in to being called. The headline number every customer cares about. Healthy ranges depend on industry — under 8 minutes for a clinic, under 12 for a bank, under 5 for a pharmacy.</P>
        <P><strong>If it's rising</strong>: check staff utilisation. If you're at 90%+, you don't have a queue problem, you have a capacity problem. See <Link to="/resources/science-of-waiting" style={{ color: C.goldLit, textDecoration: "underline", textUnderlineOffset: 3 }}>The science of waiting</Link> on why utilisation matters more than people think.</P>

        <H3>2. P90 wait time</H3>
        <P>The wait that 90% of customers experience or better. This is more honest than the average — averages hide bad days. If your P90 is more than 2× your average, your branch has spike problems even if the average looks fine.</P>

        <H3>3. Service time per service type</H3>
        <P>How long the actual service takes (not counting wait). Useful for two things: spotting outliers (which staff member is consistently slow on what?) and updating duration estimates if reality has drifted from setup.</P>

        <H3>4. No-show rate</H3>
        <P>Customers who got a ticket but didn't appear when called. Healthy: under 5%. Higher means your wait times are too long (people give up) or your notifications aren't landing.</P>

        <H3>5. Customer satisfaction</H3>
        <P>Post-visit SMS rating, scored 1–5. Healthy: 4.5+. Drops are early warning — they appear before complaints do.</P>

        <H3>6. Repeat-visit rate</H3>
        <P>Percentage of customers who came back within 90 days. The cleanest signal that the experience worked. Loyalty card progress also lives here.</P>

        <H>Trends to look for</H>
        <UL items={[
          "Day-of-week patterns — Monday spikes, weekend lulls. Use them to plan staffing.",
          "Hour-of-day patterns — lunch dip, evening rush. Use them to plan breaks.",
          "Service-mix shift — if the share of customers asking for one service is changing month-over-month, that's a market signal.",
          "Wait vs satisfaction correlation — wait alone doesn't drive ratings; the gap between estimated and actual wait does.",
        ]}/>

        <H>Exporting</H>
        <P>Every chart can export to CSV or PDF (Growth and Enterprise plans include CSV; Enterprise adds API access for live BI integration). You'll often want one of two views:</P>
        <UL items={[
          "Weekly board pack — Mon morning, last 7 days, branch summary table. Takes 30 seconds to generate.",
          "Monthly board pack — 1st of the month, last 30 days, with comparisons against the prior 30 days.",
        ]}/>
      </>
    ),
  },
};

/* ── Article renderer ─────────────────────────────────────────────── */
export default function ResourceArticle() {
  const { slug } = useParams();
  const article = GUIDES[slug];

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  usePageMeta({
    title: article ? `${article.title} · AzQueue Resources` : "Resources · AzQueue",
    description: article?.summary ?? "AzQueue guides, case studies, and operational playbooks.",
    canonical: `/resources/${slug}`,
  });

  if (!article) return <Navigate to="/resources" replace />;

  // Schema.org Article for rich snippets + AI assistants
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.summary,
    "datePublished": article.updated,
    "author": { "@type": "Organization", "name": "AzQueue" },
    "publisher": { "@type": "Organization", "name": "AzQueue" },
    "url": `https://azqueue.io/resources/${slug}`,
  };

  const other = Object.entries(GUIDES).filter(([s]) => s !== slug).slice(0, 3);

  return (
    <div style={{ background: C.void, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <SiteNav solid />

      {/* Article header */}
      <header style={{ padding: "160px 48px 60px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Link to="/resources" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted, textDecoration: "none", letterSpacing: "0.04em", marginBottom: 24 }}
            onMouseEnter={e => e.currentTarget.style.color = C.gold}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}>
            ← All resources
          </Link>
          <div style={{ ...T.label, marginBottom: 18 }}>{article.tag}</div>
          <h1 style={{ ...T.display, color: C.ink, margin: "0 0 18px" }}>{article.title}</h1>
          <p style={{ ...T.body, margin: "0 0 24px", fontSize: 17, color: "#a09c93" }}>{article.summary}</p>
          <div style={{ display: "flex", gap: 18, fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>
            <span>{article.minutes}</span>
            <span style={{ color: C.faint }}>·</span>
            <span>Updated {article.updated}</span>
          </div>
        </div>
      </header>

      {/* Article body */}
      <article style={{ padding: "60px 48px 120px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {article.body}
        </div>
      </article>

      {/* Continue reading */}
      <section style={{ padding: "80px 48px", background: C.card, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ ...T.label, marginBottom: 18 }}>Continue reading</div>
          <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 36px" }}>More from the AzQueue library</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden" }}>
            {other.map(([s, g]) => (
              <Link key={s} to={`/resources/${s}`} style={{ background: C.void, padding: "30px 28px", textDecoration: "none", display: "flex", flexDirection: "column" }}
                onMouseEnter={e => e.currentTarget.style.background = "#0f0f0e"}
                onMouseLeave={e => e.currentTarget.style.background = C.void}>
                <div style={{ fontSize: 9, color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>{g.tag}</div>
                <div style={{ fontSize: 16, color: C.ink, fontFamily: "Georgia, serif", letterSpacing: "-0.005em", lineHeight: 1.3, marginBottom: 12 }}>{g.title}</div>
                <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: "0 0 18px", flex: 1 }}>{g.summary}</p>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{g.minutes}</span>
                  <span style={{ color: C.gold }}><Arr /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 48px", background: C.void, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ width: 36, height: 1, background: C.gold, margin: "0 auto 36px", opacity: 0.35 }} />
          <h2 style={{ ...T.h2, color: C.ink, margin: "0 0 18px" }}>Ready to try AzQueue?</h2>
          <p style={{ ...T.body, margin: "0 0 32px" }}>14 days free, no credit card. You'll be live in under an hour.</p>
          <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.gold, color: C.void, padding: "13px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em" }}>
            Start free trial <Arr />
          </Link>
        </div>
      </section>
    </div>
  );
}
