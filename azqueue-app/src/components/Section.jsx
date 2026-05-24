export default function Section({ overline, title, subtitle, className = "", children }) {
  return (
    <section className={className}>
      {overline && <div className="ovline mb-3">{overline}</div>}
      {title && (
        <h2 className="font-display text-2xl sm:text-3xl font-light tracking-tighter mb-2">
          {title}
        </h2>
      )}
      {subtitle && <p className="text-ink-soft text-sm mb-6 max-w-xl">{subtitle}</p>}
      {children}
    </section>
  );
}
