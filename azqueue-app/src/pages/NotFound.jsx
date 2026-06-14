import { Link, useLocation } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

/**
 * 404 Not Found — shown when any unknown URL is visited.
 * Replaces the old catch-all that silently redirected to /.
 *
 * Keeps the marketing shell so it looks intentional.
 */
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <SiteHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        {/* Big decorative 404 */}
        <div
          className="font-display font-light gold-text leading-none mb-6 select-none"
          style={{ fontSize: "clamp(100px, 20vw, 200px)", opacity: 0.18 }}
          aria-hidden
        >
          404
        </div>

        <div className="ovline text-gold-soft mb-4 -mt-8">Page not found</div>
        <h1 className="font-display text-3xl font-light tracking-tightest mb-4">
          That page doesn't exist.
        </h1>
        <p className="text-ink-soft text-sm max-w-sm leading-relaxed mb-8">
          The URL <span className="font-mono text-gold-soft break-all">{pathname}</span> isn't
          a page on AzQueue. It may have moved, been renamed, or the link may be broken.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/">
            <button
              className="px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] font-medium transition"
              style={{
                background: "var(--color-gold, #c9a86a)",
                color: "#141410",
                border: "none",
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </Link>
          <Link to="/support">
            <button
              className="px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] transition text-ink-mute hover:text-ink"
              style={{
                background: "transparent",
                border: "1px solid var(--color-line, #2a2928)",
                cursor: "pointer",
              }}
            >
              Contact support
            </button>
          </Link>
        </div>

        <div className="rule-ornament mt-14 text-[8px]"><span>·</span></div>

        {/* Helpful shortcuts */}
        <div className="mt-8 text-[11px] text-ink-mute space-y-2">
          <div>Looking for the <Link to="/product" className="text-gold-soft hover:underline">product overview</Link>?</div>
          <div>Want to <Link to="/signup" className="text-gold-soft hover:underline">create an account</Link>?</div>
          <div>Need <Link to="/resources" className="text-gold-soft hover:underline">guides and resources</Link>?</div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
