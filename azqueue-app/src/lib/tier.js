/**
 * tier.js — single source of truth for plan-based feature limits.
 *
 * Read tier from auth.users.user_metadata.tier (set during signup).
 * Defaults to "essential" if missing.
 *
 * Used by:
 *   - Settings → Staff (seat-count cap)
 *   - Settings → Branches (branch-count cap)
 *   - Manager dashboard nav (gated to manager tier)
 *   - DisplaySetup (some features gated)
 *   - AI Assist (Personal Flow always-on; business needs Executive+)
 */

export const TIERS = ["essential", "professional", "executive", "manager"];

export const TIER_INFO = {
  essential: {
    name:  "Essential",
    price: 29,
    rank:  0,
  },
  professional: {
    name:  "Professional",
    price: 59,
    rank:  1,
  },
  executive: {
    name:  "Executive",
    price: 99,
    rank:  2,
  },
  manager: {
    name:  "Manager",
    price: 149,
    rank:  3,
  },
};

export const TIER_LIMITS = {
  essential: {
    maxStaff:          3,
    maxBranches:       1,
    autopilot:         false,
    islamicMode:       false,
    managerMode:       false,
    opsStations:       false,
    opsSla:            false,
    aiInsights:        false,
    customExports:     false,
    apiAccess:         false,
    customerProfiles:  false,  // Feature 03
    customerAi:        false,  // Feature 03 — AI summaries
  },
  professional: {
    maxStaff:          10,
    maxBranches:       3,
    autopilot:         true,
    islamicMode:       true,
    managerMode:       false,
    opsStations:       true,
    opsSla:            true,
    aiInsights:        false,
    customExports:     true,
    apiAccess:         false,
    customerProfiles:  true,   // Feature 03
    customerAi:        false,  // AI summaries need Executive+
  },
  executive: {
    maxStaff:          25,
    maxBranches:       10,
    autopilot:         true,
    islamicMode:       true,
    managerMode:       false,
    opsStations:       true,
    opsSla:            true,
    aiInsights:        true,
    customExports:     true,
    apiAccess:         true,
    customerProfiles:  true,   // Feature 03
    customerAi:        true,   // Feature 03 — AI summaries
  },
  manager: {
    maxStaff:          999,
    maxBranches:       999,
    autopilot:         true,
    islamicMode:       true,
    managerMode:       true,
    opsStations:       true,
    opsSla:            true,
    aiInsights:        true,
    customExports:     true,
    apiAccess:         true,
    customerProfiles:  true,   // Feature 03
    customerAi:        true,   // Feature 03 — AI summaries
  },
};

export function getTier(user) {
  return user?.user_metadata?.tier || "essential";
}

export function getLimits(user) {
  return TIER_LIMITS[getTier(user)] ?? TIER_LIMITS.essential;
}

export function tierAtLeast(user, minimum) {
  const cur = TIER_INFO[getTier(user)]?.rank ?? 0;
  const min = TIER_INFO[minimum]?.rank ?? 0;
  return cur >= min;
}

/** Returns the cheapest tier that unlocks a given feature flag. */
export function tierRequiredFor(feature) {
  for (const tier of TIERS) {
    if (TIER_LIMITS[tier][feature]) return tier;
  }
  return null;
}
