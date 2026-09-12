import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Clock3, Eye, Mail, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@evt/integrations/supabase/client";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { Switch } from "@evt/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@evt/components/ui/dialog";
import { buildCleanEventLink } from "@evt/lib/eventShortLinks";

interface EventReminderSettingsProps {
  eventId: string;
  hostId: string;
  event?: {
    title?: string | null;
    start_date?: string | null;
    location?: string | null;
  } | null;
}

interface ReminderSettings {
  remind3d: boolean;
  remind24h: boolean;
  remind2h: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  remind3d: true,
  remind24h: true,
  remind2h: true,
  inAppEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  whatsappEnabled: false,
};

/**
 * Host controls for the reminder schedule already consumed by the
 * send-event-reminders job. A missing row intentionally means both reminders
 * are on, matching the job's existing defaults.
 */
export default function EventReminderSettings({ eventId, hostId, event }: EventReminderSettingsProps) {
  const { t, locale } = useLanguage();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("event_reminder_settings")
        .select("remind_3d, remind_24h, remind_2h, in_app_enabled, email_enabled, sms_enabled, whatsapp_enabled")
        .eq("event_id", eventId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        toast.error(t("reminders.load_error", "Reminder settings could not be loaded."));
      } else if (data) {
        setSettings({
          remind3d: data.remind_3d !== false,
          remind24h: data.remind_24h !== false,
          remind2h: data.remind_2h !== false,
          inAppEnabled: data.in_app_enabled !== false,
          emailEnabled: data.email_enabled !== false,
          smsEnabled: data.sms_enabled === true,
          whatsappEnabled: data.whatsapp_enabled === true,
        });
      }
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  // `t` is intentionally not a dependency: the legacy language adapter returns
  // a new function each render, which would otherwise refetch this row forever.
  }, [eventId]);

  const save = useCallback(async (next: ReminderSettings) => {
    const previous = settings;
    setSettings(next);
    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from("event_reminder_settings")
      .upsert({
        event_id: eventId,
        host_id: hostId,
        remind_3d: next.remind3d,
        remind_24h: next.remind24h,
        remind_2h: next.remind2h,
        in_app_enabled: next.inAppEnabled,
        email_enabled: next.emailEnabled,
        sms_enabled: next.smsEnabled,
        whatsapp_enabled: next.whatsappEnabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: "event_id" });

    if (error) {
      setSettings(previous);
      toast.error(t("reminders.save_error", "Reminder settings were not saved. Try again."));
    } else {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    }
    setSaving(false);
  }, [eventId, hostId, settings, t]);

  const rows = [
    {
      id: "event-reminder-3d",
      checked: settings.remind3d,
      title: t("reminders.3d_title", "3 days before"),
      body: t("reminders.3d_body", "Give attendees an early heads-up while plans are still easy to adjust."),
      toggle: (checked: boolean) => void save({ ...settings, remind3d: checked }),
    },
    {
      id: "event-reminder-24h",
      checked: settings.remind24h,
      title: t("reminders.24h_title", "24 hours before"),
      body: t("reminders.24h_body", "Give attendees time to plan their trip and review event details."),
      toggle: (checked: boolean) => void save({ ...settings, remind24h: checked }),
    },
    {
      id: "event-reminder-2h",
      checked: settings.remind2h,
      title: t("reminders.2h_title", "2 hours before"),
      body: t("reminders.2h_body", "Send a useful final reminder before attendees should be on their way."),
      toggle: (checked: boolean) => void save({ ...settings, remind2h: checked }),
    },
  ];

  const eventDate = event?.start_date ? new Date(event.start_date) : null;
  const previewTitle = event?.title?.trim() || t("reminders.event_untitled", "Untitled event");
  const previewDate = eventDate && !Number.isNaN(eventDate.getTime())
    ? eventDate.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })
    : t("reminders.date_tbd", "Date TBD");
  const previewTime = eventDate && !Number.isNaN(eventDate.getTime())
    ? eventDate.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : t("reminders.time_tbd", "Time TBD");
  const previewLocation = event?.location?.trim() || t("reminders.event_location", "Event location");
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(previewLocation)}`;
  const eventUrl = buildCleanEventLink(eventId);

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="event-reminders-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="event-reminders-title" className="text-base font-bold text-foreground">
              {t("reminders.title", "Event reminders")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("reminders.description", "Choose when and where registered attendees receive reminders. Changes save automatically.")}
            </p>
          </div>
        </div>
        <span className="flex h-5 min-w-12 items-center justify-end text-[11px] font-semibold text-teal" aria-live="polite">
          {saved && <><Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{t("reminders.saved", "Saved")}</>}
        </span>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-background">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-3.5">
            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label htmlFor={row.id} className="min-w-0 flex-1 cursor-pointer">
              <span className="block text-sm font-semibold text-foreground">{row.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{row.body}</span>
            </label>
            <Switch
              id={row.id}
              checked={row.checked}
              onCheckedChange={row.toggle}
              disabled={loading || saving}
            />
          </div>
        ))}
      </div>

      <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("reminders.channels", "Delivery channels")}
      </h3>
      <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-background">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <BellRing className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="event-reminder-in-app" className="min-w-0 flex-1 cursor-pointer">
            <span className="block text-sm font-semibold text-foreground">{t("reminders.in_app", "OneEvent notification")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t("reminders.in_app_body", "Show the reminder inside OneEvent.")}</span>
          </label>
          <Switch id="event-reminder-in-app" checked={settings.inAppEnabled} onCheckedChange={(checked) => void save({ ...settings, inAppEnabled: checked })} disabled={loading || saving} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="event-reminder-email" className="min-w-0 flex-1 cursor-pointer">
            <span className="block text-sm font-semibold text-foreground">{t("reminders.email", "Email")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t("reminders.email_body", "Send a branded OneEvent reminder to the attendee's account email.")}</span>
          </label>
          <Switch id="event-reminder-email" checked={settings.emailEnabled} onCheckedChange={(checked) => void save({ ...settings, emailEnabled: checked })} disabled={loading || saving} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="event-reminder-whatsapp" className="min-w-0 flex-1 cursor-pointer">
            <span className="block text-sm font-semibold text-foreground">{t("reminders.whatsapp", "WhatsApp")}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t("reminders.whatsapp_body", "Send reminders to opted-in attendees when the reminder type is eligible for WhatsApp delivery.")}</span>
          </label>
          <Switch id="event-reminder-whatsapp" checked={settings.whatsappEnabled} onCheckedChange={(checked) => void save({ ...settings, whatsappEnabled: checked })} disabled={loading || saving} />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 opacity-60">
          <div>
            <span className="block text-sm font-semibold text-foreground">{t("reminders.sms", "SMS")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t("reminders.sms_a2p_body", "SMS broadcast invitations are active; scheduled SMS reminders are not yet available in this panel.")}</span>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("reminders.a2p_required", "Not yet available")}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("reminders.channel_note", "WhatsApp reminders work for eligible opted-in attendees. For broadcast invitations, select SMS and WhatsApp together for the broadest mobile coverage and automatic fallback.")}
        </p>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-primary/30 bg-background px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 sm:w-auto"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {t("reminders.preview", "Preview reminder")}
        </button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent closeLabel={t("reminders.close", "Close")} className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl p-0">
          <DialogHeader className="border-b border-border px-5 pb-4 pr-12 pt-5 text-left">
            <DialogTitle>{t("reminders.preview_title", "WhatsApp reminder preview")}</DialogTitle>
            <DialogDescription>{t("reminders.preview_description", "Each attendee sees their own name. The links open the map and event page.")}</DialogDescription>
          </DialogHeader>
          <div className="bg-[#efeae2] p-4">
            <div className="ml-auto max-w-[94%] rounded-2xl rounded-tr-sm bg-white p-4 text-[13px] leading-relaxed text-slate-900 shadow-sm">
              <p>{t("reminders.preview_greeting", "Hi Lee,")}</p>
              <p className="mt-3">{t("reminders.preview_intro", "This is your OneEvent reminder for")} <strong>{previewTitle}</strong>.</p>
              <div className="mt-3 space-y-1">
                <p><strong>{t("reminders.preview_date", "Date:")}</strong> {previewDate}</p>
                <p><strong>{t("reminders.preview_time", "Time:")}</strong> {previewTime}</p>
                <p><strong>{t("reminders.preview_location", "Location:")}</strong> {previewLocation}</p>
              </div>
              <p className="mt-3 flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <a className="break-all font-semibold text-[#027eb5] underline" href={directionsUrl} target="_blank" rel="noreferrer">{t("reminders.preview_directions", "Get directions")}</a>
              </p>
              <p className="mt-3">{t("reminders.preview_details", "Event details and ticket:")}</p>
              <a className="block break-all font-semibold text-[#027eb5] underline" href={eventUrl} target="_blank" rel="noreferrer">{eventUrl}</a>
              <p className="mt-3">{t("reminders.preview_review", "Please review the event details before you leave.")}</p>
              <p className="mt-3">{t("reminders.preview_looking_forward", "We look forward to seeing you there.")}</p>
              <p className="mt-3">{t("reminders.preview_stop", "Reply STOP to opt out.")}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

