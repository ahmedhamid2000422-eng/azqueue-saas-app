import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

const PILLARS = [
  { title: "Mission", description: "Make queues feel fair, transparent, and efficient for every customer." },
  { title: "Vision", description: "Bring queue intelligence to service teams across Southeast Asia and beyond." },
  { title: "Values", description: "Trust, speed, respect, and a premium experience for both staff and customers." },
];

const ROLES = [
  ["Product operations lead", "Remote · Full-time"],
  ["Customer success specialist", "KL · Full-time"],
  ["Mobile-first UI engineer", "Remote · Full-time"],
];

export default function Company() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="text-center mb-16">
          <div className="ovline text-gold-soft mb-3">Company</div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-5">
            Built for the<br />
            <em className="not-italic text-gold-soft">live world.</em>
          </h1>
          <p className="text-ink-soft text-sm max-w-xl mx-auto">
            AzQueue is a service operations platform for retail, healthcare, beauty and halal-first brands that need clear, calm customer flow.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-line border border-line mb-20">
          {PILLARS.map((item) => (
            <div key={item.title} className="bg-bg-elev p-7">
              <div className="ovline text-gold-soft mb-3">{item.title}</div>
              <h2 className="font-display text-xl mb-3 font-light tracking-tighter">{item.title}</h2>
              <p className="text-ink-soft text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        <section className="grid lg:grid-cols-[1fr_1fr] gap-px bg-line border border-line mb-20">
          <div className="bg-bg-elev p-10">
            <div className="ovline text-gold-soft mb-3">About</div>
            <h2 className="font-display text-3xl font-light tracking-tighter mb-5">
              We started with one question: <em className="not-italic text-gold-soft">why two systems?</em>
            </h2>
            <p className="text-ink-soft text-sm leading-relaxed mb-4">
              Every service business runs two queues — paper for walk-ins, calendar for bookings — and pays the cost in confused staff and customers waiting twice.
            </p>
            <p className="text-ink-soft text-sm leading-relaxed mb-6">
              AzQueue blends real-world service flow with digital readiness. We empower managers to keep customers moving without sacrificing calm.
            </p>
            <Link to="/resources"><Button variant="ghost">See our resources</Button></Link>
          </div>
          <div className="bg-bg-elev p-10">
            <div className="ovline text-gold-soft mb-3">Careers</div>
            <h2 className="font-display text-3xl font-light tracking-tighter mb-5">
              Join the team.
            </h2>
            <p className="text-ink-soft text-sm leading-relaxed mb-6">
              Hiring engineers, product operators, and customer success partners to scale queues that work for businesses and people.
            </p>
            <div className="ovline text-gold-soft mb-3">Open roles</div>
            <ul className="divide-y divide-line border-t border-b border-line">
              {ROLES.map(([role, location]) => (
                <li key={role} className="py-3 flex items-baseline justify-between">
                  <span className="text-sm">{role}</span>
                  <span className="text-[10px] text-ink-mute uppercase tracking-[0.2em]">{location}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-line pt-20 text-center">
          <div className="ovline text-gold-soft mb-3">Partner with us</div>
          <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
            Ready to work<br />
            <em className="not-italic text-gold-soft">together?</em>
          </h2>
          <p className="text-ink-soft text-sm max-w-xl mx-auto mb-8">
            Partners, customers, and collaborators are welcome.
          </p>
          <Link to="/support"><Button size="lg">Contact us</Button></Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
