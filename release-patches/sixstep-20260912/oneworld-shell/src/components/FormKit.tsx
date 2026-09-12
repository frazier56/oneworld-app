import { useEffect, useRef, useState } from "react";
import InfoDot from "./InfoDot";
import { IconCheck } from "./ActionIcons";

/**
 * THE FORM KIT — one implementation of every control a One World form is built from.
 * ============================================================================================
 * Lee, 11 Aug 2026, briefing the OneHome listing form:
 *
 *   "We have a very good form for OneJob. If you wanna see a good form, that is a good form…
 *    I would recommend you use the job creation form as your basis. Almost like take the code,
 *    copy that code, start from there… That thing took a while to make sure we got it perfectly
 *    right. One thing we always wanna do is be consistent where we can across the applications.
 *    So if you can copy and reuse code, that's the best — always REQUIRED. It's not just
 *    recommended. We want things to look exactly the same when, in fact, they are the same. So if
 *    we have a window for the description, that needs to be the same type of window that they see
 *    somewhere else, especially if it's the same type of thing."
 *
 * "Copy that code" is the instruction; PROMOTING it is how you actually get what he asked for.
 * A copy is identical for exactly one day — the next fix lands on one of the two and the two
 * forms drift, which is the state this kit exists to prevent. So the OneJob contract form's
 * controls move HERE, unchanged in look, and both forms import them.
 *
 * ── ONE REAL DEFECT FOUND WHILE DOING THIS ─────────────────────────────────────────────────
 * The contract form tags each of its sections with the legacy `oj-sec` class, and that class is
 * **not defined anywhere** — not in `tokens.css`, not in any product stylesheet, not in the built
 * CSS. It is a dead name. The form looks right today because the controls inside it carry their own styling,
 * but every section is relying on an accident. `FormSection` below gives it the panel it was
 * always meant to have, defined once, in the shell.
 *
 * ── THE RULE FOR ADDING TO THIS FILE ────────────────────────────────────────────────────────
 * A control belongs here when two products would otherwise each write it. A control that only
 * one product will ever have belongs in that product. When in doubt: if a member could see it on
 * two different screens and expect it to behave the same way, it is shell.
 */

/* ============================================================================================
   SECTION — the panel, its icon chip and its title.
   ============================================================================================ */

/**
 * A form section. Icon chip on the left, bold title, optional red asterisk when the section
 * contains something required.
 *
 * The look is OneJob's `SectionHead`, which Lee signed off in July ("at least 90% the same as
 * the event page") — carried over exactly rather than reinterpreted.
 *
 * `hint` sits UNDER the title, not under the section, because a hint that explains what a whole
 * group is for has to be read before the fields, not after them.
 */
export function FormSection({
  title, icon, hint, required, children, right, invalid, lang,
}: {
  title: string;
  /** v92 · only used to translate the ⓘ popup's close button. */
  lang?: string;
  /** An SVG path `d`. Kept as a path rather than a node so every chip is identical in size, */
  /** stroke and colour — passing arbitrary nodes is how icon rows start drifting. */
  icon: string;
  hint?: string;
  required?: boolean;
  right?: React.ReactNode;
  /** Something in here is still required. Paints the panel red — see `.ow-form-sec` in tokens. */
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="ow-form-sec" data-invalid={invalid ? "true" : undefined}>
      {/* ── THE ICON MOVED TO THE RIGHT (Lee, 12 Aug 2026) ────────────────────────────────
             *"You have icons on the left side of every section. They need to disappear — remove
             those icons from the left side and put them to the far right side of that particular
             row. On the left they don't do well, because it's pushing the title over, and the
             title needs to be left-justified, not the icon. The icon is in the way."*

             He is right and it is a typographic point, not a taste one. Every OTHER heading on
             every screen starts at the container's left edge; a 36px chip in front of this one
             put it 46px in, so the form's section titles were the only headings in the product
             that did not line up with anything. The chip is decoration and the title is the
             information — the information gets the margin.

             This is the X he drew through "The place" and "The bedroom & bath" on 11 Aug. */}
      <div className="mb-3.5 flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold leading-tight tracking-tight">
            {title}{required && <span className="ml-1 text-red-500">*</span>}
          </h3>
          {/* v92 · the hint is a ⓘ, not a line of prose. Lee, 17 Aug: *"anytime you have a
              description like that, just put an info button, so you don't have to put the
              text on the screen."* The sentence is unchanged — it moves into the popup. */}
          {hint && <InfoDot title={title} body={hint} lang={lang ?? "en"} className="-ml-1 align-baseline" />}
        </div>
        {right && <div className="shrink-0">{right}</div>}
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={icon} />
          </svg>
        </span>
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

/** A labelled field. `hint` explains, `error` corrects — they are never the same sentence. */
export function Field({
  label, hint, error, children, optional, lang,
}: {
  label: string; hint?: string; error?: string | null; optional?: boolean;
  /** v92 · only used to translate the ⓘ popup's close button. Optional, so every
      existing call site keeps working with no edit. */
  lang?: string;
  children: React.ReactNode;
}) {
  /* ── ⚠️ THE CONTROLS ON A ROW SIT ON ONE BASELINE, WHATEVER THE LABELS DO ────────────────
     Lee, 15 Aug 2026, photographing the for-sale form: *"the little attribute buttons aren't
     lined up."*

     `Row` is a two-column grid, and a grid ITEM stretches to the row height — so a field whose
     label wraps ("Total floors in building", "Air conditioners", "Building age (years)") grew
     taller and its stepper slid down, while its one-line neighbour's stepper stayed put. Every
     row on that screen with an uneven label pair was out of line, and each one looked like a
     separate spacing bug rather than one rule.

     `flex flex-col` plus `mt-auto` on the control block is the whole fix: the label and hint take
     the space they need at the top, and the control is pushed to the BOTTOM of whatever height
     the row settled on. Two steppers side by side now share an edge no matter how many lines
     their labels take, in every form in every product, with no per-screen spacing to maintain.

     This is the same class of defect as the rooms row in August and it was fixed there by
     reshaping one screen. Fixing it in `Field` is why it does not come back on the next one. */
  return (
    /* This cannot be a wrapping <label>. It contains an InfoDot button and, for Stepper fields,
       two more buttons. Mobile browsers forward a tap anywhere in a label to its first labelable
       descendant, which made tapping the return-day number open the information dialog. */
    <div className="flex h-full flex-col">
      {/* ── THE HINT BELONGS TO THE FIELD ABOVE IT, SO IT GOES ABOVE THE CONTROL ─────────
             Lee, 11 Aug 2026, circling "Worth answering — almost no listing does, and everybody
             wonders" and drawing an arrow UP to "Bed in the master": the hint sat under the
             dropdown, directly above the next control, so it read as an introduction to the
             walk-in-closet checkbox rather than an explanation of the bed question.

             Proximity decides ownership, and a line of text has two neighbours. Sitting it
             between the label and its own control removes the ambiguity entirely: everything
             from the label down to the control is one field, and the next label starts the next
             one. The ERROR stays below, because an error is about what you just did. */}
      <span className="label flex min-w-0 flex-col items-start gap-0.5">
        {/* v92 · the hint is a ⓘ, not a line of prose. It sits ON the label line so a long
            explanation can never wrap the field and push the row out of alignment — which is
            exactly what "Colombia's utilities band, 1 to 6." was doing under Estrato. */}
        <span className="flex min-w-0 max-w-full items-center gap-0.5">
          <span className="min-w-0 truncate">{label}</span>
          {hint && <InfoDot title={label} body={hint} lang={lang ?? "en"} />}
        </span>
        {optional && <span className="text-[10.5px] font-semibold uppercase tracking-wide opacity-40">optional</span>}
      </span>

      {/* `mt-auto` is what puts this on the row's baseline. See the note above the return. */}
      <span className="mt-auto block">{children}</span>
      {error && <span className="mt-1 block text-[11.5px] font-semibold leading-relaxed text-red-500">{error}</span>}
    </div>
  );
}

/** Two or three fields on one row. Collapses to one column under 340px, where a 3-up row stops
 *  being readable and starts being three cramped boxes. */
export function Row({ cols = 2, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={`grid gap-2.5 ${cols === 3 ? "grid-cols-3 max-[340px]:grid-cols-1" : "grid-cols-2 max-[340px]:grid-cols-1"}`}>
      {children}
    </div>
  );
}

/* ============================================================================================
   SEGMENTED CONTROL — promoted verbatim from OneJob.
   ============================================================================================ */

/**
 * THE segmented control. One look, everywhere.
 *
 * Lee, 31 Jul 2026: *"any buttons that slide… they should all look the same. Why have some
 * buttons look different than the others? The ones you have on create a contract, those are the
 * right way for them to look."*
 *
 * The indicator is MEASURED from the live DOM rather than computed as `100/count %`. Real options
 * carry words of different lengths, and equal-width thirds leave the pill floating off-centre
 * under the short ones. Measuring also survives font loading and rotation, which is why it re-runs
 * on resize and on `fonts.ready`.
 */
export function SegTabs<T extends string>({
  value, options, onChange, className = "", size = "md",
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = wrap.current;
      if (!el) return;
      const active = el.querySelector<HTMLElement>('[data-active="1"]');
      if (!active) return;
      setInd({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    (document as any).fonts?.ready?.then?.(measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, options.length]);

  const pad = size === "sm" ? "py-1.5 text-[12.5px]" : "py-2.5 text-[13.5px]";

  return (
    <div ref={wrap}
      className={`relative flex rounded-2xl border border-ink/10 bg-ink/[0.03] p-1 dark:border-white/12 dark:bg-white/[0.05] ${className}`}>
      {ind && (
        <span aria-hidden
          className="absolute top-1 bottom-1 rounded-xl bg-paper shadow-sm transition-all duration-200 dark:bg-white/12"
          style={{ left: ind.left, width: ind.width }} />
      )}
      {options.map(o => (
        <button key={o.value} type="button" data-active={o.value === value ? "1" : "0"}
          onClick={() => onChange(o.value)}
          className={`ow-tap relative z-[1] flex-1 rounded-xl px-2 font-bold transition ${pad} ${
            o.value === value ? "text-ink dark:text-white" : "opacity-55"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================================================
   CHOICE CHIPS — the control that makes a long attribute form feel like tapping, not typing.
   ============================================================================================ */

/**
 * Lee's whole brief for this form was *"click, click, click"*. A property has roughly thirty
 * attributes; asking for thirty typed answers on a phone is how a listing ends up half-filled.
 *
 * ONE choice — mutually exclusive, like a radio group but readable at a glance.
 *
 * Rendered as buttons in a wrapping row rather than a `<select>` on purpose: a dropdown hides
 * every option until it is opened, so an agent cannot see that "in-unit, two separate machines"
 * is even available. The options ARE the prompt.
 */
export function ChoiceChips<T extends string>({
  value, options, onChange, allowClear = false,
}: {
  value: T | null;
  options: { value: T; label: string; note?: string }[];
  onChange: (v: T | null) => void;
  /** Tapping the selected chip clears it. For a genuinely optional answer. */
  allowClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button"
            aria-pressed={on}
            onClick={() => onChange(on && allowClear ? null : o.value)}
            className={`ow-tap rounded-xl border px-3 py-2 text-left text-[13px] font-bold transition ${
              on
                ? "ow-ink-sel"
                : "border-ink/12 opacity-75 hover:opacity-100 dark:border-white/15"}`}>
            <span className="block">{o.label}</span>
            {o.note && <span className={`mt-0.5 block text-[10.5px] font-medium ${on ? "opacity-70" : "opacity-55"}`}>{o.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** MANY choices — the same chip, toggling in and out of a set. Used for amenities. */
export function MultiChips<T extends string>({
  values, options, onChange, cols,
}: {
  values: T[];
  options: { value: T; label: string }[];
  onChange: (v: T[]) => void;
  /** Lay the chips out in fixed columns instead of wrapping. Use for lists of 6+. */
  cols?: 2 | 3;
}) {
  /* ── COLUMNS, NOT A RAGGED WRAP (Lee, 11 Aug 2026) ────────────────────────────────────────
     *"Where you have what the building has — that's supposed to be structured a little better
     too. Right now… sometimes you got three on one row, sometimes you got two on one row. I
     think if they were in columns it would look a little bit better. Just make two columns, and
     it'll be easier for people to navigate through it."*

     He is right about the cause: `flex-wrap` packs by pixel width, so "Pool · Gym · Elevator"
     fits three and "Rooftop terrace · BBQ area" fits two, and the eye has no column to run down.
     A fixed grid gives every chip the same width and puts them on rails. Wrap is still the
     default — it is correct for a handful of short chips, where a grid would leave a lot of air
     inside each one — so a caller asks for columns when the list is long enough to need them. */
  if (cols) {
    return (
      <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map(o => {
          const on = values.includes(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on}
              onClick={() => onChange(on ? values.filter(v => v !== o.value) : [...values, o.value])}
              className={`ow-tap flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[12.5px] font-bold leading-snug transition ${
                on
                  ? "border-brand bg-brand/10 text-brand-deep dark:text-brand-light"
                  : "border-ink/12 opacity-70 hover:opacity-100 dark:border-white/15"}`}>
              <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border ${
                on ? "border-transparent bg-brand text-white" : "border-ink/25 dark:border-white/30"}`}>
                {on && <IconCheck size={10} />}
              </span>
              <span className="min-w-0 flex-1">{o.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = values.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on}
            onClick={() => onChange(on ? values.filter(v => v !== o.value) : [...values, o.value])}
            className={`ow-tap inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition ${
              on
                ? "border-brand bg-brand/10 text-brand-deep dark:text-brand-light"
                : "border-ink/12 opacity-70 hover:opacity-100 dark:border-white/15"}`}>
            <span aria-hidden className={`grid h-3.5 w-3.5 place-items-center rounded-[5px] border ${
              on ? "border-transparent bg-brand text-white" : "border-ink/25 dark:border-white/30"}`}>
              {on && <IconCheck size={9} />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================================
   STEPPER — a number you tap rather than type.
   ============================================================================================ */

/**
 * Bedrooms, bathrooms, parking spaces, air-conditioning units, floor.
 *
 * Every one of these is a small integer, and every one of them was a free-text box before. A
 * text box on a phone opens a keyboard, allows "three", allows "2.5" where only whole numbers
 * make sense, and allows blank — and a blank bedroom count is the single most common reason a
 * listing gets skipped in a search.
 *
 * `step` handles bathrooms, where half is real. `min` is 0 for things a place can genuinely have
 * none of and 1 for things it cannot.
 */
/* ============================================================================================
   STEPPER — ONE control, not three buttons that happen to be near each other.
   ============================================================================================
   Lee, 11 Aug 2026, with a screenshot of the listing form and eight red boxes drawn on it:

     *"There's no differentiation between what goes where… right now it's like a bunch of
     floating plus and minuses everywhere. So the user can tell, okay, this part goes to the air
     conditioner, this part goes to the parking spaces… I would even consider a slightly better
     way to design the plus and minus structure there. It just doesn't look good."*

   He is describing two separate faults and they need two separate fixes.

   ── FAULT 1: THE CONTROL LOOKED LIKE THREE CONTROLS ─────────────────────────────────────────
   Minus, value and plus were three separate bordered boxes with gaps between them. At a glance
   that is six independent buttons per row, and nothing said which three belonged together. It is
   ONE segmented pill now: a single border, two hairline dividers, no gaps. Gestalt does the rest
   — things inside one outline are one thing.

   ── FAULT 2: THE EMPTY VALUE WAS INVISIBLE ──────────────────────────────────────────────────
   An unset stepper drew "—" at 35% opacity, so on Lee's screenshots the middle cell reads as
   blank and the row reads as broken. The placeholder is a real dash at readable weight now, and
   it sits on a tinted cell so the value area is legibly the value area whether or not it has a
   number in it.

   The buttons stay 44px. The whole pill is 48px tall, which is what the label above it needs to
   look like a field rather than a floating pair of icons. */

/**
 * ── ⚠️ TAP MOVES BY ONE. PRESS AND HOLD ACCELERATES. 15 August 2026 ────────────────────────
 * Lee, on the square-metre field:
 *
 *   *"It goes up in increments of ten, but I wonder if we can make it so you can go up ten, but
 *   then you can go up one unit… if you go to ninety, you wanna go to ninety-one, ninety-two.
 *   One option is one increment every time you hit plus, but that'd take forever to get to a
 *   hundred and twenty — or what if it's four hundred square metres? That'd take four hundred
 *   pushes. So is there a way you can touch and hold it and it speeds up? Tap once it goes up one
 *   unit, tap and hold it goes up ten."*
 *
 * Exactly that, and it costs no pixels — the gesture carries it, so the control looks identical.
 *
 * **A TAP IS ALWAYS ONE `step`.** Fine control is the thing you cannot get any other way, and it
 * has to be the DEFAULT gesture rather than the one you discover.
 *
 * **A HOLD REPEATS, AND THE REPEAT GETS BIGGER, NOT FASTER.** The interval stays at a readable
 * 90ms throughout while the JUMP grows 1 → 5 → 10 → 25. Speeding the ticks up instead is the
 * classic mistake: the number blurs, the reader overshoots, and they cannot tell where to release.
 * Growing the jump keeps every intermediate value legible and still reaches 400 in about three
 * seconds.
 *
 * ⚠️ WHEN A HOLD IS SET UP TO STEP BY TEN — as the size field is — the FIRST tick is deliberately
 * `step`, not 1. `coarse` respects what the caller asked for; the fine control lives in the tap.
 *
 * Three details that are the difference between this working and being maddening:
 *   · `pointerdown` / `pointerup`, not mouse or touch events, so one path covers finger, mouse
 *     and pen — and `setPointerCapture` means a finger sliding off the button still ends the hold
 *     rather than leaving it running forever.
 *   · A hold that has fired even once SWALLOWS the click, or every hold would add one extra step
 *     at the end when the browser synthesises its click.
 *   · `touch-action: none` on the buttons, or a hold on a phone starts scrolling the form.
 */
export function Stepper({
  value, onChange, min = 0, max = 99, step = 1, coarse, suffix, placeholder = "—",
  editable = false, inputLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number; max?: number; step?: number;
  /** What a HOLD jumps by once it gets going. Defaults to ten times `step`, capped sensibly. */
  coarse?: number;
  suffix?: string;
  placeholder?: string;
  /** Lets somebody type an exact value without giving up the familiar minus/plus controls. */
  editable?: boolean;
  inputLabel?: string;
}) {
  const empty = value === null || Number.isNaN(value);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  /* Rounded to the tap size, not to `step`, so a hold that lands on 93 does not snap back to 90
     and make the fine control feel like it did not take. */
  const set = (n: number) => onChange(clamp(Math.round(n)));

  /* Two separate handles on purpose. `delay` is the 380ms wait before a hold starts repeating;
     `repeat` is the repeating tick. Sharing one slot means releasing during the wait clears the
     wrong thing, and the number keeps climbing after the finger is gone. */
  const delay = useRef<number | null>(null);
  const repeat = useRef<number | null>(null);
  const fired = useRef(false);
  const ticks = useRef(0);
  /* The live value, read at each tick. A closure captured at pointerdown would add the same jump
     to the same starting number sixty times and land nowhere near where the finger expected. */
  const live = useRef<number | null>(value);
  live.current = value;

  /* How far one HOLD tick travels. `coarse` is the caller's unit — ten square metres on the size
     field — and it grows to two and a half, then five times that, so four hundred is about three
     seconds away while every number in between is still readable. */
  const jump = () => {
    const big = coarse ?? step * 10;
    const n = ticks.current;
    return Math.max(1, Math.round(big * (n < 6 ? 1 : n < 18 ? 2.5 : 5)));
  };

  const stop = () => {
    if (delay.current != null) { window.clearTimeout(delay.current); delay.current = null; }
    if (repeat.current != null) { window.clearInterval(repeat.current); repeat.current = null; }
  };

  const begin = (dir: 1 | -1, e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    fired.current = false;
    ticks.current = 0;
    /* 380ms — long enough that no ordinary tap trips it, short enough that a deliberate hold
       does not feel like a dead button. */
    delay.current = window.setTimeout(() => {
      repeat.current = window.setInterval(() => {
        fired.current = true;
        const cur = live.current == null || Number.isNaN(live.current) ? min : live.current;
        onChange(clamp(Math.round(cur + dir * jump())));
        ticks.current += 1;
      }, 90);
    }, 380);
  };

  const end = (dir: 1 | -1) => {
    stop();
    /* A hold has already moved the number; letting the browser's synthetic click through as well
       would add one more step every single time somebody released. */
    if (fired.current) { fired.current = false; return; }
    set((value ?? (dir > 0 ? min - step : min)) + dir * step);
  };

  /* A component unmounted mid-hold — a section collapsing, a form closing — must not leave an
     interval running against a dead setState. */
  useEffect(() => stop, []);

  const btn = "ow-tap grid h-12 w-12 shrink-0 select-none place-items-center text-[19px] font-black leading-none disabled:opacity-25 transition";

  return (
    <div className="flex h-12 items-stretch overflow-hidden rounded-xl border border-ink/12 dark:border-white/15">
      <button type="button" aria-label="Less" disabled={!empty && value! <= min}
        style={{ touchAction: "none" }}
        onPointerDown={e => begin(-1, e)}
        onPointerUp={() => end(-1)}
        onPointerCancel={stop}
        onPointerLeave={stop}
        className={`${btn} border-r border-ink/10 hover:bg-ink/[0.04] dark:border-white/12 dark:hover:bg-white/[0.06]`}>−</button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap bg-ink/[0.025] px-2 dark:bg-white/[0.04]">
        {editable ? (
          <input
            type="number"
            inputMode="decimal"
            aria-label={inputLabel ?? "Value"}
            min={min}
            max={max}
            step={step}
            value={empty ? "" : value ?? ""}
            placeholder={placeholder}
            onChange={event => {
              if (event.target.value === "") { onChange(null); return; }
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(next);
            }}
            onBlur={() => {
              if (!empty && value != null) set(value);
            }}
            className={`min-w-0 flex-1 bg-transparent text-center font-extrabold leading-none tabular-nums outline-none ${empty ? "opacity-45" : ""}`}
            style={{ fontSize: stepperFitPx(String(empty ? placeholder ?? "" : value ?? ""), suffix) }}
          />
        ) : (
          <span
            className={`font-extrabold leading-none tabular-nums ${empty ? "opacity-45" : ""}`}
            style={{ fontSize: stepperFitPx(String(empty ? placeholder ?? "" : value ?? ""), suffix) }}>
            {empty ? placeholder : value}
          </span>
        )}
        {suffix && !empty && (
          <span className="font-semibold leading-none opacity-55"
            style={{ fontSize: stepperFitPx(String(value ?? ""), suffix) * SUFFIX_RATIO }}>{suffix}</span>
        )}
      </div>
      <button type="button" aria-label="More" disabled={!empty && value! >= max}
        style={{ touchAction: "none" }}
        onPointerDown={e => begin(1, e)}
        onPointerUp={() => end(1)}
        onPointerCancel={stop}
        onPointerLeave={stop}
        className={`${btn} border-l border-ink/10 hover:bg-ink/[0.04] dark:border-white/12 dark:hover:bg-white/[0.06]`}>+</button>
    </div>
  );
}

/* ============================================================================================
   COUNTFIELD — a stepper that owns its own box, so the label and the control are one unit.
   ============================================================================================
   This is Lee's red boxes, made real. He drew a rectangle around each label-plus-stepper pair
   and asked for exactly that:

     *"These should be individual sections or panels, so at least the user can tell — okay, this
     part goes to the air conditioner, this part goes to the parking spaces, this part goes to
     the floors… you're just putting a border around each section so it has its own space, to
     help the user understand: what does this plus go to? Did I hit the minus next to the plus?"*

   He also pre-empted the obvious objection himself — *"most times we don't need nested panels,
   but sometimes you do… it's not really even nested"* — and he is right that this is not real
   nesting. It is a fieldset: a hairline and a label, one level deep, inside a section that
   already has a heading. It costs 1px and it answers the question the form was failing to
   answer.

   ── THE SECOND THING IT FIXES, WHICH LEE DID NOT NAME ───────────────────────────────────────
   In his screenshot "Total floors in building" wraps to two lines and "Air conditioners" does
   too, which pushed those two steppers a full line lower than the ones beside them. Every row
   was a different height and no two controls shared a baseline. A bordered cell stretches to the
   tallest label in the row and pins the control to the BOTTOM of the cell, so the steppers line
   up across a row no matter how long the words above them are. */
export function CountField({
  label, optional, hint, ...stepper
}: {
  label: string;
  optional?: boolean;
  hint?: string;
} & Parameters<typeof Stepper>[0]) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-ink/[0.09] bg-ink/[0.012] p-2.5 dark:border-white/12 dark:bg-white/[0.02]">
      <div className="mb-1.5 flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="text-[13px] font-bold leading-snug">{label}</span>
        {optional && (
          <span className="shrink-0 text-[9.5px] font-black uppercase tracking-wider opacity-35">
            OPT
          </span>
        )}
      </div>
      <Stepper {...stepper} />
      {hint && <p className="mt-1.5 text-[11px] leading-snug opacity-55">{hint}</p>}
    </div>
  );
}

/* ============================================================================================
   TOGGLE — a yes/no with the consequence written next to it.
   ============================================================================================ */

export function Toggle({
  on, onChange, label, note,
}: { on: boolean; onChange: (v: boolean) => void; label: string; note?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="ow-tap flex w-full items-start gap-3 rounded-xl border border-ink/10 p-3 text-left transition hover:bg-brand/[0.04] dark:border-white/12">
      {/* Drawn, not "✓". U+2713 has no colour-emoji presentation but it IS a font glyph: its
          weight and vertical centring inside a 20px box differ per platform, and on Android it
          sat visibly high. `IconCheck` is the same tick used everywhere else in the shell. */}
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-white transition ${
        on ? "border-transparent bg-brand" : "border-ink/30 dark:border-white/30"}`}>
        {on && <IconCheck size={12} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold">{label}</span>
        {note && <span className="mt-0.5 block text-[11.5px] leading-relaxed opacity-55">{note}</span>}
      </span>
    </button>
  );
}

/* ============================================================================================
   THE STICKY FOOTER — what a long form needs and a short one does not.
   ============================================================================================ */

/**
 * A form this long scrolls well past a screen, so the primary action cannot live at the bottom of
 * the document — an agent who has filled in nine sections should not have to scroll to find out
 * what happens next, or scroll back up to see whether anything is missing.
 *
 * `hint` is where the blocking reason goes, in words. "Add a price and a title" beats a disabled
 * button with no explanation, which is the commonest way a form silently loses somebody.
 */
/* ============================================================================================
   FORMACTIONS — the end of the form, at the end of the form.
   ============================================================================================
   Lee, 12 Aug 2026:

     *"Both options have a strip at the bottom that says save or publish or preview — that's like
     a sticky strip. Take that away. You need three buttons on both. You're gonna have a Save
     draft and a Cancel button beside each other at the bottom of the form, then below that a
     larger Publish button that spans the full length horizontally. But the Save draft and the
     Cancel button will be fifty percent of the size, sitting above it. And they don't need to be
     sticky — they'll be at the bottom of the form on both forms."*

   ── WHY HE IS RIGHT, HAVING ASKED ME FOR THE OPPOSITE YESTERDAY ─────────────────────────────
   On 11 Aug he asked for this bar to be "tied to the footer" because it was floating mid-page,
   and I made it `fixed`. That fixed the floating and bought a worse problem: a permanent 88px
   bar across the bottom of a nine-panel form, over content, on every screen of the flow —
   the same complaint he then made about the tab bar. A form has an end. The controls that finish
   it belong at that end, where reaching them is itself the signal that you have been through
   everything.

   ── THE SHAPE IS DELIBERATE AND IT IS NOT SYMMETRY FOR ITS OWN SAKE ─────────────────────────
   Two half-width secondaries above one full-width primary reads top-to-bottom as "the two ways
   to stop, then the one way to finish". Publish is the widest thing on the screen because it is
   the only irreversible one.

   Used by BOTH listing forms — Lee: *"these are twin forms… literally copy the code and make
   them identical."* There is nothing to copy: there is one component. */
export function FormActions({
  primary, draft, cancel, hint, invalid,
}: {
  primary: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean };
  draft?: { label: string; onClick: () => void };
  cancel?: { label: string; onClick: () => void };
  /** What is still missing. Turns red once `invalid` — see the note below. */
  hint?: string | null;
  invalid?: boolean;
}) {
  return (
    <div className="mt-5 space-y-2.5 pb-6">
      {hint && (
        /* ── THE MESSAGE TURNS RED, AND SAYS SO OUT LOUD ────────────────────────────────
              Lee: *"that text at the bottom that says hey, you still need at least one photo —
              that needs to turn red like normal, and it needs to highlight the section that it's
              applicable to."* The highlighting is `FormSection`'s `invalid`; this is the other
              half. Grey until somebody actually tries, because a form that opens shouting at you
              for not having filled it in yet is a form that shouts at everybody. `role="alert"`
              only once it is real, so a screen reader is not told about it on mount. */
        <p {...(invalid ? { role: "alert" as const } : {})}
          className={`text-center text-[12.5px] font-semibold leading-snug ${
            invalid ? "text-red-500" : "opacity-55"}`}>
          {hint}
        </p>
      )}
      {(draft || cancel) && (
        <div className="flex items-stretch gap-2.5">
          {draft && (
            <button type="button" onClick={draft.onClick}
              className="btn-ghost min-w-0 flex-1 truncate whitespace-nowrap text-[clamp(13px,3.6vw,15px)]">
              {draft.label}
            </button>
          )}
          {cancel && (
            <button type="button" onClick={cancel.onClick}
              className="btn-ghost min-w-0 flex-1 truncate whitespace-nowrap text-[clamp(13px,3.6vw,15px)]">
              {cancel.label}
            </button>
          )}
        </div>
      )}
      <button type="button" onClick={primary.onClick} disabled={primary.busy || primary.disabled}
        className="btn-primary w-full truncate whitespace-nowrap py-3.5 text-[15px] font-bold disabled:opacity-60">
        {primary.busy ? "…" : primary.label}
      </button>
    </div>
  );
}

/**
 * @deprecated Use `FormActions`. Kept so OneJob's contract form keeps building until it is moved
 * across; retired from both OneHome listing forms on 12 Aug 2026 at Lee's request.
 */
export function StickyActions(props: {
  primary: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean };
  secondary?: { label: string; onClick: () => void };
  cancel?: { label: string; onClick: () => void };
  hint?: string | null;
}) {
  return (
    <FormActions
      primary={props.primary}
      draft={props.secondary}
      cancel={props.cancel}
      hint={props.hint}
    />
  );
}


/* ============================================================================================
   HOW BIG THE NUMBER IN A STEPPER IS ALLOWED TO BE
   ============================================================================================
   Lee, 16 August 2026, circling `403 m²` running under the + button:

     *"As people increase the number, the numeric value should decrease in order for it to fit.
     If the number is in a three digit place, like a hundred or more, then the number needs to
     shrink down so it fits properly inside of that section."*

   ── THE BUDGET, AND WHERE IT COMES FROM ─────────────────────────────────────────────────────
   A stepper is `h-12` with two `w-12` buttons, so the middle cell is (row width − 96px), less
   `px-2` either side. Two steppers share a `Row` on a 390px viewport, which puts each row at
   about 165px and leaves roughly **50px** of usable middle. `BUDGET_PX` is 46 — deliberately
   under the measurement, because the estimate below is an estimate and a number that is slightly
   too small is invisible while one that is slightly too big is the bug being fixed.

   ── WHY AN ESTIMATE AND NOT A MEASUREMENT ───────────────────────────────────────────────────
   Measuring needs layout, which means `useLayoutEffect`, a ref and a resize observer per
   stepper — and there are eleven of them on this form. It would also paint once at the wrong
   size before correcting, which is a visible twitch on every keystroke of a press-and-hold.
   Digits are tabular here (`tabular-nums`), so every digit is exactly the same width and a
   linear estimate is not a guess: it is arithmetic with one measured constant.

   ⚠️ FLOOR, NOT ZERO. `MIN_PX` stops a pathological value shrinking to unreadable. Past that
   point the cell's `overflow-hidden whitespace-nowrap` takes over — the row still never grows.
   ============================================================================================ */

/** Usable width of a stepper's middle cell on the narrowest supported viewport, in px. */
export const STEPPER_BUDGET_PX = 46;
/** Width of one tabular digit as a fraction of the font size, at this weight. Measured. */
const DIGIT_RATIO = 0.66;
/** A suffix like `m²` is set smaller than the value; this is that ratio, and it is exported
 *  because the suffix span uses it directly to stay in proportion while the value shrinks. */
export const SUFFIX_RATIO = 0.78;
/** Suffix glyphs are letters, not tabular digits, so they run a little narrower. */
const SUFFIX_CHAR_RATIO = 0.62;
/** The `gap-1` between the value and its suffix. */
const GAP_PX = 4;
/** Comfortable size when there is room — unchanged from before, so short values look identical. */
const MAX_PX = 16;
/** Small, but still readable at arm's length. */
const MIN_PX = 10;

/**
 * The font size at which `value` and its `suffix` fit the middle of a stepper.
 *
 * Returns `MAX_PX` whenever there is room, so every existing one- and two-digit stepper on the
 * form renders exactly as it does today and this change is invisible until it is needed.
 */
export function stepperFitPx(value: string, suffix?: string): number {
  const v = value ?? "";
  const s = suffix ?? "";
  if (!v) return MAX_PX;

  /* width(px) = v.length·DIGIT_RATIO·px + s.length·SUFFIX_CHAR_RATIO·(px·SUFFIX_RATIO) + gap */
  const perPx = v.length * DIGIT_RATIO + (s ? s.length * SUFFIX_CHAR_RATIO * SUFFIX_RATIO : 0);
  const room = STEPPER_BUDGET_PX - (s ? GAP_PX : 0);
  if (perPx <= 0) return MAX_PX;

  const fits = room / perPx;
  return Math.max(MIN_PX, Math.min(MAX_PX, Math.floor(fits * 10) / 10));
}
