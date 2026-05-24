/**
 * Card — base panel for dashboards.
 * Pass `luxe` for the framed atmospheric variant (corner marks + inner glow),
 * or `variant="sage"` for the prayer-aware sage tint.
 */
export default function Card({ luxe = false, variant = "gold", className = "", children, ...rest }) {
  if (!luxe) {
    return (
      <div className={`bg-bg-elev border border-line ${className}`} {...rest}>
        {children}
      </div>
    );
  }

  const panelClass = variant === "sage" ? "luxe-panel-prayer" : "luxe-panel";
  const cornerColor = variant === "sage" ? "#506b50" : "#8a7246";
  return (
    <div
      className={`relative corner-marks ${panelClass} border border-line ${className}`}
      {...rest}
    >
      <span className="cm cm-tl" style={{ borderColor: cornerColor }} />
      <span className="cm cm-tr" style={{ borderColor: cornerColor }} />
      <span className="cm cm-bl" style={{ borderColor: cornerColor }} />
      <span className="cm cm-br" style={{ borderColor: cornerColor }} />
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, right, className = "" }) {
  return (
    <div className={`px-5 py-4 border-b border-line flex items-center justify-between ${className}`}>
      <div>
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-[10px] text-ink-mute mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}
