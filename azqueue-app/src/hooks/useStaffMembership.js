import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

/**
 * useStaffMembership — looks up which branches the signed-in user is a staff
 * member at. Returns the membership rows + a flag to drive routing.
 *
 * A user is "staff" if there's a row in public.staff with their user_id.
 * The 0002 invite-link trigger sets user_id automatically when a staff signs
 * up with an email matching invite_email.
 */
export function useStaffMembership() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) { setLoading(false); setMemberships([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("staff")
        .select("id, branch_id, role, status, status_since, display_name, branches(id, name, slug, lat, lng, autopilot, islamic_mode)")
        .eq("user_id", user.id);
      if (!cancelled) {
        setMemberships(data ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, reloadKey]);

  return {
    memberships,
    loading,
    isStaff: memberships.length > 0,
    primary: memberships[0] ?? null,
    reload: () => setReloadKey((k) => k + 1),
  };
}
