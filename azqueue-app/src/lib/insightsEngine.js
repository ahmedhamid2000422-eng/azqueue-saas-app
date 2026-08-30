/**
 * insightsEngine.js — managerial statistics over the branch's queue history.
 *
 * DESIGN NOTE — why the maths lives here and not in the model:
 * An LLM asked to "find patterns in this data" will happily invent
 * plausible-sounding statistics. Every figure below is computed
 * deterministically; the model is only handed these finished results and
 * asked to explain and rank them. If a number appears in an insight, it
 * came from this file.
 *
 * FACT ORDER IS DELIBERATE. The model reads these in sequence and weights
 * earlier items more heavily, so the six core operating metrics come first:
 *
 *   1. Average wait          total waiting time ÷ customers served
 *   2. Wait variability      median, SD, p90 — two shops can share a 15-min
 *                            mean while one is consistent and one is chaotic
 *   3. Service rate (μ)      customers handled per hour, per server
 *   4. Arrival rate (λ)      customers joining per operating hour
 *   5. Queue pressure (ρ)    λ ÷ capacity — the single best congestion signal
 *   6. Cancellation rate     cancelled ÷ total
 *
 * Then supporting analysis: abandonment and its tipping point, repeat rate,
 * booking conversion, significance testing, per-service and demand patterns.
 */

import {
  wilsonInterval, twoProportionTest, chiSquareIndependence,
  pearson, describe, fmtP, fmtCi,
} from "./stats";

const MS_MIN = 60_000;
const pctS = (x) => `${Math.round(x * 100)}%`;
const r1 = (x) => Math.round(x * 10) / 10;

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const m = (new Date(b).getTime() - new Date(a).getTime()) / MS_MIN;
  return m >= 0 && m < 720 ? m : null;   // discard clock-skew / stale rows
}

const isLost = (t) => t.status === "cancelled" || t.status === "no_show";

/**
 * Estimate how many customers were being served at once, by finding the
 * maximum overlap of [started_at, completed_at] intervals. This stands in
 * for "number of counters open" — we don't record staffing levels directly.
 */
function estimateServers(completed) {
  const events = [];
  completed.forEach((t) => {
    if (!t.started_at || !t.completed_at) return;
    events.push([+new Date(t.started_at), 1]);
    events.push([+new Date(t.completed_at), -1]);
  });
  if (!events.length) return 1;
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, max = 0;
  for (const [, d] of events) { cur += d; max = Math.max(max, cur); }
  return Math.max(1, max);
}

/** Distinct calendar hours in which at least one customer arrived. */
function activeHours(rows) {
  const set = new Set();
  rows.forEach((t) => {
    const d = new Date(t.created_at);
    set.add(`${d.toISOString().slice(0, 10)}#${d.getHours()}`);
  });
  return set.size;
}

/**
 * Find the wait duration after which abandonment rises most sharply.
 * Scans candidate cut points and keeps the one with the strongest
 * chi-square split, provided it is significant. This is the "customers are
 * much more likely to leave after N minutes" finding.
 */
function findAbandonThreshold(withWait) {
  let best = null;
  for (let cut = 5; cut <= 60; cut += 5) {
    const under = withWait.filter((t) => t.waitMin < cut);
    const over  = withWait.filter((t) => t.waitMin >= cut);
    if (under.length < 15 || over.length < 15) continue;

    const uLost = under.filter(isLost).length;
    const oLost = over.filter(isLost).length;
    const chi = chiSquareIndependence([
      [uLost, under.length - uLost],
      [oLost, over.length - oLost],
    ]);
    if (!chi?.reliable) continue;

    const uRate = uLost / under.length;
    const oRate = oLost / over.length;
    if (oRate <= uRate) continue;                 // only care about worsening

    if (!best || chi.chi2 > best.chi.chi2) {
      best = { cut, chi, uRate, oRate, uN: under.length, oN: over.length };
    }
  }
  return best && best.chi.significant ? best : null;
}

/**
 * @param {object[]} tickets rows with status, created_at, called_at,
 *        started_at, completed_at, service_id, source, customer_email, customer_phone
 * @param {object} serviceNames  service_id → name
 * @param {object} [extra]  { bookingsTotal, bookingsCompleted }
 */
export function buildFacts(tickets, serviceNames = {}, extra = {}) {
  const rows = (tickets ?? []).filter((t) => t?.created_at);
  const facts = [];
  const raw = {};

  // Below ~30 observations interval estimates are so wide that any "insight"
  // would be storytelling. Say so rather than pretend.
  if (rows.length < 30) {
    return { sampleSize: rows.length, facts: [], raw: {}, tooLittleData: true };
  }

  const nameOf = (id) => serviceNames?.[id] ?? "Unspecified";

  const completed = rows.filter((t) => t.status === "completed");
  const cancelled = rows.filter((t) => t.status === "cancelled");
  const noShow    = rows.filter((t) => t.status === "no_show");
  const lostAll   = rows.filter(isLost);

  const withWait = rows
    .map((t) => ({ ...t, waitMin: minutesBetween(t.created_at, t.called_at ?? t.completed_at) }))
    .filter((t) => t.waitMin != null);

  const durations = completed
    .map((t) => minutesBetween(t.started_at, t.completed_at))
    .filter((m) => m != null);

  /* ═══ 1. AVERAGE WAIT TIME ═════════════════════════════════════════ */
  const waitStats = withWait.length >= 10 ? describe(withWait.map((t) => t.waitMin)) : null;
  if (waitStats) {
    raw.wait = waitStats;
    facts.push(
      `AVERAGE WAIT: customers waited ${r1(waitStats.mean)} minutes on average before ` +
      `being called (total waiting time ÷ ${waitStats.n} customers measured).`
    );
  }

  /* ═══ 2. WAIT VARIABILITY ══════════════════════════════════════════ */
  if (waitStats) {
    const gap = waitStats.p90 - waitStats.median;
    facts.push(
      `WAIT VARIABILITY: median wait ${r1(waitStats.median)} min, standard deviation ` +
      `${r1(waitStats.sd)} min, 90th percentile ${r1(waitStats.p90)} min, longest ` +
      `${r1(waitStats.max)} min. ` +
      (waitStats.cv > 0.8
        ? `The spread is wide (CV ${waitStats.cv.toFixed(2)}): the average hides very ` +
          `uneven experiences — 1 in 10 customers waits ${r1(waitStats.p90)} min or more, ` +
          `${r1(gap)} min beyond the typical customer. Two businesses can share the same ` +
          `average while one is predictable and the other is not; this one is not.`
        : `The spread is fairly tight (CV ${waitStats.cv.toFixed(2)}), so the average is a ` +
          `fair description of what a typical customer actually experiences.`)
    );
  }

  /* ═══ 3. SERVICE RATE (μ) ══════════════════════════════════════════ */
  let mu = null, servers = 1;
  if (durations.length >= 10) {
    const d = describe(durations);
    raw.serviceTime = d;
    mu = 60 / d.mean;                       // customers per hour, per server
    servers = estimateServers(completed);
    raw.serviceRate = { perServerPerHour: mu, servers, capacityPerHour: mu * servers };
    facts.push(
      `SERVICE RATE: each server handles ${r1(mu)} customers per hour ` +
      `(mean service time ${r1(d.mean)} min). Up to ${servers} customer(s) were ` +
      `observed being served at once, giving a working capacity of about ` +
      `${r1(mu * servers)} customers per hour. Service time itself ranges ` +
      `${r1(d.min)}–${r1(d.max)} min (SD ${r1(d.sd)}, CV ${d.cv.toFixed(2)})` +
      (d.cv > 1
        ? `; a CV above 1.0 means the caseload is highly irregular, so any fixed-interval ` +
          `scheduling will misfire.`
        : `.`)
    );
  }

  /* ═══ 4. ARRIVAL RATE (λ) ══════════════════════════════════════════ */
  const hrs = activeHours(rows);
  let lambda = null;
  if (hrs >= 5) {
    lambda = rows.length / hrs;
    raw.arrivalRate = { perHour: lambda, activeHours: hrs, total: rows.length };
    facts.push(
      `ARRIVAL RATE: ${r1(lambda)} customers joined per operating hour ` +
      `(${rows.length} customers across ${hrs} hours that had any activity). ` +
      `Idle hours are excluded so this reflects real trading conditions.`
    );
  }

  /* ═══ 5. QUEUE PRESSURE RATIO (ρ = λ / capacity) ═══════════════════ */
  if (lambda != null && mu != null) {
    const capacity = mu * servers;
    const rho = lambda / capacity;
    // Judge the band on the same rounded figure that is shown, so the number
    // and the interpretation can never contradict each other.
    const rhoShown = Number(rho.toFixed(2));
    raw.queuePressure = { rho, rhoShown, lambda, capacity, servers };
    facts.push(
      `QUEUE PRESSURE: ρ = ${rhoShown.toFixed(2)} (arrival rate ${r1(lambda)}/hr ÷ capacity ` +
      `${r1(capacity)}/hr). ` +
      (rhoShown >= 1
        ? `ρ at or above 1.0 means customers arrive at least as fast as they can be served — ` +
          `the queue grows without limit and waits are unbounded until demand drops or ` +
          `capacity increases. This is the most serious operational signal available.`
        : rhoShown > 0.85
          ? `Above 0.85 the system is congested: queueing theory says waiting time rises ` +
            `steeply and non-linearly in this range, so small demand spikes cause large ` +
            `wait increases. Adding one server here has an outsized effect.`
          : rhoShown > 0.6
            ? `Between 0.6 and 0.85 is a healthy working range — busy but stable.`
            : `Below 0.6 there is comfortable slack; capacity exceeds demand most of the time.`)
    );
  }

  /* ═══ 6. CANCELLATION RATE ═════════════════════════════════════════ */
  const cancelCi = wilsonInterval(cancelled.length, rows.length);
  raw.cancellationRate = cancelCi;
  facts.push(
    `CANCELLATION RATE: ${cancelled.length} of ${rows.length} tickets were cancelled — ` +
    `${fmtCi(cancelCi)}. No-shows account for a further ${noShow.length} ` +
    `(${pctS(noShow.length / rows.length)}).`
  );

  /* ═══ 7. ABANDONMENT RATE + TIPPING POINT ══════════════════════════ */
  const lossCi = wilsonInterval(lostAll.length, rows.length);
  raw.abandonmentRate = lossCi;
  facts.push(
    `ABANDONMENT RATE: ${lostAll.length} of ${rows.length} customers who joined the queue ` +
    `left without being served — ${fmtCi(lossCi)}.`
  );

  if (withWait.length >= 40) {
    const thr = findAbandonThreshold(withWait);
    if (thr) {
      raw.abandonThreshold = thr;
      facts.push(
        `ABANDONMENT TIPPING POINT: customers who waited ${thr.cut} minutes or more ` +
        `abandoned at ${pctS(thr.oRate)} (n=${thr.oN}), versus ${pctS(thr.uRate)} for ` +
        `those under ${thr.cut} minutes (n=${thr.uN}). ` +
        `χ²(${thr.chi.df}) = ${thr.chi.chi2.toFixed(2)}, ${fmtP(thr.chi.pValue)} — ` +
        `the sharpest statistically significant split found. Keeping waits under ` +
        `${thr.cut} minutes is where retention is won or lost.`
      );
    } else {
      facts.push(
        `ABANDONMENT TIPPING POINT: no wait-time threshold produced a statistically ` +
        `significant jump in abandonment. There is no evidence in this data of a ` +
        `specific cut-off beyond which customers give up.`
      );
    }
  }

  /* ═══ 8. REPEAT RATE ═══════════════════════════════════════════════ */
  const idOf = (t) => (t.customer_email || t.customer_phone || "").trim().toLowerCase();
  const identified = rows.filter((t) => idOf(t));
  if (identified.length >= 30) {
    const counts = {};
    identified.forEach((t) => { const k = idOf(t); counts[k] = (counts[k] ?? 0) + 1; });
    const people = Object.values(counts);
    const repeaters = people.filter((n) => n > 1).length;
    const repeatCi = wilsonInterval(repeaters, people.length);
    raw.repeatRate = { ...repeatCi, uniqueCustomers: people.length,
                       visitsPerCustomer: identified.length / people.length };
    facts.push(
      `REPEAT RATE: ${repeaters} of ${people.length} identifiable customers came back more ` +
      `than once — ${fmtCi(repeatCi)}, averaging ` +
      `${(identified.length / people.length).toFixed(2)} visits each. ` +
      `(Based on ${identified.length} tickets carrying an email or phone.)`
    );
  }

  /* ═══ 9. CONVERSION ════════════════════════════════════════════════ */
  const fromBooking = rows.filter((t) => t.source === "booking");
  if (fromBooking.length >= 10) {
    const kept = fromBooking.filter((t) => t.status === "completed").length;
    const ci = wilsonInterval(kept, fromBooking.length);
    raw.bookingConversion = ci;
    facts.push(
      `BOOKING CONVERSION: of ${fromBooking.length} tickets that began as an online ` +
      `booking, ${kept} were completed — ${fmtCi(ci)}. Walk-ins completed at ` +
      `${pctS(rows.filter((t) => t.source !== "booking" && t.status === "completed").length /
              Math.max(1, rows.filter((t) => t.source !== "booking").length))}.`
    );
  }
  if (extra.bookingsTotal) {
    facts.push(
      `BOOKINGS MADE: ${extra.bookingsTotal} appointments were booked in this period` +
      (extra.bookingsCompleted != null
        ? `, of which ${extra.bookingsCompleted} reached completion.` : `.`)
    );
  }
  // Be explicit about what cannot be measured, so the model doesn't guess.
  facts.push(
    `NOT MEASURED: QR-scan-to-join and booking-page-visit-to-appointment conversion ` +
    `cannot be calculated — page views are not recorded, only completed check-ins and ` +
    `bookings. Do not estimate these.`
  );

  /* ═══ 10. SIGNIFICANCE OF THE WAIT → ABANDONMENT LINK ══════════════ */
  const buckets = [
    { label: "under 10 min", min: 0,  max: 10 },
    { label: "10–20 min",    min: 10, max: 20 },
    { label: "20–40 min",    min: 20, max: 40 },
    { label: "over 40 min",  min: 40, max: Infinity },
  ];
  const table = [];
  const bucketStats = [];
  for (const b of buckets) {
    const inB = withWait.filter((t) => t.waitMin >= b.min && t.waitMin < b.max);
    if (inB.length < 10) continue;
    const lost = inB.filter(isLost).length;
    const ci = wilsonInterval(lost, inB.length);
    table.push([lost, inB.length - lost]);
    bucketStats.push({ ...b, n: inB.length, lost, ci });
    facts.push(`Wait band ${b.label}: abandonment ${fmtCi(ci)}.`);
  }
  raw.buckets = bucketStats;

  if (table.length >= 2) {
    const chi = chiSquareIndependence(table);
    raw.chiSquare = chi;
    if (chi?.significant && chi.reliable) {
      facts.push(
        `Chi-square test of independence: abandonment IS related to wait length — ` +
        `χ²(${chi.df}) = ${chi.chi2.toFixed(2)}, ${fmtP(chi.pValue)}. Unlikely to be chance. ` +
        `Note this is association, not proof of cause.`
      );
    } else if (chi && !chi.reliable) {
      facts.push(
        `Chi-square test attempted but the smallest expected count was ` +
        `${chi.minExpected.toFixed(1)} (below 5), so it is not dependable here.`
      );
    } else if (chi) {
      facts.push(
        `Chi-square test does NOT find a significant link between wait length and ` +
        `abandonment: χ²(${chi.df}) = ${chi.chi2.toFixed(2)}, ${fmtP(chi.pValue)}. ` +
        `Differences between bands may be noise.`
      );
    }

    const corr = pearson(withWait.map((t) => t.waitMin), withWait.map((t) => (isLost(t) ? 1 : 0)));
    if (corr) {
      raw.correlation = corr;
      facts.push(
        `Correlation between minutes waited and abandonment: r = ${corr.r.toFixed(3)} ` +
        `(n = ${corr.n}, ${fmtP(corr.pValue)}); r² = ${(corr.r * corr.r).toFixed(3)}, so wait ` +
        `time accounts for about ${Math.round(corr.r * corr.r * 100)}% of the variation in ` +
        `whether a customer leaves — the rest is other factors.`
      );
    }
  }

  /* ═══ 11. PER-SERVICE ══════════════════════════════════════════════ */
  const byService = {};
  rows.forEach((t) => {
    const k = t.service_id ?? "none";
    byService[k] ??= { n: 0, lost: 0, durations: [] };
    byService[k].n++;
    if (isLost(t)) byService[k].lost++;
    const d = minutesBetween(t.started_at, t.completed_at);
    if (d != null) byService[k].durations.push(d);
  });

  raw.services = [];
  Object.entries(byService)
    .filter(([, v]) => v.n >= 15)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6)
    .forEach(([id, v]) => {
      const ci = wilsonInterval(v.lost, v.n);
      const others = { n: rows.length - v.n, lost: lostAll.length - v.lost };
      const cmp = others.n >= 15 ? twoProportionTest(v.lost, v.n, others.lost, others.n) : null;
      const d = v.durations.length >= 8 ? describe(v.durations) : null;
      raw.services.push({ service: nameOf(id), n: v.n, ci, cmp, duration: d });
      facts.push(
        `${nameOf(id)} (n = ${v.n}): abandonment ${fmtCi(ci)}` +
        (d ? `, median service ${r1(d.median)} min (SD ${r1(d.sd)})` : "") +
        (cmp ? `. Versus all other services: ${fmtP(cmp.pValue)}` +
               `${cmp.significant ? " — significant difference." : " — no significant difference."}` : ".")
      );
    });

  /* ═══ 12. DEMAND PATTERN ═══════════════════════════════════════════ */
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byHour = {}, byDay = {};
  rows.forEach((t) => {
    const dt = new Date(t.created_at);
    byHour[dt.getHours()] = (byHour[dt.getHours()] ?? 0) + 1;
    byDay[dt.getDay()]    = (byDay[dt.getDay()] ?? 0) + 1;
  });
  const hourRank = Object.entries(byHour).sort((a, b) => b[1] - a[1]);
  if (hourRank.length >= 3) {
    raw.peakHours = hourRank.slice(0, 3).map(([h, n]) => ({ hour: +h, count: n }));
    const share = hourRank.slice(0, 3).reduce((a, [, n]) => a + n, 0) / rows.length;
    facts.push(
      `Demand concentration: the three busiest hours (` +
      hourRank.slice(0, 3).map(([h, n]) => `${h}:00 with ${n}`).join(", ") +
      `) carry ${pctS(share)} of all check-ins — the natural place to add cover.`
    );
  }
  const dayRank = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
  if (dayRank.length >= 2) {
    raw.byDay = dayRank.map(([d, n]) => ({ day: DAYS[d], count: n }));
    facts.push(
      `Weekday demand ranges from ${DAYS[dayRank[0][0]]} (${dayRank[0][1]}) down to ` +
      `${DAYS[dayRank[dayRank.length - 1][0]]} (${dayRank[dayRank.length - 1][1]}).`
    );
  }

  return { sampleSize: rows.length, facts, raw, tooLittleData: false };
}
