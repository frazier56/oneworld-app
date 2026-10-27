import { Link } from "react-router-dom";
import { useI18n, WA, type Localized } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { WORLD_FEED_HOME, GUEST_FEED } from "../lib/authReturn";

/**
 * ONE "NOT FOUND" SCREEN FOR EVERY APP (UX review #7, 22 Oct 2026; ONEWORLD 31).
 * ============================================================================================
 * The review found four different answers to "that is not here":
 *   · a mistyped address quietly showed the home page, with no message;
 *   · a missing member's profile drew an empty page — "·" for a photo, "—" for a name — with
 *     WORKING Connect and Message buttons that invited a visitor to message nobody;
 *   · an unknown screen inside an app drew a developer panel ("The shell is live on this route…",
 *     the session, the user id);
 *   · listings and events each said it their own way, one with a button, one with a text link.
 * A visitor cannot tell a broken link from a real but empty page. So there is one screen, one
 * sentence of what happened, one sentence of why it usually happens, and one way out: the feed.
 * Products show it with `kind` for their own noun ("listing", "event", "job") so the words fit.
 */
export type NotFoundKind = "page" | "profile" | "listing" | "event" | "job";

const TITLE: Record<NotFoundKind, Localized> = {
  page: { en: "This page isn't here", es: "Esta página no existe", de: "Diese Seite gibt es nicht", pt: "Esta página não existe", ru: "Такой страницы нет", zh: "此页面不存在" },
  profile: { en: "We couldn't find this person", es: "No encontramos a esta persona", de: "Diese Person haben wir nicht gefunden", pt: "Não encontramos esta pessoa", ru: "Мы не нашли этого человека", zh: "找不到此用户" },
  listing: { en: "This listing isn't here", es: "Este anuncio no existe", de: "Dieses Inserat gibt es nicht", pt: "Este anúncio não existe", ru: "Такого объявления нет", zh: "此房源不存在" },
  event: { en: "This event isn't here", es: "Este evento no existe", de: "Diese Veranstaltung gibt es nicht", pt: "Este evento não existe", ru: "Такого события нет", zh: "此活动不存在" },
  job: { en: "This job isn't here", es: "Este trabajo no existe", de: "Diesen Auftrag gibt es nicht", pt: "Este trabalho não existe", ru: "Такой работы нет", zh: "此工作不存在" },
};
const WHY: Localized = {
  en: "The link may be old or mistyped, or it was removed.",
  es: "Puede que el enlace sea antiguo, esté mal escrito o se haya eliminado.",
  de: "Der Link ist vielleicht veraltet, falsch geschrieben oder wurde entfernt.",
  pt: "O link pode estar antigo, digitado errado ou ter sido removido.",
  ru: "Возможно, ссылка устарела, набрана с ошибкой или была удалена.",
  zh: "链接可能已过期、输入有误或已被删除。",
};
const GO: Localized = {
  en: "Go to the One World feed", es: "Ir al feed de One World", de: "Zum One World Feed", pt: "Ir para o feed do One World", ru: "Перейти в ленту One World", zh: "前往 One World 动态",
};

export default function NotFound({ kind = "page" }: { kind?: NotFoundKind }) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center" data-ow-notfound={kind}>
      <div className="card w-full !rounded-3xl px-6 py-8">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mx-auto opacity-50">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /><path d="M8.5 8.5l5 5M13.5 8.5l-5 5" />
        </svg>
        <h1 className="mt-4 text-[22px] font-extrabold leading-tight">{WA(lang, TITLE[kind] ?? TITLE.page)}</h1>
        <p className="mt-2 text-[14px] leading-snug opacity-65">{WA(lang, WHY)}</p>
        <Link to={userId ? WORLD_FEED_HOME : GUEST_FEED} className="btn-primary mt-6 block w-full text-center">
          {WA(lang, GO)}
        </Link>
      </div>
    </div>
  );
}

/** True for a well-formed id; anything else can never be a member, so it is "not found" without a read. */
export const isUuid = (v: string | undefined | null): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
