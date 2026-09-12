import ReservationPaymentHelp from "./ReservationPaymentHelp";
import ReservationHoldStatus from "./ReservationHoldStatus";
import ExternalPaymentNotice from "./ExternalPaymentNotice";
import { useEffect, useState } from "react";
import { W, useAsync, supabase } from "@oneworld/shell";
import { rentalError } from "../lib/rental";
import { useSearchParams } from "react-router-dom";
import { FileCheck2, Upload } from "lucide-react";

/**
 * THE TENANT'S OWN REQUEST, ON THE LISTING THEY REQUESTED.
 *
 * Until 7 Sep 2026 a guest who had submitted a request had no screen that showed it — not its
 * dates, not what they would pay, and not where it stood. The host had a full panel; the tenant
 * had nothing. This card is that missing half, and it carries the one action the payment order
 * needs from the tenant: "I've sent the rent". The database refuses the host's "received" until
 * this has been recorded, so the sequence is host pre-approves → tenant sends → host confirms.
 */
type Row = {
  id: string; starts_on: string; ends_on: string; nights: number;
  quoted_total: number; guest_total: number; currency: string; state: string; approval_stage: string;
  payment_rail: string | null; payment_status: string; guest_fee_rate: number;
  identity_status: string;
  payment_declared_at: string | null; payment_received_at: string | null; preapproval_expires_at: string | null; expires_at: string;
};

const RAIL: Record<string, string> = { remitly: "Remitly", wise: "Wise", paypal: "PayPal", stripe: "card", western_union: "Western Union", bank_transfer: "bank transfer", cash: "cash", other: "" };

export default function MyRequestCard({ propertyId, userId, lang }: { propertyId: string; userId: string; lang: string }) {
  const [params] = useSearchParams();
  const selectedRequest = params.get('request');
  const [clock, setClock] = useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{const reset=()=>setBusy(false);window.addEventListener("pageshow",reset);return()=>window.removeEventListener("pageshow",reset);},[]);
  const [refresh, setRefresh] = useState(0);
  const [reference, setReference] = useState("");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState<"passport" | "national_id" | "residence_permit">("passport");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const req = useAsync(async () => {
    let query = supabase.from("rental_booking_requests")
      .select("id, starts_on, ends_on, nights, quoted_total, guest_total, currency, state, approval_stage, identity_status, payment_rail, payment_status, guest_fee_rate, payment_declared_at, payment_received_at, preapproval_expires_at, expires_at")
      .eq("property_id", propertyId).eq("guest_id", userId);
    query = selectedRequest ? query.eq('id', selectedRequest) : query.in('state', ['requested', 'accepted']);
    const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle<Row>();
    return data ?? null;
  }, [propertyId, userId, refresh, selectedRequest]);

  if (!req) return selectedRequest ? <p role="status" className="card p-4">{W(lang, 'The selected request is unavailable or still loading. No other request has been selected.', 'La solicitud seleccionada no está disponible o sigue cargando. No se seleccionó otra solicitud.')}</p> : null;
  const es = lang === "es" || lang === "co";
  const money = (n: number) => new Intl.NumberFormat(es ? "es-CO" : "en-US", { style: "currency", currency: req.currency || "COP", maximumFractionDigits: 0 }).format(n);
  const rail = RAIL[req.payment_rail ?? ""] ?? req.payment_rail ?? "";
  const preapproved = ["preapproved_id_required", "preapproved_ready"].includes(req.approval_stage);
  const declared = !!req.payment_declared_at;
  const received = !!req.payment_received_at || req.payment_status === "received";
  const external = req.payment_rail !== "stripe";
  const expired = req.state === 'expired' || (!declared && !received && req.state === 'requested'
    && new Date(req.preapproval_expires_at || req.expires_at).getTime() <= clock);
  const when = (iso: string) => new Date(iso).toLocaleDateString(es ? "es-CO" : "en-US", { day: "numeric", month: "short" });

  let status: string;
  if (req.state === "accepted") status = W(lang, "Approved — your stay is confirmed.", "Aprobada — su estadía está confirmada.");
  else if (expired) status = W(lang, "This request expired. Do not send payment. Contact the host about a new request.", "Esta solicitud venció. No envíe el pago. Contacte al anfitrión sobre una nueva solicitud.");
  else if (received) status = W(lang, "Payment received. Identity review and final approval are still pending.", "Pago recibido. La revisión de identidad y la aprobación final siguen pendientes.");
  else if (declared) status = W(lang, `You confirmed sending it on ${when(req.payment_declared_at!)}. Waiting for the host to confirm receipt.`, `Usted confirmó el envío el ${when(req.payment_declared_at!)}. Esperando que el anfitrión confirme la recepción.`);
  else if (preapproved && external) status = W(lang, `Pre-approved. Send the rent by ${rail}, then confirm it here.`, `Preaprobada. Envíe el canon por ${rail} y confírmelo aquí.`);
  else if (preapproved) status = W(lang, "Pre-approved. Complete the card step to continue.", "Preaprobada. Complete el paso de la tarjeta para continuar.");
  else status = W(lang, "Request sent — waiting for the host to review it.", "Solicitud enviada — esperando la revisión del anfitrión.");

  async function authorizeCard() {
    if (!req || busy) return;
    setBusy(true); setErr(null);
    try {
      const {data,error}=await supabase.functions.invoke("rental-create-authorization",{body:{requestId:req.id}});
      if(error || !data?.url) throw error || Error("Card authorization is unavailable.");
      window.location.assign(data.url);
    } catch {setErr(W(lang,"Could not open card authorization. Try again.","No se pudo abrir la autorización de tarjeta. Reintente."));setBusy(false);}
  }
  async function declare() {
    if (!req || !req.payment_rail) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("rental_booking_declare_payment", {
      p_request_id: req.id, p_rail: req.payment_rail, p_reference: reference.trim() || null, p_guest_name: null,
    });
    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    setRefresh(v => v + 1);
  }

  async function submitIdentity() {
    if (!req || !identityFile || busy) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowedTypes.has(identityFile.type)) {
      setErr(W(lang, "Choose a JPEG, PNG, WebP or PDF file.", "Elija un archivo JPEG, PNG, WebP o PDF."));
      return;
    }
    if (identityFile.size < 1 || identityFile.size > 15 * 1024 * 1024) {
      setErr(W(lang, "The ID file must be 15 MB or smaller.", "El archivo de identificación debe pesar 15 MB o menos."));
      return;
    }
    setBusy(true); setErr(null);
    try {
    const safeName = identityFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${req.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("rental-request-identity").upload(path, identityFile, {
      contentType: identityFile.type, upsert: false,
    });
    if (uploadError) {
      setErr(W(lang, "Your ID could not be uploaded. Please try again.", "No se pudo cargar su identificación. Inténtelo de nuevo."));
      setBusy(false);
      return;
    }
    const { data: insertedDocument, error: documentError } = await supabase.from("rental_request_identity_documents").insert({
      request_id: req.id, guest_id: userId, storage_path: path,
      document_kind: documentKind, side: documentKind === "passport" ? "photo_page" : "front",
      mime_type: identityFile.type, byte_size: identityFile.size,
    }).select("id").single<{ id: string }>();
    if (documentError || !insertedDocument?.id) {
      await supabase.storage.from("rental-request-identity").remove([path]);
      setErr(W(lang, "Your ID record could not be secured. Please try again.", "No se pudo proteger el registro de su identificación. Inténtelo de nuevo."));
      setBusy(false);
      return;
    }
    const { error: submittedError } = await supabase.rpc("mark_rental_identity_submitted", { p_request_id: req.id });
    if (submittedError) {
      if (insertedDocument?.id) {
        const { data: removed, error: cleanupError } = await supabase.from("rental_request_identity_documents")
          .delete().eq("id", insertedDocument.id).select("id");
        if (cleanupError || !removed?.some(row => row.id === insertedDocument.id)) {
          setErr(W(lang, "Submission could not be confirmed. Your private ID was retained; please refresh the request before trying again.", "No se pudo confirmar el envío. Su identificación privada se conservó; actualice la solicitud antes de intentar de nuevo."));
          return;
        }
      }
      await supabase.storage.from("rental-request-identity").remove([path]);
      setErr(rentalError(submittedError, lang));
      setBusy(false);
      return;
    }
    setIdentityFile(null);
    setBusy(false);
    setRefresh(value => value + 1);
    } catch {
      setErr(W(lang, "Submission could not be confirmed. Refresh the request before trying again.", "No se pudo confirmar el envío. Actualice la solicitud antes de intentar de nuevo."));
    } finally { setBusy(false); }
  }

  return (
    <section aria-label={W(lang, "Your request", "Su solicitud")}
      className="mb-4 rounded-2xl border border-brand/25 bg-brand/[0.07] p-4 dark:border-brand/30 dark:bg-brand/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black">{W(lang, "Your request", "Su solicitud")}</h2>
          <p className="mt-0.5 text-[12.5px] opacity-70">{req.starts_on} → {req.ends_on} · {req.nights} {W(lang, "nights", "noches")}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-60">{W(lang, "You pay", "Usted paga")}</p>
          <p className="text-base font-black">{money(Number(req.guest_total))}</p>
        </div>
      </div>
      <p className="mt-2 text-[12px] font-bold">
        {Number(req.guest_fee_rate) === 0
          ? W(lang, "No OneHome service fee on this request.", "Esta solicitud no tiene comisión de OneHome.")
          : W(lang, `Includes a ${money(Number(req.guest_total) - Number(req.quoted_total))} guest service fee.`, `Incluye una comisión de servicio del huésped de ${money(Number(req.guest_total) - Number(req.quoted_total))}.`)}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed">{status}</p>
      {req.state === 'requested' && <ReservationHoldStatus lang={lang} deadline={preapproved?req.preapproval_expires_at:null} paymentReported={declared||received||['authorized','captured'].includes(req.payment_status)} />}
      {preapproved && !expired && !["submitted", "approved"].includes(req.identity_status) && (
        <div className="mt-3 rounded-2xl border border-sky-500/30 bg-sky-500/[0.08] p-3">
          <p className="text-sm font-black text-sky-800 dark:text-sky-200">{W(lang, "Submit your passport or government ID", "Envíe su pasaporte o documento de identidad")}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-70">{W(lang,
            "The host must review this before final approval. Your document stays private between you and the property host.",
            "El anfitrión debe revisarlo antes de la aprobación final. Su documento se mantiene privado entre usted y el anfitrión del inmueble.")}</p>
          <select value={documentKind} onChange={event => setDocumentKind(event.target.value as typeof documentKind)}
            aria-label={W(lang, "Document type", "Tipo de documento")} className="field mt-3 w-full">
            <option value="passport">{W(lang, "Passport", "Pasaporte")}</option>
            <option value="national_id">{W(lang, "Government ID", "Documento de identidad")}</option>
            <option value="residence_permit">{W(lang, "Residence permit", "Permiso de residencia")}</option>
          </select>
          <label className="ow-tap mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-600/35 bg-white/55 px-3 text-center text-[13px] font-bold text-sky-800 dark:bg-white/[0.06] dark:text-sky-200">
            {identityFile ? <FileCheck2 size={18} /> : <Upload size={18} />}
            <span>{identityFile ? identityFile.name : W(lang, "Choose passport or ID", "Elegir pasaporte o documento")}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only"
              onChange={event => setIdentityFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="button" disabled={busy || !identityFile} onClick={() => void submitIdentity()}
            className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-45">
            {busy ? W(lang, "Submitting ID…", "Enviando identificación…") : W(lang, "Submit ID to the host", "Enviar identificación al anfitrión")}
          </button>
        </div>
      )}
      {external && declared && <ReservationPaymentHelp requestId={req.id} lang={lang} />}
      {preapproved && external && !declared && !received && !expired && <ExternalPaymentNotice lang={lang} />}
      {preapproved && !external && !expired && req.state === 'requested' && !['authorized','captured'].includes(req.payment_status) && <button type="button" disabled={busy} onClick={()=>void authorizeCard()} className="btn-primary mt-3 w-full">{busy?W(lang,'Opening card payment…','Abriendo pago con tarjeta…'):W(lang,'Authorize card payment','Autorizar pago con tarjeta')}</button>}

      {preapproved && external && !declared && !received && !expired && req.state === "requested" && (
        <div className="mt-3">
          <input className="field w-full" value={reference} onChange={e => setReference(e.target.value)}
            placeholder={W(lang, "Transfer reference (optional)", "Referencia de la transferencia (opcional)")} />
          <button type="button" disabled={busy} onClick={() => void declare()} className="btn-primary mt-2 w-full disabled:opacity-50">
            {W(lang, "I've sent the rent", "Ya envié el canon")}
          </button>
          <p className="mt-1.5 text-[11px] opacity-60">
            {W(lang, "Only press this after the money has left your account. The host confirms once it arrives.",
              "Presione esto solo cuando el dinero haya salido de su cuenta. El anfitrión confirma cuando llegue.")}
          </p>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-[12px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
    </section>
  );
}
