import type { ReactNode } from "react";

/**
 * SEARCH AS A QUESTION IN THREE PARTS — where, when, who.
 * ============================================================================================
 * Lee's backlog item, 16 August 2026: *"the search needs to be laid out as where, when, who."*
 *
 * The search row this replaces is one free-text box plus a 60/40 location aside. That shape asks
 * the reader to type a sentence and hope the app understands it. Nobody looking for somewhere to
 * stay is holding a sentence — they are holding three facts, and they know all three before they
 * open the app. So the control should ask for the three facts.
 *
 * ── WHY THIS IS IN THE SHELL ────────────────────────────────────────────────────────────────
 * The same reason `HomeTop` owns the 60/40 geometry: every product that has re-invented its own
 * search row has got the geometry wrong, and geometry is the part the shell has business owning.
 * WHAT the three words mean is the product's business and this file deliberately does not know —
 * "who" is guests on OneHome, a skill on OneJob, a headcount on OneEvent.
 *
 * ── SO IT TAKES ALREADY-TRANSLATED STRINGS, LIKE `HomeTop`'s PILLS ──────────────────────────
 * `W()` covers English and Spanish; One World offers seven languages. A shell control that hard-
 * codes two of them ships a half-translated header to five countries. `HomeTop` already solved
 * this for its facet pills — *"labels arrive ALREADY translated by the app's own dictionary"* —
 * and this follows it exactly. No new `shellCopy` keys, no partial translation, no drift.
 *
 * ── ⚠️ THE EMPTY STATE IS A PROMPT, NOT A BLANK ─────────────────────────────────────────────
 * Each segment always renders two lines: the question on top, the answer underneath. When there
 * is no answer yet the second line shows the placeholder the product supplied ("Anywhere", "Any
 * week", "Add guests") at reduced opacity. Two lines, always, in every state.
 *
 * That is the reserve-the-space rule, and it is not cosmetic here: if the second line collapsed
 * when empty, the bar would grow the instant a reader picked a city and every pill, card and
 * photo below it would jump down the screen mid-tap. A control that moves the page when you use
 * it feels broken, and this is the exact class of thing that made the header shift between
 * For rent and For sale.
 *
 * ── AND WHY THE DIVIDERS ARE NOT BORDERS ────────────────────────────────────────────────────
 * `border-l` on segments two and three would paint a hairline flush to the top and bottom of the
 * bar and read as three stacked boxes. These are inset rules at 60% height, which read as one
 * control divided rather than three controls touching.
 */
export default function SearchTriad({
  where, when, who, onWhere, onWhen, onWho, className,
}: {
  /** `label` is the question ("Where"); `value` the answer, or null for the placeholder. */
  where: Segment;
  when: Segment;
  who: Segment;
  onWhere: () => void;
  onWhen: () => void;
  onWho: () => void;
  className?: string;
}) {
  const segs: { s: Segment; on: () => void }[] = [
    { s: where, on: onWhere }, { s: when, on: onWhen }, { s: who, on: onWho },
  ];

  return (
    <div className={`flex items-stretch rounded-2xl border border-ink/10 bg-white/70 dark:border-white/15 dark:bg-white/10 ${className ?? ""}`}>
      {segs.map(({ s, on }, i) => (
        <div key={s.label} className="relative flex min-w-0 flex-1">
          {i > 0 && (
            /* Inset to 60% of the bar's height — see the note above on why this is not a border. */
            <span aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-px -translate-y-1/2 bg-ink/10 dark:bg-white/15" />
          )}
          <button type="button" onClick={on}
            /* 44px is the floor a thumb reliably hits on a 390px viewport; two text lines plus
               the padding clear it, and `min-h` states it rather than leaving it to luck. */
            className="ow-tap flex min-h-[44px] min-w-0 flex-1 flex-col justify-center gap-px px-3 py-2 text-left"
            aria-label={s.value ? `${s.label}: ${s.value}` : s.label}>
            <span className="truncate text-[10.5px] font-black uppercase tracking-wide opacity-70">
              {s.label}
            </span>
            {/* ALWAYS RENDERED. Never conditional — see the reserve-the-space note above. */}
            <span className={`truncate text-[13px] font-semibold ${s.value ? "" : "opacity-40"}`}>
              {s.value ?? s.placeholder}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

export type Segment = {
  /** The question. Already translated by the product's own dictionary. */
  label: string;
  /** The answer, or null when nothing is chosen yet. Already formatted by the product. */
  value: string | null;
  /** Shown in place of the answer while it is null. Already translated. */
  placeholder: string;
};

/** Escape hatch for a product that wants a fourth thing on the row. Rare; measure first. */
export type SearchTriadAside = ReactNode;
