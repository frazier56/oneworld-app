/**
 * REPLACED BY `ProfileSlots.RentalTiles` — 11 Aug 2026.
 *
 * This was a second, separate grid of somebody's listings for the public page, written while the
 * owner's own profile had two stacked labelled sections. Lee then asked for both to become ONE
 * grid with a horizontal All / Properties / Personal filter:
 *
 *   *"Let's just combine them together… that way everything is in one area. It'll consolidate the
 *    real estate space."*
 *
 * Two components rendering the same person's properties in two different shapes is exactly the
 * drift that consolidation is meant to remove — the public page and the owner's page would answer
 * "what has this agent got" differently, and only one of them would get the next fix.
 *
 * `RentalTiles` now takes `publicView`, which switches the query to published-and-public only and
 * reads the person from the route rather than the session. Re-export so the routes keep working.
 */
export { RentalTiles as default } from "./ProfileSlots";
