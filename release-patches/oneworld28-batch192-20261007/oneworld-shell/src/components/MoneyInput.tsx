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
export function moneyDigits(raw: string, currency: string, cents = true, prev = ""): string {
  const dec = cents ? (DECIMALS[currency] ?? 2) : 0;
  /* One separator survives, and it is always a full stop in the STORED value regardless of what
     the person typed — a Colombian typing "180.000" means thousands, and a decimal comma has to
     become a point before `Number()` sees it. */
  let v = raw.replace(/[^\d.,]/g, "");
  if (dec === 0) {
    /* Whole units only, but someone may still type or paste the cents: "3.590.000,50" pesos or
       "380000.50" dollars. A final locale decimal mark followed by one or two digits is the cents
       — drop them, never glue them on (that read 3.590.000,50 as 359,000,050). */
    const mark = currency === "COP" ? "," : ".";
    const at = v.lastIndexOf(mark);
    if (at >= 0 && /^\d{1,2}$/.test(v.slice(at + 1))) v = v.slice(0, at);
    return v.replace(/[.,]/g, "");
  }
  const cut = Math.max(v.lastIndexOf("."), v.lastIndexOf(","));
  if (cut < 0) return v;
  /* ⚠️ "$380,000" COULD NOT BE TYPED — Lee, 2 Oct 2026, screenshot of "$ 3.59" on a house.
     The rule used to be "whichever separator appears LAST is the decimal mark". But this field
     formats as you type, so after "3590" the box shows "3,590", and the NEXT digit arrives as
     "3,5900" — whose last separator is the grouping comma this component drew itself. It was
     read as a decimal, cut to two places, and every price stalled at 3.59.
     A separator is grouping when three or more digits follow it, when the same mark appears more
     than once ("3.590.000"), or — in dollars — when it is a comma, which is never a decimal mark
     in en-US. Only what is left can be a decimal. */
  const sep = v[cut];
  const after = v.slice(cut + 1).replace(/\D/g, "");
  const repeated = v.split(sep).length - 1 > 1;
  /* Typing past the cents: "1,900.50" + "5" arrives as "1,900.505". Three digits after the point
     looked like grouping and the amount became 1,900,505. When the value ALREADY had a decimal
     part, that point is the decimal mark — keep two places and drop the extra digit. */
  if (prev.includes(".") && sep === "." && !repeated) {
    const whole = v.slice(0, cut).replace(/\D/g, "");
    return `${whole}.${after.slice(0, dec)}`;
  }
  if (after.length >= 3 || repeated || (sep === "," && currency === "USD")) return v.replace(/\D/g, "");
  const whole = v.slice(0, cut).replace(/\D/g, "");
  return after ? `${whole}.${after.slice(0, dec)}` : `${whole}.`;
}

export function fmtMoney(n: number, currency = "USD", opts?: { cents?: boolean }): string {
  const dec = opts?.cents === false ? 0 : (DECIMALS[currency] ?? 2);
  return new Intl.NumberFormat(LOCALE[currency] ?? "en-US", {
    style: "currency", currency,
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function MoneyInput({
  value, onChange, currency = "USD", placeholder, ariaLabel, className = "", cents = true,
}: {
  /** A plain digit string, e.g. `"180000"` or `"180000.50"`. Never formatted. */
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** false → whole units only. A house, a rent or a deposit is never priced in cents, and a
   *  cents slot is one more way for a slip of the thumb to turn 380,000 into 380.00. */
  cents?: boolean;
}) {
  const shown = useMemo(() => {
    if (!value) return "";
    /* A trailing separator has to survive the round trip or the decimal point disappears from
       under the caret the instant it is typed. */
    const trailing = value.endsWith(".") ? (currency === "COP" ? "" : ".") : "";
    const n = Number(value.replace(/\.$/, "") || 0);
    const dec = cents && value.includes(".") && !value.endsWith(".")
      ? Math.min((value.split(".")[1] ?? "").length, DECIMALS[currency] ?? 2)
      : 0;
    return new Intl.NumberFormat(LOCALE[currency] ?? "en-US", {
      minimumFractionDigits: dec, maximumFractionDigits: dec,
    }).format(n) + trailing;
  }, [value, currency, cents]);

  return (
    <div className={`relative ${className}`}>
      {/* The symbol is drawn beside the field rather than inside the value, so it can never be
          selected, deleted, or accidentally sent to the server as part of the number. */}
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold opacity-45">
        {currency === "COP" ? "$" : "$"}
      </span>
      <input
        className="input h-12 w-full pl-8"
        inputMode={cents ? "decimal" : "numeric"}
        value={shown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={e => onChange(moneyDigits(e.target.value, currency, cents, value))}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-wide opacity-35">
        {currency}
      </span>
    </div>
  );
}
