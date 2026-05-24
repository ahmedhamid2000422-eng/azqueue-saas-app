import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import LuxeFrame from "../components/LuxeFrame";

const INDUSTRIES = [
  {
    id: "service",
    title: "Service",
    tagline: "Barbershop, salon and spa flow in one premium queue.",
    token: "A102",
    primary: "Ali Khan · Haircut",
    hero: "Haircut priority. Salon prep. Spa calm.",
    upNext: [
      ["A103", "Sara Ahmed", "Beard Trim"],
      ["A104", "Mohammad U.", "Haircut"],
      ["A105", "Zainab F.", "Salon"],
    ],
    labels: [
      "Walk-in and booking merge into one ordered line.",
      "Names, service, and wait estimate on a single screen.",
      "Soft finish keeps the waiting area calm.",
    ],
    quote: "AzQueue keeps every chair filled and every customer moving — without the chaos.",
    tokenFormat: "A### — walk-in token, salon-ready service.",
  },
  {
    id: "hospitality",
    title: "Hospitality",
    tagline: "Restaurants and cafés see every party and table in one glance.",
    token: "T04",
    primary: "Khalid (4) · Table for 4",
    hero: "Party size, table status and service pulse on one board.",
    upNext: [
      ["T05", "Party of 2", "Waiting"],
      ["T06", "Party of 6", "Waiting"],
      ["T07", "Party of 3", "Prep"],
    ],
    labels: [
      "Party size and table type, not just order numbers.",
      "Cover tracking and wait-time rhythm for the full floor.",
      "Reservations and walk-ins blend into one hostess flow.",
    ],
    quote: "Our front desk moved from sticky notes to one screen. It changed service night to night.",
    tokenFormat: "T## — table ticket for party tracking.",
  },
  {
    id: "professional",
    title: "Professional",
    tagline: "Clinics, law firms and finance desks. Quiet precision.",
    token: "P012",
    primary: "Ali Khan · Consultation",
    hero: "Consultation, follow-up and intake — a soft, professional queue.",
    upNext: [
      ["P013", "Sara A.", "Follow-up"],
      ["P014", "Yahya M.", "New"],
      ["P015", "Hana B.", "Review"],
    ],
    labels: [
      "Names stay private; teams stay aligned.",
      "Appointment type and urgency at a glance.",
      "One dashboard for reception, advisors and guests.",
    ],
    quote: "Reception feels calm again. Every client is expected at the right moment.",
    tokenFormat: "P### — professional appointment token.",
  },
  {
    id: "fitness",
    title: "Fitness",
    tagline: "Gyms, yoga studios and PT rooms — clipboard chaos to schedule clarity.",
    token: "07",
    primary: "Ali Khan · PT — 60min",
    hero: "Session starts, drop-ins and class flow on one screen.",
    upNext: [
      ["08", "Sara", "Yoga"],
      ["09", "Mohammad", "PT"],
      ["10", "Amina", "Spin"],
    ],
    labels: [
      "Session type and coach assignment together.",
      "Drop-ins, members and walk-ins balanced by real wait data.",
      "Premium queue, even in a high-energy studio.",
    ],
    quote: "From warm-up to cool-down, we know who's next without yelling across the gym.",
    tokenFormat: "## — studio session token.",
  },
  {
    id: "homecare",
    title: "Home Care",
    tagline: "Care agencies. Caregiver dispatch, visit tracking and compliance — in one operational queue.",
    token: "HC042",
    primary: "CLIENT-0042 · Personal Care",
    hero: "Visits scheduled. Caregivers dispatched. Nothing falls through.",
    upNext: [
      ["HC043", "Fatima R.", "En route"],
      ["HC044", "Yusuf A.", "Pending"],
      ["HC045", "Amina K.", "Docs due"],
    ],
    labels: [
      "Caregiver scheduling and visit tracking on one board — no clipboards.",
      "Missing documentation flags surface automatically before they become compliance issues.",
      "Late arrival alerts keep coordinators informed without chasing phones.",
      "Denial tracking and approval queues so nothing gets lost in email threads.",
    ],
    quote: "We stopped losing visits in the cracks. AzQueue tells us what needs attention before it becomes a problem.",
    tokenFormat: "HC### — home care visit token. Caregiver and client ref on one card.",
    sage: true,
  },
];

function IndustryBlock({ industry }) {
  const accent = industry.sage ? "text-[#9bbd9b]" : "text-gold-soft";
  const border = industry.sage ? "border-[#506b50]" : "border-line";
  return (
    <section id={industry.id} className={`border-t ${border}`}>
      <div className="max-w-6xl mx-auto px-6 py-20">
        {industry.sage && (
          <div className="mb-6 inline-flex items-center gap-2 border border-[#506b50] bg-[rgba(80,107,80,0.06)] px-3 py-1.5">
            <span className="pip breathe" />
            <span className="ovline text-[9px] text-[#9bbd9b]">Operations module · Home Care</span>
          </div>
        )}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
          {/* Left — narrative */}
          <div className={`bg-bg-elev border ${border} p-10 lg:p-12`}>
            <div className={`ovline mb-3 ${accent}`}>{industry.title}</div>
            <h2 className="font-display text-4xl font-light tracking-tightest leading-tight mb-5">
              {industry.title}.
            </h2>
            <p className="text-ink-soft text-sm mb-3">{industry.tagline}</p>
            <p className={`font-display text-base ${accent} italic mb-10`}>{industry.hero}</p>

            <ul className="space-y-4 text-sm border-t border-line pt-6">
              {industry.labels.map((item) => (
                <li key={item} className="grid grid-cols-[16px_1fr] gap-3 items-start">
                  <span className={`pip mt-2 ${industry.sage ? "bg-[#7fa37f]" : ""}`} />
                  <span className="text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-line mt-10 pt-6">
              <div className="ovline text-[9px] mb-3">{industry.sage ? "Agency note" : "Customer note"}</div>
              <p className="text-ink text-sm italic font-display">"{industry.quote}"</p>
            </div>
          </div>

          {/* Right — live panel */}
          <LuxeFrame className="p-10 lg:p-12">
            <div className="flex items-center justify-between mb-6">
              <span className="ovline text-[9px]">{industry.sage ? "Visit in progress" : "Now Serving"}</span>
              <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
                <span className="pip breathe mr-1.5" /> Live
              </span>
            </div>
            <div className={`${industry.sage ? "sage-text" : "gold-text"} font-display text-7xl font-light tracking-tightest leading-none`}>
              {industry.token}
            </div>
            <div className="text-[10px] text-ink-mute mt-4 tracking-wide">{industry.primary}</div>

            <div className="rule-ornament my-7 text-[8px]"><span>✦</span></div>

            <div>
              <div className="ovline text-[9px] mb-4">{industry.sage ? "Caregiver dispatch" : "Up next"}</div>
              <div className="divide-y divide-line border-t border-b border-line">
                {industry.upNext.map(([token, name, detail]) => (
                  <div key={token} className="grid grid-cols-[60px_1fr_auto] gap-3 py-3 items-center">
                    <span className={`font-display ${accent} text-xs`}>{token}</span>
                    <span className="text-[12px]">{name}</span>
                    <span className="text-[9px] uppercase tracking-[0.2em] text-ink-mute">{detail}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rule-ornament my-6 text-[8px]"><span>·</span></div>

            <div>
              <div className="ovline text-[9px] mb-2">Token format</div>
              <div className="text-ink-soft text-xs">{industry.tokenFormat}</div>
            </div>
          </LuxeFrame>
        </div>
      </div>
    </section>
  );
}

export default function Industries() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-6 pt-20 pb-10 text-center">
        <div className="ovline text-gold-soft mb-3">Industries</div>
        <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-5">
          One engine.<br />
          <em className="not-italic text-gold-soft">Every business type.</em>
        </h1>
        <p className="text-ink-soft text-sm max-w-md mx-auto">
          Walk-ins and bookings, calibrated for your specific flow.
        </p>
      </div>

      {/* Sharp tab strip */}
      <div className="sticky top-0 z-20 bg-bg border-y border-line overflow-x-auto">
        <div className="max-w-6xl mx-auto px-6 flex min-w-max mx-auto">
          {INDUSTRIES.map((industry) => (
            <a
              key={industry.id}
              href={`#${industry.id}`}
              className={`px-5 py-4 text-[10px] tracking-[0.22em] uppercase transition border-r border-line last:border-r-0 whitespace-nowrap ${
                industry.sage
                  ? "text-[#506b50] hover:text-[#9bbd9b]"
                  : "text-ink-mute hover:text-gold"
              }`}
            >
              {industry.title}
            </a>
          ))}
        </div>
      </div>

      <div>
        {INDUSTRIES.map((industry) => (
          <IndustryBlock key={industry.id} industry={industry} />
        ))}
      </div>

      <div className="border-t border-line">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="ovline text-gold-soft mb-3">Ready</div>
          <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
            Match your industry.<br />
            <em className="not-italic text-gold-soft">Start in under an hour.</em>
          </h2>
          <p className="text-ink-soft text-sm mb-8">14-day trial · no card · live in under an hour.</p>
          <Link to="/select"><Button size="lg">Start free trial →</Button></Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
