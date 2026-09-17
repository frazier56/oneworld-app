import { useEffect } from "react";
import { X, Check, AlertTriangle } from "lucide-react";
import { D } from "../lib/detailCopy";
import { stayFactRows, type StayFacts } from "../lib/stayFacts";
import { requestSteps, type RequestState } from "../lib/requestSteps";
import { ownerTermLines } from "../lib/monthly";
import type { Property } from "../lib/rental";

/**
 * YOUR REQUEST — a pill on the page, everything else behind a tap.
 * ============================================================================================
 * Lee, 17 September 2026: *"it really needs to be in a pop-up box. That's the main thing… that
 * way it doesn't take up all this damn room on the screen unnecessarily."* And: *"it needs to be
 * in a little pane, a little bubble or a little pill… similar to the same pill that you have for
 * the header and the footer."*
 *
 * The listing keeps being a listing. The request is one line at the top of it — the same frosted
 * pill shape as the chrome — and the whole of it opens when you want it.
 *
 * ⚠️ WHAT WAS WRONG BEFORE: the card said the dates and the money in its own header, and then a
 * panel underneath said the dates and the money AGAIN under the heading "What you asked for".
 * Lee: *"you literally duplicate it."* There is now ONE place the facts live, inside the sheet.
 */
export function RequestPill({ lang, onOpen }: { lang: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen}
      /* ⚠️ NOT `ow-reveal has-glass`. Those are the CHROME classes — the header and footer — and
         they carry fixed positioning, so the pill detached from the page and sat on top of the
         logo bar as a floating white blob. It is the pill SHAPE Lee asked for, not the pill's
         position: a full-width rounded row that scrolls with the listing like everything else. */
      className="ow-tap mb-4 flex w-full items-center justify-between gap-3 rounded-full border border-brand/30 bg-brand/[0.10] px-4 py-3 text-left backdrop-blur-sm">
      <span className="min-w-0 truncate text-[13px] font-black text-brand-deep dark:text-brand-light">
        {D(lang, "yourRequest")}
      </span>
      <span className="shrink-0 whitespace-nowrap text-[12px] font-bold opacity-65">
        {D(lang, "tapToView")}
      </span>
    </button>
  );
}

export default function RequestPanel({
  lang, facts, request, money, property, when, onClose, children,
}: {
  lang: string;
  facts: StayFacts;
  request: RequestState;
  money: (n: number) => string;
  property?: Pick<Property, "owner_terms_enabled" | "lease_notice_days" | "payment_window_business_days" | "breach_penalty_months"> | null;
  /** Date formatter owned by the caller, so one screen cannot spell a date two ways. */
  when: (iso: string) => string;
  onClose: () => void;
  /** The actions that belong to this request — declare payment, upload ID, authorize a card. */
  children?: React.ReactNode;
}) {
  /* A sheet that scrolls the page behind it is a sheet people close by accident. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const rows = stayFactRows(facts, lang, money);
  const steps = requestSteps(request, lang, when);
  const terms = ownerTermLines(property);
  let n = 0;   // only the things somebody still has to DO are numbered

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="ow-request-title">
      <button type="button" aria-label={D(lang, "close")} className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative z-10 max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/35 bg-white/95 p-5 shadow-2xl dark:border-white/15 dark:bg-slate-950/95 sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <h2 id="ow-request-title" className="text-xl font-black">{D(lang, "yourRequest")}</h2>
          <button type="button" onClick={onClose} aria-label={D(lang, "close")}
            className="ow-tap grid h-10 w-10 shrink-0 place-items-center rounded-full"><X size={20} /></button>
        </div>

        {/* THE FACTS — once, and only here. */}
        <dl className="mt-4 space-y-1.5 rounded-2xl border border-ink/10 bg-white/55 p-4 dark:border-white/10 dark:bg-white/5">
          {rows.map(r => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <dt className="font-bold opacity-65">{r.label}</dt>
              <dd className="text-right font-bold">{r.value}</dd>
            </div>
          ))}
          {facts.cleaning_fee != null && Number(facts.cleaning_fee) > 0 && (
            <p className="pt-1 text-[11px] opacity-55">{D(lang, "cleaningToHost")}</p>
          )}
        </dl>

        <h3 className="mt-5 text-[13px] font-black">{D(lang, "whatHappensNow")}</h3>
        <ol className="mt-2 space-y-2.5">
          {steps.map((s, i) => {
            if (s.kind === "warn") {
              return (
                <li key={i} className="flex gap-2.5 text-[13px] font-bold leading-relaxed text-red-600 dark:text-red-400">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">{s.text}</span>
                </li>
              );
            }
            if (s.kind === "done") {
              return (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed opacity-60">
                  <span aria-label={D(lang, "alreadyDone")}
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="min-w-0">{s.text}</span>
                </li>
              );
            }
            n += 1;
            return (
              <li key={i} className="flex gap-2.5 text-[13px] font-semibold leading-relaxed">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-black text-white">{n}</span>
                <span className="min-w-0">{s.text}</span>
              </li>
            );
          })}
        </ol>

        {terms.length > 0 && (
          <div className="mt-5 border-t border-ink/10 pt-4 dark:border-white/10">
            <h3 className="text-[12.5px] font-black">{D(lang, "hostTerms")}</h3>
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

        {children}

        {/* The footnote goes LAST, under the actions. It used to sit between the numbered step and
            the payment instructions, which is the one position in a list a reader cannot skip. */}
        <p className="mt-4 text-[11.5px] leading-relaxed opacity-55">{D(lang, "requestInChat")}</p>

        <button type="button" onClick={onClose} className="btn-primary mt-5 w-full">{D(lang, "okGotIt")}</button>
      </section>
    </div>
  );
}
