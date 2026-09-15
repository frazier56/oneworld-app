import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Mail, RefreshCw, Search, Send, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@evt/components/ui/dialog";
import { supabase } from "@evt/integrations/supabase/client";
import { cn } from "@evt/lib/utils";
import { useLanguage, useMicro } from "@evt/i18n/LanguageContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTimeZone?: string | null;
}

interface BroadcastRow {
  id: string;
  created_at: string;
  status?: string | null;
  channels?: string[] | null;
  metadata?: Record<string, unknown> | null;
  recipient_count?: number | null;
  sent_count?: number | null;
  queued_count?: number | null;
  skipped_count?: number | null;
  failed_count?: number | null;
  whatsapp_pending_count?: number | null;
}

interface ProviderStats {
  attempted?: number;
  accepted?: number;
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
  blocked?: number;
  failed?: number;
  deferred?: number;
  waiting?: number;
  unconfirmed?: number;
  last_event_at?: string | null;
}

interface ProviderRecipient {
  id: string;
  rolodex_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  destination?: string | null;
  status?: string | null;
  channel?: TrackingChannel | null;
  contact_phone?: string | null;
  provider_status?: string | null;
  provider_status_at?: string | null;
  provider_error_code?: string | null;
  provider_message_id?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  bounced_at?: string | null;
  blocked_at?: string | null;
  deferred_at?: string | null;
  undelivered_at?: string | null;
  error_message?: string | null;
}

type TrackingChannel = "email" | "sms" | "whatsapp";
type Drilldown = "tried" | "queued" | "delivered" | "opened" | "clicked" | "bounced" | "blocked" | "failed";

const trackingChannelLabels: Record<TrackingChannel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

const drilldownLabels: Record<Drilldown, string> = {
  tried: "Tried",
  queued: "Queued",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  blocked: "Blocked",
  failed: "Failed",
};

const statValue = (stats: ProviderStats | null, key: keyof ProviderStats) => {
  const value = stats?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const normalizeGmtOffset = (value?: string) => {
  if (!value) return "";
  return value
    .replace(/^GMT/, "UTC")
    .replace("UTC-05:00", "UTC-5")
    .replace("UTC-06:00", "UTC-6")
    .replace("UTC-04:00", "UTC-4");
};

const timeZoneLabel = (date: Date, timeZone?: string | null, locale = "en-US") => {
  if (!timeZone) return "";
  if (timeZone === "America/Bogota") return "COT (UTC-5)";
  let shortName = "";
  let offsetName = "";
  try {
    shortName = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
  try {
    offsetName = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    offsetName = "";
  }
  const normalizedOffset = normalizeGmtOffset(offsetName);
  if (shortName && normalizedOffset && shortName !== normalizedOffset) return `${shortName} (${normalizedOffset})`;
  return shortName || normalizedOffset;
};

const formatDateTime = (value?: string | null, timeZone?: string | null, includeDate = true, locale = "en-US") => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  if (includeDate) {
    options.month = "short";
    options.day = "numeric";
    options.year = "numeric";
  }
  if (timeZone) options.timeZone = timeZone;
  const formatted = new Intl.DateTimeFormat(locale, options).format(date);
  const zone = timeZoneLabel(date, timeZone, locale);
  return zone ? `${formatted} ${zone}` : formatted;
};

const formatProviderDateTime = (value?: string | null, timeZone?: string | null, includeDate = true, locale = "en-US") =>
  formatDateTime(value, timeZone, includeDate, locale);

const formatCompactProviderDateTime = (value?: string | null, timeZone?: string | null, locale = "en-US") => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const dateParts = new Intl.DateTimeFormat(locale, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      timeZone: timeZone || undefined,
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      dateParts.find((item) => item.type === type)?.value ?? "";
    const compactDate = locale === "en-US"
      ? `${part("month")}-${part("day")}-${part("year")}`
      : new Intl.DateTimeFormat(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: timeZone || undefined,
        }).format(date);
    const time = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: timeZone || undefined,
    }).format(date);
    const zone = timeZoneLabel(date, timeZone, locale);
    return `${compactDate} ${time}${zone ? ` ${zone}` : ""}`;
  } catch {
    return formatProviderDateTime(value, undefined, true, locale);
  }
};

const recipientMatches = (recipient: ProviderRecipient, bucket: Drilldown) => {
  if (bucket === "tried") return true;
  if (bucket === "queued") {
    const resolved = Boolean(
      recipient.delivered_at || recipient.opened_at || recipient.clicked_at ||
      recipient.bounced_at || recipient.blocked_at || recipient.undelivered_at || recipient.error_message,
    );
    return !resolved && (recipient.status === "queued" || Boolean(recipient.deferred_at));
  }
  if (bucket === "delivered") {
    const terminalFailure = recipient.status === "failed" || recipient.provider_status === "undelivered" || Boolean(recipient.undelivered_at);
    return !terminalFailure && Boolean(recipient.delivered_at || recipient.opened_at || recipient.clicked_at);
  }
  if (bucket === "opened") return Boolean(recipient.opened_at);
  if (bucket === "clicked") return Boolean(recipient.clicked_at);
  if (bucket === "bounced") return Boolean(recipient.bounced_at);
  if (bucket === "blocked") return Boolean(recipient.blocked_at);
  if (bucket === "failed") return recipient.status === "failed" || recipient.provider_status === "undelivered" || Boolean(recipient.undelivered_at) || Boolean(recipient.error_message && !recipient.bounced_at && !recipient.blocked_at && !recipient.deferred_at);
  return false;
};

const recipientTime = (recipient: ProviderRecipient, bucket: Drilldown, timeZone?: string | null, locale = "en-US") => {
  const value =
    bucket === "tried" ? recipient.sent_at || recipient.delivered_at || recipient.opened_at || recipient.clicked_at || recipient.bounced_at || recipient.blocked_at || recipient.deferred_at :
    bucket === "queued" ? recipient.deferred_at || recipient.sent_at :
    bucket === "delivered" ? recipient.delivered_at || recipient.opened_at || recipient.clicked_at || recipient.sent_at :
    bucket === "opened" ? recipient.opened_at :
    bucket === "clicked" ? recipient.clicked_at :
    bucket === "bounced" ? recipient.bounced_at :
    bucket === "blocked" ? recipient.blocked_at :
    recipient.undelivered_at || recipient.provider_status_at || recipient.bounced_at || recipient.blocked_at || recipient.deferred_at || recipient.sent_at;
  return formatCompactProviderDateTime(value, timeZone, locale);
};

const matchesTrackingSearch = (recipient: ProviderRecipient, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    recipient.contact_name,
    recipient.contact_email,
    recipient.contact_phone,
    recipient.destination,
  ].some((value) => (value || "").toLowerCase().includes(needle));
};

const readableReason = (reason?: string | null) =>
  reason && !/invited you to/i.test(reason)
    ? reason.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "";

const EMAIL_SUPPRESSION_TAG = "do_not_email";

const broadcastTypeLabel = (broadcast: BroadcastRow | null | undefined, m: (en: string) => string) => {
  if (!broadcast) return m("Broadcast invite");
  if (broadcast.metadata?.broadcast_kind === "invite_followup") {
    const reminder = typeof broadcast.metadata.reminder_label === "string" ? broadcast.metadata.reminder_label : "scheduled";
    const relativeDayMatch = reminder.trim().match(/^(\d+)\s+days?\s+away$/i);
    const reminderLabel = relativeDayMatch
      ? m(Number(relativeDayMatch[1]) === 1 ? "{count} day away" : "{count} days away")
          .replace("{count}", relativeDayMatch[1])
      : m(reminder);
    return `${m("Follow-up")} · ${reminderLabel}`;
  }
  return m("Initial invite");
};

export default function EventBroadcastHistoryDialog({ open, onOpenChange, eventId, eventTimeZone }: Props) {
  const { locale } = useLanguage();
  const m = useMicro();
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [loadedTrackingId, setLoadedTrackingId] = useState<string | null>(null);
  const [trackingErrorId, setTrackingErrorId] = useState<string | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  const [providerRecipients, setProviderRecipients] = useState<ProviderRecipient[]>([]);
  const [trackingChannel, setTrackingChannel] = useState<TrackingChannel>("email");
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [trackingSearch, setTrackingSearch] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(new Set());
  const [taggingRecipients, setTaggingRecipients] = useState(false);
  const [suppressConfirmOpen, setSuppressConfirmOpen] = useState(false);
  const trackingControlsRef = useRef<HTMLFormElement | null>(null);
  const trackingRequestRef = useRef(0);

  const selectedBroadcast = useMemo(
    () => broadcasts.find((broadcast) => broadcast.id === selectedId) || null,
    [broadcasts, selectedId],
  );
  const availableTrackingChannels = useMemo(() => {
    const channels = (selectedBroadcast?.channels || []).filter(
      (channel): channel is TrackingChannel => channel === "email" || channel === "sms" || channel === "whatsapp",
    );
    return channels.length ? channels : ["email" as TrackingChannel];
  }, [selectedBroadcast?.channels]);

  const selectedBroadcastLabel = selectedBroadcast
    ? `${formatDateTime(selectedBroadcast.created_at, eventTimeZone, true, locale)} - ${selectedBroadcast.recipient_count || 0} ${m(selectedBroadcast.recipient_count === 1 ? "contact" : "contacts")}`
    : m("Select a broadcast");

  const channelLabel = (channels?: string[] | null) =>
    (channels || [])
      .map((channel) => m(trackingChannelLabels[channel as TrackingChannel] || channel.replace(/_/g, "-")))
      .join(", ");

  const loadBroadcasts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_rolodex_broadcasts" as any)
      .select("id, created_at, status, channels, metadata, recipient_count, sent_count, queued_count, skipped_count, failed_count, whatsapp_pending_count")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(20);
    setLoading(false);
    if (error) {
      toast.error(m("Unable to load broadcast history."));
      return;
    }
    const rows = ((data || []) as BroadcastRow[]).filter((row) => row.metadata?.host_visible !== false);
    setBroadcasts(rows);
    const nextSelected = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id || null;
    setSelectedId(nextSelected);
  };

  const loadTracking = async (broadcastId: string, channel: TrackingChannel = trackingChannel) => {
    const requestId = ++trackingRequestRef.current;
    setTrackingLoading(true);
    setTrackingErrorId(null);
    setProviderStats(null);
    setProviderRecipients([]);
    setUpdatedAt(null);
    setDrilldown(null);
    try {
      const { data, error } = await supabase.functions.invoke("event-rolodex-broadcast-stats", {
        body: { broadcastId, channel },
      });
      if (requestId !== trackingRequestRef.current) return;
      if (error || (data as any)?.error) {
        setTrackingErrorId(broadcastId);
        toast.error((data as any)?.error || m("Unable to refresh broadcast tracking."));
        return;
      }
      setProviderStats(((data as any)?.provider_stats || {}) as ProviderStats);
      const recipientKey = `${channel}_recipients`;
      setProviderRecipients(((data as any)?.[recipientKey] || []) as ProviderRecipient[]);
      setLoadedTrackingId(`${broadcastId}:${channel}`);
      setUpdatedAt(new Date().toISOString());
    } finally {
      if (requestId === trackingRequestRef.current) setTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (open) void loadBroadcasts();
    if (!open) {
      trackingRequestRef.current += 1;
      setTrackingLoading(false);
      setLoadedTrackingId(null);
      setTrackingErrorId(null);
      setDrilldown(null);
      setProviderStats(null);
      setProviderRecipients([]);
      setUpdatedAt(null);
      setHistoryOpen(false);
      setTrackingSearch("");
      setTrackingChannel("email");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId]);

  useEffect(() => {
    if (open && selectedId) {
      const nextChannel = availableTrackingChannels.includes(trackingChannel)
        ? trackingChannel
        : availableTrackingChannels[0];
      setTrackingChannel(nextChannel);
      setDrilldown(null);
      void loadTracking(selectedId, nextChannel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId, availableTrackingChannels]);

  const filteredProviderRecipients = useMemo(
    () => providerRecipients.filter((recipient) => matchesTrackingSearch(recipient, trackingSearch)),
    [providerRecipients, trackingSearch],
  );

  const searchActive = trackingSearch.trim().length > 0;
  const trackingUnavailable = Boolean(selectedId && trackingErrorId === selectedId);
  const trackingPending = Boolean(
    selectedId && !trackingUnavailable && (trackingLoading || loadedTrackingId !== `${selectedId}:${trackingChannel}`),
  );

  const attemptedCount = useMemo(() => {
    if (searchActive) return filteredProviderRecipients.length;
    return (
      statValue(providerStats, "attempted") ||
      statValue(providerStats, "accepted") ||
      statValue(providerStats, "sent") ||
      providerRecipients.length ||
      (trackingChannel === "email" ? selectedBroadcast?.recipient_count : 0) ||
      0
    );
  }, [filteredProviderRecipients.length, providerRecipients.length, providerStats, searchActive, selectedBroadcast?.recipient_count, trackingChannel]);

  const bucketCounts = useMemo(() => {
    const rows = searchActive ? filteredProviderRecipients : providerRecipients;
    const rowCount = (bucket: Drilldown) => rows.filter((recipient) => recipientMatches(recipient, bucket)).length;
    const opened = searchActive ? rowCount("opened") : Math.max(statValue(providerStats, "opened"), rowCount("opened"));
    const clicked = searchActive ? rowCount("clicked") : Math.max(statValue(providerStats, "clicked"), rowCount("clicked"));
    const delivered = searchActive ? rowCount("delivered") : Math.max(statValue(providerStats, "delivered"), rowCount("delivered"), opened);
    const queued = searchActive ? rowCount("queued") : Math.max(statValue(providerStats, "waiting"), rowCount("queued"));
    const bounced = searchActive ? rowCount("bounced") : Math.max(statValue(providerStats, "bounced"), rowCount("bounced"));
    const blocked = searchActive ? rowCount("blocked") : Math.max(statValue(providerStats, "blocked"), rowCount("blocked"));
    const failed = searchActive ? rowCount("failed") : Math.max(statValue(providerStats, "failed"), rowCount("failed"));
    return { queued, delivered, opened, clicked, bounced, blocked, failed };
  }, [filteredProviderRecipients, providerRecipients, providerStats, searchActive]);

  const deliverySuccessRate = attemptedCount > 0
    ? Math.round((bucketCounts.delivered / attemptedCount) * 100)
    : null;
  const trackingMetrics = useMemo(() => {
    const base: Array<{ key: Drilldown; label: string; value: number }> = [
      { key: "tried", label: m("Tried"), value: attemptedCount },
      { key: "delivered", label: m("Delivered"), value: bucketCounts.delivered },
      { key: "clicked", label: m("Clicked"), value: bucketCounts.clicked },
      { key: "queued", label: m("Queued"), value: bucketCounts.queued },
      { key: "failed", label: m(trackingChannel === "email" ? "Failed" : "Undelivered"), value: bucketCounts.failed },
    ];
    if (trackingChannel === "email") {
      base.splice(2, 0, { key: "opened", label: m("Opened"), value: bucketCounts.opened });
      base.splice(5, 0,
        { key: "bounced", label: m("Bounced"), value: bucketCounts.bounced },
        { key: "blocked", label: m("Blocked"), value: bucketCounts.blocked },
      );
    } else if (trackingChannel === "whatsapp") {
      base.splice(2, 0, { key: "opened", label: m("Read"), value: bucketCounts.opened });
    }
    return base;
  }, [attemptedCount, bucketCounts, m, trackingChannel]);

  const drilldownRows = useMemo(
    () => drilldown ? filteredProviderRecipients.filter((recipient) => recipientMatches(recipient, drilldown)) : [],
    [drilldown, filteredProviderRecipients],
  );

  const visibleRecipientRows = drilldown ? drilldownRows : searchActive ? filteredProviderRecipients : [];
  const visibleRecipientLabel = drilldown
    ? m(drilldown === "opened" && trackingChannel === "whatsapp" ? "Read" : drilldownLabels[drilldown])
    : m("Search results");

  useEffect(() => {
    setSelectedRecipientIds(new Set());
  }, [drilldown, selectedId, trackingSearch]);

  useEffect(() => {
    if (!drilldown && !searchActive) return;
    window.setTimeout(() => {
      trackingControlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [drilldown, searchActive]);

  const selectableDrilldownRows = useMemo(
    () => trackingChannel === "email" ? visibleRecipientRows.filter((recipient) => Boolean(recipient.rolodex_id)) : [],
    [trackingChannel, visibleRecipientRows],
  );

  const selectedDrilldownRows = useMemo(
    () => selectableDrilldownRows.filter((recipient) => selectedRecipientIds.has(recipient.id)),
    [selectableDrilldownRows, selectedRecipientIds],
  );
  const selectedRolodexIds = useMemo(
    () => Array.from(new Set(selectedDrilldownRows.map((recipient) => recipient.rolodex_id).filter(Boolean))) as string[],
    [selectedDrilldownRows],
  );

  const toggleRecipientSelection = (recipientId: string) => {
    setSelectedRecipientIds((current) => {
      const next = new Set(current);
      if (next.has(recipientId)) next.delete(recipientId);
      else next.add(recipientId);
      return next;
    });
  };

  const toggleSelectAllDrilldownRows = () => {
    setSelectedRecipientIds((current) => {
      const allSelected = selectableDrilldownRows.every((recipient) => current.has(recipient.id));
      if (allSelected) return new Set();
      return new Set(selectableDrilldownRows.map((recipient) => recipient.id));
    });
  };

  const requestSuppressSelectedEmailRecipients = () => {
    if (selectedRolodexIds.length > 0) setSuppressConfirmOpen(true);
  };

  const suppressSelectedEmailRecipients = async () => {
    const rolodexIds = selectedRolodexIds;
    if (rolodexIds.length === 0) return;
    setTaggingRecipients(true);
    try {
      const { data, error } = await supabase
        .from("host_rolodex" as any)
        .select("id, tags")
        .in("id", rolodexIds);
      if (error) throw error;
      await Promise.all(((data || []) as Array<{ id: string; tags?: string[] | null }>).map((row) => {
        const nextTags = Array.from(new Set([...(row.tags || []), EMAIL_SUPPRESSION_TAG]));
        return supabase.from("host_rolodex" as any).update({ tags: nextTags }).eq("id", row.id);
      }));
      toast.success(`${rolodexIds.length} ${m(rolodexIds.length === 1 ? "contact tagged: do not email." : "contacts tagged: do not email.")}`);
      setSelectedRecipientIds(new Set());
      setSuppressConfirmOpen(false);
    } catch (error: any) {
      toast.error(error?.message || m("Could not add the do-not-email tag."));
    } finally {
      setTaggingRecipients(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[86dvh] w-[calc(100vw-24px)] max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 [&>button.absolute]:hidden">
        <DialogHeader className="shrink-0 border-b border-primary/10 px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                {m("Broadcast Invites")}
              </DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">{m("Review invite activity and refresh delivery tracking.")}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-border/50 bg-secondary/80 text-foreground transition-colors hover:bg-secondary"
              aria-label={m("Close broadcast history")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-x-hidden overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card/50 p-5 text-sm text-muted-foreground backdrop-blur-xl">
              {m("No broadcasts yet.")}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative min-w-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{m("Broadcast History")}</p>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((value) => !value)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-card/65 px-4 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.35)] backdrop-blur-xl transition-colors hover:border-primary/40"
                  aria-expanded={historyOpen}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-foreground">{selectedBroadcastLabel}</span>
                    {selectedBroadcast && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {broadcastTypeLabel(selectedBroadcast, m)} · {channelLabel(selectedBroadcast.channels) || m(selectedBroadcast.status || "Broadcast invite")}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", historyOpen && "rotate-180")} />
                </button>
                {historyOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-64 overflow-y-auto rounded-2xl border border-primary/20 bg-background/95 p-2 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                    {broadcasts.map((broadcast) => {
                      const active = broadcast.id === selectedId;
                      return (
                        <button
                          key={broadcast.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(broadcast.id);
                            setHistoryOpen(false);
                          }}
                          className={cn(
                            "w-full rounded-xl px-3 py-2 text-left transition-colors",
                            active ? "bg-primary/15 text-foreground" : "hover:bg-primary/10",
                          )}
                        >
                          <span className="block truncate text-sm font-bold">{broadcastTypeLabel(broadcast, m)} · {formatDateTime(broadcast.created_at, eventTimeZone, true, locale)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {broadcast.recipient_count || 0} {m(broadcast.recipient_count === 1 ? "contact processed" : "contacts processed")}
                            {channelLabel(broadcast.channels) ? ` • ${channelLabel(broadcast.channels)}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="min-w-0 rounded-2xl border border-primary/20 bg-card/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.3)] backdrop-blur-xl sm:p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{m(`${trackingChannelLabels[trackingChannel]} delivery tracking`)}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {m("Search for a person or tap any metric to see matching recipients.")}
                    </p>
                    {!trackingPending && !trackingUnavailable && deliverySuccessRate !== null && (
                      <p className="mt-1 text-[11px] font-bold text-primary">
                        {m("Delivery success")} {deliverySuccessRate}% ({bucketCounts.delivered}/{attemptedCount})
                      </p>
                    )}
                    {trackingPending && <p className="mt-1 text-[11px] font-medium text-muted-foreground/80">{m("Refreshing current broadcast…")}</p>}
                    {trackingUnavailable && <p className="mt-1 text-[11px] font-medium text-destructive">{m("Tracking could not be refreshed. Try again.")}</p>}
                    {!trackingPending && !trackingUnavailable && updatedAt && <p className="mt-1 text-[11px] font-medium text-muted-foreground/80">{m("Updated")} {formatDateTime(updatedAt, eventTimeZone, true, locale)}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedId && loadTracking(selectedId, trackingChannel)}
                    disabled={!selectedId || trackingLoading}
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-50",
                      trackingLoading
                        ? "animate-pulse border-red-400/60 bg-red-500/15 text-red-600 shadow-sm shadow-red-500/20"
                        : updatedAt
                          ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20"
                          : "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
                    )}
                    aria-label={m("Refresh broadcast tracking")}
                  >
                    <RefreshCw className={cn("h-4 w-4", trackingLoading && "animate-spin")} />
                  </button>
                </div>

                {availableTrackingChannels.length > 1 && (
                  <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${availableTrackingChannels.length}, minmax(0, 1fr))` }}>
                    {availableTrackingChannels.map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => {
                          setTrackingChannel(channel);
                          setDrilldown(null);
                          setTrackingSearch("");
                          if (selectedId) void loadTracking(selectedId, channel);
                        }}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-xs font-bold transition-colors",
                          trackingChannel === channel
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/40 bg-background/40 text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        {m(trackingChannelLabels[channel])}
                      </button>
                    ))}
                  </div>
                )}

                <form
                  ref={trackingControlsRef}
                  className="mb-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 shadow-sm backdrop-blur"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setDrilldown(null);
                    if (selectedId) void loadTracking(selectedId, trackingChannel);
                  }}
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={trackingSearch}
                    onChange={(event) => {
                      setTrackingSearch(event.target.value);
                      setDrilldown(null);
                    }}
                    placeholder={m(trackingChannel === "email" ? "Search name or email..." : "Search name or phone...")}
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  {trackingSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingSearch("");
                        setDrilldown(null);
                      }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={m("Clear tracking search")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                    aria-label={m("Refresh tracking search")}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>

                <div className="grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-4 sm:gap-2">
                  {trackingMetrics.map(({ key, label, value }) => {
                    const active = drilldown === key;
                    const drillable = !trackingPending && !trackingUnavailable && (Number(value) || 0) > 0;
                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={!drillable}
                        aria-busy={trackingPending}
                        onClick={() => setDrilldown(active ? null : key)}
                        className={cn(
                          "min-w-0 rounded-lg border px-1.5 py-1.5 text-left transition-colors sm:px-3 sm:py-2",
                          active ? "border-primary bg-primary/15" : "border-border/35 bg-background/45",
                          drillable ? "hover:border-primary/50 hover:bg-primary/10" : "cursor-default opacity-70"
                        )}
                      >
                        <p className={cn(
                          "break-words whitespace-normal font-semibold uppercase leading-tight text-muted-foreground sm:text-[10px]",
                          label.length > 9 ? "text-[7px] tracking-[-0.025em]" : "text-[8.5px]",
                        )}>{label}</p>
                        {trackingPending ? (
                          <span className="mt-1 block h-4 w-8 animate-pulse rounded bg-muted-foreground/25 sm:h-5 sm:w-10" />
                        ) : trackingUnavailable ? (
                          <p className="text-base font-bold leading-tight text-muted-foreground sm:text-lg">—</p>
                        ) : (
                          <p className="text-base font-bold leading-tight text-foreground sm:text-lg">{Number(value) || 0}</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {!trackingPending && !trackingUnavailable && (drilldown || searchActive) && (
                  <div className="mt-4 min-w-0 border-t border-border/40 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">{visibleRecipientLabel}{drilldown ? ` ${m("recipients")}` : ""}</p>
                        <p className="text-xs text-muted-foreground">{visibleRecipientRows.length} {m(visibleRecipientRows.length === 1 ? "contact shown" : "contacts shown")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDrilldown(null);
                          if (searchActive) setTrackingSearch("");
                        }}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      >
                        {m("Clear")}
                      </button>
                    </div>
                    {selectableDrilldownRows.length > 0 && (
                      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/35 bg-background/35 p-2 text-xs backdrop-blur">
                        {selectedDrilldownRows.length > 0 && (
                          <p className="w-full rounded-lg bg-primary/5 px-2 py-1.5 text-muted-foreground">
                            {m("Selected contacts will be tagged so they do not receive future email broadcasts. You can remove the tag later from the contact profile.")}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={toggleSelectAllDrilldownRows}
                          className="rounded-lg px-2 py-1 font-semibold text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                        >
                          {m(selectedDrilldownRows.length === selectableDrilldownRows.length ? "Clear selection" : "Select all")}
                        </button>
                        <span className="text-muted-foreground">{selectedDrilldownRows.length} {m("selected")}</span>
                        <button
                          type="button"
                          onClick={requestSuppressSelectedEmailRecipients}
                          disabled={selectedDrilldownRows.length === 0 || taggingRecipients}
                          className="ml-auto rounded-lg bg-primary px-2.5 py-1 font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
                        >
                          {taggingRecipients ? m("Tagging...") : m("Do not email")}
                        </button>
                      </div>
                    )}
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {visibleRecipientRows.length === 0 ? (
                        <p className="rounded-lg border border-border/35 bg-card/45 p-3 text-sm text-muted-foreground">
                          {m("Details are still updating. Refresh again in a moment.")}
                        </p>
                      ) : visibleRecipientRows.map((recipient) => {
                        const name = recipient.contact_name || m("Unknown contact");
                            const detail = recipient.destination || recipient.contact_email || m(trackingChannel === "email" ? "No email shown" : "No phone shown");
                            const reason = readableReason(recipient.error_message || recipient.provider_error_code);
                            const timeBucket = drilldown || "delivered";
                            const statusTrail = ([
                              recipient.delivered_at && m("Delivered"),
                              recipient.opened_at && m(trackingChannel === "whatsapp" ? "Read" : "Opened"),
                              recipient.clicked_at && m("Clicked"),
                              recipient.deferred_at && m("Queued"),
                              recipient.bounced_at && m("Bounced"),
                              recipient.blocked_at && m("Blocked"),
                              (recipient.status === "failed" || recipient.undelivered_at || recipient.error_message) && !recipient.bounced_at && !recipient.blocked_at && !recipient.deferred_at && m(trackingChannel === "email" ? "Failed" : "Undelivered"),
                            ].filter(Boolean) as string[]).join(" / ");
                            return (
                          <div key={recipient.id} className="rounded-lg border border-border/35 bg-background/35 p-3 backdrop-blur">
                            <div className="flex items-start justify-between gap-3">
                              {trackingChannel === "email" && recipient.rolodex_id && (
                                <input
                                  type="checkbox"
                                  checked={selectedRecipientIds.has(recipient.id)}
                                  onChange={() => toggleRecipientSelection(recipient.id)}
                                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                                  aria-label={`${m("Select")} ${name}`}
                                />
                              )}
                              <div className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                                <p className="truncate text-xs text-muted-foreground">{detail}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{m(trackingChannelLabels[trackingChannel])}</span>
                            </div>
                            <div className="mt-2 grid max-w-full gap-1 text-xs text-muted-foreground">
                              {searchActive && !drilldown && statusTrail && <span>{statusTrail}</span>}
                              {recipientTime(recipient, timeBucket, eventTimeZone, locale) && (
                                <span className="block overflow-x-auto whitespace-nowrap text-[10px] tracking-tight sm:text-[11px]">
                                  {recipientTime(recipient, timeBucket, eventTimeZone, locale)}
                                </span>
                              )}
                            </div>
                            {reason && <p className="mt-1 text-xs text-muted-foreground">{m("Reason")}: {reason}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {trackingChannel === "whatsapp" && (
                  <p className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {m("WhatsApp may show when a message is read. Link clicks are tracked.")}
                  </p>
                )}
                {trackingChannel === "sms" && (
                  <p className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {m("SMS shows delivery. It does not show when a text is opened.")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={suppressConfirmOpen} onOpenChange={setSuppressConfirmOpen}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-md rounded-3xl border-border bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>{m("Do not email these contacts?")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {selectedRolodexIds.length} {m(selectedRolodexIds.length === 1 ? "selected contact will no longer receive email broadcasts from this host. The tag can be removed later from the contact profile." : "selected contacts will no longer receive email broadcasts from this host. The tag can be removed later from each contact profile.")}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setSuppressConfirmOpen(false)}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            {m("Cancel")}
          </button>
          <button
            type="button"
            disabled={taggingRecipients || selectedRolodexIds.length === 0}
            onClick={() => void suppressSelectedEmailRecipients()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {taggingRecipients ? m("Applying...") : m("Apply tag")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}


