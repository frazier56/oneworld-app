/**
 * Receipt — /events/e/:id/receipt/:orderId. QR entry pass + calendar exports.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import EventReceipt from "@evt/pages/EventReceipt";

export default function EventReceiptScreen() {
  return <EventReceipt />;
}
