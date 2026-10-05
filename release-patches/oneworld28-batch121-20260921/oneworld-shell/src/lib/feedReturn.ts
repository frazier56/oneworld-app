/**
 * THE FEED BUTTON REMEMBERS WHICH APP YOU ARE IN (30 Sep 2026)
 * ============================================================================================
 * Lee: *"if I'm inside of the one job app and I click on the feed button, it should take me to
 * the one job feed, so on and so forth."* The footer's feed slot always went to `/`, and the
 * world feed opened on its first lane — Homes — whatever app you came from.
 *
 * Now the slot points at `/?lane=<the lane of the app you are in>&i=<where you left that lane>`.
 * Outside any app (profile, settings, the feed itself) it returns to the lane you were last on.
 *
 * Lane keys are the world feed's own (`products/world/lanes.ts`). Kept as plain strings here so
 * the shell does not import the app.
 */
const KEY = "ow-feed-pos";

/** First path segment → world-feed lane. */
const LANE_BY_SEGMENT: Record<string, string> = {
  home: "home", rentals: "home", sales: "home",
  events: "events",
  jobs: "jobs",
  social: "socials",
};

type Pos = { last?: string; at?: Record<string, number> };

function read(): Pos {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; }
  catch { return {}; }
}

/** The world feed calls this as the thumb moves. */
export function rememberFeedPosition(lane: string, i: number): void {
  try {
    const p = read();
    sessionStorage.setItem(KEY, JSON.stringify({ last: lane, at: { ...(p.at ?? {}), [lane]: Math.max(0, i | 0) } }));
  } catch { /* private window: the button still works, it just starts at the top */ }
}

/** Where the footer's feed slot should go from `pathname`. */
export function feedHrefFor(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  const p = read();
  const lane = LANE_BY_SEGMENT[seg] ?? p.last;
  if (!lane) return "/";
  const i = p.at?.[lane] ?? 0;
  return `/?lane=${lane}${i > 0 ? `&i=${i}` : ""}`;
}
