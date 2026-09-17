/**
 * HOW A LETTING IS SECURED — the rules in one place
 * ============================================================================================
 * Lee, 13 August 2026, after working through every option:
 *
 *   *"So that's your three options. You have one option for less than thirty days, two options
 *   after thirty days, move on."*
 *
 * ── THE THREE ────────────────────────────────────────────────────────────────────────────────
 * `authorization` — the guest's card is authorised and **the money never moves**. It does not go
 *     to the host, it does not go to OneHome, it does not leave the guest's bank. Their available
 *     balance drops and that is all. At the end it is either released, and the guest never sees a
 *     charge, or a claim is upheld from the photographs and only then is it captured.
 *
 *     This matters legally as well as commercially. Ley 820 de 2003 Art. 16 bans *constituting* a
 *     deposit — handing money over as security. In an authorisation nobody hands anything over,
 *     so there is nothing to return because nothing was taken. It is what hotels do.
 *
 * `deposit` — a real deposit, taken by the host, paid by the tenant, **never touched by
 *     OneHome**. Only offered on a stay of 30 days or more, and only after the host has
 *     acknowledged that the law does not permit it and the tenant may ask for it back.
 *
 *     Lee was precise about that wording: *"All you gotta do is just — they just have to
 *     acknowledge what it is. It's illegal. If they click the box and they still do it, that's up
 *     to them. I would take away 'I'm gonna do it anyway'."* So the copy below acknowledges, it
 *     does not confess. The same fact goes into the tenant's terms and conditions, rolled in with
 *     everything else the way Airbnb does it, rather than shouted at them separately.
 *
 * `insurance` — no deposit at all. A percentage of the rent is charged instead, and damage is
 *     paid out from the photographic record both sides accepted at move-in. Default 4.99%.
 *
 * ── WHY THE 30-DAY LINE ─────────────────────────────────────────────────────────────────────
 * Under 30 nights the law treats the stay as lodging, like a hotel — Decreto 2590 de 2009. At 30
 * days or more it is renting a home and Ley 820 applies, which is where the deposit prohibition
 * lives. Unknown or mixed listings are treated as long, because the safe default is the one that
 * cannot create a void clause.
 */

export const RESIDENTIAL_DAYS = 30;

/** The rate OneHome charges instead of a deposit. Lee, 13 Aug: *"let's make it a small
 *  percentage — four point nine nine percent of the rent amount."* Stored on the listing row as
 *  well, so a change here never rewrites what an existing host agreed to.
 *
 *  ⚠️ 15 Aug 2026 — THIS IS NO LONGER ITS OWN LITERAL. It now reads from `DAMAGE_COVER.ratePct`
 *  in cover.ts, where the rest of that product's terms live. Two constants for one charge is how
 *  a price ends up different on two screens, and this file and that one were already one edit
 *  away from disagreeing. Both names stay, because call sites use both. */
import { DAMAGE_COVER } from "./cover";
export const INSURANCE_RATE_PCT = DAMAGE_COVER.ratePct;
export const INSURANCE_RATE = INSURANCE_RATE_PCT / 100;

export type GuaranteeKind = "authorization" | "deposit" | "insurance";

/** What the listing says about how long people may stay. */
export type StayWindow = "short" | "long" | "both";

/**
 * Which options a host may choose from.
 *
 * A listing open to BOTH lengths gets all three, because it will host both kinds of stay and the
 * short-stay guest still needs the card hold. It is not a contradiction: the authorisation covers
 * the sub-30-day bookings and the deposit-or-insurance choice covers the long ones.
 */
export function optionsFor(window: StayWindow): GuaranteeKind[] {
  if (window === "short") return ["authorization"];
  if (window === "long") return ["deposit", "insurance"];
  return ["authorization", "deposit", "insurance"];
}

/** Does this choice, on this listing, require the host to acknowledge Ley 820 first? */
export const needsDepositAck = (kind: GuaranteeKind | null, window: StayWindow) =>
  kind === "deposit" && window !== "short";

/** What OneHome charges the tenant for the insurance option, per rental period. */
export const insuranceFee = (rent: number, ratePct = INSURANCE_RATE_PCT) =>
  Math.round(rent * (ratePct / 100) * 100) / 100;

/**
 * Is this specific booking short enough for a card authorisation?
 *
 * Measured from the BOOKING's dates, never from the listing's advertised window — a place
 * advertised nightly can still be let for six months, and it is the letting in front of us that
 * the statute looks at.
 */
export function bookingIsShort(startISO: string, endISO: string): boolean {
  const a = Date.parse(startISO), b = Date.parse(endISO);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false;
  return Math.round((b - a) / 86_400_000) < RESIDENTIAL_DAYS;
}

/* ── THE WORDS ─────────────────────────────────────────────────────────────────────────────────
   Kept here rather than in the screen so the listing form, the booking screen, the contract and
   the terms and conditions all say the same thing. Copy that drifts between two screens about
   money is how a promise gets made in one place and broken in another. */

type L = "en" | "es";
const P = (en: string, es: string) => ({ en, es });

export const GUARANTEE_COPY: Record<GuaranteeKind, {
  title: Record<L, string>; blurb: Record<L, string>; effect: Record<L, string>;
}> = {
  authorization: {
    title: P("Card hold", "Retención en la tarjeta"),
    blurb: P(
      "The guest's card is held for the amount. The money never leaves their account and you never receive it — it is simply frozen until checkout.",
      "Se retiene el monto en la tarjeta del huésped. El dinero nunca sale de su cuenta y usted nunca lo recibe: sólo queda congelado hasta la salida."),
    effect: P(
      "If something is damaged, you send us the move-in and move-out photos. If the claim holds, we move the money to you and release the rest.",
      "Si algo se daña, nos envía las fotos de entrada y de salida. Si el reclamo procede, le transferimos el dinero y liberamos el resto."),
  },
  deposit: {
    title: P("Take a deposit", "Cobrar un depósito"),
    blurb: P(
      "The tenant pays you a deposit directly. OneHome never holds it and never returns it — that is between you and the tenant.",
      "El arrendatario le paga a usted un depósito directamente. OneHome nunca lo retiene ni lo devuelve: eso es entre usted y el arrendatario."),
    effect: P(
      "Fewer people will book. Most tenants choose a listing without a deposit when one is available.",
      "Menos personas reservarán. La mayoría elige un anuncio sin depósito cuando existe la opción."),
  },
  insurance: {
    title: P("No deposit", "Sin depósito"),
    blurb: P(
      "The tenant pays no deposit. A small percentage of the rent covers damage instead.",
      "El arrendatario no paga depósito. En su lugar, un pequeño porcentaje del canon cubre los daños."),
    effect: P(
      "Claims are settled from the move-in and move-out photos you both accepted.",
      "Los reclamos se resuelven con las fotos de entrada y salida que ambos aceptaron."),
  },
};

/** The acknowledgement. Reproduced verbatim in the tenant's terms and conditions. */
export const DEPOSIT_ACK = P(
  "I acknowledge that Colombian law (Ley 820 de 2003, Article 16) does not permit a cash deposit or other security on a rental of 30 days or more, and that the tenant may request its return.",
  "Reconozco que la ley colombiana (Ley 820 de 2003, artículo 16) no permite exigir depósito en dinero ni otra caución en un arrendamiento de 30 días o más, y que el arrendatario puede solicitar su devolución.",
);
