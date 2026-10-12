/**
 * Supported ticket currencies. Symbol-first display.
 * Stripe-supported and common international choices.
 */
export interface CurrencyOption {
  code: string;   // ISO 4217 (e.g. "USD")
  symbol: string; // Display symbol (e.g. "$")
  name: string;   // Human label (e.g. "US Dollar")
  flag: string;   // Emoji flag for selector
  locale: string; // Preferred formatting locale
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", locale: "en-US" },
  { code: "COP", symbol: "$", name: "Colombian Peso", flag: "🇨🇴", locale: "es-CO" },
  { code: "MXN", symbol: "$", name: "Mexican Peso", flag: "🇲🇽", locale: "es-MX" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", locale: "de-DE" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵", locale: "ja-JP" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧", locale: "en-GB" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar", flag: "🇨🇦", locale: "en-CA" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷", locale: "pt-BR" },
  { code: "AUD", symbol: "$", name: "Australian Dollar", flag: "🇦🇺", locale: "en-AU" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", locale: "en-IN" },
];

export const TOP_CURRENCIES = CURRENCIES.slice(0, 5);

export function getCurrency(code: string | null | undefined): CurrencyOption {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function currencySymbol(code: string | null | undefined): string {
  return getCurrency(code).symbol;
}

export function formatCurrencyAmount(amount: number, code: string | null | undefined): string {
  const currency = getCurrency(code);
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.code === "JPY" ? 0 : 2,
      maximumFractionDigits: currency.code === "JPY" ? 0 : 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency.symbol}${(Number.isFinite(amount) ? amount : 0).toLocaleString()} ${currency.code}`;
  }
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return Number.NaN;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const decimalIndex = Math.max(lastDot, lastComma);
  if (decimalIndex >= 0 && cleaned.length - decimalIndex - 1 <= 2) {
    const whole = cleaned.slice(0, decimalIndex).replace(/[^0-9-]/g, "");
    const cents = cleaned.slice(decimalIndex + 1).replace(/[^0-9]/g, "");
    return Number(`${whole || "0"}.${cents.padEnd(2, "0")}`);
  }
  return Number(cleaned.replace(/[^0-9-]/g, ""));
}
