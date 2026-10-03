// Canonical plan config for OneEvent (One World template). Single source of truth
// for pricing, the 3-month prepay discount, description char limits, and feature
// gating. See project memory `oneevent-pricing.md`. (Lee, Jul 22 2026)
export type PlanId = "free" | "pro" | "vip";

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;          // USD / month, month-to-month
  quarterlyDiscount: number; // fraction off when paying 3 months up front (0, .10, .20)
  charLimit: number;         // description / bio character cap
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Basic",
    monthly: 0,
    quarterlyDiscount: 0,
    charLimit: 1000,
    tagline: "Everything you need to run your first events.",
    features: [
      "Create events, sell tickets & take RSVPs",
      "QR check-in at the door",
      "Photo uploads & event media sharing",
      "Speak with AI (VAIA) — up to 1,000-character descriptions",
      "Attendee Rolodex & group messaging",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 9.99,
    quarterlyDiscount: 0.10,
    charLimit: 3000,
    tagline: "For active hosts who want more polish and control.",
    highlight: true,
    features: [
      "Everything in Basic",
      "Speak with AI — richer, up to 3,000-character descriptions",
      "Require a minimum OneScore to register",
      "Priority placement in Discover",
    ],
  },
  {
    id: "vip",
    name: "VIP",
    monthly: 19.99,
    quarterlyDiscount: 0.20,
    charLimit: 6000,
    tagline: "Every tool unlocked for serious event businesses.",
    features: [
      "Everything in Pro",
      "Speak with AI — full, up to 6,000-character descriptions",
      "Discount / promo codes for your tickets",
      "Applications & request-to-join gating",
      "Generate event flyers with VAIA",
    ],
  },
];

export function normalizePlan(plan?: string | null): PlanId {
  if (plan === "vip" || plan === "monster") return "vip";
  if (plan === "pro" || plan === "scout") return "pro";
  return "free";
}

export function planById(plan?: string | null): Plan {
  const id = normalizePlan(plan);
  return PLANS.find((p) => p.id === id)!;
}

/** Total charged for a 3-month prepay (discount applied). */
export function quarterlyTotal(plan: Plan): number {
  return plan.monthly * 3 * (1 - plan.quarterlyDiscount);
}

/** Effective per-month price on the 3-month prepay plan. */
export function quarterlyPerMonth(plan: Plan): number {
  return quarterlyTotal(plan) / 3;
}

export function descriptionLimitFor(plan?: string | null): number {
  return planById(plan).charLimit;
}

export function money(n: number): string {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}
