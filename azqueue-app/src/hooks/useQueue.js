import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendCalledNotification } from "../lib/notify";

/**
 * useQueue — all queue state and mutations for ONE staff member at ONE branch.
 *
 * Takes the resolved staff + branch + station objects from useStaff() so it
 * never has to re-fetch identity itself.
 *
 * Returns:
 *   waiting           — tickets with status='waiting', priority desc → created_at asc
 *   serving           — the single ticket this staff member is currently serving (or null)
 *   loading           — true during initial fetch
 *   error             — last mutation error string, or null
 *   busy              — true while a mutation is in flight
 *   callNext()        — atomically claims oldest waiting ticket → serving
 *                       returns the claimed ticket, or null if queue empty / error
 *   completeServing() — sets status='completed', completed_at=now()
 *   noShow()          — sets status='cancelled', notes='no_show'
 *   returnToQueue()   — clears staff_id + called_at, leaves priority + created_at untouched
 *
 * callNext atomicity:
 *   Uses the `claim_next_ticket` Postgres RPC which runs a single
 *   UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *.
 *   This prevents two staff members claiming the same ticket when they
 *   both tap "Call next" at the same moment.
 *
 *   SQL to deploy in Supabase SQL editor:
 *   ─────────────────────────────────────────────────────────────────
 *   CREATE OR REPLACE FUNCTION claim_next_ticket(
 *     p_branch_id  uuid,
 *     p_staff_id   uuid,
 *     p_station_id uuid
 *   )
 *   RETURNS SETOF tickets
 *   LANGUAGE plpgsql
 *   SECURITY DEFINER
 *   AS $$
 *   BEGIN
 *     RETURN QUERY
 *     UPDATE tickets
 *     SET
 *       status              = 'serving',
 *       staff_id            = p_staff_id,
 *       assigned_station_id = p_station_id,
 *       called_at           = now()
 *     WHERE id = (
 *       SELECT id
 *       FROM   tickets
 *       WHERE  branch_id  = p_branch_id
 *         AND  status     = 'waiting'
 *         AND  created_at <= now()
 *       ORDER  BY priority DESC, created_at ASC
 *       LIMIT  1
 *       FOR UPDATE SKIP LOCKED
 *     )
 *     RETURNING *;
 *   END;
 *   $$;
 *   ─────────────────────────────────────────────────────────────────
 *
 * Realtime: ONE subscription per mount, filtered to branch_id. Unsubscribes on unmount.
 * Mutations: optimistic update first, rollback to last known good state on error.
 */
export function useQueue({ staff, branch, station }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(false);

  // Snapshot before each optimistic update — used to roll back on error.
  const prevTicketsRef = useRef([]);

  // ── Initial fetch ─────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    if (!branch?.id) return;

    const { data, error: fetchErr } = await supabase
      .from("tickets")
      .select(
        "id, token, status, customer_name, customer_phone, service_id, staff_id, " +
        "assigned_station_id, priority, source, created_at, called_at, " +
        "completed_at, notes, branch_id"
      )
      .eq("branch_id", branch.id)
      .in("status", ["waiting", "serving"])
      .lte("created_at", new Date().toISOString()) // exclude future-dated rows
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });

    if (fetchErr) {
      console.error("[useQueue] fetch error:", fetchErr);
      return;
    }

    setTickets(data ?? []);
    setLoading(false);
  }, [branch?.id]);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  // ── Realtime subscription (one per mount) ─────────────────────────
  useEffect(() => {
    if (!branch?.id) return;

    const channel = supabase
      .channel(`queue-branch-${branch.id}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "tickets",
          filter: `branch_id=eq.${branch.id}`,
        },
        () => fetchTickets()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [branch?.id, fetchTickets]);

  // ── Derived slices ────────────────────────────────────────────────
  // wait_minutes is computed client-side from created_at — no extra DB call.
  const waiting = useMemo(
    () =>
      tickets
        .filter((t) => t.status === "waiting")
        .map((t) => ({
          ...t,
          wait_minutes: Math.round(
            (Date.now() - new Date(t.created_at)) / 60000
          ),
        })),
    [tickets]
  );

  const serving = useMemo(
    () => {
      const t = tickets.find(
        (t) => t.status === "serving" && t.staff_id === staff?.id
      ) ?? null;
      if (!t) return null;
      return {
        ...t,
        wait_minutes: Math.round(
          (Date.now() - new Date(t.created_at)) / 60000
        ),
      };
    },
    [tickets, staff?.id]
  );

  // ── Optimistic helpers ────────────────────────────────────────────
  function snapshot() {
    prevTicketsRef.current = tickets;
  }
  function rollback() {
    setTickets(prevTicketsRef.current);
  }

  // ── callNext ─────────────────────────────────────────────────────
  // Calls the `claim_next_ticket` RPC which does a single atomic
  // UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *.
  // No separate SELECT — no TOCTOU window.
  const callNext = useCallback(async () => {
    if (!staff?.id || !branch?.id) return null;
    if (waiting.length === 0) return null;

    setBusy(true);
    setError(null);

    // Optimistically promote the first waiting ticket so the UI is instant.
    const optimisticTarget = waiting[0];
    snapshot();
    setTickets((prev) =>
      prev.map((t) =>
        t.id === optimisticTarget.id
          ? {
              ...t,
              status:              "serving",
              staff_id:            staff.id,
              assigned_station_id: station?.id ?? null,
              called_at:           new Date().toISOString(),
            }
          : t
      )
    );

    const { data: rows, error: rpcErr } = await supabase
      .rpc("claim_next_ticket", {
        p_branch_id:  branch.id,
        p_staff_id:   staff.id,
        p_station_id: station?.id ?? null,
      });

    // rows is an array (RETURNS SETOF); grab the single claimed row.
    const claimed = rows?.[0] ?? null;

    if (rpcErr || !claimed) {
      console.error("[useQueue] callNext RPC error:", rpcErr);
      rollback();
      setError(
        rpcErr
          ? "Couldn't call next customer — please try again."
          : "Queue is empty or the ticket was already taken."
      );
      setBusy(false);
      return null;
    }

    // Patch the optimistic row with the real DB data (token, timestamps, etc.)
    setTickets((prev) =>
      prev.map((t) => (t.id === claimed.id ? { ...t, ...claimed } : t))
    );

    // Fire SMS call notification — non-blocking, never throws
    if (claimed.customer_phone) {
      sendCalledNotification(
        claimed.customer_phone,
        claimed.customer_name ?? "Customer",
        claimed.token,
        station?.window_number ?? station?.name ?? "—",
        staff?.display_name ?? "your staff member"
      );
    }

    setBusy(false);
    return claimed;
  }, [staff?.id, branch?.id, station?.id, station?.window_number, station?.name, staff?.display_name, waiting]);

  // ── completeServing ───────────────────────────────────────────────
  const completeServing = useCallback(async () => {
    if (!serving) return;
    setBusy(true);
    setError(null);

    snapshot();
    setTickets((prev) => prev.filter((t) => t.id !== serving.id));

    const { error: mutErr } = await supabase
      .from("tickets")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", serving.id);

    if (mutErr) {
      console.error("[useQueue] completeServing error:", mutErr);
      rollback();
      setError("Couldn't complete ticket — please try again.");
    }

    setBusy(false);
  }, [serving]);

  // ── noShow ────────────────────────────────────────────────────────
  const noShow = useCallback(async () => {
    if (!serving) return;
    setBusy(true);
    setError(null);

    snapshot();
    setTickets((prev) => prev.filter((t) => t.id !== serving.id));

    const { error: mutErr } = await supabase
      .from("tickets")
      .update({
        status:       "cancelled",
        completed_at: new Date().toISOString(),
        notes:        "no_show",
      })
      .eq("id", serving.id);

    if (mutErr) {
      console.error("[useQueue] noShow error:", mutErr);
      rollback();
      setError("Couldn't mark as no-show — please try again.");
    }

    setBusy(false);
  }, [serving]);

  // ── returnToQueue ─────────────────────────────────────────────────
  // Returns the current customer to the waiting list.
  // Clears staff_id and called_at only — created_at and priority are
  // left untouched so the customer's original position is preserved.
  const returnToQueue = useCallback(async () => {
    if (!serving) return;
    setBusy(true);
    setError(null);

    snapshot();
    setTickets((prev) =>
      prev.map((t) =>
        t.id === serving.id
          ? { ...t, status: "waiting", staff_id: null, called_at: null }
          : t
      )
    );

    const { error: mutErr } = await supabase
      .from("tickets")
      .update({
        status:    "waiting",
        staff_id:  null,
        called_at: null,
      })
      .eq("id", serving.id);

    if (mutErr) {
      console.error("[useQueue] returnToQueue error:", mutErr);
      rollback();
      setError("Couldn't return customer to queue — please try again.");
    }

    setBusy(false);
  }, [serving]);

  return {
    waiting,
    serving,
    loading,
    error,
    busy,
    callNext,
    completeServing,
    noShow,
    returnToQueue,
  };
}
