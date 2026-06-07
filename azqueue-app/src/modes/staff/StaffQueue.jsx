import { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { useStaffMembership } from "../../hooks/useStaffMembership";
import { logServiceTime } from "../../lib/autopilot";
import { sendCallNotice, sendThanks } from "../../lib/notifications";
import { fetchPrayerTimes, getPauseStatus } from "../../lib/prayerTimes";
import Button from "../../components/Button";
import Card from "../../components/Card";

/**
 * StaffQueue — the core serving/idle panel for a staff member.
 *
 * Three states:
 *   · idle    — no current customer; "Pull next customer" or "Take a break"
 *   · serving — customer assigned; Complete / Skip / Pass / Park
 *   · break   — calm overlay with elapsed time + Back to it
 */
export default function StaffQueue() {
  const { user, signOut } = useAuth();
  const { primary, loading: membershipLoading } = useStaffMembership();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [prayerTimes, setPrayerTimes] = useState(null);

  // Tick clock every 30s for elapsed time + prayer pause check
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Load prayer times for the branch
  useEffect(() => {
    const branch = primary?.branches;
    if (!branch?.lat || !branch?.lng) return;
    let cancelled = false;
    (async () => {
      const t = await fetchPrayerTimes({ lat: branch.lat, lng: branch.lng });
      if (!cancelled) setPrayerTimes(t);
    })();
    return () => { cancelled = true; };
  }, [primary?.branches?.lat, primary?.branches?.lng]);

  // Pull queue + my own current customer
  const reload = useCallback(async () => {
    if (!primary?.branch_id) return;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [{ data: tk }, { data: stf }, { count: doneCount }] = await Promise.all([
      supabase.from("tickets")
        .select("id, token, status, customer_name, customer_phone, service_id, staff_id, priority, source, created_at, called_at, started_at, completed_at, branch_id, notes")
        .eq("branch_id", primary.branch_id)
        .in("status", ["waiting", "serving"])
        .gte("created_at", todayStart.toISOString()),
      supabase.from("staff")
        .select("id, display_name, role, status")
        .eq("branch_id", primary.branch_id)
        .order("display_name"),
      supabase.from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", primary.branch_id)
        .eq("staff_id", primary.id)
        .eq("status", "completed")
        .gte("created_at", todayStart.toISOString()),
    ]);

    setTickets(tk ?? []);
    setStaffList((stf ?? []).filter((s) => s.id !== primary.id));
    setCompletedToday(doneCount ?? 0);
  }, [primary?.branch_id, primary?.id]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime so other staff/owner actions update us
  useEffect(() => {
    if (!primary?.branch_id) return;
    const ch = supabase
      .channel(`staff-queue-${primary.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `branch_id=eq.${primary.branch_id}` },
        () => reload()
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "staff", filter: `branch_id=eq.${primary.branch_id}` },
        () => reload()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [primary?.branch_id, primary?.id, reload]);

  // Derived state
  const myCurrent = useMemo(
    () => tickets.find((t) => t.status === "serving" && t.staff_id === primary?.id),
    [tickets, primary?.id]
  );

  const myUpNext = useMemo(() => {
    return tickets
      .filter((t) => t.status === "waiting" && (t.staff_id === primary?.id || t.staff_id == null))
      .sort((a, b) => {
        const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
        if (pDiff !== 0) return pDiff;
        return new Date(a.created_at) - new Date(b.created_at);
      });
  }, [tickets, primary?.id]);

  const pauseStatus = useMemo(
    () => prayerTimes ? getPauseStatus(prayerTimes, {}, now) : null,
    [prayerTimes, now]
  );

  const myStatus = primary?.status ?? "off";

  async function setStatus(newStatus) {
    if (!primary?.id) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from("staff").update({ status: newStatus }).eq("id", primary.id);
    setBusy(false);
    if (e) return setError(e.message);
  }

  async function pullNext() {
    if (myUpNext.length === 0) return;
    setBusy(true);
    setError(null);
    const next = myUpNext[0];
    const ts = new Date().toISOString();
    const { error: e } = await supabase.from("tickets").update({
      status: "serving", staff_id: primary.id, called_at: ts, started_at: ts,
    }).eq("id", next.id);
    if (e) { setBusy(false); return setError(e.message); }
    sendCallNotice(next.id);
    if (myStatus !== "serving") await setStatus("serving");
    await reload();
    setBusy(false);
  }

  async function complete() {
    if (!myCurrent) return;
    setBusy(true);
    setError(null);
    const ts = new Date().toISOString();
    const { error: e } = await supabase.from("tickets")
      .update({ status: "completed", completed_at: ts }).eq("id", myCurrent.id);
    if (e) { setBusy(false); return setError(e.message); }
    logServiceTime({ branchId: myCurrent.branch_id, ticketId: myCurrent.id, serviceId: myCurrent.service_id, staffId: myCurrent.staff_id, startedAt: myCurrent.started_at, completedAt: ts });
    sendThanks(myCurrent.id);
    await setStatus("active");
    await reload();
    setBusy(false);
  }

  async function skip() {
    if (!myCurrent) return;
    setBusy(true);
    const { error: e } = await supabase.from("tickets")
      .update({ status: "no_show", completed_at: new Date().toISOString() }).eq("id", myCurrent.id);
    if (e) { setBusy(false); return setError(e.message); }
    await setStatus("active");
    await reload();
    setBusy(false);
  }

  async function passTo(staffId) {
    if (!myCurrent) return;
    setBusy(true);
    const { error: e } = await supabase.from("tickets").update({ staff_id: staffId }).eq("id", myCurrent.id);
    if (e) { setBusy(false); return setError(e.message); }
    await setStatus("active");
    await reload();
    setBusy(false);
  }

  async function sendBack() {
    if (!myCurrent) return;
    setBusy(true);
    const { error: e } = await supabase.from("tickets").update({
      status: "waiting", called_at: null, started_at: null,
      priority: (myCurrent.priority ?? 0) + 1,
    }).eq("id", myCurrent.id);
    if (e) { setBusy(false); return setError(e.message); }
    await setStatus("active");
    await reload();
    setBusy(false);
  }

  async function escalateNext() {
    const target = myUpNext[0];
    if (!target) return;
    setBusy(true);
    const maxP = myUpNext.reduce((m, t) => Math.max(m, t.priority ?? 0), 0);
    const { error: e } = await supabase.from("tickets").update({ priority: maxP + 10 }).eq("id", target.id);
    if (e) { setBusy(false); return setError(e.message); }
    await reload();
    setBusy(false);
  }

  async function endShift() {
    await setStatus("off");
    await signOut();
    navigate("/login");
  }

  // ── Render guards ─────────────────────────────────────────────
  if (membershipLoading) {
    return <div className="flex-1 flex items-center justify-center py-20 ovline text-ink-mute">Loading…</div>;
  }
  if (!primary) {
    return <Navigate to="/business" replace />;
  }

  const branch = primary.branches;
  const elapsed = myCurrent?.started_at
    ? Math.floor((now - new Date(myCurrent.started_at)) / 1000)
    : 0;

  // ── Clock-in screen — shown when staff haven't started their shift ──
  if (myStatus === "off") {
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return (
      <div className="atmosphere-hero min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="relative corner-marks luxe-panel border border-line p-10 max-w-sm w-full text-center">
          <span className="cm cm-tl" /><span className="cm cm-tr" /><span className="cm cm-bl" /><span className="cm cm-br" />

          <div className="ovline text-[9px] text-ink-mute mb-6 tracking-widest">
            {branch?.name ?? "Az Tax Services"}
          </div>

          <div className="font-display text-5xl font-light gold-text mb-1">{timeStr}</div>
          <div className="text-[11px] text-ink-mute mb-8">
            {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </div>

          <div className="rule-ornament mb-8 text-[8px]"><span>·</span></div>

          <h2 className="font-display text-2xl font-light tracking-tightest text-ink mb-2">
            Ready to start?
          </h2>
          <p className="text-ink-mute text-sm mb-8 leading-relaxed">
            Starting your shift makes you visible to customers choosing who to see.
          </p>

          <Button
            onClick={() => setStatus("active")}
            disabled={busy}
            size="lg"
            className="w-full"
          >
            {busy ? "Starting…" : "Start shift →"}
          </Button>

          {error && (
            <p className="text-[11px] text-[#d49185] mt-3">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Break overlay
  if (myStatus === "on_break") {
    const since = primary.status_since
      ? Math.floor((now - new Date(primary.status_since)) / 60000)
      : 0;
    return (
      <div className="atmosphere-hero atmosphere-prayer min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <Card luxe variant="sage" className="p-12 max-w-md text-center">
          <div className="ovline mb-3 text-[#9bbd9b] flex items-center justify-center gap-2">
            <span className="pip breathe" /> On break
          </div>
          <h1 className="font-display text-4xl font-light tracking-tightest mb-3">
            Enjoying your <em className="not-italic gold-text-soft">moment.</em>
          </h1>
          <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
          <div className="font-mono text-ink-soft text-2xl">{since} min</div>
          <div className="text-[10px] text-ink-mute tracking-wide mt-2">since you stepped away</div>
          <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
          <Button onClick={() => setStatus("active")} disabled={busy} size="lg" className="w-full">
            Back to it →
          </Button>
          <div className="text-[10px] text-ink-mute mt-4 leading-relaxed">
            Your manager sees only that you're on break. Take what you need.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 atmosphere-hero">
      {error && (
        <div className="mx-6 mt-4 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
          {error}
        </div>
      )}

      {pauseStatus?.state === "paused" && (
        <div className="mx-6 mt-4 px-5 py-3 border border-[#506b50] bg-[rgba(80,107,80,0.10)] text-center">
          <span className="ovline text-[#9bbd9b]">Paused for {pauseStatus.prayer}</span>
          <span className="text-[10px] text-ink-mute ml-3">
            queue resumes in {Math.round(pauseStatus.msLeft / 60000)} min
          </span>
        </div>
      )}

      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">
          {myCurrent ? (
            <ServingPanel
              ticket={myCurrent}
              elapsed={elapsed}
              staffList={staffList}
              onComplete={complete}
              onSkip={skip}
              onPass={passTo}
              onSendBack={sendBack}
              disabled={busy}
            />
          ) : (
            <IdlePanel
              upNext={myUpNext}
              onPull={pullNext}
              onBreak={() => setStatus("on_break")}
              onEndShift={endShift}
              onEscalate={escalateNext}
              disabled={busy || pauseStatus?.state === "paused"}
              completedToday={completedToday}
              status={myStatus}
              setStatus={setStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Serving panel ────────────────────────────────────────────── */
function ServingPanel({ ticket, elapsed, staffList, onComplete, onSkip, onPass, onSendBack, disabled }) {
  const [passOpen, setPassOpen] = useState(false);
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  return (
    <div className="relative corner-marks luxe-panel border border-line p-10">
      <span className="cm cm-tl" /><span className="cm cm-tr" /><span className="cm cm-bl" /><span className="cm cm-br" />

      <div className="flex items-center justify-between mb-6">
        <span className="ovline text-gold-soft flex items-center">
          <span className="pip breathe mr-1.5" /> Now serving
        </span>
        <span className="text-[10px] text-ink-mute font-mono">
          {String(elapsedMin).padStart(2, "0")}:{String(elapsedSec).padStart(2, "0")}
        </span>
      </div>

      <div className="text-center mb-6">
        <div className="gold-text font-display text-9xl font-light tracking-tightest leading-none">
          {ticket.token}
        </div>
        <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
        <div className="text-2xl text-ink mb-1">{ticket.customer_name}</div>
        <div className="text-xs text-ink-mute tracking-wide">{ticket.customer_phone}</div>
      </div>

      <Button onClick={onComplete} disabled={disabled} size="lg" className="w-full mb-2">
        Complete →
      </Button>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" onClick={onSendBack} disabled={disabled} className="w-full">Park</Button>
        <Button variant="ghost" onClick={onSkip} disabled={disabled} className="w-full">Skip</Button>
        <div className="relative">
          <Button
            variant="ghost"
            onClick={() => setPassOpen((o) => !o)}
            disabled={disabled || staffList.length === 0}
            className="w-full"
          >
            Pass to ▾
          </Button>
          {passOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPassOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 luxe-panel border border-line shadow-lg z-50">
                <div className="ovline text-[8px] px-4 pt-3 pb-1">Pass to teammate</div>
                {staffList.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onPass(s.id); setPassOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-surface-2 transition"
                  >
                    <div>{s.display_name}</div>
                    <div className="text-[9px] text-ink-mute mt-0.5">{s.role} · {s.status ?? "off"}</div>
                  </button>
                ))}
                {staffList.length === 0 && (
                  <div className="px-4 py-3 text-[10px] text-ink-mute italic">Nobody else on shift.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Idle panel ───────────────────────────────────────────────── */
function IdlePanel({ upNext, onPull, onBreak, onEndShift, onEscalate, disabled, completedToday, status, setStatus }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 mb-1">
        {[
          { id: "active",   label: "Ready",    color: "border-[#506b50] text-[#9bbd9b]", action: () => setStatus("active") },
          { id: "on_break", label: "On break", color: "border-line text-ink-mute",        action: () => onBreak() },
        ].map((s) => {
          const active = status === s.id;
          return (
            <button
              key={s.id}
              onClick={s.action}
              disabled={disabled}
              className={`px-3 py-1.5 border text-[10px] tracking-[0.18em] uppercase transition ${
                active
                  ? "bg-[rgba(201,168,106,0.06)] border-gold-deep text-gold"
                  : `${s.color} hover:border-gold-deep`
              }`}
            >
              {active && <span className="pip breathe mr-1.5 inline-block" />}
              {s.label}
            </button>
          );
        })}
        <button
          onClick={onEndShift}
          disabled={disabled}
          className="px-3 py-1.5 border border-line text-[10px] tracking-[0.18em] uppercase transition text-ink-mute hover:border-[#b56b5f]/60 hover:text-[#d49185]"
        >
          End shift
        </button>
      </div>

      <div className="relative corner-marks luxe-panel border border-line p-10 text-center">
        <span className="cm cm-tl" /><span className="cm cm-tr" /><span className="cm cm-bl" /><span className="cm cm-br" />

        {upNext.length === 0 ? (
          <>
            <div className="ovline mb-3 text-gold-soft">Queue is calm</div>
            <h1 className="font-display text-3xl font-light tracking-tightest mb-3">
              No one is <em className="not-italic gold-text-soft">waiting.</em>
            </h1>
            <p className="text-ink-soft text-sm">When a customer checks in, they'll appear here.</p>
            <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
            <Button variant="ghost" onClick={onBreak} disabled={disabled}>Take a break</Button>
          </>
        ) : (
          <>
            <div className="ovline mb-3 text-gold-soft">Next up for me</div>
            <div className="gold-text font-display text-7xl font-light tracking-tightest leading-none">
              {upNext[0].token}
            </div>
            <div className="text-base text-ink mt-3">{upNext[0].customer_name}</div>
            <div className="text-[11px] text-ink-mute mt-1">
              {upNext[0].source === "book" ? "Booking" : "Walk-in"}
              {(upNext[0].priority ?? 0) > 0 && <span className="text-gold-soft ml-2">★ priority</span>}
            </div>
            <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
            <Button onClick={onPull} disabled={disabled} size="lg" className="w-full mb-2">
              Call them →
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={onEscalate} disabled={disabled || (upNext[0]?.priority ?? 0) > 0} className="w-full">
                {(upNext[0]?.priority ?? 0) > 0 ? "★ priority set" : "Escalate"}
              </Button>
              <Button variant="ghost" onClick={onBreak} disabled={disabled} className="w-full">
                Take a break
              </Button>
            </div>
            {upNext.length > 1 && (
              <div className="mt-6 pt-5 border-t border-line">
                <div className="ovline text-[9px] mb-3 text-ink-mute">Then</div>
                <div className="space-y-2">
                  {upNext.slice(1, 4).map((t) => (
                    <div key={t.id} className="grid grid-cols-[60px_1fr_auto] gap-3 items-center text-left">
                      <span className="font-display text-gold-soft text-sm">{t.token}</span>
                      <span className="text-xs text-ink-soft truncate">{t.customer_name}</span>
                      <span className="text-[9px] text-ink-mute uppercase tracking-[0.18em]">
                        {t.source === "book" ? "Book" : "Walk"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">Served · today</div>
          <div className="font-display text-base mt-1 gold-text-soft">{completedToday}</div>
        </div>
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">Queue ahead</div>
          <div className="font-display text-base mt-1 gold-text-soft">{upNext.length}</div>
        </div>
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">Status</div>
          <div className="font-display text-base mt-1 capitalize gold-text-soft">
            {status === "on_break" ? "Break" : status}
          </div>
        </div>
      </div>
    </div>
  );
}
ext[0]?.priority ?? 0) > 0 ? "★ priority set" : "Escalate"}
              </Button>
              <Button variant="ghost" onClick={onBreak} disabled={disabled} className="w-full">
                Take a break
              </Button>
            </div>
            {upNext.length > 1 && (
              <div className="mt-6 pt-5 border-t border-line">
                <div className="ovline text-[9px] mb-3 text-ink-mute">Then</div>
                <div className="space-y-2">
                  {upNext.slice(1, 4).map((t) => (
                    <div key={t.id} className="grid grid-cols-[60px_1fr_auto] gap-3 items-center text-left">
                      <span className="font-display text-gold-soft text-sm">{t.token}</span>
                      <span className="text-xs text-ink-soft truncate">{t.customer_name}</span>
                      <span className="text-[9px] text-ink-mute uppercase tracking-[0.18em]">
                        {t.source === "book" ? "Book" : "Walk"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">Served · today</div>
          <div className="font-display text-base mt-1 gold-text-soft">{completedToday}</div>
        </div>
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">Queue ahead</div>
          <div className="font-display text-base mt-1 gold-text-soft">{upNext.length}</div>
        </div>
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">Status</div>
          <div className="font-display text-base mt-1 capitalize gold-text-soft">
            {status === "on_break" ? "Break" : status}
          </div>
        </div>
      </div>
    </div>
  );
}
