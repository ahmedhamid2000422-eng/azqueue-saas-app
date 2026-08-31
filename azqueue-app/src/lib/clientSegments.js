/**
 * clientSegments — one definition of "who your clients are", shared by the
 * Intel page and AI Assist.
 *
 * This lives in its own file for one reason: if the page and the assistant
 * each computed their own version of "regulars who stopped coming", they
 * would eventually disagree, and the owner would be told two different
 * numbers for the same question. One predicate, used by both.
 *
 * Everything here is a COUNT of people matching a stated rule. No scores, no
 * predictions, no "likelihood to churn" — the rules are simple enough to
 * check by hand, which is the point.
 */

const DAY = 86_400_000;

export const TIER_MIN = { VIP: 10, Loyal: 5, Regular: 3, Returning: 2, New: 1 };
export const TIER_ORDER = ["VIP", "Loyal", "Regular", "Returning", "New"];

export function tierFor(visits) {
  for (const name of TIER_ORDER) if (visits >= TIER_MIN[name]) return name;
  return "New";
}

export const SEGMENTS = [
  {
    key: "lapsed_regulars",
    label: "Regulars who stopped coming",
    rule: "3 or more visits, nothing in over a year",
    note: (n) => `${n.toLocaleString()} people visited 3 or more times but haven't been back in over a year.`,
    action: "These are the clearest names to call — they already chose you repeatedly, so something changed rather than never having started.",
    match: (p, now) => p.v >= 3 && now - p.l > 365 * DAY,
  },
  {
    key: "due_back",
    label: "Due back about now",
    rule: "last visit between 11 and 13 months ago",
    note: (n) => `${n.toLocaleString()} people last came between 11 and 13 months ago.`,
    action: "If your work runs on a yearly cycle, this is the group most likely to need you again shortly.",
    match: (p, now) => { const g = now - p.l; return g >= 334 * DAY && g <= 396 * DAY; },
  },
  {
    key: "one_visit",
    label: "Came once, never returned",
    rule: "exactly one recorded visit",
    note: (n, total) => `${n.toLocaleString()} of ${total.toLocaleString()} people (${Math.round((n / total) * 100)}%) have exactly one recorded visit.`,
    action: "A high share here is normal for one-off services and worth investigating for repeat ones. It counts recorded visits only — anyone who came before your records start looks new.",
    match: (p) => p.v === 1,
  },
  {
    key: "recent_new",
    label: "New in the last 90 days",
    rule: "first visit within the last 90 days",
    note: (n) => `${n.toLocaleString()} people visited for the first time in the last 90 days.`,
    action: "Whether these come back a second time is the single clearest signal of whether the business is growing.",
    match: (p, now) => now - p.f <= 90 * DAY,
  },
];

/**
 * Collapse tickets + imported customer rows into one record per person.
 *
 * Identity: customer_id where present, else normalised phone, else name.
 * Phone is what actually survives across systems — names get typed
 * differently every visit.
 *
 * Returns [{ key, n, p, v, prior, f, l, t }] sorted by visits desc.
 */
export function buildPeople(tickets = [], customers = []) {
  const norm = (p) => (p ?? "").replace(/[^\d+]/g, "");
  const byKey = new Map();

  for (const t of tickets) {
    const key = t.customer_id ?? t.customer_phone ?? t.customer_name;
    if (!key) continue;
    const at = new Date(t.created_at);
    const cur = byKey.get(key);
    if (cur) {
      cur.v += 1;
      if (at < cur.f) cur.f = at;
      if (at > cur.l) cur.l = at;
    } else {
      byKey.set(key, { key, n: t.customer_name ?? "—", p: t.customer_phone ?? "", v: 1, prior: 0, f: at, l: at });
    }
  }

  const byId = new Map(customers.map((c) => [c.id, c]));
  for (const rec of byKey.values()) {
    const c = byId.get(rec.key);
    if (c) { rec.n = c.display_name ?? rec.n; rec.p = c.phone ?? rec.p; }
  }

  const byPhone = new Map();
  for (const rec of byKey.values()) if (norm(rec.p)) byPhone.set(norm(rec.p), rec);

  for (const c of customers) {
    const prior = c.imported_visits ?? 0;
    if (!prior) continue;
    const live = c.phone ? byPhone.get(norm(c.phone)) : null;
    const first = c.first_seen_at ? new Date(c.first_seen_at) : null;

    if (live) {
      live.v += prior;
      live.prior = prior;
      if (first && first < live.f) live.f = first;
    } else {
      const last = c.last_seen_at ? new Date(c.last_seen_at) : first;
      byKey.set(`imp:${c.id}`, {
        key: `imp:${c.id}`, n: c.display_name ?? "—", p: c.phone ?? "",
        v: prior, prior, f: first ?? last, l: last,
      });
    }
  }

  const people = [...byKey.values()];
  for (const p of people) p.t = tierFor(p.v);
  return people.sort((a, b) => b.v - a.v || b.l - a.l);
}

/**
 * Headline client stats — the "how healthy is the client base" numbers.
 *
 * WHAT IS AND ISN'T POSSIBLE HERE
 * A full retention curve (of everyone who first came in March, what share
 * returned by month 2, 3, 4…) needs every individual visit date. Imported
 * history only carries a total and a first/last date, so that curve cannot
 * be drawn honestly for most of this client base — and a curve drawn from
 * assumed dates would look authoritative and be fiction.
 *
 * What IS exactly computable from a total plus two dates:
 *   - whether someone ever returned          (last > first)
 *   - how many are still active              (last visit within a year)
 *   - average visits per person
 *   - typical gap between visits             ((last - first) / (visits - 1))
 *
 * Those are the four below. Each is a division of two counted numbers.
 */
export function clientVitals(people, now = Date.now()) {
  const total = people.length;
  if (!total) return null;

  const visits    = people.reduce((a, p) => a + p.v, 0);
  const returned  = people.filter((p) => p.v >= 2);
  const active    = people.filter((p) => now - p.l <= 365 * DAY);

  /* Average gap per person, then the MEDIAN across people. The median
     because one client with a six-year span would drag a mean somewhere
     no real client lives. */
  const gaps = returned
    .map((p) => (p.l - p.f) / (p.v - 1) / DAY)
    .filter((g) => g > 0 && Number.isFinite(g))
    .sort((a, b) => a - b);
  const medianGapDays = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;

  /* How long visits actually take. Only AzQueue-recorded visits have a start
     and end, so this covers fewer people than the counts above — which is
     why `timedPeople` is reported alongside it. A number without its base is
     how a statistic becomes a rumour. */
  const timed = people.filter((p) => p.medMins != null).map((p) => p.medMins).sort((a, b) => a - b);
  const medianVisitMins = timed.length ? timed[Math.floor(timed.length / 2)] : null;
  const longVisitShare = timed.length
    ? timed.filter((m) => m >= (medianVisitMins ?? 0) * 2).length / timed.length
    : null;

  return {
    total,
    visits,
    medianVisitMins,
    timedPeople:   timed.length,
    longVisitShare,
    shortestMins:  timed.length ? timed[0] : null,
    longestMins:   timed.length ? timed[timed.length - 1] : null,
    returnRate:    returned.length / total,
    returnedCount: returned.length,
    activeRate:    active.length / total,
    activeCount:   active.length,
    visitsPerClient: visits / total,
    medianGapDays,
  };
}

/** Counts per segment, plus tier counts. */
export function segmentCounts(people, now = Date.now()) {
  return SEGMENTS.map((s) => ({ ...s, count: people.filter((p) => s.match(p, now)).length }));
}

/**
 * The same figures phrased as verified statistics for the assistant.
 *
 * Deliberately plain sentences that state the rule alongside the number, so
 * the model can quote the rule when asked "how do you know that?" — and can
 * never present the figure as something cleverer than a count.
 */
export const MIN_CLIENTS_FOR_FACTS = 30;

export function buildClientFacts(people, now = Date.now()) {
  /* Silence beats a thin number. "40% of your clients never returned" from a
     base of five people is arithmetically true and completely useless, and
     an owner acting on it would be acting on noise. Below the threshold the
     assistant simply isn't given client facts, and its grounding rules make
     it say it doesn't have enough history rather than guess. */
  if (people.length < MIN_CLIENTS_FOR_FACTS) return [];
  const facts = [];
  const total = people.length;
  const visits = people.reduce((a, p) => a + p.v, 0);

  facts.push(
    `Client base: ${total.toLocaleString()} distinct people with ${visits.toLocaleString()} recorded visits between them.`
  );

  for (const s of segmentCounts(people, now)) {
    facts.push(
      `${s.label}: ${s.count.toLocaleString()} people (rule: ${s.rule}). ` +
      `${Math.round((s.count / total) * 100)}% of the client base.`
    );
  }

  const v = clientVitals(people, now);
  facts.push(
    `Return rate: ${v.returnedCount.toLocaleString()} of ${total.toLocaleString()} people ` +
    `(${Math.round(v.returnRate * 100)}%) have visited more than once.`
  );
  facts.push(
    `Still active: ${v.activeCount.toLocaleString()} people (${Math.round(v.activeRate * 100)}%) ` +
    `have visited within the last 12 months.`
  );
  facts.push(
    `Average visits per client: ${v.visitsPerClient.toFixed(1)}.`
  );
  if (v.medianGapDays != null) {
    facts.push(
      `Typical gap between visits: ${Math.round(v.medianGapDays)} days (median, among people ` +
      `who have visited more than once).`
    );
  }
  if (v.medianVisitMins != null) {
    facts.push(
      `How long visits take: the typical visit lasts ${Math.round(v.medianVisitMins)} minutes ` +
      `(median), measured across ${v.timedPeople.toLocaleString()} clients who have at least one ` +
      `timed visit. The shortest client averages ${Math.round(v.shortestMins)} minutes and the ` +
      `longest ${Math.round(v.longestMins)} minutes.`
    );
    if (v.longVisitShare != null) {
      facts.push(
        `Visit length spread: ${Math.round(v.longVisitShare * 100)}% of timed clients take at ` +
        `least twice the typical visit length. This is why a single average service time is a ` +
        `poor basis for scheduling here.`
      );
    }
    facts.push(
      `Coverage note on visit length: only visits recorded in AzQueue have a start and end time. ` +
      `Imported history has none, so visit length covers ${v.timedPeople.toLocaleString()} of ` +
      `${total.toLocaleString()} clients, not all of them.`
    );
  }

  facts.push(
    `NOT MEASURED: a month-by-month retention curve. Imported history records a visit total ` +
    `and a first/last date per person, not every individual visit, so the shape of return ` +
    `behaviour over time cannot be computed for most of this client base. Say so if asked.`
  );

  const counts = TIER_ORDER.map((t) => `${t} ${people.filter((p) => p.t === t).length.toLocaleString()}`);
  facts.push(
    `Loyalty tiers by visit count (VIP 10+, Loyal 5+, Regular 3+, Returning 2, New 1): ${counts.join(", ")}. ` +
    `These thresholds are a labelling choice, not a finding from the data.`
  );

  facts.push(
    `Caveat on client history: imported visits carry a total and a first/last date, not individual dates. ` +
    `Anyone who visited before the records begin will look newer than they are.`
  );

  return facts;
}
