import type { HueRamp } from "../config";

/**
 * PAINT THE PRODUCT'S HUE ONTO THE DOCUMENT.
 * ============================================================================================
 * `tokens.css` is deliberately hue-free — every product colour in it is a CSS custom property.
 * This is the one function that fills them in, and it runs once at boot from `AppConfig.hue`.
 *
 * Why a runtime function rather than eight stylesheets: eight stylesheets is eight copies of
 * the glass system, and the whole reason this package exists is that copies drift. One
 * stylesheet plus eight nine-value ramps cannot drift — a product can only change its colour,
 * never the recipe.
 *
 * It also means the Tailwind config is identical in every app: `brand`, `brand-deep`, and the
 * rest all resolve to `var(--brand)` etc., so ~175 existing OneJob call sites keep working
 * unchanged when it is rebuilt onto the shell.
 */

/** `#RRGGBB` → `r, g, b` for use inside rgba(). Accepts the shorthand form too. */
function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

export function applyHue(hue: HueRamp, root: HTMLElement = document.documentElement): void {
  const s = root.style;

  s.setProperty("--brand",         hue.bright);   // ← IDENTITY, not text. See the contrast trap.
  s.setProperty("--brand-deep",    hue.deep);
  s.setProperty("--brand-dark",    hue.dark);
  s.setProperty("--brand-darkest", hue.darkest);
  s.setProperty("--brand-light",   hue.light);
  s.setProperty("--brand-tint",    hue.tint);
  s.setProperty("--brand-line",    hue.line);

  /* The aurora. Four radial stops, two per layer, at the opacities OneJob's green field was
     tuned to over three rounds of Lee's review — a field any louder competes with the content
     it sits behind, and any quieter reads as a flat grey page.

     The DARK values are deliberately STRONGER, not weaker. On #0B0F1A a 34%-opacity wash is
     nearly invisible; the field has to work harder to be seen at all. */
  const light: Record<string, string> = {
    "--aurora-1": rgba(hue.bright, .34),
    "--aurora-2": rgba(hue.light,  .26),
    "--aurora-3": rgba(hue.deep,   .26),
    "--aurora-4": rgba(hue.dark,   .18),
  };
  /* DARK REDESIGNED 8 Aug 2026 — Lee's review of the Event/Agent dark screenshots: "the
     colors are too contrasty… dark orange on dark just doesn't look right… take that gradient
     away or make it more subtle." The old map (bright .40 + dark .38 + deep .32) painted a
     heavy coloured fog that read muddy on every hue. Dark mode is now PREMIUM INK WITH A HINT
     OF VOICE: one soft glow of the bright step up top, a whisper of the light step low, and
     the deep/dark stops nearly gone — the glass and the content carry the screen, the hue only
     signs it. If a future eye wants dark louder, raise these a step at a time with Lee looking
     at a real phone — never back to .40. */
  const dark: Record<string, string> = {
    "--aurora-1": rgba(hue.bright, .16),
    "--aurora-2": rgba(hue.dark,   .10),
    "--aurora-3": rgba(hue.deep,   .09),
    "--aurora-4": rgba(hue.light,  .07),
  };

  const isDark = root.classList.contains("dark");
  const set = isDark ? dark : light;
  for (const [k, v] of Object.entries(set)) s.setProperty(k, v);

  /* ── The theme can flip after boot, and the aurora has to follow it ────────────────────────
     One observer on <html>'s class attribute is cheaper and more reliable than asking every
     theme toggle to remember.

     THE STALE-CLOSURE BUG THIS FIXES, because it is subtle and it bit: the first version
     installed the observer once and skipped it thereafter, so the observer kept the FIRST
     product's colour maps forever. In a single-origin SPA the drawer's sibling rows are
     client-side <Link>s, so going /job → /event → toggling dark mode repainted the aurora in
     OneJob's GREEN on a OneEvent screen, and stayed wrong until a hard reload.

     The maps now live in a mutable box the observer reads at fire time, so the newest call to
     applyHue always wins. The observer itself is still installed once — creating a second one
     per navigation is its own leak. */
  const box: HueMaps = { light, dark };
  const existing = (root as any).__owHue as { obs: MutationObserver; maps: HueMaps } | undefined;
  if (existing) {
    existing.maps.light = light;
    existing.maps.dark = dark;
  } else {
    const state = { maps: box, obs: null as unknown as MutationObserver };
    state.obs = new MutationObserver(() => {
      const next = root.classList.contains("dark") ? state.maps.dark : state.maps.light;
      for (const [k, v] of Object.entries(next)) root.style.setProperty(k, v);
    });
    state.obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    (root as any).__owHue = state;
  }
}

type HueMaps = { light: Record<string, string>; dark: Record<string, string> };

/**
 * Tear the observer down. Only a test harness or a hot-reload boundary needs this — in the app
 * the observer is meant to live as long as the document does, because the document is the app.
 */
export function stopHueObserver(root: HTMLElement = document.documentElement): void {
  const s = (root as any).__owHue as { obs: MutationObserver } | undefined;
  if (s) { s.obs.disconnect(); delete (root as any).__owHue; }
}
