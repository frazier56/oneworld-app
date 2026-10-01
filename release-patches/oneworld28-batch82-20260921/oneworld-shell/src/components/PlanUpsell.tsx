import { Link } from "react-router-dom";
import { W } from "../lib/i18n";
import { productHref } from "../routes";
import type { Product } from "../lib/oneId";

/**
 * THE DOOR OUT OF A LIMIT.
 * ============================================================================================
 * Lee, 18 September 2026: *"we need to make sure that there's a section to actually get to
 * subscription services. Like how does someone even subscribe? We need to make sure that there's
 * a logical flow there."*
 *
 * There WAS a plans screen, in the drawer, behind the hamburger — and Lee, who built the app,
 * could not find it. That is the whole finding: a pricing page nobody stumbles into is a pricing
 * page nobody buys from.
 *
 * ── WHERE THE FLOW ACTUALLY IS ─────────────────────────────────────────────────────────────
 * Not a banner on the home screen. The moment somebody wants a paid plan is the moment they hit
 * the edge of a free one — the ninth photo, the six hundred and first character, the fourth house
 * rule. The wall is the advert, so the wall carries the door. Everywhere a limit is stated, this
 * goes beside it.
 *
 * It says what the next tier actually gives, in the same units as the limit they just met, and
 * then gets out of the way. "Upgrade for more" is not information; "25 photos on Pro" is.
 */
export default function PlanUpsell({
  product, plan, what, lang, className = "",
}: {
  product: Product;
  /** The viewer's current plan. VIP is the top, so VIP is never shown this. */
  plan: string | null | undefined;
  /** What they would get, in the same unit as the limit they just hit. */
  what: { pro: string; vip: string };
  lang: string;
  className?: string;
}) {
  const p = String(plan ?? "free").toLowerCase();
  if (p === "vip") return null;

  /* Somebody already on Pro is only ever shown the VIP number. Repeating the Pro number to a Pro
     subscriber is an advert for what they already bought. */
  const line = p === "pro"
    ? W(lang, `VIP: ${what.vip}`, `VIP: ${what.vip}`)
    : W(lang, `Pro: ${what.pro} · VIP: ${what.vip}`, `Pro: ${what.pro} · VIP: ${what.vip}`);

  return (
    <Link
      to={productHref(product, "/plans")}
      className={`ow-tap mt-1.5 inline-flex flex-wrap items-center gap-x-1.5 text-[12px] font-bold text-brand-deep underline decoration-dotted underline-offset-4 dark:text-brand-light ${className}`}
    >
      <span>{line}</span>
      <span className="opacity-70">{W(lang, "See plans", "Ver planes")}</span>
    </Link>
  );
}
