import ExternalPaymentNotice from "./ExternalPaymentNotice";
import { useEffect, useState } from "react";
import { CreditCard, FileCheck2, Landmark, ShieldCheck, Upload, X } from "lucide-react";
import { W, RENTAL_GUEST_FEE_RATE } from "@oneworld/shell";
import AgreementAcceptance from './AgreementAcceptance';
import StayFactsTable from './StayFactsTable';
import type { Property } from '../lib/rental';
import { getRentalLegalDocuments } from '../lib/legalDocuments';

/* `remitly` stays in the union because REQUESTS ALREADY EXIST carrying it — a type that cannot
   represent a row in the table is a type that lies. Nothing OFFERS it any more: Remitly has no
   pay-me link, so a host can never register one as a destination, and offering a guest a rail
   the host cannot receive is how money goes nowhere. */
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
  hostRails, property, cleaningFee = null,
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
  /** ⚠️ WHAT THIS HOST CAN ACTUALLY RECEIVE — from `rental_property_payout_rails`, never
      guessed. `undefined` means the answer has not arrived yet; `[]` means the host has no
      destination on file at all. The sheet used to offer all four to everybody, defaulting to
      Remitly, so a guest could choose a rail the host had no account for. */
  hostRails?: readonly RentalPaymentRail[];
  /** The listing, for the two stay times and the host's own terms. Both are facts about THIS
      property that the request is being made against, so they belong on the screen where
      somebody decides — not only on the contract that does not exist yet. */
  property?: Pick<Property, "check_in_time" | "check_out_time" | "owner_terms_enabled" | "lease_notice_days" | "payment_window_business_days" | "breach_penalty_months"> | null;
  /** The host's flat cleaning charge, shown as its own line so nobody has to work out why the
      total is bigger than the rent. Paid to the host, stated as such. */
  cleaningFee?: number | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (details: RentalRequestDetails) => void | Promise<void>;
}) {
  /* Chosen only once the host's real rails are known, and only from them. `null` until then,
     so a guest can never submit a rail that was a placeholder. */
  const [paymentRail, setPaymentRail] = useState<RentalPaymentRail | null>(null);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState<RentalRequestDetails["documentKind"]>("passport");
  const feeRate = hostPaysGuestFee || waived ? 0 : (guestFeeRate ?? RENTAL_GUEST_FEE_RATE);
  /* ⛔ THE CLEAN IS NOT IN THIS TOTAL ANY MORE. 17 September 2026, Lee: *"it's just a one-time
     cleaning fee at the end of the scheduled stay… you physically have to check out, that's when
     the cleaning fee applies."* It is charged once when the tenancy actually ends, it rolls over
     if they extend, and the host can waive it — so it belongs to the tenancy, not to the booking,
     and `create_rental_booking_request` no longer adds it to `quoted_total` either. Leaving it in
     here would quote a number the database is not going to charge, and on a renewal it would be
     charged again every single time. It is still SHOWN, as its own line, said plainly. */
  const base = stay.total;
  const [documentsAccepted, setDocumentsAccepted] = useState(false);
  const rentalLegalDocuments = getRentalLegalDocuments(lang);

  const allRails: Array<{ id: RentalPaymentRail; title: string; sub: string; icon: typeof CreditCard }> = [
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

  /* ⚠️ A CARD IS NOT OFFERED ON A MONTHLY AGREEMENT (pre-existing rule, kept) and no rail is
     offered that the host cannot receive. `hostRails` undefined = still asking; show nothing
     rather than a list that is about to change under the guest's finger. */
  const offered = hostRails === undefined
    ? []
    : allRails.filter(r => hostRails.includes(r.id)).filter(r => !monthly || r.id !== "stripe");
  const railsLoading = hostRails === undefined;
  /* The host has no destination on file — or only the legacy "I confirm my account is ready"
     tick. The request is NOT blocked: existing tenancies and hosts who ticked that box before
     15 Sep must still be able to take one. The guest is told the truth instead of being handed
     a menu of rails that lead nowhere. */
  const arrangeWithHost = !railsLoading && offered.length === 0;

  /* Pick the first rail the host can take, once we know. Re-runs if the answer changes, and
     clears a choice that is no longer on offer — a guest who picked Wise must not keep it if
     the host removed the link while the sheet was open. */
  useEffect(() => {
    if (railsLoading) return;
    setPaymentRail(prev => (prev && offered.some(r => r.id === prev) ? prev : offered[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railsLoading, offered.map(r => r.id).join(",")]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="rental-request-title">
      <button type="button" aria-label={W(lang, "Close request", "Cerrar solicitud")}
        className="absolute inset-0 cursor-default" onClick={busy ? undefined : onClose} />
      <section className="relative z-10 max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/35 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-slate-950/95 sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* ⛔ THE DATE LINE THAT USED TO SIT HERE IS GONE. It said the dates and the night
                count, and the facts block four lines below said the dates and the night count
                again. Same duplication Lee caught on the request card. One place only. */}
            <h2 id="rental-request-title" className="text-xl font-black">{W(lang, "Request this home", "Solicitar este hogar")}</h2>
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
            <span className="font-bold">{money(base * feeRate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-2 dark:border-white/10">
            <span className="text-sm font-black">{W(lang, "Estimated total", "Total estimado")}</span>
            <strong className="text-lg">{money(base * (1 + feeRate))}</strong>
          </div>
          {waived && <p className="text-[11px] leading-relaxed text-brand-deep dark:text-brand-light">
            {W(lang, "No OneHome service fee on this request, for you or the host.", "Esta solicitud no tiene comisión de OneHome, ni para usted ni para el anfitrión.")}
          </p>}
          {!waived && hostPaysGuestFee && <p className="text-[11px] leading-relaxed text-brand-deep dark:text-brand-light">
            {W(lang, "This host covers the guest service fee.", "Este anfitrión cubre la comisión de servicio del huésped.")}
          </p>}
        </div>

        {/* ⛔ A PARAGRAPH OF INVENTED TERMS USED TO SIT HERE on every monthly request, identical
            on every property. It is deleted. What shows now is exactly what this person is asking
            for — the six facts — and, under them, only the terms this host actually set. */}
        <div className="mt-4">
          <StayFactsTable lang={lang} money={money} property={property ?? null}
            facts={{ starts_on: stay.starts_on, ends_on: stay.ends_on, nights: stay.nights,
              check_in_time: property?.check_in_time, check_out_time: property?.check_out_time,
              cleaning_fee: cleaningFee,
              guest_total: base * (1 + feeRate), currency: undefined }} />
        </div>
        <fieldset className="mt-5 space-y-2">
          <legend className="mb-2 text-sm font-black">{W(lang, "How would you like to pay?", "¿Cómo desea pagar?")}</legend>
          {railsLoading && (
            <p className="text-[12px] opacity-60" role="status">
              {W(lang, "Checking how this host accepts payment…", "Consultando cómo acepta pagos este anfitrión…")}
            </p>
          )}
          {arrangeWithHost && (
            <p className="rounded-2xl border border-ink/10 p-3 text-[12px] leading-relaxed opacity-75 dark:border-white/10">
              {W(lang,
                "This host has not listed a way to be paid yet. You can still send the request — once they pre-approve it, the two of you agree how payment is made.",
                "Este anfitrión aún no ha registrado una forma de cobro. Puede enviar la solicitud igualmente — cuando la preapruebe, ustedes acuerdan cómo se hace el pago.")}
            </p>
          )}
          {offered.map(({ id, title, sub, icon: Icon }) => (
 <label key={id} className={`ow-edge flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${paymentRail === id ? "border-brand bg-brand/[0.08]" : " "}`}>
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
        {paymentRail && paymentRail !== "stripe" && <ExternalPaymentNotice lang={lang} />}

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
          onClick={() => void onSubmit({ paymentRail: paymentRail ?? "remitly", identityFile, documentKind, termsAccepted: documentsAccepted })}
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
