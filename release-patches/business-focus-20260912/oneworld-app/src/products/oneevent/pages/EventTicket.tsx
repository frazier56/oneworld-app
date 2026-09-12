import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, Ticket } from "lucide-react";
import AppLayout from "@evt/components/app/AppLayout";
import EventTicketView from "@evt/components/events/EventTicketView";
import { useAuth } from "@evt/hooks/useAuth";
import { supabase } from "@evt/integrations/supabase/client";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { ScreenHeading } from "@oneworld/shell";

export default function EventTicket() {
  const { t } = useLanguage();
  /* Route is /events/ticket/:regId. Historically callers passed an EVENT id here (the page
     then loaded the signed-in user's latest registration for it); the new route name says
     REGISTRATION id. Accept both: try the value as a registration id first, then fall back
     to treating it as an event id — old links and new links both resolve. */
  const { regId } = useParams<{ regId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const backState = (location.state as { backMode?: "history"; backLabel?: string } | null) ?? null;
  const backLabel = backState?.backLabel ?? t("tix.back_events", "Back to My Events");

  const handleBack = () => {
    if (backState?.backMode === "history") {
      navigate(-1);
      return;
    }
    navigate("/events/events");
  };

  useEffect(() => {
    if (!user?.id || !regId) return;

    let active = true;

    const loadTicket = async () => {
      setLoading(true);

      /* 1) As a registration id (the route's declared meaning). */
      let reg: any = null;
      const { data: byRegId } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("id", regId)
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .maybeSingle();
      reg = byRegId ?? null;

      /* 2) Fall back: the value is an event id — latest live registration for it. */
      if (!reg) {
        const { data: byEventId } = await supabase
          .from("event_registrations")
          .select("*")
          .eq("event_id", regId)
          .eq("user_id", user.id)
          .neq("status", "cancelled")
          .order("registered_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        reg = byEventId ?? null;
      }

      const eventId = reg?.event_id ?? regId;
      const [{ data: eventData }, { data: profileData }] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId).single(),
        /* Granted columns only — select("*") on profiles throws 42501. */
        supabase.from("profiles").select("id, full_name, photo_url, category").eq("id", user.id).single(),
      ]);

      if (!active) return;

      setEvent(eventData ?? null);
      setRegistration(reg);
      setProfile(profileData ?? null);
      setLoading(false);
    };

    loadTicket();

    return () => {
      active = false;
    };
  }, [regId, user?.id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!event || !registration) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-8">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Ticket className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mb-2 font-display text-2xl font-bold text-foreground">{t("tix.not_found", "Ticket not found")}</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              {t("tix.not_found_desc", "We couldn't find an active ticket for this event on your account.")}
            </p>
            <button
              onClick={handleBack}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {backLabel}
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-8">
        {/* v14 (Lee): every screen carries its name — this one is your ticket. */}
        <ScreenHeading>{t("tix.title", "My Ticket")}</ScreenHeading>
        <EventTicketView
          event={{
            id: event.id,
            title: event.title,
            location: event.location || event.venue_name || "",
            start_date: event.start_date || undefined,
            end_date: event.end_date || undefined,
            timezone: event.timezone || undefined,
            cover_image_url: event.cover_image_url || undefined,
          }}
          registration={{
            id: registration.id,
            qr_code: registration.qr_code,
            quantity: registration.quantity,
            status: registration.status,
            amount_paid_cents: registration.amount_paid_cents,
            paid_at: registration.paid_at,
            registered_at: registration.registered_at,
          }}
          currency={event.currency || "USD"}
          userName={profile?.full_name || user?.email || "Member"}
          userCategory={profile?.category || undefined}
          onBack={handleBack}
          backLabel={backLabel}
        />
      </div>
    </AppLayout>
  );
}
