import { useEffect, useState } from "react";

/**
 * CustomerJourneyDemo — auto-cycling visual that shows the customer flow
 * end-to-end. Six scenes, ~3 seconds each, with luxe transitions. Designed
 * to live inside the DisplaySetup wizard so owners can show staff exactly
 * what customers will experience before going live.
 *
 * Each scene renders three "screens" side-by-side:
 *   · Customer phone (left)
 *   · Wall display (center, larger)
 *   · Owner / staff dashboard (right)
 *
 * The active screen for each scene is highlighted; the others fade.
 */

const SCENES = [
  {
    id: 1,
    title: "Sara walks in",
    body: "She sees a small QR poster by reception. Phone camera over it.",
    activeOn: "phone",
    phone: { kind: "scanQr" },
    display: { kind: "ready", token: "—", name: "Ready for the next customer" },
    dashboard: { kind: "queue", servingToken: "A101", waiting: 3 },
  },
  {
    id: 2,
    title: "Picks her service",
    body: "Two taps: Haircut. Enters her phone. Done.",
    activeOn: "phone",
    phone: { kind: "form", service: "Haircut", name: "Sara A.", phone: "+60 12 345 6789" },
    display: { kind: "now", token: "A101", name: "Ali Khan · Haircut" },
    dashboard: { kind: "queue", servingToken: "A101", waiting: 3 },
  },
  {
    id: 3,
    title: "Ticket A102 issued",
    body: "Live ticket on her phone. Position 3, est. wait 15 min. WhatsApp confirmation arrives.",
    activeOn: "phone",
    phone: { kind: "ticket", token: "A102", position: 3, eta: "~15m" },
    display: { kind: "now", token: "A101", name: "Ali Khan · Haircut" },
    dashboard: { kind: "queue", servingToken: "A101", waiting: 4, lastAdded: "A102" },
  },
  {
    id: 4,
    title: "Waits, watches the wall",
    body: "She sits down. Watches the gold display tick down through customers.",
    activeOn: "display",
    phone: { kind: "ticket", token: "A102", position: 1, eta: "~5m" },
    display: { kind: "now", token: "A101", name: "Ali Khan · Haircut", upNext: "A102" },
    dashboard: { kind: "queue", servingToken: "A101", waiting: 4 },
  },
  {
    id: 5,
    title: "Her turn",
    body: "Staff clicks Call Next. Display flips to A102. WhatsApp pings her phone.",
    activeOn: "display",
    phone: { kind: "ticketUp", token: "A102" },
    display: { kind: "now", token: "A102", name: "Sara A. · Haircut", animate: true },
    dashboard: { kind: "queue", servingToken: "A102", waiting: 3 },
  },
  {
    id: 6,
    title: "Service complete",
    body: "Done. WhatsApp asks for a star rating. Sara walks out. Staff calls A103.",
    activeOn: "phone",
    phone: { kind: "thanks" },
    display: { kind: "now", token: "A103", name: "Mohammad U. · Beard" },
    dashboard: { kind: "queue", servingToken: "A103", waiting: 2 },
  },
];

const DURATION_MS = 4200;

export default function CustomerJourneyDemo() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % SCENES.length);
    }, DURATION_MS);
    return () => clearInterval(id);
  }, [playing]);

  const scene = SCENES[idx];

  return (
    <div className="relative">
      {/* Atmospheric wash behind the whole demo */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, rgba(201,168,106,0.08), transparent 70%)"
        }}
      />

      <div className="relative">
        {/* Caption strip */}
        <div className="text-center mb-6">
          <div className="ovline text-gold-soft mb-2">
            Step {idx + 1} of {SCENES.length}
          </div>
          <h3 key={scene.id} className="drift-up font-display text-2xl font-light tracking-tighter">
            {scene.title}
          </h3>
          <p key={`b-${scene.id}`} className="drift-up text-ink-soft text-sm mt-2 max-w-xl mx-auto">
            {scene.body}
          </p>
        </div>

        {/* Three-screen stage */}
        <div className="grid grid-cols-[1fr_1.6fr_1fr] gap-4 items-center mb-6">
          <Phone scene={scene} active={scene.activeOn === "phone"} />
          <Wall  scene={scene} active={scene.activeOn === "display"} />
          <Desk  scene={scene} active={scene.activeOn === "dashboard"} />
        </div>

        {/* Scene dots + play/pause */}
        <div className="flex items-center justify-center gap-3">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1 transition-all ${
                i === idx ? "bg-gold w-8" : "bg-line w-4 hover:bg-line-2"
              }`}
            />
          ))}
          <button
            onClick={() => setPlaying((p) => !p)}
            className="ml-3 text-[9px] tracking-[0.2em] uppercase text-ink-mute hover:text-ink"
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>

        <div className="text-[10px] text-ink-mute text-center mt-4 italic">
          Demo · uses mock data. Your real customers will see your branch name and services.
        </div>
      </div>
    </div>
  );
}

/* ── Customer phone ────────────────────────────────────────────────── */
function Phone({ scene, active }) {
  return (
    <div
      className={`mx-auto transition-all duration-500 ${active ? "opacity-100 scale-100" : "opacity-50 scale-95"}`}
      style={{ maxWidth: 180 }}
    >
      <div className="ovline text-[8px] mb-2 text-center">Customer phone</div>
      <div className="relative bg-bg-elev border border-line rounded-[20px] p-3 shadow-lg" style={{ aspectRatio: "9/19" }}>
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-line rounded-full" />
        <div className="h-full w-full overflow-hidden rounded-[12px] bg-bg flex flex-col">
          {scene.phone.kind === "scanQr" && <PhoneScanQR />}
          {scene.phone.kind === "form" && <PhoneForm v={scene.phone} />}
          {scene.phone.kind === "ticket" && <PhoneTicket v={scene.phone} />}
          {scene.phone.kind === "ticketUp" && <PhoneTicketUp v={scene.phone} />}
          {scene.phone.kind === "thanks" && <PhoneThanks />}
        </div>
      </div>
    </div>
  );
}

function PhoneScanQR() {
  return (
    <div className="flex-1 flex items-center justify-center bg-black/60 relative">
      <div className="grid grid-cols-7 gap-px w-20 h-20" aria-hidden>
        {[1,1,1,0,1,1,1, 1,0,0,0,0,0,1, 1,0,1,1,1,0,1, 1,0,1,1,1,0,1, 1,0,0,0,0,0,1, 1,1,1,1,1,1,1, 0,1,0,1,0,1,0]
          .map((v, i) => (
            <div key={i} className={v ? "bg-gold-soft" : "bg-transparent"} />
          ))}
      </div>
      <div className="absolute inset-x-3 top-1/2 h-px bg-gold/70 animate-pulse" style={{ boxShadow: "0 0 8px #c9a86a" }} />
      <div className="absolute bottom-3 left-0 right-0 text-center">
        <div className="ovline text-[6px] text-gold-soft">Scan to enter</div>
      </div>
    </div>
  );
}

function PhoneForm({ v }) {
  return (
    <div className="flex-1 p-2.5">
      <div className="ovline text-[6px] text-gold-soft mb-1.5">Check in</div>
      <div className="font-display text-[10px] mb-2">KL Downtown</div>
      <div className="text-[5px] text-ink-mute uppercase tracking-wide mb-1">Service</div>
      <div className="border border-gold-deep bg-[rgba(201,168,106,0.06)] px-2 py-1 mb-2">
        <div className="text-[7px] text-gold-soft">● {v.service}</div>
      </div>
      <div className="text-[5px] text-ink-mute uppercase tracking-wide mb-1">Name</div>
      <div className="bg-bg-elev border border-line px-2 py-1 mb-2 text-[7px] text-ink">{v.name}</div>
      <div className="text-[5px] text-ink-mute uppercase tracking-wide mb-1">Phone</div>
      <div className="bg-bg-elev border border-line px-2 py-1 mb-2 text-[6px] text-ink font-mono">{v.phone}</div>
      <div className="bg-gold text-[#141410] text-[6px] uppercase tracking-[0.2em] px-2 py-1.5 text-center font-bold">
        Get my ticket →
      </div>
    </div>
  );
}

function PhoneTicket({ v }) {
  return (
    <div className="flex-1 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="ovline text-[6px] text-gold-soft">Your ticket</div>
        <div className="ovline text-[6px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1" />Live
        </div>
      </div>
      <div className="gold-text font-display text-3xl font-light leading-none tracking-tightest">{v.token}</div>
      <div className="rule-ornament my-2 text-[5px]"><span>·</span></div>
      <div className="grid grid-cols-2 gap-px bg-line border border-line">
        <div className="bg-bg-elev p-1.5 text-center">
          <div className="text-[5px] text-ink-mute uppercase">Ahead</div>
          <div className="font-display text-base gold-text-soft">{v.position}</div>
        </div>
        <div className="bg-bg-elev p-1.5 text-center">
          <div className="text-[5px] text-ink-mute uppercase">ETA</div>
          <div className="font-display text-base gold-text-soft">{v.eta}</div>
        </div>
      </div>
      <div className="text-[6px] text-ink-mute mt-2 text-center">Keep this open — it updates the moment you're called.</div>
    </div>
  );
}

function PhoneTicketUp({ v }) {
  return (
    <div className="flex-1 p-2.5 text-center flex flex-col justify-center">
      <div className="ovline text-[6px] text-[#9bbd9b] flex items-center justify-center gap-1 mb-1">
        <span className="pip breathe" />You're up now
      </div>
      <div className="gold-text font-display text-4xl font-light leading-none tracking-tightest">{v.token}</div>
      <div className="rule-ornament my-2 text-[5px]"><span>✦</span></div>
      <div className="text-[7px] text-ink">Walk in now — Counter 2.</div>
    </div>
  );
}

function PhoneThanks() {
  return (
    <div className="flex-1 p-2.5 text-center flex flex-col justify-center">
      <div className="ovline text-[6px] text-gold-soft mb-1">Thank you</div>
      <div className="font-display text-base font-light tracking-tighter mb-2">Service complete.</div>
      <div className="text-[10px] text-gold-soft tracking-wider">★ ★ ★ ★ ★</div>
      <div className="text-[6px] text-ink-mute mt-2">Tap to rate.</div>
    </div>
  );
}

/* ── Wall display ──────────────────────────────────────────────────── */
function Wall({ scene, active }) {
  const v = scene.display;
  return (
    <div className={`transition-all duration-500 ${active ? "opacity-100 scale-100" : "opacity-50 scale-95"}`}>
      <div className="ovline text-[8px] mb-2 text-center">Wall display</div>
      <div className="relative bg-bg border border-line rounded-md overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {/* Ambient gold */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{
          background: "radial-gradient(60% 80% at 50% 0%, rgba(201,168,106,0.10), transparent 70%)"
        }} />
        <div className="relative h-full p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="ovline text-[7px] text-gold-soft">KL Downtown</div>
            <div className="ovline text-[7px] text-[#9bbd9b] flex items-center">
              <span className="pip breathe mr-1" />Live
            </div>
          </div>

          <div className="text-center">
            <div className="ovline text-[7px] mb-1">Now serving</div>
            <div
              key={v.token}
              className={`drift-up gold-text font-display font-light tracking-tightest leading-none ${
                v.animate ? "scale-105 transition-transform" : ""
              }`}
              style={{ fontSize: "clamp(36px, 4.5vw, 60px)" }}
            >
              {v.token}
            </div>
            <div className="text-[7px] text-ink-mute mt-1">{v.name}</div>
          </div>

          <div className="text-[6px] text-ink-mute text-right">
            {v.upNext ? <>Up next · <span className="text-gold-soft">{v.upNext}</span></> : "azqueue.io"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Owner dashboard ──────────────────────────────────────────────── */
function Desk({ scene, active }) {
  const v = scene.dashboard;
  return (
    <div className={`mx-auto transition-all duration-500 ${active ? "opacity-100 scale-100" : "opacity-50 scale-95"}`}>
      <div className="ovline text-[8px] mb-2 text-center">Staff dashboard</div>
      <div className="bg-bg-elev border border-line rounded-md p-3" style={{ aspectRatio: "10/13" }}>
        <div className="ovline text-[6px] text-gold-soft mb-1">Now serving</div>
        <div className="gold-text font-display text-2xl font-light leading-none tracking-tightest">{v.servingToken}</div>
        <div className="rule-ornament my-2 text-[5px]"><span>·</span></div>
        <div className="ovline text-[6px] mb-1">Up next · {v.waiting}</div>
        <div className="space-y-px bg-line border border-line">
          {[
            ["A102", "Sara A.",      v.lastAdded === "A102"],
            ["A103", "Mohammad U.",  false],
            ["A104", "Zainab F.",    false],
          ].map(([t, n, fresh]) => (
            <div key={t} className={`bg-bg-elev px-1.5 py-1 grid grid-cols-[24px_1fr] gap-1.5 items-center ${fresh ? "bg-[rgba(201,168,106,0.06)]" : ""}`}>
              <span className="font-display text-[7px] text-gold-soft">{t}</span>
              <span className="text-[7px] text-ink truncate">{n}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 bg-gold text-[#141410] text-[6px] uppercase tracking-[0.18em] py-1 text-center font-bold">
          Call next →
        </div>
      </div>
    </div>
  );
}
