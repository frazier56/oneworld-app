/**
 * Ticket wallet — /events/tickets. Upcoming/past tickets with the QR pass view.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import AppTickets from "@evt/pages/AppTickets";

export default function TicketsScreen() {
  return <AppTickets />;
}
