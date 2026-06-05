import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { sendCheckinConfirmation } from "../lib/notify";

/**
 * useCheckin — public hook for the customer check-in flow.
 *
 * Fetches branch + services from Supabase (no auth required — public read).
 * Handles token generation and ticket insertion.
 *
 * Token format: A001, A002, … A999
 *   - Queries today's tickets for this branch WHERE token LIKE 'A%'
 *   - Takes the last one by created_at, increments the number
 *   - Falls back to A001 if none exist today
 *
 * Returns:
 *   branch      — { id, name, city } or null
 *   services    — [{ id, name, description }]
 *   loading     — true during initial fetch
 *   submitting  — true while ticket is being inserted
 *   error       — string or null
 *   submitted   — true once ticket inserted successfully
 *   token       — e.g. "A014"
 *   position    — number of waiting tickets ahead of this one
 *   submit(name, phone, serviceId) — inserts ticket, sets submitted=true
 */
export function useCheckin() {
  const { branchId } = useParams();

  const [branch,     setBranch]     = useState(null);
  const [services,   setServices]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [submitted,  setSubmitted]  = useState(false);
  const [token,      setToken]      = useState(null);
  const [position,   setPosition]   = useState(null);

  /* ── Initial fetch: branch + services ─────────────────────── */
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const [{ data: branchRow, error: bErr }, { data: svcRows, error: sErr }] =
        await Promise.all([
          supabase
            .from("branches")
            .select("id, name, city")
            .eq("id", branchId)
            .maybeSingle(),
          supabase
            .from("services")
            .select("id, name")
            .eq("branch_id", branchId)
            .order("name"),
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

      setBranch(branchRow);
      setServices(svcRows ?? []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [branchId]);

  /* ── submit ────────────────────────────────────────────────── */
  async function submit(name, phone, serviceId) {
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

      /* 2. Count current waiting tickets (position estimate) ── */
      const { count: waitingCount } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("status", "waiting");

      /* 3. Insert ticket ────────────────────────────────────── */
      const { error: insertErr } = await supabase
        .from("tickets")
        .insert({
          branch_id:     branchId,
          service_id:    serviceId,
          token:         newToken,
          source:        "walk",
          customer_name: name.trim(),
          customer_phone: phone?.trim() || null,
          status:        "waiting",
          priority:      1,
        });

      if (insertErr) {
        console.error("[useCheckin] insert error:", insertErr);
        setError("Couldn't join the queue — please try again.");
        setSubmitting(false);
        return;
      }

      setToken(newToken);
      setPosition(waitingCount ?? 0); // tickets ahead (before this insert)
      setSubmitted(true);

      // Fire SMS confirmation — non-blocking, never throws
      if (phone?.trim()) {
        sendCheckinConfirmation(
          phone.trim(),
          name.trim(),
          newToken,
          waitingCount ?? 0,
          branch?.name ?? "Az Tax Services"
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
    loading,
    submitting,
    error,
    submitted,
    token,
    position,
    submit,
  };
}
