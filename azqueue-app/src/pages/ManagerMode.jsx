import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import LuxeFrame from "../components/LuxeFrame";
import { CountUp } from "../components/LiveTicker";

const ALERTS = [
  { tag: "Long task", who: "Mohammad U.", body: "Haircut · 32 min · usually 18 min", level: "warn" },
  { tag: "Off-pattern", who: "Sara A.", body: "Break at 14:18 · usually 14:30", level: "info" },
  { tag: "Wellness", who: "Yusuf K.", body: "5h 20m without break · suggest pause", level: "warn" },
  { tag: "Idle", who: "Counter 3", body: "8 min idle · queue has 4 waiting", level: "info" },
];

const PILLARS = [
  {
    n: "01",
    title: "Break-pattern intelligence",
    body: "Each staff member has a rhythm. Manager Mode learns it — and tells you when someone breaks early, late, or skips entirely.",
  },
  {
    n: "02",
    title: "Anomaly detection",
    body: "When a service takes 80% longer than the staff member's own average, you know. Before the queue notices.",
  },
  {
    n: "03",
    title: "Wellness signals",
    body: "Hours without break, consecutive customers, escalation rate — surfaced gently, never as surveillance.",
  },
  {
    n: "04",
    title: "Performance review",
    body: "Weekly digest per staff member. Pulled from queue data, not gut feeling.",
  },
];

export default function ManagerMode() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <Hero />
      <Promise />
      <PillarGrid />
      <AlertFeedSection />
      <Patterns />
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
            Manager · business only
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-6">
            See your people<br />
            <em className="not-italic gold-text-soft">before the queue does.</em>
          </h1>
          <p className="text-ink-soft text-lg max-w-md mb-3">
            Break patterns. Anomalies. Wellness. Performance.
          </p>
          <p className="font-display text-xl text-gold-soft italic mb-10">
            Quiet intelligence — never surveillance.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup?tier=manager"><Button>Start Manager trial →</Button></Link>
            <a href="#pillars"><Button variant="ghost">See the signals</Button></a>
          </div>
          <div className="text-[10px] text-ink-mute mt-5 tracking-wide">
            Business mode only · 14-day trial · no card
          </div>
        </div>
        <ManagerLivePanel />
      </div>
    </section>
  );
}

function ManagerLivePanel() {
  const staff = [
    { name: "Yusuf K.", role: "Senior", state: "serving", hours: "5h 20m", flag: "wellness" },
    { name: "Sara A.", role: "Stylist", state: "serving", hours: "3h 10m" },
    { name: "Mohammad U.", role: "Stylist", state: "long task", hours: "2h 40m", flag: "long" },
    { name: "Hana B.", role: "Junior", state: "on break", hours: "4h 00m" },
  ];

  return (
    <LuxeFrame variant="sage" className="p-7">
      <div className="flex items-center justify-between mb-4">
        <span className="ovline text-[9px] text-[#9bbd9b]">Staff · live</span>
        <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1.5" /> Watching
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line mb-5">
        {[
          ["Active", 3],
          ["On break", 1],
          ["Alerts", 2],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-elev p-3">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-1 gold-text-soft">
              <CountUp to={v} />
            </div>
          </div>
        ))}
      </div>

      <div className="rule-ornament my-4 text-[8px]"><span>·</span></div>

      <div className="ovline text-[9px] mb-3">Roster</div>
      <div className="space-y-px bg-line border border-line">
        {staff.map((s) => (
          <div key={s.name} className="bg-bg-elev p-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
            <div>
              <div className="text-[12px] text-ink">{s.name}</div>
              <div className="text-[9px] text-ink-mute uppercase tracking-[0.15em]">{s.role}</div>
            </div>
            <div className="text-[10px] text-ink-mute font-mono">{s.hours}</div>
            <div className={`text-[9px] uppercase tracking-[0.18em] ${
              s.flag === "wellness" ? "text-[#d49185]" :
              s.flag === "long" ? "text-gold" :
              s.state === "on break" ? "text-[#74b9e8]" :
              "text-[#9bbd9b]"
            }`}>
              {s.flag === "wellness" ? "● needs break" : s.flag === "long" ? "● long task" : s.state}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line mt-5 pt-3 text-[10px] text-ink-mute italic font-display text-center">
        Insights surface gently. Nothing punitive.
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
          <h3 className="font-display text-2xl font-light mb-6 tracking-tighter">You manage by gut feeling.</h3>
          <ul className="space-y-4 text-ink-soft text-sm">
            {[
              "You don't notice when a service takes twice as long until customers complain.",
              "Break patterns are invisible — until someone burns out.",
              "Performance reviews are based on memory, not data.",
              "The best staff carry the weakest, and you can't tell why.",
            ].map((p) => (
              <li key={p} className="flex gap-3">
                <span className="w-1 h-1 rounded-full bg-[#b56b5f] mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="ovline mb-3 text-[#9bbd9b]">With Manager Mode</div>
          <h3 className="font-display text-2xl font-light mb-6 tracking-tighter">You manage with clarity.</h3>
          <ul className="space-y-4 text-ink-soft text-sm">
            {[
              "Long-task alerts surface in real time — before the queue notices.",
              "Break patterns learned per person, drift flagged automatically.",
              "Weekly performance digest pulls straight from queue data.",
              "Wellness signals tell you when someone needs a moment.",
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

function PillarGrid() {
  return (
    <section id="pillars" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-[#9bbd9b]">Four signals</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          What Manager Mode <em className="not-italic gold-text-soft">watches.</em>
        </h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
        {PILLARS.map((p) => (
          <div key={p.n} className="bg-bg-elev p-7">
            <div className="font-display text-[#9bbd9b] text-3xl font-light mb-3">{p.n}</div>
            <div className="font-display text-lg mb-3">{p.title}</div>
            <p className="text-ink-soft text-xs leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertFeedSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-gold-soft">Real-time feed</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Alerts before the <em className="not-italic gold-text-soft">queue notices.</em>
        </h2>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
        <LuxeFrame className="p-9">
          <div className="ovline text-gold-soft mb-3">Live alert feed</div>
          <h3 className="font-display text-2xl font-light tracking-tighter mb-6">A typical afternoon.</h3>
          <div className="space-y-px bg-line border border-line">
            {ALERTS.map((a) => (
              <div key={a.who + a.body} className="bg-bg-elev p-4 grid grid-cols-[80px_1fr] gap-3 items-baseline">
                <div className={`ovline text-[8px] ${a.level === "warn" ? "text-gold-soft" : "text-[#9bbd9b]"}`}>
                  {a.tag}
                </div>
                <div>
                  <div className="text-[12px] text-ink">{a.who}</div>
                  <div className="text-[10px] text-ink-mute mt-0.5">{a.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rule-ornament my-6 text-[8px]"><span>✦</span></div>
          <div className="text-[10px] text-ink-mute tracking-wide text-center">
            Alerts learn each staff member's baseline — anomalies surface, not absolutes.
          </div>
        </LuxeFrame>

        <div className="bg-bg-elev border border-line p-9">
          <div className="ovline text-gold-soft mb-3">Why it matters</div>
          <h3 className="font-display text-2xl font-light tracking-tighter mb-6">
            Not a stopwatch. <em className="not-italic gold-text-soft">A signal.</em>
          </h3>
          <ul className="space-y-5 text-sm border-t border-line pt-6">
            {[
              ["Personal baselines", "Each staff member has their own rhythm. Manager Mode learns it before alerting."],
              ["Soft thresholds", "Alerts are suggestions, never automatic actions. You decide what to do."],
              ["No tracking exposure", "Insights stay in the dashboard. Staff aren't shown their own scores by default."],
              ["Branch-aware", "Compares like with like — the salon with the salon, not the spa."],
            ].map(([t, d]) => (
              <li key={t} className="grid grid-cols-[16px_1fr] gap-3">
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

function Patterns() {
  // Simple visualization of break-pattern heatmap (mock SVG)
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const staff = ["Yusuf", "Sara", "Mohammad", "Hana"];
  const data = [
    [0, 0.2, 0.7, 0.1, 0.9, 0.0, 0.4, 0.0, 0.6, 0.0], // Yusuf
    [0, 0.1, 0.3, 0.8, 0.0, 0.7, 0.0, 0.5, 0.0, 0.0], // Sara
    [0, 0.0, 0.5, 0.2, 0.6, 0.0, 0.0, 0.7, 0.1, 0.0], // Mohammad
    [0, 0.0, 0.0, 0.6, 0.4, 0.8, 0.2, 0.0, 0.5, 0.0], // Hana
  ];

  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-gold-soft">Break-pattern map</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Each rhythm. <em className="not-italic gold-text-soft">Learned.</em>
        </h2>
      </div>
      <LuxeFrame className="p-10">
        <div className="grid grid-cols-[80px_1fr] gap-4 items-center">
          <div className="ovline text-[9px] text-right pr-2">Staff</div>
          <div className="grid grid-cols-10 gap-1">
            {hours.map((h) => (
              <div key={h} className="text-[9px] text-ink-mute font-mono text-center">{h}:00</div>
            ))}
          </div>

          {staff.map((name, sIdx) => (
            <div key={name} className="contents">
              <div className="text-[11px] text-ink text-right pr-2">{name}</div>
              <div className="grid grid-cols-10 gap-1">
                {data[sIdx].map((v, hIdx) => (
                  <div
                    key={hIdx}
                    className="h-8 border border-line"
                    style={{
                      background: v > 0
                        ? `rgba(201, 168, 106, ${v * 0.6})`
                        : "transparent",
                      boxShadow: v > 0 ? `inset 0 0 12px rgba(201, 168, 106, ${v * 0.3})` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rule-ornament my-6 text-[8px]"><span>·</span></div>
        <div className="flex items-center justify-center gap-3 text-[10px] text-ink-mute">
          <span>Break frequency</span>
          <div className="flex gap-px border border-line">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div key={v} className="w-6 h-3" style={{ background: `rgba(201, 168, 106, ${v * 0.6})` }} />
            ))}
          </div>
          <span className="font-mono">low → high</span>
        </div>
      </LuxeFrame>
    </section>
  );
}

function Pricing() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-20 border-t border-line">
      <div className="bg-bg-elev border border-[#506b50] p-10 text-center">
        <div className="ovline mb-3 text-[#9bbd9b]">Manager tier · RM149/mo</div>
        <h2 className="font-display text-3xl font-light tracking-tighter mb-4">
          People intelligence is its own tier.
        </h2>
        <p className="text-ink-soft text-sm mb-6 max-w-md mx-auto">
          Includes everything in Executive plus the Manager dashboard, anomaly alerts, break-pattern intelligence and weekly performance digests.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/signup?tier=manager"><Button>Start Manager trial →</Button></Link>
          <Link to="/#pricing"><Button variant="ghost">Compare tiers</Button></Link>
        </div>
        <div className="text-[10px] text-ink-mute mt-5 tracking-wide">
          Available in Business mode only · not for Personal Flow
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24 border-t border-line text-center">
      <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
        Manage with clarity.<br />
        <em className="not-italic gold-text-soft">Lead with care.</em>
      </h2>
      <p className="text-ink-soft text-sm mb-8">14-day trial · no card · live in under an hour.</p>
      <Link to="/signup?tier=manager"><Button size="lg">Start Manager trial →</Button></Link>
    </section>
  );
}
