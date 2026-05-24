import { Link, useLocation } from "react-router-dom";

export default function Sidebar({ mode, items, footerName, footerRole }) {
  const location = useLocation();
  const base = mode === "business" ? "/business" : "/personal";

  return (
    <aside className="relative w-[220px] shrink-0 border-r border-line py-3 flex flex-col h-screen sticky top-0 luxe-panel">
      {/* Subtle gold dust glow at top of sidebar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, rgba(201,168,106,0.07), transparent 70%)" }}
      />

      <Link to="/" className="relative px-4 pt-1 pb-4 flex items-center gap-2 hover:opacity-80 transition">
        <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs shadow-[0_0_18px_rgba(201,168,106,0.25)]">A</div>
        <span className="font-display text-sm tracking-tight">AzQueue</span>
      </Link>

      <div className="rule-ornament mx-4 text-[7px]"><span>·</span></div>

      <nav className="relative flex-1 py-2">
        <div className="ovline px-4 py-2.5 text-[9px] flex items-center gap-2">
          <span>{mode === "business" ? "Business" : "Personal flow"}</span>
        </div>
        {items.map((it) => {
          const path = `${base}${it.path}`;
          const active =
            location.pathname === path ||
            (it.path === "" && location.pathname === base);
          return (
            <Link
              key={it.label}
              to={path}
              className={`relative flex items-center justify-between px-4 py-2.5 text-xs transition border-l-2 ${
                active
                  ? "border-gold bg-[rgba(201,168,106,0.06)] text-gold-soft"
                  : "border-transparent text-ink-soft hover:text-ink hover:bg-white/[0.02]"
              }`}
            >
              <span className="flex items-center gap-2">
                {active && <span className="pip breathe" />}
                <span className={active ? "tracking-wide" : ""}>{it.label}</span>
              </span>
              {it.badge && (
                <span className="text-[9px] bg-gold text-[#141410] px-1.5 rounded-full font-semibold">
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="rule-ornament mx-4 text-[7px]"><span>✦</span></div>

      <div className="px-4 py-3 border-t border-line">
        <div className="ovline mb-1 text-[9px]">Signed in</div>
        <div className="text-xs">{footerName}</div>
        <div className="text-[10px] text-ink-mute mt-0.5">{footerRole}</div>
      </div>
    </aside>
  );
}
