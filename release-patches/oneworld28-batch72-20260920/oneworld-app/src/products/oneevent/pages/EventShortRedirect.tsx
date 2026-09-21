import { useEffect } from "react";
import { Navigate, useParams, useLocation } from "react-router-dom";
import { eventCodeToUuid } from "@evt/lib/eventShortLinks";

/**
 * Short event link used by QR codes on AI-generated flyers:
 *   https://onesocial.ai/e/<eventCode>?src=ai_flyer
 * Forwards to the canonical /discover-events/:id route, preserving query string.
 */
export default function EventShortRedirect() {
  const { id } = useParams<{ id: string }>();
  const { search } = useLocation();

  useEffect(() => {
    // no-op; render-time <Navigate> handles it
  }, []);

  if (!id) return <Navigate to="/events" replace />;
  return <Navigate to={`/events/e/${eventCodeToUuid(id)}${search || ""}`} replace />;
}
