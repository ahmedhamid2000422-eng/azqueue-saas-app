import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { useBranch } from "../../lib/BranchContext";
import { useAutopilot } from "../../hooks/useAutopilot";
import { logServiceTime } from "../../lib/autopilot";
import { sendCallNotice, sendThanks } from "../../lib/notifications";
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

  // Escalation state
  const [escalations, setEscalations] = useState([]);
  const slaEnabled   = getLimits(user).opsSla;
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
      const fullCols = "id, token, status, customer_name, customer_phone, service_id, staff_id, priority, source, created_at, called_at, started_at, completed_at, branch_id, notes, assigned_station_id, bounce_count";
      const baseCols = "id, token, status, customer_name, customer_phone, service_id, staff_id, priority, source, created_at, called_at, started_at, completed_at, branch_id, notes";

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

  /* ── Load capacity limit from localStorage when branch is known ── */
  useEffect(() => {
    if (!branch?.id) return;
    const stored = localStorage.getItem(`queue-capacity-${branch.id}`);
    const parsed = stored ? parseInt(stored, 10) : 0;
    setCapacityLimit(isNaN(parsed) ? 0 : parsed);
    setLimitDraft(stored ?? "");
  }, [branch?.id]);

  /* ── Derived ───────────────────────────────────────────────────── */
  const serving = useMemo(() => tickets.find((t) => t.status === "serving"), [tickets]);
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
  const [staffList, setStaffList] = useState([]);

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

  async function callNext() {
    if (waiting.length === 0) return;
    setBusy(true);
    setError(null);
    const next = waiting[0];
    const now = new Date().toISOString();

    if (serving) {
      const { error: e1 } = await supabase
        .from("tickets")
        .update({ status: "completed", completed_at: now })
        .eq("id", serving.id);
      if (e1) { setBusy(false); return setError(e1.message); }
      logServiceTime({
        branchId: serving.branch_id, ticketId: serving.id, serviceId: serving.service_id,
        staffId: serving.staff_id, startedAt: serving.started_at, completedAt: now,
      });
      sendThanks(serving.id);
      // Save customer record when a ticket is auto-completed by calling next
      if (serving.customer_name || serving.customer_phone) {
        findOrCreateCustomer(branch.id, {
          name:  serving.customer_name,
          phone: serving.customer_phone,
        }).then(async (cust) => {
          if (!cust) return;
          const svcName = serviceNameMap[serving.service_id] ?? "";
          await logQueueEvent(cust.id, branch.id, "queue_complete", {
            ticketId: serving.id,
            token:    serving.token,
            service:  svcName,
            staffId:  serving.staff_id,
          }).catch(() => {});
          generatePersona(cust.id, branch.id).catch(() => {});
        }).catch(() => {});
      }
    }

    const { error: e2 } = await supabase
      .from("tickets")
      .update({ status: "serving", called_at: now, started_at: now })
      .eq("id", next.id);
    if (e2) { setBusy(false); return setError(e2.message); }

    sendCallNotice(next.id);
    await reload();
    setBusy(false);
  }

  // Opens the satisfaction survey before completing the ticket
  function complete() {
    if (!serving) return;
    setSurveyTicket(serving);
    setSurveyScore(0);
    setSurveyNote("");
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

  /* ── Autopilot ─────────────────────────────────────────────────── */
  const autopilot = useAutopilot({
    branch,
    serving,
    waiting,
    onCallNext: callNext,
  });

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
      {/* ── Satisfaction Survey Modal ─────────────────────────────────── */}
      {surveyTicket && (
        <SatisfactionSurvey
          ticket={surveyTicket}
          busy={surveyBusy}
          onSubmit={(score, note) => submitSurveyAndComplete(score, note)}
          onSkip={() => submitSurveyAndComplete(0, "")}
        />
      )}
      <RewardToast
        reward={loyaltyReward}
        onClose={() => setLoyaltyReward(null)}
      />
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
            {waiting.length > 0 && (
              <button
                onClick={() => setSmartSortOn((x) => !x)}
                className={"text-[9px] border px-2 py-0.5 ovline transition " + (smartSortOn ? "border-gold-deep text-gold-soft" : "border-line text-ink-mute hover:border-line-2")}
                title="Smart sort: quick cases first, complex cases last — keeps the line moving"
              >
                {smartSortOn ? "Smart sort ON" : "Smart sort"}
              </button>
            )}
            {waiting.length > 0 && (
              <button
                onClick={() => setSplitLaneOn((x) => !x)}
                className={"text-[9px] border px-2 py-0.5 ovline transition " + (splitLaneOn ? "border-amber-800 text-amber-400" : "border-line text-ink-mute hover:border-line-2")}
                title="Split-lane view: Fast Lane (quick/standard) on the left, Complex Lane (complex/extended) on the right"
              >
                {splitLaneOn ? "Split lanes ON" : "Split lanes"}
              </button>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <div>
            <div className="ovline text-[9px]">Customer link</div>
            <a href={customerUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-gold-soft hover:text-gold underline-offset-2 hover:underline break-all">
              /q/{branch.slug}
            </a>
          </div>
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
              {autopilot.enabled && (
                <span className="ovline text-[10px] text-gold-soft flex items-center">
                  <span className="pip breathe mr-1.5" style={{ background: "#c9a86a" }} />
                  {autopilot.paused
                    ? `Autopilot · ${autopilot.pausedReason}`
                    : autopilot.secondsUntilNext != null
                      ? `Autopilot · next in ${formatSec(autopilot.secondsUntilNext)}`
                      : `Autopilot · ${autopilot.avgServiceSec ? "calibrated" : "learning"}`}
                </span>
              )}
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
              ? <>{serving.customer_name} <span className="text-ink-mute">· {serving.customer_phone}</span></>
              : <span className="text-ink-mute">No customer in service</span>}
          </div>
          {serving && (() => {
            const svcName = serviceNameMap[serving.service_id] ?? "";
            const cx = getComplexity(svcName);
            return svcName ? (
              <div className={"inline-flex items-center gap-2 text-[9px] border px-2.5 py-1 mb-1 " + cx.color + " " + cx.border}>
                <span>{cx.label}</span>
                <span className="opacity-70">{svcName}</span>
                <span className="opacity-50">·</span>
                <span>~{durationStats[svcName]?.avg ?? cx.estimatedMin}m</span>
                {durationStats[svcName] && (
                  <span className="opacity-50">({durationStats[svcName].count} actual samples)</span>
                )}
              </div>
            ) : null;
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
                Parked back <strong>{serving.bounce_count}×</strong> — this customer may need
                {serving.bounce_count >= 3 ? " direct manager attention." : " a dedicated counter."}
              </span>
            </div>
          )}

          <div className="rule-ornament my-7 text-[9px]"><span>✦</span></div>

          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={callNext} disabled={busy || waiting.length === 0} size="lg">
              Call next customer →
            </Button>
            <Button variant="ghost" onClick={complete} disabled={busy || !serving}>
              Complete
            </Button>
            <Button variant="ghost" onClick={skipServing} disabled={busy || !serving}>
              Skip
            </Button>
            <Button variant="ghost" onClick={sendBackToQueue} disabled={busy || !serving} title="Park this customer back in the queue">
              Park
            </Button>
            {serving && staffList.length > 1 && (
              <ReassignMenu
                ticket={serving}
                staffList={staffList}
                onReassign={(staffId) => reassignTicket(serving.id, staffId)}
                disabled={busy}
              />
            )}
          </div>
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

          {waiting.length === 0 ? (
            <div className="px-5 py-10 text-center text-ink-mute text-xs">
              Queue is empty.
              <div className="mt-2 text-[10px]">Share <span className="text-gold-soft">/q/{branch.slug}</span> with customers.</div>
            </div>
          ) : (
            waiting.slice(0, 8).map((t, i) => {
              const arrival = arrivalState(t.customer_distance_m);
              const isPriority = (t.priority ?? 0) > 0;
              return (
                <div
                  key={t.id}
                  className={`px-5 py-3 border-b border-line last:border-b-0 grid grid-cols-[60px_1fr_auto_auto] gap-2 items-center ${
                    i === 0 ? "bg-[rgba(201,168,106,0.05)]" : ""
                  }`}
                >
                  <span className="font-display text-gold-soft text-sm flex items-center gap-1">
                    {isPriority && <span className="text-[#e4cb95] text-[10px]">★</span>}
                    {t.token}
                    {(t.bounce_count ?? 0) > 0 && (
                      <span
                        title={`Parked back ${t.bounce_count}× — may need attention`}
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
                    <div className="text-[10px] text-ink-mute font-mono flex items-center gap-2">
                      <span>{t.customer_phone}</span>
                      {arrival === "en_route" && (
                        <span className="text-[#74b9e8]">
                          · ETA {formatEta(t.customer_eta_sec)}
                        </span>
                      )}
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
          value={autopilot.avgServiceSec ? `${Math.round(autopilot.avgServiceSec / 60)}m` : "—"}
          hint={autopilot.avgServiceSec ? "Rolling avg" : "Learning…"}
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
                  <div key={t.id} className="px-4 py-3 border-b border-line last:border-b-0 flex items-center gap-3">
                    <span className="font-display text-gold-soft text-sm w-10 shrink-0">{t.token}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-ink truncate">{t.customer_name}</div>
                      <div className={"text-[9px] flex items-center gap-1.5 " + cx.color}>
                        {isDropOff && <span>📦</span>}
                        <span>{cx.label}</span>
                        <span className="text-ink-mute">·</span>
                        <span className="text-ink-mute truncate">{svcName}</span>
                        <span className="text-ink-mute">·</span>
                        <span>{durMin}m{hasReal ? <span className="text-emerald-400 ml-0.5">✓</span> : ""}</span>
                      </div>
                    </div>
                    {assignedStaff ? (
                      <span className="text-[9px] text-ink-mute shrink-0 border border-line px-1.5 py-0.5">{assignedStaff.display_name}</span>
                    ) : (
                      <span className="text-[9px] text-ink-mute shrink-0">Any</span>
                    )}
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
                  <div key={t.id} className={"px-4 py-3 border-b border-line last:border-b-0 " + (!t.staff_id ? "bg-amber-950/10" : "")}>
                    <div className="flex items-start gap-3">
                      <span className="font-display text-gold-soft text-sm w-10 shrink-0 mt-0.5">{t.token}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-ink truncate">{t.customer_name}</div>
                        <div className={"text-[9px] flex items-center gap-1.5 " + cx.color}>
                          <span>{cx.label}</span>
                          <span className="text-ink-mute">·</span>
                          <span className="text-ink-mute truncate">{svcName}</span>
                          <span className="text-ink-mute">·</span>
                          <span>{durMin}m</span>
                          {hasReal && <span className="text-emerald-400">(real · {durationStats[svcName].count} cases)</span>}
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
                      <div className="shrink-0 text-right">
                        {assignedStaff ? (
                          <span className="text-[9px] text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5">{assignedStaff.display_name}</span>
                        ) : (
                          <span className="text-[9px] text-amber-400 border border-amber-800/50 px-1.5 py-0.5">Unassigned</span>
                        )}
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
                        ? `Parked back ${ticket.bounce_count || 0}x — customer may need direct attention`
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
function ReassignMenu({ ticket, staffList, onReassign, disabled }) {
  const [open, setOpen] = useState(false);
  if (!staffList || staffList.length <= 1) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((x) => !x)}
        disabled={disabled}
        className="text-[10px] text-ink-mute hover:text-ink border border-line px-2.5 py-1 transition disabled:opacity-40"
      >
        Reassign
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-bg-elev border border-line shadow-lg min-w-[160px] py-1">
            {staffList.map((s) => (
              <button
                key={s.id}
                onClick={() => { setOpen(false); onReassign(s.id); }}
                className="w-full text-left px-4 py-2 text-[11px] text-ink-soft hover:text-ink hover:bg-white/[0.03] transition"
              >
                {s.display_name}
                {ticket?.staff_id === s.id && (
                  <span className="text-[9px] text-gold-soft ml-2">current</span>
                )}
              </button>
            ))}
          </div>
        </>
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
