import ReservationPaymentHelp from "../components/ReservationPaymentHelp";
import ReservationHoldStatus from "../components/ReservationHoldStatus";
import { useListingFeeWaiver } from "../lib/useListingFeeWaiver";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W,
  IconPlus, ScreenHeading, GlassDate, GlassSelect, GlassTime, coverMergeValues,
} from "@oneworld/shell";
import {
  ADDENDUMS, COLOMBIA_BASELINE_READY, buildSnapshot, sha256, cyclesBetween, addInterval, isoDate,
  hostFeeOverTerm, guestFeeOverTerm, hostFee, guestFee, netToManager, totalDueFromGuest,
  rentalError, type Property, type BillInterval, PROPERTY_COLUMNS,
  PAYOUT_FIRST_DAYS, PAYOUT_LATER_DAYS,
} from "../lib/rental";
import {
  renderCoLease, renderCoSelectedClauses, selectedCoLeaseSections, missingTemplateKeys, fillTemplate, placeholdersIn,
  CO_LEASE_SECTIONS, CO_OPTIONAL_SECTIONS, SIGNER_TITLES, CO_RESIDENTIAL_DAYS,
} from "../lib/coTemplate";
import { rentalMoney } from "../lib/requestDisplay";
import LeasePreview from "./LeasePreview";
import MonthlyRentalPanel from '../components/MonthlyRentalPanel';

const IMPORTED_TERM_LABELS: Record<string, { en: string; es: string }> = {
  inspection_days: { en: "Move-in inspection window", es: "Plazo de inspección de entrega" },
  response_days: { en: "Response window", es: "Plazo de respuesta" },
  renewal_notice_days: { en: "Renewal notice", es: "Aviso de renovación" },
  late_fee_terms: { en: "Late payment", es: "Pago tardío" },
  utilities_responsibility: { en: "Utilities", es: "Servicios" },
  maintenance_responsibility: { en: "Maintenance", es: "Mantenimiento" },
  subletting_allowed: { en: "Subletting", es: "Subarriendo" },
  early_termination_terms: { en: "Early termination", es: "Terminación anticipada" },
  escalation_basis: { en: "Rent adjustment basis", es: "Base del reajuste del canon" },
  escalation_notes: { en: "Rent adjustment details", es: "Detalles del reajuste del canon" },
  governing_law: { en: "Governing law", es: "Ley aplicable" },
  jurisdiction: { en: "Jurisdiction", es: "Jurisdicción" },
  check_in_time: { en: "Check-in time", es: "Hora de entrada" },
  check_out_time: { en: "Check-out time", es: "Hora de salida" },
};

const DEFAULT_CONTRACT_FIELDS: Record<string, string> = {
  arrendador_doc_tipo: "C.C.",
  arrendatario_doc_tipo: "Pasaporte",
  dias_aviso: "15",
  dias_habiles_pago: "5",
  dias_devolucion: "5",
};

function importedTermNumber(value: unknown, min: number, max: number): number | null {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function importedTermBoolean(value: unknown): boolean | null {
  if (/^(true|yes|si|sí|1)$/i.test(String(value ?? "").trim())) return true;
  if (/^(false|no|0)$/i.test(String(value ?? "").trim())) return false;
  return null;
}

function addImportedHostTerms(
  base: string,
  property: Property,
  language: "en" | "es",
): string {
  if (!property.owner_terms_enabled) return base;
  const terms = property.imported_contract_terms || {};
  const rows = Object.entries(IMPORTED_TERM_LABELS)
    .filter(([key]) => String(terms[key] ?? "").trim())
    .map(([key, label]) => `${label[language]}: ${String(terms[key]).trim()}.`);
  const notes = (property.imported_contract_unmapped || [])
    .filter(row => row?.label && row?.value)
    .map(row => `${row.label}: ${row.value}.`);
  if (!rows.length && !notes.length) return base;
  const heading = language === "es" ? "CONDICIONES ESPECÍFICAS DEL PROPIETARIO" : "HOST-SPECIFIC TERMS";
  const intro = language === "es"
    ? "El propietario revisó y aprobó estas condiciones importadas antes de guardar el inmueble:"
    : "The host reviewed and approved these imported terms before saving the property:";
  return `${base.trim()}\n\n${heading}\n${intro}\n${[...rows, ...notes].map(row => `• ${row}`).join("\n")}`;
}

/**
 * /rentals/r/:id/contract — PHASE 3. Draft, addendums, signature, snapshot.
 * ============================================================================================
 * Lee, 10 Aug 2026, and this screen is his paragraph turned into a flow:
 *
 *   *"We'll kinda have them upload that. And then, basically, when they accept it, we'll just
 *   take a snapshot, and then we'll time stamp it with the person's signature and say, whoever,
 *   Lee Frazier signed it at October fifth nine fifty-five PM. So that way there's a contract,
 *   and it has a stamped signature, and it shows the same thing for both parties. And then both
 *   people can always pull it up as a contract if they ever want to show it, print it, save it,
 *   share it."*
 *
 * And on the addendums:
 *
 *   *"Some stuff is addendum stuff, and then some stuff is Colombia stuff… we can allow people
 *   to optionally select the addendums if it's applicable… maybe like a one-paragraph, a one or
 *   two sentence summary for each page. So the person who's looking at this, they'll know
 *   exactly what they're selecting. If they don't wanna read the whole thing, at least they'll
 *   have a summary… a new user comes along and they don't wanna read eighteen pages, but they
 *   know that that's the actual agreement, and they can read it if they want to."*
 *
 * So every addendum shows a short summary by default. After the owner acknowledges the optional
 * instructions, tapping a card selects it and reveals the full clause plus any required details.
 *
 * ⚠️ THE COLOMBIAN BASELINE IS NOT IN THE PICKER YET. Lee is sending his own last Colombian
 * lease to be the baseline. Writing Ley-820 residential language from memory and labelling it
 * "the Colombian agreement" would be worse than shipping nothing — an unenforceable lease that
 * looks official is the most damaging thing this product could put in front of a tenant. Until
 * his document arrives and counsel has read it, UPLOAD-YOUR-OWN is the path, and it is complete:
 * upload, addendums, both signatures, snapshot, hash, and a copy either party can open forever.
 */
export default function ContractScreen() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const selectedRequest=searchParams.get('request');
  const listingFee = useListingFeeWaiver(id);
  const { lang } = useI18n();
  const { userId, displayName } = useOneId();
  const nav = useNavigate();
  const es = lang === "es" || lang === "co";
  const L: "en" | "es" = es ? "es" : "en";

  const property = useAsync(async () => {
    const [{ data }, addressResult] = await Promise.all([
      supabase.from("rental_properties").select(PROPERTY_COLUMNS).eq("id", id).maybeSingle(),
      supabase.rpc("rental_property_address", { p_property_id: id }),
    ]);
    return data ? ({ ...(data as unknown as Record<string, unknown>), address_line: typeof addressResult.data === "string" ? addressResult.data : null } as unknown as Property) : null;
  }, [id]);

  /* Private, owner-only facts are collected once in the host profile. They never join a public
     listing query; this owner screen reads only the signed-in user's own row. */
  const hostProfile = useAsync(async () => {
    if (!userId) return null;
    const { data } = await supabase.from("rental_host_profiles")
      .select("role,legal_name,document_kind,document_number,private_address_line,private_city,private_region,private_country")
      .eq("user_id", userId).maybeSingle<any>();
    return data ?? null;
  }, [userId], !!userId);
  const hostReadiness = useAsync(async () => {
    if (!userId) return null;
    const { data } = await supabase.rpc("rental_host_profile_readiness");
    return (Array.isArray(data) ? data[0] : data) as { profile_ready?: boolean } | null;
  }, [userId], !!userId);

  const [requestRefresh, setRequestRefresh] = useState(0);

  const request = useAsync(async () => {
    if (!userId) return null;
    let query = supabase.from("rental_booking_requests")
      .select("id, guest_id, starts_on, ends_on, nights, quoted_total, currency, state, created_at, approval_stage, preapproval_expires_at, expires_at, identity_status, payment_rail, payment_status, payment_declared_at, payment_declared_by, payment_reference, host_pays_guest_fee, host_fee_rate, guest_fee_rate, guest_total, host_net")
      .eq("property_id", id)
      .order("created_at", { ascending: false }).limit(1);
    if(selectedRequest) query=query.eq('id',selectedRequest);
    else query=query.in('state',['requested','accepted']);
    const {data}=await query.maybeSingle<any>();
    if (!data) return null;
    const { data: guest } = await supabase.from("profiles").select("full_name").eq("id", data.guest_id).maybeSingle<any>();
    const {data:period}=await supabase.from('rental_monthly_periods').select('starts_on,rental_monthly_agreements(starts_on,monthly_rent,currency)').eq('request_id',data.id).maybeSingle<any>();
    const monthly=period?.rental_monthly_agreements;
    return { ...data, guest_name: guest?.full_name ?? null,monthly,isRenewal:!!monthly && monthly.starts_on!==period.starts_on };
  }, [id, userId, requestRefresh,selectedRequest], !!userId);

  const identityDocument = useAsync(async () => {
    if (!request?.id || !userId) return null;
    const { data } = await supabase.from("rental_request_identity_documents")
      .select("id, storage_path, document_kind, side, mime_type, review_status, rejection_reason, created_at")
      .eq("request_id", request.id).order("created_at", { ascending: false }).limit(1).maybeSingle<any>();
    if (!data) return null;
    const { data: signed } = await supabase.storage.from("rental-request-identity")
      .createSignedUrl(data.storage_path, 300);
    return { ...data, signed_url: signed?.signedUrl ?? null };
  }, [request?.id, userId, requestRefresh], !!request?.id && !!userId);

  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [startsOn, setStartsOn] = useState(isoDate(new Date()));
  const [months, setMonths] = useState("12");
  const [nights, setNights] = useState("7");
  const [docText, setDocText] = useState("");
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const [signName, setSignName] = useState("");
  /* WHO IS SIGNING, IN WHAT CAPACITY (Lee, 10 Aug). Defaults to manager because that is who
     nine listings out of ten are actually posted by — the owner is the exception. */
  const [signTitle, setSignTitle] = useState<string>("manager");
  /* THE INSPECTION WINDOW. Lee: *"the whole window can't last more than like five days… maybe
     we give them seven, but they can't be lingering around."* Bounded here AND by a database
     check constraint, because a deadline a screen can move is a deadline that decides a deposit. */
  const [inspectionDays, setInspectionDays] = useState(5);
  const [responseDays, setResponseDays] = useState(2);
  /* Every blank in the Colombian template, as a form. `useTemplate` switches between the
     fill-in-the-blanks path and the upload-your-own path. */
  const [useTemplate, setUseTemplate] = useState(true);
  const [f, setF] = useState<Record<string, string>>({ ...DEFAULT_CONTRACT_FIELDS });
  const set = (k: string) => (e: { target: { value: string } }) =>
    setF(c => ({ ...c, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preapprovalHours, setPreapprovalHours] = useState("24");
  const [requestStage, setRequestStage] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [showLifecycleBlockers, setShowLifecycleBlockers] = useState(false);
  const [addendumInstructionsUnderstood, setAddendumInstructionsUnderstood] = useState(false);
  const [editingLeaseDetails, setEditingLeaseDetails] = useState(!selectedRequest);
  const [agreementExpanded, setAgreementExpanded] = useState(false);
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);
  const draftKey = useMemo(
    () => `ow-onehome-contract-draft-v2:${userId || "signed-out"}:${id}:${selectedRequest || "direct"}`,
    [userId, id, selectedRequest],
  );
  const ownerTermsAllowed = property?.owner_terms_enabled === true;

  const focusField = (key: string) => {
    const container = document.getElementById(`lease-field-${key}`);
    const target = container?.matches("input,textarea,button")
      ? container as HTMLElement
      : container?.querySelector<HTMLElement>("input,textarea,button,[tabindex]");
    target?.focus();
    container?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const focusSection = (id: string) => {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  async function notifyRequest() {
    if (!request?.id) return;
    await supabase.functions.invoke("rental-request-notify", { body: { requestId: request.id } });
  }

  async function reviewIdentity(approve: boolean) {
    if (!request?.id) return;
    const reason = approve ? null : window.prompt(W(lang,
      "Tell the tenant what needs to be corrected.",
      "Indique al arrendatario qué debe corregir."));
    if (!approve && !reason?.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("review_rental_request_identity", {
      p_request_id: request.id, p_approve: approve, p_reason: reason,
    });
    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    if (request.payment_status !== 'received') await notifyRequest();
    setRequestRefresh(v => v + 1);
  }

  async function confirmExternalPayment() {
    if (!request?.id) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("confirm_rental_external_payment", {
      p_request_id: request.id, p_reference: paymentReference.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    setRequestStage((data as any)?.approval_stage ?? request.approval_stage);
    setRequestRefresh(v => v + 1);
  }

  async function finalizeApproval() {
    if (!request?.id) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.functions.invoke("rental-finalize-approval", {
      body: { requestId: request.id },
    });
    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    setRequestStage("approved");
    setRequestRefresh(v => v + 1);
  }

  async function preapproveRequest() {
    if (!request?.id || !userId || !property) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("preapprove_rental_request", {
      p_request_id: request.id,
      p_hours: Number(preapprovalHours),
    });
    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    setRequestStage((data as any)?.approval_stage
      ?? (request.identity_status === "approved" ? "preapproved_ready" : "preapproved_id_required"));
    const { error: notifyError } = await supabase.functions.invoke("rental-request-notify", {
      body: { requestId: request.id },
    });
    if (notifyError) setErr(W(lang,
      "The pre-approval is saved, but one or more notifications could not be sent. Use Messages to contact the tenant while we retry.",
      "La preaprobación se guardó, pero no se pudieron enviar una o más notificaciones. Use Mensajes para contactar al inquilino mientras reintentamos."));
    setRequestRefresh(v => v + 1);
  }

  useEffect(() => {
    if (!request || !property) return;
    setTenantName(request.guest_name ?? "");
    setStartsOn(request.starts_on);
    if (property.price_unit === "night") setNights(String(request.nights || 1));
    else {
      const a = new Date(request.starts_on + "T00:00:00");
      const b = new Date(request.ends_on + "T00:00:00");
      setMonths(String(Math.max(1, Math.round((b.getTime() - a.getTime()) / (30 * 86_400_000)))));
    }
  }, [request?.id, property?.id]);

  useEffect(() => {
    setInspectionDays(5);
    setResponseDays(2);
    if (!property?.id || !property.owner_terms_enabled) return;
    const terms = property.imported_contract_terms || {};
    const importedInspection = importedTermNumber(terms.inspection_days, 1, 7);
    const importedResponse = importedTermNumber(terms.response_days, 1, 5);
    if (importedInspection != null) setInspectionDays(importedInspection);
    if (importedResponse != null) setResponseDays(importedResponse);
  }, [property?.id, property?.owner_terms_enabled]);

  /* The listing decision is authoritative. A stale browser draft must not reopen the custom
     contract path after the host has turned supplemental owner terms off. */
  useEffect(() => {
    if (property && !property.owner_terms_enabled) setUseTemplate(true);
  }, [property?.id, property?.owner_terms_enabled]);

  /* The grey placeholder looked filled but still counted as blank in Lee's screenshots. Put the
     signed-in person's real display name into state so the field, preview and saved bytes agree. */
  useEffect(() => {
    if (!displayName) return;
    setSignName(current => current || displayName);
    setF(current => current.arrendador_nombre
      ? current
      : { ...current, arrendador_nombre: displayName });
  }, [displayName, hydratedDraftKey]);

  useEffect(() => {
    if (!hostProfile || hydratedDraftKey !== draftKey) return;
    const documentLabel: Record<string, string> = {
      passport: "Pasaporte", national_id: "C.C.", residence_permit: "C.E.", nit: "NIT",
    };
    const signerLabel: Record<string, string> = {
      owner: "owner", property_manager: "manager", agent: "agent",
    };
    /* Protected profile facts are authoritative. A display alias or stale browser draft must
       never win over the verified legal identity used in the agreement. */
    setSignName(hostProfile.legal_name || displayName || "");
    setSignTitle(signerLabel[hostProfile.role] || "manager");
    setF(current => ({
      ...current,
      arrendador_nombre: hostProfile.legal_name || displayName || "",
      arrendador_doc_tipo: documentLabel[hostProfile.document_kind] || DEFAULT_CONTRACT_FIELDS.arrendador_doc_tipo,
      arrendador_doc: hostProfile.document_number || "",
      arrendador_direccion: [
        hostProfile.private_address_line, hostProfile.private_city, hostProfile.private_region, hostProfile.private_country,
      ].filter(Boolean).join(", "),
    }));
  }, [hostProfile, hydratedDraftKey, draftKey, displayName]);

  useEffect(() => {
    if (!property || hydratedDraftKey !== draftKey) return;
    setF(current => ({
      ...current,
      direccion: current.direccion || property.address_line || "",
      dias_aviso: current.dias_aviso === DEFAULT_CONTRACT_FIELDS.dias_aviso
        ? String(property.lease_notice_days ?? 15) : current.dias_aviso,
      dias_habiles_pago: current.dias_habiles_pago === DEFAULT_CONTRACT_FIELDS.dias_habiles_pago
        ? String(property.payment_window_business_days ?? 5) : current.dias_habiles_pago,
      dias_devolucion: current.dias_devolucion === DEFAULT_CONTRACT_FIELDS.dias_devolucion
        ? String(property.deposit_return_days ?? 30) : current.dias_devolucion,
      sancion: current.sancion || money(Number(property.price || 0) * Number(property.breach_penalty_months ?? 1)),
      canon_renovacion: current.canon_renovacion || money(Number(property.price || 0)),
    }));
  }, [property?.id, hydratedDraftKey, draftKey]);

  /* A long legal form must survive a reload. The draft is scoped to this browser, One ID,
     property and request; it is cleared after a successful send. */
  useEffect(() => {
    /* A mounted route can move from request A to request B without remounting this component.
       Reset every request-scoped value before reading B. Otherwise A's identity can paint into B
       for one render and the persistence effect can save it under B's key. */
    setHydratedDraftKey(null);
    setF({ ...DEFAULT_CONTRACT_FIELDS });
    setTenantEmail("");
    setTenantName("");
    setStartsOn(isoDate(new Date()));
    setMonths("12");
    setNights("7");
    setDocText("");
    setDocUrl(null);
    setPicked([]);
    setSignName(displayName || "");
    setSignTitle("manager");
    setInspectionDays(5);
    setResponseDays(2);
    setUseTemplate(true);
    setShowValidation(false);
    setShowLifecycleBlockers(false);
    setAddendumInstructionsUnderstood(false);
    setEditingLeaseDetails(!selectedRequest);
    setErr(null);
    setPaymentReference("");
    setRequestStage(null);
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, any>;
        if (saved.f && typeof saved.f === "object") setF({ ...DEFAULT_CONTRACT_FIELDS, ...saved.f });
        if (typeof saved.tenantEmail === "string") setTenantEmail(saved.tenantEmail);
        if (typeof saved.tenantName === "string") setTenantName(saved.tenantName);
        if (typeof saved.startsOn === "string") setStartsOn(saved.startsOn);
        if (typeof saved.months === "string") setMonths(saved.months);
        if (typeof saved.nights === "string") setNights(saved.nights);
        if (Array.isArray(saved.picked)) setPicked(saved.picked.filter((key: unknown) => typeof key === "string"));
        if (typeof saved.signName === "string") setSignName(saved.signName);
        if (typeof saved.signTitle === "string") setSignTitle(saved.signTitle);
        if (Number.isFinite(saved.inspectionDays)) setInspectionDays(saved.inspectionDays);
        if (Number.isFinite(saved.responseDays)) setResponseDays(saved.responseDays);
        if (typeof saved.useTemplate === "boolean") setUseTemplate(saved.useTemplate);
        if (typeof saved.addendumInstructionsUnderstood === "boolean") setAddendumInstructionsUnderstood(saved.addendumInstructionsUnderstood);
        if (typeof saved.docText === "string") setDocText(saved.docText);
        if (typeof saved.docUrl === "string" || saved.docUrl === null) setDocUrl(saved.docUrl);
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
    /* State, not a ref: the persistence effect from the old render must still see the old scope
       and refuse to write. The new key becomes writable only in the committed render that also
       contains the reset-or-loaded fields. */
    setHydratedDraftKey(draftKey);
  }, [draftKey, displayName]);

  useEffect(() => {
    if (hydratedDraftKey !== draftKey) return;
    try {
      /* Government IDs and the host's home address come back from protected tables. They do not
         belong in localStorage, even inside an account-scoped draft key. */
      const {
        arrendador_doc: _hostDocument,
        arrendatario_doc: _tenantDocument,
        arrendador_direccion: _hostAddress,
        ...draftFields
      } = f;
      localStorage.setItem(draftKey, JSON.stringify({
        f: draftFields, tenantEmail, tenantName, startsOn, months, nights, picked, signName, signTitle,
        inspectionDays, responseDays, useTemplate, docText, docUrl, addendumInstructionsUnderstood,
      }));
    } catch {
      /* Private browsing/storage denial must not make the contract form unusable. */
    }
  }, [hydratedDraftKey, draftKey, f, tenantEmail, tenantName, startsOn, months, nights, picked,
    signName, signTitle, inspectionDays, responseDays, useTemplate, docText, docUrl,
    addendumInstructionsUnderstood]);

  const interval: BillInterval = property?.price_unit === "night" ? "days" : "months";
  const count = interval === "days" ? (Number(nights) || 1) : 1;
  const totalMonths = Number(months) || 1;

  const endsOn = useMemo(() => {
    if(request?.monthly)return request.ends_on;
    const start = new Date(startsOn + "T00:00:00");
    return isoDate(interval === "days" ? addInterval(start, "days", count)
                                       : addInterval(start, "months", totalMonths));
  }, [startsOn, interval, count, totalMonths,request?.id]);

  /* ── LEY 820 ART. 16 — THE DEPOSIT GATE ────────────────────────────────────────────────
     A cash deposit, or any other caución real, may not be required on an urban housing lease,
     and a clause that breaches it is void by operation of law. Decreto 2590 de 2009 takes
     habitual sub-30-day stays out of the residential regime, so that is where the line sits.
     30 days or more is treated as residential — the boundary above 30 is genuinely contested
     and the cost of being wrong runs one direction only.

     Measured from the CONTRACT DATES, not from the listing's price unit. A property advertised
     nightly can still be let for six months, and it is the lease in front of us that the statute
     looks at. */
  const stayDays = useMemo(() => {
    const a = Date.parse(startsOn), b = Date.parse(endsOn);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    return Math.round((b - a) / 86_400_000);
  }, [startsOn, endsOn]);
  /* Unknown dates are treated as residential. The safe default is the one that cannot create a
     void clause. */
  const isResidential = stayDays === null || stayDays >= CO_RESIDENTIAL_DAYS;

  /* Someone can pick the deposit clause on a 10-day stay and then push the end date out to six
     months. Hiding the checkbox is not enough — the key is still in `picked`, and it would render
     into the contract. Drop it when the lease crosses the line. */
  useEffect(() => {
    if (!isResidential) return;
    const gated = new Set(ADDENDUMS.filter(a => a.shortStayOnly).map(a => a.key));
    setPicked(c => (c.some(k => gated.has(k)) ? c.filter(k => !gated.has(k)) : c));
  }, [isResidential]);

  const cycles = useMemo(
    () => cyclesBetween(startsOn, endsOn, interval, count),
    [startsOn, endsOn, interval, count],
  );
  const rent = Number(request?.monthly?.monthly_rent ?? property?.price ?? 0);
  const dep = property?.deposit_required ? (property.deposit_amount ?? 0) : 0;
  const contractCurrency = request?.monthly?.currency ?? request?.currency ?? property?.currency ?? "USD";
  const money = (amount: number) => rentalMoney(amount, contractCurrency, lang);
  const includeShortStayDeposit = !isResidential && dep > 0;

  /* ONE source of the filled values. The preview on screen and the bytes that get signed are
     built from this same object — if they were built twice, they would eventually differ, and
     "the contract I read is not the contract I signed" is the worst defect this product could
     have. */
  const tv = useMemo(() => ({
    ...coverMergeValues(lang, money),
    ...f,
    direccion: f.direccion || property?.address_line || "",
    ciudad: property?.city ?? "",
    area: property?.area_m2 ?? f.area ?? "",
    amoblado: property?.furnished
      ? (L === "es" ? "entregado amoblado" : "handed over furnished")
      : (L === "es" ? "sin amoblar" : "unfurnished"),
    duracion: interval === "days"
      ? `${count} ${L === "es" ? "noches" : "nights"}`
      : `${totalMonths} ${L === "es" ? "meses" : "months"}`,
    fecha_inicio: startsOn,
    fecha_fin: endsOn,
    arrendatario_nombre: tenantName,
    canon: property ? money(rent) : "",
    canon_renovacion: request?.monthly ? money(rent) : f.canon_renovacion || (property ? money(property.price) : ""),
    deposito: property?.deposit_required ? money(property.deposit_amount ?? 0) : "",
    sancion: request?.monthly ? "0" : f.sancion || (property?.deposit_required ? money(property.deposit_amount ?? 0) : ""),
    dias_aviso: request?.monthly ? "15" : f.dias_aviso,
    servicios_incluidos: f.servicios_incluidos ||
      (L === "es" ? "Agua, energía, gas, internet y administración"
                  : "Water, power, gas, internet and building fees"),
  }), [f, property, interval, count, totalMonths, startsOn, endsOn, tenantName, L, lang,
    request?.id, request?.monthly, contractCurrency, rent]);

  const selectedSections = useMemo(
    () => selectedCoLeaseSections(picked, includeShortStayDeposit),
    [picked, includeShortStayDeposit],
  );
  const draftAgreementBody = useMemo(() => {
    if (!property) return "";
    const base = useTemplate
      ? renderCoLease({ lang: L, values: tv, addendumKeys: picked, includeShortStayDeposit })
      : `${docText.trim()}${picked.length ? `\n\n${renderCoSelectedClauses({ lang: L, values: tv, addendumKeys: picked })}` : ""}`;
    return addImportedHostTerms(base, property, L);
  }, [property, useTemplate, L, tv, picked, includeShortStayDeposit, docText]);
  const customDocumentUrl = useAsync(async () => {
    if (!docUrl || useTemplate) return null;
    if (/^https?:\/\//i.test(docUrl)) return docUrl;
    const { data } = await supabase.storage.from("contract-attachments").createSignedUrl(docUrl, 300);
    return data?.signedUrl ?? null;
  }, [docUrl, useTemplate], !!docUrl && !useTemplate);
  const missingKeys = useMemo(
    () => missingTemplateKeys(selectedSections, L, tv),
    [selectedSections, L, tv],
  );
  const selectedOptionalSections = useMemo(() => {
    const chosen = new Set(picked);
    return CO_OPTIONAL_SECTIONS.filter(section => chosen.has(section.key));
  }, [picked]);
  const optionalMissingKeys = useMemo(
    () => missingTemplateKeys(selectedOptionalSections, L, tv),
    [selectedOptionalSections, L, tv],
  );
  const activeMissingKeys = useTemplate ? missingKeys : optionalMissingKeys;
  const blanks = activeMissingKeys.length;
  const requestPaymentReady = !request || ["authorized", "captured", "received"].includes(request.payment_status);
  const requestStageValue = requestStage ?? request?.approval_stage;
  const requestApprovalReady = !request || requestStageValue === "approved";
  const requestExpired = !!request && (request.state === "expired" || new Date(request.expires_at).getTime() <= Date.now());
  const hostSetupReady = hostReadiness?.profile_ready === true;
  const lifecycleReady = hostSetupReady && (!selectedRequest || !!request)
    && (!request || (request.identity_status === "approved" && requestPaymentReady && requestApprovalReady));
  const lifecycleBlockers = useMemo<Array<{ id: string; text: string }>>(() => {
    if (!selectedRequest) return hostSetupReady ? [] : [{ id: "lease-host-profile", text: W(lang,
      "Complete your private host profile before signing this lease.",
      "Complete su perfil privado de anfitrión antes de firmar este contrato.") }];
    if (!request) return [{ id: "lease-request-lifecycle", text: W(lang,
      "The selected tenant request is still loading or is no longer available.",
      "La solicitud seleccionada todavía está cargando o ya no está disponible.") }];
    if (requestStageValue === "requested" && requestExpired) return [{ id: "lease-request-lifecycle", text: W(lang,
      "This request expired. Ask the tenant to submit a new rental request before you collect identity or payment.",
      "Esta solicitud venció. Pida al arrendatario que envíe una nueva solicitud antes de recopilar identidad o pago.") }];
    if (requestStageValue === "requested") return [{ id: "lease-request-preapproval", text: W(lang,
      "Pre-approve this tenant. OneHome will ask them for their identity and payment in the same request.",
      "Preapruebe a este arrendatario. OneHome le pedirá la identidad y el pago en la misma solicitud.") }];
    const blockers: Array<{ id: string; text: string }> = [];
    if (request.identity_status !== "approved") blockers.push({ id: "lease-request-identity", text: W(lang,
      request.identity_status === "submitted"
        ? "Review the identity the tenant submitted."
        : "The tenant has not submitted their identity yet.",
      request.identity_status === "submitted"
        ? "Revise la identificación que envió el arrendatario."
        : "El arrendatario aún no ha enviado su identificación.") });
    if (!requestPaymentReady) blockers.push({ id: "lease-request-payment", text: W(lang,
      request.payment_rail === "stripe"
        ? "The tenant's card authorization is still pending."
        : request.payment_declared_at
          ? `Confirm the ${request.payment_rail || "transfer"} payment only after it appears in your account.`
          : `The tenant has not marked the ${request.payment_rail || "transfer"} payment as sent yet.`,
      request.payment_rail === "stripe"
        ? "La autorización de la tarjeta del arrendatario aún está pendiente."
        : request.payment_declared_at
          ? `Confirme el pago por ${request.payment_rail || "transferencia"} solo cuando aparezca en su cuenta.`
          : `El arrendatario aún no ha marcado como enviado el pago por ${request.payment_rail || "transferencia"}.`) });
    if (!blockers.length && !requestApprovalReady) blockers.push({ id: "lease-request-final-approval", text: W(lang,
      "Approve the tenant and lock the requested dates.",
      "Apruebe al arrendatario y bloquee las fechas solicitadas.") });
    if (!blockers.length && !hostSetupReady) blockers.push({ id: "lease-host-profile", text: W(lang,
      "Complete your private host profile before signing this lease.",
      "Complete su perfil privado de anfitrión antes de firmar este contrato.") });
    return blockers;
  }, [selectedRequest, request, requestStageValue, requestExpired, requestPaymentReady, requestApprovalReady, hostSetupReady, lang]);
  const lifecycleIssue = lifecycleBlockers[0]?.text ?? null;
  useEffect(() => {
    if (showValidation && blanks === 0) setErr(current => current?.startsWith("Complete ") || current?.startsWith("Complete los ") || current?.startsWith("Complete el ") ? null : current);
  }, [showValidation, blanks]);
  const contractHostRate = request ? Number(request.host_fee_rate) : listingFee.waived ? 0 : (property?.host_pays_guest_fee ? 0.09 : 0.015);
  const contractGuestRate = request ? Number(request.guest_fee_rate) : listingFee.waived ? 0 : (property?.host_pays_guest_fee ? 0 : 0.075);
  const hostTotalFee = hostFeeOverTerm({ rent, cycles, rate: contractHostRate });
  const guestTotalFee = guestFeeOverTerm({ rent, cycles, rate: contractGuestRate });

  async function upload(file: File | null) {
    if (!file || !userId) return;
    setBusy(true); setErr(null);
    /* PRIVATE. The Colombian template carries both parties' names, their passport or cédula
       numbers, the street address, and — in the deposit-return addendum — a bank account and the
       holder's ID. That was going into a world-readable bucket until the launch audit caught it.
       `contract-attachments` is already private and already accepts PDFs and documents. */
    const path = `${userId}/rental-contracts/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("contract-attachments").upload(path, file);
    if (error) { setErr(error.message); setBusy(false); return; }
    setDocUrl(path);   // stored as a PATH; opened through a short-lived signed URL
    /* A PDF cannot be read into the snapshot in the browser, so the snapshot names the file and
       carries its hash. The signed bytes are still verifiable; they simply live in the file. */
    setDocText(t => t || W(lang,
      `The agreement is the attached document: ${file.name}.`,
      `El acuerdo es el documento adjunto: ${file.name}.`));
    setBusy(false);
  }

  /**
   * SEND IT. The contract row is created with BOTH the terms and the manager's signature stamp;
   * the tenant's stamp lands when they accept, and only then is the snapshot frozen.
   *
   * No fee rate is sent — the database stamps `host_fee_rate`, `guest_fee_rate` and the derived
   * total, then freezes all three at signing. A rate the client could set is one it could set wrong.
   */
  async function send() {
    if (!userId || !property) return;
    /* A tenant decision comes before contract drafting. Do not send the host into a blank legal
       field while the request itself is still waiting for pre-approval, ID or payment. */
    if (!lifecycleReady) {
      setErr(null);
      setShowLifecycleBlockers(true);
      return;
    }
    if (activeMissingKeys.length) {
      setEditingLeaseDetails(true);
      setShowValidation(true);
      setErr(W(lang,
        `Complete the ${activeMissingKeys.length} required field${activeMissingKeys.length === 1 ? "" : "s"}. The first one is ready for you below.`,
        `Complete ${activeMissingKeys.length === 1 ? "el campo obligatorio" : `los ${activeMissingKeys.length} campos obligatorios`}. El primero está listo abajo.`));
      requestAnimationFrame(() => focusField(activeMissingKeys[0]));
      return;
    }
    if (!useTemplate && docText.trim().length <= 20) {
      setErr(W(lang,
        "Add the agreement text or upload the agreement before continuing.",
        "Agregue el texto del contrato o suba el contrato antes de continuar."));
      document.getElementById("lease-field-contract-text")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!(signName.trim() || displayName)) {
      setErr(W(lang, "Enter the signer's full name.", "Ingrese el nombre completo de quien firma."));
      focusField("sign_name");
      return;
    }
    setShowValidation(false);
    setBusy(true); setErr(null);
    const now = new Date().toISOString();
    const name = signName.trim() || displayName || "";
    const t = SIGNER_TITLES.find(x => x.key === signTitle);
    const titleLabel = t ? (L === "es" ? t.es : t.en) : "";

    /* The signed bytes come from the SAME values the preview rendered — never from a second
       build of the same document. */
    const body = draftAgreementBody;
    const importedTerms = property.owner_terms_enabled ? (property.imported_contract_terms || {}) : {};
    const renewalNoticeDays = importedTermNumber(importedTerms.renewal_notice_days, 0, 365);
    const sublettingAllowed = importedTermBoolean(importedTerms.subletting_allowed);

    const { data, error } = await supabase.from("rental_contracts").insert({
      property_id: property.id,
      booking_request_id: request?.id ?? null,
      agent_id: userId,
      tenant_id: request?.guest_id ?? null,
      tenant_name: tenantName.trim() || null,
      tenant_email: tenantEmail.trim() || null,
      starts_on: startsOn,
      ends_on: endsOn,
      bill_interval: interval,
      bill_interval_count: count,
      rent_amount: rent,
      deposit_required: !!dep,
      deposit_amount: dep || null,
      document_url: useTemplate ? null : docUrl,
      addendum_keys: picked,
      agent_signed_title: titleLabel,
      /* Lee's ceiling and floor, sent explicitly. The database re-checks both. */
      inspection_days: inspectionDays,
      response_days: responseDays,
      renewal_notice_days: renewalNoticeDays,
      late_fee_terms: importedTerms.late_fee_terms || null,
      utilities_responsibility: importedTerms.utilities_responsibility || null,
      maintenance_responsibility: importedTerms.maintenance_responsibility || null,
      subletting_allowed: sublettingAllowed,
      early_termination_terms: importedTerms.early_termination_terms || null,
      escalation_basis: importedTerms.escalation_basis || null,
      escalation_notes: importedTerms.escalation_notes || null,
      governing_law: importedTerms.governing_law || null,
      jurisdiction: importedTerms.jurisdiction || null,
      check_in_time: importedTerms.check_in_time || null,
      check_out_time: importedTerms.check_out_time || null,
      imported_doc_kind: property.owner_terms_enabled ? property.imported_doc_kind : null,
      imported_at: property.owner_terms_enabled ? property.imported_at : null,
      /* Held as a DRAFT of the snapshot until the tenant signs. The database only freezes it
         once it is written alongside a signature, so re-sending before acceptance is allowed. */
      contract_snapshot: null,
      terms_extra: {
        draft_body: body,
        imported_unmapped: property.owner_terms_enabled ? (property.imported_contract_unmapped || []) : [],
      },
      agent_signed_at: now,
      agent_signed_name: name,
      status: "sent",
      sent_at: now,
    }).select("id, host_fee_rate, guest_fee_rate").single();

    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    /* Preparing a contract must never silently accept the stay. Final acceptance is a separate
       server-controlled transition after identity approval and payment authorization/receipt. */
    /* The database owns the current rates and stamps both onto the row. The draft uses those
       returned values, not today's client constants, so the final signed copy cannot disagree
       with the frozen billing contract. */
    const snapshot = buildSnapshot({
      documentText: body,
      /* `body` already contains every selected clause. Passing the keys again would append
         a second, unfilled copy during snapshot construction. */
      addendumKeys: [],
      lang: L,
      agent: { name: `${name}${titleLabel ? ` · ${titleLabel}` : ""}`, at: now },
      tenant: null,                                  // stamped on acceptance, not before
      property: `${property.title} — ${[property.neighbourhood, property.city].filter(Boolean).join(", ")}`,
      term: `${startsOn} → ${endsOn}`,
      rent: money(rent),
      deposit: dep ? money(dep) : null,
      hostFeeAmount: money(hostFee(rent, Number(data!.host_fee_rate))),
      guestFeeAmount: money(guestFee(rent, Number(data!.guest_fee_rate))),
      totalPlatformFees: money(hostFee(rent, Number(data!.host_fee_rate)) + guestFee(rent, Number(data!.guest_fee_rate))),
    });
    /* Keep the draft text with the row so the acceptance screen rebuilds the identical bytes. */
    sessionStorage.setItem(`ow-rental-draft-${data!.id}`, snapshot);
    localStorage.removeItem(draftKey);
    nav(productHref("onerental", `/c/${data!.id}`));
  }

  if (property === undefined) {
    return <div className="py-6"><div className="card ow-shimmer h-64" /></div>;
  }
  if (!property || property.agent_id !== userId) {
    return (
      <div className="py-12 text-center text-sm opacity-60">
        {W(lang, "Only the person who listed this place can draft its contract.",
                 "Solo quien publicó este inmueble puede redactar su contrato.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScreenHeading titlePriority>
        {W(lang, "Review request & prepare contract", "Revisar solicitud y preparar contrato")}
      </ScreenHeading>
      <p className="mt-1 text-[12.5px] opacity-60">{property.title}</p>

      <div id="lease-host-profile" tabIndex={-1} className={`card flex items-center gap-3 p-3 outline-none focus:ring-2 focus:ring-brand/40 ${hostSetupReady ? "" : "border border-amber-400/35"}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${hostSetupReady ? "bg-emerald-500/12 text-emerald-700" : "bg-amber-500/12 text-amber-700"}`} aria-hidden>{hostSetupReady ? "✓" : "!"}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-black">{W(lang, "Owner / manager details", "Datos del propietario / administrador")}</p>
          <p className="text-[11.5px] leading-relaxed opacity-60">{hostSetupReady
            ? W(lang, "Ready and filled into this private agreement.", "Listos y completados en este contrato privado.")
            : W(lang, "Complete once—identity, private address and payment route.", "Complete una vez: identidad, dirección privada y forma de pago.")}</p>
        </div>
        <Link className="shrink-0 text-[12px] font-black text-brand underline" to={productHref("onerental", `/host-profile?return=${encodeURIComponent(`/rentals/r/${property.id}/contract${selectedRequest ? `?request=${selectedRequest}` : ""}`)}`)}>{hostSetupReady ? W(lang, "Review", "Revisar") : W(lang, "Complete", "Completar")}</Link>
      </div>

      {property.price_unit==='month' && <MonthlyRentalPanel propertyId={property.id} userId={userId} hostId={property.agent_id} amount={property.price} currency={property.currency || 'COP'} lang={lang} selectedRequestId={request?.id}/>}
      {selectedRequest && !request && <p role="status" className="card p-4">{W(lang, 'The selected request is unavailable or still loading. No other request has been selected.', 'La solicitud seleccionada no está disponible o sigue cargando. No se seleccionó otra solicitud.')}</p>}
      {request && (
        <div id="lease-request-lifecycle" tabIndex={-1} className="card p-4 outline-none focus:ring-2 focus:ring-brand/40">
          <p className="text-[11px] font-black uppercase tracking-wide opacity-50">{W(lang, "Tenant request", "Solicitud del arrendatario")}</p>
          <p className="mt-1 font-bold">{request.guest_name || W(lang, "One ID tenant", "Arrendatario con One ID")}</p>
          <p className="mt-3 text-[11px] font-black uppercase tracking-wide opacity-50">{W(lang, "Requested rental dates", "Fechas de arriendo solicitadas")}</p>
          <p className="mt-1 text-sm font-semibold opacity-75">
            {W(lang, "From", "Desde")} {formatRequestDate(request.starts_on, lang)} {W(lang, "to", "hasta")} {formatRequestDate(request.ends_on, lang)}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl bg-white/35 px-3 py-2 text-sm dark:bg-white/[0.04]">
            <span className="font-semibold opacity-65">{W(lang, "Total rent requested", "Canon total solicitado")}</span>
            <strong>{rentalMoney(Number(request.quoted_total || 0), request.currency, lang)}</strong>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div id="lease-request-identity" tabIndex={-1} className="rounded-2xl border border-white/55 bg-white/35 p-3 outline-none focus:ring-2 focus:ring-red-400/50">
              <p className="font-black uppercase tracking-wide opacity-50">{W(lang, "Identity", "Identidad")}</p>
              <p className="mt-1 font-bold">{request.identity_status === "approved"
                ? W(lang, "Approved", "Aprobada")
                : request.identity_status === "submitted"
                  ? W(lang, "Submitted · review needed", "Enviada · falta revisar")
                  : W(lang, "Not submitted", "No enviada")}</p>
            </div>
            <div id="lease-request-payment" tabIndex={-1} className="rounded-2xl border border-white/55 bg-white/35 p-3 outline-none focus:ring-2 focus:ring-red-400/50">
              <p className="font-black uppercase tracking-wide opacity-50">{W(lang, "Payment", "Pago")}</p>
              <p className="mt-1 font-bold">{request.payment_status === "authorized"
                ? W(lang, "Card authorized", "Tarjeta autorizada")
                : request.payment_status === "received"
                  ? W(lang, "Received", "Recibido")
                  : W(lang, "Pending", "Pendiente")}</p>
            </div>
          </div>

          {request.payment_rail !== 'stripe' && request.payment_declared_at && <ReservationPaymentHelp requestId={request.id} lang={lang} />}
          {request.state === 'requested' && <ReservationHoldStatus lang={lang} deadline={request.preapproval_expires_at} paymentReported={!!request.payment_declared_at || ['authorized','captured','received'].includes(request.payment_status)} />}
          {request.state === 'expired' && <p role="status">{W(lang, 'This request expired. Do not collect payment for it.', 'Esta solicitud venció. No cobre el pago de esta solicitud.')}</p>}
          {(requestStage ?? request.approval_stage) === "requested" && request.state === 'requested' && new Date(request.expires_at).getTime() > Date.now() && (
            <div id="lease-request-preapproval" tabIndex={-1} className="mt-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3 outline-none focus:ring-2 focus:ring-red-400/50">
              <p className="text-sm font-black">{W(lang, "Pre-approve this request", "Preaprobar esta solicitud")}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{W(lang,
                "Dates are not held yet. Pre-approval sends the tenant one request for their identity and payment. Choose how long they have to complete both.",
                "Las fechas aún no están reservadas. La preaprobación envía al arrendatario una solicitud de identidad y pago. Elija cuánto tiempo tendrá para completar ambos.")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={W(lang, "Pre-approval duration", "Duración de preaprobación")}>
                {[24, 36, 48].map(hours => (
                  <button key={hours} type="button" onClick={() => setPreapprovalHours(String(hours))}
                    className={`rounded-xl border px-2 py-2 text-xs font-black ${preapprovalHours === String(hours) ? "border-sky-600 bg-sky-600 text-white" : "border-white/70 bg-white/45"}`}>
                    {hours}h
                  </button>
                ))}
              </div>
              <button type="button" disabled={busy} onClick={preapproveRequest}
                className="btn-primary mt-3 w-full disabled:opacity-50">
                {busy ? W(lang, "Saving…", "Guardando…") : W(lang, "Pre-approve · request ID and payment", "Preaprobar · solicitar identidad y pago")}
              </button>
            </div>
          )}

          {(requestStage ?? request.approval_stage) === "preapproved_id_required" && (
            <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3 text-sm font-bold">
              {W(lang, "Pre-approved · waiting for the tenant's ID", "Preaprobada · esperando la identificación del arrendatario")}
            </div>
          )}

          {(requestStage ?? request.approval_stage) === "preapproved_ready" && (
            <div className="mt-3 rounded-2xl border border-brand/25 bg-brand/[0.08] p-3 text-sm font-bold text-brand">
              {W(lang, "Pre-approved · ID complete · payment confirmation pending", "Preaprobada · identificación completa · falta confirmar el pago")}
            </div>
          )}

          {identityDocument && request.identity_status === "submitted" && (
            <div className="mt-3 rounded-2xl border border-white/60 bg-white/35 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-black">{W(lang, "Review tenant ID", "Revisar identificación")}</p>
              <p className="mt-1 text-[11.5px] opacity-60">{W(lang,
                "This private document is visible only to the applicant and this property's owner.",
                "Este documento privado solo es visible para el solicitante y el propietario de este inmueble.")}</p>
              {identityDocument.signed_url && (
                <a href={identityDocument.signed_url} target="_blank" rel="noreferrer"
                  className="btn-ghost mt-3 block w-full text-center">
                  {W(lang, "Open submitted ID", "Abrir identificación enviada")}
                </a>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => void reviewIdentity(false)}
                  className="btn-ghost text-red-600 disabled:opacity-50">
                  {W(lang, "Needs correction", "Necesita corrección")}
                </button>
                <button type="button" disabled={busy} onClick={() => void reviewIdentity(true)}
                  className="btn-primary disabled:opacity-50">
                  {W(lang, "Approve ID", "Aprobar identificación")}
                </button>
              </div>
            </div>
          )}

          {request.payment_rail !== "stripe"
            && request.payment_status !== "received"
            && ["preapproved_id_required", "preapproved_ready"].includes(requestStage ?? request.approval_stage) && (
            <div className="mt-3 rounded-2xl border border-white/60 bg-white/35 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-black">{W(lang, "Confirm payment received", "Confirmar pago recibido")}</p>
              {/* ORDER OF OPERATIONS (7 Sep 2026): the tenant records "sent" first; the database refuses
                  "received" until then. So the button is inert until the tenant has spoken. */}
              {request.payment_declared_at ? (
                <p className="mt-1 text-[11.5px] opacity-70">{W(lang,
                  `The tenant says they sent it by ${request.payment_rail || "transfer"} on ${new Date(request.payment_declared_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })}${request.payment_reference ? ` (ref ${request.payment_reference})` : ""}. Confirm only once it is visible in your account.`,
                  `El inquilino dice que lo envió por ${request.payment_rail || "transferencia"} el ${new Date(request.payment_declared_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}${request.payment_reference ? ` (ref. ${request.payment_reference})` : ""}. Confirme solo cuando aparezca en su cuenta.`)}</p>
              ) : (
                <p className="mt-1 text-[11.5px] opacity-70">{W(lang,
                  "Waiting for the tenant to confirm they have sent the rent. You can mark it received after that.",
                  "Esperando que el inquilino confirme que envió el canon. Podrá marcarlo como recibido después.")}</p>
              )}
              <input className="input mt-3 w-full" value={paymentReference} onChange={e => setPaymentReference(e.target.value)}
                aria-describedby="lease-payment-reference-help"
                placeholder={W(lang, "Receipt or transfer reference (optional)", "Referencia del recibo o transferencia (opcional)")} />
              <p id="lease-payment-reference-help" className="mt-1 text-[11px] leading-relaxed opacity-55">
                {request.payment_declared_at
                  ? W(lang, "Optional: enter the reference shown in your receiving account.", "Opcional: escriba la referencia que aparece en su cuenta receptora.")
                  : W(lang, "You can enter a reference now. Confirm receipt unlocks only after the tenant reports the transfer as sent.", "Puede escribir una referencia ahora. Confirmar recepción se habilita solo cuando el inquilino reporta que envió la transferencia.")}
              </p>
              <button type="button" disabled={busy || !request.payment_declared_at} onClick={() => void confirmExternalPayment()}
                className="btn-primary mt-2 w-full disabled:opacity-50">
                {W(lang, "Confirm receipt", "Confirmar recepción")}
              </button>
              {request.identity_status !== "approved" && (
                <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {W(lang, "Identity review is still required before final approval.", "Aún falta revisar la identidad antes de la aprobación final.")}
                </p>
              )}
            </div>
          )}

          {request.identity_status === "approved"
            && ["authorized", "received", "captured"].includes(request.payment_status)
            && (requestStage ?? request.approval_stage) !== "approved" && (
            <div id="lease-request-final-approval" tabIndex={-1} className="mt-3 rounded-2xl border border-brand/25 bg-brand/[0.08] p-3 outline-none focus:ring-2 focus:ring-red-400/50">
              <p className="text-sm font-black text-brand">{W(lang, "Ready for final approval", "Lista para aprobación final")}</p>
              <p className="mt-1 text-[11.5px] opacity-65">{W(lang,
                request.payment_rail === "stripe"
                  ? "Final approval captures the authorized card and locks the requested dates."
                  : "Final approval locks the requested dates now that payment is confirmed."
                , request.payment_rail === "stripe"
                  ? "La aprobación final captura la tarjeta autorizada y bloquea las fechas solicitadas."
                  : "La aprobación final bloquea las fechas solicitadas ahora que el pago está confirmado.")}</p>
              <button type="button" disabled={busy} onClick={() => void finalizeApproval()}
                className="btn-primary mt-3 w-full disabled:opacity-50">
                {busy ? W(lang, "Finalizing…", "Finalizando…") : W(lang, "Approve tenant and lock dates", "Aprobar arrendatario y bloquear fechas")}
              </button>
            </div>
          )}

          <p className="mt-2 text-[11.5px] leading-relaxed opacity-55">{W(lang, "Identity is linked from the tenant's One ID. Adjust only the dates or terms if you are making a special offer.", "La identidad viene del One ID del arrendatario. Ajuste solo las fechas o condiciones si hará una oferta especial.")}</p>
        </div>
      )}

      {request?.isRenewal ? <p className="card p-4 text-sm">{W(lang,'This renews the original monthly agreement. Complete approval and payment above; no second lease or signature is needed.','Esto renueva el acuerdo mensual original. Complete la aprobación y el pago arriba; no se necesita otro contrato ni firma.')}</p> : <>
      {/* ── WHO ──────────────────────────────────────────────────────────────────────────── */}
      {!request && <Section title={W(lang, "The tenant", "El arrendatario")}>
        <div className="space-y-2">
          <input className="input w-full" value={tenantName} readOnly={!!request} onChange={e => setTenantName(e.target.value)}
            placeholder={W(lang, "Full name", "Nombre completo")} />
          {request
            ? <div className="input flex w-full items-center gap-2 border-sky-500/30 bg-sky-500/[0.08] text-sm font-bold text-sky-800 dark:text-sky-200">
                <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-600 text-sm text-white">✓</span>
                {W(lang, "One ID account", "Cuenta One ID")}
              </div>
            : <input className="input w-full" type="email" value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} placeholder={W(lang, "Email", "Correo")} />}
        </div>
      </Section>}

      {/* ── TERM. Nightly and monthly are the same contract, only the unit changes. ──────── */}
      {(!request || editingLeaseDetails) && <Section title={W(lang, "Term", "Término")}
        hint={interval === "days"
          ? W(lang, "A stay. Billed once for the whole booking.", "Una estadía. Se cobra una vez por toda la reserva.")
          : W(lang, "A lease. Billed on the same date each calendar month — never in 30-day blocks.",
                    "Un arriendo. Se cobra la misma fecha cada mes calendario — nunca en bloques de 30 días.")}>
        {request && !editingLeaseDetails ? (
          <div className="rounded-xl border border-brand/20 bg-brand/[0.055] p-3">
            <p className="text-[11px] font-black uppercase tracking-wide opacity-50">{W(lang, "Requested rental dates", "Fechas de arriendo solicitadas")}</p>
            <p className="mt-1 text-sm font-bold">{W(lang, "From", "Desde")} {formatRequestDate(startsOn, lang)} {W(lang, "to", "hasta")} {formatRequestDate(endsOn, lang)}</p>
          </div>
        ) : <><div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-[minmax(0,1fr)_96px]">
          <label className="block">
            <span className="label">{W(lang, "Starts", "Inicia")}</span>
            {/* The glass calendar, not the OS one — see `Pickers.tsx` in the shell. `min` is
                omitted so it keeps the default today-floor: a lease cannot start in the past. */}
            {request?.monthly ? <p className="input">{request.starts_on}</p> : <GlassDate value={startsOn} onChange={setStartsOn} />}
          </label>
          <label className="block">
            <span className="label">{interval === "days" ? W(lang, "Nights", "Noches") : W(lang, "Months", "Meses")}</span>
            <input className="input w-full" inputMode="numeric"
              readOnly={!!request?.monthly}
              value={interval === "days" ? nights : months}
              onChange={e => (interval === "days" ? setNights : setMonths)(e.target.value)} />
          </label>
        </div>
        <p className="text-[12px] opacity-60">
          {W(lang, `Ends ${endsOn} · ${cycles} payment${cycles === 1 ? "" : "s"}`,
                   `Termina el ${endsOn} · ${cycles} pago${cycles === 1 ? "" : "s"}`)}
        </p>
        </>}
      </Section>}

      {/* ── THE AGREEMENT — standard by default, owner document only when enabled ───────
          Lee, 10 Aug 2026: *"if they wanna just use the same form and basically say fill in the
          blanks, we could just give them a form that's gonna auto-populate the blanks. And then
          when they see the form, they'll see everything populated in blue text, so they can
          review everything and then send it."* That is the default path. The owner's own
          document is available only when they enabled supplemental terms on the listing. */}
      <Section title={W(lang, "The agreement", "El acuerdo")}>
        {request && !editingLeaseDetails ? <>
          <p className="text-[12.5px] leading-relaxed opacity-65">{W(lang,
            "The agreement is already filled from the listing, host profile and this tenant's request.",
            "El contrato ya está completo con los datos del anuncio, el perfil del anfitrión y la solicitud de este arrendatario.")}</p>
          <button type="button" aria-expanded={agreementExpanded} onClick={() => setAgreementExpanded(value => !value)}
            className="btn-ghost w-full">
            {agreementExpanded ? W(lang, "Hide agreement", "Ocultar contrato") : W(lang, "View agreement", "Ver contrato")}
          </button>
          {agreementExpanded && <div className="space-y-2">
            {!useTemplate && customDocumentUrl && <a href={customDocumentUrl} target="_blank" rel="noreferrer"
              className="block text-[12px] font-bold text-brand underline">
              {W(lang, "Open the uploaded agreement", "Abrir el contrato subido")}
            </a>}
            <p className="whitespace-pre-wrap rounded-xl border border-ink/10 bg-white/35 p-3 text-[12.5px] leading-relaxed dark:border-white/12 dark:bg-white/[0.04]">
              {draftAgreementBody || W(lang, "No custom agreement text has been added yet.", "Todavía no se ha agregado el texto del contrato personalizado.")}
            </p>
          </div>}
        </> : <>
        {request && (
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3">
            <p className="text-[12.5px] font-bold text-sky-800 dark:text-sky-200">{editingLeaseDetails
              ? W(lang, "Editing this tenant's agreement only", "Editando solo el contrato de este arrendatario")
              : W(lang, "Review mode · listing and One ID details are already filled where available", "Modo de revisión · los datos del anuncio y One ID ya están completos donde están disponibles")}</p>
            <div className="mt-2">
              <button type="button" onClick={() => setEditingLeaseDetails(false)} className="btn-ghost min-h-11 w-full">
                {editingLeaseDetails ? W(lang, "Return to review", "Volver a revisar") : W(lang, "Change this request only", "Cambiar solo esta solicitud")}
              </button>
            </div>
          </div>
        )}
        {ownerTermsAllowed ? (
          <div className="flex gap-2">
            {[true, false].map(t => (
              <button key={String(t)} type="button" onClick={() => setUseTemplate(t)}
                className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-bold transition ${
                  useTemplate === t
                    ? "border-transparent bg-ink text-paper dark:bg-white dark:text-ink"
                    : "border-ink/12 opacity-70 dark:border-white/15"}`}>
                {t ? W(lang, "OneHome agreement", "Contrato de OneHome")
                   : W(lang, "My own contract", "Mi propio contrato")}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-brand/20 bg-brand/[0.055] p-3 text-[12px] font-bold leading-relaxed text-brand-deep dark:text-brand-light">
            {W(lang,
              "Using OneHome's standard agreement. No supplemental owner terms were enabled for this property.",
              "Se usa el contrato estándar de OneHome. No se activaron condiciones adicionales del propietario para este inmueble.")}
          </p>
        )}

        {useTemplate ? (
          <>
            <p className="rounded-xl bg-amber-500/10 p-3 text-[11.5px] leading-relaxed">
              {W(lang,
                `A starting point, not legal advice. It follows the ${CO_LEASE_SECTIONS.length} sections a Colombian residential lease normally carries — term, IPC increase, repairs, the acta de entrega, default — in our own words, and a Colombian attorney has not reviewed it yet.`,
                `Un punto de partida, no asesoría legal. Sigue las ${CO_LEASE_SECTIONS.length} secciones que normalmente lleva un contrato de arrendamiento colombiano — término, reajuste por IPC, reparaciones, acta de entrega, incumplimiento — con nuestras propias palabras, y aún no lo ha revisado un abogado colombiano.`)}
            </p>

            {/* THE BLANKS, AS A FORM. Only the ones a human has to supply: everything derivable
                from the listing and the term is filled already and is not asked twice. */}
            {(editingLeaseDetails || !request) && <div className="space-y-3">
              <p className="rounded-xl border border-ink/10 bg-ink/[0.025] p-3 text-[11.5px] leading-relaxed opacity-70 dark:border-white/12 dark:bg-white/[0.04]">
                {W(lang,
                  "Your legal name, government ID and private notice address come from your host profile. To change them, use Owner / manager details above; they cannot be edited inside one tenant's agreement.",
                  "Su nombre legal, identificación oficial y dirección privada de notificación provienen de su perfil de anfitrión. Para cambiarlos, use Datos del propietario / administrador arriba; no se pueden editar dentro del contrato de un solo arrendatario.")}
              </p>
              <div>
                <span className="label">{W(lang, "Tenant's ID", "Documento del arrendatario")}</span>
                <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2">
                {/* PASSPORT IS THE DEFAULT ON THE TENANT SIDE. This product is aimed at
                    expatriates and tourists — Lee signed his own Medellín lease with a passport
                    number, and a form that only offers a cédula is broken for its own audience. */}
                  <div id="lease-field-arrendatario_doc_tipo">
                    <GlassSelect<string>
                      value={f.arrendatario_doc_tipo ?? "Pasaporte"} ariaLabel={W(lang, "Tenant ID type", "Tipo de documento del arrendatario")}
                      onChange={v => set("arrendatario_doc_tipo")({ target: { value: v } } as any)}
                      options={["Pasaporte", "C.E.", "C.C."].map(o => ({ value: o, label: o }))}
                      className="!px-2.5" />
                  </div>
                  <Blank fieldKey="arrendatario_doc" label={W(lang, "Tenant's ID number", "Número de documento del arrendatario")}
                    v={f.arrendatario_doc ?? ""} on={set("arrendatario_doc")} ph="649537448" bare
                    invalid={showValidation && missingKeys.includes("arrendatario_doc")} requiredText={W(lang, "Required", "Obligatorio")} />
                </div>
              </div>
              <p className="rounded-xl border border-ink/10 bg-ink/[0.025] p-3 text-[11.5px] leading-relaxed opacity-70 dark:border-white/12 dark:bg-white/[0.04]">
                <span className="font-black">{W(lang, "Property address", "Dirección del inmueble")}:</span>{" "}
                {f.direccion || property?.address_line || W(lang, "Complete this on the listing.", "Complétela en el anuncio.")}
              </p>
              {!property?.area_m2 && <Blank fieldKey="area" label={W(lang, "Approximate area (m²)", "Área aproximada (m²)")}
                v={f.area ?? ""} on={set("area")} ph="92" inputMode="decimal"
                invalid={showValidation && missingKeys.includes("area")} requiredText={W(lang, "Required", "Obligatorio")} />}
              <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
                <Blank fieldKey="dias_aviso" label={W(lang, "Notice days", "Días de aviso")}
                  v={f.dias_aviso ?? ""} on={set("dias_aviso")} ph="15" inputMode="numeric"
                  invalid={showValidation && missingKeys.includes("dias_aviso")} requiredText={W(lang, "Required", "Obligatorio")} />
                <Blank fieldKey="dias_habiles_pago" label={W(lang, "Payment window (business days)", "Plazo de pago (días hábiles)")}
                  v={f.dias_habiles_pago ?? ""} on={set("dias_habiles_pago")} ph="5" inputMode="numeric"
                  invalid={showValidation && missingKeys.includes("dias_habiles_pago")} requiredText={W(lang, "Required", "Obligatorio")} />
              </div>
              <Blank fieldKey="dias_devolucion" label={W(lang, "Deposit return (business days)", "Devolución del depósito (días hábiles)")}
                v={f.dias_devolucion ?? ""} on={set("dias_devolucion")} ph="5" inputMode="numeric"
                invalid={showValidation && missingKeys.includes("dias_devolucion")} requiredText={W(lang, "Required", "Obligatorio")} />
              <Blank fieldKey="sancion" label={W(lang, "Breach penalty", "Sanción por incumplimiento")}
                v={f.sancion ?? ""} on={set("sancion")} ph={money(rent)} inputMode="decimal"
                invalid={showValidation && missingKeys.includes("sancion")} requiredText={W(lang, "Required", "Obligatorio")} />
              <Blank fieldKey="canon_renovacion" label={W(lang, "Rent on renewal", "Canon en la prórroga")}
                v={f.canon_renovacion || (property ? money(property.price) : "")} on={set("canon_renovacion")}
                ph={property ? money(property.price) : ""}
                invalid={showValidation && missingKeys.includes("canon_renovacion")} requiredText={W(lang, "Required", "Obligatorio")} />
            </div>}
            <p className="text-[11px] leading-relaxed opacity-55">
              {W(lang,
                "Rent on renewal can differ from today's rent — that is normal here, and leaving it as it stands is fine.",
                "El canon de la prórroga puede ser distinto al de hoy — es normal aquí, y dejarlo igual está bien.")}
            </p>

            {/* THE REVIEW. Everything filled in blue, everything still missing in amber. */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-black uppercase tracking-wide opacity-55">
                  {W(lang, "Review before sending", "Revise antes de enviar")}
                </span>
                <span className={`text-[12px] font-bold ${blanks ? "text-amber-600 dark:text-amber-400" : "text-brand"}`}>
                  {blanks
                    ? W(lang, `${blanks} still blank`, `${blanks} sin llenar`)
                    : W(lang, "Nothing left blank", "Nada sin llenar")}
                </span>
              </div>
              {blanks > 0 && <p className="mb-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
                {W(lang, "Tap any amber blank to jump to the field that fills it.", "Toque cualquier espacio ámbar para ir al campo que lo completa.")}
              </p>}
              <LeasePreview lang={L} values={tv} addendumKeys={picked}
                includeShortStayDeposit={includeShortStayDeposit}
                onBlankClick={key => { setShowValidation(true); focusField(key); }} />
            </div>
          </>
        ) : (
          <>
            <label className="ow-tap flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink/25 py-3 text-[13px] font-bold dark:border-white/25">
              <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
                disabled={busy} onChange={e => upload(e.target.files?.[0] ?? null)} />
              <IconPlus size={15} />
              {docUrl ? W(lang, "Replace the uploaded document", "Reemplazar el documento subido")
                      : W(lang, "Upload your agreement", "Subir su contrato")}
            </label>
            {docUrl && (
              <a href={docUrl} target="_blank" rel="noreferrer" className="block text-[12px] font-bold text-brand underline">
                {W(lang, "View the uploaded document", "Ver el documento subido")}
              </a>
            )}
            <label className="block">
              <span className="label">{W(lang, "Terms in the contract", "Términos del contrato")}</span>
              <textarea id="lease-field-contract-text" className="input min-h-[160px] w-full" value={docText} onChange={e => setDocText(e.target.value)}
                placeholder={W(lang,
                  "Paste or type the terms both of you are agreeing to. This text is what gets snapshotted and stamped with both signatures.",
                  "Pegue o escriba los términos que ambos están aceptando. Este texto es el que se congela y se sella con ambas firmas.")} />
            </label>
          </>
        )}
        </>}
      </Section>

      {/* ── ADDENDUMS ────────────────────────────────────────────────────────────────────── */}
      {/* Say WHY the deposit clause is not on offer. An agent who cannot find it will otherwise
          type one into a free-text field, which is the same void clause with no audit trail. */}
      {(!request || editingLeaseDetails) && <Section title={W(lang, "Addendums", "Anexos")}>
        <label className="mb-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-brand/25 bg-brand/[0.06] p-3 text-[12px] font-bold leading-relaxed text-brand-deep dark:text-brand-light">
          <input type="checkbox" checked={addendumInstructionsUnderstood}
            onChange={event => setAddendumInstructionsUnderstood(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ow-brand)]" />
          <span>{W(lang,
            "I understand: these clauses are optional. Tap a card to add it, and tap it again to remove it.",
            "Entiendo: estas cláusulas son opcionales. Toque una tarjeta para agregarla y vuelva a tocarla para quitarla.")}</span>
        </label>
        {isResidential && (
          <p className="mb-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-3 text-[11.5px] leading-relaxed opacity-75 dark:border-white/12 dark:bg-white/[0.04]">
            {W(lang,
              `This lease runs ${stayDays === null ? "30 days or more" : `${stayDays} days`}, so it is an urban housing lease. Colombian law (Ley 820 de 2003, Art. 16) does not allow a cash deposit or any other real guarantee on one — a clause asking for it has no effect and the money is returnable on demand. Use "How the lease is guaranteed" instead: a co-signer, a rent-guarantee policy, or a surety. That is what the Colombian market already uses.`,
              `Este contrato dura ${stayDays === null ? "30 días o más" : `${stayDays} días`}, por lo que es un arrendamiento de vivienda urbana. El artículo 16 de la Ley 820 de 2003 no permite exigir depósito en dinero ni caución real alguna — una cláusula que lo pida es ineficaz y el dinero es devolvible. Use en su lugar «Garantía del contrato»: codeudor, póliza de arrendamiento o fianza. Es lo que el mercado colombiano ya utiliza.`)}
          </p>
        )}
        <div className="space-y-2">
          {ADDENDUMS.filter(a => !(a.shortStayOnly && isResidential)).map(a => {
            const on = picked.includes(a.key);
            const clauseSection = CO_OPTIONAL_SECTIONS.find(section => section.key === a.key)!;
            const clauseFieldKeys = placeholdersIn([clauseSection], L);
            const clauseMissingKeys = missingTemplateKeys([clauseSection], L, tv);
            const clauseIncomplete = on && clauseMissingKeys.length > 0;
            return (
              <div key={a.key} className={`rounded-xl border p-3 transition ${
                showValidation && clauseIncomplete
                  ? "border-red-400 bg-red-500/[0.05] ring-2 ring-red-300/40"
                  : clauseIncomplete
                    ? "border-amber-400/70 bg-amber-500/[0.05]"
                    : on
                      ? "border-brand/40 bg-brand/[0.05]"
                      : "border-ink/10 dark:border-white/12"}`}>
                <button type="button" aria-pressed={on} disabled={!addendumInstructionsUnderstood}
                  className="min-h-11 w-full text-left disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={() => setPicked(c => on ? c.filter(k => k !== a.key) : [...c, a.key])}>
                  <span className="block min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-[13.5px] font-bold">{a.title[L]}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {on ? W(lang, "Tap to remove", "Toque para quitar") : W(lang, "Tap to add", "Toque para agregar")}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed opacity-65">{a.summary[L]}</span>
                    {on && clauseFieldKeys.length > 0 && (
                      <span className={`mt-1.5 block text-[11px] font-bold ${clauseIncomplete ? "text-amber-700 dark:text-amber-300" : "text-brand"}`}>
                        {clauseIncomplete
                          ? W(lang, `${clauseMissingKeys.length} detail${clauseMissingKeys.length === 1 ? "" : "s"} to complete`,
                                    `${clauseMissingKeys.length} dato${clauseMissingKeys.length === 1 ? "" : "s"} por completar`)
                          : W(lang, "All details complete", "Todos los datos completos")}
                      </span>
                    )}
                  </span>
                </button>
                {on && (
                  <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed opacity-80">
                    {fillTemplate(a.body[L], tv)}
                  </p>
                )}
                {on && <OptionalClauseFields clauseKey={a.key} lang={lang} values={f}
                  setValue={(key, value) => setF(current => ({ ...current, [key]: value }))}
                  invalidKeys={showValidation ? activeMissingKeys : []} startsOn={startsOn} />}
              </div>
            );
          })}
        </div>
      </Section>}

      {/* ── MONEY, STATED BEFORE ANYONE SIGNS ────────────────────────────────────────────── */}
      <Section title={W(lang, "Money", "Dinero")}>
        <Row label={W(lang, "Rent per payment", "Canon por pago")} value={money(rent)} />
        <Row label={W(lang, "Payments over the term", "Pagos durante el término")} value={String(cycles)} />
        {!!dep && <Row label={W(lang, "Deposit", "Depósito")} value={money(dep)} />}
        {/* TWO DIFFERENT NUMBERS, LABELLED AS SUCH. The first pass put the whole-term fee under
            a label that said "of each transfer", directly beneath a per-payment rent — which
            reads as though we take $1,045 out of a $1,150 payment. Caught in UAT, and it is
            exactly the kind of line that turns into "you never told me" three months later. */}
        {!request && listingFee.pending ? <p role="status">{W(lang, "Checking listing fees…", "Consultando comisiones…")}</p> : !request && listingFee.error ? <button className="btn-ghost" onClick={listingFee.retry}>{W(lang, "Fees unavailable. Try again", "Comisiones no disponibles. Reintentar")}</button> : <><Row label={W(lang, "Host fee, per payment", "Comisión del anfitrión, por pago")}
          value={`− ${money(hostFee(rent, contractHostRate))}`} />
        <Row bold label={W(lang, "You receive per payment", "Usted recibe por pago")} value={money(netToManager(rent, contractHostRate))} />
        <Row label={W(lang, "Guest fee, per payment", "Comisión del huésped, por pago")}
          value={`+ ${money(guestFee(rent, contractGuestRate))}`} />
        <Row bold label={W(lang, "Guest pays per payment", "El huésped paga por pago")} value={money(totalDueFromGuest(rent, contractGuestRate))} />
        <Row label={W(lang, "Total platform fees, per payment", "Comisiones totales de la plataforma, por pago")}
          value={money(hostFee(rent, contractHostRate) + guestFee(rent, contractGuestRate))} />
        <Row label={W(lang, `Host fees over the term (${cycles} payment${cycles === 1 ? "" : "s"})`,
                            `Comisiones del anfitrión durante el término (${cycles} pago${cycles === 1 ? "" : "s"})`)}
          value={money(hostTotalFee)} />
        <Row label={W(lang, `Guest fees over the term (${cycles} payment${cycles === 1 ? "" : "s"})`,
                            `Comisiones del huésped durante el término (${cycles} pago${cycles === 1 ? "" : "s"})`)}
          value={money(guestTotalFee)} /></>}
        {!!dep && (
          <p className="mt-2 rounded-xl bg-ink/[0.04] p-3 text-[12px] leading-relaxed dark:bg-white/[0.06]">
            {W(lang,
              "The deposit is captured and held for the whole term — not a temporary hold that expires. It is released against the walkthrough photos you both agreed to.",
              "El depósito se captura y se retiene durante todo el término — no es una retención temporal que expira. Se libera con base en las fotos del acta que ambos aceptaron.")}
          </p>
        )}
        <p className="text-[11px] leading-relaxed opacity-50">
          {W(lang,
            `Payouts arrive in about ${PAYOUT_FIRST_DAYS} days the first time, then about ${PAYOUT_LATER_DAYS} days.`,
            `Los pagos llegan en unos ${PAYOUT_FIRST_DAYS} días la primera vez, y luego en unos ${PAYOUT_LATER_DAYS} días.`)}
        </p>
      </Section>

      {/* ── THE INSPECTION WINDOW ────────────────────────────────────────────────────────
          Lee, 10 Aug 2026: *"the property manager should send over how many days they have to
          conduct a property inspection… the whole window for the inspection can't last more
          than like five days. She needs to give two days to get a response, and it needs to fall
          within five days if it's gonna be valid. Otherwise they passed their move-in inspection
          window. Maybe we give them seven days, but they can't be lingering around."*

          Both numbers are bounded by a database check constraint as well as by this screen: a
          deadline the client can move is a deadline that decides who keeps a deposit. */}
      <Section title={W(lang, "The walkthrough window", "El plazo del acta de entrega")}
        hint={W(lang,
          "The landlord or manager submits the move-in condition photos. The tenant responds to those photos. Both steps must finish inside this window, counted from move-in.",
          "El propietario o administrador envía las fotos del estado de entrega. El arrendatario responde a esas fotos. Ambos pasos deben terminar dentro de este plazo, contado desde la entrada.")}>
        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
          <label className="block">
            <span className="label">{W(lang, "Whole window (days)", "Plazo total (días)")}</span>
            <GlassSelect<string>
              value={String(inspectionDays)} ariaLabel={W(lang, "Whole window (days)", "Plazo total (días)")}
              onChange={v => setInspectionDays(Number(v))}
              options={[2, 3, 4, 5, 6, 7].map(d => ({ value: String(d), label: `${d} ${W(lang, "days", "días")}` }))} />
          </label>
          <label className="block">
            <span className="label">{W(lang, "Time to answer (days)", "Tiempo para responder (días)")}</span>
            <GlassSelect<string>
              value={String(responseDays)} ariaLabel={W(lang, "Time to answer (days)", "Tiempo para responder (días)")}
              onChange={v => setResponseDays(Number(v))}
              options={[1, 2, 3].filter(d => d < inspectionDays).map(d => ({ value: String(d), label: `${d} ${W(lang, "days", "días")}` }))} />
          </label>
        </div>
        {/* The dates, computed and shown, so nobody has to do the arithmetic in their head —
            and so a manager cannot upload on the last afternoon and then blame the tenant. */}
        <div className="rounded-xl bg-ink/[0.04] p-3 text-[12px] leading-relaxed dark:bg-white/[0.06]">
          <p>
            <span className="font-bold">{W(lang, "Move-in", "Entrada")}:</span> {startsOn}
          </p>
          <p>
            <span className="font-bold">{W(lang, "Landlord/manager photos due", "Fecha límite para fotos del propietario/administrador")}:</span>{" "}
            {isoDate(addInterval(new Date(startsOn + "T00:00:00"), "days", inspectionDays - responseDays))}
          </p>
          <p>
            <span className="font-bold">{W(lang, "Tenant responses due / window closes", "Respuestas del arrendatario / cierre del plazo")}:</span>{" "}
            {isoDate(addInterval(new Date(startsOn + "T00:00:00"), "days", inspectionDays))}
          </p>
          <p className="mt-1.5 font-semibold text-brand">
            {W(lang,
              `A ${inspectionDays}-day window gives the landlord or manager ${inspectionDays - responseDays} day${inspectionDays - responseDays === 1 ? "" : "s"} to submit photos, then leaves ${responseDays} day${responseDays === 1 ? "" : "s"} for the tenant.`,
              `Un plazo de ${inspectionDays} días da al propietario o administrador ${inspectionDays - responseDays} día${inspectionDays - responseDays === 1 ? "" : "s"} para enviar las fotos y deja ${responseDays} día${responseDays === 1 ? "" : "s"} al arrendatario para responder.`)}
          </p>
          <p className="mt-1.5 opacity-70">
            {W(lang,
              "If the window closes with photos that were never answered, the photos stand as the record and the silence is recorded with them. If nobody submitted anything, there is no move-in record — and with no record, nothing can be deducted from the deposit at the end.",
              "Si el plazo cierra con fotos que nunca se respondieron, las fotos quedan como registro y el silencio queda registrado con ellas. Si nadie envió nada, no hay acta de entrada — y sin acta, no se puede descontar nada del depósito al final.")}
          </p>
        </div>
      </Section>

      {/* ── SIGN ─────────────────────────────────────────────────────────────────────────── */}
      {!request && <Section title={W(lang, "Your signature", "Su firma")}
        hint={W(lang,
          "Your name and your title are both stamped, with the exact date and time. Neither can be changed afterwards.",
          "Se sellan su nombre y su cargo, con la fecha y hora exactas. Ninguno se puede cambiar después.")}>
        <div className="space-y-3">
          <label id="lease-field-sign_name" className="block">
            <span className="label">{W(lang, "Full name", "Nombre completo")}</span>
            <input className="input w-full" value={signName} onChange={e => setSignName(e.target.value)}
              placeholder={displayName ?? W(lang, "Your full name", "Su nombre completo")} />
          </label>
          <label id="lease-field-sign_title" className="block">
            {/* Lee: *"they list your title — property owner, property manager, property agent."*
                In a dispute the question is never "did somebody sign" but "was that person
                entitled to let this property". A name alone cannot answer it. */}
            <span className="label">{W(lang, "Your title", "Su cargo")}</span>
            <GlassSelect<string>
              value={signTitle} ariaLabel={W(lang, "Your title", "Su cargo")}
              onChange={setSignTitle}
              options={SIGNER_TITLES.filter(t => t.key !== "tenant").map(t => ({
                value: t.key, label: L === "es" ? t.es : t.en,
              }))} />
          </label>
        </div>
        <p className="rounded-xl bg-ink/[0.04] p-2.5 text-[12px] dark:bg-white/[0.06]">
          {W(lang, "It will read", "Va a decir")}:{" "}
          <span className="font-bold text-brand">
            {(signName.trim() || displayName || "—")}
            {" · "}
            {(() => { const t = SIGNER_TITLES.find(x => x.key === signTitle); return t ? (L === "es" ? t.es : t.en) : ""; })()}
          </span>
        </p>
      </Section>}

      {request && <div className="card mt-4 p-4">
        <p className="text-[12.5px] font-black">{W(lang, "Need to make a special change for this tenant?", "¿Necesita hacer un cambio especial para este arrendatario?")}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{W(lang,
          "Changes here apply only to this request. The public listing stays unchanged.",
          "Los cambios aquí se aplican solo a esta solicitud. El anuncio público no cambia.")}</p>
        <button type="button" onClick={() => setEditingLeaseDetails(value => !value)} className="btn-ghost mt-3 w-full">
          {editingLeaseDetails ? W(lang, "Return to review", "Volver a revisar") : W(lang, "Modify this request", "Modificar esta solicitud")}
        </button>
      </div>}

      {err && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>
      )}

      {showLifecycleBlockers && !lifecycleReady && lifecycleBlockers.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-700 dark:text-red-300">
          <p className="text-[12.5px] font-black">{W(lang, "Complete these steps before sending the lease:", "Complete estos pasos antes de enviar el contrato:")}</p>
          <div className="mt-1 space-y-1">
            {lifecycleBlockers.map(blocker => (
              <button key={blocker.id} type="button" onClick={() => focusSection(blocker.id)}
                className="block min-h-11 w-full rounded-lg px-2 py-2 text-left text-[12.5px] font-semibold underline underline-offset-2 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-400/60">
                {blocker.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {lifecycleIssue && !err && !showLifecycleBlockers && (
        <p role="status" className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-[12.5px] font-semibold text-amber-800 dark:text-amber-300">
          {W(lang, "Before this can be sent: ", "Antes de poder enviarlo: ")}{lifecycleIssue}
        </p>
      )}

      <p className="mt-4 text-center text-[11.5px] opacity-55">
        {W(lang, "Your draft saves automatically on this device.", "Su borrador se guarda automáticamente en este dispositivo.")}
      </p>
      <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={send}>
        {busy ? "…"
          : !lifecycleReady
            ? hostReadiness !== undefined && !hostSetupReady
                && (!request || (request.identity_status === "approved" && requestPaymentReady && requestApprovalReady))
              ? W(lang, "Complete host profile", "Completar perfil de anfitrión")
              : requestStageValue === "requested" && requestExpired
                ? W(lang, "Request expired", "Solicitud vencida")
              : requestStageValue === "requested"
                ? W(lang, "Pre-approve tenant", "Preaprobar arrendatario")
                : W(lang, "Complete tenant approval", "Completar aprobación del arrendatario")
            : blanks > 0
              ? W(lang, `Review ${blanks} required field${blanks === 1 ? "" : "s"}`,
                        `Revisar ${blanks} campo${blanks === 1 ? "" : "s"} obligatorio${blanks === 1 ? "" : "s"}`)
              : W(lang, "Sign and send to the tenant", "Firmar y enviar al arrendatario")}
      </button>
      <Link to={productHref("onerental", `/r/${property.id}`)}
        className="mt-3 block text-center text-[12px] font-bold opacity-55 underline">
        {W(lang, "Back to the listing", "Volver al anuncio")}
      </Link>
      </>}
    </div>
  );
}

function formatRequestDate(value: string, lang: string) {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString(lang === "es" || lang === "co" ? "es-CO" : "en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mt-4 space-y-3 p-4">
      <div>
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{title}</h2>
        {hint && <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-50">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${bold ? "border-t border-ink/10 pt-2 dark:border-white/12" : ""}`}>
      <span className={`text-[13px] ${bold ? "font-bold" : "opacity-70"}`}>{label}</span>
      <span className={bold ? "text-[16px] font-black tracking-tight text-brand" : "text-[13.5px] font-bold"}>{value}</span>
    </div>
  );
}

/**
 * ONE BLANK IN THE FILL-IN FORM.
 *
 * `bare` drops the label for the two compound fields (ID type + number), where a second label
 * over a 92px select reads as a bug rather than as help.
 */
function Blank({ label, v, on, ph, bare, fieldKey, invalid, inputMode, requiredText = "Required" }: {
  label: string;
  v: string;
  on: (e: { target: { value: string } }) => void;
  ph?: string;
  bare?: boolean;
  fieldKey?: string;
  invalid?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url";
  requiredText?: string;
}) {
  const input = (
    <input className={`input w-full ${invalid ? "!border-red-400 ring-2 ring-red-300/50" : ""}`}
      value={v} onChange={on} placeholder={ph} autoComplete="off" inputMode={inputMode}
      aria-invalid={invalid || undefined} />
  );
  if (bare) return <div id={fieldKey ? `lease-field-${fieldKey}` : undefined} className="self-end">{input}</div>;
  return (
    <label id={fieldKey ? `lease-field-${fieldKey}` : undefined} className="block">
      <span className="label">{label}</span>
      {input}
      {invalid && <span className="mt-1 block text-[11px] font-semibold text-red-600 dark:text-red-400">
        {requiredText}
      </span>}
    </label>
  );
}

/** Inputs that belong only to an optional clause. They appear the moment the clause is selected,
 * so choosing a clause can never create hidden placeholders in the agreement. */
function OptionalClauseFields({ clauseKey, lang, values, setValue, invalidKeys, startsOn }: {
  clauseKey: string;
  lang: string;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  invalidKeys: string[];
  startsOn: string;
}) {
  const bad = (key: string) => invalidKeys.includes(key);
  const change = (key: string) => (e: { target: { value: string } }) => setValue(key, e.target.value);
  const field = (key: string, label: string, placeholder = "", inputMode: "text" | "numeric" | "decimal" = "text") => (
    <Blank fieldKey={key} label={label} v={values[key] ?? ""} on={change(key)} ph={placeholder}
      inputMode={inputMode} invalid={bad(key)} requiredText={W(lang, "Required", "Obligatorio")} />
  );

  let content: React.ReactNode = null;
  if (clauseKey === "garantia") content = <>
    <label id="lease-field-garantia_tipo" className="block">
      <span className="label">{W(lang, "Guarantee type", "Tipo de garantía")}</span>
      <GlassSelect<string> value={values.garantia_tipo ?? ""}
        ariaLabel={W(lang, "Guarantee type", "Tipo de garantía")}
        onChange={value => setValue("garantia_tipo", value)}
        options={[
          { value: "", label: W(lang, "Choose one", "Elija una") },
          { value: W(lang, "co-signer", "codeudor"), label: W(lang, "Co-signer", "Codeudor") },
          { value: W(lang, "rent-guarantee policy", "póliza de arrendamiento"), label: W(lang, "Rent-guarantee policy", "Póliza de arrendamiento") },
          { value: W(lang, "surety", "fianza"), label: W(lang, "Surety", "Fianza") },
        ]} className={bad("garantia_tipo") ? "!border-red-400 ring-2 ring-red-300/50" : ""} />
    </label>
    {field("garantia_detalle", W(lang, "Guarantee details", "Detalles de la garantía"), W(lang, "Name, provider and reference", "Nombre, proveedor y referencia"))}
  </>;
  else if (clauseKey === "cobertura_rc") content = <>
    {field("rc_aseguradora", W(lang, "Liability insurer", "Aseguradora de responsabilidad"), W(lang, "Insurer name", "Nombre de la aseguradora"))}
    {field("rc_limite", W(lang, "Coverage limit", "Límite de cobertura"), "COP 50.000.000", "decimal")}
  </>;
  else if (clauseKey === "electrodomestico") content = <>
    {field("electrodomestico", W(lang, "Appliance", "Electrodoméstico"), W(lang, "For example: refrigerator", "Por ejemplo: nevera"))}
    <label id="lease-field-fecha_instalacion" className="block">
      <span className="label">{W(lang, "Installation date", "Fecha de instalación")}</span>
      <GlassDate value={values.fecha_instalacion ?? ""} onChange={value => setValue("fecha_instalacion", value)}
        min={startsOn} invalid={bad("fecha_instalacion")} />
    </label>
    <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
      {field("aporte_arrendatario", W(lang, "Tenant contribution", "Aporte del arrendatario"), "COP 0", "decimal")}
      {field("reembolso", W(lang, "Refund on renewal", "Reembolso en la prórroga"), "COP 0", "decimal")}
    </div>
  </>;
  else if (clauseKey === "cuenta_devolucion") content = <>
    {field("cuenta_devolucion", W(lang, "Refund account", "Cuenta para la devolución"), W(lang, "Bank and account number", "Banco y número de cuenta"))}
    {field("titular_cuenta", W(lang, "Account holder", "Titular de la cuenta"), W(lang, "Full legal name", "Nombre legal completo"))}
  </>;
  else if (clauseKey === "limpieza") content = <>
    {field("valor_limpieza", W(lang, "Cleaning value", "Valor de la limpieza"), "COP 0", "decimal")}
    {field("frecuencia_limpieza", W(lang, "Cleaning frequency", "Frecuencia de la limpieza"), W(lang, "For example: every two weeks", "Por ejemplo: cada dos semanas"))}
  </>;
  else if (clauseKey === "estadia_corta") content = <>
    <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
      <label id="lease-field-check_in" className="block">
        <span className="label">{W(lang, "Check-in time", "Hora de entrada")}</span>
        <div className={bad("check_in") ? "rounded-xl ring-2 ring-red-300/60" : ""}>
          <GlassTime value={values.check_in ?? ""} onChange={value => setValue("check_in", value)} />
        </div>
      </label>
      <label id="lease-field-check_out" className="block">
        <span className="label">{W(lang, "Check-out time", "Hora de salida")}</span>
        <div className={bad("check_out") ? "rounded-xl ring-2 ring-red-300/60" : ""}>
          <GlassTime value={values.check_out ?? ""} onChange={value => setValue("check_out", value)} />
        </div>
      </label>
    </div>
    {field("politica_cancelacion", W(lang, "Cancellation policy", "Política de cancelación"), W(lang, "Describe the policy shown on the listing", "Describa la política publicada en el anuncio"))}
  </>;

  if (!content) return null;
  return (
    <div className="ml-0 mt-3 space-y-2 rounded-xl border border-brand/20 bg-white/45 p-3 min-[390px]:ml-8 dark:bg-white/[0.04]">
      <p className="text-[11px] font-black uppercase tracking-wide text-brand">
        {W(lang, "Fill in this addendum", "Complete este anexo")}
      </p>
      <p className="text-[11.5px] leading-relaxed opacity-65">
        {W(lang,
          "These answers replace the blank lines in the clause above.",
          "Estas respuestas reemplazan los espacios en blanco de la cláusula anterior.")}
      </p>
      {content}
    </div>
  );
}
