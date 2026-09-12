/**
 * Hosts — /events/hosts. Find organizers by city; profiles open at /events/p/:id.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import HostSearch from "@evt/pages/HostSearch";

export default function Hosts() {
  return <HostSearch />;
}
