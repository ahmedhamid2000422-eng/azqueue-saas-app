import { useState } from "react";
import { useCheckin } from "../hooks/useCheckin";

/**
 * Checkin — public customer check-in page.
 * Route: /checkin/:branchId
 *
 * Three screens shown one at a time:
 *   1. Service picker
 *   2. Name + phone form
 *   3. Confirmation (token + position)
 */
export default function Checkin() {
  const {
    branch,
    services,
    loading,
    submitting,
    error,
    submitted,
    token,
    position,
    submit,
  } = useCheckin();

  const [screen,    setScreen]    = useState(1); // 1 | 2 | 3
  const [serviceId, setServiceId] = useState(null);
  const [name,      setName]      = useState("");
  const [phone,     setPhone]     = useState("");

  const selectedService = services.find((s) => s.id === serviceId);

  /* ── Handle form submit ───────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !serviceId) return;
    await submit(name, phone, serviceId);
    // useCheckin sets submitted=true on success; we watch that below
  }

  // Move to screen 3 when submission succeeds
  if (submitted && screen !== 3) {
    setScreen(3);
  }

  /* ── Loading state ────────────────────────────────────────── */
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

  /* ── Screen 1: Service picker ─────────────────────────────── */
  if (screen === 1) {
    return (
      <Shell>
        <div className="min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Branch name */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-9 h-9 bg-gold rounded-sm mb-5 shadow-[0_0_24px_rgba(201,168,106,0.3)]">
                <span className="font-display text-[#141410] text-sm font-semibold">A</span>
              </div>
              <h1 className="font-display text-3xl font-light tracking-tightest gold-text mb-2">
                {branch.name}
              </h1>
              <p className="text-ink-soft text-sm">What brings you in today?</p>
            </div>

            {/* Service grid */}
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
                      {svc.description && (
                        <div className="text-[10px] text-ink-mute mt-1 leading-relaxed line-clamp-2">
                          {svc.description}
                        </div>
                      )}
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
            {/* Back arrow */}
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
              <p className="text-ink-mute text-xs">
                {selectedService?.name}
              </p>
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
