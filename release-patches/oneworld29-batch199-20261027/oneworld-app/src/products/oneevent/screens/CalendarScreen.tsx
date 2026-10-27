/**
 * Calendar — /events/calendar. Upcoming calendar_events + job_executions.
 * Thin wrapper: the ported page owns the screen; AppShell owns all chrome.
 */
import CalendarPage from "@evt/pages/CalendarPage";

export default function CalendarScreen() {
  return <CalendarPage />;
}
