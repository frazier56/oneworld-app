import ExternalPaymentNotice from "./ExternalPaymentNotice";
import { useState } from "react";
import { CreditCard, FileCheck2, Landmark, ShieldCheck, Upload, X } from "lucide-react";
import { W, RENTAL_GUEST_FEE_RATE } from "@oneworld/shell";
import { monthlyTerms } from '../lib/monthly';
import AgreementAcceptance from './AgreementAcceptance';
import { getRentalLegalDocuments } from '../lib/legalDocuments';

export type RentalPaymentRail = "stripe" | "remitly" | "wise" | "paypal";

export type RentalRequestDetails = {
  paymentRail: RentalPaymentRail;
  identityFile: File | null;
  documentKind: "passport" | "national_id" | "residence_permit";
  termsAccepted: boolean;
};

type Stay = { starts_on: string; ends_on: string; total: number; nights: number };

export default function RentalRequestSheet({
  lang, stay, money, hostPaysGuestFee, busy, error, onClose, onSubmit, monthly=false, guestFeeRate, waived=false,
}: {
  lang: string;
  monthly?: boolean;
  stay: Stay;
  money: (amount: number) => string;
  hostPaysGuestFee: boolean;
  /** Server-quoted guest rate for THIS guest on THIS listing (see `rental_fee_preview`).
      Undefined until the preview answers; then the standard rate is the fallback. A scoped
      waiver returns 0 here so the estimate matches what the database will stamp on submit. */
  guestFeeRate?: number;
  waived?: boolean;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (details: RentalRequestDetails) => void | Promise<void>;
}) {
  const [paymentRail, setPaymentRail] = useState<RentalPaymentRail>("remitly");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState<RentalRequestDetails["documentKind"]>("passport");
  const feeRate = hostPaysGuestFee || waived ? 0 : (guestFeeRate ?? RENTAL_GUEST_FEE_RATE);
  const [documentsAccepted, setDocumentsAccepted] = useState(false);
  const rentalLegalDocuments = getRentalLegalDocuments(lang);

  const rails: Array<{ id: RentalPaymentRail; title: string; sub: string; icon: typeof CreditCard }> = [
    {
      id: "remitly", icon: Landmark,
      title: W(lang, "Remitly — primary payout route", "Remitly — medio principal de pago"),
      sub: W(lang, "Pay after pre-approval. The host confirms receipt before the booking becomes final.", "Pague después de la preaprobación. El anfitrión confirma la recepción antes de finalizar la reserva."),
    },
    {
      id: "stripe", icon: CreditCard,
      title: W(lang, "Card authorization", "Autorización de tarjeta"),
      sub: W(lang, "Authorize your card after host pre-approval. Card availability depends on the host's payout country.", "Autorice la tarjeta después de la preaprobación. La disponibilidad depende del país de pago del anfitrión."),
    },
    {
      id: "wise", icon: Landmark,
      title: "Wise",
      sub: W(lang, "Pay after pre-approval; the host confirms receipt.", "Pague después de la preaprobación; el anfitrión confirma la recepción."),
    },
    {
      id: "paypal", icon: Landmark,
      title: "PayPal",
      sub: W(lang, "Pay after pre-approval; the host confirms receipt.", "Pague después de la preaprobación; el anfitrión confirma la recepción."),
    },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="rental-request-title">
      <button type="button" aria-label={W(lang, "Close request", "Cerrar solicitud")}
        className="absolute inset-0 cursor-default" onClick={busy ? undefined : onClose} />
      <section className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/35 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-slate-950/95 sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="rental-request-title" className="text-xl font-black">{W(lang, "Request this home", "Solicitar este hogar")}</h2>
            <p className="mt-1 text-[12.5px] opacity-60">{stay.starts_on} → {stay.ends_on} · {stay.nights} {W(lang, "nights", "noches")}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy}
            className="ow-tap grid h-10 w-10 shrink-0 place-items-center rounded-full" aria-label={W(lang, "Close", "Cerrar")}>
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border border-ink/10 bg-white/55 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="font-bold opacity-65">{W(lang, "Base rent", "Canon base")}</span>
            <span className="font-bold">{money(stay.total)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="font-bold opacity-65">{W(lang, "Guest service fee", "Comisión de servicio del huésped")}</span>
            <span className="font-bold">{money(stay.total * feeRate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-2 dark:border-white/10">
            <span className="text-sm font-black">{W(lang, "Estimated total", "Total estimado")}</span>
            <strong className="text-lg">{money(stay.total * (1 + feeRate))}</strong>
          </div>
          {waived && <p className="text-[11px] leading-relaxed text-brand-deep dark:text-brand-light">
            {W(lang, "No OneHome service fee on this request, for you or the host.", "Esta solicitud no tiene comisión de OneHome, ni para usted ni para el anfitrión.")}
          </p>}
          {!waived && hostPaysGuestFee && <p className="text-[11px] leading-relaxed text-brand-deep dark:text-brand-light">
            {W(lang, "This host covers the guest service fee.", "Este anfitrión cubre la comisión de servicio del huésped.")}
          </p>}
        </div>

        {monthly && <div className="mt-4 rounded-2xl border border-brand/25 bg-brand/10 p-4 text-sm"><strong>{W(lang,'Proposed monthly agreement','Acuerdo mensual propuesto')}</strong><p className="mt-2">{monthlyTerms(lang==='es'||lang==='co')}</p><p className="mt-2 text-xs">{W(lang,'Accepting below proposes these terms to the host. It does not confirm a booking. Pre-stay cancellation rules remain separate.','Aceptar abajo propone estos términos al anfitrión. No confirma una reserva. Las reglas de cancelación previas a la estadía son aparte.')}</p></div>}
        <fieldset className="mt-5 space-y-2">
          <legend className="mb-2 text-sm font-black">{W(lang, "How would you like to pay?", "¿Cómo desea pagar?")}</legend>
          {rails.filter(rail=>!monthly||rail.id!=='stripe').map(({ id, title, sub, icon: Icon }) => (
            <label key={id} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${paymentRail === id ? "border-brand bg-brand/[0.08]" : "border-ink/10 dark:border-white/10"}`}>
              <input type="radio" name="rental-payment-rail" value={id} checked={paymentRail === id}
                onChange={() => setPaymentRail(id)} className="sr-only" />
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm dark:bg-white/10"><Icon size={18} /></span>
              <span className="min-w-0">
                <strong className="block text-[13px]">{title}</strong>
                <span className="mt-0.5 block text-[11.5px] leading-snug opacity-60">{sub}</span>
              </span>
              <span aria-hidden="true" className={`ml-auto mt-2 h-4 w-4 shrink-0 rounded-full border-2 ${paymentRail === id ? "border-brand bg-brand shadow-[inset_0_0_0_3px_white]" : "border-ink/25"}`} />
            </label>
          ))}
        </fieldset>
        <p className="mt-2 text-xs">{W(lang,"Submitting this request does not hold the dates. The hold starts when the host pre-approves.","Enviar esta solicitud no reserva las fechas. La reserva temporal comienza cuando el anfitrión preaprueba.")}</p>
        {paymentRail !== "stripe" && <ExternalPaymentNotice lang={lang} />}

        <div className="mt-5 rounded-2xl border border-ink/10 p-4 dark:border-white/10">
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-black">{W(lang, "Verify your identity", "Verifique su identidad")}</h3>
              <p className="mt-1 text-[11.5px] leading-relaxed opacity-65">
                {W(lang,
                  "You may add your passport or ID now, which can improve your chance of approval. You may also wait: the host can pre-approve you, but final approval will remain pending until your ID is uploaded and reviewed.",
                  "Puede agregar su pasaporte o identificación ahora, lo que puede mejorar su posibilidad de aprobación. También puede esperar: el anfitrión puede preaprobarle, pero la aprobación final quedará pendiente hasta que cargue y se revise su identificación.")}
              </p>
            </div>
          </div>
          <select value={documentKind} onChange={e => setDocumentKind(e.target.value as RentalRequestDetails["documentKind"])}
            className="field mt-3 w-full" aria-label={W(lang, "Document type", "Tipo de documento")}>
            <option value="passport">{W(lang, "Passport", "Pasaporte")}</option>
            <option value="national_id">{W(lang, "National ID", "Documento nacional")}</option>
            <option value="residence_permit">{W(lang, "Residence permit", "Permiso de residencia")}</option>
          </select>
          <label className="ow-tap mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand/45 px-3 text-center text-[13px] font-bold text-brand-deep dark:text-brand-light">
            {identityFile ? <FileCheck2 size={18} /> : <Upload size={18} />}
            <span>{identityFile ? identityFile.name : W(lang, "Add ID now (optional)", "Agregar identificación ahora (opcional)")}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only"
              onChange={e => setIdentityFile(e.target.files?.[0] ?? null)} />
          </label>
          {identityFile && identityFile.size > 15 * 1024 * 1024 && (
            <p className="mt-2 text-xs font-bold text-red-600">{W(lang, "The file must be 15 MB or smaller.", "El archivo debe pesar 15 MB o menos.")}</p>
          )}
        </div>

        <div className="mt-4"><AgreementAcceptance documents={rentalLegalDocuments} locale={lang}
          onChange={docs => setDocumentsAccepted(docs.length === rentalLegalDocuments.length)} /></div>

        {error && <p className="mt-3 text-sm font-bold text-red-600" role="alert">{error}</p>}
        <button type="button" disabled={busy || !documentsAccepted || !!(identityFile && identityFile.size > 15 * 1024 * 1024)}
          onClick={() => void onSubmit({ paymentRail, identityFile, documentKind, termsAccepted: documentsAccepted })}
          className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-45">
          {busy ? W(lang, "Submitting…", "Enviando…") : W(lang, "Submit rental request", "Enviar solicitud de arriendo")}
        </button>
        <p className="mt-2 text-center text-[10.5px] leading-relaxed opacity-45">
          {W(lang, "Submitting is not final approval and does not guarantee the home.", "Enviar la solicitud no es una aprobación final ni garantiza el inmueble.")}
        </p>
      </section>
    </div>
  );
}
