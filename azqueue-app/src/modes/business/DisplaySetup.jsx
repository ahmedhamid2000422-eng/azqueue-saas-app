import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useBranch } from "../../lib/BranchContext";
import Card, { CardHeader } from "../../components/Card";
import Button from "../../components/Button";
import CustomerJourneyDemo from "../../components/CustomerJourneyDemo";

/**
 * DisplaySetup — the in-dashboard "TV display + iPad kiosk" setup wizard.
 *
 * This is the page owners hit to roll out their queue display on the wall
 * and the check-in iPad at the door. It gives them:
 *   - The two URLs they need (display + kiosk)
 *   - QR codes to scan from a TV's browser or an iPad
 *   - Step-by-step setup for Chromecast, Apple TV, Fire Stick, browser, iPad
 *   - A live preview of what the display will look like
 *   - "Migrating from another queue system?" tips at the bottom
 *
 * Designed so a business owner who's never set up a TV display can be
 * running in under 10 minutes.
 */
export default function DisplaySetup() {
  const { branch, dbReady } = useBranch();
  const [activeGuide, setActiveGuide] = useState("chromecast");

  if (!dbReady) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">Display setup</h1>
        <p className="text-ink-soft text-sm">Run the database migration to enable display setup.</p>
      </div>
    );
  }
  if (!branch) {
    return <div className="p-8 text-ink-mute ovline">Select a branch to set up its display.</div>;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://azqueue.io";
  const displayUrl = `${origin}/display/${branch.slug}`;
  const kioskUrl   = `${origin}/q/${branch.slug}?kiosk=1`;
  const checkinUrl = `${origin}/q/${branch.slug}`;
  const bookingUrl = `${origin}/b/${branch.slug}`;
  const surveyUrl  = `${origin}/survey/${branch.slug}`;

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="mb-8">
        <div className="ovline mb-2 text-gold-soft">Setup · live display & kiosk</div>
        <h1 className="font-display text-4xl font-light tracking-tightest">Display setup</h1>
        <div className="text-xs text-ink-soft mt-2">
          Wall-mounted TV, iPad kiosk at the door, customer QR poster — set up everything for{" "}
          <span className="text-ink">{branch.name}</span> in one place.
        </div>
      </header>

      {/* Customer journey demo — owners see what their customers will experience */}
      <Card luxe className="p-7 mb-3 overflow-hidden">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <div className="ovline text-gold-soft mb-2">Watch the customer journey</div>
            <h2 className="font-display text-2xl font-light tracking-tighter">
              What your customers <em className="not-italic gold-text-soft">actually see.</em>
            </h2>
          </div>
          <span className="ovline text-[9px] text-ink-mute hidden md:block">~25s loop</span>
        </div>

        <CustomerJourneyDemo />

        <div className="rule-ornament mt-5 text-[8px]"><span>·</span></div>
        <div className="text-[10px] text-ink-mute text-center mt-3">
          Show this to staff during onboarding so everyone knows the flow before opening day.
        </div>
      </Card>

      {/* URL cards — display, kiosk, customer QR, booking link */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <UrlCard
          label="TV Display"
          subtitle="Wall screen for the waiting area"
          url={displayUrl}
          accent="gold"
          openLabel="Open display"
        />
        <UrlCard
          label="iPad Kiosk"
          subtitle="Self check-in tablet at the door"
          url={kioskUrl}
          accent="gold"
          openLabel="Open kiosk"
        />
        <UrlCard
          label="Walk-in QR"
          subtitle="Print or share for walk-in scanning"
          url={checkinUrl}
          accent="sage"
          openLabel="Open check-in"
        />
        <UrlCard
          label="Booking link"
          subtitle="Customers book ahead — your Calendly"
          url={bookingUrl}
          accent="sage"
          openLabel="Open booking"
        />
        <UrlCard
          label="Feedback survey"
          subtitle="Rate-your-visit page customers can fill anytime"
          url={surveyUrl}
          accent="sage"
          openLabel="Open survey"
        />
      </div>

      {/* Live preview + setup guides */}
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-3 mb-3">
        {/* Live preview iframe of the actual display */}
        <Card luxe className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <div className="ovline text-gold-soft mb-1">Live preview</div>
              <div className="text-xs text-ink">What customers will see right now</div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-ink-mute">
              <span className="pip breathe" />
              <span className="uppercase tracking-[0.2em]">demo data</span>
            </div>
          </div>
          <div className="relative bg-bg" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={`/display/${branch.slug}?demo=1`}
              title="Display preview"
              className="absolute inset-0 w-full h-full border-0"
              style={{ transformOrigin: "top left" }}
            />
          </div>
          <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic">
            Real customer data appears once you run the queue. The preview uses demo numbers so you can position the screen first.
          </div>
        </Card>

        {/* Setup guide tabs */}
        <Card luxe className="p-6">
          <div className="ovline text-gold-soft mb-3">Setup guide</div>
          <h2 className="font-display text-2xl font-light tracking-tighter mb-4">
            Pick what you have.
          </h2>

          <div className="flex flex-wrap gap-1 border-b border-line mb-5">
            {GUIDES.map((g) => {
              const active = activeGuide === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGuide(g.id)}
                  className={`relative px-3 py-2 text-[10px] tracking-[0.18em] uppercase transition ${
                    active ? "text-gold" : "text-ink-mute hover:text-ink"
                  }`}
                >
                  {g.label}
                  {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-gold" />}
                </button>
              );
            })}
          </div>

          <Guide id={activeGuide} displayUrl={displayUrl} kioskUrl={kioskUrl} />
        </Card>
      </div>

      {/* QR codes for posters + iPad pairing */}
      <Card luxe className="p-7 mb-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <QrTile label="TV Display URL"  url={displayUrl} caption="Scan from a TV browser, then bookmark." />
          <QrTile label="iPad Kiosk URL"  url={kioskUrl}   caption="Scan from the iPad at the door." />
          <QrTile label="Walk-in poster"  url={checkinUrl} caption="Print A4 and stick at reception." />
          <QrTile label="Booking poster"  url={bookingUrl} caption="Share on Instagram or Google profile." />
          <QrTile label="Feedback survey" url={surveyUrl}  caption="Print at the door so customers can rate easily." />
        </div>
      </Card>

      {/* Migration helper */}
      <Card luxe variant="sage" className="p-7">
        <div className="ovline text-[#9bbd9b] mb-3">Switching from another queue system?</div>
        <h2 className="font-display text-2xl font-light tracking-tighter mb-4">
          Make the transition <em className="not-italic gold-text-soft">in one afternoon.</em>
        </h2>

        <div className="grid md:grid-cols-3 gap-px bg-line border border-line">
          {MIGRATION_STEPS.map((s, i) => (
            <div key={i} className="bg-bg-elev p-5">
              <div className="font-display text-gold-soft text-2xl mb-2">{String(i + 1).padStart(2, "0")}</div>
              <div className="text-sm text-ink mb-2">{s.title}</div>
              <p className="text-[11px] text-ink-mute leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
        <div className="text-[10px] text-ink-mute italic font-display text-center">
          Most owners are running on AzQueue within an afternoon, with the old system still up as a backup.
        </div>
      </Card>
    </div>
  );
}

/* ── URL card with copy + open ─────────────────────────────────────── */
function UrlCard({ label, subtitle, url, accent, openLabel }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <Card luxe variant={accent === "sage" ? "sage" : "gold"} className="p-6">
      <div className={`ovline mb-2 ${accent === "sage" ? "text-[#9bbd9b]" : "text-gold-soft"}`}>{label}</div>
      <div className="text-xs text-ink-mute mb-4">{subtitle}</div>
      <div className="bg-bg border border-line p-3 mb-4 font-mono text-[10px] text-gold-soft break-all">
        {url}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={copy}>
          {copied ? "Copied ✓" : "Copy URL"}
        </Button>
        <a href={url} target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost">{openLabel} →</Button>
        </a>
      </div>
    </Card>
  );
}

/* ── QR tile ───────────────────────────────────────────────────────── */
function QrTile({ label, url, caption }) {
  return (
    <div className="text-center">
      <div className="ovline mb-3">{label}</div>
      <div className="bg-white p-4 inline-block">
        <QRCodeSVG value={url} size={160} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#0b0b0c" />
      </div>
      <div className="text-[10px] text-ink-mute mt-3 max-w-[200px] mx-auto">{caption}</div>
    </div>
  );
}

/* ── Setup guides ──────────────────────────────────────────────────── */
const GUIDES = [
  { id: "chromecast", label: "Chromecast" },
  { id: "appletv",    label: "Apple TV" },
  { id: "firestick",  label: "Fire Stick" },
  { id: "browser",    label: "Mini PC / TV browser" },
  { id: "ipad",       label: "iPad on a stand" },
];

function Guide({ id, displayUrl, kioskUrl }) {
  if (id === "chromecast") {
    return (
      <Steps title="Chromecast">
        <Step n="01" title="Plug in the Chromecast">
          Connect the Chromecast to a free HDMI port on your TV. Power it via USB on the TV or with the included adapter.
        </Step>
        <Step n="02" title="Open Chrome on your laptop or phone">
          Sign in to the same Wi-Fi network as the Chromecast. Open <span className="font-mono text-gold-soft">{displayUrl}</span>.
        </Step>
        <Step n="03" title="Cast the tab">
          In Chrome's three-dot menu, choose <em className="not-italic">Cast</em>. Pick your Chromecast under "Sources → Cast tab." The display goes full-screen on the TV.
        </Step>
        <Step n="04" title="Leave it running">
          Press <span className="font-mono">F11</span> to remove the URL bar before casting if you want a totally clean look.
        </Step>
      </Steps>
    );
  }
  if (id === "appletv") {
    return (
      <Steps title="Apple TV">
        <Step n="01" title="Open Safari on your iPad or Mac">
          Make sure it's on the same Wi-Fi as the Apple TV. Open <span className="font-mono text-gold-soft">{displayUrl}</span>.
        </Step>
        <Step n="02" title="AirPlay the page">
          Tap the AirPlay icon in Safari (or Control Center). Pick your Apple TV. The page mirrors to the screen.
        </Step>
        <Step n="03" title="Lock the iPad in landscape, plug it in">
          The iPad needs to stay awake — set Auto-Lock to Never under Settings → Display & Brightness, and keep it charging.
        </Step>
        <Step n="04" title="Optional: a dedicated AirPlay sender">
          For a permanent setup, a $25 used Mac Mini or an old laptop running fullscreen Safari to AirPlay is more reliable than an iPad.
        </Step>
      </Steps>
    );
  }
  if (id === "firestick") {
    return (
      <Steps title="Fire Stick">
        <Step n="01" title="Install the Silk Browser on the Fire Stick">
          From the Fire Stick home screen, search "Silk Browser" — it's free.
        </Step>
        <Step n="02" title="Open the display URL">
          In Silk, navigate to <span className="font-mono text-gold-soft">{displayUrl}</span>.
        </Step>
        <Step n="03" title="Bookmark it">
          Add it as a favorite so it loads on every reboot.
        </Step>
        <Step n="04" title="Disable screensaver">
          Settings → Display & Sounds → Screen Saver → Start After: <em>Never</em>.
        </Step>
      </Steps>
    );
  }
  if (id === "browser") {
    return (
      <Steps title="Mini PC or any TV browser">
        <Step n="01" title="Connect the device to the TV">
          A Raspberry Pi, mini PC, or even an old laptop plugged into HDMI all work the same. Cheapest: a $40 Raspberry Pi 4.
        </Step>
        <Step n="02" title="Open a browser at startup">
          Set the browser to launch fullscreen on boot, pointed at <span className="font-mono text-gold-soft">{displayUrl}</span>. On Pi, use the built-in <em>Kiosk Mode</em> in Raspberry Pi OS.
        </Step>
        <Step n="03" title="Disable screen sleep + cursor">
          On Linux: <span className="font-mono text-[10px]">unclutter</span> hides the cursor; <span className="font-mono text-[10px]">xset s off</span> stops screen sleep.
        </Step>
        <Step n="04" title="Test the network">
          The display needs Wi-Fi or ethernet to receive realtime updates. If you ever lose connection, the screen freezes on its last state — no panic.
        </Step>
      </Steps>
    );
  }
  if (id === "ipad") {
    return (
      <Steps title="iPad on a wall stand or kiosk stand">
        <Step n="01" title="Mount or stand the iPad">
          Floor stand at the door for the kiosk; wall mount above reception for the display. Either way: keep it plugged in.
        </Step>
        <Step n="02" title="Open Safari, navigate to the URL">
          Display: <span className="font-mono text-gold-soft">{displayUrl}</span><br/>
          Kiosk: <span className="font-mono text-gold-soft">{kioskUrl}</span>
        </Step>
        <Step n="03" title="Add to Home Screen">
          In Safari, tap Share → "Add to Home Screen". This lets it run full-screen without the URL bar.
        </Step>
        <Step n="04" title="Lock it down with Guided Access">
          Settings → Accessibility → Guided Access → On. Then triple-press the side button to lock the iPad to that one page. Set a passcode the manager knows.
        </Step>
        <Step n="05" title="Auto-Lock: Never">
          Settings → Display → Auto-Lock → <em>Never</em>. Plug it in.
        </Step>
      </Steps>
    );
  }
  return null;
}

function Steps({ title, children }) {
  return (
    <div>
      <div className="text-[10px] text-ink-mute uppercase tracking-[0.22em] mb-3">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="grid grid-cols-[40px_1fr] gap-3 items-start">
      <div className="font-display text-gold-soft text-base">{n}</div>
      <div>
        <div className="text-sm text-ink mb-1">{title}</div>
        <div className="text-[11px] text-ink-soft leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ── Migration helper ──────────────────────────────────────────────── */
const MIGRATION_STEPS = [
  {
    title: "Run both side-by-side for one day",
    body: "Don't cut the old system over until you've watched AzQueue handle a real lunch rush. Keep the paper tickets on the counter as a backup; staff use whichever they prefer for the first day.",
  },
  {
    title: "Print the QR poster, place at the door",
    body: "Most walk-ins prefer scanning in. Use the Customer QR above — A4 size, gold border, mounted in a stand. Within a day, paper tickets stop getting touched.",
  },
  {
    title: "Move bookings over in batches",
    body: "If you have a list of upcoming bookings in the old system, you can paste them into Bookings → New booking. Or share us a CSV and we'll add a one-click import.",
  },
];
