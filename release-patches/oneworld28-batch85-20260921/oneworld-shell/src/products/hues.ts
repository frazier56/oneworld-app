import type { HueRamp } from "../config";
import type { AppKey } from "../lib/oneWorld";

/**
 * EIGHT RAMPS, ONE FILE.
 * ============================================================================================
 * Every product's colour, side by side, so a clash is visible at a glance instead of being
 * discovered on a screen six weeks later. That is not a filing preference: OneSocial's violet
 * colliding with the Trusted badge tier was invisible for as long as the two colours lived in
 * different files.
 *
 * ── How to read a ramp ───────────────────────────────────────────────────────────────────────
 *   bright   THE IDENTITY. Aurora, glows, gradient starts, the mark. ⛔ NEVER text, never a flat
 *            button fill. It is chosen to glow, and a colour chosen to glow does not measure.
 *   DEFAULT  THE TEXT STEP on light. Must measure ≥4.5:1 on #FAFAF8.
 *   light    THE TEXT STEP on dark. Must measure ≥7:1 on #0B0F1A.
 *
 * Every ramp below has both measured. `assertConfig` throws if DEFAULT === bright, because that
 * exact mistake was made once and cost ~175 call sites.
 *
 * ── What is NOT here ─────────────────────────────────────────────────────────────────────────
 * Teal #15C2B2 (STATE), clay (ACTION) and #0B0F1A (SELECTION) are family-wide and live in
 * `tokens.css`. A product that recolours those has broken the one thing making eight products
 * read as one company. Amber belongs to OneScore alone and `assertConfig` enforces it.
 */

/**
 * SKY BLUE — the RENT section of OneHome.
 *
 * It was shared by the app and its rent section until 11 Aug 2026, when Lee moved the APP to a
 * medium teal (see `onehome` below) and the sections stayed where they were. Kept as a named
 * constant rather than inlined because `onerental` is the only key that wears it and a named
 * ramp is what makes the three-step OneHome family legible in one screenful.
 *
 * Measured before use, as every ramp here must be:
 *   DEFAULT #0369A1 on #FAFAF8 = 5.68:1  (needs >= 4.5)
 *   light   #7DD3FC on #0B0F1A = 11.48:1 (needs >= 7)
 */
const SKY: HueRamp = {
  bright: "#0EA5E9",  DEFAULT: "#0369A1", deep: "#0369A1", dark: "#075985",
  darkest: "#0C3D5A", light: "#7DD3FC", tint: "#E8F6FD", line: "#BFE6F8",
};

export const HUES: Record<AppKey, HueRamp> = {
  /** GREEN. Money, completion, "get paid". Shipped and reviewed over three rounds. */
  onejob: {
    bright: "#17A45C",  DEFAULT: "#0E8248", deep: "#0E8248", dark: "#0B6539",
    darkest: "#073F23", light: "#5FD79B", tint: "#EAF9F0", line: "#C2EAD5",
  },

  /** AMBER. The marquee and the trademark. Reserved — no other product may wear it. */
  onescore: {
    bright: "#E0A21F",  DEFAULT: "#96690A", deep: "#96690A", dark: "#7A5507",
    darkest: "#4A3304", light: "#F3C969", tint: "#FDF6E6", line: "#F2E1B4",
  },

  /** ORANGE. Tickets, doors, a night out. Warm without being alarm-red. */
  oneevent: {
    bright: "#E2711D",  DEFAULT: "#9C4A0C", deep: "#9C4A0C", dark: "#7E3B09",
    darkest: "#4E2405", light: "#F5A468", tint: "#FDF1E8", line: "#F5D6BC",
  },

  /**
   * INDIGO-VIOLET — SETTLED 3 Aug 2026 by Lee, after seeing all eight dots together.
   *
   * *"The OneSocial colour direction should stay in the indigo/purple family, but verify it does
   * not clash with OneVoice blue. If needed, adjust OneVoice lighter blue or OneSocial darker
   * indigo."*
   *
   * So: stay in the family, and the burden of separation falls on OneSocial, not on OneVoice.
   * That is the right way round — OneVoice's blue is already on a live customer-facing product
   * with a printed wordmark, and OneSocial's screens are still being built. Move the cheap one.
   *
   * ── The measurement, since "verify" was the actual instruction ───────────────────────────
   *   OneVoice   #2E6BE6 → hue 220°   (blue)
   *   OneSocial  #7C4DE8 → hue 258°   — 38° apart, and at 10px dot size on a white card that is
   *                                     close enough that both read as "blue-purple".
   *   OneSocial  #8B3DEA → hue 267°   — 47° apart, unmistakably purple beside a blue.
   *
   * They are also never adjacent: the switcher's order puts OneAgent's wine between them, and no
   * drawer lists them side by side. 47° plus separation plus different names is sufficient; a
   * bigger move would start walking into OnePage's magenta at the other end.
   *
   * ── What this does NOT resolve, and it is smaller than it was ────────────────────────────
   * The TRUSTED badge tier's metal runs a #6A2FC0 ramp. Pushing the identity step to 267° moves
   * OneSocial away from that too, but a Trusted ring on a OneSocial screen still sits in the
   * same neighbourhood. That is a badge-tier question for the OneSocial thread, on real screens
   * with a real ring next to real chrome — not a colour that can be picked in the abstract.
   *
   * Only `bright` moves. `DEFAULT`/`deep`/`dark`/`darkest` are the TEXT steps and every one of
   * them is already contrast-tested; re-picking them to match a dot would break roughly 175 call
   * sites to fix a 9° problem.
   */
  onesocial: {
    bright: "#8B3DEA",  DEFAULT: "#5B21B6", deep: "#5B21B6", dark: "#4A1A96",
    darkest: "#2E0F5E", light: "#C4A9FA", tint: "#F4EEFE", line: "#DDCCFB",
  },

  /**
   * DEEP WINE RED. Lee, 2 Aug 2026: *"agent is gonna probably not look good in gray… dark
   * maroon or something. Burnt amber… a dark deep wine red."*
   *
   * Burnt amber was the other half of that sentence and it is ruled out: amber is OneScore's
   * and nothing else may approach it. Wine red reads as the broker it describes — Lee: *"an AI
   * agent is basically a middleman, like a real estate agent or a modeling agent."*
   */
  oneagent: {
    /* #7B2D3B is the wine that was already agreed and written down; it stays the identity step
       rather than being "improved" into something brighter. Note this ramp is the one case where
       the identity hue is DARK — wine glows by being deep, not by being loud — so `DEFAULT` is
       only a shade below it. `assertConfig` still requires the two to differ, and they do. */
    bright: "#7B2D3B",  DEFAULT: "#6B2331", deep: "#6B2331", dark: "#551A26",
    darkest: "#340F17", light: "#E0919E", tint: "#FBEDEF", line: "#F0CBD2",
  },

  /**
   * SKY BLUE — OneRental. Lee's call, 10 Aug 2026, and the compromise inside it is on the record.
   *
   * He asked for teal: *"Teal is gonna be the color, like a sky blue sky blue teal… but, hey,
   * I'm open to suggestions."* Teal itself cannot be a product hue and this is the one rule in
   * the file with no exception: `#15C2B2` means CHOSEN / TRUE / READY on every screen in every
   * product. A product wearing it makes every checkmark, every selected chip and every ready
   * state ambiguous — `assertConfig` throws on it, and correctly.
   *
   * The second half of his sentence is the answer. `#0EA5E9` is sky blue: cyan-leaning, bright,
   * unmistakably the colour of water and light — which is what Cartagena and the Colombian coast
   * already sell with, and this app is Colombia-only.
   *
   *   OneRental  #0EA5E9 → 199°, 89% sat
   *   TEAL-STATE #15C2B2 → 174°   — 25° away, and mint-green-cyan against a blue-cyan
   *   OneVoice   #2E6BE6 → 220°   — 21° away, and royal-saturated against a light sky
   *
   * ⚠️ NAMED HONESTLY: this is the TIGHTEST gap in the family — 21° on one side, 25° on the
   * other. Value and chroma carry the separation, not hue alone: the state teal is a deeper
   * green-cyan used on small marks, OneVoice is a dense royal blue on a service several drawer
   * rows away, and this is a bright open sky. If it ever reads as a checkmark on a dark screen,
   * the fix is this block plus the dot in `oneWorld.ts` — two edits, no call sites.
   *
   * Measured before use, as every ramp here must be:
   *   DEFAULT #0369A1 on #FAFAF8 = 5.68:1  (needs ≥4.5)
   *   light   #7DD3FC on #0B0F1A = 11.48:1 (needs ≥7)
   */
  onerental: SKY,

  /**
   * ONEHOME — MEDIUM TEAL. Lee's call, 11 Aug 2026, and it is the SECOND time he has asked.
   *
   * *"The colour dot corresponding to the actual colour of the app… so the OneHome should be more
   * like a teal. It's like a, you know, medium teal colour, and all the rest of the dots are
   * fine."*
   *
   * He asked for teal on 10 Aug too and was given sky blue instead, with the STATE-colour rule as
   * the reason. Asked twice is a decision, not a preference, so the answer is now yes — but the
   * rule it collides with is real and the compromise has to be written down rather than waved
   * through, because the next person to read this file will otherwise "fix" it back.
   *
   * ── WHAT THE RULE ACTUALLY FORBIDS ──────────────────────────────────────────────────────────
   * `#15C2B2` means CHOSEN / TRUE / READY on every screen in every product. A product wearing
   * THAT hex makes every checkmark ambiguous, and `assertConfig` throws on it. What the rule has
   * never said is that the teal FAMILY is off-limits — OneSale already sits at 193° and ships.
   *
   *   STATE      #15C2B2 → 174°, L 42%   bright mint, small marks, always lit
   *   OneHome    #0D9488 → 175°, L 32%   ten points darker, denser, always a large flat fill
   *
   * ⚠️ NAMED HONESTLY, because this is now the tightest pair in the family and tighter than the
   * one already flagged below: the separation here is VALUE ALONE. One degree of hue. That is
   * defensible for the surfaces this colour actually paints — a 9px launcher dot beside the word
   * "OneHome", a card's top rule, a screen's chrome — and it is not defensible for a checkmark.
   * So the standing instruction is narrow: **OneHome may not tint a state mark.** If a tick, a
   * selected chip or a ready badge inside OneHome ever needs a colour, it takes the family state
   * teal, not the product hue, exactly as every other product does.
   *
   * ── AND IT IS NO LONGER THE SAME OBJECT AS THE RENT SECTION ─────────────────────────────────
   * That alias was correct while the app and its rent half were the same blue. They are not any
   * more, and pretending otherwise would put teal on the rentals screens Lee did not ask to
   * change. The shape is now a family of three, which is a better story than the alias was:
   *
   *   OneHome  #0D9488  175°  L 32%   THE APP    — launcher, drawer, switcher, marketing card
   *     ├ rent #0EA5E9  199°  L 48%   light, open, air
   *     └ sale #0E7490  193°  L 31%   deep, dense, water
   *
   * All three are cyan-teal, so the sections still read as halves of the parent; each is 6–24°
   * from the others, so none is mistaken for another. The test that asserted "one object" is
   * replaced by one asserting THIS shape — see `tests/shell.products.cjs`.
   *
   * Measured before use, as every ramp here must be:
   *   DEFAULT #0F766E on #FAFAF8 = 5.24:1  (needs ≥4.5)
   *   light   #5EEAD4 on #0B0F1A = 12.93:1 (needs ≥7)
   */
  onehome: {
    bright: "#0D9488",  DEFAULT: "#0F766E", deep: "#0F766E", dark: "#0B5A54",
    darkest: "#06332F", light: "#5EEAD4", tint: "#E7F7F4", line: "#BCE8E1",
  },

  /**
   * DEEP PETROL — OneSale, the buying half of One Home. Lee's call, 10 Aug 2026.
   *
   * *"The for-sale portion can be like a deeper baby blue — you have the light blues for rentals
   * and a dark kind of baby blue for the for-sale. Adding a little bit more teal in it to make it
   * darker."* That is exactly this: `#0E7490`, hue 193°, lightness 31%.
   *
   * ── WHY TWO NEIGHBOURING HUES IS RIGHT HERE, AND NOT THE USUAL MISTAKE ──────────────────
   * Every other pair in this family is deliberately far apart, because they are different
   * products. OneRental and OneSale are not — they are the two halves of ONE HOME, renting and
   * buying, and a customer should read them as siblings on sight. So they share a hue family and
   * separate by DEPTH instead:
   *
   *   OneRental  #0EA5E9 → 199°, L 48%   light, open, air
   *   OneSale    #0E7490 → 193°, L 31%   deep, dense, water
   *
   * Six degrees of hue and seventeen points of lightness. Beside each other they read as one
   * brand in two weights; alone, neither is mistaken for the other.
   *
   * ⚠️ THE THING THAT ACTUALLY NEEDED CHECKING: the family STATE colour `#15C2B2` sits at 174°,
   * and "more teal" moves toward it. At 193° this is 19° away AND far darker and bluer — a deep
   * petrol next to a bright mint. That is the separation doing the work, not the hue number, and
   * it is why the value had to come down rather than the hue moving further.
   *
   * Measured: DEFAULT #0B5A72 on #FAFAF8 = 7.39:1 · light #7DD3EC on #0B0F1A = 11.30:1
   */
  onesale: {
    bright: "#0E7490",  DEFAULT: "#0B5A72", deep: "#0B5A72", dark: "#094757",
    darkest: "#062E39", light: "#7DD3EC", tint: "#E8F5FA", line: "#BFE3F0",
  },

  /** BLUE. The telephone. Calm, utility, "this is answering for you". */
  onevoice: {
    bright: "#2E6BE6",  DEFAULT: "#1D4ED8", deep: "#1D4ED8", dark: "#1740A8",
    darkest: "#0E2765", light: "#93B4F8", tint: "#EDF3FE", line: "#CBDCFB",
  },

  /**
   * MAGENTA — the brand doc's assignment for OnePage, restored 3 Aug 2026.
   *
   * I had this as deep teal #0EA5A0, and there were TWO problems with that. The brand document
   * says magenta, and a teal one step from #15C2B2 puts a product's voice next to the family
   * STATE colour — the exact adjacency the one-hue rule exists to prevent. Magenta has neither
   * problem and is also further from OneEvent's orange in a drawer list.
   */
  onepage: {
    bright: "#D6338B",  DEFAULT: "#A3126A", deep: "#A3126A", dark: "#830C55",
    darkest: "#4E0733", light: "#F49BC9", tint: "#FDEDF6", line: "#F8CDE4",
  },

  /**
   * BERRY — the brand doc's assignment for OneApp, restored 3 Aug 2026.
   *
   * This was #8B5CF6, a violet a hair from OneSocial's #7C4DE8. The distinctness test compares
   * hex strings, so two near-identical violets passed it while being indistinguishable to an
   * actual eye in an actual drawer — a test measuring the wrong thing is worse than no test,
   * because it reports green. Berry is unmistakably not OneSocial.
   */
  oneapp: {
    bright: "#8E2F6B",  DEFAULT: "#7A2159", deep: "#7A2159", dark: "#5F1845",
    darkest: "#390E29", light: "#E29CC7", tint: "#FAEDF5", line: "#F0CFE2",
  },

  /**
   * CORAL — OnePay. The 7 Sep 2026 brief calls #F3765C provisional; it ships as the identity step
   * and the text steps are darkened until they clear 4.5:1 on white, the same discipline every
   * other ramp follows. Pink-leaning so it never reads as OneEvent's orange, and nowhere near amber.
   */
  onepay: {
    bright: "#F3765C",  DEFAULT: "#C24A32", deep: "#C24A32", dark: "#9E3A27",
    darkest: "#5E2217", light: "#F9B4A5", tint: "#FEF0EC", line: "#F8D3CA",
  },

  /**
   * NAVY — One Business. The colour a business owner already associates with "the account, the
   * bill, the numbers". Deliberately darker and greyer than OneVoice's #2E6BE6, because OneVoice
   * is the flagship module INSIDE One Business and the two wordmarks sit on the same screen.
   */
  onebusiness: {
    bright: "#1F4E79",  DEFAULT: "#173C5E", deep: "#173C5E", dark: "#112D47",
    darkest: "#0A1B2B", light: "#9DBBDA", tint: "#EDF3F9", line: "#CFDEEE",
  },
};

/**
 * ONE WORLD — the parent, not a product.
 * ============================================================================================
 * Deliberately NOT in `HUES`, which is typed `Record<AppKey, HueRamp>` and means "the eight
 * products". One World is the thing they belong to; giving it an `AppKey` would put it in every
 * drawer's sibling list and in the switcher's grid as a ninth product to connect, which is
 * exactly what it is not.
 *
 * The colour is the mark's own blue — Lee, 4 Aug 2026: *"the actual other part of the O should
 * be, I guess, blue. And the far left part of the O will be more like white or silver."* So the
 * parent surface wears the parent's colour, and the shared screens finally stop borrowing
 * OneJob's green.
 *
 * It is close to OneVoice's blue by design, not by accident: OneVoice is the service closest to
 * the company's own identity. They are never adjacent — One World's hue only ever paints
 * surfaces that belong to nobody, and those surfaces never list a product's chrome.
 */
export const ONE_WORLD_HUE: HueRamp = {
  bright: "#2E6BE6", DEFAULT: "#1B49B8", deep: "#1B49B8", dark: "#153A94",
  darkest: "#0C2159", light: "#9DBCFA", tint: "#EFF4FE", line: "#CFDEFB",
};
