/**
 * identify.js — POST /identify
 *
 * The core ingestion endpoint. Every channel webhook calls this to
 * resolve a customer before logging an event.
 *
 * Request body:
 * {
 *   branchId:    "uuid",          // required
 *   name?:       "string",
 *   email?:      "string",
 *   phone?:      "string",
 *   country?:    "SA",            // ISO 3166-1 alpha-2 hint for phone parsing
 *   facebookId?: "string",
 *   instagramId?:"string",
 *   whatsappId?: "string",
 *   freshdeskId?:"string",
 *
 *   // Optional: log an event at the same time as identifying
 *   event?: {
 *     channel:     "facebook"|"instagram"|"whatsapp"|"email"|"freshdesk"|"manual",
 *     eventType:   "message"|...,
 *     direction?:  "inbound"|"outbound",
 *     content?:    "string",
 *     metadata?:   object,
 *     externalId?: "string",
 *   }
 * }
 *
 * Response 200:
 * {
 *   customer: { id, display_name, email, phone, ... },
 *   created:  boolean,
 *   event?:   { id, channel, event_type, content, created_at }
 * }
 */

import { Router } from "express";
import { normalizeIdentity } from "../lib/normalize.js";
import { findOrCreate, logEvent, logWebhook } from "../lib/match.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { branchId, country, event: rawEvent, ...rawIdentity } = req.body;

    // ── Validate ──────────────────────────────────────────────────────
    if (!branchId || typeof branchId !== "string") {
      return res.status(400).json({ error: "branchId is required" });
    }

    const identity = normalizeIdentity({ ...rawIdentity, country });

    // Need at least one identifier to match on
    const hasIdentifier = !!(
      identity.email     ||
      identity.phone     ||
      identity.whatsappId ||
      identity.facebookId ||
      identity.instagramId ||
      identity.freshdeskId
    );

    if (!hasIdentifier) {
      return res.status(400).json({
        error: "At least one identifier is required: email, phone, facebookId, instagramId, whatsappId, or freshdeskId",
      });
    }

    // ── Find or create customer ───────────────────────────────────────
    const { customer, created } = await findOrCreate(branchId, identity);

    // ── Optionally log an event ───────────────────────────────────────
    let eventRow = null;
    if (rawEvent?.channel && rawEvent?.eventType) {
      eventRow = await logEvent({
        customerId:  customer.id,
        branchId,
        channel:     rawEvent.channel,
        eventType:   rawEvent.eventType,
        direction:   rawEvent.direction ?? "inbound",
        content:     rawEvent.content   ?? null,
        metadata:    rawEvent.metadata  ?? null,
        externalId:  rawEvent.externalId ?? null,
      });

      // Fire-and-forget webhook log
      logWebhook({
        channel:    rawEvent.channel,
        branchId,
        customerId: customer.id,
        eventType:  rawEvent.eventType,
        payload:    req.body,
        processed:  true,
      });
    }

    const response = { customer, created };
    if (eventRow) response.event = eventRow;

    return res.status(created ? 201 : 200).json(response);
  } catch (err) {
    // Log for debugging, then let global handler respond
    logWebhook({
      channel:   req.body?.event?.channel ?? "manual",
      branchId:  req.body?.branchId,
      payload:   req.body,
      processed: false,
      error:     err.message,
    });
    next(err);
  }
});

export default router;
