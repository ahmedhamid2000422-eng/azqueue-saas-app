/**
 * normalize.js — Input sanitisation before identity matching.
 *
 * Rules:
 *   phone  → E.164 via libphonenumber-js (falls back to stripped digits)
 *   email  → lowercase + trim
 *   name   → trim + title-case if all-uppercase
 *   socialId → trim (FB/IG/WA IDs are opaque strings)
 *
 * Always returns a new object — never mutates the input.
 */

import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

// Default country hint when the caller doesn't provide one.
// Used only if the number has no leading country code.
const DEFAULT_COUNTRY = "US";

/**
 * Normalize a phone number to E.164.
 * Returns null if the input is falsy or unparseable.
 *
 * @param {string|null} raw  — any format: "+1 555 123 4567", "05501234567", etc.
 * @param {string}      country — ISO 3166-1 alpha-2 hint (e.g. "SA", "GB")
 * @returns {string|null}
 *
 * @example
 *   normalizePhone("+1 (555) 123-4567")   // "+15551234567"
 *   normalizePhone("0550 123 456", "SA")  // "+966550123456"
 *   normalizePhone("not-a-phone")          // null
 */
export function normalizePhone(raw, country = DEFAULT_COUNTRY) {
  if (!raw) return null;
  const stripped = raw.replace(/\s/g, "");
  try {
    if (isValidPhoneNumber(stripped, country)) {
      return parsePhoneNumber(stripped, country).format("E.164");
    }
    // Try without country hint (number may include country code)
    if (isValidPhoneNumber(stripped)) {
      return parsePhoneNumber(stripped).format("E.164");
    }
  } catch {
    // fall through
  }
  return null; // unparseable — caller decides what to do
}

/**
 * Normalize an email address.
 * Returns null if input is falsy or contains no "@".
 *
 * @param {string|null} raw
 * @returns {string|null}
 *
 * @example
 *   normalizeEmail("  Ahmed@Example.COM  ")  // "ahmed@example.com"
 */
export function normalizeEmail(raw) {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : null;
}

/**
 * Normalize a display name.
 * Converts ALL-CAPS names to Title Case. Trims whitespace.
 * Returns null if blank.
 *
 * @param {string|null} raw
 * @returns {string|null}
 *
 * @example
 *   normalizeName("AHMED HAMID")   // "Ahmed Hamid"
 *   normalizeName("  Sara  ")      // "Sara"
 */
export function normalizeName(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

/**
 * Normalize a social/external ID (Facebook PSID, IG IGSID, etc.)
 * Just trims whitespace. Returns null if blank.
 *
 * @param {string|null} raw
 * @returns {string|null}
 */
export function normalizeSocialId(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

/**
 * Normalize a full identity payload in one call.
 * Any field not provided is left as undefined (omitted from the result).
 *
 * @param {{
 *   name?:        string,
 *   email?:       string,
 *   phone?:       string,
 *   country?:     string,   — ISO country hint for phone parsing
 *   facebookId?:  string,
 *   instagramId?: string,
 *   whatsappId?:  string,
 *   freshdeskId?: string,
 * }} raw
 * @returns {{
 *   name?:        string,
 *   email?:       string,
 *   phone?:       string,
 *   facebookId?:  string,
 *   instagramId?: string,
 *   whatsappId?:  string,
 *   freshdeskId?: string,
 * }}
 */
export function normalizeIdentity(raw = {}) {
  const result = {};

  const name = normalizeName(raw.name);
  if (name)   result.name = name;

  const email = normalizeEmail(raw.email);
  if (email)  result.email = email;

  // WhatsApp IDs are phone numbers — normalize them too
  const phone = normalizePhone(raw.phone, raw.country);
  if (phone)  result.phone = phone;

  const waId = normalizePhone(raw.whatsappId, raw.country);
  if (waId)   result.whatsappId = waId;

  const fbId = normalizeSocialId(raw.facebookId);
  if (fbId)   result.facebookId = fbId;

  const igId = normalizeSocialId(raw.instagramId);
  if (igId)   result.instagramId = igId;

  const fdId = normalizeSocialId(raw.freshdeskId);
  if (fdId)   result.freshdeskId = fdId;

  return result;
}
