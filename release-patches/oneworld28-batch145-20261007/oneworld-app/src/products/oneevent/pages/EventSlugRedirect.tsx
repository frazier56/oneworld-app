import { useEffect, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { supabase } from "@evt/integrations/supabase/client";

/**
 * Vanity event link: https://onesocial.ai/events/<slug>
 * Resolves the slug → event id, then forwards to /discover-events/:id,
 * which already handles draft / cancelled / not-found states.
 */
export default function EventSlugRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const { search } = useLocation();
  const [target, setTarget] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setNotFound(true);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("resolve_event_slug", { s: slug });
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
      } else {
        setTarget(`/events/e/${data}${search || ""}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, search]);

  if (target) return <Navigate to={target} replace />;
  if (notFound) return <Navigate to="/events" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
