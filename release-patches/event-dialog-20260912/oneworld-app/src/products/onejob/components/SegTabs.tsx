import { useEffect, useRef, useState } from "react";

/**
 * THE segmented control. One look, everywhere.
 *
 * Lee, Jul 31 2026: "any buttons that slide... they should all look the same. Like, why have some
 * buttons look different than the others? The ones you have on create a contract, those are the
 * right way for them to look."
 *
 * He's right, and the inconsistency was real: One-time / Recurring on the contract form was a
 * frosted pill with a brand-coloured indicator that glides between options, while Hire / Find work / My
 * jobs — a control people hit far more often — was three flat boxes with a border swap. Same
 * gesture, same job, two visual languages, on screens one tap apart. That's the kind of thing that
 * makes an app feel assembled rather than designed.
 *
 * This is the contract-form control generalised to N options and pulled out so there is exactly one
 * implementation to change next time.
 *
 * The indicator is MEASURED from the live DOM rather than computed as `100/count %`. Options here
 * carry real words of different lengths ("Hire" vs "Find work"), and equal-width thirds would leave
 * the pill floating off-centre under the short ones. Measuring also survives font loading and
 * rotation, which is why it re-runs on resize and on fonts.ready.
 */
export default function SegTabs<T extends string>({
  value,
  options,
  onChange,
  className = "",
  size = "md",
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  /** `sm` for dense contexts; `md` matches the contract form. */
  size?: "sm" | "md";
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLButtonElement>("button[data-on='1']");
      if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    (document as any).fonts?.ready?.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [value, options.length]);

  const pad = size === "sm" ? "px-3 py-2 text-[12.5px]" : "px-4 py-2.5 text-[13px]";

  return (
    <div
      ref={wrap}
      role="tablist"
      className={`relative flex rounded-full p-1 ${className}`}
      style={{
        background: "var(--glass-fill)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "var(--frost)",
        WebkitBackdropFilter: "var(--frost)",
        boxShadow: "var(--frostedge)",
      }}
    >
      {/* Rendered only once measured, so it never flashes at the wrong width on first paint. */}
      {ind && (
        <span
          aria-hidden
          className="oj-seg-ind absolute bottom-1 top-1 left-0 rounded-full"
          style={{
            transform: `translateX(${ind.left}px)`,
            width: ind.width,
            /* Mid stop at 28%, not 55%. The label spans roughly the middle half of the pill, and
               at 55% the top of the type sat on #139553 — white on that is 3.85:1 and FAILS AA.
               Pulling the midpoint up puts the whole label past #0E8248 (4.64:1 at its top edge).
               #17A45C keeps only the first quarter, where nothing is written. GREEN_MIGRATION §1. */
            background: "linear-gradient(160deg, #17A45C 0%, #0E8248 28%, #0B6539 100%)",
            boxShadow: "0 8px 18px -8px rgba(14,130,72,.9), inset 0 1px 0 rgba(255,255,255,.32)",
          }}
        />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            data-on={on ? "1" : "0"}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex-1 whitespace-nowrap rounded-full font-extrabold transition-colors ${pad} ${
              on ? "text-white" : "opacity-60"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
