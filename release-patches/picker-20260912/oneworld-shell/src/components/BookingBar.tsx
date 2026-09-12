import { useEffect, useMemo, useState } from "react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import { quote, nightsBetween, type StayRules, type Booked } from "../lib/stay";
import { W } from "../lib/i18n";

/**
 * THE BAR THAT NEVER SCROLLS AWAY — pattern one from the Airbnb audit, 14 Aug 2026
 * ============================================================================================
 * Lee, after twenty-one Airbnb screenshots: *"we wanna make sure the experience is intuitive and
 * familiar… let's take advantage of their iterations instead of starting from scratch."*
 *
 * ── WHAT WAS ACTUALLY WRONG ─────────────────────────────────────────────────────────────────
 * The reservation engine has been finished for a day and a half. `stay.ts` prices a stay with
 * seasonal and weekend uplift, weekly and monthly discounts, and refuses ranges that overlap a
 * booking. `AvailabilityCalendar` draws two months with the booked nights struck through.
 * `booking.ts` holds the cancellation policies. Every one of those passes its harness.
 *
 * **Nothing in the product imported any of it.** A person on a listing could send a message and
 * do nothing else. There was no price for their dates, because there were no dates.
 *
 * This component is the missing mount. It is deliberately ONE file rather than three, because the
 * bar, the calendar and the price breakdown are a single conversation — *when are you coming, and
 * what does that cost* — and splitting them across files is how the sticky bar ends up showing a
 * different number from the sheet it opens.
 *
 * ── WHY THE BAR IS PINNED ───────────────────────────────────────────────────────────────────
 * Every Airbnb screen where a decision is possible has the decision pinned to the bottom of the
 * phone: price on the left, action on the right, never scrolling. The rule underneath it is that
 * a reader can stop reading at any point and still act. Our listing page had the opposite shape —
 * the only thing you could do was at the bottom, after the prose.
 *
 * ── THE NUMBER IS LIVE, AND IT IS ARITHMETIC ────────────────────────────────────────────────
 * Two more of their patterns, and both are cheap because `quote()` already returns the working:
 *   · the total updates as the dates are picked, rather than after
 *   · the breakdown shows nights × rate, then each discount NAMED and in green as a negative,
 *     then the total — because a subtraction you can see beats a smaller number you cannot
 *
 * ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────────────────────
 * It does not take money. `onReserve` hands the chosen range and the quote back to the product,
 * and the product decides what happens next — today that is the request-to-book row, and once
 * Stripe exists it is a payment. Keeping the money out of here is what lets the same bar serve a
 * long lease, where the money leg is a different shape entirely.
 */

export type BookingBarProps = {
  lang: string;
  /** What a night costs, plus seasons, weekend uplift, discounts and any minimum stay. */
  rules: StayRules;
  /** Nights already taken. Half-open: `ends_on` is a departure day and is bookable. */
  booked?: Booked[];
  /** How the headline price reads when no dates are chosen yet — "$1,200 / month". */
  restingLabel: string;
  /** Draw an amount the way this listing draws money (currency, rate, separators). */
  money: (n: number) => string;
  /** One sentence of cancellation policy, shown inside the price box — never a link. */
  cancelLine?: string;
  /** Fired when the reader commits. The product owns everything after this. */
  onReserve: (r: { starts_on: string; ends_on: string; total: number; nights: number }) => void;
  /** Instant book, or a request the host has to answer. Changes the verb, nothing else. */
  mode?: "instant" | "request";
  busy?: boolean;
  /** Explicit existing-stay exception supplied by the property screen. */
  earliestSelectableDate?: string;
  existingStayNote?: string;
};

export default function BookingBar({
  lang, rules, booked = [], restingLabel, money, cancelLine, onReserve,
  mode = "request", busy = false, earliestSelectableDate, existingStayNote,
}: BookingBarProps) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const q = useMemo(() => quote(start, end, rules, booked), [start, end, rules, booked]);
  const ready = q.reason == null && q.total > 0;
  const nights = start && end ? nightsBetween(start, end) : 0;

  /* A sheet that scrolls the page behind it is a sheet people close by accident. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Escape closes it. Cheap, and the thing a keyboard user reaches for first. */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  /* The refusals a reader will actually hit, in their words rather than the engine's. */
  const refusal = !q.reason ? null : {
    "no-dates":    W(lang, "Pick your dates", "Elija sus fechas"),
    "backwards":   W(lang, "Those dates are the wrong way round", "Esas fechas están al revés"),
    "too-short":   W(lang, `${rules.minNights ?? 0} nights minimum`, `Mínimo ${rules.minNights ?? 0} noches`),
    "unavailable": W(lang, "Some of those nights are taken", "Algunas de esas noches están ocupadas"),
  }[q.reason] ?? null;

  const verb = mode === "instant"
    ? W(lang, "Reserve", "Reservar")
    : W(lang, "Request to book", "Solicitar reserva");

  const dateLine = start && end
    ? `${fmt(start, lang)} – ${fmt(end, lang)}`
    : W(lang, "Add dates", "Agregar fechas");

  return (
    <>
      {/* ── THE PINNED BAR ───────────────────────────────────────────────────────────────────
             `sticky` rather than `fixed`: fixed elements on iOS fight the address bar as it
             collapses, and a booking bar that jitters while you scroll reads as broken. It sits
             above the tab bar, so `bottom` is offset by the same variable the tabs use. */}
      <div
        className="ow-bookbar sticky bottom-[calc(var(--ow-tabs,0px)+env(safe-area-inset-bottom))] z-30
                   -mx-4 mt-6 border-t border-ink/10 bg-[var(--ow-paper,#fff)]/92 px-4 py-3
                   backdrop-blur-xl dark:border-white/12 dark:bg-[var(--ow-paper,#0B0F1A)]/92">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {ready ? (
              <>
                <p className="truncate text-[17px] font-black tracking-tight tabular-nums">
                  {money(q.total)}
                </p>
                <p className="truncate text-[11.5px] font-semibold opacity-55">
                  {nights} {W(lang, nights === 1 ? "night" : "nights", nights === 1 ? "noche" : "noches")}
                  {" · "}{dateLine}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-[17px] font-black tracking-tight">{restingLabel}</p>
                <button type="button" onClick={() => setOpen(true)}
                  className="truncate text-[11.5px] font-bold underline underline-offset-2 opacity-60">
                  {dateLine}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 whitespace-nowrap px-5"
            disabled={busy}
            /* Close the sheet on the way out. Found by the harness, 14 Aug: with the sheet open
               the bar is still behind it and still live, so pressing the bar committed the
               booking and left the sheet sitting on top of a page that had already moved on. */
            onClick={() => {
              if (!ready) { setOpen(true); return; }
              setOpen(false);
              onReserve({ starts_on: start!, ends_on: end!, total: q.total, nights });
            }}
          >
            {busy ? "…" : ready ? verb : W(lang, "Check dates", "Ver fechas")}
          </button>
        </div>
      </div>

      {/* ── THE SHEET ────────────────────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45"
             onClick={() => setOpen(false)}>
          <div
            className="ow-booksheet max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[var(--ow-paper,#fff)]
                       px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 dark:bg-[var(--ow-paper,#0B0F1A)]"
            role="dialog" aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/20 dark:bg-white/25" />

            {/* Airbnb's heading is the NIGHTS COUNT, not the dates — because the number of nights
                is the thing people get wrong, and we compute it and were throwing it away. */}
            <div className="flex items-baseline justify-between">
              <h2 className="text-[20px] font-black tracking-tight">
                {nights > 0
                  ? `${nights} ${W(lang, nights === 1 ? "night" : "nights", nights === 1 ? "noche" : "noches")}`
                  : W(lang, "Pick your dates", "Elija sus fechas")}
              </h2>
              {(start || end) && (
                <button type="button" onClick={() => { setStart(null); setEnd(null); }}
                  className="text-[13px] font-bold underline underline-offset-2 opacity-65">
                  {W(lang, "Clear", "Borrar")}
                </button>
              )}
            </div>
            {start && end && (
              <p className="mt-0.5 text-[13px] opacity-60">{dateLine}</p>
            )}

            <div className="mt-3">
              {existingStayNote && <p className="mb-3 rounded-xl bg-teal/10 p-3 text-sm">
                {existingStayNote}
              </p>}
              <AvailabilityCalendar
                today={earliestSelectableDate}
                lang={lang === "es" ? "es" : "en"}
                booked={booked}
                minNights={rules.minNights}
                value={{ start, end }}
                onChange={v => { setStart(v.start); setEnd(v.end); }}
              />
            </div>

            {/* ── THE PRICE AS ARITHMETIC ──────────────────────────────────────────────────
                   Never one number. Nights × rate, then every discount NAMED and drawn as a
                   green negative, then the total. `quote()` already returns all of it. */}
            {ready && (
              <section className="card mt-4 space-y-2 p-4">
                <Row
                  k={`${nights} ${W(lang, nights === 1 ? "night" : "nights", nights === 1 ? "noche" : "noches")} × ${money(rules.base)}`}
                  v={money(q.subtotal)} />

                {q.discountPct > 0 && (
                  <Row
                    k={discountName(lang, nights)}
                    v={`−${money(q.discount)}`}
                    green />
                )}

                {/* Their move, and a good one: the platform's contribution stated as a line, so
                    the reader can see whose side we are on. Ours is the absence of a deposit. */}
                <Row k={W(lang, "Security deposit", "Depósito")}
                     v={W(lang, "None", "Ninguno")} green />

                <div className="!mt-3 border-t border-ink/10 pt-3 dark:border-white/12">
                  <Row k={W(lang, "Total", "Total")} v={money(q.total)} bold />
                </div>

                {cancelLine && (
                  <p className="!mt-3 text-[11.5px] leading-relaxed opacity-60">{cancelLine}</p>
                )}
              </section>
            )}

            {refusal && start && (
              <p className="mt-3 text-center text-[13px] font-bold opacity-65">{refusal}</p>
            )}

            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={!ready || busy}
              onClick={() => { setOpen(false); onReserve({ starts_on: start!, ends_on: end!, total: q.total, nights }); }}
            >
              {ready ? `${verb} · ${money(q.total)}` : W(lang, "Pick your dates", "Elija sus fechas")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────────────────────────── */

function Row({ k, v, green, bold }: { k: string; v: string; green?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-[14px] ${bold ? "font-black" : "opacity-75"}`}>{k}</span>
      <span className={[
        "whitespace-nowrap text-[14px] tabular-nums",
        bold ? "font-black" : "font-bold",
        green ? "text-emerald-600 dark:text-emerald-400" : "",
      ].join(" ")}>{v}</span>
    </div>
  );
}

/** Name the discount rather than printing "discount" — the engine knows which rule fired. */
function discountName(lang: string, nights: number) {
  if (nights >= 28) return W(lang, "Monthly stay discount", "Descuento por mes");
  return W(lang, "Weekly stay discount", "Descuento por semana");
}

function fmt(d: string, lang: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(
    lang === "en" ? "en-US" : "es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
}
