import { selectedCoLeaseSections, fillSegments, missingTemplateKeys, type CoSection } from "../lib/coTemplate";

/**
 * THE FILLED CONTRACT, ON SCREEN, WITH EVERY VALUE IN BLUE.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"when they see the form, they'll see everything populated in, like, blue
 * text, so they can review everything and then send it."*
 *
 * Two properties this component exists to guarantee:
 *
 *   1. WHAT IS STILL BLANK IS AS LOUD AS WHAT IS FILLED. An unfilled placeholder renders as
 *      `____` in an amber, dashed-underlined style, and the count of them is reported to the
 *      caller so the send button can refuse. Lee's own signed Medellín lease contains a blank
 *      that was never filled — *"conforme al acta de entrega que se firma el día ____"* — and
 *      it survived to signature because on paper it looked like the rest of the page. On this
 *      screen it cannot.
 *
 *   2. NOTHING IS RENDERED AS HTML. `fillSegments` returns data; React renders it. A manager
 *      who types a tag into a field has typed a string.
 */
export function countBlanks(
  sections: CoSection[], lang: "en" | "es",
  values: Record<string, string | number | null | undefined>,
): number {
  return missingTemplateKeys(sections, lang, values).length;
}

export default function LeasePreview({ lang, values, addendumKeys, includeShortStayDeposit = true, onBlankClick }: {
  lang: "en" | "es";
  values: Record<string, string | number | null | undefined>;
  addendumKeys: string[];
  includeShortStayDeposit?: boolean;
  onBlankClick?: (key: string) => void;
}) {
  const sections = selectedCoLeaseSections(addendumKeys, includeShortStayDeposit);
  return (
    <div className="max-h-[520px] overflow-auto rounded-xl border border-ink/10 bg-paper p-4 dark:border-white/12 dark:bg-white/[0.03]">
      {sections.map((s, i) => (
        <Section key={s.key} n={i + 1} s={s} lang={lang} values={values} onBlankClick={onBlankClick} />
      ))}
    </div>
  );
}

function Section({ n, s, lang, values, onBlankClick }: {
  n: number; s: CoSection; lang: "en" | "es";
  values: Record<string, string | number | null | undefined>;
  onBlankClick?: (key: string) => void;
}) {
  return (
    <section className="mb-4">
      <h3 className="text-[12.5px] font-black uppercase tracking-wide opacity-70">
        {n}. {s.heading[lang]}
      </h3>
      <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed opacity-90">
        {fillSegments(s.body[lang], values).map((g, i) =>
          g.kind === "text" ? <span key={i}>{g.value}</span>
          : g.kind === "filled"
            ? <span key={i} className="font-bold text-brand">{g.value}</span>
            /* A blank is not quietly grey. It is the one thing on this page that must be
               noticed, so it is amber and underlined — the same treatment a missing required
               field gets anywhere else in the family. */
            : <button key={i} type="button" onClick={() => g.key && onBlankClick?.(g.key)}
                aria-label={g.key ? `${lang === "es" ? "Completar" : "Complete"} ${g.key}` : undefined}
                className="rounded px-0.5 font-bold text-amber-700 underline decoration-dashed underline-offset-2 hover:bg-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-amber-300">
                {g.value}
              </button>,
        )}
      </p>
    </section>
  );
}
