/**
 * COVER — the two insurance products, coded as if they were already bought
 * ============================================================================================
 * Lee, 15 August 2026:
 *
 *   *"I thought she was putting placeholders, like, basically gonna code everything as if it's
 *   already done. We just don't know who the companies are gonna be… we could just make up a
 *   price and everything… it's just placeholders for now. So that's what we should be doing."*
 *
 * So this is not a stub and not a feature flag. Every screen, every price line, every contract
 * clause and every stored column behaves exactly as it will on the day a real carrier signs.
 * The ONLY things that are invented are the numbers and the carrier's name, and they are all in
 * this one file, each marked `PLACEHOLDER`. Swapping in a real policy is editing this file and
 * nothing else.
 *
 * ── WHY THIS SHAPE, AND NOT A FLAG ───────────────────────────────────────────────────────────
 * A flag means the flow is never exercised: nobody sees the price line, nobody reads the clause,
 * nobody discovers that the total does not add up until the week a carrier is signed and the
 * whole thing has to be built under a deadline. Placeholder numbers running through the real
 * plumbing means the only work left on that day is arithmetic.
 *
 * ── ⚠️ THE WORD PROBLEM, AND IT IS THE WHOLE RISK ────────────────────────────────────────────
 * `one-world-counsel`, and the July 26 finding that generated it: never ship a word carrying
 * legal meaning we have not earned. **"Insured" implies a carrier is on risk.** Until a carrier
 * signs, no carrier is on risk, so the member-facing word here is **cover**, never "insurance",
 * never "insured", never "policy", never "guaranteed". `COVER_LIVE` below is `false`, and while
 * it is false every screen must show the pending line from `PENDING_NOTE`. Turning it `true` is
 * a decision a signed carrier makes, not a decision a developer makes.
 *
 * That is also why nothing here says a claim WILL be paid. It says what the cover is FOR and
 * what the limit is. A promise to pay is the one sentence that turns a marketing page into a
 * regulated insurance offer.
 */

type L = "en" | "es";
/* ⚠️ ENGLISH FIRST. `coTemplate.ts` in the app defines its own `P` as `(es, en)` — the opposite
   order — and imports the clauses below. Getting this backwards ships a contract whose Spanish
   clause is in English to a Spanish-speaking tenant, which is the one file where that is not a
   cosmetic bug. Matches shell/lib/guarantee.ts, which is the file this one sits beside. */
const P = (en: string, es: string) => ({ en, es });

/* ── THE SWITCH ──────────────────────────────────────────────────────────────────────────────
   FALSE until a carrier signs. While false, the flows work end to end, the money is computed
   and shown, and every surface carries the pending line. Nothing is hidden — a host choosing
   cover today is choosing a product that is described honestly as not yet placed. */
export const COVER_LIVE = false;

/** PLACEHOLDER. The carrier line every surface prints while `COVER_LIVE` is false. */
export const COVER_CARRIER = "pending";

export const PENDING_NOTE = P(
  "Cover is not yet placed with an insurer. Nothing is charged for it and no claim can be made until it is — you will be told before that changes.",
  "La cobertura aún no está colocada con una aseguradora. No se cobra nada por ella ni se puede reclamar hasta que lo esté — se le avisará antes de que eso cambie.",
);

/* Only ONE cover is ours to sell. Liability is the host's own — see below. */
export type CoverKind = "damage";

/** Who the charge lands on. This is not cosmetic: it decides which side's total moves. */
export type CoverPayer = "guest" | "host";

export type CoverSpec = {
  kind: CoverKind;
  payer: CoverPayer;
  /** PLACEHOLDER rate, percent of the rent for the period being charged. */
  ratePct: number;
  /** PLACEHOLDER cover limit per stay, in US dollars — the number the screens print. */
  limitUsd: number;
  /** PLACEHOLDER excess the claiming side carries, in US dollars. */
  excessUsd: number;
  /** Is this cover offered on stays under 30 nights, 30+, or both? See guarantee.ts. */
  stays: "short" | "long" | "both";
  title: Record<L, string>;
  /** One line: what it is for. Never what it promises to pay. */
  blurb: Record<L, string>;
  /** What it does NOT do — printed at the same size as the blurb, never in a footnote. */
  excludes: Record<L, string>;
};

/**
 * DAMAGE COVER — paid by the guest, replaces the deposit.
 *
 * 4.99% is Lee's own number from 13 August (*"let's make it a small percentage — four point nine
 * nine percent of the rent amount"*) and it is deliberately the same literal as
 * `guarantee.INSURANCE_RATE_PCT`, which this now supersedes as the place it is defined. Keeping
 * two rate constants for one charge is how a price ends up different on two screens.
 */
export const DAMAGE_COVER: CoverSpec = {
  kind: "damage",
  payer: "guest",
  ratePct: 4.99,          // PLACEHOLDER
  limitUsd: 25_000,       // PLACEHOLDER
  excessUsd: 250,         // PLACEHOLDER
  stays: "both",
  title: P("Damage cover", "Cobertura de daños"),
  blurb: P(
    "Covers damage to the home during the stay, instead of a deposit. Settled from the move-in and move-out photos you both accepted.",
    "Cubre daños a la vivienda durante la estadía, en lugar de un depósito. Se resuelve con las fotos de entrada y salida que ambos aceptaron."),
  excludes: P(
    "It does not cover unpaid rent, normal wear, or anything not in the move-in photos.",
    "No cubre cánones impagos, desgaste normal, ni nada que no aparezca en las fotos de entrada."),
};

/* ── LIABILITY IS NOT OURS TO SELL, AND THIS IS WHY ───────────────────────────────────────────
   Lee, 15 August 2026, working it out unprompted:

     *"I think what it is is that the homeowner who's posting their property must have liability
     coverage for their house. So if someone gets hurt while they're renting the host's house,
     then the homeowner has liability coverage… So then the question is, why do I, as owner of
     OneHome, need liability insurance? We just need to make sure that homeowner has checked the
     box."*

   He is right, and the earlier build here was wrong. It charged the host 1.49 percent for a
   liability product OneHome would supposedly carry. That is not a thing a marketplace can buy:
   the risk lives in a building we do not own, have never inspected and cannot control, and no
   carrier prices that sensibly across every home that lists.

   The confirmation is Airbnb's own history. They shipped nothing for three years, then a
   self-funded promise in 2011 after the EJ ransacking, and did not place a real liability policy
   with a carrier until January 2015 — SIX YEARS IN. And even that policy sits SECOND: if the host
   has their own homeowner or renter cover, theirs pays first and Airbnb's applies only after.
   The biggest platform in the category, with a real carrier, still treats liability as the
   property owner's responsibility. So do we.

   ── SO THE PRODUCT IS TWO THINGS, NEITHER OF WHICH IS INSURANCE WE SELL ─────────────────────
   1. AN ATTESTATION. The host states they carry it, names the carrier and the amount. Shown to
      the tenant as SELF-REPORTED, never "verified" — we did not check it, and `one-world-counsel`
      is explicit that "verified" claims a check we did not perform.
   2. A REFERRAL. A host without cover is sent to a carrier, and we take a referral commission.
      Revenue with no risk on our balance sheet, and it makes the listing better.

   Damage cover above stays ours, because that risk IS per-booking and we are the only party who
   sees every booking. The two genuinely work in opposite directions. */

export type LiabilityAttestation = {
  /** Did the host state they carry liability cover on this property? */
  carried: boolean;
  /** Whose policy. Free text — the host types it, we do not validate it against anything. */
  insurer: string | null;
  /** The limit the host says they carry, in US dollars. Their number, labelled as theirs. */
  amountUsd: number | null;
  /** When they stated it. An attestation nobody can date is one nobody can rely on. */
  attestedAt: string | null;
};

/** PLACEHOLDER. The minimum we ASK for — never enforce, because we cannot verify it. */
export const LIABILITY_SUGGESTED_USD = 50_000;

/** PLACEHOLDER commission on a referred policy, until a broker agreement says otherwise. */
export const LIABILITY_REFERRAL_PCT = 10;

export const LIABILITY_COPY = {
  title: P("Liability cover on this property", "Responsabilidad civil sobre este inmueble"),
  /* What it is, in the words of somebody who has never bought one. */
  what: P(
    "This is your own insurance, on your own building — the kind that pays a guest's medical bill if a ceiling fan comes down on them. It is not something OneHome sells you or holds for you.",
    "Es su propio seguro, sobre su propio inmueble — el que paga la cuenta médica de un huésped si se le cae un ventilador de techo encima. No es algo que OneHome le venda ni le administre."),
  /* The tick. Deliberately a statement in the first person, so it reads as the host's words. */
  attest: P(
    "I carry liability insurance on this property and it is in force.",
    "Tengo un seguro de responsabilidad civil vigente sobre este inmueble."),
  /* What the TENANT is shown. "Self-reported" is doing load-bearing work here. */
  tenantLine: P(
    "The host states they carry liability insurance on this property. Self-reported — OneHome has not checked the policy.",
    "El arrendador declara tener seguro de responsabilidad civil sobre este inmueble. Declarado por él — OneHome no ha verificado la póliza."),
  /* For the host who has none. An offer, not a barrier — it must never block publishing. */
  referral: P(
    "Do not have one? We can introduce you to an insurer who writes this cover in Colombia. Most hosts here carry it, and listings that say so get more enquiries.",
    "¿No tiene? Podemos presentarle una aseguradora que expide esta cobertura en Colombia. La mayoría de los anfitriones aquí la tienen, y los anuncios que lo dicen reciben más consultas."),
  /* And what we will NOT say. Kept as copy so it is reviewable, not folklore. */
  neverSay: P(
    "Never: verified, guaranteed, insured by OneHome, covered by us. We are told, we are not shown.",
    "Nunca: verificado, garantizado, asegurado por OneHome, cubierto por nosotros. Nos lo dicen, no lo comprobamos."),
};

export const COVERS: Record<CoverKind, CoverSpec> = {
  damage: DAMAGE_COVER,
};

/**
 * The charge for one billing period. Rounded to cents the same way `platformFee` is, so a total
 * assembled from these never lands a cent away from the sum a member adds up by hand.
 */
export const coverFee = (rent: number, spec: CoverSpec): number =>
  Math.round(Math.max(0, rent) * (spec.ratePct / 100) * 100) / 100;

/** The charge over a whole term — the number a lease actually costs, not the monthly slice. */
export const coverFeeOverTerm = (rent: number, cycles: number, spec: CoverSpec): number =>
  Math.round(coverFee(rent, spec) * Math.max(0, cycles) * 100) / 100;

/**
 * What lands on the GUEST's bill, and what comes off the HOST's payout, for one period. Written
 * as one function so no screen can add liability to a guest's total by mistake.
 */
export function coverSplit(rent: number, opts: { damage: boolean }) {
  /* The host side is deliberately always zero now. Liability is the host's own policy, bought
     from their own carrier, and nothing about it passes through a OneHome price line. */
  const guest = opts.damage ? coverFee(rent, DAMAGE_COVER) : 0;
  return { guest, host: 0, total: guest };
}

/**
 * The line every price breakdown prints. One function, so the guest's checkout, the host's
 * "what you keep" panel and the contract cannot describe the same charge three ways.
 */
export function coverLine(lang: string, spec: CoverSpec, amount: number, fmt: (n: number) => string) {
  const es = lang === "es" || lang === "co";
  const label = es ? spec.title.es : spec.title.en;
  return {
    label: `${label} (${spec.ratePct}%)`,
    amount: fmt(amount),
    /* While cover is unplaced the amount is still SHOWN — struck through in the UI — so the
       member sees exactly what the line will be and that it is not being charged today. */
    charged: COVER_LIVE,
    note: COVER_LIVE ? null : (es ? PENDING_NOTE.es : PENDING_NOTE.en),
  };
}

/** "Up to $25,000, with a $250 excess" — the only two numbers a member ever asks for. */
export function coverLimits(lang: string, spec: CoverSpec, fmt: (n: number) => string) {
  const es = lang === "es" || lang === "co";
  if (spec.excessUsd <= 0) {
    return es ? `Hasta ${fmt(spec.limitUsd)}.` : `Up to ${fmt(spec.limitUsd)}.`;
  }
  return es
    ? `Hasta ${fmt(spec.limitUsd)}, con un deducible de ${fmt(spec.excessUsd)}.`
    : `Up to ${fmt(spec.limitUsd)}, with a ${fmt(spec.excessUsd)} excess.`;
}

/* ── THE CONTRACT CLAUSES ────────────────────────────────────────────────────────────────────
   Kept beside the rates rather than in coTemplate.ts so the clause and the number it refers to
   can never drift. coTemplate imports these. `{{...}}` placeholders are filled by the same
   merge the rest of the contract uses. */
export const COVER_CLAUSES = {
  damage: {
    heading: P("Damage cover", "Cobertura de daños"),
    body: P(
      "Instead of a deposit, the TENANT pays damage cover equal to {{cobertura_danos_pct}}% of the rent per period. The limit is {{cobertura_danos_limite}} per stay, with an excess of {{cobertura_danos_deducible}} carried by the claiming party. Claims are settled solely from the move-in and move-out photographic record accepted by both parties. It does not cover unpaid rent or normal wear. {{cobertura_estado}}",
      "En lugar de depósito, EL ARRENDATARIO paga una cobertura de daños equivalente al {{cobertura_danos_pct}}% del canon por período. El límite es de {{cobertura_danos_limite}} por estadía, con un deducible de {{cobertura_danos_deducible}} a cargo de quien reclama. Los reclamos se resuelven exclusivamente con el acta fotográfica de entrada y de salida aceptada por ambas partes. No cubre cánones impagos ni el desgaste normal del inmueble. {{cobertura_estado}}"),
  },
  liability: {
    heading: P("Liability cover", "Responsabilidad civil"),
    /* The clause records what the LANDLORD told us, and says plainly that we did not check it.
       A contract clause asserting cover we never saw would be the platform vouching for a policy
       it has no knowledge of — which is the whole problem this rewrite exists to remove. */
    body: P(
      "The LANDLORD declares that they maintain liability insurance in force on the property with {{rc_aseguradora}}, for a limit of {{rc_limite}}, covering injury suffered by the TENANT or their guests inside the property. This declaration is the LANDLORD's own; OneHome has not inspected the policy and gives no warranty as to its existence, scope or continuation. Liability insurance is not sold, arranged or held by OneHome.",
      "EL ARRENDADOR declara que mantiene vigente un seguro de responsabilidad civil sobre el inmueble con {{rc_aseguradora}}, por un límite de {{rc_limite}}, que ampara las lesiones sufridas por EL ARRENDATARIO o sus invitados dentro del inmueble. Esta declaración es del ARRENDADOR; OneHome no ha inspeccionado la póliza y no garantiza su existencia, alcance ni continuidad. OneHome no vende, intermedia ni administra el seguro de responsabilidad civil."),
  },
} as const;

/** The sentence that goes into `{{cobertura_estado}}`. It is what keeps the clause honest. */
export const COVER_STATUS_CLAUSE = P(
  "As at the date of this agreement the cover has not been placed with an insurer and no amount is charged for it; neither party may bring a claim under this clause until OneHome gives written notice otherwise.",
  "A la fecha de este contrato la cobertura no ha sido colocada con una aseguradora y no se cobra suma alguna por ella; ninguna de las partes puede presentar un reclamo bajo esta cláusula hasta que OneHome notifique lo contrario por escrito.",
);

/** Every merge value the two clauses need, in one call. */
export function coverMergeValues(lang: string, fmt: (n: number) => string) {
  const es = lang === "es" || lang === "co";
  return {
    cobertura_danos_pct: String(DAMAGE_COVER.ratePct),
    cobertura_danos_limite: fmt(DAMAGE_COVER.limitUsd),
    cobertura_danos_deducible: fmt(DAMAGE_COVER.excessUsd),
    /* Filled from the LISTING's attestation, not from a constant — it is the host's number. */
    rc_aseguradora: "",
    rc_limite: "",
    cobertura_estado: COVER_LIVE ? "" : (es ? COVER_STATUS_CLAUSE.es : COVER_STATUS_CLAUSE.en),
  };
}
