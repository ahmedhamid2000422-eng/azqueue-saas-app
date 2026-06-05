import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

/**
 * useStaff — resolves the signed-in user's staff record + their branch
 * in a single fetch on mount. No polling, no intervals.
 *
 * Returns:
 *   staff   — row from public.staff (id, branch_id, user_id, display_name, role, status)
 *   branch  — row from public.branches (id, owner_id, name, city, timezone, islamic_mode, autopilot)
 *   station — row from public.stations where preparer_id = staff.id, or null if none assigned
 *   loading — true until first fetch completes
 *   error   — actionable string if fetch failed, null otherwise
 */
export function useStaff() {
  const { user } = useAuth();
  const [staff,   setStaff]   = useState(null);
  const [branch,  setBranch]  = useState(null);
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!user) {
      setStaff(null);
      setBranch(null);
      setStation(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      // ── 1. Staff row ────────────────────────────────────────────
      const { data: staffRow, error: staffErr } = await supabase
        .from("staff")
        .select("id, branch_id, user_id, display_name, role, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (staffErr) {
        // Raw Supabase errors (RLS, network, JWT) are not useful to a
        // front-desk worker. Log for debugging; show something actionable.
        console.error("[useStaff] staff query error:", staffErr);
        setError(
          "Couldn't load your staff profile — please refresh. " +
          "If this keeps happening, contact your administrator."
        );
        setLoading(false);
        return;
      }

      if (!staffRow) {
        // User exists in auth.users but has no staff row yet.
        // Most common cause: owner account not yet linked, or invite
        // email mismatch.
        setError(
          "No staff profile found for this account — " +
          "contact your administrator to get access."
        );
        setLoading(false);
        return;
      }

      setStaff(staffRow);

      // ── 2. Branch + assigned station (parallel) ─────────────────
      const [
        { data: branchRow, error: branchErr },
        { data: stationRow },
      ] = await Promise.all([
        supabase
          .from("branches")
          .select("id, owner_id, name, city, timezone, islamic_mode, autopilot")
          .eq("id", staffRow.branch_id)
          .maybeSingle(),
        supabase
          .from("stations")
          .select("id, branch_id, window_number, name, preparer_id, status")
          .eq("preparer_id", staffRow.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (branchErr) {
        console.error("[useStaff] branch query error:", branchErr);
        setError(
          "Staff profile loaded but branch data is unavailable — " +
          "please refresh or contact your administrator."
        );
        setLoading(false);
        return;
      }

      setBranch(branchRow ?? null);
      setStation(stationRow ?? null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return { staff, branch, station, loading, error };
}
