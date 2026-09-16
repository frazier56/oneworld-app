import { FEE_PCT, VaiaFace } from "@oneworld/shell";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Upload, X, Plus, MapPin, DollarSign,
  Calendar as CalendarIcon, Clock, Ticket, Tag,
  Globe, Eye, Users, FileText, Sparkles, ImageIcon,
  Search, Star, Lock, ArrowUpRight, Link2, AlertCircle, AlertTriangle, Download,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { useIsMobile } from "@evt/hooks/use-mobile";
import { cn } from "@evt/lib/utils";
import { Button } from "@evt/components/ui/button";
import { Input } from "@evt/components/ui/input";
import { Textarea } from "@evt/components/ui/textarea";
import { RichTextEditor, stripRichTextHtml } from "@evt/components/ui/rich-text-editor";
import { Switch } from "@evt/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@evt/components/ui/select";
import { Slider } from "@evt/components/ui/slider";
import { supabase } from "@evt/integrations/supabase/client";
import { useAuth } from "@evt/hooks/useAuth";
import { toast } from "sonner";
import EventPreview from "@evt/components/events/EventPreview";
import InfoTip from "@evt/components/InfoTip";
import { Calendar } from "@evt/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@evt/components/ui/popover";
import { format, parse } from "date-fns";
import { de, enUS, es, ptBR, ru, zhCN } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@evt/components/ui/dialog";
import PlacesInput from "@evt/components/PlacesInput";
import { detectContactInfo } from "@evt/lib/contactInfoDetection";
import { usePayoutStatus } from "@evt/hooks/usePayoutStatus";
import { PayoutReadinessBanner } from "@evt/components/payouts/PayoutReadinessBanner";
import { PayoutStatusCard } from "@evt/components/payouts/PayoutStatusCard";
import { SpeakOrTypeField } from "@evt/components/app/SpeakOrTypeField";
import EventApplicationGate from "@evt/components/events/EventApplicationGate";
import ApplicationFormRenderer, { type AnswerMap } from "@evt/components/events/ApplicationFormRenderer";
import { detectAspectRatio, aspectRatioCss, type CoverAspectRatio } from "@evt/lib/imageAspect";
import { AiFlyerStudio } from "@evt/components/events/AiFlyerStudio";
import { CURRENCIES, currencySymbol } from "@evt/lib/currencies";
import { normalizeEventSlugInput } from "@evt/lib/eventShortLinks";
import { normalizePlan } from "@evt/lib/plans";
import { EVENT_TIME_ZONES } from "@evt/lib/eventTime";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { createEventOptionText, createEventText } from "@evt/i18n/createEventLocale";

/** Tiny helper so we know the Confirm dialog actually mounted in the DOM,
 *  independent of Radix's onOpenAutoFocus (which can be skipped when focus
 *  is held by a Sheet/Toast/Preview overlay). */
function ConfirmMountSignal({ onMounted }: { onMounted: () => void }) {
  useEffect(() => { onMounted(); }, [onMounted]);
  return null;
}

/* ── Types ── */
export interface EventFormData {
  eventName: string;
  description: string;
  category: string;
  eventType: "conference" | "party" | "workshop" | "meetup" | "festival" | "networking" | "other";
  visibility: "public" | "unlisted" | "private";
  locationType: "in-person" | "online" | "hybrid";
  location: string;
  venueName: string;
  eventLink: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  sameDay: boolean;
  useDuration: boolean;
  durationHours: number;
  timezone: string;
  isEvergreen: boolean;
  dateTbd: boolean;
  timeTbd: boolean;
  ticketMode: "free" | "paid";
  currency: string;
  generalAdmissionPrice: string;
  generalAdmissionQty: string;
  hasVipTicket: boolean;
  vipPrice: string;
  vipQty: string;
  isUnlimitedCapacity: boolean;
  capacity: string;
  requireScore: boolean;
  minScore: number;
  hasDiscountCode: boolean;
  discountCode: string;
  discountPercent: string;
  /** Vanity URL slug: <host>/events/<slug>. Letters/numbers/hyphens, 3-60 chars. */
  slug: string;
  showTotalTickets: boolean;
  showRemainingTickets: boolean;
  /** Accept Wise (direct transfer) for buyers in Colombia & other non-Stripe countries. */
  acceptWise: boolean;
  /** Host's Wise email/handle, shown to Wise buyers at checkout. */
  hostWiseHandle: string;
  /** Accept PayPal (direct transfer) — secondary international payout option. */
  acceptPaypal: boolean;
  /** Host's PayPal email / PayPal.Me link, shown to PayPal buyers at checkout. */
  hostPaypalHandle: string;
  includedFoodTickets: number;
  foodTicketDescription: string;
  includedDrinkTickets: number;
  drinkTicketDescription: string;
  coverImage: File | null;
  coverImageUrl: string;
  coverAspectRatio: CoverAspectRatio;
  coverVideo: File | null;
  coverVideoUrl: string;
  attachments: File[];
  attachmentUrls: { name: string; url: string; source?: string; caption?: string; likes?: number; comments?: number; postUrl?: string }[];
  addressVisible: boolean;
  status: "draft" | "published";
  // Application gate (available for free + paid events)
  requiresApplication: boolean;
  applicationRequiresApproval: boolean;
  applicationIcpDescription: string;
  applicationQuestions: import("./ApplicationFormBuilder").AppQuestion[];
}

export const INITIAL_EVENT_FORM: EventFormData = {
  eventName: "", description: "", category: "", eventType: "other",
  visibility: "public", locationType: "in-person",
  location: "", venueName: "", eventLink: "",
  startDate: "", startTime: "", endDate: "", endTime: "",
  sameDay: false, useDuration: false, durationHours: 2,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  isEvergreen: false,
  dateTbd: false, timeTbd: false,
  ticketMode: "free", currency: "USD", generalAdmissionPrice: "", generalAdmissionQty: "",
  hasVipTicket: false, vipPrice: "", vipQty: "",
  isUnlimitedCapacity: true, capacity: "",
  requireScore: false, minScore: 0,
  hasDiscountCode: false, discountCode: "", discountPercent: "", slug: "",
  showTotalTickets: true, showRemainingTickets: true, acceptWise: false, hostWiseHandle: "", acceptPaypal: false, hostPaypalHandle: "",
  includedFoodTickets: 0, foodTicketDescription: "",
  includedDrinkTickets: 0, drinkTicketDescription: "",
  coverImage: null, coverImageUrl: "", coverAspectRatio: "16:9",
  coverVideo: null, coverVideoUrl: "",
  attachments: [], attachmentUrls: [], addressVisible: true, status: "draft",
  requiresApplication: false, applicationRequiresApproval: false, applicationIcpDescription: "", applicationQuestions: [],
};

interface Props {
  onBack: () => void;
  onPublish: (data: EventFormData, persistedId?: string | null) => Promise<string | null | void> | string | null | void;
  onSaveDraft: (data: EventFormData, persistedId?: string | null) => Promise<string | null | void> | string | null | void;
  onAutoSaveDraft: (data: EventFormData, persistedId?: string | null) => Promise<string | null | void> | string | null | void;
  onDiscardDraft: (draftId: string) => Promise<void> | void;
  initialData?: Partial<EventFormData>;
  persistedDraftId?: string | null;
  /** When true, automatically open the live Preview Event view right after the form mounts. */
  autoOpenPreview?: boolean;
}

// Local safety net for a brand-new event, covering the window BEFORE the first
// DB draft save lands (or if that save fails). Mirrors the form to localStorage on
// every change so nothing is lost if the tab navigates away — e.g. a mobile flyer
// download that leaves the SPA. Cleared once a real DB draft exists or on publish. (Lee, Jul 22)
const DRAFT_BACKUP_KEY = "oneevent:new-event-backup";
function stripForBackup(f: EventFormData) {
  // File/Blob objects can't be JSON-serialized (and would become {}); drop them.
  // The text — the part that's painful to lose — is what we preserve.
  const { coverImage, attachments, coverVideo, ...rest } = f as any;
  return rest;
}
function readDraftBackup(): Partial<EventFormData> | null {
  try { const raw = localStorage.getItem(DRAFT_BACKUP_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeDraftBackup(f: EventFormData) {
  try { localStorage.setItem(DRAFT_BACKUP_KEY, JSON.stringify(stripForBackup(f))); } catch { /* quota / private mode */ }
}
function clearDraftBackup() {
  try { localStorage.removeItem(DRAFT_BACKUP_KEY); } catch { /* noop */ }
}

function hasDraftableContent(form: EventFormData) {
  return Boolean(
    form.eventName.trim() ||
    form.description.trim() ||
    form.category.trim() ||
    form.location.trim() ||
    form.venueName.trim() ||
    form.eventLink.trim() ||
    form.startDate ||
    form.startTime ||
    form.endDate ||
    form.endTime ||
    form.coverImage ||
    form.coverImageUrl ||
    form.attachments.length ||
    form.attachmentUrls.length ||
    form.ticketMode === "paid" ||
    form.requiresApplication ||
    form.applicationIcpDescription.trim() ||
    form.applicationQuestions.length
  );
}

function getDraftSignature(form: EventFormData) {
  return JSON.stringify({
    ...form,
    coverImage: form.coverImage ? `${form.coverImage.name}-${form.coverImage.size}-${form.coverImage.lastModified}` : null,
    attachments: form.attachments.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
  });
}

/* ── Attachment limits per tier ── */
function getAttachmentLimits(tier: string | null) {
  switch (tier) {
    case "vip": return { cover: 5, supporting: 10 };
    case "pro": return { cover: 1, supporting: 1 };
    default: return { cover: 1, supporting: 0 };
  }
}

function getDescriptionLimit(tier: string | null) {
  // Match OneSocial — a 3000-char floor gives VAIA room to write a full, richly
  // sectioned description. The old 300-char free cap physically forced the AI to
  // cram everything into one run-on sentence. (Lee, Jul 22)
  if (tier === "vip" || tier === "monster") return 6000;
  if (tier === "pro" || tier === "scout") return 3000;
  return 1000;
}

function getDescriptionPlainText(description: string) {
  return stripRichTextHtml(description || "").trim();
}

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, vip: 2 };

function canUseAiFeature(plan: string | null, required: "pro" | "vip") {
  return PLAN_RANK[normalizePlan(plan)] >= PLAN_RANK[required];
}

/* ── Shared sub-components ── */
function SectionCard({ title, icon: Icon, info, children }: { title: string; icon: React.ElementType; info?: string; children: React.ReactNode }) {
  const { lang } = useLanguage();
  const ce = (english: string) => createEventText(lang, english);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {info && <InfoTip text={info} label={ce("More info")} dismissLabel={ce("Got it")} />}
      </div>
      {children}
    </div>
  );
}

function FieldError({ error, reserve = false }: { error?: string; reserve?: boolean }) {
  // When `reserve` is true we always render the line so the surrounding
  // grid row doesn't jump vertically when an inline error appears.
  if (!error && !reserve) return null;
  return (
    /* v23 CL: every visible error carries data-field-error, so the publish handler can
       scroll the FIRST one into view — the old [data-field] selector matched nothing. */
    <p {...(error ? { "data-field-error": "1" } : {})}
      className={cn("text-xs mt-1 leading-tight min-h-[1rem] scroll-mt-28", error ? "text-destructive font-semibold" : "text-transparent")}>
      {error || "placeholder"}
    </p>
  );
}

/* ── Date Picker ── */
function DatePickerField({ value, onChange, label, required, error, minDate }: {
  value: string; onChange: (v: string) => void; label: string; required?: boolean; error?: string; minDate?: string;
}) {
  const { lang } = useLanguage();
  const ce = (english: string) => createEventText(lang, english);
  const dateLocale = lang === "co" || lang === "es" ? es
    : lang === "de" ? de
    : lang === "ru" ? ru
    : lang === "zh" ? zhCN
    : lang === "pt" ? ptBR
    : enUS;
  const calendarLocale = lang === "co" ? "es-CO"
    : lang === "es" ? "es"
    : lang === "de" ? "de-DE"
    : lang === "ru" ? "ru-RU"
    : lang === "zh" ? "zh-CN"
    : lang === "pt" ? "pt-BR"
    : "en-US";
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const disabledBefore = minDate ? parse(minDate, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline"
            className={cn("w-full min-w-0 justify-start text-left font-normal bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20 hover:bg-secondary/70",
              !value && "text-muted-foreground", error && "border-destructive")}>
            <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{value ? format(parse(value, "yyyy-MM-dd", new Date()), "PP", { locale: dateLocale }) : ce("Select date")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card/95 backdrop-blur-xl border-ink/20 dark:border-white/15 shadow-2xl shadow-primary/10" align="start">
          <Calendar mode="single" selected={selectedDate}
            onSelect={(d) => { if (d) { onChange(format(d, "yyyy-MM-dd")); setOpen(false); } }}
            disabled={disabledBefore ? (date) => date < disabledBefore : undefined}
            locale={calendarLocale} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <FieldError error={error} reserve />
    </div>
  );
}

/* ── Time Picker ── */
function TimePicker({ value, onChange, label, error }: { value: string; onChange: (v: string) => void; label: string; error?: string }) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = ["00", "15", "30", "45"];
  const parsed = useMemo(() => {
    if (!value) return { h: 9, m: "00", ampm: "AM" };
    const [hh, mm] = value.split(":");
    let h = parseInt(hh);
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return { h, m: mm || "00", ampm };
  }, [value]);
  const buildTime = (h: number, m: string, ampm: string) => {
    let hour24 = h;
    if (ampm === "PM" && h !== 12) hour24 = h + 12;
    if (ampm === "AM" && h === 12) hour24 = 0;
    onChange(`${String(hour24).padStart(2, "0")}:${m}`);
  };
  const borderClass = error ? "ring-2 ring-red-500 border-red-500" : "";
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className={cn("flex items-center gap-1.5 rounded-lg p-0.5", borderClass)}>
        <Select value={String(parsed.h)} onValueChange={v => buildTime(Number(v), parsed.m, parsed.ampm)}>
          <SelectTrigger className="w-[72px] bg-brand/10 border-brand/40 dark:bg-brand/15 dark:border-brand/40 text-center font-semibold"><SelectValue /></SelectTrigger>
          <SelectContent>{hours.map(h => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-lg font-bold text-muted-foreground">:</span>
        <Select value={parsed.m} onValueChange={v => buildTime(parsed.h, v, parsed.ampm)}>
          <SelectTrigger className="w-[72px] bg-brand/10 border-brand/40 dark:bg-brand/15 dark:border-brand/40 text-center font-semibold"><SelectValue /></SelectTrigger>
          <SelectContent>{minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex rounded-lg overflow-hidden border border-ink/20 dark:border-white/12">
          {["AM", "PM"].map(ap => (
            <button key={ap} type="button" onClick={() => buildTime(parsed.h, parsed.m, ap)}
              className={cn("min-w-[46px] px-3 py-2 text-xs font-bold transition-all text-center",
                parsed.ampm === ap ? "evt-chip-active bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary")}>
              {ap}
            </button>
          ))}
        </div>
      </div>
      <FieldError error={error} reserve />
    </div>
  );
}

/* ── Cover / Flyer Editor — accepts any aspect ratio (16:9, 4:5, 9:16, 1:1) ── */
function CoverImageEditor({
  previewUrl,
  aspectRatio,
  onUpload,
  onRemove,
  onDownload,
}: {
  previewUrl: string;
  aspectRatio: CoverAspectRatio;
  onUpload: (f: File) => void;
  onRemove: () => void;
  onDownload?: () => void;
}) {
  const { lang } = useLanguage();
  const ce = (english: string) => createEventText(lang, english);
  if (!previewUrl) {
    return (
      <div className="border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/40 transition-colors border-ink/20 dark:border-white/12"
        onClick={() => document.getElementById("event-bg-input")?.click()}>
        <div className="p-6 text-center">
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">{ce("Upload a cover image or flyer")}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            {ce("JPG, PNG up to 10MB · Any ratio — vertical flyers (4:5, 9:16) supported")}
          </p>
        </div>
        <input id="event-bg-input" type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      </div>
    );
  }

  const isVertical = aspectRatio === "4:5" || aspectRatio === "9:16";
  const ratioLabel: Record<CoverAspectRatio, string> = {
    "16:9": ce("Landscape · 16:9"),
    "4:5": ce("Portrait · 4:5 (Instagram post)"),
    "9:16": ce("Vertical · 9:16 (Story / Reel)"),
    "1:1": ce("Square · 1:1"),
  };

  return (
    <div className="space-y-2">
      <div
        className="relative w-full mx-auto rounded-xl overflow-hidden border border-primary/30 bg-black/40"
        style={{
          aspectRatio: aspectRatioCss(aspectRatio),
          maxWidth: isVertical ? 280 : "100%",
        }}
      >
        {/* Blurred backdrop fills any letterbox space (esp. for vertical flyers) */}
        <img
          src={previewUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40 pointer-events-none"
        />
        {/* The flyer itself, fully visible — no crop */}
        <img
          src={previewUrl}
          alt={ce("Cover")}
          className="relative z-10 w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-destructive transition-colors z-20">
          <X className="w-3 h-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); document.getElementById("event-bg-input")?.click(); }}
          className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-medium hover:bg-black/80 transition-colors z-20">
          {ce("Change")}
        </button>
        {onDownload && (
          <button
            onClick={e => { e.stopPropagation(); onDownload(); }}
            className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-medium hover:bg-black/80 transition-colors z-20 flex items-center gap-1">
            <Download className="w-3 h-3" /> {ce("Download")}
          </button>
        )}
        <input id="event-bg-input" type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">{ratioLabel[aspectRatio]}</p>
    </div>
  );
}

function AttachmentPreviewItem({
  name,
  url,
  file,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  position,
}: {
  name: string;
  url?: string;
  file?: File;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  position?: number;
}) {
  const { lang } = useLanguage();
  const ce = (english: string) => createEventText(lang, english);
  const [objectUrl, setObjectUrl] = useState("");
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const previewUrl = url || objectUrl;
  const isImage = Boolean(previewUrl && (file?.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(name)));
  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 text-xs">
        {typeof position === "number" && (
          <span className="text-[10px] font-semibold text-muted-foreground w-4 text-center">{position}</span>
        )}
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp}
            className="text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed" title={ce("Move up")}>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown}
            className="text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed" title={ce("Move down")}>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        {isImage ? (
          <button type="button" onClick={() => setZoomed(true)}
            className="h-12 w-10 rounded-md overflow-hidden border border-border bg-background hover:ring-2 hover:ring-primary/50 transition"
            title={ce("Click to enlarge")}>
            <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
          </button>
        ) : (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer"
            className="h-12 w-10 rounded-md border border-border bg-background flex items-center justify-center hover:border-primary/50"
            title={ce("Open file")}>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </a>
        )}
        <span className="text-foreground truncate flex-1">{name}</span>
        {previewUrl && (
          <button type="button" onClick={download} className="text-muted-foreground hover:text-primary" title={ce("Download")}>
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" title={ce("Remove")}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {zoomed && isImage && previewUrl && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomed(false)}>
          <button type="button" onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label={ce("Close preview")}>
            <X className="w-5 h-5" />
          </button>
          <img src={previewUrl} alt={name}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/50 px-3 py-1.5 rounded-full">
            {name}
          </p>
        </div>
      )}
    </>
  );
}

/* ── Category Search ── */
const EVENT_CATEGORIES = [
  "Tech", "Music", "Fitness", "Business", "Arts", "Food & Drink",
  "Wellness", "Photography", "Fashion", "Sports", "Education",
  "Networking", "Charity", "Comedy", "Film", "Gaming",
];

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export default function CreateEventForm({ onBack, onPublish, onSaveDraft, onAutoSaveDraft, onDiscardDraft, initialData, persistedDraftId, autoOpenPreview }: Props) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const ce = useCallback((english: string) => createEventText(lang, english), [lang]);
  const cep = useCallback((english: string, values: Record<string, string | number>) => {
    let translated = createEventText(lang, english);
    for (const [key, value] of Object.entries(values)) translated = translated.split(`{${key}}`).join(String(value));
    return translated;
  }, [lang]);
  const dateLocale = lang === "co" || lang === "es" ? es
    : lang === "de" ? de
    : lang === "ru" ? ru
    : lang === "zh" ? zhCN
    : lang === "pt" ? ptBR
    : enUS;
  const { user, profile, subscription } = useAuth();
  /* v24 DP (Lee): while creating an event, nudge the host to finish the profile attendees
     will judge them by — location + profession on the shared One ID profile, and a
     OneScore for credibility. Dismissible; links go to the SAME onboarding surfaces. */
  const [profileNudge, setProfileNudge] = useState<{ needsProfile: boolean; needsScore: boolean } | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return sessionStorage.getItem("ow.evt.profileNudge") === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const [{ data: prof }, { data: score }] = await Promise.all([
        supabase.from("profiles").select("location, job_title").eq("id", user.id).maybeSingle(),
        supabase.from("score_history").select("one_score").eq("user_id", user.id).order("calculated_at", { ascending: false }).limit(1),
      ]);
      if (!alive) return;
      const needsProfile = !String((prof as any)?.location || "").trim() || !String((prof as any)?.job_title || "").trim();
      const needsScore = !(score && score.length > 0);
      setProfileNudge({ needsProfile, needsScore });
    })();
    return () => { alive = false; };
  }, [user?.id]);
  const [form, setForm] = useState<EventFormData>({ ...INITIAL_EVENT_FORM, ...initialData });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [bgPreview, setBgPreview] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(!!autoOpenPreview);
  const [showApplicationPreview, setShowApplicationPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmMounted, setConfirmMounted] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autoSavedDraftId, setAutoSavedDraftId] = useState<string | null>(persistedDraftId ?? null);
  const [aiFlyerOpen, setAiFlyerOpen] = useState(false);
  const [aiStudioMode, setAiStudioMode] = useState<"flyer" | "background">("flyer");
  const [payoutBlockOpen, setPayoutBlockOpen] = useState(false);
  const [payoutSuccessOpen, setPayoutSuccessOpen] = useState(false);
  const [payoutReturnError, setPayoutReturnError] = useState<string | null>(null);
  const [payoutRetryBusy, setPayoutRetryBusy] = useState(false);
  const payout = usePayoutStatus();

  // Return path used when launching Stripe onboarding from this form. We
  // include the draft id so the events hub re-opens the same event on return,
  // and a `payouts=connected` flag so we can show a polished confirmation.
  const payoutReturnPath = (() => {
    const draftId = autoSavedDraftId ?? persistedDraftId ?? null;
    return draftId
      ? `/events/events?edit=${draftId}&payouts=connected`
      : `/events/events?payouts=connected`;
  })();

  const retryPayoutOnboarding = useCallback(async () => {
    setPayoutRetryBusy(true);
    try {
      const url = await payout.startOnboarding(payoutReturnPath);
      if (url) window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : ce("Couldn't reopen Stripe onboarding.");
      toast.error(msg);
      setPayoutRetryBusy(false);
    }
  }, [ce, payout, payoutReturnPath]);

  // When Stripe redirects back, confirm success or surface an inline error+retry.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("payouts") === "connected";
    const refreshFlag = url.searchParams.get("refresh") === "1";
    if (!connected && !refreshFlag) return;

    url.searchParams.delete("payouts");
    url.searchParams.delete("refresh");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));

    if (refreshFlag && !connected) {
      setPayoutReturnError(ce("Your Stripe onboarding session expired before you finished. Tap retry to pick up where you left off."));
      return;
    }

    (async () => {
      await payout.refresh();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase.functions.invoke("stripe-connect-status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (data?.payouts_enabled) {
          setPayoutReturnError(null);
          setPayoutSuccessOpen(true);
        } else {
          const dueCount = Array.isArray(data?.requirements_currently_due) ? data.requirements_currently_due.length : 0;
          setPayoutReturnError(
            dueCount > 0
              ? cep("Stripe still needs {count} more details before payouts can turn on. Tap retry to finish.", { count: dueCount })
              : ce("Stripe didn't confirm your payout setup. Tap retry to finish, or contact support if this keeps happening.")
          );
        }
      } catch {
        setPayoutReturnError(ce("We couldn't confirm your Stripe payout status. Tap retry to continue."));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startedWithExistingDraftRef = useRef(Boolean(persistedDraftId));
  const manualDraftSavedRef = useRef(false);
  const publishedRef = useRef(false);
  const autoSaveInFlightRef = useRef(false);
  const initialSignatureRef = useRef(getDraftSignature({ ...INITIAL_EVENT_FORM, ...initialData } as EventFormData));
  const lastSavedSignatureRef = useRef(initialSignatureRef.current);

  const planTier = subscription?.plan || null;
  const limits = getAttachmentLimits(planTier);
  const descLimit = getDescriptionLimit(planTier);
  const canDiscount = planTier === "vip";
  const canGenerateAiBackground = canUseAiFeature(planTier, "pro");
  const canGenerateAiFlyer = canUseAiFeature(planTier, "vip");
  const initialEventId = (initialData as { id?: string } | undefined)?.id ?? null;
  const initialEventStatus = (initialData as { status?: string } | undefined)?.status ?? null;
  const isEditingPublishedEvent = Boolean(initialEventId && initialEventStatus === "published");
  const currentPersistedId = autoSavedDraftId ?? persistedDraftId ?? initialEventId ?? null;
  const descriptionPlainText = useMemo(() => getDescriptionPlainText(form.description), [form.description]);
  const hasUnpublishedChanges = useMemo(() => getDraftSignature(form) !== initialSignatureRef.current, [form]);
  const publishDisabled = uploading || publishing || (isEditingPublishedEvent && !hasUnpublishedChanges);
  const publishActionLabel = publishing
    ? ce("Processing...")
    : uploading
      ? ce("Uploading...")
      : isEditingPublishedEvent
        ? (hasUnpublishedChanges ? ce("Publish with changes") : ce("No changes to publish"))
        : ce("Publish Event");

  const updateField = useCallback(<K extends keyof EventFormData>(key: K, val: EventFormData[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === "sameDay" && val === true) next.endDate = prev.startDate;
      if (key === "startDate" && prev.sameDay) next.endDate = val as string;
      // Auto-compute end time from duration
      if ((key === "startTime" || key === "durationHours") && next.useDuration && next.startTime) {
        const [hh, mm] = next.startTime.split(":").map(Number);
        const totalMin = hh * 60 + (mm || 0) + next.durationHours * 60;
        next.endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        // If the duration crosses midnight, advance the END DATE to the correct day
        // so it never false-flags a same-day conflict. (Lee, Jul 23)
        const dayOffset = Math.floor(totalMin / 1440);
        if (next.startDate) {
          const base = parse(next.startDate, "yyyy-MM-dd", new Date());
          base.setDate(base.getDate() + dayOffset);
          next.endDate = format(base, "yyyy-MM-dd");
          if (dayOffset > 0) next.sameDay = false;
        }
      }

      // ── Live time-conflict detection (no need to wait for Save/Publish) ──
      // Only relevant when same-calendar-day. If the user picks an end time that
      // is AT or BEFORE the start time, surface a friendly inline error
      // immediately and suggest the smart fix (toggle Same day off → next day).
      const effectiveEndDate = next.sameDay ? next.startDate : (next.endDate || next.startDate);
      const sameCalendarDay = !!next.startDate && effectiveEndDate === next.startDate;
      const hasBoth = !!next.startTime && !!next.endTime;
      setErrors(prevErr => {
        const e = { ...prevErr };
        if (!next.isEvergreen && sameCalendarDay && hasBoth && next.endTime <= next.startTime) {
          // Helpful, descriptive message — explains WHY and the fix.
          const msg = next.endTime === "00:00"
            ? ce("12:00 AM is the next day — turn off \"Same day\" to span midnight")
            : ce("End time is before start time — turn off \"Same day\" if your event runs past midnight");
          e.endTime = msg;
          e.startTime = ce("Conflicts with end time");
        } else {
          // Clear stale conflict errors as soon as the user fixes the issue.
          // When both values are present, time-field errors can only be the
          // conflict above. Clear them without comparing translated text so a
          // language switch cannot strand an error written in the old locale.
          // Missing-value guards remain untouched when either value is blank.
          if (hasBoth) {
            delete e.endTime;
            delete e.startTime;
          }
        }
        // Clear the touched field's prior error if it was a generic "required" error
        if (e[key as string] && key !== "startTime" && key !== "endTime") delete e[key as string];
        return e;
      });

      return next;
    });
  }, [ce]);

  const validate = () => {
    const e: Record<string, string> = {};
    const plainDescription = getDescriptionPlainText(form.description);
    if (!form.eventName.trim()) e.eventName = ce("Event name is required");
    if (!plainDescription) e.description = ce("Description is required");
    if (plainDescription.length > descLimit) e.description = cep("Description exceeds {limit} character limit", { limit: descLimit });

    // Contact info detection in description
    const contactCheck = detectContactInfo(plainDescription);
    if (contactCheck.hasContactInfo) e.description = ce("Remove contact information before continuing. Keep event communication inside OneEvent.");

    // Evergreen offers skip date validation entirely (no fixed schedule)
    if (!form.isEvergreen) {
      if (!form.dateTbd) {
        if (!form.startDate) e.startDate = ce("Start date is required");
        if (!form.sameDay && !form.endDate) e.endDate = ce("End date is required");
        if (!form.sameDay && form.endDate && form.startDate && form.endDate < form.startDate) e.endDate = ce("End date cannot be before start date");
      }
    }

    // End time must be after start time (same day or same-day toggle)
    if (!form.isEvergreen && form.startDate && form.startTime && form.endTime) {
      const effectiveEndDate = form.sameDay ? form.startDate : (form.endDate || form.startDate);
      if (effectiveEndDate === form.startDate && form.endTime <= form.startTime) {
        e.endTime = form.endTime === "00:00"
          ? ce("12:00 AM is the next day — turn off \"Same day\" to span midnight")
          : ce("End time is before start time — turn off \"Same day\" if your event runs past midnight");
        e.startTime = ce("Conflicts with end time");
      }
    }

    if (form.locationType === "in-person" && !form.location.trim()) e.location = ce("Location is required");
    if (form.locationType === "online" && !form.eventLink.trim()) e.eventLink = ce("Event link is required");
    if (!form.isUnlimitedCapacity && (!form.capacity || parseInt(form.capacity) <= 0)) e.capacity = ce("Enter a valid capacity");
    if (form.ticketMode === "paid") {
      if (!form.generalAdmissionPrice || parseFloat(form.generalAdmissionPrice) <= 0) e.generalAdmissionPrice = ce("Price must be greater than zero");
      if (form.hasVipTicket && (!form.vipPrice || parseFloat(form.vipPrice) <= 0)) e.vipPrice = ce("VIP price must be greater than zero");
    }
    if (form.slug.trim() && !/^[A-Za-z0-9]([A-Za-z0-9-]{1,58})[A-Za-z0-9]$/.test(form.slug.trim())) {
      e.slug = ce("Use 3–60 letters, numbers or hyphens. Start and end with a letter or number.");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const uid = user?.id || "anon";
    const path = `${uid}/${folder}/${crypto.randomUUID()}-${file.name}`;
    const { data, error } = await supabase.storage.from("job-media").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("job-media").getPublicUrl(data.path).data.publicUrl;
  };

  const handleCoverImage = async (file: File) => {
    updateField("coverImage", file);
    const ratio = await detectAspectRatio(file);
    updateField("coverAspectRatio", ratio);
    const reader = new FileReader();
    reader.onload = () => setBgPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const downloadCurrentCover = async () => {
    const url = bgPreview || form.coverImageUrl;
    if (!url) return;
    const name = `event-${form.coverAspectRatio === "16:9" ? "cover" : "flyer"}.png`;
    // Fetch to a blob first so the anchor download NEVER navigates the tab away.
    // On mobile a cross-origin storage URL with the `download` attr is treated as a
    // navigation, which was blowing away the in-progress event. (Lee, Jul 22)
    try {
      const resp = await fetch(url, { mode: "cors" });
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    } catch {
      // Last resort: open in a new tab so we never replace the current SPA page.
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const uploadAllFiles = async (silent = false): Promise<EventFormData> => {
    if (!silent) setUploading(true);
    try {
      let coverUrl = form.coverImageUrl;
      if (form.coverImage) coverUrl = await uploadFile(form.coverImage, "event-covers");
      const newAttUrls = [...form.attachmentUrls];
      for (const file of form.attachments) {
        const url = await uploadFile(file, "event-attachments");
        newAttUrls.push({ name: file.name, url });
      }
      // Functional update so we don't clobber any user input typed during the upload.
      setForm(prev => ({
        ...prev,
        coverImageUrl: coverUrl,
        // Only swap in newly uploaded URLs if user hasn't replaced them mid-flight
        attachmentUrls: prev.attachmentUrls.length >= newAttUrls.length ? prev.attachmentUrls : newAttUrls,
        // Drop the files we successfully uploaded; keep any new files added during the upload
        attachments: prev.attachments.filter(f => !form.attachments.includes(f)),
        coverImage: prev.coverImage === form.coverImage ? null : prev.coverImage,
      }));
      if (!silent) setBgPreview("");
      // Return a snapshot useful for the caller (publish path)
      return { ...form, coverImage: null, coverImageUrl: coverUrl, attachmentUrls: newAttUrls, attachments: [] };
    } finally { if (!silent) setUploading(false); }
  };

  const persistDraftSilently = useCallback(async (reason: "autosave" | "publish-fallback") => {
    if (autoSaveInFlightRef.current) return currentPersistedId;
    autoSaveInFlightRef.current = true;
    setAutoSaveState("saving");
    try {
      // Only run uploads when there are actually new files to upload.
      // Otherwise, save the current form metadata as-is — this prevents the
      // upload path from calling setForm() and clobbering text the user is
      // actively typing into question labels, descriptions, etc.
      const hasNewFiles = Boolean(form.coverImage) || form.attachments.length > 0;
      const payload = hasNewFiles
        ? await uploadAllFiles(reason === "autosave")
        : form;
      const saved = await onAutoSaveDraft({ ...payload, status: "draft" }, currentPersistedId);
      const nextId = typeof saved === "string" ? saved : currentPersistedId;
      if (typeof saved === "string") setAutoSavedDraftId(saved);
      lastSavedSignatureRef.current = getDraftSignature(payload);
      setAutoSaveState("saved");
      return nextId;
    } catch (err) {
      setAutoSaveState("error");
      if (reason === "publish-fallback") {
        toast.error(ce("The publish dialog failed, so we tried to save your event as a draft."));
      }
      return null;
    } finally {
      autoSaveInFlightRef.current = false;
    }
  }, [currentPersistedId, form, onAutoSaveDraft, uploadAllFiles]);

  useEffect(() => {
    if (persistedDraftId) setAutoSavedDraftId(persistedDraftId);
  }, [persistedDraftId]);

  useEffect(() => {
    if (showPreview || showApplicationPreview || confirmOpen || uploading || publishing || isEditingPublishedEvent) return;
    if (!hasDraftableContent(form)) return;

    const signature = getDraftSignature(form);
    if (signature === lastSavedSignatureRef.current) return;

    const timer = window.setTimeout(() => {
      void persistDraftSilently("autosave");
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [confirmOpen, form, isEditingPublishedEvent, persistDraftSilently, publishing, showApplicationPreview, showPreview, uploading]);

  // ---- Local backup safety net (new events only) ----
  // Restore once on mount if we crashed/navigated out mid-creation last time.
  const backupRestoredRef = useRef(false);
  useEffect(() => {
    if (backupRestoredRef.current) return;
    backupRestoredRef.current = true;
    if (currentPersistedId || (initialData as { id?: string } | undefined)?.id || isEditingPublishedEvent) return;
    if (hasDraftableContent(form)) return; // form already has content — don't overwrite
    const saved = readDraftBackup();
    if (saved && hasDraftableContent({ ...INITIAL_EVENT_FORM, ...saved } as EventFormData)) {
      setForm(prev => ({ ...prev, ...saved }));
      toast.success(ce("Recovered your unsaved event — pick up right where you left off."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror to localStorage on every change until a real DB draft exists.
  useEffect(() => {
    if (isEditingPublishedEvent) return;
    if (currentPersistedId) { clearDraftBackup(); return; } // DB has it now → Drafts tab is the recovery path
    if (!hasDraftableContent(form)) return;
    const id = window.setTimeout(() => writeDraftBackup(form), 400);
    return () => window.clearTimeout(id);
  }, [form, currentPersistedId, isEditingPublishedEvent]);

  // Flush on tab hide / navigation (mobile flyer download, back button, app switch).
  useEffect(() => {
    const flush = () => {
      if (isEditingPublishedEvent || currentPersistedId) return;
      if (hasDraftableContent(form)) writeDraftBackup(form); // synchronous → guaranteed before unload
    };
    window.addEventListener("pagehide", flush);
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onVis); };
  }, [form, currentPersistedId, isEditingPublishedEvent]);

  useEffect(() => {
    if (!publishing || !confirmOpen) {
      setConfirmMounted(false);
      return;
    }

    // Watchdog: only fire if dialog truly never reached the DOM after a generous delay.
    // We use a 4s window and verify via a DOM query (not just the autofocus callback,
    // which Radix sometimes skips when focus is held by a Sheet/Toast/Preview overlay).
    const timer = window.setTimeout(async () => {
      if (!confirmOpen) return;
      const dialogInDom = typeof document !== "undefined" &&
        document.querySelector('[role="dialog"][data-state="open"]') !== null;
      if (confirmMounted || dialogInDom) {
        // Dialog is actually showing — clear stuck publishing state but don't error.
        if (!confirmMounted) setConfirmMounted(true);
        return;
      }
      await persistDraftSilently("publish-fallback");
      setConfirmOpen(false);
      setPublishing(false);
      toast.error(ce("The confirm step did not appear, so your work was saved to Drafts."));
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [confirmMounted, confirmOpen, persistDraftSilently, publishing]);

  const FIELD_LABELS: Record<string, string> = {
    eventName: "Event name",
    description: "Description",
    startDate: "Start date",
    endDate: "End date",
    startTime: "Start time",
    endTime: "End time",
    location: "Location",
    eventLink: "Event link",
    capacity: "Capacity",
    generalAdmissionPrice: "Ticket price",
    vipPrice: "VIP price",
  };

  const handlePublish = async () => {
    if (isEditingPublishedEvent && !hasUnpublishedChanges) {
      toast.message(ce("No changes to publish."));
      return;
    }

    const e: Record<string, string> = {};
    const plainDescription = getDescriptionPlainText(form.description);
    if (!form.eventName.trim()) e.eventName = ce("Event name is required");
    if (!plainDescription) e.description = ce("Description is required");
    if (plainDescription.length > descLimit) e.description = cep("Description exceeds {limit} character limit", { limit: descLimit });
    const contactCheck = detectContactInfo(plainDescription);
    if (contactCheck.hasContactInfo) e.description = ce("Remove contact information before continuing. Keep event communication inside OneEvent.");
    if (!form.isEvergreen) {
      if (!form.dateTbd) {
        if (!form.startDate) e.startDate = ce("Start date is required");
        if (!form.sameDay && !form.endDate) e.endDate = ce("End date is required");
        if (!form.sameDay && form.endDate && form.startDate && form.endDate < form.startDate) e.endDate = ce("End date cannot be before start date");
      }
    }
    if (!form.isEvergreen && form.startDate && form.startTime && form.endTime) {
      const effectiveEndDate = form.sameDay ? form.startDate : (form.endDate || form.startDate);
      if (effectiveEndDate === form.startDate && form.endTime <= form.startTime) {
        e.endTime = form.endTime === "00:00"
          ? ce("12:00 AM is the next day — turn off \"Same day\" to span midnight")
          : ce("End time is before start time — turn off \"Same day\" if your event runs past midnight");
        e.startTime = ce("Conflicts with end time");
      }
    }
    if (form.locationType === "in-person" && !form.location.trim()) e.location = ce("Location is required");
    if (form.locationType === "online" && !form.eventLink.trim()) e.eventLink = ce("Event link is required");
    if (!form.isUnlimitedCapacity && (!form.capacity || parseInt(form.capacity) <= 0)) e.capacity = ce("Enter a valid capacity");
    if (form.ticketMode === "paid") {
      if (!form.generalAdmissionPrice || parseFloat(form.generalAdmissionPrice) <= 0) e.generalAdmissionPrice = ce("Price must be greater than zero");
      if (form.hasVipTicket && (!form.vipPrice || parseFloat(form.vipPrice) <= 0)) e.vipPrice = ce("VIP price must be greater than zero");
    }
    setErrors(e);

    if (Object.keys(e).length > 0) {
      // Send the user back to the form so they can see which fields are flagged
      setShowPreview(false);
      const missingLabels = Object.keys(e).map(k => ce(FIELD_LABELS[k] || k)).join(", ");
      toast.error(cep("Please fix: {fields}", { fields: missingLabels }));
      // v23 CL (Lee's UAT): the old selector queried [data-field], which NO element carried —
      // the scroll silently did nothing and publish looked broken. Every rendered FieldError
      // now stamps data-field-error, so the first flagged field scrolls into view for real.
      setTimeout(() => {
        const el = document.querySelector(`[data-field-error]`) as HTMLElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
      return;
    }
    // Block paid events from publishing without Stripe Connect ready
    if (form.ticketMode === "paid" && !payout.loading && !payout.payouts_enabled) {
      setPayoutBlockOpen(true);
      return;
    }
    setConfirmMounted(false);
    setShowPreview(false);
    setPublishing(true);
    setConfirmOpen(true);
  };

  const confirmPublish = async () => {
    setConfirmOpen(false);
    try {
      const uploaded = await uploadAllFiles();
      publishedRef.current = true;
      const saved = await onPublish({ ...uploaded, status: "published" }, currentPersistedId);
      if (typeof saved === "string") setAutoSavedDraftId(saved);
      clearDraftBackup();
    } catch (err: any) {
      toast.error(cep("Failed to upload files: {error}", { error: err.message || ce("Unknown error") }));
      setPublishing(false);
    }
  };

  const handleDraft = async () => {
    try {
      const uploaded = await uploadAllFiles();
      manualDraftSavedRef.current = true;
      const saved = await onSaveDraft({ ...uploaded, status: "draft" }, currentPersistedId);
      if (typeof saved === "string") setAutoSavedDraftId(saved);
      lastSavedSignatureRef.current = getDraftSignature(uploaded);
      setAutoSaveState("saved");
    } catch (err: any) {
      toast.error(cep("Failed to save draft: {error}", { error: err.message || ce("Unknown error") }));
    }
  };

  const handleBack = async () => {
    if (!startedWithExistingDraftRef.current && autoSavedDraftId && !manualDraftSavedRef.current && !publishedRef.current) {
      try {
        await onDiscardDraft(autoSavedDraftId);
      } catch {
        toast.error(ce("Couldn't remove the temporary draft."));
      }
    }
    onBack();
  };

  const handlePreview = async () => {
    if (form.coverImage || form.attachments.length > 0) {
      try {
        const uploaded = await uploadAllFiles();
        setShowPreview(true);
        setForm(prev => ({ ...prev, ...uploaded }));
        return;
      } catch (err: any) { toast.error(cep("Failed to upload files for preview: {error}", { error: err.message || ce("Unknown error") })); }
    }
    setShowPreview(true);
  };

  const handleApplicationPreview = () => {
    if (!form.requiresApplication) {
      toast.error(ce("Turn on Request to Join before previewing the application."));
      return;
    }
    if (form.applicationQuestions.length === 0) {
      toast.error(ce("Add at least one application question before previewing the form."));
      return;
    }
    setShowApplicationPreview(true);
  };

  const previewApplicationQuestions = form.applicationQuestions.map((q, i) => ({
    ...q,
    label: q.label.trim() || `${ce("Question")} ${i + 1}`,
  }));

  const handlePreviewApplicationSubmit = async (_answers: AnswerMap) => {
    toast.success(ce("Preview submitted — no application was saved."));
  };

  if (showPreview) {
    return (
      <EventPreview formData={form} onBack={() => setShowPreview(false)} onPublish={() => handlePublish()} />
    );
  }

  if (showApplicationPreview) {
    const paymentCopy = form.ticketMode === "paid"
      ? form.applicationRequiresApproval
        ? ce("Your card is authorized today and only charged if the host approves you.")
        : ce("After submitting, you'll continue to secure checkout.")
      : ce("The host reviews your request before confirming your spot.");
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 border-b border-primary/30 bg-primary/5 backdrop-blur-md">
          <div className="max-w-lg mx-auto px-4">
            <div className="h-14 flex items-center justify-between gap-3">
              <button onClick={() => setShowApplicationPreview(false)} className="flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80 transition-opacity">
                <ArrowLeft className="w-4 h-4" /> {ce("Back to Edit")}
              </button>
              <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">{ce("Application Preview")}</span>
            </div>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="rounded-2xl bg-card border border-border p-5 mb-4">
            <h1 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {form.eventName || ce("Untitled Event")}
            </h1>
            <div className="flex items-center gap-2 text-xs text-primary font-semibold">
              <FileText className="w-3.5 h-3.5" /> {ce("Request to join")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{paymentCopy}</p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-5 mb-6">
            <h2 className="text-sm font-bold text-foreground mb-4">{ce("Request to join")}</h2>
            <ApplicationFormRenderer
              questions={previewApplicationQuestions}
              onSubmit={handlePreviewApplicationSubmit}
              previewMode
              submitLabel={form.ticketMode === "paid" && form.applicationRequiresApproval ? ce("Authorize payment & request to join") : ce("Submit request")}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Teal/green gradient background — bold and consistent */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 left-0 w-full h-full"
          style={{ background: "linear-gradient(135deg, hsl(174 72% 42% / 0.18), hsl(187 85% 40% / 0.12), transparent 55%)" }} />
        <div className="absolute top-[5%] right-[10%] w-[600px] h-[600px] rounded-full opacity-[0.15]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 65%)" }} />
        <div className="absolute bottom-[10%] left-[5%] w-[500px] h-[500px] rounded-full opacity-[0.10]"
          style={{ background: "radial-gradient(circle, hsl(168 80% 50%), transparent 65%)" }} />
        <div className="absolute top-[50%] left-[40%] w-[400px] h-[400px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(187 85% 40%), transparent 65%)" }} />
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 border-b border-ink/12 dark:border-white/10 backdrop-blur-xl"
        style={{ background: "linear-gradient(180deg, hsl(var(--card) / 0.95) 0%, hsl(var(--card) / 0.85) 100%)" }}>
        <div className="max-w-lg mx-auto px-2">
          {/* Row 1: Back + Title + autosave (mobile) / full row (desktop) */}
          <div className="h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-3">
            <button onClick={() => void handleBack()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-ink/20 dark:border-white/12 bg-secondary text-foreground hover:bg-secondary/80 transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {ce("Back")}
            </button>
            <h1 className="text-sm sm:text-lg font-bold text-foreground truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>{ce("Create Event")}</h1>
            {/* Desktop action buttons (hidden — app is a phone column everywhere) */}
            <div className="hidden">
              <Button variant="outline" size="sm" onClick={handlePreview} disabled={uploading} className="rounded-full text-xs border-ink/20 dark:border-white/12">
                  <Eye className="w-3.5 h-3.5 mr-1" /> {ce("Preview Event")}
              </Button>
              {form.requiresApplication && (
                <Button variant="outline" size="sm" onClick={handleApplicationPreview} disabled={uploading} className="rounded-full text-xs border-ink/20 dark:border-white/12">
                    <FileText className="w-3.5 h-3.5 mr-1" /> {ce("Preview Form")}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDraft} disabled={uploading} className="rounded-full text-xs border-ink/20 dark:border-white/12">
                {uploading ? ce("Uploading...") : ce("Save Draft")}
              </Button>
              <Button size="sm" onClick={handlePublish} disabled={publishDisabled} className="rounded-full text-xs bg-primary text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-45 disabled:shadow-none">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> {publishActionLabel}
              </Button>
            </div>
            {/* Mobile autosave indicator (compact) */}
            {autoSaveState !== "idle" && (
              <span className="sm:hidden text-[10px] text-muted-foreground shrink-0 truncate max-w-[80px]">
                {autoSaveState === "saving" ? ce("Saving…") : autoSaveState === "saved" ? ce("Saved") : ce("Failed")}
              </span>
            )}
          </div>
          {/* Actions (Preview / Save Draft / Publish) live at the BOTTOM of the
              form now (Lee, Jul 22) — header keeps just Back + title. */}
          {/* Desktop autosave row */}
          {autoSaveState !== "idle" && (
            <div className="hidden sm:block pb-3 text-right text-[11px] text-muted-foreground">
              {autoSaveState === "saving" ? ce("Saving draft…") : autoSaveState === "saved" ? ce("Draft saved") : ce("Draft backup failed")}
            </div>
          )}
        </div>
      </div>

      {/* Form Body */}
      <div className="max-w-lg mx-auto px-2 py-6">
        {payoutReturnError && (
          <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-200">{ce("Payout setup didn't finish")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{payoutReturnError}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={retryPayoutOnboarding}
                  disabled={payoutRetryBusy}
                  className="h-7 rounded-full bg-primary text-primary-foreground text-[11px] px-3"
                >
                  {payoutRetryBusy ? ce("Opening Stripe…") : ce("Retry payout setup")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPayoutReturnError(null)}
                  className="h-7 rounded-full text-[11px] px-3 border-ink/20 dark:border-white/12"
                >
                  {ce("Dismiss")}
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* v24 DP: complete-your-profile nudge — attendees see the host card on every
            event page; an empty location or missing OneScore costs the host trust. */}
        {!nudgeDismissed && profileNudge && (profileNudge.needsProfile || profileNudge.needsScore) && (
          <div className="mb-5 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{ce("Make your host card land")}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {ce("Attendees see your profile on every event page. Add your location and profession so they know who's hosting. A OneScore next to your name builds the credibility that fills seats.")}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {profileNudge.needsProfile && (
                    <button type="button" onClick={() => navigate("/account/profile")}
                      className="ow-btn-espresso rounded-full px-3.5 py-1.5 text-xs font-bold">
                      {ce("Complete your profile →")}
                    </button>
                  )}
                  {profileNudge.needsScore && (
                    <button type="button" onClick={() => navigate("/score")}
                      className="rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/15">
                      {ce("Get your OneScore →")}
                    </button>
                  )}
                </div>
              </div>
              <button type="button" aria-label={ce("Dismiss")}
                onClick={() => { setNudgeDismissed(true); try { sessionStorage.setItem("ow.evt.profileNudge", "1"); } catch { /* ignore */ } }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
          </div>
        )}
        <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-[1fr_380px]")}>


          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* Event Basics */}
            <SectionCard title={ce("Event Basics")} icon={CalendarIcon}>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Event Name")} <span className="text-red-500">*</span></label>
                  <Input value={form.eventName} onChange={e => updateField("eventName", e.target.value)}
                    placeholder={ce("e.g. Tech Summit 2025")}
                    className={cn("bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20 focus:border-primary/50", errors.eventName && "border-destructive")} />
                  <FieldError error={errors.eventName} />
                </div>

                <div id="desc-field" className="scroll-mt-20">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">{ce("Description")} <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-1.5">
                      <InfoTip
                        text={
                          <div className="space-y-2">
                            <p>{ce("Speak with AI (VAIA) — tap it and just talk for up to 2 minutes about your event: the vibe, who it's for, food, schedule, dress code, prices, anything. VAIA transcribes everything and organizes it into a clean, inviting, nicely-formatted description for you.")}</p>
                            <p>{ce("How much VAIA can write depends on your plan:")}</p>
                            <p className="text-xs text-ink/70 dark:text-white/70">{cep("Basic {basic} characters · Pro {pro} · VIP {vip}", { basic: "1,000", pro: "3,000", vip: "6,000" })}</p>
                          </div>
                        }
                        action={
                          <span className="block w-full rounded-full bg-gradient-to-r from-brand-bright to-brand-deep py-2 text-center text-xs font-semibold text-white">
                            {ce("Upgrade for more →")}
                          </span>
                        }
                        onAction={() => navigate("/events/pricing")}
                        label={ce("More info")}
                        dismissLabel={ce("Got it")}
                      />
                    </div>
                  </div>
                  {/* v19 (Lee): OneJob's speak-or-type pattern — the empty box IS the
                      chooser (big "Speak it" straight into recording, "Type it" one tap
                      away); once text exists it's a normal editor with the VAIA pill. */}
                  <SpeakOrTypeField
                    mode="rich"
                    value={form.description}
                    onChange={(html) => updateField("description", html)}
                    type="event"
                    title={form.eventName}
                    category={form.category}
                    charLimit={descLimit}
                    placeholder={ce("What should attendees expect? Speakers, schedule, what's included, attire requirements...")}
                    fieldLabel={ce("Event Description")}
                    error={!!errors.description}
                    chooserPrompt={ce("How do you want to describe your event?")}
                    hint={ce("Talking is faster — describe the event out loud and VAIA writes the description for you.")}
                    speakLabel={ce("Speak it")}
                    typeLabel={ce("Type it")}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <FieldError error={errors.description} />
                     <span className={cn("text-[10px]",
                      descriptionPlainText.length > descLimit ? "text-destructive"
                        : "text-muted-foreground/50"
                    )}>
                      {descriptionPlainText.length} / {descLimit} {ce("chars")}
                    </span>
                  </div>
                  {/* VAIA upgrade nudge when hitting character limit */}
                  {descriptionPlainText.length > descLimit && (
                    <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
                      {/* Was a hand-rolled <img> pointing at a public path that has never existed, and it hid
                          itself on error — so VAIA silently vanished from this screen instead of
                          showing her face (§4.8, 10 Aug 2026). The shell component owns the asset
                          and the fallback, in one place, for every product. */}
                      <VaiaFace size={32} className="mt-0.5" ring="ring-transparent" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground font-medium mb-1">{ce("You've hit your {limit}-character limit!").replace("{limit}", String(descLimit))}</p>
                        <p className="text-[11px] text-muted-foreground mb-2">{ce("Upgrade your plan to write longer, more detailed descriptions that attract more attendees.")}</p>
                        <Button size="sm" className="rounded-full text-[11px] h-7 px-4" onClick={() => navigate("/events/pricing")}>
                          {ce("Unlock More →")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Event Type + Category + Visibility + Location Type — row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Event Type")}</label>
                    <Select value={form.eventType} onValueChange={v => updateField("eventType", v as any)}>
                      <SelectTrigger className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20"><SelectValue displayValue={createEventOptionText(lang, form.eventType)} /></SelectTrigger>
                      <SelectContent>
                        {["conference", "party", "workshop", "meetup", "festival", "networking", "other"].map(t => (
                          <SelectItem key={t} value={t}>{ce(t.charAt(0).toUpperCase() + t.slice(1))}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Category")}</label>
                    <Select value={form.category} onValueChange={v => updateField("category", v)}>
                      <SelectTrigger className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20"><SelectValue displayValue={form.category ? createEventOptionText(lang, form.category) : undefined} placeholder={ce("Select...")} /></SelectTrigger>
                      <SelectContent>
                        {EVENT_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{createEventOptionText(lang, c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Visibility")}</label>
                    <Select value={form.visibility} onValueChange={v => updateField("visibility", v as any)}>
                      <SelectTrigger className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20"><SelectValue displayValue={createEventOptionText(lang, form.visibility)} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{ce("Public")}</SelectItem>
                        <SelectItem value="unlisted">{ce("Unlisted")}</SelectItem>
                        <SelectItem value="private">{ce("Private")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Location Type")}</label>
                    <Select value={form.locationType} onValueChange={v => updateField("locationType", v as any)}>
                      <SelectTrigger className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20"><SelectValue displayValue={createEventOptionText(lang, form.locationType)} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-person">{ce("In-Person")}</SelectItem>
                        <SelectItem value="online">{ce("Online")}</SelectItem>
                        <SelectItem value="hybrid">{ce("Hybrid")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Date & Time */}
            <SectionCard title={form.isEvergreen ? ce("Open-Ended Offer (Available Anytime)") : ce("Date & Time")} icon={Clock}>
              <div className="space-y-3">
                {/* Evergreen / Open-ended offer toggle */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border border-amber-500/20">
                  <Switch
                    checked={form.isEvergreen}
                    onCheckedChange={v => updateField("isEvergreen", v)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {ce("Open-Ended Offer (Available Anytime)")}
                      <InfoTip text={ce("Turn on for coaching packages, courses, community access, or anything sold without a fixed date. It displays as an Offer instead of an Event — no schedule required, and buyers can purchase anytime for instant access via their receipt.")} label={ce("More info")} dismissLabel={ce("Got it")} />
                    </div>
                  </div>
                </div>

                {form.isEvergreen ? (
                  <div className="text-xs text-muted-foreground bg-secondary/30 border border-ink/12 dark:border-white/10 rounded-xl p-3">
                    <span className="text-foreground font-medium">{ce("Available anytime")}</span> — {ce("buyers can purchase at any time and get instant access via their receipt.")}
                  </div>
                ) : (
                  <>
                    {/* TBD toggles — date and/or time can be marked TBD */}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 cursor-pointer">
                        <Switch
                          checked={form.dateTbd}
                          onCheckedChange={v => {
                            updateField("dateTbd", v);
                            if (v) { updateField("startDate", ""); updateField("endDate", ""); }
                          }}
                          className="scale-90"
                        />
                        <span className="text-[11px] font-medium text-foreground">{ce("Date TBD")}</span>
                      </label>
                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 cursor-pointer">
                        <Switch
                          checked={form.timeTbd}
                          onCheckedChange={v => {
                            updateField("timeTbd", v);
                            if (v) { updateField("startTime", ""); updateField("endTime", ""); }
                          }}
                          className="scale-90"
                        />
                        <span className="text-[11px] font-medium text-foreground">{ce("Time TBD")}</span>
                      </label>
                    </div>

                    {form.dateTbd && form.timeTbd ? (
                      <div className="text-xs text-muted-foreground bg-secondary/30 border border-ink/12 dark:border-white/10 rounded-xl p-3">
                        🕒 <span className="text-foreground font-medium">{ce("Date & time to be determined")}</span> — {ce("your event will display as TBD. You can update it later.")}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Event timezone")}</label>
                          <Select value={form.timezone} onValueChange={v => updateField("timezone", v)}>
                            <SelectTrigger className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20">
                              <SelectValue placeholder={ce("Select timezone")} />
                            </SelectTrigger>
                            <SelectContent>
                              {EVENT_TIME_ZONES.map(zone => (
                                <SelectItem key={zone.value} value={zone.value}>{zone.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                            {ce("Ticket emails and calendar links use this event timezone. Medellin and Bogota use Colombia Time (COT), not daylight saving time.")}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 items-start">
                          {form.dateTbd ? (
                            <div className="px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 h-10 flex items-center text-[11px] text-muted-foreground">{ce("Start Date")}: TBD</div>
                          ) : (
                            <DatePickerField value={form.startDate} onChange={v => updateField("startDate", v)} label={ce("Start Date")} required error={errors.startDate} />
                          )}
                          {form.timeTbd ? (
                            <div className="px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 h-10 flex items-center text-[11px] text-muted-foreground">{ce("Start Time")}: TBD</div>
                          ) : (
                            <TimePicker value={form.startTime} onChange={v => updateField("startTime", v)} label={ce("Start Time")} error={errors.startTime} />
                          )}
                          {/* Same day + Duration toggles side by side (Lee, Jul 22) */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 h-10 whitespace-nowrap">
                              <Switch checked={form.sameDay} onCheckedChange={v => { updateField("sameDay", v); if (v) updateField("endDate", form.startDate); }} className="scale-90" disabled={form.dateTbd} />
                              <span className="text-[11px] font-medium text-foreground">{ce("Same day")}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 h-10 whitespace-nowrap">
                              <Switch checked={form.useDuration} onCheckedChange={v => updateField("useDuration", v)} className="scale-90" disabled={form.timeTbd} />
                              <span className="text-[11px] font-medium text-foreground">{ce("Duration")}</span>
                            </div>
                          </div>
                        </div>
                        {form.useDuration && !form.timeTbd ? (
                          <div>
                              <label className="text-xs font-medium text-muted-foreground mb-2 block">{ce("Duration")}</label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: "30 min", value: 0.5 }, { label: "1 hr", value: 1 }, { label: "1.5 hrs", value: 1.5 },
                                { label: "2 hrs", value: 2 }, { label: "3 hrs", value: 3 }, { label: "4 hrs", value: 4 },
                                { label: "6 hrs", value: 6 }, { label: "8 hrs", value: 8 },
                              ].map(d => (
                                <button key={d.value} type="button" onClick={() => updateField("durationHours", d.value)}
                                  className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                                    form.durationHours === d.value
                                      ? "bg-primary/15 border-primary text-primary shadow-sm shadow-primary/10"
                                      : "bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20 text-muted-foreground hover:border-primary/30")}>
                                  {d.label}
                                </button>
                              ))}
                            </div>
                            {form.startTime && (
                              <p className="text-xs text-primary/70 mt-2">
                                ✓ {ce("Ends")} {(() => {
                                  const [hh, mm] = form.startTime.split(":").map(Number);
                                  const total = hh * 60 + (mm || 0) + form.durationHours * 60;
                                  const eh = Math.floor(total / 60) % 24;
                                  const em = total % 60;
                                  const dayOffset = Math.floor(total / 1440);
                                  const time = `${eh > 12 ? eh - 12 : eh || 12}:${String(em).padStart(2, "0")} ${eh >= 12 ? "PM" : "AM"}`;
                                  if (dayOffset > 0 && form.startDate) {
                                    const d = parse(form.startDate, "yyyy-MM-dd", new Date());
                                    d.setDate(d.getDate() + dayOffset);
                                    return `${format(d, "MMM d", { locale: dateLocale })} ${ce("at")} ${time}`;
                                  }
                                  return `${ce("at")} ${time}`;
                                })()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 items-start">
                            {form.dateTbd ? (
                              <div className="px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 h-10 flex items-center text-[11px] text-muted-foreground">{ce("End Date")}: TBD</div>
                            ) : !form.sameDay ? (
                              <DatePickerField value={form.endDate} onChange={v => updateField("endDate", v)} label={ce("End Date")} required error={errors.endDate} minDate={form.startDate} />
                            ) : (
                              <div className="hidden sm:block" aria-hidden />
                            )}
                            <div className={form.sameDay && !form.dateTbd ? "col-span-2 sm:col-span-1" : ""}>
                              {form.timeTbd ? (
                                <div className="px-3 py-2 rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 h-10 flex items-center text-[11px] text-muted-foreground">{ce("End Time")}: TBD</div>
                              ) : (
                                <TimePicker value={form.endTime} onChange={v => updateField("endTime", v)} label={ce("End Time")} error={errors.endTime} />
                              )}
                            </div>
                            <div className="hidden sm:block w-[104px]" aria-hidden />
                            <div className="hidden sm:block w-[100px]" aria-hidden />
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            {/* Location */}
            <SectionCard title={ce("Location")} icon={MapPin}>
              <div className="space-y-3">
                {(form.locationType === "in-person" || form.locationType === "hybrid") && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Venue / Building name")} <span className="text-muted-foreground/50 text-[10px]">({ce("optional")})</span></label>
                      <PlacesInput variant="establishment" value={form.venueName} onChange={v => updateField("venueName", v)}
                        onResolve={(r) => { if (r.name) updateField("venueName", r.name); if (r.address) updateField("location", r.address); }}
                        placeholder={ce("e.g. Dodger Stadium, Chase Bank…")} className="input" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Address")} <span className="text-muted-foreground/50 text-[10px]">({ce("or building name")})</span> <span className="text-red-500">*</span></label>
                      <PlacesInput variant="address" value={form.location} onChange={v => updateField("location", v)}
                        onResolve={(r) => updateField("location", r.address)}
                        placeholder={ce("Start typing an address…")} className={cn("input", errors.location && "!border-destructive")} />
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <Switch checked={form.addressVisible !== false} onCheckedChange={v => updateField("addressVisible", v)} />
                      <div>
                        <span className="text-sm text-foreground">{ce("Show full address publicly")}</span>
                        <p className="text-[10px] text-muted-foreground">{ce("If off, only a general area will be shown until ticket purchase or access granted")}</p>
                      </div>
                    </div>
                  </>
                )}
                {(form.locationType === "online" || form.locationType === "hybrid") && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Event Link")} <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input value={form.eventLink} onChange={e => updateField("eventLink", e.target.value)}
                        placeholder={ce("https://zoom.us/j/... or streaming link")}
                        className={cn("pl-9 bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20", errors.eventLink && "border-destructive")} />
                    </div>
                    <FieldError error={errors.eventLink} />
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Tickets */}
            <SectionCard title={ce("Tickets & Capacity")} icon={Ticket}>
              <div className="space-y-4">
                {/* Free vs Paid toggle */}
                <div className="flex gap-2">
                  {(["free", "paid"] as const).map(t => (
                    <button key={t} onClick={() => updateField("ticketMode", t)}
                      className={cn("flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all",
                        form.ticketMode === t ? "bg-primary/15 border-primary text-primary" : "bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20 text-muted-foreground")}>
                      {t === "free" ? ce("Free RSVP") : ce("Paid Tickets")}
                    </button>
                  ))}
                </div>

                {/* Paid ticket details */}
                {form.ticketMode === "paid" && (
                  <div className="space-y-4 p-4 rounded-xl bg-secondary/40 dark:bg-white/[0.04] border border-ink/20 dark:border-white/12">
                    {/* General Admission */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                          {ce("General Admission price")} ({currencySymbol(form.currency)}) <span className="text-red-500">*</span>
                          <InfoTip text={ce("General Admission is your standard entry ticket — the base price everyone pays to get in. If you add a VIP tier below, that's an optional higher-priced ticket with extra perks.")} label={ce("More info")} dismissLabel={ce("Got it")} />
                        </label>
                        <div className="flex gap-2">
                          <Select value={form.currency} onValueChange={(v) => updateField("currency", v)}>
                            <SelectTrigger className="w-[110px] shrink-0 bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20 text-xs px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-w-[240px]">
                              {CURRENCIES.map((c) => (
                                <SelectItem key={c.code} value={c.code} className="text-sm">
                                  <span className="flex items-center gap-2"><span className="text-2xl leading-none">{c.flag}</span>{c.code} {c.symbol}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="number" min="0" step="0.01" value={form.generalAdmissionPrice}
                            onChange={e => updateField("generalAdmissionPrice", e.target.value)}
                            placeholder={ce("Enter price")} className={cn("flex-1 min-w-0 bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20", errors.generalAdmissionPrice && "border-destructive")} />
                        </div>
                        <FieldError error={errors.generalAdmissionPrice} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("General Admission quantity")}</label>
                        <Input type="number" min="1" value={form.generalAdmissionQty}
                          onChange={e => updateField("generalAdmissionQty", e.target.value)}
                          placeholder={ce("Quantity")} className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20" />
                      </div>
                    </div>

                    {/* VIP Toggle */}
                    <div className="flex items-center gap-3">
                      <Switch checked={form.hasVipTicket} onCheckedChange={v => updateField("hasVipTicket", v)} />
                      <span className="text-xs font-medium text-foreground">{ce("Add VIP Ticket")}</span>
                    </div>
                    {form.hasVipTicket && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("VIP Price")} ({currencySymbol(form.currency)}) <span className="text-red-500">*</span></label>
                          <Input type="number" min="0" step="0.01" value={form.vipPrice}
                            onChange={e => updateField("vipPrice", e.target.value)}
                            placeholder={ce("Enter price")} className={cn("bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20", errors.vipPrice && "border-destructive")} />
                          <FieldError error={errors.vipPrice} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("VIP Qty")}</label>
                          <Input type="number" min="1" value={form.vipQty}
                            onChange={e => updateField("vipQty", e.target.value)}
                            placeholder={ce("Quantity")} className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20" />
                        </div>
                      </div>
                    )}

                    {/* Included Food & Drink Tickets */}
                    <div className="space-y-3 pt-3 border-t border-ink/12 dark:border-white/10">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{ce("Included with Ticket")}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">🍽️ {ce("Food Tickets")}</label>
                          <Input type="number" min="0" value={form.includedFoodTickets || ""}
                            onChange={e => updateField("includedFoodTickets", parseInt(e.target.value) || 0)}
                            placeholder={ce("None")} className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">🍹 {ce("Drink Tickets")}</label>
                          <Input type="number" min="0" value={form.includedDrinkTickets || ""}
                            onChange={e => updateField("includedDrinkTickets", parseInt(e.target.value) || 0)}
                            placeholder={ce("None")} className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20" />
                        </div>
                      </div>
                      {(form.includedFoodTickets > 0 || form.includedDrinkTickets > 0) && (
                        <div className="space-y-2">
                          {form.includedFoodTickets > 0 && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">{ce("Food description")}</label>
                              <Input value={form.foodTicketDescription}
                                onChange={e => updateField("foodTicketDescription", e.target.value)}
                                placeholder={ce("e.g. One entrée plate, choice of chicken or veggie")}
                                className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20" />
                            </div>
                          )}
                          {form.includedDrinkTickets > 0 && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">{ce("Drink description")}</label>
                              <Input value={form.drinkTicketDescription}
                                onChange={e => updateField("drinkTicketDescription", e.target.value)}
                                placeholder={ce("e.g. One cocktail or non-alcoholic beverage")}
                                className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline payout setup — host sees their connected bank
                        (or a CTA to set one up) before they ever hit Publish. */}
                    <div className="pt-3 border-t border-ink/12 dark:border-white/10">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">{ce("Payouts")}</p>
                      <PayoutStatusCard returnPath={payoutReturnPath} />
                    </div>

                    {/* Platform fee note */}
                    <p className="text-[10px] text-muted-foreground/60">{ce("OneEvent applies a {fee} platform fee on ticket revenue.").replace("{fee}", FEE_PCT)}</p>
                  </div>
                )}

                {/* Capacity */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.isUnlimitedCapacity} onCheckedChange={v => updateField("isUnlimitedCapacity", v)} />
                    <span className="text-xs font-medium text-foreground">{ce("Unlimited capacity")}</span>
                  </div>
                  {!form.isUnlimitedCapacity && (
                    <div className="flex-1 max-w-[160px]">
                      <Input type="number" min="1" value={form.capacity}
                        onChange={e => updateField("capacity", e.target.value)}
                        placeholder="e.g. 200" className={cn("bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20", errors.capacity && "border-destructive")} />
                      <FieldError error={errors.capacity} />
                    </div>
                  )}
                </div>

                {/* Ticket Visibility Toggles */}
                {!form.isUnlimitedCapacity && (
                  <div className="space-y-2 pt-2 border-t border-ink/12 dark:border-white/10">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{ce("Ticket Visibility on Event Page")}</p>
                    <div className="flex items-center gap-3">
                      <Switch checked={form.showTotalTickets} onCheckedChange={v => updateField("showTotalTickets", v)} />
                      <span className="text-xs font-medium text-foreground">{ce("Show total tickets available")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={form.showRemainingTickets} onCheckedChange={v => updateField("showRemainingTickets", v)} />
                      <span className="text-xs font-medium text-foreground">{ce("Show tickets remaining")}</span>
                    </div>
                  </div>
                )}

                {/* Wise (direct transfer) — for paid events, especially Colombia */}
                {form.ticketMode === "paid" && (
                  <div className="pt-3 mt-2 border-t border-ink/12 dark:border-white/10 space-y-2">
                    <div className="flex items-start gap-3">
                      <Switch checked={form.acceptWise} onCheckedChange={v => updateField("acceptWise", v)} className="mt-0.5" />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-foreground">{ce("Accept Wise payments")}</span>
                        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          {ce("For buyers in Colombia & other countries Stripe doesn't support. Buyer sends ticket price to you via Wise; order goes pending until you confirm receipt in your dashboard. No platform fee on Wise ticket sales for now.")}
                        </p>
                      </div>
                    </div>
                    {form.acceptWise && (
                      <div className="pl-12 space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground block">{ce("Your Wise email or @handle")}</label>
                        <input
                          type="text"
                          value={form.hostWiseHandle}
                          onChange={(e) => updateField("hostWiseHandle", e.target.value)}
                          placeholder="you@example.com"
                          className="w-full px-3 py-2 rounded-lg bg-secondary/40 dark:bg-white/[0.06] border border-ink/20 dark:border-white/15 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-[10px] text-muted-foreground">{ce("Buyers see this at checkout to send their ticket payment.")}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* PayPal (direct transfer) — secondary international payout, mirrors Wise */}
                {form.ticketMode === "paid" && (
                  <div className="pt-3 mt-2 border-t border-ink/12 dark:border-white/10 space-y-2">
                    <div className="flex items-start gap-3">
                      <Switch checked={form.acceptPaypal} onCheckedChange={v => updateField("acceptPaypal", v)} className="mt-0.5" />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-foreground">{ce("Accept PayPal payments")}</span>
                        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          {ce("A secondary option for buyers who can't use an international card. Buyer sends the ticket price to your PayPal; the order goes pending until you confirm receipt in your dashboard. No platform fee on PayPal ticket sales for now.")}
                        </p>
                      </div>
                    </div>
                    {form.acceptPaypal && (
                      <div className="pl-12 space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground block">{ce("Your PayPal email or PayPal.Me link")}</label>
                        <input
                          type="text"
                          value={form.hostPaypalHandle}
                          onChange={(e) => updateField("hostPaypalHandle", e.target.value)}
                          placeholder="you@example.com or paypal.me/you"
                          className="w-full px-3 py-2 rounded-lg bg-secondary/40 dark:bg-white/[0.06] border border-ink/20 dark:border-white/15 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-[10px] text-muted-foreground">{ce("Buyers see this at checkout to send their ticket payment.")}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* (placeholder kept for diff alignment) */}
                {false && (
                  <div />
                )}

                {/* Discount Code (VIP only) */}
                {form.ticketMode === "paid" && (
                  <div>
                    {canDiscount ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Switch checked={form.hasDiscountCode} onCheckedChange={v => updateField("hasDiscountCode", v)} />
                          <span className="text-xs font-medium text-foreground">{ce("Add Discount Code")}</span>
                        </div>
                        {form.hasDiscountCode && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Code")}</label>
                              <Input value={form.discountCode} onChange={e => updateField("discountCode", e.target.value.toUpperCase())}
                                placeholder={ce("Code (e.g. letters/numbers)")} className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20 uppercase" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{ce("Discount %")}</label>
                              <Input type="number" min="1" max="100" value={form.discountPercent}
                                onChange={e => updateField("discountPercent", e.target.value)}
                                placeholder={ce("% off")} className="bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-ink/12 dark:border-white/10">
                        <Lock className="w-4 h-4 text-muted-foreground/40" />
                        <span className="text-[11px] text-muted-foreground flex-1">{ce("Discount codes are available on VIP plans.")}</span>
                        <Button size="sm" variant="outline" className="rounded-full text-[10px] border-primary/30 text-primary hover:bg-primary/10 h-7 px-3"
                          onClick={() => navigate(`/events/pricing?return=${encodeURIComponent("/events/events")}`)}>
                          {ce("Upgrade")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Vanity URL — v23 DB (Lee): the prefix moved OUT of the box (it was eating
                    all the typing room); the field holds just the custom part, with a live
                    preview of the full link underneath as they type. */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block">
                    {ce("Custom event URL (optional)")}
                  </label>
                  <p className="text-[11px] text-muted-foreground/70 mb-1.5 mt-0.5">
                    {window.location.host}/events/<span className="text-muted-foreground">…{ce("your-custom-name")}</span>
                  </p>
                  <Input
                    value={form.slug}
                    onChange={e => updateField("slug", normalizeEventSlugInput(e.target.value))}
                    placeholder="ExecutionRoom"
                    className={cn("bg-secondary/60 dark:bg-white/[0.06] border-ink/25 dark:border-white/20 focus:border-primary/50", errors.slug && "border-destructive")}
                    maxLength={60}
                  />
                  {form.slug.trim() && (
                    <p className="mt-1.5 break-all rounded-lg bg-primary/[0.06] border border-primary/20 px-2.5 py-1.5 text-[11px] font-semibold text-primary">
                      → {window.location.host}/events/{form.slug}
                    </p>
                  )}
                  <FieldError error={errors.slug} />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {ce("Letters, numbers and hyphens only. Used on flyers, QR codes and shareable links.")}
                  </p>
                </div>


              </div>
            </SectionCard>

            {/* Request to Join / Application — own pane so hosts notice it.
                Explanatory text lives in the (i) InfoTip (Lee, Jul 22). */}
            <SectionCard title={ce("Request to Join / Application")} icon={FileText}
              info={ce("Attendees request to join and complete your questions before their spot is confirmed. Their answers land in your applicant Rolodex with a VAIA fit score. Turning this on changes the public event button to “Request to Join.”")}>
              <EventApplicationGate
                enabled={form.requiresApplication}
                onEnabledChange={v => updateField("requiresApplication", v)}
                icpDescription={form.applicationIcpDescription}
                onIcpChange={v => updateField("applicationIcpDescription", v)}
                questions={form.applicationQuestions}
                onQuestionsChange={qs => updateField("applicationQuestions", qs)}
                requiresApproval={form.applicationRequiresApproval}
                onRequiresApprovalChange={v => updateField("applicationRequiresApproval", v)}
                isPaid={form.ticketMode === "paid"}
              />
            </SectionCard>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* OneScore Requirement */}
            <SectionCard title={ce("OneScore Requirement")} icon={Star}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={form.requireScore} onCheckedChange={v => updateField("requireScore", v)} />
                  <span className="text-xs font-medium text-foreground">{ce("Require minimum score")}</span>
                </div>
                {form.requireScore && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{ce("Minimum score to attend")}</span>
                      <span className="text-lg font-bold text-primary">{form.minScore}+</span>
                    </div>
                    <Slider value={[form.minScore]} onValueChange={([v]) => updateField("minScore", v)}
                      min={0} max={100} step={5} className="py-2" />
                    <div className="flex justify-between text-[10px] text-muted-foreground/60">
                      <span>{ce("Open to all")}</span><span>50</span><span>100</span>
                    </div>
                    {form.minScore >= 80 && (
                      <p className="text-[10px] text-amber-400/80">⚠ {ce("High score requirements may reduce attendees")}</p>
                    )}
                  </>
                )}
              </div>
            </SectionCard>



            {/* Cover Image / Flyer */}
            <SectionCard title={ce("Cover or Flyer")} icon={ImageIcon}>
              <CoverImageEditor
                previewUrl={bgPreview || form.coverImageUrl}
                aspectRatio={form.coverAspectRatio}
                onUpload={handleCoverImage}
                onRemove={() => { updateField("coverImage", null); updateField("coverImageUrl", ""); updateField("coverAspectRatio", "16:9"); setBgPreview(""); }}
                onDownload={(bgPreview || form.coverImageUrl) ? downloadCurrentCover : undefined}
              />
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Background is a text-free horizontal image — a title OR a
                    // description is enough for VAIA to design from. (Lee, Jul 22)
                    if (!form.eventName.trim() && !getDescriptionPlainText(form.description)) {
                      toast.error(ce("Add an event title or description first so VAIA knows what to design."));
                      return;
                    }
                    if (!canGenerateAiBackground) {
                      navigate(`/events/pricing?plan=pro&return=${encodeURIComponent("/events/events")}`);
                      return;
                    }
                    setAiStudioMode("background");
                    setAiFlyerOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm border border-primary transition-colors hover:opacity-90"
                >
                  <ImageIcon className="w-4 h-4" />
                  {ce("Generate Cover Image with VAIA")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.eventName.trim()) {
                      toast.error(ce("Add an event title first so VAIA knows what to design."));
                      return;
                    }
                    if (!canGenerateAiFlyer) {
                      navigate(`/events/pricing?plan=vip&return=${encodeURIComponent("/events/events")}`);
                      return;
                    }
                    setAiStudioMode("flyer");
                    setAiFlyerOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary font-semibold text-sm border border-primary/30 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {ce("Generate Flyer with VAIA")}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-center">
                <p className="text-[11px] text-muted-foreground">
                  {ce("AI Cover Image is a Pro feature · AI Flyer is VIP. Uploading your own image is always free.")}
                </p>
                <InfoTip
                  text={
                    <div className="space-y-2">
                      <p>{ce("AI Cover Image generates a square event cover — a Pro feature.")}</p>
                      <p>{ce("AI Flyer generates a vertical share flyer with a QR code — a VIP feature.")}</p>
                      <p>{ce("You can always upload your own image for free. To generate with VAIA, upgrade to the plan shown.")}</p>
                    </div>
                  }
                  action={
                    <span className="block w-full rounded-full bg-gradient-to-r from-brand-bright to-brand-deep py-2 text-center text-xs font-semibold text-white">
                      {ce("See plans →")}
                    </span>
                  }
                  onAction={() => navigate("/events/pricing")}
                  label={ce("More info")}
                  dismissLabel={ce("Got it")}
                />
              </div>
            </SectionCard>

            {/* Supporting Attachments */}
            <SectionCard title={ce("Supporting Attachments")} icon={FileText}>
              {limits.supporting === 0 ? (
                <div className="rounded-xl border border-ink/12 dark:border-white/10 bg-secondary/20 p-5 text-center space-y-3">
                  <Lock className="w-6 h-6 mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">{ce("Attachments (flyers, maps, etc.) are available on Pro and VIP plans.")}</p>
                  <Button size="sm" variant="outline" className="rounded-full text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => navigate(`/events/pricing?return=${encodeURIComponent("/events/events")}`)}>
                    <ArrowUpRight className="w-3 h-3 mr-1" /> {ce("Upgrade Plan")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-muted-foreground">
                      {form.attachments.length + form.attachmentUrls.length} / {limits.supporting} {ce("used")}
                    </p>
                  </div>
                  <div className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-colors",
                    form.attachments.length + form.attachmentUrls.length >= limits.supporting
                      ? "border-amber-500/30 cursor-not-allowed opacity-60"
                      : "border-ink/20 dark:border-white/12 cursor-pointer hover:border-primary/40"
                  )}
                    onClick={() => {
                      if (form.attachments.length + form.attachmentUrls.length >= limits.supporting) {
                        toast.error(cep("Your plan allows {count} attachment(s). Upgrade for more!", { count: limits.supporting }));
                        return;
                      }
                      document.getElementById("event-file-input")?.click();
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragEnter={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      (e.currentTarget as HTMLDivElement).classList.add("border-primary","bg-primary/5");
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      (e.currentTarget as HTMLDivElement).classList.remove("border-primary","bg-primary/5");
                    }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      (e.currentTarget as HTMLDivElement).classList.remove("border-primary","bg-primary/5");
                      const current = form.attachments.length + form.attachmentUrls.length;
                      if (current >= limits.supporting) {
                        toast.error(cep("Your plan allows {count} attachment(s). Upgrade for more!", { count: limits.supporting }));
                        return;
                      }
                      const remaining = limits.supporting - current;
                       const dropped = Array.from(e.dataTransfer.files || []).filter(f =>
                         f.type.startsWith("image/") ||
                         f.type.startsWith("video/") ||
                         f.type.startsWith("audio/") ||
                         f.type === "application/pdf" ||
                         /\.(pdf|jpg|jpeg|png|webp|gif|docx?|mp4|mov|webm|m4v|avi|mkv|mp3|wav|m4a|aac|ogg)$/i.test(f.name)
                       ).slice(0, remaining);
                       if (dropped.length === 0) {
                         toast.error(ce("Unsupported file type. Use PDF, DOC, images, video, or audio."));
                         return;
                       }
                       updateField("attachments", [...form.attachments, ...dropped]);
                       toast.success(cep(dropped.length === 1 ? "Added {count} file" : "Added {count} files", { count: dropped.length }));
                     }}>
                     <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                     <p className="text-xs text-muted-foreground">{ce("Click or drag & drop flyers, maps, schedules, videos, audio (PDF, DOC, images, MP4, MP3)")}</p>
                     <input id="event-file-input" type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.doc,.mp4,.mov,.webm,.m4v,.avi,.mkv,.mp3,.wav,.m4a,.aac,.ogg,image/*,video/*,audio/*"
                      onChange={e => {
                        if (!e.target.files) return;
                        const current = form.attachments.length + form.attachmentUrls.length;
                        const remaining = limits.supporting - current;
                        const files = Array.from(e.target.files).slice(0, remaining);
                        if (files.length > 0) updateField("attachments", [...form.attachments, ...files]);
                        e.target.value = "";
                      }} />
                  </div>
                </>
              )}
              {(form.attachmentUrls.length > 0 || form.attachments.length > 0) && (() => {
                type Combined =
                  | { kind: "url"; idx: number; name: string; url: string }
                  | { kind: "file"; idx: number; name: string; file: File };
                const combined: Combined[] = [
                  ...form.attachmentUrls.map((a, idx) => ({ kind: "url" as const, idx, name: a.name, url: a.url })),
                  ...form.attachments.map((f, idx) => ({ kind: "file" as const, idx, name: f.name, file: f })),
                ];
                const applyOrder = (next: Combined[]) => {
                  const newUrls = next.filter((c) => c.kind === "url").map((c) => {
                    const item = c as Extract<Combined, { kind: "url" }>;
                    return form.attachmentUrls[item.idx];
                  });
                  const newFiles = next.filter((c) => c.kind === "file").map((c) => {
                    const item = c as Extract<Combined, { kind: "file" }>;
                    return form.attachments[item.idx];
                  });
                  updateField("attachmentUrls", newUrls);
                  updateField("attachments", newFiles);
                };
                const move = (from: number, to: number) => {
                  if (to < 0 || to >= combined.length) return;
                  const next = [...combined];
                  const [item] = next.splice(from, 1);
                  next.splice(to, 0, item);
                  applyOrder(next);
                };
                return (
                  <div className="mt-3 space-y-1">
                    {combined.map((c, i) => (
                      <AttachmentPreviewItem
                        key={`${c.kind}-${c.idx}`}
                        name={c.name}
                        url={c.kind === "url" ? c.url : undefined}
                        file={c.kind === "file" ? c.file : undefined}
                        position={i + 1}
                        canMoveUp={i > 0}
                        canMoveDown={i < combined.length - 1}
                        onMoveUp={() => move(i, i - 1)}
                        onMoveDown={() => move(i, i + 1)}
                        onRemove={() => {
                          if (c.kind === "url") {
                            updateField("attachmentUrls", form.attachmentUrls.filter((_, j) => j !== c.idx));
                          } else {
                            updateField("attachments", form.attachments.filter((_, j) => j !== c.idx));
                          }
                        }}
                      />
                    ))}
                  </div>
                );
              })()}
            </SectionCard>

            {/* Summary Preview */}
            <div className="rounded-2xl border border-primary/20 p-5 backdrop-blur-xl"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.02) 100%)" }}>
              <h3 className="text-sm font-semibold text-foreground">{ce("Event Summary")}</h3>
              <p className="mb-3 mt-0.5 text-[11px] text-muted-foreground/70">{ce("Your flyer and event details become shareable once you publish.")}</p>
              {(() => {
                const sym = currencySymbol(form.currency);
                // Date
                let dateLine = ce("TBD");
                if (!form.dateTbd && form.startDate) {
                  dateLine = format(parse(form.startDate, "yyyy-MM-dd", new Date()), "PP", { locale: dateLocale });
                  if (!form.timeTbd && form.startTime) dateLine += " " + ce("at") + " " + form.startTime;
                  if (!form.sameDay && form.endDate && form.endDate !== form.startDate) {
                    dateLine += ` – ${format(parse(form.endDate, "yyyy-MM-dd", new Date()), "PP", { locale: dateLocale })}`;
                  } else if (form.useDuration && form.durationHours) {
                    dateLine += ` · ${form.durationHours}h`;
                  }
                }
                // Location
                let locLine = ce("TBD");
                if (form.locationType === "online") locLine = ce("Online event");
                else if (form.venueName || form.location) locLine = `${form.venueName ? form.venueName + ", " : ""}${form.location}`.trim();
                // Description excerpt (≈2 sentences), with a "more" link back to the field
                const full = descriptionPlainText;
                let excerpt = "";
                if (full) {
                  const sentences = full.match(/[^.!?]+[.!?]+/g);
                  excerpt = sentences ? sentences.slice(0, 2).join(" ").trim() : full;
                  if (excerpt.length > 170) excerpt = excerpt.slice(0, 170).trim() + "…";
                }
                const truncated = full.length > excerpt.length;
                const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 text-muted-foreground/70">{label}</span>
                    <span className="flex-1 text-foreground">{children}</span>
                  </div>
                );
                return (
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-sm"><strong className="text-foreground">{form.eventName || ce("Untitled Event")}</strong></p>
                      <p className="text-muted-foreground/80">
                        {createEventOptionText(lang, form.eventType || "event")}{form.category ? ` · ${createEventOptionText(lang, form.category)}` : ""}{form.visibility !== "public" ? ` · ${createEventOptionText(lang, form.visibility)}` : ""}
                      </p>
                    </div>
                    <div className="space-y-2.5 border-t border-primary/10 pt-3">
                      {excerpt && (
                        <Row label={ce("About")}>
                          <span className="text-muted-foreground">{excerpt}</span>
                          {truncated && (
                            <button type="button"
                              onClick={() => document.getElementById("desc-field")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                              className="ml-1 font-semibold text-primary underline-offset-2 hover:underline">{ce("more")}</button>
                          )}
                        </Row>
                      )}
                      <Row label={ce("When")}>{dateLine}</Row>
                      <Row label={ce("Where")}>{locLine}</Row>
                      <Row label={ce("Tickets")}>
                        {form.ticketMode === "free"
                          ? (form.isUnlimitedCapacity || !form.capacity ? ce("Free · Unlimited spots") : `${ce("Free")} · ${form.capacity} ${ce("spots")}`)
                          : <>
                              {ce("General Admission")} {sym}{form.generalAdmissionPrice || "0"}
                              {form.hasVipTicket ? ` · VIP ${sym}${form.vipPrice || "0"}` : ""}
                              {!form.isUnlimitedCapacity && form.capacity ? ` · ${form.capacity} ${ce("spots")}` : ""}
                            </>
                        }
                      </Row>
                      {(form.includedFoodTickets > 0 || form.includedDrinkTickets > 0) && (
                        <Row label={ce("Included")}>
                          {[
                            form.includedFoodTickets > 0 ? `${form.includedFoodTickets} ${ce("food")}` : "",
                            form.includedDrinkTickets > 0 ? `${form.includedDrinkTickets} ${ce("drink")}` : "",
                          ].filter(Boolean).join(" · ")} {ce((form.includedFoodTickets + form.includedDrinkTickets) > 1 ? "tickets" : "ticket")}
                        </Row>
                      )}
                      {form.hasDiscountCode && form.discountCode && (
                        <Row label={ce("Promo")}>{form.discountCode}{form.discountPercent ? ` · ${form.discountPercent}% ${ce("off")}` : ""}</Row>
                      )}
                      {form.requiresApplication && <Row label={ce("Entry")}>{ce("Requires application")}{form.applicationRequiresApproval ? ` (${ce("approval")})` : ""}</Row>}
                      {form.requireScore && form.minScore > 0 && <Row label={ce("Min score")}>{form.minScore}+</Row>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Bottom actions (Lee, Jul 22): Preview + Form + Save Draft on one
                row, big Publish button below — the primary action bar for the
                whole form, at the very bottom of the page. */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreview} disabled={uploading} className="flex-1 rounded-full text-xs border-ink/20 dark:border-white/12 h-9">
                  <Eye className="w-3.5 h-3.5 mr-1" /> {ce("Preview")}
                </Button>
                {form.requiresApplication && (
                  <Button variant="outline" size="sm" onClick={handleApplicationPreview} disabled={uploading} className="flex-1 rounded-full text-xs border-ink/20 dark:border-white/12 h-9">
                    <FileText className="w-3.5 h-3.5 mr-1" /> {ce("Form")}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDraft} disabled={uploading} className="flex-1 rounded-full text-xs border-ink/20 dark:border-white/12 h-9">
                  {uploading ? ce("Saving…") : ce("Save Draft")}
                </Button>
              </div>
              <Button onClick={handlePublish} disabled={publishDisabled} className="w-full h-11 rounded-full text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-45 disabled:shadow-none">
                <Sparkles className="w-4 h-4 mr-1.5" /> {publishActionLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Publish Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!uploading) { setConfirmOpen(open); if (!open) setPublishing(false); } }}>
        <DialogContent
          onOpenAutoFocus={() => setConfirmMounted(true)}
          onEscapeKeyDown={(event?: Event) => event?.preventDefault()}
          onPointerDownOutside={(event?: Event) => event?.preventDefault()}
          className="bg-card border-ink/20 dark:border-white/12 backdrop-blur-xl"
        >
          <ConfirmMountSignal onMounted={() => setConfirmMounted(true)} />
          <DialogHeader>
            <DialogTitle className="text-foreground">{isEditingPublishedEvent ? ce("Publish changes?") : ce("Publish Event?")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isEditingPublishedEvent
                ? ce("This will update the live event with your latest changes.")
                : ce("This will make your event live and visible to users on Discover Events. Are you sure?")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-secondary/30 border border-ink/12 dark:border-white/10 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">{form.eventName || ce("Untitled")}</p>
            <p className="text-xs text-muted-foreground">{form.category ? createEventOptionText(lang, form.category) : ce("No category")} • {form.locationType === "online" ? ce("Online") : form.location || ce("No location")}</p>
            <p className="text-xs text-primary font-semibold">
              {form.ticketMode === "free" ? ce("Free Event") : `${ce("General Admission")} ${currencySymbol(form.currency)}${form.generalAdmissionPrice}${form.hasVipTicket ? ` / VIP ${currencySymbol(form.currency)}${form.vipPrice}` : ""}`}
            </p>
            {!form.isUnlimitedCapacity && form.capacity && <p className="text-xs text-muted-foreground">{ce("Capacity")}: {form.capacity}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPublishing(false); }} className="border-ink/20 dark:border-white/12">{ce("Cancel")}</Button>
            <Button onClick={confirmPublish} disabled={uploading} className="bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> {uploading ? ce("Publishing...") : ce("Confirm & Publish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={payoutBlockOpen} onOpenChange={setPayoutBlockOpen}>
        <DialogContent className="bg-card border-ink/20 dark:border-white/12 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{ce("Set up payouts to publish this paid event")}</DialogTitle>
            <DialogDescription>
              {ce("Before you can sell tickets, you need to connect a bank account so we can send you the money.")}
            </DialogDescription>
          </DialogHeader>
          <PayoutReadinessBanner variant="block" context="event" returnPath={payoutReturnPath} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutBlockOpen(false)} className="border-ink/20 dark:border-white/12">{ce("Save as draft")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Polished confirmation shown after Stripe redirects back with payouts connected. */}
      <Dialog open={payoutSuccessOpen} onOpenChange={setPayoutSuccessOpen}>
        <DialogContent className="bg-card border-ink/20 dark:border-white/12 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" /> {ce("Payouts connected")}
            </DialogTitle>
            <DialogDescription>
              {ce("Your bank account is linked through Stripe. You're ready to publish this paid event and start selling tickets.")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-emerald-500/[0.08] border border-emerald-500/30 p-3">
            <p className="text-xs font-semibold text-emerald-300">
              {payout.bank_name ? payout.bank_name : ce("Bank account")}
              {payout.bank_last4 ? <> •••• {payout.bank_last4}</> : null}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {payout.country ? <>{payout.country.toUpperCase()}</> : null}
              {payout.default_currency ? <> · {payout.default_currency.toUpperCase()}</> : null}
              {" · "}{ce("Funds settle on Stripe's standard schedule.")}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayoutSuccessOpen(false)} className="border-ink/20 dark:border-white/12">
              {ce("Keep editing")}
            </Button>
            <Button
              onClick={() => { setPayoutSuccessOpen(false); setPayoutBlockOpen(false); }}
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> {ce("Continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AiFlyerStudio
        open={aiFlyerOpen}
        onOpenChange={setAiFlyerOpen}
        mode={aiStudioMode}
        eventId={currentPersistedId}
        title={form.eventName}
        description={form.description}
        category={form.category}
        eventType={form.eventType}
        venueName={form.venueName || form.location}
        startDate={form.startDate}
        startTime={form.startTime}
        ticketsLine={
          form.ticketMode === "free"
            ? ce("Free event")
            : `${ce("General Admission")} ${currencySymbol(form.currency)}${form.generalAdmissionPrice || "0"}${form.hasVipTicket ? ` · VIP ${currencySymbol(form.currency)}${form.vipPrice || "0"}` : ""}`
        }
        includedLine={
          (form.includedFoodTickets > 0 || form.includedDrinkTickets > 0)
            ? `${[form.includedFoodTickets > 0 ? `${form.includedFoodTickets} food` : "", form.includedDrinkTickets > 0 ? `${form.includedDrinkTickets} drink` : ""].filter(Boolean).join(" · ")} ticket${(form.includedFoodTickets + form.includedDrinkTickets) > 1 ? "s" : ""} included`
            : null
        }
        slug={form.slug || null}
        hostName={profile?.full_name || null}
        onAccept={({ fileUrl, file, aspectRatio, flyerFile }) => {
          if (aiStudioMode === "background") {
            setForm(prev => ({
              ...prev,
              coverImage: file,
              coverImageUrl: "",
              coverVideo: null,
              coverVideoUrl: "",
              coverAspectRatio: aspectRatio,
            }));
            setBgPreview(fileUrl);
          } else if (flyerFile) {
            updateField("attachments", [...form.attachments, flyerFile]);
          }
        }}
        onAcceptVideo={({ file, posterFile }) => {
          updateField("attachments", [...form.attachments, file, posterFile]);
          toast.success(ce("Animated flyer saved to supporting media."));
        }}
      />
    </div>
  );
}
