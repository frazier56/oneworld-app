/**
 * Ticket pass — /events/ticket/:regId. EventTicket reads :regId itself and accepts either a
 * registration id (the route's declared meaning) or an event id (what the older hub links
 * passed), resolving to the signed-in user's live registration either way.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import EventTicket from "@evt/pages/EventTicket";

export default function EventTicketScreen() {
  return <EventTicket />;
}
