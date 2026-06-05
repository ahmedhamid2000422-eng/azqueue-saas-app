import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * useDisplay — public hook for the TV display page.
 *
 * No auth required. Fetches:
 *   - Branch name from branches table
 *   - All staff at this branch (for name + colour mapping)
 *   - All tickets with status='serving' (the Now Serving cards)
 *   - Next 8 tickets with status='waiting', ordered by priority DESC, created_at ASC
 *
 * Realtime: one Supabase channel subscription on tickets table
 * filtered by branch_id. Any INSERT/UPDATE/DELETE triggers a refetch
 * of both serving and waiting lists.
 *
 * Returns:
 *   branchName  — string
 *   serving     — ticket rows with status='serving'
 *   waiting     — up to 8 ticket rows with status='waiting'
 *   staff       — all staff rows for this branch (id, display_name, role, status)
 *   loading     — true during first fetch
 */
export function useDisplay() {
  const { branchId } = useParams();

  const [branchName, setBranchName] = useState("");
  const [serving,    setServing]    = useState([]);
  const [waiting,    setWaiting]    = useState([]);
  const [staff,      setStaff]      = useState([]);
  const [stations,   setStations]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  /* ── Fetch tickets (called on mount + every realtime event) ── */
  const fetchTickets = useCallback(async () => {
    if (!branchId) return;

    const [{ data: servingRows }, { data: waitingRows }] = await Promise.all([
      supabase
        .from("tickets")
        .select(
          "id, token, status, customer_name, service_id, staff_id, assigned_station_id, called_at"
        )
        .eq("branch_id", branchId)
        .eq("status", "serving"),

      supabase
        .from("tickets")
        .select("id, token, status, customer_name, service_id, priority, created_at")
        .eq("branch_id", branchId)
        .eq("status", "waiting")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(8),
    ]);

    setServing(servingRows ?? []);
    setWaiting(waitingRows ?? []);
  }, [branchId]);

  /* ── Initial full fetch: branch + staff + tickets ─────────── */
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [
        { data: branchRow },
        { data: staffRows },
        { data: stationRows },
      ] = await Promise.all([
        supabase
          .from("branches")
          .select("id, name, city")
          .eq("id", branchId)
          .maybeSingle(),
        supabase
          .from("staff")
          .select("id, display_name, role, status")
          .eq("branch_id", branchId)
          .order("display_name"),
        supabase
          .from("stations")
          .select("id, window_number, name, preparer_id, status")
          .eq("branch_id", branchId)
          .order("window_number"),
      ]);

      if (cancelled) return;

      setBranchName(branchRow?.name ?? "");
      setStaff(staffRows ?? []);
      setStations(stationRows ?? []);

      await fetchTickets();
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [branchId, fetchTickets]);

  /* ── Realtime subscription ────────────────────────────────── */
  useEffect(() => {
    if (!branchId) return;

    const channel = supabase
      .channel(`display-${branchId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "tickets",
          filter: `branch_id=eq.${branchId}`,
        },
        () => fetchTickets()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [branchId, fetchTickets]);

  return { branchName, serving, waiting, staff, stations, loading };
}
