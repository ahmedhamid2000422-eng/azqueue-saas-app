import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

/**
 * SetupChecklist — persistent "what's left to set up" card on the Queue page.
 *
 * Tracks six setup milestones, computed live from the actual database:
 *   1. Branch created             — branch row exists
 *   2. Services added             — at least one active service
 *   3. Location set               — branch has lat/lng (so prayer times work)
 *   4. First customer checked in  — at least one ticket exists
 *   5. TV display URL opened      — owner clicked "Set up display"
 *   6. Staff invited              — at least one staff row in the branch
 *
 * Auto-collapses when complete. Dismissable per-branch via localStorage.
 */
export default function SetupChecklist({ branch }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ services: 0, tickets: 0, staff: 0 });
  const [openedDisplay, setOpenedDisplay] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Per-branch localStorage flags
  const dismissKey = `azq.setup.dismissed.${branch?.id}`;
  const displayKey = `azq.setup.displayOpened.${branch?.id}`;

  useEffect(() => {
    if (!branch?.id) return;
    setDismissed(!!localStorage.getItem(dismissKey));
    setOpenedDisplay(!!localStorage.getItem(displayKey));

    let cancelled = false;
    (async () => {
      const [{ count: svcCount }, { count: tCount }, { count: staffCount }] = await Promise.all([
        supabase.from("services").select("id", { count: "exact", head: true }).eq("branch_id", branch.id).eq("active", true),
        supabase.from("tickets") .select("id", { count: "exact", head: true }).eq("branch_id", branch.id),
        supabase.from("staff")   .select("id", { count: "exact", head: true }).eq("branch_id", branch.id),
      ]);
      if (cancelled) return;
      setCounts({ services: svcCount ?? 0, tickets: tCount ?? 0, staff: staffCount ?? 0 });
    })();
    return () => { cancelled = true; };
  }, [branch?.id]);

  if (!branch || dismissed) return null;

  const items = [
    {
      key: "branch",
      label: "Create your branch",
      done: true,
      hint: branch.name,
    },
    {
      key: "services",
      label: "Add services customers can pick",
      done: counts.services > 0,
      hint: counts.services > 0 ? `${counts.services} active` : "0 services",
      cta: { label: "Add services →", to: "/business/settings" },
    },
    {
      key: "location",
      label: "Set your location for accurate prayer times",
      done: branch.lat != null && branch.lng != null,
      hint: branch.lat != null ? `${branch.lat.toFixed(3)}, ${branch.lng.toFixed(3)}` : "—",
      cta: { label: "Set location →", to: "/business/settings" },
    },
    {
      key: "tv",
      label: "Set up the TV display",
      done: openedDisplay,
      hint: "On the wall in the lobby",
      cta: {
        label: "Open setup →",
        onClick: () => {
          try { localStorage.setItem(displayKey, "1"); } catch {}
          setOpenedDisplay(true);
          navigate("/business/display");
        },
      },
    },
    {
      key: "ticket",
      label: "Take your first customer",
      done: counts.tickets > 0,
      hint: counts.tickets > 0 ? `${counts.tickets} so far` : "0 tickets",
      cta: { label: "View QR →", to: "/business/display" },
    },
    {
      key: "staff",
      label: "Invite a teammate",
      done: counts.staff > 0,
      hint: counts.staff > 0 ? `${counts.staff} on team` : "Just you",
      cta: { label: "Invite →", to: "/business/settings" },
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;

  function dismiss() {
    try { localStorage.setItem(dismissKey, "1"); } catch {}
    setDismissed(true);
  }

  return (
    <div className="relative corner-marks luxe-panel border border-line mb-6">
      <span className="cm cm-tl" />
      <span className="cm cm-tr" />
      <span className="cm cm-bl" />
      <span className="cm cm-br" />

      <div className="flex items-baseline justify-between p-5 border-b border-line">
        <div>
          <div className="ovline text-gold-soft mb-1">
            {allDone ? "Setup complete" : `Setup · ${doneCount} of ${total} done`}
          </div>
          <h3 className="font-display text-xl font-light tracking-tighter">
            {allDone
              ? <>You're <em className="not-italic gold-text-soft">live.</em></>
              : <>Finish setting up <em className="not-italic gold-text-soft">{branch.name}.</em></>}
          </h3>
        </div>
        <button
          onClick={dismiss}
          className="text-[10px] tracking-[0.18em] uppercase text-ink-mute hover:text-ink"
        >
          {allDone ? "Hide" : "Skip"}
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="h-1 bg-line overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold-deep to-gold transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="p-5 grid md:grid-cols-2 gap-3">
        {items.map((it) => (
          <div
            key={it.key}
            className={`grid grid-cols-[20px_1fr_auto] gap-3 items-center px-3 py-3 border ${
              it.done ? "border-[#506b50] bg-[rgba(80,107,80,0.04)]" : "border-line"
            }`}
          >
            <span className={`w-4 h-4 flex items-center justify-center text-[10px] ${
              it.done ? "bg-[#506b50] text-[#0b0b0c]" : "border border-line-2 text-transparent"
            }`}>✓</span>
            <div className="min-w-0">
              <div className={`text-sm ${it.done ? "text-ink-mute line-through" : "text-ink"}`}>{it.label}</div>
              <div className="text-[10px] text-ink-mute mt-0.5 truncate">{it.hint}</div>
            </div>
            {!it.done && it.cta && (
              <CtaLink {...it.cta} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaLink({ label, to, onClick }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={onClick ?? (() => navigate(to))}
      className="text-[10px] tracking-[0.18em] uppercase text-gold-soft hover:text-gold whitespace-nowrap"
    >
      {label}
    </button>
  );
}
