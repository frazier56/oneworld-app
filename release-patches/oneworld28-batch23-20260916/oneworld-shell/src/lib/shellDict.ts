import type { Lang } from "./i18n";
import { SHELL_STRINGS } from "../config";

/**
 * THE SHELL'S OWN WORDS, IN ALL SEVEN LANGUAGES.
 * ============================================================================================
 * The chrome is this package's responsibility, so its translations are too. A product that had
 * to supply "Sign in" in Russian itself would supply it slightly differently from the product
 * next door, and the family would be translated eight times over — badly, and inconsistently.
 *
 * ── Why this is a function and not a constant ────────────────────────────────────────────────
 * The language picker is derived from the dictionary: a flag is offered ONLY when its
 * dictionary is real (`readyLangs`), so a member can never tap a flag and watch nothing happen.
 *
 * If this file simply merged all seven languages into every product, that guarantee would
 * invert: every product would advertise seven languages, the chrome would translate, and the
 * product's own screens would silently fall back to English. Half a translation reads as
 * broken, and on a screen that moves money it is a defect rather than a rough edge.
 *
 * So a product DECLARES the languages it actually carries, and gets the shell's words for
 * exactly those. Adding German to a product is one entry in that list plus real German copy —
 * and if the copy is missing, `assertConfig` throws at startup instead of shipping.
 *
 * ── Spanish is TWO entries and that is deliberate ────────────────────────────────────────────
 * `es` (España) and `co` (Colombia) are separate. They are not the same Spanish, and Colombia is
 * the larger market here. OneJob originally mapped both to `es`, so the picker listed two rows,
 * both set the language to `es`, and the header flag resolved to whichever row came FIRST —
 * choosing España painted a Colombian flag. A live defect, caused by treating them as one.
 */

type Row = Record<(typeof SHELL_STRINGS)[number], string>;

const EN: Row = {
  signin: "Sign in", signout: "Sign out", join: "Create account",
  continueGoogle: "Continue with Google", continueApple: "Continue with Apple", comingSoon: "Coming soon",
  continueEmail: "Continue with email", emailPlaceholder: "you@email.com",
  sendCode: "Send code", enterCode: "Enter the code", verify: "Verify",
  codeSent: "Check your email for the 6-digit code",
  home: "Home", messages: "Messages", profile: "Profile", settings: "Settings",
  language: "Language", theme: "Theme", back: "Back", menu: "Menu", close: "Close",
  vaiaInsights: "Tap for insights", vaiaInsightsAria: "Tap VAIA for insights",
  notifications: "Notifications", notificationsUnread: "Unread notifications: {count}",
  country: "Country", currency: "Currency", pricesIn: "Prices in",
  ratesLoading: "Loading today's rates…",
};

/* Colombia. Voseo avoided, "usted" register — this is a platform people are paid through, and
   the tú/usted choice is the difference between reading as a friend and reading as a business. */
const CO: Row = {
  signin: "Iniciar sesión", signout: "Cerrar sesión", join: "Registrarse",
  continueGoogle: "Continuar con Google", continueApple: "Continuar con Apple", comingSoon: "Próximamente",
  continueEmail: "Continuar con correo", emailPlaceholder: "usted@correo.com",
  sendCode: "Enviar código", enterCode: "Ingrese el código", verify: "Verificar",
  codeSent: "Revise su correo: le enviamos un código de 6 dígitos",
  home: "Inicio", messages: "Mensajes", profile: "Perfil", settings: "Ajustes",
  language: "Idioma", theme: "Tema", back: "Atrás", menu: "Menú", close: "Cerrar",
  vaiaInsights: "Toque para ver ideas", vaiaInsightsAria: "Toque VAIA para ver ideas",
  notifications: "Notificaciones", notificationsUnread: "Notificaciones sin leer: {count}",
  country: "País", currency: "Moneda", pricesIn: "Precios en",
  ratesLoading: "Cargando las tasas de hoy…",
};

/* España. "Correo electrónico" in full, tú register, and `vosotros` never appears in interface
   copy — it dates the product instantly. */
const ES: Row = {
  signin: "Iniciar sesión", signout: "Cerrar sesión", join: "Únete",
  continueGoogle: "Continuar con Google", continueApple: "Continuar con Apple", comingSoon: "Próximamente",
  continueEmail: "Continuar con correo electrónico", emailPlaceholder: "tu@correo.com",
  sendCode: "Enviar código", enterCode: "Introduce el código", verify: "Verificar",
  codeSent: "Revisa tu correo: te enviamos un código de 6 dígitos",
  home: "Inicio", messages: "Mensajes", profile: "Perfil", settings: "Ajustes",
  language: "Idioma", theme: "Tema", back: "Atrás", menu: "Menú", close: "Cerrar",
  vaiaInsights: "Toca para ver ideas", vaiaInsightsAria: "Toca VAIA para ver ideas",
  notifications: "Notificaciones", notificationsUnread: "Notificaciones sin leer: {count}",
  country: "País", currency: "Moneda", pricesIn: "Precios en",
  ratesLoading: "Cargando las tasas de hoy…",
};

const DE: Row = {
  signin: "Anmelden", signout: "Abmelden", join: "Registrieren",
  continueGoogle: "Weiter mit Google", continueApple: "Weiter mit Apple", comingSoon: "Demnächst",
  continueEmail: "Weiter mit E-Mail", emailPlaceholder: "du@email.de",
  sendCode: "Code senden", enterCode: "Code eingeben", verify: "Bestätigen",
  codeSent: "Sieh in deiner E-Mail nach dem 6-stelligen Code",
  home: "Start", messages: "Nachrichten", profile: "Profil", settings: "Einstellungen",
  language: "Sprache", theme: "Design", back: "Zurück", menu: "Menü", close: "Schließen",
  vaiaInsights: "Für Einblicke tippen", vaiaInsightsAria: "VAIA für Einblicke antippen",
  notifications: "Benachrichtigungen", notificationsUnread: "Ungelesene Benachrichtigungen: {count}",
  country: "Land", currency: "Währung", pricesIn: "Preise in",
  ratesLoading: "Heutige Wechselkurse werden geladen…",
};

const RU: Row = {
  signin: "Войти", signout: "Выйти", join: "Регистрация",
  continueGoogle: "Продолжить с Google", continueApple: "Продолжить с Apple", comingSoon: "Скоро",
  continueEmail: "Продолжить по почте", emailPlaceholder: "you@email.com",
  sendCode: "Отправить код", enterCode: "Введите код", verify: "Подтвердить",
  codeSent: "Проверьте почту — мы отправили 6-значный код",
  home: "Главная", messages: "Сообщения", profile: "Профиль", settings: "Настройки",
  language: "Язык", theme: "Тема", back: "Назад", menu: "Меню", close: "Закрыть",
  vaiaInsights: "Нажмите для подсказок", vaiaInsightsAria: "Нажмите VAIA, чтобы получить подсказки",
  notifications: "Уведомления", notificationsUnread: "Непрочитанные уведомления: {count}",
  country: "Страна", currency: "Валюта", pricesIn: "Цены в",
  ratesLoading: "Загружаются сегодняшние курсы…",
};

const ZH: Row = {
  signin: "登录", signout: "退出登录", join: "注册",
  continueGoogle: "使用 Google 继续", continueApple: "使用 Apple 继续", comingSoon: "即将推出",
  continueEmail: "使用邮箱继续", emailPlaceholder: "you@email.com",
  sendCode: "发送验证码", enterCode: "输入验证码", verify: "验证",
  codeSent: "请查收邮箱中的 6 位验证码",
  home: "首页", messages: "消息", profile: "我的", settings: "设置",
  language: "语言", theme: "主题", back: "返回", menu: "菜单", close: "关闭",
  vaiaInsights: "点按查看洞察", vaiaInsightsAria: "点按 VAIA 查看洞察",
  notifications: "通知", notificationsUnread: "未读通知：{count}",
  country: "国家", currency: "货币", pricesIn: "价格币种",
  ratesLoading: "正在加载今日汇率…",
};

/* Brazil, not Portugal. "Você", and "e-mail" with the hyphen, which is the Brazilian norm. */
const PT: Row = {
  signin: "Entrar", signout: "Sair", join: "Cadastrar",
  continueGoogle: "Continuar com Google", continueApple: "Continuar com Apple", comingSoon: "Em breve",
  continueEmail: "Continuar com e-mail", emailPlaceholder: "voce@email.com",
  sendCode: "Enviar código", enterCode: "Digite o código", verify: "Verificar",
  codeSent: "Confira seu e-mail: enviamos um código de 6 dígitos",
  home: "Início", messages: "Mensagens", profile: "Perfil", settings: "Configurações",
  language: "Idioma", theme: "Tema", back: "Voltar", menu: "Menu", close: "Fechar",
  vaiaInsights: "Toque para ver insights", vaiaInsightsAria: "Toque em VAIA para ver insights",
  notifications: "Notificações", notificationsUnread: "Notificações não lidas: {count}",
  country: "País", currency: "Moeda", pricesIn: "Preços em",
  ratesLoading: "Carregando as taxas de hoje…",
};

const ALL: Record<Lang, Row> = { en: EN, co: CO, es: ES, de: DE, ru: RU, zh: ZH, pt: PT };

/**
 * The shell's words for exactly the languages a product carries.
 *
 * English is always included whether or not it is asked for: it is the fallback every other
 * language falls back TO, and a dictionary with no `en` produces raw keys on screen.
 */
export function shellDict(langs: readonly Lang[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = { en: { ...EN } };
  for (const l of langs) out[l] = { ...ALL[l] };
  return out;
}
