/**
 * Prayer time service — fetches real timings from the Aladhan API.
 * Free, public, no auth needed. https://aladhan.com/prayer-times-api
 *
 * Strategy:
 *   1. Cache today's timings in localStorage keyed by date + lat/lng
 *   2. Fetch on miss from /v1/timings/{DD-MM-YYYY}?latitude=X&longitude=Y&method=2
 *   3. method=2 = Islamic Society of North America (sensible global default)
 *   4. Returns { fajr, dhuhr, asr, maghrib, isha, jumah } as "HH:MM" strings
 *
 * Designed to be resilient — falls back to sensible defaults if the API
 * is unreachable so the app never breaks.
 */

const FALLBACK_KL = {
  fajr:    "05:55",
  dhuhr:   "13:15",
  asr:     "16:30",
  maghrib: "19:25",
  isha:    "20:35",
  jumah:   "13:15",
};

const PRAYER_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const CACHE_PREFIX = "azq.prayertimes.";

function cacheKey(lat, lng, date) {
  return `${CACHE_PREFIX}${date}.${lat?.toFixed(3)}.${lng?.toFixed(3)}`;
}

function todayDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function ddmmyyyy(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Fetch today's prayer times for a given lat/lng.
 * Returns { fajr, dhuhr, asr, maghrib, isha, jumah } in HH:MM format.
 */
export async function fetchPrayerTimes({ lat, lng } = {}) {
  // No coordinates → use sensible default
  if (lat == null || lng == null) return FALLBACK_KL;

  const date = todayDate();
  const key = cacheKey(lat, lng, date);

  // 1. Cache hit
  try {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch {
    // localStorage unavailable — fine, just skip
  }

  // 2. Fetch from Aladhan
  try {
    const url = `https://api.aladhan.com/v1/timings/${ddmmyyyy()}?latitude=${lat}&longitude=${lng}&method=2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Aladhan ${res.status}`);
    const json = await res.json();
    const t = json?.data?.timings;
    if (!t) throw new Error("Bad response");

    const times = {
      fajr:    stripTimezone(t.Fajr),
      dhuhr:   stripTimezone(t.Dhuhr),
      asr:     stripTimezone(t.Asr),
      maghrib: stripTimezone(t.Maghrib),
      isha:    stripTimezone(t.Isha),
      jumah:   stripTimezone(t.Dhuhr), // Jumu'ah held at Dhuhr time on Fridays
    };

    try { localStorage.setItem(key, JSON.stringify(times)); } catch {}
    return times;
  } catch (e) {
    // 3. Network failure → fall back to KL defaults
    console.warn("prayer times fetch failed, using fallback", e);
    return FALLBACK_KL;
  }
}

// Aladhan returns "13:15 (+08)" — strip the parenthetical
function stripTimezone(s) {
  if (!s) return null;
  return s.split(" ")[0];
}

/**
 * Given a times object and a Date, return the next upcoming prayer.
 * If all today's prayers have passed, returns tomorrow's Fajr.
 */
export function getNextPrayer(times, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // On Fridays, Dhuhr becomes Jumu'ah
  const isFriday = now.getDay() === 5;

  for (const name of PRAYER_NAMES) {
    const [h, m] = times[name].split(":").map(Number);
    const t = new Date(today);
    t.setHours(h, m, 0, 0);
    if (t > now) {
      return {
        name: isFriday && name === "dhuhr" ? "Jumu'ah" : capitalise(name),
        time: times[name],
        at: t,
        msUntil: t - now,
      };
    }
  }

  // All passed → tomorrow's Fajr
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const [h, m] = times.fajr.split(":").map(Number);
  tomorrow.setHours(h, m, 0, 0);
  return {
    name: "Fajr",
    time: times.fajr,
    at: tomorrow,
    msUntil: tomorrow - now,
  };
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pause-window status — used to decide whether the queue should be paused.
 * Returns one of:
 *   - { state: "clear" }                          — far from any prayer
 *   - { state: "approaching", prayer, msUntil }   — within `warnMinutes` of prayer (soft signal)
 *   - { state: "paused",      prayer, msLeft }    — currently within prayer window (hard pause)
 */
export function getPauseStatus(times, options = {}, now = new Date()) {
  const warnMinutes = options.warnMinutes ?? 10;
  const pauseDurationMinutes = options.pauseDurationMinutes ?? 20;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (const name of PRAYER_NAMES) {
    const [h, m] = times[name].split(":").map(Number);
    const start = new Date(today);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + pauseDurationMinutes * 60000);
    const warn = new Date(start.getTime() - warnMinutes * 60000);

    if (now >= start && now < end) {
      return { state: "paused", prayer: capitalise(name), msLeft: end - now };
    }
    if (now >= warn && now < start) {
      return { state: "approaching", prayer: capitalise(name), msUntil: start - now };
    }
  }

  return { state: "clear" };
}

export function minutesUntilLabel(ms) {
  if (ms < 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `in ${hours}h` : `in ${hours}h ${rem}m`;
}
