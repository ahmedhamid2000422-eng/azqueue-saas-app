import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBranch } from "../lib/BranchContext";

/**
 * Topbar — premium meta strip for the dashboards.
 * Left: live clock + branch switcher + autopilot/Islamic status.
 * Right: user menu.
 */
export default function Topbar() {
  const { user, signOut } = useAuth();
  const { branch, branches, select } = useBranch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const ref = useRef(null);
  const branchRef = useRef(null);

  // Live clock — updates every 60s (display is HH:MM, no seconds needed)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (branchRef.current && !branchRef.current.contains(e.target)) setBranchOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  if (!user) return null;

  const initial = (user.email || "?").charAt(0).toUpperCase();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="relative px-5 py-3 border-b border-line flex items-center justify-between bg-bg-elev">
      {/* Subtle gold underline at the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(201,168,106,0.18) 30%, rgba(201,168,106,0.18) 70%, transparent)" }}
      />

      {/* Live status meta */}
      <div className="flex items-center gap-6 text-[11px]">
        <div className="flex items-baseline gap-2">
          <span className="ovline text-[8px]">Now</span>
          <span className="font-mono text-ink">{time}</span>
          <span className="text-ink-mute hidden md:inline">· {date}</span>
        </div>

        {/* Branch switcher — only renders if there's a branch */}
        {branch && (
          <div className="relative" ref={branchRef}>
            <button
              onClick={() => setBranchOpen((o) => !o)}
              className="flex items-baseline gap-2 hover:bg-surface-2 px-2 py-1 transition border border-transparent hover:border-line"
            >
              <span className="ovline text-[8px]">Branch</span>
              <span className="text-ink">{branch.name}</span>
              <span className="text-ink-mute text-[9px]">▾</span>
            </button>

            {branchOpen && (
              <div className="absolute left-0 top-full mt-1 w-72 luxe-panel border border-line shadow-lg z-50">
                <div className="px-4 py-3 border-b border-line">
                  <div className="ovline text-[8px] mb-1">Switch branch</div>
                  <div className="text-[10px] text-ink-mute">{branches.length} {branches.length === 1 ? "branch" : "branches"}</div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {branches.map((b) => {
                    const active = branch?.id === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => { select(b.id); setBranchOpen(false); }}
                        className={`w-full text-left px-4 py-3 transition border-l-2 flex items-center justify-between ${
                          active
                            ? "border-gold bg-[rgba(201,168,106,0.06)] text-gold-soft"
                            : "border-transparent text-ink-soft hover:text-ink hover:bg-surface-2"
                        }`}
                      >
                        <div>
                          <div className="text-xs">{b.name}</div>
                          <div className="text-[10px] text-ink-mute mt-0.5">{b.city ?? "—"}</div>
                        </div>
                        {active && <span className="text-[10px] text-gold-soft">●</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="px-4 py-3 border-t border-line text-[10px] text-ink-mute">
                  Add or rename in Settings · Branches
                </div>
              </div>
            )}
          </div>
        )}

        <div className="hidden md:flex items-center gap-2">
          <span className="pip breathe" />
          <span className="text-[#9bbd9b] text-[11px]">
            {branch?.autopilot ? "Autopilot active" : "Manual mode"}
          </span>
        </div>
      </div>

      {/* User menu */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2 py-1 hover:bg-surface-2 rounded-sm transition"
        >
          <div className="w-7 h-7 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs shadow-[0_0_14px_rgba(201,168,106,0.25)]">
            {initial}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs text-ink">{user.email}</div>
            <div className="text-[9px] text-ink-mute uppercase tracking-[0.15em]">Signed in</div>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-56 luxe-panel border border-line shadow-lg z-50">
            <div className="px-4 py-3 border-b border-line">
              <div className="ovline text-[9px] mb-1">Signed in as</div>
              <div className="text-xs text-ink truncate">{user.email}</div>
            </div>
            {user.user_metadata?.platform_admin === true && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-xs text-gold-soft hover:text-gold hover:bg-surface-2 transition border-b border-line"
              >
                Platform admin →
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3 text-xs text-ink-soft hover:text-ink hover:bg-surface-2 transition"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
