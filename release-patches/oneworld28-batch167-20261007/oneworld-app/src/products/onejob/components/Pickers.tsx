/**
 * MOVED TO THE SHELL — 11 Aug 2026.
 *
 * The glass pickers now live in `@oneworld/shell` (`components/Pickers.tsx`), because OneHome was
 * shipping a native `<input type="date">` while this file sat here solving exactly that problem.
 * Lee: *"these are brother and sister apps, and they should be using the same code whenever
 * possible."*
 *
 * This shim exists so OneJob's ~40 call sites did not all have to change in the same commit. It is
 * a re-export and nothing else — do NOT add behaviour here, or the fork this move was meant to
 * prevent starts again in the one file named after preventing it. New code should import from
 * `@oneworld/shell` directly.
 *
 * `GlassDate` gained optional `min` / `max` in the move. Omitting `min` keeps the original
 * today-floor, so every existing call site behaves identically.
 */
export { GlassDate, GlassTime, GlassTimePicker, GlassSelect } from "@oneworld/shell";
