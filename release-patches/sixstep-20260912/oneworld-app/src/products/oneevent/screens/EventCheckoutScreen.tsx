/**
 * Checkout — /events/e/:id/checkout. Stripe rail (fee = shell FEE_RATE) plus Wise/PayPal direct.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import EventCheckout from "@evt/pages/EventCheckout";

export default function EventCheckoutScreen() {
  return <EventCheckout />;
}
