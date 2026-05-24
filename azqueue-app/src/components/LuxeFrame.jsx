/**
 * LuxeFrame — luxury display frame with gold corner marks and atmospheric panel.
 * Wrap live previews, hero displays, anything that should feel "behind glass".
 *
 * Variants:
 *  - "gold" (default) — warm gold inner glow, gold corner marks
 *  - "sage" — sage-green inner glow (for Islamic Mode)
 */
export default function LuxeFrame({ variant = "gold", className = "", children }) {
  const panelClass = variant === "sage" ? "luxe-panel-prayer" : "luxe-panel";
  const cornerColor = variant === "sage" ? "#506b50" : "#8a7246";
  return (
    <div className={`relative corner-marks ${panelClass} border border-line ${className}`}>
      <span className="cm cm-tl" style={{ borderColor: cornerColor }} />
      <span className="cm cm-tr" style={{ borderColor: cornerColor }} />
      <span className="cm cm-bl" style={{ borderColor: cornerColor }} />
      <span className="cm cm-br" style={{ borderColor: cornerColor }} />
      {children}
    </div>
  );
}

/**
 * Ornamented hairline divider with a center mark — for luxe section breaks.
 */
export function Ornament({ mark = "✦", className = "" }) {
  return (
    <div className={`rule-ornament text-[10px] ${className}`}>
      <span>{mark}</span>
    </div>
  );
}
