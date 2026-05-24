export default function Button({ variant = "gold", size = "md", className = "", children, ...rest }) {
  const base = "inline-flex items-center justify-center text-[11px] font-medium tracking-[0.08em] uppercase transition hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none";
  const sizes = {
    sm: "px-3 py-1.5 text-[10px]",
    md: "px-5 py-3",
    lg: "px-8 py-4 text-[12px]",
  };
  const variants = {
    gold:  "bg-gold text-[#141410] hover:bg-gold-soft",
    ghost: "bg-transparent text-ink border border-line-2 hover:border-gold-deep hover:text-gold-soft",
    danger:"bg-transparent text-ink border border-line-2 hover:border-bad hover:text-[#d49185]",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
