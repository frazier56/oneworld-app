/**
 * Event detail — /events/e/:id (public in spirit: a shared link opens without a wall).
 * EventDetail reads :id itself and decodes flyer-QR base64url codes to uuids.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import EventDetail from "@evt/pages/EventDetail";

export default function EventDetailScreen() {
  return <EventDetail />;
}
