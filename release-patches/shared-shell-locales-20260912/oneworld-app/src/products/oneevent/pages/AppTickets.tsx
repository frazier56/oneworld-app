import { ScreenHeading } from "@oneworld/shell";
import { useState, useEffect } from "react";
import { VaiaPopupCard } from "@evt/components/app/VaiaPopupCard";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@evt/hooks/use-mobile";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { useAuth } from "@evt/hooks/useAuth";
import { supabase } from "@evt/integrations/supabase/client";
import AppLayout from "@evt/components/app/AppLayout";
import InfoTip from "@evt/components/InfoTip";
import EventTicketView from "@evt/components/events/EventTicketView";
import {
  Calendar, MapPin, User, QrCode, CheckCircle, Clock,
  AlertCircle, Loader2, Ticket,
} from "lucide-react";
import { cn } from "@evt/lib/utils";
import { currencySymbol } from "@evt/lib/currencies";

type Tab = "upcoming" | "past" | "archived" | "all";

interface TicketRow {
  id: string;
  event_id: string;
  status: string;
  quantity: number;
  qr_code: string | null;
  registered_at: string;
  checked_in_at: string | null;
  checked_in_count: number;
  event: {
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    timezone?: string | null;
    location: string | null;
    cover_image_url: string | null;
    host_id: string;
    ticket_type: string | null;
    ga_ticket_price: number | null;
    vip_ticket_price: number | null;
    ticket_price: number | null;
  };
  hostName?: string;
}

function useTicketStatusCfg() {
  const { t } = useLanguage();
  return {
    registered: { label: t("ticket.status.registered"), color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.1)", Icon: Clock },
    "checked-in": { label: t("ticket.status.checked_in"), color: "#22C55E", bg: "rgba(34,197,94,0.15)", Icon: CheckCircle },
    completed: { label: t("ticket.status.completed"), color: "#22C55E", bg: "rgba(34,197,94,0.15)", Icon: CheckCircle },
    pending: { label: t("ticket.status.pending"), color: "#FFC107", bg: "rgba(255,193,7,0.15)", Icon: AlertCircle },
    canceled: { label: t("ticket.status.canceled"), color: "#FF5555", bg: "rgba(255,85,85,0.15)", Icon: AlertCircle },
  } as Record<string, { label: string; color: string; bg: string; Icon: typeof Clock }>;
}

export default function AppTickets() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const STATUS_CFG = useTicketStatusCfg();

  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const [{ data: regs }, { data: prof }] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("id, event_id, status, quantity, qr_code, registered_at, checked_in_at, checked_in_count, events!event_registrations_event_id_fkey(id, title, start_date, end_date, timezone, location, cover_image_url, host_id, ticket_type, ga_ticket_price, vip_ticket_price, ticket_price, currency)")
          .eq("user_id", user.id)
          .order("registered_at", { ascending: false }),
        /* Named, GRANTED columns only — email is owner-private (my_private_profile RPC) and
           select("*")/email on profiles throws 42501. Nothing here renders the email. */
        supabase.from("profiles").select("id, full_name, photo_url, category").eq("id", user.id).single(),
      ]);

      setProfile(prof);

      if (regs && regs.length > 0) {
        // Fetch host names
        const hostIds = [...new Set((regs as any[]).map((r: any) => r.events?.host_id).filter(Boolean))];
        let hostMap: Record<string, string> = {};
        if (hostIds.length > 0) {
          const { data: hosts } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", hostIds);
          if (hosts) {
            hostMap = Object.fromEntries(hosts.map((h) => [h.id, h.full_name || "Host"]));
          }
        }

        const mapped: TicketRow[] = (regs as any[])
          .filter((r: any) => r.events)
          .map((r: any) => ({
            id: r.id,
            event_id: r.event_id,
            status: r.checked_in_at ? "checked-in" : r.status,
            quantity: r.quantity,
            qr_code: r.qr_code,
            registered_at: r.registered_at,
            checked_in_at: r.checked_in_at,
            checked_in_count: r.checked_in_count || 0,
            event: r.events,
            hostName: hostMap[r.events.host_id] || "Host",
          }));
        setTickets(mapped);
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const now = new Date();
  const upcoming = tickets.filter((t) => {
    const end = t.event.end_date ? new Date(t.event.end_date) : t.event.start_date ? new Date(t.event.start_date) : null;
    return end ? end >= now : true;
  });
  const past = tickets.filter((t) => {
    const end = t.event.end_date ? new Date(t.event.end_date) : t.event.start_date ? new Date(t.event.start_date) : null;
    return end ? end < now : false;
  });

  const displayed = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : tickets;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "upcoming", label: t("hub.tab.upcoming"), count: upcoming.length },
    { key: "past", label: t("hub.tab.past"), count: past.length },
    { key: "all", label: t("hub.tab.all"), count: tickets.length },
  ];

  // Detail view using EventTicketView
  if (selectedTicket) {
    return (
      <AppLayout>
        <div className="py-2">
          <EventTicketView
            event={{
              id: selectedTicket.event.id,
              title: selectedTicket.event.title,
              location: selectedTicket.event.location || undefined,
              start_date: selectedTicket.event.start_date || undefined,
              end_date: selectedTicket.event.end_date || undefined,
              timezone: selectedTicket.event.timezone || undefined,
              cover_image_url: selectedTicket.event.cover_image_url || undefined,
            }}
            registration={{
              id: selectedTicket.id,
              qr_code: selectedTicket.qr_code,
              quantity: selectedTicket.quantity,
              status: selectedTicket.status,
            }}
            userName={profile?.full_name || "Attendee"}
            userCategory={profile?.category || undefined}
            onBack={() => setSelectedTicket(null)}
            backLabel={t("hub.tickets.back_to_tickets")}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* AppShell's main container already provides the max-w-lg column + padding. */}
      <div className="py-2">
        {/* One shared heading row (Lee, 10 Aug 2026). This screen used to set its own font size
            and family, so its title sat differently from every sibling's — exactly the drift
            ScreenHeading exists to end. */}
        <ScreenHeading className="mb-6" right={
          <InfoTip text="Your ticket wallet — every event you've bought or registered for. Split into Upcoming and Past. Tap a ticket for its QR pass." />
        }>{t("hub.tickets.title")}</ScreenHeading>

        {/* Status Tabs */}
        <div className="flex gap-1 mb-6 border-b-2 border-border">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-3 text-sm font-semibold transition-all -mb-[2px]",
                activeTab === tab.key
                  ? "text-foreground border-b-[3px] border-primary"
                  : "text-muted-foreground border-b-[3px] border-transparent"
              )}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.length === 0 ? (
              <div className="p-12 rounded-[16px] border border-border bg-card text-center">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-primary/10">
                  <QrCode size={32} className="text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-foreground">{t("hub.tickets.empty_title")}</h2>
                <p className="text-sm text-muted-foreground">{t("hub.tickets.empty_desc")}</p>
                <button
                  onClick={() => navigate("/events")}
                  className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all"
                >
                  Browse Events
                </button>
              </div>
            ) : displayed.map(ticket => {
              const cfg = STATUS_CFG[ticket.status] || STATUS_CFG.registered;
              const startDate = ticket.event.start_date ? new Date(ticket.event.start_date) : null;
              const endDate = ticket.event.end_date ? new Date(ticket.event.end_date) : null;
              const dateStr = startDate
                ? startDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : "Date TBD";
              const timeStr = startDate
                ? `${startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}${endDate ? ` – ${endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}`
                : "";
              const price = ticket.event.ga_ticket_price || ticket.event.ticket_price || 0;
              const priceStr = price > 0 ? `${currencySymbol((ticket.event as any).currency)}${price} ${(((ticket.event as any).currency as string) || "USD").toUpperCase()}` : "Free";

              return (
                <button key={ticket.id} onClick={() => setSelectedTicket(ticket)}
                  className="w-full p-4 md:p-6 rounded-[16px] border border-border bg-card transition-all hover:bg-secondary/50 text-left relative">
                  {ticket.quantity > 1 && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full font-bold text-xs bg-primary text-primary-foreground">{ticket.quantity}x</div>
                  )}
                  <div className="flex flex-col md:flex-row gap-4">
                    {ticket.event.cover_image_url ? (
                      <img src={ticket.event.cover_image_url} alt={ticket.event.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Ticket size={32} className="text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-lg md:text-xl font-semibold text-foreground">{ticket.event.title}</h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                          <cfg.Icon size={14} /> {cfg.label}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar size={16} /> {dateStr}{timeStr ? ` • ${timeStr}` : ""}
                        </div>
                        {ticket.event.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin size={16} /> {ticket.event.location}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User size={16} /> {t("ev.hosted_by", "Hosted by")} {ticket.hostName}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                        <div className="text-sm">
                          <span className="text-primary">General Admission</span>
                          <span className="mx-2 text-border">•</span>
                          <span className="font-semibold text-foreground">{priceStr}</span>
                        </div>
                        {ticket.checked_in_count > 0 && ticket.quantity > 1 && (
                          <span className="px-3 py-1.5 rounded-2xl text-xs font-semibold" style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22C55E" }}>
                            {ticket.checked_in_count}/{ticket.quantity} Attended
                          </span>
                        )}
                      </div>
                      {ticket.checked_in_at && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Checked in: {new Date(ticket.checked_in_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
