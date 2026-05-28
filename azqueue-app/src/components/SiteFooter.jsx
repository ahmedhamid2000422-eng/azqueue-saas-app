import { Link } from "react-router-dom";
import useIsMobile from "../lib/useIsMobile";

/* ──────────────────────────────────────────────────────────────────────
 * SiteFooter — the single footer used on every marketing / info page.
 *
 * Uses inline styles deliberately so the visual chrome matches the
 * inline-styled marketing pages (Landing, Resources, Industries, etc.)
 * exactly — no Tailwind-vs-inline drift. Drop this on the bottom of
 * any public page and the look stays consistent.
 * ──────────────────────────────────────────────────────────────────── */

const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  goldLit:"#d4b478",
  muted:  "#60605a",
  border: "rgba(255,255,255,0.07)",
  card:   "#0c0c0b",
  dim:    "#3a3835",
};

const Arr = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

const COLS = [
  { heading: "Product",     links: [
    ["Features",      "/product"],
    ["Industries",    "/industries"],
    ["Pricing",       "/#pricing"],
    ["FAQ",           "/#faq"],
  ]},
  { heading: "Solutions",   links: [
    ["For clinics",       "/industries"],
    ["For banks",         "/industries"],
    ["For salons",        "/industries"],
    ["Islamic Mode",      "/islamic-mode"],
    ["Multi-branch",      "/resources/multi-branch"],
  ]},
  { heading: "Resources",   links: [
    ["All guides",            "/resources"],
    ["Science of waiting",    "/resources/science-of-waiting"],
    ["Setup guide",           "/resources/setup-guide"],
    ["Case studies",          "/resources#case-studies"],
    ["Support",               "/support"],
  ]},
  { heading: "Company",     links: [
    ["About",          "/company"],
    ["Careers",        "/company"],
    ["Terms",          "/legal/terms"],
    ["Privacy",        "/legal/privacy"],
    ["Refunds",        "/legal/refund"],
  ]},
];

export default function SiteFooter() {
  const mob = useIsMobile();
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: mob ? "48px 20px 32px" : "72px 48px 36px", background: C.void, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1.5fr 1fr 1fr 1fr 1fr", gap: mob ? 32 : 40, marginBottom: mob ? 40 : 64 }}>

          {/* Brand column — full width on mobile */}
          <div style={mob ? { gridColumn: "1 / -1" } : {}}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 24, height: 24, background: C.gold, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.void }}>A</div>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
            </div>
            <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, maxWidth: 240, margin: 0 }}>
              Queue and line management for clinics, banks, salons, and service businesses. Walk-ins and bookings in one smart queue.
            </p>
            <div style={{ marginTop: 24 }}>
              <Link to="/support" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: C.goldLit, textDecoration: "none", letterSpacing: "0.01em" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                Get in touch <Arr />
              </Link>
            </div>
          </div>

          {/* Link columns */}
          {COLS.map(col => (
            <div key={col.heading}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18, fontWeight: 600 }}>{col.heading}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {col.links.map(([label, to]) => (
                  to.startsWith("/#") || to.includes("#") ? (
                    <a key={label} href={to} style={{ fontSize: 12.5, color: C.dim, textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={e => e.target.style.color = C.ink}
                      onMouseLeave={e => e.target.style.color = C.dim}>{label}</a>
                  ) : (
                    <Link key={label} to={to} style={{ fontSize: 12.5, color: C.dim, textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={e => e.target.style.color = C.ink}
                      onMouseLeave={e => e.target.style.color = C.dim}>{label}</Link>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom rule */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28, display: "flex", flexDirection: mob ? "column" : "row", justifyContent: "space-between", alignItems: mob ? "flex-start" : "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: C.dim }}>© 2026 AzQueue. All rights reserved.</div>
          <div style={{ display: "flex", gap: 24 }}>
            {[["Privacy", "/legal/privacy"], ["Terms", "/legal/terms"], ["Refunds", "/legal/refund"], ["Support", "/support"]].map(([label, to]) => (
              <Link key={label} to={to} style={{ fontSize: 11, color: C.dim, textDecoration: "none" }}
                onMouseEnter={e => e.target.style.color = C.muted}
                onMouseLeave={e => e.target.style.color = C.dim}>{label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
