import { D } from "../lib/detailCopy";
import { stayFactRows, type StayFacts } from "../lib/stayFacts";
import { ownerTermLines } from "../lib/monthly";
import type { Property } from "../lib/rental";

/**
 * THE SIX FACTS, RENDERED — and the host's own terms under them.
 * ============================================================================================
 * The same component in the request sheet, on the request card and on the host's review screen,
 * so a number can never read one way before you send it and another way afterwards.
 */
export default function StayFactsTable({
  lang, facts, money, property, heading,
}: {
  lang: string;
  facts: StayFacts;
  money: (n: number) => string;
  /** Optional. Supplying it adds the host's own terms below the facts, when the host set any. */
  property?: Pick<Property, "owner_terms_enabled" | "lease_notice_days" | "payment_window_business_days" | "breach_penalty_months"> | null;
  heading?: string;
}) {
  const rows = stayFactRows(facts, lang, money);
  const terms = ownerTermLines(property);
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/55 p-4 dark:border-white/10 dark:bg-white/5">
      <h3 className="text-[13px] font-black">{heading ?? D(lang, "askedFor")}</h3>
      <dl className="mt-2 space-y-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <dt className="font-bold opacity-65">{r.label}</dt>
            <dd className={`text-right font-bold ${r.muted ? "opacity-45" : ""}`}>{r.value}</dd>
          </div>
        ))}
      </dl>

      {terms.length > 0 && (
        <div className="mt-3 border-t border-ink/10 pt-3 dark:border-white/10">
          <h4 className="text-[12.5px] font-black">{D(lang, "hostTerms")}</h4>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed opacity-75">
            {terms.map(t => (
              <li key={t.key}>
                {t.key === "notice" && D(lang, "termNotice", { n: t.n })}
                {t.key === "payWindow" && D(lang, "termPayWindow", { n: t.n })}
                {t.key === "breach" && D(lang, t.n === 1 ? "termBreach" : "termBreachPl", { n: t.n })}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] opacity-55">{D(lang, "termsFromHost")}</p>
        </div>
      )}
    </div>
  );
}
