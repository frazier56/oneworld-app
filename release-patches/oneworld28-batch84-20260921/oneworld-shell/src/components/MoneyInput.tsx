import { useMemo } from "react";

/**
 * MONEYINPUT — a price field that looks like a price while you are typing it.
 * ============================================================================================
 * Lee, 12 Aug 2026:
 *
 *   *"Every time you have a price option, you gotta format it properly. Right now you have the
 *   asking price in US dollars, but you don't format the price. We don't know where the comma is
 *   gonna go — you don't have commas, you don't have dollars and cents. We need periods and
 *   commas and formatting and a dollar sign, so it looks fine."*
 *
 * He is describing `180000` sitting in a box, which is a number nobody can read at a glance and
 * which is one fat-fingered zero away from being off by a factor of ten. On a listing where the
 * asking price is the single most consequential field on the screen, that is worth solving
 * properly rather than formatting it only after it is saved.
 *
 * ── THE RULE: FORMAT THE VIEW, NEVER THE VALUE ──────────────────────────────────────────────
 * The caller's state stays a plain digit string — `"180000"` — exactly as it was before this
 * component existed, so every `Number(price)` downstream keeps working and nothing has to learn
 * to strip separators back out. Only what is PAINTED carries the grouping. A component that
 * writes "180,000" into the caller's state is a component that eventually posts a comma to the
 * database.
 *
 * ── COLOMBIAN AND US CONVENTIONS ARE MIRROR IMAGES, AND THAT MATTERS HERE ───────────────────
 * `es-CO` groups thousands with a FULL STOP and marks decimals with a COMMA — 180.000,50 — which
 * is the exact opposite of `en-US`. A Colombian agent typing pesos and a foreign buyer reading
 * dollars are both right and they disagree, so the grouping follows the CURRENCY rather than the
 * app's language. Pesos also carry no cents in practice; dollars do.
 */

const LOCALE: Record<string, string> = { USD: "en-US", COP: "es-CO" };
const DECIMALS: Record<string, number> = { USD: 2, COP: 0 };

/** The digits the caller keeps. Everything else is presentation. */
export function moneyDigits(raw: string, currency: string): string {
  const dec = DECIMALS[currency] ?? 2;
  /* One separator survives, and it is always a full stop in the STORED value regardless of what
     the person typed — a Colombian typing "180.000" means thousands, and a decimal comma has to
     become a point before `Number()` sees it. */
  let v = raw.replace(/[^\d.,]/g, "");
  if (dec === 0) return v.replace(/[.,]/g, "");
  /* Treat whichever separator appears LAST as the decimal mark; the rest are grouping. */
  const lastDot = v.lastIndexOf("."), lastComma = v.lastIndexOf(",");
  const cut = Math.max(lastDot, lastComma);
  if (cut < 0) return v.replace(/\D/g, "");
  const whole = v.slice(0, cut).replace(/\D/g, "");
  const frac = v.slice(cut + 1).replace(/\D/g, "").slice(0, dec);
  return frac ? `${whole}.${frac}` : `${whole}.`;
}

/** `1234.5` → `$1,234.50` (USD) or `$ 1.235` (COP). Exported — panels and cards use it too. */
export function fmtMoney(n: number, currency = "USD", opts?: { cents?: boolean }): string {
  const dec = opts?.cents === false ? 0 : (DECIMALS[currency] ?? 2);
  return new Intl.NumberFormat(LOCALE[currency] ?? "en-US", {
    style: "currency", currency,
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function MoneyInput({
  value, onChange, currency = "USD", placeholder, ariaLabel, className = "",
}: {
  /** A plain digit string, e.g. `"180000"` or `"180000.50"`. Never formatted. */
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const shown = useMemo(() => {
    if (!value) return "";
    /* A trailing separator has to survive the round trip or the decimal point disappears from
       under the caret the instant it is typed. */
    const trailing = value.endsWith(".") ? (currency === "COP" ? "" : ".") : "";
    const n = Number(value.replace(/\.$/, "") || 0);
    const dec = value.includes(".") && !value.endsWith(".")
      ? Math.min((value.split(".")[1] ?? "").length, DECIMALS[currency] ?? 2)
      : 0;
    return new Intl.NumberFormat(LOCALE[currency] ?? "en-US", {
      minimumFractionDigits: dec, maximumFractionDigits: dec,
    }).format(n) + trailing;
  }, [value, currency]);

  return (
    <div className={`relative ${className}`}>
      {/* The symbol is drawn beside the field rather than inside the value, so it can never be
          selected, deleted, or accidentally sent to the server as part of the number. */}
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold opacity-45">
        {currency === "COP" ? "$" : "$"}
      </span>
      <input
        className="input h-12 w-full pl-8"
        inputMode="decimal"
        value={shown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={e => onChange(moneyDigits(e.target.value, currency))}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-wide opacity-35">
        {currency}
      </span>
    </div>
  );
}
