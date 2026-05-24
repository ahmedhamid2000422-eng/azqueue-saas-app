import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import LuxeFrame from "../components/LuxeFrame";
import LiveTicker, { CountUp } from "../components/LiveTicker";

export default function Product() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <Hero />
      <CombinedQueue />
      <Autopilot />
      <FeatureRow />
      <ChannelRow />
      <CTA />
      <SiteFooter />
    </div>
  );
}

/* ── Hero ───────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="atmosphere-hero max-w-6xl mx-auto px-6 pt-20 pb-24">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <div className="ovline mb-5 inline-flex items-center gap-2 border border-line px-3 py-1">
            <span className="pip breathe" />
            Product · the flow engine
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-6">
            One engine.<br />
            <em className="not-italic gold-text-soft">Every flow.</em>
          </h1>
          <p className="text-ink-soft text-lg max-w-md mb-3">
            Walk-ins, bookings, prayer pauses, branch service.
          </p>
          <p className="font-display text-xl text-gold-soft italic mb-10">
            One queue, calibrated for premium service.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup"><Button>Start free trial →</Button></Link>
            <a href="#queue"><Button variant="ghost">See it live</Button></a>
          </div>
          <div className="text-[10px] text-ink-mute mt-5 tracking-wide">
            14-day trial · No card · Live in under an hour
          </div>
        </div>
        <HeroPanel />
      </div>
    </section>
  );
}

function HeroPanel() {
  return (
    <LuxeFrame className="p-7">
      <div className="flex items-center justify-between mb-4">
        <span className="ovline text-[9px]">Combined queue</span>
        <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1.5" /> Live
        </span>
      </div>

      <LiveTicker
        values={["A102", "T04", "P012", "07"]}
        intervalMs={3800}
      />
      <div className="text-[10px] text-ink-mute mt-3 tracking-wide">Counter 2 · Combined Mode</div>

      <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>

      <div className="grid grid-cols-2 gap-px bg-line border border-line">
        {[
          ["Walk-ins · today", 128],
          ["Bookings · today", 76],
          ["Avg wait", "12m"],
          ["Customer NPS", 72],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-elev p-3">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-1 gold-text-soft">
              {typeof v === "number" ? <CountUp to={v} /> : v}
            </div>
          </div>
        ))}
      </div>

      <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>

      <div>
        <div className="ovline text-[9px] mb-3">Service streams</div>
        {[
          ["Walk-in", "A102", "haircut"],
          ["Booking", "T04", "table for 4"],
          ["Booking", "P012", "consultation"],
        ].map(([source, token, detail]) => (
          <div key={token} className="grid grid-cols-[60px_50px_1fr] gap-2 py-1.5 items-center">
            <span className={`text-[9px] uppercase tracking-[0.1em] ${source === "Booking" ? "text-[#74b9e8]" : "text-gold-soft"}`}>
              {source}
            </span>
            <span className="font-display text-gold-soft text-xs">{token}</span>
            <span className="text-[11px] text-ink-soft">{detail}</span>
          </div>
        ))}
      </div>
    </LuxeFrame>
  );
}

/* ── 01 · Combined Queue ────────────────────────────────────────── */
function CombinedQueue() {
  return (
    <section id="queue" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-14">
        <div className="ovline mb-3 text-gold-soft">01 · The Combined Queue</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Walk-in and booking <em className="not-italic gold-text-soft">merge without friction.</em>
        </h2>
        <p className="text-ink-soft text-sm mt-3 max-w-md mx-auto">
          One ordered stream. No second app. No paper slip.
        </p>
      </div>

      <TicketFlow />

      <div className="grid md:grid-cols-4 gap-px bg-line border border-line mt-10">
        {[
          ["Single screen", "One ticket pool, both inputs visible."],
          ["Fair priority", "Bookings hold a soft window; walk-ins fill gaps."],
          ["No double-staffing", "One staff button covers both flows."],
          ["No reset", "Prayer pauses, breaks — queue holds its position."],
        ].map(([t, d]) => (
          <div key={t} className="bg-bg-elev p-6">
            <div className="ovline text-gold-soft mb-2">{t}</div>
            <p className="text-ink-soft text-xs leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* TicketFlow — two luxury ticket cards converging into a Combined panel */
function TicketFlow() {
  return (
    <div className="grid lg:grid-cols-[1fr_64px_1.1fr] gap-6 lg:gap-0 items-center">
      {/* Two source ticket cards */}
      <div className="space-y-4">
        <TicketCard
          source="walk"
          token="A102"
          name="Ali Khan"
          service="Haircut"
          counter="Counter 2"
          time="14:18"
        />
        <TicketCard
          source="book"
          token="P012"
          name="Sara A."
          service="Consultation"
          counter="Slot 14:30"
          time="12:42"
        />
      </div>

      {/* Flow connector */}
      <div className="hidden lg:flex flex-col items-center justify-center h-full relative">
        <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gold-deep to-gold-deep" />
        <div className="w-2 h-2 border border-gold-deep rotate-45 my-2 bg-bg" />
        <div className="ovline text-[8px] text-gold-soft py-1">into</div>
        <div className="w-2 h-2 border border-gold-deep rotate-45 my-2 bg-bg" />
        <div className="w-px flex-1 bg-gradient-to-t from-transparent via-gold-deep to-gold-deep" />
      </div>

      {/* Combined panel */}
      <CombinedPanel />
    </div>
  );
}

/* Single ticket card — luxury boarding-pass aesthetic */
function TicketCard({ source, token, name, service, counter, time }) {
  const isBook = source === "book";
  const sourceColor = isBook ? "text-[#74b9e8]" : "text-gold-soft";
  const sourceLabel = isBook ? "Booking" : "Walk-in";

  return (
    <div className="relative grid grid-cols-[24px_1fr] luxe-panel border border-line">
      {/* Perforated stub edge */}
      <div className="relative border-r border-line border-dashed flex flex-col items-center justify-center py-2 gap-1.5">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-line-2" />
        ))}
      </div>

      {/* Ticket body */}
      <div className="px-6 py-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`ovline text-[9px] ${sourceColor} flex items-center gap-1.5`}>
            <span className="pip" style={{ background: isBook ? "#74b9e8" : "#c9a86a" }} />
            {sourceLabel}
          </div>
          <div className="text-[9px] text-ink-mute font-mono tracking-wide">{time}</div>
        </div>

        <div className="flex items-baseline justify-between gap-4">
          <div className="gold-text font-display text-5xl font-light tracking-tightest leading-none">
            {token}
          </div>
          <div className="text-right">
            <div className="text-xs text-ink leading-tight">{name}</div>
            <div className="text-[10px] text-ink-mute mt-0.5 tracking-wide">{service}</div>
          </div>
        </div>

        <div className="rule-ornament mt-4 mb-3 text-[7px]"><span>·</span></div>

        <div className="flex items-center justify-between text-[9px] text-ink-mute uppercase tracking-[0.18em]">
          <span>{counter}</span>
          <span>KL Downtown</span>
        </div>
      </div>
    </div>
  );
}

/* Combined queue panel — receipt-style ledger of merged tickets */
function CombinedPanel() {
  return (
    <LuxeFrame className="p-7">
      <div className="flex items-center justify-between mb-4">
        <div className="ovline text-[9px]">Combined queue</div>
        <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1.5" /> Live
        </span>
      </div>

      <div className="text-[10px] text-ink-mute mb-2 tracking-wide">Now serving</div>
      <div className="gold-text font-display text-7xl font-light tracking-tightest leading-none mb-1">
        A102
      </div>
      <div className="text-[10px] text-ink-mute mb-5 tracking-wide">Counter 2 · Walk-in · Ali Khan</div>

      <div className="rule-ornament my-4 text-[8px]"><span>✦</span></div>

      <div className="ovline text-[9px] mb-3">Sequence · merged & priority-ordered</div>
      <div className="space-y-px bg-line border border-line">
        {[
          { pos: "1", token: "A102", source: "walk", note: "now serving" },
          { pos: "2", token: "P012", source: "book", note: "slot 14:30" },
          { pos: "3", token: "T04",  source: "book", note: "slot 14:45" },
          { pos: "4", token: "A103", source: "walk", note: "wait 8m" },
          { pos: "5", token: "A104", source: "walk", note: "wait 12m" },
        ].map((r, i) => (
          <div
            key={r.pos}
            className={`grid grid-cols-[28px_60px_1fr_auto] gap-3 px-3 py-2 items-center ${
              i === 0 ? "bg-[rgba(201,168,106,0.06)]" : "bg-bg-elev"
            }`}
          >
            <span className="ovline text-[8px] text-ink-mute">{r.pos}</span>
            <span className="font-display text-gold-soft text-xs">{r.token}</span>
            <span className={`text-[9px] uppercase tracking-[0.18em] ${
              r.source === "book" ? "text-[#74b9e8]" : "text-gold-soft"
            }`}>
              {r.source === "book" ? "Booking" : "Walk-in"}
            </span>
            <span className="text-[10px] text-ink-mute">{r.note}</span>
          </div>
        ))}
      </div>

      <div className="rule-ornament my-4 text-[8px]"><span>·</span></div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        {[
          ["Walk-ins", 3],
          ["Bookings", 2],
          ["Avg wait", "8m"],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-elev p-2.5 text-center">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-1 gold-text-soft">
              {typeof v === "number" ? <CountUp to={v} /> : v}
            </div>
          </div>
        ))}
      </div>
    </LuxeFrame>
  );
}

/* ── 02 · Autopilot ─────────────────────────────────────────────── */
function Autopilot() {
  // Live countdown ticker for the autopilot panel
  const [seconds, setSeconds] = useState(8);
  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => (s <= 1 ? 12 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-gold-soft">02 · Autopilot</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Pace the queue with <em className="not-italic gold-text-soft">intelligent timing.</em>
        </h2>
        <p className="text-ink-soft text-sm mt-3 max-w-md mx-auto">
          Adaptive · staff-aware · pause-aware.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 items-stretch">
        <LuxeFrame className="p-10">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
            <div>
              <div className="ovline text-[9px]">Countdown</div>
              <div className="gold-text font-display text-6xl font-light leading-none mt-1">{seconds}s</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-ink-mute uppercase tracking-[0.2em]">Next call</div>
              <div className="text-ink text-sm mt-1">A102 · Haircut</div>
              <div className="text-[10px] text-ink-mute mt-1">Counter 2</div>
            </div>
          </div>

          <div className="relative mx-auto w-52 h-52 my-2">
            <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
              <defs>
                <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7fa37f" />
                  <stop offset="100%" stopColor="#cde0cd" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#26262a" strokeWidth="6" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ring-grad)" strokeWidth="6"
                strokeDasharray="326" strokeDashoffset="98" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-mute">Pacing</div>
              <div className="gold-text font-display text-5xl font-light mt-1">82%</div>
              <div className="text-[9px] text-ink-mute tracking-wide mt-2">on rhythm</div>
            </div>
          </div>

          <div className="rule-ornament my-6 text-[8px]"><span>✦</span></div>

          <div className="grid grid-cols-3 gap-px bg-line border border-line">
            {[
              ["Calls / hr", 21],
              ["Service · avg", "4m"],
              ["Idle staff", 0],
            ].map(([l, v]) => (
              <div key={l} className="bg-bg-elev p-3 text-center">
                <div className="ovline text-[8px]">{l}</div>
                <div className="font-display text-base mt-1 gold-text-soft">
                  {typeof v === "number" ? <CountUp to={v} /> : v}
                </div>
              </div>
            ))}
          </div>
        </LuxeFrame>

        <div className="bg-bg-elev border border-line p-10">
          <p className="text-ink-soft text-sm mb-6">
            Autopilot keeps service moving at a premium rhythm. Speeds up when staff are ahead. Slows down when the queue grows. Pauses gracefully for prayer and breaks.
          </p>
          <ul className="space-y-4 text-sm border-t border-line pt-6">
            {[
              ["Adaptive", "Calls calibrated to your real service time."],
              ["Staff-aware", "Slows down when called > active staff."],
              ["Pause-aware", "Halts during prayer or breaks automatically."],
            ].map(([t, d]) => (
              <li key={t} className="grid grid-cols-[16px_1fr] gap-3 items-start">
                <span className="pip mt-2" />
                <div>
                  <div className="text-ink">{t}</div>
                  <div className="text-ink-mute text-xs mt-0.5">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Islamic Mode + Insights row ────────────────────────────────── */
function FeatureRow() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        <div className="bg-bg-elev border border-[#506b50] p-10">
          <div className="ovline text-[#9bbd9b] mb-3">Feature · Islamic Mode</div>
          <h2 className="font-display text-3xl font-light tracking-tighter mb-4">
            Prayer-aware <em className="not-italic gold-text-soft">queue timing.</em>
          </h2>
          <p className="text-ink-soft text-sm mb-6">
            Islamic Mode treats prayer pauses as a first-class part of service flow. Blocks calls before prayer, surfaces the next window, and keeps customers informed while the world stops.
          </p>

          <LuxeFrame variant="sage" className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="ovline text-[9px] text-[#9bbd9b] flex items-center">
                <span className="pip breathe mr-1.5" /> Next prayer
              </div>
              <div className="text-[10px] text-ink-mute uppercase tracking-[0.2em]">Auto-pause</div>
            </div>
            <div className="gold-text font-display text-4xl font-light leading-none">Dhuhr · 13:15</div>
            <div className="rule-ornament my-4 text-[8px]"><span>·</span></div>
            <div className="text-[10px] text-ink-mute tracking-wide">
              Resumes 13:35 · <CountUp to={12} /> customers notified
            </div>
          </LuxeFrame>

          <Link to="/islamic-mode" className="text-[10px] tracking-[0.2em] uppercase text-gold-soft hover:text-gold mt-5 inline-block">
            See Islamic Mode →
          </Link>
        </div>

        <InsightsLedger />
      </div>
    </section>
  );
}

/* InsightsLedger — premium alert ledger like a private banking statement */
function InsightsLedger() {
  const items = [
    {
      time: "09:42",
      mark: "✱",
      severity: "warn",
      title: "Slow service alert",
      body: "Tickets over 18m flagged for intervention.",
      impact: "−12%",
      impactLabel: "wait",
      direction: "down",
    },
    {
      time: "11:08",
      mark: "✦",
      severity: "info",
      title: "Booking conversion",
      body: "Unconfirmed slots surfaced before next service window.",
      impact: "+24%",
      impactLabel: "fill",
      direction: "up",
    },
    {
      time: "13:21",
      mark: "✦",
      severity: "info",
      title: "Idle staff insight",
      body: "Underused chairs highlighted for throughput.",
      impact: "+8%",
      impactLabel: "util",
      direction: "up",
    },
    {
      time: "16:55",
      mark: "✱",
      severity: "warn",
      title: "Repeat-customer drift",
      body: "Loyalty cohort waiting longer than first-timers.",
      impact: "−4%",
      impactLabel: "NPS",
      direction: "down",
    },
  ];

  return (
    <LuxeFrame className="p-9">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="ovline text-gold-soft mb-2">Feature · Insights</div>
          <h2 className="font-display text-3xl font-light tracking-tighter">
            Actionable queue <em className="not-italic gold-text-soft">intelligence.</em>
          </h2>
        </div>
        <div className="ovline text-[9px] text-ink-mute hidden md:block">Today · 4 entries</div>
      </div>

      {/* Ledger header */}
      <div className="grid grid-cols-[44px_18px_1fr_70px] gap-3 px-1 pb-2 border-b border-line">
        {["Time", "·", "Insight", "Impact"].map((h, i) => (
          <div key={i} className={`ovline text-[8px] text-ink-mute ${i === 3 ? "text-right" : ""}`}>{h}</div>
        ))}
      </div>

      {/* Ledger rows */}
      <div className="divide-y divide-line border-b border-line">
        {items.map((item) => (
          <div
            key={item.title}
            className="grid grid-cols-[44px_18px_1fr_70px] gap-3 px-1 py-4 items-baseline hover:bg-[rgba(201,168,106,0.03)] transition"
          >
            {/* Time */}
            <div className="font-mono text-[10px] text-gold-soft tracking-wide">{item.time}</div>

            {/* Severity ornament */}
            <div className={`text-[12px] leading-none ${
              item.severity === "warn" ? "text-[#d49185]" : "text-gold-soft"
            }`}>
              {item.mark}
            </div>

            {/* Title + body */}
            <div>
              <div className="text-sm text-ink leading-tight">{item.title}</div>
              <p className="text-ink-mute text-[11px] mt-1 leading-relaxed">{item.body}</p>
            </div>

            {/* Impact pill with arrow */}
            <div className="text-right">
              <div className={`inline-flex items-baseline gap-1 font-display text-base ${
                item.direction === "up" ? "text-[#9bbd9b]" : "text-[#d49185]"
              }`}>
                <span className="text-[10px]">{item.direction === "up" ? "▲" : "▼"}</span>
                <span>{item.impact}</span>
              </div>
              <div className="ovline text-[8px] text-ink-mute mt-0.5">{item.impactLabel}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rule-ornament my-6 text-[8px]"><span>✦</span></div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        {[
          ["Recalculated", "Nightly"],
          ["Scope", "Per branch"],
          ["Insights", 47],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-elev p-3 text-center">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-1 gold-text-soft">
              {typeof v === "number" ? <CountUp to={v} /> : v}
            </div>
          </div>
        ))}
      </div>
    </LuxeFrame>
  );
}

/* ── WhatsApp + Multi-branch ────────────────────────────────────── */
function ChannelRow() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 items-stretch">
        <LuxeFrame className="p-8">
          <div className="ovline text-gold-soft mb-3">WhatsApp-first</div>
          <h2 className="font-display text-3xl font-light tracking-tighter mb-6">
            Notifications built for <em className="not-italic gold-text-soft">customers.</em>
          </h2>

          <WhatsAppChat />

          <div className="rule-ornament my-6 text-[8px]"><span>·</span></div>

          <div className="grid grid-cols-3 gap-px bg-line border border-line">
            {[
              ["Sent · today", 184],
              ["Open rate", "97%"],
              ["Languages", 5],
            ].map(([l, v]) => (
              <div key={l} className="bg-bg-elev p-3 text-center">
                <div className="ovline text-[8px]">{l}</div>
                <div className="font-display text-base mt-1 gold-text-soft">
                  {typeof v === "number" ? <CountUp to={v} /> : v}
                </div>
              </div>
            ))}
          </div>
        </LuxeFrame>

        <BranchOpsPanel />
      </div>
    </section>
  );
}

/* Multi-branch operations panel — premium ops dashboard with sparklines */
function BranchOpsPanel() {
  const branches = [
    {
      name: "KL Downtown",
      city: "Bukit Bintang · Mon–Sun",
      tickets: 12,
      wait: "9m",
      load: 0.78,
      status: "live",
      spark: [4, 6, 5, 8, 11, 9, 12, 10, 13, 12],
    },
    {
      name: "Bangsar Studio",
      city: "Bangsar · Mon–Sat",
      tickets: 8,
      wait: "6m",
      load: 0.52,
      status: "live",
      spark: [3, 4, 6, 5, 7, 8, 6, 8, 7, 8],
    },
    {
      name: "Puchong Clinic",
      city: "Puchong · Tue–Sun",
      tickets: 5,
      wait: "4m",
      load: 0.34,
      status: "live",
      spark: [1, 2, 3, 4, 4, 5, 5, 5, 6, 5],
    },
    {
      name: "Subang Atelier",
      city: "Subang · opening soon",
      tickets: 0,
      wait: "—",
      load: 0,
      status: "closed",
      spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ];

  return (
    <LuxeFrame className="p-9">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="ovline text-gold-soft mb-2">Multi-branch</div>
          <h2 className="font-display text-3xl font-light tracking-tighter">
            One dashboard <em className="not-italic gold-text-soft">across locations.</em>
          </h2>
        </div>
        <div className="ovline text-[9px] text-ink-mute hidden md:block">Updated · just now</div>
      </div>

      <p className="text-ink-soft text-sm mb-6 max-w-md">
        Every branch on one screen. Queue, performance, service flow — without switching apps.
      </p>

      {/* Column header */}
      <div className="grid grid-cols-[1.2fr_72px_50px_60px_70px] gap-3 px-4 pb-2 border-b border-line">
        {["Branch", "Today", "Live", "Wait", "Status"].map((h) => (
          <div key={h} className="ovline text-[8px] text-ink-mute">{h}</div>
        ))}
      </div>

      <div className="divide-y divide-line">
        {branches.map((b) => (
          <div
            key={b.name}
            className="grid grid-cols-[1.2fr_72px_50px_60px_70px] gap-3 px-4 py-4 items-center hover:bg-[rgba(201,168,106,0.03)] transition"
          >
            {/* Branch */}
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`pip ${b.status === "live" ? "breathe" : "opacity-30"}`}
                style={{ background: b.status === "live" ? "#9bbd9b" : "#6e6c65" }}
              />
              <div className="min-w-0">
                <div className="font-display text-sm text-ink truncate">{b.name}</div>
                <div className="text-[10px] text-ink-mute truncate tracking-wide">{b.city}</div>
              </div>
            </div>

            {/* Sparkline */}
            <Sparkline data={b.spark} active={b.status === "live"} />

            {/* Tickets */}
            <div className="font-display text-base gold-text-soft text-right">
              {b.status === "live" ? <CountUp to={b.tickets} /> : "—"}
            </div>

            {/* Wait */}
            <div className="text-right">
              <div className="text-[11px] text-ink font-mono">{b.wait}</div>
              {b.status === "live" && (
                <div className="h-0.5 bg-line mt-1 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-gold-deep to-gold" style={{ width: `${b.load * 100}%` }} />
                </div>
              )}
            </div>

            {/* Status pill */}
            <div className="text-right">
              <span className={`inline-block text-[8px] uppercase tracking-[0.2em] px-2 py-1 border ${
                b.status === "live"
                  ? "border-[#506b50] text-[#9bbd9b] bg-[rgba(80,107,80,0.08)]"
                  : "border-line text-ink-mute"
              }`}>
                {b.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rule-ornament my-6 text-[8px]"><span>✦</span></div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        {[
          ["Branches", 4],
          ["Live tickets", 25],
          ["Avg load", "63%"],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-elev p-3 text-center">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-1 gold-text-soft">
              {typeof v === "number" ? <CountUp to={v} /> : v}
            </div>
          </div>
        ))}
      </div>
    </LuxeFrame>
  );
}

/* Sparkline — minimal SVG line graph for branch traffic over time */
function Sparkline({ data, active }) {
  if (!active || !data.some((v) => v > 0)) {
    return (
      <div className="flex items-center h-6">
        <div className="h-px bg-line w-full" />
      </div>
    );
  }
  const max = Math.max(...data, 1);
  const w = 70;
  const h = 24;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h * 0.85 - 1}`).join(" ");
  // Path version for a smoother feel
  const pathD = "M" + points.split(" ").join(" L");
  // Fill polygon: start from bottom-left, follow points, end at bottom-right
  const fillD = `${pathD} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6 overflow-visible">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a86a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c9a86a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#spark-fill)" />
      <path d={pathD} fill="none" stroke="#e4cb95" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* End point dot */}
      <circle
        cx={(data.length - 1) * step}
        cy={h - (data[data.length - 1] / max) * h * 0.85 - 1}
        r="1.6"
        fill="#f5e3b9"
      />
    </svg>
  );
}

/* ── WhatsApp chat mockup ───────────────────────────────────────── */
function WhatsAppChat() {
  // Subtle ambient texture for the chat surface — feels like an actual phone screen
  const surface = {
    background:
      "radial-gradient(60% 40% at 50% 0%, rgba(127,163,127,0.06), transparent 70%), linear-gradient(180deg, #0d1310 0%, #0a0e0c 100%)",
  };

  const messages = [
    {
      token: "A102",
      service: "Haircut",
      body: "Your booking is confirmed for 14:30 today. We'll send a heads-up before you're called.",
      time: "09:12",
      read: true,
    },
    {
      token: "A102",
      service: "Now serving",
      body: "You're next, Ali. Walk in now — Counter 2.",
      time: "14:18",
      read: true,
      live: true,
    },
    {
      token: "A102",
      service: "Thank you",
      body: "Thanks for visiting. Tap to rate your experience — ★ ★ ★ ★ ★",
      time: "14:52",
      read: false,
    },
  ];

  return (
    <div className="border border-[#1a3a26] bg-[#0a0e0c]" style={surface}>
      {/* Phone header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a3a26] bg-[#0f1612]">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366] to-[#0d6a3a] flex items-center justify-center font-display text-[#0b0b0c] text-xs shadow-[0_0_18px_rgba(37,211,102,0.25)]">
          A
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-ink leading-tight">AzQueue · KL Downtown</div>
          <div className="flex items-center gap-1.5 text-[9px] text-[#9bbd9b] tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
            online · typing rarely, calling never
          </div>
        </div>
        <div className="text-[9px] text-ink-mute font-mono uppercase tracking-[0.2em]">end-to-end</div>
      </div>

      {/* Day separator */}
      <div className="flex justify-center py-3">
        <div className="text-[9px] text-ink-mute uppercase tracking-[0.22em] bg-[#0f1612] border border-[#1a3a26] px-3 py-1 rounded-full">
          Today
        </div>
      </div>

      {/* Bubbles */}
      <div className="px-4 pb-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className="flex">
            {/* Bubble — left-aligned (from business → customer view) */}
            <div className="max-w-[88%] relative bg-[#11241b] border border-[#1f3a2a] rounded-2xl rounded-tl-sm px-4 py-3 shadow-[0_2px_18px_rgba(0,0,0,0.4)]">
              {/* Sender chip */}
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[#9bbd9b] text-[11px] tracking-tight">{m.token}</span>
                  <span className="text-[9px] text-ink-mute uppercase tracking-[0.18em]">{m.service}</span>
                </div>
                {m.live && (
                  <span className="text-[8px] text-[#9bbd9b] uppercase tracking-[0.2em] flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#25D366] animate-pulse" />
                    live
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="text-[12px] text-ink leading-relaxed">{m.body}</div>

              {/* Meta */}
              <div className="flex items-center justify-end gap-1.5 mt-1.5 -mb-0.5">
                <span className="text-[9px] text-ink-mute font-mono">{m.time}</span>
                {/* WhatsApp-style read receipt — two ticks */}
                <svg viewBox="0 0 16 12" className="w-3 h-3" fill="none" stroke={m.read ? "#74b9e8" : "#6e6c65"} strokeWidth="1.5">
                  <path d="M1 6.5 L4.5 10 L11 2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 6.5 L8.5 10 L15 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composer hint */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1a3a26] bg-[#0f1612]">
        <div className="flex-1 h-8 rounded-full bg-[#0a0e0c] border border-[#1a3a26] px-3 flex items-center text-[10px] text-ink-mute italic">
          Customers don't reply — this channel is one-way & on-brand.
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-[#0d6a3a] flex items-center justify-center text-[#0b0b0c] text-[14px]">
          →
        </div>
      </div>
    </div>
  );
}

/* ── CTA ────────────────────────────────────────────────────────── */
function CTA() {
  return (
    <section className="atmosphere-hero max-w-3xl mx-auto px-6 py-24 border-t border-line text-center">
      <div className="ovline text-gold-soft mb-3">Ready</div>
      <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
        See it live.<br />
        <em className="not-italic gold-text-soft">In under an hour.</em>
      </h2>
      <p className="text-ink-soft text-sm mb-8">14-day trial · no card · live in under an hour.</p>
      <Link to="/signup"><Button size="lg">Start free trial →</Button></Link>
    </section>
  );
}
