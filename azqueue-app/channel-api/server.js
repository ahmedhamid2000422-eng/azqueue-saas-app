/**
 * server.js — AzQueue Channel API
 *
 * Receives inbound webhooks from Facebook, Instagram, WhatsApp, etc.
 * Normalises identities → matches/creates customers in Supabase → logs events.
 * Also exposes a REST API for the frontend to call /identify and /enrich.
 *
 * Port: process.env.PORT (default 3001)
 *
 * Routes:
 *   POST /identify              — find-or-create customer by identity fields
 *   GET  /customers             — list customers for a branch
 *   GET  /customers/:id         — single customer + timeline
 *   PATCH /customers/:id        — update customer fields
 *   DELETE /customers/:id       — delete customer
 *   GET  /customers/:id/events  — customer event timeline
 *   POST /customers/:id/events  — log an event manually
 *   POST /enrich/:id            — LLM enrichment (cached 24h)
 *
 * Webhook endpoints (add as you connect channels):
 *   GET  /webhooks/facebook     — Meta verification handshake
 *   POST /webhooks/facebook     — inbound FB Messenger messages
 *   GET  /webhooks/instagram    — Meta verification handshake
 *   POST /webhooks/instagram    — inbound IG DMs
 *   POST /webhooks/whatsapp     — inbound WhatsApp Cloud messages
 *
 * Zid e-commerce integration (OAuth — see src/routes/zid.js for why this
 * has to live server-side):
 *   GET  /zid/connect           — get the Zid consent-screen URL for a branch
 *   GET  /zid/callback          — OAuth redirect target, exchanges code for tokens
 *   POST /zid/sync              — pull customers/orders/products into AzQueue
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import identifyRouter  from "./src/routes/identify.js";
import customersRouter from "./src/routes/customers.js";
import enrichRouter    from "./src/routes/enrich.js";
import zidRouter        from "./src/routes/zid.js";

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ── Security & logging ────────────────────────────────────────────────
app.use(helmet());

// Allow requests from the AzQueue frontend and any local dev origin.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server requests (no Origin header) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));

app.use(morgan("dev"));

// Webhook routes need the raw body for signature verification —
// must be registered BEFORE express.json()
// (add here when connecting Meta webhooks)

app.use(express.json({ limit: "256kb" }));

// ── API-key guard ─────────────────────────────────────────────────────
// Simple shared-secret auth for server-to-server calls.
// The frontend does NOT call this API directly — it goes through Supabase RLS.
// Set CHANNEL_API_KEY in .env and in Supabase Edge Function secrets.
const API_KEY = process.env.CHANNEL_API_KEY;

function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // dev mode: no key required
  const supplied = req.headers["x-api-key"] ?? req.query.api_key;
  if (supplied === API_KEY) return next();
  return res.status(401).json({ error: "Unauthorised" });
}

// ── Routes ────────────────────────────────────────────────────────────
app.use("/identify",  requireApiKey, identifyRouter);
app.use("/customers", requireApiKey, customersRouter);
app.use("/enrich",    requireApiKey, enrichRouter);

// Zid has its own per-branch-owner auth (a real Supabase user session,
// checked against branch ownership) instead of the shared x-api-key —
// see verifyBranchOwner() in src/routes/zid.js for why.
app.use("/zid", zidRouter);

// Health check — no auth required
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  const msg    = err.message ?? "Internal server error";
  if (status >= 500) console.error(err);
  res.status(status).json({ error: msg });
});

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`AzQueue Channel API listening on http://localhost:${PORT}`);
  if (!API_KEY) console.warn("⚠  CHANNEL_API_KEY not set — all requests accepted (dev mode)");
});
