import { Link } from "react-router-dom";
import { TIER_INFO, getTier } from "../lib/tier";
import { useAuth } from "../lib/AuthContext";
import Card from "./Card";
import Button from "./Button";

/**
 * TierGate — wraps a section that requires a higher tier than the user has.
 * If the user's tier ≥ `requires`, just renders children. Otherwise renders
 * a luxe "upgrade required" panel with a link to billing.
 *
 * Usage:
 *   <TierGate requires="manager" feature="Manager dashboard" reason="Track staff break patterns…">
 *     <ManagerInternals />
 *   </TierGate>
 */
export default function TierGate({ requires, feature, reason, children }) {
  const { user } = useAuth();
  const cur = getTier(user);
  const curRank = TIER_INFO[cur]?.rank ?? 0;
  const reqRank = TIER_INFO[requires]?.rank ?? 0;

  if (curRank >= reqRank) return children;

  const reqInfo = TIER_INFO[requires];
  return (
    <div className="atmosphere-hero p-8 max-w-2xl">
      <Card luxe className="p-9 text-center">
        <div className="ovline mb-3 text-gold-soft">{reqInfo.name} feature</div>
        <h1 className="font-display text-3xl font-light tracking-tightest mb-3">
          {feature ?? "This feature"} is on <em className="not-italic gold-text-soft">{reqInfo.name}.</em>
        </h1>
        {reason && (
          <p className="text-ink-soft text-sm leading-relaxed max-w-sm mx-auto mb-5">
            {reason}
          </p>
        )}

        <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>

        <div className="flex items-baseline justify-center gap-1 mb-6">
          <span className="text-ink-mute text-[10px]">RM</span>
          <span className="font-display text-gold text-5xl font-light">{reqInfo.price}</span>
          <span className="text-ink-mute text-[10px]">/mo</span>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/business/settings"><Button>Upgrade to {reqInfo.name} →</Button></Link>
          <a href="/#pricing" target="_blank" rel="noopener noreferrer"><Button variant="ghost">Compare tiers</Button></a>
        </div>

        <div className="text-[10px] text-ink-mute mt-5">
          You're on <span className="text-ink">{TIER_INFO[cur]?.name ?? "Essential"}</span> · upgrade anytime, no migration needed.
        </div>
      </Card>
    </div>
  );
}
