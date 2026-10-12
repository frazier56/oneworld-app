/* ============================================================================================
 * CARD CHROME — the two pieces that sit ON the photograph, defined once.
 *
 * These are not an arbitrary slice of the card. They are the two that DRIFTED:
 *
 *   U24  the host avatar was 32px on the sale card and 56px on the rent card   (fixed v94)
 *   U25  the photo badge read "5" on sale and "3 / 7" on rent                  (fixed v95)
 *
 * Both cost a version. Both were "the two sides do the same thing differently". Written twice,
 * they will drift a third time; written once, they cannot.
 *
 * ── WHAT THESE DO NOT OWN ───────────────────────────────────────────────────────────────────
 * The destination. `HostAvatar` takes `to` rather than building it, because rent links into
 * onerental's profile route and sale into onesale's. The shared piece owns the SHAPE; each
 * product owns where it points — the same boundary listingFacts() draws around the kind label.
 * A shared component that decides destinations is a place where two products argue.
 *
 * ── AND WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────────────────
 * The rent card's GRID layout has a smaller badge — `right-1.5 top-1.5`, `text-[10px]`, bare
 * count. That is a different control for a different layout, not drift, and it stays where it is.
 * ==========================================================================================*/
import { Link } from "react-router-dom";
import { Avatar } from "@oneworld/shell";

/** Who listed it — top left, ringed, 56px. Lee: *"the profile photo should be at the top left."* */
export function HostAvatar({ to, agent }: { to: string; agent?: { photo_url?: string | null; full_name?: string | null } }) {
  return (
    <Link to={to} className="ow-tap absolute left-2 top-2 rounded-full ring-2 ring-white/70">
      <Avatar src={agent?.photo_url} name={agent?.full_name} size={56}
        rounded="rounded-full" textSize="text-[15px]" />
    </Link>
  );
}

/** Which photo of how many — top right. Renders nothing for a single photo. */
export function PhotoCount({ idx, total }: { idx: number; total: number }) {
  if (total <= 1) return null;
  return (
    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white backdrop-blur-sm">
      {idx + 1} / {total}
    </span>
  );
}
