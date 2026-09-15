import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ScreenHeading } from "@oneworld/shell";
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { Navbar } from "@evt/components/Navbar";
import { Footer } from "@evt/components/Footer";
import { ArrowLeft, MapPin, Calendar, Users, Shield, MessageSquare, Loader2, Pencil, Trash2, Star, CheckCircle2, BookmarkIcon, ImageIcon, ChevronLeft, ChevronRight, X, User, Copy, Settings, Video } from "lucide-react";
import EventOwnerActionsMenu from "@evt/components/events/EventOwnerActionsMenu";
import { VaiaMarketplaceGuide } from "@evt/components/marketplace/VaiaMarketplaceGuide";
import { GuestInteractionGate } from "@evt/components/marketplace/GuestInteractionGate";
import { ShareListingButton } from "@evt/components/marketplace/ShareListingButton";
import { DetailNavigation } from "@evt/components/marketplace/DetailNavigation";
import { useAuth } from "@evt/hooks/useAuth";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";
import { createNotification } from "@evt/lib/notificationHelpers";
import { notifySmsNewMessage } from "@evt/lib/notifySms";
import EventLinkedJobs from "@evt/components/events/EventLinkedJobs";
import { LocationMap } from "@evt/components/marketplace/LocationMap";
import { ShareToInstagram } from "@evt/components/events/ShareToInstagram";
import { CollapsibleDescription } from "@evt/components/events/CollapsibleDescription";
import PhotoLightbox from "@evt/components/events/PhotoLightbox";
import { currencySymbol } from "@evt/lib/currencies";
import { eventCodeToUuid } from "@evt/lib/eventShortLinks";
import OneScoreDonut from "@evt/components/app/OneScoreDonut";

interface EventData {
  id: string;
  title: string;
  host_id: string;
  location: string | null;
  venue_name: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_aspect_ratio?: string | null;
  ticket_price: number | null;
  ticket_type: string | null;
  max_attendees: number | null;
  attendee_count: number;
  category: string | null;
  event_type: string | null;
  description: string | null;
  slug?: string | null;
  attachment_urls: any;
  ga_ticket_qty: number | null;
  ga_ticket_price: number | null;
  ga_sold: number | null;
  vip_ticket_qty: number | null;
  vip_ticket_price: number | null;
  vip_sold: number | null;
  min_score: number | null;
  location_type: string | null;
  latitude: number | null;
  longitude: number | null;
  address_visible: boolean;
  show_total_tickets: boolean;
  show_remaining_tickets: boolean;
  requires_application?: boolean | null;
  application_requires_approval?: boolean | null;
  is_evergreen?: boolean | null;
}

interface HostProfile {
  id: string;
  full_name: string;
  photo_url: string | null;
  job_title: string | null;
  location: string | null;
}

function getScoreColor(score: number) {
  if (score >= 90) return { bg: "rgba(16,185,129,0.15)", text: "#10B981" };
  if (score >= 80) return { bg: "rgba(46,230,214,0.15)", text: "#2EE6D6" };
  return { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" };
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [contacting, setContacting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);
  const [host, setHost] = useState<HostProfile | null>(null);
  const [hostScore, setHostScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFoundReason, setNotFoundReason] = useState<"missing" | "draft" | "private" | null>(null);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [allEventIds, setAllEventIds] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [isCoOwner, setIsCoOwner] = useState(false);
  const [coOwnerHosts, setCoOwnerHosts] = useState<HostProfile[]>([]);
  /* v23 CN (Lee's UAT): an applicant with a pending request used to see the same
     "Request to Join" button as a stranger — zero feedback anywhere. The page now
     knows about MY application and shows the real state. */
  const [myApp, setMyApp] = useState<{ id?: string; approval_status: string; payment_status: string } | null>(null);

  const backState = (location.state as { backMode?: "history"; backLabel?: string; viewAsVisitor?: boolean } | null) ?? null;
  const viewAsVisitor = backState?.viewAsVisitor === true;
  const backLabel = backState?.backLabel ?? t("ev.back_events", "Back to Events");
  const handleBack = () => {
    if (backState?.backMode === "history") {
      navigate(-1);
      return;
    }
    navigate("/events");
  };

  /* Printed flyer QRs carry the compact base64url code (/events/e/<code>) — decode it to the
     uuid; a plain uuid passes through unchanged. */
  const eventId = id ? eventCodeToUuid(id) : id;

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId!)
        .single();

      if (error || !data) {
        // RLS may have hidden a draft. Ask the public status checker so we can
        // show a helpful message instead of a generic 404 (e.g. for QR scans).
        try {
          const resp = await fetch(
            `https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/check-event-status?id=${encodeURIComponent(eventId!)}`,
          );
          const json = await resp.json().catch(() => null);
          if (json?.exists) {
            setNotFoundReason(json.status === "draft" ? "draft" : "private");
            setDraftTitle(json.title ?? null);
          } else {
            setNotFoundReason("missing");
          }
        } catch {
          setNotFoundReason("missing");
        }
        setLoading(false);
        return;
      }

      setEvent(data as unknown as EventData);

      // Load co-owners (publicly visible ones for the host card; current-user check for manage rights)
      const { data: coRows } = await supabase
        .from("event_co_owners")
        .select("user_id, show_publicly")
        .eq("event_id", data.id);
      const coRowsArr = (coRows as Array<{ user_id: string; show_publicly: boolean }>) || [];
      if (user && coRowsArr.some((r) => r.user_id === user.id)) setIsCoOwner(true);
      const publicCoUserIds = coRowsArr.filter((r) => r.show_publicly).map((r) => r.user_id);
      if (publicCoUserIds.length) {
        const { data: coProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url, job_title, location")
          .in("id", publicCoUserIds);
        if (coProfiles) setCoOwnerHosts(coProfiles as HostProfile[]);
      }

      const { data: hostData } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, job_title, location")
        .eq("id", data.host_id)
        .single();
      if (hostData) setHost(hostData);

      const { data: scoreData } = await supabase
        .from("score_history")
        .select("one_score")
        .eq("user_id", data.host_id)
        .order("calculated_at", { ascending: false })
        .limit(1);
      if (scoreData?.[0]) setHostScore(scoreData[0].one_score);

      const { data: allEvents } = await supabase
        .from("events")
        .select("id")
        .eq("status", "published")
        .order("start_date", { ascending: true });
      if (allEvents) setAllEventIds(allEvents.map(e => e.id));

      // Check if user has saved this event
      if (user) {
        const { data: savedData } = await supabase
          .from("saved_items")
          .select("id")
          .eq("user_id", user.id)
          .eq("item_id", eventId!)
          .eq("item_type", "event")
          .maybeSingle();
        if (savedData) setSaved(true);
      }

      setLoading(false);
    };
    if (eventId) fetchEvent();
  }, [eventId, user]);

  const formatDate = (startDate: string | null, endDate: string | null) => {
    if (event?.is_evergreen) return "Available anytime — buy now, access immediately";
    if (!startDate) return t("ev.date_tbd", "Date TBD");
    const start = new Date(startDate);
    const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
    if (endDate) {
      const end = new Date(endDate);
      if (start.toDateString() !== end.toDateString()) {
        return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
      }
    }
    return start.toLocaleDateString("en-US", opts);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return ""; }
  };

  /* v23 CN: load my application state for gated events (pending chip / rejected note). */
  useEffect(() => {
    let alive = true;
    if (!user?.id || !eventId) { setMyApp(null); return; }
    (async () => {
      const { data } = await supabase
        .from("event_applications")
        .select("id, approval_status, payment_status")
        .eq("event_id", eventId)
        .eq("applicant_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (alive) setMyApp((data as any) || null);
    })();
    return () => { alive = false; };
  }, [user?.id, eventId]);

  /* One save implementation for the button AND the post-signup resume. */
  const toggleSaveEvent = async () => {
    if (!user?.id) return;
    try {
      if (saved) {
        await supabase.from("saved_items").delete().eq("user_id", user.id).eq("item_id", eventId!).eq("item_type", "event");
        setSaved(false);
        toast.success(t("ev.toast_unsaved", "Event removed from saved."));
      } else {
        await supabase.from("saved_items").insert({ user_id: user.id, item_id: eventId!, item_type: "event" });
        setSaved(true);
        toast.success(t("ev.toast_saved", "Event saved! Find it under My Events."));
      }
    } catch { toast.error(t("ev.toast_save_fail", "Could not save event.")); }
  };

  /* RESUME AFTER EXPRESS JOIN (Lee's standing rule, 17 Aug 2026): a gated action sends the
     visitor through /events/join-express and back here with ?do=<action>. The moment the
     session and event exist, the action they originally tapped completes on its own. */
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !user?.id || !event) return;
    const sp = new URLSearchParams(location.search);
    const act = sp.get("do");
    if (!act) return;
    resumedRef.current = true;
    navigate(location.pathname, { replace: true, state: location.state });
    if (act === "save" && !saved) void toggleSaveEvent();
    if (act === "message-host") void handleContactHost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, event, location.search]);

  const handleContactHost = async () => {
    if (!user?.id) { navigate(`/events/join-express?next=${encodeURIComponent(`/events/e/${eventId}?do=message-host`)}`); return; }
    if (!event) return;
    setContacting(true);
    try {
      const { data: existingConvos } = await supabase
        .from("conversations")
        .select("*")
        .contains("participant_ids", [user.id])
        .eq("category", "events");

      let convoId: string | null = null;
      if (existingConvos) {
        const match = existingConvos.find((c: any) =>
          c.participant_ids.includes(event.host_id) &&
          c.metadata?.event_id === eventId
        );
        if (match) convoId = match.id;
      }

      const autoMsg = `Hi! I have a question about your "${event.title}" event. Could you provide more details?`;

      if (!convoId) {
        const { data: newConvo } = await supabase.from("conversations").insert({
          participant_ids: [user.id, event.host_id],
          category: "events",
          metadata: { event_id: eventId, event_title: event.title, source: "event_inquiry" },
          last_message_text: autoMsg.slice(0, 100),
          last_message_at: new Date().toISOString(),
        } as any).select("id").single();
        convoId = newConvo?.id || null;
      }

      if (convoId) {
        await supabase.from("messages").insert({
          conversation_id: convoId,
          sender_id: user.id,
          content: autoMsg,
          message_type: "text",
          metadata: { source: "event_inquiry", event_id: eventId, event_title: event.title },
        });

        await supabase.from("conversations").update({
          last_message_text: autoMsg.slice(0, 100),
          last_message_at: new Date().toISOString(),
        }).eq("id", convoId);

        await createNotification({
          userId: event.host_id,
          type: "general",
          title: "New event inquiry",
          body: `Someone has a question about your "${event.title}" event.`,
          actionUrl: `/events/messages/${convoId}`,
          metadata: { event_id: eventId },
        });
        notifySmsNewMessage({ recipientId: event.host_id, senderId: user.id, messagePreview: autoMsg.slice(0, 100), messageType: "event_share" });

        toast.success(t("ev.toast_msg_sent", "Message sent! Check your Messages to continue the conversation."));
        navigate(`/events/messages/${convoId}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    } finally {
      setContacting(false);
    }
  };

  const handleRegister = () => {
    if (!event) return;
    if (event.requires_application) {
      navigate(`/events/e/${eventId}/apply`);
      return;
    }
    /* EXPRESS CHECKOUT (Lee, 17 Aug 2026): guests go STRAIGHT to checkout — the account is
       created there in ~20 seconds (Google, or name+email+phone+password). Never a wall. */
    navigate(`/events/e/${eventId}/checkout`);
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!event) {
    const isDraft = notFoundReason === "draft";
    const isPrivate = notFoundReason === "private";
    return (
      <div>
        <Navbar />
        <div className="py-16 text-center">
          {isDraft ? (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {draftTitle ? `"${draftTitle}" is still a draft` : "This event is still a draft"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Only the host can preview it right now. Once it's published, this link (and any printed QR codes) will work for everyone.
              </p>
            </>
          ) : isPrivate ? (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">{t("ev.not_public", "This event isn't public")}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                The host hasn't made it visible yet. Check back soon, or ask the host to publish it.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">{t("ev.not_found", "Event not found")}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("ev.not_found_desc", "This event may have been removed or the link is incorrect.")}
              </p>
            </>
          )}
          <button onClick={() => navigate("/events")} className="text-primary text-sm">
            Back to Events
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const totalTickets = (event.ga_ticket_qty || event.max_attendees || 0) + (event.vip_ticket_qty || 0);
  const soldTickets = (event.ga_sold || 0) + (event.vip_sold || 0);
  const remaining = Math.max(0, totalTickets - soldTickets);
  const isSoldOut = totalTickets > 0 && remaining === 0;
  const isFree = event.ticket_type === "free" || ((event.ticket_price || 0) === 0 && (event.ga_ticket_price || 0) === 0);
  const displayPrice = event.ga_ticket_price || event.ticket_price || 0;
  const eventCurrency = ((event as any).currency as string) || "USD";
  const eventSymbol = currencySymbol(eventCurrency);
  const eventCurrencyLabel = eventCurrency.toUpperCase();
  const capacityText = (event.show_total_tickets !== false && totalTickets > 0) ? `${totalTickets}` : totalTickets > 0 ? t("ev.limited", "Limited") : t("ev.unlimited", "Unlimited");
  const ticketPct = totalTickets > 0 ? Math.round((remaining / totalTickets) * 100) : 100;
  const showRemainingBar = event.show_remaining_tickets !== false && totalTickets > 0;
  const hsc = getScoreColor(hostScore);
  const venueName = event.venue_name || (event.location ? event.location.split(",")[0].trim() : t("ev.online", "Online"));
  const timeText = [formatTime(event.start_date), formatTime(event.end_date)].filter(Boolean).join(" – ");

  // Parse attachment_urls for media. Animated flyers are saved as video
  // attachments, so keep them visible alongside photos instead of dropping them.
  const mediaItems: { url: string; type: "image" | "video" }[] = [];
  if (event.attachment_urls) {
    try {
      const arr = typeof event.attachment_urls === "string" ? JSON.parse(event.attachment_urls) : event.attachment_urls;
      if (Array.isArray(arr)) {
        arr.forEach((item: any) => {
          const url = typeof item === "string" ? item : item?.url;
          const rawType = typeof item === "string" ? "" : String(item?.type || "");
          const isVideo = /video/i.test(rawType) || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url || "");
          const isImage = /image/i.test(rawType) || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url || "");
          if (url && (isImage || isVideo)) mediaItems.push({ url, type: isVideo ? "video" : "image" });
        });
      }
    } catch {}
  }
  /* TAPPABLE PHOTOS (Lee, 17 Aug 2026): the cover flyer opens full-screen too — one
     lightbox over [cover, ...media], swipeable, X to close. */
  const allPhotos: { url: string; type: "image" | "video" }[] = [
    ...(event.cover_image_url ? [{ url: event.cover_image_url, type: "image" as const }] : []),
    ...mediaItems,
  ];
  const mediaOffset = event.cover_image_url ? 1 : 0;

  return (
    <div>
      <Navbar />
      {/* AppShell provides the main column — the old fixed-navbar padding and page max-width are gone. */}
      <div>
        {/* Page name on the VAIA row (Lee, 17 Aug 2026): the pill was floating over an empty
            left half — every screen carries its name, and this one is simply "Event". */}
        <ScreenHeading>{t("ev.title", "Event")}</ScreenHeading>
        <div className="flex items-center justify-between mb-3 md:mb-6">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80 text-primary">
            <ArrowLeft size={18} /> {backLabel}
          </button>
          <div className="flex items-center gap-2">
            <DetailNavigation currentId={eventId || ""} allIds={allEventIds} basePath="/events/e" label="Event" swipeDisabled={lightboxIndex !== null} />
            {user?.id && (user.id === event.host_id || isCoOwner) && !viewAsVisitor && (
              <EventOwnerActionsMenu
                eventId={event.id}
                hostId={event.host_id}
                currentUserId={user.id}
                duplicating={duplicating}
                onEdit={() => navigate(`/events/events?edit=${event.id}`)}
                onManage={() => navigate(`/events/events/${event.id}/manage`)}
                onDuplicate={async () => {
                  if (!event || duplicating) return;
                  setDuplicating(true);
                  try {
                    const { error } = await supabase.from("events").insert({
                      host_id: event.host_id,
                      title: `${event.title} (Copy)`,
                      description: event.description,
                      location: event.location,
                      venue_name: event.venue_name,
                      cover_image_url: event.cover_image_url,
                      ticket_type: event.ticket_type,
                      ticket_price: event.ticket_price,
                      max_attendees: event.max_attendees,
                      category: event.category,
                      event_type: event.event_type,
                      ga_ticket_qty: event.ga_ticket_qty,
                      ga_ticket_price: event.ga_ticket_price,
                      vip_ticket_qty: event.vip_ticket_qty,
                      vip_ticket_price: event.vip_ticket_price,
                      min_score: event.min_score,
                      location_type: event.location_type,
                      latitude: event.latitude,
                      longitude: event.longitude,
                      address_visible: event.address_visible,
                      status: "draft",
                      attendee_count: 0,
                      revenue: 0,
                      ga_sold: 0,
                      vip_sold: 0,
                    } as any).select("id").single();
                    if (error) throw error;
                    toast.success("Event duplicated as draft — update the details and publish when ready.");
                    navigate("/events/events");
                  } catch (err: any) {
                    console.error("Duplicate error:", err);
                    toast.error("Failed to duplicate event.");
                  } finally {
                    setDuplicating(false);
                  }
                }}
                onDelete={async () => {
                  if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
                  await supabase.from("event_registrations").delete().eq("event_id", eventId!);
                  const { error } = await supabase.from("events").delete().eq("id", eventId!).eq("host_id", user.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Event deleted");
                  navigate("/events");
                }}
                onTransferred={() => {
                  toast.success("Ownership updated. Returning to your events.");
                  navigate("/events/events");
                }}
              />
            )}
          </div>
        </div>

        <VaiaMarketplaceGuide page="event-detail" />

        {/* Hero — renders flyer in its native aspect ratio (no crop) */}
        {(() => {
          const ratio = (event.cover_aspect_ratio as any) || "16:9";
          const isFlyer = ratio === "4:5" || ratio === "9:16" || ratio === "1:1";
          /* HERO SIZING FIX (Lee/Joel's event, 16 Aug 2026): the flyer branch was dead —
             both sides said "16/7", so a square/portrait flyer shrank to a thumbnail between
             blur bars. Flyers now keep their own aspect, height-capped on desktop.
             v33.1 (Lee, 19 Aug): "make the header picture square like Joel's — bigger,
             for ALL events." Wide 16:9 covers no longer render as a short 16/7 strip:
             every hero is now the tall 4/5 frame (flyers keep their own aspect). Wide
             photos center-crop to fill it — display-only, so it retrofits every
             existing event automatically. */
          const heroAspect = ratio === "1:1" ? "1/1" : ratio === "9:16" ? "9/16" : "4/5";
          return (
            <div className={`relative rounded-2xl overflow-hidden mb-6 bg-black/40 mx-auto ${event.cover_image_url ? "cursor-pointer" : ""}`} style={{ aspectRatio: heroAspect, maxHeight: "min(72vh, 560px)", maxWidth: 560 }} onClick={() => { if (event.cover_image_url) setLightboxIndex(0); }} title={event.cover_image_url ? "Tap to view full size" : undefined}>
              {event.cover_image_url ? (
                <>
                  {/* Blurred backdrop fills letterbox area for vertical flyers */}
                  {isFlyer && (
                    <img src={event.cover_image_url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50" />
                  )}
                  <img
                    src={event.cover_image_url}
                    alt={event.title}
                    className={`relative z-[1] w-full h-full ${isFlyer ? "object-contain" : "object-cover"}`}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                  <Calendar size={48} className="text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute inset-0 z-[2] pointer-events-none" style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.82) 100%)" }} />
              <div className="absolute bottom-3 left-4 right-4 sm:bottom-5 sm:left-6 sm:right-6 z-[3]">
                {event.category && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded mb-1.5 inline-block" style={{ background: "rgba(46,230,214,0.12)", border: "1px solid rgba(46,230,214,0.2)", color: "#2EE6D6" }}>{event.category}</span>
                )}
                <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl font-semibold text-white mb-0.5 leading-snug tracking-tight" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>{event.title}</h1>
                <p className="text-[10px] sm:text-xs text-white/55">{t("ev.posted_open", "Posted · Registrations open")}</p>
              </div>
            </div>
          );
        })()}

        {user?.id && (user.id === event.host_id || isCoOwner) && !viewAsVisitor && (
          <div className="mx-auto -mt-2 mb-6" style={{ maxWidth: 560 }}>
            <button
              onClick={() => navigate(`/events/events/${event.id}/manage`)}
              className="ow-btn-espresso flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
            >
              <Settings className="w-4 h-4" /> Manage
            </button>
          </div>
        )}

        <div className="space-y-6 pb-16">
            {/* 1. Event details — right under the hero. Location lives here;
                the standalone Venue/city box was removed (Lee, Jul 22). */}
            <div className="rounded-2xl p-5 bg-card border border-border space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("ev.details", "Event Details")}</h3>
              {event.category && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("ev.category", "Category")}</span>
                  <span className="font-medium text-foreground">{event.category}</span>
                </div>
              )}
              {event.event_type && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("ev.event_type", "Event Type")}</span>
                  <span className="font-medium text-foreground capitalize">{event.event_type}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {t("ev.date", "Date")}</span>
                <span className="font-medium text-foreground text-right text-xs">
                  {formatDate(event.start_date, event.end_date)}
                  {timeText && <><br /><span className="text-muted-foreground font-normal">{timeText}</span></>}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {t("ev.location", "Location")}</span>
                <span className="font-medium text-foreground text-right text-xs max-w-[200px] truncate">{venueName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {t("ev.capacity", "Capacity")}</span>
                <span className="font-medium text-foreground">{capacityText}</span>
              </div>
              {(event.min_score || 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-primary" /> Min Score</span>
                  <span className="font-medium text-foreground">{event.min_score}+</span>
                </div>
              )}
            </div>

            {/* 2. About this event */}
            <CollapsibleDescription text={event.description || "No description provided."} />

            {/* 3. Map — real embedded map, right after About (Lee, Jul 22) */}
            <LocationMap
              latitude={event.latitude}
              longitude={event.longitude}
              location={event.location}
              addressVisible={event.address_visible}
              venueName={event.venue_name}
            />

            {/* Event Media */}
            {mediaItems.length > 0 && (
              <div className="rounded-2xl p-6 bg-card border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">{t("ev.media", "Event Media")}</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaItems.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl overflow-hidden aspect-video bg-secondary cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                      onClick={() => setLightboxIndex(i + mediaOffset)}
                    >
                      {item.type === "video" ? (
                        <div className="relative h-full w-full bg-black">
                          <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                          <div className="absolute inset-0 grid place-items-center bg-black/20">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-primary shadow">
                              <Video className="h-5 w-5" />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <img src={item.url} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lightbox — v14: extracted to PhotoLightbox with pinch-zoom/pan/double-tap
                (Lee: "you can't pinch and zoom... that's the point of tapping it") and the
                honest counter (was "1 / 0": it counted only the gallery, not the cover). */}
            {lightboxIndex !== null && allPhotos.length > 0 && (
              <PhotoLightbox
                photos={allPhotos}
                index={lightboxIndex}
                onIndex={setLightboxIndex}
                onClose={() => setLightboxIndex(null)}
              />
            )}

            {/* 3. Hosted by */}
            {/* Box 1: Hosted By — prominent card */}
            <div
              className={`relative rounded-2xl overflow-hidden border border-primary/30 transition-all p-4 ${host?.id ? "cursor-pointer hover:border-primary/50" : "cursor-default opacity-90"}`}
              onClick={() => {
                if (host?.id) {
                  navigate(`/events/p/${host.id}`, { state: { from: location.pathname, backLabel: "Back to Event" } });
                } else {
                  toast.info(t("ev.toast_host_gone", "This host is no longer on OneEvent."));
                }
              }}
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.02))" }}
            >
              {hostScore > 0 && (
                <div className="absolute top-4 right-4">
                  <OneScoreDonut
                    score={hostScore}
                    size={52}
                    strokeWidth={4}
                    label=""
                    wholeClassName="text-sm"
                    decimalClassName="text-[9px]"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("ev.hosted_by", "Hosted by")}</p>
              <div className="flex items-center gap-3 pr-14">
                {host?.photo_url ? (
                  <img
                    src={host.photo_url}
                    alt={host.full_name}
                    className="w-16 h-16 object-cover rounded-xl border border-border/40 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                    {(host?.full_name || "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                    {host?.full_name || "Unknown Host"}
                  </p>
                  {host?.location && (
                    <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {host.location}
                    </p>
                  )}
                  {coOwnerHosts.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1 truncate">
                      with {coOwnerHosts.map((c) => c.full_name).filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Tickets */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{t("checkout.ga", "General Admission")}</p>
                  <p className="text-lg font-bold text-foreground">{isFree ? "Free" : `${eventSymbol}${displayPrice.toFixed(2)} ${eventCurrencyLabel}`}</p>
                </div>
                {(event.vip_ticket_price || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">VIP</p>
                    <p className="text-lg font-bold text-foreground">{eventSymbol}{(event.vip_ticket_price || 0).toFixed(2)} {eventCurrencyLabel}</p>
                  </div>
                )}
              </div>

              {showRemainingBar && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{t("ev.tickets_remaining", "Tickets remaining")}</span>
                    <span className="font-semibold" style={{ color: remaining < 20 ? "#F59E0B" : "hsl(var(--foreground) / 0.8)" }}>
                      {event.show_total_tickets !== false ? `${remaining} / ${totalTickets}` : `${remaining} left`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${ticketPct}%`, background: ticketPct < 15 ? "#EF4444" : ticketPct < 30 ? "#F59E0B" : "#2EE6D6" }} />
                  </div>
                </div>
              )}

              {/* v23 CN: an applicant with a pending request sees their real state here,
                  not a fresh "Request to Join" that silently re-opens the form. */}
              {event.requires_application && myApp?.approval_status === "approved" && myApp?.payment_status === "pending" ? (
                /* v32 (Lee): APPROVE-AS-NUDGE — the host approved them before they paid.
                   Positive lane: one tap opens checkout on the SAME application; the card
                   is charged and the ticket issued the moment they authorize. */
                <div className="rounded-xl border border-primary/40 bg-primary/[0.07] p-4 text-center">
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {t("ev.approved_pay_title", "You're approved — complete payment")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("ev.approved_pay_body", "The host approved your request! Nothing has been charged yet — your spot locks in the moment you authorize payment, and your ticket is issued instantly.")}
                  </p>
                  <button
                    onClick={() => navigate(`/events/e/${eventId}/checkout?applicationId=${myApp.id || ""}`)}
                    className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:brightness-105"
                  >
                    {t("ev.approved_pay_cta", "Complete payment — lock my spot")}
                  </button>
                </div>
              ) : event.requires_application && (myApp?.approval_status === "pending" || myApp?.approval_status === "approved") && myApp?.payment_status === "failed" ? (
                /* v30 FB (Lee): the capture-failed lane. The host tried to approve them and the
                   charge failed (expired hold, dead card). Their application is SAVED — one tap
                   re-opens checkout on the same application to put a new payment in. */
                <div className="rounded-xl border border-destructive/40 bg-destructive/[0.07] p-4 text-center">
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    {t("ev.payment_failed_title", "Payment issue — action needed")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("ev.payment_failed_body", "The host approved your request, but your card couldn't be charged. Your application is saved — just re-authorize payment to confirm your spot.")}
                  </p>
                  <button
                    onClick={() => navigate(`/events/e/${eventId}/checkout?applicationId=${myApp.id || ""}`)}
                    className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:brightness-105"
                  >
                    {t("ev.payment_failed_cta", "Fix payment — re-authorize your card")}
                  </button>
                </div>
              ) : event.requires_application && myApp?.approval_status === "pending" ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-center">
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    {t("ev.request_pending", "Request pending — the host is reviewing")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {myApp.payment_status === "authorized"
                      ? t("ev.request_pending_auth", "Your card is authorized, not charged. Your ticket arrives the moment they approve you.")
                      : t("ev.request_pending_free", "Nothing to pay — your ticket arrives the moment they approve you. We'll notify you.")}
                  </p>
                </div>
              ) : (
                <>
                  <button
                    disabled={isSoldOut}
                    onClick={handleRegister}
                    className="w-full py-3.5 rounded-xl font-semibold text-base transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {isSoldOut ? t("ev.sold_out", "Sold Out") : event.requires_application ? t("ev.request_join", "Request to Join") : isFree ? t("ev.register_free", "Register Free") : `${t("ev.get_tickets", "Get Tickets")} — ${eventSymbol}${displayPrice.toFixed(2)} ${eventCurrencyLabel}`}
                  </button>
                  {event.requires_application && myApp?.approval_status === "rejected" && (
                    <p className="text-[11px] text-center text-muted-foreground mt-2">
                      {t("ev.request_declined", "Your previous request wasn't approved. You can request again.")}
                    </p>
                  )}
                  <p className="text-[10px] text-center text-muted-foreground/60 mt-2">
                    {event.requires_application && !isFree ? t("ev.card_auth_note", "Your card is authorized now and only charged if the host approves you.") : isFree ? "" : "Payment processing is currently in test mode."}
                  </p>
                </>
              )}
            </div>

            <EventLinkedJobs eventId={event.id} eventTitle={event.title} hostId={event.host_id} />

            {/* 5. Share to Instagram + Save event (also message host) */}
            <div className="rounded-2xl p-5 bg-card border border-border space-y-3">
              {host && (!user || host.id !== user.id || viewAsVisitor) && (
                <button
                  onClick={async () => {
                    if (!user) {
                      /* Express-gated, returns here and ?do=message-host opens the thread. */
                      navigate(`/events/join-express?next=${encodeURIComponent(`/events/e/${eventId}?do=message-host`)}`);
                      return;
                    }
                    if (contacting) return;
                    setContacting(true);
                    try {
                      const { data: convos } = await supabase
                        .from("conversations")
                        .select("id")
                        .contains("participant_ids", [user.id, host.id])
                        .limit(1);
                      if (convos && convos.length > 0) {
                        navigate(`/events/messages/${convos[0].id}`);
                      } else {
                        const { data: newConvo, error } = await supabase
                          .from("conversations")
                          .insert({
                            participant_ids: [user.id, host.id],
                            category: "professionals",
                            metadata: { source: "event_detail", event_id: event?.id, event_title: event?.title },
                          })
                          .select("id")
                          .single();
                        if (error) throw error;
                        navigate(`/events/messages/${newConvo.id}`);
                      }
                    } catch (err) {
                      console.error("Message host error:", err);
                      toast.error(t("ev.toast_conv_fail", "Could not start conversation. Please try again."));
                    } finally {
                      setContacting(false);
                    }
                  }}
                  disabled={contacting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary text-primary font-semibold text-sm hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {contacting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {contacting ? t("ev.connecting", "Connecting…") : t("ev.message_host", "Message Host")}
                </button>
              )}
              <ShareListingButton type="event" id={eventId || ""} title={event.title} className="w-full" />
              <ShareToInstagram
                eventId={eventId || ""}
                eventTitle={event.title}
                coverImageUrl={event.cover_image_url}
                slug={event.slug || null}
                startDate={event.start_date}
                venueName={event.venue_name}
                hostHandle={host?.full_name || null}
              />
              <button
                onClick={() => {
                  /* EXPRESS-GATED (Lee, 17 Aug 2026): signed out -> the 20-second express
                     account, then RIGHT BACK HERE where ?do=save finishes the save and pops
                     "Event saved!". The rule for every gated action. */
                  if (!user) {
                    navigate(`/events/join-express?next=${encodeURIComponent(`/events/e/${eventId}?do=save`)}`);
                    return;
                  }
                  toggleSaveEvent();
                }}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm shadow-sm shadow-primary/5 transition-colors ${saved ? "border-primary bg-primary/10 text-primary" : "border-primary/35 bg-primary/[0.03] text-foreground hover:border-primary/55 hover:bg-primary/[0.08]"}`}
              >
                <BookmarkIcon className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
                {saved ? t("ev.saved", "Saved") : t("ev.save", "Save Event")}
              </button>
            </div>

            {/* 6. How ticketing works — very bottom. Says what actually happens: OneEvent
                holds the payment; the host sets refund terms; no "protected/guaranteed/
                verified" claims (counsel rule). */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{t("ev.ticketing", "Ticketing by OneEvent")}</span>
              </div>
              {/* v14 REWRITE (Lee, 18 Aug 2026): the "holds your payment / refund policy"
                  line was WRONG — OneEvent money flows through Stripe to the host, nothing
                  is escrowed, and refunds are the host's own policy. This card is where
                  OneEvent promotes itself, so it now lists what the product actually does.
                  Icons: SAME size on every row, top-aligned (the old items-center made the
                  first icon float tiny beside three wrapped lines — Lee's screenshot). */}
              <div className="space-y-2.5 text-xs text-muted-foreground">
                {([
                  t("ev.trust_payment", "Buy with confidence — payments are authorized and secured through Stripe, the world's largest payment processor"),
                  t("ev.trust_profile", "Hosts can display their public profile and OneScore™"),
                  t("ev.trust_qr", "QR code check-in on arrival"),
                  t("ev.trust_chat", "You're added to the event group chat automatically — updates arrive in the app and on your phone"),
                  t("ev.trust_media", "Post-event media sharing between attendees"),
                  t("ev.trust_flyer", "Share the event flyer straight to Instagram — no screenshots needed"),
                  t("ev.trust_score", "Grow your OneScore™ by attending events"),
                ] as string[]).map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                    <span>{line}</span>
                  </div>
                ))}
                <div className="pt-2 mt-1 border-t border-border text-[11px]">
                  {t("ev.trust_owl", "OneEvent is part of the One World Labs family of small-business apps.")}{" "}
                  <a href="https://oneworldlabs.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline font-medium">
                    oneworldlabs.ai
                  </a>
                </div>
              </div>
            </div>
        </div>
      </div>
      <Footer />
      {/* The shell's AppShell renders the bottom tabs everywhere now — the old page-owned
          BottomTabs + h-20 spacer are gone. */}
    </div>
  );
}
