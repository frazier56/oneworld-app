import { useMemo, useState } from "react";
import { nightsIn, takenNights, type Booked, type Day } from "../lib/stay";

/**
 * WHICH NIGHTS ARE FREE, AND PICK YOURS — reservation tasks 1 and 2
 * ============================================================================================
 * The whole gap between "a listing you look at" and "a listing you can book" is this control.
 *
 * ── TAKEN MEANS THE NIGHT, NOT THE DAY ──────────────────────────────────────────────────────
 * A departure day is bookable: the last guest leaves in the morning and the next arrives in the
 * afternoon. Greying out the checkout day loses a sellable night on every reservation in the
 * calendar, and because it looks tidy nobody ever reports it as a bug. `takenNights` is the
 * single source of that truth and it excludes the end date.
 *
 * ── THIS IS A VIEW, NEVER THE GUARD ─────────────────────────────────────────────────────────
 * Overlap is refused by the database — an exclusion constraint on the booking table and another
 * on the hold table. A check written here loses every race it is ever in, and the second booking
 * of a popular week is exactly a race. This control exists so the guest is not offered something
 * that will fail, not to make it fail.
 *
 * ── PICKING ─────────────────────────────────────────────────────────────────────────────────
 * First tap sets arrival. Second tap sets departure. Tapping earlier than the arrival restarts
 * from there rather than showing an error, because that is what the person meant. A range that
 * would jump over a taken night is refused on the second tap — that is the one case where a
 * silent restart would be wrong, so it says so.
 */

type Props = {
  booked: Booked[];
  /** what is picked now, if anything */
  value: { start: Day | null; end: Day | null };
  onChange: (v: { start: Day | null; end: Day | null }) => void;
  /** how many months to show. Two on a phone is enough to span a normal trip. */
  months?: number;
  /** nothing before today is bookable */
  today?: Day;
  lang?: "en" | "es";
  minNights?: number | null;
};

const MONTH: Record<"en" | "es", string[]> = {
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
};
/* Monday first. Colombia, like most of Latin America and Europe, reads a week that way. */
const DOW: Record<"en" | "es", string[]> = {
  en: ["M","T","W","T","F","S","S"],
  es: ["L","M","M","J","V","S","D"],
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AvailabilityCalendar({
  booked, value, onChange, months = 2, today, lang = "en", minNights,
}: Props) {
  const from = today ?? iso(new Date());
  const taken = useMemo(() => takenNights(booked), [booked]);
  const [cursor, setCursor] = useState(() => { const d = new Date(from + "T00:00:00Z"); d.setUTCDate(1); return d; });
  const [msg, setMsg] = useState<string | null>(null);

  const grids = useMemo(() => Array.from({ length: months }, (_, i) => {
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + i, 1));
    const lead = (first.getUTCDay() + 6) % 7;                 // Monday-first offset
    const len = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return {
      label: `${MONTH[lang][first.getUTCMonth()]} ${first.getUTCFullYear()}`,
      cells: [...Array(lead).fill(null),
              ...Array.from({ length: len }, (_, d) => iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), d + 1))))],
    };
  }), [cursor, months, lang]);

  const inRange = (d: Day) =>
    !!value.start && !!value.end && d >= value.start && d < value.end;

  function tap(d: Day) {
    setMsg(null);
    if (d < from || taken.has(d)) return;

    /* no selection, or restarting */
    if (!value.start || value.end || d <= value.start) { onChange({ start: d, end: null }); return; }

    /* Second tap names the DEPARTURE date itself. The old code added one day here even though
       the screen explicitly asked for a checkout date. A guest tapping 5 October therefore saw
       6 October and paid for an extra night. All stay ranges are already half-open, so the
       tapped departure date is the correct exclusive end without any adjustment. */
    const end = d;
    const nights = nightsIn(value.start, end);
    if (nights.some(n => taken.has(n))) {
      setMsg(lang === "es"
        ? "Hay noches ocupadas en ese rango. Elija otra fecha de salida."
        : "There are booked nights in that range. Pick another checkout date.");
      return;
    }
    if (minNights && nights.length < minNights) {
      setMsg(lang === "es"
        ? `La estadía mínima es de ${minNights} noches.`
        : `The minimum stay is ${minNights} nights.`);
      return;
    }
    onChange({ start: value.start, end });
  }

  /* ── v71 · SWIPE BETWEEN MONTHS ──────────────────────────────────────────────────────────
     On a phone the first thing anybody tries on a calendar is a swipe. The arrows stay; this is
     an addition, not a replacement.

     ⚠️ `touch-action: pan-y` and a 48px threshold, together, are what stop this hijacking the
     page. Without the first, a vertical scroll that drifts sideways starts changing months;
     without the second, so does a slightly untidy tap. And the backward bound is the SAME
     expression the previous-month button is disabled by, so the gesture cannot walk somewhere
     the button refuses to go. */
  const owSwipeMonth = (() => {
    let x0 = 0, y0 = 0, live = false;
    const MIN = 48;
    return {
      onPointerDown: (e: React.PointerEvent) => { x0 = e.clientX; y0 = e.clientY; live = true; },
      onPointerUp: (e: React.PointerEvent) => {
        if (!live) return;
        live = false;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (Math.abs(dx) < MIN || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx > 0) {
          if (iso(cursor) <= from.slice(0, 8) + "01") return;   /* same bound as the ‹ button */
          setCursor(c => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() - 1, 1)));
        } else {
          setCursor(c => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1)));
        }
      },
      onPointerCancel: () => { live = false; },
    };
  })();

  return (
    /* Keep the seven-day grid comfortably inside narrow phone sheets. The old 40px cells used
       280px before the sheet's own padding, leaving almost no breathing room on a 320px screen.
       Desktop keeps the original full-width rhythm; phones get a centered 320px ceiling and
       slightly smaller cells without shrinking the labelled tap targets below 36px. */
    <div className="ow-cal mx-auto w-full max-w-[294px] sm:max-w-none"
         style={{ touchAction: "pan-y" }} {...owSwipeMonth}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label={lang === "es" ? "Mes anterior" : "Previous month"}
          className="ow-tap grid h-10 w-10 place-items-center rounded-xl text-[18px] disabled:opacity-30"
          disabled={iso(cursor) <= from.slice(0, 8) + "01"}
          onClick={() => setCursor(c => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() - 1, 1)))}>‹</button>
        <p className="text-[13.5px] font-bold">{grids[0].label}</p>
        <button type="button" aria-label={lang === "es" ? "Mes siguiente" : "Next month"}
          className="ow-tap grid h-10 w-10 place-items-center rounded-xl text-[18px]"
          onClick={() => setCursor(c => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1)))}>›</button>
      </div>

      {grids.map((g, gi) => (
        <div key={g.label} className={gi ? "mt-5" : ""}>
          {gi > 0 && <p className="mb-2 text-center text-[13.5px] font-bold">{g.label}</p>}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {DOW[lang].map((d, i) => (
              <span key={i} className="pb-1 text-[10.5px] font-bold uppercase opacity-45">{d}</span>))}
            {g.cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const past = d < from, isTaken = taken.has(d);
              const isStart = d === value.start;
              const isEnd = !!value.end && d === value.end;
              const mid = inRange(d) && !isStart && !isEnd;
              const dead = past || isTaken;
              return (
                <button key={d} type="button" onClick={() => tap(d)} disabled={dead}
                  aria-label={d} aria-pressed={isStart || isEnd || mid}
                  className={[
                    "ow-tap relative mx-auto grid h-9 w-9 place-items-center rounded-xl text-[13px] font-semibold transition sm:h-10 sm:w-10",
                    dead ? "cursor-not-allowed opacity-25" : "",
                    /* a booked night gets a line through it — greying alone reads the same as
                       "in the past", and those are different things to a guest */
                    isTaken && !past ? "line-through decoration-[1.5px]" : "",
                    isStart || isEnd ? "bg-brand text-white" : "",
                    mid ? "bg-brand/15" : "",
                  ].join(" ")}>
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {msg && <p className="mt-3 rounded-xl bg-brand/10 p-2.5 text-center text-[12px] leading-snug">{msg}</p>}
      {value.start && !value.end && (
        <p className="mt-3 text-center text-[12px] opacity-60">
          {lang === "es" ? "Ahora elija la fecha de salida" : "Now pick your checkout date"}
        </p>
      )}
    </div>
  );
}
