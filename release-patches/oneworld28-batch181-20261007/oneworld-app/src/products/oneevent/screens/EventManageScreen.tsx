/**
 * Host management — /events/events/:id/manage. Registrations, check-in, payouts, applicants.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import EventManagement from "@evt/pages/EventManagement";

export default function EventManageScreen() {
  return <EventManagement />;
}
