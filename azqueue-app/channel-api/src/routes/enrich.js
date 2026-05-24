/**
 * enrich.js — POST /enrich/:customerId
 *
 * The ONLY place in channel-api that calls an LLM.
 * Generates a structured customer summary from their event timeline.
 * Results are cached in `enrich_cache` for 24 hours.
 *
 * Request: POST /enrich/:customerId
 * Body (optional): { force: true }  — bypass cache and regenerate
 *
 * Response 200:
 * {
 *   customerId: "uuid",
 *   summary:    "2-3 sentence summary",
 *   sentiment:  "positive"|"neutral"|"negative"|"frustrated",
 *   key_issues: ["string", ...],
 *   recommended_action: "string",
 *   generated_at: "ISO timestamp",
 *   cached: boolean
 * }
 *
 * Response 204: not enough event data to generate a summary
 * Response 503: LLM unavailable (no API key or network error)
 *
 * Uses Anthropic Claude claude-haiku-4-5-20251001 by default (fast + cheap).
 * Set ENRICH_MODEL in .env to override (e.g. claude-sonnet-4-6).
 */

import { Router }  from "express";
import Anthropic   from "@anthropic-ai/sdk";
import { db }      from "../db.js";

const router = Router();

// Initialise Anthropic client lazily so the server starts even without a key.
let anthropic = null;
function getClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const MODEL     = process.env.ENRICH_MODEL ?? "claude-haiku-4-5-20251001";
const CACHE_TTL = Number(process.env.ENRICH_CACHE_HOURS ?? 24) * 60 * 60 * 1000; // ms

router.post("/:customerId", async (req, res, next) => {
  const { customerId } = req.params;
  const force = req.body?.force === true;

  try {
    // ── 1. Check cache ────────────────────────────────────────────────
    if (!force) {
      const { data: cached } = await db
        .from("enrich_cache")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return res.json({
          customerId,
          summary:            cached.summary,
          sentiment:          cached.sentiment,
          key_issues:         cached.key_issues,
          recommended_action: cached.recommended_action,
          generated_at:       cached.generated_at,
          cached:             true,
        });
      }
    }

    // ── 2. Load last 30 events ─────────────────────────────────────────
    const { data: events, error: evErr } = await db
      .from("customer_events")
      .select("channel, event_type, direction, content, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (evErr) throw evErr;

    if (!events?.length) {
      return res.status(204).end(); // No content — nothing to summarise
    }

    // ── 3. Call LLM ───────────────────────────────────────────────────
    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    const timeline = events
      .slice()
      .reverse()
      .map((e) => {
        const who = e.direction === "outbound" ? "Staff" : "Customer";
        return `[${e.channel}] ${who}: ${e.event_type} — ${e.content ?? "(no content)"}`;
      })
      .join("\n");

    const prompt = `You are a customer support assistant for a queue management system.
Analyse this customer's interaction history and produce a structured summary for staff.

Customer timeline (oldest → newest):
${timeline}

Respond with a JSON object — no markdown, no explanation, JSON only:
{
  "summary": "2-3 sentences describing this customer and their history",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "key_issues": ["up to 4 short phrases", "..."],
  "recommended_action": "one sentence — what staff should do or know"
}`;

    const message = await client.messages.create({
      model:      MODEL,
      max_tokens: 512,
      messages:   [{ role: "user", content: prompt }],
    });

    const rawText = message.content?.[0]?.text ?? "{}";

    // Strip any accidental markdown fences
    const jsonText = rawText.replace(/```(?:json)?/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = {};
    }

    const result = {
      summary:            parsed.summary            ?? null,
      sentiment:          parsed.sentiment           ?? "neutral",
      key_issues:         Array.isArray(parsed.key_issues) ? parsed.key_issues : [],
      recommended_action: parsed.recommended_action  ?? null,
    };

    // ── 4. Upsert cache ───────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + CACHE_TTL).toISOString();
    const generatedAt = new Date().toISOString();

    const { error: cacheErr } = await db
      .from("enrich_cache")
      .upsert(
        {
          customer_id:        customerId,
          ...result,
          model:              MODEL,
          generated_at:       generatedAt,
          expires_at:         expiresAt,
        },
        { onConflict: "customer_id" }
      );

    if (cacheErr) console.warn("enrich_cache upsert failed:", cacheErr.message);

    return res.json({
      customerId,
      ...result,
      generated_at: generatedAt,
      cached:       false,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
