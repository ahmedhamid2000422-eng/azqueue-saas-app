/**
 * score.ts — Lead scoring logic.
 *
 * Classifies a completed conversation context into HOT / WARM / COLD
 * and generates a next_action recommendation.
 *
 * This runs deterministically (no AI call needed for scoring itself —
 * Claude is used for the summary only).
 */

export type LeadScore = "HOT" | "WARM" | "COLD";
export type NextAction = "Book consultation" | "Follow up" | "Send estimate" | "Nurture";

export interface ScoredLead {
  lead_score:  LeadScore;
  next_action: NextAction;
  summary:     string;
}

interface Context {
  service_category?: string;
  property_type?:    string;
  location?:         string;
  budget_range?:     string;
  timeline?:         string;
  requirements?:     string;
  [key: string]:     unknown;
}

/** Returns true if the value looks like a real answer (not blank / "skip" / "not sure"). */
function hasAnswer(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  return v.length > 0 && !["skip", "not sure", "n/a", "na", "no", "-", "unsure"].includes(v);
}

/** Returns true if the timeline suggests urgency or near-term intent. */
function isUrgent(timeline: string | undefined): boolean {
  if (!timeline) return false;
  const t = timeline.toLowerCase();
  return (
    t.includes("urgent") ||
    t.includes("asap") ||
    t.includes("1") ||          // "1-3 months" or choice "1"
    t.includes("month") ||
    t.includes("soon") ||
    t.includes("deadline")
  );
}

/** Returns true if a budget / revenue / goal has been stated concretely. */
function hasBudget(budget: string | undefined): boolean {
  if (!budget) return false;
  const b = budget.toLowerCase();
  // Skip vague answers
  if (b.includes("not sure") || b.includes("unsure") || b.includes("prefer not")) return false;
  return true;
}

export function scoreContext(ctx: Context): { score: LeadScore; next_action: NextAction } {
  const urgent   = isUrgent(ctx.timeline);
  const budget   = hasBudget(ctx.budget_range);
  const location = hasAnswer(ctx.location);
  const service  = hasAnswer(ctx.service_category);

  // HOT: budget + urgent + has service intent + location known
  if (budget && urgent && service) {
    return { score: "HOT", next_action: "Book consultation" };
  }

  // HOT (slightly less): budget + near-term + location
  if (budget && location && isUrgent(ctx.timeline)) {
    return { score: "HOT", next_action: "Book consultation" };
  }

  // WARM: either budget OR timeline, has some intent
  if ((budget || urgent) && service) {
    return { score: "WARM", next_action: budget ? "Send estimate" : "Follow up" };
  }

  // WARM: has location + service but no budget/timeline
  if (service && location) {
    return { score: "WARM", next_action: "Follow up" };
  }

  // COLD: general inquiry, no budget, no urgency
  return { score: "COLD", next_action: "Nurture" };
}

/**
 * Build a plain-English summary without Claude (for fast path).
 * Claude can enrich this later; this is the fallback.
 */
export function buildSummary(ctx: Context, score: LeadScore): string {
  const parts: string[] = [];

  if (ctx.service_category) parts.push(`Interested in: ${ctx.service_category}`);
  if (ctx.property_type)    parts.push(`Type: ${ctx.property_type}`);
  if (ctx.location)         parts.push(`Location: ${ctx.location}`);
  if (ctx.budget_range)     parts.push(`Budget/goal: ${ctx.budget_range}`);
  if (ctx.timeline)         parts.push(`Timeline: ${ctx.timeline}`);
  if (ctx.requirements)     parts.push(`Notes: ${ctx.requirements}`);

  const base = parts.join(" · ");
  const tag  = score === "HOT" ? "🔥 Hot lead — ready to move forward."
             : score === "WARM" ? "🌡 Warm lead — follow up within 48 hrs."
             : "❄️ Cold lead — add to nurture sequence.";

  return base ? `${base}. ${tag}` : tag;
}
