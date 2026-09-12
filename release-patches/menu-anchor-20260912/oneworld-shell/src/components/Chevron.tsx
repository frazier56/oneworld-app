/**
 * THE chevron. One component, one size, everywhere.
 *
 * Lee, Jul 26 2026: "you even have a different arrow under 'who are you in this contract'. Pick a
 * date, different arrow. We need to have the same arrows across all of them... they're all tiny, you
 * can't even see it."
 *
 * Before this, the app had three unrelated things doing the same job:
 *   • a 22px stroked SVG on "Get your money right" (Start-a-job) — the good one
 *   • a bare "▾" text glyph in every glass picker — renders tiny and differently per font/OS
 *   • a "›" text glyph for row affordances
 *
 * A text glyph can't be sized reliably (it follows the font metrics, not your CSS), which is exactly
 * why those looked microscopic next to the SVG one. This is an SVG at the reference size, so every
 * expand/collapse and every picker now points with the same shape and weight.
 *
 * SIZES — default `md` (22px) is the canon, matching "Get your money right". Only drop to `sm` for
 * genuinely dense inline UI, never for a section someone is meant to notice and tap.
 */

const SIZES = { sm: 16, md: 22, lg: 26 } as const;

export default function Chevron({
  dir = "down",
  size = "md",
  open,
  className = "",
  color = "currentColor",
}: {
  /** Resting direction. */
  dir?: "down" | "right" | "up" | "left";
  size?: keyof typeof SIZES;
  /**
   * For collapsibles: pass the open state and the chevron rotates 180° instead of you having to
   * swap the direction yourself. Keeps the motion consistent app-wide.
   */
  open?: boolean;
  className?: string;
  color?: string;
}) {
  const px = SIZES[size];
  const baseRotate = { down: 0, left: 90, up: 180, right: 270 }[dir];
  const rotate = baseRotate + (open ? 180 : 0);
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
