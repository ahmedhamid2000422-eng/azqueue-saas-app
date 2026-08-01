/**
 * tts.js — browser-native voice announcements via Web Speech API (SpeechSynthesis).
 *
 * Usage:
 *   import { announceTicket, isTtsEnabled, setTtsEnabled } from "./tts";
 *
 *   // When a ticket is called:
 *   announceTicket({ token: "A15", customerName: "Sara", counter: "Counter 2", branchId });
 *
 *   // Toggle per-branch:
 *   setTtsEnabled(branchId, true);
 *   isTtsEnabled(branchId); // → true
 *
 * Gracefully no-ops when SpeechSynthesis is unavailable (old browsers, SSR).
 *
 * ── PAYWALL / TOGGLE NOTE ─────────────────────────────────────────────────────
 * The on/off state is stored in localStorage so it persists across refreshes
 * without a schema change. Key: "azq.tts.<branchId>"
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = (branchId) => `azq.tts.${branchId}`;

/** Returns true if TTS is enabled for this branch (default: true). */
export function isTtsEnabled(branchId) {
  if (!branchId) return false;
  try {
    const val = localStorage.getItem(STORAGE_KEY(branchId));
    return val === null ? true : val === "true"; // default ON
  } catch {
    return true;
  }
}

/** Enable or disable TTS for a branch. */
export function setTtsEnabled(branchId, enabled) {
  if (!branchId) return;
  try {
    localStorage.setItem(STORAGE_KEY(branchId), enabled ? "true" : "false");
  } catch {}
}

/**
 * Announce a ticket being called.
 *
 * @param {object} opts
 * @param {string} opts.token        — ticket token, e.g. "A15"
 * @param {string} [opts.customerName] — customer name, e.g. "Sara"
 * @param {string} [opts.counter]    — counter/station label, e.g. "Counter 2"
 * @param {string} [opts.branchId]   — used to check the per-branch toggle
 */
export function announceTicket({ token, customerName, counter, branchId }) {
  if (typeof window === "undefined") return;
  if (!window.speechSynthesis) return;
  if (branchId && !isTtsEnabled(branchId)) return;

  // Cancel any currently playing announcement so we don't queue up a backlog
  window.speechSynthesis.cancel();

  const name    = customerName?.trim() || null;
  const station = counter?.trim()      || null;

  // Build announcement text
  // e.g. "Ticket A15, Sara, please proceed to Counter 2"
  // e.g. "Ticket A15, please proceed to the counter"
  let text = `Ticket ${token}`;
  if (name) text += `, ${name}`;
  text += ", please proceed to ";
  text += station ? station : "the counter";
  text += ".";

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate   = 0.92;   // slightly slower for clarity
  utterance.pitch  = 1.0;
  utterance.volume = 1.0;

  // Prefer a clear English voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Microsoft"))
  ) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}
