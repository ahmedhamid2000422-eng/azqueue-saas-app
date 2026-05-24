import { useState } from "react";
import { CountUp } from "./LiveTicker";

const INDUSTRIES = [
  {
    id: "service",
    title: "Service",
    subtitle: "Barbershop · Salon · Spa",
    token: "A102",
    primaryLabel: "Customer",
    primaryValue: "Ali Khan",
    secondaryLabel: "Service",
    secondaryValue: "Haircut",
    upNext: [
      { token: "A103", name: "Sara Ahmed", detail: "Beard Trim" },
      { token: "A104", name: "Mohammad U.", detail: "Haircut" },
      { token: "A105", name: "Zainab F.", detail: "Salon" },
    ],
    kpis: [
      { label: "Waiting", value: "5" },
      { label: "Avg wait", value: "8m" },
      { label: "Served", value: "12" },
    ],
  },
  {
    id: "hospitality",
    title: "Hospitality",
    subtitle: "Restaurant · Café",
    token: "T04",
    primaryLabel: "Party",
    primaryValue: "Khalid (4)",
    secondaryLabel: "Status",
    secondaryValue: "Table for 4",
    upNext: [
      { token: "T05", name: "Party of 2", detail: "Waiting" },
      { token: "T06", name: "Party of 6", detail: "Waiting" },
      { token: "T07", name: "Party of 3", detail: "Prep" },
    ],
    kpis: [
      { label: "Tables", value: "3" },
      { label: "Covers", value: "184" },
      { label: "Seat-time", value: "47m" },
    ],
  },
  {
    id: "professional",
    title: "Professional",
    subtitle: "Clinic · Law · Finance",
    token: "P012",
    primaryLabel: "Client",
    primaryValue: "Ali Khan",
    secondaryLabel: "Service",
    secondaryValue: "Consultation",
    upNext: [
      { token: "P013", name: "Sara A.", detail: "Follow-up" },
      { token: "P014", name: "Yahya M.", detail: "New" },
      { token: "P015", name: "Hana B.", detail: "Review" },
    ],
    kpis: [
      { label: "Waiting", value: "4" },
      { label: "Avg consult", value: "18m" },
      { label: "Seen", value: "12" },
    ],
  },
  {
    id: "fitness",
    title: "Fitness",
    subtitle: "Gym · Yoga · PT",
    token: "07",
    primaryLabel: "Member",
    primaryValue: "Ali Khan",
    secondaryLabel: "Session",
    secondaryValue: "PT — 60min",
    upNext: [
      { token: "08", name: "Sara", detail: "Yoga" },
      { token: "09", name: "Mohammad", detail: "PT" },
      { token: "10", name: "Amina", detail: "Spin" },
    ],
    kpis: [
      { label: "Sessions", value: "12" },
      { label: "Drop-ins", value: "3" },
      { label: "Avg duration", value: "52m" },
    ],
  },
  {
    id: "homecare",
    title: "Home Care",
    subtitle: "Care Agency · Senior Care · Home Health",
    token: "HC042",
    primaryLabel: "Client Ref",
    primaryValue: "CLIENT-0042",
    secondaryLabel: "Visit type",
    secondaryValue: "Personal Care",
    upNext: [
      { token: "HC043", name: "Fatima R.", detail: "En route" },
      { token: "HC044", name: "Yusuf A.", detail: "Pending" },
      { token: "HC045", name: "Amina K.", detail: "Docs due" },
    ],
    kpis: [
      { label: "Visits today", value: "9" },
      { label: "On-time", value: "89%" },
      { label: "Open flags", value: "2" },
    ],
  },
];

export default function IndustriesSection() {
  const [activeId, setActiveId] = useState("service");
  const active = INDUSTRIES.find((item) => item.id === activeId) ?? INDUSTRIES[0];

  return (
    <section id="industries" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-14">
        <div className="ovline mb-3 text-gold-soft">Industries</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          One queue. <em className="not-italic text-gold-soft">Every business.</em>
        </h2>
      </div>

      {/* Tab row — flat hairline tabs, no pills */}
      <div className="flex justify-center border-b border-line mb-10">
        {INDUSTRIES.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`relative px-6 py-3 text-[10px] tracking-[0.22em] uppercase transition ${
                isActive ? "text-gold" : "text-ink-mute hover:text-ink"
              }`}
            >
              {item.title}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-gold" />
              )}
            </button>
          );
        })}
      </div>

      {/* Single active panel — luxury frame with corner marks & inner glow */}
      <div className="relative corner-marks luxe-panel border border-line">
        <span className="cm cm-tl" />
        <span className="cm cm-tr" />
        <span className="cm cm-bl" />
        <span className="cm cm-br" />
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-px bg-line">
          {/* Left: live serving */}
          <div className="luxe-panel p-9">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="ovline text-[9px]">{active.subtitle}</div>
                <div className="font-display text-2xl font-light tracking-tighter mt-2">{active.title}</div>
              </div>
              <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
                <span className="pip breathe mr-1.5" /> Live
              </span>
            </div>

            <div className="border-t border-line pt-6">
              <div className="ovline text-[9px] mb-2">Now Serving</div>
              <div key={active.id} className="drift-up gold-text font-display text-8xl font-light tracking-tightest leading-none">
                {active.token}
              </div>
              <div className="text-[10px] text-ink-mute mt-4 tracking-wide">
                {active.primaryValue} · {active.secondaryValue}
              </div>
            </div>

            <div className="rule-ornament my-6 text-[8px]"><span>✦</span></div>

            <div className="grid grid-cols-3 gap-px bg-line border border-line">
              {active.kpis.map((stat) => (
                <div key={stat.label} className="bg-bg-elev p-3">
                  <div className="ovline text-[8px]">{stat.label}</div>
                  <div className="font-display text-lg mt-1 gold-text-soft">
                    {/^\d+$/.test(stat.value) ? <CountUp to={parseInt(stat.value, 10)} /> : stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: up next list */}
          <div className="luxe-panel p-9">
            <div className="flex items-center justify-between mb-5">
              <div className="ovline text-[9px]">Up next</div>
              <div className="text-[9px] text-ink-mute tracking-[0.2em] uppercase">{active.upNext.length} ahead</div>
            </div>
            <div className="divide-y divide-line border-t border-b border-line">
              {active.upNext.map((row) => (
                <div key={row.token} className="grid grid-cols-[60px_1fr_auto] gap-3 py-3 items-center">
                  <span className="font-display text-gold-soft text-xs">{row.token}</span>
                  <span className="text-[12px]">{row.name}</span>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-ink-mute">{row.detail}</span>
                </div>
              ))}
            </div>
            <div className="rule-ornament my-6 text-[8px]"><span>·</span></div>
            <div className="ovline text-[9px] text-ink-mute text-center">
              Calibrated for {active.title.toLowerCase()} flow
            </div>
          </div>
        </div>
      </div>

      {/* Industry directory — minimal four-column index */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line border-t-0">
        {INDUSTRIES.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`bg-bg-elev p-5 text-left transition ${
                isActive ? "text-ink" : "text-ink-mute hover:text-ink"
              }`}
            >
              <div className={`ovline text-[8px] mb-1 ${isActive ? "text-gold-soft" : ""}`}>
                {item.title}
              </div>
              <div className="text-[11px] tracking-wide">{item.subtitle}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
