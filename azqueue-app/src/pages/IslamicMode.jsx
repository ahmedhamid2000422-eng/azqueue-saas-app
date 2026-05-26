import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import LuxeFrame from "../components/LuxeFrame";
import { CountUp } from "../components/LiveTicker";
import usePageMeta from "../lib/usePageMeta";

const PRAYERS = [
  { name: "Fajr", time: "05:42", note: "Pre-dawn pause · gentle resume." },
  { name: "Dhuhr", time: "13:15", note: "Mid-day pause · 20 minute window." },
  { name: "Asr", time: "16:32", note: "Afternoon pause · prayer-aware reschedule." },
  { name: "Maghrib", time: "19:21", note: "Sunset pause · evening flow continues." },
  { name: "Isha", time: "20:38", note: "Night pause · close-of-day handling." },
  { name: "Jumu'ah", time: "Fri 13:15", note: "Friday block · 60 minute reservation." },
];

const PRINCIPLES = [
  {
    title: "Prayer is not a feature",
    body: "It's a first-class part of how the queue thinks. Time, intention, and presence all build into the engine.",
  },
  {
    title: "Customers stay informed",
    body: "Automatic WhatsApp messages let people pause with confidence. They know when service resumes — to the minute.",
  },
  {
    title: "Staff stay calm",
    body: "No manual reset. No restart. The queue holds its place and resumes from exactly where it stopped.",
  },
];

const SCRIPTURE_INTENT =
  "Indeed, prayer has been decreed upon the believers a decree of specified times. — Qur'an 4:103";

export default function IslamicMode() {
  usePageMeta({
    title: "Islamic Mode — Prayer-Aware Queue Scheduling · AzQueue",
    description: "Islamic Mode pauses the queue automatically for each daily prayer, notifies customers in line, and resumes from the same position. Built for businesses in Muslim-majority markets.",
    canonical: "/islamic-mode",
  });
  return (
    <div className="min-h-screen bg-bg text-ink pt-[60px]">
      <SiteNav solid />
      <Hero />
      <Promise />
      <PrayerGrid />
      <FlowPanel />
      <Principles />
      <Pricing />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="atmosphere-hero atmosphere-prayer max-w-6xl mx-auto px-6 pt-20 pb-24">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <div className="ovline mb-5 inline-flex items-center gap-2 border border-[#506b50] px-3 py-1 text-[#9bbd9b]">
            <span className="pip breathe" />
            Islamic Mode · prayer-aware
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-6">
            The queue that<br />
            <em className="not-italic gold-text-soft">prays with you.</em>
          </h1>
          <p className="text-ink-soft text-lg max-w-md mb-3">
            Five daily prayers. Jumu'ah Friday. Auto-paused, auto-resumed.
          </p>
          <p className="font-display text-xl text-gold-soft italic mb-10">
            Halal flow. Premium service.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup"><Button>Start free trial →</Button></Link>
            <a href="#prayers"><Button variant="ghost">See prayer flow</Button></a>
          </div>
          <div className="text-[10px] text-ink-mute mt-5 tracking-wide">
            Included on Professional · enabled in one tap
          </div>
        </div>
        <PrayerLivePanel />
      </div>
    </section>
  );
}

function PrayerLivePanel() {
  return (
    <LuxeFrame variant="sage" className="p-7">
      <div className="flex items-center justify-between mb-4">
        <span className="ovline text-[9px] text-[#9bbd9b]">Next prayer</span>
        <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1.5" /> Auto-pause
        </span>
      </div>
      <div className="gold-text font-display text-7xl font-light tracking-tightest leading-none">Dhuhr</div>
      <div className="text-[12px] text-ink-mute mt-3 tracking-wide">13:15 · in 41 minutes</div>

      <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        {[
          ["Pause window", "20 min"],
          ["Notified", 12],
          ["Resume", "13:35"],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-elev p-2.5">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-0.5 gold-text-soft">
              {typeof v === "number" ? <CountUp to={v} /> : v}
            </div>
          </div>
        ))}
      </div>

      <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>

      <div>
        <div className="ovline text-[9px] mb-3">Customers notified · WhatsApp</div>
        {[
          ["A102", "Ali Khan", "Resumes 13:35"],
          ["A103", "Sara Ahmed", "Resumes 13:35"],
          ["A104", "Mohammad U.", "Resumes 13:35"],
        ].map(([token, name, status]) => (
          <div key={token} className="grid grid-cols-[52px_1fr_auto] gap-2 py-1.5 items-center">
            <span className="font-display text-gold-soft text-xs">{token}</span>
            <span className="text-[11px]">{name}</span>
            <span className="text-[9px] uppercase tracking-[0.1em] text-[#9bbd9b]">{status.split(" ").pop()}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-line mt-4 pt-3 text-[10px] text-ink-mute italic font-display text-center">
        {SCRIPTURE_INTENT}
      </div>
    </LuxeFrame>
  );
}

function Promise() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <div className="ovline mb-3 text-[#d49185]">Without it</div>
          <h3 className="font-display text-2xl font-light mb-6 tracking-tighter">Prayer disrupts the queue.</h3>
          <ul className="space-y-4 text-ink-soft text-sm">
            {[
              "Staff scramble to reset the queue after each prayer.",
              "Customers in line don't know how long the pause lasts.",
              "Walk-ins keep arriving during prayer, expecting service.",
              "The queue restarts manually — losing position and trust.",
            ].map((p) => (
              <li key={p} className="flex gap-3">
                <span className="w-1 h-1 rounded-full bg-[#b56b5f] mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="ovline mb-3 text-[#9bbd9b]">With Islamic Mode</div>
          <h3 className="font-display text-2xl font-light mb-6 tracking-tighter">Prayer becomes part of the flow.</h3>
          <ul className="space-y-4 text-ink-soft text-sm">
            {[
              "Queue auto-pauses 10 min before each prayer.",
              "Customers receive WhatsApp with exact resume time.",
              "New arrivals see a calm 'paused for prayer' screen.",
              "After salah, queue resumes from the same position — automatically.",
            ].map((p) => (
              <li key={p} className="flex gap-3">
                <span className="w-1 h-1 rounded-full bg-[#9bbd9b] mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function PrayerGrid() {
  return (
    <section id="prayers" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-[#9bbd9b]">Six prayer windows</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Five daily. <em className="not-italic text-gold-soft">Jumu'ah Friday.</em>
        </h2>
        <p className="text-ink-soft text-sm mt-3 max-w-md mx-auto">
          Calculated by location. Adjustable per branch. Refreshed daily.
        </p>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-px bg-line border border-line">
        {PRAYERS.map((p) => (
          <div key={p.name} className="bg-bg-elev p-6">
            <div className="ovline text-[9px] text-[#9bbd9b] mb-2">{p.name}</div>
            <div className="font-display text-2xl text-gold font-light tracking-tighter">{p.time}</div>
            <div className="border-t border-line mt-4 pt-3 text-[10px] text-ink-mute leading-relaxed">{p.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlowPanel() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-gold-soft">The flow</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          From adhan to <em className="not-italic text-gold-soft">resume.</em>
        </h2>
      </div>
      <div className="grid md:grid-cols-4 gap-px bg-line border border-line">
        {[
          { n: "01", title: "10 min before", body: "Queue receives a soft signal. Staff finishes current customer." },
          { n: "02", title: "Adhan", body: "Queue pauses. Customers receive WhatsApp with resume time." },
          { n: "03", title: "Salah", body: "'Paused for prayer' screen displayed. New arrivals informed." },
          { n: "04", title: "Resume", body: "Queue resumes from the exact same position. No reset." },
        ].map((s) => (
          <div key={s.n} className="bg-bg-elev p-7">
            <div className="font-display text-[#9bbd9b] text-3xl font-light mb-3">{s.n}</div>
            <div className="text-sm font-medium mb-2">{s.title}</div>
            <p className="text-ink-soft text-xs leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Principles() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-[#9bbd9b]">Built with intention</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Halal-first <em className="not-italic text-gold-soft">design.</em>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-px bg-line border border-line">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="bg-bg-elev p-8">
            <div className="font-display text-xl mb-4">{p.title}</div>
            <p className="text-ink-soft text-sm leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-20 border-t border-line">
      <div className="bg-bg-elev border border-[#506b50] p-10 text-center">
        <div className="ovline mb-3 text-[#9bbd9b]">Included</div>
        <h2 className="font-display text-3xl font-light tracking-tighter mb-4">
          Islamic Mode is included on Professional.
        </h2>
        <p className="text-ink-soft text-sm mb-6 max-w-md mx-auto">
          One tap to enable. Works in both Business and Personal modes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/signup?tier=professional"><Button>Start Professional trial →</Button></Link>
          <Link to="/#pricing"><Button variant="ghost">See all plans</Button></Link>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24 border-t border-line text-center">
      <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
        Serve with calm.<br />
        <em className="not-italic text-gold-soft">Pause with grace.</em>
      </h2>
      <p className="text-ink-soft text-sm mb-8">14-day trial · no card · live in under an hour.</p>
      <Link to="/signup?tier=professional"><Button size="lg">Start free trial →</Button></Link>
    </section>
  );
}
