import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useIsMobile from "../lib/useIsMobile";

const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  muted:  "#60605a",
  border: "rgba(255,255,255,0.07)",
  dim:    "#3a3835",
};

const LINKS = [
  { label: "Product",    to: "/product" },
  { label: "Industries", to: "/industries" },
  { label: "Pricing",    to: "/#pricing" },
  { label: "Resources",  to: "/resources" },
  { label: "Company",    to: "/company" },
];

export default function SiteNav({ solid = false }) {
  const [scrolled, setScrolled] = useState(solid);
  const [open, setOpen]         = useState(false);
  const location                = useLocation();
  const mob                     = useIsMobile();

  useEffect(() => {
    if (solid) { setScrolled(true); return; }
    const h = () => setScrolled(window.scrollY > 32);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [solid]);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (to) => {
    if (to.startsWith("/#")) return false;
    return location.pathname === to;
  };

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 60, padding: mob ? "0 20px" : "0 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled || open ? "rgba(8,8,7,0.96)" : "transparent",
        backdropFilter: scrolled || open ? "blur(16px)" : "none",
        borderBottom: scrolled || open ? `1px solid ${C.border}` : "1px solid transparent",
        transition: "all 0.4s ease",
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", zIndex: 101 }}>
          <div style={{ width: 24, height: 24, background: C.gold, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: C.void, letterSpacing: "0.02em" }}>AQ</div>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
        </Link>

        {/* Desktop nav */}
        {!mob && (
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            {LINKS.map(({ label, to }) =>
              to.startsWith("/#") ? (
                <a key={label} href={to.replace("/", "")} style={{ fontSize: 13, fontWeight: 400, color: C.muted, textDecoration: "none", letterSpacing: "0.01em", transition: "color 0.2s" }}
                  onMouseEnter={e => e.target.style.color = C.ink}
                  onMouseLeave={e => e.target.style.color = C.muted}>
                  {label}
                </a>
              ) : (
                <Link key={label} to={to} style={{ fontSize: 13, fontWeight: 400, color: isActive(to) ? C.ink : C.muted, textDecoration: "none", letterSpacing: "0.01em", transition: "color 0.2s", borderBottom: isActive(to) ? `1px solid rgba(184,149,90,0.4)` : "1px solid transparent", paddingBottom: 1 }}
                  onMouseEnter={e => e.currentTarget.style.color = C.ink}
                  onMouseLeave={e => e.currentTarget.style.color = isActive(to) ? C.ink : C.muted}>
                  {label}
                </Link>
              )
            )}
            <div style={{ width: 1, height: 16, background: C.border }} />
            <Link to="/login" style={{ fontSize: 13, fontWeight: 500, color: C.ink, textDecoration: "none", padding: "7px 22px", border: `1px solid ${C.border}`, borderRadius: 6, letterSpacing: "0.01em", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.dim}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              Sign in
            </Link>
          </div>
        )}

        {/* Mobile: sign in + hamburger */}
        {mob && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 101 }}>
            <Link to="/login" style={{ fontSize: 12, fontWeight: 500, color: C.ink, textDecoration: "none", padding: "6px 14px", border: `1px solid ${C.border}`, borderRadius: 5 }}>
              Sign in
            </Link>
            <button onClick={() => setOpen(v => !v)} aria-label={open ? "Close menu" : "Open menu"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 4.5, alignItems: "center", justifyContent: "center" }}>
              <span style={{ display: "block", width: 20, height: 1.5, background: C.ink, borderRadius: 2, transition: "all 0.25s", transform: open ? "rotate(45deg) translateY(6px)" : "none" }} />
              <span style={{ display: "block", width: 20, height: 1.5, background: C.ink, borderRadius: 2, transition: "all 0.25s", opacity: open ? 0 : 1 }} />
              <span style={{ display: "block", width: 20, height: 1.5, background: C.ink, borderRadius: 2, transition: "all 0.25s", transform: open ? "rotate(-45deg) translateY(-6px)" : "none" }} />
            </button>
          </div>
        )}
      </nav>

      {/* Mobile slide-in drawer */}
      {mob && (
        <div style={{
          position: "fixed", top: 60, left: 0, right: 0, bottom: 0, zIndex: 99,
          background: "rgba(8,8,7,0.98)", backdropFilter: "blur(24px)",
          display: "flex", flexDirection: "column",
          padding: "32px 24px 48px",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {LINKS.map(({ label, to }) =>
              to.startsWith("/#") ? (
                <a key={label} href={to.replace("/", "")} onClick={() => setOpen(false)}
                  style={{ fontSize: 22, fontWeight: 400, color: C.muted, textDecoration: "none", padding: "14px 0", borderBottom: `1px solid ${C.border}`, fontFamily: "Georgia, serif", letterSpacing: "-0.01em", transition: "color 0.2s" }}>
                  {label}
                </a>
              ) : (
                <Link key={label} to={to}
                  style={{ fontSize: 22, fontWeight: 400, color: isActive(to) ? C.gold : C.muted, textDecoration: "none", padding: "14px 0", borderBottom: `1px solid ${C.border}`, fontFamily: "Georgia, serif", letterSpacing: "-0.01em", transition: "color 0.2s" }}>
                  {label}
                </Link>
              )
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 32 }}>
            <Link to="/signup" onClick={() => setOpen(false)}
              style={{ display: "block", textAlign: "center", background: C.gold, color: C.void, padding: "14px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em", textTransform: "uppercase" }}>
              Get started free
            </Link>
            <Link to="/support" onClick={() => setOpen(false)}
              style={{ display: "block", textAlign: "center", background: "transparent", color: C.ink, padding: "14px 0", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none", border: `1px solid ${C.border}`, letterSpacing: "0.01em" }}>
              Book a setup call
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
