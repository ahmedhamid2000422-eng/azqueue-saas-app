import { Link } from "react-router-dom";
import Button from "../components/Button";
import IndustriesSection from "../components/IndustriesSection";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import LuxeFrame from "../components/LuxeFrame";
import LiveTicker, { CountUp } from "../components/LiveTicker";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Hero />
      <OneEngine />
      <PersonaIntelligence />
      <SmartQueue />
      <SatisfactionScores />
      <Checklists />
      <PainSolution />
      <LiveExperience />
      <Autopilot />
      <IslamicMode />
      <IndustriesSection />
      <Pricing />
      <CTA />
      <SiteFooter />
    </div>
  );
}
function Hero() {
  return (
    <section className="atmosphere-hero max-w-6xl mx-auto px-6 pt-20 pb-24">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <div className="ovline mb-5 inline-flex items-center gap-2 border border-line px-3 py-1">
            <span className="pip breathe" />
            Queue intelligence · one system
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-6">
            Know every customer<br />
            before they <em className="not-italic gold-text-soft">sit down.</em>
          </h1>
          <p className="text-ink-soft text-lg max-w-md mb-3">
            Walk-ins. Bookings. AI personas. Satisfaction scores.
          </p>
          <p className="font-display text-xl text-gold-soft italic mb-10">
            One system. Finally intelligent.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/select"><Button>Start free trial →</Button></Link>
            <a href="#persona"><Button variant="ghost">See the persona engine</Button></a>
          </div>
          <div className="text-[10px] text-ink-mute mt-5 tracking-wide">
            14-day trial · No card · Live in under an hour
          </div>
        </div>
        <LivePreview />
      </div>
    </section>
  );
}

function LivePreview() {
  return (
    <LuxeFrame className="p-7">
      <div className="flex items-center justify-between mb-4">
        <span className="ovline text-[9px]">Now Serving</span>
        <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1.5" /> Live
        </span>
      </div>
      <LiveTicker values={["A102", "B42C1", "A103", "A104"]} intervalMs={4500} />
      <div className="text-[10px] text-ink-mute mt-3 tracking-wide">Counter 2 · Est. 3 min</div>
      <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
      <div className="border border-gold-deep/40 bg-gold-deep/5 p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="ovline text-[8px] text-gold-soft">AI Customer Persona</span>
          <span className="text-[8px] text-[#9bbd9b] ovline">↩ Returning · 7 visits</span>
        </div>
        <div className="text-[10px] text-ink-soft leading-relaxed">
          High-value regular. Always books haircut + beard. Prefers the same stylist. Sensitive to wait times — offer priority.
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-emerald-400">😄 4.8★</span>
          <span className="text-[8px] text-ink-mute">avg satisfaction</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-px bg-line border border-line">
        {[["Walk-ins",128],["Bookings",76],["Served",184],["Avg wait","12m"]].map(([l,v]) => (
          <div key={l} className="bg-bg-elev p-2.5">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-0.5 gold-text-soft">
              {typeof v === "number" ? <CountUp to={v} /> : v}
            </div>
          </div>
        ))}
      </div>
    </LuxeFrame>
  );
}

function OneEngine() {
  return (
    <section id="engine" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-gold-soft">The mechanism</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          One engine. <em className="text-gold-soft not-italic font-display italic">Two inputs.</em>
        </h2>
      </div>
      <div className="grid md:grid-cols-[1fr_60px_1fr] gap-0 max-w-3xl mx-auto">
        <div className="bg-surface border border-line p-6">
          <div className="ovline mb-3">Input A</div>
          <h3 className="font-display text-xl mb-2">Walk-in</h3>
          <p className="text-ink-soft text-sm leading-relaxed">Customer arrives. Gets a ticket. Enters the queue immediately.</p>
        </div>
        <div className="hidden md:flex flex-col items-center justify-center">
          <div className="w-px flex-1 bg-gradient-to-b from-transparent to-gold-deep" />
          <div className="ovline text-[8px] py-2 text-gold-soft">into</div>
          <div className="w-px flex-1 bg-gradient-to-t from-transparent to-gold-deep" />
        </div>
        <div className="bg-surface border border-line p-6">
          <div className="ovline mb-3">Input B</div>
          <h3 className="font-display text-xl mb-2">Booking</h3>
          <p className="text-ink-soft text-sm leading-relaxed">Customer books ahead. Gets a time slot. Arrives knowing when.</p>
        </div>
      </div>
      <div className="flex justify-center py-5">
        <div className="w-px h-6 bg-gradient-to-b from-gold-deep to-gold" />
      </div>
      <div className="bg-bg-elev border border-gold-deep p-6 max-w-md mx-auto text-center relative">
        <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-gold text-[#141410] px-3 py-0.5 text-[9px] tracking-[0.18em] uppercase font-bold">
          The result
        </div>
        <div className="font-display text-2xl text-gold-soft mt-2 mb-1">Combined Mode</div>
        <p className="text-ink-soft text-xs">Both streams merge into one fair, ordered queue. Automatic priority.</p>
      </div>
    </section>
  );
}

function PersonaIntelligence() {
  return (
    <section id="persona" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <LuxeFrame className="p-7 order-2 md:order-1">
          <div className="ovline text-[9px] text-gold-soft mb-4">AI Customer Persona · live</div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-display text-lg tracking-tight">Abdullah K.</div>
              <div className="text-[10px] text-ink-mute mt-0.5">+60 12 345 6789 · 7 visits</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] text-[#9bbd9b] border border-[#506b50] px-2 py-0.5 ovline">↩ Returning</span>
              <span className="text-[10px] text-emerald-400">😄 4.8★ avg</span>
            </div>
          </div>
          <div className="rule-ornament my-4 text-[7px]"><span>·</span></div>
          <div className="mb-4">
            <div className="ovline text-[8px] mb-2">AI profile</div>
            <p className="text-[11px] text-ink-soft leading-relaxed">
              High-value loyal customer. Always books haircut + beard combo. Strong preference for Staff: Ahmad. Very punctual. Sensitive to wait times — offer priority. Likely to upsell on premium treatments.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-line border border-line mb-4">
            {[["Visits","7"],["Avg wait","4m"],["LTV tier","High"]].map(([l,v]) => (
              <div key={l} className="bg-bg-elev p-2.5 text-center">
                <div className="ovline text-[7px] mb-0.5">{l}</div>
                <div className="font-display text-sm gold-text-soft">{v}</div>
              </div>
            ))}
          </div>
          <div className="border border-line p-3 mb-4">
            <div className="ovline text-[8px] mb-2">Support history · Freshdesk</div>
            <div className="space-y-1.5">
              {[["LOW","Pricing enquiry for monthly plan","resolved"],["MED","Waited too long — requested refund","closed"]].map(([p,s,st]) => (
                <div key={s} className="flex items-start gap-2 text-[10px]">
                  <span className={`ovline text-[7px] pt-0.5 shrink-0 ${p==="MED"?"text-orange-400":"text-ink-mute"}`}>[{p}]</span>
                  <span className="text-ink-soft flex-1 truncate">{s}</span>
                  <span className="text-ink-mute shrink-0">{st}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ovline text-[8px] mb-2">Satisfaction history</div>
          <div className="flex gap-2">
            {["🤩","😄","😄","😊","🤩"].map((e,i) => <span key={i} className="text-base">{e}</span>)}
            <span className="text-[10px] text-ink-mute self-center ml-1">last 5 visits</span>
          </div>
        </LuxeFrame>
        <div className="order-1 md:order-2">
          <div className="ovline mb-3 text-gold-soft">Feature · Customer Intelligence</div>
          <h2 className="font-display text-4xl font-light tracking-tighter mb-5">
            Every customer<br />
            walks in with a <em className="not-italic text-gold-soft">dossier.</em>
          </h2>
          <p className="text-ink-soft text-sm mb-6 leading-relaxed">
            The moment a customer joins your queue, AzQueue builds a living AI persona from their visit history, support tickets, and satisfaction scores — so your staff already know who they are before saying hello.
          </p>
          <ul className="space-y-4 text-sm">
            {[
              ["New vs. returning","Instantly see first-timers vs. loyal regulars — adjust your approach before they reach the counter."],
              ["AI-written profile","GPT-4 synthesises visit patterns, wait sensitivity, service preferences, and lifetime value into plain language your staff can read in 10 seconds."],
              ["Freshdesk enrichment","Open support tickets and past complaints are pulled in automatically — no tab-switching, no guessing."],
              ["Satisfaction history","Every post-visit rating appears on the profile so staff know if this customer has had a bad experience before."],
            ].map(([t,d]) => (
              <li key={t} className="flex gap-3">
                <span className="pip mt-2 shrink-0" style={{background:"#c9a86a"}} />
                <div>
                  <div className="text-ink font-medium">{t}</div>
                  <div className="text-ink-mute text-xs mt-0.5 leading-relaxed">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SmartQueue() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-gold-soft">Feature · Smart Queue</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          The queue thinks <em className="not-italic text-gold-soft">for itself.</em>
        </h2>
        <p className="text-ink-soft text-sm mt-3 max-w-lg mx-auto">
          AzQueue scores every ticket by complexity, splits fast and complex cases into separate lanes, and assigns the right staff automatically.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="border border-[#2a4a6a] bg-[#74b9e8]/5 p-6">
          <div className="text-2xl mb-3 text-[#74b9e8]">⚡</div>
          <div className="ovline text-[9px] mb-2 text-ink-soft">Complexity scoring</div>
          <p className="text-xs text-ink-soft leading-relaxed">Every service is tagged Simple, Standard, Complex, or Extended based on real service data. Fast cases are served first so your line keeps moving.</p>
          <div className="space-y-1.5 mt-3">
            {[["A102","Haircut","Simple","text-[#9bbd9b]","border-[#506b50]"],["A103","Tax Return","Complex","text-orange-400","border-orange-800"],["A104","Passport","Standard","text-[#74b9e8]","border-[#2a4a6a]"]].map(([tok,svc,tier,tc,bc]) => (
              <div key={tok} className="flex items-center gap-2 text-[10px]">
                <span className="font-mono text-gold-soft w-10 shrink-0">{tok}</span>
                <span className="text-ink-soft flex-1 truncate">{svc}</span>
                <span className={`ovline text-[7px] border px-1.5 py-0.5 ${tc} ${bc}`}>{tier}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-gold-deep bg-gold-deep/5 p-6">
          <div className="text-2xl mb-3 text-gold-soft">⇌</div>
          <div className="ovline text-[9px] mb-2 text-ink-soft">Split-lane view</div>
          <p className="text-xs text-ink-soft leading-relaxed">Enable Split Lanes to separate Fast Lane from Complex Lane. Both process in parallel so no one case blocks the queue.</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[["Fast Lane",["A102 Haircut","A105 Top-up"],"text-[#9bbd9b]"],["Complex",["A103 Tax","A106 Visa"],"text-orange-400"]].map(([lane,items,tc]) => (
              <div key={lane} className="border border-line p-2">
                <div className={`ovline text-[7px] mb-1.5 ${tc}`}>{lane}</div>
                {items.map(it => <div key={it} className="text-[9px] text-ink-soft py-0.5 border-b border-line/50 last:border-b-0 truncate">{it}</div>)}
              </div>
            ))}
          </div>
        </div>
        <div className="border border-[#506b50] bg-[#9bbd9b]/5 p-6">
          <div className="text-2xl mb-3 text-[#9bbd9b]">◎</div>
          <div className="ovline text-[9px] mb-2 text-ink-soft">Smart staff assignment</div>
          <p className="text-xs text-ink-soft leading-relaxed">The autopilot routes each ticket to the best available staff member based on workload and service capability — no manual assignment needed.</p>
          <div className="space-y-2 mt-3">
            {[["Ahmad","Haircut",2,"●"],["Sara","Consult",1,"●"],["Faiz","—",0,"○"]].map(([name,svc,load,dot]) => (
              <div key={name} className="flex items-center gap-2 text-[10px]">
                <span className={`text-[8px] ${load>0?"text-[#9bbd9b]":"text-ink-mute"}`}>{dot}</span>
                <span className="text-ink flex-1">{name}</span>
                <span className="text-ink-mute">{svc}</span>
                {load>0 && <span className="text-[8px] text-gold-soft font-mono">{load} active</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SatisfactionScores() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-12 items-center">
        <div>
          <div className="ovline mb-3 text-gold-soft">Feature · Satisfaction Scores</div>
          <h2 className="font-display text-4xl font-light tracking-tighter mb-5">
            Every visit<br />gets a <em className="not-italic text-gold-soft">score.</em>
          </h2>
          <p className="text-ink-soft text-sm mb-6 leading-relaxed">
            When staff complete a ticket, a quick 5-emoji survey appears. One tap — and the score is linked to the customer profile forever. No surveys to send. No follow-up emails.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              ["Instant staff survey","Appears the moment a ticket is marked complete — no friction."],
              ["Linked to the customer","Scores accumulate on the profile. Staff see the history before the next visit."],
              ["Average score at a glance","The customer list shows each person's all-time average so you know who your champions and risks are."],
            ].map(([t,d]) => (
              <li key={t} className="flex gap-3">
                <span className="pip mt-2 shrink-0" />
                <div>
                  <div className="text-ink">{t}</div>
                  <div className="text-ink-mute text-xs">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <LuxeFrame className="p-7">
          <div className="ovline text-[9px] text-gold-soft mb-5">Rate this visit</div>
          <div className="text-[11px] text-ink-soft mb-4">Abdullah K. · #A102</div>
          <div className="flex gap-4 justify-center mb-3">
            {["😞","😐","😊","😄","🤩"].map((e,i) => (
              <span key={i} className={`text-3xl transition-transform ${i===4?"scale-125":"opacity-40"}`}>{e}</span>
            ))}
          </div>
          <div className="text-center text-xs text-emerald-400 mb-6">Excellent</div>
          <div className="border border-line bg-bg p-3 mb-4">
            <div className="ovline text-[8px] mb-1.5">Staff note</div>
            <div className="text-[10px] text-ink-mute italic">Regular VIP — offered complimentary treatment upgrade.</div>
          </div>
          <div className="rule-ornament my-4 text-[7px]"><span>·</span></div>
          <div className="ovline text-[8px] mb-3">Satisfaction history</div>
          <div className="space-y-2">
            {[["🤩","Excellent","Always a pleasure","12 May"],["😄","Great","Quick and professional","28 Apr"],["😊","Good","","15 Apr"]].map(([em,label,note,date]) => (
              <div key={date} className="flex items-center gap-2 text-[10px]">
                <span>{em}</span>
                <span className="text-ink flex-1">{label}</span>
                {note && <span className="text-ink-mute text-[9px] italic truncate">{note}</span>}
                <span className="text-ink-mute shrink-0">{date}</span>
              </div>
            ))}
          </div>
        </LuxeFrame>
      </div>
    </section>
  );
}

function Checklists() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <LuxeFrame className="p-7 order-2 md:order-1">
          <div className="ovline text-[9px] text-gold-soft mb-4">WhatsApp · auto-sent on booking</div>
          <div className="bg-[#0a0e0c] border border-[#1a3a26] p-4">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#1a3a26]">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#25D366] to-[#0d6a3a] flex items-center justify-center font-display text-[#0b0b0c] text-[10px]">A</div>
              <div className="text-[10px] text-ink">AzQueue · Booking Confirmed</div>
            </div>
            <div className="bg-[#11241b] border border-[#1f3a2a] rounded-2xl rounded-tl-sm px-3 py-3">
              <div className="text-[11px] text-ink mb-2">Hi Abdullah — your Tax Return appointment is confirmed for Mon 9am.</div>
              <div className="text-[10px] text-ink-soft mb-2">Please bring the following documents:</div>
              <div className="space-y-1.5">
                {["✓ MyKad (original + copy)","✓ EA Form / payslips (12 months)","✓ Bank statements (6 months)","✓ EPF statement","✓ Receipts for deductions"].map(item => (
                  <div key={item} className="text-[10px] text-[#9bbd9b]">{item}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="rule-ornament my-4 text-[7px]"><span>·</span></div>
          <div className="ovline text-[8px] mb-2">Checklist library</div>
          <div className="space-y-1">
            {[["Tax Return","5 documents"],["Property Purchase","8 documents"],["Passport Renewal","3 documents"],["Health Screening","2 documents"]].map(([svc,count]) => (
              <div key={svc} className="flex items-center gap-2 text-[10px] py-1 border-b border-line/30 last:border-0">
                <span className="flex-1 text-ink-soft">{svc}</span>
                <span className="text-[#74b9e8] ovline text-[8px]">{count}</span>
              </div>
            ))}
          </div>
        </LuxeFrame>
        <div className="order-1 md:order-2">
          <div className="ovline mb-3 text-gold-soft">Feature · Document Checklists</div>
          <h2 className="font-display text-4xl font-light tracking-tighter mb-5">
            Customers arrive<br /><em className="not-italic text-gold-soft">prepared.</em>
          </h2>
          <p className="text-ink-soft text-sm mb-6 leading-relaxed">
            The moment a booking is confirmed, AzQueue sends the customer a WhatsApp with a tailored document checklist. No more "I forgot my IC." No more wasted appointments.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              ["50+ service templates","Built-in checklists for accounting, legal, medical, government, and more."],
              ["Auto-sent on booking","WhatsApp fires the instant the booking is saved — zero manual follow-up."],
              ["Custom per branch","Each branch can override the global list for location-specific requirements."],
            ].map(([t,d]) => (
              <li key={t} className="flex gap-3">
                <span className="pip mt-2 shrink-0" />
                <div>
                  <div className="text-ink">{t}</div>
                  <div className="text-ink-mute text-xs">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function PainSolution() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-2 gap-px bg-line border border-line">
        <div className="bg-bg-elev p-10">
          <div className="ovline mb-3 text-[#d49185]">The old way</div>
          <h3 className="font-display text-2xl font-light mb-2 tracking-tighter">Two systems. <em className="not-italic text-[#d49185]">No intelligence.</em></h3>
          <p className="text-ink-mute text-xs tracking-wide mb-6">Most businesses still live like this.</p>
          <div className="grid grid-cols-2 gap-3 mb-7">
            <div className="border border-[#3a2a26] bg-[#1a1413] p-4 rotate-[-2deg] origin-bottom-left">
              <div className="text-[8px] uppercase tracking-[0.2em] text-[#d49185] mb-1">Paper</div>
              <div className="font-mono text-2xl text-[#d49185]">047</div>
              <div className="text-[8px] text-ink-mute mt-1">walk-in · torn</div>
            </div>
            <div className="border border-[#3a2a26] bg-[#1a1413] p-4 rotate-[1.5deg]">
              <div className="text-[8px] uppercase tracking-[0.2em] text-[#d49185] mb-1">Calendar</div>
              <div className="space-y-1">
                {["09:00 booked","10:30 ✗ no-show","11:00 booked"].map((s,i) => (
                  <div key={i} className="text-[9px] text-ink-mute font-mono">{s}</div>
                ))}
              </div>
            </div>
          </div>
          <ul className="space-y-3 text-ink-soft text-sm border-t border-line pt-5">
            {[
              "Paper for walk-ins. Calendar for bookings. They never talk.",
              "Staff have no idea who the customer is until they speak.",
              "No document reminders — customers arrive unprepared.",
              "No satisfaction data. No way to know who to retain.",
              "No idea if this is the first visit or the tenth.",
            ].map(p => (
              <li key={p} className="grid grid-cols-[10px_1fr] gap-3 items-baseline">
                <span className="text-[#b56b5f] text-[10px]">✗</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="luxe-panel p-10">
          <div className="ovline mb-3 text-gold-soft">The AzQueue way</div>
          <h3 className="font-display text-2xl font-light mb-2 tracking-tighter">One engine. <em className="not-italic gold-text-soft">Complete intelligence.</em></h3>
          <p className="text-ink-mute text-xs tracking-wide mb-6">Everything your team needs, before the customer reaches the counter.</p>
          <div className="border border-gold-deep bg-bg p-4 mb-7">
            <div className="flex items-center justify-between mb-3">
              <div className="ovline text-[8px]">Combined queue · A102</div>
              <span className="text-[9px] text-[#9bbd9b]">↩ Returning · 7 visits · 😄 4.8★</span>
            </div>
            <p className="text-[10px] text-ink-soft italic leading-relaxed">
              "Loyal VIP. Prefers Ahmad. Sensitive to wait times. Last ticket: open complaint — address proactively."
            </p>
          </div>
          <ul className="space-y-3 text-ink-soft text-sm border-t border-line pt-5">
            {[
              "One queue — walk-ins and bookings, priority-ordered automatically.",
              "AI persona ready the moment the customer joins the queue.",
              "Document checklist WhatsApped before they leave the house.",
              "Satisfaction score captured after every single visit.",
              "New vs. returning status visible at a glance on every ticket.",
            ].map(p => (
              <li key={p} className="grid grid-cols-[10px_1fr] gap-3 items-baseline">
                <span className="text-[#9bbd9b] text-[10px]">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function LiveExperience() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-14">
        <div className="ovline mb-3 text-gold-soft">Live experience</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          From chaos to clarity in <em className="not-italic gold-text-soft">three taps.</em>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-px bg-line border border-line">
        <div className="luxe-panel p-7">
          <div className="flex items-baseline justify-between mb-5">
            <div className="font-display gold-text text-3xl font-light leading-none">01</div>
            <div className="ovline text-[8px]">Customer arrives</div>
          </div>
          <div className="border border-line bg-bg p-4 flex items-center gap-4">
            <div className="grid grid-cols-7 gap-px w-16 h-16 shrink-0">
              {[1,1,1,0,1,1,1,1,0,0,0,0,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,0,1,0,1,0,1,0].map((v,i) => (
                <div key={i} className={v?"bg-gold-soft":"bg-transparent"} />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-ink-mute uppercase tracking-[0.18em] mb-1">Scan to enter</div>
              <div className="font-mono text-[10px] text-gold-soft truncate">azqueue.io/q/branch</div>
              <div className="rule-ornament my-2 text-[7px]"><span>·</span></div>
              <div className="text-[9px] text-ink-mute">Pick service · enter phone</div>
            </div>
          </div>
          <div className="text-[11px] text-ink-soft leading-relaxed mt-5">
            Scan QR → pick service → enter phone → ticket issued. Their AI persona loads in the background before staff calls them.
          </div>
        </div>
        <div className="luxe-panel p-7">
          <div className="flex items-baseline justify-between mb-5">
            <div className="font-display gold-text text-3xl font-light leading-none">02</div>
            <div className="ovline text-[8px]">Staff sees the persona</div>
          </div>
          <div className="border border-line bg-bg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="ovline text-[8px]">A102 · Abdullah K.</span>
              <span className="text-[8px] text-[#9bbd9b]">↩ 7 visits</span>
            </div>
            <div className="text-[10px] text-ink-soft italic leading-snug mb-3">
              "VIP regular. Prefers Ahmad. Upsell opportunity on premium beard oil."
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">😄</span>
              <span className="text-[9px] text-emerald-400">4.8★ avg satisfaction</span>
            </div>
          </div>
          <div className="text-[11px] text-ink-soft leading-relaxed mt-5">
            Staff see the AI persona, visit count, and satisfaction history — before pressing "Call next."
          </div>
        </div>
        <div className="luxe-panel p-7">
          <div className="flex items-baseline justify-between mb-5">
            <div className="font-display gold-text text-3xl font-light leading-none">03</div>
            <div className="ovline text-[8px]">Score and complete</div>
          </div>
          <div className="border border-line bg-bg p-4">
            <div className="ovline text-[8px] mb-3">Rate this visit</div>
            <div className="flex gap-2 justify-center mb-2">
              {["😞","😐","😊","😄","🤩"].map((e,i) => (
                <span key={i} className={`text-xl ${i===4?"":"opacity-30"}`}>{e}</span>
              ))}
            </div>
            <div className="text-center text-[9px] text-emerald-400 mb-3">Excellent</div>
            <div className="border border-line bg-bg-elev py-2 text-center text-[10px] text-gold-soft tracking-wide">
              Submit &amp; complete →
            </div>
          </div>
          <div className="text-[11px] text-ink-soft leading-relaxed mt-5">
            One emoji tap, optional note. Score links to the customer profile instantly.
          </div>
        </div>
      </div>
    </section>
  );
}

function Autopilot() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-12 items-center">
        <div>
          <div className="ovline mb-3 text-gold-soft">Feature · Autopilot</div>
          <h2 className="font-display text-4xl font-light tracking-tighter mb-5">
            The queue runs <em className="not-italic text-gold-soft">itself.</em>
          </h2>
          <p className="text-ink-soft text-sm mb-6">
            Autopilot calls the next customer at the right pace — slowing down when staff is behind, speeding up when the queue grows. No fixed timers, no babysitting.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              ["Adaptive pacing","Calls calibrated to your real service time."],
              ["Staff-aware","Slows down when queued exceeds active staff."],
              ["Pause-aware","Halts during prayer or breaks automatically."],
              ["Smart assignment","Routes each ticket to the least-loaded eligible staff."],
            ].map(([t,d]) => (
              <li key={t} className="flex gap-3">
                <span className="pip mt-2 shrink-0" />
                <div>
                  <div className="text-ink">{t}</div>
                  <div className="text-ink-mute text-xs">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <LuxeFrame className="p-7">
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="pip breathe" />
              <span className="text-xs text-[#9bbd9b]">Autopilot active</span>
            </div>
            <span className="text-[10px] text-ink-mute font-mono">next call in 8s</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="ovline text-[9px] mb-2">Now serving</div>
              <div className="gold-text font-display text-7xl font-light tracking-tightest leading-none">A102</div>
              <div className="text-[10px] text-ink-mute mt-3 tracking-wide">Ali Khan · Haircut · Ahmad</div>
            </div>
            <Ring />
          </div>
          <div className="rule-ornament mt-6 text-[8px]"><span>✦</span></div>
        </LuxeFrame>
      </div>
    </section>
  );
}

function Ring() {
  return (
    <div className="relative w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#26262a" strokeWidth="3" />
        <circle cx="40" cy="40" r="34" fill="none" stroke="#7fa37f" strokeWidth="3" strokeDasharray="213.6" strokeDashoffset="100" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-base text-[#9bbd9b] font-medium">8s</div>
      </div>
    </div>
  );
}

function IslamicMode() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-10">
        <div className="ovline mb-3 text-[#9bbd9b]">Feature · Islamic Mode</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">Built for Muslim-owned businesses.</h2>
        <p className="text-ink-soft text-sm mt-3 max-w-md mx-auto">Your queue and schedule respect prayer times — automatically.</p>
      </div>
      <div className="bg-bg-elev border border-[#506b50] p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="pip animate-pulse" />
            <div>
              <div className="text-sm text-[#9bbd9b]">Next prayer: Dhuhr · 13:15</div>
              <div className="text-[10px] text-ink-mute mt-0.5">Auto-pause enabled · works in both modes</div>
            </div>
          </div>
          <span className="text-[10px] text-ink-mute font-mono">in 41 min</span>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-8 max-w-2xl mx-auto">
        {[
          ["Prayer blocks","All 5 daily prayers + Jumu'ah Friday auto-blocked."],
          ["Queue auto-pause","10 min before prayer, customers receive WhatsApp."],
        ].map(([t,d]) => (
          <div key={t} className="bg-surface border border-line p-5">
            <div className="text-sm font-medium mb-2">{t}</div>
            <p className="text-ink-soft text-xs leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name:"Essential", price:29, tag:"For getting started", gold:false,
      feats:["Queue management","Walk-ins + bookings combined","QR check-in","WhatsApp notifications","Up to 3 staff","Email support"],
    },
    {
      name:"Professional", price:59, tag:"Most chosen", gold:true,
      feats:["Everything in Essential","AI customer personas","New/returning detection","Document checklists (50+)","Islamic Mode + prayer blocks","Autopilot + smart pacing","Priority support"],
    },
    {
      name:"Executive", price:99, tag:"For growing businesses", gold:false,
      feats:["Everything in Pro","Satisfaction scores + history","Freshdesk integration","Smart queue + split lanes","Smart staff assignment","SLA escalations","White-glove setup"],
    },
    {
      name:"Manager", price:149, tag:"People intelligence", gold:false, sage:true,
      feats:["Everything in Executive","Manager dashboard","Break-pattern insights","Anomaly & wellness alerts","Performance reviews","Dedicated concierge"],
    },
  ];
  return (
    <section id="pricing" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-10">
        <div className="ovline mb-3 text-gold-soft">Pricing</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">Four tiers. <em className="not-italic gold-text-soft">No hidden fees.</em></h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map(t => (
          <div key={t.name} className={`relative bg-bg-elev border p-6 ${t.gold?"border-gold-deep":t.sage?"border-[#506b50]":"border-line"}`}>
            {t.gold && (
              <div className="absolute -top-px left-4 bg-gold text-[#141410] px-2 py-0.5 text-[8px] tracking-[0.18em] uppercase font-bold">Most popular</div>
            )}
            {t.sage && (
              <div className="absolute -top-px left-4 bg-[#506b50] text-[#e4f0e4] px-2 py-0.5 text-[8px] tracking-[0.18em] uppercase font-bold">People intel</div>
            )}
            <div className={`ovline text-[9px] mb-2 ${t.gold?"text-gold-soft":t.sage?"text-[#9bbd9b]":""}`}>{t.tag}</div>
            <div className="font-display text-lg">{t.name}</div>
            <div className="flex items-baseline gap-0.5 mt-4 mb-3">
              <span className="text-ink-mute text-[10px]">RM</span>
              <span className="font-display text-gold text-4xl font-light">{t.price}</span>
              <span className="text-ink-mute text-[10px]">/mo</span>
            </div>
            <div className="h-px bg-line mb-3" />
            <ul className="text-[11px] text-ink-soft space-y-1.5 mb-5">
              {t.feats.map(f => <li key={f}>✓ {f}</li>)}
            </ul>
            <Link to={`/signup?tier=${t.name.toLowerCase()}`} className="block">
              <Button variant={t.gold?"gold":"ghost"} className="w-full">Start trial</Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24 border-t border-line text-center">
      <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
        Know every customer.<br />
        <em className="not-italic text-gold-soft">Serve them better.</em>
      </h2>
      <p className="text-ink-soft text-sm mb-8">14-day trial · no card · live in under an hour.</p>
      <Link to="/select"><Button size="lg">Get started →</Button></Link>
    </section>
  );
}
