const variants = {
  walk: "bg-[rgba(201,168,106,0.08)] text-gold-soft",
  book: "bg-[rgba(52,152,219,0.1)] text-[#74b9e8] border border-[rgba(52,152,219,0.2)]",
  conf: "bg-[rgba(127,163,127,0.1)] text-[#9bbd9b] border border-[rgba(127,163,127,0.2)]",
  done: "bg-white/[0.04] text-ink-soft border border-line",
  due:  "bg-[rgba(181,107,95,0.1)] text-[#d49185] border border-[rgba(181,107,95,0.2)]",
};

export default function Badge({ variant = "walk", children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[9px] tracking-[0.1em] uppercase font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
