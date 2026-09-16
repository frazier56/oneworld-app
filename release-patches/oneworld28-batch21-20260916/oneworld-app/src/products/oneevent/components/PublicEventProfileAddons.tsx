import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { ConnectedPlatforms, useAsync, useI18n, supabase, W } from "@oneworld/shell";

const PublicSocialFeed = lazy(() => import("../../onesocial/PublicSocialFeed"));

type HostedEvent = {
  id: string;
  title: string | null;
  start_date: string | null;
  location: string | null;
  venue_name: string | null;
  cover_image_url: string | null;
  ticket_type: string | null;
  ticket_price: number | null;
  ga_ticket_price: number | null;
  vip_ticket_price: number | null;
  ga_sold: number | null;
  vip_sold: number | null;
};

const money = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? `$${n.toFixed(n % 1 ? 2 : 0)}` : null;

function eventPrice(e: HostedEvent) {
  return money(e.ga_ticket_price) || money(e.vip_ticket_price) || money(e.ticket_price);
}

function eventPlace(e: HostedEvent) {
  return [e.venue_name, e.location].filter(Boolean).join(" · ");
}

function EventInitial({ title }: { title: string }) {
  return (
    <div className="grid aspect-[16/10] w-full place-items-center bg-brand/10 text-3xl font-extrabold text-brand">
      {title.trim()[0]?.toUpperCase() || "E"}
    </div>
  );
}

export function PublicHostedEvents() {
  const { lang } = useI18n();
  const { userId } = useParams();
  const isEs = lang === "es" || lang === "co";

  const events = useAsync(async () => {
    const { data, error } = await supabase.from("events")
      .select("id, title, start_date, location, venue_name, cover_image_url, ticket_type, ticket_price, ga_ticket_price, vip_ticket_price, ga_sold, vip_sold")
      .eq("host_id", userId!)
      .eq("status", "published")
      .order("start_date", { ascending: true })
      .limit(8);
    if (error) {
      console.error("[oneevent] public hosted events read failed:", error.message);
      throw error;
    }
    return (data ?? []) as HostedEvent[];
  }, [userId], !!userId);

  const list = events ?? [];
  if (!list.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-widest opacity-45">
          {W(lang, "Hosted events", "Eventos del anfitrion")}
        </p>
        <span className="rounded-full border border-brand/25 bg-brand/5 px-2.5 py-1 text-[11px] font-bold text-brand">
          {list.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((event) => {
          const title = event.title || W(lang, "Untitled event", "Evento sin titulo");
          const sold = Number(event.ga_sold || 0) + Number(event.vip_sold || 0);
          const price = eventPrice(event);
          return (
            <Link
              key={event.id}
              to={`/events/e/${event.id}`}
              className="card block overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative overflow-hidden">
                {event.cover_image_url ? (
                  <img src={event.cover_image_url} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                ) : (
                  <EventInitial title={title} />
                )}
                {price && (
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-extrabold text-ink shadow-sm">
                    {price}
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3.5">
                <h2 className="line-clamp-2 text-[15px] font-extrabold leading-tight">{title}</h2>
                <div className="space-y-1 text-[12.5px] opacity-65">
                  {event.start_date && (
                    <p className="flex items-center gap-1.5">
                      <Calendar size={13} className="shrink-0 text-brand" />
                      {new Date(event.start_date).toLocaleDateString(isEs ? "es" : "en", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {eventPlace(event) && (
                    <p className="flex items-center gap-1.5">
                      <MapPin size={13} className="shrink-0 text-brand" />
                      <span className="line-clamp-1">{eventPlace(event)}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 font-semibold text-brand">
                    <Ticket size={13} className="shrink-0" />
                    {W(lang, `${sold} ticket${sold === 1 ? "" : "s"} sold`, `${sold} entrada${sold === 1 ? "" : "s"} vendida${sold === 1 ? "" : "s"}`)}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function PublicEventProfileSignals() {
  const { userId } = useParams();
  if (!userId) return null;
  return (
    <>
      <ConnectedPlatforms userId={userId} />
      <Suspense fallback={null}>
        <PublicSocialFeed />
      </Suspense>
    </>
  );
}
