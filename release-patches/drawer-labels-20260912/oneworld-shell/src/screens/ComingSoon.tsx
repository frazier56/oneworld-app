import { Link } from "react-router-dom";
import { useI18n, W } from "../lib/i18n";
import { CONFIGS } from "../products";
import { HUB } from "../routes";
import type { AppKey } from "../lib/oneWorld";
import Wordmark from "../components/Wordmark";

/**
 * COMINGSOON — an app you can read about and cannot yet walk into.
 * ============================================================================================
 * Lee, 12 Aug 2026:
 *
 *   *"I want to put a coming-soon stamp on the agent screen. We still want them to be able to
 *   click and learn about it, but we still want them to know that it's coming soon. I don't want
 *   them to be able to access the app portion, but they should be able to access the website
 *   where they can learn about it — because it's not fully done yet, and the rest of them are
 *   kind of getting there."*
 *
 * Three requirements, and they pull against each other, which is why this is a screen rather than
 * a redirect or a hidden tile:
 *
 *   1. **Discoverable.** The tile stays in the switcher and the link still works. An app that
 *      vanishes teaches people it does not exist; an app that says "soon" teaches them to come
 *      back. OneAgent is part of the pitch — six apps — and removing it undercuts the pitch.
 *   2. **Not enterable.** Every route under the product lands here. Not a banner over a working
 *      screen: a half-built product with a sticker on it is still a half-built product, and the
 *      first person to tap through it forms their opinion of the whole ecosystem from it.
 *   3. **Learnable elsewhere.** The website is finished; the app is not. So the one outward link
 *      goes there.
 *
 * The other five apps are untouched. This mounts per product, so switching OneAgent on later is
 * deleting one line in `App.tsx` rather than unpicking a flag.
 */
export default function ComingSoon({
  product, learnMoreUrl = HUB,
}: {
  product: AppKey;
  /**
   * The public page that explains this product. Defaults to the parent marketing site.
   *
   * DELIBERATELY NOT `MARKETING_HOST[product]`. Those hostnames redirect INTO the app — pointing
   * "Read about it" at `oneagent.oneworldlabs.ai` would bounce the person straight back to this
   * screen, which is the one outcome the button exists to avoid. Point it at a product page on
   * the site only once that page is a page and not a redirect.
   */
  learnMoreUrl?: string;
}) {
  const { lang } = useI18n();
  const cfg = CONFIGS[product];
  /* The product's own name, assembled the way the wordmark spells it — the drawn "O", then the
     ink part, then the brand part — so the prose can never drift from the mark directly above
     it. For OneAgent that is "O" + "ne" + "Agent". */
  const name = `O${cfg.wordmark.ink}${cfg.wordmark.brand}`;

  return (
    <div className="mx-auto flex min-h-[82vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <Wordmark wordmark={cfg.wordmark} h={40} />

      {/* The stamp. Angled and outlined rather than a solid pill, because it should read as
          something applied ON TOP of the product rather than as a feature of it. */}
      <span
        className="mt-5 inline-block rounded-xl border-2 border-brand/60 px-4 py-1.5 text-[13px] font-black uppercase tracking-[0.18em] text-brand"
        style={{ transform: "rotate(-3deg)" }}
      >
        {W(lang, "Coming soon", "Muy pronto")}
      </span>

      {/* NO TAGLINE LINE HERE. `Wordmark` already draws it under the mark — printing
          `cfg.wordmark.tagline` again put "Your middleman" on screen twice, two centimetres
          apart, which is what the first render actually did. */}

      <p className="mt-5 text-[13.5px] leading-relaxed opacity-65">
        {W(lang,
          `${name} is still being built. The rest of One World Labs is open — and your One ID already works across all of it, so there is nothing to set up when this one opens.`,
          `${name} todavía se está construyendo. El resto de One World Labs está abierto — y su One ID ya funciona en todo, así que no habrá nada que configurar cuando este abra.`)}
      </p>

      <a
        href={learnMoreUrl}
        target="_blank"
        rel="noreferrer"
        /* `.btn-brand`, not `.btn-primary`: the token file reserves the brand button for actions
           that are NAVIGATION rather than commitment, and this one leaves for a website. */
        className="btn-brand ow-tap mt-6 w-full max-w-xs py-3.5 text-[15px] font-bold"
      >
        {W(lang, "Read about it", "Conocer más")}
      </a>

      <Link
        to="/"
        className="ow-tap mt-3 grid min-h-[44px] w-full max-w-xs place-items-center text-[13.5px] font-bold opacity-60"
      >
        {W(lang, "Back to One World", "Volver a One World")}
      </Link>
    </div>
  );
}
