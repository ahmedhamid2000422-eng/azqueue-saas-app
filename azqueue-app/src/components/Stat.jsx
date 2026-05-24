import { CountUp } from "./LiveTicker";

/**
 * Stat — KPI tile for dashboards.
 * Numeric values get a soft gold-gradient text fill and an animated count-up.
 * Pass `accent` to render the value in the brighter gold.
 * Pass `live` for a breathing pip in the corner.
 */
export default function Stat({ label, value, hint, accent = false, live = false }) {
  const isNumeric = typeof value === "number" || /^\d+$/.test(String(value ?? ""));
  const numeric = isNumeric ? Number(value) : null;
  const goldClass = accent ? "gold-text" : "gold-text-soft";

  return (
    <div className="relative bg-bg-elev border border-line p-4">
      <div className="flex items-center justify-between">
        <div className="ovline text-[9px]">{label}</div>
        {live && <span className="pip breathe" />}
      </div>
      <div className={`font-display text-2xl mt-1 leading-none ${goldClass}`}>
        {isNumeric ? <CountUp to={numeric} /> : value}
      </div>
      {hint && <div className="text-[10px] text-ink-mute mt-1.5">{hint}</div>}
    </div>
  );
}
