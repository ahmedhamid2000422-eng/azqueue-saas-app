/**
 * stats.js — inferential statistics for queue analysis.
 *
 * Implemented here rather than pulled from a library so the maths is
 * auditable and the bundle stays small. Every function is a standard,
 * textbook estimator; references given per function.
 *
 * The point of these is honesty about uncertainty. "40% of customers cancel"
 * means very little on its own — with 10 tickets it is noise, with 400 it is
 * a finding. Confidence intervals and p-values are what separate the two.
 */

/* ── Distribution helpers ──────────────────────────────────────────── */

/** Abramowitz & Stegun 7.1.26 — max error 1.5e-7. */
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

/** Standard normal CDF. */
export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Two-sided p-value for a z statistic. */
export function twoSidedP(z) {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/* ── Incomplete gamma, for the chi-square tail ─────────────────────── */

function gammaln(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/** Regularised lower incomplete gamma P(a,x) by series expansion. */
function gser(a, x) {
  const ITMAX = 200, EPS = 3e-12;
  if (x <= 0) return 0;
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 0; n < ITMAX; n++) {
    ap++; del *= x / ap; sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
}

/** Regularised upper incomplete gamma Q(a,x) by continued fraction. */
function gcf(a, x) {
  const ITMAX = 200, EPS = 3e-12, FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;  if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

/** Upper tail of the chi-square distribution: P(X > x | df). */
export function chiSquareP(x, df) {
  if (x <= 0 || df <= 0) return 1;
  const a = df / 2, xx = x / 2;
  return xx < a + 1 ? 1 - gser(a, xx) : gcf(a, xx);
}

/* ── Estimators ────────────────────────────────────────────────────── */

/**
 * Wilson score interval for a proportion.
 * Preferred over the normal approximation: it behaves sensibly at small n
 * and near 0% or 100%, where the textbook interval can run outside [0,1].
 * Wilson (1927), J. Amer. Statist. Assoc.
 */
export function wilsonInterval(successes, n, z = 1.96) {
  if (!n) return null;
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const halfWidth = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return {
    estimate: p,
    low:  Math.max(0, (centre - halfWidth) / d),
    high: Math.min(1, (centre + halfWidth) / d),
    n,
  };
}

/**
 * Two-proportion z-test — is the loss rate genuinely different between two
 * groups, or could this gap be chance?
 */
export function twoProportionTest(s1, n1, s2, n2) {
  if (!n1 || !n2) return null;
  const p1 = s1 / n1, p2 = s2 / n2;
  const pooled = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = (p1 - p2) / se;
  return {
    p1, p2,
    diff: p1 - p2,
    z,
    pValue: twoSidedP(z),
    significant: twoSidedP(z) < 0.05,
  };
}

/**
 * Chi-square test of independence on an r×c contingency table.
 * Answers: is outcome related to group at all, across every group at once?
 */
export function chiSquareIndependence(table) {
  const rows = table.length;
  const cols = table[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return null;

  const rowSums = table.map((r) => r.reduce((a, b) => a + b, 0));
  const colSums = Array.from({ length: cols }, (_, j) =>
    table.reduce((a, r) => a + r[j], 0));
  const total = rowSums.reduce((a, b) => a + b, 0);
  if (!total) return null;

  let chi2 = 0;
  let minExpected = Infinity;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowSums[i] * colSums[j]) / total;
      minExpected = Math.min(minExpected, expected);
      if (expected > 0) chi2 += ((table[i][j] - expected) ** 2) / expected;
    }
  }
  const df = (rows - 1) * (cols - 1);
  return {
    chi2,
    df,
    pValue: chiSquareP(chi2, df),
    significant: chiSquareP(chi2, df) < 0.05,
    // Cochran's rule: expected counts under 5 make the approximation unsafe
    reliable: minExpected >= 5,
    minExpected,
  };
}

/** Pearson correlation coefficient. */
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  // t = r*sqrt((n-2)/(1-r^2)), approximated to a normal for the p-value
  const t = r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));
  return { r, n, pValue: twoSidedP(t), significant: twoSidedP(t) < 0.05 };
}

/** Mean, standard deviation, and coefficient of variation. */
export function describe(values) {
  const n = values.length;
  if (!n) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1
    ? values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)
    : 0;
  const sd = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    n, mean, sd,
    cv: mean ? sd / mean : null,       // coefficient of variation
    median: q(0.5), p75: q(0.75), p90: q(0.9), min: sorted[0], max: sorted[n - 1],
  };
}

/** Format a p-value the way a report would. */
export function fmtP(p) {
  if (p == null) return "n/a";
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(3)}`;
}

/** Format a proportion with its confidence interval. */
export function fmtCi(ci) {
  if (!ci) return "n/a";
  const pct = (x) => `${Math.round(x * 100)}%`;
  return `${pct(ci.estimate)} (95% CI ${pct(ci.low)}–${pct(ci.high)}, n=${ci.n})`;
}
