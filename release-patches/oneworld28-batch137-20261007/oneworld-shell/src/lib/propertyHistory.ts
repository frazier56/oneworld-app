/**
 * PROPERTY HISTORY — the thing OneHome is actually for.
 * ============================================================================================
 * Lee, 11 Aug 2026:
 *
 *   *"These people don't have properties with history on them and prices are all over the place.
 *    For that reason… we're definitely trying to bring history, the historical values in play."*
 *
 * ── THE PREMISE EVERYONE GETS WRONG ─────────────────────────────────────────────────────────
 * "Colombia has no MLS, so property history is impossible here." The first half is true. The
 * second half is false, and this file is the proof.
 *
 * The IGAC publishes every notarial transfer registered in the country as open data on
 * datos.gov.co — dataset `7y2j-43cv`. Verified live from this codebase on 11 Aug 2026:
 *
 *   · ~30.9 million transactions nationally
 *   · 1,544,313 of them in Medellín
 *   · 105,963 Medellín rows of type COMPRAVENTA carrying a real transaction value
 *   · chained by MATRÍCULA INMOBILIARIA, with the deed number and the notaría on each row
 *
 * A worked example, pulled live: matrícula `001-121` has a COMPRAVENTA registered 27 Jun 2023 at
 * 530,000,000 COP. That is a real sale price for a real Medellín property, free, public, and
 * currently shown to nobody.
 *
 * ── THE FIVE CAVEATS, STATED UP FRONT ───────────────────────────────────────────────────────
 * Any one of these turns into a lie on screen if it is handled quietly, so each is handled loudly:
 *
 * 1. VALUES ONLY EXIST 2021–2023. Earlier rows carry the event but not the money. So a property
 *    can have a long chain and one priced entry — the UI must say "1 priced sale of 6 events",
 *    never imply the chain IS the price history.
 * 2. `valor` IS DIRTY. Some rows carry 100,000 COP for a usufruct, some carry the true price.
 *    Filtering to COMPRAVENTA removes most of it; an implausibility floor removes the rest.
 * 3. COMPRAVENTA ≠ COMPRAVENTA DERECHOS DE CUOTA. The second is the sale of a FRACTIONAL SHARE —
 *    17,563 Medellín rows of it — and its value is a share price, not a property price.
 *    Presenting one as the other would understate a property by an unknown multiple. They are
 *    separated here and the fractional ones are labelled, never mixed into a headline.
 * 4. NO AREA, NO GEOMETRY. There is no m² in this dataset, so a price-per-m² can only be computed
 *    against the area the LISTING claims. That is the agent's number, not the registry's, and it
 *    is labelled as such.
 * 5. `numero_catastral` IS NULL FOR 100% OF MEDELLÍN ROWS. Matrícula is the ONLY join key. Which
 *    is exactly why the listing form asks for it, and why "nobody knows what a matrícula is" was
 *    the wrong reason to remove the field — see `onesale/screens/ListProperty.tsx`.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────────────────────
 * Not an estimate. Not a valuation. Not a Zestimate. It reports transactions that were registered
 * before a notary, and nothing else. The moment this file starts inferring a number nobody
 * recorded, it stops being the thing that makes OneHome trustworthy.
 */

const IGAC = "https://www.datos.gov.co/resource/7y2j-43cv.json";

/** A full outright sale. The only code whose `valor` is a property price. */
const SALE = "COMPRAVENTA";
/** Sale of a fractional share — a real transaction, but NOT the price of the whole property. */
const SHARE_SALE = "COMPRAVENTA DERECHOS DE CUOTA";

/**
 * Below this, a `valor` is not a market price — it is a nominal or symbolic figure, a stamp-duty
 * base, or a data-entry artefact. 20,000,000 COP is roughly USD 6,400 at today's TRM; nothing in
 * urban Medellín trades for less, so anything under it is noise rather than a bargain.
 */
const IMPLAUSIBLE_BELOW = 20_000_000;

/**
 * ⚠️ THE REGISTRY DOES NOT USE ONE DATE FORMAT, AND IT COST US "Invalid Date" ON A LIVE LISTING.
 *
 * Found on 15 Aug 2026 by opening the Cartagena sample on production and reading the screen —
 * not by reading this file. `fecha_radica_texto` comes back in at least three shapes, mixed
 * inside a single folio's chain:
 *
 *   "2023-06-29 00:00:00"   ISO, what the old `.slice(0, 10)` assumed
 *   "13/07/2022"            day/month/year — `new Date()` reads this as 7 December in en-US
 *   "06/07/21"              day/month/two-digit-year — parsed as year 6 AD, or not at all
 *
 * Slicing the first ten characters of "13/07/2022" yields "13/07/2022", which `new Date()`
 * mis-parses or rejects. Both failure modes are worse than the other: one prints "Invalid Date"
 * on a property listing, and the QUIET one silently swaps the day and the month, which would
 * misdate a registered sale by up to eleven months and never look broken.
 *
 * Colombia writes dates day-first. So does the registry. Normalise everything to ISO here, once,
 * and let every screen downstream keep assuming ISO.
 */
function toIsoDate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  /* Already ISO, with or without a time component. */
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  /* Day-first with slashes or dots, two- or four-digit year. */
  /* ⚠️ FOUR-DIGIT YEAR FIRST IN THE ALTERNATION. `(\d{2}|\d{4})` looks equivalent and is not:
     regex alternation is ordered, so `\d{2}` matches the "20" of "2022" and the year silently
     becomes 2020. Caught by the unit table below this file's change, not by reading it — every
     four-digit year in the registry was landing two years wrong while looking perfectly normal. */
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4}|\d{2})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    /* A two-digit year in a property registry is this century. The dataset starts well after
       2000 and no anotación in it predates the millennium in this format. */
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    /* Refuse the impossible rather than emit a date that will render as something plausible. */
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }
  return "";
}

export type RegistryEvent = {
  /** Registry order — the anotación number on the folio. */
  anotacion: number;
  /** ISO date the transfer was registered. */
  date: string;
  year: number;
  /** COP. Null when the row carries the event but no money (everything before 2021). */
  valueCop: number | null;
  /** The registered nature of the act, e.g. COMPRAVENTA. */
  kind: string;
  /** True for an outright sale whose value we are willing to show as a property price. */
  isSale: boolean;
  /** True for a fractional-share sale — shown, but never as the property's price. */
  isShareSale: boolean;
  /** "ESCRITURA 722 DE 27-06-2023; NOTARIA 31 DE MEDELLIN" — the receipt. */
  document: string | null;
};

export type PropertyHistory = {
  matricula: string;
  /** Every registered event we can see, newest first. */
  events: RegistryEvent[];
  /** Outright sales carrying a plausible price, newest first. The headline. */
  pricedSales: RegistryEvent[];
  /** When the folio was opened. Often decades before the first event we hold. */
  openedOn: string | null;
  municipality: string | null;
};

/**
 * NORMALISE WHAT SOMEBODY TYPES INTO WHAT THE DATASET STORES.
 *
 * Medellín folios live under two registry offices and the dataset writes them differently:
 * `001-121` (ORIP 1, 1.14M rows) and `01N-5547202` (ORIP 01N, 406k rows). A person copying off a
 * certificado will type any of `001-121`, `1-121`, `001 121`, `001121`, `01N5547202`.
 *
 * An exact-match query against an un-normalised string is how this feature would look broken to
 * an agent holding the correct document in their hand.
 */
export function normaliseMatricula(raw: string): string | null {
  const s = (raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;

  const dashed = s.match(/^(\d{1,3}N?)[-–—]?(\d{1,10})$/);
  if (dashed) {
    const [, office, serial] = dashed;
    /* An office ending in N keeps its letter and its own zero-padding; a numeric office is padded
       to three digits, which is how the dataset writes it. */
    const pad = office.endsWith("N")
      ? office.padStart(3, "0")
      : office.padStart(3, "0");
    return `${pad}-${String(Number(serial))}`;
  }

  /* No separator at all: `001121`. Ambiguous in general, but both Medellín offices are three
     characters, so take the first three and treat the rest as the serial. */
  const run = s.match(/^(\d{2}N|\d{3})(\d{1,10})$/);
  if (run) return `${run[1]}-${String(Number(run[2]))}`;

  return null;
}

/** Human-readable, the way it is printed on a certificado. */
export function formatMatricula(m: string): string {
  return m;
}

const parseEvent = (r: any): RegistryEvent => {
  const kind = String(r.nombre_natujur ?? "").trim();
  const raw = r.valor != null ? Number(r.valor) : NaN;
  const value = Number.isFinite(raw) && raw > 0 ? raw : null;
  return {
    anotacion: Number(r.num_anotacion) || 0,
    date: toIsoDate(r.fecha_radica_texto),
    year: Number(r.year_radica) || 0,
    valueCop: value,
    kind,
    isSale: kind === SALE,
    isShareSale: kind === SHARE_SALE,
    document: r.documento_justificativo ? String(r.documento_justificativo) : null,
  };
};

/* One lookup per matrícula per session. A detail screen that re-fetches on every render would hit
   a public government endpoint once per scroll. */
const cache = new Map<string, PropertyHistory | null>();

/**
 * The registered history of one property.
 *
 * Returns null when the matrícula is unreadable, unknown to the dataset, or the endpoint cannot be
 * reached. **Null means "we have nothing to show", NEVER "this property has no history"** — the
 * dataset's priced coverage is 2021–2023 and a genuinely old, quiet property will legitimately
 * come back empty. Callers must not render an absence as a fact about the property.
 */
export async function fetchPropertyHistory(rawMatricula: string): Promise<PropertyHistory | null> {
  const m = normaliseMatricula(rawMatricula);
  if (!m) return null;
  if (cache.has(m)) return cache.get(m)!;

  try {
    const url = new URL(IGAC);
    url.searchParams.set("$where", `matricula='${m.replace(/'/g, "")}'`);
    url.searchParams.set("$order", "num_anotacion DESC");
    url.searchParams.set("$limit", "200");
    const r = await fetch(url.toString());
    if (!r.ok) { cache.set(m, null); return null; }
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) { cache.set(m, null); return null; }

    const events = rows.map(parseEvent).sort((a, b) => b.anotacion - a.anotacion);

    /* THE HEADLINE SET. Outright sales only, priced only, above the implausibility floor. Every
       exclusion here is one that would otherwise put a wrong number on a listing. */
    const pricedSales = events.filter(
      e => e.isSale && e.valueCop != null && e.valueCop >= IMPLAUSIBLE_BELOW);

    const out: PropertyHistory = {
      matricula: m,
      events,
      pricedSales,
      openedOn: rows[0]?.fecha_apertura_texto ? String(rows[0].fecha_apertura_texto).slice(0, 10) : null,
      municipality: rows[0]?.municipio ? String(rows[0].municipio) : null,
    };
    cache.set(m, out);
    return out;
  } catch {
    /* Never cache a network failure as "no history" — the next mount should try again. */
    return null;
  }
}

/**
 * Compound annual growth between the two most distant priced sales, as a percentage.
 *
 * Null unless there are genuinely two priced sales at least a year apart. Two sales four months
 * apart annualise into a number that says far more about the arithmetic than about the property,
 * and printing it would be the first dishonest thing on the screen.
 */
export function annualGrowthPct(h: PropertyHistory): number | null {
  const s = h.pricedSales;
  if (s.length < 2) return null;
  const newest = s[0];
  const oldest = s[s.length - 1];
  if (!newest.valueCop || !oldest.valueCop) return null;
  /* A chain with an unreadable date yields no growth figure at all. NaN percent on a property
     page is the same class of defect as "Invalid Date" — it just hides better. */
  if (!newest.date || !oldest.date) return null;
  const years = (new Date(newest.date).getTime() - new Date(oldest.date).getTime()) / 31_557_600_000;
  if (!Number.isFinite(years)) return null;
  if (!(years >= 1)) return null;
  const growth = (Math.pow(newest.valueCop / oldest.valueCop, 1 / years) - 1) * 100;
  return Number.isFinite(growth) ? Math.round(growth * 10) / 10 : null;
}

/** "ESCRITURA 722 DE 27-06-2023; NOTARIA 31 DE MEDELLIN" → "Escritura 722 · Notaría 31". */
export function shortDeed(document: string | null): string | null {
  if (!document) return null;
  const esc = document.match(/ESCRITURA\s+(\d+)/i);
  const not = document.match(/NOTAR[ÍI]A\s+([A-ZÁÉÍÓÚÑ0-9]+)/i);
  const parts: string[] = [];
  if (esc) parts.push(`Escritura ${esc[1]}`);
  if (not) parts.push(`Notaría ${not[1].charAt(0) + not[1].slice(1).toLowerCase()}`);
  return parts.length ? parts.join(" · ") : null;
}
