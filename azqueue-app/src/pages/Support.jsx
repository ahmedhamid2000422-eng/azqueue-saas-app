import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

const FAQ = [
  {
    q: "How do I add a new branch?",
    a: "Open Settings · Branches in the business dashboard, choose Add branch, and assign staff. Each branch gets its own queue, hours and prayer schedule. Setup takes under two minutes per location.",
  },
  {
    q: "What happens to my queue during prayer time?",
    a: "Islamic Mode auto-pauses the queue ten minutes before each prayer. Customers in line receive an automatic WhatsApp note with the resume time. The queue restarts from the same position — no data lost, no manual reset.",
  },
  {
    q: "How are customers notified?",
    a: "By WhatsApp, by default. Customers receive three messages: ticket confirmation, a five-minutes-out heads-up, and a you're-next call. SMS and email are available as fallbacks. No app install required.",
  },
  {
    q: "Can walk-ins and bookings really share one queue?",
    a: "Yes — that's the core of AzQueue. Bookings hold a soft priority window around their slot. Walk-ins fill the gaps. Both streams are ordered fairly by the same engine, so neither group ever feels skipped.",
  },
  {
    q: "Does Autopilot replace my staff?",
    a: "No. Autopilot just calls the next customer at the right pace. Your staff still serve, greet and decide. Autopilot watches real service time and slows down when you fall behind, speeds up when the queue grows.",
  },
  {
    q: "Can I export my queue and revenue data?",
    a: "Yes. Insights exports to CSV and PDF on any plan. Professional and Executive include API access for custom dashboards and accounting integrations.",
  },
  {
    q: "What's included in the 14-day trial?",
    a: "Every Professional-tier feature, no card required. You'll be live in under an hour. If you don't choose a plan by day 14 the workspace pauses — your data stays for thirty days.",
  },
  {
    q: "Do you support multiple languages?",
    a: "The customer-facing flow ships in English, Bahasa Malaysia and Arabic. Staff dashboard adds French and Urdu. Custom translations available on Executive.",
  },
];

const CHANNELS = [
  { label: "FAQ", description: "Answers to setup, queue, billing and Islamic Mode questions." },
  { label: "Contact", description: "Email, WhatsApp or live chat — Monday to Saturday." },
  { label: "Community", description: "Partner network for owners, managers and operators." },
];

export default function Support() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="space-y-5 text-center mb-16">
          <div className="ovline text-gold-soft">Support</div>
          <h1 className="font-display text-5xl font-light tracking-tightest leading-tight">
            Help, when you need it.
          </h1>
          <p className="text-ink-soft max-w-xl mx-auto text-sm">
            Browse the answers, reach the team, or join the network.
          </p>
        </div>

        {/* Channel index — sharp three-column directory */}
        <div className="grid md:grid-cols-3 gap-px bg-line border border-line mb-20">
          {CHANNELS.map((item) => (
            <div key={item.label} className="bg-bg-elev p-7">
              <div className="ovline text-gold-soft mb-3">{item.label}</div>
              <p className="text-ink-soft text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        {/* FAQ accordion + contact column */}
        <div className="grid gap-px bg-line border border-line lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-bg-elev p-10">
            <div className="flex items-baseline justify-between mb-8">
              <div>
                <div className="ovline text-gold-soft mb-2">Frequently asked</div>
                <h2 className="font-display text-3xl font-light tracking-tighter">Questions, answered.</h2>
              </div>
              <span className="ovline text-[9px] text-ink-mute">{FAQ.length} entries</span>
            </div>

            <div className="border-t border-line">
              {FAQ.map((item, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div key={item.q} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                      className="w-full text-left flex items-baseline justify-between gap-6 py-5 group"
                    >
                      <span className="grid grid-cols-[28px_1fr] gap-3 items-baseline">
                        <span className="font-display text-gold-soft text-[11px] tracking-[0.18em]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className={`text-sm transition ${isOpen ? "text-ink" : "text-ink-soft group-hover:text-ink"}`}>
                          {item.q}
                        </span>
                      </span>
                      <span className={`font-display text-lg leading-none transition ${isOpen ? "text-gold rotate-45" : "text-ink-mute"}`}>
                        +
                      </span>
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-[28px_1fr] gap-3 pb-6 pr-8">
                        <span />
                        <p className="text-ink-soft text-sm leading-relaxed">{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-bg-elev p-10 flex flex-col">
            <div className="ovline text-gold-soft mb-2">Direct line</div>
            <h2 className="font-display text-3xl font-light tracking-tighter mb-8">Talk to us.</h2>

            <div className="space-y-px bg-line border border-line">
              {[
                ["Email", "support@azqueue.io"],
                ["WhatsApp", "+60 12-345 6789"],
                ["Live chat", "9am – 6pm MYT"],
              ].map(([label, value]) => (
                <div key={label} className="bg-bg-elev p-5 grid grid-cols-[80px_1fr] gap-4 items-center">
                  <span className="ovline text-[9px]">{label}</span>
                  <span className="text-sm text-ink">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-10">
              <Link to="/select" className="block">
                <Button className="w-full">Open support ticket →</Button>
              </Link>
              <div className="text-[10px] text-ink-mute mt-3 tracking-wide text-center">
                Average first response · under 2 hours
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
