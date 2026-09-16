import { useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOneId } from "../lib/oneId";
import { readPref, writePref } from "../lib/safeStorage";
import { PRODUCT_PATH } from "../routes";
import type { Product } from "../lib/oneId";
import Splash from "./Splash";
import OneWorldSwitcher from "./OneWorldSwitcher";
import { useI18n } from "../lib/i18n";
import ProductMarquee from "../components/ProductMarquee";
import { applyHue } from "../lib/hue";
import { ONE_WORLD_HUE } from "../products/hues";

/**
 * THE FRONT DOOR — and there are two of them, which is the whole point.
 * ============================================================================================
 * Lee, 4 Aug 2026, correcting the version that shipped an hour earlier:
 *
 *   "I didn't really think that in the app world, once you download the app, you won't go to the
 *    marketing page. If you log out of an app like Instagram, it just takes you to the splash
 *    screen... we're prepping for it to be an app, right?"
 *
 * He is right and I had it wrong. The reasoning that produced the marketing-site redirect was
 * about a WEBSITE — a signed-out visitor at a bare origin has no session, so send them to the
 * story. But this is being built as an app, and an app that ejects you to a website when you sign
 * out has, from the person's point of view, closed itself. Instagram does not do it. Gmail does
 * not do it. The marketing site is where you go BEFORE you have the app, and adverts point there
 * directly; it is not a screen the app should ever navigate to.
 *
 * So the signed-out front door is a SPLASH, and which splash depends on why they are here:
 *
 *   · They came in through a product — they downloaded "OneJob", they think of this as OneJob —
 *     so signing out lands them on OneJob's splash, ready to sign back in. Lee: *"if you
 *     downloaded the app in one job and you log out of one job, you should be brought to the
 *     splash screen for one job. So the system needs to know what their primary download was."*
 *
 *   · They came in through One World itself, with no product intent. Lee: *"we've assumed that
 *     some person downloaded the One World app without any marketing around jobs. We gotta
 *     account for that... One World needs a splash screen, just in case."* That is this screen.
 *
 * ── WHY THE PRIMARY IS CACHED ON THE DEVICE ─────────────────────────────────────────────────
 * `profiles.signup_app` is the record of where somebody entered, and it is the right source of
 * truth — but reading it needs a session, and by definition there is none at the moment we have
 * to decide which splash to show. So the primary is mirrored into device storage whenever they
 * are signed in, and the signed-out screen reads the mirror. The database stays authoritative;
 * this is a cache with exactly one job.
 *
 * A device with no mirror has never been signed in on this device, which is precisely the
 * "no intent" case — and it gets the One World splash. The fallback is not a guess.
 */

/** Where this device last knew the person to live. Device-scoped on purpose — a shared laptop
 *  should not inherit somebody else's home product. */
export const PRIMARY_KEY = "ow.primary";

export function rememberPrimary(p: Product | null) {
  if (p) writePref(PRIMARY_KEY, p);
}

export function readPrimary(): Product | null {
  const v = readPref(PRIMARY_KEY);
  return v && v in PRODUCT_PATH ? (v as Product) : null;
}

/**
 * THE FRONT DOOR'S OWN WORDS, IN ALL SEVEN.
 *
 * Lee, 4 Aug 2026: *"they can click the flag they want, but they need to work."*
 *
 * The shell's chrome has been translated seven ways since the package was written. This screen's
 * two sentences were hard-coded English literals, so they were the one thing on the front door
 * that a flag could not touch — on the exact screen where somebody decides whether the product is
 * real. Written properly rather than machine-passed: register matters more than vocabulary here
 * (usted for Colombia, tú for Spain, Sie for Germany), and "small business" is a different idea in
 * each market.
 */
const OW_COPY: Record<string, { head: string; sub: string }> = {
  en: {
    head: "AI that runs the boring but profitable half of your business.",
    sub: "One World Labs builds AI technology for small businesses and freelancers — an ecosystem of apps you use and services we run for you, so the work gets found, the customers get answered and the money actually arrives.",
  },
  co: {
    head: "IA que se encarga de la parte aburrida —  y rentable — de su negocio.",
    sub: "One World Labs crea tecnología de IA para pequeños negocios e independientes: aplicaciones que usted usa y servicios que operamos por usted, para que el trabajo aparezca, los clientes reciban respuesta y el dinero sí llegue.",
  },
  es: {
    head: "IA que se ocupa de la parte aburrida —  y rentable — de tu negocio.",
    sub: "One World Labs crea tecnología de IA para pequeñas empresas y autónomos: aplicaciones que usas y servicios que gestionamos por ti, para que el trabajo llegue, los clientes reciban respuesta y el dinero acabe en tu cuenta.",
  },
  de: {
    head: "KI für die langweilige — aber lukrative — Hälfte Ihres Geschäfts.",
    sub: "One World Labs entwickelt KI für kleine Unternehmen und Selbstständige: Apps, die Sie selbst nutzen, und Dienste, die wir für Sie betreiben — damit Aufträge gefunden, Kunden beantwortet und Rechnungen bezahlt werden.",
  },
  ru: {
    head: "ИИ для скучной — но прибыльной — половины вашего дела.",
    sub: "One World Labs создаёт технологии ИИ для малого бизнеса и фрилансеров: приложения, которыми вы пользуетесь сами, и сервисы, которые мы ведём за вас — чтобы заказы находились, клиенты получали ответ, а деньги действительно приходили.",
  },
  zh: {
    head: "用 AI 处理生意里枯燥却赚钱的那一半。",
    sub: "One World Labs 为小微企业和自由职业者打造 AI 技术：既有你自己使用的应用，也有我们替你运营的服务——让活儿找得到、客户有人应、钱真的到账。",
  },
  pt: {
    head: "IA que cuida da parte chata — e lucrativa — do seu negócio.",
    sub: "A One World Labs cria tecnologia de IA para pequenos negócios e autônomos: aplicativos que você usa e serviços que operamos por você, para o trabalho aparecer, os clientes serem atendidos e o dinheiro realmente chegar.",
  },
};

/* ── THE `autoForward` PROP IS DELETED, NOT DEPRECATED ────────────────────────────────────────
   It used to read `ow.primary` off the device and navigate straight into that product. Lee
   reported the result about forty times — *"I should be able to go to One World Labs and just get
   to the One World Labs homepage"* — and it survived every one of those reports because it is
   invisible: the origin renders, then React navigates, so there is nothing in the network tab.

   `App.tsx` stopped passing it on 4 Aug 2026. Leaving the prop behind with a comment arguing for
   the behaviour would have been a loaded gun in a shared package — the next person to read it
   finds a documented switch that turns the bug back on. So the prop is gone.

   THE ORIGIN IS THE COMPANY. It renders One World, whatever the device remembers. */
export default function OneWorldEntry() {
  const { loading, userId } = useOneId();
  const { lang } = useI18n();
  const navigate = useNavigate();

  /* ── THE PARENT'S OWN COLOUR ──────────────────────────────────────────────────────────────
     This route mounts with OneJob's config to borrow the providers, so it inherited OneJob's
     hue — and the One World splash rendered on a green aurora with a green "World" in the
     wordmark and a green One ID pill. The company's own front door was wearing one product's
     colour, which is the same mistake as the green header, one layer down.

     `useLayoutEffect` in `AppShell` sets the config's hue before paint; this runs after and
     overrides it, which is the correct order — the product hue is the default, and this surface
     is the exception. */
  useLayoutEffect(() => { applyHue(ONE_WORLD_HUE); }, []);
  /* Nothing is decided until identity is. Rendering the splash for 80ms and then snapping into
     Your World is worse than rendering nothing for 80ms. */
  if (loading) return null;

  /* ── SIGNED IN IS THE ONLY STATE IN WHICH "YOUR WORLD" MEANS ANYTHING ──────────────────
     `/switch` used to render the switcher whether or not there was a session, so a signed-out
     visitor got a screen headed "Your World" listing eight products as though they owned none of
     them — with a Sign in button wedged into the middle of it. Lee, 4 Aug 2026: *"when you're
     not signed in you should see more of a marketing page, just like the rest of the splash
     screens are. And then when you sign in, then you see all of your items."*

     Exactly. Your World is a possessive; there is no "your" before there is a you. Both routes
     now run through here, so signed-out means the One World splash on either. */
  if (userId) return <OneWorldSwitcher />;

  /* Signed out WITH a known home: that product's own splash, not this one. `replace` so the back
     button cannot bounce between the two.

     ROOT ONLY. Somebody who taps "Your World" while signed out is asking what One World is, and
     bouncing them into OneJob's pitch answers a question they did not ask. The forward belongs
     to the front door, not to the screen you chose. */
  /* No forward here either. A device that remembers a HOME product still gets One World at
     the origin — the memory is used when SIGNING OUT, which is where it belongs. */

  /* ── THE ONE WORLD SPLASH ──────────────────────────────────────────────────────────────
     Lee: *"it kinda does some little bit of stuff below the login. Kinda like how the rest of
     the apps look on the splash screen. It should mimic the same look — all the splash screens
     should be basically the same, right, with just different text."*

     So this is the SAME `Splash` component the eight products use, given One World's words and
     One World's mark. Not a bespoke screen: if the splash layout changes for one product it
     changes here too, which is the only way eight-plus-one stays one family. */
  return (
    <Splash
      headline={(OW_COPY[lang] ?? OW_COPY.en).head}
      sub={(OW_COPY[lang] ?? OW_COPY.en).sub}
      wordmark={{ ink: "ne", brand: "World", tagline: "Small business solutions", markSrc: "/mark-oneworld.png" }}
      below={<ProductMarquee />}
      onSignIn={() => navigate("/signin")}
      onJoin={() => navigate("/join")}
    />
  );
}

/** Mirror the database's record of where somebody entered into device storage, so the signed-out
 *  screen has something to read. Mounted by the shell wherever identity is available. */
export function usePrimaryMirror(primary: Product | null) {
  useEffect(() => { rememberPrimary(primary); }, [primary]);
}
