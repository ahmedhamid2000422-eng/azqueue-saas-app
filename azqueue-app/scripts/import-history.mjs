/**
 * import-history.mjs — one-time import of pre-AzQueue client history.
 *
 * RUN THIS LOCALLY. It needs the service key, so it must never run in the
 * browser and the data file must never go back into the repo — that file being
 * publicly served is the reason this script exists.
 *
 *   node scripts/import-history.mjs \
 *     --file ~/Downloads/aztax-clients.json \
 *     --branch <branch-uuid> \
 *     --source qminder
 *
 * Environment:
 *   SUPABASE_URL          your project URL
 *   SUPABASE_SERVICE_KEY  service role / secret key (sb_secret_… or legacy)
 *
 * SAFE TO RE-RUN. People are matched on phone within the branch and upserted,
 * so running twice does not double anyone's visit count.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ── Args ─────────────────────────────────────────────────────────── */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const FILE   = args.file;
const BRANCH = args.branch;
const SOURCE = args.source ?? "import";

if (!FILE || !BRANCH) {
  console.error("Usage: node scripts/import-history.mjs --file <path> --branch <uuid> [--source qminder]");
  process.exit(1);
}

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

/* ── Read ─────────────────────────────────────────────────────────── */
const raw = JSON.parse(readFileSync(FILE.replace(/^~/, process.env.HOME ?? ""), "utf8"));
const people = raw.customers ?? [];

console.log(`Read ${people.length.toLocaleString()} people, ${(raw.total ?? 0).toLocaleString()} visits`);

/* Phone is the only reliable identity across systems — names are typed
   differently every visit. Anyone without one can still be imported, but
   they can't be matched to future check-ins, so they're counted separately
   and reported rather than silently dropped. */
const normalise = (p) => (p ?? "").replace(/[^\d+]/g, "") || null;

let noPhone = 0;
const rows = people.map((c) => {
  const phone = normalise(c.p);
  if (!phone) noPhone += 1;
  return {
    branch_id:       BRANCH,
    display_name:    c.n ?? null,
    phone,
    imported_visits: Number(c.v) || 0,
    first_seen_at:   c.f ? new Date(c.f).toISOString() : null,
    last_seen_at:    c.l ? new Date(c.l).toISOString() : null,
    imported_at:     new Date().toISOString(),
    import_source:   SOURCE,
  };
});

if (noPhone) {
  console.log(`  ${noPhone.toLocaleString()} have no phone number — imported, but they won't merge with future visits.`);
}

/* ── Write, in batches ────────────────────────────────────────────── */
const withPhone = rows.filter((r) => r.phone);
const without   = rows.filter((r) => !r.phone);
const BATCH = 500;
let done = 0, failed = 0;

for (let i = 0; i < withPhone.length; i += BATCH) {
  const slice = withPhone.slice(i, i + BATCH);
  const { error } = await db
    .from("customers")
    .upsert(slice, { onConflict: "branch_id,phone", ignoreDuplicates: false });
  if (error) { failed += slice.length; console.error(`  batch ${i}: ${error.message}`); }
  else { done += slice.length; process.stdout.write(`\r  upserted ${done.toLocaleString()}/${withPhone.length.toLocaleString()}`); }
}
console.log("");

for (let i = 0; i < without.length; i += BATCH) {
  const { error } = await db.from("customers").insert(without.slice(i, i + BATCH));
  if (error) { failed += Math.min(BATCH, without.length - i); console.error(`  no-phone batch ${i}: ${error.message}`); }
}

/* ── Aggregates that have no per-row source ───────────────────────── */
const months = raw.monthly?.labels ?? [];
const { error: sErr } = await db.from("branch_history_summary").upsert({
  branch_id:     BRANCH,
  source:        SOURCE,
  total_visits:  raw.total ?? 0,
  unique_people: raw.unique ?? people.length,
  range_from:    months.length ? `${months[0]}-01` : null,
  range_to:      months.length ? `${months[months.length - 1]}-01` : null,
  hours:         raw.hours  ?? null,
  days:          raw.days   ?? null,
  months:        raw.monthly ?? null,
  imported_at:   new Date().toISOString(),
}, { onConflict: "branch_id" });

if (sErr) console.error("summary failed:", sErr.message);

console.log(`\nDone. ${done.toLocaleString()} imported${failed ? `, ${failed} failed` : ""}.`);
console.log("The source file is not needed again — keep it out of the repo.");
