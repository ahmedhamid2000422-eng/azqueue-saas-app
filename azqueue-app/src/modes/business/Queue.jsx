import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { useBranch } from "../../lib/BranchContext";
import { logServiceTime } from "../../lib/autopilot";
import { loadServiceStats } from "../../lib/waitEstimator";
import QueueNudge from "../../components/QueueNudge";
import CompletePanel from "../../components/CompletePanel";
import QueueHygiene from "../../components/QueueHygiene";
import InReviewList from "../../components/InReviewList";
import CompleteReminder from "../../components/CompleteReminder";
import InProgressPanel from "../../components/InProgressPanel";
import QueuePauseControl from "../../components/QueuePauseControl";
import { assignWork } from "../../lib/backQueue";
import { sendCallNotice, sendThanks } from "../../lib/notifications";
import { sendCallNoticeSms } from "../../lib/notifications";
import { sendWaitUpdate } from "../../lib/notify";
import { sendCalledEmail } from "../../lib/notifyEmail";
import { postBranchAlert, broadcastToQueue, loadActiveAlert, clearBranchAlert } from "../../lib/alerts";
import { SMS_ENABLED, TURN_TIMEOUT_MINUTES, NEAR_FRONT_POSITION, INTERCEPT_AFTER_MINUTES } from "../../lib/features";
import { sendWaitEmail } from "../../lib/notifyEmail";
import { announceTicket } from "../../lib/tts";
import { arrivalState, formatEta } from "../../lib/arrival";
import { loadOpenEscalations, resolveEscalation } from "../../lib/sla";
import { getLimits } from "../../lib/tier";
import { getComplexity, analyzeQueue, smartSort, buildDurationStats, TIERS } from "../../lib/complexity";
import { pickBestStaff, enrichStaffLoad } from "../../lib/autoAssign";
import { findOrCreateCustomer, generatePersona, logQueueEvent } from "../../lib/customers";
import { saveScore, scoreEmoji, scoreColour } from "../../lib/satisfaction";
import { addPunch, addBonusPunch, getCustomerCard, hasUnclaimedReward, punchDots, redeemReward } from "../../lib/loyalty";
import Button from "../../components/Button";
import Card, { CardHeader } from "../../components/Card";

/** Convert seconds to a short human-readable string e.g. "2m 30s" or "45s" */
function formatSec(sec) {
  if (sec == null || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
import Stat from "../../components/Stat";
import Badge from "../../components/Badge";
import SetupChecklist from "../../components/SetupChecklist";

export default function Queue() {
  const { user } = useAuth();
  const { branch, branches, loading: branchLoading, dbReady, reload: reloadBranches } = useBranch();

  // Queue state
  const [tickets, setTickets] = useState([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [stationMap, setStationMap] = useState({}); // station id → name
  const [serviceNameMap, setServiceNameMap] = useState({}); // service id → service name
  const [durationStats, setDurationStats] = useState({}); // real service durations
  const [smartSortOn, setSmartSortOn] = useState(false);
  const [splitLaneOn, setSplitLaneOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const dbNotReady = !dbReady;

  // Scheduled bookings for today
  // Track which ticket IDs have already had persona generation kicked off
  // so we don't re-fire on every 30s poll
  const personaFiredRef = useRef(new Set());

  // Customer persona cache: ticketId → { isNew, visitCount, personaSummary, avgScore }
  const [personaCache, setPersonaCache] = useState({});

  // Satisfaction survey modal
  const [surveyTicket, setSurveyTicket] = useState(null); // ticket being rated
  const [surveyScore, setSurveyScore] = useState(0);
  const [surveyNote, setSurveyNote] = useState("");
  const [surveyBusy, setSurveyBusy] = useState(false);

  // Loyalty punch card
  const [loyaltyReward, setLoyaltyReward] = useState(null); // { customerName, reward } when earned
  const [loyaltyCards, setLoyaltyCards] = useState({});     // customerId → card data

  const [scheduledCount, setScheduledCount] = useState(0);
  const [upcomingBookings, setUpcomingBookings] = useState([]);

  // Daily capacity limit (persisted in localStorage per branch)
  const [capacityLimit, setCapacityLimit] = useState(0);
  const [showLimitEditor, setShowLimitEditor] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");

  // Last-refresh timestamp for the refresh button / realtime-fallback indicator
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // SMS "Your turn" button: ticketId → "sending" | "sent" | "error"
  const [smsSent, setSmsSent] = useState({});
  const [clearConfirm, setClearConfirm] = useState(false);

  /* Reveals the end-of-day and destructive actions. Closed by default —
     see the note beside Clear queue in the header. */
  const [moreOpen, setMoreOpen] = useState(false);

  // Currently-live broadcast banner (so staff can see and take it down)
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertMinutes, setAlertMinutes] = useState(15); // how long it stays on the TV
  const [alertSpeak,   setAlertSpeak]   = useState(false); // read aloud on the TV too

  // Broadcast alert modal
  const [alertOpen,    setAlertOpen]    = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult,  setAlertResult]  = useState(null); // { sent, failed }

  // Escalation state
  const [escalations, setEscalations] = useState([]);
  const slaEnabled   = getLimits(user).opsSla;

  // Elapsed timer — single interval, resets when the serving ticket changes (no DB calls)
  const [elapsedSec, setElapsedSec] = useState(0);
  // Intercept modal — shown when staff taps "Call next" while already serving
  const [interceptPending, setInterceptPending] = useState(false);
  // Ticket the staff member dismissed the "still serving" prompt for, so it
  // isn't shown again for that same customer.
  const interceptDismissedRef = useRef(null);
  // Manager = branch owner OR manager-tier plan
  const isManager    = branch?.owner_id === user?.id || getLimits(user).managerMode;

  /* ── Load tickets + completed-today count ──────────────────────── */
  const reload = useCallback(async () => {
    if (!branch?.id) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // ── Critical path: tickets + supporting data ─────────────────────
    // Ticket SELECT tries full column list first. If columns like
    // assigned_station_id or bounce_count don't exist yet (migration not run),
    // it automatically retries with the base columns so the queue still loads.
    try {
      let active = null;
      const fullCols = "id, token, status, customer_name, customer_phone, customer_email, service_id, staff_id, priority, source, created_at, called_at, started_at, completed_at, branch_id, notes, assigned_station_id, bounce_count, is_premium, requested_advisor_id, advisor_fee, near_front_notified_at, turn_expires_at, detail, handoff_category";
      const baseCols = "id, token, status, customer_name, customer_phone, customer_email, service_id, staff_id, priority, source, created_at, called_at, started_at, completed_at, branch_id, notes, is_premium, requested_advisor_id, advisor_fee, near_front_notified_at, turn_expires_at, detail, handoff_category";

      const { data: a1, error: e1 } = await supabase
        .from("tickets")
        .select(fullCols)
        .eq("branch_id", branch.id)
        .in("status", ["waiting", "serving"])
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: true });

      if (e1) {
        // Retry without optional columns (handles databases on older migrations)
        const { data: a2, error: e2 } = await supabase
          .from("tickets")
          .select(baseCols)
          .eq("branch_id", branch.id)
          .in("status", ["waiting", "serving"])
          .gte("created_at", todayStart.toISOString())
          .order("created_at", { ascending: true });
        if (e2) {
          setError(`Queue failed to load: ${e2.message} — run the latest database migrations in Supabase.`);
          return;
        }
        active = a2;
      } else {
        active = a1;
      }

      const [
        { count },
        { data: stf },
        { data: stn },
        { data: svcs },
        { data: recent },
      ] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true })
          .eq("branch_id", branch.id).eq("status", "completed")
          .gte("created_at", todayStart.toISOString()),
        supabase.from("staff").select("id, display_name, role, status")
          .eq("branch_id", branch.id).order("display_name"),
        supabase.from("stations").select("id, name").eq("branch_id", branch.id),
        supabase.from("services").select("id, name").eq("branch_id", branch.id),
        supabase.from("tickets").select("service_id, started_at, completed_at")
          .eq("branch_id", branch.id).eq("status", "completed")
          .not("started_at", "is", null).not("completed_at", "is", null)
          .order("completed_at", { ascending: false }).limit(100),
      ]);

      const svcNameMap = Object.fromEntries((svcs ?? []).map((s) => [s.id, s.name]));

      setTickets(active ?? []);
      setQueueLoaded(true);
      setCompletedToday(count ?? 0);
      setStaffList(stf ?? []);
      setStationMap(Object.fromEntries((stn ?? []).map((s) => [s.id, s.name])));
      setServiceNameMap(svcNameMap);
      setDurationStats(buildDurationStats(recent ?? [], svcNameMap));
      setLastRefreshed(new Date());
      setError(null);

      // Auto-generate persona for each active customer (background — non-blocking).
      // Guard with a ref so we only fire once per ticket, not on every 30s poll.
      if (active?.length) {
        active.forEach((t) => {
          if ((t.customer_name || t.customer_phone) && !personaFiredRef.current.has(t.id)) {
            personaFiredRef.current.add(t.id);
            findOrCreateCustomer(branch.id, { name: t.customer_name, phone: t.customer_phone })
              .then(async (cust) => {
                if (!cust) return;
                generatePersona(cust.id, branch.id).catch(() => {});
                // Load persona snapshot for the ticket card
                const [{ data: evts }, { data: scores }] = await Promise.all([
                  supabase.from("customer_events").select("event_type, created_at")
                    .eq("customer_id", cust.id).order("created_at", { ascending: false }).limit(20),
                  supabase.from("satisfaction_scores").select("score")
                    .eq("customer_id", cust.id).limit(10),
                ]);
                const visits = (evts ?? []).filter(e => e.event_type === "queue_complete" || e.event_type === "queue_join");
                const avgScore = scores?.length
                  ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length * 10) / 10
                  : null;
                setPersonaCache(prev => ({
                  ...prev,
                  [t.id]: {
                    isNew: visits.length <= 1,
                    visitCount: visits.length,
                    persona: cust.ai_persona ? cust.ai_persona.slice(0, 120) : null,
                    avgScore,
                    customerId: cust.id,
                  },
                }));
              })
              .catch(() => {});
          }
        });
      }
    } catch (err) {
      setError(`Unexpected error loading queue: ${err?.message ?? err}`);
    }

    // ── Bookings (non-critical — isolated so a missing table never breaks the queue) ─
    try {
      const [{ count: sched }, { data: upcoming }] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .eq("branch_id", branch.id)
          .gte("scheduled_at", todayStart.toISOString())
          .lt("scheduled_at", tomorrowStart.toISOString()),
        supabase.from("bookings")
          .select("id, scheduled_at, service_id, customer_name, customer_phone, staff_id")
          .eq("branch_id", branch.id)
          .gte("scheduled_at", new Date().toISOString())
          .lt("scheduled_at", tomorrowStart.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(6),
      ]);
      setScheduledCount(sched ?? 0);
      setUpcomingBookings(upcoming ?? []);

      // Auto-prepare personas for upcoming scheduled visits (fire once per booking)
      if (upcoming?.length) {
        upcoming.forEach((bk) => {
          if ((bk.customer_name || bk.customer_phone) && !personaFiredRef.current.has(bk.id)) {
            personaFiredRef.current.add(bk.id);
            findOrCreateCustomer(branch.id, { name: bk.customer_name, phone: bk.customer_phone })
              .then((cust) => cust && generatePersona(cust.id, branch.id))
              .catch(() => {});
          }
        });
      }
    } catch {
      // Bookings table unavailable — not critical
      setScheduledCount(0);
      setUpcomingBookings([]);
    }

    // ── Escalations ──────────────────────────────────────────────────
    if (slaEnabled) {
      loadOpenEscalations(branch.id).then(setEscalations).catch(() => {});
    }
  }, [branch?.id, slaEnabled]);

  useEffect(() => { reload(); }, [reload]);

  /* ── Realtime: keep dashboard in sync when customer checks in ──── */
  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`branch-${branch.id}-tickets`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `branch_id=eq.${branch.id}` },
        () => reload()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch?.id, reload]);

  /* ── Realtime: escalation changes ─────────────────────────────── */
  useEffect(() => {
    if (!branch?.id || !slaEnabled) return;
    const ch = supabase
      .channel(`queue-escalations-${branch.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "escalations" },
        () => loadOpenEscalations(branch.id).then(setEscalations).catch(() => {})
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch?.id, slaEnabled]);

  /* ── Polling fallback: re-fetch every 30 s in case realtime misses events ── */
  /* This guarantees QR walk-ins always appear even if the realtime socket drops */
  useEffect(() => {
    const id = setInterval(reload, 30_000);
    return () => clearInterval(id);
  }, [reload]);

  /* ── Derived ───────────────────────────────────────────────────── */
  const serving = useMemo(() => tickets.find((t) => t.status === "serving"), [tickets]);

  /* ── Elapsed timer for the currently-serving client ──────────── */
  /* One interval per page. Resets when serving ticket id changes.  */
  useEffect(() => {
    const ts = serving?.called_at ?? serving?.started_at ?? null;
    if (!ts) { setElapsedSec(0); return; }
    const start = new Date(ts);
    const tick = () => setElapsedSec(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serving?.id, serving?.called_at, serving?.started_at]);

  /* ── Load capacity limit from localStorage when branch is known ── */
  useEffect(() => {
    if (!branch?.id) return;
    const stored = localStorage.getItem(`queue-capacity-${branch.id}`);
    const parsed = stored ? parseInt(stored, 10) : 0;
    setCapacityLimit(isNaN(parsed) ? 0 : parsed);
    setLimitDraft(stored ?? "");
  }, [branch?.id]);
  // Waiting list — smart-sorted (complexity-aware) or default arrival order
  const waiting = useMemo(() => {
    const base = tickets.filter((t) => t.status === "waiting");
    if (smartSortOn) return smartSort(base, serviceNameMap, durationStats);
    return base.sort((a, b) => {
      const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (pDiff !== 0) return pDiff;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [tickets, smartSortOn, serviceNameMap, durationStats]);

  // Staff list — used by the "Reassign to" menu on each ticket (loaded in reload())
  /* Has the queue been fetched even once?
     `tickets` starts as [] and the page rendered "Queue is empty" while the
     first request was still in flight — so staff could be looking at an empty
     screen with people in the room, and the list appeared to fill itself in at
     random when the fetch landed. An empty state and an unknown state are not
     the same thing, and only one of them should say the queue is empty. */
  const [queueLoaded, setQueueLoaded] = useState(false);

  const [staffList, setStaffList] = useState([]);

  /* WHO IS SERVING FROM THIS DEVICE
     Every visit was being recorded with no staff at all — callNextInner never
     wrote staff_id, so `with_staff` was 0 across the whole history. That makes
     any later question about who handles what, or whether case length differs
     by person, permanently unanswerable for this period.

     Identifying staff by the logged-in user cannot work here: the owner and
     his staff share one account, so `user_id` names the account rather than
     the person. The device is the better proxy — the counter iPad is one
     person, the back desk another — so this is chosen once per browser and
     remembered. */
  const STAFF_KEY = `azq.servingStaff.${branch?.id ?? "none"}`;
  const [servingStaffId, setServingStaffId] = useState("");
  useEffect(() => {
    if (!branch?.id) return;
    try { setServingStaffId(localStorage.getItem(STAFF_KEY) || ""); } catch { /* private mode */ }
  }, [branch?.id, STAFF_KEY]);
  function chooseServingStaff(id) {
    setServingStaffId(id);
    try { id ? localStorage.setItem(STAFF_KEY, id) : localStorage.removeItem(STAFF_KEY); }
    catch { /* private mode */ }
  }

  // Queue analysis — runs whenever waiting list changes
  const queueAnalysis = useMemo(
    () => analyzeQueue({ waiting, serving, staffList, serviceMap: serviceNameMap, durationStats }),
    [waiting, serving, staffList, serviceNameMap, durationStats]
  );

  // ── Split-lane derived views ──────────────────────────────────────────
  // Fast lane: quick + standard; Complex lane: complex + extended
  const fastLane = useMemo(
    () =>
      waiting.filter((t) => {
        const tier = getComplexity(serviceNameMap[t.service_id] ?? "").tier;
        return tier === "quick" || tier === "standard";
      }),
    [waiting, serviceNameMap]
  );
  const complexLane = useMemo(
    () =>
      waiting.filter((t) => {
        const tier = getComplexity(serviceNameMap[t.service_id] ?? "").tier;
        return tier === "complex" || tier === "extended";
      }),
    [waiting, serviceNameMap]
  );
  const dropOffTickets = useMemo(
    () =>
      waiting.filter((t) =>
        (serviceNameMap[t.service_id] ?? "").toLowerCase().includes("drop")
      ),
    [waiting, serviceNameMap]
  );

  // Staff enriched with current workload count — used for smart auto-assignment
  const enrichedStaffList = useMemo(
    () => enrichStaffLoad(staffList, tickets),
    [staffList, tickets]
  );

  // Auto-assign all unassigned complex/extended tickets to the right staff
  async function autoAssignComplex() {
    const targets = complexLane.filter((t) => !t.staff_id);
    if (!targets.length || !enrichedStaffList.length) return;
    setBusy(true);
    setError(null);
    // Track load locally so each successive pick accounts for prior assignments
    let currentStaff = [...enrichedStaffList];
    for (const t of targets) {
      const svcName = serviceNameMap[t.service_id] ?? "";
      const pick    = pickBestStaff(svcName, currentStaff);
      if (pick.staffId) {
        await supabase.from("tickets").update({ staff_id: pick.staffId }).eq("id", t.id);
        currentStaff = currentStaff.map((s) =>
          s.id === pick.staffId ? { ...s, currentLoad: (s.currentLoad ?? 0) + 1 } : s
        );
      }
    }
    await reload();
    setBusy(false);
  }

  /* ── Actions ───────────────────────────────────────────────────── */
  // All actions optimistically reload at the end so the dashboard updates
  // instantly — realtime is only a nice-to-have for cross-device sync.

  // callNextInner — claims the next waiting ticket without touching the
  // current serving ticket. Called by callNext() and by intercept modal
  // resolution handlers (after the current ticket has been dealt with).
  async function callNextInner() {
    if (waiting.length === 0) return;
    setBusy(true);
    setError(null);
    const next = waiting[0];
    const now  = new Date().toISOString();
    // Start the no-show clock: if the customer hasn't been served within
    // TURN_TIMEOUT_MINUTES, expire_called_tickets() (pg_cron, every minute)
    // cancels the ticket so the counter isn't held indefinitely.
    const turnExpiresAt = new Date(Date.now() + TURN_TIMEOUT_MINUTES * 60_000).toISOString();
    const { error: e } = await supabase
      .from("tickets")
      .update({
        status: "serving", called_at: now, started_at: now,
        turn_expires_at: turnExpiresAt,
        /* Who took this one. Null when nobody has been chosen on this device —
           better an honest gap than every visit credited to one person. */
        ...(servingStaffId ? { staff_id: servingStaffId } : {}),
      })
      .eq("id", next.id);
    if (e) { setBusy(false); return setError(e.message); }
    sendCallNotice(next.id);
    // Voice announcement (C3) — announce ticket + counter via Web Speech API
    const counterLabel = (next.assigned_station_id && stationMap[next.assigned_station_id])
      ? stationMap[next.assigned_station_id]
      : null;
    announceTicket({
      token:        next.token,
      customerName: next.customer_name,
      counter:      counterLabel,
      branchId:     branch?.id,
    });
    // "It's your turn" notifications — email first (transactional, always on),
    // SMS as a secondary channel when a phone number is on the ticket.
    if (next.customer_email || next.customer_phone) {
      const staffName = resolveStaffName(next);

      if (next.customer_email) {
        sendCalledEmail({
          email:      next.customer_email,
          name:       next.customer_name ?? "Customer",
          token:      next.token,
          counter:    counterLabel ?? "the front desk",
          staffName,
          branchName: branch?.name,
        });
      }
      /* Via the edge function — the direct-to-Twilio call this replaced was
         blocked by the browser and never sent anything. */
      if (next.customer_phone) {
        sendCallNoticeSms(next.id);
      }
    }
    await reload();
    setBusy(false);
  }

  /* NO LONGER WIRED TO ANY BUTTON — kept, not deleted, deliberately.
     "Call next" as a separate action is gone: finishing someone is now how
     the next person is called (see complete() below). Nothing calls this,
     which also means the intercept modal it opens can no longer appear.
     Left in place because the intercept logic — what to do with a visit that
     has run long — is the right idea and may return as a prompt on the
     Done button rather than as its own action. Delete it if that never
     happens; do not wire it back to a button without reading complete(). */
  // callNext — if someone is already being served, ask what to do with them
  // first. But only when the visit is genuinely running long: prompting on
  // every call is noise, because normally staff finish one customer and move
  // straight to the next.
  // eslint-disable-next-line no-unused-vars
  //
  // Dismissing the prompt ("Cancel") suppresses it for that ticket, so it
  // doesn't reappear on the very next click.
  async function callNext() {
    if (waiting.length === 0) return;

    if (serving) {
      const startedAt = serving.started_at ?? serving.called_at;
      const servingMs = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
      const runningLong = servingMs > INTERCEPT_AFTER_MINUTES * 60_000;
      const dismissed = interceptDismissedRef.current === serving.id;

      if (runningLong && !dismissed) {
        setInterceptPending(true);
        return;
      }

      /* Ask how the visit ended before moving on. This is the step that was
         missing: completion used to be silent, so the last customer of the
         day was never closed and no outcome was ever recorded. The panel
         calls the next customer itself once answered. */
      setCompleting({ ticket: serving, andCallNext: true });
      return;
    }

    await callNextInner();
  }

  // directComplete — completes the current ticket without opening the
  // satisfaction survey. Used by the intercept modal ("Complete" option).
  async function directComplete(ticket, outcome = null) {
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    const { error: e } = await supabase
      .from("tickets")
      .update({
        status: "completed",
        completed_at: now,
        ...(outcome ? { outcome } : {}),
      })
      .eq("id", ticket.id);
    if (e) { setBusy(false); return setError(e.message); }
    logServiceTime({
      branchId: ticket.branch_id, ticketId: ticket.id, serviceId: ticket.service_id,
      staffId: ticket.staff_id, startedAt: ticket.started_at, completedAt: now,
    });
    sendThanks(ticket.id);
    if (ticket.customer_name || ticket.customer_phone) {
      findOrCreateCustomer(branch.id, { name: ticket.customer_name, phone: ticket.customer_phone })
        .then(async (cust) => {
          if (!cust) return;
          await logQueueEvent(cust.id, branch.id, "queue_complete", {
            ticketId: ticket.id, token: ticket.token,
            service:  serviceNameMap[ticket.service_id] ?? "",
            staffId:  ticket.staff_id,
          }).catch(() => {});
          generatePersona(cust.id, branch.id).catch(() => {});
        }).catch(() => {});
    }
    setBusy(false);
  }

  /* What the Complete panel does with the answer. Everything routes through
     directComplete so the existing bookkeeping — service time, thanks email,
     customer record — happens exactly as before. */
  async function resolveComplete({ outcome, category }) {
    const { ticket, andCallNext } = completing ?? {};
    if (!ticket) return;
    setCompleting(null);

    if (outcome === "handoff" && category) {
      /* Back queue: the customer goes home, the work continues. assignWork
         sets handed_off_at, which is what keeps it OUT of the waiting list
         and every wait calculation. */
      setBusy(true);
      await assignWork({ ticketId: ticket.id, category, takenInBy: ticket.staff_id ?? null })
        .catch((e) => setError(e.message));
      setBusy(false);
    } else {
      await directComplete(ticket, outcome);
    }

    await reload();
    if (andCallNext) await callNextInner();
  }

  // ── Intercept modal resolution handlers ─────────────────────────
  async function interceptResolveComplete() {
    setInterceptPending(false);
    await directComplete(serving);
    await reload();          // sync state before calling next
    await callNextInner();
  }
  async function interceptResolveReturn() {
    setInterceptPending(false);
    await sendBackToQueue();
    await callNextInner();
  }
  async function interceptResolveNoShow() {
    setInterceptPending(false);
    await skipServing();
    await callNextInner();
  }

  /* ONE ACTION, NOT TWO.
     There used to be a Complete button and a separate "Call next customer"
     button. Two buttons for what is, at the counter, a single moment: this
     person is finished, bring me the next one. Staff pressed Call next
     (because that is what they wanted) and skipped Complete (because it
     looked like optional bookkeeping) — which is why whole days closed in a
     single burst at 5pm with no outcomes recorded.

     Now finishing someone IS how you get the next person. The bookkeeping
     is no longer a separate act of discipline; it happens because it is on
     the path to the thing staff actually want. */
  function complete() {
    if (!serving) return;
    setCompleting({ ticket: serving, andCallNext: true });
  }

  /* Nobody is at the counter yet — the only thing to do is start. */
  function startNext() {
    if (waiting.length === 0) return;
    callNextInner();
  }

  // Called when staff submit the survey (or skip it)
  async function submitSurveyAndComplete(score, note) {
    if (!surveyTicket) return;
    setSurveyBusy(true);
    const ticket = surveyTicket;
    setSurveyTicket(null);
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    const { error: e } = await supabase
      .from("tickets")
      .update({ status: "completed", completed_at: now })
      .eq("id", ticket.id);
    if (e) { setBusy(false); setSurveyBusy(false); return setError(e.message); }

    logServiceTime({
      branchId: ticket.branch_id, ticketId: ticket.id, serviceId: ticket.service_id,
      staffId: ticket.staff_id, startedAt: ticket.started_at, completedAt: now,
    });
    sendThanks(ticket.id);

    if (ticket.customer_name || ticket.customer_phone) {
      findOrCreateCustomer(branch.id, {
        name:  ticket.customer_name,
        phone: ticket.customer_phone,
      }).then(async (cust) => {
        if (!cust) return;
        const svcName = serviceNameMap[ticket.service_id] ?? "";
        await logQueueEvent(cust.id, branch.id, "queue_complete", {
          ticketId: ticket.id, token: ticket.token, service: svcName, staffId: ticket.staff_id,
        }).catch(() => {});
        generatePersona(cust.id, branch.id).catch(() => {});
        // Save satisfaction score if staff rated the visit
        if (score > 0) {
          saveScore({
            branchId: branch.id, ticketId: ticket.id,
            customerId: cust.id, staffId: ticket.staff_id ?? null,
            score, note,
          }).catch(() => {});
        }
        // Auto-punch loyalty card
        addPunch(branch.id, cust.id, ticket.id, ticket.staff_id ?? null).then(({ rewardEarned, program }) => {
          if (rewardEarned && program) {
            setLoyaltyReward({
              customerName: cust.name ?? ticket.customer_name ?? "Customer",
              reward: program.reward_description,
            });
          }
          // Refresh loyalty card in cache
          getCustomerCard(branch.id, cust.id).then(card => {
            if (card) setLoyaltyCards(prev => ({ ...prev, [cust.id]: card }));
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    }
    await reload();
    setBusy(false);
    setSurveyBusy(false);
  }

  // Mark current as no-show (skip them). Useful when a customer doesn't show up.
  async function skipServing() {
    if (!serving) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase
      .from("tickets")
      .update({ status: "no_show", completed_at: new Date().toISOString() })
      .eq("id", serving.id);
    if (e) { setBusy(false); return setError(e.message); }
    await reload();
    setBusy(false);
  }

  // Reassign a ticket to a different staff member
  async function reassignTicket(ticketId, staffId) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase
      .from("tickets")
      .update({ staff_id: staffId })
      .eq("id", ticketId);
    if (e) { setBusy(false); return setError(e.message); }
    await reload();
    setBusy(false);
  }

  // Bump a waiting ticket to the front of the queue
  async function escalateTicket(ticketId) {
    setBusy(true);
    setError(null);
    const maxPriority = waiting.reduce((m, t) => Math.max(m, t.priority ?? 0), 0);
    const { error: e } = await supabase
      .from("tickets")
      .update({ priority: maxPriority + 10 })
      .eq("id", ticketId);
    if (e) { setBusy(false); return setError(e.message); }
    await reload();
    setBusy(false);
  }

  /* ── Track the live broadcast banner ───────────────────────────────
     Staff need to see that a message is on the TV and be able to pull it
     down early — otherwise the only way to remove it is to wait out the
     15-minute expiry.                                                    */
  const refreshActiveAlert = useCallback(async () => {
    if (!branch?.id) return;
    setActiveAlert(await loadActiveAlert(branch.id));
  }, [branch?.id]);

  useEffect(() => {
    if (!branch?.id) return;
    refreshActiveAlert();
    const id = setInterval(refreshActiveAlert, 30_000);
    return () => clearInterval(id);
  }, [branch?.id, refreshActiveAlert]);

  // Drop it from the UI the moment it expires, without waiting for a poll
  useEffect(() => {
    if (!activeAlert?.expires_at) return;
    const ms = new Date(activeAlert.expires_at).getTime() - Date.now();
    if (ms <= 0) { setActiveAlert(null); return; }
    const t = setTimeout(() => setActiveAlert(null), ms);
    return () => clearTimeout(t);
  }, [activeAlert?.id, activeAlert?.expires_at]);

  async function dismissAlert() {
    if (!activeAlert) return;
    await clearBranchAlert(activeAlert.id);
    setActiveAlert(null);
  }

  /* ── "You're almost up" reminder ────────────────────────────────────
     When a waiting ticket reaches NEAR_FRONT_POSITION (3rd in line) we send
     one heads-up on every active channel. `near_front_notified_at` is stamped
     on the ticket so it fires exactly once even across reloads, other staff
     devices, or the customer moving back and forth in the queue.          */
  useEffect(() => {
    if (!branch?.id || waiting.length === 0) return;

    const candidates = waiting
      .map((t, i) => ({ ticket: t, position: i + 1 }))
      .filter(({ ticket, position }) =>
        position <= NEAR_FRONT_POSITION &&
        !ticket.near_front_notified_at &&
        (ticket.customer_email || (SMS_ENABLED && ticket.customer_phone)));

    if (candidates.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const { ticket, position } of candidates) {
        if (cancelled) return;

        // Claim the send first so two open dashboards can't both fire it.
        const { data: claimed, error: claimErr } = await supabase
          .from("tickets")
          .update({ near_front_notified_at: new Date().toISOString() })
          .eq("id", ticket.id)
          .is("near_front_notified_at", null)
          .select("id");
        if (claimErr || !claimed?.length) continue;  // someone else got it

        if (ticket.customer_email) {
          sendWaitEmail({
            email:      ticket.customer_email,
            name:       ticket.customer_name ?? "there",
            position,
            branchName: branch?.name ?? "AzQueue",
            ticketId:   ticket.id,
          }).catch(() => {});
        }
        if (SMS_ENABLED && ticket.customer_phone) {
          sendWaitUpdate(
            ticket.customer_phone,
            ticket.customer_name ?? "there",
            position,
            branch?.name ?? "AzQueue",
          ).catch(() => {});
        }
      }
    })();

    return () => { cancelled = true; };
  }, [waiting, branch?.id, branch?.name]);

  /**
   * Human name of the staff member serving a ticket, for customer-facing
   * notifications. Order of preference:
   *   1. the staff member actually assigned to the ticket
   *   2. the signed-in user's own staff record
   * Returns "" when neither resolves — callers then omit the name rather
   * than leaking an account username like "aztaxservices1".
   *
   * NOTE: staff rows key the auth user on `user_id`, not `id`. Matching on
   * `s.id === user.id` never hit, which is why the email said
   * "aztaxservices1 is ready for you".
   */
  function resolveStaffName(ticket) {
    const assigned = ticket?.staff_id
      ? staffList.find((s) => s.id === ticket.staff_id)
      : null;
    if (assigned?.display_name) return assigned.display_name;

    const me = staffList.find((s) => s.user_id === user?.id);
    if (me?.display_name) return me.display_name;

    return "";
  }

  // ── "Your turn" nudge ──────────────────────────────────────────────
  // Re-sends the "come to the counter" notice on every channel we have for
  // this customer: email always, SMS as well once it's re-enabled.
  async function sendYourTurn(ticket) {
    if (!ticket.customer_email && !ticket.customer_phone) return;
    setSmsSent((prev) => ({ ...prev, [ticket.id]: "sending" }));
    const staffName = resolveStaffName(ticket) || "Our team";
    // Window label: use assigned station name if available, else "Counter 1"
    const windowLabel = (ticket.assigned_station_id && stationMap[ticket.assigned_station_id])
      ? stationMap[ticket.assigned_station_id]
      : "Counter 1";
    try {
      const jobs = [];

      if (ticket.customer_email) {
        jobs.push(sendCalledEmail({
          email:      ticket.customer_email,
          name:       ticket.customer_name ?? "Customer",
          token:      ticket.token,
          counter:    windowLabel,
          staffName,
          branchName: branch?.name ?? "AzQueue",
        }));
      }

      if (SMS_ENABLED && ticket.customer_phone) {
        jobs.push(sendCallNoticeSms(ticket.id));
      }

      await Promise.all(jobs);
      setSmsSent((prev) => ({ ...prev, [ticket.id]: "sent" }));
      // Auto-clear the "Sent ✓" indicator after 4 s
      setTimeout(() => setSmsSent((prev) => {
        const next = { ...prev };
        delete next[ticket.id];
        return next;
      }), 4000);
    } catch {
      setSmsSent((prev) => ({ ...prev, [ticket.id]: "error" }));
      setTimeout(() => setSmsSent((prev) => {
        const next = { ...prev };
        delete next[ticket.id];
        return next;
      }), 4000);
    }
  }

  // ── Broadcast alert ──────────────────────────────────────────────────
  // Three things happen: a banner goes up on every TV display for this
  // branch, everyone in the queue with an email gets the message, and — once
  // SMS is re-enabled — anyone with a phone number gets a text too.
  async function sendBroadcast() {
    if (!alertMessage.trim() || alertSending) return;
    setAlertSending(true);
    setAlertResult(null);

    const message = alertMessage.trim();
    const targets = tickets.filter(
      (t) => ["waiting", "serving"].includes(t.status) && (t.customer_email || t.customer_phone)
    );

    // 1. Banner on the TV displays (independent of who has contact details)
    const banner = await postBranchAlert(branch.id, message, {
      minutes: alertMinutes,
      userId: user?.id ?? null,
      speak: alertSpeak,
    });
    refreshActiveAlert();

    // 2. Direct notifications
    const { emailed, texted } = await broadcastToQueue(
      targets,
      message,
      branch?.name ?? "AzQueue",
    );

    setAlertSending(false);
    setAlertResult({
      total:    targets.length,
      emailed,
      texted,
      onScreen: banner.ok,
      spoken:   banner.ok && alertSpeak,
    });

    setTimeout(() => {
      setAlertOpen(false);
      setAlertMessage("");
      setAlertResult(null);
      setAlertSpeak(false);
    }, 4000);
  }

  // ── Manager escalation overrides ───────────────────────────────────

  // Resolve an escalation (manager only)
  async function handleResolveEscalation(escalationId) {
    if (!isManager) return;
    setBusy(true);
    try {
      await resolveEscalation(escalationId);
      setEscalations((prev) => prev.filter((e) => e.id !== escalationId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Boost a ticket to the top of the queue (manager override)
  async function handleManagerBoost(ticketId) {
    if (!isManager) return;
    setBusy(true);
    setError(null);
    const maxPriority = waiting.reduce((m, t) => Math.max(m, t.priority ?? 0), 0);
    const { error: e } = await supabase
      .from("tickets")
      .update({ priority: maxPriority + 20 }) // +20 so it leapfrogs regular escalations
      .eq("id", ticketId);
    if (e) setError(e.message);
    else await reload();
    setBusy(false);
  }

  // Cancel a waiting ticket (different from no-show — customer chose to leave)
  async function cancelTicket(ticketId) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase
      .from("tickets")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", ticketId);
    if (e) { setBusy(false); return setError(e.message); }
    await reload();
    setBusy(false);
  }

  // Send the currently-serving ticket BACK to the waiting queue (e.g. customer
  // stepped away or needs more time). Resets called_at + started_at; the autopilot
  // will recompute its turn from scratch. Useful instead of skipping outright.
  async function sendBackToQueue() {
    if (!serving) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase
      .from("tickets")
      .update({
        status:       "waiting",
        called_at:    null,
        started_at:   null,
        // Bump priority a touch so they don't go to the very back
        priority:     (serving.priority ?? 0) + 1,
        // Track how many times this ticket has been parked back
        bounce_count: (serving.bounce_count ?? 0) + 1,
      })
      .eq("id", serving.id);
    if (e) { setBusy(false); return setError(e.message); }
    await reload();
    setBusy(false);
  }

  async function clearQueue() {
    setBusy(true);
    setError(null);
    /* Writes expired_at, NOT completed_at. Clearing the screen is
       housekeeping — nobody was served and nobody necessarily walked out.
       Recording it as a completion inflated service times; recording it as an
       ordinary cancellation inflated the abandonment rate, which is the one
       number this business most needs to be true. */
    const { error: e } = await supabase
      .from("tickets")
      .update({ status: "cancelled", expired_at: new Date().toISOString() })
      .eq("branch_id", branch.id)
      .in("status", ["waiting", "serving"]);
    setClearConfirm(false);
    if (e) { setBusy(false); return setError(e.message); }
    await reload();
    setBusy(false);
  }

  /* ── Typical service time ──────────────────────────────────────────
     Shown as a stat so staff can see how long a visit actually takes here.
     This is the MEDIAN of completed visits, not the mean: one two-hour
     immigration file would otherwise drag the number away from what a
     normal appointment looks like.                                      */
  const [avgServiceSec, setAvgServiceSec] = useState(null);

  /* The Complete panel. Holds the ticket being finished and what should
     happen once the outcome is chosen — `andCallNext` is set when this was
     triggered by Call next, so finishing flows straight on to the next
     customer rather than making staff press twice. */
  const [completing, setCompleting] = useState(null);   // { ticket, andCallNext }

  useEffect(() => {
    let cancelled = false;
    if (!branch?.id) return;
    loadServiceStats(branch.id)
      .then((s) => { if (!cancelled) setAvgServiceSec(s?.overall?.median ? s.overall.median * 60 : null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [branch?.id, serving?.id]);

  // First-run users are redirected to /business/onboarding by the render guard below.

  /* ── Render guards ─────────────────────────────────────────────── */
  if (branchLoading) {
    return <div className="p-8 text-ink-mute ovline">Loading your queue…</div>;
  }

  // Database not migrated yet — friendly waiting state
  if (dbNotReady) {
    return (
      <div className="p-8 max-w-xl atmosphere-hero">
        <header className="mb-6">
          <div className="ovline mb-2 text-gold-soft">Setup pending</div>
          <h1 className="font-display text-3xl font-light tracking-tightest">
            Database not connected yet
          </h1>
          <p className="text-ink-soft text-sm mt-3">
            Your dashboard UI is ready, but the database tables haven't been created. Run <span className="font-mono text-gold-soft">supabase/migrations/0001_init.sql</span> in your Supabase SQL editor when you're ready, then refresh this page.
          </p>
        </header>
        <Card luxe className="p-7">
          <div className="ovline text-[9px] mb-3">Three-step setup</div>
          <ol className="space-y-3 text-sm text-ink-soft">
            <li className="grid grid-cols-[20px_1fr] gap-3">
              <span className="font-display text-gold-soft">1.</span>
              <span>Open your Supabase project → SQL Editor → New query</span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-3">
              <span className="font-display text-gold-soft">2.</span>
              <span>Paste the contents of <span className="font-mono text-[11px] text-gold-soft">supabase/migrations/0001_init.sql</span></span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-3">
              <span className="font-display text-gold-soft">3.</span>
              <span>Click Run, then come back here and refresh.</span>
            </li>
          </ol>
          <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>
          <div className="text-[10px] text-ink-mute text-center tracking-wide">
            Takes about 3 minutes. Nothing in the rest of the app breaks until then.
          </div>
        </Card>
      </div>
    );
  }

  // First-run user with no branches → kick them through the onboarding wizard
  if (!branch) {
    return <Navigate to="/business/onboarding" replace />;
  }

  /* ── Main view ─────────────────────────────────────────────────── */
  const customerUrl = `${window.location.origin}/q/${branch.slug}`;

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      {/* ── Intercept Modal — resolve current visit before calling next ── */}
      {interceptPending && (
        <InterceptModal
          ticket={serving}
          busy={busy}
          onComplete={interceptResolveComplete}
          onReturn={interceptResolveReturn}
          onNoShow={interceptResolveNoShow}
          onDismiss={() => {
            // Remember the dismissal so the prompt doesn't reappear for this
            // same customer on the next "Call next" click.
            interceptDismissedRef.current = serving?.id ?? null;
            setInterceptPending(false);
          }}
        />
      )}

      {/* ── Satisfaction Survey Modal ─────────────────────────────────── */}
      {surveyTicket && (
        <SatisfactionSurvey
          ticket={surveyTicket}
          busy={surveyBusy}
          onSubmit={(score, note) => submitSurveyAndComplete(score, note)}
          onSkip={() => submitSurveyAndComplete(0, "")}
        />
      )}
      {/* ── Clear Queue Confirmation ─────────────────────────────────── */}
      {clearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-line w-full max-w-sm p-7 shadow-2xl">
            <div className="ovline text-[9px] text-[#d49185] mb-2">End of day</div>
            <h2 className="font-display text-xl font-light tracking-tight mb-3">Clear entire queue?</h2>
            <p className="text-sm text-ink-soft mb-6">
              This will cancel all {waiting.length + (serving ? 1 : 0)} remaining ticket{(waiting.length + (serving ? 1 : 0)) !== 1 ? "s" : ""} in the queue. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button onClick={clearQueue} disabled={busy} className="flex-1" style={{ background: "#6b2e2e", borderColor: "#6b2e2e" }}>
                Yes, clear queue
              </Button>
              <Button variant="ghost" onClick={() => setClearConfirm(false)} disabled={busy} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast Alert Modal ─────────────────────────────────────── */}
      {alertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-line w-full max-w-md p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="ovline text-[9px] text-gold-soft mb-1">Queue Broadcast</div>
                <h2 className="font-display text-xl font-light tracking-tight">Send alert to queue</h2>
              </div>
              <button
                onClick={() => { setAlertOpen(false); setAlertMessage(""); setAlertResult(null); }}
                className="text-ink-mute hover:text-ink text-lg leading-none"
                disabled={alertSending}
              >
                ✕
              </button>
            </div>

            {alertResult ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-sm text-ink">
                  {alertResult.onScreen && (
                    <>
                      {alertResult.spoken
                        ? "Announced and showing on the TV display"
                        : "Showing on the TV display"}
                      <br />
                    </>
                  )}
                  {alertResult.emailed > 0
                    ? <>Emailed <strong>{alertResult.emailed}</strong> of {alertResult.total} in queue</>
                    : <span className="text-ink-mute">No one in the queue has an email address</span>}
                  {alertResult.texted > 0 && <> · texted {alertResult.texted}</>}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-ink-soft mb-4">
                  Shows as a banner on the TV display for 15 minutes, and is emailed to{" "}
                  <strong>
                    {tickets.filter(t => ["waiting","serving"].includes(t.status) && t.customer_email).length}
                  </strong>{" "}
                  of {tickets.filter(t => ["waiting","serving"].includes(t.status)).length} customers in the queue.
                  {SMS_ENABLED && " Customers who opted in also get a text."}
                </p>
                <textarea
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  placeholder="e.g. We're running about 20 minutes behind schedule. Thank you for your patience!"
                  rows={4}
                  className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-3 py-2.5 text-ink placeholder:text-ink-mute resize-none mb-4"
                  autoFocus
                />

                <label className="flex items-start gap-2.5 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={alertSpeak}
                    onChange={(e) => setAlertSpeak(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-[#c9a86a]"
                  />
                  <span className="text-[11px] text-ink-soft leading-relaxed">
                    Announce out loud on the TV
                    <span className="block text-[10px] text-ink-mute">
                      Plays a chime, then reads the message aloud once. The banner
                      still shows either way.
                    </span>
                  </span>
                </label>

                <div className="flex items-center gap-2 mb-4">
                  <span className="ovline text-[9px] text-ink-mute">Show on TV for</span>
                  {[5, 15, 30, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAlertMinutes(m)}
                      className={`text-[10px] px-2 py-1 border transition ${
                        alertMinutes === m
                          ? "border-gold-deep text-gold-soft bg-[rgba(201,168,106,0.08)]"
                          : "border-line text-ink-mute hover:border-line-2 hover:text-ink"
                      }`}
                    >
                      {m < 60 ? `${m} min` : "1 hr"}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={sendBroadcast}
                    disabled={!alertMessage.trim() || alertSending}
                    className="flex-1 bg-[#0f1a14] text-gold-soft text-[11px] ovline px-4 py-2.5 hover:bg-[#1a2b1e] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {alertSending ? "Sending…" : "📢 Send to all in queue"}
                  </button>
                  <button
                    onClick={() => { setAlertOpen(false); setAlertMessage(""); }}
                    disabled={alertSending}
                    className="text-[11px] ovline px-4 py-2.5 border border-line text-ink-mute hover:text-ink hover:border-line-2 transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <RewardToast
        reward={loyaltyReward}
        onClose={() => setLoyaltyReward(null)}
      />
      {/* Above the header, because it is about the screen being wrong — and a
          correction that appears below the numbers it corrects gets read
          second, if at all. `waiting.length` as the refresh key means it
          re-checks whenever the queue actually changes. */}
      <div className="mb-5">
        <QueueHygiene branchId={branch?.id} refreshKey={waiting.length + (serving ? 1 : 0)} />
      </div>

      <header className="flex justify-between items-start mb-8 gap-4">
        <div>
          <div className="ovline mb-2 text-gold-soft">Live · combined queue</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Queue</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-xs text-ink-soft flex items-center">
              <span className="pip breathe mr-2 inline-block" />
              {waiting.length} waiting &nbsp;<span className="text-ink-mute">·</span>&nbsp; {serving ? "1 in service" : "0 in service"}
              <span className="text-ink-mute"> · {branch.name}</span>
            </span>
            {queueAnalysis.tally.dropoff > 0 && (
              <span className="text-[9px] border border-emerald-800 text-emerald-400 px-2 py-0.5 ovline">
                {queueAnalysis.tally.dropoff} drop-off{queueAnalysis.tally.dropoff > 1 ? "s" : ""} · fast-track
              </span>
            )}
            {/* SMART SORT AND SPLIT LANES USED TO BE BUTTONS HERE.
                They are configuration, not actions: nobody decides whether
                the queue should reorder itself while a customer is standing
                in front of them. You decide once and forget. On the counter
                screen they were two more things to read past, on a page the
                owner said was already too complex for his father.

                Their state still lives in this component and both features
                work exactly as before — only the toggles moved. When either
                is on, a small label shows below so it is never a mystery why
                the order looks different. */}
            {waiting.length > 0 && smartSortOn && (
              <span className="text-[9px] ovline text-gold-soft border border-gold-deep/50 px-2 py-0.5">
                Smart sort on
              </span>
            )}
            {waiting.length > 0 && splitLaneOn && (
              <span className="text-[9px] ovline text-amber-400 border border-amber-800/50 px-2 py-0.5">
                Split lanes on
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          {/* Live broadcast banner — visible so staff know a message is on the
              TV, and can pull it down before the 15-minute expiry. */}
          {activeAlert && (
            <div className="flex items-center gap-2 border border-amber-800/60 bg-amber-900/10 px-2.5 py-1.5 max-w-[320px]">
              <span className="text-[11px] shrink-0">📢</span>
              <span className="text-[10px] text-amber-200/90 text-left leading-snug line-clamp-2">
                {activeAlert.message}
              </span>
              <button
                onClick={dismissAlert}
                title="Remove this message from the TV display"
                className="text-[9px] ovline border border-line px-2 py-0.5 text-ink-mute hover:text-ink hover:border-line-2 transition shrink-0"
              >
                Take down
              </button>
            </div>
          )}
          <div>
            <div className="ovline text-[9px]">Customer link</div>
            <a href={customerUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-gold-soft hover:text-gold underline-offset-2 hover:underline break-all">
              {customerUrl}
            </a>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAlertOpen(true)}
              className="text-[9px] border border-line px-2.5 py-1 text-ink-mute hover:text-amber-400 hover:border-amber-800 transition disabled:opacity-30 ovline"
              title="Post a message on the TV display and email everyone in the queue"
            >
              📢 Alert queue
            </button>
            {/* CLEAR QUEUE IS BEHIND A DISCLOSURE NOW.
                It cancels every remaining ticket, and it was sitting inches
                from controls pressed several times an hour. That is a
                foot-gun on a screen used at speed by someone who did not
                choose this software.

                It is also needed far less than it was: the nightly sweep now
                closes anything left open for 18 hours, which is what this
                button was really being used for. Kept, because end-of-day
                still happens; moved, because a destructive action should
                take one more press than a safe one. */}
            {moreOpen && (
              <button
                onClick={() => setClearConfirm(true)}
                disabled={waiting.length === 0 && !serving}
                className="text-[9px] border border-red-900/60 px-2.5 py-1 text-[#d49185] hover:border-red-900 transition disabled:opacity-30 ovline"
                title="Cancel all remaining tickets — end of day only"
              >
                🗑 Clear queue
              </button>
            )}
            <button
              onClick={() => setMoreOpen((x) => !x)}
              className="text-[9px] border border-line px-2.5 py-1 text-ink-mute hover:text-ink transition ovline"
              title="End-of-day and rarely used actions"
            >
              {moreOpen ? "Less" : "More"}
            </button>
            <button
              onClick={() => reload()}
              disabled={busy}
              className="text-[9px] border border-line px-2.5 py-1 text-ink-mute hover:text-ink hover:border-line-2 transition disabled:opacity-40 ovline"
              title="Force refresh — use this if a QR check-in isn't showing up"
            >
              ↺ Refresh
              {lastRefreshed && (
                <span className="ml-1.5 opacity-50">
                  {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-3 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
          {error}
        </div>
      )}

      <SetupChecklist branch={branch} />

      <div className="grid grid-cols-12 gap-3 mb-3">
        {/* Now Serving */}
        <Card luxe className="col-span-12 lg:col-span-8 p-8">
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-line">
            <span className="ovline text-[10px]">Now Serving</span>
            <div className="flex items-center gap-4">
              <span className="ovline text-[10px] text-[#9bbd9b] flex items-center">
                <span className="pip breathe mr-1.5" /> Counter 1 · Live
              </span>
            </div>
          </div>

          <div
            key={serving?.token || "empty"}
            className="drift-up gold-text font-display text-[96px] sm:text-[128px] font-light tracking-tightest leading-none"
          >
            {serving?.token || "—"}
          </div>
          <div className="text-sm text-ink-soft mt-4 mb-2 tracking-wide">
            {serving
              ? <>{serving.customer_name || <span className="text-ink-mute italic">Guest</span>} <span className="text-ink-mute">· {serving.customer_phone}</span></>
              : <span className="text-ink-mute">No customer in service</span>}
          </div>
          {serving && (() => {
            const svcName = serviceNameMap[serving.service_id] ?? "";
            const cx = getComplexity(svcName);
            const waitMin = serving.wait_minutes ?? 0;
            return (
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {svcName && (
                  <div className={"inline-flex items-center gap-2 text-[9px] border px-2.5 py-1 " + cx.color + " " + cx.border}>
                    <span>{cx.label}</span>
                    <span className="opacity-70">{svcName}</span>
                    <span className="opacity-50">·</span>
                    <span>~{durationStats[svcName]?.avg ?? cx.estimatedMin}m</span>
                    {durationStats[svcName] && (
                      <span className="opacity-50">({durationStats[svcName].count} actual samples)</span>
                    )}
                  </div>
                )}
                <span className="text-[9px] text-ink-mute border border-line px-2 py-0.5">
                  Waiting {waitMin} min
                </span>
              </div>
            );
          })()}

          {/* Bounce alert — shown when customer has been parked back multiple times */}
          {serving && (serving.bounce_count ?? 0) >= 2 && (
            <div className={`text-[11px] px-3 py-2 border flex items-center gap-2 mb-1 ${
              serving.bounce_count >= 3
                ? "border-red-900/40 bg-red-950/10 text-red-400"
                : "border-gold-deep/60 bg-[rgba(201,168,106,0.06)] text-gold-soft"
            }`}>
              <span>↩</span>
              <span>
                Returned to queue <strong>{serving.bounce_count}×</strong> — this customer may need
                {serving.bounce_count >= 3 ? " direct manager attention." : " a dedicated counter."}
              </span>
            </div>
          )}

          {/* Elapsed time + soft warning */}
          {serving && (
            <div className="flex items-center gap-3 mt-3">
              <span className="ovline text-[9px] text-ink-mute">
                Time: {String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:{String(elapsedSec % 60).padStart(2, "0")}
              </span>
              {elapsedSec >= 1800 && (
                <span className="text-[10px] text-gold-soft border border-gold-deep/40 px-2 py-0.5">
                  Need help? Reassign or call backup.
                </span>
              )}
            </div>
          )}

          {/* A paused queue is the single most important fact on this screen, so
          it goes above the hygiene nudge and the header. */}
      <div className="mb-5">
        <QueuePauseControl branch={branch} onChange={reloadBranches} waiting={waiting} />
      </div>

      {/* Fires once each time a NEW person is called, then removes itself
          after 40 calls. Scaffolding, not an alert — a permanent prompt would
          be ignored within a week, and the one message that has to land is
          this one. */}
      <CompleteReminder serving={serving} />

      {/* The second line. Renders nothing when empty, so it costs no
              space on a day with no drop-offs — and appears the moment there
              is something to chase, which is the only time it is useful. */}
          <div className="mt-6">
            <InReviewList
              branchId={branch?.id}
              branchName={branch?.name}
              branchSlug={branch?.slug}
              onChange={reload}
            />
          </div>

          <div className="rule-ornament my-7 text-[9px]"><span>✦</span></div>

          {/* WHICH BUTTON IS BIG DEPENDS ON WHAT IS HAPPENING.
              Complete used to be a ghost button sitting between Skip and
              Return, while "Call next customer" was large and primary. So the
              action required on every single visit looked optional, and the
              one that leaves the previous visit unrecorded looked like the
              main thing to press.

              That is not a training problem, it is the screen giving the
              wrong instruction — and it is the most likely cause of days
              where every ticket was closed in one burst at 5pm.

              With someone at the counter, finishing them is the next action
              and Complete is the large button. With nobody being served,
              calling the next person is, and it takes the emphasis back. */}
          {/* Who is at this counter. Sits with the buttons because it is part
              of the same action, and it only appears when there is more than
              one person to choose between. */}
          {staffList.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11.5px] text-ink-mute">Serving from this device:</span>
              <select
                value={servingStaffId}
                onChange={(e) => chooseServingStaff(e.target.value)}
                className="bg-bg-elev border border-line focus:border-gold-deep outline-none px-2.5 py-1.5 text-[12px] text-ink"
              >
                <option value="">Not set</option>
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.display_name || st.full_name || st.name || st.email || "Staff"}
                  </option>
                ))}
              </select>
              {!servingStaffId && (
                <span className="text-[11px] text-ink-mute">
                  — pick a name so visits are recorded against the right person
                </span>
              )}
            </div>
          )}

          {/* ONE BIG BUTTON, THEN EVERYTHING ELSE.
              There were five buttons here of near-equal weight — Complete,
              Call next, Skip, Return, Reassign — and the owner said plainly
              that the queue is too complex for his father to use. Five
              choices at the moment you finish with someone is four too many.

              Now there is one large action that covers the ordinary case,
              Reassign beside it for the one genuinely common exception, and
              the rare cases sit smaller underneath where they can still be
              reached but do not compete. */}
          <div className="flex flex-wrap gap-3 items-center">
            {serving ? (
              <button
                onClick={complete}
                disabled={busy}
                className="flex-1 min-w-[280px] bg-gold-deep/15 border-2 border-gold-deep text-ink hover:bg-gold-deep/25 transition disabled:opacity-40 px-8 py-6 text-left"
              >
                <div className="text-[19px] leading-tight">
                  Done with {serving.customer_name ? serving.customer_name.split(" ")[0] : serving.token}
                </div>
                <div className="text-[12.5px] text-ink-mute mt-1">
                  {waiting.length > 0
                    ? `Finish and call the next person · ${waiting.length} waiting`
                    : "Finish — nobody else is waiting"}
                </div>
              </button>
            ) : (
              <button
                onClick={startNext}
                disabled={busy || waiting.length === 0}
                className="flex-1 min-w-[280px] bg-gold-deep/15 border-2 border-gold-deep text-ink hover:bg-gold-deep/25 transition disabled:opacity-30 px-8 py-6 text-left"
              >
                <div className="text-[19px] leading-tight">
                  {waiting.length > 0 ? "Call the next person" : "Nobody waiting"}
                </div>
                <div className="text-[12.5px] text-ink-mute mt-1">
                  {waiting.length > 0
                    ? `${waiting.length} ${waiting.length === 1 ? "person" : "people"} in the queue`
                    : "The queue is empty"}
                </div>
              </button>
            )}

            {serving && (
              <ReassignMenu
                ticket={serving}
                staffList={staffList}
                onReassign={(staffId) => reassignTicket(serving.id, staffId)}
                onBackToQueue={sendBackToQueue}
                disabled={busy}
              />
            )}
            {(serving?.customer_email || serving?.customer_phone) && (
              <button
                onClick={() => sendYourTurn(serving)}
                disabled={smsSent[serving.id] === "sending"}
                title="Re-send the 'Your turn' notice on every channel we have"
                className={`text-[11px] px-3 py-1.5 border leading-none transition-colors ${
                  smsSent[serving.id] === "sent"
                    ? "border-[#506b50] text-[#9bbd9b]"
                    : smsSent[serving.id] === "error"
                    ? "border-red-800 text-red-400"
                    : smsSent[serving.id] === "sending"
                    ? "border-line text-ink-mute cursor-wait"
                    : "border-line text-ink-mute hover:border-[#74b9e8] hover:text-[#74b9e8]"
                }`}
              >
                {smsSent[serving.id] === "sent"
                  ? "Nudge sent ✓"
                  : smsSent[serving.id] === "error"
                  ? "Nudge failed ✗"
                  : smsSent[serving.id] === "sending"
                  ? "Sending…"
                  : SMS_ENABLED ? "📣 Nudge customer" : "✉ Nudge by email"}
              </button>
            )}
          </div>

          {/* The uncommon cases. Deliberately small and below the fold of the
              main action — they are needed a few times a week, not a few
              times an hour, and at full size they made the screen look like
              it was asking a question every time someone finished. */}
          {serving && (
            <div className="flex flex-wrap gap-4 items-center mt-4 pt-3 border-t border-line">
              <button
                onClick={skipServing}
                disabled={busy}
                className="text-[11.5px] text-ink-mute hover:text-ink transition disabled:opacity-40"
                title="They did not come to the counter"
              >
                Didn't show up
              </button>
              <button
                onClick={sendBackToQueue}
                disabled={busy}
                className="text-[11.5px] text-ink-mute hover:text-ink transition disabled:opacity-40"
                title="Put this customer back in the queue"
              >
                Back to the queue
              </button>
            </div>
          )}
        </Card>

        {/* Up Next */}
        <Card luxe className="col-span-12 lg:col-span-4">
          <CardHeader
            title="Up next"
            right={<span className="ovline text-[9px]">{waiting.length} waiting</span>}
          />
          {/* Drop-off batch banner */}
          {dropOffTickets.length > 0 && (
            <div className="mx-5 mt-2 mb-1 border border-emerald-800/50 bg-emerald-900/10 px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[9px] ovline text-emerald-400 mb-0.5">📦 Drop-offs in queue</div>
                <div className="text-[11px] text-ink-soft">
                  {dropOffTickets.length} drop-off{dropOffTickets.length > 1 ? "s" : ""}
                  {" "}· ~{dropOffTickets.length * 5}m total
                  {dropOffTickets.length > 1 && " · batch at any counter"}
                </div>
              </div>
              <span className="text-2xl font-light text-emerald-400 shrink-0">{dropOffTickets.length}</span>
            </div>
          )}

          {!queueLoaded ? (
            <div className="px-5 py-10 text-center text-ink-mute text-xs">
              Loading the queue…
            </div>
          ) : waiting.length === 0 ? (
            <div className="px-5 py-10 text-center text-ink-mute text-xs">
              Queue is empty.
              <div className="mt-2 text-[10px]">Share <span className="text-gold-soft">/q/{branch.slug}</span> with customers.</div>
            </div>
          ) : (
            waiting.slice(0, 8).map((t, i) => {
              const arrival = arrivalState(t.customer_distance_m);
              const isPriority = (t.priority ?? 0) > 0;
              const waitMin = t.wait_minutes ?? 0;
              const waitBorder =
                waitMin > 35 ? "border-l-2 border-l-[#b56b5f]" :
                waitMin > 20 ? "border-l-2 border-l-[#c9a86a]/60" : "";
              return (
                <div
                  key={t.id}
                  className={`px-5 py-3 border-b border-line last:border-b-0 grid grid-cols-[60px_1fr_auto_auto] gap-2 items-center ${
                    i === 0 ? "bg-[rgba(201,168,106,0.05)]" : ""
                  } ${waitBorder}`}
                >
                  <span className="font-display text-gold-soft text-sm flex items-center gap-1">
                    {isPriority && <span className="text-[#e4cb95] text-[10px]">★</span>}
                    {t.token}
                    {(t.bounce_count ?? 0) > 0 && (
                      <span
                        title={`Returned to queue ${t.bounce_count}× — may need attention`}
                        className={`text-[9px] font-mono px-1 leading-none rounded-sm ${
                          t.bounce_count >= 3
                            ? "bg-red-900/30 text-red-400"
                            : "bg-gold/10 text-gold-soft"
                        }`}
                      >
                        ↩{t.bounce_count}
                      </span>
                    )}
                  </span>
                  <div>
                    <div className="text-xs text-ink flex items-center gap-2">
                      {t.customer_name}
                      {arrival === "arrived" && (
                        <span className="text-[8px] text-[#9bbd9b] uppercase tracking-[0.2em] flex items-center">
                          <span className="pip breathe mr-1" style={{ background: "#9bbd9b" }} />
                          here
                        </span>
                      )}
                      {arrival === "approaching" && (
                        <span className="text-[8px] text-gold-soft uppercase tracking-[0.2em] flex items-center">
                          <span className="pip breathe mr-1" style={{ background: "#e4cb95" }} />
                          at door
                        </span>
                      )}
                    </div>
                    {/* Service name + wait time row */}
                    <div className="text-[10px] text-ink-mute flex items-center gap-2 mt-0.5">
                      {serviceNameMap[t.service_id] && (
                        <span>{serviceNameMap[t.service_id]}</span>
                      )}
                      <span className={
                        waitMin > 35 ? "text-[#d49185]" :
                        waitMin > 20 ? "text-[#c9a86a]" :
                        "text-ink-mute"
                      }>
                        · {waitMin} min wait
                      </span>
                      {arrival === "en_route" && (
                        <span className="text-[#74b9e8]">
                          · ETA {formatEta(t.customer_eta_sec)}
                        </span>
                      )}
                    </div>
                    {/* What they actually came in for, before they reach the
                        counter. `detail` is free text staff typed on a
                        previous visit or at handoff — "I-130, missing birth
                        certificate". Without it here, the first anyone knows
                        of a complex case is when the person is already
                        sitting down, which is exactly when it is most
                        expensive to discover it needs someone else. */}
                    {(t.detail || t.handoff_category) && (
                      <div className="text-[10.5px] mt-1 leading-snug flex items-start gap-1.5">
                        {/* A visit that ended "needs documents" is the one
                            worth seeing before you call the person — it is
                            the difference between a two-minute conversation
                            and a wasted counter slot. Amber, not red: it is
                            information, not a fault. */}
                        {t.handoff_category === "dropoff" && (
                          <span className="text-[9px] ovline text-amber-400 border border-amber-800/50 px-1.5 py-0.5 shrink-0">
                            Drop-off
                          </span>
                        )}
                        {t.detail && (
                          <span className="text-ink-soft">{t.detail}</span>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] text-ink-mute font-mono mt-0.5">
                      {t.customer_phone}
                    </div>
                    {personaCache[t.id] && (
                      <PersonaMini data={personaCache[t.id]} />
                    )}
                    {personaCache[t.id]?.customerId && loyaltyCards[personaCache[t.id].customerId] && (
                      <LoyaltyChip
                        card={loyaltyCards[personaCache[t.id].customerId]}
                        onBonus={() => addBonusPunch(branch.id, personaCache[t.id].customerId, t.id, null)
                          .then(({ rewardEarned, program }) => {
                            if (rewardEarned && program) setLoyaltyReward({ customerName: t.customer_name ?? "Customer", reward: program.reward_description });
                            getCustomerCard(branch.id, personaCache[t.id].customerId).then(card => {
                              if (card) setLoyaltyCards(prev => ({ ...prev, [personaCache[t.id].customerId]: card }));
                            }).catch(() => {});
                          }).catch(() => {})}
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={t.source === "book" ? "book" : "walk"}>
                      {t.source === "book" ? "Booking" : "Walk-in"}
                    </Badge>
                    {(() => {
                      const cx = getComplexity(serviceNameMap[t.service_id] ?? "");
                      return (
                        <span className={"text-[8px] border px-1.5 py-0.5 leading-none ovline " + cx.color + " " + cx.border}>
                          {cx.label} · ~{durationStats[serviceNameMap[t.service_id]]?.avg ?? cx.estimatedMin}m
                        </span>
                      );
                    })()}
                    {t.assigned_station_id && stationMap[t.assigned_station_id] && (
                      <span className="text-[9px] text-[#9bbd9b] tracking-[0.15em] uppercase border border-[#506b50] px-1.5 py-0.5 leading-none">
                        {stationMap[t.assigned_station_id]}
                      </span>
                    )}
                  </div>
                  {/* "Your turn" nudge — sends on every channel we have for them */}
                  {(t.customer_email || t.customer_phone) && (
                    <button
                      onClick={() => sendYourTurn(t)}
                      disabled={smsSent[t.id] === "sending"}
                      title={SMS_ENABLED ? "Send 'Your turn' by email and SMS" : "Send 'Your turn' by email"}
                      className={`text-[10px] px-2 py-1 border leading-none transition-colors ${
                        smsSent[t.id] === "sent"
                          ? "border-[#506b50] text-[#9bbd9b]"
                          : smsSent[t.id] === "error"
                          ? "border-red-800 text-red-400"
                          : smsSent[t.id] === "sending"
                          ? "border-line text-ink-mute cursor-wait"
                          : "border-line text-ink-mute hover:border-[#74b9e8] hover:text-[#74b9e8]"
                      }`}
                    >
                      {smsSent[t.id] === "sent"
                        ? "Sent ✓"
                        : smsSent[t.id] === "error"
                        ? "Failed ✗"
                        : smsSent[t.id] === "sending"
                        ? "…"
                        : SMS_ENABLED ? "📣 Nudge" : "✉ Email"}
                    </button>
                  )}
                  <TicketActionsMenu
                    ticket={t}
                    staffList={staffList}
                    isPriority={isPriority}
                    onEscalate={() => escalateTicket(t.id)}
                    onReassign={(staffId) => reassignTicket(t.id, staffId)}
                    onCancel={() => cancelTicket(t.id)}
                    disabled={busy}
                  />
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Waiting"    value={waiting.length} hint="Active queue" live />
        <Stat label="In service" value={serving ? 1 : 0} hint="Right now" />
        <Stat label="Served"     value={completedToday} hint="Today" accent />
        <Stat label="Scheduled"  value={scheduledCount} hint="Bookings today" />
        <Stat
          label="Avg service"
          value={avgServiceSec ? `${Math.round(avgServiceSec / 60)}m` : "—"}
          hint="Recent average"
        />
      </div>

      {/* Capacity system */}
      {(() => {
        const totalToday = waiting.length + (serving ? 1 : 0) + completedToday + scheduledCount;
        const atCapacity = capacityLimit > 0 && totalToday >= capacityLimit;
        const nearCapacity = capacityLimit > 0 && !atCapacity && totalToday >= capacityLimit * 0.8;
        return (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {atCapacity && (
              <div className="flex-1 border border-red-800 bg-red-950/10 px-4 py-2 flex items-center gap-3">
                <span className="text-red-400 text-lg">⚠</span>
                <div className="text-sm text-red-300">
                  Daily capacity reached <span className="font-mono text-red-400">({totalToday}/{capacityLimit})</span> — consider pausing walk-ins or redirecting customers.
                </div>
              </div>
            )}
            {nearCapacity && !atCapacity && (
              <div className="flex-1 border border-amber-800/60 bg-amber-950/10 px-4 py-2 flex items-center gap-3">
                <span className="text-amber-400 text-lg">◈</span>
                <div className="text-sm text-amber-300/80">
                  Approaching capacity — <span className="font-mono">{totalToday}/{capacityLimit}</span> slots used today.
                </div>
              </div>
            )}
            <div className="ml-auto shrink-0 relative">
              <button
                onClick={() => setShowLimitEditor((x) => !x)}
                className="text-[9px] border border-line px-2.5 py-1 text-ink-mute hover:text-ink hover:border-line-2 transition ovline"
              >
                {capacityLimit > 0 ? `Limit: ${capacityLimit}/day` : "Set daily limit"}
              </button>
              {showLimitEditor && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowLimitEditor(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-bg-elev border border-line shadow-lg p-3 w-52">
                    <div className="ovline text-[9px] mb-2 text-gold-soft">Daily capacity limit</div>
                    <div className="text-[10px] text-ink-mute mb-3">
                      Max walk-ins + bookings per day. Queue shows a warning when reached.
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={limitDraft}
                      onChange={(e) => setLimitDraft(e.target.value)}
                      placeholder="e.g. 50 (0 = no limit)"
                      className="w-full bg-bg border border-line px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-mute focus:border-gold-deep outline-none mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const v = parseInt(limitDraft, 10);
                          const safe = isNaN(v) || v < 0 ? 0 : v;
                          setCapacityLimit(safe);
                          localStorage.setItem(`queue-capacity-${branch.id}`, String(safe));
                          setShowLimitEditor(false);
                        }}
                        className="flex-1 text-[10px] bg-gold/10 border border-gold-deep text-gold-soft px-2 py-1.5 hover:bg-gold/20 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setCapacityLimit(0);
                          setLimitDraft("");
                          localStorage.removeItem(`queue-capacity-${branch.id}`);
                          setShowLimitEditor(false);
                        }}
                        className="text-[10px] border border-line text-ink-mute px-2 py-1.5 hover:text-ink transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}


      {/* ── Today's Schedule ──────────────────────────────────────── */}
      {scheduledCount > 0 && (
        <div className="mt-4 border border-line bg-bg-elev">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="ovline text-[9px] text-gold-soft">Today's Schedule</div>
              <span className="text-[9px] border border-line px-2 py-0.5 text-ink-mute">
                {scheduledCount} booking{scheduledCount !== 1 ? "s" : ""} total
              </span>
            </div>
            <div className="text-[10px] text-ink-mute">
              {upcomingBookings.length > 0
                ? `Next: ${new Date(upcomingBookings[0].scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "All done for today"}
            </div>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="px-5 py-6 text-center text-[11px] text-ink-mute">No more bookings scheduled for today.</div>
          ) : (
            <div className="divide-y divide-line">
              {upcomingBookings.map((bk) => {
                const svcName = serviceNameMap[bk.service_id] ?? "—";
                const assignedStaff = staffList.find((s) => s.id === bk.staff_id);
                const slotTime = new Date(bk.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const minutesAway = Math.round((new Date(bk.scheduled_at) - Date.now()) / 60000);
                const soon = minutesAway <= 15;
                return (
                  <div key={bk.id} className={`px-5 py-3 flex items-center gap-4 ${soon ? "bg-[rgba(201,168,106,0.04)]" : ""}`}>
                    <div className={`font-mono text-sm shrink-0 ${soon ? "text-gold-soft" : "text-ink-mute"}`}>{slotTime}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-ink truncate">{bk.customer_name || "—"}</div>
                      <div className="text-[10px] text-ink-mute truncate">{svcName}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {assignedStaff && (
                        <span className="text-[9px] border border-line px-1.5 py-0.5 text-ink-mute">{assignedStaff.display_name}</span>
                      )}
                      {soon && minutesAway > 0 && (
                        <span className="text-[9px] text-gold-soft border border-gold-deep/40 px-1.5 py-0.5">
                          in {minutesAway}m
                        </span>
                      )}
                      {minutesAway <= 0 && (
                        <span className="text-[9px] text-[#9bbd9b] border border-[#506b50] px-1.5 py-0.5">now</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {scheduledCount > upcomingBookings.length && (
                <div className="px-5 py-2 text-[10px] text-ink-mute text-center">
                  + {scheduledCount - upcomingBookings.length} more earlier today — view in Schedule tab
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Split-Lane View ───────────────────────────────────────── */}
      {splitLaneOn && waiting.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">

          {/* Fast Lane — quick + standard */}
          <div className="border border-emerald-800/40 bg-emerald-900/5">
            <div className="px-4 py-3 border-b border-emerald-800/40 flex items-center justify-between">
              <div className="ovline text-[9px] text-emerald-400">⚡ Fast Lane · Quick &amp; Standard</div>
              <span className="text-[9px] text-emerald-400">{fastLane.length} ticket{fastLane.length !== 1 ? "s" : ""}</span>
            </div>
            {fastLane.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-ink-mute">No quick or standard cases</div>
            ) : (
              fastLane.map((t) => {
                const svcName = serviceNameMap[t.service_id] ?? "";
                const cx      = getComplexity(svcName);
                const isDropOff = svcName.toLowerCase().includes("drop");
                const assignedStaff = staffList.find((s) => s.id === t.staff_id);
                const realAvg = durationStats[svcName]?.avg;
                const durMin  = realAvg ?? cx.estimatedMin;
                const hasReal = durationStats[svcName]?.count >= 5;
                return (
                  <div key={t.id} className={`px-4 py-3 border-b border-line last:border-b-0 flex items-center gap-3 ${t.is_premium ? "bg-[rgba(201,168,106,0.04)]" : ""}`}>
                    <span className="font-display text-gold-soft text-sm w-10 shrink-0">{t.token}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-xs text-ink truncate">{t.customer_name}</div>
                        {t.is_premium && (
                          <span className="text-[9px] text-gold-soft border border-gold/40 px-1 shrink-0">⭐ Senior</span>
                        )}
                      </div>
                      <div className={"text-[9px] flex items-center gap-1.5 " + cx.color}>
                        {isDropOff && <span>📦</span>}
                        <span>{cx.label}</span>
                        <span className="text-ink-mute">·</span>
                        <span className="text-ink-mute truncate">{svcName}</span>
                        <span className="text-ink-mute">·</span>
                        <span>{durMin}m{hasReal ? <span className="text-emerald-400 ml-0.5">✓</span> : ""}</span>
                        {t.is_premium && (
                          <>
                            <span className="text-ink-mute">·</span>
                            <span className="text-gold-soft">+${t.advisor_fee ?? 50} at counter</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      {assignedStaff ? (
                        <span className="text-[9px] text-ink-mute border border-line px-1.5 py-0.5">{assignedStaff.display_name}</span>
                      ) : (
                        <span className="text-[9px] text-ink-mute">Any</span>
                      )}
                      {/* Requested staff (different from assigned) */}
                      {t.requested_advisor_id && t.requested_advisor_id !== t.staff_id && (() => {
                        const req = staffList.find((s) => s.id === t.requested_advisor_id);
                        return req ? (
                          <span className="text-[9px] text-gold-soft/70">↳ wants {req.display_name}</span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Complex Lane — complex + extended */}
          <div className="border border-amber-800/40 bg-amber-900/5">
            <div className="px-4 py-3 border-b border-amber-800/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="ovline text-[9px] text-amber-400">◈ Complex Lane · Cases &amp; Extended</div>
                {complexLane.some((t) => !t.staff_id) && enrichedStaffList.length > 0 && (
                  <button
                    onClick={autoAssignComplex}
                    disabled={busy}
                    className="text-[9px] border border-amber-800/60 text-amber-400 px-2 py-0.5 hover:bg-amber-900/20 transition disabled:opacity-40 ovline"
                  >
                    Auto-assign
                  </button>
                )}
              </div>
              <span className="text-[9px] text-amber-400 shrink-0">{complexLane.length} ticket{complexLane.length !== 1 ? "s" : ""}</span>
            </div>
            {complexLane.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-ink-mute">No complex or extended cases</div>
            ) : (
              complexLane.map((t) => {
                const svcName       = serviceNameMap[t.service_id] ?? "";
                const cx            = getComplexity(svcName);
                const assignedStaff = staffList.find((s) => s.id === t.staff_id);
                const realAvg       = durationStats[svcName]?.avg;
                const durMin        = realAvg ?? cx.estimatedMin;
                const hasReal       = (durationStats[svcName]?.count ?? 0) >= 5;
                // Suggest best staff only if unassigned
                const suggestion    = !t.staff_id && enrichedStaffList.length
                  ? pickBestStaff(svcName, enrichedStaffList)
                  : null;
                return (
                  <div key={t.id} className={"px-4 py-3 border-b border-line last:border-b-0 " + (!t.staff_id ? "bg-amber-950/10" : "") + (t.is_premium ? " bg-[rgba(201,168,106,0.04)]" : "")}>
                    <div className="flex items-start gap-3">
                      <span className="font-display text-gold-soft text-sm w-10 shrink-0 mt-0.5">{t.token}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-xs text-ink truncate">{t.customer_name}</div>
                          {t.is_premium && (
                            <span className="text-[9px] text-gold-soft border border-gold/40 px-1 shrink-0">⭐ Senior</span>
                          )}
                        </div>
                        <div className={"text-[9px] flex items-center gap-1.5 " + cx.color}>
                          <span>{cx.label}</span>
                          <span className="text-ink-mute">·</span>
                          <span className="text-ink-mute truncate">{svcName}</span>
                          <span className="text-ink-mute">·</span>
                          <span>{durMin}m</span>
                          {hasReal && <span className="text-emerald-400">(real · {durationStats[svcName].count} cases)</span>}
                          {t.is_premium && (
                            <>
                              <span className="text-ink-mute">·</span>
                              <span className="text-gold-soft">+${t.advisor_fee ?? 50} at counter</span>
                            </>
                          )}
                        </div>
                        {/* Immigration note */}
                        {(svcName.toLowerCase().includes("immig") || svcName.toLowerCase().includes("visa") || svcName.toLowerCase().includes("i-") || svcName.toLowerCase().includes("n-4")) && (
                          <div className="text-[9px] text-amber-400/70 mt-0.5">Immigration — allow full appointment time</div>
                        )}
                        {/* Business tax note */}
                        {(svcName.toLowerCase().includes("business tax") || svcName.toLowerCase().includes("llc") || svcName.toLowerCase().includes("s-corp") || svcName.toLowerCase().includes("corporate")) && (
                          <div className="text-[9px] text-red-400/70 mt-0.5">Business tax — specialist required</div>
                        )}
                        {suggestion && (
                          <div className="text-[9px] text-ink-mute flex items-center gap-1.5 mt-1">
                            <span className="text-gold-soft">→</span>
                            <span>Suggested: <strong className="text-gold-soft">{suggestion.staffName}</strong></span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-1">
                        {assignedStaff ? (
                          <span className="text-[9px] text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5">{assignedStaff.display_name}</span>
                        ) : (
                          <span className="text-[9px] text-amber-400 border border-amber-800/50 px-1.5 py-0.5">Unassigned</span>
                        )}
                        {/* Requested staff */}
                        {t.requested_advisor_id && t.requested_advisor_id !== t.staff_id && (() => {
                          const req = staffList.find((s) => s.id === t.requested_advisor_id);
                          return req ? (
                            <span className="text-[9px] text-gold-soft/70">↳ wants {req.display_name}</span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ── Smart Queue Optimizer ─────────────────────────────────── */}
      {waiting.length > 0 && (
        <div className="mt-4 border border-line bg-bg-elev">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="ovline text-[9px] text-gold-soft">Queue Analysis</div>
              <div className={"text-[9px] border px-2 py-0.5 " + (
                queueAnalysis.staffingStatus === "overloaded" ? "border-red-800 text-red-400" :
                queueAnalysis.staffingStatus === "stretched"  ? "border-amber-800 text-amber-400" :
                "border-[#506b50] text-[#9bbd9b]"
              )}>
                {queueAnalysis.staffingStatus === "overloaded" ? "Overloaded" :
                 queueAnalysis.staffingStatus === "stretched"  ? "Stretched" : "On track"}
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-ink-mute">
              <span>~{queueAnalysis.projectedWaitMin}m projected wait</span>
              <span>{queueAnalysis.activeStaff} active staff</span>
            </div>
          </div>

          {/* Tier breakdown */}
          <div className="px-5 py-3 border-b border-line grid grid-cols-4 gap-3">
            {[
              { key: "quick",    label: "Quick",    icon: "⚡", color: "text-emerald-400" },
              { key: "standard", label: "Standard", icon: "◎",  color: "text-sky-400" },
              { key: "complex",  label: "Complex",  icon: "◈",  color: "text-amber-400" },
              { key: "extended", label: "Extended", icon: "⧖",  color: "text-red-400" },
            ].map(({ key, label, icon, color }) => (
              <div key={key} className="text-center">
                <div className={"text-xl font-light " + color}>{queueAnalysis.tally[key] ?? 0}</div>
                <div className="text-[9px] text-ink-mute ovline mt-0.5">{icon} {label}</div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {queueAnalysis.recommendations.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-2 gap-3">
                <div className="ovline text-[9px] text-ink-mute">Recommendations</div>
                {complexLane.some((t) => !t.staff_id) && enrichedStaffList.length > 0 && (
                  <button
                    onClick={autoAssignComplex}
                    disabled={busy}
                    className="text-[9px] border border-amber-800/50 text-amber-400 px-2 py-0.5 ovline hover:bg-amber-900/20 transition disabled:opacity-40 shrink-0"
                    title="Auto-assign unassigned complex/extended tickets to the best available specialist"
                  >
                    Auto-assign complex →
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {queueAnalysis.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-2 text-xs text-ink-soft">
                    <span className="text-gold-soft shrink-0">→</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
              {/* Real-data adaptive duration note */}
              {Object.values(durationStats).some((s) => s.count >= 5) && (
                <div className="mt-2 text-[10px] text-emerald-400/80 flex items-center gap-1.5">
                  <span>✦</span>
                  <span>Wait estimates are using real-case averages — schedule adapts automatically as more data accumulates.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Escalation panel ─────────────────────────────────────────── */}
      {slaEnabled && escalations.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="ovline text-[9px] text-red-400 flex items-center gap-2">
              <span className="pip bg-red-500 animate-pulse" />
              {escalations.length} open escalation{escalations.length !== 1 ? "s" : ""}
            </div>
            {!isManager && (
              <span className="text-[9px] text-ink-mute border border-line px-2 py-0.5">
                Manager override required to act
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {escalations.map((esc) => {
              const ticket   = esc.tickets ?? {};
              const isBreach = esc.level === "breach";
              const isBounce = esc.reason === "bounce_excessive";
              const icon     = isBounce ? "↩" : "⏱";

              return (
                <div
                  key={esc.id}
                  className={`border px-4 py-3 flex items-center gap-3 ${
                    isBreach ? "border-red-800 bg-red-950/10" : "border-amber-800/50 bg-amber-950/10"
                  }`}
                >
                  <span className={`text-lg ${isBreach ? "text-red-400" : "text-amber-400"}`}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-ink flex items-center gap-2 flex-wrap">
                      <span className="font-display text-gold-soft">{ticket.token}</span>
                      <span>{ticket.customer_name}</span>
                      <span className={`text-[9px] border px-1.5 py-0.5 leading-none ${
                        isBreach ? "border-red-800 text-red-400" : "border-amber-800 text-amber-400"
                      }`}>
                        {isBreach ? "Breach" : "Warning"}
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-mute mt-0.5">
                      {isBounce
                        ? `Returned to queue ${ticket.bounce_count || 0}x — customer may need direct attention`
                        : "Waiting beyond SLA threshold — act now"}
                    </div>
                  </div>
                  {isManager && (
                    <button
                      onClick={() => handleResolveEscalation(esc.id)}
                      disabled={busy}
                      className="text-[10px] border border-line px-2.5 py-1 text-ink-mute hover:text-[#9bbd9b] hover:border-[#506b50] transition disabled:opacity-40 shrink-0"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested action, bottom-left. Sits opposite the AI Assist dock so
          the two never overlap. Renders nothing unless something is actually
          worth saying. */}
      <QueueNudge branch={branch} waiting={waiting} serving={serving} />

      {/* One question when a visit ends. See CompletePanel for why it is four
          options and not a form. */}
      {completing && (
        <CompletePanel
          ticket={completing.ticket}
          busy={busy}
          onResolve={resolveComplete}
          onCancel={() => setCompleting(null)}
        />
      )}
    </div>
  );
}

/* ── TicketActionsMenu ───────────────────────────────────────────────── */
function TicketActionsMenu({ ticket, staffList, isPriority, onEscalate, onReassign, onCancel, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((x) => !x)}
        disabled={disabled}
        className="text-ink-mute hover:text-ink text-xs px-2 py-1 border border-transparent hover:border-line transition disabled:opacity-40"
        title="Actions"
      >
        ···
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-bg-elev border border-line shadow-lg min-w-[160px] py-1">
            {!isPriority && (
              <button
                onClick={() => { setOpen(false); onEscalate(); }}
                className="w-full text-left px-4 py-2 text-[11px] text-ink-soft hover:text-ink hover:bg-white/[0.03] transition"
              >
                Escalate to front
              </button>
            )}
            {staffList.length > 1 && staffList.map((s) => (
              <button
                key={s.id}
                onClick={() => { setOpen(false); onReassign(s.id); }}
                className="w-full text-left px-4 py-2 text-[11px] text-ink-soft hover:text-ink hover:bg-white/[0.03] transition"
              >
                Assign to {s.display_name}
              </button>
            ))}
            <div className="border-t border-line/50 my-1" />
            <button
              onClick={() => { setOpen(false); onCancel(); }}
              className="w-full text-left px-4 py-2 text-[11px] text-red-400/80 hover:text-red-400 hover:bg-white/[0.03] transition"
            >
              Cancel ticket
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── ReassignMenu ───────────────────────────────────────────────────── */
function ReassignMenu({ ticket, staffList, onReassign, onBackToQueue, disabled }) {
  const [open, setOpen] = useState(false);

  /* Green, and sized to sit beside the main action rather than beneath it.
     This is the one exception that happens often in a two-person office:
     someone reaches the counter and turns out to need the other person —
     a notarisation, a complex case. Making it hard to reach is how a
     customer ends up waiting through a second full queue cycle.

     Green because it is not a warning and not the primary path. Gold is
     "finish this", red is "something is wrong"; handing work to a
     colleague is neither. */
  const others = (staffList ?? []).filter((s) => s.id !== ticket?.staff_id);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((x) => !x)}
        disabled={disabled}
        className="border-2 border-[#506b50] text-[#9bbd9b] hover:bg-[rgba(80,107,80,0.15)] transition disabled:opacity-40 px-6 py-6 text-left min-w-[190px]"
      >
        <div className="text-[15px] leading-tight">Hand over</div>
        <div className="text-[11.5px] text-[#9bbd9b]/70 mt-1">
          Someone else takes this
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-bg-elev border border-[#506b50]/60 shadow-lg min-w-[240px] py-1">
            {others.length > 0 && (
              <div className="px-4 pt-2 pb-1 text-[9px] ovline text-ink-mute">
                To a person
              </div>
            )}
            {others.map((s) => (
              <button
                key={s.id}
                onClick={() => { setOpen(false); onReassign(s.id); }}
                className="w-full text-left px-4 py-2.5 text-[12.5px] text-ink-soft hover:text-ink hover:bg-white/[0.03] transition"
              >
                {s.display_name}
              </button>
            ))}

            {/* Back to the line, for when it is not a specific person's job —
                just "not mine". Without this, staff either guess at a name or
                leave the ticket sitting on them. */}
            {onBackToQueue && (
              <>
                <div className="border-t border-line mt-1 pt-1">
                  <div className="px-4 pt-1 pb-1 text-[9px] ovline text-ink-mute">
                    Or
                  </div>
                  <button
                    onClick={() => { setOpen(false); onBackToQueue(); }}
                    className="w-full text-left px-4 py-2.5 text-[12.5px] text-ink-soft hover:text-ink hover:bg-white/[0.03] transition"
                  >
                    Put back in the line
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── PersonaMini ─────────────────────────────────────────────────────────
   Compact customer context shown under a waiting ticket:
   new-vs-returning, visit count, average satisfaction, AI persona blurb.
   `data` comes from personaCache[ticketId]:
     { isNew, visitCount, persona, avgScore, customerId }                  */
function PersonaMini({ data }) {
  if (!data) return null;
  const { isNew, visitCount, persona, avgScore } = data;

  const chips = [];
  if (isNew) {
    chips.push(
      <span key="new" className="border border-[#74b9e8]/40 text-[#74b9e8] px-1.5 py-px">
        New
      </span>
    );
  } else if (visitCount > 1) {
    chips.push(
      <span key="visits" className="border border-line text-ink-mute px-1.5 py-px">
        {visitCount} visits
      </span>
    );
  }
  if (avgScore != null) {
    const good = avgScore >= 4;
    chips.push(
      <span
        key="score"
        className={`border px-1.5 py-px ${good ? "border-[#506b50] text-[#9bbd9b]" : "border-[#b56b5f]/40 text-[#d49185]"}`}
        title="Average satisfaction score"
      >
        ★ {avgScore}
      </span>
    );
  }

  if (chips.length === 0 && !persona) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[9px] tracking-wide">{chips}</div>
      )}
      {persona && (
        <div className="text-[10px] text-ink-mute italic leading-snug line-clamp-2">
          {persona}
        </div>
      )}
    </div>
  );
}

/* ── LoyaltyChip ─────────────────────────────────────────────────────── */
function LoyaltyChip({ card, onBonus }) {
  const dots = punchDots(card, card.program);
  const unclaimed = hasUnclaimedReward(card);
  return (
    <div className={`border px-2 py-1.5 mt-1 ${unclaimed ? "border-gold bg-gold/10" : "border-line bg-bg"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="ovline text-[7px] text-gold-soft">
          {unclaimed ? "🎁 Reward ready!" : `🎟 ${card.current_punches}/${card.program?.punches_required} punches`}
        </span>
        <button
          onClick={onBonus}
          className="text-[7px] ovline text-gold-soft border border-gold-deep px-1.5 py-0.5 hover:bg-gold-deep/20 transition"
        >
          + bonus
        </button>
      </div>
      {!unclaimed && dots.length > 0 && (
        <div className="flex gap-0.5 flex-wrap">
          {dots.map((filled, i) => (
            <span key={i} className={`w-2 h-2 rounded-full border ${filled ? "bg-gold border-gold" : "border-line"}`} />
          ))}
        </div>
      )}
      {unclaimed && (
        <div className="text-[9px] text-gold-soft">{card.program?.reward_description}</div>
      )}
    </div>
  );
}

/* ── RewardToast ─────────────────────────────────────────────────────── */
function RewardToast({ reward, onClose }) {
  if (!reward) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-bg-elev border border-gold shadow-2xl p-5 max-w-xs drift-up">
      <div className="text-2xl mb-2">🎉</div>
      <div className="text-sm font-medium text-gold-soft mb-1">Loyalty reward earned!</div>
      <div className="text-xs text-ink-soft mb-1">
        <span className="text-ink font-medium">{reward.customerName}</span> just hit their punch goal.
      </div>
      <div className="text-xs text-gold-soft italic mb-3">"{reward.reward}"</div>
      <button
        onClick={onClose}
        className="text-[10px] ovline text-ink-mute border border-line px-3 py-1 hover:border-gold-deep transition w-full"
      >
        Got it — tell the customer
      </button>
    </div>
  );
}


/* ── SatisfactionSurvey ─────────────────────────────────────────────── */
function SatisfactionSurvey({ ticket, busy, onSubmit, onSkip }) {
  const [score, setScore] = useState(0);
  const [note,  setNote]  = useState("");

  const emojis = [
    { v: 1, label: "😞", title: "Very dissatisfied" },
    { v: 2, label: "😕", title: "Dissatisfied" },
    { v: 3, label: "😐", title: "Neutral" },
    { v: 4, label: "😊", title: "Satisfied" },
    { v: 5, label: "😄", title: "Very satisfied" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-elev border border-line shadow-2xl max-w-sm w-full mx-4 p-7">
        <div className="ovline text-gold-soft mb-1 text-[9px]">How did it go?</div>
        <h2 className="font-display text-2xl font-light tracking-tightest mb-1">
          Rate this visit
        </h2>
        <div className="text-xs text-ink-mute mb-5">
          {ticket.customer_name ?? ticket.token}
          {ticket.service_name ? <span className="ml-2 text-ink-soft">· {ticket.service_name}</span> : null}
        </div>

        {/* Emoji rating */}
        <div className="flex justify-between mb-5">
          {emojis.map(({ v, label, title }) => (
            <button
              key={v}
              title={title}
              onClick={() => setScore(v)}
              className={`text-3xl transition-transform ${
                score === v ? "scale-125" : "opacity-40 hover:opacity-70 hover:scale-110"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Optional note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          rows={2}
          className="w-full bg-bg border border-line focus:border-gold-deep outline-none text-sm px-3 py-2 text-ink placeholder:text-ink-mute resize-none transition mb-4"
        />

        <div className="flex gap-3">
          <button
            onClick={() => onSubmit(score, note)}
            disabled={busy || score === 0}
            className="flex-1 bg-gold text-[#141410] text-xs font-medium py-2.5 tracking-wide disabled:opacity-40 transition hover:opacity-90"
          >
            {busy ? "Completing…" : "Complete visit"}
          </button>
          <button
            onClick={onSkip}
            disabled={busy}
            className="text-xs text-ink-mute border border-line px-4 py-2.5 hover:border-line-2 transition disabled:opacity-40"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── InterceptModal ─────────────────────────────────────────────────── */
// Shown when staff taps "Call next" while a customer is still being served.
// Forces them to resolve the current visit before moving on.
function InterceptModal({ ticket, busy, onComplete, onReturn, onNoShow, onDismiss }) {
  if (!ticket) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg border border-line p-7 max-w-sm w-full mx-4">
        <div className="ovline text-[9px] text-ink-mute mb-4">Finish current visit first</div>
        <div className="text-base font-medium text-ink mb-1">
          {ticket.customer_name || ticket.token} is still at the counter
        </div>
        <div className="text-xs text-ink-soft mb-6">
          Resolve this visit before calling the next customer.
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onComplete}
            disabled={busy}
            className="w-full bg-gold text-[#141410] text-xs font-medium py-2.5 tracking-wide disabled:opacity-40 transition hover:opacity-90"
          >
            Complete visit → call next
          </button>
          <button
            onClick={onReturn}
            disabled={busy}
            className="w-full border border-line text-xs text-ink py-2.5 tracking-wide hover:border-line-2 transition disabled:opacity-40"
          >
            Return to queue → call next
          </button>
          <button
            onClick={onNoShow}
            disabled={busy}
            className="w-full border border-line text-xs text-ink-mute py-2.5 tracking-wide hover:border-line-2 transition disabled:opacity-40"
          >
            No-show → call next
          </button>
        </div>

        <button
          onClick={onDismiss}
          disabled={busy}
          className="mt-4 w-full text-[10px] ovline text-ink-mute hover:text-ink transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
