import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, FEE_RATE, FEE_PCT } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { GlassDate, GlassTimePicker, GlassSelect } from "./Pickers";
import PlacesInput from "./PlacesInput";
import { Mic, Sparkles } from "lucide-react";
import { RichTextEditor, stripRichTextHtml } from "@job/components/ui/rich-text-editor";
import SegTabs from "@job/components/SegTabs";
import { VaiaDescriptionModal } from "@job/components/app/VaiaDescriptionModal";
import InfoTip from "@job/components/InfoTip";
import PaymentSheet from "./PaymentSheet";
import { deliverContract } from "@job/lib/deliverContract";
import PhoneInput from "./PhoneInput";
import PayoutSetup from "./PayoutSetup";

/**
 * Is this plausibly a real, deliverable address?
 *
 * Deliberately stricter than `<input type="email">`, which happily accepts "a@b" and
 * "mary.frazier123@icloud..com" — the exact typo that sent one of Lee's contracts into the void on
 * Jul 25 2026. We reject consecutive dots, a leading/trailing dot in either half, a missing TLD, and
 * a one-letter TLD. We do NOT try to be RFC-complete: the goal is to catch the fat-finger mistakes
 * that silently swallow a contract, not to argue with anyone's unusual-but-valid address.
 */
function emailLooksReal(raw: string): boolean {
  const v = raw.trim();
  if (!v || /\s/.test(v) || /\.\./.test(v)) return false;
  const parts = v.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.startsWith(".") || local.endsWith(".")) return false;
  if (!domain || domain.startsWith(".") || domain.endsWith(".") || domain.startsWith("-")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.some((l) => !l)) return false;
  return /^[a-z]{2,}$/i.test(labels[labels.length - 1]);
}
import { fnError, thrownError } from "@job/lib/fnError";
import { fmtDateTimeShort } from "@job/lib/datetime";
import { ACCEPT_WINDOWS, DEFAULT_ACCEPT_HOURS, deadlineFrom, windowLabel, type AcceptWindow } from "@job/lib/acceptWindow";

import { useI18n, W } from "@job/lib/i18n";
import { contractLink } from "@job/lib/oneWorld";
/**
 * OneJob CONTRACT form. NO role inference — the initiator EXPLICITLY selects Payer / Payee,
 * and the counterparty becomes the opposite. Autosaves as a draft on any change.
 * Dates: Start + "Same day" toggle → otherwise an End date (recurring always needs an end date).
 * Location: Building name + Address, both Google Places. Currency shows a flag (glass selector).
 * Preview opens its own screen (formatted contract). Payer without a wallet method → "Set up your
 * payment" routes to the full Wallet screen; once a method exists → "Preview & send" → pay in-app.
 */
const DURATIONS = [1, 2, 3, 5, 8];
const CURRENCIES = [
  { code: "USD", flag: "🇺🇸" }, { code: "EUR", flag: "🇪🇺" }, { code: "COP", flag: "🇨🇴" },
  { code: "MXN", flag: "🇲🇽" }, { code: "BRL", flag: "🇧🇷" }, { code: "THB", flag: "🇹🇭" },
  { code: "INR", flag: "🇮🇳" }, { code: "RUB", flag: "🇷🇺" },
];

/**
 * WINDOWS HAS NO FLAG GLYPHS. Regional-indicator emoji (🇨🇴) render as the two
 * letters "CO" on Windows Chrome — which is exactly what a COP contract showed:
 * "co COP" instead of a Colombian flag. The language selector already solved this
 * with a flagcdn image; the currency picker is now on the same one. Canon: real
 * flag images, never emoji.
 */
const CUR_CC: Record<string, string> = { USD: "us", EUR: "eu", COP: "co", MXN: "mx", BRL: "br", THB: "th", INR: "in", RUB: "ru" };
const CurFlag = ({ code }: { code: string }) => (
  <img src={`https://flagcdn.com/w40/${CUR_CC[code] ?? "us"}.png`} alt=""
       className="inline-block h-3.5 w-5 rounded-[2px] object-cover align-[-2px]" />
);
const flagFor = (c: string) => CURRENCIES.find(x => x.code === c)?.flag ?? "";
// Locale per currency so amounts group the way that country writes money (COP 300.000, USD 300,000.00).
const CUR_LOCALE: Record<string, string> = { USD: "en-US", EUR: "de-DE", COP: "es-CO", MXN: "es-MX", BRL: "pt-BR", THB: "th-TH", INR: "en-IN", RUB: "ru-RU" };
// Currencies typically written without decimals.
const NO_DECIMALS = new Set(["COP", "CLP", "JPY"]);
const FREQS = [{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Contract type — One-time vs Recurring.
 *
 * One indicator that SLIDES, never a background that blinks between options. And the indicator
 * is measured from the active button's own offsetWidth/offsetLeft rather than assumed to be
 * half the track: equal-halves maths desyncs the first time a label is translated, and this app
 * ships in English and Spanish. Re-measures on resize and on font load for the same reason.
 */
/**
 * One-time / Recurring. Now a thin wrapper over the shared SegTabs so this control and the
 * Hire / Find work / My jobs tabs can never drift apart again — this file used to own the only
 * implementation, which is exactly why the other tab strip ended up looking different.
 * (Lee, Jul 31 2026)
 */
function ContractTypeSeg({ recurring, onChange, lang }: { recurring: boolean; onChange: (v: boolean) => void; lang: string }) {
  return (
    <SegTabs<"once" | "rec">
      value={recurring ? "rec" : "once"}
      onChange={v => onChange(v === "rec")}
      options={[{ value: "once", label: W(lang, "One-time", "Una sola vez") }, { value: "rec", label: W(lang, "Recurring", "Recurrente") }]}
    />
  );
}

/** Section header for the create-contract page — matches OneEvent's "Create Event" sections:
 *  a small teal-tinted rounded-square icon chip + a bold title, with a red * when the section
 *  contains a required field. (Lee, Jul 26 2026 — "at least 90% the same as the event page".) */
function SectionHead({ title, d, required }: { title: string; d: string; required?: boolean }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
      </span>
      <h3 className="text-lg font-extrabold tracking-tight">
        {title}{required && <span className="ml-1 text-red-500">*</span>}
      </h3>
    </div>
  );
}

/**
 * ONE CONTRACT FORM. EVERY ENTRY POINT.
 *
 * Lee, 29 Jul 2026: "They definitely have different entry points, but the contract form is
 * effectively the same. Some information is prepopulated depending on the entry point... and then
 * everything else is the same from there."
 *
 * So this component is the single form, and the ONLY thing an entry point may do is prefill:
 *   • Create a contract (My Jobs)  — nothing prefilled, user picks role and counterparty
 *   • Hire from a profile          — recipientId + recipientName + initialRole="payer"
 *   • QR code                      — same, via QRPay
 *
 * Everything downstream — review, payment sheet, send ceremony, draft autosave, accept, complete,
 * payout — is this component's and must never be reimplemented per entry point. `Hire.tsx` used to
 * carry its own parallel form with its own payment call and NO review step and NO draft saving,
 * which is how the Hire path ended up writing `jobs` rows that appeared in nobody's My Jobs.
 */
export default function ContractForm({ recipientId, recipientName, initialRole, conversationId, initialDraftId, autoPreview, onClose, onSent }:
  { recipientId?: string | null; recipientName?: string; initialRole?: "payer" | "payee"; conversationId?: string | null; initialDraftId?: string | null; autoPreview?: boolean; onClose: () => void; onSent?: (id: string) => void }) {
  const { lang } = useI18n();
  const acceptWindowLabel = (hours: number) => W(lang, windowLabel(hours), ({
    6: "6 horas", 12: "12 horas", 24: "1 día", 48: "2 días",
  } as Record<number, string>)[hours] ?? windowLabel(hours));
  const frequencyLabel = (value: string) => ({
    daily: W(lang, "Daily", "Diario"), weekly: W(lang, "Weekly", "Semanal"), monthly: W(lang, "Monthly", "Mensual"),
  } as Record<string, string>)[value] ?? value;
  const dayLabels = lang === "en" ? DOW : ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
  const { user, session } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  // MUST pick — no default. The one exception is an entry point that already knows: hiring someone
  // from their profile or their QR code means you are the payer, and asking would be a question the
  // product already has the answer to.
  const [role, setRole] = useState<"" | "payer" | "payee">(initialRole ?? "");
  const [date, setDate] = useState("");
  const [sameDay, setSameDay] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [fromT, setFromT] = useState("");
  const [hours, setHours] = useState<number | "custom" | null>(null); const [toT, setToT] = useState("");
  const [recurring, setRecurring] = useState(false); const [freq, setFreq] = useState("weekly"); const [days, setDays] = useState<number[]>([]);
  // Recurring PAYMENTS config (subscription-style). Stored inside the recurrence jsonb.
  const [recPay, setRecPay] = useState(false);
  const [recTrigger, setRecTrigger] = useState<"completion" | "scheduled">("completion");
  const [recEndType, setRecEndType] = useState<"date" | "count">("date");
  const [recCount, setRecCount] = useState<string>("");
  // Autopay schedule (when the automatic charge fires): day-of-week (weekly), day-of-month (monthly), + time.
  const [payDow, setPayDow] = useState<number>(1);
  const [payDom, setPayDom] = useState<number>(1);
  const [payTime, setPayTime] = useState<string>("09:00");
  const [desc, setDesc] = useState("");
  const [building, setBuilding] = useState(""); const [address, setAddress] = useState("");
  const [price, setPrice] = useState(""); const [currency, setCurrency] = useState("USD");
  const [attaching, setAttaching] = useState(false); const [attachmentUrl, setAttachmentUrl] = useState("");
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [loadingDraft, setLoadingDraft] = useState(!!initialDraftId);
  const [saved, setSaved] = useState(false);
  const [payoutReady, setPayoutReady] = useState<boolean | null>(null);
  const [hasMethod, setHasMethod] = useState<boolean | null>(null);
  const [methodLabel, setMethodLabel] = useState<string>("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [vaiaOpen, setVaiaOpen] = useState(false);
  /** Set once the person picks "Type it" on the empty-description chooser. Sticky for the life of
   *  the form — the choice is about how you start, not something to re-ask on every keystroke. */
  const [typingChosen, setTypingChosen] = useState(false);
  const [payAgreement, setPayAgreement] = useState<any>(null);
  const [shareToken, setShareToken] = useState<string>("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // Counterparty ("Who is the payer/payee?") — a OneJob member (recipient_id) OR an off-app invitee.
  const [selRecipId, setSelRecipId] = useState<string | null>(recipientId ?? null);
  const [selRecipName, setSelRecipName] = useState<string>(recipientName ?? "");
  const [cpQuery, setCpQuery] = useState("");
  /** Shape returned by search_contract_members v2. `has_account` distinguishes someone who can sign
   *  in today from a profile that exists but has never claimed an account — we can still address a
   *  contract to the latter, we just have to email them a claim link instead of a bell. */
  type CpResult = {
    id: string; full_name: string | null; photo_url?: string | null; job_title?: string | null;
    has_account?: boolean;
    /** "email" | "phone" — how we'd reach them if they're not in-app. */
    contact_kind?: string | null;
    /** MASKED destination, e.g. "j••••@gmail.com". Safe to show the sender; never the raw address. */
    contact_hint?: string | null;
  };
  const [cpResults, setCpResults] = useState<CpResult[]>([]);
  const [selRecipHasAccount, setSelRecipHasAccount] = useState(true);
  const [selRecipContactKind, setSelRecipContactKind] = useState<string | null>(null);
  const [selRecipContactHint, setSelRecipContactHint] = useState<string | null>(null);
  const [invMode, setInvMode] = useState(false);
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invPhone, setInvPhone] = useState("");
  const [invPhoneValid, setInvPhoneValid] = useState(false);
  /**
   * Whether the clock (start time, duration, end time) is showing.
   *
   * Collapsed by default so the common case — "this job is on Tuesday" — is two fields and not
   * six. It opens by itself whenever a time already exists, which covers editing a saved draft,
   * and it is FORCED open below whenever the end time conflicts with the start, because an error
   * message inside a collapsed panel is an error message nobody reads.
   */
  const [timeOpenRaw, setTimeOpen] = useState(false);

  /** Set once a contract is actually out the door — drives the confirmation screen. */
  const [sentInfo, setSentInfo] = useState<{ id: string; to: string; how: string; paid: boolean; acceptHours?: number; deadline?: string | null; heldCents?: number } | null>(null);
  /** How many hours the other side gets to accept before the contract expires and the hold releases. */
  const [acceptHours, setAcceptHours] = useState<AcceptWindow>(DEFAULT_ACCEPT_HOURS);
  /**
   * The stepped authorize→send progress overlay (#38).
   * Lee, Jul 26 2026: "it says authorizing payment, and then once it authorizes, it's just sent. It
   * says successful, contract sent." Money moving in one silent jump from a tap to a closed sheet
   * gives someone no idea what was actually done to their card. Each stage is a real milestone:
   *   authorizing → the PaymentIntent is being created and confirmed
   *   authorized  → the hold exists; nothing has been taken
   *   sending     → notifying / emailing / texting the counterparty
   *   sent        → out the door
   */
  const [sendStage, setSendStage] = useState<null | "authorizing" | "authorized" | "sending" | "sent">(null);

  const symbolFor = (c: string) => (0).toLocaleString("en", { style: "currency", currency: c, maximumFractionDigits: 0 }).replace(/[0-9.,\s]/g, "");
  const endFromDuration = (start: string, h: number) => {
    const [hh, mm] = start.split(":").map(Number);
    const end = (hh * 60 + mm + h * 60) % (24 * 60);
    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  };
  const effectiveTo = hours === "custom" ? toT : (fromT && typeof hours === "number" ? endFromDuration(fromT, hours) : "");
  const effectiveEndDate = (sameDay && !recurring) ? date : endDate;
  const totalN = Number(price) > 0 ? Number(price) * (1 + FEE_RATE) : null;
  const curLocale = CUR_LOCALE[currency] || "en-US";
  const maxFrac = NO_DECIMALS.has(currency) ? 0 : 2;
  const fmt = (n: number) => new Intl.NumberFormat(curLocale, { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: maxFrac }).format(n);
  // Separators for THIS currency's locale, for the live-formatted price input.
  const seps = (() => { const p = new Intl.NumberFormat(curLocale).formatToParts(11111.1); return { g: p.find(x => x.type === "group")?.value ?? ",", d: p.find(x => x.type === "decimal")?.value ?? "." }; })();
  const priceDisplay = (() => {
    if (!price) return "";
    const [ip, dp] = price.split(".");
    const grouped = ip ? Number(ip).toLocaleString(curLocale, { maximumFractionDigits: 0 }) : "0";
    return dp != null ? `${grouped}${seps.d}${dp}` : grouped;
  })();
  const onPriceInput = (raw: string) => {
    let v = raw.split(seps.g).join("");           // drop group separators
    if (seps.d !== ".") v = v.split(seps.d).join("."); // normalize decimal to "."
    v = v.replace(/[^0-9.]/g, "");
    const dot = v.indexOf(".");
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
    if (NO_DECIMALS.has(currency)) v = v.replace(/\./g, "");
    setPrice(v);
  };
  const locationLine = [building, address].filter(Boolean).join(" · ");
  // desc now holds rich HTML (VAIA formatting preserved). Plain-text view for empty-checks + title fallbacks.
  const descPlain = stripRichTextHtml(desc).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  const appLocale = lang === "co" ? "es-CO" : "en-US";
  const calendarDate = (d?: string | null, includeWeekday = false) => {
    if (!d) return "";
    const [year, month, day] = String(d).split("-").map(Number);
    if (!year || !month || !day) return String(d);
    return new Date(year, month - 1, day).toLocaleDateString(appLocale, {
      ...(includeWeekday ? { weekday: "short" as const } : {}),
      month: "short", day: "numeric", year: "numeric",
    });
  };
  const t12 = (t?: string | null) => {
    if (!t) return "";
    const [hour, minute] = String(t).split(":").map(Number);
    if (Number.isNaN(hour)) return String(t);
    return new Date(2000, 0, 1, hour, minute || 0).toLocaleTimeString(appLocale, {
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };
  const timeRange = (from?: string | null, to?: string | null) => from ? (to ? `${t12(from)} – ${t12(to)}` : t12(from)) : "";
  const prettyDate = (d?: string | null) => calendarDate(d, true);
  const durationLabel = (() => {
    if (typeof hours === "number") return `${hours}h`;
    if (fromT && effectiveTo) { const [a1, a2] = fromT.split(":").map(Number); const [b1, b2] = effectiveTo.split(":").map(Number); let mins = (b1 * 60 + b2) - (a1 * 60 + a2); if (mins < 0) mins += 24 * 60; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `${h}h ${m}m` : `${h}h`; }
    return "";
  })();
  // Location split for the preview: NAME line + ADDRESS line, de-duplicated.
  const locName = building.trim();
  const locAddr = address.trim();
  const locSame = locName && locAddr && locName.toLowerCase() === locAddr.toLowerCase();

  // auto-populate name from profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).single()
      .then(({ data }) => { if (data?.full_name) setName(n => n || data.full_name); });
  }, [user?.id]);

  // resume an existing draft (tapped from My Jobs) — prefill every field, then unlock autosave
  useEffect(() => {
    if (!initialDraftId || !user) return;
    let cancelled = false;
    supabase.from("agreements").select("*").eq("id", initialDraftId).single()
      .then(({ data: a, error }) => {
        if (cancelled) return;
        if (error || !a) { setLoadingDraft(false); return; }
        setTitle(a.title || "");
        setRole(a.payer_id === user.id ? "payer" : a.payee_id === user.id ? "payee" : "");
        setSelRecipId(a.recipient_id || null);
        if (a.recipient_id) supabase.from("profiles").select("full_name").eq("id", a.recipient_id).maybeSingle().then(({ data: p }) => { if (!cancelled && p?.full_name) setSelRecipName(p.full_name); });
        if (a.invitee_name || a.invitee_email || a.invitee_phone) { setInvMode(true); setInvName(a.invitee_name || ""); setInvEmail(a.invitee_email || ""); setInvPhone(a.invitee_phone || ""); }
        setDesc(a.description || "");
        setDate(a.start_date || "");
        const same = !a.end_date || a.end_date === a.start_date;
        setSameDay(same);
        setEndDate(same ? "" : (a.end_date || ""));
        setFromT(a.start_time || "");
        if (a.end_time) { setHours("custom"); setToT(a.end_time); }
        setRecurring(!!a.is_recurring);
        if (a.recurrence?.freq) setFreq(a.recurrence.freq);
        if (Array.isArray(a.recurrence?.days)) setDays(a.recurrence.days);
        if (a.recurrence?.payments) {
          setRecPay(true);
          if (a.recurrence.trigger) setRecTrigger(a.recurrence.trigger);
          if (a.recurrence.end?.type === "count") { setRecEndType("count"); if (a.recurrence.end.count) setRecCount(String(a.recurrence.end.count)); }
          else setRecEndType("date");
          if (a.recurrence.payTime) setPayTime(a.recurrence.payTime);
          if (a.recurrence.payDay != null) { if (a.recurrence.freq === "monthly") setPayDom(a.recurrence.payDay); else setPayDow(a.recurrence.payDay); }
        }
        const lp = a.location_place || {};
        setBuilding(lp.building || "");
        setAddress(lp.address || a.location || "");
        if (a.payment_amount != null) setPrice(String(a.payment_amount));
        if (a.currency) setCurrency(a.currency);
        if (a.attachment_url) setAttachmentUrl(a.attachment_url);
        // Only adopt a value we actually offer — a stray 72 from somewhere else would render a row
        // of unselected pills with no way to tell what's in force.
        if (ACCEPT_WINDOWS.includes(a.accept_window_hours)) setAcceptHours(a.accept_window_hours);
        setLoadingDraft(false);
      });
    return () => { cancelled = true; };
  }, [initialDraftId, user?.id]);

  // does the current user (the one who'd pay, if payer) already have a wallet method?
  // Also grab the primary method's label so it shows in the summary + preview ("Visa •••• 2462").
  useEffect(() => {
    if (!user) return;
    supabase.from("payment_methods").select("brand,last4,alias,method_type").eq("user_id", user.id)
      .order("is_primary", { ascending: false }).limit(1)
      .then(({ data }) => {
        const m: any = data?.[0];
        setHasMethod(!!m);
        setMethodLabel(m ? (m.alias || (m.method_type === "card" ? `${m.brand ?? "Card"} •••• ${m.last4 ?? "0000"}`
          : m.method_type === "bancolombia" ? "Bancolombia" : m.method_type === "nequi" ? "Nequi" : "Payment method")) : "");
      });
  }, [user?.id]);

  /**
   * PRESERVE THE FORM ACROSS THE STRIPE ROUND TRIP.
   *
   * Setting up a payout is a full-page redirect out to Stripe and back, which destroys all React
   * state. Lee hit exactly this: he'd typed a job title, tapped "Set up payout", and came back to an
   * empty form. Everything the user has typed goes into sessionStorage on the way out and comes
   * straight back on the way in — keyed per draft so two tabs can't overwrite each other, and with
   * a 30-minute expiry so a stale snapshot never resurrects itself days later.
   */
  const STASH_KEY = `oj:contract-form:${initialDraftId ?? draftId ?? "new"}`;
  const stashFormState = () => {
    try {
      sessionStorage.setItem(STASH_KEY, JSON.stringify({
        at: new Date().toISOString(),
        v: 1,
        s: {
          name, title, role, date, sameDay, endDate, fromT, hours, toT,
          recurring, freq, days, recPay, recTrigger, recEndType, recCount,
          payDow, payDom, payTime, desc, building, address, price, currency,
          attachmentUrl, selRecipId, selRecipName, selRecipHasAccount,
          selRecipContactKind, selRecipContactHint,
          invMode, invName, invEmail, invPhone, invPhoneValid, previewOpen,
          acceptHours,
        },
      }));
    } catch { /* private mode / storage full — the draft row is still the backstop */ }
  };

  // Restore once, on mount, before anything else can overwrite it.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(STASH_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Older than 30 minutes? Not this journey — bin it.
      if (!parsed?.s || Date.now() - new Date(parsed.at).getTime() > 30 * 60_000) {
        sessionStorage.removeItem(STASH_KEY);
        return;
      }
      const s = parsed.s;
      const set = <T,>(fn: (v: T) => void, v: T | undefined) => { if (v !== undefined) fn(v); };
      set(setName, s.name); set(setTitle, s.title); set(setRole, s.role);
      set(setDate, s.date); set(setSameDay, s.sameDay); set(setEndDate, s.endDate);
      set(setFromT, s.fromT); set(setHours, s.hours); set(setToT, s.toT);
      set(setRecurring, s.recurring); set(setFreq, s.freq); set(setDays, s.days);
      set(setRecPay, s.recPay); set(setRecTrigger, s.recTrigger);
      set(setRecEndType, s.recEndType); set(setRecCount, s.recCount);
      set(setPayDow, s.payDow); set(setPayDom, s.payDom); set(setPayTime, s.payTime);
      set(setDesc, s.desc); set(setBuilding, s.building); set(setAddress, s.address);
      set(setPrice, s.price); set(setCurrency, s.currency); set(setAttachmentUrl, s.attachmentUrl);
      set(setSelRecipId, s.selRecipId); set(setSelRecipName, s.selRecipName);
      set(setSelRecipHasAccount, s.selRecipHasAccount);
      set(setSelRecipContactKind, s.selRecipContactKind);
      set(setSelRecipContactHint, s.selRecipContactHint);
      set(setInvMode, s.invMode); set(setInvName, s.invName);
      set(setInvEmail, s.invEmail); set(setInvPhone, s.invPhone);
      set(setInvPhoneValid, s.invPhoneValid);
      set(setPreviewOpen, s.previewOpen);
      if (ACCEPT_WINDOWS.includes(s.acceptHours)) setAcceptHours(s.acceptHours);
      sessionStorage.removeItem(STASH_KEY);
    } catch { /* corrupt snapshot — ignore and start clean */ }
  }, []);

  /**
   * Payout readiness. `null` means STILL CHECKING, and the UI shows a spinner for it rather than
   * flashing "set up your payout" at somebody who just finished setting it up. Coming back from
   * Stripe used to sit on the old state for about a minute before flipping — Lee: "it should
   * continue to spin until it actually populates."
   */
  const checkPayout = async () => {
    setPayoutReady(null);
    try {
      const { data } = await supabase.functions.invoke("stripe-connect-status");
      setPayoutReady(!!(data?.ready ?? data?.payouts_enabled ?? data?.charges_enabled ?? data?.onboarded));
    } catch {
      setPayoutReady(false);
    }
  };

  useEffect(() => {
    if (role !== "payee") return;
    checkPayout();
  }, [role]);

  /**
   * Stripe sends us back with ?success=1 (or ?refresh=1). Re-check immediately instead of waiting
   * for a stale cache to expire, and strip the param so a later reload doesn't re-trigger it.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("success") && !params.get("refresh")) return;
    checkPayout();
    params.delete("success"); params.delete("refresh");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  // Counterparty member search (debounced). Matches on name; skips once a member is picked.
  useEffect(() => {
    const q = cpQuery.trim();
    if (q.length < 2 || selRecipId) { setCpResults([]); return; }
    let cancel = false;
    const tmr = setTimeout(async () => {
      // MUST go through the RPC, not `profiles` directly — it is SECURITY DEFINER and returns a
      // deliberately narrow shape (no emails, no phone numbers) so the search can't be scraped.
      //
      // v2 (Jul 25 2026), after Lee: "Johana should populate — anyone who's in the database
      // already." 1545 of 1547 profiles are migrated waitlist rows with no auth.users record. v1
      // hid them, because agreements.recipient_id FK'd to auth.users and picking one crashed the
      // save. The FK now points at public.profiles, so EVERY real person is selectable; the RPC
      // just flags who has actually claimed an account and sorts those first.
      const { data } = await supabase.rpc("search_contract_members", { q, exclude_id: user?.id ?? null });
      if (!cancel) setCpResults((data as CpResult[] | null) ?? []);
    }, 250);
    return () => { cancel = true; clearTimeout(tmr); };
  }, [cpQuery, selRecipId, user?.id]);

  const me = user?.id;
  const buildRow = (status: string) => ({
    ...(draftId ? { id: draftId } : {}),
    conversation_id: conversationId ?? null,
    sender_id: me, recipient_id: selRecipId ?? null,
    payer_id: role === "payer" ? me : (role === "payee" ? (selRecipId ?? null) : null),
    payee_id: role === "payee" ? me : (role === "payer" ? (selRecipId ?? null) : null),
    invitee_name: selRecipId ? null : (invName.trim() || null),
    invitee_email: selRecipId ? null : (invEmail.trim() || null),
    invitee_phone: selRecipId ? null : (invPhone.trim() || null),
    title: (title.trim() || descPlain.slice(0, 80) || "Untitled contract").slice(0, 80),
    description: desc,
    compensation: price ? String(Number(price)) : null, compensation_type: "fixed",
    payment_amount: price ? Number(price) : null, payment_rail: "stripe",
    start_date: date || null, end_date: effectiveEndDate || null, start_time: fromT || null, end_time: effectiveTo || null,
    is_recurring: recurring,
    recurrence: recurring ? {
      freq, days,
      payments: recPay,
      ...(recPay ? {
        trigger: recTrigger,
        end: recEndType === "count" && Number(recCount) > 0 ? { type: "count", count: Number(recCount) } : { type: "date", date: endDate || null },
        ...(recTrigger === "scheduled" ? { payTime, payDay: freq === "monthly" ? payDom : payDow } : {}),
      } : {}),
    } : null,
    location: address || building || null,
    location_place: (building || address) ? { building: building || null, address: address || null } : null,
    attachment_url: attachmentUrl || null,
    // currency MUST be persisted — it was omitted, so a COP 300.000 draft reloaded as USD
    // and every My Jobs card rendered the wrong symbol. (UAT Jul 25 2026)
    currency: currency || "USD",
    // The chosen accept window travels with the draft. The DEADLINE itself is only stamped at send
    // time (see sendNow) — a deadline on a draft would start a clock nobody has been told about.
    accept_window_hours: acceptHours,
    status, payment_status: "pending",
  });

  /**
   * ────────────────────────────────────────────────────────────────────────────────────────
   * THE ANONYMOUS STASH — what happens when a signed-out visitor finishes the contract.
   *
   * Lee, 29 Jul 2026: "if they fill out the entire contract, they'll be more prone to be patient
   * enough to sign in... Expose them to the contract, at least give them great value." And on the
   * abandoned ones: "it's auto saving in some type of temporary folder... when they register and
   * come back, that temporary file moves into their file. If they never come back, that temporary
   * file just purges."
   *
   * So the visitor never sees a wall until the money step, and nothing they typed is ever lost:
   *
   *   1. everything they typed goes into `quick_hire_drafts` — a row with no owner, a 24h TTL and
   *      an unguessable resume token. `purge_expired_quick_hire_drafts` (cron, hourly at :23)
   *      deletes it if they never come back. That is the "temporary folder".
   *   2. the token goes in localStorage, not sessionStorage — Google OAuth can come back in a
   *      different tab, and sessionStorage is per-tab. Losing the token means losing the contract.
   *   3. /auth?from=/jobs/qr?claim=<token> — sign-up, then straight back to the money step.
   *   4. QRPay calls claim_quick_hire_draft(token), which mints the real agreement OWNED BY THEM.
   *
   * Only reachable from /hire/:proId and /quick-hire/:proId, because those are the only doorways
   * a signed-out person can be standing in — and they are also the only ones where we know the
   * professional, which quick_hire_drafts requires.
   */
  const ANON_TOKEN_KEY = "onejob-anon-draft-token";
  const stashAnonDraftAndSignUp = async () => {
    if (!recipientId) {
      // No professional in context: nothing to stash against. Send them to sign up and come back
      // to a fresh form rather than silently doing nothing, which is what used to happen.
      stashFormState();
      nav(`/auth?from=${encodeURIComponent("/jobs/qr")}`);
      return;
    }
    // 32 hex chars from the platform CSPRNG. The token IS the bearer credential for this draft,
    // so it must not be Math.random().
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

    const payload = {
      title: (title.trim() || descPlain.slice(0, 80) || "Untitled contract").slice(0, 80),
      description: desc,
      payment_amount: price ? String(Number(price)) : "",
      currency: currency || "USD",
      start_date: date || "", end_date: effectiveEndDate || "",
      start_time: fromT || "", end_time: effectiveTo || "",
      location: address || building || "",
    };
    const { error } = await supabase.from("quick_hire_drafts").insert({
      resume_token: token,
      professional_id: recipientId,
      professional_name: recipientName || "Professional",
      job_payload: payload,
      payment_started_at: new Date().toISOString(),
    });
    if (error) { setErr(`Couldn't hold onto this contract. ${error.message}`); return; }

    try { localStorage.setItem(ANON_TOKEN_KEY, token); } catch { /* private mode — the stash row still exists */ }
    stashFormState(); // belt and braces: if the claim ever fails, the typing is still recoverable
    nav(`/auth?from=${encodeURIComponent(`/jobs/qr?claim=${token}`)}`);
  };

  const saveDraft = async () => {
    if (!user) return null;
    const { data, error } = await supabase.from("agreements").upsert(buildRow("draft")).select("id").single();
    if (error) { setErr(`Couldn't save this contract. ${error.message}`); return null; }
    if (data?.id) { if (!draftId) setDraftId(data.id); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    return data?.id ?? draftId;
  };

  // Returning from the wallet (?preview=1) → once the draft is loaded and a method
  // now exists, drop the payer straight back on the preview. Fires once.
  const autoPreviewDone = useRef(false);
  useEffect(() => {
    if (!autoPreview || autoPreviewDone.current || loadingDraft) return;
    if (role === "payer" && hasMethod) { autoPreviewDone.current = true; setPreviewOpen(true); }
  }, [autoPreview, loadingDraft, role, hasMethod]);

  // autosave (debounced) once there's anything meaningful
  useEffect(() => {
    if (!user || loadingDraft || !(role || desc || price || date || title)) return;
    const h = setTimeout(() => { saveDraft(); }, 1200);
    return () => clearTimeout(h);
    // eslint-disable-next-line
  }, [title, role, desc, price, date, sameDay, endDate, fromT, toT, hours, recurring, freq, JSON.stringify(days), recPay, recTrigger, recEndType, recCount, payDow, payDom, payTime, building, address, attachmentUrl, acceptHours]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !user) return;
    setAttaching(true);
    const path = `${user.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("contract-attachments").upload(path, f, { upsert: true });
    // STORE THE PATH, NOT A URL. `contract-attachments` is a PRIVATE bucket as of 29 Jul 2026 —
    // it used to be public, which meant getPublicUrl() handed out a link that read the file for
    // anyone who ever saw it, RLS not consulted. A contract attachment is a scope of work, an
    // invoice, sometimes someone's ID. The path is meaningless without a session; the signed URL
    // is minted on demand by attachmentSignedUrl() below and expires.
    if (error) setErr(`Couldn't attach that file. ${error.message}`);
    else setAttachmentUrl(path);
    setAttaching(false);
  };

  /**
   * Turn whatever is in `attachment_url` into something openable, for 60 minutes.
   *
   * Handles both shapes, because rows written before the bucket went private hold a full public
   * URL rather than a path: anything containing /contract-attachments/ gets the path sliced back
   * out of it. Those old links stopped resolving the moment the bucket flipped, so this is not
   * politeness — it is the only way an existing attachment still opens.
   */
  const attachmentSignedUrl = async (stored: string): Promise<string | null> => {
    if (!stored) return null;
    const marker = "/contract-attachments/";
    const i = stored.indexOf(marker);
    const path = i >= 0 ? decodeURIComponent(stored.slice(i + marker.length).replace(/^public\//, "")) : stored;
    const { data } = await supabase.storage.from("contract-attachments").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const openAttachment = async (stored: string) => {
    const url = await attachmentSignedUrl(stored);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setErr("That attachment isn't available — it may have been removed.");
  };

  // startPayout removed — PayoutSetup owns the whole Stripe round trip now (briefing,
  // spinner-until-navigation, approval confirmation, manage link), shared with Settings.

  const recNeedsEndDate = recurring && !(recPay && recEndType === "count" && Number(recCount) > 0);
  const missing = {
    role: !role, desc: !descPlain, date: !date, price: !(Number(price) > 0),
    endDate: ((!sameDay && !recurring) || recNeedsEndDate) && !endDate,
    // Must know the other party: a picked member OR an invitee with a name + email/phone.
    recipient: !!role && !selRecipId && !(invName.trim() && (invEmail.trim() || invPhone.trim())),
  };
  // Time sanity: only a single-day job with an explicit custom end can be "backwards".
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const singleDay = (sameDay && !recurring) || (!!endDate && endDate === date);
  const timeConflict = hours === "custom" && !!fromT && !!toT && singleDay && toMin(toT) <= toMin(fromT);

  /**
   * The clock shows if the user opened it, OR a time is already set (editing a draft), OR the
   * times conflict — you cannot ask someone to fix an end time they can't see.
   */
  const timeOpen = timeOpenRaw || !!fromT || hours != null || timeConflict;
  const ok = !Object.values(missing).some(Boolean) && !timeConflict;
  const missingList = () => {
    const m: string[] = [];
    if (missing.role) m.push(W(lang, "who you are", "tu rol"));
    if (missing.recipient) m.push(W(lang, "who it’s with", "la otra persona"));
    if (missing.desc) m.push(W(lang, "a description", "una descripción"));
    if (missing.date) m.push(W(lang, "a start date", "una fecha de inicio"));
    if (missing.endDate) m.push(W(lang, "an end date", "una fecha de finalización"));
    if (missing.price) m.push(W(lang, "a price", "un precio"));
    return m;
  };

  // The bottom action depends on role + wallet readiness.
  const primaryLabel =
    // Signed out: never say "Set up your payment" — hasMethod is false only because there is no
    // account yet, and promising a payment screen before a sign-up screen is a lie.
    !user ? W(lang, "Review & continue", "Revisar y continuar")
    : role === "payee" ? W(lang, "Preview", "Vista previa")
    : role === "payer" ? (hasMethod ? W(lang, "Preview", "Vista previa") : W(lang, "Set up your payment", "Configurar tu pago"))
    : W(lang, "Continue", "Continuar");

  const onPrimary = async () => {
    setErr("");
    if (timeConflict) { setErr(W(lang, "End time is before the start time — fix the hours.", "La hora de finalización es anterior a la de inicio. Corrige el horario.")); return; }
    if (!ok) { setErr(W(lang, `Add ${missingList().join(", ")}.`, `Completa: ${missingList().join(", ")}.`)); return; }
    // THE GATE. Not at the top of the form — here, after they have written a real job for a real
    // person and are one tap from paying. saveDraft() returns null for a signed-out user, so
    // before this the button simply did nothing.
    if (!user) { setBusy(true); await stashAnonDraftAndSignUp(); setBusy(false); return; }
    if (role === "payee" && !payoutReady) { setErr(W(lang, "Set up your payout first so you can get paid.", "Configura primero el método para recibir tu pago.")); return; }
    setBusy(true);
    const id = await saveDraft();
    setBusy(false);
    if (!id) return; // saveDraft already surfaced the real error
    if (role === "payer" && !hasMethod) {
      // Wallet screen to add a method, then return straight to this draft's preview.
      nav(`/jobs/wallet?return=${encodeURIComponent(`/jobs/qr?draft=${id}&preview=1`)}`);
      return;
    }
    setPreviewOpen(true);
  };

  // Save the draft, then open the wallet with a return path back to this contract.
  const goToWallet = async () => {
    const id = await saveDraft();
    const ret = id ? `/jobs/qr?draft=${id}&preview=1` : "/jobs/qr";
    nav(`/jobs/wallet?return=${encodeURIComponent(ret)}`);
  };

  const sendNow = async () => {
    setBusy(true); setErr("");
    const id = await saveDraft();
    if (!id) { setBusy(false); return; }
    // The accept clock starts NOW, not when the draft was written. Both parties see the same
    // deadline and `expire-stale-contracts` enforces it.
    const deadline = deadlineFrom(acceptHours);
    // A payer's contract stays a DRAFT until the money is actually held. Flipping it to
    // "pending" here meant abandoning the payment sheet left a live, unpaid contract sitting
    // in the other person's inbox (and in their tab badge). (UAT Jul 25 2026)
    const payerWillPayNow = role === "payer" && selRecipId && !(recurring && recPay);
    if (!payerWillPayNow) {
      await supabase.from("agreements").update({
        status: "pending", accept_window_hours: acceptHours, accept_deadline: deadline,
      }).eq("id", id);
    }
    setBusy(false);
    if (role === "payer" && recurring && recPay) {
      // Recurring-payment contract: NO one-time charge. It activates here and the recurring
      // engine authorizes/charges each cycle on its own schedule (using the saved card).
      onSent?.(id);
    } else if (role === "payer" && selRecipId) {
      // Paying an existing member → authorize the hold now. The window travels with the
      // agreement so the payment sheet's success path can stamp the deadline atomically with "sent".
      setPayAgreement({ agreementId: id, amount: Number(price), recipientId: selRecipId, title: title.trim() || descPlain.slice(0, 80) || "Contract", conversationId, currency, acceptHours, deadline });
    } else {
      // Payee, or a payer inviting a non-member: send the contract; payment happens once they accept + join.
      // Tell them it's waiting. Server-side, because notifying another user, opening their Messages
      // thread and emailing a non-member are all things the browser is (correctly) not allowed to do.
      setSendStage("sending");
      await deliverContract(id);
      setSendStage("sent");
      // A beat on "Contract sent" so the last step is legible, then the confirmation screen.
      await new Promise((r) => setTimeout(r, 550));
      setSendStage(null);
      // Confirm it landed instead of silently closing the sheet — "did that send?" was a real
      // question a user had no way to answer. (Lee, Jul 25 2026)
      setSentInfo({ id, to: delivery?.to || counterpartyName || W(lang, "them", "la otra persona"), how: delivery?.how || "", paid: false, acceptHours, deadline });
    }
  };

  // Guest share — generate (once) a share_token and hand back the public /contract/:token link
  // so a no-app counterparty can view + accept it on the web.
  const shareLink = async () => {
    setErr("");
    if (!ok) { setErr(`Add ${missingList().join(", ")} first.`); return; }
    setShareBusy(true);
    const id = await saveDraft();
    if (!id) { setShareBusy(false); return; }
    // reuse an existing token if there is one; otherwise mint + persist
    let token = shareToken;
    if (!token) {
      const { data: cur } = await supabase.from("agreements").select("share_token").eq("id", id).single();
      token = cur?.share_token || (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 24);
      if (!cur?.share_token) await supabase.from("agreements").update({ share_token: token, status: "pending" }).eq("id", id);
      setShareToken(token);
    }
    const url = contractLink(token);
    setShareBusy(false);
    if (navigator.share) { try { await navigator.share({ title: title.trim() || "OneJob contract", url }); return; } catch { /* fell back */ } }
    try { await navigator.clipboard.writeText(url); setShareCopied(true); setTimeout(() => setShareCopied(false), 1800); }
    catch { setErr(url); }
  };

  /** Who the other side is, whether they came from member search or the invite form. */
  const counterpartyName = (selRecipId ? selRecipName : invName.trim()) || "";

  /**
   * WHERE this contract is about to go, in words, before anyone taps a money button.
   *
   * Lee, Jul 25 2026: "once you click preview, it doesn't say where it's sending it to... below the
   * pay and send button, put in small text who and how it's actually being sent." Sending something
   * you're about to be charged for, with no statement of the destination, is the kind of thing that
   * makes people abandon a checkout — and rightly so.
   *
   * Addresses are shown MASKED (j••••@gmail.com) because they come from a search that any member
   * can run; the sender only needs enough to recognise their own contact.
   */
  const delivery: { to: string; how: string } | null = (() => {
    if (!counterpartyName) return null;
    if (selRecipId) {
      if (selRecipHasAccount) {
        return { to: counterpartyName, how: W(lang, "in the OneJob app — they'll get a notification and a message right away", "en la aplicación OneJob; recibirá una notificación y un mensaje de inmediato") };
      }
      if (selRecipContactHint) {
        return {
          to: counterpartyName,
          how: selRecipContactKind === "phone"
            ? W(lang, `by text to ${selRecipContactHint}`, `por mensaje de texto al ${selRecipContactHint}`)
            : W(lang, `by email to ${selRecipContactHint}`, `por correo electrónico a ${selRecipContactHint}`),
        };
      }
      return { to: counterpartyName, how: W(lang, "by a link you can share with them", "mediante un enlace que puedes compartir") };
    }
    const bits: string[] = [];
    if (invEmail.trim()) bits.push(W(lang, `by email to ${invEmail.trim()}`, `por correo electrónico a ${invEmail.trim()}`));
    if (invPhone.trim()) bits.push(W(lang, `by text to ${invPhone.trim()}`, `por mensaje de texto al ${invPhone.trim()}`));
    if (!bits.length) return { to: counterpartyName, how: W(lang, "— add their email or phone first", "— agrega primero su correo o teléfono") };
    return { to: counterpartyName, how: bits.join(W(lang, " and ", " y ")) };
  })();

  /* A SELECTED OPTION takes the SELECTION colour (#0B0F1A), not teal and not the graphite action
     ramp. Lee, Aug 1 2026: "the selector options you're using, green, supposed to be black."
     A filter is a switch — it doesn't earn brand colour, and a teal chip sitting directly above the
     primary button makes the two compete for the same glance. (One World Labs colour system.) */
  const pill = (active: boolean) => `rounded-full px-3 py-1.5 text-xs font-bold transition ${active ? "bg-selection text-white dark:bg-paper dark:text-ink" : "bg-ink/5 opacity-70 dark:bg-white/10"}`;

  /**
   * ---------- STEPPED SEND OVERLAY (#38) ----------
   *
   * Lee, Jul 26 2026: "it says authorizing payment, and then it just — once it authorizes, it's just
   * sent. It says successful. Contract sent."
   *
   * Three named steps instead of one anonymous spinner. The middle one is the point of the whole
   * thing: "Authorization successful — nothing taken yet." A payer watching a spinner has no idea
   * whether they've just been charged, and that uncertainty is what makes people close the app.
   */
  const SendProgress = () => {
    if (!sendStage) return null;
    const order = ["authorizing", "authorized", "sending", "sent"] as const;
    const at = order.indexOf(sendStage as any);
    const steps: Array<{ key: typeof order[number]; label: string; note: string }> = [
      { key: "authorizing", label: W(lang, "Authorizing payment", "Autorizando el pago"), note: W(lang, "Asking your bank to hold the funds.", "Solicitando a tu banco la retención de los fondos.") },
      { key: "authorized", label: W(lang, "Authorization successful", "Autorización exitosa"), note: W(lang, "Held on your card. Nothing has been taken.", "Retenido en tu tarjeta. No se ha cobrado nada.") },
      { key: "sending", label: W(lang, "Sending the contract", "Enviando el contrato"), note: W(lang, `Notifying ${counterpartyName || "them"}.`, `Notificando a ${counterpartyName || "la otra persona"}.`) },
      { key: "sent", label: W(lang, "Contract sent", "Contrato enviado"), note: W(lang, "They can accept it now.", "Ya pueden aceptarlo.") },
    ];
    // A payee (or a payer inviting a non-member) never authorizes anything here — don't show them
    // two steps about a card that isn't being charged.
    const visible = role === "payer" && selRecipId ? steps : steps.filter((s) => s.key === "sending" || s.key === "sent");
    return (
      <div className="fixed inset-0 z-[92] grid place-items-center bg-black/55 px-6 backdrop-blur-sm">
        <div className="oj-glass-modal oj-pop w-full max-w-sm rounded-3xl p-6">
          <h3 className="text-center text-lg font-extrabold">
            {sendStage === "sent" ? W(lang, "Contract sent ✓", "Contrato enviado ✓") : W(lang, "Hang on a moment…", "Espera un momento…")}
          </h3>
          <ol className="mt-5 space-y-3.5">
            {visible.map((s) => {
              const i = order.indexOf(s.key);
              const done = i < at;
              const now = i === at;
              return (
                <li key={s.key} className="flex items-start gap-3">
                  <span className={
                    done ? "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-deep text-[11px] font-bold text-white"
                      : now ? "mt-0.5 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
                        : "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink/15 text-[11px] opacity-40 dark:border-white/20"
                  }>
                    {done ? "✓" : now ? "" : "•"}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${done || now ? "" : "opacity-40"}`}>{s.label}</p>
                    <p className={`text-[11px] leading-snug ${done || now ? "opacity-65" : "opacity-35"}`}>{s.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 text-center text-[11px] leading-snug opacity-50">
            {W(lang, "Don't close this screen — we're only a second away.", "No cierres esta pantalla; falta muy poco.")}
          </p>
        </div>
      </div>
    );
  };
  const glassSelect = "!bg-white/55 dark:!bg-white/10 backdrop-blur-md !border-white/60 dark:!border-white/15";

  // ---------- SENT CONFIRMATION ----------
  // Before this existed, "Pay & send" just closed the sheet. The money was held, the contract was
  // out, and the sender had no acknowledgement of either — they had to go hunting in My Jobs to
  // find out whether anything happened. (Lee, Jul 25 2026)
  if (sentInfo) {
    return (
      <div className="fixed inset-0 z-[87] overflow-y-auto bg-paper dark:bg-ink">
        <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-brand/15 text-4xl text-brand">✓</div>
          <h1 className="mt-5 text-2xl font-extrabold">{W(lang, `Sent to ${sentInfo.to}`, `Enviado a ${sentInfo.to}`)}</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed opacity-70">
            {W(lang, `${sentInfo.to} has been sent this contract${sentInfo.how ? ` ${sentInfo.how}` : ""} and can now accept it.`, `El contrato se envió a ${sentInfo.to}${sentInfo.how ? ` ${sentInfo.how}` : ""} y ya puede aceptarlo.`)}
          </p>

          {/* ---------- WHAT JUST HAPPENED TO YOUR MONEY ----------
              Lee, Jul 26 2026: "funds were authorized but not taken... a hold will be placed on the
              funds for up to twelve hours." Two facts a payer must have in writing at this exact
              moment: nothing has been charged, and the hold has an end date. Vague reassurance
              ("held safely") is what makes people call support. */}
          {sentInfo.paid && (
            <div className="mt-5 w-full max-w-sm rounded-2xl border border-brand/30 bg-brand/5 p-4 text-left">
              <p className="oj-eyebrow oj-eyebrow--state">{W(lang, "Your money right now", "Tu dinero en este momento")}</p>
              <p className="mt-1.5 text-[13px] font-bold">{W(lang, "Authorized — not taken.", "Autorizado, no cobrado.")}</p>
              <p className="mt-1 text-[12px] leading-snug opacity-70">
                {/* The AMOUNT ACTUALLY CHARGED, reported back by the payment sheet — not the form's
                    pre-promo total. With FOUNDER1 the real hold is $1.00 while this line used to
                    announce "$529.95 is being held against your card". (UAT Jul 26 2026) */}
                {W(lang,
                  `Your bank is holding ${sentInfo.heldCents != null ? fmt(sentInfo.heldCents / 100) : price ? fmt(totalN ?? Number(price)) : "the amount"} against your card. Nothing has left your account, and nothing will unless ${sentInfo.to} accepts.`,
                  `Tu banco mantiene una retención de ${sentInfo.heldCents != null ? fmt(sentInfo.heldCents / 100) : price ? fmt(totalN ?? Number(price)) : "el monto"} en tu tarjeta. No ha salido dinero de tu cuenta y no saldrá a menos que ${sentInfo.to} acepte.`)}
              </p>
              <div className="my-3 h-px bg-brand/20" />
              <p className="text-[12px] leading-snug opacity-70">
                <span className="font-bold opacity-100">{W(lang, `The hold lasts ${acceptWindowLabel(sentInfo.acceptHours ?? acceptHours)}.`, `La retención dura ${acceptWindowLabel(sentInfo.acceptHours ?? acceptHours)}.`)}</span>{" "}
                {sentInfo.deadline ? W(lang, `It ends ${fmtDateTimeShort(sentInfo.deadline, appLocale)}. `, `Termina el ${fmtDateTimeShort(sentInfo.deadline, appLocale)}. `) : ""}
                {W(lang, "If they haven't accepted by then, the contract closes itself and the hold is released automatically — you're never charged for a contract nobody accepted.", "Si no han aceptado para entonces, el contrato se cierra y la retención se libera automáticamente. No se te cobra por un contrato que nadie aceptó.")}
              </p>
              <div className="my-3 h-px bg-brand/20" />
              <p className="text-[12px] leading-snug opacity-70">
                {W(lang, "When they accept, the payment is collected and held by ", "Cuando acepten, el pago será cobrado y resguardado por ")}<span className="font-bold opacity-100">OneJob</span>{W(lang, " — not by them. It only reaches them after you ", ", no por la otra persona. Solo se le entrega después de que ")}<em>{W(lang, "both", "ambos")}</em>{W(lang, " mark the job complete.", " marquen el trabajo como completado.")}
              </p>
            </div>
          )}

          {!sentInfo.paid && (
            <p className="mt-4 max-w-sm text-xs leading-relaxed opacity-60">
              {W(lang, `This contract expires in ${acceptWindowLabel(sentInfo.acceptHours ?? acceptHours)} if it isn't accepted`, `Este contrato vence en ${acceptWindowLabel(sentInfo.acceptHours ?? acceptHours)} si no se acepta`)}
              {sentInfo.deadline ? ` — ${fmtDateTimeShort(sentInfo.deadline, appLocale)}` : ""}{W(lang, ". You can always send it again.", ". Siempre puedes volver a enviarlo.")}
            </p>
          )}

          <p className="mt-3 max-w-sm text-xs leading-relaxed opacity-50">
            {W(lang, "You'll get a notification the moment they accept or decline. Until then you can find it under My Jobs, and withdraw it if you change your mind.", "Recibirás una notificación en cuanto acepten o rechacen. Mientras tanto, lo encontrarás en Mis trabajos y podrás retirarlo si cambias de opinión.")}
          </p>
          {/* FIX-D (Jul 26 2026): Share moved HERE — you can only share a REAL, sent contract, never
              a premature draft. Lee: "you have to process the payment to share the link... once you
              process the payment, then it should show on that screen where it says sent to [name],
              there you should have a button that says share." */}
          <button onClick={shareLink} disabled={shareBusy}
            className="mt-8 flex w-full max-w-xs items-center justify-center gap-1.5 rounded-full border border-brand/30 bg-brand/5 py-3 text-sm font-bold text-brand transition active:scale-[.98]">
            {shareBusy ? "…" : shareCopied ? W(lang, "✓ Link copied", "✓ Enlace copiado") : W(lang, "🔗 Share link", "🔗 Compartir enlace")}
          </button>
          <button onClick={() => { const id = sentInfo.id; setSentInfo(null); onSent?.(id); }}
            className="btn-primary mt-2 w-full max-w-xs">
            {W(lang, "Done", "Listo")}
          </button>
        </div>
      </div>
    );
  }

  // ---------- PREVIEW SCREEN (its own surface) ----------
  if (previewOpen) {
    // Keep VAIA's rich formatting (headings/bold/bullets) in the preview.
    const descHtml = /<\/?[a-z][\s\S]*>/i.test(desc) ? desc : desc.replace(/\n/g, "<br/>");
    return (
      <div className="fixed inset-0 z-[86] overflow-y-auto bg-paper dark:bg-ink">
        <div className="mx-auto max-w-lg px-4 pb-28 pt-5">
          <button onClick={() => setPreviewOpen(false)} className="mb-3 flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">‹ {W(lang, "Back to edit", "Volver a editar")}</button>
          <p className="mb-3 rounded-xl bg-brand/10 px-3 py-2 text-center text-xs font-semibold text-brand">
            {W(lang, `Preview — this is how the ${role === "payer" ? "payee" : "payer"} will see it`, `Vista previa: así lo verá ${role === "payer" ? "el profesional" : "el cliente"}`)}
          </p>

          <div className="overflow-hidden rounded-3xl border border-ink/10 shadow-xl dark:border-white/10">
            <div className="bg-gradient-to-br from-brand/20 via-brand/5 to-transparent px-6 pb-5 pt-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">{W(lang, "OneJob contract", "Contrato de OneJob")}</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight">{title.trim() || descPlain.slice(0, 80) || W(lang, "Untitled contract", "Contrato sin título")}</h1>

              {/* BOTH PARTIES, named and labelled. The preview used to show only your own name and
                  the word "paying" — you couldn't tell from this screen who the contract was even
                  with. Lee, Jul 25 2026: "it doesn't say who the payer is... that needs to be on the
                  preview screen for sure. Your name, a bullet, payer or payee — and the next
                  person's name right below that." Roles are spelled out in plain words because
                  "payer/payee" are one letter apart and easy to misread on a money screen. */}
              <ul className="mt-3 space-y-1.5">
                <PartyLine
                  who={name || W(lang, "You", "Tú")}
                  isYou
                  role={role === "payer" ? "payer" : "payee"}
                  lang={lang}
                />
                <PartyLine
                  who={counterpartyName || (invMode ? "—" : W(lang, "Not selected yet", "Aún sin seleccionar"))}
                  role={role === "payer" ? "payee" : "payer"}
                  muted={!counterpartyName}
                  lang={lang}
                />
              </ul>
            </div>
            <div className="space-y-4 px-6 py-6">
              {descPlain && (
                <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-40">{W(lang, "The job", "El trabajo")}</p>
                  <div className="text-[15px] leading-relaxed opacity-90 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:font-bold [&_ul]:mb-2"
                    dangerouslySetInnerHTML={{ __html: descHtml }} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label={W(lang, "Start date", "Fecha de inicio")}>{prettyDate(date) || "—"}</Field>
                <Field label={W(lang, "Start time", "Hora de inicio")}>{t12(fromT) || "—"}</Field>
                <Field label={recurring ? W(lang, "Ends", "Termina") : W(lang, "End date", "Fecha de finalización")}>
                  {recurring
                    ? (recPay && recEndType === "count" && Number(recCount) > 0 ? W(lang, `After ${recCount} times`, `Después de ${recCount} veces`) : (prettyDate(endDate) || "—"))
                    : sameDay ? W(lang, "Same day", "El mismo día") : (prettyDate(endDate) || "—")}
                </Field>
                <Field label={W(lang, "End time", "Hora de finalización")}>{t12(effectiveTo) || "—"}</Field>
                <Field label={W(lang, "Duration", "Duración")}>{durationLabel || "—"}</Field>
                <Field label={W(lang, "Recurring", "Recurrente")}>{recurring ? `${frequencyLabel(freq)}${days.length ? ` · ${days.map(d => dayLabels[d]).join(", ")}` : ""}` : "No"}</Field>
                {recurring && recPay && (
                  <div className="col-span-2">
                    <Field label={W(lang, "Recurring payments", "Pagos recurrentes")}>
                      {W(lang,
                        `${price ? fmt(Number(price)) : "Price"} ${recTrigger === "completion" ? "each period, released when you both mark it complete" : "auto-charged each period on schedule"}`,
                        `${price ? fmt(Number(price)) : "Precio"} ${recTrigger === "completion" ? "en cada periodo; se libera cuando ambos lo marcan como completado" : "se cobra automáticamente en cada periodo según la programación"}`)}
                    </Field>
                  </div>
                )}
                <div className="col-span-2">
                  <Field label={W(lang, "Location", "Ubicación")}>
                    {locName || locAddr ? (
                      locSame || !locAddr ? (locName || locAddr)
                      : !locName ? locAddr
                      : <><span className="block font-semibold">{locName}</span><span className="block opacity-70">{locAddr}</span></>
                    ) : "—"}
                  </Field>
                </div>
                {/* ATTACHMENT — added 29 Jul 2026. It was possible to attach a file to a contract
                    and then for NOBODY to ever see it: the upload wrote agreements.attachment_url,
                    MyJobs carried the column into its row objects, and not one screen rendered it.
                    A contract that says "scope of work is in the attached PDF" was, in practice, a
                    contract with no scope of work. Opens through a short-lived signed URL because
                    the bucket is private. */}
                {attachmentUrl && (
                  <div className="col-span-2">
                    <Field label={W(lang, "Attachment", "Archivo adjunto")}>
                      <button type="button" onClick={() => openAttachment(attachmentUrl)}
                        className="font-semibold text-brand underline underline-offset-2">
                        {W(lang, "📎 Open attached file", "📎 Abrir archivo adjunto")}
                      </button>
                    </Field>
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-ink/[0.04] p-4 dark:bg-white/[0.06]">
                <div className="flex items-center justify-between text-sm opacity-70"><span>{W(lang, "Amount", "Monto")}</span><span>{price ? fmt(Number(price)) : "—"}</span></div>
                <div className="mt-1 flex items-center justify-between text-sm opacity-70"><span>{W(lang, `Service fee (${FEE_PCT})`, `Tarifa de servicio (${FEE_PCT})`)}</span><span>{totalN ? fmt(totalN - Number(price)) : "—"}</span></div>
                <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-2 font-extrabold dark:border-white/10"><span>Total</span><span>{totalN ? fmt(totalN) : "—"}</span></div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] opacity-50"><CurFlag code={currency} />{currency}</p>
              </div>
            </div>
          </div>

          {role === "payer" && (
            <p className="mt-3 text-center text-xs opacity-60">
              {methodLabel ? <>{W(lang, "You’ll pay with", "Pagarás con")} 💳 {methodLabel} · {W(lang, "only you see this", "solo tú ves esto")}</> : W(lang, "Add a payment method in your wallet before sending.", "Agrega un método de pago en tu billetera antes de enviar.")}
            </p>
          )}

          <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg border-t border-ink/10 bg-paper/95 p-4 backdrop-blur dark:border-white/10 dark:bg-ink/95">
            {/* FIX-D (Jul 26 2026): Share link REMOVED from here — sharing before payment is premature
                (nothing's been sent yet). It now lives on the "Sent to …" confirmation screen, so you
                only ever share a real, active contract. Preview bar is just Revise + Pay & send. */}
            <button onClick={() => setPreviewOpen(false)} className="btn-ghost w-full">{W(lang, "Revise", "Revisar")}</button>
            <button onClick={sendNow} disabled={busy} className="btn-primary mt-2 w-full text-lg">
              {busy ? "…" : role === "payer" ? (recurring && recPay ? W(lang, "Start recurring contract", "Iniciar contrato recurrente") : W(lang, "Pay & send", "Pagar y enviar")) : W(lang, "Send contract", "Enviar contrato")}
            </button>
            {/* Never let anyone tap a money button without knowing who it reaches and how. */}
            {delivery && (
              <p className="mt-2 px-2 text-center text-[11px] leading-snug opacity-60">
                {W(lang, "This contract will be sent to", "Este contrato se enviará a")} <span className="font-semibold opacity-90">{delivery.to}</span> {delivery.how}.
              </p>
            )}
            {err && <p className="mt-2 text-center text-sm text-red-500">{err}</p>}
          </div>

          {/* Pay & send opens the in-app payment sheet (was set in state but never rendered → button did nothing). */}
          {payAgreement && (
            <PaymentSheet
              agreement={payAgreement}
              /* UAT Jul 25 2026: this used to just close the sheet. The card was charged but the
                 row stayed at pending/pending and the counterparty was NEVER notified — the money
                 was held and nobody knew. Mirror HireModal: mark it sent + held, then deliver.
                 Delivery moved server-side (deliverContract) once we found the client-side notify
                 was blocked by RLS for every user except Lee. */
              onStage={(s) => {
                if (s === "failed") { setSendStage(null); return; }
                setSendStage(s);
              }}
              onPaid={async (info) => {
                const paidId = payAgreement.agreementId;
                const hrs = payAgreement.acceptHours ?? acceptHours;
                const dl = payAgreement.deadline ?? deadlineFrom(hrs);
                // A free founder-code contract has no card and no hold. pay-contract-saved already
                // recorded that; overwriting payment_status with "held" here would make the contract
                // claim a hold that does not exist.
                const wasFree = !!info?.free;
                setPayAgreement(null);
                // Let "Authorization successful" actually be read before we move on.
                await new Promise((r) => setTimeout(r, 700));
                setSendStage("sending");
                try {
                  // `authorized_at` is NOT written here any more. It's a money-timeline stamp, and
                  // `guard_agreement_money_columns` now rejects browser writes to those columns —
                  // a party could otherwise forge the whole timeline. `pay-contract-saved` (and
                  // `confirm-contract-authorization` on the 3DS path) stamp it server-side, where
                  // the Stripe result is actually known. (UAT Jul 26 2026)
                  await supabase.from("agreements").update({
                    status: "sent",
                    ...(wasFree ? {} : { payment_status: "held" }),
                    accept_window_hours: hrs,
                    accept_deadline: dl,
                  }).eq("id", paidId);
                  await deliverContract(paidId);
                } catch { /* the charge already succeeded — never block the user on bookkeeping */ }
                setSendStage("sent");
                await new Promise((r) => setTimeout(r, 650));
                setSendStage(null);
                setSentInfo({ id: paidId, to: delivery?.to || counterpartyName || W(lang, "them", "la otra persona"), how: delivery?.how || "", paid: !wasFree, acceptHours: hrs, deadline: dl, heldCents: info?.chargedCents });
              }}
              onClose={() => { setPayAgreement(null); setSendStage(null); }}
            />
          )}

          {/* Sits above the payment sheet (z-92 vs z-88) so the steps are what you watch. */}
          <SendProgress />
        </div>
      </div>
    );
  }

  // ---------- FORM ----------
  return (
    /* Restyled to the OneEvent "Create Event" canon (Lee, Jul 25 2026): a full-screen page with
       the soft teal gradient wash, a modern back pill + title header, and every field group
       rendered as its own white rounded-3xl card (see `.oj-form-stack` in index.css) instead of
       one long flat glass sheet. Same engine, cleaner modern surface. */
    /* v19 CE (Lee, 18 Aug): the form used to sit at z-[85] with NO background — the page
       behind bled through and the form's content visibly scrolled OVER the app header and
       tab bar (both z-40). "Nothing should be on top of the header or the footer." The
       overlay now lives UNDER the chrome (z-30) with an opaque surface, and pads its top
       so the first fields clear the sticky header. */
    <div className="oj-create-page fixed inset-0 z-30 overflow-y-auto bg-paper dark:bg-ink">
      <div className="mx-auto min-h-full w-full max-w-lg px-4 pb-40 pt-20">
        {/* Header row — back pill left, page title right (OneEvent pattern) */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-paper/70 px-2 py-2 backdrop-blur dark:bg-ink/60">
          <button onClick={onClose}
            className="flex h-10 items-center gap-1 rounded-full border border-ink/15 bg-paper/80 pl-2 pr-3.5 text-sm font-bold transition active:scale-[.98] dark:border-white/20 dark:bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            {W(lang, "Back", "Atrás")}
          </button>
          <h2 className="text-lg font-extrabold tracking-tight">{W(lang, "Create Contract", "Crear contrato")}</h2>
        </div>
        <p className="mb-3 px-1 text-xs font-semibold opacity-50">{saved ? W(lang, "✓ Draft saved", "✓ Borrador guardado") : W(lang, "Autosaves as you go.", "Se guarda automáticamente mientras avanzas.")}</p>

        <div className="oj-form-stack space-y-4">
          {/* ── Contract type, lifted to the top ────────────────────────────────────────────
              This is the same `recurring` state the buried "🔁 Recurring job?" toggle used to
              own — same setter, same side effect (turning it on clears same-day, because a
              repeating job by definition spans days). Nothing new reaches the database.

              It moved because the answer to "is this a one-off or does it repeat?" changes what
              the rest of the form should even ask you, and a question that reshapes the form
              belongs above the form, not two sections into it.

              NOTE ON THE MISSING THIRD OPTION: the mock showed One-time / Recurring / HOURLY.
              Hourly is not built — this app prices a contract as one amount, and the hour chips
              below set how LONG the job runs, not a rate to multiply. Shipping a third tab that
              silently does nothing would be worse than not shipping it, so there are two.
              (Lee, 31 Jul 2026 — hourly rates are a real feature, not a layout change.) */}
          <div className="oj-plain">
            <ContractTypeSeg lang={lang} recurring={recurring} onChange={next => {
              setRecurring(prev => {
                if (prev === next) return prev;
                if (next) setSameDay(false);
                return next;
              });
            }} />
          </div>

          <section className="oj-sec">
            <SectionHead title={W(lang, "Contract basics", "Datos básicos del contrato")} d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" required />
          {/* Job title — shows on the draft card + the sent contract */}
          <div><label className="label">{W(lang, "Job title", "Título del trabajo")}</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value.slice(0, 80))}
              placeholder={W(lang, "e.g. Kitchen deep-clean, Logo design", "p. ej. Limpieza profunda, diseño de logotipo")} />
          </div>

          {/* Name */}
          <div><label className="label">{W(lang, "Your name", "Tu nombre")}</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={W(lang, "Your name", "Tu nombre")} /></div>

          {/* Role — explicit, no inference */}
          <div><label className="label">{W(lang, "Who are you in this contract?", "¿Cuál es tu rol en este contrato?")}</label>
            <GlassSelect value={role || ("" as any)} onChange={v => setRole(v as any)} ariaLabel={W(lang, "Your role", "Tu rol")}
              options={[
                { value: "payer" as any, label: W(lang, "Payer — I’m paying for the service", "Cliente — voy a pagar por el servicio") },
                { value: "payee" as any, label: W(lang, "Payee — I’m performing the service", "Profesional — voy a prestar el servicio") },
              ]} />
            {missing.role && <p className="mt-1 text-xs text-red-500">{W(lang, "Please select your role.", "Selecciona tu rol.")}</p>}
          </div>

          {/* Counterparty — who's on the other side. Required so the contract can be sent + charged. */}
          {role && (
            <div>
              <label className="label">Who is the {role === "payer" ? "payee (getting paid)" : "payer (paying)"}?</label>
              {selRecipId ? (
                <div className="rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{(selRecipName || "?").charAt(0)}</span>
                      {selRecipName || "Selected member"}
                    </span>
                    <button type="button" onClick={() => { setSelRecipId(null); setSelRecipName(""); setSelRecipHasAccount(true); setSelRecipContactKind(null); setSelRecipContactHint(null); setCpQuery(""); }} className="text-xs font-bold text-brand">Change</button>
                  </div>
                  {!selRecipHasAccount && (
                    <p className="mt-2 text-[11px] leading-snug opacity-70">
                      They haven’t claimed their OneJob account yet — we’ll email them a link that opens this
                      contract the moment they sign up.
                    </p>
                  )}
                </div>
              ) : !invMode ? (
                <>
                  <input className="input" value={cpQuery} onChange={e => setCpQuery(e.target.value)} placeholder="Search their name or email…" />
                  {cpQuery.trim().length >= 2 && cpResults.length === 0 && (
                    <p className="mt-1.5 text-xs opacity-60">
                      Nobody by that name yet — use <button type="button" onClick={() => setInvMode(true)} className="font-bold text-brand underline">invite them instead</button> and we'll send the contract to their email or phone.
                    </p>
                  )}
                  {cpResults.length > 0 && (
                    <div className="mt-1 overflow-hidden rounded-xl border border-ink/10 dark:border-white/10">
                      {cpResults.map(r => (
                        <button type="button" key={r.id}
                          onClick={() => {
                            setSelRecipId(r.id);
                            setSelRecipName(r.full_name || "Member");
                            setSelRecipHasAccount(r.has_account !== false);
                            setSelRecipContactKind(r.contact_kind ?? null);
                            setSelRecipContactHint(r.contact_hint ?? null);
                            setCpResults([]); setCpQuery("");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand/5">
                          {r.photo_url
                            ? <img src={r.photo_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                            : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{(r.full_name || "?").charAt(0)}</span>}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{r.full_name || "Member"}</span>
                            {r.job_title && <span className="block truncate text-[11px] opacity-60">{r.job_title}</span>}
                          </span>
                          {/* Not a rejection — just sets expectations that this person gets an email
                              invite rather than an in-app notification. */}
                          {r.has_account === false && (
                            <span className="shrink-0 rounded-full bg-ink/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide opacity-60 dark:bg-white/10">Invite</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setInvMode(true)} className="mt-2 text-xs font-bold text-brand">Not on OneJob? Invite by email or phone →</button>
                </>
              ) : (
                <div className="space-y-2">
                  <input className="input" value={invName} onChange={e => setInvName(e.target.value)} placeholder="Their name" />
                  <input className="input" type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="Their email" />
                  {/* Lee typed "mary.frazier123@icloud..com" (two dots) and the contract went out to an
                      address that can't exist. `type="email"` alone accepts it — browsers only check
                      for an @ and a dot. Catch it here, while they can still fix it. (Jul 25 2026) */}
                  {invEmail.trim() && !emailLooksReal(invEmail) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      That email doesn’t look right{/\.\./.test(invEmail) ? " — there’s a double dot in it" : ""}. Double-check it, or they won’t get the contract.
                    </p>
                  )}
                  {/* Country picker + live per-country formatting, and we store E.164 — a bare
                      "3001234567" is unroutable without knowing it's Colombia. (Lee, Jul 25 2026) */}
                  <PhoneInput
                    value={invPhone}
                    onChange={(e164, valid) => { setInvPhone(e164); setInvPhoneValid(valid); }}
                    placeholder="Their phone (for text)"
                  />
                  {invPhone && !invPhoneValid && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      That doesn’t look like a complete number for the country you picked — check it, or leave it blank and use email.
                    </p>
                  )}
                  <p className="text-[11px] opacity-60">We’ll use this to send them the contract by email or text. Add at least an email or a phone.</p>
                  <button type="button" onClick={() => setInvMode(false)} className="text-xs font-bold text-brand">← Search a OneJob member instead</button>
                </div>
              )}
              {missing.recipient && <p className="mt-1 text-xs text-red-500">Add who this contract is with (search a member, or invite by email/phone).</p>}
            </div>
          )}

          {/* Payee payout gate. Shared with Settings so the briefing, the approval modal and the
              manage link can't drift between the two places a pro sets this up. The form snapshot
              happens here, on the way out, because only this screen has state to lose. */}
          {role === "payee" && (
            <PayoutSetup
              returnPath={window.location.pathname + window.location.search}
              onReady={setPayoutReady}
              onBeforeLeave={() => { stashFormState(); saveDraft(); }}
            />
          )}

          </section>
          <section className="oj-sec">
            <SectionHead title={W(lang, "Date & time", "Fecha y hora")} d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" required />
          {/* Schedule — start date + same-day toggle + end date */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">{W(lang, "Start date", "Fecha de inicio")}</label>
              <button type="button" disabled={recurring} onClick={() => { if (!recurring) setSameDay(s => !s); }}
                title={recurring ? "Recurring jobs run across multiple days" : ""}
                className={`flex items-center gap-2 text-xs font-bold ${recurring ? "cursor-not-allowed opacity-40" : ""}`}>
                <span className="opacity-70">{W(lang, "Same day", "El mismo día")}</span>
                <span className={`relative h-5 w-9 rounded-full transition ${sameDay && !recurring ? "bg-teal" : "bg-ink/25 dark:bg-white/25"}`}>
                  <span className={`absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white transition-all ${sameDay && !recurring ? "left-[19px]" : "left-[3px]"}`} /></span>
              </button>
            </div>
            {/* Two dates, side by side — a range reads as a range. Collapses to one column on
                the narrowest phones so neither picker gets squeezed. */}
            <div className={(!sameDay || recNeedsEndDate) ? "grid gap-3 min-[380px]:grid-cols-2" : ""}>
              <GlassDate value={date} onChange={setDate} invalid={missing.date} />
              {(!sameDay || recNeedsEndDate) && (
                <div><label className="label min-[380px]:sr-only">{W(lang, "End date", "Fecha de finalización")}</label>
                  <GlassDate value={endDate} onChange={setEndDate} invalid={missing.endDate} />
                </div>
              )}
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setTimeOpen(o => !o)}
              className="flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left">
              <span className="label !mb-0">
                {W(lang, "Time", "Hora")}
                {!timeOpen && (fromT || hours != null) && (
                  <span className="ml-2 font-bold text-brand">
                    {fromT ? t12(fromT) : ""}{durationLabel ? ` · ${durationLabel}` : ""}
                  </span>
                )}
                {!timeOpen && !fromT && hours == null && (
                  <span className="ml-2 font-semibold opacity-45">{W(lang, "Add a start time and how long", "Agrega la hora de inicio y la duración")}</span>
                )}
              </span>
              <span className={`text-brand transition-transform ${timeOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            <div className={timeOpen ? "mt-1" : "hidden"}>
            <label className="label">{W(lang, "Starts at", "Empieza a las")}</label>
            <GlassTimePicker value={fromT} onChange={setFromT} />
            {/* Durations + Custom on ONE row (Lee: Custom had wrapped onto its own line).
                Tighter padding + nowrap keeps all six on a single line on a phone; Custom is
                italic because it behaves differently from the fixed durations. */}
            <div className="mt-2 flex items-center gap-1 whitespace-nowrap">
              {DURATIONS.map(h => (
                <button key={h} type="button" onClick={() => setHours(hours === h ? null : h)}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-bold transition ${hours === h ? "bg-selection text-white dark:bg-paper dark:text-ink" : "bg-ink/5 opacity-70 dark:bg-white/10"}`}>{h}h</button>
              ))}
              <button type="button" onClick={() => setHours(hours === "custom" ? null : "custom")}
                className={`shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-bold italic transition ${hours === "custom" ? "bg-selection text-white dark:bg-paper dark:text-ink" : "bg-ink/5 opacity-70 dark:bg-white/10"}`}>{W(lang, "Custom", "Personalizado")}</button>
            </div>
            {/* End time — spelled out, in 12-hour time. Was a bare "→ 23:00". */}
            {effectiveTo && hours !== "custom" && (
              <p className="mt-2 text-sm"><span className="font-semibold opacity-60">{W(lang, "End time", "Hora de finalización")}</span>
                <span className="ml-2 font-bold text-brand">{t12(effectiveTo)}</span></p>
            )}
            {hours === "custom" && <div className="mt-2"><label className="label">{W(lang, "End time", "Hora de finalización")}</label><GlassTimePicker value={toT} onChange={setToT} />
              {timeConflict && <p className="mt-1 text-xs text-red-500">{W(lang, "End time must be after the start time.", "La hora de finalización debe ser posterior a la hora de inicio.")}</p>}</div>}
            </div>
          </div>

          {/* Recurring detail — the toggle that used to sit here is now the segmented control at
              the top of the form. Same state, one control instead of two; a setting with two
              places to change it is a setting people stop trusting. The DETAIL stays here,
              because how often and until when are schedule questions. */}
          <div>
            {recurring && (
              <div className="mt-3 space-y-3 rounded-xl bg-ink/5 p-3 dark:bg-white/5">
                <GlassSelect value={freq as any} onChange={v => setFreq(v)} ariaLabel="Repeats" options={FREQS as any} />
                {freq === "weekly" && (
                  <div className="grid grid-cols-7 gap-1">
                    {DOW.map((d, i) => (
                      <button key={i} type="button" onClick={() => setDays(ds => ds.includes(i) ? ds.filter(x => x !== i) : [...ds, i])}
                        className={`rounded-full py-1.5 text-center text-[11px] font-bold transition ${days.includes(i) ? "bg-selection text-white dark:bg-paper dark:text-ink" : "bg-ink/5 opacity-70 dark:bg-white/10"}`}>{d}</button>
                    ))}
                  </div>
                )}
                {/* End condition — by date (set above) or after N times */}
                <div>
                  <label className="label !mb-1 !text-[11px]">Ends</label>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setRecEndType("date")} className={pill(recEndType === "date")}>On end date</button>
                    <button type="button" onClick={() => setRecEndType("count")} className={pill(recEndType === "count")}>After # times</button>
                  </div>
                  {recEndType === "date"
                    ? <p className="mt-1 text-xs opacity-60">Ends on the end date set above.</p>
                    : <div className="mt-2 flex items-center gap-2">
                        <input type="text" inputMode="numeric" value={recCount} onChange={e => setRecCount(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                          placeholder="e.g. 12" className="input !w-24" />
                        <span className="text-xs opacity-60">times, then stop</span>
                      </div>}
                </div>

                {/* Recurring PAYMENTS toggle */}
                <div className="rounded-xl border border-brand/25 bg-brand/[0.05] p-3">
                  <button type="button" onClick={() => setRecPay(v => !v)} className="flex w-full items-center justify-between">
                    <span className="text-sm font-semibold">💳 Recurring payments?</span>
                    <span className={`relative h-6 w-11 rounded-full transition ${recPay ? "bg-teal" : "bg-ink/25 dark:bg-white/25"}`}>
                      <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${recPay ? "left-[23px]" : "left-[3px]"}`} /></span>
                  </button>
                  {recPay && (
                    <div className="mt-3 space-y-2">
                      <label className="label !mb-1 !text-[11px]">Charge the payer</label>
                      <GlassSelect value={recTrigger as any} onChange={v => setRecTrigger(v as any)} ariaLabel="Payment trigger"
                        options={[
                          { value: "completion" as any, label: "When you both mark it complete" },
                          { value: "scheduled" as any, label: "Automatically on the scheduled day" },
                        ]} />
                      {recTrigger === "scheduled" && (
                        <div className="rounded-xl bg-ink/[0.03] p-2.5 dark:bg-white/[0.05]">
                          <label className="label !mb-1 !text-[11px]">Payment day &amp; time</label>
                          {freq !== "daily" && (
                            <GlassSelect
                              value={String(freq === "monthly" ? payDom : payDow) as any}
                              onChange={v => freq === "monthly" ? setPayDom(Number(v)) : setPayDow(Number(v))}
                              ariaLabel={freq === "monthly" ? "Day of month" : "Day of week"}
                              className="mb-2"
                              options={freq === "monthly"
                                ? Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1) as any, label: `Day ${i + 1} of each month` }))
                                : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => ({ value: String(i) as any, label: `Every ${d}` }))} />
                          )}
                          <GlassTimePicker value={payTime} onChange={setPayTime} />
                          <p className="mt-1.5 text-[11px] opacity-55">The charge fires on this {freq === "monthly" ? "day each month" : freq === "daily" ? "time each day" : "day each week"} at {t12(payTime)}.</p>
                        </div>
                      )}
                      <p className="text-xs opacity-70">
                        {price ? fmt(Number(price)) : "The price"} will be {recTrigger === "completion"
                          ? "held each period and released once you both mark that visit complete"
                          : `charged automatically ${freq === "daily" ? "each day" : freq === "monthly" ? `on day ${payDom} each month` : `every ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][payDow]}`} at ${t12(payTime)}`}. Runs {freq}{recEndType === "count" && Number(recCount) > 0 ? ` for ${recCount} times` : " until the end date"}.
                      </p>
                    </div>
                  )}
                </div>

                {recEndType === "date" && <p className="text-xs opacity-60">Recurring jobs need an end date (set it above).</p>}
              </div>
            )}
          </div>

          </section>
          <section className="oj-sec">
            <SectionHead title={W(lang, "The job", "El trabajo")} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" required />
          {/* Description — VAIA composer MODAL (same as OneEvent: avatar header + speak/type → Generate) */}
          <div>
            {/* ── Where "Speak with AI" lives ──────────────────────────────────────────────
                It used to be a filled brand-coloured pill sitting on the label row, opposite "What's the
                job?" — the brightest object in the section, competing with the question it was
                meant to help you answer, and dragging the eye away from the empty box you are
                supposed to type in.

                It now sits UNDER the description box, left-aligned, as a quiet outlined control
                sized to its own text. That ordering matches how the decision actually happens:
                you read the question, you look at the empty box, and THEN you decide whether to
                write it yourself or have VAIA do it. Offering the shortcut before the task reads
                like the app would rather you didn't type.

                Left rather than full-width or centred, because it is an alternative, not the
                primary action — the primary action on this screen is the send bar at the bottom,
                and only one thing should look like that. (Lee, 31 Jul 2026 — his call on
                placement, my call on weight.) */}
            <label className="label">{W(lang, "What’s the job?", "¿Cuál es el trabajo?")} <span className="text-red-500">*</span></label>

            {/* ── SPEAK OR TYPE ─────────────────────────────────────────────────────────────
                Lee, Jul 31 2026: "instead of clicking inside the box like people normally do by
                habit, they should touch inside the box and maybe it gives them two options right
                there — speak your description, or type. If they type it brings up the keyboard
                like normal. If they say speak, it brings up the microphone with AI."

                He's right about the habit, and that's the whole problem: tapping a text box opens a
                keyboard, so every single person types by default and never discovers that talking
                is faster — especially on the screen where they're describing physical work with
                their hands full. Burying the better path behind a small link under the box meant
                almost nobody took it.

                So the empty box IS the chooser. Nothing else. Speaking gets the primary weight
                because it's what we want people to do; typing stays one tap away and looks like a
                normal alternative rather than a punishment.

                It only stands in front of an EMPTY description. The moment there's text — typed,
                dictated, or VAIA-written — this disappears for good and the editor behaves exactly
                as it always has. A chooser that reappeared on every tap would be a tax on editing.
                And an existing draft opens straight into the editor, because that decision was
                already made the first time. */}
            {!descPlain.trim() && !typingChosen ? (
              <div /* Plain border, not a dashed error box. Lee, Jul 31 2026: "you have this red dash border
                     around that section — I don't think you need that either." He's right; a dashed red
                     outline is the app's language for "you got something wrong", and this is just a
                     question being asked before you've had a chance to answer it. */
                  className="rounded-2xl border border-ink/10 bg-brand/[0.035] p-4 dark:border-white/10">
                <p className="text-center text-[13px] font-semibold opacity-70">{W(lang, "How do you want to describe the work?", "¿Cómo quieres describir el trabajo?")}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setVaiaOpen(true)}
                    className="btn-brand flex-[3] !py-3.5 !text-[15px]">
                    <Mic size={18} /> {W(lang, "Speak it", "Describir por voz")}
                  </button>
                  <button type="button" onClick={() => setTypingChosen(true)}
                    className="flex-[2] rounded-2xl border border-ink/20 px-3 py-3.5 text-[15px] font-bold transition active:scale-95 dark:border-white/20">
                    ⌨️ {W(lang, "Type it", "Escribir")}
                  </button>
                </div>
                <p className="mt-2.5 text-center text-[11.5px] leading-snug opacity-55">
                  {W(lang, "Talking is faster — describe the work out loud and VAIA writes the scope for you.", "Hablar es más rápido: describe el trabajo en voz alta y VAIA redacta el alcance.")}
                </p>
              </div>
            ) : (
              <>
                <RichTextEditor value={desc} onChange={html => setDesc(html)} placeholder={W(lang, "Describe the work…", "Describe el trabajo…")} error={missing.desc} />
                {/* Still reachable after you've started typing — changing your mind mid-draft is
                    normal, and VAIA takes what's already in the box as its starting notes. */}
                <div className="mt-2 flex items-center gap-1.5">
                  <button type="button" onClick={() => setVaiaOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/35 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/10 active:scale-95">
                    <Sparkles size={13} /> Speak with AI
                  </button>
                  <InfoTip text="Speak with AI (VAIA) — tap it and describe just the WORK: what will be done and any expectations (dress code, arrive early, perks, greet the host). Skip the date, time, location & price — those have their own fields. VAIA writes a clean contract scope for you." />
                </div>
              </>
            )}
            {/* autoRecord only when they came from the empty-box "Speak it" button. Tapping the
                small "Speak with AI" link further down is a different intent — that person is
                mid-draft and may want to read what they have before talking. */}
            <VaiaDescriptionModal open={vaiaOpen} onClose={() => setVaiaOpen(false)}
              type="contract" title={title.trim() || descPlain.slice(0, 80)} charLimit={2000}
              currentDescription={desc} fieldLabel="Contract description"
              autoRecord={!descPlain.trim() && !typingChosen}
              onApply={html => { setDesc(html); setTypingChosen(true); }} />
          </div>

          </section>
          <section className="oj-sec">
            <SectionHead title={W(lang, "Location", "Ubicación")} d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z M12 9a1 1 0 1 0 0 2a1 1 0 1 0 0-2" />
          {/* Location — building name + address, both Google Places.
              Picking a place splits it: NAME → building field, ADDRESS → address field. */}
          <div><label className="label">{W(lang, "Location", "Ubicación")}</label>
            <div className="space-y-2">
              <PlacesInput value={building} onChange={setBuilding} variant="establishment" placeholder={W(lang, "Building or place name (optional)", "Nombre del edificio o lugar (opcional)")}
                onSelectParts={({ name, address: addr, full }) => { setBuilding(name || full); if (addr) setAddress(addr); }} />
              <PlacesInput value={address} onChange={setAddress} variant="address" placeholder={W(lang, "Street address", "Dirección")}
                onSelectParts={({ name, address: addr, full }) => { setAddress(full); if (name && addr && !building.trim()) setBuilding(name); }} />
            </div>
          </div>

          </section>
          <section className="oj-sec">
            <SectionHead title={W(lang, "Price", "Precio")} d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" required />
          {/* Price + currency (glass selector w/ flag) */}
          <div><label className="label">{W(lang, "Price", "Precio")}</label>
            <div className="flex gap-2">
              <GlassSelect value={currency as any} onChange={v => setCurrency(v)} ariaLabel={W(lang, "Currency", "Moneda")} className={`!w-[124px] shrink-0 ${glassSelect}`}
                options={CURRENCIES.map(c => ({ value: c.code as any, label: (<span className="flex items-center gap-2"><CurFlag code={c.code} />{c.code}</span>) }))} />
              <div className={"input flex min-w-0 flex-1 items-center gap-1" + (missing.price ? " !border-red-400 ring-2 ring-red-300/50" : "")}>
                <span className="shrink-0 font-semibold opacity-60">{symbolFor(currency)}</span>
                <input type="text" inputMode="decimal" className="min-w-0 flex-1 bg-transparent outline-none" value={priceDisplay}
                  onChange={e => onPriceInput(e.target.value)} placeholder={NO_DECIMALS.has(currency) ? "0" : "0.00"} />
              </div>
            </div>
            <p className="mt-1 text-xs opacity-50">{W(lang, `${FEE_PCT} platform fee${totalN ? ` · Total ${fmt(totalN)}` : ""}`, `${FEE_PCT} de tarifa de plataforma${totalN ? ` · Total ${fmt(totalN)}` : ""}`)}</p>
          </div>

          {/* ---------- HOW LONG DO THEY GET TO ACCEPT? ----------
              Lee, Jul 26 2026: "you can put a time frame around how long you want to give people to
              accept the job before the job expires... the job itself will have an expiration. If it
              wasn't accepted, it would just fall off."

              This is a money control, which is why it lives under Price rather than under Date &
              time. Sending a contract puts a real authorization on the payer's card and that reduces
              their available balance — so a contract nobody answers is somebody's money sitting
              frozen. The window is our promise back to them: no answer by then, card released,
              contract closed. `expire-stale-contracts` enforces it every 5 minutes. */}
          <div className="mt-4">
            <label className="label">{W(lang, "How long do they have to accept?", "¿Cuánto tiempo tienen para aceptar?")}</label>
            <div className="flex flex-wrap gap-2">
              {ACCEPT_WINDOWS.map(h => (
                <button key={h} type="button" onClick={() => setAcceptHours(h)}
                  className={pill(acceptHours === h)}>
                  {acceptWindowLabel(h)}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug opacity-55">
              {role === "payer"
                ? W(lang, `If they don't accept within ${acceptWindowLabel(acceptHours)}, the contract closes itself and the hold on your card is released — you're never charged for a contract nobody accepted.`, `Si no aceptan en ${acceptWindowLabel(acceptHours)}, el contrato se cierra y se libera la retención en tu tarjeta. No se te cobra por un contrato que nadie aceptó.`)
                : W(lang, `If they don't accept within ${acceptWindowLabel(acceptHours)}, this contract closes itself and you'll be told. You can always send it again.`, `Si no aceptan en ${acceptWindowLabel(acceptHours)}, el contrato se cierra y recibirás un aviso. Siempre puedes volver a enviarlo.`)}
            </p>
          </div>

          </section>
          <section className="oj-sec">
            <SectionHead title={W(lang, "Attachment", "Archivo adjunto")} d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.5 3.5 0 1 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
          {/* Attachment */}
          <div><label className="label">{W(lang, "Attachment (optional)", "Archivo adjunto (opcional)")}</label>
            <label className="btn-ghost w-full cursor-pointer">
              {attaching ? W(lang, "Uploading…", "Subiendo…") : attachmentUrl ? W(lang, "✓ Attached — replace", "✓ Adjunto — reemplazar") : W(lang, "📎 Add a file", "📎 Agregar un archivo")}
              <input type="file" className="hidden" onChange={onFile} />
            </label>
          </div>

          </section>
          {/* Summary — spaced, readable (no description) */}
          <div className="rounded-2xl border border-ink/10 p-4 dark:border-white/10">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide opacity-40">{W(lang, "Summary", "Resumen")}</p>
            <SummaryRow k={W(lang, "Name", "Nombre")} v={name || "—"} />
            <SummaryRow k={W(lang, "Role", "Rol")} v={role ? (role === "payer" ? W(lang, "Payer (you pay)", "Cliente (tú pagas)") : W(lang, "Payee (you get paid)", "Profesional (tú cobras)")) : "—"} />
            <SummaryRow k={W(lang, "Date", "Fecha")} v={date ? (sameDay ? W(lang, `${calendarDate(date)} (same day)`, `${calendarDate(date)} (el mismo día)`) : `${calendarDate(date)} → ${endDate ? calendarDate(endDate) : "?"}`) : "—"} />
            <SummaryRow k={W(lang, "Time", "Hora")} v={timeRange(fromT, effectiveTo) || "—"} />
            <SummaryRow k={W(lang, "Recurring", "Recurrente")} v={recurring ? `${frequencyLabel(freq)}${days.length ? ` (${days.map(d => dayLabels[d]).join(",")})` : ""}` : "No"} />
            <SummaryRow k={W(lang, "Location", "Ubicación")} v={locationLine || "—"} />
            <SummaryRow k={W(lang, "Price", "Precio")} v={price ? fmt(Number(price)) : "—"} />
            <SummaryRow k={W(lang, "Accept within", "Aceptar antes de")} v={acceptWindowLabel(acceptHours)} />
          </div>

          {/* Paying with — its own actionable box (change / add a method) */}
          {role === "payer" && (
            <div className="flex items-center gap-3 rounded-2xl border border-ink/10 p-3.5 dark:border-white/10">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-base">💳</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-40">{W(lang, "Paying with", "Método de pago")}</p>
                <p className="truncate text-sm font-semibold">{methodLabel || W(lang, "No method yet", "Aún no hay método")}</p>
              </div>
              <button type="button" onClick={goToWallet}
                className="shrink-0 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand">
                {methodLabel ? W(lang, "Change", "Cambiar") : W(lang, "Add", "Agregar")}
              </button>
            </div>
          )}
        </div>

        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

        {/* ── The send bar ────────────────────────────────────────────────────────────────
            Sits at the natural end of the form. It was sticky for a while, on the theory that a
            long form hides its primary action — but Lee, Jul 31 2026: "you will never click that
            button unless you've completed the form and you're at the bottom, so there's no point
            in having it be a sticky button."

            He's right, and the sticky version was actively worse than the reasoning that produced
            it: a permanently-visible Continue on a form with required fields still empty invites
            people to press it and collect an error, and it ate a strip of screen on every single
            scroll of an already long form. The reassurance line about the Vault reads better here
            too — it lands as the last thing you read before committing rather than as furniture
            parked over the field you're typing in. */}
        <div className="mt-5">
          <button onClick={saveDraft} className="btn-ghost w-full">{W(lang, "Save draft", "Guardar borrador")}</button>
        </div>

        <div className="mt-4" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
          <button onClick={onPrimary} disabled={busy} className="btn-primary w-full text-lg">
            {busy ? "…" : primaryLabel}
          </button>
          {role === "payer" && hasMethod === false ? (
            <p className="mt-1.5 text-center text-[11px] opacity-55">{W(lang, "Add an available payment method, then return to send.", "Agrega un método de pago disponible y luego vuelve para enviar.")}</p>
          ) : (
            <p className="mt-1.5 text-center text-[11px] opacity-55">{W(lang, "The contract shows the payment status before you send it.", "El contrato muestra el estado del pago antes de enviarlo.")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One line of the "who's on this contract" list at the top of the preview.
 *
 * The words matter more than the layout here. "Payer" and "Payee" differ by a single letter, and
 * this is the screen where someone commits money — so each role carries its plain-English meaning
 * in parentheses, exactly as Lee specified: the client paying for the service, and the professional
 * performing the services.
 */
function PartyLine({ who, role, isYou, muted, lang }: {
  who: string; role: "payer" | "payee"; isYou?: boolean; muted?: boolean; lang: string;
}) {
  const label = role === "payer" ? W(lang, "Payer", "Cliente") : W(lang, "Payee", "Profesional");
  const meaning = role === "payer" ? W(lang, "the client paying for the service", "quien paga por el servicio") : W(lang, "the professional performing the services", "quien presta el servicio");
  return (
    <li className={`flex items-start gap-2 ${muted ? "opacity-50" : ""}`}>
      <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${role === "payer" ? "bg-brand" : "bg-ink/40 dark:bg-white/40"}`} />
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-snug">
          {who}{isYou && <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-brand">{W(lang, "You", "Tú")}</span>}
        </span>
        <span className="block text-[11px] leading-snug opacity-60">
          <span className="font-semibold">{label}</span> ({meaning})
        </span>
      </span>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-ink/[0.03] px-3 py-2 dark:bg-white/[0.05]">
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-40">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{children}</p>
    </div>
  );
}
function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs opacity-50">{k}</span>
      <span className="min-w-0 flex-1 truncate text-right text-sm font-medium">{v}</span>
    </div>
  );
}
