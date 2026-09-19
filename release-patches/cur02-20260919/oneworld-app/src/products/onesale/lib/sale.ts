/**
 * ONESALE — the buying half of One Home. Shared truths for every screen.
 *
 * The one thing this file exists to keep straight: WHAT MONEY CAN ACTUALLY MOVE. Lee, 10 Aug:
 * *"the sales purchase price won't go through it — the big money won't be able to go through.
 * But the agent commission could be paid through the app, the earnest money, all that stuff."*
 * So every figure here is labelled by whether it passes through us or not, and the screens read
 * that label rather than deciding for themselves.
 */
import { SALE_FEE_RATE, saleFeeOnEarnest, productHref, type CompareItem } from "@oneworld/shell";

export type SaleStatus = "draft" | "published" | "under_offer" | "sold" | "withdrawn";
export type SaleKind = "apartment" | "house" | "lot" | "office" | "commercial" | "farm";

export type SaleProperty = {
  id: string; agent_id: string; title: string; description: string | null; photos: string[];
  asking_price: number; currency: string;
  display_currency: "USD" | "COP"; display_fx_rate: number | null;
  commission_pct: number | null; commission_paid_by: "seller" | "buyer" | "shared" | null;
  earnest_money: number | null;
  kind: SaleKind; country: string | null; city: string | null; neighbourhood: string | null;
  address_line: string | null; address_is_public: boolean;
  bedrooms: number | null; bathrooms: number | null; area_m2: number | null;
  parking_spaces: number | null; year_built: number | null;
  estrato: number | null; admin_fee_monthly: number | null; matricula_inmobiliaria: string | null;
  is_public: boolean; status: SaleStatus; created_at: string;
  /* Where the map draws it, and how honestly. `geo_precision` is "exact" only when the seller
     published a street address — which OneHome almost never is — so in practice every sale pin
     is a circle over an area rather than a claim about a building. */
  /* In SALE_COLUMNS since 11 Aug and never typed, so the comparison could not read them. */
  floor_number: number | null; floors_in_building: number | null;
  display_lat: number | null; display_lng: number | null;
  geo_precision: "exact" | "approximate" | null;
  showings_enabled: boolean;
  showing_notice_hours: number | null;
  showing_slot_minutes: number | null;
};

export const SALE_COLUMNS =
  "id, agent_id, title, description, photos, asking_price, currency, display_currency, " +
  "display_fx_rate, commission_pct, commission_paid_by, earnest_money, kind, country, city, " +
  "neighbourhood, address_line, address_is_public, bedrooms, bathrooms, area_m2, parking_spaces, " +
  "year_built, estrato, admin_fee_monthly, matricula_inmobiliaria, is_public, status, created_at, " +
  /* The 11 Aug shared attribute block — the same columns, with the same names, as
     `rental_properties`. One migration put them on both tables so one detail screen, one card and
     one future filter can read either without branching. */
  "property_type, floor_number, floors_in_building, furnished, master_bed, walk_in_closet, " +
  "dual_vanities, laundry, air_conditioning_units, has_balcony, has_patio, has_backyard, " +
  "has_grill, security_level, pets_allowed, schools_nearby, school_zone, amenities, " +
  "available_from, allow_public_share, " +
  /* 12 Aug: the number people quote on the phone, when it was last edited, and the two attributes
     nobody else's listing states. Same additions the rent side got the same day. */
  "listing_no, updated_at, penthouse, open_view, allow_comments, " +
  /* 15 Aug: the map needs a point and a precision. The sale feed had no map, so nothing here
     ever asked for these — and a map view added without them would have drawn an empty city.
     `geo_precision` decides pin-vs-circle; see shell/components/ListingMap.tsx. */
  "display_lat, display_lng, geo_precision, " +
  /* The three viewing settings, so the buyer's page knows whether to offer the button at all. */
  "showings_enabled, showing_notice_hours, showing_slot_minutes";

export type SaleHistory = {
  id: string; property_id: string | null; matricula_inmobiliaria: string | null;
  address_line: string | null; city: string | null;
  sold_price: number; currency: string; sold_on: string;
  document_path: string | null; verified_at: string | null; created_at: string;
};

/* ── WHAT PASSES THROUGH US, AND WHAT DOES NOT ─────────────────────────────────────────────── */

/**
 * The purchase price NEVER passes through OneSale. A Colombian sale closes through attorneys,
 * and pretending otherwise would be the single most damaging claim this product could make.
 *
 * WHAT WE CHARGE, AND ON WHAT (Lee, 10 Aug 2026):
 *   *"The only thing that we're taking commission on is the earnest money, and we'll take six
 *   percent of the earnest money."*
 *
 * So there is exactly ONE fee base on this side of One Home: the earnest money captured into the
 * vault. Not the asking price. Not the agent's commission. An earlier draft of this file charged
 * the RENTAL rate against the commission — right arithmetic, wrong base, and a fee we are not
 * entitled to. The helper below takes the earnest amount by name so that mistake cannot repeat
 * silently: a call site handing it a commission is visible in the diff.
 */
export const FEE_BASE = "earnest_money" as const;
export const PASSES_THROUGH_US = ["earnest_money", "commission"] as const;
export const WE_CHARGE_ON = ["earnest_money"] as const;
export const NEVER_PASSES_THROUGH_US = ["purchase_price"] as const;

export const commissionAmount = (p: Pick<SaleProperty, "asking_price" | "commission_pct">) =>
  p.commission_pct == null ? null : Math.round(p.asking_price * (p.commission_pct / 100) * 100) / 100;

/** Our 5.99% of the earnest money held in the vault. The only fee OneSale charges. */
export const earnestFee = (earnest: number) => saleFeeOnEarnest(earnest);

/** What reaches the seller's side of the closing out of the earnest money. */
export const earnestNet = (earnest: number) =>
  Math.round((earnest - saleFeeOnEarnest(earnest)) * 100) / 100;

/**
 * Commission routed through the app arrives WHOLE. We do not take a second cut of it — our take
 * is the earnest-money fee and nothing else. Kept as an explicit identity function rather than
 * deleted, so a screen reaching for "what does the agent net" gets the right answer instead of
 * inventing one.
 */
export const commissionNet = (gross: number) => gross;

export const SALE_FEE_RATE_USED = SALE_FEE_RATE;

export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
export const cop = (usdAmount: number, fx: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", currencyDisplay: "code", maximumFractionDigits: 0 }).format(usdAmount * fx);

export const KIND_LABEL: Record<SaleKind, { en: string; es: string }> = {
  apartment:  { en: "Apartment", es: "Apartamento" },
  house:      { en: "House",     es: "Casa" },
  lot:        { en: "Lot",       es: "Lote" },
  office:     { en: "Office",    es: "Oficina" },
  commercial: { en: "Commercial",es: "Local comercial" },
  farm:       { en: "Farm",      es: "Finca" },
};

/* Cities moved to the shell, 12 Aug 2026 — this product's list and the rent product's list had
   drifted apart. See shell/lib/coGeo.ts. Barrios come with them. */
export { CO_CITIES, CO_NEIGHBOURHOODS, coCityKey } from "@oneworld/shell";

/* ── THE VALUE RANGE ──────────────────────────────────────────────────────────────────────────
 *
 * Lee, 10 Aug 2026: *"The main thing is that we're storing history for sale… sales history like
 * Zillow does. And we have sales history, then you have property values… here's a property range
 * value. Same thing like Zillow."*
 *
 * The arithmetic lives in `sale_estimate()` in the database, not here, for two reasons: it needs
 * the whole comparable set (which a browser has no business downloading), and it must give the
 * same answer to a signed-out visitor as to the listing agent. The client's only job is to render
 * what came back honestly — including the cases where the answer is "not yet".
 */

export type SaleEstimate =
  | { ok: true; currency: string;
      low: number; mid: number; high: number;
      per_m2_low: number; per_m2_mid: number; per_m2_high: number;
      area_m2: number; comparables: number;
      basis: "neighbourhood_similar_size" | "neighbourhood_same_type" | "city_similar_size"
           | "city_same_type" | "city_any_type";
      confidence: "high" | "medium" | "low";
      window_months: number; oldest_sale: string; newest_sale: string;
      asking_vs_mid_pct: number | null;
      disclaimer_en: string; disclaimer_es: string }
  | { ok: false; reason: "not_found" | "not_visible" | "no_area" | "not_enough_comparables";
      comparables?: number; minimum?: number; months?: number;
      message_en?: string; message_es?: string };

export type SaleComparable = {
  sold_on: string; sold_price: number; currency: string; area_m2: number;
  price_per_m2: number; bedrooms: number | null; neighbourhood: string | null; verified: boolean;
};

/** How the range was reached, said plainly. A number nobody can interrogate is a number nobody
 *  trusts — and in a market with no public record, trust is the entire product. */
export const BASIS_LABEL: Record<string, { en: string; es: string }> = {
  neighbourhood_similar_size: { en: "sales in this neighbourhood, similar size",
                                es: "ventas en este barrio, de tamaño similar" },
  neighbourhood_same_type:    { en: "sales in this neighbourhood",
                                es: "ventas en este barrio" },
  city_similar_size:          { en: "sales in this city, similar size",
                                es: "ventas en esta ciudad, de tamaño similar" },
  city_same_type:             { en: "sales of this property type in this city",
                                es: "ventas de este tipo de inmueble en esta ciudad" },
  city_any_type:              { en: "sales in this city",
                                es: "ventas en esta ciudad" },
};

export const CONFIDENCE_LABEL: Record<string, { en: string; es: string }> = {
  high:   { en: "Strong basis",  es: "Base sólida" },
  medium: { en: "Fair basis",    es: "Base razonable" },
  low:    { en: "Thin basis",    es: "Base limitada" },
};

/**
 * A SALE LISTING AS THE COMPARISON SEES IT — the twin of the rent side's `toCompareItem`.
 *
 * ⚠️ `period` IS NULL, AND THAT IS THE WHOLE DIFFERENCE. An asking price is a total, not a rate,
 * so the price row prints it bare while a rental prints "per month". Setting it to "month" here
 * would put a monthly figure on a purchase price in the matrix and in the printed PDF.
 *
 * ⚠️ MISSING STAYS NULL, never zero — a nulled field wins nothing and loses nothing.
 */
export function toCompareItem(
  l: SaleProperty,
  agent?: { full_name?: string | null; score?: number | null; score_v9_snapshot?: number | null },
  registryCount?: number | null,
): CompareItem {
  const score = agent?.score ?? agent?.score_v9_snapshot ?? null;
  return {
    id: l.id,
    kind: "sale",
    title: l.title,
    photo: l.photos?.[0] ?? null,
    href: productHref("onesale", `/s/${l.id}`),
    city: l.city ?? null,
    neighbourhood: l.neighbourhood ?? null,
    price: Number(l.asking_price),
    period: null,
    bedrooms: l.bedrooms ?? null,
    bathrooms: l.bathrooms == null ? null : Number(l.bathrooms),
    areaM2: l.area_m2 == null ? null : Number(l.area_m2),
    parking: l.parking_spaces ?? null,
    yearBuilt: l.year_built ?? null,
    estrato: l.estrato ?? null,
    floor: l.floor_number ?? null,
    furnished: (l as any).furnished ?? null,
    balcony: (l as any).has_balcony ?? null,
    penthouse: (l as any).penthouse ?? null,
    openView: (l as any).open_view ?? null,
    petsAllowed: (l as any).pets_allowed ?? null,
    security: (l as any).security_level ?? null,
    amenities: Array.isArray((l as any).amenities) ? (l as any).amenities : [],
    adminFee: l.admin_fee_monthly == null ? null : Number(l.admin_fee_monthly),
    agentScore: score == null ? null : Number(score),
    agentName: agent?.full_name ?? null,
    /* How many registered notarial sales the registry holds for this folio. The one column no
       other Colombian portal can print, so it earns a row of its own on a sale comparison. */
    registryCount: registryCount ?? null,
  };
}
