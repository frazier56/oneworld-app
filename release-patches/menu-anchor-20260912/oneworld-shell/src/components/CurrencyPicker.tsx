import { useEffect, useState } from "react";
import { useI18n, W } from "../lib/i18n";
import { fetchTrm, type Trm } from "../lib/trm";
import { useViewerCcy, type ViewerCcy } from "../lib/viewerCurrency";

/**
 * THE READER'S CURRENCY SWITCH, AND THE "i" THAT EXPLAINS THE RATE.
 * ============================================================================================
 * Lee, 12 Aug 2026, two asks that belong on one control:
 *
 *   *"The person looking at it should be able to choose what currency they want to see it in."*
 *   *"Put a little i beside the conversion so they can hover or tap it and see where the rate
 *   came from. People need to know we didn't just make the rate up."*
 *
 * ── WHY THE "i" MATTERS MORE THAN IT LOOKS ──────────────────────────────────────────────────
 * A converted price is a claim about money, and the reader has no way to check it. Colombian
 * portals routinely quote a "dollar price" at whatever rate the agent felt like, which is exactly
 * the deception Lee named on 11 Aug: *"we can't allow the user to input the conversion because it
 * could be wrong, and that could be very deceptive."* The number this app uses is the TRM — the
 * official rate certified daily by the Superintendencia Financiera — and saying so, with the date
 * it took effect and the figure itself, is the difference between a converted price and a
 * trustworthy one.
 *
 * So the note states all four things: what the rate is called, who certifies it, the exact figure,
 * and the day it is in force from. Not "approximate conversion".
 *
 * ── TAP, NOT HOVER ──────────────────────────────────────────────────────────────────────────
 * He said "hover or tap", and on the phone this product is used on there is no hover. It is a
 * button that opens a paragraph in place, which also means it is reachable by keyboard and read
 * aloud by a screen reader — a `title` attribute is none of those things.
 */
export default function CurrencyPicker({
  compact = false, className = "",
}: {
  /** Just the two chips, no label and no note — for a feed row where space is the constraint. */
  compact?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();
  const [ccy, setCcy] = useViewerCcy();
  const [trm, setTrm] = useState<Trm | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { void fetchTrm().then(setTrm); }, []);

  const chips = (
    <div className="flex overflow-hidden rounded-xl border border-ink/12 dark:border-white/15">
      {(["USD", "COP"] as ViewerCcy[]).map(c => (
        <button key={c} type="button" onClick={() => setCcy(c)}
          aria-pressed={ccy === c}
          className={`ow-tap px-3 py-1.5 text-[12px] font-black transition ${
            ccy === c ? "ow-ink-sel" : "opacity-55"}`}>
          {c}
        </button>
      ))}
    </div>
  );

  if (compact) return <div className={className}>{chips}</div>;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-bold">
          {W(lang, "Show prices in", "Ver precios en")}
          {/* The "i". Only offered once there is a real rate to explain. */}
          {trm && (
            <button type="button" onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-label={W(lang, "Where this rate comes from", "De dónde viene esta tasa")}
              className="ow-tap grid h-5 w-5 place-items-center rounded-full border border-ink/25 text-[10px] font-black leading-none opacity-60 dark:border-white/30">
              i
            </button>
          )}
        </span>
        {chips}
      </div>

      {open && trm && (
        <p className="mt-2 rounded-xl bg-ink/[0.05] p-2.5 text-[11.5px] leading-relaxed opacity-70 dark:bg-white/[0.07]">
          {W(lang,
            `Pesos are converted at the TRM — Colombia's official representative market rate, certified by the Superintendencia Financiera. Today's rate, in force from ${trm.from}, is ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(trm.rate)} COP to one US dollar. Nobody on this platform can set or edit it.`,
            `Los pesos se convierten a la TRM — la tasa representativa del mercado, certificada por la Superintendencia Financiera. La tasa vigente desde ${trm.from} es ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(trm.rate)} COP por dólar. Nadie en esta plataforma puede fijarla ni editarla.`)}
        </p>
      )}

      {!trm && ccy === "COP" && (
        <p className="mt-2 text-[11.5px] font-semibold leading-snug text-amber-600 dark:text-amber-400">
          {W(lang,
            "Waiting for today's official rate — prices stay in dollars until it loads rather than being converted at a guess.",
            "Esperando la TRM oficial de hoy — los precios siguen en dólares hasta que cargue, en vez de convertirse a una tasa inventada.")}
        </p>
      )}
    </div>
  );
}
