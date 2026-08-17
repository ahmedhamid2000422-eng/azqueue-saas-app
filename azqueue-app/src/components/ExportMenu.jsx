import { useEffect, useRef, useState } from "react";
import Button from "./Button";

/**
 * ExportMenu — one "Export ▾" button offering CSV or Excel.
 *
 * Both handlers receive no arguments and may be async; the menu shows a
 * working state while an export runs and surfaces failures via onError.
 *
 *   <ExportMenu
 *     onCsv={() => exportBookings(bookings, services, branch, "csv")}
 *     onXlsx={() => exportBookings(bookings, services, branch, "xlsx")}
 *     disabled={bookings.length === 0}
 *     onError={(e) => setError(e.message)}
 *   />
 */
export default function ExportMenu({ onCsv, onXlsx, disabled, onError, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey  = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(fn, label) {
    setOpen(false);
    if (!fn) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(`[ExportMenu] ${label} export failed`, err);
      onError?.(err instanceof Error ? err : new Error(`Could not export ${label}.`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <Button
        variant="ghost"
        size={size}
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? "Exporting…" : "Export ▾"}
      </Button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-[168px] border border-line bg-bg-elev shadow-xl">
          <button
            type="button"
            onClick={() => run(onXlsx, "Excel")}
            className="block w-full px-4 py-2.5 text-left text-[12px] text-ink-soft hover:bg-[rgba(201,168,106,0.08)] hover:text-ink transition"
          >
            Excel <span className="text-ink-mute">(.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => run(onCsv, "CSV")}
            className="block w-full border-t border-line px-4 py-2.5 text-left text-[12px] text-ink-soft hover:bg-[rgba(201,168,106,0.08)] hover:text-ink transition"
          >
            CSV <span className="text-ink-mute">(.csv)</span>
          </button>
        </div>
      )}
    </div>
  );
}
