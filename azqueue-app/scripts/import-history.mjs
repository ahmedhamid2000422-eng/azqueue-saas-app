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

/* ── Write, in batches ──────────────────────────────────────────────
   NOT an upsert. The unique index on (branch_id, phone) is PARTIAL —
   `where phone is not null` — and Postgres won't use a partial index to
   resolve ON CONFLICT, so the obvious `.upsert({ onConflict })` fails with
   "no unique or exclusion constraint matching the ON CONFLICT
   specification". Instead: read what's already there, update those rows by
   id, insert the rest. Still safe to re-run — an existing person is updated
   in place, never duplicated and never added to twice. */
const BATCH = 500;
let done = 0, failed = 0;

const { data: existing, error: exErr } = await db
  .from("customers")
  .select("id, phone")
  .eq("branch_id", BRANCH)
  .limit(100_000);

if (exErr) { console.error("Could not read existing customers:", exErr.message); process.exit(1); }

const existingByPhone = new Map(
  (existing ?? []).filter((c) => c.phone).map((c) => [normalise(c.phone), c.id])
);
console.log(`  ${existingByPhone.size.toLocaleString()} people already in this branch`);

const toUpdate = [];
const toInsert = [];
for (const r of rows) {
  const id = r.phone ? existingByPhone.get(r.phone) : null;
  if (id) toUpdate.push({ id, ...r });
  else toInsert.push(r);
}

for (let i = 0; i < toInsert.length; i += BATCH) {
  const slice = toInsert.slice(i, i + BATCH);
  const { error } = await db.from("customers").insert(slice);
  if (error) { failed += slice.length; console.error(`  insert ${i}: ${error.message}`); }
  else { done += slice.length; process.stdout.write(`\r  inserted ${done.toLocaleString()}/${toInsert.length.toLocaleString()}`); }
}
if (toInsert.length) console.log("");

/* Updates go one at a time — there are usually few of them, and a failure
   here should name the row rather than take a batch of 500 down with it. */
for (const u of toUpdate) {
  const { id, ...fields } = u;
  const { error } = await db.from("customers").update(fields).eq("id", id);
  if (error) { failed += 1; console.error(`  update ${id}: ${error.message}`); }
  else done += 1;
}
if (toUpdate.length) console.log(`  updated ${toUpdate.length.toLocaleString()} existing`);

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
