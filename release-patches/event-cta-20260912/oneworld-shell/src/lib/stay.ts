/**
 * WHAT A STAY COSTS, AND WHICH NIGHTS ARE FREE
 * ============================================================================================
 * Tasks 1-3 of the reservation engine. One file, because the listing calendar, the price
 * breakdown the guest sees, the host's own preview and the eventual charge must all produce the
 * same number from the same rules. Two implementations of a price is two prices.
 *
 * ── NIGHTS, NOT DAYS ────────────────────────────────────────────────────────────────────────
 * A stay from the 14th to the 21st is SEVEN nights, and the 21st is not one of them — the guest
 * leaves that morning and somebody else can arrive that afternoon. Every range here is
 * half-open: start included, end excluded. Getting this wrong is how a booking system loses a
 * sellable night on every single reservation, and it is the most common bug in the category.
 *
 * ── PERCENTAGES, NOT REPLACEMENT PRICES ─────────────────────────────────────────────────────
 * Lee, 13 Aug 2026: *"seasonal rate — what's the percent increase you want on your seasonal
 * dates, and select the dates."* A season is a range plus a percentage. A hard-coded December
 * price goes stale the moment the host changes their base rate, and nobody notices until they
 * have undercharged a whole season.
 */

/** A night, as YYYY-MM-DD. Deliberately a string: a Date carries a timezone and a night does not.
 *  A booking on the 14th is the 14th in Medellín whatever the guest's phone thinks. */
export type Day = string;

export type Season = { starts_on: Day; ends_on: Day; pct: number; label?: string | null };

export type StayRules = {
  /** the nightly rate before anything is applied */
  base: number;
  /** Friday and Saturday nights, e.g. 20 for a fifth more */
  weekendPct?: number | null;
  minNights?: number | null;
  /** 7 nights or more */
  weeklyDiscountPct?: number | null;
  /** 28 nights or more */
  monthlyDiscountPct?: number | null;
  seasons?: Season[];
};

export type Booked = { starts_on: Day; ends_on: Day };

const MS = 86_400_000;
const toMs = (d: Day) => Date.parse(d + "T00:00:00Z");
export const dayAdd = (d: Day, n: number) => new Date(toMs(d) + n * MS).toISOString().slice(0, 10);
export const nightsBetween = (a: Day, b: Day) => Math.round((toMs(b) - toMs(a)) / MS);

/** Every night in [start, end) — the end date is a departure, not a night. */
export function nightsIn(start: Day, end: Day): Day[] {
  const out: Day[] = [];
  for (let d = start; toMs(d) < toMs(end); d = dayAdd(d, 1)) out.push(d);
  return out;
}

/** Do two half-open ranges share a night? */
export const overlaps = (aS: Day, aE: Day, bS: Day, bE: Day) =>
  toMs(aS) < toMs(bE) && toMs(bS) < toMs(aE);

/** The set of nights already taken. A departure day is NOT taken — someone can arrive that day. */
export function takenNights(booked: Booked[]): Set<Day> {
  const s = new Set<Day>();
  for (const b of booked) for (const n of nightsIn(b.starts_on, b.ends_on)) s.add(n);
  return s;
}

/** Is this whole range free? Used by the calendar and asserted again by the database. */
export const rangeIsFree = (start: Day, end: Day, booked: Booked[]) =>
  !booked.some(b => overlaps(start, end, b.starts_on, b.ends_on));

const isWeekendNight = (d: Day) => {
  const dow = new Date(toMs(d)).getUTCDay();   // 5 Fri, 6 Sat
  return dow === 5 || dow === 6;
};

const seasonPct = (d: Day, seasons: Season[] = []) => {
  /* Later-created seasons win where two overlap — the host drew the second one on purpose. The
     caller passes them in creation order, so the LAST match is the live one. */
  let pct = 0;
  for (const s of seasons) if (toMs(d) >= toMs(s.starts_on) && toMs(d) <= toMs(s.ends_on)) pct = s.pct;
  return pct;
};

export type NightLine = { day: Day; amount: number; weekend: boolean; seasonPct: number };

export type Quote = {
  ok: boolean;
  /** why not, in a form the screen can translate */
  reason?: "no-dates" | "backwards" | "too-short" | "unavailable";
  nights: number;
  minNights?: number;
  lines: NightLine[];
  /** before any length discount */
  subtotal: number;
  discountPct: number;
  discount: number;
  total: number;
};

/**
 * Price a stay. Returns a REASON rather than throwing, because every one of these is a normal
 * thing for a guest to do — pick one date and stop, pick the end before the start, ask for two
 * nights where the host wants five.
 */
export function quote(start: Day | null, end: Day | null, rules: StayRules, booked: Booked[] = []): Quote {
  const empty: Quote = { ok: false, nights: 0, lines: [], subtotal: 0, discountPct: 0, discount: 0, total: 0 };
  if (!start || !end) return { ...empty, reason: "no-dates" };
  if (toMs(end) <= toMs(start)) return { ...empty, reason: "backwards" };

  const nights = nightsBetween(start, end);
  if (rules.minNights && nights < rules.minNights)
    return { ...empty, nights, minNights: rules.minNights, reason: "too-short" };
  if (!rangeIsFree(start, end, booked))
    return { ...empty, nights, reason: "unavailable" };

  const lines = nightsIn(start, end).map<NightLine>(day => {
    const weekend = isWeekendNight(day);
    const sp = seasonPct(day, rules.seasons);
    /* Season and weekend both apply. A December Saturday is dearer than a December Tuesday AND
       dearer than a June Saturday, which is what a host means when they set both. */
    const amount = rules.base * (1 + sp / 100) * (1 + (weekend ? (rules.weekendPct ?? 0) : 0) / 100);
    return { day, weekend, seasonPct: sp, amount: Math.round(amount * 100) / 100 };
  });

  const subtotal = Math.round(lines.reduce((t, l) => t + l.amount, 0) * 100) / 100;
  const discountPct = nights >= 28 ? (rules.monthlyDiscountPct ?? 0)
                    : nights >= 7  ? (rules.weeklyDiscountPct ?? 0) : 0;
  const discount = Math.round(subtotal * (discountPct / 100) * 100) / 100;

  return { ok: true, nights, lines, subtotal, discountPct, discount,
           total: Math.round((subtotal - discount) * 100) / 100 };
}
