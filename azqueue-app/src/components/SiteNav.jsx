import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const C = {
  void:   "#080807",
  ink:    "#f0ede6",
  gold:   "#b8955a",
  muted:  "#60605a",
  border: "rgba(255,255,255,0.07)",
  dim:    "#3a3835",
};

export default function SiteNav({ solid = false }) {
  const [scrolled, setScrolled] = useState(solid);
  const location = useLocation();

  useEffect(() => {
    if (solid) { setScrolled(true); return; }
    const h = () => setScrolled(window.scrollY > 32);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [solid]);

  const links = [
    { label: "Product",    to: "/product" },
    { label: "Industries", to: "/industries" },
    { label: "Pricing",    to: "/#pricing" },
    { label: "Resources",  to: "/resources" },
    { label: "Company",    to: "/company" },
  ];

  const isActive = (to) => {
    if (to.startsWith("/#")) return false;
    return location.pathname === to;
  };

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: 60, padding: "0 48px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: scrolled ? "rgba(8,8,7,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      transition: "all 0.4s ease",
    }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
        <div style={{ width: 24, height: 24, background: C.gold, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.void }}>A</div>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: "0.01em" }}>AzQueue</span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {links.map(({ label, to }) => (
          to.startsWith("/#") ? (
            <a key={label} href={to.replace("/", "")} style={{
              fontSize: 13, fontWeight: 400, color: C.muted,
              textDecoration: "none", letterSpacing: "0.01em", transition: "color 0.2s",
            }}
              onMouseEnter={e => e.target.style.color = C.ink}
              onMouseLeave={e => e.target.style.color = C.muted}>
              {label}
            </a>
          ) : (
            <Link key={label} to={to} style={{
              fontSize: 13, fontWeight: 400,
              color: isActive(to) ? C.ink : C.muted,
              textDecoration: "none", letterSpacing: "0.01em", transition: "color 0.2s",
              borderBottom: isActive(to) ? `1px solid rgba(184,149,90,0.4)` : "1px solid transparent",
              paddingBottom: 1,
            }}
              onMouseEnter={e => e.currentTarget.style.color = C.ink}
              onMouseLeave={e => e.currentTarget.style.color = isActive(to) ? C.ink : C.muted}>
              {label}
            </Link>
          )
        ))}

        <div style={{ width: 1, height: 16, background: C.border }} />

        <Link to="/login" style={{
          fontSize: 13, fontWeight: 500, color: C.ink, textDecoration: "none",
          padding: "7px 22px", border: `1px solid ${C.border}`,
          borderRadius: 6, letterSpacing: "0.01em", transition: "all 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.dim}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
          Sign in
        </Link>
      </div>
    </nav>
  );
}
