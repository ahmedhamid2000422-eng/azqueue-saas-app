import { useEffect, useState } from "react";

/**
 * LiveTicker — cycles through a list of values (e.g. queue tokens), one at a time,
 * with a graceful drift-up animation between values. Gives marketing dashboards
 * the feeling of a real, ticking, live system without server data.
 */
export default function LiveTicker({
  values,
  intervalMs = 4500,
  className = "",
  textClass = "gold-text font-display text-7xl font-light tracking-tightest leading-none",
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % values.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [values.length, intervalMs]);

  return (
    <div className={`relative ${className}`}>
      <div key={idx} className={`drift-up ${textClass}`}>
        {values[idx]}
      </div>
    </div>
  );
}

/**
 * CountUp — slowly increments a number toward a target. Used for "Served" / "Today"
 * style stats, so panels feel alive even when idle.
 */
export function CountUp({ to, start = 0, durationMs = 1800, className = "" }) {
  const [n, setN] = useState(start);
  useEffect(() => {
    const startTime = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(start + (to - start) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, start, durationMs]);
  return <span className={className}>{n}</span>;
}
