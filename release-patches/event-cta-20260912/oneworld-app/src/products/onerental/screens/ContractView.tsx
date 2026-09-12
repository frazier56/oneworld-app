import { rentalMoney, unsignedTenantStatus } from "../lib/requestDisplay";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, IconCheck, IconCamera, ScreenHeading,
} from "@oneworld/shell";
import {
  buildSnapshot, sha256, stamp, ADDENDUMS, rentalError,
  hostFee, guestFee, netToManager, totalDueFromGuest,
} from "../lib/rental";
import { SIGNER_TITLES } from "../lib/coTemplate";
import MonthlyRentalPanel from '../components/MonthlyRentalPanel';
import StayReviews from '../components/StayReviews';
import { monthlyTerms } from '../lib/monthly';

/**
 * /rentals/c/:id — the contract itself. Accept it, or read the signed copy.
 * ============================================================================================
 * Lee: *"it shows the same thing for both parties. And then both people can always pull it up as
 * a contract if they ever want to show it, print it, save it, share it."* So this screen is the
 * SAME screen for both sides — the only difference is which button is available.
 *
 * ── `awaiting_first_payment` IS A REAL STATE ────────────────────────────────────────────────
 * Lee, 10 Aug: *"in order to accept the deal, that money needs to be transferred over and
 * basically set in the vault."* So accepting does not make a lease active when a deposit is
 * required — it moves the contract to `awaiting_first_payment`, and only the money makes it active.
 * Without that state a tenant "accepts", the manager blocks out the calendar, and nothing ever
 * arrived. The screen says which of the two just happened, in words.
 *
 * ⚠️ THE DEPOSIT CAPTURE IS NOT WIRED. Phase 4 touches the live money layer, and money changes
 * stop for Lee. The button that would take the deposit is honest about that rather than pretending
 * — a dead control that looks live is worse than a control that says what it is waiting for.
 */
export default function ContractView() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId, displayName } = useOneId();
  const es = lang === "es" || lang === "co";
  const L: "en" | "es" = es ? "es" : "en";
  const [signName, setSignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const c = useAsync(async () => {
    const { data } = await supabase.from("rental_contracts")
      .select("id, property_id, agent_id, tenant_id, tenant_name, tenant_email, starts_on, ends_on, " +
              "bill_interval, bill_interval_count, rent_amount, deposit_required, deposit_amount, " +
              "deposit_status, fee_rate, host_fee_rate, guest_fee_rate, document_url, addendum_keys, " +
              "contract_snapshot, snapshot_sha256, " +
              "agent_signed_at, agent_signed_name, agent_signed_title, " +
              "tenant_signed_at, tenant_signed_name, tenant_signed_title, " +
              "inspection_days, response_days, status, terms_extra, currency, booking_request_id")
      .eq("id", id).maybeSingle();
    return data as any;
  }, [id, tick]);

  const prop = useAsync(async () => {
    if (!c) return null;
    const [{ data }, addressResult] = await Promise.all([
      supabase.from("rental_properties")
        .select("id, title, city, neighbourhood").eq("id", c.property_id).maybeSingle(),
      supabase.rpc("rental_property_address", { p_property_id: c.property_id }),
    ]);
    return data ? { ...data, address_line: typeof addressResult.data === "string" ? addressResult.data : null } : null;
  }, [c?.property_id], !!c);

  const iAmAgent = !!userId && c?.agent_id === userId;
  const iAmTenant = !!userId && (c?.tenant_id === userId || (!c?.tenant_id && !iAmAgent));
  const signed = !!c?.contract_snapshot;
  const money = (amount: number) => rentalMoney(amount, c?.currency, lang);

  /**
   * ACCEPT. Builds the FINAL snapshot with both stamps, hashes it, and writes both in the same
   * update — after which the database refuses to let either change, forever.
   */
  async function accept() {
    if (!c || !userId) return;
    setBusy(true); setErr(null);
    const now = new Date().toISOString();
    const name = signName.trim() || displayName || "";
    const tt = SIGNER_TITLES.find(x => x.key === "tenant")!;
    const tenantTitle = L === "es" ? tt.es : tt.en;
    const draft = sessionStorage.getItem(`ow-rental-draft-${c.id}`) ?? "";
    /* Rebuild from the same inputs rather than trusting the draft blindly — the draft is a
       convenience, not the source of truth. If it is missing the contract still signs. */
    const body = c.terms_extra?.draft_body || draft.split("──────────────────────────────────────────")[1]?.trim() || draft || "";
    const snapshot = buildSnapshot({
      documentText: body + (c.terms_extra?.monthly_agreement ? '\n\n'+monthlyTerms(L==='es') : ''),
      /* Current drafts already contain their selected clauses. Only the legacy fallback body
         needs the builder to append addendums; otherwise a second raw-token copy is signed. */
      addendumKeys: c.terms_extra?.draft_body ? [] : (c.addendum_keys ?? []),
      lang: L,
      /* Both stamps carry a CAPACITY, not just a name — Lee, 10 Aug: *"they list your title,
         property owner, property manager, property agent."* */
      agent: {
        name: `${c.agent_signed_name ?? ""}${c.agent_signed_title ? ` · ${c.agent_signed_title}` : ""}`,
        at: c.agent_signed_at ?? now,
      },
      tenant: { name: `${name} · ${tenantTitle}`, at: now },
      property: `${prop?.title ?? ""} — ${[prop?.neighbourhood, prop?.city].filter(Boolean).join(", ")}`,
      term: `${c.starts_on} → ${c.ends_on}`,
      rent: money(Number(c.rent_amount)),
      deposit: c.deposit_required ? money(Number(c.deposit_amount)) : null,
      /* The contract row is the authority after creation. Reading the current shell constants
         here would silently reprice an older lease when OneHome changes its rates. */
      hostFeeAmount: money(hostFee(Number(c.rent_amount), Number(c.host_fee_rate))),
      guestFeeAmount: money(guestFee(Number(c.rent_amount), Number(c.guest_fee_rate))),
      totalPlatformFees: money(hostFee(Number(c.rent_amount), Number(c.host_fee_rate)) + guestFee(Number(c.rent_amount), Number(c.guest_fee_rate))),
    });
    const hash = await sha256(snapshot);

    const { error } = await supabase.from("rental_contracts").update({
      tenant_id: userId,
      tenant_signed_at: now,
      tenant_signed_name: name,
      tenant_signed_title: tenantTitle,
      contract_snapshot: snapshot,
      snapshot_sha256: hash,
      accepted_at: now,
      /* THE STATE THAT MATTERS. A deposit-required contract is NOT active on acceptance. */
      status: "awaiting_first_payment",
      deposit_status: c.deposit_required ? "pending" : "none",
      activated_at: null,
    }).eq("id", c.id);

    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    setTick(t => t + 1);
  }

  /* SAYING NO IS A STEP TOO. The `declined` status existed from day one and nothing on any
     screen could reach it — a tenant who did not want the place had a Sign button and no other
     door, which is the "a done state is still a door" finding in reverse. */
  async function decline() {
    if (!c || !userId) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("rental_contracts")
      .update({ status: "declined" }).eq("id", c.id);
    setBusy(false);
    if (error) { setErr(rentalError(error, lang)); return; }
    setTick(t => t + 1);
  }

  if (c === undefined) return <div className="py-6"><div className="card ow-shimmer h-72" /></div>;
  if (!c) return <div className="py-12 text-center text-sm opacity-60">
    {W(lang, "Contract not found.", "Contrato no encontrado.")}
  </div>;

  return (
    <div className="space-y-4">
      <ScreenHeading>
        {W(lang, "Rental agreement", "Contrato de arrendamiento")}
      </ScreenHeading>
      <p className="mt-1 text-[12.5px] opacity-60">{prop?.title}</p>

      {prop?.address_line && (
        <a
          className="ow-tap inline-flex min-h-11 items-center rounded-xl border border-brand/25 px-4 text-sm font-bold text-brand"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([prop.address_line, prop.city].filter(Boolean).join(", "))}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {W(lang, "Get directions", "Cómo llegar")}
        </a>
      )}

      <StatusBanner c={c} lang={lang} />
      {c.terms_extra?.monthly_agreement && <MonthlyRentalPanel propertyId={c.property_id} userId={userId} hostId={c.agent_id} amount={Number(c.rent_amount)} currency={c.currency} lang={lang} selectedRequestId={c.booking_request_id}/>}

      {/* ── THE TERMS, IN A TABLE ANYONE CAN READ ────────────────────────────────────────── */}
      <section className="card mt-4 space-y-1.5 p-4">
        <Row l={W(lang, "Term", "Término")} v={`${c.starts_on} → ${c.ends_on}`} />
        <Row l={W(lang, "Rent", "Canon")} v={money(Number(c.rent_amount))} />
        {c.deposit_required && <Row l={W(lang, "Deposit", "Depósito")} v={money(Number(c.deposit_amount))} />}
        <Row l={W(lang, "Host fee", "Comisión del anfitrión")}
          v={`${money(hostFee(Number(c.rent_amount), Number(c.host_fee_rate)))} / ${W(lang, "payment", "pago")}`} />
        <Row l={W(lang, "Host receives", "El anfitrión recibe")}
          v={`${money(netToManager(Number(c.rent_amount), Number(c.host_fee_rate)))} / ${W(lang, "payment", "pago")}`} />
        <Row l={W(lang, "Guest fee", "Comisión del huésped")}
          v={`${money(guestFee(Number(c.rent_amount), Number(c.guest_fee_rate)))} / ${W(lang, "payment", "pago")}`} />
        <Row l={W(lang, "Guest pays", "El huésped paga")}
          v={`${money(totalDueFromGuest(Number(c.rent_amount), Number(c.guest_fee_rate)))} / ${W(lang, "payment", "pago")}`} />
        <Row l={W(lang, "Total platform fees", "Comisiones totales de la plataforma")}
          v={`${money(hostFee(Number(c.rent_amount), Number(c.host_fee_rate)) + guestFee(Number(c.rent_amount), Number(c.guest_fee_rate)))} / ${W(lang, "monthly payment", "pago mensual")}`} />
        {(c.addendum_keys ?? []).length > 0 && (
          <Row l={W(lang, "Addendums", "Anexos")}
            v={ADDENDUMS.filter(a => c.addendum_keys.includes(a.key)).map(a => a.title[L]).join(", ")} />
        )}
        {c.document_url && (
          <button type="button" className="block pt-1 text-left text-[12.5px] font-bold text-brand underline"
            onClick={async () => {
              /* Signed on demand and short-lived. The lease is in a PRIVATE bucket now — see
                 the launch-audit note in ContractScreen — so there is no link to hand out. */
              const { data } = await supabase.storage.from("contract-attachments")
                .createSignedUrl(c.document_url, 300);
              if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
            }}>
            {W(lang, "Open the attached document", "Abrir el documento adjunto")}
          </button>
        )}
      </section>

      {/* ── SIGNATURES ───────────────────────────────────────────────────────────────────── */}
      <section className="card mt-3 space-y-1.5 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "Signatures", "Firmas")}
        </h2>
        {c.agent_signed_at && (
          <p className="flex items-start gap-2 text-[13px]">
            <span className="mt-0.5 text-brand"><IconCheck size={14} /></span>
            <span className="opacity-85">
              {stamp(`${c.agent_signed_name ?? ""}${c.agent_signed_title ? ` · ${c.agent_signed_title}` : ""}`,
                     c.agent_signed_at, L)}
            </span>
          </p>
        )}
        {c.tenant_signed_at ? (
          <p className="flex items-start gap-2 text-[13px]">
            <span className="mt-0.5 text-brand"><IconCheck size={14} /></span>
            <span className="opacity-85">
              {stamp(`${c.tenant_signed_name ?? ""}${c.tenant_signed_title ? ` · ${c.tenant_signed_title}` : ""}`,
                     c.tenant_signed_at, L)}
            </span>
          </p>
        ) : (
          <p className="text-[12.5px] opacity-55">
            {unsignedTenantStatus(c.status, lang)}
          </p>
        )}
        {c.snapshot_sha256 && (
          <p className="pt-1 text-[10.5px] leading-relaxed opacity-45">
            {W(lang, "Document fingerprint", "Huella del documento")}: {c.snapshot_sha256.slice(0, 32)}…
            <br />
            {W(lang,
              "Both of you hold the same copy. If a single character ever differed, this fingerprint would not match.",
              "Ambos tienen la misma copia. Si un solo carácter cambiara, esta huella no coincidiría.")}
          </p>
        )}
      </section>

      {/* ── THE SIGNED COPY ──────────────────────────────────────────────────────────────── */}
      {signed && (
        <section className="card mt-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
              {W(lang, "The signed copy", "La copia firmada")}
            </h2>
            <button type="button" className="text-[12px] font-bold text-brand underline"
              onClick={() => window.print()}>
              {W(lang, "Print / save", "Imprimir / guardar")}
            </button>
          </div>
          <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed opacity-90">
            {c.contract_snapshot}
          </pre>
        </section>
      )}

      {err && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}

      {/* ── ACCEPT ───────────────────────────────────────────────────────────────────────── */}
      {!signed && iAmTenant && (
        <section className="card mt-4 space-y-2 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "Accept and sign", "Aceptar y firmar")}
          </h2>
          <p className="text-[12px] leading-relaxed opacity-60">
            {c.deposit_required
              ? W(lang,
                  "Signing does not start the lease on its own. The deposit has to be in first — until then the contract sits waiting, and the dates are not yours yet.",
                  "Firmar no inicia el arriendo por sí solo. Primero debe entrar el depósito — hasta entonces el contrato queda en espera y las fechas aún no son suyas.")
              : W(lang,
                  "Typing your full name signs it. The signed copy is stamped with your name and the exact time, and cannot be changed by anyone afterwards.",
                  "Escribir su nombre completo lo firma. La copia queda sellada con su nombre y la hora exacta, y nadie puede cambiarla después.")}
          </p>
          <input className="input w-full" value={signName} onChange={e => setSignName(e.target.value)}
            placeholder={displayName ?? W(lang, "Your full name", "Su nombre completo")} />
          <button type="button" className="btn-primary w-full" disabled={busy || !(signName.trim() || displayName)}
            onClick={accept}>
            {busy ? "…" : W(lang, "Sign this agreement", "Firmar este contrato")}
          </button>
          <button type="button" className="btn-ghost w-full" disabled={busy} onClick={decline}>
            {W(lang, "No thanks — decline", "No, gracias — rechazar")}
          </button>
        </section>
      )}

      {/* ── THE DEPOSIT STEP — HONEST, NOT DECORATIVE ────────────────────────────────────
          UAT council, Lens 1: *"a payment succeeds but the counterparty gets no notification →
          P0 dead end"*, and its sibling — a screen that says "the lease starts when the deposit
          is in" while offering no way to put it in is the same dead end with better manners.
          Lens 6: copy must never claim a state the database can't prove.

          The money leg is not built (it moves live money, so it stops with Lee). So this says
          exactly that, in the same shape PlansScreen uses for its own unfinished Stripe leg:
          a real control, visibly not yet live, with the reason on it. A button that looked
          live and did nothing would be worse than no button at all. */}
      {c.status === "awaiting_first_payment" && c.terms_extra?.monthly_agreement && <section className="card space-y-3 p-4">
        <h2 className="font-black">{W(lang,'First month payment','Pago del primer mes')}</h2>
        <p className="text-sm">{W(lang,'The host must confirm the actual transfer and finish approving the request. Signing alone does not record payment.','El anfitrión debe confirmar la transferencia real y finalizar la aprobación. Firmar no registra un pago.')}</p>
        {iAmAgent && <>
          <Link className="block font-bold text-brand underline" to={`/rentals/r/${c.property_id}/contract?request=${c.booking_request_id}`}>{W(lang,'Review payment receipt','Revisar recepción del pago')}</Link>
          <button className="btn-primary w-full" disabled={busy} onClick={async()=>{setBusy(true);setErr(null);try{const {error}=await supabase.rpc('activate_monthly_rental_contract',{p_contract_id:c.id});if(error)throw error;setTick(t=>t+1);}catch(e:any){setErr(e.message);}finally{setBusy(false);}}}>{W(lang,'Activate with confirmed payment','Activar con pago confirmado')}</button>
        </>}
      </section>}
      {c.status === "awaiting_first_payment" && !c.terms_extra?.monthly_agreement && (
        <section className="card mt-4 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "The deposit", "El depósito")}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed">
            {W(lang,
              `${money(Number(c.deposit_amount))} — held for the whole term and released against the walkthrough photos you both agree.`,
              `${money(Number(c.deposit_amount))} — retenido durante todo el término y liberado con base en las fotos del acta que ambos acepten.`)}
          </p>
          <button type="button" disabled
            className="btn-primary mt-3 w-full cursor-not-allowed opacity-45">
            {W(lang, "Pay the deposit", "Pagar el depósito")}
          </button>
          <p className="mt-2 text-center text-[11.5px] leading-relaxed opacity-60">
            {W(lang,
              "Payments open shortly. Nothing has been charged, and this lease has not started — the dates are not committed to you yet.",
              "Los pagos se habilitan pronto. No se ha cobrado nada y este arriendo no ha empezado — las fechas aún no están comprometidas para usted.")}
          </p>
        </section>
      )}

      {/* ── WHAT HAPPENS NEXT ────────────────────────────────────────────────────────────── */}
      {(c.status === "awaiting_first_payment" || c.status === "active") && (
        <Link to={productHref("onerental", `/c/${c.id}/walkthrough`)}
          className="card ow-tap mt-3 flex items-center gap-3 p-4">
          <span className="text-brand"><IconCamera size={20} /></span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">
              {W(lang, "Photograph the property together", "Fotografíen el inmueble juntos")}
            </span>
            <span className="mt-0.5 block text-[12px] leading-relaxed opacity-60">
              {W(lang,
                `${c.inspection_days ?? 5} days from move-in to agree the photos, with ${c.response_days ?? 2} days to answer each one. Anything not in them cannot be taken out of the deposit later.`,
                `${c.inspection_days ?? 5} días desde la entrada para aceptar las fotos, con ${c.response_days ?? 2} días para responder cada una. Lo que no esté en ellas no se puede descontar del depósito después.`)}
            </span>
          </span>
        </Link>
      )}
      {userId && (userId === c.agent_id || userId === c.tenant_id) && <StayReviews key={userId + ':' + c.id} contractId={c.id} lang={lang} />}
    </div>
  );
}

function StatusBanner({ c, lang }: { c: any; lang: string }) {
  const map: Record<string, { en: string; es: string; tone: string }> = {
    draft:  { en: "Draft — not sent yet.", es: "Borrador — aún no enviado.", tone: "opacity-70" },
    sent:   { en: "Sent. Waiting for the tenant to sign.", es: "Enviado. Esperando la firma del arrendatario.", tone: "opacity-70" },
    /* The state that stops a manager blocking a calendar for money that never arrived. */
    awaiting_first_payment: {
      en: "Signed by both — but NOT active yet. The lease starts when the first payment is recorded.",
      es: "Firmado por ambos — pero AÚN NO activo. El arriendo empieza cuando se registre el primer pago.",
      tone: "text-amber-700 dark:text-amber-400",
    },
    active:   { en: "Active.", es: "Activo.", tone: "text-brand" },
    ended:    { en: "Ended.", es: "Terminado.", tone: "opacity-60" },
    declined: { en: "Declined.", es: "Rechazado.", tone: "opacity-60" },
    cancelled:{ en: "Cancelled.", es: "Cancelado.", tone: "opacity-60" },
    expired:  { en: "Expired.", es: "Vencido.", tone: "opacity-60" },
  };
  const m = map[c.status] ?? map.draft;
  return (
    <p className={`mt-3 text-[13px] font-bold ${m.tone}`}>{W(lang, m.en, m.es)}</p>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[13px] opacity-65">{l}</span>
      <span className="text-right text-[13.5px] font-bold">{v}</span>
    </div>
  );
}
