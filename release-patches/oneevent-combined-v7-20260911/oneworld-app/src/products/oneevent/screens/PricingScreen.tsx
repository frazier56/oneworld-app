/**
 * Plans — /events/pricing. Stripe plan checkout + billing portal.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import Pricing from "@evt/pages/Pricing";

export default function PricingScreen() {
  return <Pricing />;
}
