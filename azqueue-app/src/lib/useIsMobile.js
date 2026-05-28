import { useEffect, useState } from "react";

/**
 * Returns true when the viewport is ≤ 768px wide.
 * Updates on resize. Used by marketing pages to switch between
 * desktop and mobile layouts without a CSS framework.
 */
export default function useIsMobile(breakpoint = 768) {
  const [mob, setMob] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const handler = () => setMob(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler, { passive: true });
    handler(); // sync on mount
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);

  return mob;
}
