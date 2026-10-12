import React from "react";

/**
 * A PERSON'S NAME IS NEVER CUT OFF.
 * ============================================================================================
 * Lee, 12 Oct 2026, looking at Karen's profile: *"it says karen Mujer Maga Mag… and then it gets
 * cut off. People's names should never be cut off. We got to just make the name smaller or make
 * it wrap or something."*
 *
 * He is right, and the cause was a one-word fix made for the opposite reason. `PublicWorld`'s
 * heading carried `truncate`, added so a long name could not push the card's layout — the two
 * lines under it (job title, location) already had it, and the name was the odd one out. But a
 * job title and a city can be abbreviated by the reader's imagination. A NAME cannot: "karen
 * Mujer Maga Mag…" is not a shortened name, it is a wrong one, and it is the first thing anyone
 * reads about that person.
 *
 * Note the member's own profile screen never had `truncate` and always wrapped. So the app was
 * already inconsistent: your name was whole, everyone else's was clipped.
 *
 * ── WHAT THIS DOES INSTEAD ──────────────────────────────────────────────────────────────────
 * Three things, in order of how much they give up:
 *   1. IT WRAPS. Two lines is free — the card has the room, and the elements below it move down
 *      rather than being overlapped.
 *   2. IT STEPS THE TYPE DOWN as the name gets longer, so a long name takes two comfortable
 *      lines instead of three cramped ones. The thresholds are in CHARACTERS because that is
 *      what actually drives the wrap; the sizes are the existing scale, not new values.
 *   3. ONLY THEN does it clamp, at three lines, with the full name on `title` so a hover or a
 *      long-press still reveals it. That backstop exists for a pasted paragraph in a name field,
 *      not for a human name — at the sizes below, a 60-character name still fits in three lines.
 * `break-words` is there so a single unbroken 40-character token wraps instead of overflowing
 * the card, which is the one case `line-clamp` alone does not handle.
 *
 * Shared rather than fixed in place, because the next screen that shows someone's name should
 * not have to rediscover this.
 */

/** Measured against the narrowest place this runs: a 390px phone, beside an 80px photo. */
function sizeFor(name: string): string {
  const n = name.trim().length;
  if (n <= 22) return "text-lg sm:text-xl";
  if (n <= 34) return "text-base sm:text-lg";
  return "text-[15px] sm:text-base";
}

export default function MemberName({
  name, as: Tag = "h1", className = "",
}: {
  name: string | null | undefined;
  /** `h1` on a profile, `h2`/`p` wherever the heading level differs. */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}) {
  const value = (name ?? "").trim();
  return (
    <Tag
      /* The full name, always, for hover and for anyone whose device shows a long-press tooltip. */
      title={value || undefined}
      className={`line-clamp-3 break-words font-extrabold leading-tight ${sizeFor(value)} ${className}`}
    >
      {value || "—"}
    </Tag>
  );
}
