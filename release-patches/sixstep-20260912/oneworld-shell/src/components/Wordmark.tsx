import type { AppConfig } from "../config";

/**
 * THE WORDMARK — one component, eight products.
 * ============================================================================================
 * Every product's mark reads the same way: the drawn "O", then a first part in ink, then a
 * second part in the product's hue, with a tagline underneath. Only the three strings and the
 * image change, and all four come from `AppConfig.wordmark`.
 *
 * ── Two failures this shape prevents, both of which actually shipped ─────────────────────────
 *
 * 1. **"nePage".** The mark IS the letter O. When the image failed to load, the sister app's
 *    header read "nePage" — live, for weeks. A text "O" in the same weight sits underneath and
 *    is revealed by `onError`, so a missing asset costs a little kerning and nothing else.
 *    `alt=""` keeps the image out of the accessibility tree so the fallback is not read twice.
 *
 *    Lee saw exactly this on every screen of every product, 4 Aug 2026: *"the logo is missing
 *    from all of the shell pages. You just have a regular O, like the letter O, but that letter
 *    O needs to be the logo."* The component was not at fault — `public/marks/` did not exist in
 *    this app at all, so all eight 404'd and all eight fell back. The fallback working perfectly
 *    is what hid it.
 *
 * 2. **Padding inside the asset.** Lee, 31 Jul 2026: *"the O needs to be pushed closer to the
 *    text."* The CSS gap was already 2px — the space was INSIDE the PNG, which carried 56px of
 *    transparent padding on every side. No amount of CSS at this end can close that. Crop every
 *    product's mark to its alpha bounds before shipping it; that is a rule about the asset, not
 *    about this component. Every mark is now generated cropped to its alpha bounds, and the CSS
 *    gap is 2px — Lee, 4 Aug 2026: *"it needs to be, like, only two pixels away from the rest of
 *    the text."*
 *
 * A colour token cannot recolour a PNG. A new product needs its mark re-rendered in its own hue
 * as a file — see `ONEJOB_greenify_marks.py` for how OneJob's was done.
 */
/**
 * KERNING THE LOGOTYPE AGAINST THE MARK — measured, not guessed.
 * ============================================================================================
 * Lee, 4 Aug 2026, twice, and the second time because I overcorrected the first: *"the O and the
 * N are literally on top of each other. They should be immediately next to each other just like
 * text — you know how the N and the E are next to each other but not touching."*
 *
 * He is right both times and the fix is arithmetic, so here it is written down instead of eyeballed
 * a third time.
 *
 * The mark is a PNG cropped to its alpha bounds, so its box is as wide as its widest point — but
 * at the height the capital letters sit, the ring has already curved inward and the last 5% of the
 * image width is empty. Attempt one pulled the text back by 22% of the mark height — four times
 * that entire empty margin, which is exactly why the N landed on top of the O.
 */
/**
 * ── MEASURED OFF THE RENDER, NOT OFF THE ASSET ──────────────────────────────────────────────
 * Measuring the PNG alone was still wrong, because a font glyph has its OWN empty margin: the
 * "n" starts about 1.1px inside its box at h=34. Asset margin + CSS margin + glyph side bearing
 * is the real distance, and only the last of those is invisible in the source.
 *
 * So these two numbers come from a pixel-column scan of the actual rendered wordmark
 * (`kern3.mjs` → the ink runs in `band-name.png` / `band-tag.png`), which is the only place all
 * three add up. Values are a fraction of the mark's height, so they hold at every size.
 *
 * Target, at h=34 — the letter-to-letter ink gaps inside "neWorld" measure 1.9–2.0px, so:
 *   mark ink → "n" ink        ≈ 2.05px      (the same air as o→r, the widest normal pair)
 *   tagline ink left edge     = name ink left edge   (one straight left margin under the mark)
 */
const LEAD_NAME = -0.0298;
const LEAD_TAGLINE = 0.0035;

/**
 * ── THE VERTICAL PROPORTIONS, TAKEN OFF LEE'S OWN ARTWORK ────────────────────────────────────
 * Lee, 4 Aug 2026, attaching the OneVoice and OneSocial logos: *"I believe these are done the
 * correct way… I'd be curious to know how many pixels difference the One World logo is versus
 * these."*
 *
 * So they were measured rather than admired. Ink bounds, at native resolution, all three files:
 *
 *                        OneVoice      OneSocial     ONE WORLD (before)
 *   mark height / cap      2.46          2.74           2.20
 *   mark above name top    0.74          0.94           0.58     ← all fractions of cap height
 *   mark below tagline     0.31          0.34           0.05
 *
 * Read as fractions of the MARK's own height, the reference proportions are consistent to about
 * two percent across two different logos drawn at 6x different sizes:
 *
 *   above the name   0.315      cap height   0.393      line gap   0.050
 *   tagline          0.120      below it     0.126
 *
 * Ours was wrong in three places at once, which is why it never looked right no matter which one
 * got nudged: the type was 16% too large against the mark, the line gap was more than double,
 * and the mark stopped dead at the tagline instead of hanging below it. The numbers below are
 * those five proportions, and the mark now sits in the word the way it does on his artwork.
 */
/* ── Lee, 4 Aug 2026, correcting me: it was the NAME that was too small, not the lockup ──────
   *"The text I was referring to wasn't the overall logo text — it was just the n-e-W-o-r-l-d
   portion. The 'small business' text at the bottom is fine, keep that. The other text needs to be
   bigger, at least one point, probably two. And the small business text shouldn't fly out to the
   right like double the length — it should be tucked under the top text for the most part,
   sticking out maybe ten percent."*

   Two numbers, and the second is the measurable one. The tagline is letter-spaced uppercase so it
   runs long; growing the name and easing the tagline back puts the tagline UNDER the word with a
   little air past it, instead of beside it. `kern-check.mjs` measures the INK widths of both and
   holds the overhang near +10%. */
const NAME_SIZE = 0.4520;      // × mark height — was .3887, roughly two points up at splash size
/* Lee, 4 Aug 2026, on the Your World header: *"the One World logo doesn't appear centred, and
   it's because that word 'solutions' is throwing it off so much. We need to make that text a lot
   smaller — it's like fifty percent to the right of the One World part. It's too big."*

   Two levers, and the second matters as much as the first: the tagline is UPPERCASE and
   letter-spaced, so a size cut alone barely helps — the tracking is what makes it run long.
   Cutting both takes the ink overhang from roughly +50% down to about +10%, which is the number
   he asked for originally, and the lockup reads centred again because the widest thing in it is
   no longer the small print. */
const TAG_SIZE = 0.1450;       // was .1824 — the tagline had grown wider than the name
const TAG_LIFT = 0.025;         // opens the line gap between the name and the tagline
const COLUMN_LIFT = 0.076;     // raises the text so the mark hangs below the tagline

/**
 * HOW MUCH TO SHRINK A LONG TAGLINE so it holds one line without clipping.
 *
 * The reference is the longest tagline the family ships today — OneHome's sale section, at 28
 * characters. Anything at or under the comfortable length renders at full size and is untouched,
 * so every existing product looks exactly as it did today. Longer strings scale down
 * proportionally, with a floor so a pathological future tagline shrinks to small rather than to
 * unreadable.
 *
 * Character count rather than measured width, on purpose: this runs inside the render of a header
 * that paints on every screen of every product, and a layout measurement there costs a reflow per
 * paint to solve something a ratio solves for free. Every tagline in the family is uppercase Latin
 * at one weight, so width tracks length closely enough.
 */
const TAG_COMFORTABLE = 22;   // characters that fit at full size on a 390px viewport
const TAG_MIN_SCALE = 0.72;   // never shrink past this — below it the small print stops being read

export function tagScale(tagline: string): number {
  const n = tagline ? tagline.length : 0;
  if (n <= TAG_COMFORTABLE) return 1;
  return Math.max(TAG_MIN_SCALE, TAG_COMFORTABLE / n);
}

export default function Wordmark({
  wordmark, h = 30,
}: { wordmark: AppConfig["wordmark"]; h?: number }) {
  return (
    /* ── THE TEXT TUCKS INTO THE O, IT DOES NOT SIT BESIDE ITS BOUNDING BOX ────────────────
       Lee, 4 Aug 2026: *"the O should be next to the n-e, so it spells ONE. But you have a huge
       gap between the O and the n-e."*

       The CSS gap was 2px and measured 2px in the browser — the gap he could see was OPTICAL. The
       mark is a ring that is open at the top right, so at the height the letters sit, the stroke
       has already curved back inward and the image's right edge is empty air. Two pixels of CSS
       plus six pixels of nothing reads as eight, and the word stops spelling "One".

       Kerning a letterform against a logotype is done by eye, not by box: the text is pulled back
       into the curve by a fraction of the mark's own height, so it holds at every size the
       wordmark is rendered at. */
    /* ── ALIGNED AT THE BOTTOM, NOT CENTRED ──────────────────────────────────────────────
       Lee, 4 Aug 2026: *"the O is too low. You centered it vertically against the n-e, but it
       shouldn't be centered. The bottom of the logo should roughly be the same as where it says
       'small business'."*

       `items-center` splits the mark's overhang evenly above and below the two-line text column,
       which puts its bottom below the tagline and its top above the cap height — so the mark
       reads as having slipped down out of the word. Aligning the BOTTOM edges puts the whole
       overhang above, where the ascenders already are, and the mark sits IN the line rather than
       under it. It is the same principle as the horizontal kerning above: align the thing the
       eye actually reads, not the bounding box. */
    /* `translate="no"` + the `notranslate` class, NOT a custom data attribute. 15 Aug 2026:
       `data-no-translate` was here and browsers ignore it — it is not a standard. On Chrome for
       Android, with the page offered in Spanish, the translator read the fallback "O" as the
       Spanish conjunction "o" and rendered the header as **"EITHERne Home"**. A brand mark
       translated into a different word is about the worst thing a header can do, and it was one
       attribute away from impossible. `translate="no"` is the HTML standard; `notranslate` is
       what Google Translate itself honours. Both, belt and braces, and the fallback "O" carries
       them too so it cannot be reached on its own. */
    <span className="inline-flex select-none items-end notranslate" translate="no" data-no-translate>
      <img
        /* BASE_URL, because the app may not be served from the domain root. OneJob had this and
           the extraction dropped it; a bare "/marks/x.png" 404s under any sub-path deploy, and
           the failure is silent because the text-"O" fallback covers it.
           A markSrc that is already absolute (a `data:` URI or an `http(s)` URL) is used as-is —
           BASE_URL only prefixes root-relative asset paths. */
        src={/^(data:|https?:)/.test(wordmark.markSrc)
          ? wordmark.markSrc
          : `${(import.meta as any).env?.BASE_URL ?? "/"}${wordmark.markSrc.replace(/^\//, "")}`}
        style={{ height: h }} alt="" className="block"
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = "none";
          const o = img.nextElementSibling as HTMLElement | null;
          if (o) o.style.display = "block";
        }}
      />
      <span aria-hidden translate="no"
        className="font-extrabold tracking-tight text-brand-deep dark:text-brand-light notranslate"
        style={{ display: "none", fontSize: h * 0.72, lineHeight: 1 }}>
        O
      </span>
      {/* ── `text-left` IS THE FIX FOR "YOU CENTERED PIECES AT A TIME" ────────────────────
          The splash is `text-center`, and text-align INHERITS. So the moment the page was
          centred, the name and the tagline each centred themselves INSIDE this column — and
          because the tagline is wider than the name, the name drifted right, away from the mark,
          while the tagline overhung on both sides and ran back underneath the O.

          That is exactly what Lee saw and exactly what he said: *"if you center it, that doesn't
          mean center everything. You have to keep the O-N-E together. You don't take the logo
          part and center pieces at a time."* The logo is centred as ONE object by the layout
          around it; inside it, everything stays hard against the mark. */}
      <span className="flex min-w-0 flex-col justify-center text-left" style={{ lineHeight: 1, marginBottom: h * COLUMN_LIFT }}>
        <span className="font-extrabold tracking-tight"
              style={{ fontSize: h * NAME_SIZE, marginLeft: h * LEAD_NAME }}>
          <span className="text-ink dark:text-paper">{wordmark.ink}</span>
          {/* The second half carries the product colour — the wordmark itself tells you which
              product you are standing in, which is the entire point of one hue per product. */}
          <span className="text-brand-deep dark:text-brand-light">{wordmark.brand}</span>
        </span>
        {/* ── ⚠️ THE TAGLINE MAY NEVER WRAP. THIS IS WHY THE HEADER MOVED. ──────────
            Lee, 15 August 2026, with both headers circled in red: *"the alignment between both of
            these screens is not quite right... the header should look exactly the same regardless
            of which. If you click on For rent or For sale, it's supposed to be in the same exact
            position on every screen all the time."*

            He named the mechanism himself: *"it's probably because the text is wrapped."* He was
            right. OneHome's two sections carry different taglines — ARRIENDO CON CONTRATO is 21
            characters, COMPRA Y VENTA CON HISTORIAL is 28. At desktop width both fit and the
            headers ARE identical, which is exactly why this survived so long. At 390px the longer
            one ran out of room, wrapped to two lines, made the lockup taller, and moved everything
            measured from the header.

            Two rules, and both are needed:
             · `whitespace-nowrap` — it can never become two lines, in any language, at any width.
             · `min-w-0` on the column plus `overflow-hidden` here — without them the nowrap text
               would instead push the column wider than its parent and shove the header controls
               off the right edge, which is the same defect wearing a different hat.

            And it SHRINKS rather than clips: `TAG_SIZE` is the ceiling and a longer string scales
            down against the longest one this family ships. That keeps the +10% ink-overhang rule
            Lee set on 4 August intact for the short taglines, while making the long ones
            physically incapable of taking a second line. */}
        <span className="overflow-hidden whitespace-nowrap font-semibold uppercase text-brand"
          style={{
            fontSize: h * TAG_SIZE * tagScale(wordmark.tagline),
            letterSpacing: "0.085em",
            marginLeft: h * LEAD_TAGLINE,
            marginTop: h * TAG_LIFT,
          }}>
          {wordmark.tagline}
        </span>
      </span>
    </span>
  );
}
