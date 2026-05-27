/**
 * ShadowSlots.jsx
 *
 * Shadow Slots manager — embedded inside the Schedule page.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Header: title + enable/disable toggle                  │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  Walk-in traffic heatmap (7 days × operating hours)     │
 *   │  • Click a cell to create a shadow slot                 │
 *   │  • Gold border = shadow slot active for that cell       │
 *   │  • Heat colour = historical walk-in volume              │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  Active shadow slots list with remove buttons           │
 *   └─────────────────────────────────────────────────────────┘
 */

import { useEffect, useState, useCallback } from "react";
import { useBranch } from "../../lib/BranchContext";
import {
  fetchShadowSlots,
  fetchWalkinHeatmap,
  addShadowSlot,
  removeShadowSlot,
  setShadowSlotsEnabled,
  normaliseHeatmap,
  hasShadowSlot,
  getShadowSlot,
  DAY_LABELS,
  DAY_FULL,
  fmtHour,
} from "../../lib/shadowSlots";
import Card, { CardHeader } from "../../components/Card";
import Button from "../../components/Button";

// Operating hours shown in the grid (matching get_available_slots defaults)
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

export default function ShadowSlots() {
  const { branch } = useBranch();

  const [slots, setSlots]       = useState([]);
  const [heatmap, setHeatmap]   = useState({});
  const [normMap, setNormMap]   = useState({});
  const [enabled, setEnabled]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false); // for toggle
  const [cellBusy, setCellBusy] = useState(null);  // "dow-hour" string
  const [error, setError]       = useState(null);
  const [hasData, setHasData]   = useState(false);

  const load = useCallback(async () => {
    if (!branch?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [slotData, heatData] = await Promise.all([
        fetchShadowSlots(branch.id),
        fetchWalkinHeatmap(branch.id, 90),
      ]);
      setSlots(slotData);
      setHeatmap(heatData);
      setNormMap(normaliseHeatmap(heatData));
      setEnabled(branch.shadow_slots_enabled ?? false);

      const totalCells = Object.values(heatData).reduce(
        (sum, row) => sum + Object.keys(row).length, 0
      );
      setHasData(totalCells > 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [branch?.id, branch?.shadow_slots_enabled]);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled() {
    setBusy(true);
    try {
      await setShadowSlotsEnabled(branch.id, !enabled);
      setEnabled((v) => !v);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCell(dow, hour) {
    const key = `${dow}-${hour}`;
    const existing = getShadowSlot(slots, dow, hour);
    setCellBusy(key);
    setError(null);
    try {
      if (existing) {
        await removeShadowSlot(existing.id);
        setSlots((prev) => prev.filter((s) => s.id !== existing.id));
      } else {
        const created = await addShadowSlot(branch.id, dow, hour, 60);
        setSlots((prev) => [...prev, created]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCellBusy(null);
    }
  }

  async function handleRemove(slot) {
    setCellBusy(slot.id);
    setError(null);
    try {
      await removeShadowSlot(slot.id);
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setCellBusy(null);
    }
  }

  if (!branch) return null;

  return (
    <Card luxe className="mt-6">
      <CardHeader
        title="Shadow Slots"
        subtitle="Block time windows for walk-in traffic based on historical patterns"
        right={
          <div className="flex items-center gap-3">
            <span className="ovline text-[9px] text-ink-mute">
              {enabled ? "Active — blocking slots online" : "Off — all slots bookable online"}
            </span>
            <button
              onClick={toggleEnabled}
              disabled={busy}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                enabled ? "bg-gold-deep" : "bg-line-2"
              }`}
              aria-label="Toggle shadow slots"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        }
      />

      {error && (
        <div className="mx-5 mb-4 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading heatmap…</div>
      ) : (
        <>
          {/* ── Heatmap ─────────────────────────────────────────────── */}
          <div className="px-5 pb-2">
            <div className="ovline text-[9px] mb-3 flex items-center gap-2">
              Walk-in traffic · last 90 days
              {!hasData && (
                <span className="text-ink-mute normal-case text-[9px] tracking-normal ml-1">
                  · Not enough data yet — check back after a few days of operation
                </span>
              )}
            </div>

            {/* Day headers */}
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `56px repeat(${HOURS.length}, 1fr)` }}
            >
              <div /> {/* empty corner */}
              {HOURS.map((h) => (
                <div key={h} className="text-center ovline text-[8px] pb-1.5 text-ink-mute">
                  {fmtHour(h)}
                </div>
              ))}

              {/* Rows — one per day of week */}
              {DAY_LABELS.map((dayLabel, dow) => (
                <>
                  <div
                    key={`label-${dow}`}
                    className="ovline text-[9px] pr-2 flex items-center justify-end text-ink-soft"
                  >
                    {dayLabel}
                  </div>
                  {HOURS.map((hour) => {
                    const norm       = normMap[dow]?.[hour] ?? 0;
                    const isShadow   = hasShadowSlot(slots, dow, hour);
                    const isBusy     = cellBusy === `${dow}-${hour}`;
                    const count      = heatmap[dow]?.[hour] ?? 0;

                    // Heat colour: transparent → amber tint based on normalised intensity
                    const heatAlpha  = hasData ? Math.round(norm * 100) : 0;
                    const heatBg     = heatAlpha > 0
                      ? `rgba(184,149,90,${(norm * 0.35).toFixed(2)})`
                      : "transparent";

                    return (
                      <button
                        key={`${dow}-${hour}`}
                        onClick={() => handleCell(dow, hour)}
                        disabled={isBusy}
                        title={
                          isShadow
                            ? `${DAY_FULL[dow]} ${fmtHour(hour)} — shadow slot active (click to remove)`
                            : count > 0
                            ? `${DAY_FULL[dow]} ${fmtHour(hour)} — ${count} walk-ins in 90 days (click to block)`
                            : `${DAY_FULL[dow]} ${fmtHour(hour)} — no walk-in data`
                        }
                        className={`
                          relative h-8 border transition-all duration-150
                          ${isShadow
                            ? "border-gold-deep bg-[rgba(184,149,90,0.12)]"
                            : "border-line hover:border-gold-deep/60"
                          }
                          ${isBusy ? "opacity-40 cursor-wait" : "cursor-pointer"}
                        `}
                        style={{ background: isShadow ? undefined : heatBg }}
                      >
                        {isShadow && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-gold-soft"
                            style={{ fontSize: 9 }}
                          >
                            ✦
                          </span>
                        )}
                        {!isShadow && hasData && norm > 0.15 && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-ink-mute"
                            style={{ fontSize: 8 }}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-5 text-[9px] text-ink-mute">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-gold-deep bg-[rgba(184,149,90,0.12)] inline-flex items-center justify-center text-gold-soft" style={{ fontSize: 7 }}>✦</span>
                Shadow slot — hidden from online booking
              </span>
              {hasData && (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 inline-block" style={{ background: "rgba(184,149,90,0.30)" }} />
                  High walk-in volume
                </span>
              )}
              <span className="ml-auto text-ink-mute/60">Click any cell to toggle</span>
            </div>
          </div>

          {/* ── Active slots list ────────────────────────────────────── */}
          {slots.length > 0 && (
            <div className="border-t border-line mt-4 px-5 pt-4 pb-5">
              <div className="ovline text-[9px] mb-3">
                Active shadow slots · {slots.length}
              </div>
              <div className="space-y-px">
                {slots
                  .slice()
                  .sort((a, b) => a.day_of_week - b.day_of_week || a.hour - b.hour)
                  .map((s) => {
                    const endHour = s.hour + Math.floor(s.duration_min / 60);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between bg-bg-elev border border-line px-4 py-2.5"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-gold-soft text-[9px] font-mono w-8">
                            {DAY_LABELS[s.day_of_week]}
                          </span>
                          <span className="text-xs text-ink">
                            {fmtHour(s.hour)}
                            {endHour <= 23 ? ` – ${fmtHour(endHour)}` : ""}
                          </span>
                          <span className="text-[10px] text-ink-mute">
                            {s.duration_min} min window
                          </span>
                          {s.label && (
                            <span className="text-[10px] text-ink-soft italic">{s.label}</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cellBusy === s.id}
                          onClick={() => handleRemove(s)}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {slots.length === 0 && (
            <div className="px-5 pb-5 pt-2 text-[11px] text-ink-mute italic">
              No shadow slots set. Click cells in the heatmap above to block time windows.
            </div>
          )}

          {/* ── How it works callout ─────────────────────────────────── */}
          <div className="border-t border-line px-5 py-4 bg-[rgba(184,149,90,0.02)]">
            <div className="ovline text-[8px] mb-2">How shadow slots work</div>
            <p className="text-[11px] text-ink-mute leading-relaxed max-w-2xl">
              Blocked windows are invisible to customers booking online — those slots simply don't
              appear in the time picker. Walk-in customers who arrive during that window slide
              straight in without pushing back anyone who already booked. Enable the toggle above
              to activate the blocks on your public booking page.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
