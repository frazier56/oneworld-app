import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  MoneyInput,
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading,
  FormSection, Field, Row, Stepper, Toggle, StickyActions, SegTabs,
  GlassDate, GlassSelect, PlacesInput, fetchTrm, fmtCop, type Trm,
  RENTAL_HOST_FEE_RATE,
  RENTAL_GUEST_FEE_RATE,
} from "@oneworld/shell";

/**
 * PAYMENT SETUP — what the tenant will be charged, agreed before anybody is charged.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"we do need to have a portal in here where people can set up payments."*
 *
 * The order of the questions is taken from Zillow's rental-payments flow, which I read end to end
 * on 11 Aug: monthly rent → payment date → how long it runs → security deposit → prorated first
 * month → other move-in costs → who the tenant is → where the money lands.
 *
 * That order is the useful part. It goes from the number both sides already agreed, through the
 * numbers that surprise people, and only then asks for bank details — because a form that opens by
 * asking for your account number gets abandoned by people who would happily have finished it.
 *
 * ── WHAT THIS SCREEN DOES NOT DO ────────────────────────────────────────────────────────────
 * It does not move money. It writes a SCHEDULE — an agreement about what will be charged and when.
 * There is no "paid" anywhere in the table behind it, deliberately: the moment this becomes a
 * second record of what actually happened, it will disagree with the payment processor, and the
 * one that disagrees with the bank is the one that is wrong. Charging goes through the
 * money-authorisation audit before a line of it is written.
 *
 * ── THE DEPOSIT IS OFF BY DEFAULT, AND THAT IS A LEGAL POSITION ──────────────────────────────
 * Ley 820 de 2003 Art. 16 appears to prohibit cash security deposits on Colombian residential
 * leases — including collected through an intermediary or under another name — with offending
 * clauses void by operation of law. That is pending counsel (project plan 3.9), so this screen
 * does not make a deposit the default shape of a lease. It offers the two things Colombian
 * landlords actually use instead, a codeudor and a seguro de arrendamiento, and it says why.
 *
 * ── ONE RULE THE DATABASE ENFORCES AND THIS SCREEN ONLY REFLECTS ─────────────────────────────
 * Changing any number voids BOTH agreements. That is in the trigger, not here, because an
 * agreement is to a specific set of figures and a UI-side rule would be one fetch away from being
 * bypassed. This screen simply shows the consequence honestly before the agent edits.
 */
export default function PaymentSetup() {
  const { id: propertyId } = useParams<{ id: string }>();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const scheduleId = params.get("schedule");

  const [rent, setRent] = useState("");
  const [dueDay, setDueDay] = useState<number | null>(1);
  const [startsOn, setStartsOn] = useState("");
  const [term, setTerm] = useState<"fixed" | "monthly">("fixed");
  const [endsOn, setEndsOn] = useState("");
  const [proratedFirst, setProratedFirst] = useState("");
  const [backedBy, setBackedBy] = useState<"codeudor" | "rent_guarantee" | "deposit" | "none">("codeudor");
  const [deposit, setDeposit] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [otherMoveIn, setOtherMoveIn] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");

  const [trm, setTrm] = useState<Trm | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetchTrm().then(setTrm); }, []);

  /* The listing supplies the defaults. An agent who has already typed the rent once should not
     type it again, and a schedule whose rent silently differs from the listing is the first thing
     a tenant will notice. */
  const property = useAsync(async () => {
    const { data } = await supabase.from("rental_properties")
      .select("id, title, price, currency, agent_id, available_from")
      .eq("id", propertyId!).maybeSingle<any>();
    return data ?? null;
  }, [propertyId], !!propertyId);

  useEffect(() => {
    if (!property) return;
    setRent(prev => prev || String(property.price ?? ""));
    setStartsOn(prev => prev || property.available_from || "");
  }, [property]);

  /* An existing schedule being edited or reviewed. */
  const existing = useAsync(async () => {
    if (!scheduleId) return null;
    const { data } = await supabase.from("rent_payment_schedules")
      .select("*").eq("id", scheduleId).maybeSingle<any>();
    return data ?? null;
  }, [scheduleId], !!scheduleId);

  useEffect(() => {
    if (!existing) return;
    setRent(String(existing.rent_amount ?? ""));
    setDueDay(existing.due_day ?? 1);
    setStartsOn(existing.starts_on ?? "");
    setTerm(existing.ends_on ? "fixed" : "monthly");
    setEndsOn(existing.ends_on ?? "");
    setProratedFirst(existing.prorated_first != null ? String(existing.prorated_first) : "");
    setBackedBy(existing.backed_by ?? "codeudor");
    setDeposit(existing.security_deposit != null ? String(existing.security_deposit) : "");
    setDepositNote(existing.deposit_note ?? "");
    setOtherMoveIn(existing.other_move_in != null ? String(existing.other_move_in) : "");
    setOtherNote(existing.other_move_in_note ?? "");
    setTenantName(existing.tenant_name ?? "");
    setTenantEmail(existing.tenant_email ?? "");
  }, [existing]);

  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const rentNum = Number(rent) || 0;
  const dueToday = useMemo(() => (
    (Number(proratedFirst) || 0) +
    (backedBy === "deposit" ? Number(deposit) || 0 : 0) +
    (Number(otherMoveIn) || 0)
  ), [proratedFirst, deposit, otherMoveIn, backedBy]);

  const usd = (v: number) => new Intl.NumberFormat("en-US",
    { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

  const blocking =
    rentNum <= 0 ? W(lang, "Add the monthly rent", "Agregue el canon mensual")
    : !startsOn ? W(lang, "Set the start date", "Defina la fecha de inicio")
    : term === "fixed" && !endsOn ? W(lang, "Set the end date, or switch to month-to-month",
                                            "Defina la fecha final, o cambie a mes a mes")
    : !tenantEmail.trim() ? W(lang, "Add the tenant's email", "Agregue el correo del arrendatario")
    : null;

  async function save(send: boolean) {
    if (!userId || !propertyId) return;
    setBusy(true); setErr(null);
    const row = {
      property_id: propertyId, agent_id: userId,
      tenant_name: tenantName.trim() || null,
      tenant_email: tenantEmail.trim().toLowerCase() || null,
      rent_amount: rentNum, currency: "USD", due_day: dueDay ?? 1,
      starts_on: startsOn, ends_on: term === "fixed" ? (endsOn || null) : null,
      prorated_first: n(proratedFirst),
      /* Only written when the lease is actually backed by one. Storing a deposit figure on a lease
         backed by a codeudor would leave a number nobody agreed to sitting in the record. */
      security_deposit: backedBy === "deposit" ? n(deposit) : null,
      deposit_note: backedBy === "deposit" ? (depositNote.trim() || null) : null,
      other_move_in: n(otherMoveIn), other_move_in_note: otherNote.trim() || null,
      backed_by: backedBy,
      status: send ? "sent" : "draft",
      updated_at: new Date().toISOString(),
    };
    const q = scheduleId
      ? supabase.from("rent_payment_schedules").update(row).eq("id", scheduleId).select("id").single<any>()
      : supabase.from("rent_payment_schedules").insert(row).select("id").single<any>();
    const { error } = await q;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    nav(productHref("onerental", `/r/${propertyId}`));
  }

  return (
    <div className="space-y-1 pb-28">
      <ScreenHeading>{W(lang, "Set up rent payments", "Configurar el pago del arriendo")}</ScreenHeading>
      {property && (
        <p className="text-[12.5px] opacity-60">{property.title}</p>
      )}
      <p className="mt-1 text-[12.5px] leading-relaxed opacity-60">
        {W(lang,
          "Nothing is charged here. You're writing down what will be charged and when, so the tenant agrees to it before any money moves.",
          "Aquí no se cobra nada. Está dejando por escrito qué se cobrará y cuándo, para que el arrendatario lo acepte antes de que se mueva dinero.")}
      </p>

      {/* ── 1 · THE RENT ─────────────────────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "The rent", "El canon")} required
        icon="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3">
        <Field label={W(lang, "Monthly rent (USD)", "Canon mensual (USD)")}
          hint={trm && rentNum > 0
            ? W(lang, `≈ ${fmtCop(rentNum, trm.rate)} at today's official rate`,
                      `≈ ${fmtCop(rentNum, trm.rate)} a la tasa oficial de hoy`)
            : undefined}>
          <MoneyInput value={rent} onChange={setRent} placeholder="1900" />
        </Field>
        <Field label={W(lang, "Due each month on the", "Se paga cada mes el día")}
          hint={W(lang,
            "Capped at the 28th so the date exists in every month — a rent due on the 30th silently skips February.",
            "Máximo el 28 para que la fecha exista todos los meses — un canon con vencimiento el 30 se salta febrero.")}>
          <Stepper value={dueDay} onChange={setDueDay} min={1} max={28} />
        </Field>
      </FormSection>

      {/* ── 2 · HOW LONG ─────────────────────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "How long it runs", "Duración")} required
        icon="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z">
        <SegTabs<"fixed" | "monthly">
          value={term} onChange={setTerm}
          options={[
            { value: "fixed",   label: W(lang, "Fixed term", "Plazo fijo") },
            { value: "monthly", label: W(lang, "Month to month", "Mes a mes") },
          ]} />
        <Field label={W(lang, "First payment covers from", "El primer pago cubre desde")}>
          <GlassDate value={startsOn} onChange={setStartsOn} min="" />
        </Field>
        {term === "fixed" && (
          <Field label={W(lang, "Last payment covers until", "El último pago cubre hasta")}>
            <GlassDate value={endsOn} onChange={setEndsOn} min={startsOn || ""} />
          </Field>
        )}
      </FormSection>

      {/* ── 3 · HOW THE LEASE IS BACKED ──────────────────────────────────────────────────────
          This section exists instead of a deposit box, and the copy explains why in the tenant's
          language rather than citing a statute at them. */}
      <FormSection title={W(lang, "How the lease is backed", "Cómo se respalda el contrato")}
        icon="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z M9.5 12l1.8 1.8L15 10">
        <Field label={W(lang, "What secures it", "Qué lo asegura")}>
          <GlassSelect<"codeudor" | "rent_guarantee" | "deposit" | "none">
            value={backedBy} ariaLabel={W(lang, "What secures the lease", "Qué asegura el contrato")}
            onChange={setBackedBy}
            options={[
              { value: "codeudor",       label: W(lang, "A co-signer (codeudor)", "Un codeudor") },
              { value: "rent_guarantee", label: W(lang, "A rent guarantee policy", "Póliza de arrendamiento") },
              { value: "deposit",        label: W(lang, "A cash security deposit", "Depósito en efectivo") },
              { value: "none",           label: W(lang, "Nothing — trust only", "Nada — solo confianza") },
            ]} />
        </Field>

        {backedBy === "deposit" ? (
          <>
            {/* Said plainly, once, at the moment it is relevant. Not a blocker — an agent may have
                advice we do not — but they should not choose it without knowing. */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3">
              <p className="text-[12.5px] font-bold text-amber-700 dark:text-amber-400">
                {W(lang, "Check this one with your lawyer", "Consulte esto con su abogado")}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-75">
                {W(lang,
                  "Colombian law (Ley 820 de 2003, art. 16) restricts cash security deposits on residential leases, including when they are collected through an intermediary or called something else. A codeudor or a rent guarantee policy is what is normally used instead.",
                  "La ley colombiana (Ley 820 de 2003, art. 16) restringe los depósitos en efectivo en arriendo de vivienda, incluso cuando se cobran a través de un intermediario o se les da otro nombre. Normalmente se usa un codeudor o una póliza de arrendamiento.")}
              </p>
            </div>
            <Field label={W(lang, "Deposit amount (USD)", "Monto del depósito (USD)")}>
              <MoneyInput value={deposit} onChange={setDeposit} placeholder="1900" />
            </Field>
            <Field label={W(lang, "A note about it", "Una nota al respecto")} optional
              hint={W(lang, "What it covers and when it comes back. The tenant sees this.",
                            "Qué cubre y cuándo se devuelve. El arrendatario ve esto.")}>
              <input className="input w-full" maxLength={500} value={depositNote}
                onChange={e => setDepositNote(e.target.value)} />
            </Field>
          </>
        ) : (
          <p className="text-[11.5px] leading-relaxed opacity-60">
            {backedBy === "none"
              ? W(lang, "Nothing secures this lease beyond the agreement itself. That is allowed, and it is worth being deliberate about.",
                        "Nada respalda este contrato más allá del acuerdo mismo. Es válido, y vale la pena hacerlo a conciencia.")
              : W(lang, "No cash changes hands to secure the lease — which is the arrangement Colombian residential law is built around.",
                        "No se entrega dinero en efectivo para asegurar el contrato — que es el esquema sobre el que está construida la ley de arrendamiento de vivienda en Colombia.")}
          </p>
        )}
      </FormSection>

      {/* ── 4 · WHAT IS DUE AT MOVE-IN ───────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "Due at move-in", "Al momento de la entrega")}
        icon="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 8l2-4h12l2 4M12 12v4M10 14h4"
        hint={W(lang,
          "The one-off costs. Every one of these is what makes somebody feel ambushed on the day, so they are stated up front.",
          "Los costos únicos. Cada uno de estos es lo que hace que alguien se sienta emboscado el día de la entrega, así que se dicen desde el principio.")}>
        <Field label={W(lang, "Prorated first month (USD)", "Primer mes prorrateado (USD)")} optional
          hint={W(lang, "If they move in mid-month, the part-month at the start.",
                        "Si se mudan a mitad de mes, la fracción del primer mes.")}>
          <MoneyInput value={proratedFirst} onChange={setProratedFirst} />
        </Field>
        <Field label={W(lang, "Other move-in costs (USD)", "Otros costos de entrada (USD)")} optional>
          <MoneyInput value={otherMoveIn} onChange={setOtherMoveIn} />
        </Field>
        {Number(otherMoveIn) > 0 && (
          <Field label={W(lang, "What that covers", "Qué cubre")}>
            <input className="input w-full" maxLength={300} value={otherNote}
              onChange={e => setOtherNote(e.target.value)}
              placeholder={W(lang, "e.g. cleaning, key deposit, admin for the first month",
                                   "Ej.: aseo, llaves, administración del primer mes")} />
          </Field>
        )}

        {/* THE TOTAL. The number the tenant is actually deciding about, computed rather than
            typed, so it cannot disagree with the parts above it. */}
        {dueToday > 0 && (
          <div className="mt-2 rounded-2xl border border-brand/25 bg-brand/[0.06] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-bold">
                {W(lang, "Total due before they get the keys", "Total a pagar antes de recibir las llaves")}
              </span>
              <span className="text-[19px] font-black tracking-tight">{usd(dueToday)}</span>
            </div>
            {trm && (
              <p className="mt-0.5 text-right text-[11.5px] opacity-60">≈ {fmtCop(dueToday, trm.rate)}</p>
            )}
            <p className="mt-1.5 text-[11.5px] leading-relaxed opacity-65">
              {W(lang, "Then ", "Luego ")}<b>{usd(rentNum)}</b>
              {W(lang, ` on the ${dueDay ?? 1} of each month.`, ` el día ${dueDay ?? 1} de cada mes.`)}
            </p>
          </div>
        )}
      </FormSection>

      {/* ── 5 · WHO IS PAYING ────────────────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "The tenant", "El arrendatario")} required
        icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8">
        <Row>
          <Field label={W(lang, "Their name", "Su nombre")} optional>
            <input className="input w-full" maxLength={120} value={tenantName}
              onChange={e => setTenantName(e.target.value)} />
          </Field>
          <Field label={W(lang, "Their email", "Su correo")}>
            <input className="input w-full" type="email" inputMode="email" value={tenantEmail}
              onChange={e => setTenantEmail(e.target.value)} placeholder="nombre@correo.com" />
          </Field>
        </Row>
        <p className="text-[11.5px] leading-relaxed opacity-60">
          {W(lang,
            "They get this to review and accept. Nothing is charged until they have.",
            "Ellos lo reciben para revisarlo y aceptarlo. No se cobra nada hasta que lo hagan.")}
        </p>
      </FormSection>

      {/* Both sides of the fee are stated on the same screen. New quotes use the current shell
          rates; a created contract freezes both rates on its own database row. */}
      {rentNum > 0 && (
        <div className="mt-3 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-[11px] font-black uppercase tracking-wide opacity-55">
            {W(lang, "What reaches you", "Lo que le llega")}
          </p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-[13px] opacity-70">
              {W(lang, "Host fee", "Comisión del anfitrión")}
            </span>
            <span className="text-[13px] font-bold opacity-70">
              − {usd(Math.round(rentNum * RENTAL_HOST_FEE_RATE * 100) / 100)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-ink/10 pt-1.5 dark:border-white/10">
            <span className="text-[13.5px] font-bold">{W(lang, "You receive / month", "Usted recibe / mes")}</span>
            <span className="text-[18px] font-black tracking-tight text-brand">
              {usd(Math.round(rentNum * (1 - RENTAL_HOST_FEE_RATE) * 100) / 100)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-ink/10 pt-1.5 dark:border-white/10">
            <span className="text-[13px] opacity-70">
              {W(lang, "Guest fee", "Comisión del huésped")}
            </span>
            <span className="text-[13px] font-bold opacity-70">
              + {usd(Math.round(rentNum * RENTAL_GUEST_FEE_RATE * 100) / 100)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[13.5px] font-bold">{W(lang, "Tenant pays / month", "El arrendatario paga / mes")}</span>
            <span className="text-[16px] font-black tracking-tight text-brand">
              {usd(Math.round(rentNum * (1 + RENTAL_GUEST_FEE_RATE) * 100) / 100)}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed opacity-50">
            {W(lang,
              "The fee amounts above are shown before this payment schedule is sent. A host may choose to absorb the guest fee. The rent itself goes directly from tenant to landlord; OneHome collects only its own fees.",
              "Los montos de las comisiones aparecen arriba antes de enviar este plan de pagos. El anfitrión puede asumir la comisión del huésped. El canon va directamente del arrendatario al arrendador; OneHome solo cobra sus propias comisiones.")}
          </p>
        </div>
      )}

      {err && <p className="mt-3 text-center text-[12.5px] font-semibold text-red-500">{err}</p>}

      <StickyActions
        hint={blocking}
        secondary={{ label: W(lang, "Save draft", "Guardar borrador"), onClick: () => save(false) }}
        primary={{
          label: W(lang, "Send to tenant", "Enviar al arrendatario"),
          onClick: () => save(true), disabled: !!blocking, busy,
        }} />
    </div>
  );
}
