/**
 * Application gate — /events/e/:id/apply. Creates event_applications then forwards to checkout.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import EventApply from "@evt/pages/EventApply";

export default function EventApplyScreen() {
  return <EventApply />;
}
