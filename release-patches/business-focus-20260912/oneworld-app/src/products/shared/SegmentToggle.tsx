import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productHref, W } from "@oneworld/shell";

/**
 * ONE HOME — the two segments, on both feeds.
 *
 * Lee, 10 Aug 2026: *"out of One Home there'll be two segments — properties for sale and for
 * rent… two buckets, for sale and for rent."*
 *
 * One Home is a BRAND, not a route. Renting and buying are two products in the shell because
 * they need different hues, different footers and — the real reason — different money: a rental
 * moves rent and a deposit through us, and a sale never moves the purchase price at all. This
 * strip is what makes them feel like one place anyway, and it is the same component on both
 * feeds so the two halves can never drift apart.
 */
export default function SegmentToggle({ current, lang, context = "feed" }: {
  current: "rent" | "sale"; lang: string; context?: "feed" | "manage";
}) {
  const nav = useNavigate();
  const [selected, setSelected] = useState(current);
  useEffect(() => setSelected(current), [current]);
  const opts = [
    { key: "rent" as const, to: productHref("onerental", context === "manage" ? "/list" : ""), en: context === "manage" ? "Renting" : "For rent", es: context === "manage" ? "Arrendando" : "En arriendo" },
    { key: "sale" as const, to: productHref("onesale", context === "manage" ? "/list" : ""), en: context === "manage" ? "Selling" : "For sale", es: context === "manage" ? "Vendiendo" : "En venta" },
  ];
  const choose = (key: "rent" | "sale", to: string) => {
    if (key === selected) return;
    setSelected(key);
    window.setTimeout(() => nav(to), 170);
  };
  return (
    <div className="relative grid grid-cols-2 rounded-full border border-ink/10 bg-ink/[0.06] p-1 dark:border-white/10 dark:bg-white/[0.08]" role="tablist" aria-label="One Home">
      <span aria-hidden className={`pointer-events-none absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-ink shadow-md transition-transform duration-200 ease-out dark:bg-white ${selected === "sale" ? "translate-x-full" : "translate-x-0"}`} />
      {opts.map(o => {
        const on = o.key === selected;
        return (
          <button type="button" key={o.key} onClick={() => choose(o.key, o.to)} role="tab" aria-selected={on}
            className={`ow-tap relative z-10 rounded-full px-3 py-2.5 text-center text-[13px] font-bold transition-colors duration-200 ${on ? "text-paper dark:text-ink" : "opacity-65"}`}>
            {W(lang, o.en, o.es)}
          </button>
        );
      })}
    </div>
  );
}
