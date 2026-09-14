import {
  RENTAL_HOST_FEE_RATE,
  RENTAL_GUEST_FEE_RATE,
} from "@oneworld/shell";
import { CO_OPTIONAL_SECTIONS } from "./coTemplate";
import { coverOf } from "./media";

/**
 * ONERENTAL — the shared truths every screen reads. Types, money, dates, addendums.
 * ============================================================================================
 * One file so no screen invents its own version of the fee, the month, or the price label. Each
 * of those has been got wrong once already somewhere in this codebase, and each was invisible
 * until it was expensive.
 */

/* ── ROWS ──────────────────────────────────────────────────────────────────────────────────── */

export type PriceUnit = "night" | "month";
export type BillInterval = "days" | "months";
export type ListingStatus = "draft" | "published" | "paused" | "archived";
export type ContractStatus =
  | "draft" | "sent" | "declined" | "awaiting_first_payment" | "active" | "ended" | "cancelled" | "expired";
export type DepositStatus =
  | "none" | "pending" | "held" | "returned" | "partially_returned" | "claimed" | "disputed";

export type Property = {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  photos: string[];
  videos: string[];
  /* ── MEDIA CHOICES (7 Sep 2026, OneHome media lane) — see lib/media.ts ──────────────────────
     The host's still cover (null = first photo), the ONE photo-or-video the Discover feed leads
     with (null = the cover), and whether the listing appears in the feed at all. All three are
     nullable-or-defaulted on the table so every listing written before them still types. */
  cover_photo: string | null;
  feed_preview: { kind: "photo" | "video"; url: string } | null;
  feed_visible: boolean;
  price: number;
  price_unit: PriceUnit;
  host_pays_guest_fee: boolean;
  currency: string;
  display_currency: "USD" | "COP";
  display_fx_rate: number | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  deposit_currency: "USD" | "COP" | null;
  country: string | null;
  city: string | null;
  neighbourhood: string | null;
  /** Loaded separately through rental_property_address; never returned on a public listing row. */
  address_line?: string | null;
  address_is_public: boolean;
  /** Folio de matrícula inmobiliaria, when the lister supplied one. Optional on every listing. */
  matricula_inmobiliaria: string | null;
  bedrooms: number | null;
  /** How many people the place sleeps. NULL = the host has not said — never guess one. */
  max_guests: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  /* The MAP point — see PROPERTY_COLUMNS. Never the exact address unless address_is_public. */
  display_lat: number | null;
  display_lng: number | null;
  geo_precision: "exact" | "approximate" | null;
  furnished: boolean;
  available_from: string | null;
  min_term_days: number;
  bill_interval: BillInterval;
  bill_interval_count: number;
  is_public: boolean;
  status: ListingStatus;
  created_at: string;

  /* ── The attribute set Lee dictated on 11 Aug 2026 ────────────────────────────────────────
     Every one of these is nullable: they arrived by migration on a table that already had rows
     (none, as it happened), and a listing written before the migration is still a valid listing.
     The screens all treat `null` as "not answered" and simply do not show the row. */
  property_type: string | null;
  floor_number: number | null;
  floors_in_building: number | null;
  parking_spaces: number | null;
  estrato: number | null;
  /* On the table since 11 Aug and never typed here, so nothing could read it. The comparison
     needs it — "which of these five is the newest building" is a question people actually ask. */
  year_built: number | null;
  master_bed: string | null;
  walk_in_closet: boolean | null;
  dual_vanities: boolean | null;
  laundry: string | null;
  air_conditioning_units: number | null;
  has_balcony: boolean | null;
  has_patio: boolean | null;
  has_backyard: boolean | null;
  has_grill: boolean | null;
  security_level: string | null;
  pets_allowed: string | null;
  schools_nearby: boolean | null;
  school_zone: string | null;
  amenities: string[];
  /** The owner's toggle. `false` hides the share control everywhere this listing appears. */
  allow_public_share: boolean;
  deposit_basis: "amount" | "months";
  deposit_months: number | null;
  deposit_return_days: number;
  lease_notice_days: number;
  payment_window_business_days: number;
  breach_penalty_months: number;
  /** Always `landlord` since 15 Aug 2026. See ListProperty and shell/lib/cover.ts — OneHome
      never collects, holds or returns a deposit, and takes no fee on one. */
  deposit_held_by: string;

  /* ── HOW THE LETTING IS SECURED (15 Aug 2026) ────────────────────────────────────────────
     `guarantee_kind` is the host's answer: `authorization` (card hold, stays under 30 nights),
     `deposit` (paid to the host directly, never through us) or `insurance` (damage cover).
     Null on every listing written before this migration; the screens read the older columns as
     a fallback rather than showing "not chosen" over a deposit the host really did set. */
  guarantee_kind: "authorization" | "deposit" | "insurance" | null;
  /** What the guarantee is worth: the deposit amount, or the cover charge for one period. */
  guarantee_amount: number | null;
  /** Damage-cover rate. Named `insurance_rate_pct` because that is the 13 Aug column name. */
  insurance_rate_pct: number | null;
  /** When the host ticked the Ley 820 acknowledgement, and the exact words they ticked. An
      acknowledgement nobody can date is one nobody can rely on. */
  deposit_ack_at: string | null;
  deposit_ack_by: string | null;
  deposit_ack_text: string | null;
  /* The two covers, with their rate and limits COPIED ONTO THE ROW at publish time — same
     discipline as `display_fx_rate`. Changing a rate in shell/lib/cover.ts must never rewrite
     what a host and a tenant already agreed to. */
  damage_cover_limit: number | null;
  damage_cover_excess: number | null;
  /** RETIRED 15 Aug 2026 — liability was never ours to sell. Kept so old rows still type. */
  liability_cover: boolean;
  /** The host's OWN policy, as the host stated it. Never render as "verified". */
  liability_attested: boolean;
  liability_insurer: string | null;
  liability_amount_usd: number | null;
  liability_attested_at: string | null;
  liability_referral_optin: boolean;
  /** Was a carrier actually on risk when this listing was published? False until one signs. */
  cover_placed: boolean;

  /* ── SHOWINGS (15 Aug 2026) ──────────────────────────────────────────────────────────────
     The host's weekly windows live in `showing_windows`, one row per weekday block. These three
     are the settings that apply to the whole property rather than to a particular Tuesday — how
     much warning this human being needs, how long one viewing takes, and whether they are
     accepting viewings at all. */
  showings_enabled: boolean;
  /** Hours of warning. 0 = same day is fine. Null = never set, so the button stays hidden. */
  showing_notice_hours: number | null;
  showing_slot_minutes: number;
  /** Host-reviewed suggestions imported from a lease or existing listing. Source bytes are not stored. */
  owner_terms_enabled: boolean;
  imported_contract_terms: Record<string, string>;
  imported_contract_unmapped: { label: string; value: string }[];
  imported_doc_kind: string | null;
  imported_at: string | null;
};

/** The columns every read of `rental_properties` names. Never `select("*")` — same discipline
    as `profiles`, for the same reason: a column added tomorrow should not silently ship. */
export const PROPERTY_COLUMNS =
  "id, agent_id, title, description, photos, videos, cover_photo, feed_preview, feed_visible, " +
  "price, price_unit, host_pays_guest_fee, currency, display_currency, " +
  "display_fx_rate, deposit_required, deposit_amount, deposit_currency, country, city, neighbourhood, " +
  "address_is_public, bedrooms, bathrooms, area_m2, furnished, available_from, min_term_days, " +
  /* 15 Aug: how many people it sleeps. Usually the first question a guest asks, and OneHome
     had no field for it anywhere — not the form, the card, the detail page or the filters. */
  "max_guests, " +
  "bill_interval, bill_interval_count, is_public, status, created_at, " +
  /* The 11 Aug attribute block. Named, like everything else — `select("*")` would have shipped
     these to every screen the moment the migration ran, including the ones not ready to show them. */
  "property_type, floor_number, floors_in_building, parking_spaces, estrato, master_bed, " +
  "walk_in_closet, dual_vanities, laundry, air_conditioning_units, has_balcony, has_patio, " +
  "has_backyard, has_grill, security_level, pets_allowed, schools_nearby, school_zone, " +
  "amenities, allow_public_share, deposit_basis, deposit_months, deposit_return_days, deposit_held_by, " +
  "lease_notice_days, payment_window_business_days, breach_penalty_months, " +
  /* 15 Aug: the guarantee choice and the two covers. Named like everything else — never
     `select("*")`, for the reason two lines up. */
  "guarantee_kind, guarantee_amount, insurance_rate_pct, deposit_ack_at, deposit_ack_by, " +
  "deposit_ack_text, damage_cover_limit, damage_cover_excess, liability_cover, " +
  "liability_attested, liability_insurer, liability_amount_usd, liability_attested_at, " +
  "liability_referral_optin, cover_placed, " +
  "showings_enabled, showing_notice_hours, showing_slot_minutes, " +
  "owner_terms_enabled, imported_contract_terms, imported_contract_unmapped, imported_doc_kind, imported_at, " +
  /* The map point (11 Aug). NOT the address: for any listing whose address is not public these
     were deliberately offset by up to ~250m in the browser before they were saved, so the true
     coordinate is not in the database at all. See shell/lib/geo.ts. */
  "display_lat, display_lng, geo_precision, " +
  /* 12 Aug: the listing number people quote on the phone, when it was last edited, and the two
     attributes nobody else's listing states. */
  "listing_no, updated_at, penthouse, open_view, year_built, ac_in_master, " +
  /* The folio. The ONLY join key into the national registry — without it the detail page cannot
     show what the place actually sold for. Added to the rental table 12 Aug 2026. */
  "matricula_inmobiliaria, allow_comments";

export type RentalAgent = {
  agent_id: string;
  full_name: string | null;
  photo_url: string | null;
  score: number | null;
  total_listings: number;
  active_listings: number;
};

/* ── COLOMBIA ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Lee, 10 Aug 2026: *"it's gonna be Colombia only for right now… it's gonna cater to expatriates
 * or tourists that are looking for housing in Colombia and Medellín and Bogotá and Cali,
 * Cartagena and places like that, and it's gonna be some of the more exclusive properties."*
 *
 * A fixed list rather than free text, because a city filter only works if everyone spells the
 * city the same way — "Medellin", "Medellín" and "medellin" are three cities to a database and
 * one city to a person. Free text is still accepted for anywhere not listed.
 */
/* ── CITIES AND BARRIOS MOVED TO THE SHELL, 12 Aug 2026 ──────────────────────────────────────
   Both were defined here AND, differently, in products/onesale/lib/sale.ts — the rent form
   offered Pereira and Bucaramanga, the sale form offered Barranquilla and Santa Marta, and only
   this side carried barrio suggestions at all. Lee: "these are twin forms." One list now lives in
   the shell; these re-exports keep every existing import in this product working unchanged. */
export { CO_CITIES, CO_NEIGHBOURHOODS, coCityKey } from "@oneworld/shell";
import { drawPrice, productHref, type ViewerCcy, type CompareItem } from "@oneworld/shell";

/* ── MONEY ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * WHAT THE PROPERTY MANAGER ACTUALLY RECEIVES.
 *
 * Lee, 10 Aug 2026: *"When the renter pays the money, it's gonna be six point nine nine percent
 * less… whoever the property manager is, they can increase the price if they want to. But when
 * the money transfers to their account, it'll be six point nine nine percent less than where it
 * started."*
 *
 * The host and guest pay different fees. The host receives rent less the host fee; the guest
 * pays rent plus the guest fee. The rent itself still moves directly between them — OneHome
 * collects only its own two fees.
 *
 * This function exists so the listing screen can show a NET-TO-YOU FIGURE next to the rent
 * before anybody publishes. A percentage in the small print is how a platform gets accused of a
 * hidden charge; a number they can read is how it doesn't.
 */
export const hostFee = (amount: number, rate = RENTAL_HOST_FEE_RATE) =>
  Math.round(amount * rate * 100) / 100;

export const guestFee = (amount: number, rate = RENTAL_GUEST_FEE_RATE) =>
  Math.round(amount * rate * 100) / 100;

export const netToManager = (amount: number, rate = RENTAL_HOST_FEE_RATE) =>
  Math.round((amount - hostFee(amount, rate)) * 100) / 100;

export const totalDueFromGuest = (amount: number, rate = RENTAL_GUEST_FEE_RATE) =>
  Math.round((amount + guestFee(amount, rate)) * 100) / 100;

/**
 * TOTAL fee over the whole term — the number that actually matters on a lease, and the one a
 * per-transaction percentage hides. Lee: *"any transaction that flows through."* A 6-month lease
 * billed monthly pays the fee six times.
 *
 * ⚠️ `deposit` / `depositThroughUs` ARE NOW ALWAYS UNUSED, and the arguments are kept only so an
 * old call site fails loudly rather than silently changing meaning. As of 15 Aug 2026 OneHome
 * never receives a deposit, so it can never earn a percentage of one: charging a fee on a sum
 * implies receiving it, and that implication is the whole regulatory exposure. Pass `null` and
 * `false`, or nothing at all. The next person to add a deposit fee should read Ley 820 de 2003
 * Art. 16 first, and then not.
 */
export function hostFeeOverTerm(opts: {
  rent: number;
  cycles: number;
  deposit?: number | null;
  depositThroughUs?: boolean;
  rate?: number;
}): number {
  const rate = opts.rate ?? RENTAL_HOST_FEE_RATE;
  const rentFee = hostFee(opts.rent, rate) * Math.max(0, opts.cycles);
  const depFee = opts.depositThroughUs && opts.deposit ? hostFee(opts.deposit, rate) : 0;
  return Math.round((rentFee + depFee) * 100) / 100;
}

export function guestFeeOverTerm(opts: {
  rent: number;
  cycles: number;
  rate?: number;
}): number {
  const rate = opts.rate ?? RENTAL_GUEST_FEE_RATE;
  return Math.round(guestFee(opts.rent, rate) * Math.max(0, opts.cycles) * 100) / 100;
}

export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export const usd2 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/**
 * COP is DISPLAY ONLY in v1 (Lee, 10 Aug). The charge is in USD and the screen says so — a
 * price shown in pesos and billed in dollars without a word is the kind of surprise that ends
 * up in a WhatsApp group, which is the one place we cannot afford to look worse than the
 * incumbent.
 *
 * Colombian convention: thousands separated with a full stop, no decimals. `es-CO` does that.
 */
export const cop = (usdAmount: number, fx: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", currencyDisplay: "code", maximumFractionDigits: 0 })
    .format(usdAmount * fx);

/** Format the stored denomination before applying the reader's currency choice. */
const rentalPrice = (
  p: Pick<Property, "price"> & Partial<Pick<Property, "currency">>,
  ccy: ViewerCcy, rate?: number | null,
) => {
  if (p.currency?.toUpperCase() === "COP") {
    if (ccy === "COP" || !rate || !Number.isFinite(rate) || rate <= 0) {
      return cop(p.price, 1);
    }
    return drawPrice(p.price / rate, ccy, rate);
  }
  return drawPrice(p.price, ccy, rate);
};

/** "$1,900 / month" · "COP 9.000.000 / month". */
/**
 * "$1,900 / month", in whichever currency the READER chose.
 *
 * Legacy listings default to USD. COP listings retain their native denomination when the
 * official TRM is unavailable; conversion never relabels a peso number as dollars.
 */
export const priceLabel = (
  p: Pick<Property, "price" | "price_unit"> & Partial<Pick<Property, "currency">>, lang: string,
  ccy: ViewerCcy = "USD", rate?: number | null,
) =>
  `${rentalPrice(p, ccy, rate)} / ${p.price_unit === "night"
    ? (lang === "es" || lang === "co" ? "noche" : "night")
    : (lang === "es" || lang === "co" ? "mes" : "month")}`;

/**
 * THE SAME NUMBER, WITHOUT ITS PERIOD — for places that have already said what the period is.
 *
 * Lee, 15 Aug 2026, on the map: *"It doesn't need to be per month. Just write the price. The per
 * month is implied because every listing is gonna be based on the per month… it's gonna take a
 * lot less horizontal room up that way."*
 *
 * ⚠️ This is NOT a shorter `priceLabel` and must not creep onto cards or the detail screen. A
 * rent figure with no period attached is genuinely ambiguous — the same product already carries
 * nightly listings — and the ONLY thing that makes it safe here is that the surrounding surface
 * states the period once for everything on it. Use it where that sentence exists, and nowhere
 * else. `ListingMap`'s `period` prop is what prints it.
 */
export const priceOnly = (
  p: Pick<Property, "price"> & Partial<Pick<Property, "currency">>, ccy: ViewerCcy = "USD", rate?: number | null,
) => rentalPrice(p, ccy, rate);

/* ── ERRORS A MEMBER CAN ACT ON ────────────────────────────────────────────────────────────
   The database refuses an overlapping booking with SQLSTATE 23P01 and a message that names an
   exclusion constraint. The migration's own comment promised the app would render that as
   "those dates were just taken" — and the first pass did not, so a Spanish-speaking tenant
   would have met a raw Postgres string at the exact moment they tried to commit to a home.
   Caught by the launch audit. Everything else still shows the SERVER'S OWN sentence, because a
   summarised error is how the Messages defect stayed invisible for weeks. */
export function rentalError(e: { code?: string; message?: string } | null, lang: string): string {
  const es = lang === "es" || lang === "co";
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  if (code === "23P01" || /no_double_booking/.test(msg)) {
    return es
      ? "Esas fechas se acaban de tomar para este inmueble. Elija otras fechas."
      : "Those dates have just been taken for this property. Please pick different dates.";
  }
  if (code === "42501") {
    return es
      ? "Esta acción no le corresponde a usted en este contrato."
      : "That is not your side of this contract to change.";
  }
  return msg || (es ? "Algo salió mal." : "Something went wrong.");
}

/* ── DATES ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * THE ONE GENUINE DIFFERENCE BETWEEN NIGHTLY AND MONTHLY, and Lee named it himself: *"one month
 * is slightly different, because thirty-one days is different than thirty days."*
 *
 * Months are NOT 30-day blocks. Billing a lease every 30 days walks its due date backwards about
 * five days a year, and a member notices that on a bank statement long before they notice it in
 * an app. This mirrors, in the browser, exactly what Postgres does server-side with
 * `due_date + (n || ' month')::interval`: clamp to the last valid day of the target month.
 *
 * 31 Jan + 1 month → 28 Feb (29 Feb in a leap year). Both proven against the database.
 */
export function addInterval(from: Date, interval: BillInterval, count: number): Date {
  const d = new Date(from.getTime());
  if (interval === "days") {
    d.setDate(d.getDate() + count);
    return d;
  }
  const day = d.getDate();
  d.setDate(1);                       // park on the 1st so the month add cannot roll over
  d.setMonth(d.getMonth() + count);
  const lastOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastOfTarget));
  return d;
}

/** How many billing cycles a term contains. Used for the total-fee figure on the listing. */
export function cyclesBetween(startISO: string, endISO: string, interval: BillInterval, count: number): number {
  const end = new Date(endISO + "T00:00:00");
  let cur = new Date(startISO + "T00:00:00");
  let n = 0;
  while (cur < end && n < 600) { cur = addInterval(cur, interval, count); n++; }
  return n;
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/* ── PAYOUT TIMING ─────────────────────────────────────────────────────────────────────────── */

/**
 * Lee's numbers, stated on screen BEFORE anybody accepts. A manager expecting the deposit
 * tomorrow who sees it a week later files a ticket and tells the WhatsApp group. Saying it late
 * is the same as not saying it.
 */
export const PAYOUT_FIRST_DAYS = 7;
export const PAYOUT_LATER_DAYS = 2;

/* ── THE ADDENDUM LIBRARY ──────────────────────────────────────────────────────────────────── */

/**
 * Lee, 10 Aug 2026: *"we probably should put… a one or two sentence summary for each page. So
 * the person who's looking at this, they'll know exactly what they're selecting. If they don't
 * wanna read the whole thing, at least they'll have a summary… a new user comes along, and they
 * don't wanna read eighteen pages, but they know that that's the actual agreement, and they can
 * read it if they want to."*
 *
 * That is the shape here: an addendum is an OPTIONAL clause set, each carrying a plain-language
 * summary in the two live languages. The summary is what the picker shows; the full text is one
 * tap away and is what actually gets snapshotted into the signed document.
 *
 * ⚠️ THE COLOMBIA BASELINE IS NOT HERE YET, ON PURPOSE. Lee is sending his own last Colombian
 * lease to be the baseline. Writing Ley-820 residential language from memory and shipping it as
 * "the Colombian agreement" would be worse than having none — an unenforceable lease that looks
 * official is the single most damaging thing this product could put in front of a tenant. The
 * The baseline now EXISTS, structurally, in `coTemplate.ts` — see the note on
 * COLOMBIA_BASELINE_READY below for what "structurally" is doing in that sentence.
 */
export type Addendum = {
  key: string;
  title: { en: string; es: string };
  /** One or two sentences. What the picker shows. Never more — that is the whole point. */
  summary: { en: string; es: string };
  /** The clause text merged into the snapshot when selected. */
  body: { en: string; es: string };
  /** Ley 820 Art. 16 — offered only on a stay under CO_RESIDENTIAL_DAYS. See CoSection. */
  shortStayOnly?: boolean;
};

/**
 * ONE LIST, DERIVED FROM THE COLOMBIAN LEASE STRUCTURE.
 *
 * The first pass of this file carried a generic, invented set (pets, utilities, subletting…).
 * That is now gone: the real optional clauses live in `coTemplate.ts`, drawn from an actual
 * signed Medellín lease Lee provided, and this is a thin adapter so nothing else in the product
 * has to know which file they came from. Two lists of addendums would drift within a week.
 */
export const ADDENDUMS: Addendum[] = CO_OPTIONAL_SECTIONS.map(a => ({
  key: a.key, title: a.heading, summary: a.summary, body: a.body,
  /* Ley 820 Art. 16 — see the note on CoSection.shortStayOnly. Carried through here so the
     picker can hide it rather than each screen re-deriving the rule. */
  shortStayOnly: a.shortStayOnly,
}));

/**
 * THE COLOMBIAN BASELINE IS NOW REAL — structurally. It is `CO_LEASE_SECTIONS`, written fresh
 * from the legal shape of a Colombian residential lease (Ley 820 + ordinary practice), because
 * the document Lee sent is the intellectual property of another firm and carries an explicit
 * no-reproduction notice.
 *
 * ⚠️ STILL NOT COUNSEL-REVIEWED. It is offered as a STARTING POINT the manager edits, next to
 * upload-your-own — never as "the Colombian agreement" — until a Colombian attorney reads it.
 * The distinction is on the screen, in words, not only here.
 */
export const COLOMBIA_BASELINE_READY = false;

/* ── THE SNAPSHOT ──────────────────────────────────────────────────────────────────────────── */

/**
 * Lee, 10 Aug 2026: *"when they accept it, we'll just take a snapshot, and then we'll time stamp
 * it with the person's signature and say, you know, whoever, Lee Frazier signed it at October
 * fifth nine fifty-five PM… so there's a contract, and it has a stamped signature, and it shows
 * the same thing for both parties. And then both people can always pull it up as a contract if
 * they ever want to show it, print it, save it, share it."*
 *
 * So the snapshot is built ONCE, at acceptance, from the document plus the selected addendums
 * plus both signature stamps — and is then immutable at the database (see the trigger). It is
 * the same bytes for both parties forever, which is the only property that makes it a contract
 * rather than a screen.
 */
export function stamp(name: string, whenISO: string, lang: string): string {
  const d = new Date(whenISO);
  const when = d.toLocaleString(lang === "es" || lang === "co" ? "es-CO" : "en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return lang === "es" || lang === "co"
    ? `Firmado por ${name} el ${when}`
    : `Signed by ${name} on ${when}`;
}

export function buildSnapshot(input: {
  documentText: string;
  addendumKeys: string[];
  lang: "en" | "es";
  agent: { name: string; at: string } | null;
  tenant: { name: string; at: string } | null;
  property: string;
  term: string;
  rent: string;
  deposit: string | null;
  hostFeeAmount: string;
  guestFeeAmount: string;
  totalPlatformFees: string;
}): string {
  const L = input.lang === "es" ? "es" : "en";
  const t = (en: string, es: string) => (L === "es" ? es : en);
  const chosen = ADDENDUMS.filter(a => input.addendumKeys.includes(a.key));

  const lines: string[] = [];
  lines.push(t("RENTAL AGREEMENT", "CONTRATO DE ARRENDAMIENTO"));
  lines.push("");
  lines.push(`${t("Property", "Inmueble")}: ${input.property}`);
  lines.push(`${t("Term", "Término")}: ${input.term}`);
  lines.push(`${t("Rent", "Canon")}: ${input.rent}`);
  if (input.deposit) lines.push(`${t("Deposit", "Depósito")}: ${input.deposit}`);
  lines.push(
    `${t("Host platform fee", "Comisión de la plataforma para el anfitrión")}: ` +
    `${input.hostFeeAmount} ` +
    t("deducted from each rent payment.", "descontado de cada pago del canon."));
  lines.push(
    `${t("Guest platform fee", "Comisión de la plataforma para el huésped")}: ` +
    `${input.guestFeeAmount} ` +
    t("added to each rent payment.", "añadido a cada pago del canon."));
  lines.push(
    `${t("Total platform fees", "Comisiones totales de la plataforma")}: ` +
    `${input.totalPlatformFees} ` +
    t("per payment. The rent itself goes directly from tenant to landlord.",
      "por pago. El canon pasa directamente del arrendatario al arrendador."));
  lines.push("");
  lines.push("──────────────────────────────────────────");
  lines.push("");
  lines.push(input.documentText.trim());

  if (chosen.length) {
    lines.push("");
    lines.push(t("ADDENDUMS SELECTED BY BOTH PARTIES", "ANEXOS SELECCIONADOS POR AMBAS PARTES"));
    for (const a of chosen) {
      lines.push("");
      lines.push(`— ${a.title[L]}`);
      lines.push(a.body[L]);
    }
  }

  lines.push("");
  lines.push("──────────────────────────────────────────");
  lines.push("");
  if (input.agent) lines.push(stamp(input.agent.name, input.agent.at, L));
  if (input.tenant) lines.push(stamp(input.tenant.name, input.tenant.at, L));
  return lines.join("\n");
}

/** Browser-native SHA-256, so both parties can verify the document is byte-identical. */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A LISTING AS THE COMPARISON SEES IT.
 *
 * Kept here rather than in the shell because only this file knows what a rental row looks like —
 * the shell's `CompareItem` is deliberately table-agnostic so one matrix can hold a rental and a
 * sale side by side. Every field maps straight across; nothing is computed, guessed or defaulted.
 *
 * ⚠️ MISSING STAYS NULL. `?? null`, never `?? 0`. A zero means "this flat has no bathrooms" and
 * would lose that row honestly; a null means "not stated" and correctly wins nothing and loses
 * nothing. See `winnersOf`.
 */
export function toCompareItem(l: Property, agent?: { full_name?: string | null; score?: number | null }): CompareItem {
  return {
    id: l.id,
    kind: "rental",
    title: l.title,
    photo: coverOf(l),
    href: productHref("onerental", `/r/${l.id}`),
    city: l.city ?? null,
    neighbourhood: l.neighbourhood ?? null,
    price: Number(l.price),
    period: l.price_unit === "night" ? "night" : "month",
    bedrooms: l.bedrooms ?? null,
    bathrooms: l.bathrooms == null ? null : Number(l.bathrooms),
    areaM2: l.area_m2 == null ? null : Number(l.area_m2),
    parking: l.parking_spaces ?? null,
    yearBuilt: l.year_built ?? null,
    estrato: l.estrato ?? null,
    floor: l.floor_number ?? null,
    furnished: l.furnished ?? null,
    balcony: l.has_balcony ?? null,
    penthouse: (l as any).penthouse ?? null,
    openView: (l as any).open_view ?? null,
    petsAllowed: l.pets_allowed ?? null,
    security: l.security_level ?? null,
    amenities: Array.isArray(l.amenities) ? l.amenities : [],
    /* A rental has no admin fee column — the figure belongs to the sale side. Null, not zero:
       zero would win the "lowest admin fee" row against a sale that honestly charges one. */
    adminFee: null,
    agentScore: agent?.score == null ? null : Number(agent.score),
    agentName: agent?.full_name ?? null,
    registryCount: null,
  };
}
