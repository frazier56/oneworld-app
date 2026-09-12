import { useI18n, W } from "../lib/i18n";

/**
 * SIMILAR UNITS IN THE AREA — announced, not faked.
 * ============================================================================================
 * Lee, 12 Aug 2026:
 *
 *   *"If someone clicked on a property, they should not only see similar properties, but they
 *   should also see the history of that property… And if it's not ready, put an honest coming
 *   soon on it."*
 *
 * ── WHY THIS IS A NOTICE AND NOT A ROW OF CARDS ─────────────────────────────────────────────
 * "Similar" is a claim. Every portal that shows a comparables strip is asserting that these four
 * places are the right yardstick for the one you are looking at, and the assertion is what the
 * reader uses to decide whether the asking price is reasonable. Filling the strip today would
 * mean picking on the only axes currently trustworthy at volume — same city, roughly the same
 * bedroom count — and Medellín prices vary by a factor of five across neighbourhoods that share a
 * comuna. A strip built on that would not be a weak feature; it would be a confidently wrong one,
 * on the single screen where OneHome's whole pitch is that its numbers are recorded rather than
 * guessed.
 *
 * So it says what it will be and when it can be true. Two things have to land first, and both are
 * real work rather than a switch:
 *
 *   1. **Neighbourhood as a first-class field**, resolved through Places rather than typed, so
 *      "El Poblado" and "Poblado" and "el poblado" are one place. Free text cannot be compared.
 *   2. **Area, honestly.** m² is optional on both forms today, and price-per-m² across listings
 *      that mostly lack it is arithmetic on a sample that selected itself.
 *
 * ── THE HONEST-STAMP RULE ───────────────────────────────────────────────────────────────────
 * A "coming soon" that never names what is missing is decoration. This one states the two
 * blockers in the reader's language, so a lister reading it learns that filling in the
 * neighbourhood and the area is what makes it work — which is the cheapest way to get the data
 * the feature needs.
 */
export default function SimilarUnits({
  neighbourhood, city, lang: langProp,
}: {
  neighbourhood?: string | null;
  city?: string | null;
  lang?: string;
}) {
  const i18n = useI18n();
  const lang = langProp ?? i18n.lang;
  /* Name the actual place when the listing has one — "in El Poblado" is a promise about
     somewhere real; "in the area" is a placeholder that reads as unfinished copy. */
  const where = (neighbourhood || city || "").trim();

  return (
    <section className="ow-form-sec">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {where
            ? W(lang, `Similar units in ${where}`, `Inmuebles similares en ${where}`)
            : W(lang, "Similar units in the area", "Inmuebles similares en la zona")}
        </h3>
        <span className="rounded-full border border-white/45 bg-white/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-ink/60 shadow-sm backdrop-blur-xl dark:border-white/20 dark:bg-white/[0.08] dark:text-white/65">
          {W(lang, "Coming soon", "Muy pronto")}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed opacity-55">
        {W(lang,
          "Not ready, and we would rather say so than show you four places that aren't actually comparable. Prices in Medellín swing by several times over across neighbourhoods that sit side by side, so a comparison is only worth reading once neighbourhoods are matched exactly and the area in m² is on enough listings to divide by.",
          "Aún no está listo, y preferimos decirlo antes que mostrarle cuatro inmuebles que en realidad no son comparables. Los precios en Medellín varían varias veces entre barrios vecinos, así que una comparación solo sirve cuando los barrios coinciden exactamente y el área en m² está en suficientes anuncios como para dividir por ella.")}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed opacity-40">
        {W(lang,
          "Listing a place? Filling in the neighbourhood and the size in m² is what brings this on.",
          "¿Va a publicar un inmueble? Completar el barrio y el área en m² es lo que activa esto.")}
      </p>
    </section>
  );
}
