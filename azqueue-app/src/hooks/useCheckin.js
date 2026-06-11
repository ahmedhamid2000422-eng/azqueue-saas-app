import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { sendCheckinConfirmation } from "../lib/notify";

/**
 * useCheckin — public hook for the customer check-in flow.
 *
 * Fetches branch + services + all active staff (with live queue depths).
 * Handles token generation and ticket insertion.
 *
 * Returns:
 *   branch        — { id, name, city } or null
 *   services      — [{ id, name }]
 *   staffMembers  — active staff with live queue info:
 *                   [{ id, display_name, status, is_senior_advisor,
 *                      advisor_fee, queueDepth, estWait }]
 *   loading       — true during initial fetch
 *   submitting    — true while ticket is being inserted
 *   error         — string or null
 *   submitted     — true once ticket inserted successfully
 *   token         — e.g. "A014"
 *   position      — number of waiting tickets ahead of this one
 *   submit(name, phone, serviceId, preferredStaffId) — inserts ticket
 */
export function useCheckin() {
  const { branchId } = useParams();

  const [branch,       setBranch]       = useState(null);
  const [services,     setServices]     = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState(null);
  const [submitted,    setSubmitted]    = useState(false);
  const [token,        setToken]        = useState(null);
  const [position,     setPosition]     = useState(null);

  /* ── Initial fetch ─────────────────────────────────────────── */
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const [
        { data: branchRow, error: bErr },
        { data: svcRows,   error: sErr },
        { data: staffRows },
        { data: ticketRows },
      ] = await Promise.all([
        supabase
          .from("branches")
          .select("id, name, city, brand_color")
          .eq("id", branchId)
          .maybeSingle(),
        supabase
          .from("services")
          .select("id, name")
          .eq("branch_id", branchId)
          .order("name"),
        // All staff who are on duty today (not "off")
        supabase
          .from("staff")
          .select("id, display_name, status, is_senior_advisor, advisor_fee")
          .eq("branch_id", branchId)
          .in("status", ["active", "serving", "on_break"])
          .order("display_name"),
        // Live ticket counts per staff member
        supabase
          .from("tickets")
          .select("staff_id")
          .eq("branch_id", branchId)
          .in("status", ["waiting", "serving"]),
      ]);

      if (cancelled) return;

      if (bErr || !branchRow) {
        setError("Branch not found. Please check the QR code and try again.");
        setLoading(false);
        return;
      }
      if (sErr) {
        setError("Couldn't load services. Please refresh.");
        setLoading(false);
        return;
      }

      // Build per-staff queue depth map
      const depthMap = {};
      for (const t of ticketRows ?? []) {
        if (t.staff_id) depthMap[t.staff_id] = (depthMap[t.staff_id] ?? 0) + 1;
      }

      const enriched = (staffRows ?? []).map((s) => {
        const depth = depthMap[s.id] ?? 0;
        return {
          ...s,
          queueDepth: depth,
          estWait:    depth * 10, // ~10 min per ticket
        };
      });

      setBranch(branchRow);
      setServices(svcRows ?? []);
      setStaffMembers(enriched);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [branchId]);

  /* ── submit ────────────────────────────────────────────────── */
  async function submit(name, phone, serviceId, preferredStaffId = null) {
    if (!branchId || !name.trim() || !serviceId) return;
    setSubmitting(true);
    setError(null);

    try {
      /* 1. Determine next token ─────────────────────────────── */
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: lastRow } = await supabase
        .from("tickets")
        .select("token")
        .eq("branch_id", branchId)
        .gte("created_at", todayStart.toISOString())
        .like("token", "A%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1;
      if (lastRow?.token) {
        const parsed = parseInt(lastRow.token.slice(1), 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      const newToken = "A" + String(nextNum).padStart(3, "0");

      /* 2. Count waiting tickets for position estimate ───────── */
      const { count: waitingCount } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("status", "waiting");

      /* 3. Resolve premium / advisor fee ───────────────────── */
      const preferredStaff = preferredStaffId
        ? staffMembers.find((s) => s.id === preferredStaffId)
        : null;
      const isSenior   = !!preferredStaff?.is_senior_advisor;
      const advisorFee = isSenior ? (preferredStaff.advisor_fee ?? 50) : null;

      /* 4. Insert ticket ────────────────────────────────────── */
      const { error: insertErr } = await supabase
        .from("tickets")
        .insert({
          branch_id:            branchId,
          service_id:           serviceId,
          token:                newToken,
          source:               "walk",
          customer_name:        name.trim(),
          customer_phone:       phone?.trim() || null,
          status:               "waiting",
          priority:             isSenior ? 2 : 1,
          is_premium:           isSenior,
          requested_advisor_id: preferredStaffId ?? null,
          advisor_fee:          advisorFee,
        });

      if (insertErr) {
        console.error("[useCheckin] insert error:", insertErr);
        setError("Couldn't join the queue — please try again.");
        setSubmitting(false);
        return;
      }

      setToken(newToken);
      setPosition(waitingCount ?? 0);
      setSubmitted(true);

      // Fire SMS confirmation — non-blocking, never throws
      if (phone?.trim()) {
        sendCheckinConfirmation(
          phone.trim(),
          name.trim(),
          newToken,
          waitingCount ?? 0,
          branch?.name ?? "AzQueue"
        );
      }
    } catch (e) {
      console.error("[useCheckin] unexpected error:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    branch,
    services,
    staffMembers,
    // keep seniorAdvisors as a derived slice for backward compat if needed
    seniorAdvisors: staffMembers.filter((s) => s.is_senior_advisor),
    loading,
    submitting,
    error,
    submitted,
    token,
    position,
    submit,
  };
}
