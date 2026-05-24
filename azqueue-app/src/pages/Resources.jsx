import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

const CHANNELS = [
  { title: "Documentation", description: "Setup templates, staff onboarding, and operational checklists." },
  { title: "API Reference", description: "Queue webhooks, branch data, and reporting payloads." },
  { title: "Release notes", description: "Latest features, updates, and service improvements." },
];

const REFERENCES = [
  "API docs for queue webhooks and counters.",
  "WhatsApp messaging examples and templates.",
  "Branch onboarding checklist for managers.",
  "Admin role definitions and security controls.",
];

export default function Resources() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="text-center mb-16">
          <div className="ovline text-gold-soft mb-3">Resources</div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-5">
            Learn faster.<br />
            <em className="not-italic text-gold-soft">Ship sooner.</em>
          </h1>
          <p className="text-ink-soft text-sm max-w-xl mx-auto">
            Built for busy operators: quick setup, easy integration, a clear path from launch to reliable service.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-line border border-line mb-20">
          {CHANNELS.map((card) => (
            <article key={card.title} className="bg-bg-elev p-7">
              <div className="ovline text-gold-soft mb-3">{card.title}</div>
              <h2 className="font-display text-xl mb-3 font-light tracking-tighter">{card.title}</h2>
              <p className="text-ink-soft text-sm leading-relaxed">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-px bg-line border border-line mb-20">
          <div className="bg-bg-elev p-10">
            <div className="ovline text-gold-soft mb-3">Quick start</div>
            <h2 className="font-display text-3xl font-light tracking-tighter mb-4">Deploy AzQueue in one hour.</h2>
            <p className="text-ink-soft text-sm leading-relaxed mb-6">
              Set up the staff panel, queue screen, and WhatsApp notifications. The same guide works for walk-in, booking, and prayer-aware service.
            </p>
            <Link to="/signup"><Button>Start setup guide</Button></Link>
          </div>
          <div className="bg-bg-elev p-10">
            <div className="ovline text-gold-soft mb-3">Trusted reference</div>
            <h2 className="font-display text-3xl font-light tracking-tighter mb-6">Everything you need.</h2>
            <ul className="divide-y divide-line border-t border-b border-line">
              {REFERENCES.map((item) => (
                <li key={item} className="py-3 grid grid-cols-[16px_1fr] gap-3 items-start text-sm text-ink-soft">
                  <span className="pip mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section className="border-t border-line pt-20 text-center">
          <div className="ovline text-gold-soft mb-3">Custom integration</div>
          <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
            Connect AzQueue<br />
            <em className="not-italic text-gold-soft">to your stack.</em>
          </h2>
          <p className="text-ink-soft text-sm max-w-xl mx-auto mb-8">
            From booking systems to internal dashboards, our team can help make AzQueue part of your existing tech stack.
          </p>
          <Link to="/support"><Button>Request integration support</Button></Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
