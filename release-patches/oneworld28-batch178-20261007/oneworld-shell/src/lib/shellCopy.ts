import type { Lang } from "./i18n";

/**
 * THE CHROME'S SENTENCES — the ones that are not single UI words.
 * ============================================================================================
 * `shellDict` holds the short labels a product DECLARES ("Sign in", "Settings"). This file holds
 * the shell's own full sentences: the One ID badge, the marquee's label and hint, the privacy
 * line. They are different in one way that matters — a product cannot opt out of them, because
 * they belong to surfaces the shell owns outright (the splash, Your World, the marquee).
 *
 * ── Why this exists at all ───────────────────────────────────────────────────────────────────
 * All seven flags were switched on and then UAT'd at phone width, in Portuguese. The headline,
 * the sub, "Entrar" and "Cadastrar" all translated — and directly underneath them sat "Works
 * across all apps", "SIX APPS · THREE SERVICES", "Tap any one to see what it does" and the
 * whole privacy line, in English. That is precisely the half-translated screen `shellDict`'s
 * doc comment warns about, reintroduced from the other end: the words were not in the dictionary
 * to begin with, so nothing could have caught it.
 *
 * Falls back to English by key, so an untranslated string degrades to English rather than to a
 * raw key on screen.
 */

type Key =
  | "oneIdWorks"
  | "oneIdSignedIn"
  | "groups"
  | "marqueeHint"
  | "oneIdNotice"
  | "dataUse"
  | "slideToDisconnect"
  | "yourWorld"
  | "yourWorldSub"
  | "connected"
  | "notConnected"
  | "everything"
  | "homeLabel"
  | "homeNotSet"
  | "change"
  | "signOutReturns"
  | "searchPh"
  | "composerPh"
  | "composeVideo"
  | "composePhoto"
  | "composeWrite"
  | "composeLive";

const EN: Record<Key, string> = {
  oneIdWorks: "Works across all apps",
  oneIdSignedIn: "You are signed in across all apps",
  groups: "Eight apps · Three services",
  marqueeHint: "Tap any one to see what it does",
  oneIdNotice:
    "One ID · one account for all of One World Labs — OneJob, OneScore, OneEvent, OneSocial, OneAgent, OneHome, OneVoice, OnePage and OneApp.",
  dataUse: "How your data is used",
  slideToDisconnect: "Slide to disconnect",
  yourWorld: "Your World.",
  yourWorldSub: "AI-based solutions for small businesses and freelancers.",
  connected: "Connected",
  notConnected: "Not connected yet",
  everything: "Everything in One World",
  homeLabel: "Home",
  homeNotSet: "not set",
  change: "change",
  signOutReturns: "Signing out brings you back here.",
  searchPh: "Search",
  composerPh: "Start something…",
  composeVideo: "Video",
  composePhoto: "Photo",
  composeWrite: "Write",
  composeLive: "Go Live",
};

const CO: Record<Key, string> = {
  oneIdWorks: "Funciona en todas las aplicaciones",
  oneIdSignedIn: "Su sesión está iniciada en todas las aplicaciones",
  groups: "Ocho aplicaciones · Tres servicios",
  marqueeHint: "Toque cualquiera para ver qué hace",
  oneIdNotice:
    "One ID · una sola cuenta para todo One World Labs — OneJob, OneScore, OneEvent, OneSocial, OneAgent, OneHome, OneVoice, OnePage y OneApp.",
  dataUse: "Cómo se usan sus datos",
  slideToDisconnect: "Deslice para desconectar",
  yourWorld: "Su mundo.",
  yourWorldSub: "Soluciones con IA para pequeñas empresas y trabajadores independientes.",
  connected: "Conectados",
  notConnected: "Aún sin conectar",
  everything: "Todo en One World",
  homeLabel: "Principal",
  homeNotSet: "sin definir",
  change: "cambiar",
  signOutReturns: "Al cerrar sesión volverá aquí.",
  searchPh: "Buscar",
  composerPh: "Empiece algo…",
  composeVideo: "Video",
  composePhoto: "Foto",
  composeWrite: "Escribir",
  composeLive: "En vivo",
};

const ES: Record<Key, string> = {
  oneIdWorks: "Funciona en todas las aplicaciones",
  oneIdSignedIn: "Has iniciado sesión en todas las aplicaciones",
  groups: "Ocho aplicaciones · Tres servicios",
  marqueeHint: "Toca cualquiera para ver qué hace",
  oneIdNotice:
    "One ID · una sola cuenta para todo One World Labs — OneJob, OneScore, OneEvent, OneSocial, OneAgent, OneHome, OneVoice, OnePage y OneApp.",
  dataUse: "Cómo se usan tus datos",
  slideToDisconnect: "Desliza para desconectar",
  yourWorld: "Tu mundo.",
  yourWorldSub: "Soluciones con IA para pequeñas empresas y autónomos.",
  connected: "Conectados",
  notConnected: "Aún sin conectar",
  everything: "Todo en One World",
  homeLabel: "Principal",
  homeNotSet: "sin definir",
  change: "cambiar",
  signOutReturns: "Al cerrar sesión volverás aquí.",
  searchPh: "Buscar",
  composerPh: "Empieza algo…",
  composeVideo: "Video",
  composePhoto: "Foto",
  composeWrite: "Escribir",
  composeLive: "En vivo",
};

const DE: Record<Key, string> = {
  oneIdWorks: "Gilt für alle Apps",
  oneIdSignedIn: "Du bist in allen Apps angemeldet",
  groups: "Acht Apps · Drei Dienste",
  marqueeHint: "Tippe eine an, um zu sehen, was sie macht",
  oneIdNotice:
    "One ID · ein Konto für ganz One World Labs — OneJob, OneScore, OneEvent, OneSocial, OneAgent, OneHome, OneVoice, OnePage und OneApp.",
  dataUse: "So werden deine Daten verwendet",
  slideToDisconnect: "Zum Trennen wischen",
  yourWorld: "Deine Welt.",
  yourWorldSub: "KI-Lösungen für kleine Unternehmen und Selbstständige.",
  connected: "Verbunden",
  notConnected: "Noch nicht verbunden",
  everything: "Alles in One World",
  homeLabel: "Start",
  homeNotSet: "nicht gesetzt",
  change: "ändern",
  signOutReturns: "Beim Abmelden landest du wieder hier.",
  searchPh: "Suchen",
  composerPh: "Leg los…",
  composeVideo: "Video",
  composePhoto: "Foto",
  composeWrite: "Schreiben",
  composeLive: "Live gehen",
};

const RU: Record<Key, string> = {
  oneIdWorks: "Работает во всех приложениях",
  oneIdSignedIn: "Вы вошли во все приложения",
  groups: "Восемь приложений · Три сервиса",
  marqueeHint: "Нажмите на любое, чтобы узнать, что оно делает",
  oneIdNotice:
    "One ID · один аккаунт для всего One World Labs — OneJob, OneScore, OneEvent, OneSocial, OneAgent, OneHome, OneVoice, OnePage и OneApp.",
  dataUse: "Как используются ваши данные",
  slideToDisconnect: "Проведите, чтобы отключить",
  yourWorld: "Ваш мир.",
  yourWorldSub: "Решения на базе ИИ для малого бизнеса и фрилансеров.",
  connected: "Подключено",
  notConnected: "Ещё не подключено",
  everything: "Всё в One World",
  homeLabel: "Главное",
  homeNotSet: "не выбрано",
  change: "изменить",
  signOutReturns: "После выхода вы вернётесь сюда.",
  searchPh: "Поиск",
  composerPh: "Начните что-нибудь…",
  composeVideo: "Видео",
  composePhoto: "Фото",
  composeWrite: "Написать",
  composeLive: "Эфир",
};

const ZH: Record<Key, string> = {
  oneIdWorks: "适用于所有应用",
  oneIdSignedIn: "您已在所有应用中登录",
  groups: "八个应用 · 三项服务",
  marqueeHint: "点按任意一个，看看它能做什么",
  oneIdNotice:
    "One ID · 一个账号通行整个 One World Labs — OneJob、OneScore、OneEvent、OneSocial、OneAgent、OneHome、OneVoice、OnePage 和 OneApp。",
  dataUse: "我们如何使用您的数据",
  slideToDisconnect: "滑动以断开连接",
  yourWorld: "你的世界。",
  yourWorldSub: "面向小微企业和自由职业者的 AI 解决方案。",
  connected: "已连接",
  notConnected: "尚未连接",
  everything: "One World 的全部",
  homeLabel: "主应用",
  homeNotSet: "未设置",
  change: "更改",
  signOutReturns: "退出登录后会回到这里。",
  searchPh: "搜索",
  composerPh: "开始一件事…",
  composeVideo: "视频",
  composePhoto: "照片",
  composeWrite: "写点什么",
  composeLive: "直播",
};

const PT: Record<Key, string> = {
  oneIdWorks: "Funciona em todos os aplicativos",
  oneIdSignedIn: "Você está conectado em todos os aplicativos",
  groups: "Oito aplicativos · Três serviços",
  marqueeHint: "Toque em qualquer um para ver o que ele faz",
  oneIdNotice:
    "One ID · uma conta para todo o One World Labs — OneJob, OneScore, OneEvent, OneSocial, OneAgent, OneHome, OneVoice, OnePage e OneApp.",
  dataUse: "Como seus dados são usados",
  slideToDisconnect: "Deslize para desconectar",
  yourWorld: "Seu mundo.",
  yourWorldSub: "Soluções com IA para pequenos negócios e profissionais autônomos.",
  connected: "Conectados",
  notConnected: "Ainda não conectados",
  everything: "Tudo no One World",
  homeLabel: "Principal",
  homeNotSet: "não definido",
  change: "alterar",
  signOutReturns: "Ao sair, você volta para cá.",
  searchPh: "Buscar",
  composerPh: "Comece algo…",
  composeVideo: "Vídeo",
  composePhoto: "Foto",
  composeWrite: "Escrever",
  composeLive: "Ao vivo",
};

const ALL: Record<Lang, Record<Key, string>> = { en: EN, co: CO, es: ES, de: DE, ru: RU, zh: ZH, pt: PT };

/** One chrome sentence in the current language, falling back to English per key. */
export function sc(lang: Lang | string, key: Key): string {
  return (ALL as Record<string, Record<Key, string>>)[lang]?.[key] ?? EN[key];
}

/** Exported for the test harness: every language must carry every key. */
export const SHELL_COPY = ALL;
