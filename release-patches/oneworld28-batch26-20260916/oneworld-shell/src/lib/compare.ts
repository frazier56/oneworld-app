/**
 * COMPARE — up to five places, side by side, with a winner on every row.
 * ============================================================================================
 * Lee, 15 August 2026:
 *
 *   *"We gotta put some type of comparison tool in place where a person can compare up to five
 *   properties… they can create a PDF… a matrix system that says, here's all the attributes down
 *   the left side, and here are the properties across the top per column… which one wins in each
 *   category."*
 *
 * ── WHY FIVE, AND WHY THE CAP IS ENFORCED HERE ──────────────────────────────────────────────
 * Five columns is the most that fits a sheet of A4 in landscape at a type size somebody can read
 * across a table, and it is also about the most a person can hold in their head. The cap lives in
 * this file rather than in the screen so the bar, the sheet and the PDF cannot disagree about it.
 *
 * ── ⚠️ AND WHY THE "AI SUMMARY" IS NOT AN LLM CALL ──────────────────────────────────────────
 * It reads like one and it is deliberately not one. Every sentence it writes is derived from the
 * winner table below — the cheapest per square metre, the newest, the one with parking — so it
 * **cannot invent an amenity that is not on the listing**. A model summarising five homes will
 * eventually write "walking distance to the metro" about a flat that is not, and on somebody's
 * property that is a claim we published, not a paraphrase. It is also instant, free, works
 * offline, and gives the same answer twice.
 *
 * If a model is added later it should ARGUE about a matrix it was handed, never restate facts it
 * was trusted to read. The hook for that is `summarise()` — swap the body, keep the inputs.
 *
 * ── THE ONE RULE THAT MAKES A WINNER HONEST ─────────────────────────────────────────────────
 * A row only crowns a winner when the values genuinely differ AND every column has a value. Two
 * flats both with three bedrooms have no winner; a flat that simply did not state its estrato has
 * not lost that row. Marking a blank as a loss punishes the listing that was merely incomplete,
 * which is exactly backwards on a platform whose promise is that the data is straight.
 */

import { W } from "./i18n";

export const COMPARE_MAX = 5;

/** The normalised shape both feeds produce. Neither table is read directly by anything here. */
export type CompareItem = {
  id: string;
  kind: "rental" | "sale";
  title: string;
  photo: string | null;
  href: string;
  city: string | null;
  neighbourhood: string | null;
  /** In US dollars. Rent per its own period; a sale's asking price. */
  price: number;
  /** "month" | "night" for a rental; null for a sale. */
  period: "month" | "night" | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaM2: number | null;
  parking: number | null;
  yearBuilt: number | null;
  estrato: number | null;
  floor: number | null;
  furnished: boolean | null;
  balcony: boolean | null;
  penthouse: boolean | null;
  openView: boolean | null;
  petsAllowed: string | null;
  security: string | null;
  amenities: string[];
  adminFee: number | null;
  /** OneScore of the person listing it, 0–100. */
  agentScore: number | null;
  agentName: string | null;
  /** How many registered sales the registry holds for it. The thing only OneHome can show. */
  registryCount: number | null;
};

/* ── THE ROWS ──────────────────────────────────────────────────────────────────────────────────
   `better` says which direction wins. `null` means the row is informative but not a contest —
   nobody "wins" on being on the fourth floor, and pretending otherwise would put a green tick on
   an arbitrary preference. */
export type Better = "high" | "low" | "yes" | null;

export type Row = {
  key: string;
  en: string;
  es: string;
  /** The comparable number. Null means "not stated" — never zero. */
  value: (i: CompareItem) => number | null;
  /** What the cell reads. */
  text: (i: CompareItem, lang: string) => string;
  better: Better;
  /** Rows that only make sense when every item is the same kind. */
  onlyWhen?: (items: CompareItem[]) => boolean;
};

const yn = (v: boolean | null, lang: string) =>
  v == null ? "—" : v ? W(lang, "Yes", "Sí") : W(lang, "No", "No");

const num = (v: number | null, suffix = "") => (v == null ? "—" : `${v}${suffix}`);

const money = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("en-US",
    { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const allRentals = (items: CompareItem[]) => items.every(i => i.kind === "rental");
const allSales = (items: CompareItem[]) => items.every(i => i.kind === "sale");

export const ROWS: Row[] = [
  {
    key: "price", en: "Price", es: "Precio", better: "low",
    value: i => i.price,
    text: (i, lang) => i.period
      ? `${money(i.price)} / ${i.period === "night" ? W(lang, "night", "noche") : W(lang, "month", "mes")}`
      : money(i.price),
  },
  {
    /* ⚠️ THE ROW THAT DOES THE MOST WORK, AND THE ONE NOBODY COMPUTES BY HAND.
       A bigger flat at a bigger price can still be the better buy, and the only way to see that
       across five listings is per square metre. Null when either half is missing rather than
       dividing by a guessed area. */
    key: "perM2", en: "Price per m²", es: "Precio por m²", better: "low",
    value: i => (i.areaM2 && i.areaM2 > 0 ? Math.round((i.price / i.areaM2) * 100) / 100 : null),
    text: i => (i.areaM2 && i.areaM2 > 0 ? money(Math.round(i.price / i.areaM2)) : "—"),
  },
  { key: "area", en: "Size", es: "Área", better: "high",
    value: i => i.areaM2, text: i => num(i.areaM2, " m²") },
  { key: "beds", en: "Bedrooms", es: "Habitaciones", better: "high",
    value: i => i.bedrooms, text: i => num(i.bedrooms) },
  { key: "baths", en: "Bathrooms", es: "Baños", better: "high",
    value: i => i.bathrooms, text: i => num(i.bathrooms) },
  { key: "parking", en: "Parking", es: "Parqueaderos", better: "high",
    value: i => i.parking, text: i => num(i.parking) },
  { key: "year", en: "Year built", es: "Año de construcción", better: "high",
    value: i => i.yearBuilt, text: i => num(i.yearBuilt) },
  {
    /* Estrato is Colombia's utilities band, 1 to 6. HIGHER is the more expensive neighbourhood,
       which is not the same as better — a 6 pays the most for water and power. So it is shown and
       never crowned. Getting this backwards would put a green tick on the highest utility bill in
       the country. */
    key: "estrato", en: "Estrato", es: "Estrato", better: null,
    value: i => i.estrato, text: i => num(i.estrato),
  },
  { key: "floor", en: "Floor", es: "Piso", better: null,
    value: i => i.floor, text: i => num(i.floor) },
  { key: "admin", en: "Monthly admin fee", es: "Administración mensual", better: "low",
    value: i => i.adminFee, text: i => money(i.adminFee) },
  { key: "furnished", en: "Furnished", es: "Amoblado", better: "yes",
    value: i => (i.furnished == null ? null : i.furnished ? 1 : 0), text: (i, l) => yn(i.furnished, l),
    onlyWhen: allRentals },
  { key: "balcony", en: "Balcony", es: "Balcón", better: "yes",
    value: i => (i.balcony == null ? null : i.balcony ? 1 : 0), text: (i, l) => yn(i.balcony, l) },
  { key: "penthouse", en: "Penthouse", es: "Penthouse", better: "yes",
    value: i => (i.penthouse == null ? null : i.penthouse ? 1 : 0), text: (i, l) => yn(i.penthouse, l) },
  { key: "view", en: "Open view", es: "Vista despejada", better: "yes",
    value: i => (i.openView == null ? null : i.openView ? 1 : 0), text: (i, l) => yn(i.openView, l) },
  { key: "amenities", en: "Amenities", es: "Amenidades", better: "high",
    value: i => (i.amenities.length ? i.amenities.length : null),
    text: i => (i.amenities.length ? String(i.amenities.length) : "—") },
  {
    /* The credibility layer, in the matrix, because it is a fact about the offer and people
       weigh it. Never crowned when nobody has a score — see the null rule at the top. */
    key: "score", en: "Lister's OneScore", es: "OneScore de quien publica", better: "high",
    value: i => i.agentScore, text: i => num(i.agentScore),
  },
  {
    key: "registry", en: "Registered sales on file", es: "Ventas registradas", better: "high",
    value: i => i.registryCount, text: i => num(i.registryCount),
    onlyWhen: allSales,
  },
];

export const rowsFor = (items: CompareItem[]) =>
  ROWS.filter(r => !r.onlyWhen || r.onlyWhen(items));

/**
 * Which columns win a row. Returns a set of item ids — a SET, because a genuine tie has two
 * winners and silently picking the left-most one is a lie told by an implementation detail.
 *
 * Empty when the row cannot be judged: fewer than two values, every value identical, or the
 * direction is `null`.
 */
export function winnersOf(row: Row, items: CompareItem[]): Set<string> {
  if (!row.better) return new Set();
  const vals = items.map(i => ({ id: i.id, v: row.value(i) }));
  const known = vals.filter(x => x.v != null) as { id: string; v: number }[];

  /* ⚠️ EVERY COLUMN MUST HAVE A VALUE. A listing that simply did not state its estrato has not
     lost that row, and a green tick opposite four dashes is not a comparison — it is a reward for
     being the only one who filled the field in. */
  if (known.length < 2 || known.length !== items.length) return new Set();

  const best = row.better === "low"
    ? Math.min(...known.map(x => x.v))
    : Math.max(...known.map(x => x.v));

  /* Nothing to win if they all match. */
  if (known.every(x => x.v === best)) return new Set();
  /* "yes" only crowns an actual yes — when the best available answer is no, nobody wins. */
  if (row.better === "yes" && best !== 1) return new Set();

  return new Set(known.filter(x => x.v === best).map(x => x.id));
}

/** How many rows each column wins. The number under each heading in the sheet and the PDF. */
export function scoreboard(items: CompareItem[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(items.map(i => [i.id, 0]));
  for (const row of rowsFor(items)) {
    for (const id of winnersOf(row, items)) out[id] += 1;
  }
  return out;
}

/**
 * THE SUMMARY — written from the winner table, so every clause is checkable against the row
 * above it. See the header for why this is not a model call.
 *
 * It deliberately does NOT declare an overall winner. Row wins are not weighted and cannot be:
 * whether a second bathroom beats forty dollars a month is the reader's question, not ours, and
 * a platform that answers it is steering somebody towards a home for reasons it invented.
 */
export function summarise(items: CompareItem[], lang: string): string[] {
  if (items.length < 2) return [];
  const es = lang === "es" || lang === "co";
  const out: string[] = [];
  const name = (id: string) => items.find(i => i.id === id)?.title ?? "";
  const short = (t: string) => (t.length > 38 ? t.slice(0, 36).trimEnd() + "…" : t);

  const say = (rowKey: string, en: (n: string, v: string) => string, esf: (n: string, v: string) => string) => {
    const row = rowsFor(items).find(r => r.key === rowKey);
    if (!row) return;
    const w = [...winnersOf(row, items)];
    if (w.length !== 1) return;                       // a tie explains nothing
    const item = items.find(i => i.id === w[0])!;
    out.push((es ? esf : en)(short(name(w[0])), row.text(item, lang)));
  };

  say("perM2",
    (n, v) => `${n} is the best value by floor area, at ${v} per square metre.`,
    (n, v) => `${n} ofrece el mejor valor por área, a ${v} por metro cuadrado.`);
  say("price",
    (n, v) => `${n} is the cheapest outright, at ${v}.`,
    (n, v) => `${n} es el más económico, a ${v}.`);
  say("area",
    (n, v) => `${n} is the largest, at ${v}.`,
    (n, v) => `${n} es el más grande, con ${v}.`);
  say("year",
    (n, v) => `${n} is the newest building, from ${v}.`,
    (n, v) => `${n} es el edificio más nuevo, de ${v}.`);
  say("parking",
    (n, v) => `${n} has the most parking, with ${v}.`,
    (n, v) => `${n} tiene más parqueaderos, con ${v}.`);
  say("score",
    (n, v) => `${n} is listed by the highest-rated member here, at ${v} out of 100.`,
    (n, v) => `${n} lo publica el miembro con mejor calificación, ${v} de 100.`);

  /* The honest closing line. It says what the table shows and stops. */
  const board = scoreboard(items);
  const top = Object.entries(board).sort((a, b) => b[1] - a[1]);
  if (top.length && top[0][1] > 0 && top[0][1] !== top[1]?.[1]) {
    out.push(es
      ? `En total, ${short(name(top[0][0]))} gana ${top[0][1]} de ${rowsFor(items).filter(r => r.better).length} categorías comparables. Cuál conviene depende de qué categorías le importan a usted.`
      : `On the whole, ${short(name(top[0][0]))} wins ${top[0][1]} of the ${rowsFor(items).filter(r => r.better).length} categories that can be judged. Which one is right still depends on which of those categories matter to you.`);
  }
  return out;
}
