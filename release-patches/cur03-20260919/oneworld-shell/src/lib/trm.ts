/**
 * THE PESO RATE — one number, from the government, never from a text box.
 * ============================================================================================
 * Lee, 11 Aug 2026:
 *
 *   *"the conversion should be based on some type of general standard. We can't allow the user to
 *    input the conversion because it could be wrong, and that could be very deceptive… we could use
 *    Bank Colombia or some type of national government of Colombia conversion rate."*
 *
 * He is right, and it is worse than "could be wrong". A listing that stores the agent's typed rate
 * is a listing whose peso price is whatever the agent felt like. At 4,000 COP/USD — the number that
 * was hard-coded as the default in the listing form — a $1,900 rent displayed as 7,600,000 COP.
 * The real rate today is around 3,125, which makes the true figure about 5,938,000. The form was
 * quietly overstating every peso price by roughly 28%. Nobody typed a lie; the default WAS one.
 *
 * ── WHAT THE TRM IS ─────────────────────────────────────────────────────────────────────────
 * The `tasa representativa del mercado` is the official COP/USD rate. The Superintendencia
 * Financiera de Colombia calculates it from the day's interbank spot transactions and certifies
 * it; it is the rate Colombian law points at for converting dollar obligations. It is not a
 * broker's quote and not a mid-market estimate — it is THE number, and using it means the peso
 * price on a listing is a fact rather than an opinion.
 *
 * ── ONE ROW IS NOT ONE DAY ──────────────────────────────────────────────────────────────────
 * This is the trap, and it is the reason for the query below. The dataset publishes a row per
 * CERTIFICATION, with `vigenciadesde` and `vigenciahasta` marking the span it is in force for. A
 * rate certified on a Friday stays valid through the weekend, and a holiday stretches it further —
 * the 7 Aug 2026 row runs four days, through Monday the 10th, because the 7th is Batalla de
 * Boyacá. Fetching "the most recent row" happens to work; fetching "the row where
 * `vigenciadesde` equals today" returns NOTHING on roughly 40% of days, and a naive caller then
 * shows no price at all. So we ask the range question, which is the question the data is shaped to
 * answer, and only fall back to "latest" if that comes up empty.
 *
 * "Today" is computed in America/Bogota, not in the browser's zone. A tenant browsing from Miami
 * at 11pm is already on tomorrow's date in UTC, and tomorrow's TRM does not exist yet.
 *
 * ── WHY A LISTING STILL STORES A RATE ───────────────────────────────────────────────────────
 * It stores the rate it was PUBLISHED at, plus the timestamp — not so the price can drift, but so
 * a listing from March can be read honestly in August. What changes is where the number comes
 * from: the app fetches it, the agent never types it, and the listing says which day's official
 * rate it is showing. Display is COP, the charge is USD, and the listing says both.
 */

const SOCRATA = "https://www.datos.gov.co/resource/32sa-8pi3.json";

export type Trm = {
  /** Pesos per US dollar. */
  rate: number;
  /** The day the certification takes effect (YYYY-MM-DD). */
  from: string;
  /** The last day it is in force (YYYY-MM-DD). Often not the same as `from`. */
  until: string;
  /** Where it came from — shown to the user so the number is attributable. */
  source: "superfinanciera";
};

/** Today's date in Bogotá, as YYYY-MM-DD. Colombia has no daylight saving, but the browser does. */
export function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/* One fetch per session, shared by every screen that shows a price. The rate changes once a day;
   re-asking on every card render would be a request per listing. */
let inflight: Promise<Trm | null> | null = null;
let cached: { at: string; value: Trm } | null = null;

const CACHE_KEY = "ow-trm-v1";

function readStored(day: string): Trm | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { at: string; value: Trm };
    return p?.at === day && p.value?.rate > 0 ? p.value : null;
  } catch { return null; }
}

/**
 * The official rate in force today, or null if it cannot be reached.
 *
 * NULL IS A REAL ANSWER AND CALLERS MUST HANDLE IT. When the rate is unavailable the correct
 * behaviour is to show the USD price alone — never to fall back to a guessed rate, because a
 * silently-guessed peso price is exactly the deception this module exists to prevent.
 */
export async function fetchTrm(): Promise<Trm | null> {
  const day = bogotaToday();
  if (cached?.at === day) return cached.value;
  const stored = readStored(day);
  if (stored) { cached = { at: day, value: stored }; return stored; }
  if (inflight) return inflight;

  inflight = (async () => {
    const keep = (t: Trm) => {
      cached = { at: day, value: t };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cached)); } catch { /* private mode */ }
      return t;
    };
    const parse = (r: any): Trm | null => {
      const rate = Number(r?.valor);
      if (!Number.isFinite(rate) || rate <= 0) return null;
      return {
        rate,
        from: String(r.vigenciadesde ?? "").slice(0, 10),
        until: String(r.vigenciahasta ?? r.vigenciadesde ?? "").slice(0, 10),
        source: "superfinanciera",
      };
    };
    try {
      /* The range question. `$where` is SoQL; the timestamps are floating, so a plain date
         literal compares correctly against them. */
      const where = encodeURIComponent(
        `vigenciadesde <= '${day}T00:00:00.000' AND vigenciahasta >= '${day}T00:00:00.000'`);
      const r = await fetch(`${SOCRATA}?$where=${where}&$limit=1`);
      if (r.ok) {
        const rows = await r.json();
        const t = Array.isArray(rows) && rows[0] ? parse(rows[0]) : null;
        if (t) return keep(t);
      }
      /* Fallback: the newest row. Reached when the range query finds nothing — a publishing gap,
         or a clock far enough off that today is outside every span. Still an official figure,
         just possibly a day stale, and `until` tells the caller so. */
      const r2 = await fetch(`${SOCRATA}?$order=vigenciadesde DESC&$limit=1`);
      if (!r2.ok) return null;
      const rows2 = await r2.json();
      const t2 = Array.isArray(rows2) && rows2[0] ? parse(rows2[0]) : null;
      return t2 ? keep(t2) : null;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Format pesos the way Colombia writes them: thousands with dots, no decimals. */
export function fmtCop(usd: number, rate: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", currencyDisplay: "code", maximumFractionDigits: 0,
  }).format(Math.round(usd * rate));
}
