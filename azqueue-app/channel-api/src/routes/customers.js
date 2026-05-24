/**
 * customers.js — Customer CRUD + event timeline
 *
 * GET    /customers?branch_id=&search=&limit=&offset=
 * GET    /customers/:id
 * PATCH  /customers/:id
 * DELETE /customers/:id
 * GET    /customers/:id/events?limit=&offset=&direction=
 * POST   /customers/:id/events    — manually log an event
 */

import { Router } from "express";
import { db } from "../db.js";
import { logEvent } from "../lib/match.js";

const router = Router();

// ── List customers ────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { branch_id, search = "", limit = "50", offset = "0" } = req.query;

    if (!branch_id) return res.status(400).json({ error: "branch_id is required" });

    let query = db
      .from("customers")
      .select("id, display_name, email, phone, tags, vip, last_seen_at, created_at, freshdesk_id")
      .eq("branch_id", branch_id)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (search.trim()) {
      query = query.or(
        `display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ customers: data ?? [], count: data?.length ?? 0 });
  } catch (err) { next(err); }
});

// ── Single customer ───────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const [
      { data: customer, error: cErr },
      { data: events },
      { data: notes },
      { data: summary },
    ] = await Promise.all([
      db.from("customers").select("*").eq("id", id).single(),
      db.from("customer_events")
        .select("id, channel, event_type, direction, content, external_id, staff_id, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("customer_notes")
        .select("id, content, staff_id, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      db.from("enrich_cache")
        .select("summary, sentiment, key_issues, recommended_action, generated_at, expires_at")
        .eq("customer_id", id)
        .maybeSingle(),
    ]);

    if (cErr || !customer) return res.status(404).json({ error: "Customer not found" });

    // Only return cached enrichment if it hasn't expired
    const validSummary = summary && new Date(summary.expires_at) > new Date() ? summary : null;

    res.json({ ...customer, events: events ?? [], notes: notes ?? [], enrichment: validSummary });
  } catch (err) { next(err); }
});

// ── Update customer ───────────────────────────────────────────────────
const ALLOWED_FIELDS = new Set([
  "display_name", "email", "phone", "tags", "vip",
  "facebook_id", "instagram_id", "whatsapp_id", "freshdesk_id", "avatar_url",
]);

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => ALLOWED_FIELDS.has(k))
    );

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const { data, error } = await db
      .from("customers")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: "Customer not found" });
    res.json(data);
  } catch (err) { next(err); }
});

// ── Delete customer ───────────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await db.from("customers").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── Event timeline ────────────────────────────────────────────────────
router.get("/:id/events", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = "50", offset = "0", direction } = req.query;

    let query = db
      .from("customer_events")
      .select("id, channel, event_type, direction, content, external_id, staff_id, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (direction === "inbound" || direction === "outbound") {
      query = query.eq("direction", direction);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ events: data ?? [] });
  } catch (err) { next(err); }
});

// ── Log an event manually ─────────────────────────────────────────────
router.post("/:id/events", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify customer exists and get its branch_id
    const { data: customer, error: cErr } = await db
      .from("customers")
      .select("id, branch_id")
      .eq("id", id)
      .single();

    if (cErr || !customer) return res.status(404).json({ error: "Customer not found" });

    const { channel, eventType, direction, content, metadata, externalId, staffId } = req.body;

    if (!channel || !eventType) {
      return res.status(400).json({ error: "channel and eventType are required" });
    }

    const event = await logEvent({
      customerId: customer.id,
      branchId:   customer.branch_id,
      channel,
      eventType,
      direction:  direction ?? "inbound",
      content:    content   ?? null,
      metadata:   metadata  ?? null,
      externalId: externalId ?? null,
      staffId:    staffId   ?? null,
    });

    res.status(201).json(event);
  } catch (err) { next(err); }
});

export default router;
