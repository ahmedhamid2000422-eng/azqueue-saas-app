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
  if (branchId && !isTtsEnabled(branchId)) return;

  // Always play the chime first. On TV boxes (TV Bro, Silk, older WebViews)
  // SpeechSynthesis is frequently missing or silently no-ops, so the chime is
  // the dependable half of the announcement — it uses WebAudio and needs no
  // speech engine and no audio file.
  playChime();

  if (!window.speechSynthesis) return;

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

  // Speak just after the chime so the two don't overlap.
  setTimeout(() => speak(text), CHIME_MS);
}

function speak(text) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = 0.92;   // slightly slower for clarity
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;

    // Prefer a clear English voice if available. On Android TV the voice list
    // is often empty until `voiceschanged` fires, so an empty list is normal
    // and we simply let the engine pick its default.
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Microsoft"))
    ) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech unavailable — the chime already played, so the call is still audible.
  }
}

/* ── Chime (WebAudio) ──────────────────────────────────────────────────
   A two-tone "ding-dong" synthesised at runtime. No audio file to host, no
   speech engine required, so it works on TV browsers where SpeechSynthesis
   doesn't. Browsers block audio until the user interacts with the page at
   least once — call unlockAudio() from a tap handler (see the TV display's
   "Enable sound" overlay).                                              */

const CHIME_MS = 900;
let audioCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    try { audioCtx = new AC(); } catch { return null; }
  }
  return audioCtx;
}

/**
 * Resume the AudioContext. Must be called from inside a real user gesture
 * (click/tap/keypress) or browsers keep it suspended and nothing plays.
 * Returns true if audio is ready.
 */
export async function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    // Some engines only fully "arm" after producing sound once.
    tone(ctx, 880, ctx.currentTime, 0.01, 0.0001);
    // Warm up the speech engine too, silently.
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/** True when audio has been unlocked and will actually be heard. */
export function isAudioReady() {
  const ctx = getCtx();
  return !!ctx && ctx.state === "running";
}

function tone(ctx, freq, startAt, dur, peak = 0.25) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);
  // Soft attack + exponential decay reads as a bell rather than a beep
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);
}

/** Two-tone attention chime. Safe to call anywhere; silent if audio is locked. */
export function playChime() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    tone(ctx, 987.77, t,        0.45); // B5
    tone(ctx, 783.99, t + 0.28, 0.55); // G5
  } catch {
    // Non-fatal: the visual flash still signals the call.
  }
}
