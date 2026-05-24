import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../lib/i18n";

/**
 * LanguagePicker — small, premium dropdown used on customer-facing pages
 * (check-in, ticket, kiosk, display). Persists choice via i18n's localStorage
 * detector so the kiosk remembers a customer's preference.
 *
 * Variants:
 *   - default: pill-style with native script preview
 *   - kiosk: bigger touch targets for the iPad
 */
export default function LanguagePicker({ variant = "default" }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  const isKiosk = variant === "kiosk";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 border border-line hover:border-gold-deep transition ${
          isKiosk ? "px-5 py-3 text-base" : "px-3 py-1.5 text-xs"
        }`}
      >
        <span className="opacity-60">⌘</span>
        <span>{current.native}</span>
        <span className="text-ink-mute">▾</span>
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1 luxe-panel border border-line shadow-lg z-50 ${
          isKiosk ? "w-72" : "w-56"
        }`}>
          <div className="px-4 py-2 border-b border-line ovline text-[8px]">{current.label}</div>
          {LANGUAGES.map((l) => {
            const active = l.code === i18n.language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => { i18n.changeLanguage(l.code); setOpen(false); }}
                className={`w-full text-left px-4 py-3 transition border-l-2 ${
                  active
                    ? "border-gold bg-[rgba(201,168,106,0.06)] text-gold-soft"
                    : "border-transparent text-ink-soft hover:text-ink hover:bg-surface-2"
                } ${isKiosk ? "text-base" : "text-xs"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={l.rtl ? "text-right" : ""}>{l.native}</span>
                  <span className="text-[9px] text-ink-mute uppercase tracking-[0.2em]">{l.code}</span>
                </div>
                <div className="text-[10px] text-ink-mute mt-0.5">{l.label}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
