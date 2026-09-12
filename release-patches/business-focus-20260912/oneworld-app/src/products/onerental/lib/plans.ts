import type { PlanTier } from "@oneworld/shell";

/**
 * ONERENTAL PLANS — Free · Pro $9.99 · VIP $19.99. Lee set the prices, 10 Aug 2026:
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
      "Contracts, signatures and the walkthrough — all included",
      "Your OneScore on every listing",
      "Message tenants directly",
    ],
    bulletsEs: [
      "Un inmueble publicado",
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
      "Five live listings",
      "Your places rank above free listings in the feed",
      "Higher in agent search, with a Pro mark",
      "Views, saves and enquiries per listing",
    ],
    bulletsEs: [
      "Todo lo de Gratis",
      "Cinco inmuebles publicados",
      "Sus inmuebles aparecen por encima de los anuncios gratuitos",
      "Más arriba en la búsqueda de agentes, con distintivo Pro",
      "Vistas, guardados y consultas por anuncio",
    ],
  },
  {
    key: "vip", nameEn: "VIP", nameEs: "VIP", price: "$19.99",
    perEn: "/month", perEs: "/mes",
    tagEn: "Get seen first", tagEs: "Que lo vean primero",
    bulletsEn: [
      "Everything in Pro",
      "Unlimited listings",
      "Featured at the top of your city's feed",
      "First in agent search",
      "New listings pushed to tenants whose saved search matches",
    ],
    bulletsEs: [
      "Todo lo de Pro",
      "Inmuebles ilimitados",
      "Destacado en la parte superior del feed de su ciudad",
      "Primero en la búsqueda de agentes",
      "Sus nuevos anuncios se envían a quienes buscan algo así",
    ],
  },
];
