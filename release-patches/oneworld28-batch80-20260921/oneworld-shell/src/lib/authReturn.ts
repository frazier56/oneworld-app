/**
 * WHERE SIGNING IN LANDS YOU — and the one place that address is written down.
 * ============================================================================================
 * Lee, 21 September 2026: *"when you sign in, you need to be taken to the feed that we just
 * built. Now you can get to Your World from the hamburger icon. We don't want to get rid of the
 * Your World page — you just get to it from the hamburger. I really think everywhere you sign
 * in, regardless of the sign in, you should go to the feed page."*
 *
 * So this is the default destination for `/signin`, for `/join`, and for the fallback inside
 * `safeAuthReturn` when a `?next=` is missing or does not survive validation. It used to be
 * `/yourworld`, in all three.
 *
 * ── WHY IT LIVES HERE AND NOT IN THE FOOTER ─────────────────────────────────────────────────
 * `BottomTabs` owned this constant because the footer's home slot needed it. The auth screens
 * need the same address, and a screen importing a component to learn a route is backwards — so
 * it moved down into lib and the footer imports it from here. One address, one file. Today the
 * feed is `/sandbox`; the day it takes the front door this becomes `"/"` and the footer, both
 * auth screens and the return-trip fallback all follow in that single edit.
 *
 * ⚠️ A `?next=` STILL WINS. A guest who tapped Register on a public event signs in and goes back
 * to that checkout, not to the feed — that return trip is the whole reason `?next=` exists and
 * this does not touch it. This is the answer to "signed in, and nobody said where to".
 */
export const WORLD_FEED_HOME = "/sandbox";

/* ── NOBODY IS EVER SENT BACK TO YOUR WORLD (Lee, 22 Sep 2026) ──────────────────────────────
 * Landing on the feed was already the fallback for "signed in, and nobody said where to". It was
 * not enough, and production proved it: the signed-out front door rendered Your World, the drawer
 * recorded `/yourworld` as the place to come back to, and the return trip — which is a perfectly
 * valid same-origin path — walked straight past the fallback. Lee signed in and landed on Your
 * World, exactly as before.
 *
 * So the retired screen is named here. `/yourworld` and `/switch` are not invalid paths; they are
 * simply never a DESTINATION. Both resolve to the feed. Every other return trip is untouched: a
 * guest who tapped Register on a public event still comes back to that checkout, which is the
 * whole reason `?next=` exists.
 *
 * The screen itself is not going anywhere — it stays reachable from the hamburger. */
const RETIRED_DESTINATIONS = new Set(["/yourworld", "/switch"]);

/** Keep authentication return trips inside this app, including the original query and hash. */
export function safeAuthReturn(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return WORLD_FEED_HOME;
  try {
    const url = new URL(value, "https://oneworld.invalid");
    if (url.origin !== "https://oneworld.invalid") return WORLD_FEED_HOME;
    if (RETIRED_DESTINATIONS.has(url.pathname.replace(/\/+$/, "").toLowerCase() || "/")) return WORLD_FEED_HOME;
    return url.pathname + url.search + url.hash;
  } catch { return WORLD_FEED_HOME; }
}

export const signUpHref = (next: string) => "/join?next=" + encodeURIComponent(safeAuthReturn(next));
