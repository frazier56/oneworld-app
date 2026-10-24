import type { KeyboardEvent } from "react";

/* ── A RADIO GROUP THAT WORKS FROM THE KEYBOARD (18 Oct 2026, Testing on overlay 57) — SHELL ───
   `role="radio"` on a button promises radio behaviour, and a button gives none of it: ArrowRight
   on the layout choice and ArrowDown on the Sort choice did nothing. Put this on the element with
   `role="radiogroup"`, and give each radio `tabIndex={checked ? 0 : -1}` (one tab stop per group):
   Arrow keys move AND select (wrapping), Home / End jump to the ends. The choice is made by the
   radio's own click handler, so there is exactly one code path for mouse, touch and keyboard. */
const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function radioGroupKeys(e: KeyboardEvent<HTMLElement>): void {
  if (!(e.key in STEP) && e.key !== "Home" && e.key !== "End") return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'));
  if (!radios.length) return;
  const focused = radios.indexOf(document.activeElement as HTMLElement);
  const from = focused >= 0 ? focused : Math.max(0, radios.findIndex(r => r.getAttribute("aria-checked") === "true"));
  const next = e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1
    : (from + STEP[e.key] + radios.length) % radios.length;
  e.preventDefault();
  radios[next].click();
  radios[next].focus();
}
