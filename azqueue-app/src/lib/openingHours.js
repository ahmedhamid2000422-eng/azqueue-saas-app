/**
 * openingHours — read the branch's trading hours for a given day.
 *
 * Stored on branches.hours as JSON keyed by short weekday name:
 *   {"mon":["09:00","18:00"], "tue":["09:00","18:00"], "sun":null}
 *
 * A missing key or a null value means closed that day. That distinction
 * matters on the TV: "Closed today" is useful information, whereas showing
 * nothing at all just looks like the screen is broken.
 */

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Turn "18:00" into "6:00 PM". Falls back to the raw string if unparseable. */
export function prettyTime(hhmm) {
  if (typeof hhmm !== "string" || !hhmm.includes(":")) return hhmm ?? "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Today's hours.
 * @returns {{open:string, close:string, openPretty:string, closePretty:string, closed:false}
 *          | {closed:true} | null}   null = no hours configured at all
 */
export function hoursForToday(hours, now = new Date()) {
  if (!hours || typeof hours !== "object") return null;
  const key = DAYS[now.getDay()];
  const entry = hours[key];

  // Explicitly configured as closed today.
  if (entry === null || entry === false) return { closed: true };
  if (!Array.isArray(entry) || entry.length < 2) return null;

  const [open, close] = entry;
  if (!open || !close) return { closed: true };

  return {
    closed: false,
    open, close,
    openPretty:  prettyTime(open),
    closePretty: prettyTime(close),
  };
}

/** Minutes until closing time today; null if unknown or already closed. */
export function minutesUntilClose(hours, now = new Date()) {
  const t = hoursForToday(hours, now);
  if (!t || t.closed) return null;
  const [h, m] = t.close.split(":").map(Number);
  const closeAt = new Date(now);
  closeAt.setHours(h, m, 0, 0);
  const diff = Math.round((closeAt - now) / 60000);
  return diff > 0 ? diff : null;
}

/** True when the current time falls inside today's trading hours. */
export function isOpenNow(hours, now = new Date()) {
  const t = hoursForToday(hours, now);
  if (!t || t.closed) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  return mins >= toMin(t.open) && mins < toMin(t.close);
}
