import type { PlanTier } from "@oneworld/shell";

/**
 * ONERENTAL PLANS — Free · Pro $9.99 · VIP $29.99.
 *
 * ⚠️ VIP MOVED FROM 19.99 TO 29.99 ON 17 SEPTEMBER 2026, by Lee, together with what the two paid
 * tiers now carry: more photos, more description characters and more house rules. His words:
 * *"instead of 10 dollars it's 9.99… instead of 30, it's 29.99. So really it's not three paid
 * options — you have free, then Pro, and then VIP."* The prices below are the published ones and
 * the only place they are written.
 *
 * Original note, prices from 10 Aug 2026:
 * *"some properties can get promoted to the top, kinda like sponsored… free, pro, VIP. Pro will
 * give them something — I'll let you decide what… you can decide based on marketing."*
 *
 * ── THE LADDER, AND WHY IT IS SHAPED THIS WAY ───────────────────────────────────────────────
 * On a two-sided marketplace the thing supply will actually pay for is DEMAND, not features. A
 * property manager does not want a nicer dashboard; they want their apartment seen before the
 * one below it. So each rung buys a different amount of ATTENTION, and every rung leaves the
 * product itself fully usable:
 *
 *   FREE  — participate.  One live listing. Contracts, signatures, the walkthrough and the score
 *           are all included, because those are the reasons to be here rather than in a WhatsApp
 *           group, and putting them behind a paywall would sell the wrong thing.
 *   PRO   — be seen.      Five live listings, above free in the feed and in agent search, a Pro
 *           mark on the card, and the numbers behind it (views, saves, enquiries).
 *   VIP   — be seen FIRST. Unlimited listings, the featured rotation at the top of the city feed,
 *           first in agent search, and outbound reach — a new listing is pushed to tenants whose
 *           saved search matches it.
 *
 * ── WHAT IS DELIBERATELY *NOT* SOLD ─────────────────────────────────────────────────────────
 * Nothing about trust. Not the score, not verification, not the walkthrough, not the contract.
 * The moment a paid tier buys a credibility signal, the signal is worth nothing — which is the
 * whole company's thesis, not just this product's.
 *
 * ⚠️ NOT WIRED TO STRIPE. Like the shell's own PlansScreen, checkout is honestly "opening soon".
 * The listing caps below are enforced NOWHERE yet — they are the published promise, and the
 * enforcement lands with the money leg, in the same round that charges for it.
 */
export const RENTAL_TIERS: PlanTier[] = [
  {
    key: "free", nameEn: "Free", nameEs: "Gratis", price: "$0",
    perEn: "forever", perEs: "para siempre",
    bulletsEn: [
      "One live listing",
      "8 photos, 600 characters of description, 3 house rules",
      "Contracts, signatures and the walkthrough — all included",
      "Your OneScore on every listing",
      "Message tenants directly",
    ],
    bulletsEs: [
      "Un inmueble publicado",
      "8 fotos, 600 caracteres de descripción, 3 reglas de la casa",
      "Contratos, firmas y acta de entrega — todo incluido",
      "Su OneScore en cada anuncio",
      "Escriba directamente a los interesados",
    ],
  },
  {
    key: "pro", nameEn: "Pro", nameEs: "Pro", price: "$9.99",
    perEn: "/month", perEs: "/mes",
    tagEn: "Get seen", tagEs: "Que lo vean", popular: true,
    bulletsEn: [
      "Everything in Free",
      "25 photos, 2,000 characters of description, 10 house rules",
      "Five live listings",
      "Your places rank above free listings in the feed",
      "Higher in agent search, with a Pro mark",
      "Views, saves and enquiries per listing",
    ],
    bulletsEs: [
      "Todo lo de Gratis",
      "25 fotos, 2.000 caracteres de descripción, 10 reglas de la casa",
      "Cinco inmuebles publicados",
      "Sus inmuebles aparecen por encima de los anuncios gratuitos",
      "Más arriba en la búsqueda de agentes, con distintivo Pro",
      "Vistas, guardados y consultas por anuncio",
    ],
  },
  {
    key: "vip", nameEn: "VIP", nameEs: "VIP", price: "$29.99",
    perEn: "/month", perEs: "/mes",
    tagEn: "Get seen first", tagEs: "Que lo vean primero",
    bulletsEn: [
      /* ⚠️ THE FIRST BULLET IS THE CROSS-APP ONE, because from 18 September 2026 that is what
         VIP actually is. Lee: *"if you go VIP, it's across all apps… they just pay that one
         cost."* Every other line here describes OneHome, so without this one somebody reads a
         list of rental features and never learns that the same 29.99 also makes them VIP in
         OneJob, OneEvent and everything else. It leads, in bold, because it is the reason the
         tier costs three times Pro. */
      "VIP in EVERY One World app — OneJob, OneEvent, OneScore and the rest — for this one price",
      "Everything in Pro",
      "50 photos, 5,000 characters of description, 50 house rules",
      "Unlimited listings",
      "Featured at the top of your city's feed",
      "First in agent search",
      "New listings pushed to tenants whose saved search matches",
    ],
    bulletsEs: [
      "VIP en TODAS las apps de One World — OneJob, OneEvent, OneScore y las demás — por este único precio",
      "Todo lo de Pro",
      "50 fotos, 5.000 caracteres de descripción, 50 reglas de la casa",
      "Inmuebles ilimitados",
      "Destacado en la parte superior del feed de su ciudad",
      "Primero en la búsqueda de agentes",
      "Sus nuevos anuncios se envían a quienes buscan algo así",
    ],
  },
];


/* ════════════════════════════════════════════════════════════════════════════════════════
   WHAT EACH TIER ACTUALLY ALLOWS — the numbers, separate from the marketing copy above.
   ============================================================================================
   Lee set the house-rule counts himself on 17 September 2026: *"for the free option, you can have
   three rules. Pro, you can have 10. VIP, you can have up to 50."* The photo and description caps
   follow the same curve, and 2,000 characters on Pro is the figure he named when he first asked
   for a description limit.

   ⚠️ THESE NUMBERS ARE ALSO IN THE DATABASE — `public.rental_plan_limits(plan)` — AND THE
   DATABASE IS THE ONE THAT DECIDES. The plan columns on `profiles` were browser-writable once and
   anybody could self-grant VIP; a limit that only a form enforces is not a limit. This table
   exists so the form can show the right number and disable the right control BEFORE somebody
   types for a minute and is then refused. If the two ever disagree, the server wins and this file
   is the bug. */
export type PlanKey = "free" | "pro" | "vip";

export type PlanLimits = {
  key: PlanKey;
  /** Monthly price in US dollars. Free is 0. Keep in step with `price` in RENTAL_TIERS above. */
  priceUsd: number;
  houseRules: number;
  photos: number;
  descriptionChars: number;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { key: "free", priceUsd: 0,     houseRules: 3,  photos: 8,  descriptionChars: 600 },
  pro:  { key: "pro",  priceUsd: 9.99,  houseRules: 10, photos: 25, descriptionChars: 2000 },
  vip:  { key: "vip",  priceUsd: 29.99, houseRules: 50, photos: 50, descriptionChars: 5000 },
};

/** Anything unrecognised is Free. An unknown plan must never unlock more than a known one. */
export function planLimits(plan: string | null | undefined): PlanLimits {
  const key = String(plan ?? "").toLowerCase();
  return key === "vip" ? PLAN_LIMITS.vip : key === "pro" ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

/** One rule is at most two sentences. 100 characters is that, and the database enforces it. */
export const HOUSE_RULE_MAX_CHARS = 100;
