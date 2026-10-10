/* ── A RIDE'S PRICE, IN THE READER'S MONEY ──────────────────────────────────────────────────
   Lee, 9 Oct 2026: "show it in the currency based on the flag at the top … a driver with a US flag
   sees dollars, the passenger in Colombia sees pesos." A ride is charged in ONE currency (the
   rider's choice when they ask). Everyone else sees that price in their own currency first, with
   the real charge underneath — the shell's rule for every price: the reader's currency, and the
   real one beside it. Conversion uses the official TRM for pesos and the shell's rate table for
   everything else; if a rate is missing, only the real price is shown (never a guessed one). */
import { useEffect, useState } from "react";
import { useViewerCcy, drawPriceDisplay, fetchTrm, fmtMoney, useI18n, W } from "@oneworld/shell";

let trmMemo: number | null = null;
function useTrmRate(): number | null {
  const [r, setR] = useState<number | null>(trmMemo);
  useEffect(() => {
    if (trmMemo) return;
    let alive = true;
    fetchTrm().then(t => { const v = (t as { rate?: number } | null)?.rate ?? null; if (v) trmMemo = v; if (alive) setR(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return r;
}

/** Ride amount → USD (the shell's pivot), or null when the peso rate is unknown. */
function toUsd(amount: number, currency: string, trm: number | null): number | null {
  if (currency === "USD") return amount;
  if (currency === "COP") return trm ? amount / trm : null;
  return null;
}

/** "≈ 11 dollars" under a price in another currency; nothing when the reader already uses it. */
export function RideMoneyHint({ amount, currency, className = "" }: { amount: number; currency: string; className?: string }) {
  const { lang } = useI18n();
  const [viewer] = useViewerCcy();
  const trm = useTrmRate();
  if (!amount || viewer === currency) return null;
  const usd = toUsd(amount, currency, trm);
  if (usd == null) return null;
  const d = drawPriceDisplay(usd, viewer, trm);
  if (d.currency === currency) return null;
  return <p className={`text-[12px] font-semibold tabular-nums opacity-60 ${className}`}>≈ {d.text} {W(lang, "in your currency", "en su moneda")}</p>;
}

/** The headline form: the reader's currency first, the real charge beside it. */
export function useRideMoney() {
  const [viewer] = useViewerCcy();
  const trm = useTrmRate();
  return (amount: number | null, currency: string) => {
    if (amount == null) return "";
    const real = fmtMoney(amount, currency, { cents: false });
    if (viewer === currency) return real;
    const usd = toUsd(amount, currency, trm);
    if (usd == null) return real;
    const d = drawPriceDisplay(usd, viewer, trm);
    /* "$9 (30.000 COP)": both currencies use "$", so the real one carries its code. */
    return d.currency === currency ? real : `${d.text} (${real.replace(/^\$\s?/, "")} ${currency})`;
  };
}
