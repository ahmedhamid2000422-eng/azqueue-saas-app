/**
 * ComingSoon — the honest placeholder.
 *
 * Used for pages that exist in the navigation but aren't finished. The point
 * is to say plainly what the page will do and what it needs first, rather
 * than showing a half-built screen that makes people wonder whether they've
 * broken something or configured it wrong.
 *
 * If a page can already do something partial, don't use this — show the part
 * that works. This is for genuinely not-yet.
 */
export default function ComingSoon({ title, summary, points = [], needs }) {
  return (
    <div className="p-8 max-w-xl">
      <header className="mb-5">
        <div className="flex items-center gap-2.5 mb-2">
          <h1 className="font-display text-3xl font-light tracking-tightest">{title}</h1>
          <span className="text-[8px] ovline border border-line text-ink-mute px-1.5 py-px tracking-wider">
            Soon
          </span>
        </div>
        <p className="text-ink-soft text-[13px] leading-relaxed">{summary}</p>
      </header>

      {points.length > 0 && (
        <div className="border border-line mb-5">
          <div className="px-4 py-2.5 border-b border-line ovline text-[8px] text-ink-mute">
            What it will do
          </div>
          {points.map((p) => (
            <div key={p} className="px-4 py-2.5 border-b border-line last:border-b-0 flex gap-2.5">
              <span className="text-gold-soft text-[10px] leading-5 shrink-0">—</span>
              <span className="text-[12px] text-ink-soft leading-relaxed">{p}</span>
            </div>
          ))}
        </div>
      )}

      {needs && (
        <p className="text-[11px] text-ink-mute leading-relaxed border-l border-gold-deep/50 pl-3">
          {needs}
        </p>
      )}
    </div>
  );
}
