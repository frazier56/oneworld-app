/* ── − PRICE + ──────────────────────────────────────────────────────────────────────────────
   Lee, 9 Oct 2026: "let's say it comes in at $30. They can just click plus, plus, plus … $2.50
   would be pretty good. You hit it twice, that's $5 more."
   One tap = 2.50 dollars or 2,000 pesos (fare.ts). The number itself stays typeable for anyone
   who wants an exact figure.
   UAT 12 Oct: the box showed whole units only, so $8 + one tap painted "11" while the ride would
   have been sent at 10.50. Dollars show cents; pesos still show none (MoneyInput's own rule). */
import { MoneyInput, useI18n, W } from "@oneworld/shell";
import { fareStep } from "../lib/fare";

export default function PriceStepper({ value, onChange, currency, ariaLabel, min = 0 }: {
  value: string; onChange: (v: string) => void; currency: string; ariaLabel: string; min?: number;
}) {
  const { lang } = useI18n();
  const step = fareStep(currency);
  const n = Number(value) || 0;
  /* 10.5 → "10.50": a dollar amount with cents always shows both digits. Whole amounts stay whole. */
  const set = (x: number) => { const v = Number(Math.max(min, x).toFixed(2)); onChange(Number.isInteger(v) ? String(v) : v.toFixed(2)); };
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => set(n - step)} disabled={n - step < Math.max(min, step)}
          aria-label={W(lang, "Lower the price", "Bajar el precio")}
          className="ow-tap ow-edge grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-[22px] font-bold leading-none disabled:opacity-35">−</button>
        <MoneyInput value={value} onChange={onChange} currency={currency} ariaLabel={ariaLabel}
          className="min-w-0 flex-1 text-center text-base font-bold" />
        <button type="button" onClick={() => set(n + step)}
          aria-label={W(lang, "Raise the price", "Subir el precio")}
          className="ow-tap ow-edge grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-[22px] font-bold leading-none">+</button>
      </div>
    </div>
  );
}
