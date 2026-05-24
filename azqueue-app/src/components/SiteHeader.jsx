import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Button from "./Button";

const NAV_LINKS = [
  ["Product",      "/product"],
  ["Industries",   "/industries"],
  ["Personal",     "/personal-flow"],
  ["Islamic Mode", "/islamic-mode"],
  ["Manager",      "/manager-mode"],
  ["Resources",    "/resources"],
  ["Support",      "/support"],
  ["Company",      "/company"],
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-bg/95 border-b border-line">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs">A</div>
          <span className="font-display text-base">AzQueue</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 text-xs text-ink-soft">
          {NAV_LINKS.map(([label, href]) => (
            <Link
              key={href}
              to={href}
              className={`hover:text-ink transition ${pathname === href ? "text-ink" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/signup"><Button size="sm">Sign up</Button></Link>
        </div>

        {/* Mobile: sign in + hamburger */}
        <div className="flex lg:hidden items-center gap-3">
          <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <button
            className="flex flex-col gap-[5px] p-2 -mr-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <span className={`block h-px w-5 bg-ink transition-all duration-200 origin-center ${open ? "rotate-45 translate-y-[6px]" : ""}`} />
            <span className={`block h-px w-5 bg-ink transition-all duration-200 ${open ? "opacity-0 scale-x-0" : ""}`} />
            <span className={`block h-px w-5 bg-ink transition-all duration-200 origin-center ${open ? "-rotate-45 -translate-y-[6px]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="lg:hidden border-t border-line bg-bg px-6 py-4">
          <nav className="flex flex-col mb-5">
            {NAV_LINKS.map(([label, href]) => (
              <Link
                key={href}
                to={href}
                onClick={() => setOpen(false)}
                className={`py-3 text-sm border-b border-line last:border-0 transition ${
                  pathname === href ? "text-gold-soft" : "text-ink-soft hover:text-ink"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link to="/signup" onClick={() => setOpen(false)}>
            <Button size="sm" className="w-full">Create free account →</Button>
          </Link>
        </div>
      )}
    </header>
  );
}
