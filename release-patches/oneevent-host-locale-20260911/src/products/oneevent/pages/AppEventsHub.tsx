import { ScreenHeading } from "@oneworld/shell";
import { useState, useEffect, useCallback, useRef } from "react";
import { VaiaPopupCard } from "@evt/components/app/VaiaPopupCard";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@evt/hooks/useAuth";
import { useIsMobile } from "@evt/hooks/use-mobile";
import { useLanguage, useMicro } from "@evt/i18n/LanguageContext";
import AppLayout from "@evt/components/app/AppLayout";
import InfoTip from "@evt/components/InfoTip";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Plus, MapPin, Clock, Users, Ticket,
  CheckCircle2, XCircle, AlertCircle, Radar, Star,
  Settings, QrCode, Pencil, Trash2, BookUser, Send,
  Search, UserPlus, X, Eye, EyeOff, Copy, Bookmark, MessageCircle, Upload,
  ChevronDown, History,
} from "lucide-react";
import { getPlanTier, isCapabilityUnlocked, DEFAULT_CAPABILITIES } from "@evt/lib/capabilities";
import UpgradePrompt from "@evt/components/app/UpgradePrompt";
/* VAIA's face is served from `public/`, not bundled. There used to be a second,
   byte-identical copy under `oneevent/assets/` and only the public one was ever committed,
   which broke a clean build (found by Max, 13 Aug 2026). One file, one path — the same
   `/vaia-avatar-v5.png` that `VaiaFace` in the shell already defaults to. */
import { cn } from "@evt/lib/utils";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";
import CreateEventForm, { EventFormData } from "@evt/components/events/CreateEventForm";
import HostRolodexBlast from "@evt/components/events/HostRolodexBlast";
import EventBroadcastHistoryDialog from "@evt/components/events/EventBroadcastHistoryDialog";
import RolodexContactDrawer from "@evt/components/events/RolodexContactDrawer";
import RolodexCsvImport from "@evt/components/events/RolodexCsvImport";
import RolodexAISearch from "@evt/components/events/RolodexAISearch";
import RolodexContactForm from "@evt/components/events/RolodexContactForm";
import RolodexShareDrawer from "@evt/components/events/RolodexShareDrawer";
import { splitRolodexValues } from "@evt/lib/rolodexSchema";
import { format } from "date-fns";
import { currencySymbol } from "@evt/lib/currencies";
import { normalizeEventTimeZone, utcIsoToZonedParts, zonedDateTimeToUtcIso } from "@evt/lib/eventTime";
import InlinePayoutsPanel from "@evt/components/payouts/InlinePayoutsPanel";
import { Wallet } from "lucide-react";
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

/* ── Types ── */
type EventTab = "upcoming" | "drafts" | "past" | "archived" | "all" | "radar" | "payouts";
type Perspective = "attending" | "hosting" | "rolodex";

interface RolodexContact {
  rolodex_id: string;
  contact_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  occupation: string | null; // v33: from the row itself (application answers / CSV / edits)
  photo_url: string | null;
  job_title: string | null;
  category: string | null;
  events_attended: number;
  whatsapp_ok: boolean | null;
  sms_ok: boolean | null;
  email_ok: boolean | null;
  attestation_id: string | null;
  last_notified_at: string | null;
}

interface EventCard {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  timezone?: string | null;
  location: string | null;
  venue_name: string | null;
  cover_image_url: string | null;
  cover_aspect_ratio?: string | null;
  ticket_type: string | null;
  ticket_price: number | null;
  currency?: string | null;
  status: string;
  attendee_count: number;
  revenue: number | null;
  host_id: string;
  category: string | null;
  max_attendees: number | null;
  event_type: string | null;
  visibility: string | null;
  location_type: string | null;
  event_link: string | null;
  ga_ticket_price: number | null;
  ga_ticket_qty: number | null;
  ga_sold?: number | null;
  has_vip_ticket: boolean | null;
  vip_ticket_price: number | null;
  vip_ticket_qty: number | null;
  vip_sold?: number | null;
  attachment_urls: any;
  discount_code: string | null;
  slug?: string | null;
  discount_percent: number | null;
  min_score: number | null;
  latitude: number | null;
  longitude: number | null;
  address_visible: boolean;
  is_evergreen?: boolean | null;
  requires_application?: boolean | null;
  application_requires_approval?: boolean | null;
  application_icp_description?: string | null;
}

const TAB_KEYS: EventTab[] = ["upcoming", "drafts", "past", "archived", "all", "radar", "payouts"];

const soldTicketsFor = (event: Pick<EventCard, "ga_sold" | "vip_sold">) =>
  Number(event.ga_sold || 0) + Number(event.vip_sold || 0);

const hasPaidPublishedTickets = (event: EventCard) =>
  event.status === "published" && (
    Number(event.ga_ticket_price || event.ticket_price || 0) > 0 ||
    (event.has_vip_ticket && Number(event.vip_ticket_price || 0) > 0)
  );

const withHostStats = (event: EventCard, revenue?: number | null): EventCard => ({
  ...event,
  attendee_count: soldTicketsFor(event),
  revenue: revenue === undefined ? null : revenue,
});

export default function AppEventsHub() {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const m = useMicro();
  const [activeTab, setActiveTab] = useState<EventTab>("upcoming");
  const [perspective, setPerspective] = useState<Perspective>("attending");
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Hide the VAIA subheader pill while the full-screen Create Event form is open.
  useEffect(() => { window.dispatchEvent(new CustomEvent("os-vaia-sub-hide", { detail: showCreateForm })); }, [showCreateForm]);
  const [editingEvent, setEditingEvent] = useState<EventCard | null>(null);
  const [editingApplicationForm, setEditingApplicationForm] = useState<{ questions: any[] } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draftPreviewPrompt, setDraftPreviewPrompt] = useState<{ id: string; title: string } | null>(null);
  const [autoPreviewOnOpen, setAutoPreviewOnOpen] = useState(false);

  const [hostedEvents, setHostedEvents] = useState<EventCard[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<EventCard[]>([]);
  /* Saved events (17 Aug 2026): saved_items had a writer (Save Event on the detail page)
     and NO reader anywhere in the product — saving an event visibly did nothing. They now
     live here, under the same centre tab as everything else of yours. */
  const [savedEvents, setSavedEvents] = useState<EventCard[]>([]);
  /* v23 CN (Lee's UAT): pending join-requests were invisible here — an applicant had NO
     trace anywhere that their request existed. They now surface under Attending. */
  const [requestedEvents, setRequestedEvents] = useState<(EventCard & { __authorized?: boolean })[]>([]);
  /* v28 EN (Lee): tapping a pending card opens the little "ticket pending" story — with a
     straight line to the host — instead of silently jumping to the event page. */
  const [pendingDialog, setPendingDialog] = useState<null | (EventCard & { __authorized?: boolean })>(null);
  const [contactingHost, setContactingHost] = useState(false);
  const [loading, setLoading] = useState(true);

  // Rolodex state
  const [rolodexContacts, setRolodexContacts] = useState<RolodexContact[]>([]);
  const [rolodexLoading, setRolodexLoading] = useState(false);
  const [rolodexSearch, setRolodexSearch] = useState("");
  const [openRolodex, setOpenRolodex] = useState<{ id: string; name: string } | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [blastEvent, setBlastEvent] = useState<EventCard | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactBusy, setAddContactBusy] = useState(false);
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const [selectedBlastEventId, setSelectedBlastEventId] = useState<string | null>(null);
  const [rolodexToolsOpen, setRolodexToolsOpen] = useState(false);
  const [rolodexBroadcastHistoryOpen, setRolodexBroadcastHistoryOpen] = useState(false);
  const [addContactSearch, setAddContactSearch] = useState("");
  const [addContactResults, setAddContactResults] = useState<any[]>([]);
  const [calendarEventIds, setCalendarEventIds] = useState<Set<string>>(new Set());
  const [selectedRolodex, setSelectedRolodex] = useState<Set<string>>(new Set());
  const [bulkBlastEvent, setBulkBlastEvent] = useState<EventCard | null>(null);

  // Past events remain published records and must keep their Rolodex history available.
  const publishedHostedEvents = hostedEvents.filter((event) => event.status === "published");
  const selectedBlastEvent =
    publishedHostedEvents.find((event) => event.id === selectedBlastEventId) ||
    publishedHostedEvents[0] ||
    null;

  const plan = getPlanTier(subscription?.plan);
  const canHost = isCapabilityUnlocked("host_events", plan, DEFAULT_CAPABILITIES);

  const tabLabels: Record<EventTab, string> = {
    upcoming: t("hub.tab.upcoming"), drafts: t("hub.tab.drafts"), past: t("hub.tab.past"),
    archived: t("hub.tab.archived"), all: t("hub.tab.all"), radar: t("hub.tab.radar"),
    payouts: t("hub.tab.payouts"),
  };

  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [{ data: hosted, error: hostErr }, { data: regs, error: regErr }, { data: calendarRows, error: calendarErr }] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("host_id", user.id)
          .order("start_date", { ascending: true }),
        supabase
          .from("event_registrations")
          .select("event_id, status, quantity")
          .eq("user_id", user.id)
          .neq("status", "cancelled"),
        supabase
          .from("calendar_events")
          .select("event_id")
          .eq("user_id", user.id),
      ]);

      if (hostErr) throw hostErr;
      if (regErr) throw regErr;
      if (calendarErr) throw calendarErr;

      const hostedRows = ((hosted || []) as EventCard[]).map((event) => withHostStats(event));
      setHostedEvents(hostedRows);
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session || hostedRows.length === 0) return;
          const revenueEvents = hostedRows.filter(hasPaidPublishedTickets);
          if (revenueEvents.length === 0) return;
          const pairs = await Promise.all(revenueEvents.map(async (event) => {
            try {
              const { data: res } = await supabase.functions.invoke("stripe-event-activity", {
                body: { event_id: event.id },
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              const cents = Number((res as any)?.totals?.net_to_host);
              return [event.id, Number.isFinite(cents) ? cents / 100 : null] as const;
            } catch {
              return [event.id, null] as const;
            }
          }));
          const revenueById = new Map(pairs);
          setHostedEvents((prev) => prev.map((event) => withHostStats(event, revenueById.get(event.id))));
        } catch {
          // Hosted cards already have sold-count truth; Stripe totals are a progressive enhancement.
        }
      })();
      setCalendarEventIds(new Set((calendarRows || []).map((row: any) => row.event_id).filter(Boolean)));

      if (regs && regs.length > 0) {
        const eventIds = regs.map((r) => r.event_id);
        const { data: attendEvents, error: attErr } = await supabase
          .from("events")
          .select("*")
          .in("id", eventIds)
          .order("start_date", { ascending: true });
        if (attErr) throw attErr;
        setAttendingEvents(((attendEvents || []) as EventCard[]).filter(e => e.host_id !== user.id));
      } else {
        setAttendingEvents([]);
      }

      // v23 CN: my pending join-requests (gated events awaiting host approval)
      /* v28 EM (Forrest Harris, 18 Aug 2026): a guest application stays ORPHANED even after
         the same email creates an account — he applied, signed up 29s later, and this rail
         showed him nothing. Claim my own guest applications (by verified email, SECURITY
         DEFINER) before looking them up. Best-effort — the lookup below works either way. */
      await supabase.rpc("claim_my_guest_applications" as any);
      const { data: myApps } = await supabase
        .from("event_applications")
        .select("event_id, payment_status")
        .eq("applicant_user_id", user.id)
        .eq("approval_status", "pending");
      const regIds = new Set((regs || []).map((r: any) => r.event_id));
      const pendingIds = (myApps || []).map((a: any) => a.event_id).filter((eid: string) => !regIds.has(eid));
      if (pendingIds.length) {
        const authIds = new Set((myApps || []).filter((a: any) => a.payment_status === "authorized").map((a: any) => a.event_id));
        const { data: reqEvs } = await supabase
          .from("events").select("*").in("id", pendingIds)
          .order("start_date", { ascending: true });
        setRequestedEvents(((reqEvs || []) as EventCard[]).map(e => ({ ...e, __authorized: authIds.has(e.id) })));
      } else {
        setRequestedEvents([]);
      }

      // Saved-for-later events (bookmarked from event pages)
      const { data: savedRows } = await supabase
        .from("saved_items")
        .select("item_id")
        .eq("user_id", user.id)
        .eq("item_type", "event");
      const savedIds = (savedRows || []).map((r: any) => r.item_id).filter(Boolean);
      if (savedIds.length) {
        const { data: savedEvs } = await supabase
          .from("events").select("*").in("id", savedIds)
          .order("start_date", { ascending: true });
        setSavedEvents((savedEvs || []) as EventCard[]);
      } else {
        setSavedEvents([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-pick the top-level Events perspective once the real data for this
  // signed-in identity has loaded. Resetting on user change prevents admin
  // impersonation / account switches from keeping a stale Attending default.
  const autoPerspectiveSet = useRef(false);
  useEffect(() => {
    autoPerspectiveSet.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (autoPerspectiveSet.current) return;
    if (loading) return;
    // Default to "hosting" whenever the user has any hosted events (draft or live).
    // Only fall back to "attending" when there are no hosted events at all.
    if (hostedEvents.length > 0) {
      setPerspective("hosting");
      if (hostedEvents.every(e => e.status === "draft")) setActiveTab("drafts");
    } else if (attendingEvents.length > 0) {
      setPerspective("attending");
    }
    autoPerspectiveSet.current = true;
  }, [loading, hostedEvents.length, attendingEvents.length]);

  // Handle ?edit=<id> query param
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "hosting" || tab === "attending" || tab === "rolodex") {
      setPerspective(tab);
      setSearchParams(prev => { prev.delete("tab"); return prev; }, { replace: true });
    }

    // Returning from Stripe payout onboarding. Let the host know their payouts are
    // submitted/under review and land them back on their event. (Lee, Jul 23)
    if (searchParams.get("payouts") === "connected" || searchParams.get("success") === "1") {
      toast.success("Payouts submitted to Stripe — they're under review. We'll notify you once you're approved. Your event is saved as a draft.", { duration: 9000 });
      setPerspective("hosting");
      if (!searchParams.get("edit")) setActiveTab("drafts");
      setSearchParams(prev => { prev.delete("payouts"); prev.delete("success"); prev.delete("refresh"); return prev; }, { replace: true });
    }

    // VIP30 (Masterminds) onboarding lands here with ?launched=true.
    // Show the welcome toast then strip the flag so a refresh won't re-trigger.
    if (searchParams.get("launched") === "true") {
      toast.success(
        "Welcome to OneEvent! Your VIP30 perks are active for the next 30 days. Start by exploring events and inviting your network.",
        { duration: 10000 }
      );
      setSearchParams(prev => { prev.delete("launched"); return prev; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && hostedEvents.length > 0 && !showCreateForm) {
      const eventToEdit = hostedEvents.find(e => e.id === editId);
      if (eventToEdit) {
        setEditingEvent(eventToEdit);
        setShowCreateForm(true);
        setPerspective("hosting");
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, hostedEvents, showCreateForm, setSearchParams]);

  // Load existing application form when editing an event
  useEffect(() => {
    if (!editingEvent?.id) { setEditingApplicationForm(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("event_application_forms")
        .select("questions, is_active")
        .eq("event_id", editingEvent.id)
        .maybeSingle();
      if (!cancelled) {
        const qs = (data && Array.isArray((data as any).questions)) ? (data as any).questions : [];
        setEditingApplicationForm({ questions: qs });
      }
    })();
    return () => { cancelled = true; };
  }, [editingEvent?.id]);

  // Fetch rolodex contacts
  const fetchRolodex = useCallback(async () => {
    if (!user?.id) return;
    setRolodexLoading(true);
    try {
      /* v33 (Lee's Rolodex UAT): applications now auto-populate host_rolodex server-side,
         so the row itself carries name/occupation/photo — read them all, not just name/email. */
      const { data: rolodex } = await supabase
        .from("host_rolodex" as any)
        .select("id, contact_id, name, email, phone, occupation, location, photo_url, custom_fields, whatsapp_ok, sms_ok, email_ok, attestation_id, last_notified_at")
        .eq("host_id", user.id);

      if (!rolodex || rolodex.length === 0) {
        setRolodexContacts([]);
        setRolodexLoading(false);
        return;
      }

      const rolodexRows = rolodex as any[];
      const contactIds = rolodexRows.map((r) => r.contact_id).filter(Boolean);

      // Fetch profiles for linked contacts
      const { data: profiles } = contactIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, photo_url, job_title, category").in("id", contactIds)
        : { data: [] as any[] };

      // Count events attended
      const { data: regCounts } = contactIds.length > 0
        ? await supabase.from("event_registrations").select("user_id, event_id").in("user_id", contactIds)
        : { data: [] as any[] };

      const countMap: Record<string, number> = {};
      (regCounts || []).forEach((r: any) => { countMap[r.user_id] = (countMap[r.user_id] || 0) + 1; });
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const contacts: RolodexContact[] = rolodexRows.map((r) => {
        const p: any = r.contact_id ? profileMap.get(r.contact_id) : null;
        return {
          rolodex_id: r.id,
          contact_id: r.contact_id || "",
          full_name: r.name || p?.full_name || r.email || m("Unnamed"),
          email: r.email || null,
          phone: r.phone || null,
          occupation: r.occupation || (r.custom_fields?.profession as string) || null,
          photo_url: r.photo_url || p?.photo_url || null,
          job_title: p?.job_title || null,
          category: p?.category || null,
          events_attended: r.contact_id ? (countMap[r.contact_id] || 0) : 0,
          whatsapp_ok: r.whatsapp_ok ?? null,
          sms_ok: r.sms_ok ?? null,
          email_ok: r.email_ok ?? null,
          attestation_id: r.attestation_id || null,
          last_notified_at: r.last_notified_at || null,
        };
      });

      setRolodexContacts(contacts);
    } catch (err) {
      console.error("Failed to fetch rolodex:", err);
    } finally {
      setRolodexLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (perspective === "rolodex") fetchRolodex();
  }, [perspective, fetchRolodex]);

  // Add contact search
  useEffect(() => {
    if (!addContactSearch.trim() || addContactSearch.length < 2) { setAddContactResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, job_title, category")
        .neq("id", user?.id || "")
        .or(`full_name.ilike.%${addContactSearch}%,job_title.ilike.%${addContactSearch}%`)
        .limit(8);
      // Filter out already in rolodex
      const existingIds = new Set(rolodexContacts.map(c => c.contact_id));
      setAddContactResults((data || []).filter((p: any) => !existingIds.has(p.id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [addContactSearch, user?.id, rolodexContacts]);

  const handleAddToRolodex = async (contactId: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from("host_rolodex" as any).insert({
      host_id: user.id,
      contact_id: contactId,
      source: "manual",
    });
    if (error && !error.message.includes("duplicate")) {
      toast.error(m("Failed to add contact"));
      return;
    }
    toast.success(m("Contact added to Rolodex!"));
    setAddContactSearch("");
    setAddContactResults([]);
    fetchRolodex();
  };

  // Delete by rolodex row id (always present, even for CSV-imported contacts with null contact_id)
  const handleRemoveFromRolodex = async (rolodexId: string) => {
    if (!user?.id || !rolodexId) return;
    const { error } = await supabase.from("host_rolodex" as any).delete()
      .eq("host_id", user.id)
      .eq("id", rolodexId);
    if (error) { toast.error(m("Failed to remove contact")); return; }
    toast.success(m("Contact removed"));
    setRolodexContacts(prev => prev.filter(c => c.rolodex_id !== rolodexId));
  };

  const toggleSelectRolodex = (rolodexId: string) => {
    setSelectedRolodex(prev => {
      const next = new Set(prev);
      next.has(rolodexId) ? next.delete(rolodexId) : next.add(rolodexId);
      return next;
    });
  };

  const handleBulkRemove = async () => {
    if (!user?.id || selectedRolodex.size === 0) return;
    if (!confirm(`${m("Remove")} ${selectedRolodex.size} ${m(selectedRolodex.size === 1 ? "contact" : "contacts")} ${m("from your Rolodex?")}`)) return;
    const ids = Array.from(selectedRolodex);
    // Chunk to avoid PostgREST URL length limits (~8KB) — 1000 UUIDs would exceed this
    const CHUNK_SIZE = 100;
    let removed = 0;
    let failed = false;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from("host_rolodex" as any).delete()
        .eq("host_id", user.id).in("id", chunk);
      if (error) {
        console.error("Bulk remove chunk failed:", error);
        failed = true;
        break;
      }
      removed += chunk.length;
    }
    if (failed && removed === 0) {
      toast.error(m("Failed to remove contacts"));
      return;
    }
    if (failed) {
      toast.warning(`${m("Removed")} ${removed} ${m("of")} ${ids.length} ${m("contacts. Try again to remove the rest.")}`);
    } else {
      toast.success(ids.length === 1 ? m("Removed 1 contact") : `${m("Removed")} ${ids.length} ${m("contacts")}`);
    }
    setSelectedRolodex(new Set());
    fetchRolodex();
  };


  const now = new Date();

  const filterEvents = (events: EventCard[]) => {
    return events.filter(e => {
      const eventDate = e.start_date ? new Date(e.start_date) : null;
      const isPast = eventDate ? eventDate < now : false;
      const isArchived = e.status === "archived" || e.status === "cancelled";
      const isDraft = e.status === "draft";

      if (activeTab === "all") return true;
      if (activeTab === "drafts") return isDraft;
      if (activeTab === "upcoming") return !isDraft && !isPast && !isArchived;
      if (activeTab === "past") return !isDraft && isPast && !isArchived;
      if (activeTab === "archived") return isArchived;
      return true;
    });
  };

  const currentEvents = perspective === "hosting" ? hostedEvents : attendingEvents;
  const filtered = filterEvents(currentEvents);

  const formatEventDate = (startDate: string | null, endDate: string | null, isEvergreen?: boolean | null) => {
    if (isEvergreen) return "Available anytime";
    if (!startDate) return "Date TBD";
    const start = new Date(startDate);
    const dateStr = format(start, "MMM d, yyyy");
    const timeStr = format(start, "h:mm a");
    if (endDate) {
      const end = new Date(endDate);
      return `${dateStr} · ${timeStr} – ${format(end, "h:mm a")}`;
    }
    return `${dateStr} · ${timeStr}`;
  };

  const formatPrice = (ticketType: string | null, ticketPrice: number | null, currency?: string | null) => {
    if (ticketType === "free" || !ticketPrice || ticketPrice === 0) return "Free";
    return `${currencySymbol(currency)}${ticketPrice}`;
  };

  const eventDetailState = { backMode: "history" as const, backLabel: "Back to My Events" };

  const isEventInCalendar = (eventId: string) => calendarEventIds.has(eventId);

  const handleCalendarAction = async (event: EventCard) => {
    if (isEventInCalendar(event.id)) {
      navigate("/events/calendar");
      return;
    }

    if (!user?.id) return;
    if (!event.start_date) {
      toast.error("This event doesn't have a date yet.");
      return;
    }

    try {
      const { error } = await supabase.from("calendar_events").insert({
        user_id: user.id,
        event_id: event.id,
        title: event.title,
        start_at: event.start_date,
        end_at: event.end_date || event.start_date,
        description: event.description ? `Event: ${event.title}

${event.description}` : `Event: ${event.title}`,
        color: "#2EE6D6",
      });

      if (error) throw error;

      setCalendarEventIds((prev) => new Set([...prev, event.id]));
      toast.success("Added to your calendar.");
      navigate("/events/calendar");
    } catch (err: any) {
      toast.error(err.message || "Couldn't add this event to your calendar.");
    }
  };

  const getStatusBadge = (event: EventCard) => {
    const isPast = event.start_date ? new Date(event.start_date) < now : false;
    if (event.status === "draft") return { label: t("event.status.draft"), color: "#000", bg: "#F59E0B" };
    if (event.status === "cancelled") return { label: t("event.status.cancelled"), color: "#fff", bg: "#EF4444" };
    if (event.status === "archived") return { label: t("event.status.archived"), color: "#fff", bg: "#6B7280" };
    if (isPast) return { label: t("event.status.completed"), color: "#000", bg: "#10B981" };
    return { label: t("event.status.live"), color: "#000", bg: "#2EE6D6" };
  };

  const handleDeleteEvent = async (eventId: string) => {
    setDeletingId(eventId);
    try {
      // Delete registrations first
      await supabase.from("event_registrations").delete().eq("event_id", eventId);
      const { error } = await supabase.from("events").delete().eq("id", eventId).eq("host_id", user!.id);
      if (error) throw error;
      toast.success("Event deleted successfully");
      setHostedEvents(prev => prev.filter(e => e.id !== eventId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      toast.error("Failed to delete event: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleEventStatus = async (event: EventCard) => {
    const next = event.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("events").update({ status: next }).eq("id", event.id).eq("host_id", user!.id);
    if (error) { toast.error("Failed to update event status"); return; }
    setHostedEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: next } : e));
    toast.success(next === "draft" ? "Moved to Drafts" : "Event is now Live");
  };

  const handleDuplicateEvent = async (event: EventCard) => {
    if (!user?.id) return;
    try {
      const { data: dup, error } = await supabase.from("events").insert({
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
        cover_aspect_ratio: (event as any).cover_aspect_ratio || "16:9",
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
        timezone: event.timezone || null,
        address_visible: event.address_visible,
        status: "draft",
        attendee_count: 0,
        revenue: 0,
        ga_sold: 0,
        vip_sold: 0,
      } as any).select("id").single();
      if (error) throw error;
      toast.success("Event duplicated as draft! Edit it to publish.");
      fetchEvents();
    } catch (err: any) {
      toast.error("Failed to duplicate: " + err.message);
    }
  };

  const saveEvent = async (
    data: EventFormData,
    status: "draft" | "published",
    persistedId?: string | null,
    opts?: { silent?: boolean; keepFormOpen?: boolean }
  ): Promise<string | null> => {
    if (!user?.id) { toast.error("You must be logged in."); return null; }
    const ticketPrice = data.ticketMode === "paid" ? parseFloat(data.generalAdmissionPrice) || 0 : 0;
    const eventTimezone = normalizeEventTimeZone(data.timezone);
    const startIso = data.isEvergreen || !data.startDate
      ? null
      : zonedDateTimeToUtcIso(data.startDate, data.startTime || "00:00", eventTimezone);
    const endIso = data.isEvergreen || !(data.endDate || data.startDate)
      ? null
      : zonedDateTimeToUtcIso(data.endDate || data.startDate, data.endTime || "23:59", eventTimezone);
    const eventPayload = {
      host_id: user.id,
      title: data.eventName,
      description: data.description,
      category: data.category || null,
      location: data.locationType !== "online" ? data.location : null,
      venue_name: data.venueName || null,
      cover_image_url: data.coverImageUrl || null,
      cover_aspect_ratio: data.coverAspectRatio || "16:9",
      start_date: startIso,
      end_date: endIso,
      timezone: eventTimezone,
      is_evergreen: data.isEvergreen || false,
      ticket_type: data.ticketMode,
      ticket_price: ticketPrice,
      max_attendees: data.isUnlimitedCapacity ? null : (parseInt(data.capacity) || null),
      event_type: data.eventType || "other",
      visibility: data.visibility || "public",
      location_type: data.locationType || "in-person",
      status,
      ga_ticket_price: data.ticketMode === "paid" ? (parseFloat(data.generalAdmissionPrice) || 0) : 0,
      ga_ticket_qty: data.isUnlimitedCapacity ? null : (parseInt(data.capacity) || null),
      has_vip_ticket: data.hasVipTicket || false,
      vip_ticket_price: data.hasVipTicket ? (parseFloat(data.vipPrice) || 0) : 0,
      currency: data.ticketMode === "paid" ? (data.currency || "USD") : "USD",
      vip_ticket_qty: data.hasVipTicket ? (parseInt(data.vipQty) || null) : null,
      attachment_urls: data.attachmentUrls || [],
      event_link: data.eventLink || null,
      discount_code: data.hasDiscountCode ? data.discountCode : null,
      discount_percent: data.hasDiscountCode ? (parseInt(data.discountPercent) || null) : null,
      address_visible: data.addressVisible !== false,
      show_total_tickets: data.showTotalTickets !== false,
      show_remaining_tickets: data.showRemainingTickets !== false,
      accept_wise: data.acceptWise === true,
      host_wise_handle: data.acceptWise && data.hostWiseHandle ? data.hostWiseHandle.trim() : null,
      accept_paypal: data.acceptPaypal === true,
      host_paypal_handle: data.acceptPaypal && data.hostPaypalHandle ? data.hostPaypalHandle.trim() : null,
      requires_application: !!data.requiresApplication,
      application_requires_approval: data.requiresApplication ? !!data.applicationRequiresApproval : false,
      application_icp_description: data.requiresApplication ? (data.applicationIcpDescription || null) : null,
      slug: data.slug ? data.slug.trim() : null,
    };

    const targetId = persistedId ?? (editingEvent ? editingEvent.id : null);
    let savedEventId: string | null = null;
    if (targetId) {
      // Update existing event/draft
      const { error } = await supabase.from("events").update(eventPayload as any).eq("id", targetId).eq("host_id", user.id);
      if (error) { if (!opts?.silent) toast.error("Failed to save event: " + error.message); return null; }
      savedEventId = targetId;
      if (!opts?.silent) toast.success(status === "published" ? "Event published!" : "Draft saved.");
    } else {
      // Insert new event
      const { data: inserted, error } = await supabase.from("events").insert(eventPayload as any).select("id").single();
      if (error) { if (!opts?.silent) toast.error("Failed to save event: " + error.message); return null; }
      savedEventId = inserted?.id || null;
      if (!opts?.silent) toast.success(status === "published" ? "Event published!" : "Draft saved.");
    }

    // Persist application form (questions) when application gate is on
    if (savedEventId && data.requiresApplication) {
      const formPayload = {
        event_id: savedEventId,
        host_id: user.id,
        title: "Request to join",
        description: null as string | null,
        questions: (data.applicationQuestions || []) as any,
        is_active: true,
      };
      const { error: formErr } = await supabase
        .from("event_application_forms")
        .upsert(formPayload as any, { onConflict: "event_id" });
      if (formErr) {
        console.error("event_application_forms upsert failed:", formErr);
        if (!opts?.silent) toast.error("Application form failed to save: " + formErr.message);
      }
    } else if (savedEventId) {
      // Disable any existing form if the gate is now off
      await supabase
        .from("event_application_forms")
        .update({ is_active: false } as any)
        .eq("event_id", savedEventId);
    }

    if (!opts?.keepFormOpen) {
      setShowCreateForm(false);
      setEditingEvent(null);
    }
    fetchEvents();
    return savedEventId;
  };

  const discardDraft = async (draftId: string) => {
    if (!user?.id || !draftId) return;
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", draftId)
      .eq("host_id", user.id)
      .eq("status", "draft");
    if (error) console.error("discardDraft failed:", error);
    fetchEvents();
  };

  if (showCreateForm) {
    // When editing, wait until the application form has been fetched so the
    // questions array is populated on first mount (CreateEventForm seeds its
    // internal state from initialData only once).
    if (editingEvent?.id && editingApplicationForm === null) {
      return (
        <AppLayout>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
            <div className="text-xs text-muted-foreground">Loading event…</div>
          </div>
        </AppLayout>
      );
    }
    const editingTimezone = normalizeEventTimeZone(editingEvent?.timezone);
    const editingStart = utcIsoToZonedParts(editingEvent?.start_date, editingTimezone);
    const editingEnd = utcIsoToZonedParts(editingEvent?.end_date, editingTimezone);
    return (
      <AppLayout>
        <CreateEventForm
          onBack={() => { setShowCreateForm(false); setEditingEvent(null); setAutoPreviewOnOpen(false); }}
          autoOpenPreview={autoPreviewOnOpen}
          onPublish={(data, persistedId) => saveEvent(data, "published", persistedId)}
          onSaveDraft={(data, persistedId) => saveEvent(data, "draft", persistedId)}
          onAutoSaveDraft={(data, persistedId) => saveEvent(data, "draft", persistedId, { silent: true, keepFormOpen: true })}
          onDiscardDraft={(draftId) => discardDraft(draftId)}
          persistedDraftId={editingEvent?.status === "draft" ? editingEvent.id : null}
          initialData={editingEvent ? {
            id: editingEvent.id,
            status: editingEvent.status,
            eventName: editingEvent.title,
            description: editingEvent.description || "",
            category: editingEvent.category || "",
            eventType: (editingEvent.event_type as any) || "other",
            visibility: (editingEvent.visibility as any) || "public",
            locationType: (editingEvent.location_type as any) || "in-person",
            location: editingEvent.location || "",
            venueName: editingEvent.venue_name || "",
            eventLink: editingEvent.event_link || "",
            coverImageUrl: editingEvent.cover_image_url || "",
            coverAspectRatio: ((editingEvent as any).cover_aspect_ratio as any) || "16:9",
            ticketMode: editingEvent.ticket_type === "free" ? "free" : "paid",
            currency: ((editingEvent as any).currency as string) || "USD",
            generalAdmissionPrice: String(editingEvent.ga_ticket_price || editingEvent.ticket_price || 0),
            generalAdmissionQty: String(editingEvent.ga_ticket_qty || ""),
            hasVipTicket: editingEvent.has_vip_ticket || false,
            vipPrice: String(editingEvent.vip_ticket_price || ""),
            vipQty: String(editingEvent.vip_ticket_qty || ""),
            isUnlimitedCapacity: !editingEvent.max_attendees,
            capacity: String(editingEvent.max_attendees || ""),
            requireScore: (editingEvent.min_score || 0) > 0,
            minScore: editingEvent.min_score || 0,
            hasDiscountCode: !!editingEvent.discount_code,
            discountCode: editingEvent.discount_code || "",
            discountPercent: String(editingEvent.discount_percent || ""),
            slug: (editingEvent as any).slug || "",
            showTotalTickets: (editingEvent as any).show_total_tickets !== false,
            showRemainingTickets: (editingEvent as any).show_remaining_tickets !== false,
            acceptWise: (editingEvent as any).accept_wise === true,
            hostWiseHandle: (editingEvent as any).host_wise_handle || "",
            acceptPaypal: (editingEvent as any).accept_paypal === true,
            hostPaypalHandle: (editingEvent as any).host_paypal_handle || "",
            timezone: editingTimezone,
            startDate: editingStart.date,
            startTime: editingStart.time,
            endDate: editingEnd.date,
            endTime: editingEnd.time,
            attachmentUrls: Array.isArray(editingEvent.attachment_urls) ? editingEvent.attachment_urls : [],
            requiresApplication: !!(editingEvent as any).requires_application,
            applicationRequiresApproval: !!(editingEvent as any).application_requires_approval,
            applicationIcpDescription: (editingEvent as any).application_icp_description || "",
            applicationQuestions: editingApplicationForm?.questions || [],
          } as any : undefined}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* AppShell's main container owns the column — only overflow guarding stays. */}
      <div style={{ overflowX: "hidden" }}>
        {/* Header — descriptive copy folded into the (i) tip (Lee, Jul 21) */}
        <ScreenHeading className="mb-6" right={
          <InfoTip text="Events are where real connections happen — everything you host and attend in one place. Switch to Hosting to create events and manage your guest Rolodex; Attending shows the events you've registered for." />
        }>{t("hub.events.title")}</ScreenHeading>

        {/* Perspective Toggle — only Hosting + Attending live here permanently.
            Rolodex is a Hosting-scoped sub-action (shown to the right of Create Event). */}
        <div className="mb-6 space-y-3">
          {/* Hosting / Attending — full-width segmented control (Lee, Jul 21) */}
          <div className="inline-flex w-full rounded-full border border-border bg-secondary p-1">
            {(["hosting", "attending"] as Perspective[]).map(p => {
              const on = perspective === p || (p === "hosting" && perspective === "rolodex");
              return (
                /* v24 DO (Lee): the segmented control carries the modernized espresso
                   treatment — no more flat burnt-amber next to polished buttons. */
                <button key={p} onClick={() => setPerspective(p)}
                  className={cn(
                    "flex-1 px-5 py-2 rounded-full text-sm font-bold transition-all",
                    on ? "ow-btn-espresso" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {p === "attending" ? t("hub.perspective.attending") : t("hub.perspective.hosting")}
                </button>
              );
            })}
          </div>
          {/* Hosting actions — Rolodex (left) · Create (right); Attending has none */}
          {(perspective === "hosting" || perspective === "rolodex") && (
            <div className="flex items-center gap-2">
              {perspective === "rolodex" ? (
                <>
                  <button onClick={() => setPerspective("hosting")} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 bg-secondary border border-border text-foreground" aria-label={m("Close Rolodex")}>
                    <Plus className="w-4 h-4 rotate-45" />
                  </button>
                  <div className="relative z-40 flex-1">
                    <button
                      type="button"
                      onClick={() => setRolodexToolsOpen((open) => !open)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-all active:scale-95"
                      aria-expanded={rolodexToolsOpen}
                    >
                      <BookUser className="h-4 w-4" /> {m("Rolodex Tools")}
                      <ChevronDown className={cn("h-4 w-4 transition-transform", rolodexToolsOpen && "rotate-180")} />
                    </button>
                    {rolodexToolsOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
                        <button type="button" onClick={() => { setRolodexToolsOpen(false); setShowAddContact(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-primary/10">
                          <UserPlus className="h-4 w-4 text-primary" /> {m("Add contact")}
                        </button>
                        <button type="button" onClick={() => { setRolodexToolsOpen(false); setShowShareDrawer(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-primary/10">
                          <QrCode className="h-4 w-4 text-primary" /> {m("Share Rolodex")}
                        </button>
                        <button type="button" onClick={() => { setRolodexToolsOpen(false); setShowCsvImport(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-primary/10">
                          <Upload className="h-4 w-4 text-primary" /> {m("Import contacts")}
                        </button>
                        <button
                          type="button"
                          disabled={!selectedBlastEvent}
                          onClick={() => {
                            if (!selectedBlastEvent) return;
                            setRolodexToolsOpen(false);
                            setRolodexBroadcastHistoryOpen(true);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-primary/10 disabled:opacity-50"
                        >
                          <History className="h-4 w-4 text-primary" /> {m("Broadcast History")}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => setPerspective("rolodex")} className="flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 bg-secondary border border-border text-foreground">
                    <BookUser className="w-4 h-4" /> Rolodex
                  </button>
                  {/* v24 DO (Lee): Create Event is the BLACK button on this screen. */}
                  <button onClick={() => setShowCreateForm(true)} className="ow-btn-ink flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95">
                    <Plus className="w-4 h-4" /> {t("hub.events.create")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status Tabs */}
        {/* Status Tabs - hide when viewing rolodex */}
        {perspective !== "rolodex" && (
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none pb-1">
          {TAB_KEYS.filter(tab => tab !== "payouts" || perspective === "hosting").map(tab => {
            const isPayouts = tab === "payouts";
            const active = activeTab === tab;
            return (
              /* v24 DO (Lee): "those are filters — that should be a black button, not
                 orange." Active filter chips go ink-black; espresso stays for actions. */
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-full border text-sm font-semibold capitalize transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
                  active
                    ? "ow-btn-ink border-transparent"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                )}>
                {tab === "radar" && <Radar className="w-4 h-4" />}
                {isPayouts && <Wallet className="w-4 h-4" />}
                {tabLabels[tab]}
                {tab === "drafts" && hostedEvents.some(e => e.status === "draft") && (
                  <span className={cn(
                    "ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    active ? "bg-white/25 text-white" : "bg-red-500 text-white"
                  )}>
                    {hostedEvents.filter(e => e.status === "draft").length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        )}

        {/* Rolodex View */}
        {perspective === "rolodex" ? (
          <div>
            {/* Add Contact Modal — full form */}
            {showAddContact && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setShowAddContact(false)}>
                <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border shadow-card rounded-2xl">
                  <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
                     <h3 className="text-base font-bold text-foreground">{m("Add contact to your Rolodex")}</h3>
                     <button onClick={() => setShowAddContact(false)} className="p-1.5 rounded-2xl bg-secondary hover:bg-secondary/80" aria-label={m("Close add contact")}><X className="w-4 h-4 text-foreground" /></button>
                  </div>
                  <div className="p-5">
                    <RolodexContactForm
                       submitLabel={addContactBusy ? m("Saving…") : m("Save contact")}
                      busy={addContactBusy}
                      onCancel={() => setShowAddContact(false)}
                      onSubmit={async (values) => {
                        if (!user?.id) return;
                        setAddContactBusy(true);
                        try {
                          const { native, custom_fields, notes } = splitRolodexValues(values);
                          const { data: row, error } = await supabase.from("host_rolodex" as any).insert({
                            host_id: user.id, source: "manual", ...native, custom_fields,
                          }).select("id").single();
                          if (error) throw error;
                          if (notes && row) {
                            await supabase.from("rolodex_notes" as any).insert({ rolodex_id: (row as any).id, host_id: user.id, body: notes });
                          }
                           toast.success(m("Contact added to Rolodex!"));
                          setShowAddContact(false);
                          fetchRolodex();
                        } catch (err: any) {
                           toast.error(err?.message || m("Failed to add contact"));
                        } finally {
                          setAddContactBusy(false);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {showShareDrawer && <RolodexShareDrawer onClose={() => setShowShareDrawer(false)} />}

            {selectedBlastEvent && (
              <EventBroadcastHistoryDialog
                open={rolodexBroadcastHistoryOpen}
                onOpenChange={setRolodexBroadcastHistoryOpen}
                eventId={selectedBlastEvent.id}
                eventTimeZone={selectedBlastEvent.timezone}
              />
            )}

            {/* VAIA AI search (Pro+) */}
            <RolodexAISearch onMatchClick={(id) => {
              const c = rolodexContacts.find(x => x.rolodex_id === id);
              if (c) setOpenRolodex({ id: c.rolodex_id, name: c.full_name });
            }} />

            {/* Search bar — v33 (Lee): the old single row squeezed "3 contacts" + Import CSV
                beside the input on phones ("contacts" wrapped under "3", Import pushed off).
                Search now gets the full width; count + import live on their own row. */}
            <div className="mb-4">
              <div className="flex items-center gap-2 px-4 h-10 rounded-xl bg-secondary/50 border border-border min-w-0">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input value={rolodexSearch} onChange={e => setRolodexSearch(e.target.value)}
                  placeholder={m("Search your Rolodex...")}
                  className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm" />
              </div>
              <div className="flex items-center justify-between gap-3 mt-2 px-1">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                  {rolodexContacts.length} {m(rolodexContacts.length === 1 ? "contact" : "contacts")}
                </span>
                <button onClick={() => setShowCsvImport(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary border border-border text-foreground hover:bg-primary/10 whitespace-nowrap shrink-0">
                  <Upload className="w-3 h-3 inline mr-1 -mt-0.5" /> {m("Import contacts (CSV)")}
                </button>
              </div>
            </div>

            {/* Blast to event */}
            {publishedHostedEvents.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Send className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm font-bold text-foreground">{m("Choose event")}</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {publishedHostedEvents.map((event) => {
                    const active = selectedBlastEvent?.id === event.id;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedBlastEventId(event.id)}
                        className={cn(
                          "flex max-w-[260px] shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all",
                          active
                            ? "border-primary/50 bg-primary/15 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-primary/5",
                        )}
                        aria-pressed={active}
                      >
                        <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", active ? "border-primary bg-primary/15" : "border-muted-foreground/35")}>
                          {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                        <span className="truncate">{event.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {rolodexLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">{m("Loading your Rolodex...")}</p>
              </div>
            ) : rolodexContacts.length === 0 ? (
              <div className="p-12 rounded-2xl text-center bg-secondary/50 border border-border">
                <BookUser className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold text-foreground mb-2">{m("Your Rolodex is empty")}</h3>
                <p className="text-sm text-muted-foreground mb-4">{m("Contacts are automatically added when people register for your events. You can also add connections manually.")}</p>
                <button onClick={() => setShowAddContact(true)}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90">
                  <UserPlus className="w-4 h-4 inline mr-1" /> {m("Add Your First Contact")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const visible = rolodexContacts.filter(c =>
                    c.full_name.toLowerCase().includes(rolodexSearch.toLowerCase()) ||
                    (c.occupation || "").toLowerCase().includes(rolodexSearch.toLowerCase()) ||
                    (c.job_title || "").toLowerCase().includes(rolodexSearch.toLowerCase())
                  );
                  const allSelected = visible.length > 0 && visible.every(c => selectedRolodex.has(c.rolodex_id));
                  return (
                    <>
                      <div className="flex items-center gap-3 px-2 py-1">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            setSelectedRolodex(prev => {
                              if (allSelected) {
                                const next = new Set(prev);
                                visible.forEach(c => next.delete(c.rolodex_id));
                                return next;
                              }
                              const next = new Set(prev);
                              visible.forEach(c => next.add(c.rolodex_id));
                              return next;
                            });
                          }}
                          className="w-4 h-4 accent-primary"
                          aria-label={m("Select all contacts")}
                        />
                        <span className="text-xs text-muted-foreground">
                          {selectedRolodex.size > 0 ? `${selectedRolodex.size} ${m("selected")}` : m("Select all")}
                        </span>
                        {selectedRolodex.size > 0 && (
                          <div className="ml-auto flex gap-2">
                            {selectedBlastEvent && (
                              <button
                                onClick={() => setBulkBlastEvent(selectedBlastEvent)}
                                className="px-3 py-1.5 rounded-2xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
                              >
                                {/* v33 (Lee): "I don't know what blast selected means" — say what it does. */}
                                <Send className="w-3 h-3 inline mr-1" /> {m("Invite to event")}
                              </button>
                            )}
                            <button
                              onClick={handleBulkRemove}
                              className="px-3 py-1.5 rounded-2xl text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
                            >
                              <Trash2 className="w-3 h-3 inline mr-1" /> {m("Remove")}
                            </button>
                            <button
                              onClick={() => setSelectedRolodex(new Set())}
                              className="px-3 py-1.5 rounded-2xl text-xs font-semibold bg-secondary border border-border text-foreground"
                            >
                              {m("Clear")}
                            </button>
                          </div>
                        )}
                      </div>
                      {visible.map(c => {
                        const checked = selectedRolodex.has(c.rolodex_id);
                        return (
                          <div key={c.rolodex_id}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-xl bg-card border transition-colors",
                              checked ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"
                            )}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => { e.stopPropagation(); toggleSelectRolodex(c.rolodex_id); }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 accent-primary flex-shrink-0"
                              aria-label={`${m("Select")} ${c.full_name}`}
                            />
                            <div onClick={() => setOpenRolodex({ id: c.rolodex_id, name: c.full_name })} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                              <img src={c.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.full_name)}`}
                                alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{c.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{c.occupation || c.job_title || c.category || m("Member")}</p>
                              </div>
                              <span className="text-xs text-muted-foreground/60 flex-shrink-0">{c.events_attended} {m(c.events_attended === 1 ? "event" : "events")}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveFromRolodex(c.rolodex_id); }}
                              aria-label={`${m("Remove")} ${c.full_name}`}
                              className="p-2 rounded-2xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (activeTab === "payouts" ? (
          <InlinePayoutsPanel />
        ) : activeTab === "radar" ? (
          <div className="p-12 rounded-2xl text-center bg-secondary/50 border border-border">
            <Radar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("hub.events.radar_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("hub.events.radar_desc")}</p>
          </div>
        ) : loading ? (
          <div className="p-12 rounded-2xl text-center bg-secondary/50 border border-border">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading events...</p>
          </div>
        ) : (
          <>
          {/* v23 CN: pending join-requests get a visible home — no more invisible applications. */}
          {perspective === "attending" && requestedEvents.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" /> {t("hub.requested", "Requested — waiting on the host")}
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {requestedEvents.map(ev => (
                  <button key={ev.id} onClick={() => setPendingDialog(ev)}
                    className="w-44 shrink-0 rounded-xl overflow-hidden bg-card border border-amber-500/30 text-left hover:ring-2 hover:ring-amber-500/40 transition-all">
                    <div className="h-24 bg-secondary relative">
                      {ev.cover_image_url
                        ? <img src={ev.cover_image_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Calendar className="w-6 h-6 text-muted-foreground/30" /></div>}
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-white">
                        <Clock className="w-2.5 h-2.5" /> {t("hub.pending_approval", "Pending approval")}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-foreground line-clamp-2">{ev.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {(ev as any).__authorized ? t("hub.card_authorized", "Card authorized — not charged") : formatEventDate(ev.start_date, ev.end_date, ev.is_evergreen)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {perspective === "attending" && savedEvents.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-primary" /> {t("hub.saved", "Saved")}
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {savedEvents.map(ev => (
                  <button key={ev.id} onClick={() => navigate(`/events/e/${ev.id}`)}
                    className="w-40 shrink-0 rounded-xl overflow-hidden bg-card border border-border text-left hover:ring-2 hover:ring-primary/40 transition-all">
                    <div className="h-24 bg-secondary">
                      {ev.cover_image_url
                        ? <img src={ev.cover_image_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Calendar className="w-6 h-6 text-muted-foreground/30" /></div>}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-foreground line-clamp-2">{ev.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatEventDate(ev.start_date, ev.end_date, ev.is_evergreen)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="col-span-full p-12 rounded-2xl text-center bg-secondary/50 border border-border">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t("hub.events.empty_title")}</h3>
                  <p className="text-sm text-muted-foreground">{t("hub.events.empty_desc")}</p>
                  {perspective === "hosting" && (
                    <button onClick={() => setShowCreateForm(true)}
                      className="mt-4 px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all">
                      <Plus className="w-4 h-4 inline mr-1" /> Create Your First Event
                    </button>
                  )}
                </motion.div>
              ) : (
                filtered.map((event, i) => {
                  const badge = getStatusBadge(event);
                  return (
                    <motion.div key={event.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        if (perspective === "hosting") {
                          // Draft events can't be shown live — tell the host and take them
                          // straight to the manage page where they can hit "Preview".
                          if (event.status === "draft") {
                            setDraftPreviewPrompt({ id: event.id, title: event.title });
                            return;
                          }
                          // Live event → open the public page in a new tab so the host
                          // always lands on the event (not their own dashboard) regardless
                          // of session/impersonation state.
                          const path = `/events/e/${event.id}`;
                          // Full base-aware URL so a new tab lands on THIS app's
                          // event page (/oneevents-preview/...) — not the root
                          // domain, which renders the One World Labs hub instead.
                          const fullUrl = window.location.origin + `/events/e/${event.id}`;
                          try {
                            const w = window.open(fullUrl, "_blank", "noopener");
                            if (!w) navigate(path, { state: { ...eventDetailState } });
                          } catch {
                            navigate(path, { state: { ...eventDetailState } });
                          }
                        } else {
                          navigate(`/events/ticket/${event.id}`, { state: eventDetailState });
                        }
                      }}
                      title={perspective === "hosting" ? "View Live" : undefined}
                      className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] bg-card border border-border shadow-card shadow-sm">
                      {/* Big-block photo with details overlaid on a bottom dark
                          gradient (Lee, Jul 22). Host controls stay below. */}
                      <div className="relative" style={{ aspectRatio: "4/5" }}>
                        {event.cover_image_url ? (
                          <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Calendar className="w-12 h-12 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{ background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </div>
                        {formatPrice(event.ticket_type, event.ticket_price, event.currency) !== "Free" && (
                          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-2xl text-xs font-bold bg-background/80 text-foreground backdrop-blur-sm">
                            {formatPrice(event.ticket_type, event.ticket_price, event.currency)}
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                          <h3 className="line-clamp-2 text-base font-bold leading-tight" style={{ textShadow: "0 1px 6px rgba(0,0,0,.55)" }}>{event.title}</h3>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/90">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-brand-light" /> {formatEventDate(event.start_date, event.end_date, event.is_evergreen)}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/90">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-brand-light" /> {event.location || event.venue_name || "Location TBD"}
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="space-y-1.5">
                          {perspective === "attending" && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/events/ticket/${event.id}`, { state: eventDetailState });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all"
                              >
                                <Ticket className="w-3 h-3" /> View Ticket
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/events/e/${event.id}`, { state: { ...eventDetailState, viewAsVisitor: true } });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                              >
                                <Eye className="w-3 h-3" /> View Live
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleCalendarAction(event);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                              >
                                <Calendar className="w-3 h-3" /> {isEventInCalendar(event.id) ? "View in Calendar" : "Add to Calendar"}
                              </button>
                            </div>
                          )}
                          {perspective === "hosting" && (
                            <>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                                <span className="text-xs text-muted-foreground">
                                  <Users className="w-3 h-3 inline mr-1" />{event.attendee_count} {t("hub.events.attendees")}
                                </span>
                                <span className="text-xs font-semibold text-primary">
                                  {event.revenue == null ? "—" : `${currencySymbol(event.currency)}${Number(event.revenue).toFixed(2)}`}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/events/events/${event.id}/manage`); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all"
                                >
                                  <Settings className="w-3 h-3" /> Manage
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEvent(event);
                                    setShowCreateForm(true);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDuplicateEvent(event); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                                >
                                  <Copy className="w-3 h-3" /> Duplicate
                                </button>
                                {(event.status === "published" || event.status === "draft") && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleEventStatus(event); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                                  >
                                    {event.status === "published"
                                      ? (<><EyeOff className="w-3 h-3" /> Unpublish</>)
                                      : (<><Eye className="w-3 h-3" /> Publish</>)}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleCalendarAction(event);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                                >
                                  <Calendar className="w-3 h-3" /> {isEventInCalendar(event.id) ? "View in Calendar" : "Add to Calendar"}
                                </button>
                                {confirmDeleteId === event.id ? (
                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <span className="text-xs text-destructive font-medium">Delete?</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                      disabled={deletingId === event.id}
                                      className="px-2.5 py-1 rounded-2xl text-xs font-semibold bg-destructive text-destructive-foreground hover:opacity-90 transition-all disabled:opacity-50"
                                    >
                                      {deletingId === event.id ? "…" : "Yes"}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                      className="px-2.5 py-1 rounded-2xl text-xs font-semibold bg-secondary text-foreground border border-border"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(event.id); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                                  >
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
          </>
        ))}

        {/* Blast Modal */}
        {blastEvent && (
          <HostRolodexBlast
            hostId={user!.id}
            contacts={rolodexContacts}
            event={{ id: blastEvent.id, title: blastEvent.title, start_date: blastEvent.start_date, location: blastEvent.location }}
            onClose={() => setBlastEvent(null)}
            onSent={fetchRolodex}
          />
        )}

        {/* Bulk Blast Modal — pre-filtered to selected contacts */}
        {bulkBlastEvent && (
          <HostRolodexBlast
            hostId={user!.id}
            contacts={rolodexContacts.filter(c => selectedRolodex.has(c.rolodex_id))}
            event={{ id: bulkBlastEvent.id, title: bulkBlastEvent.title, start_date: bulkBlastEvent.start_date, location: bulkBlastEvent.location }}
            onClose={() => setBulkBlastEvent(null)}
            onSent={() => { setBulkBlastEvent(null); setSelectedRolodex(new Set()); fetchRolodex(); }}
          />
        )}

        {openRolodex && (
          <RolodexContactDrawer
            rolodexId={openRolodex.id}
            contactName={openRolodex.name}
            onClose={() => { setOpenRolodex(null); fetchRolodex(); }}
          />
        )}

        {showCsvImport && (
          <RolodexCsvImport onClose={() => setShowCsvImport(false)} onImported={fetchRolodex} />
        )}

        {/* v18 (Lee, 18 Aug): the bottom VAIA tip card is GONE — "she doesn't even need
            to be down there at the bottom… VAIA normally is active at the top right." The
            live VAIA entry point stays where it belongs, in the header insights button. */}
      </div>

      <AlertDialog open={!!draftPreviewPrompt} onOpenChange={(open) => !open && setDraftPreviewPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This event is still a draft</AlertDialogTitle>
            <AlertDialogDescription>
              {draftPreviewPrompt?.title ? `"${draftPreviewPrompt.title}" hasn't been published yet, ` : "This event hasn't been published yet, "}
              so it can't be viewed in live mode. You can open it in preview to see exactly how it will look once it goes live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!draftPreviewPrompt) return;
                const id = draftPreviewPrompt.id;
                const ev = hostedEvents.find(e => e.id === id);
                setDraftPreviewPrompt(null);
                if (ev) {
                  setEditingEvent(ev);
                  setAutoPreviewOnOpen(true);
                  setPerspective("hosting");
                  setShowCreateForm(true);
                }
              }}
            >
              Show in preview mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* v28 EN (Lee): the pending-ticket story. "Your ticket is pending review from the
          event host" — with a straight line to message the host, and the event itself. */}
      {pendingDialog && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setPendingDialog(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15">
                  <Clock className="h-5 w-5 text-amber-500" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{t("hub.pending_dlg_title", "Ticket pending")}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{pendingDialog.title}</p>
                </div>
              </div>
              <button onClick={() => setPendingDialog(null)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary border border-border text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {pendingDialog.__authorized
                ? t("hub.pending_dlg_body_auth", "Your card is authorized — a hold, not a charge. The host is reviewing your request; the moment they approve, the card is charged and your ticket lands right here. If they don't, the hold is released automatically.")
                : t("hub.pending_dlg_body", "Your request is with the host — they review it and your ticket lands right here the moment they approve. We'll also let you know by email and in the app.")}
            </p>
            <div className="mt-5 space-y-2">
              <button
                disabled={contactingHost}
                onClick={async () => {
                  if (!user?.id || !pendingDialog.host_id || contactingHost) return;
                  setContactingHost(true);
                  try {
                    const { data: convos } = await supabase
                      .from("conversations").select("id")
                      .contains("participant_ids", [user.id, pendingDialog.host_id]).limit(1);
                    if (convos && convos.length > 0) {
                      navigate(`/events/messages/${convos[0].id}`);
                    } else {
                      const { data: newConvo, error } = await supabase
                        .from("conversations")
                        .insert({
                          participant_ids: [user.id, pendingDialog.host_id],
                          category: "professionals",
                          metadata: { source: "pending_ticket", event_id: pendingDialog.id, event_title: pendingDialog.title },
                        })
                        .select("id").single();
                      if (error) throw error;
                      navigate(`/events/messages/${newConvo.id}`);
                    }
                  } catch {
                    navigate(`/events/e/${pendingDialog.id}`);
                  } finally {
                    setContactingHost(false);
                  }
                }}
                className="ow-btn-espresso flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" /> {t("hub.contact_host", "Contact the event host")}
              </button>
              <button
                onClick={() => { const id = pendingDialog.id; setPendingDialog(null); navigate(`/events/e/${id}`); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground"
              >
                {t("hub.view_event", "View the event")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
