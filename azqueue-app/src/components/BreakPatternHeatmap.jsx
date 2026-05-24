/**
 * BreakPatternHeatmap — luxe heatmap grid for "when does each staff member
 * typically take their break?"
 *
 * Brighter cells = more frequent breaks at that hour. Built from real
 * staff_status_log rows (computed in src/lib/managerIntel.js → heatmap).
 *
 * Props:
 *   rows           — array of { id, name, values, raw }
 *                    where values[hour] is 0..1 (normalised intensity)
 *                    and raw[hour] is the actual count (for tooltips)
 *   startHour      — first hour shown (default 9)
 *   endHour        — last hour shown, exclusive (default 18)
 *   variant        — "gold" (default) | "sage"
 *   onCellClick    — optional (staffId, hour) => void
 *
 * Usage:
 *   <BreakPatternHeatmap rows={intel.heatmap} />
 *   <BreakPatternHeatmap rows={intel.heatmap} startHour={6} endHour={22} variant="sage" />
 */
export default function BreakPatternHeatmap({
  rows = [],
  startHour = 9,
  endHour = 18,
  variant = "gold",
  onCellClick,
}) {
  const hours = Array.from(
    { length: Math.max(0, endHour - startHour) },
    (_, i) => i + startHour
  );

  const baseRGB = variant === "sage" ? "127, 163, 127" : "201, 168, 106";
  const opacityScale = 0.65;
  const glowScale = 0.32;

  if (rows.length === 0) {
    return (
      <div className="text-center text-ink-mute text-xs py-8 italic">
        No staff history yet. Patterns will appear as your team logs activity.
      </div>
    );
  }

  return (
    <div
      className="grid items-center gap-3"
      style={{ gridTemplateColumns: `100px 1fr` }}
    >
      {/* Hour header — empty cell + hours strip */}
      <div />
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
      >
        {hours.map((h) => (
          <div key={h} className="text-[9px] text-ink-mute font-mono text-center">
            {h}
          </div>
        ))}
      </div>

      {/* One row per staff member */}
      {rows.map((row) => (
        <div key={row.id} className="contents">
          <div className="text-[11px] text-ink text-right pr-2 truncate">
            {row.name}
          </div>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
          >
            {hours.map((h) => {
              const v = row.values[h] ?? 0;
              const count = row.raw?.[h] ?? 0;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => onCellClick?.(row.id, h)}
                  disabled={!onCellClick}
                  className="h-7 border border-line transition hover:brightness-125"
                  style={{
                    background: v > 0 ? `rgba(${baseRGB}, ${v * opacityScale})` : "transparent",
                    boxShadow:
                      v > 0
                        ? `inset 0 0 10px rgba(${baseRGB}, ${v * glowScale})`
                        : "none",
                    cursor: onCellClick ? "pointer" : "default",
                  }}
                  title={`${row.name} · ${h}:00 · ${count} ${count === 1 ? "break" : "breaks"} observed`}
                  aria-label={`${row.name} ${h}:00 · ${count} breaks`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Legend strip — drop below the heatmap when you want to explain the colour scale.
 */
export function HeatmapLegend({ variant = "gold" }) {
  const baseRGB = variant === "sage" ? "127, 163, 127" : "201, 168, 106";
  return (
    <div className="flex items-center justify-center gap-3 text-[10px] text-ink-mute">
      <span>Break frequency</span>
      <div className="flex gap-px border border-line">
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
          <div
            key={v}
            className="w-6 h-3"
            style={{ background: `rgba(${baseRGB}, ${v * 0.65})` }}
          />
        ))}
      </div>
      <span className="font-mono">low → high</span>
    </div>
  );
}
