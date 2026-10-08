/**
 * THE TAILWIND PRESET — the half of the colour system that lives outside CSS.
 * ============================================================================================
 * The package shipped `tokens.css` and forgot this, and the result was worse than a missing
 * feature: `tokens.css` `@apply`s `bg-paper` and `bg-ink`, so a product following the README
 * got `CssSyntaxError: The 'border-ink/10' class does not exist` and NOTHING rendered. A build
 * that fails loudly is the good version of that mistake; the quiet version is `bg-clay`
 * resolving to nothing and the Join button rendering white-on-white.
 *
 * A product's `tailwind.config.ts` is now three lines:
 *
 *   import preset from "@oneworld/shell/tailwind-preset.cjs";
 *   export default {
 *     presets: [preset],
 *     content: ["./index.html", "./src/**\/*.{ts,tsx}",
 *               "./node_modules/@oneworld/shell/src/**\/*.{ts,tsx}"],
 *   };
 *
 * ── Why the brand scale points at CSS variables ──────────────────────────────────────────────
 * Eight products hand-writing the same eight-step scale is precisely the drift this package
 * exists to prevent — and it is worse than duplication, because a product would have to get the
 * contrast trap right on its own, eight times. Instead every `brand` step resolves to a custom
 * property, and `applyHue()` fills those in from `AppConfig.hue` at boot. One scale, eight
 * values, zero copies.
 *
 * ── THE ONE LINE THAT MATTERS MOST ───────────────────────────────────────────────────────────
 * `DEFAULT` is `var(--brand-deep)`, NOT `var(--brand)`.
 *
 * `--brand` is the IDENTITY step — the aurora, the mark, gradient starts. As text it measures
 * around 3:1 on the light paper and fails, and `text-brand` appears ~175 times in OneJob alone.
 * Pointing `DEFAULT` at the deep step fixes all of them at once instead of one by one. This trap
 * has now shipped wrong three times: on OneVoice, on the violet ramp, and in the first cut of
 * this package where `hue.DEFAULT` was validated by `assertConfig` and then never used by
 * anything at runtime.
 *
 * `.dark .text-brand` in tokens.css flips to the light step, because the deep step measures
 * under 4:1 on the dark ink. Deleting that rule is the easiest way to ship unreadable dark mode.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Never pure black, never pure white. Black on aurora glass reads as a hole punched in
           the page. */
        ink: "#0B0F1A",
        paper: "#FAFAF8",

        /* VOICE — the only role that changes per product. Written by applyHue(). */
        brand: {
          DEFAULT: "var(--brand-deep)",   // ← the TEXT step. See above. Do not "simplify" this.
          bright:  "var(--brand)",        // the identity — aurora, mark, gradient starts
          deep:    "var(--brand-deep)",
          dark:    "var(--brand-dark)",
          darkest: "var(--brand-darkest)",
          light:   "var(--brand-light)",  // the text step on dark
          tint:    "var(--brand-tint)",
          line:    "var(--brand-line)",
        },

        /* ACTION — the one thing you press. Warm graphite, family-wide, never per-product.
           The token keeps the name `clay` although the value is graphite: Lee, 31 Jul 2026,
           *"the brown colour for some of those buttons is a bit much."* Renaming the token
           would mean editing every button to change one colour, and each of those edits is a
           chance to break a handler on a screen that moves money. Retire the value behind the
           name, not the name. */
        clay: { DEFAULT: "#332C26", deep: "#241E19", light: "#4A4038", tint: "#F2F0ED" },

        /* STATE — what is chosen / true / ready / held. Family-wide. A product that wears this
           makes "chosen" stop being legible everywhere. */
        teal: { DEFAULT: "#15C2B2", dark: "#0E9B8E", deep: "#0B7F74", light: "#5EEAD4", depth: "#0F766E" },

        /* SELECTION — a filter or toggle currently ON. A switch is not a state and not an
           action, so it gets neither the teal nor the graphite ramp. */
        selection: "#0B0F1A",
      },
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
      boxShadow: {
        card: "0 1px 3px rgba(11,15,26,.06), 0 8px 24px rgba(11,15,26,.05)",
        glass: "inset 0 1px 0 rgba(255,255,255,.85), 0 20px 48px -20px rgba(11,15,26,.28)",
      },
    },
  },
  plugins: [],
};
