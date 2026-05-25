import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import LuxeFrame from "../components/LuxeFrame";
import LiveTicker, { CountUp } from "../components/LiveTicker";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Hero />
      <TrustBar />
      <FeatureCards />
      <HowItWorks />
      <WhoItsFor />
      <LeaveAndReturn />
      <PainSolution />
      <MultilingualShowcase />
      <SocialProof />
      <Pricing />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="atmosphere-hero max-w-6xl mx-auto px-6 pt-20 pb-24">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
        <div>
          <div className="ovline mb-5 inline-flex items-center gap-2 border border-line px-3 py-1">
            <span className="pip breathe" />
            Built for walk-in businesses
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-6">
            The operating system<br />
            for <em className="not-italic gold-text-soft">walk-in businesses.</em>
          </h1>
          <p className="text-ink-soft text-lg max-w-md mb-6 leading-relaxed">
            Walk-ins and bookings in one queue. Customers check in, leave, and come back when called.
          </p>
          <p className="text-sm text-gold-soft mb-10 font-medium">
            Built for multilingual, high-traffic service businesses.
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            <Link to="/select"><Button>Start free trial — no card →</Button></Link>
            <a href="#how-it-works"><Button variant="ghost">See how it works</Button></a>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-ink-mute">
            <span>✓ Ready in 10 minutes</span>
            <span>✓ No hardware needed</span>
            <span>✓ Works on any device</span>
          </div>
        </div>
        <KioskMockup />
      </div>
    </section>
  );
}

function KioskMockup() {
  return (
    <div className="relative flex justify-center items-center py-8">
      <div className="relative w-72 bg-[#1a1a1f] border-4 border-[#2e2e35] rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#111113] px-4 py-2 flex items-center justify-between border-b border-[#26262a]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3a3a40]" />
          <div className="w-16 h-1 rounded-full bg-[#2a2a30]" />
          <div className="text-[9px] text-ink-mute font-mono">AzQueue</div>
        </div>
        <div className="bg-[#0b0b0c] px-6 py-8">
          <div className="text-center mb-6">
            <div className="font-display text-gold-soft text-xl mb-1">Welcome</div>
            <div className="text-xs text-ink-mute">Select your language to begin</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {[["🇬🇧","English"],["🇲🇾","Bahasa"],["🇸🇦","العربية"],["🇨🇳","中文"]].map(([flag,lang]) => (
              <div key={lang} className="border border-line bg-surface px-3 py-2.5 text-center">
                <div className="text-lg mb-0.5">{flag}</div>
                <div className="text-[10px] text-ink-soft">{lang}</div>
              </div>
            ))}
          </div>
          <div className="border border-gold-deep bg-gold-deep/10 px-4 py-3 text-center">
            <div className="text-[11px] text-gold-soft">Tap to check in →</div>
          </div>
        </div>
        <div className="bg-[#111113] px-4 py-3 flex justify-center border-t border-[#26262a]">
          <div className="w-24 h-1 rounded-full bg-[#2a2a30]" />
        </div>
      </div>
      <div className="absolute -right-2 top-10 bg-[#11241b] border border-[#1f3a2a] rounded-2xl rounded-tr-sm px-3 py-2.5 max-w-[150px] shadow-lg">
        <div className="text-[9px] text-[#9bbd9b] ovline mb-1">AzQueue SMS</div>
        <div className="text-[10px] text-ink leading-relaxed">You're #3. Est. wait: 12 min. We'll text you 👋</div>
      </div>
      <div className="absolute -left-2 bottom-14 bg-bg-elev border border-gold-deep px-3 py-2 shadow-lg">
        <div className="ovline text-[8px] text-gold-soft mb-1">Your ticket</div>
        <div className="font-display text-2xl gold-text-soft">A · 07</div>
        <div className="text-[9px] text-ink-mute">Counter 2 · 12 min</div>
      </div>
    </div>
  );
}

function TrustBar() {
  return (
    <section className="border-t border-b border-line bg-bg-elev">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap justify-center gap-x-10 gap-y-3">
        {[
          ["⚡", "Ready in 10 minutes"],
          ["📱", "No hardware needed"],
          ["☁️", "Cloud-based dashboard"],
          ["🔒", "Secure & reliable"],
        ].map(([icon, label]) => (
          <div key={label} className="flex items-center gap-2 text-sm text-ink-soft">
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureCards() {
  const features = [
    { icon: "🎟️", title: "Smart Queue", line: "Walk-ins and bookings merge into one fair, ordered queue." },
    { icon: "📱", title: "SMS & WhatsApp", line: "Customers get notified when they join, when they're next, and when served." },
    { icon: "🧠", title: "AI Customer Profiles", line: "Staff see visit history, preferences, and satisfaction score before serving." },
    { icon: "🌍", title: "Multilingual Kiosk", line: "Check-in screen and notifications in the customer's own language." },
    { icon: "📋", title: "Document Checklists", line: "Auto-sent to customers on booking so they arrive prepared." },
    { icon: "📊", title: "Live Dashboard", line: "Real-time queue, staff assignments, and satisfaction scores in one view." },
  ];
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
      <div className="text-center mb-10">
        <div className="ovline mb-3 text-gold-soft">What it does</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Everything your lobby needs.<br />
          <em className="not-italic gold-text-soft">Nothing it doesn't.</em>
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map(({ icon, title, line }) => (
          <div key={title} className="bg-bg-elev border border-line p-6 hover:border-gold-deep transition-colors">
            <div className="text-2xl mb-3">{icon}</div>
            <div className="text-base font-medium text-ink mb-1">{title}</div>
            <div className="text-sm text-ink-soft">{line}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Customer checks in", line: "Scan QR or walk up to kiosk. Pick a service, enter phone. Done in seconds." },
    { n: "02", title: "They get a text", line: "Instant SMS with queue position and estimated wait time." },
    { n: "03", title: "They leave and relax", line: "No standing around. They get another alert when they're next." },
    { n: "04", title: "Staff calls them in", line: "One tap. Staff already see the customer profile before they arrive." },
  ];
  return (
    <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
      <div className="text-center mb-10">
        <div className="ovline mb-3 text-gold-soft">How it works</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Simple for customers.<br />
          <em className="not-italic gold-text-soft">Powerful for your team.</em>
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map(({ n, title, line }) => (
          <div key={n} className="bg-bg-elev border border-line p-6">
            <div className="font-display gold-text text-3xl font-light leading-none mb-4">{n}</div>
            <div className="text-base font-medium text-ink mb-2">{title}</div>
            <div className="text-sm text-ink-soft">{line}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhoItsFor() {
  const industries = [
    "Immigration Offices", "Tax & Accounting", "Clinics", "Legal Firms",
    "Government Services", "Salons & Beauty", "Repair Shops", "Financial Services",
  ];
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
      <div className="text-center mb-8">
        <div className="ovline mb-3 text-gold-soft">Who it's for</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Built for businesses that deal with<br />
          <em className="not-italic gold-text-soft">real people at the door.</em>
        </h2>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {industries.map(name => (
          <span key={name} className="border border-line bg-bg-elev px-4 py-2 text-sm text-ink-soft hover:border-gold-deep hover:text-ink transition-colors">
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

function LeaveAndReturn() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="ovline mb-3 text-gold-soft">The big idea</div>
          <h2 className="font-display text-4xl font-light tracking-tighter mb-5">
            Waiting shouldn't mean<br />
            <em className="not-italic gold-text-soft">being trapped.</em>
          </h2>
          <p className="text-ink-soft text-base mb-8 leading-relaxed">
            Customers check in, then go live their life — grab coffee, sit in their car, run an errand. We text them when it's their turn. No more standing in a lobby staring at a screen.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[["Before","Standing in a crowded lobby, afraid to leave.","#d49185"],["After","Check in, leave, get a text, come back calm.","#9bbd9b"]].map(([label, text, color]) => (
              <div key={label} className="border border-line p-4">
                <div className="text-xs font-medium mb-1" style={{ color }}>{label}</div>
                <p className="text-sm text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[
            ["10:02am", "📍", "Fatimah checks in. Ticket #B07. Est. wait: 22 min."],
            ["10:04am", "📱", "SMS: You're #7. Est. 22 min. We'll text you when ready 👋"],
            ["10:06am", "☕", "Fatimah walks to the café next door. No stress."],
            ["10:24am", "🔔", "SMS: You're next! Head back now. Counter 2."],
            ["10:26am", "✅", "Fatimah arrives calm. Staff already know her profile."],
          ].map(([time, icon, msg]) => (
            <div key={time} className="border border-line p-3 flex gap-3">
              <span className="text-lg shrink-0">{icon}</span>
              <div>
                <div className="text-[10px] text-ink-mute ovline mb-0.5">{time}</div>
                <div className="text-sm text-ink-soft">{msg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PainSolution() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
      <div className="grid md:grid-cols-2 gap-px bg-line border border-line">
        <div className="bg-bg-elev p-8">
          <div className="ovline mb-4 text-[#d49185]">The old way</div>
          <ul className="space-y-3">
            {[
              "Paper for walk-ins. Calendar for bookings. They never talk.",
              "Staff have no idea who the customer is until they speak.",
              "No reminders — customers arrive unprepared or not at all.",
            ].map(p => (
              <li key={p} className="flex gap-3 text-sm text-ink-soft">
                <span className="text-[#b56b5f] shrink-0 mt-0.5">✗</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="luxe-panel p-8">
          <div className="ovline mb-4 text-gold-soft">The AzQueue way</div>
          <ul className="space-y-3">
            {[
              "One queue — walk-ins and bookings, ordered automatically.",
              "AI profile ready the moment the customer joins the queue.",
              "Document checklist WhatsApped before they leave the house.",
            ].map(p => (
              <li key={p} className="flex gap-3 text-sm text-ink-soft">
                <span className="text-[#9bbd9b] shrink-0 mt-0.5">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function MultilingualShowcase() {
  const langs = [
    { flag: "🇬🇧", name: "English", hello: "Welcome" },
    { flag: "🇲🇾", name: "Bahasa Melayu", hello: "Selamat datang" },
    { flag: "🇸🇦", name: "العربية", hello: "أهلاً وسهلاً" },
    { flag: "🇨🇳", name: "中文", hello: "欢迎光临" },
    { flag: "🇮🇳", name: "தமிழ்", hello: "வரவேற்கிறோம்" },
    { flag: "🇵🇰", name: "اردو", hello: "خوش آمدید" },
  ];
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-12 items-center">
        <div>
          <div className="ovline mb-3 text-gold-soft">Multilingual kiosk</div>
          <h2 className="font-display text-4xl font-light tracking-tighter mb-4">
            Serve every customer<br />
            <em className="not-italic gold-text-soft">in their language.</em>
          </h2>
          <p className="text-ink-soft text-base leading-relaxed">
            The kiosk, SMS messages, and queue updates are all delivered in the customer's chosen language — automatically.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {langs.map(({ flag, name, hello }) => (
            <div key={name} className="border border-line bg-bg-elev p-3 hover:border-gold-deep transition-colors">
              <div className="text-2xl mb-1.5">{flag}</div>
              <div className="text-xs font-medium text-ink">{name}</div>
              <div className="text-[10px] text-ink-mute italic mt-0.5">{hello}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="border-t border-line bg-bg-elev">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="ovline mb-3 text-gold-soft">Trusted by service businesses</div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            { quote: "Our receptionist used to spend half the day on a paper list. Now the queue runs itself.", name: "Dr. Amir R.", role: "Family Clinic, KL" },
            { quote: "Since we launched SMS updates, the lobby is calm and we get 5-star reviews every week.", name: "Sarah L.", role: "Law Firm, Petaling Jaya" },
            { quote: "Setup was incredibly simple — we were live before lunch on day one.", name: "Hassan M.", role: "Auto Repair, Shah Alam" },
          ].map(({ quote, name, role }) => (
            <div key={name} className="border border-line bg-bg p-6">
              <p className="text-sm text-ink-soft italic mb-4">"{quote}"</p>
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="text-xs text-ink-mute">{role}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line">
          {[["500+","Customers served daily"],["12 min","Avg wait reduction"],["98%","SMS delivery rate"],["10 min","Avg setup time"]].map(([val, label]) => (
            <div key={label} className="bg-bg-elev p-6 text-center">
              <div className="font-display text-3xl gold-text-soft mb-1">{val}</div>
              <div className="text-xs text-ink-mute">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name:"Essential", price:29, tag:"For getting started", gold:false,
      feats:["Walk-ins + bookings","QR check-in","WhatsApp notifications","Up to 3 staff"] },
    { name:"Professional", price:59, tag:"Most chosen", gold:true,
      feats:["Everything in Essential","AI customer personas","Multilingual kiosk","Document checklists","Islamic Mode"] },
    { name:"Executive", price:99, tag:"For growing businesses", gold:false,
      feats:["Everything in Pro","Satisfaction scores","Smart queue + split lanes","Freshdesk integration"] },
    { name:"Manager", price:149, tag:"People intelligence", gold:false, sage:true,
      feats:["Everything in Executive","Manager dashboard","Performance reviews","Dedicated concierge"] },
  ];
  return (
    <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
      <div className="text-center mb-4">
        <div className="ovline mb-3 text-gold-soft">Pricing</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">Simple pricing. <em className="not-italic gold-text-soft">No surprises.</em></h2>
        <p className="text-ink-soft text-sm mt-3">14-day free trial · No card required · Cancel any time</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
        {tiers.map(t => (
          <div key={t.name} className={`relative bg-bg-elev border p-6 ${t.gold?"border-gold-deep":t.sage?"border-[#506b50]":"border-line"}`}>
            {t.gold && <div className="absolute -top-px left-4 bg-gold text-[#141410] px-2 py-0.5 text-[8px] tracking-[0.18em] uppercase font-bold">Most popular</div>}
            {t.sage && <div className="absolute -top-px left-4 bg-[#506b50] text-[#e4f0e4] px-2 py-0.5 text-[8px] tracking-[0.18em] uppercase font-bold">People intel</div>}
            <div className={`ovline text-[9px] mb-2 ${t.gold?"text-gold-soft":t.sage?"text-[#9bbd9b]":""}`}>{t.tag}</div>
            <div className="font-display text-lg">{t.name}</div>
            <div className="flex items-baseline gap-0.5 mt-3 mb-3">
              <span className="text-ink-mute text-[10px]">RM</span>
              <span className="font-display text-gold text-4xl font-light">{t.price}</span>
              <span className="text-ink-mute text-[10px]">/mo</span>
            </div>
            <div className="h-px bg-line mb-3" />
            <ul className="text-xs text-ink-soft space-y-1.5 mb-5">
              {t.feats.map(f => <li key={f}>✓ {f}</li>)}
            </ul>
            <Link to={`/signup?tier=${t.name.toLowerCase()}`} className="block">
              <Button variant={t.gold?"gold":"ghost"} className="w-full">Start free trial</Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-24 border-t border-line text-center">
      <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-4 leading-tight">
        A calmer lobby starts<br />
        <em className="not-italic text-gold-soft">in 10 minutes.</em>
      </h2>
      <p className="text-ink-mute text-sm mb-8">No hardware. No contracts. No complicated setup.</p>
      <Link to="/select"><Button size="lg">Start free trial — no card needed →</Button></Link>
      <div className="text-xs text-ink-mute mt-4">14-day trial · Cancel any time</div>
    </section>
  );
}
