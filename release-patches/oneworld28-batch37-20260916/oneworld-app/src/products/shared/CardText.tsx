import { W } from "@oneworld/shell";

/**
 * THE TEXT AT THE BOTTOM OF EVERY PROPERTY TILE — RENT AND SALE, ONE COMPONENT.
 * ============================================================================================
 * Lee, 16 Sep 2026, after finding rent and sale had drifted apart again: *"What I'm saying to you
 * needs to be consistent, 100% consistent across sales and rentals. I don't know why you're
 * having a difficult time with that."*
 *
 * Fair. The reason is that there were TWO card layouts in two files, and every instruction had to
 * be applied twice by hand — so each round one of them got missed. Last batch it was rent. The
 * batch before, sale. A rule that has to be obeyed in two places is a rule that will be broken.
 *
 * So there is now one component and the feeds hand it values. Consistency stops being something
 * anybody has to remember.
 *
 * THE LAYOUT, and the reasoning Lee gave for each part:
 *   LEFT  — what this is, and where.
 *     · Line one: BEDS · BATHS · SIZE. *"People care about the bedroom, bathroom and the square
 *       meters first."* Right: those three are what somebody filters on in their head.
 *     · Line two: TYPE · FURNISHED. Still useful, but it is the qualifier, not the headline.
 *     · Line three: the place.
 *   RIGHT — what it costs.
 *     · The price in the reader's own currency, then the local equivalent underneath.
 *
 * ⚠️ THE PLACE WRAPS INTELLIGENTLY, WHICH IS NOT THE SAME AS "wraps". Lee: *"Try to keep the city
 * on the same row, keep the state on the same row. But if you can put them on the same row
 * together, then do it. Just separate it by a comma."*
 *
 * So: both on one line when they fit, and when they do not, the CITY keeps line one and only the
 * region drops. That is what `whitespace-nowrap` on the city plus a normal-wrapping region buys —
 * the break can only ever happen at the comma, never in the middle of a place name. A plain
 * `truncate` gave "Poblado del Sur, Santa…" and a plain wrap could split "Santa Rosa de Osos"
 * anywhere it liked.
 */
export function CardText({ beds, type, where, priceMain, priceAlt, onDark = false, extra }: {
  /** Line one: the three numbers, already joined. */
  beds: string;
  /** Line two: kind and furnished, already joined. */
  type: string;
  /** "City, Region" — the country is dropped by the callers; it is never news. */
  where?: string | null;
  priceMain: string;
  /** The approximate amount in the other currency. Omitted when there is nothing to convert. */
  priceAlt?: string | null;
  /** True on a photo scrim, where the muted ink of the light theme is unreadable. */
  onDark?: boolean;
  /** A status pill, e.g. sale's "Under offer". Sits under the price. */
  extra?: React.ReactNode;
}) {
  const cut = (where ?? "").lastIndexOf(",");
  const city = where ? (cut === -1 ? where : where.slice(0, cut)) : "";
  const region = where && cut !== -1 ? where.slice(cut + 1).trim() : "";

  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[14px] font-black leading-snug">{beds}</p>
        {type && <p className="text-[12.5px] font-semibold leading-snug opacity-85">{type}</p>}
        {city && (
          <p className={`mt-0.5 text-[12px] font-semibold leading-tight ${onDark ? "opacity-90" : "opacity-70"}`}>
            <span className="whitespace-nowrap">{city}</span>
            {region && <>, <span>{region}</span></>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end text-right">
        <p className="text-[15px] font-black leading-snug tracking-tight">{priceMain}</p>
        {priceAlt && <p className="mt-0.5 text-[11px] leading-none opacity-75">{priceAlt}</p>}
        {extra}
      </div>
    </div>
  );
}

/**
 * The two attribute lines, from one listing, in Lee's order.
 *
 * ⚠️ `listingFacts` returns them in a single canonical order — kind, beds, baths, size, furnished
 * — and this SPLITS that, rather than re-deriving anything. One definition of the words and the
 * units (including m² versus square feet), two ways of arranging them.
 */
export function factLines(facts: string[], kindLabel: string | null, lang: string): { beds: string; type: string } {
  const rest = facts.filter(f => f !== kindLabel);
  const furnished = rest.find(f => f === W(lang, "Furnished", "Amoblado") || f === W(lang, "Unfurnished", "Sin amoblar")) ?? null;
  const numbers = rest.filter(f => f !== furnished);
  return {
    beds: numbers.join(" · "),
    type: [kindLabel, furnished].filter(Boolean).join(" · "),
  };
}
