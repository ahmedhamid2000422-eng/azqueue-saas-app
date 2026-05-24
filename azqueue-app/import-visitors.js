/**
 * import-visitors.js
 *
 * Imports a historical visitor Excel log into AzQueue's Supabase tables.
 * Populates: customers, customer_events, tickets
 *
 * Usage:
 *   node import-visitors.js <path-to-xlsx> <branch_id>
 *
 * Example:
 *   node import-visitors.js "Visitors - Mohamed's office 2 (1).xlsx" abc-123-uuid
 *
 * No extra installs needed — uses packages already in the project.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";

// ── Read .env without dotenv ──────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    const env = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    // fall back to .env
    try {
      const raw = readFileSync(".env", "utf8");
      const env = {};
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      return env;
    } catch {
      return {};
    }
  }
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

const [,, filePath, branchId] = process.argv;

if (!filePath || !branchId) {
  console.error("\nUsage: node import-visitors.js <path-to-xlsx> <branch_id>\n");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("\nCould not find VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env or .env.local\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Column detection ──────────────────────────────────────────────────────────
function findCol(headers, ...candidates) {
  for (const c of candidates) {
    const found = headers.find(h => h?.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return null;
}

// ── Parse duration strings → seconds ─────────────────────────────────────────
function parseDuration(val) {
  if (val == null || val === "") return null;
  if (typeof val === "number") return Math.round(val);
  const s = String(val).trim();

  // HH:MM:SS or MM:SS
  const colon = s.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (colon) {
    const [, a, b, c] = colon;
    return c != null ? +a * 3600 + +b * 60 + +c : +a * 60 + +b;
  }

  // "2 hours 10 minutes" / "39 minutes 50 seconds" / "2h 10m 5s"
  let secs = 0;
  const h  = s.match(/(\d+)\s*h/i);  if (h)  secs += +h[1]  * 3600;
  const m  = s.match(/(\d+)\s*m/i);  if (m)  secs += +m[1]  * 60;
  const sc = s.match(/(\d+)\s*s/i);  if (sc) secs += +sc[1];
  if (secs > 0) return secs;

  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n);
}

// ── Service & status mapping ──────────────────────────────────────────────────
function mapService(raw) {
  if (!raw) return "General";
  const s = String(raw).toLowerCase();
  if (s.includes("immigr"))   return "Immigration";
  if (s.includes("tax"))      return "Tax Service";
  if (s.includes("drop"))     return "Drop-Off";
  if (s.includes("question")) return "Questions";
  return String(raw).trim();
}

function mapStatus(raw) {
  if (!raw) return "cancelled";
  const s = String(raw).toLowerCase();
  if (s.includes("served") || s.includes("complet") || s.includes("done")) return "served";
  if (s.includes("no.show") || s.includes("no show") || s.includes("noshow")) return "no_show";
  return "cancelled";
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nReading: ${filePath}`);
  const buf  = readFileSync(filePath);
  const wb   = xlsxRead(buf, { type: "buffer", cellDates: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsxUtils.sheet_to_json(ws, { defval: null });

  if (!rows.length) { console.error("No rows found in sheet."); process.exit(1); }

  const headers = Object.keys(rows[0]);
  console.log(`Found ${rows.length} rows.`);
  console.log(`Columns: ${headers.join(", ")}\n`);

  const COL = {
    name:        findCol(headers, "name", "visitor", "client", "customer"),
    phone:       findCol(headers, "phone", "mobile", "tel"),
    email:       findCol(headers, "email"),
    service:     findCol(headers, "service", "category", "type", "reason"),
    status:      findCol(headers, "status", "result", "outcome"),
    joinedAt:    findCol(headers, "join", "queue time", "arrival", "check", "created", "date", "time"),
    waitSecs:    findCol(headers, "wait time", "wait_time", "waittime", "wait"),
    serviceSecs: findCol(headers, "service time", "service_time", "servicetime", "duration", "served time"),
  };

  console.log("Column mapping detected:");
  for (const [k, v] of Object.entries(COL)) {
    console.log(`  ${k.padEnd(12)} → ${v ?? "(not found)"}`);
  }
  console.log();

  let imported = 0, skipped = 0;
  const customerCache = {};

  for (const [i, row] of rows.entries()) {
    const rawName    = COL.name        ? row[COL.name]        : null;
    const rawPhone   = COL.phone       ? row[COL.phone]       : null;
    const rawEmail   = COL.email       ? row[COL.email]       : null;
    const rawService = COL.service     ? row[COL.service]     : null;
    const rawStatus  = COL.status      ? row[COL.status]      : null;
    const rawJoined  = COL.joinedAt    ? row[COL.joinedAt]    : null;
    const rawWait    = COL.waitSecs    ? row[COL.waitSecs]    : null;
    const rawSvcTime = COL.serviceSecs ? row[COL.serviceSecs] : null;

    const customerName = rawName ? String(rawName).trim() : null;
    if (!customerName) { skipped++; continue; }

    const service  = mapService(rawService);
    const status   = mapStatus(rawStatus);
    const waitSecs = parseDuration(rawWait);
    const svcSecs  = parseDuration(rawSvcTime);

    // Parse joined-at timestamp (cellDates:true gives real Date objects)
    let joinedAt = null;
    if (rawJoined instanceof Date && !isNaN(rawJoined)) {
      joinedAt = rawJoined.toISOString();
    } else if (rawJoined != null) {
      const d = new Date(rawJoined);
      if (!isNaN(d)) joinedAt = d.toISOString();
    }
    joinedAt = joinedAt ?? new Date().toISOString();

    // 1. Find or create customer
    let customerId = customerCache[customerName.toLowerCase()];
    if (!customerId) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("branch_id", branchId)
        .ilike("display_name", customerName)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from("customers")
          .insert({
            branch_id:    branchId,
            display_name: customerName,
            phone:        rawPhone ? String(rawPhone).trim() : null,
            email:        rawEmail ? String(rawEmail).trim() : null,
            last_seen_at: joinedAt,
          })
          .select("id")
          .single();

        if (error) {
          console.warn(`  Row ${i + 1}: Skipping "${customerName}" — ${error.message}`);
          skipped++;
          continue;
        }
        customerId = created.id;
      }
      customerCache[customerName.toLowerCase()] = customerId;
    }

    // 2. Log customer event
    const eventType = status === "served" ? "queue_complete" : "queue_join";
    const waitLabel = waitSecs != null ? ` · waited ${Math.round(waitSecs / 60)}m` : "";
    const svcLabel  = svcSecs  != null ? ` · ${Math.round(svcSecs  / 60)}m service` : "";
    const content = status === "served"
      ? `Served · ${service}${svcLabel}${waitLabel}`
      : `Cancelled by clerk · ${service}${waitLabel}`;

    await supabase.from("customer_events").insert({
      customer_id: customerId,
      branch_id:   branchId,
      channel:     "queue",
      event_type:  eventType,
      content,
      metadata: {
        service,
        status,
        wait_seconds:    waitSecs,
        service_seconds: svcSecs,
        original_date:   joinedAt,
        imported:        true,
      },
    });

    // 3. Insert historical ticket
    await supabase.from("tickets").insert({
      branch_id:      branchId,
      token:          `H${String(i + 1).padStart(4, "0")}`,
      source:         "walk",
      status:         status === "served" ? "completed" : "cancelled",
      customer_name:  customerName,
      customer_phone: rawPhone ? String(rawPhone).trim() : null,
      created_at:     joinedAt,
    });

    // Update customer last_seen_at if this visit is more recent
    await supabase
      .from("customers")
      .update({ last_seen_at: joinedAt })
      .eq("id", customerId)
      .lt("last_seen_at", joinedAt);

    imported++;
    process.stdout.write(`\r  Imported ${imported} / ${rows.length} rows...`);
  }

  console.log(`\n\nDone!`);
  console.log(`  Imported : ${imported}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`\nOpen the Customers page in AzQueue to see all profiles.\n`);
}

main().catch(err => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
