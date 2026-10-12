/**
 * THE COLOMBIAN RESIDENTIAL LEASE — structure, not a copy.
 * ============================================================================================
 * Built 10 Aug 2026 from a real signed lease Lee sent: a furnished apartment in Medellín,
 * `Contrato Arriendo CONTREE 1003`, 19 Dec 2025 → 18 Jan 2026.
 *
 * ⚠️ WHY THIS IS WRITTEN FRESH AND NOT LIFTED ────────────────────────────────────────────────
 * That document carries an explicit notice: its content, design and layout are the intellectual
 * property of DAVID HERNÁNDEZ & ASOCIADOS, and reproduction without written permission is
 * threatened with legal action. So it is used here as a MODEL OF WHAT A COLOMBIAN LEASE MUST
 * COVER — which is Ley 820 de 2003 and ordinary local practice, and nobody owns that — and every
 * sentence below is our own. Nothing is copied.
 *
 * ⚠️ NOT COUNSEL-REVIEWED YET. This is the structure and the plain-language wording; a Colombian
 * attorney reads it before it is offered as "the Colombian agreement". Until then it is offered
 * as a STARTING POINT the manager edits, alongside the upload-your-own path — which is exactly
 * how a template should be introduced anyway.
 *
 * ── WHAT THE REAL DOCUMENT TAUGHT US, beyond the clauses ────────────────────────────────────
 *   · PASSPORT, NOT CÉDULA. Lee signed as `PASAPORTE 649537448`. This product is aimed at
 *     expatriates and tourists; a form with only a cédula field is broken for its own audience.
 *   · THE ACTA DE ENTREGA IS ALREADY EXPECTED. The lease says the tenant receives the property
 *     *"conforme al acta de entrega que se firma el día ____"* — and in the signed copy that
 *     blank was never filled. The walkthrough is not a new idea imposed on Colombian practice;
 *     it is the piece Colombian practice already assumes and almost nobody produces.
 *   · THE PAYMENT WINDOW IS BUSINESS DAYS. His said the first five business days of the month.
 *     A recurring engine that bills "the same calendar day" is billing the wrong day.
 *   · RENT CHANGES AT RENEWAL. His stepped from $9,300,000 to $8,600,000 COP on a five-month
 *     renewal. One fixed number for the whole relationship is the wrong model.
 *   · REAJUSTE ANUAL BY IPC. After twelve months rent rises by the previous calendar year's
 *     consumer price index. Automatic, no notice needed — standard, and legally framed.
 */

import { COVER_CLAUSES } from "@oneworld/shell";

export type CoSection = {
  key: string;
  heading: { en: string; es: string };
  /** ONE OR TWO SENTENCES. What the picker and the reader see first — Lee's whole point:
   *  *"they don't wanna read eighteen pages, but they know that's the actual agreement."* */
  summary: { en: string; es: string };
  body: { en: string; es: string };
  /** Required sections are always in. Optional ones are the addendums. */
  optional?: boolean;
  /**
   * ⚠️ LEY 820 GATE — offered ONLY on a stay of fewer than 30 days.
   *
   * A cash deposit, or any other caución real, may not be required on an urban housing lease
   * (Ley 820 de 2003, Art. 16), and a clause that breaches it is ineficaz de pleno derecho —
   * void without a judge, money returnable on demand. Decreto 2590 de 2009 Art. 2 takes habitual
   * sub-30-day tourist accommodation out of the residential regime entirely, which is why hotels
   * in Colombia take incidental deposits lawfully.
   *
   * 30 days or more is treated as residential. The boundary above 30 days is genuinely contested
   * and the cost of being wrong runs one direction only.
   */
  shortStayOnly?: boolean;
};

/**
 * The line itself, in one place, so no screen invents its own.
 * Anything at or over this many days is residential and therefore deposit-prohibited.
 */
export const CO_RESIDENTIAL_DAYS = 30;

const P = (es: string, en: string) => ({ es, en });

/* ── THE BODY OF A COLOMBIAN RESIDENTIAL LEASE ────────────────────────────────────────────── */
export const CO_LEASE_SECTIONS: CoSection[] = [
  {
    key: "partes",
    heading: P("Identificación de las partes", "The parties"),
    summary: P(
      "Quién arrienda y quién ocupa, con su documento de identidad. Los extranjeros se identifican con pasaporte.",
      "Who is letting and who is occupying, with an identity document. Foreigners identify with a passport."),
    body: P(
      "ARRENDADOR: {{arrendador_nombre}}, identificado con {{arrendador_doc_tipo}} No. {{arrendador_doc}}, con dirección de notificación en {{arrendador_direccion}}, quien entrega el inmueble y otorga su uso.\nARRENDATARIO: {{arrendatario_nombre}}, identificado con {{arrendatario_doc_tipo}} No. {{arrendatario_doc}}, quien ocupa el inmueble y paga por su uso.",
      "LANDLORD: {{arrendador_nombre}}, holding {{arrendador_doc_tipo}} No. {{arrendador_doc}}, with a notice address at {{arrendador_direccion}}, who hands over the property and grants its use.\nTENANT: {{arrendatario_nombre}}, holding {{arrendatario_doc_tipo}} No. {{arrendatario_doc}}, who occupies the property and pays for its use."),
  },
  {
    key: "objeto",
    heading: P("Objeto del contrato", "The property"),
    summary: P(
      "Cuál es el inmueble: dirección, ciudad, área y si se entrega amoblado.",
      "Which property this is: address, city, area, and whether it comes furnished."),
    body: P(
      "El ARRENDADOR entrega en arrendamiento el inmueble ubicado en {{direccion}}, {{ciudad}}, con un área aproximada de {{area}} m², {{amoblado}}.",
      "The LANDLORD lets the property at {{direccion}}, {{ciudad}}, of approximately {{area}} m², {{amoblado}}."),
  },
  {
    key: "destinacion",
    heading: P("Destinación", "Permitted use"),
    summary: P(
      "El inmueble es para vivienda, no para negocios ni para nada ilegal. Darle otro uso termina el contrato.",
      "The property is a home, not a business, and not for anything illegal. Any other use ends the agreement."),
    body: P(
      "El inmueble se destina exclusivamente a vivienda habitual y permanente. Queda prohibido destinarlo a fines ilícitos de cualquier naturaleza. El incumplimiento de esta cláusula da lugar a la terminación inmediata del contrato.",
      "The property is for habitual residential use only. Any unlawful use is prohibited. Breach of this clause ends the agreement immediately."),
  },
  {
    key: "vigencia",
    heading: P("Vigencia", "Term"),
    summary: P(
      "Cuándo empieza y cuándo termina el contrato, y por cuánto tiempo es.",
      "When the agreement starts, when it ends, and how long it runs."),
    body: P(
      "El presente contrato tiene una duración de {{duracion}}, contados desde el {{fecha_inicio}} hasta el {{fecha_fin}}.",
      "This agreement runs for {{duracion}}, from {{fecha_inicio}} to {{fecha_fin}}."),
  },
  {
    key: "renovacion",
    heading: P("Renovación", "Renewal"),
    summary: P(
      "Cómo se renueva o se termina: hay que avisar con anticipación, y el canon de la renovación puede ser distinto.",
      "How it renews or ends: notice is required, and the rent on renewal can be different."),
    body: P(
      "Cualquiera de las partes que desee terminar el contrato o prorrogarlo deberá notificarlo por escrito con no menos de {{dias_aviso}} días de anticipación al vencimiento. De no mediar aviso, el contrato se entenderá prorrogado por un término igual al inicial. El canon aplicable durante la prórroga será de {{canon_renovacion}}.",
      "Either party wishing to end or extend the agreement must give written notice at least {{dias_aviso}} days before expiry. Absent notice, it renews for a period equal to the original. The rent during the renewal shall be {{canon_renovacion}}."),
  },
  {
    key: "canon",
    heading: P("Canon de arrendamiento", "Rent"),
    summary: P(
      "Cuánto se paga, cada cuánto, y hasta qué día del mes sin quedar en mora.",
      "How much is paid, how often, and the last day of the month before it counts as late."),
    body: P(
      "EL ARRENDATARIO pagará al ARRENDADOR la suma de {{canon}} por cada período de arrendamiento. El pago se realizará dentro de los primeros {{dias_habiles_pago}} días hábiles de cada período, a través de la plataforma OneRental.",
      "The TENANT shall pay the LANDLORD {{canon}} for each rental period, within the first {{dias_habiles_pago}} business days of the period, through the OneRental platform."),
  },
  {
    key: "reajuste",
    heading: P("Reajuste anual", "Annual increase"),
    summary: P(
      "Cada doce meses el arriendo sube según la inflación del año anterior (IPC). Es automático y no requiere aviso.",
      "Every twelve months the rent rises with last year's inflation (Colombia's CPI). Automatic, no notice needed."),
    body: P(
      "Cumplidos doce (12) meses de vigencia, y cada doce (12) meses en adelante, el canon se incrementará automáticamente y sin necesidad de requerimiento, en el mismo porcentaje en que haya variado el Índice de Precios al Consumidor certificado por el DANE para el año calendario inmediatamente anterior.",
      "After twelve (12) months, and every twelve (12) months thereafter, the rent increases automatically and without demand, by the same percentage as the Consumer Price Index certified by DANE for the preceding calendar year."),
  },
  {
    key: "servicios",
    heading: P("Servicios públicos y administración", "Utilities and building fees"),
    summary: P(
      "Qué está incluido en el arriendo — agua, luz, gas, internet, administración — y qué se paga aparte.",
      "What the rent covers — water, power, gas, internet, building fees — and what is paid separately."),
    body: P(
      "{{servicios_incluidos}} se encuentran incluidos en el canon. Cualquier servicio adicional contratado por EL ARRENDATARIO será asumido por éste.",
      "{{servicios_incluidos}} are included in the rent. Any additional service contracted by the TENANT is at the TENANT's cost."),
  },
  {
    /* THE POINT OF THE GATE. Removing the deposit from a long lease without offering the
       replacement just leaves the landlord feeling unprotected and the agent typing a deposit
       into a free-text field. A Colombian landlord does not feel unprotected without a deposit —
       they ask for one of these three, and the market has worked this way for decades. The
       seguro is the modern one and the one to lean on: an insurer supervised by the
       Superintendencia Financiera indemnifies unpaid rent and often utilities and damage, the
       tenant is credit-studied, and it costs a single-digit percentage of the monthly rent.

       It is also the better marketing line. "No deposit required — your lease is backed by a
       guarantee policy" beats "we hold your deposit safely", wins against Airbnb (no deposit
       either way) AND against a traditional Colombian agency (no codeudor), and is the compliant
       option rather than the compromise. */
    key: "garantia",
    optional: true,
    heading: P("Garantía del contrato", "How the lease is guaranteed"),
    summary: P(
      "En Colombia un arriendo de vivienda no lleva depósito. Se garantiza con codeudor, póliza de arrendamiento o fianza.",
      "A Colombian housing lease carries no deposit. It is guaranteed by a co-signer, a rent-guarantee policy, or a surety."),
    body: P(
      "Conforme al artículo 16 de la Ley 820 de 2003, no se exige depósito en dinero ni caución real alguna. El cumplimiento de las obligaciones de EL ARRENDATARIO se garantiza mediante {{garantia_tipo}} a favor del ARRENDADOR: {{garantia_detalle}}. La contratación y vigencia de dicha garantía es requisito para la entrega del inmueble.",
      "In accordance with Article 16 of Ley 820 de 2003, no cash deposit or real guarantee is required. The TENANT's obligations are secured by {{garantia_tipo}} in favour of the LANDLORD: {{garantia_detalle}}. Putting that guarantee in place, and keeping it in force, is a condition of handover."),
  },
  {
    key: "deposito",
    shortStayOnly: true,
    heading: P("Depósito (solo estadías cortas)", "Deposit (short stays only)"),
    summary: P(
      "Cuánto es el depósito, cómo se retiene y cuándo se devuelve después de entregar el inmueble.",
      "How much the deposit is, how it is held, and when it comes back after handover."),
    body: P(
      "EL ARRENDATARIO entregará la suma de {{deposito}} como depósito de la estadía. Este valor se recibe únicamente en tránsito y se devuelve dentro de los {{dias_devolucion}} días hábiles siguientes a la entrega física del inmueble, previa verificación del acta de entrega y del acta de restitución. Esta cláusula aplica exclusivamente a estadías inferiores a treinta (30) días, conforme al Decreto 2590 de 2009; no se aplica a contratos de arrendamiento de vivienda urbana.",
      "The TENANT shall pay {{deposito}} as a stay deposit. It is received in transit only and returned within {{dias_devolucion}} business days of physical handover, after checking the move-in and move-out records. This clause applies solely to stays of fewer than thirty (30) days under Decreto 2590 de 2009; it does not apply to an urban housing lease."),
  },
  /* ── THE TWO COVERS (15 Aug 2026) ────────────────────────────────────────────────────────
     Lee: *"I thought she was putting placeholders, like, basically gonna code everything as if
     it's already done."* So these are real clauses in the real contract, merged with real
     numbers — the numbers are just the placeholder ones, and every one of them lives in
     shell/lib/cover.ts. The clause TEXT lives there too, beside the rates it quotes, so a clause
     and its number can never drift apart. This file imports them rather than restating them.

     `{{cobertura_estado}}` is the honesty valve: while no carrier is placed it merges to a
     sentence saying so and saying no claim can be brought. When a carrier signs it merges to
     nothing and the clause reads as an ordinary insurance clause. Nobody has to remember to
     delete anything. */
  {
    key: "cobertura_danos",
    optional: true,
    heading: COVER_CLAUSES.damage.heading,
    summary: P(
      "En lugar de depósito, una cobertura de daños que se resuelve con las fotos de entrada y salida.",
      "Instead of a deposit, damage cover settled from the move-in and move-out photos."),
    body: COVER_CLAUSES.damage.body,
  },
  {
    key: "cobertura_rc",
    optional: true,
    heading: COVER_CLAUSES.liability.heading,
    summary: P(
      "El arrendador mantiene cobertura por lesiones dentro del inmueble y daños a terceros.",
      "The landlord carries cover for injury inside the property and damage to third parties."),
    body: COVER_CLAUSES.liability.body,
  },
  {
    key: "reparaciones",
    heading: P("Reparaciones", "Repairs"),
    summary: P(
      "El arrendador arregla lo estructural (humedades, techo). El arrendatario arregla lo que dañe con el uso (vidrios, paredes).",
      "The landlord fixes the building (damp, roof). The tenant fixes what they break (glass, walls)."),
    body: P(
      "REPARACIONES NECESARIAS: aquellas indispensables para mantener el inmueble en condiciones de uso, y sin las cuales podría deteriorarse gravemente — a cargo del ARRENDADOR.\nREPARACIONES LOCATIVAS: aquellas derivadas de deterioros producidos por culpa del ARRENDATARIO o de sus dependientes — a cargo del ARRENDATARIO.\nEL ARRENDATARIO deberá informar por escrito al ARRENDADOR cualquier daño que corresponda a éste, indicando su naturaleza y gravedad.",
      "NECESSARY REPAIRS: those indispensable to keep the property usable, without which it would seriously deteriorate — the LANDLORD's responsibility.\nTENANT REPAIRS: those arising from damage caused by the TENANT or their guests — the TENANT's responsibility.\nThe TENANT must notify the LANDLORD in writing of any damage falling to the LANDLORD, stating its nature and severity."),
  },
  {
    key: "entrega",
    heading: P("Entrega y restitución — acta de entrega", "Handover and return — the condition record"),
    summary: P(
      "El estado del inmueble se documenta con fotos que ambos aceptan al entrar y al salir. Lo que no esté en las fotos no se puede cobrar del depósito.",
      "The condition is documented with photos both sides accept at move-in and move-out. Anything not in the photos cannot be charged against the deposit."),
    body: P(
      "EL ARRENDATARIO declara recibir el inmueble en estado de servir, conforme al ACTA DE ENTREGA levantada en la plataforma OneRental, integrada por fotografías fechadas que ambas partes aceptaron expresamente.\nTerminado el contrato, EL ARRENDATARIO restituirá el inmueble en el mismo estado, salvo el deterioro natural derivado del uso normal, conforme al ACTA DE RESTITUCIÓN levantada del mismo modo.\nNINGÚN DESCUENTO DEL DEPÓSITO PODRÁ FUNDARSE EN UN DAÑO QUE NO CONSTE EN DICHAS ACTAS.",
      "The TENANT acknowledges receiving the property in serviceable condition, per the MOVE-IN RECORD created in OneRental: dated photographs both parties expressly accepted.\nOn termination the TENANT returns the property in the same condition, allowing for ordinary wear, per the MOVE-OUT RECORD made the same way.\nNO DEPOSIT DEDUCTION MAY BE BASED ON DAMAGE THAT DOES NOT APPEAR IN THOSE RECORDS."),
  },
  {
    key: "mejoras",
    heading: P("Mejoras y reformas", "Alterations"),
    summary: P(
      "No se pueden hacer cambios al inmueble sin permiso escrito del arrendador.",
      "No changes to the property without the landlord's written permission."),
    body: P(
      "EL ARRENDATARIO no podrá realizar mejoras, reformas ni modificaciones en el inmueble sin autorización previa y escrita del ARRENDADOR.",
      "The TENANT may not make improvements, alterations or modifications without the LANDLORD's prior written authorisation."),
  },
  {
    key: "incumplimiento",
    heading: P("Incumplimiento", "Default"),
    summary: P(
      "Si no se paga a tiempo se causan intereses de mora, y el contrato puede terminarse con una sanción.",
      "Late payment accrues default interest, and the agreement can be ended with a penalty."),
    body: P(
      "El retardo en el pago del canon causará intereses moratorios a la tasa máxima legal certificada por la Superintendencia Financiera de Colombia. El incumplimiento de cualquiera de las obligaciones aquí pactadas o de las señaladas en la ley dará lugar a la terminación del contrato y al pago de una sanción equivalente a {{sancion}}, sin perjuicio de los perjuicios que se causen. El presente contrato presta mérito ejecutivo.",
      "Late payment accrues default interest at the maximum legal rate certified by Colombia's financial superintendency. Breach of any obligation here or in law ends the agreement and triggers a penalty of {{sancion}}, without prejudice to damages. This agreement is directly enforceable."),
  },
  {
    key: "cesion",
    heading: P("Cesión y subarriendo", "Assignment and subletting"),
    summary: P(
      "El arrendatario no puede pasarle el contrato a otra persona ni subarrendar sin permiso escrito.",
      "The tenant cannot hand the agreement to somebody else or sublet without written permission."),
    body: P(
      "EL ARRENDATARIO no podrá ceder el contrato ni subarrendar total o parcialmente el inmueble sin autorización previa y escrita del ARRENDADOR.",
      "The TENANT may not assign this agreement or sublet the property, in whole or in part, without the LANDLORD's prior written authorisation."),
  },
  {
    key: "abandono",
    heading: P("Abandono del inmueble", "Abandonment"),
    summary: P(
      "Si el inmueble queda desocupado 30 días, el arrendador puede entrar con un testigo. Viajar no cuenta como abandono si el arriendo está al día.",
      "If the property sits empty for 30 days the landlord may enter with a witness. Travelling is not abandonment while the rent is paid."),
    body: P(
      "Si el inmueble permaneciere abandonado o desocupado por treinta (30) días continuos, EL ARRENDADOR queda facultado para ingresar y recuperar su tenencia con la sola presencia de un testigo, a fin de evitar su deterioro. No se considerarán abandono las ausencias temporales por viaje, razones médicas o personales, siempre que el canon se encuentre al día y permanezcan pertenencias del ARRENDATARIO en el inmueble.",
      "If the property is left empty for thirty (30) continuous days, the LANDLORD may enter and recover possession in the presence of a witness, to prevent deterioration. Temporary absences for travel, medical or personal reasons are not abandonment, provided the rent is current and the TENANT's belongings remain."),
  },
];

/* ── OPTIONAL ADDENDUMS — the "cláusulas adicionales" of a real Colombian lease ─────────────
   Every one of these is drawn from something that genuinely appears in Colombian furnished
   rentals, including three that appear in the very document Lee sent: an appliance the landlord
   agrees to install and part-charge, a nominated bank account for the deposit return, and a pet
   living in the property. */
export const CO_ADDENDUMS: CoSection[] = [
  {
    key: "mascota", optional: true,
    heading: P("Mascota en el inmueble", "A pet in the property"),
    summary: P(
      "Se permite una mascota, y quien la trae responde por los daños que cause.",
      "One pet is allowed, and whoever brings it answers for any damage it causes."),
    body: P(
      "Se autoriza la permanencia de una mascota doméstica en el inmueble. La parte que la aloja responderá por los daños o inconvenientes que ésta ocasione, los cuales podrán descontarse del depósito conforme a las actas fotográficas.",
      "One domestic pet may live in the property. The party keeping it is liable for any damage or nuisance it causes, deductible from the deposit in line with the photographic records."),
  },
  {
    key: "electrodomestico", optional: true,
    heading: P("Electrodoméstico a instalar", "An appliance to be installed"),
    summary: P(
      "El arrendador instala un equipo (por ejemplo aire acondicionado) y se acuerda quién paga qué y qué pasa si el contrato no se extiende.",
      "The landlord installs equipment (an air conditioner, say) and the parties agree who pays what, and what happens if the lease is not extended."),
    body: P(
      "EL ARRENDADOR instalará {{electrodomestico}} en el inmueble a más tardar el {{fecha_instalacion}}. EL ARRENDATARIO aportará {{aporte_arrendatario}} de su valor. Si el contrato no se prorroga, dicho aporte quedará en favor del ARRENDADOR; si se prorroga, se reembolsará {{reembolso}} dentro del primer día hábil siguiente a la confirmación de la prórroga.",
      "The LANDLORD will install {{electrodomestico}} by {{fecha_instalacion}}. The TENANT contributes {{aporte_arrendatario}} of its cost. If the lease is not extended that contribution stays with the LANDLORD; if it is extended, {{reembolso}} is refunded on the first business day after the extension is confirmed."),
  },
  {
    key: "cuenta_devolucion", optional: true,
    shortStayOnly: true,
    heading: P("Cuenta para la devolución del depósito", "Account for the deposit return"),
    summary: P(
      "A qué cuenta se devuelve el depósito, si es distinta a la de quien paga.",
      "Which account the deposit is returned to, if it is not the one that paid."),
    body: P(
      "La devolución del depósito se realizará a la cuenta {{cuenta_devolucion}} a nombre de {{titular_cuenta}}. Cuando el pago se haya realizado a través de la plataforma OneRental, la devolución se efectuará por el mismo medio, salvo acuerdo expreso en contrario.",
      "The deposit will be returned to account {{cuenta_devolucion}} in the name of {{titular_cuenta}}. Where payment was made through OneRental, the return is made by the same route unless expressly agreed otherwise."),
  },
  {
    key: "limpieza", optional: true,
    heading: P("Limpieza incluida", "Cleaning included"),
    summary: P(
      "El canon incluye un servicio de limpieza, con su valor y su frecuencia.",
      "The rent includes a cleaning service, with its value and how often it comes."),
    body: P(
      "El canon incluye servicio de limpieza por valor de {{valor_limpieza}}, con una frecuencia de {{frecuencia_limpieza}}.",
      "The rent includes a cleaning service worth {{valor_limpieza}}, provided {{frecuencia_limpieza}}."),
  },
  {
    key: "inventario", optional: true,
    heading: P("Inventario de muebles", "Furniture inventory"),
    summary: P(
      "Lista de los muebles y electrodomésticos entregados, que se verifica en el acta de entrega.",
      "A list of the furniture and appliances handed over, checked against the move-in record."),
    body: P(
      "Se adjunta inventario de muebles, enseres y electrodomésticos entregados con el inmueble. El inventario se verifica contra el acta de entrega fotográfica y es la referencia para cualquier descuento al momento de la restitución.",
      "An inventory of the furniture, fittings and appliances handed over is attached. It is checked against the photographic move-in record and is the reference for any deduction at handover."),
  },
  {
    key: "estadia_corta", optional: true,
    heading: P("Estadía corta / turística", "Short or tourist stay"),
    summary: P(
      "Para estadías por noches: hora de entrada y de salida, y qué pasa si se cancela.",
      "For stays by the night: check-in and check-out times, and what happens on cancellation."),
    body: P(
      "La entrada se realizará a partir de las {{check_in}} y la salida a más tardar a las {{check_out}}. Las cancelaciones se regirán por la política {{politica_cancelacion}} publicada en el anuncio al momento de la reserva.",
      "Check-in is from {{check_in}} and check-out is by {{check_out}}. Cancellations follow the {{politica_cancelacion}} policy published on the listing at the time of booking."),
  },
];

/** Every clause the drafter may turn on or off. Some legally significant optional clauses live
 * beside the baseline sections because that is where they read naturally; the rest are ordinary
 * addendums. The editor must treat both groups the same or it will render tokens nobody can fill. */
export const CO_OPTIONAL_SECTIONS: CoSection[] = [
  ...CO_LEASE_SECTIONS.filter(section => section.optional),
  ...CO_ADDENDUMS,
];

/** The exact sections that may be previewed and signed for the current choices. A short-stay
 * deposit clause is tied to the listing's existing deposit rule; it is never silently introduced
 * for a residential lease. */
export function selectedCoLeaseSections(
  addendumKeys: string[],
  includeShortStayDeposit = true,
): CoSection[] {
  const chosen = new Set(addendumKeys);
  const baseline = CO_LEASE_SECTIONS.filter(section =>
    (!section.shortStayOnly || includeShortStayDeposit)
    && (!section.optional || chosen.has(section.key)));
  return [...baseline, ...CO_ADDENDUMS.filter(section => chosen.has(section.key))];
}

/** Fill the placeholders. Anything left unfilled stays visible as `____` rather than vanishing —
 *  a blank a human can see is a blank a human fills in, and Lee's own lease shows what happens
 *  when a blank quietly survives into a signed document. */
export function fillTemplate(text: string, values: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => {
    const v = values[k];
    return v === undefined || v === null || v === "" ? "____" : String(v);
  });
}

/** Render the whole lease, required sections plus whichever addendums were chosen. */
export function renderCoLease(opts: {
  lang: "en" | "es";
  values: Record<string, string | number | null | undefined>;
  addendumKeys: string[];
  includeShortStayDeposit?: boolean;
}): string {
  const L = opts.lang;
  const out: string[] = [];
  const chosen = new Set(opts.addendumKeys);
  const baseline = CO_LEASE_SECTIONS.filter(section =>
    (!section.shortStayOnly || opts.includeShortStayDeposit !== false)
    && (!section.optional || chosen.has(section.key)));
  baseline.forEach((s, i) => {
    out.push(`${i + 1}. ${s.heading[L].toUpperCase()}`);
    out.push(fillTemplate(s.body[L], opts.values));
    out.push("");
  });
  const extra = CO_ADDENDUMS.filter(a => opts.addendumKeys.includes(a.key));
  if (extra.length) {
    out.push(L === "es" ? "CLÁUSULAS ADICIONALES" : "ADDITIONAL CLAUSES");
    out.push("");
    extra.forEach((a, i) => {
      out.push(`${i + 1}. ${a.heading[L]}`);
      out.push(fillTemplate(a.body[L], opts.values));
      out.push("");
    });
  }
  return out.join("\n").trim();
}

/** Filled optional clauses for the upload-your-own path. The uploaded document remains the base;
 * only clauses explicitly selected in OneHome are appended, once, with no raw tokens. */
export function renderCoSelectedClauses(opts: {
  lang: "en" | "es";
  values: Record<string, string | number | null | undefined>;
  addendumKeys: string[];
}): string {
  const chosen = new Set(opts.addendumKeys);
  const sections = CO_OPTIONAL_SECTIONS.filter(section => chosen.has(section.key));
  if (!sections.length) return "";
  const heading = opts.lang === "es" ? "CLÁUSULAS ADICIONALES" : "ADDITIONAL CLAUSES";
  return [heading, ...sections.flatMap((section, index) => [
    "",
    `${index + 1}. ${section.heading[opts.lang]}`,
    fillTemplate(section.body[opts.lang], opts.values),
  ])].join("\n").trim();
}

/* ── FILL-IN-THE-BLANKS RENDERING ──────────────────────────────────────────────────────────
   Lee, 10 Aug 2026: *"if they wanna just use the same form and basically say fill in the
   blanks, we could just give them a form that's gonna auto-populate the blanks. And then when
   they see the form, they'll see everything populated in, like, blue text, so they can review
   everything and then send it."*

   So the contract is not a wall of text with values buried in it — it is the SAME document with
   every value the manager typed rendered in the product's own blue. Two things fall out of that
   and both matter:

     · What is still BLANK is equally visible, as `____` in the same blue. Lee's own signed lease
       has an unfilled blank in it — *"conforme al acta de entrega que se firma el día ____"* —
       and nobody noticed because it looked like the rest of the page. Here it cannot hide.
     · Nothing is rendered as HTML. Segments are returned as data and React renders them, so a
       manager who types `<script>` into a field types a string, not a script. */

export type Segment = { kind: "text" | "filled" | "blank"; value: string; key?: string };

export function fillSegments(
  text: string,
  values: Record<string, string | number | null | undefined>,
): Segment[] {
  const out: Segment[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    const v = values[m[1]];
    const empty = v === undefined || v === null || String(v).trim() === "";
    out.push({ kind: empty ? "blank" : "filled", value: empty ? "____" : String(v), key: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

/** Unique missing inputs, in document order. Counting occurrences made one missing value look
 * like several separate jobs and still gave the user no route to the field that fixes it. */
export function missingTemplateKeys(
  sections: CoSection[],
  lang: "en" | "es",
  values: Record<string, string | number | null | undefined>,
): string[] {
  const seen = new Set<string>();
  for (const section of sections) {
    for (const segment of fillSegments(section.body[lang], values)) {
      if (segment.kind === "blank" && segment.key) seen.add(segment.key);
    }
  }
  return [...seen];
}

/** Which placeholders a given set of sections actually asks for — drives the form's fields. */
export function placeholdersIn(sections: CoSection[], lang: "en" | "es"): string[] {
  const keys = new Set<string>();
  for (const s of sections) {
    for (const m of s.body[lang].matchAll(/\{\{(\w+)\}\}/g)) keys.add(m[1]);
  }
  return [...keys];
}

/**
 * WHO IS SIGNING, AND IN WHAT CAPACITY.
 *
 * Lee: *"they list your title — property owner, property manager, property agent, whatever.
 * Whoever's signing that deal, you put your title, your name, timestamp."*
 *
 * This is not decoration. In a dispute the question is never "did somebody sign" — it is
 * "was that person entitled to let this property". A stamp that says only a name cannot answer
 * it; one that says "Property manager" can.
 */
export const SIGNER_TITLES = [
  { key: "owner",    en: "Property owner",     es: "Propietario" },
  { key: "manager",  en: "Property manager",   es: "Administrador del inmueble" },
  { key: "agent",    en: "Property agent",     es: "Agente inmobiliario" },
  { key: "attorney", en: "Legal representative", es: "Representante legal" },
  { key: "tenant",   en: "Tenant",             es: "Arrendatario" },
] as const;
