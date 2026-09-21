/**
 * REQUEST TO BOOK, AND WHAT HAPPENS IF SOMEBODY CANCELS — tasks 5 and 7
 * ============================================================================================
 * Lee, 13 August 2026:
 *
 *   *"Request to book, host accepts — yes, all this stuff is in place, so there should be a
 *   standard rental agreement already in place. During the listing they can read and confirm with
 *   a check mark that they agree to the rental agreement, they can click on the link… just like
 *   Airbnb has a standard rental agreement. That way when they book something they don't have to
 *   do anything, they just put the place out there for rent and see who accepts it."*
 *
 * ── WHY THE AGREEMENT IS ACCEPTED AT LISTING TIME, NOT AT BOOKING TIME ──────────────────────
 * A host who must sign something per booking will decline bookings at three in the morning by not
 * being awake. Accepting once, at listing, is what makes instant booking possible at all — and it
 * is exactly how Airbnb works. The acceptance is stamped with the version of the agreement that
 * was current, because "they agreed to the terms" is worthless if nobody can say which terms.
 *
 * ── THE CANCELLATION POLICY IS AN OBJECT, NOT A PARAGRAPH ───────────────────────────────────
 * Today it is a sentence inside a contract clause and nothing acts on it. A policy nothing acts
 * on is a policy nobody can rely on: the guest reads a promise the software cannot keep, and the
 * argument that follows is settled by whoever is more stubborn. Here it is three numbers, and the
 * refund is computed rather than negotiated.
 */

export type BookingState =
  | "requested"    // the guest asked
  | "accepted"     // the host said yes — this becomes the rental agreement
  | "declined"
  | "expired"      // the host never answered
  | "cancelled_by_guest"
  | "cancelled_by_host";

/** Lee: the host puts the place up and sees who accepts. Instant means no waiting on a human. */
export type BookingMode = "instant" | "request";

/** How long a host has to answer before the request lapses and the dates come back. */
export const REQUEST_WINDOW_HOURS = 24;

export const isLive = (s: BookingState) => s === "requested" || s === "accepted";
export const holdsDates = (s: BookingState) => isLive(s);

/** Where a request goes when the host answers, or when nobody does. */
export function afterHostDecision(accepted: boolean | null): BookingState {
  if (accepted === null) return "expired";
  return accepted ? "accepted" : "declined";
}

/* ── THE STANDARD AGREEMENT ───────────────────────────────────────────────────────────────────
   Bumped whenever the wording changes. An acceptance records the version it was given, so a host
   who accepted v1 has not silently accepted v2. */
export const AGREEMENT_VERSION = 1;

export type AgreementAcceptance = {
  version: number;
  accepted_at: string;
  accepted_by: string;
};

/** A listing may only take bookings if its host accepted the CURRENT agreement. */
export const agreementIsCurrent = (a?: AgreementAcceptance | null) =>
  !!a && a.version === AGREEMENT_VERSION;

/* ── CANCELLATION ─────────────────────────────────────────────────────────────────────────────
   Three named policies, the shapes the market already uses, so a guest recognises what they are
   agreeing to instead of reading a bespoke paragraph on every listing. */
export type CancelPolicy = "flexible" | "moderate" | "strict";

type PolicyRule = {
  /** full refund if cancelled at least this many days before arrival */
  fullDays: number;
  /** partial refund inside that, down to `partialDays` before arrival */
  partialDays: number;
  partialPct: number;
};

export const POLICIES: Record<CancelPolicy, PolicyRule> = {
  flexible: { fullDays: 1,  partialDays: 0,  partialPct: 0 },
  moderate: { fullDays: 5,  partialDays: 1,  partialPct: 50 },
  strict:   { fullDays: 14, partialDays: 7,  partialPct: 50 },
};

export type Refund = {
  pct: number;
  amount: number;
  /** which rule decided it, so the screen can say why rather than just show a number */
  band: "full" | "partial" | "none";
  daysBefore: number;
};

/**
 * What comes back if the guest cancels now.
 *
 * `nights already taken are never refunded` is deliberately NOT modelled here — this is the
 * before-arrival case, which is the only one a policy can settle arithmetically. A guest who
 * leaves early is a conversation, and pretending otherwise would put a wrong number on a screen.
 */
export function refundFor(
  policy: CancelPolicy, total: number, arrivalISO: string, nowISO: string,
): Refund {
  const day = 86_400_000;
  const days = Math.floor((Date.parse(arrivalISO + "T00:00:00Z") - Date.parse(nowISO)) / day);
  const r = POLICIES[policy];
  const pct = days >= r.fullDays ? 100
            : days >= r.partialDays ? r.partialPct
            : 0;
  return {
    pct,
    amount: Math.round(total * (pct / 100) * 100) / 100,
    band: pct === 100 ? "full" : pct > 0 ? "partial" : "none",
    daysBefore: days,
  };
}

/** A host cancelling is not the guest's fault, so it is always everything back. */
export const hostCancelRefund = (total: number): Refund =>
  ({ pct: 100, amount: total, band: "full", daysBefore: 0 });

type L = "en" | "es";
const P = (en: string, es: string) => ({ en, es });

export const POLICY_COPY: Record<CancelPolicy, { title: Record<L, string>; line: Record<L, string> }> = {
  flexible: { title: P("Flexible", "Flexible"),
    line: P("Everything back up to a day before arrival.", "Todo de vuelta hasta un día antes de la llegada.") },
  moderate: { title: P("Moderate", "Moderada"),
    line: P("Everything back up to five days before. Half back up to the day before.",
            "Todo de vuelta hasta cinco días antes. La mitad hasta el día anterior.") },
  strict:   { title: P("Strict", "Estricta"),
    line: P("Everything back up to two weeks before. Half back up to a week before.",
            "Todo de vuelta hasta dos semanas antes. La mitad hasta una semana antes.") },
};
