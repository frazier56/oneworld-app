import { createContext, useContext, useEffect, useState } from "react";
import { readPref, writePref } from "./safeStorage";

/**
 * THE CANONICAL ONE WORLD LANGUAGE LIST — read off the hub, not invented here.
 *
 * `www.oneworldlabs.ai` holds the canon and already ships real copy for all seven. Verified
 * against the running page on 2 Aug 2026. Apps are brought into line with it, never the reverse.
 *
 * Chosen by COUNTRY, not language, and the distinction is load-bearing: Colombia and Spain are
 * both Spanish and they are not the same Spanish. OneJob originally mapped both to `es`, so the
 * picker listed two rows, both set the language to `es`, and the header flag resolved to
 * whichever row came FIRST — choosing Espana painted a Colombian flag. A live defect, caused
 * entirely by not matching the hub.
 */
export const ONE_WORLD_LANGS = [
  { code: "en", cc: "us", label: "English",   country: "USA" },
  { code: "co", cc: "co", label: "Español",   country: "Colombia" },
  { code: "es", cc: "es", label: "Español",   country: "España" },
  { code: "de", cc: "de", label: "Deutsch",   country: "Deutschland" },
  { code: "ru", cc: "ru", label: "Русский",   country: "Россия" },
  { code: "zh", cc: "cn", label: "中文",       country: "中国" },
  { code: "pt", cc: "br", label: "Português", country: "Brasil" },
] as const;

export type Lang = (typeof ONE_WORLD_LANGS)[number]["code"];

/**
 * Which languages this app actually carries. A language is offered ONLY when its dictionary is
 * real — a member in Berlin who taps the German flag and sees no change concludes the app is
 * broken, and on a screen that moves money a silent English fallback is a defect, not a rough
 * edge.
 *
 * Derived from the dictionary rather than hand-maintained, so it can never claim a language the
 * app does not have. Treat every missing language as an open task with a date, not a decision:
 * the hub offers seven and an app offering three makes the family look unfinished.
 */
export const readyLangs = (dict: Record<string, Record<string, string>>) =>
  ONE_WORLD_LANGS.filter(l => dict[l.code] && Object.keys(dict[l.code]).length > 0);

/* `dict` is on the context because the language PICKER needs it. `readyLangs(dict)` is what
   guarantees a flag is only offered when its dictionary is real, and a picker that had to be
   handed the dictionary as a prop by every caller would eventually be handed the wrong one. */
const Ctx = createContext<{
  lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string;
  dict: Record<string, Record<string, string>>;
} | null>(null);

/** The language choice is shared across all five apps, like the session. */
const LANG_KEY = "oneworld-lang";

/**
 * `defaultLang` — THE LANGUAGE A PRODUCT OPENS IN (added 10 Aug 2026 for OneRental).
 * A DEFAULT, NOT A LOCK: a stored choice always wins, so somebody who set English in OneJob is
 * not flipped to Spanish by walking into OneRental. Per product, so it cannot leak. Opt-in, so
 * every other product still opens in English byte-identically.
 */
export function I18nProvider({ dict, defaultLang, children }:
  { dict: Record<string, Record<string, string>>; defaultLang?: Lang; children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (readPref(LANG_KEY) as Lang) || defaultLang || "en");
  useEffect(() => {
    writePref(LANG_KEY, lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang === "co" ? "es" : lang;
  }, [lang]);
  const t = (k: string) => dict[lang]?.[k] ?? dict.en?.[k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t, dict }}>{children}</Ctx.Provider>;
}

export const useI18n = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("[oneworld-shell] useI18n() outside <I18nProvider>. Mount <AppShell>.");
  return v;
};

/** Inline bilingual copy for strings built at runtime. "co" is Spanish — a bare `=== "es"`
 *  test silently served English to every user in Colombia. */
export const W = (lang: string, en: string, es: string) =>
  lang === "es" || lang === "co" ? es : en;

export type Localized = { en: string } & Partial<Record<Lang, string>>;
export const WA = (lang: string, t: Localized): string => (t as Record<string, string | undefined>)[lang] ?? (lang === "co" ? t.es : undefined) ?? t.en;
