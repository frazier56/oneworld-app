import type { ReactNode } from "react";
import { W, WA, type Localized } from "@oneworld/shell";

/**
 * LISTING STEPS — the step rail and step panels both listing forms use (15 Oct 2026).
 * ============================================================================================
 * The rent form has been a step wizard since September; the sale form was one long page. PUB30's
 * 15 Oct brief: *"make it a real step wizard — location first, photos/videos second… Back/Next keep
 * every entry, selection and media order; no remount, no new draft ids."* Same experience, same
 * code: both forms now draw the rail and the panels from here.
 *
 *  - `StepPanel` HIDES a step, it never unmounts it. Every input, chip, media order and pending
 *    upload on a step you left is still mounted when you come back — that is what keeps Back/Next
 *    lossless and the draft id stable.
 *  - `StepRail` is the "Step n of N" line plus one dot per step. Each dot is a 44 px tap target
 *    (the visible bar is 6 px; the button around it is not). Dots past `reachable` are drawn faint
 *    and marked aria-disabled — the parent's `onStep` sends a forward jump to the step that is
 *    actually stopping you.
 */

/* Assembled at render time, so they are templates — "Step 3 of 5" cannot be keyed by its English. */
export const STEP_OF: Localized = {
  en: "Step {n} of {total}", es: "Paso {n} de {total}", co: "Paso {n} de {total}",
  de: "Schritt {n} von {total}", pt: "Etapa {n} de {total}",
  ru: "Шаг {n} из {total}", zh: "第 {n} 步，共 {total} 步",
};
export const NEXT_STEP: Localized = {
  en: "Next: {step}", es: "Siguiente: {step}", co: "Siguiente: {step}",
  de: "Weiter: {step}", pt: "Próximo: {step}",
  ru: "Далее: {step}", zh: "下一步：{step}",
};

export function StepPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <div hidden={!active} data-step-panel={active ? "active" : "hidden"}>{children}</div>;
}

export function StepRail<K extends string>({ lang, steps, titles, step, reachable, onStep }: {
  lang: string;
  steps: readonly K[];
  /** [English, Spanish] per step — read aloud on each dot. */
  titles: Record<K, [string, string]>;
  step: K;
  /** Index of the furthest step earned so far. */
  reachable: number;
  onStep: (next: K) => void;
}) {
  const es = lang === "es" || lang === "co";
  const index = steps.indexOf(step);
  return (
    <nav aria-label={W(lang, "Listing steps", "Pasos del anuncio")} className="mt-3" data-step={step}>
      <p className="text-[14px] font-black leading-snug">
        {WA(lang, STEP_OF).replace("{n}", String(index + 1)).replace("{total}", String(steps.length))}
      </p>
      {/* The negative margins keep the rail where the 6 px bars always sat; only the tap area grew. */}
      <ol className="-mb-[19px] -mt-[11px] flex gap-1.5" role="list">
        {steps.map((item, itemIndex) => (
          <li key={item} className="min-w-0 flex-1">
            <button type="button" onClick={() => onStep(item)}
              aria-current={item === step ? "step" : undefined}
              aria-label={titles[item][es ? 1 : 0]}
              aria-disabled={itemIndex > Math.max(index, reachable) ? true : undefined}
              className="flex h-11 w-full items-center">
              <span aria-hidden className={`block h-1.5 w-full rounded-full transition ${
                itemIndex <= index ? "bg-ink/70 dark:bg-white/70"
                : itemIndex <= reachable ? "bg-ink/30 dark:bg-white/30"
                : "bg-ink/10 dark:bg-white/10"}`} />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
