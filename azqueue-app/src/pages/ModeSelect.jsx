import { Link } from "react-router-dom";

export default function ModeSelect() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 border-b border-line">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs">A</div>
          <span className="font-display text-base">AzQueue</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full text-center">
          <div className="ovline mb-3 text-gold-soft">Choose your mode</div>
          <h1 className="font-display text-4xl font-light tracking-tighter mb-3">
            How will you <em className="not-italic text-gold-soft">use AzQueue?</em>
          </h1>
          <p className="text-ink-soft text-sm mb-12 max-w-md mx-auto">
            Pick one to get started. You can switch anytime in settings.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <ModeCard
              to="/business"
              overline="For businesses"
              title="Business Mode"
              desc="Queue + booking management for service businesses. Walk-ins and bookings merge into one intelligent queue."
              footer="Barbershops · clinics · cafés · gyms"
            />
            <ModeCard
              to="/personal"
              overline="For individuals"
              title="Personal Flow"
              desc="Manage your day, your tasks, your focus. Deep work, smart docs, AI assist — all in one calm workspace."
              footer="Students · founders · creators"
            />
          </div>

          <div className="text-[10px] text-ink-mute mt-10">
            Both modes share the same engine · switch later from Settings
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCard({ to, overline, title, desc, footer }) {
  return (
    <Link
      to={to}
      className="group bg-bg-elev border border-line hover:border-gold-deep transition p-7 text-left flex flex-col"
    >
      <div className="ovline mb-3 text-gold-soft">{overline}</div>
      <h3 className="font-display text-2xl font-light tracking-tighter mb-3 group-hover:text-gold-soft transition">
        {title}
      </h3>
      <p className="text-ink-soft text-sm leading-relaxed mb-6 flex-1">{desc}</p>
      <div className="text-[10px] text-ink-mute pt-4 border-t border-line">{footer}</div>
      <div className="text-gold-soft text-xs mt-3 tracking-[0.08em] uppercase">Enter →</div>
    </Link>
  );
}
