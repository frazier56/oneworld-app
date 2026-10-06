import type { Lang } from "./i18n";
import type { AppConfig } from "../config";

export const ONEBUSINESS_TAGLINES: Record<Lang, string> = {
  en: "Every service, one account",
  co: "Todos los servicios, una cuenta",
  es: "Todos los servicios, una cuenta",
  de: "Alle Services, ein Konto",
  ru: "Все услуги — один аккаунт",
  zh: "所有服务，一个账户",
  pt: "Todos os serviços, uma conta",
};

/* ── ONEHOME'S TAGLINE WAS SPANISH IN EVERY LANGUAGE (14 Sep 2026) ──────────────────────────
   Nine products define a tagline and seven of them are English. OneHome's two sections are the
   exceptions: "Arriendo con contrato" and "Compra y venta con historial" are written straight
   into `products/index.ts` with no language branch, so an English, German or Portuguese reader
   has been looking at Spanish in the header of every single OneHome screen.

   It hid because the words are the product's whole promise and read as branding — but a tagline
   is a SENTENCE, and the rule is the same one that put the photo menu into seven languages: a
   member who taps their flag and still gets Spanish concludes the app is broken.

   One map, applied by both headers, so the classic bar and the reveal bar can never disagree.
   `tagScale()` in `Wordmark.tsx` already sizes a tagline by its length, so the longer English
   and German lines fit without a second measurement. */
export const HOME_TAGLINES: Record<"onerental" | "onesale", Record<Lang, string>> = {
  onerental: {
    en: "Renting, with a contract",
    es: "Arriendo con contrato",
    co: "Arriendo con contrato",
    de: "Mieten mit Vertrag",
    ru: "Аренда по договору",
    zh: "有合同的租赁",
    pt: "Aluguel com contrato",
  },
  onesale: {
    en: "Buying and selling, on record",
    es: "Compra y venta con historial",
    co: "Compra y venta con historial",
    de: "Kaufen und verkaufen mit Historie",
    ru: "Покупка и продажа с историей",
    zh: "有记录的买卖",
    pt: "Compra e venda com histórico",
  },
};

/** The wordmark a header should draw: the product's own, with any language-dependent tagline
 *  swapped in. Both headers call this, so neither can drift from the other. */
export function localisedWordmark(config: AppConfig, lang: Lang): AppConfig["wordmark"] {
  if (config.key === "onebusiness") return { ...config.wordmark, tagline: ONEBUSINESS_TAGLINES[lang] ?? ONEBUSINESS_TAGLINES.en };
  const home = HOME_TAGLINES[config.key as "onerental" | "onesale"];
  if (home) {
    return {
      ...config.wordmark,
      tagline: home[lang] ?? home.en,
      /* ── BOTH ONEHOME SECTIONS WEAR ONE MARK, AND IT IS THE BLUE ONE ────────────────────
         One app, one face — but the face was `mark-onerental.png`, which is drawn in TEAL
         (#18D8C0 measured). Two things wrong with that at once. Lee, 14 Sep 2026: *"the OneHome
         O logo really should be in blue."* And teal is reserved ecosystem-wide for STATE, never
         for identity, so a teal brand mark was a rule break as well as a preference miss.
         `mark-onesale.png` is the same artwork already drawn in OneHome's sky blue (#18A8D8),
         so this is a file swap, not new artwork — and it retires the `hue-rotate` filter in
         `headerReveal.css` that was trying to fake it (and could not, because the crescent is
         near-black and a hue rotation cannot colour something with no hue). */
      markSrc: config.wordmark.brand === "Home" ? "/mark-onesale.png" : config.wordmark.markSrc,
    };
  }
  return config.wordmark;
}

