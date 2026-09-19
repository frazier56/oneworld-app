import ReservationPaymentHelp from "./ReservationPaymentHelp";
import ExternalPaymentNotice from "./ExternalPaymentNotice";
import { useEffect, useState } from "react";
import { W, useAsync, supabase } from "@oneworld/shell";
import { rentalError } from "../lib/rental";
import RequestPanel, { RequestPill } from "./RequestPanel";
import { D } from "../lib/detailCopy";
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
  check_in_time: string | null; check_out_time: string | null;
  rental_properties?: { cleaning_fee: number | null } | null;
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const req = useAsync(async () => {
    let query = supabase.from("rental_booking_requests")
      .select("id, starts_on, ends_on, nights, quoted_total, guest_total, currency, state, approval_stage, identity_status, payment_rail, payment_status, guest_fee_rate, payment_declared_at, payment_received_at, preapproval_expires_at, expires_at, check_in_time, check_out_time, rental_properties(cleaning_fee)")
      .eq("property_id", propertyId).eq("guest_id", userId);
    query = selectedRequest ? query.eq('id', selectedRequest) : query.in('state', ['requested', 'accepted']);
    const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle<Row>();
    return data ?? null;
  }, [propertyId, userId, refresh, selectedRequest]);

  /* ── WHERE THE MONEY ACTUALLY GOES ──────────────────────────────────────────────────────
     ⚠️ UNTIL TODAY THIS CARD SAID "Send the rent by Wise, then confirm it here" AND NEVER SAID
     WHERE. There was no way to find out inside OneHome, so the two of them had to swap a link
     somewhere else — WhatsApp, email — which is precisely where a rental scam lives, because a
     link that arrives that way has nothing vouching for it.

     The server decides everything: only a party to this request gets an answer, only once the
     host has pre-approved, only while it is still open, and only the rail already chosen here.
     A card on file can never come back, and the host's OTHER destinations never come back. The
     client asks and renders; it does not judge. */
  const payTo = useAsync(async () => {
    if (!req) return null;
    const { data, error } = await supabase.rpc("rental_request_payment_instructions", { p_request_id: req.id });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as {
      rail: string | null; handle: string | null; host_name: string | null;
      amount: number | null; currency: string | null; payable: boolean; reason: string;
    } | null;
  }, [req?.id, req?.approval_stage, req?.state, refresh]);

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

  /* ⛔ THE STATUS LADDER IS GONE. Seven mutually exclusive sentences, only one of which was
     ever true, chosen by an if/else chain that had drifted out of step with the payment states
     around it. It is replaced by `lib/requestSteps.ts`, which returns the same information as a
     SEQUENCE — what is already done, what somebody still has to do, in order — because that is
     what Lee asked for and because a list you can check off cannot say two things at once. */

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
    <>
      {/* ⛔ THE BIG INLINE CARD IS GONE. It printed the dates and the money in its own header and
          then printed them AGAIN underneath — Lee, 17 September 2026: *"you literally duplicate
          it… that needs to be consolidated down."* It also ate the top of a listing page that a
          person had opened to look at a listing.

          One pill now, the same frosted shape as the header and footer chrome, and the whole
          request opens on a tap. The facts live in exactly one place, inside the sheet. */}
      <RequestPill lang={lang} onOpen={() => setOpen(true)} />
      {open && (
        <RequestPanel
          lang={lang} money={money} when={when} onClose={() => setOpen(false)}
          request={req}
          facts={{
            starts_on: req.starts_on, ends_on: req.ends_on, nights: req.nights,
            check_in_time: req.check_in_time, check_out_time: req.check_out_time,
            cleaning_fee: req.rental_properties?.cleaning_fee ?? null,
            guest_total: req.guest_total, currency: req.currency,
          }}>
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
      {/* ⛔ `ReservationHoldStatus` NO LONGER RENDERS HERE. It printed "Dates held · 24h 0m left
          to report payment. Deadline: …" as its own three-line bold block directly under the step
          it was the clock for. Lee, 17 September 2026: *"it says the host has up until the 17th.
          Again, that will all be a part of the same step."* The deadline and the hold are now one
          clause inside the payment step, which is the only place either of them means anything. */}

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
      <p className="mt-3 text-[11.5px] leading-relaxed opacity-55">
            {/* The sentence and the number come from the SAME subtraction. It used to say "no fee"
               when the RATE was zero while printing a fee derived from the TOTALS, so the two
               could disagree on one line about the same money. */}
            {(() => {
              const fee = Number(req.guest_total) - Number(req.quoted_total);
              return fee <= 0
                ? W(lang, "No OneHome service fee on this request.", "Esta solicitud no tiene comisión de OneHome.")
                : W(lang, `Includes a ${money(fee)} guest service fee.`, `Incluye una comisión de servicio del huésped de ${money(fee)}.`);
            })()}
          </p>
      {/* ⚠️ THE DEADLINE SITS WITH THE STEP IT BELONGS TO. Lee, 17 September 2026: *"it says the
          host has up until the 17th. Again, that will all be a part of the same step."* This
          countdown was printing after the footnote and after the fee sentence, three items away
          from the payment instruction it is the clock for. First thing under the sequence now. */}
      {external && declared && <ReservationPaymentHelp requestId={req.id} lang={lang} />}
      {/* ⚠️ TWO BLOCKS WERE SAYING THE SAME THING. This seven-line notice warns "confirm the
          host, recipient and amount… we cannot reverse it… wait for pre-approval" — and the
          destination block below now says the actionable half in two lines, to somebody who IS
          already pre-approved. Lee's rule: cut every sentence an adjacent one already carries.
          So the long notice appears only when there is NO destination block to carry it. */}
      {preapproved && external && !declared && !received && !expired && !payTo?.payable && <ExternalPaymentNotice lang={lang} />}
      {preapproved && !external && !expired && req.state === 'requested' && !['authorized','captured'].includes(req.payment_status) && <button type="button" disabled={busy} onClick={()=>void authorizeCard()} className="btn-primary mt-3 w-full">{busy?W(lang,'Opening card payment…','Abriendo pago con tarjeta…'):W(lang,'Authorize card payment','Autorizar pago con tarjeta')}</button>}

      {/* ── SEND IT HERE ─────────────────────────────────────────────────────────────────
          Shown only when the server says this request is payable. `payTo === undefined` is
          still loading and `null` is a failed read — in both cases say nothing rather than
          guess, because a wrong destination is money gone. */}
      {preapproved && external && !declared && !received && !expired && req.state === "requested" && payTo?.payable && (
        <div className="mt-3 rounded-2xl border border-emerald-600/30 bg-emerald-500/[0.08] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            {W(lang, "Send it here", "Envíelo aquí")}
          </p>
          {payTo.handle ? (
            <>
              <p className="mt-1.5 text-[12.5px] font-bold">
                {rail}{payTo.host_name ? ` · ${payTo.host_name}` : ""}
              </p>
              {/* The link is SELECTABLE TEXT, not only a tap target: a renter paying from a
                  laptop copies it into their bank, and one that can only be tapped is useless
                  to them. `break-all` because a pay link has no spaces to wrap at and would
                  otherwise run off a 390px screen. */}
              <a href={payTo.handle} target="_blank" rel="noopener noreferrer"
                className="mt-1 block select-all break-all text-[12.5px] font-bold text-emerald-800 underline underline-offset-2 dark:text-emerald-200">
                {payTo.handle}
              </a>
              <p className="mt-2 text-[11.5px] leading-relaxed opacity-75">
                {W(lang,
                  `Send ${money(Number(req.guest_total))}. Check the name on the other side matches before you send — OneHome never holds this money and cannot reverse it.`,
                  `Envíe ${money(Number(req.guest_total))}. Verifique que el nombre al otro lado coincida antes de enviar — OneHome nunca resguarda este dinero y no puede revertirlo.`)}
              </p>
            </>
          ) : (
            /* The host chose a rail they have no destination for, so there is nothing honest to
               print. Say that, rather than showing an empty box the renter stares at. */
            <p className="mt-1.5 text-[12px] leading-relaxed">
              {W(lang,
                `This host has not added their ${rail} details yet. Message them for it — and only send money to something they confirm inside OneHome.`,
                `Este anfitrión aún no ha agregado sus datos de ${rail}. Escríbale para pedirlos — y envíe dinero solo a algo que confirme dentro de OneHome.`)}
            </p>
          )}
        </div>
      )}

      {preapproved && external && !declared && !received && !expired && req.state === "requested" && (
        <div className="mt-3">
          <input className="field w-full" value={reference} onChange={e => setReference(e.target.value)}
            placeholder={W(lang, "Transfer reference (optional)", "Referencia de la transferencia (opcional)")} />
          <button type="button" disabled={busy} onClick={() => void declare()} className="btn-primary mt-2 w-full disabled:opacity-50">
            {/* ⚠️ Lee's rule, and this was the sentence he used to illustrate it: *"Buttons
                carry LABELS, not sentences: 'Rent sent', not 'I've sent the rent'."* The
                explanation already sits in the line underneath, which is where it belongs. */}
            {W(lang, "Rent sent", "Canon enviado")}
          </button>
          <p className="mt-1.5 text-[11px] opacity-60">
            {W(lang, "Only press this after the money has left your account. The host confirms once it arrives.",
              "Presione esto solo cuando el dinero haya salido de su cuenta. El anfitrión confirma cuando llegue.")}
          </p>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-[12px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
        </RequestPanel>
      )}
    </>
  );
}
