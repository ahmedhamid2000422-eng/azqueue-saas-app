import { Link } from "react-router-dom";

/**
 * BusinessHome — the front page of a customer's OWN domain.
 *
 * WHY THIS EXISTS
 * The A2P 10DLC campaign was rejected twice, the second time because "the
 * provided website URL does not match the Brand and Campaign registered". The
 * brand is Az Tax Services; the site was azqueue.io, a different company. A
 * carrier reviewer landing there saw a queue-software vendor and no evidence
 * that Az Tax texts anyone.
 *
 * So aztaxservices.io now resolves to this page instead of the AzQueue
 * marketing site. A reviewer sees the business named on the brand
 * registration, its real address and phone, a plain description of what it
 * texts and how someone consents, and links to the policies — all above the
 * fold, all naming one entity.
 *
 * It is also just a useful page. The business had no web presence at all.
 */

/* Keyed by hostname. Adding a customer domain is a DNS record and an entry
   here — deliberately small, because every field on it has to match that
   business's brand registration exactly, and a generated approximation would
   reintroduce the mismatch this page exists to fix. */
export const BUSINESS_SITES = {
  "aztaxservices.io": {
    slug:    "az-tax-services",
    name:    "Az Tax Services",
    tagline: "Tax preparation and immigration services in Aurora, Colorado.",
    phone:   "(303) 368-4322",
    email:   "aztaxservices1@gmail.com",
    city:    "Aurora, Colorado",
  },
};

/** The site config for the current hostname, or null on azqueue.io. */
export function businessForHost(host = "") {
  const clean = host.toLowerCase().replace(/^www\./, "").split(":")[0];
  return BUSINESS_SITES[clean] ?? null;
}

export default function BusinessHome({ site }) {
  if (!site) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-line px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <div className="font-display text-lg font-light tracking-tight text-ink">
            {site.name}
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl font-light tracking-tightest mb-4">
            {site.name}
          </h1>
          <p className="text-[15px] text-ink-soft leading-relaxed mb-8 max-w-xl">
            {site.tagline}
          </p>

          <div className="flex flex-wrap gap-3 mb-14">
            <a
              href={`/q/${site.slug}`}
              className="ovline text-[11px] border border-gold-deep px-5 py-3 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition"
            >
              Join the queue
            </a>
            <a
              href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}
              className="ovline text-[11px] border border-line px-5 py-3 text-ink-soft hover:text-ink transition"
            >
              Call {site.phone}
            </a>
          </div>

          {/* The section the carrier review is looking for. Written plainly
              and kept on the front page rather than behind a link, because a
              reviewer who has to hunt for the opt-in records that there
              isn't one. */}
          <section className="border-t border-line pt-10 max-w-xl">
            <h2 className="ovline text-[10px] text-gold-soft mb-4">
              Text message notifications
            </h2>
            <div className="space-y-3 text-[13px] text-ink-soft leading-relaxed">
              <p>
                When you check in at our office you can choose to be notified
                by text message instead of waiting in the room. We text you
                your place in the queue and let you know when it is your turn.
              </p>
              <p>
                You opt in by ticking a box on our check-in form — it is
                unchecked by default, and you are served exactly the same way
                if you leave it unticked. Message frequency varies, typically
                1–5 per visit. Message and data rates may apply. Reply{" "}
                <strong>STOP</strong> to cancel or <strong>HELP</strong> for
                help at any time.
              </p>
              <p className="text-ink">
                We never sell or share your phone number with third parties for
                marketing, and we never send you promotional messages.
              </p>
              <p className="text-ink-mute">
                See our{" "}
                <Link to={`/b/${site.slug}/privacy`} className="text-gold-soft underline">
                  privacy policy
                </Link>{" "}
                and{" "}
                <Link to={`/b/${site.slug}/terms`} className="text-gold-soft underline">
                  terms of service
                </Link>
                .
              </p>
            </div>
          </section>

          <section className="border-t border-line mt-10 pt-10 max-w-xl">
            <h2 className="ovline text-[10px] text-gold-soft mb-4">Contact</h2>
            <div className="space-y-1.5 text-[13px] text-ink-soft">
              <div>{site.city}</div>
              <div>{site.phone}</div>
              <div>{site.email}</div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-line px-6 py-6">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-ink-mute">
          <span>© {new Date().getFullYear()} {site.name}</span>
          <Link to={`/b/${site.slug}/privacy`} className="hover:text-ink transition">Privacy</Link>
          <Link to={`/b/${site.slug}/terms`} className="hover:text-ink transition">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
