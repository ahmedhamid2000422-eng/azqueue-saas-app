import { Link } from "react-router-dom";

const COLS = [
  ["Product", [
    ["Overview",   "/product"],
    ["Pricing",    "/#pricing"],
    ["Industries", "/industries"],
    ["Start trial","/signup"],
  ]],
  ["Resources", [
    ["Documentation", "/resources"],
    ["Setup guides",  "/resources"],
    ["API reference", "/resources"],
    ["Support",       "/support"],
  ]],
  ["Platform", [
    ["Islamic Mode",  "/islamic-mode"],
    ["Manager Mode",  "/manager-mode"],
    ["Personal Flow", "/personal-flow"],
    ["Home Care",     "/industries#homecare"],
  ]],
  ["Company", [
    ["About",   "/company"],
    ["Privacy", "/legal/privacy"],
    ["Terms",   "/legal/terms"],
    ["Refunds", "/legal/refund"],
  ]],
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg mt-12">
      <div className="max-w-6xl mx-auto px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
        {COLS.map(([heading, items]) => (
          <div key={heading}>
            <div className="ovline mb-3">{heading}</div>
            {items.map(([label, href]) => (
              <Link key={label} to={href} className="block text-ink-soft py-1 hover:text-ink transition">
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-[9px]">A</div>
            <span className="font-display text-sm">AzQueue</span>
          </div>
          <div className="text-[10px] text-ink-mute">© 2026 AzQueue · All rights reserved</div>
        </div>
      </div>
    </footer>
  );
}
