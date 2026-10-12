/**
 * My Events — the centre tab (/events/events). Hosting/Attending hub, Rolodex, create-event flow.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import AppEventsHub from "@evt/pages/AppEventsHub";

export default function MyEvents() {
  return <AppEventsHub />;
}
