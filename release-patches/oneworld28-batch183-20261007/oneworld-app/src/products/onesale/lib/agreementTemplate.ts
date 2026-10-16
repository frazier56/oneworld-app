/**
 * The sale agreement — a PROMESA DE COMPRAVENTA — as plain text, in Spanish or English.
 * ============================================================================================
 * Lee, 29 Sep 2026: *"the buyer and seller can sign an agreement for a house for sale and the
 * agent can sign as well."* In Colombia the private agreement that precedes the deed is the
 * promesa de compraventa; the notary then executes the escritura pública. So this is that
 * document, and it says in terms that the notary still does the transfer.
 *
 * ── WHAT THE LAW REQUIRES OF IT (art. 89, Ley 153 de 1887) ───────────────────────────────
 * In writing; a fixed date or condition for signing the deed; and the contract so determined that
 * only the deed and its formalities remain. So the form REQUIRES the closing date and the notary.
 * Electronic signature is valid under Ley 527 de 1999.
 *
 * ⚠️ DRAFT TEXT — COUNSEL REVIEW PENDING. Sent to Cuesta Lawyers (Bogotá) for review, 30 Sep 2026.
 * `AGREEMENT_DRAFT_NOTE` prints on the document until that review is done. Removing it is a
 * one-line change and should only happen with the firm's written sign-off.
 */

export const AGREEMENT_DRAFT_NOTE = {
  es: "Plantilla en revisión legal. Revise el texto con su abogado antes de firmar.",
  en: "Template under legal review. Check the text with your lawyer before signing.",
};

export type AgreementValues = {
  lang: "es" | "en";
  sellerName: string; sellerEmail?: string | null;
  buyerName: string; buyerEmail: string;
  agentName?: string | null; agentEmail?: string | null;
  propertyTitle: string;
  address: string;
  city: string;
  matricula?: string | null;
  price: number;
  currency: string;
  downPayment?: number | null;
  downPaymentDue?: string | null;
  arrasKind: "confirmatorias" | "retracto";
  closingDate: string;
  notary: string;
  commissionPct?: number | null;
  commissionPaidBy?: "seller" | "buyer" | "split" | null;
  penaltyPct: number;
  extraTerms?: string | null;
};

const money = (n: number, ccy: string, lang: "es" | "en") => {
  try {
    return new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", {
      style: "currency", currency: ccy, currencyDisplay: "code", maximumFractionDigits: 0,
    }).format(n).replace(/ /g, " ");
  } catch { return `${ccy} ${Math.round(n).toLocaleString("en-US")}`; }
};
const day = (iso: string, lang: "es" | "en") =>
  new Date(iso + "T12:00:00Z").toLocaleDateString(lang === "es" ? "es-CO" : "en-US",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function renderPromesa(v: AgreementValues): string {
  const es = v.lang === "es";
  const L = (a: string, b: string) => (es ? a : b);
  const hasAgent = !!(v.agentName && v.agentName.trim());
  const dp = v.downPayment && v.downPayment > 0 ? v.downPayment : 0;
  const balance = v.price - dp;
  const commission = v.commissionPct != null && v.commissionPct > 0
    ? Math.round(v.price * v.commissionPct) / 100 : null;
  const paidBy = {
    seller: L("el PROMITENTE VENDEDOR", "the SELLER"),
    buyer: L("el PROMITENTE COMPRADOR", "the BUYER"),
    split: L("ambas partes por partes iguales", "both parties in equal shares"),
  }[v.commissionPaidBy ?? "seller"];

  const clauses: string[] = [];
  const n = (t: string, b: string) => clauses.push(`${L("CLÁUSULA", "CLAUSE")} ${clauses.length + 1}. ${t}\n${b}`);

  n(L("OBJETO.", "PURPOSE."),
    L(`El PROMITENTE VENDEDOR promete vender y el PROMITENTE COMPRADOR promete comprar el inmueble "${v.propertyTitle}", ubicado en ${v.address}, ${v.city}${v.matricula ? `, identificado con folio de matrícula inmobiliaria ${v.matricula}` : ""}, con todas sus mejoras, anexidades y dependencias.`,
      `The SELLER promises to sell and the BUYER promises to buy the property "${v.propertyTitle}", located at ${v.address}, ${v.city}${v.matricula ? `, registered under property record (matrícula inmobiliaria) ${v.matricula}` : ""}, with all its improvements and fixtures.`));

  n(L("PRECIO.", "PRICE."),
    L(`El precio total es ${money(v.price, v.currency, "es")}.`,
      `The total price is ${money(v.price, v.currency, "en")}.`));

  n(L("FORMA DE PAGO.", "PAYMENT."),
    dp > 0
      ? L(`a) ${money(dp, v.currency, "es")} a título de arras ${v.arrasKind === "retracto" ? "de retracto" : "confirmatorias"}${v.downPaymentDue ? `, a más tardar el ${day(v.downPaymentDue, "es")}` : ""}. b) El saldo de ${money(balance, v.currency, "es")} en la fecha de otorgamiento de la escritura pública.`,
          `a) ${money(dp, v.currency, "en")} as ${v.arrasKind === "retracto" ? "withdrawal deposit (arras de retracto)" : "confirmatory deposit (arras confirmatorias)"}${v.downPaymentDue ? `, no later than ${day(v.downPaymentDue, "en")}` : ""}. b) The balance of ${money(balance, v.currency, "en")} on the date the public deed is signed.`)
      : L(`La totalidad del precio se pagará en la fecha de otorgamiento de la escritura pública.`,
          `The full price will be paid on the date the public deed is signed.`));

  if (dp > 0) {
    n(L("ARRAS.", "DEPOSIT."),
      v.arrasKind === "retracto"
        ? L("Las arras son de retracto (art. 1859 del Código Civil). Si el PROMITENTE COMPRADOR se retracta, las pierde; si se retracta el PROMITENTE VENDEDOR, las devolverá dobladas.",
            "The deposit is a withdrawal deposit (Civil Code art. 1859). If the BUYER withdraws, the BUYER loses it; if the SELLER withdraws, the SELLER returns it doubled.")
        : L("Las arras son confirmatorias: se imputan al precio y confirman el negocio. No dan derecho a retractarse.",
            "The deposit is confirmatory: it counts toward the price and confirms the deal. It gives no right to withdraw."));
  }

  n(L("ESCRITURA PÚBLICA.", "PUBLIC DEED."),
    L(`La escritura pública de compraventa se otorgará el ${day(v.closingDate, "es")} en la ${v.notary}. Esta promesa no transfiere la propiedad: la transferencia ocurre con la escritura y su registro.`,
      `The public deed of sale will be signed on ${day(v.closingDate, "en")} at ${v.notary}. This agreement does not transfer ownership: ownership passes with the deed and its registration.`));

  n(L("ENTREGA.", "HANDOVER."),
    L("El inmueble se entregará el día de otorgamiento de la escritura, en el estado en que se encuentra, a paz y salvo por servicios públicos, administración e impuesto predial.",
      "The property will be handed over on the day the deed is signed, in its current condition, with utilities, building administration fees and property tax paid up to date."));

  n(L("LIBERTAD Y SANEAMIENTO.", "CLEAR TITLE."),
    L("El PROMITENTE VENDEDOR declara que el inmueble es de su propiedad, que no lo ha prometido en venta a otra persona y que está libre de embargos, hipotecas, demandas y limitaciones al dominio, y saldrá al saneamiento conforme a la ley.",
      "The SELLER states that the property is theirs, has not been promised to anyone else, and is free of liens, mortgages, lawsuits and restrictions on title, and will answer for title defects as the law requires."));

  n(L("GASTOS.", "COSTS."),
    L("Los gastos notariales se pagarán por partes iguales. La retención en la fuente corre por cuenta del PROMITENTE VENDEDOR. Los impuestos de beneficencia y los derechos de registro corren por cuenta del PROMITENTE COMPRADOR.",
      "Notary fees are split equally. The withholding tax (retención en la fuente) is paid by the SELLER. Registration tax (beneficencia) and registry fees are paid by the BUYER."));

  if (hasAgent && commission != null) {
    n(L("COMISIÓN.", "COMMISSION."),
      L(`${v.agentName} intervino como agente inmobiliario. Su comisión es el ${v.commissionPct}% del precio (${money(commission, v.currency, "es")}), a cargo de ${paidBy}, pagadera en la fecha de la escritura.`,
        `${v.agentName} acted as the real-estate agent. The commission is ${v.commissionPct}% of the price (${money(commission, v.currency, "en")}), paid by ${paidBy}, due on the deed date.`));
  }

  n(L("CLÁUSULA PENAL.", "PENALTY."),
    L(`La parte que incumpla pagará a la cumplida el ${v.penaltyPct}% del precio a título de pena, sin perjuicio de exigir el cumplimiento.`,
      `A party in breach will pay the other ${v.penaltyPct}% of the price as a penalty, without prejudice to demanding performance.`));

  if (v.extraTerms && v.extraTerms.trim()) {
    n(L("ACUERDOS ADICIONALES.", "ADDITIONAL TERMS."), v.extraTerms.trim());
  }

  n(L("FIRMA ELECTRÓNICA.", "ELECTRONIC SIGNATURE."),
    L("Las partes aceptan firmar este documento electrónicamente en OneHome, con la misma validez que una firma manuscrita (Ley 527 de 1999). OneHome no es parte de este contrato.",
      "The parties agree to sign this document electronically on OneHome, with the same validity as a handwritten signature (Law 527 of 1999). OneHome is not a party to this agreement."));

  const parties = [
    L(`PROMITENTE VENDEDOR: ${v.sellerName}${v.sellerEmail ? ` (${v.sellerEmail})` : ""}.`,
      `SELLER: ${v.sellerName}${v.sellerEmail ? ` (${v.sellerEmail})` : ""}.`),
    L(`PROMITENTE COMPRADOR: ${v.buyerName} (${v.buyerEmail}).`,
      `BUYER: ${v.buyerName} (${v.buyerEmail}).`),
    ...(hasAgent ? [L(`AGENTE INMOBILIARIO: ${v.agentName}${v.agentEmail ? ` (${v.agentEmail})` : ""}.`,
                      `REAL-ESTATE AGENT: ${v.agentName}${v.agentEmail ? ` (${v.agentEmail})` : ""}.`)] : []),
  ];

  return [
    L("PROMESA DE COMPRAVENTA DE INMUEBLE", "PROMISE TO BUY AND SELL REAL PROPERTY"),
    "",
    ...parties,
    "",
    ...clauses.flatMap(c => [c, ""]),
  ].join("\n").trim();
}
