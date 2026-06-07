import { useState } from "react";
import { useCheckin } from "../hooks/useCheckin";

/**
 * Checkin — public customer check-in page.
 * Route: /checkin/:branchId
 *
 * Three screens shown one at a time:
 *   1. Service picker  →  Staff picker (optional)
 *   2. Name + phone form
 *   3. Confirmation (token + position)
 */
export default function Checkin() {
  const {
    branch,
    services,
    staffMembers,
    loading,
    submitting,
    error,
    submitted,
    token,
    position,
    submit,
  } = useCheckin();

  const [screen,           setScreen]           = useState(1); // 1 | 2 | 3
  const [serviceId,        setServiceId]        = useState(null);
  const [preferredStaffId, setPreferredStaffId] = useState(null); // null = anyone
  const [name,             setName]             = useState("");
  const [phone,            setPhone]            = useState("");

  const selectedService = services.find((s) => s.id === serviceId);
  const preferredStaff  = staffMembers.find((s) => s.id === preferredStaffId) ?? null;
  const isSeniorPick    = !!preferredStaff?.is_senior_advisor;

  /* ── Handle form submit ───────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !serviceId) return;
    await submit(name, phone, serviceId, preferredStaffId);
  }

  // Move to screen 3 when submission succeeds
  if (submitted && screen !== 3) setScreen(3);

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="ovline text-ink-mute text-[11px] tracking-widest">Loading…</div>
        </div>
      </Shell>
    );
  }

  /* ── Branch not found ─────────────────────────────────────── */
  if (!branch) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-screen px-6">
          <div className="text-center max-w-sm">
            <div className="font-display text-2xl font-light text-ink mb-3">Branch not found</div>
            <p className="text-ink-soft text-sm">
              {error ?? "Please check the QR code and try again."}
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  /* ── Screen 1: Service + Staff picker ────────────────────── */
  if (screen === 1) {
    return (
      <Shell>
        <div className="min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">

            {/* Branch logo + name */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-9 h-9 bg-gold rounded-sm mb-5 shadow-[0_0_24px_rgba(201,168,106,0.3)]">
                <span className="font-display text-[#141410] text-sm font-semibold">A</span>
              </div>
              <h1 className="font-display text-3xl font-light tracking-tightest gold-text mb-2">
                {branch.name}
              </h1>
              <p className="text-ink-soft text-sm">What brings you in today?</p>
            </div>

            {/* ── Service grid ─────────────────────────────── */}
            {services.length === 0 ? (
              <div className="text-center text-ink-mute text-sm py-8">
                No services available right now.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-8">
                {services.map((svc) => {
                  const selected = serviceId === svc.id;
                  return (
                    <button
                      key={svc.id}
                      onClick={() => setServiceId(svc.id)}
                      className={`p-4 border text-left transition ${
                        selected
                          ? "border-gold bg-[rgba(201,168,106,0.08)] text-gold-soft"
                          : "border-line text-ink-soft hover:border-[#3a3a3f] hover:text-ink"
                      }`}
                    >
                      <div className="font-display text-base font-light leading-snug">
                        {svc.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Staff picker — shown once a service is chosen ── */}
            {serviceId && staffMembers.length > 0 && (
              <div className="mb-8">
                <div className="ovline text-[9px] text-ink-mute mb-3">
                  Who would you like to see?
                </div>

                {/* "Next available" option */}
                <button
                  onClick={() => setPreferredStaffId(null)}
                  className={`w-full p-3.5 border text-left transition mb-2 flex items-center gap-3 ${
                    preferredStaffId === null
                      ? "border-gold bg-[rgba(201,168,106,0.08)]"
                      : "border-line hover:border-[#3a3a3f]"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                    preferredStaffId === null ? "border-gold bg-gold" : "border-line"
                  }`}>
                    {preferredStaffId === null && (
                      <span className="text-[#141410] text-[10px] font-bold">✓</span>
                    )}
                  </div>
                  <div>
                    <div className={`font-display text-sm font-light ${
                      preferredStaffId === null ? "text-gold-soft" : "text-ink"
                    }`}>
                      Next available
                    </div>
                    <div className="text-[10px] text-ink-mute mt-0.5">
                      Fastest option — whoever's free first
                    </div>
                  </div>
                </button>

                {/* Individual staff cards */}
                {staffMembers.map((s) => {
                  const picked = preferredStaffId === s.id;
                  const statusLabel = s.status === "serving"
                    ? "With client"
                    : s.status === "on_break"
                    ? "On break"
                    : "Available";
                  const statusColor = s.status === "serving"
                    ? "text-gold-soft"
                    : s.status === "on_break"
                    ? "text-[#74b9e8]"
                    : "text-[#9bbd9b]";
                  const waitLabel = s.estWait === 0 ? "Ready now" : `~${s.estWait} min wait`;

                  return (
                    <button
                      key={s.id}
                      onClick={() => setPreferredStaffId(picked ? null : s.id)}
                      className={`w-full p-3.5 border text-left transition mb-2 flex items-center gap-3 ${
                        picked
                          ? "border-gold bg-[rgba(201,168,106,0.08)]"
                          : "border-line hover:border-[#3a3a3f]"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                        picked ? "border-gold bg-gold" : "border-line"
                      }`}>
                        {picked && (
                          <span className="text-[#141410] text-[10px] font-bold">✓</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-display text-sm font-light ${
                            picked ? "text-gold-soft" : "text-ink"
                          }`}>
                            {s.display_name}
                          </span>
                          {s.is_senior_advisor && (
                            <span className="text-[9px] text-gold-soft border border-gold/40 px-1 shrink-0">
                              ⭐ Senior
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
                          <span className="text-ink-mute text-[10px]">·</span>
                          <span className="text-[10px] text-ink-mute">{waitLabel}</span>
                          {s.is_senior_advisor && (
                            <>
                              <span className="text-ink-mute text-[10px]">·</span>
                              <span className="text-[10px] text-gold-soft">
                                +${s.advisor_fee ?? 50} at counter
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Next button */}
            <button
              onClick={() => setScreen(2)}
              disabled={!serviceId}
              className="w-full py-3.5 bg-gold text-[#141410] font-medium text-sm tracking-wide disabled:opacity-30 transition hover:opacity-90"
            >
              Next →
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ── Screen 2: Name + phone ───────────────────────────────── */
  if (screen === 2) {
    return (
      <Shell>
        <div className="min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">

            {/* Back */}
            <button
              onClick={() => setScreen(1)}
              className="flex items-center gap-2 text-ink-mute text-xs mb-10 hover:text-ink transition"
            >
              ← Back
            </button>

            <div className="mb-8">
              <h2 className="font-display text-2xl font-light tracking-tightest text-ink mb-1">
                Your details
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-ink-mute text-xs">{selectedService?.name}</p>
                {preferredStaff && (
                  <>
                    <span className="text-ink-mute text-xs">·</span>
                    <p className="text-xs text-gold-soft">{preferredStaff.display_name}</p>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="ovline text-[9px] text-ink-mute block mb-2">
                  Your name <span className="text-gold-soft">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  required
                  autoFocus
                  className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none px-4 py-3 text-sm text-ink placeholder:text-ink-mute transition"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="ovline text-[9px] text-ink-mute block mb-2">
                  Phone number
                  <span className="text-ink-mute font-normal normal-case ml-2 tracking-normal">
                    — for SMS updates
                  </span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none px-4 py-3 text-sm text-ink placeholder:text-ink-mute transition"
                />
              </div>

              {/* Senior advisor fee notice */}
              {isSeniorPick && (
                <div className="border border-gold/30 bg-[rgba(201,168,106,0.06)] px-4 py-3">
                  <div className="text-[11px] text-gold-soft font-medium mb-0.5">
                    ⭐ Senior Advisor — {preferredStaff.display_name}
                  </div>
                  <div className="text-[10px] text-ink-mute">
                    An additional ${preferredStaff.advisor_fee ?? 50} consultation fee applies — payable at the counter after your session.
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="text-[11px] text-[#d49185] border border-[#b56b5f]/30 bg-[#b56b5f]/08 px-3 py-2">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!name.trim() || submitting}
                className="w-full py-3.5 bg-gold text-[#141410] font-medium text-sm tracking-wide disabled:opacity-30 transition hover:opacity-90 mt-2"
              >
                {submitting ? "Joining queue…" : "Join queue →"}
              </button>
            </form>
          </div>
        </div>
      </Shell>
    );
  }

  /* ── Screen 3: Confirmation ───────────────────────────────── */
  const estWait = Math.max(1, position ?? 0) * 10;

  return (
    <Shell>
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">

          {/* Token */}
          <div
            className="font-display font-light gold-text leading-none mb-6"
            style={{ fontSize: 120 }}
          >
            {token}
          </div>

          {/* Staff preference badge */}
          {preferredStaff && (
            <div className="inline-flex items-center gap-2 border border-gold/40 bg-[rgba(201,168,106,0.08)] px-3 py-1.5 mb-4">
              {isSeniorPick && <span className="text-gold-soft text-xs">⭐</span>}
              <span className="text-gold-soft text-xs font-medium">{preferredStaff.display_name}</span>
              {isSeniorPick && (
                <span className="text-ink-mute text-[10px]">+${preferredStaff.advisor_fee ?? 50} at counter</span>
              )}
            </div>
          )}

          {/* Position + wait */}
          <div className="text-ink text-lg mb-1">
            You are number <span className="text-gold-soft font-medium">{(position ?? 0) + 1}</span> in line
          </div>
          <div className="text-ink-soft text-sm mb-5">
            Estimated wait: <span className="text-ink">{estWait} min</span>
          </div>

          {/* Service name */}
          <div className="ovline text-[9px] text-ink-mute mb-8">
            {selectedService?.name ?? ""}
          </div>

          {/* Divider */}
          <div className="border-t border-line mb-6" />

          {/* Instructions */}
          <p className="text-ink-soft text-sm mb-3">
            Please take a seat. We will call your name.
          </p>
          <p className="text-ink-mute text-[11px]">
            Need to leave? Show this screen to staff.
          </p>

          {/* Branch name at bottom */}
          <div className="mt-10 flex items-center justify-center gap-2 opacity-40">
            <div className="w-4 h-4 bg-gold rounded-sm flex items-center justify-center">
              <span className="font-display text-[#141410] text-[8px]">A</span>
            </div>
            <span className="font-display text-xs text-ink-mute">{branch.name}</span>
          </div>

        </div>
      </div>
    </Shell>
  );
}

/* ── Shell ────────────────────────────────────────────────────── */
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      {children}
    </div>
  );
}
