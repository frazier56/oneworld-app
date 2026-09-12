import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@evt/hooks/useAuth";
import { useIsMobile } from "@evt/hooks/use-mobile";
import { useLanguage } from "@evt/i18n/LanguageContext";
import AppLayout from "@evt/components/app/AppLayout";
import { supabase } from "@evt/integrations/supabase/client";
import { ArrowLeft, Calendar, MapPin, Ticket, EyeOff, Upload, Download, Copy, X, MessageCircle, Settings, UserPlus, Share2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@evt/lib/utils";
import { toast } from "sonner";
import EventOverviewTab from "@evt/components/events/EventOverviewTab";
import EventReminderSettings from "@evt/components/events/EventReminderSettings";
import EventRegistrationsTab from "@evt/components/events/EventRegistrationsTab";
import EventCheckInTab from "@evt/components/events/EventCheckInTab";
import EventPhotosTab from "@evt/components/events/EventPhotosTab";
import LinkJobsToEvent from "@evt/components/events/LinkJobsToEvent";
import EventFoodDrinkPanel from "@evt/components/events/EventFoodDrinkPanel";
import EventApplicantsTab from "@evt/components/events/EventApplicantsTab";
import EventPayoutsTab from "@evt/components/events/EventPayoutsTab";
import EventActivityTab from "@evt/components/events/EventActivityTab";
import EventManagersPanel from "@evt/components/events/EventManagersPanel";
import IssueComplimentaryTicketDialog from "@evt/components/events/IssueComplimentaryTicketDialog";
import EventOwnerActionsMenu from "@evt/components/events/EventOwnerActionsMenu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@evt/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@evt/components/ui/alert-dialog";
import { calculateEventAttendanceCounts, calculateEventRevenue } from "@evt/lib/eventTicketing";
import { buildCleanEventLink, buildEventVanityLink } from "@evt/lib/eventShortLinks";
import { ScreenHeading } from "@oneworld/shell";

type Tab = "overview" | "registrations" | "applicants" | "check-in" | "photos" | "food-drink" | "jobs" | "payouts" | "activity";

/* v11: tab labels live in the OneEvent dictionary (mgmt.tab.*) — all seven languages.
   v18 (Lee, 18 Aug): Applicants BEFORE Registrations — approval is the prerequisite, so the
   tab order now mirrors the actual flow: review applicants → registrations → check-in. */
const BASE_TAB_KEYS: Tab[] = ["overview", "applicants", "registrations", "check-in", "payouts", "photos", "food-drink", "jobs", "activity"];

interface Registration {
  id: string;
  user_id: string;
  status: string;
  quantity: number;
  registered_at: string;
  checked_in_at: string | null;
  checked_in_count: number;
  qr_code: string | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  registration_source?: string | null;
  payment_status?: string | null;
  amount_paid?: number | null;
  ticket_type?: string | null;
  ticket_email_status?: string | null;
  ticket_email_last_sent_at?: string | null;
  resend_count?: number | null;
  claimed_at?: string | null;
  qr_valid?: boolean | null;
  profile?: { full_name: string; email: string; photo_url: string | null };
}

export default function EventManagement() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t, locale } = useLanguage();
  /* v33: notifications + the applicant's chat DM deep-link straight to a tab
     (…/manage?tab=applicants). Honor it on first render; invalid values fall
     back to Overview exactly as before. */
  const [searchParams] = useSearchParams();
  const initialTab = ((): Tab => {
    const q = searchParams.get("tab");
    return (BASE_TAB_KEYS as string[]).includes(q || "") ? (q as Tab) : "overview";
  })();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [event, setEvent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [compOpen, setCompOpen] = useState(false);
  const [eventToolsOpen, setEventToolsOpen] = useState(false);
  const [managerToolsOpen, setManagerToolsOpen] = useState(false);
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("events").select("*").eq("id", id).single();
    if (data) setEvent(data);
  }, [id]);

  /* v18 (Lee): registrations need to KNOW about applications — a registration whose
     application is still pending must show "Pending approval" and be un-checkin-able. */
  const [pendingApps, setPendingApps] = useState<{ user_ids: Set<string>; emails: Set<string> }>({ user_ids: new Set(), emails: new Set() });

  /* v25 EF (Lee): a freshly-claimed manager lands here with ?welcome=manager and gets the
     quick next-next-done tour of what their new powers do. Shown once per arrival. */
  const [managerTourStep, setManagerTourStep] = useState<number>(() => {
    try { return new URLSearchParams(window.location.search).get("welcome") === "manager" ? 0 : -1; } catch { return -1; }
  });

  /* v22 CB: delegates (event managers) get a RESTRICTED portal. null = not a delegate
     (host / co-owner / admin see everything, as before). */
  const [managerPerms, setManagerPerms] = useState<string[] | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const ADMIN_UID = "eeb6bced-c34b-4c73-8e3a-bd0498fe1b6c";
  const isHost = !!(user && event && user.id === event.host_id);
  useEffect(() => {
    if (!user || !event) return;
    if (user.id === event.host_id || user.id === ADMIN_UID) { setManagerPerms(null); setAccessChecked(true); return; }
    (async () => {
      const [{ data: mgr }, { data: co }] = await Promise.all([
        supabase
          .from("event_managers" as any)
          .select("permissions, event_id")
          .eq("user_id", user.id)
          .or(`event_id.eq.${event.id},and(event_id.is.null,host_id.eq.${event.host_id})`),
        supabase
          .from("event_co_owners")
          .select("id")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (co) { setManagerPerms(null); setAccessChecked(true); return; } // co-owner = full portal
      const rows: any[] = (mgr as any[]) || [];
      if (rows.length) {
        const perms = Array.from(new Set(rows.flatMap((r) => r.permissions || [])));
        setManagerPerms(perms.length ? perms : ["all"]);
      } else {
        // No role at all — this page isn't theirs; back to the public event.
        // v22r2: do NOT mark access as checked — the spinner holds until the
        // redirect unmounts us, so not even one frame of host UI renders.
        navigate(`/events/e/${event.id}`, { replace: true });
        return;
      }
      setAccessChecked(true);
    })();
  }, [user, event, navigate]);

  /* Delegate tab map: money and event-editing surfaces stay host-only always. */
  const delegateTabs = (perms: string[]): Tab[] => {
    if (perms.includes("all")) return ["registrations", "check-in", "photos", "food-drink", "activity"];
    const t: Tab[] = [];
    if (perms.includes("check-in")) { t.push("check-in"); }
    if (perms.includes("registrations") || perms.includes("check-in")) t.push("registrations");
    if (perms.includes("food-drink")) t.push("food-drink");
    if (perms.includes("media")) t.push("photos");
    return t.length ? Array.from(new Set(t)) : ["check-in"];
  };
  const visibleTabs: Tab[] = managerPerms ? delegateTabs(managerPerms) : BASE_TAB_KEYS;
  useEffect(() => {
    if (managerPerms && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerPerms]);

  const fetchRegistrations = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", id)
      .order("registered_at", { ascending: false });

    const baseRegs: any[] = data ?? [];

    // Authorized, host-visible applications feed the approval gate on real
    // registrations. An application is never synthesized into a ticket row.
    const { data: allApps } = await supabase
      .from("event_applications")
      .select("id, applicant_name, applicant_email, applicant_user_id, approval_status, payment_status, paid_at, approved_at, ticket_type, quantity, created_at")
      .eq("event_id", id);
    const pend = (allApps ?? []).filter((a: any) => a.approval_status === "pending");
    setPendingApps({
      user_ids: new Set(pend.map((a: any) => a.applicant_user_id).filter(Boolean)),
      emails: new Set(pend.map((a: any) => (a.applicant_email || "").toLowerCase()).filter(Boolean)),
    });

    const userIdsFromRegs = baseRegs.map((r: any) => r.user_id).filter(Boolean);
    const allUserIds = Array.from(new Set(userIdsFromRegs));

    /* Granted columns only — profiles.email is owner-private (42501 for anyone else).
       Registration rows fall back to matching by user_id; guest applicants keep the e-mail
       they typed on the application itself. */
    const { data: profiles } = allUserIds.length
      ? await supabase.from("profiles").select("id, full_name, photo_url").in("id", allUserIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const enriched = baseRegs.map((r: any) => ({
      ...r,
      user_id: r.user_id ?? "",
      /* Guest ticket buyers (17 Aug 2026): a tokenized-ticket row has user_id NULL and the
         buyer's details on guest_name/guest_email — show THOSE, not "Unknown". */
      profile: (r.user_id ? profileMap.get(r.user_id) : null)
        ?? (r.recipient_name || r.recipient_email || r.guest_name || r.guest_email
            ? {
                full_name: r.recipient_name || r.guest_name || r.recipient_email || r.guest_email,
                email: r.recipient_email || r.guest_email || "",
                photo_url: null,
              }
            : { full_name: "Unknown", email: "", photo_url: null }),
    }));

    setRegistrations(enriched);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchEvent(); fetchRegistrations(); }, [fetchEvent, fetchRegistrations]);

  const refresh = () => { fetchEvent(); fetchRegistrations(); };

  const eventUrl = typeof window !== "undefined" && id
    ? (event?.slug?.trim() ? buildEventVanityLink(event.slug) : buildCleanEventLink(id))
    : "";

  useEffect(() => {
    setQrDataUrl("");
  }, [eventUrl]);

  const togglePublish = async () => {
    if (!event) return;
    const next = event.status === "published" ? "draft" : "published";
    if (next === "draft" && !confirm(t("mgmt.unpublish_confirm", "Move this event to draft? It will no longer be publicly visible."))) return;
    setStatusBusy(true);
    const { error } = await supabase.from("events").update({ status: next }).eq("id", event.id);
    setStatusBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "draft" ? t("mgmt.unpublished", "Event unpublished — now a draft.") : t("mgmt.published", "Event published — live again."));
    fetchEvent();
  };

  const openQr = async () => {
    setQrOpen(true);
    if (qrDataUrl) return;
    try {
      const QR = (await import("qrcode")).default;
      const url = await QR.toDataURL(eventUrl, { width: 512, margin: 2, color: { dark: "#0B0F1A", light: "#FFFFFF" } });
      setQrDataUrl(url);
    } catch (e: any) {
      toast.error(t("mgmt.qr_fail", "Failed to generate QR code"));
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `event-${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-qr.png`;
    a.click();
  };

  const copyEventUrl = () => {
    navigator.clipboard.writeText(eventUrl);
    toast.success(t("mgmt.link_copied", "Event link copied"));
  };

  const shareEventUrl = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: event?.title || "OneEvent", url: eventUrl });
      } else {
        copyEventUrl();
      }
    } catch {
      // Native share sheets can be dismissed without an error message.
    }
  };

  const openGroupChat = async () => {
    const { data, error } = await supabase.rpc("create_event_group_chat", { p_event_id: event.id });
    if (error || !data) {
      toast.error(error?.message ?? t("mgmt.chat_error", "Couldn't open the event chat."));
      return;
    }
    navigate(`/events/messages/${data}`);
  };

  const duplicateEvent = async () => {
    if (!user?.id || duplicateBusy) return;
    setDuplicateBusy(true);
    try {
      const { error } = await supabase.from("events").insert({
        host_id: user.id,
        title: `${event.title} (Copy)`,
        description: event.description,
        category: event.category,
        event_type: event.event_type,
        visibility: event.visibility,
        location_type: event.location_type,
        location: event.location,
        venue_name: event.venue_name,
        event_link: event.event_link,
        cover_image_url: event.cover_image_url,
        cover_aspect_ratio: event.cover_aspect_ratio || "16:9",
        attachment_urls: event.attachment_urls,
        ticket_type: event.ticket_type,
        ticket_price: event.ticket_price,
        ga_ticket_price: event.ga_ticket_price,
        ga_ticket_qty: event.ga_ticket_qty,
        has_vip_ticket: event.has_vip_ticket,
        vip_ticket_price: event.vip_ticket_price,
        vip_ticket_qty: event.vip_ticket_qty,
        max_attendees: event.max_attendees,
        min_score: event.min_score,
        discount_code: event.discount_code,
        discount_percent: event.discount_percent,
        latitude: event.latitude,
        longitude: event.longitude,
        address_visible: event.address_visible,
        status: "draft",
        attendee_count: 0,
        revenue: 0,
        ga_sold: 0,
        vip_sold: 0,
      } as any);
      if (error) throw error;
      toast.success("Event duplicated as draft! Edit it to publish.");
    } catch (err: any) {
      toast.error("Failed to duplicate: " + err.message);
    } finally {
      setDuplicateBusy(false);
    }
  };

  const deleteEvent = async () => {
    if (!user?.id || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await supabase.from("event_registrations").delete().eq("event_id", event.id);
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id)
        .eq("host_id", user.id);
      if (error) throw error;
      toast.success("Event deleted successfully");
      navigate("/events/events?tab=hosting", { replace: true });
    } catch (err: any) {
      toast.error("Failed to delete event: " + err.message);
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  };

  /* v22r2 (Max's block, 18 Aug 2026): accessChecked was set but never READ, so delegates
     and strangers got a first-render flash of the full host tab/control set while the
     async role query ran. Nothing renders now until the role is RESOLVED: hosts and the
     platform admin resolve synchronously; everyone else waits on accessChecked (the same
     effect that restricts or bounces them). Signed-out visitors bounce immediately. */
  useEffect(() => {
    if (!authLoading && !user && event) {
      navigate(`/events/e/${event.id}`, { replace: true });
    }
  }, [authLoading, user, event, navigate]);
  const roleResolved = !!event && !!user && (user.id === event.host_id || user.id === ADMIN_UID || accessChecked);

  if (loading || !event || !roleResolved) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const checkedInCount = registrations.filter((r) => r.status === "checked-in").length;
  const attendanceCounts = calculateEventAttendanceCounts(registrations);
  const overviewEvent = {
    ...event,
    attendee_count: attendanceCounts.totalAttendance,
    paid_attendee_count: attendanceCounts.paidAttendees,
    complimentary_attendee_count: attendanceCounts.complimentaryAttendees,
    revenue: calculateEventRevenue(registrations),
  };
  
  const statusLabel = event.status === "published" ? t("mgmt.registering", "Registering") : event.status === "draft" ? t("event.status.draft", "Draft") : event.status;
  const startDisplay = event.start_date ? new Date(event.start_date).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "";
  const endDisplay = event.end_date ? new Date(event.end_date).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <AppLayout>
      {/* AppShell's main container owns width/padding now — the old 1400px desktop shell is gone. */}
      <div>
        {/* Header */}
        <ScreenHeading className="mb-4">{t("mgmt.title", "Manage")}</ScreenHeading>
        <button onClick={() => navigate("/events/events?tab=hosting")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("mgmt.back", "Back to Events")}
        </button>

        <h2 className="text-foreground font-bold mb-1" style={{ fontSize: isMobile ? 24 : 32, fontFamily: "'Outfit', sans-serif" }}>
          {event.title}
        </h2>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30 mb-3">
          <Ticket className="w-3 h-3" /> {statusLabel}
        </span>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 flex-wrap">
          {startDisplay && (
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {startDisplay}{endDisplay && endDisplay !== startDisplay ? ` - ${endDisplay}` : ""}</span>
          )}
          {event.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
          )}
        </div>

        {/* Host actions — hidden for delegates (v22 CB). */}
        {managerPerms && (
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-600">
            {t("mgmt.managing_for_host", "Managing this event for the host")}
          </p>
        )}
        <div className={cn("mb-6 flex w-full items-start justify-center gap-3 sm:w-auto", managerPerms && "hidden")}>
          <div className="relative min-w-0 flex-1 basis-0 sm:max-w-[12rem]">
            <button
              type="button"
              onClick={() => setEventToolsOpen((open) => !open)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-card/65 px-4 py-2 text-sm font-bold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_12px_30px_rgba(0,0,0,.10)] backdrop-blur-xl transition-colors hover:bg-primary/10"
              aria-expanded={eventToolsOpen}
            >
              <Settings className="h-4 w-4 text-primary" />
              {t("mgmt.event_tools", "Event Tools")}
            </button>
            {eventToolsOpen && (
              <div className="absolute left-0 top-full z-40 mt-2 max-h-[65vh] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border/45 bg-card p-2 shadow-[0_20px_50px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.35)]">
                <button type="button" onClick={() => { setEventToolsOpen(false); navigate(`/events/events?edit=${id}`); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/10">
                  <Pencil className="h-4 w-4 text-primary" /> {t("mgmt.edit", "Edit")}
                </button>
                <button type="button" onClick={() => { setEventToolsOpen(false); void duplicateEvent(); }} disabled={duplicateBusy} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50">
                  <Copy className="h-4 w-4 text-primary" /> {duplicateBusy ? t("mgmt.duplicating", "Duplicating...") : t("mgmt.duplicate", "Duplicate")}
                </button>
                <button type="button" onClick={() => { setEventToolsOpen(false); void openGroupChat(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/10">
                  <MessageCircle className="h-4 w-4 text-primary" /> {t("mgmt.msg_attendees", "Group Chat")}
                </button>
                <button type="button" onClick={() => { setEventToolsOpen(false); void togglePublish(); }} disabled={statusBusy} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50">
                  {event.status === "published" ? <EyeOff className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4 text-primary" />}
                  {event.status === "published" ? t("mgmt.unpublish", "Unpublish") : t("mgmt.publish", "Publish")}
                </button>
                <div className="my-1 h-px bg-border/60" />
                <EventOwnerActionsMenu
                  mode="ownership"
                  eventId={event.id}
                  hostId={event.host_id}
                  currentUserId={user!.id}
                  onEdit={() => undefined}
                  onDuplicate={() => undefined}
                  onDelete={() => undefined}
                  onTransferred={() => { void fetchEvent(); }}
                />
                <div className="my-1 h-px bg-border/60" />
                <button type="button" onClick={() => { setEventToolsOpen(false); setDeleteOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" /> {t("mgmt.delete", "Delete")}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setEventToolsOpen(false); void openQr(); }}
            className="inline-flex min-w-0 flex-1 basis-0 items-center justify-center gap-2 rounded-full border border-primary/25 bg-card/65 px-4 py-2 text-sm font-bold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_12px_30px_rgba(0,0,0,.10)] backdrop-blur-xl transition-colors hover:bg-primary/10 sm:max-w-[12rem]"
          >
            <Share2 className="h-4 w-4 text-primary" /> {t("mgmt.share", "Share")}
          </button>
        </div>

        <IssueComplimentaryTicketDialog
          open={compOpen}
          onOpenChange={setCompOpen}
          eventId={event.id}
          hasVip={!!event.vip_ticket_price || !!event.vip_capacity || !!event.vip_price}
          onIssued={refresh}
        />
        {user && (
          <Dialog open={managerToolsOpen} onOpenChange={setManagerToolsOpen}>
            <DialogContent closeLabel={t("mgmt.close", "Close")} className="max-w-md p-0 overflow-hidden">
              <DialogHeader className="border-b border-border/60 px-5 py-4">
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" /> {t("mgmt.assign_manager", "Assign manager")}
                </DialogTitle>
                <DialogDescription>
                  {t("mgmt.assign_manager_description", "Generate an expiring link for someone helping run this event.")}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[72vh] overflow-y-auto p-5">
                <EventManagersPanel
                  eventId={event.id}
                  hostId={event.host_id}
                  currentUserId={user.id}
                  embedded
                  startOpen
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleteBusy) setDeleteOpen(open); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("mgmt.delete_title", "Delete this event?")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("mgmt.delete_description", "This permanently removes {title} and its registration records. This action cannot be undone.").replace("{title}", event.title)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>{t("mgmt.cancel", "Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(clickEvent) => { clickEvent.preventDefault(); void deleteEvent(); }}
                disabled={deleteBusy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteBusy ? t("mgmt.deleting", "Deleting...") : t("mgmt.delete_event", "Delete event")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {qrOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQrOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border shadow-card rounded-2xl p-6 w-full max-w-sm relative">
              <button onClick={() => setQrOpen(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-foreground mb-1">{t("mgmt.qr_title", "Event QR Code")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("mgmt.qr_desc", "Scan to open this event page. Print on your flyer or share at the door.")}</p>
              <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-4 min-h-[260px]">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Event QR Code" className="w-full max-w-[240px]" />
                ) : (
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={downloadQr} disabled={!qrDataUrl} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl border border-border bg-secondary text-xs font-semibold text-foreground transition-colors hover:bg-secondary/75 disabled:opacity-50">
                  <Download className="w-3.5 h-3.5" /> {t("mgmt.download", "Download")}
                </button>
                <button onClick={() => void shareEventUrl()} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold bg-secondary border border-border text-foreground transition-colors hover:bg-secondary/75">
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 break-all text-center">{eventUrl}</p>
            </div>
          </div>
        )}

        {/* v25 EF: the claimed-manager welcome tour — three taps and they're working. */}
        {managerTourStep >= 0 && (() => {
          const steps = [
            {
              title: t("mgr.tour1_title", "You're in — welcome aboard 🎉"),
              body: t("mgr.tour1_body", "The host gave you access to help run this event. The tabs you see across the top are exactly the powers they picked for you."),
            },
            {
              title: t("mgr.tour2_title", "Check-In is your main tool"),
              body: t("mgr.tour2_body", "Open the Check-In tab and tap \"Scan QR Code\". Green check + one beep = they're in. Amber + two beeps = already checked in. You can always check someone in manually too."),
            },
            {
              title: t("mgr.tour3_title", "Vouchers & media"),
              body: t("mgr.tour3_body", "The same scanner redeems food & drink voucher QRs from attendees' tickets. If the host gave you media powers, the Photos tab is where event pictures live. That's it — you're ready."),
            },
          ];
          const st = steps[Math.min(managerTourStep, steps.length - 1)];
          const last = managerTourStep >= steps.length - 1;
          return (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <p className="text-base font-bold text-foreground">{st.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{st.body}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex gap-1.5">
                    {steps.map((_, i) => (
                      <span key={i} className={cn("h-1.5 w-5 rounded-full", i <= managerTourStep ? "bg-primary" : "bg-secondary")} />
                    ))}
                  </span>
                  <span className="flex gap-2">
                    {managerTourStep > 0 && (
                      <button onClick={() => setManagerTourStep((s) => s - 1)}
                        className="rounded-full border border-border bg-secondary px-4 py-2 text-xs font-bold text-foreground">
                        {t("mgr.tour_back", "Back")}
                      </button>
                    )}
                    <button onClick={() => (last ? setManagerTourStep(-1) : setManagerTourStep((s) => s + 1))}
                      className="ow-btn-espresso rounded-full px-5 py-2 text-xs font-bold">
                      {last ? t("mgr.tour_done", "Let's go") : t("mgr.tour_next", "Next")}
                    </button>
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Tabs — v25 DV (Lee): Applicants stays VISIBLE even without an application, and
            explains itself when tapped, instead of silently missing from the row. */}
        <div className="flex gap-1 mb-6 border-b-2 border-border overflow-x-auto">
          {visibleTabs.map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap -mb-[2px]",
                activeTab === key
                  ? "text-foreground border-b-[3px] border-primary"
                  : "text-muted-foreground border-b-[3px] border-transparent"
              )}
            >
              {t(`mgmt.tab.${key}`)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <>
            <EventOverviewTab
              event={overviewEvent}
              checkedInCount={attendanceCounts.checkedInAttendees || checkedInCount}
              onOpenPayouts={() => setActiveTab("payouts")}
              onOpenGuestList={() => setCompOpen(true)}
              onOpenAssignManager={() => setManagerToolsOpen(true)}
              onOpenGroupChat={() => void openGroupChat()}
            />
            {managerPerms === null && (
              <EventReminderSettings eventId={event.id} hostId={event.host_id} event={event} />
            )}
          </>
        )}
        {activeTab === "registrations" && (
          <EventRegistrationsTab
            eventId={event.id}
            registrations={registrations}
            onRefresh={refresh}
            pendingApps={pendingApps}
            requiresApproval={!!event.requires_application && !!event.application_requires_approval}
            onOpenApplicants={() => setActiveTab("applicants")}
            onOpenCheckIn={() => setActiveTab("check-in")}
          />
        )}
        {/* v25 EB (Lee): approving creates a registration — onChanged refetches so the
            other tabs see it IMMEDIATELY ("Al disappeared" was a stale list, not lost data).
            v25 DV: with no application configured, the tab explains itself. */}
        {activeTab === "applicants" && (
          event.requires_application ? (
            <EventApplicantsTab eventId={event.id} onChanged={refresh} />
          ) : (
            <div className="rounded-2xl border border-border bg-secondary/40 p-10 text-center">
              <p className="text-sm font-bold text-foreground">{t("mgmt.no_application_title", "No application required for this event")}</p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {t("mgmt.no_application_body", "Attendees register directly — you'll find everyone under Registrations. Want to screen people first? Turn on \"Request to Join\" in your event settings.")}
              </p>
              <button onClick={() => navigate(`/events/events?edit=${id}`)}
                className="mt-4 rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/15">
                {t("mgmt.open_event_settings", "Open event settings")}
              </button>
            </div>
          )
        )}
        {activeTab === "check-in" && (
          <EventCheckInTab
            eventId={event.id}
            registrations={registrations}
            onRefresh={refresh}
            pendingApps={pendingApps}
            requiresApproval={!!event.requires_application && !!event.application_requires_approval}
          />
        )}
        {activeTab === "photos" && (
          <EventPhotosTab eventId={event.id} eventTitle={event.title} registrations={registrations} />
        )}
        {activeTab === "food-drink" && (
          <EventFoodDrinkPanel eventId={event.id} />
        )}
        {activeTab === "jobs" && (
          <LinkJobsToEvent eventId={event.id} hostId={event.host_id} currentUserId={user?.id || ""} />
        )}
        {activeTab === "payouts" && (
          <EventPayoutsTab eventId={event.id} />
        )}
        {activeTab === "activity" && (
          <EventActivityTab eventId={event.id} />
        )}
      </div>
    </AppLayout>
  );
}
