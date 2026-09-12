import type { AppConfig } from "../config";
import type { AppKey } from "../lib/oneWorld";
import { PRODUCT_PATH } from "../routes";
import { HUES } from "./hues";
import { shellDict } from "../lib/shellDict";
import {
  RENTAL_HOST_FEE_PCT,
  RENTAL_GUEST_FEE_PCT,
  RENTAL_FEE_PCT,
} from "../lib/supabase";

/**
 * EIGHT SHELLS, ONE FILE.
 * ============================================================================================
 * Lee, 3 Aug 2026: *"we might as well build the shells for the 3 services too… the header needs
 * to be the same, the hamburger icon needs to reflect the same information, the footer
 * information is going to vary depending on the app anyway, but still the shell needs to be
 * there — the login stuff, the header, the hamburger thing, the footer. They'll just have
 * different footer information."*
 *
 * This is that, for all eight. Every product below is a complete, mountable shell today: header,
 * drawer, sign-in, terms gate, translation, and whatever footer it should have. What none of
 * them have yet is SCREENS — those are what each product's own thread builds, and they land as
 * routes inside the shell without touching anything here.
 *
 * ── The rule these configs exist to enforce ──────────────────────────────────────────────────
 * A product may vary its hue, its wordmark, its footer tabs, its drawer extras, its copy and its
 * terms. Nothing else. If a product needs to change the header or the drawer, that change is
 * made HERE, once, for all eight — that is the entire point of the package.
 *
 * ── Language coverage, stated honestly ───────────────────────────────────────────────────────
 * Every product declares `["co", "es"]` alongside English today. The hub offers seven, and
 * seven is the target — but a language is offered only when the copy is real, so a product
 * claiming German it does not have would ship a flag that half-works. Adding a language is one
 * entry in the list plus real copy, and `assertConfig` throws at startup if the copy is missing.
 * The gap is an open task with a date, not a decision.
 */

/**
 * ALL SEVEN. Lee, 4 Aug 2026: *"there's only seven flags. I will put the seven flags that we
 * already have coded... they can click the flag they want, but they need to work."*
 *
 * The shell's own words — Sign in, Join, Menu, Home, Messages, Profile, Settings, Close — have
 * existed in all seven since the package was written; the products were only DECLARING three, so
 * `readyLangs` offered three. Four complete translations were sitting unused.
 *
 * `assertConfig` still enforces the real guarantee: a language may only be offered if every SHELL
 * string exists in it. That is what stops a flag doing nothing. Product-specific copy — a splash
 * headline, a terms bullet — falls back to English until it is written, and each product's thread
 * owns writing it.
 */
const LANGS = ["co", "es", "de", "ru", "zh", "pt"] as const;

/** Every path is under the product's own root — one origin, so a tab is a route. */
const p = (k: AppKey, sub = "") => `${PRODUCT_PATH[k]}${sub}`;

/** Terms live on the hub, one document per product. */
const terms = (k: AppKey) => `https://www.oneworldlabs.ai/terms/${k}`;

/* ══════════════════════════════════════════════════════════════════════════════════════════
   THE FIVE CONSUMER APPS — five tabs, primary in the middle, Messages fourth, Profile last.
   `assertConfig` enforces every one of those, because a member who learns "bottom-right is me"
   in one product must find it in the same place in the next.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export const ONEJOB: AppConfig = {
  key: "onejob",
  wordmark: { ink: "ne", brand: "Job", tagline: "Get hired · Get paid", markSrc: "/mark-onejob.png" },
  hue: HUES.onejob,
  tabs: [
    { to: p("onejob"),             labelKey: "home",     icon: "home" },
    { to: p("onejob", "/jobs"),    labelKey: "jobs",     icon: "jobs" },
    /* THE MONEY BUTTON. Every job on the platform starts here, and it is the only reason the
       centre slot is raised at all. */
    { to: p("onejob", "/qr"),      labelKey: "qrpay",    icon: "money", primary: true },
    { to: p("onejob", "/messages"), labelKey: "messages", icon: "messages" },
    { to: p("onejob", "/profile"), labelKey: "profile",  icon: "profile" },
  ],
  notificationsPath: p("onejob", "/alerts"),
  drawerExtras: [
    { to: p("onejob", "/calendar"), labelKey: "calendar", icon: "calendar" },
    { to: p("onejob", "/plans"),    labelKey: "plans",    icon: "plans" },
    { to: p("onejob", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onejob") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      jobs: "My jobs", qrpay: "Start a job", calendar: "Calendar", plans: "Plans",
      splashHead: "Get hired. Get paid.",
      splashSub: "Real work, real people, money that actually arrives.",
      splashPitch: "OneJob is where small jobs get agreed, done and paid for. Both sides sign the same plain-language contract, the money is held from the moment the job is agreed, and it is released when the work is finished. No invoice, and no awkward follow-up message a fortnight later.",
      termsTitle: "Before you use OneJob",
      termsP1: "Work you complete here counts toward your OneScore.",
      termsP2: "Payment is held until the work is marked done by both sides.",
      termsP3: "One World Labs charges a platform fee on each completed job.",
    },
    co: {
      jobs: "Mis trabajos", qrpay: "Iniciar trabajo", calendar: "Calendario", plans: "Planes",
      splashHead: "Consiga trabajo. Reciba su pago.",
      splashSub: "Trabajo real, personas reales, dinero que sí llega.",
      splashPitch: "OneJob es donde los trabajos pequeños se acuerdan, se hacen y se pagan. Ambas partes firman el mismo contrato en lenguaje sencillo, el dinero queda retenido desde que se acuerda el trabajo y se libera cuando termina. Sin facturas y sin tener que perseguir a nadie después.",
      termsTitle: "Antes de usar OneJob",
      termsP1: "El trabajo que complete aquí cuenta para su OneScore.",
      termsP2: "El pago se retiene hasta que ambas partes marquen el trabajo como terminado.",
      termsP3: "One World Labs cobra una comisión por cada trabajo completado.",
    },
    es: {
      jobs: "Mis trabajos", qrpay: "Iniciar trabajo", calendar: "Calendario", plans: "Planes",
      splashHead: "Encuentra trabajo. Cobra.",
      splashSub: "Trabajo real, personas reales, dinero que llega de verdad.",
      splashPitch: "OneJob es donde los trabajos pequeños se acuerdan, se hacen y se pagan. Ambas partes firman el mismo contrato en lenguaje claro, el dinero queda retenido desde que se acuerda el trabajo y se libera al terminarlo. Sin facturas y sin perseguir a nadie después.",
      termsTitle: "Antes de usar OneJob",
      termsP1: "El trabajo que completes aquí cuenta para tu OneScore.",
      termsP2: "El pago se retiene hasta que ambas partes marquen el trabajo como terminado.",
      termsP3: "One World Labs cobra una comisión por cada trabajo completado.",
    },
    de: {
      jobs: "Meine Aufträge",
      qrpay: "Auftrag starten",
      calendar: "Kalender",
      plans: "Tarife",
      splashHead: "Aufträge finden. Geld bekommen.",
      splashSub: "Echte Arbeit, echte Menschen, Geld, das wirklich ankommt.",
      splashPitch: "Bei OneJob werden kleine Aufträge vereinbart, erledigt und bezahlt. Beide Seiten unterschreiben denselben Vertrag in klarer Sprache, das Geld wird ab der Zusage einbehalten und freigegeben, sobald die Arbeit fertig ist. Keine Rechnung, keine peinliche Erinnerung zwei Wochen später.",
      termsTitle: "Bevor du OneJob nutzt",
      termsP1: "Aufträge, die du hier abschließt, zählen für deinen OneScore.",
      termsP2: "Die Zahlung wird zurückgehalten, bis beide Seiten den Auftrag als erledigt markieren.",
      termsP3: "One World Labs erhebt eine Gebühr auf jeden abgeschlossenen Auftrag.",
    },
    ru: {
      jobs: "Мои заказы",
      qrpay: "Начать работу",
      calendar: "Календарь",
      plans: "Тарифы",
      splashHead: "Находите работу. Получайте оплату.",
      splashSub: "Настоящая работа, настоящие люди, деньги, которые действительно приходят.",
      splashPitch: "OneJob — это место, где небольшие заказы согласовываются, выполняются и оплачиваются. Обе стороны подписывают один и тот же договор простым языком, деньги резервируются с момента договорённости и переводятся, когда работа завершена. Без счетов и неловких напоминаний через две недели.",
      termsTitle: "Прежде чем пользоваться OneJob",
      termsP1: "Работа, выполненная здесь, учитывается в вашем OneScore.",
      termsP2: "Оплата удерживается, пока обе стороны не отметят работу выполненной.",
      termsP3: "One World Labs берёт комиссию с каждого выполненного заказа.",
    },
    zh: {
      jobs: "我的工作",
      qrpay: "开始工作",
      calendar: "日历",
      plans: "套餐",
      splashHead: "接到活，拿到钱。",
      splashSub: "真实的工作，真实的人，真正到账的钱。",
      splashPitch: "在 OneJob，小活从谈成、干完到收款一气呵成。双方签同一份通俗易懂的合同，活一谈成钱就先存管，干完即放款。不用开发票，也不用两周后尴尬地催款。",
      termsTitle: "使用 OneJob 前请了解",
      termsP1: "您在这里完成的工作会计入您的 OneScore。",
      termsP2: "款项将暂存，直到双方都确认工作完成。",
      termsP3: "One World Labs 会对每笔完成的工作收取平台费。",
    },
    pt: {
      jobs: "Meus trabalhos",
      qrpay: "Iniciar trabalho",
      calendar: "Agenda",
      plans: "Planos",
      splashHead: "Consiga trabalho. Receba.",
      splashSub: "Trabalho de verdade, pessoas de verdade, dinheiro que realmente chega.",
      splashPitch: "No OneJob, trabalhos pequenos são combinados, feitos e pagos. Os dois lados assinam o mesmo contrato em linguagem simples, o dinheiro fica retido desde o momento do acordo e é liberado quando o trabalho termina. Sem nota fiscal e sem aquela cobrança constrangedora duas semanas depois.",
      termsTitle: "Antes de usar o OneJob",
      termsP1: "O trabalho que você concluir aqui conta para o seu OneScore.",
      termsP2: "O pagamento fica retido até que os dois lados marquem o trabalho como concluído.",
      termsP3: "A One World Labs cobra uma taxa por cada trabalho concluído.",
    },
  }),
};

export const ONESCORE: AppConfig = {
  key: "onescore",
  wordmark: { ink: "ne", brand: "Score", tagline: "Credibility, earned", markSrc: "/mark-onescore.png" },
  hue: HUES.onescore,
  /* Footer LOCKED by Lee, 8 Aug 2026: Home · Connect · My score (centre) · Simulator · Profile.
     NO Messages tab, NO calendar. Home is a LinkedIn-style community/discover feed; Connect builds
     your score by linking platforms; the centre is your score; Simulator sits where Messages would
     on the other apps. OneScore is the one app without Messages — `assertConfig` exempts it. */
  tabs: [
    { to: p("onescore"),               labelKey: "home",      icon: "home" },
    { to: p("onescore", "/connect"),   labelKey: "connect",   icon: "connect" },
    { to: p("onescore", "/score"),     labelKey: "myscore",   icon: "score", primary: true },
    { to: p("onescore", "/simulator"), labelKey: "simulator", icon: "simulator" },
    { to: p("onescore", "/profile"),   labelKey: "profile",   icon: "profile" },
  ],
  notificationsPath: p("onescore", "/alerts"),
  drawerExtras: [
    { to: p("onescore", "/how"),      labelKey: "howItWorks", icon: "help" },
    { to: p("onescore", "/plans"),    labelKey: "plans",      icon: "plans" },
    { to: p("onescore", "/settings"), labelKey: "settings",   icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onescore") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      passport: "Passport", myscore: "My score", connect: "Connect", simulator: "Simulator", howItWorks: "How it works", plans: "Plans",
      splashHead: "Credibility you can carry.",
      splashSub: "One score, earned across everything you actually did.",
      splashPitch: "OneScore turns what you have actually done into a number you can show anybody. Completed work, verified credentials, real reviews and connections all count towards it. It is yours, it moves with you across every One World app, and nobody can buy a better one.",
      termsTitle: "Before you use OneScore",
      /* THE LINE THAT MATTERS LEGALLY. Counsel was unambiguous: OneVoice call content and
         OneJob payment data must NEVER feed the score (EU AI Act Art. 5(1)(c), CIPA, FCRA).
         Completed jobs feeding it is fine and is the product — Lee was right about that. This
         copy states the boundary in the place a person actually reads it. */
      termsP1: "Your score is built from work you completed and reviews you received.",
      termsP2: "Call recordings and payment details never affect your score.",
      termsP3: "You can see every item that moved your score, and dispute any of them.",
    },
    co: {
      passport: "Pasaporte", myscore: "Mi puntaje", connect: "Conectar", simulator: "Simulador", howItWorks: "Cómo funciona", plans: "Planes",
      splashHead: "Credibilidad que lo acompaña.",
      splashSub: "Un puntaje, ganado con lo que realmente hizo.",
      splashPitch: "OneScore convierte lo que usted realmente ha hecho en un puntaje que puede mostrarle a cualquiera. Cuenta el trabajo terminado, los títulos verificados, las reseñas reales y sus conexiones. Es suyo, lo acompaña en todas las aplicaciones de One World, y nadie puede comprar uno mejor.",
      termsTitle: "Antes de usar OneScore",
      termsP1: "Su puntaje se construye con el trabajo que completó y las reseñas que recibió.",
      termsP2: "Las grabaciones de llamadas y los datos de pago nunca afectan su puntaje.",
      termsP3: "Puede ver cada elemento que movió su puntaje y disputar cualquiera de ellos.",
    },
    es: {
      passport: "Pasaporte", myscore: "Mi puntuación", connect: "Conectar", simulator: "Simulador", howItWorks: "Cómo funciona", plans: "Planes",
      splashHead: "Credibilidad que te acompaña.",
      splashSub: "Una puntuación, ganada con lo que de verdad hiciste.",
      splashPitch: "OneScore convierte lo que de verdad has hecho en una puntuación que puedes enseñar a cualquiera. Cuenta el trabajo terminado, los títulos verificados, las reseñas reales y tus conexiones. Es tuya, te acompaña en todas las aplicaciones de One World, y nadie puede comprar una mejor.",
      termsTitle: "Antes de usar OneScore",
      termsP1: "Tu puntuación se construye con el trabajo que completaste y las reseñas recibidas.",
      termsP2: "Las grabaciones de llamadas y los datos de pago nunca afectan tu puntuación.",
      termsP3: "Puedes ver cada elemento que movió tu puntuación y disputar cualquiera.",
    },
    de: {
      passport: "Pass",
      myscore: "Mein Score",
      connect: "Verbinden", simulator: "Simulator", plans: "Tarife",
      howItWorks: "So funktioniert es",
      splashHead: "Glaubwürdigkeit, die du mitnimmst.",
      splashSub: "Ein Score, verdient über alles, was du wirklich getan hast.",
      splashPitch: "OneScore macht aus dem, was du wirklich geleistet hast, eine Zahl, die du jedem zeigen kannst. Erledigte Arbeit, geprüfte Nachweise, echte Bewertungen und Kontakte zählen hinein. Sie gehört dir, begleitet dich durch jede One-World-App — und niemand kann sich eine bessere kaufen.",
      termsTitle: "Bevor du OneScore nutzt",
      termsP1: "Dein Score entsteht aus abgeschlossener Arbeit und erhaltenen Bewertungen.",
      termsP2: "Gesprächsaufzeichnungen und Zahlungsdaten beeinflussen deinen Score nie.",
      termsP3: "Du siehst jeden Posten, der deinen Score bewegt hat, und kannst jeden davon anfechten.",
    },
    ru: {
      passport: "Паспорт",
      myscore: "Мой рейтинг",
      connect: "Подключить", simulator: "Симулятор", plans: "Тарифы",
      howItWorks: "Как это работает",
      splashHead: "Репутация, которую можно взять с собой.",
      splashSub: "Один рейтинг, заработанный всем, что вы действительно сделали.",
      splashPitch: "OneScore превращает то, что вы действительно сделали, в число, которое можно показать кому угодно. Завершённая работа, подтверждённые документы, настоящие отзывы и связи — всё идёт в счёт. Он ваш, он следует за вами во всех приложениях One World, и никто не может купить себе лучший.",
      termsTitle: "Прежде чем пользоваться OneScore",
      termsP1: "Ваш рейтинг складывается из выполненной работы и полученных отзывов.",
      termsP2: "Записи звонков и платёжные данные никогда не влияют на рейтинг.",
      termsP3: "Вы видите каждый пункт, изменивший ваш рейтинг, и можете оспорить любой из них.",
    },
    zh: {
      passport: "凭证",
      myscore: "我的评分",
      connect: "连接", simulator: "模拟器", plans: "套餐",
      howItWorks: "评分方式",
      splashHead: "可以随身带走的信誉。",
      splashSub: "一个评分，来自你真正做过的每一件事。",
      splashPitch: "OneScore 把您真正做过的事变成一个可以展示给任何人的分数。完成的工作、经过验证的资质、真实的评价和人脉都会计入。它属于您，随您通行每一个 One World 应用，而且谁也买不到更高的分。",
      termsTitle: "使用 OneScore 前请了解",
      termsP1: "您的评分来自已完成的工作和收到的评价。",
      termsP2: "通话录音和支付信息绝不会影响您的评分。",
      termsP3: "您可以查看影响评分的每一项，并对任何一项提出申诉。",
    },
    pt: {
      passport: "Passaporte",
      myscore: "Minha pontuação",
      connect: "Conectar", simulator: "Simulador", plans: "Planos",
      howItWorks: "Como funciona",
      splashHead: "Credibilidade que você leva com você.",
      splashSub: "Uma pontuação, construída com tudo o que você realmente fez.",
      splashPitch: "O OneScore transforma o que você realmente fez em um número que pode mostrar a qualquer pessoa. Trabalho concluído, credenciais verificadas, avaliações reais e conexões contam para ele. Ele é seu, acompanha você em todos os apps One World, e ninguém pode comprar um melhor.",
      termsTitle: "Antes de usar o OneScore",
      termsP1: "Sua pontuação vem do trabalho concluído e das avaliações recebidas.",
      termsP2: "Gravações de chamadas e dados de pagamento nunca afetam sua pontuação.",
      termsP3: "Você vê cada item que mexeu na sua pontuação e pode contestar qualquer um deles.",
    },
  }),
};

export const ONEEVENT: AppConfig = {
  key: "oneevent",
  wordmark: { ink: "ne", brand: "Event", tagline: "Show up · Sell out", markSrc: "/mark-oneevent.png" },
  hue: HUES.oneevent,
  /* Footer LOCKED by Lee, 8 Aug 2026: Home · Hosts · My Events (centre) · Messages · Profile.
     Home = discover active events; Hosts = find event hosts; My Events (centre) = create + your
     hosted/attended events + tickets bought. */
  tabs: [
    { to: p("oneevent"),             labelKey: "home",     icon: "home" },
    { to: p("oneevent", "/hosts"),   labelKey: "hosts",    icon: "people" },
    { to: p("oneevent", "/events"),  labelKey: "myEvents", icon: "tickets", primary: true },
    { to: p("oneevent", "/messages"), labelKey: "messages", icon: "messages" },
    { to: p("oneevent", "/profile"),  labelKey: "profile",  icon: "profile" },
  ],
  notificationsPath: p("oneevent", "/alerts"),
  drawerExtras: [
    { to: p("oneevent", "/calendar"), labelKey: "calendar", icon: "calendar" },
    { to: p("oneevent", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("oneevent") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      discover: "Discover", tickets: "Tickets", hosts: "Hosts", myEvents: "My Events", calendar: "Calendar",
      splashHead: "Show up. Sell out.",
      splashSub: "Find what's on, or fill the room yourself.",
      splashPitch: "OneEvent handles the whole event: the page, the tickets, the door and the money. People buy from a link you send and scan in on the day, and your payout arrives without a fortnight of reconciliation. Small enough for a room above a bar, sturdy enough for a room of five hundred.",
      termsTitle: "Before you use OneEvent",
      termsP1: "Tickets you buy are held in your account and scanned at the door.",
      termsP2: "Organisers set their own refund terms — check before you buy.",
      termsP3: "One World Labs charges a fee on each ticket sold.",
    },
    co: {
      discover: "Descubrir", tickets: "Boletas", hosts: "Anfitriones", myEvents: "Mis eventos", calendar: "Calendario",
      splashHead: "Vaya. Llene el lugar.",
      splashSub: "Encuentre qué hay, o llene el salón usted mismo.",
      splashPitch: "OneEvent se encarga de todo el evento: la página, las boletas, la entrada y el dinero. La gente compra desde un enlace que usted envía y escanea al llegar, y su pago llega sin dos semanas de cuadres. Sirve para un salón pequeño y aguanta uno de quinientas personas.",
      termsTitle: "Antes de usar OneEvent",
      termsP1: "Las boletas que compre quedan en su cuenta y se escanean en la entrada.",
      termsP2: "Cada organizador define sus condiciones de reembolso — revíselas antes de comprar.",
      termsP3: "One World Labs cobra una comisión por cada boleta vendida.",
    },
    es: {
      discover: "Descubrir", tickets: "Entradas", hosts: "Anfitriones", myEvents: "Mis eventos", calendar: "Calendario",
      splashHead: "Ve. Llena la sala.",
      splashSub: "Encuentra qué hay, o llena la sala tú mismo.",
      splashPitch: "OneEvent se encarga de todo el evento: la página, las entradas, la puerta y el dinero. La gente compra desde un enlace que envías y escanea al llegar, y tu pago llega sin dos semanas de cuadres. Vale para una sala pequeña y aguanta una de quinientas personas.",
      termsTitle: "Antes de usar OneEvent",
      termsP1: "Las entradas que compres quedan en tu cuenta y se escanean en la puerta.",
      termsP2: "Cada organizador fija sus condiciones de reembolso — compruébalas antes de comprar.",
      termsP3: "One World Labs cobra una comisión por cada entrada vendida.",
    },
    de: {
      discover: "Entdecken",
      hosts: "Gastgeber", myEvents: "Meine Events",
      tickets: "Tickets",
      calendar: "Kalender",
      splashHead: "Hingehen. Ausverkaufen.",
      splashSub: "Finde, was läuft — oder füll den Saal selbst.",
      splashPitch: "OneEvent übernimmt das ganze Event: die Seite, die Tickets, den Einlass und das Geld. Die Leute kaufen über einen Link, den du schickst, scannen am Tag selbst ein, und deine Auszahlung kommt ohne zwei Wochen Abrechnung. Klein genug für den Raum über einer Bar, stabil genug für fünfhundert Leute.",
      termsTitle: "Bevor du OneEvent nutzt",
      termsP1: "Gekaufte Tickets liegen in deinem Konto und werden am Einlass gescannt.",
      termsP2: "Veranstalter legen ihre Rückgabebedingungen selbst fest — prüfe sie vor dem Kauf.",
      termsP3: "One World Labs erhebt eine Gebühr pro verkauftem Ticket.",
    },
    ru: {
      discover: "Афиша",
      hosts: "Организаторы", myEvents: "Мои события",
      tickets: "Билеты",
      calendar: "Календарь",
      splashHead: "Приходите. Собирайте зал.",
      splashSub: "Найдите, что происходит, — или соберите зал сами.",
      splashPitch: "OneEvent берёт на себя всё событие: страницу, билеты, вход и деньги. Люди покупают по ссылке, которую вы отправляете, сканируют билет на входе, а выплата приходит без двух недель сверки. Подходит и для комнаты над баром, и для зала на пятьсот человек.",
      termsTitle: "Прежде чем пользоваться OneEvent",
      termsP1: "Купленные билеты хранятся в вашем аккаунте и сканируются на входе.",
      termsP2: "Организаторы сами устанавливают условия возврата — проверьте их перед покупкой.",
      termsP3: "One World Labs берёт комиссию с каждого проданного билета.",
    },
    zh: {
      discover: "发现",
      hosts: "主办方", myEvents: "我的活动",
      tickets: "门票",
      calendar: "日历",
      splashHead: "去现场。卖光票。",
      splashSub: "看看有什么活动，或者自己把场子坐满。",
      splashPitch: "OneEvent 包办整场活动：页面、门票、入场和收款。观众通过您发的链接购票，当天扫码入场，您的款项到账不用等两周对账。小到酒吧楼上的一个房间，大到五百人的场子，都撑得住。",
      termsTitle: "使用 OneEvent 前请了解",
      termsP1: "您购买的门票保存在账户中，入场时扫码核验。",
      termsP2: "退票条件由主办方自行设定 — 购票前请先确认。",
      termsP3: "One World Labs 会对每张售出的门票收取费用。",
    },
    pt: {
      discover: "Descobrir",
      hosts: "Anfitriões", myEvents: "Meus eventos",
      tickets: "Ingressos",
      calendar: "Agenda",
      splashHead: "Vá ao evento. Lote esgotado.",
      splashSub: "Descubra o que está rolando — ou lote a sua própria casa.",
      splashPitch: "O OneEvent cuida do evento inteiro: a página, os ingressos, a entrada e o dinheiro. As pessoas compram pelo link que você envia e fazem check-in no dia, e o seu repasse chega sem duas semanas de conciliação. Pequeno o bastante para uma sala em cima de um bar, firme o bastante para uma sala de quinhentas pessoas.",
      termsTitle: "Antes de usar o OneEvent",
      termsP1: "Os ingressos comprados ficam na sua conta e são lidos na entrada.",
      termsP2: "Cada organizador define suas regras de reembolso — confira antes de comprar.",
      termsP3: "A One World Labs cobra uma taxa por ingresso vendido.",
    },
  }),
};

export const ONESOCIAL: AppConfig = {
  key: "onesocial",
  wordmark: { ink: "ne", brand: "Social", tagline: "Credibility first", markSrc: "/mark-onesocial.png" },
  hue: HUES.onesocial,   // ← SETTLED 3 Aug 2026: indigo-violet, separated from OneVoice. See hues.ts.
  /* CENTRE = CONNECT — Lee, 9 Aug 2026: "We certainly need a button to connect everything.
     It should be the middle button." OneSocial's whole value is all your social media in one
     place, so the raised money-button is where platforms get connected and managed. Posting
     did not lose its door: the HomeTop composer (Video · Photo · Write · Go Live) routes to
     /post, which stays a real screen — it is just not the centre anymore. */
  tabs: [
    { to: p("onesocial"),              labelKey: "home",     icon: "feed" },
    { to: p("onesocial", "/people"),   labelKey: "people",   icon: "people" },
    { to: p("onesocial", "/connect"),  labelKey: "connect",  icon: "connect", primary: true },
    { to: p("onesocial", "/messages"), labelKey: "messages", icon: "messages" },
    { to: p("onesocial", "/profile"),  labelKey: "profile",  icon: "profile" },
  ],
  notificationsPath: p("onesocial", "/alerts"),
  drawerExtras: [
    { to: p("onesocial", "/search"),   labelKey: "search",   icon: "search" },
    { to: p("onesocial", "/plans"),    labelKey: "plans",    icon: "plans" },
    { to: p("onesocial", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onesocial") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      people: "People", post: "Post", connect: "Connect", search: "Search", plans: "Plans",
      splashHead: "A network you can trust.",
      splashSub: "Professionals, verified by what they've actually done.",
      splashPitch: "OneSocial connects the platforms you are already on and turns the audience you have already built into credibility somebody can verify. One profile, one link to send, and a following that finally counts for something outside the app it lives in.",
      termsTitle: "Before you use OneSocial",
      termsP1: "Your profile is public. Anything you post can be seen and shared.",
      termsP2: "Your OneScore appears on your profile only if you switch it on.",
      termsP3: "Impersonation and fake credentials get the account removed.",
    },
    co: {
      people: "Personas", post: "Publicar", connect: "Conectar", search: "Buscar", plans: "Planes",
      splashHead: "Una red en la que puede confiar.",
      splashSub: "Profesionales, verificados por lo que realmente han hecho.",
      splashPitch: "OneSocial conecta las plataformas donde usted ya está y convierte la audiencia que ya construyó en credibilidad que otra persona puede verificar. Un solo perfil, un solo enlace para enviar, y seguidores que por fin valen algo fuera de la aplicación donde viven.",
      termsTitle: "Antes de usar OneSocial",
      termsP1: "Su perfil es público. Lo que publique puede ser visto y compartido.",
      termsP2: "Su OneScore aparece en su perfil solo si usted lo activa.",
      termsP3: "La suplantación y las credenciales falsas causan la eliminación de la cuenta.",
    },
    es: {
      people: "Personas", post: "Publicar", connect: "Conectar", search: "Buscar", plans: "Planes",
      splashHead: "Una red en la que puedes confiar.",
      splashSub: "Profesionales, verificados por lo que de verdad han hecho.",
      splashPitch: "OneSocial conecta las plataformas donde ya estás y convierte la audiencia que ya has construido en credibilidad que alguien puede verificar. Un solo perfil, un solo enlace para enviar, y seguidores que por fin cuentan fuera de la aplicación donde viven.",
      termsTitle: "Antes de usar OneSocial",
      termsP1: "Tu perfil es público. Lo que publiques puede verse y compartirse.",
      termsP2: "Tu OneScore aparece en tu perfil solo si lo activas.",
      termsP3: "La suplantación y las credenciales falsas provocan la eliminación de la cuenta.",
    },
    de: {
      people: "Menschen",
      post: "Beitrag",
      connect: "Verbinden",
      search: "Suche",
      plans: "Tarife",
      splashHead: "Ein Netzwerk, dem du trauen kannst.",
      splashSub: "Fachleute, belegt durch das, was sie wirklich geleistet haben.",
      splashPitch: "OneSocial verbindet die Plattformen, auf denen du schon bist, und macht aus dem Publikum, das du bereits aufgebaut hast, überprüfbare Glaubwürdigkeit. Ein Profil, ein Link zum Verschicken — und eine Reichweite, die endlich auch außerhalb der App zählt, in der sie lebt.",
      termsTitle: "Bevor du OneSocial nutzt",
      termsP1: "Dein Profil ist öffentlich. Alles, was du postest, kann gesehen und geteilt werden.",
      termsP2: "Dein OneScore erscheint nur dann auf deinem Profil, wenn du ihn einschaltest.",
      termsP3: "Wer sich als jemand anderes ausgibt oder Qualifikationen erfindet, verliert das Konto.",
    },
    ru: {
      people: "Люди",
      post: "Публикация",
      connect: "Подключить",
      search: "Поиск",
      plans: "Тарифы",
      splashHead: "Сеть, которой можно доверять.",
      splashSub: "Специалисты, подтверждённые тем, что они действительно сделали.",
      splashPitch: "OneSocial соединяет платформы, где вы уже есть, и превращает аудиторию, которую вы уже собрали, в репутацию, которую можно проверить. Один профиль, одна ссылка — и подписчики, которые наконец что-то значат за пределами приложения, где они живут.",
      termsTitle: "Прежде чем пользоваться OneSocial",
      termsP1: "Ваш профиль открыт. Всё опубликованное можно увидеть и переслать.",
      termsP2: "OneScore появляется в профиле, только если вы сами его включите.",
      termsP3: "За выдачу себя за другого и поддельные документы аккаунт удаляется.",
    },
    zh: {
      people: "人脉",
      post: "发布",
      connect: "连接",
      search: "搜索",
      plans: "套餐",
      splashHead: "一个值得信任的人脉网络。",
      splashSub: "专业人士，用真正做过的事来证明自己。",
      splashPitch: "OneSocial 连接您已经在用的平台，把您已经积累的粉丝变成别人可以核实的信誉。一个主页，一条链接，让您的关注量终于在它所在的应用之外也有了分量。",
      termsTitle: "使用 OneSocial 前请了解",
      termsP1: "您的主页是公开的。您发布的内容可被他人查看和分享。",
      termsP2: "只有您主动开启，OneScore 才会显示在主页上。",
      termsP3: "冒充他人或伪造资历将被注销账号。",
    },
    pt: {
      people: "Pessoas",
      post: "Publicar",
      connect: "Conectar",
      search: "Buscar",
      plans: "Planos",
      splashHead: "Uma rede em que dá para confiar.",
      splashSub: "Profissionais, comprovados pelo que realmente fizeram.",
      splashPitch: "O OneSocial conecta as plataformas em que você já está e transforma o público que você já construiu em credibilidade que alguém pode verificar. Um perfil, um link para enviar, e uma audiência que finalmente vale algo fora do app em que ela vive.",
      termsTitle: "Antes de usar o OneSocial",
      termsP1: "Seu perfil é público. Tudo o que você publica pode ser visto e compartilhado.",
      termsP2: "Seu OneScore só aparece no perfil se você ativar.",
      termsP3: "Fingir ser outra pessoa ou inventar credenciais leva à remoção da conta.",
    },
  }),
};

export const ONEAGENT: AppConfig = {
  key: "oneagent",
  wordmark: { ink: "ne", brand: "Agent", tagline: "Your middleman", markSrc: "/mark-oneagent.png" },
  hue: HUES.oneagent,
  tabs: [
    { to: p("oneagent"),              labelKey: "home",     icon: "home" },
    { to: p("oneagent", "/deals"),    labelKey: "deals",    icon: "deals" },
    /* Lee, 8 Aug 2026: the centre action is PARTNER — grow the book (QR/link invites) and
       partner with people already on the platform. Icon-only in the footer; this key is the
       screen's name and its accessibility label, never a visible caption. */
    { to: p("oneagent", "/partner"),  labelKey: "partner",  icon: "agent", primary: true },
    { to: p("oneagent", "/messages"), labelKey: "messages", icon: "messages" },
    { to: p("oneagent", "/profile"),  labelKey: "profile",  icon: "profile" },
  ],
  notificationsPath: p("oneagent", "/alerts"),
  drawerExtras: [
    { to: p("oneagent", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("oneagent") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      deals: "Deals", partner: "Partner",
      /* Lee's own framing, 2 Aug 2026: *"an AI agent — it's basically a middleman, like a real
         estate agent or a modeling agent."* And his RULING, 8 Aug 2026, resolving the
         human-vs-software copy conflict flagged in the OneAgent brief: the agent is a HUMAN
         middleman. The old sub ("An agent that finds the work…") and terms point 2 ("It reads
         only what you connect") described software; every line below now describes a person. */
      splashHead: "Someone to work the deal.",
      splashSub: "A real agent in your corner — a person who finds the work, negotiates and brings you the offer.",
      splashPitch: "OneAgent is representation for people who have never had any: a real middleman who brings you opportunities, handles the awkward conversation about money, and takes a share only when you get paid. It is being built now, and your One ID already works here.",
      termsTitle: "Before you use OneAgent",
      termsP1: "Your agent is a real person acting on your behalf. Nothing binding happens without your approval.",
      termsP2: "You choose what your agent may do for you, and you can revoke that permission at any time.",
      termsP3: "Deals are recorded on the platform — your agent's track record is built from the deals they close for people like you.",
    },
    co: {
      deals: "Negocios", partner: "Socio",
      splashHead: "Alguien que negocia por usted.",
      splashSub: "Un agente de verdad a su lado: una persona que busca el trabajo, negocia y le trae la oferta.",
      splashPitch: "OneAgent es representación para quienes nunca la han tenido: un intermediario de verdad que le trae oportunidades, tiene la conversación incómoda sobre el dinero y solo cobra cuando a usted le pagan. Se está construyendo ahora, y su One ID ya funciona aquí.",
      termsTitle: "Antes de usar OneAgent",
      termsP1: "Su agente es una persona real que actúa en su nombre. Nada vinculante ocurre sin su aprobación.",
      termsP2: "Usted decide qué puede hacer su agente por usted, y puede revocar ese permiso en cualquier momento.",
      termsP3: "Los negocios quedan registrados en la plataforma: la trayectoria de su agente se construye con los negocios que cierra para personas como usted.",
    },
    es: {
      deals: "Acuerdos", partner: "Socio",
      splashHead: "Alguien que negocia por ti.",
      splashSub: "Un agente de verdad a tu lado: una persona que busca el trabajo, negocia y te trae la oferta.",
      splashPitch: "OneAgent es representación para quien nunca la ha tenido: un intermediario de verdad que te trae oportunidades, tiene la conversación incómoda sobre el dinero y solo cobra cuando a ti te pagan. Se está construyendo ahora, y tu One ID ya funciona aquí.",
      termsTitle: "Antes de usar OneAgent",
      termsP1: "Tu agente es una persona real que actúa en tu nombre. Nada vinculante ocurre sin tu aprobación.",
      termsP2: "Tú decides qué puede hacer tu agente por ti, y puedes revocar ese permiso cuando quieras.",
      termsP3: "Los acuerdos quedan registrados en la plataforma: la trayectoria de tu agente se construye con los acuerdos que cierra para personas como tú.",
    },
    de: {
      deals: "Deals",
      partner: "Partner",
      splashHead: "Jemand, der den Deal führt.",
      splashSub: "Ein echter Agent an deiner Seite — ein Mensch, der die Arbeit findet, verhandelt und dir das Angebot bringt.",
      splashPitch: "OneAgent ist Vertretung für Leute, die nie eine hatten: ein echter Vermittler, der dir Chancen bringt, das unangenehme Gespräch übers Geld führt und nur dann einen Anteil nimmt, wenn du bezahlt wirst. Er wird gerade gebaut — deine One ID funktioniert hier schon.",
      termsTitle: "Bevor du OneAgent nutzt",
      termsP1: "Dein Agent ist ein echter Mensch, der in deinem Namen handelt. Nichts Verbindliches passiert ohne deine Freigabe.",
      termsP2: "Du bestimmst, was dein Agent für dich tun darf, und kannst diese Erlaubnis jederzeit widerrufen.",
      termsP3: "Deals werden auf der Plattform festgehalten — die Bilanz deines Agenten entsteht aus den Deals, die er für Menschen wie dich abschließt.",
    },
    ru: {
      deals: "Сделки",
      partner: "Партнёр",
      splashHead: "Тот, кто ведёт сделку за вас.",
      splashSub: "Настоящий агент на вашей стороне — человек, который находит работу, ведёт переговоры и приносит вам предложение.",
      splashPitch: "OneAgent — это представитель для тех, у кого его никогда не было: настоящий посредник, который приносит вам возможности, берёт на себя неловкий разговор о деньгах и получает долю только тогда, когда платят вам. Сервис сейчас в разработке, но ваш One ID здесь уже работает.",
      termsTitle: "Прежде чем пользоваться OneAgent",
      termsP1: "Ваш агент — реальный человек, действующий от вашего имени. Ничего обязывающего не происходит без вашего одобрения.",
      termsP2: "Вы решаете, что агент может делать за вас, и можете отозвать это разрешение в любой момент.",
      termsP3: "Сделки фиксируются на платформе — репутация агента складывается из сделок, закрытых для таких людей, как вы.",
    },
    zh: {
      deals: "商机",
      partner: "合作",
      splashHead: "有人替你谈这笔生意。",
      splashSub: "一位真正站在你这边的经纪人——由真人帮你找活、谈判，并把报价带回来。",
      splashPitch: "OneAgent 为从未有过经纪人的人提供经纪服务：一个真正的中间人，为您带来机会，替您谈那些不好开口的价钱，只有您收到钱他才抽成。目前正在开发中，您的 One ID 已经可以在这里使用。",
      termsTitle: "使用 OneAgent 前请了解",
      termsP1: "您的经纪人是真人，以您的名义行事。任何有约束力的事项都需您先批准。",
      termsP2: "您决定经纪人可以为您做什么，并可随时撤销该授权。",
      termsP3: "所有交易都记录在平台上——经纪人的业绩由他为像您这样的人达成的交易累积而成。",
    },
    pt: {
      deals: "Negócios",
      partner: "Parceiro",
      splashHead: "Alguém para conduzir o negócio.",
      splashSub: "Um agente de verdade ao seu lado — uma pessoa que encontra o trabalho, negocia e traz a proposta para você.",
      splashPitch: "O OneAgent é representação para quem nunca teve: um intermediário de verdade que traz oportunidades, cuida da conversa desconfortável sobre dinheiro e só fica com uma parte quando você recebe. Está sendo construído agora, e o seu One ID já funciona aqui.",
      termsTitle: "Antes de usar o OneAgent",
      termsP1: "Seu agente é uma pessoa real agindo em seu nome. Nada vinculante acontece sem a sua aprovação.",
      termsP2: "Você decide o que seu agente pode fazer por você, e pode revogar essa permissão a qualquer momento.",
      termsP3: "Os negócios ficam registrados na plataforma — o histórico do seu agente é construído com os negócios que ele fecha para pessoas como você.",
    },
  }),
};

/* ══════════════════════════════════════════════════════════════════════════════════════════
   THE THREE SERVICES — same header, same drawer, same sign-in. Different footer.

   Lee, 3 Aug 2026: *"the services don't need the glassmorphism makeover — they already have it.
   They just need the shell correct, the sign-in correct, the hamburger working, the translation
   working."*

   Three tabs each rather than five, and no raised centre slot. A service is something you check,
   not something you do all day, and a raised action button with nothing urgent behind it is a
   promise the product does not keep. `assertConfig` allows fewer, never more.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export const ONEVOICE: AppConfig = {
  key: "onevoice",
  wordmark: { ink: "ne", brand: "Voice", tagline: "Always answered", markSrc: "/mark-onevoice.png" },
  hue: HUES.onevoice,
  /* THE DASHBOARD LEE ASKED FOR, 3 Aug 2026: *"let's build a dashboard behind the login for One
     Voice — total billable minutes, and total calls… the users will have to have other options
     like cancel plan, upgrade my plan."* Calls, minutes, billing. Nothing else belongs here. */
  tabs: [
    { to: p("onevoice"),           labelKey: "calls",   icon: "calls" },
    { to: p("onevoice", "/usage"), labelKey: "usage",   icon: "minutes" },
    { to: p("onevoice", "/plan"),  labelKey: "plan",    icon: "billing" },
  ],
  notificationsPath: p("onevoice", "/alerts"),
  drawerExtras: [
    { to: p("onevoice", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onevoice") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      calls: "Calls", usage: "Usage", plan: "Plan",
      splashHead: "Your phone, always answered.",
      splashSub: "Every call picked up, logged and summarised — including the ones at 2am.",
      splashPitch: "OneVoice answers your phone when you cannot. It books the appointment, takes the message, and answers the questions your customers actually ask, in the languages they ask them in. You get the transcript and the booking; the caller gets a person who picked up.",
      termsTitle: "Before you use OneVoice",
      /* CALL RECORDING IS THE SHARPEST LEGAL EDGE IN THE WHOLE ECOSYSTEM. Twelve US states
         require all-party consent; California Penal Code §637.2 is $5,000 PER VIOLATION, which
         on call volume is a class action. This copy is the customer-facing half of that; the
         all-party consent announcement on the call itself is the other half and is not
         optional. */
      termsP1: "You are responsible for telling callers that calls are recorded, where the law requires it.",
      termsP2: "Recordings are stored privately and are never used to score anyone.",
      termsP3: "You can cancel or change your plan at any time from this dashboard.",
    },
    co: {
      calls: "Llamadas", usage: "Uso", plan: "Plan",
      splashHead: "Su teléfono, siempre contestado.",
      splashSub: "Cada llamada contestada, registrada y resumida — incluso las de las 2 a. m.",
      splashPitch: "OneVoice contesta su teléfono cuando usted no puede. Agenda la cita, toma el mensaje y responde las preguntas que sus clientes realmente hacen, en el idioma en que las hacen. Usted recibe la transcripción y la cita; quien llama recibe a alguien que contestó.",
      termsTitle: "Antes de usar OneVoice",
      termsP1: "Usted es responsable de avisar a quien llama que la llamada se graba, donde la ley lo exija.",
      termsP2: "Las grabaciones se guardan de forma privada y nunca se usan para calificar a nadie.",
      termsP3: "Puede cancelar o cambiar su plan cuando quiera desde este panel.",
    },
    es: {
      calls: "Llamadas", usage: "Uso", plan: "Plan",
      splashHead: "Tu teléfono, siempre contestado.",
      splashSub: "Cada llamada atendida, registrada y resumida — incluidas las de las 2 de la mañana.",
      splashPitch: "OneVoice contesta tu teléfono cuando tú no puedes. Agenda la cita, toma el mensaje y responde las preguntas que tus clientes hacen de verdad, en el idioma en que las hacen. Tú recibes la transcripción y la cita; quien llama recibe a alguien que contestó.",
      termsTitle: "Antes de usar OneVoice",
      termsP1: "Eres responsable de avisar a quien llama de que la llamada se graba, donde la ley lo exija.",
      termsP2: "Las grabaciones se guardan de forma privada y nunca se usan para puntuar a nadie.",
      termsP3: "Puedes cancelar o cambiar tu plan cuando quieras desde este panel.",
    },
    de: {
      calls: "Anrufe",
      usage: "Verbrauch",
      plan: "Tarif",
      splashHead: "Dein Telefon, immer besetzt.",
      splashSub: "Jeder Anruf angenommen, protokolliert und zusammengefasst — auch der um 2 Uhr nachts.",
      splashPitch: "OneVoice geht ans Telefon, wenn du es nicht kannst. Es bucht den Termin, nimmt die Nachricht auf und beantwortet die Fragen, die deine Kunden wirklich stellen — in den Sprachen, in denen sie sie stellen. Du bekommst Protokoll und Buchung; der Anrufer bekommt jemanden, der abgenommen hat.",
      termsTitle: "Bevor du OneVoice nutzt",
      termsP1: "Du bist dafür verantwortlich, Anrufer auf die Aufzeichnung hinzuweisen, wo das Gesetz es verlangt.",
      termsP2: "Aufzeichnungen werden privat gespeichert und niemals zur Bewertung von Personen genutzt.",
      termsP3: "Du kannst deinen Tarif jederzeit hier im Dashboard ändern oder kündigen.",
    },
    ru: {
      calls: "Звонки",
      usage: "Расход",
      plan: "Тариф",
      splashHead: "Ваш телефон всегда отвечает.",
      splashSub: "Каждый звонок принят, записан и кратко изложен — включая те, что в два часа ночи.",
      splashPitch: "OneVoice отвечает на ваши звонки, когда вы не можете. Он записывает на приём, принимает сообщение и отвечает на вопросы, которые ваши клиенты действительно задают, на тех языках, на которых они их задают. Вы получаете расшифровку и запись; звонящий — человека, который взял трубку.",
      termsTitle: "Прежде чем пользоваться OneVoice",
      termsP1: "Вы обязаны предупреждать звонящих о записи там, где этого требует закон.",
      termsP2: "Записи хранятся приватно и никогда не используются для оценки людей.",
      termsP3: "Вы можете сменить или отменить тариф в любой момент в этой панели.",
    },
    zh: {
      calls: "通话",
      usage: "用量",
      plan: "套餐",
      splashHead: "您的电话，永远有人接。",
      splashSub: "每通电话都被接起、记录并总结 — 包括凌晨两点那一通。",
      splashPitch: "OneVoice 在您不方便时替您接电话。它帮客户预约、留言，并用客户提问的语言回答他们真正想问的问题。您拿到通话记录和预约，来电的人则感觉有人接了电话。",
      termsTitle: "使用 OneVoice 前请了解",
      termsP1: "在法律要求的地区，由您负责告知来电者通话将被录音。",
      termsP2: "录音以私密方式存储，绝不用于对任何人评分。",
      termsP3: "您可随时在本面板更改或取消套餐。",
    },
    pt: {
      calls: "Chamadas",
      usage: "Uso",
      plan: "Plano",
      splashHead: "Seu telefone, sempre atendido.",
      splashSub: "Toda ligação atendida, registrada e resumida — inclusive as das duas da manhã.",
      splashPitch: "O OneVoice atende o seu telefone quando você não pode. Ele marca o horário, anota o recado e responde às perguntas que os seus clientes realmente fazem, nos idiomas em que elas chegam. Você recebe a transcrição e o agendamento; quem ligou recebe alguém que atendeu.",
      termsTitle: "Antes de usar o OneVoice",
      termsP1: "É sua responsabilidade avisar quem liga que a chamada é gravada, onde a lei exigir.",
      termsP2: "As gravações ficam armazenadas de forma privada e nunca são usadas para pontuar ninguém.",
      termsP3: "Você pode cancelar ou mudar de plano a qualquer momento por este painel.",
    },
  }),
};

export const ONEPAGE: AppConfig = {
  key: "onepage",
  wordmark: { ink: "ne", brand: "Page", tagline: "Your site, done", markSrc: "/mark-onepage.png" },
  hue: HUES.onepage,
  tabs: [
    { to: p("onepage"),           labelKey: "site",  icon: "site" },
    { to: p("onepage", "/edit"),  labelKey: "edit",  icon: "compose" },
    { to: p("onepage", "/plan"),  labelKey: "plan",  icon: "billing" },
  ],
  notificationsPath: p("onepage", "/alerts"),
  drawerExtras: [
    { to: p("onepage", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2"], url: terms("onepage") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      site: "Site", edit: "Edit", plan: "Plan",
      splashHead: "Your website, already built.",
      splashSub: "Change a line, press publish. No agency, no ticket queue.",
      splashPitch: "OnePage builds and runs the website your business should already have. You describe what you do; it writes the pages, puts them online, and keeps them current. No template to fight with and nobody to chase for a change.",
      termsTitle: "Before you use OnePage",
      termsP1: "You own your content and your domain. You can take both with you.",
      termsP2: "Published changes go live immediately — there is no staging step.",
    },
    co: {
      site: "Sitio", edit: "Editar", plan: "Plan",
      splashHead: "Su sitio web, ya construido.",
      splashSub: "Cambie una línea y publique. Sin agencia, sin fila de tickets.",
      splashPitch: "OnePage construye y mantiene el sitio web que su negocio ya debería tener. Usted describe lo que hace; él escribe las páginas, las publica y las mantiene al día. Sin plantillas que pelear y sin tener que perseguir a nadie para un cambio.",
      termsTitle: "Antes de usar OnePage",
      termsP1: "El contenido y el dominio son suyos. Puede llevárselos.",
      termsP2: "Los cambios publicados salen en vivo de inmediato — no hay paso de revisión.",
    },
    es: {
      site: "Sitio", edit: "Editar", plan: "Plan",
      splashHead: "Tu web, ya construida.",
      splashSub: "Cambia una línea y publica. Sin agencia, sin cola de tickets.",
      splashPitch: "OnePage construye y mantiene la web que tu negocio ya debería tener. Tú describes lo que haces; él escribe las páginas, las publica y las mantiene al día. Sin plantillas con las que pelear y sin perseguir a nadie para un cambio.",
      termsTitle: "Antes de usar OnePage",
      termsP1: "El contenido y el dominio son tuyos. Puedes llevártelos.",
      termsP2: "Los cambios publicados salen en vivo de inmediato — no hay paso intermedio.",
    },
    de: {
      site: "Website",
      edit: "Bearbeiten",
      plan: "Tarif",
      splashHead: "Deine Website, schon fertig.",
      splashSub: "Eine Zeile ändern, veröffentlichen. Keine Agentur, keine Ticket-Warteschlange.",
      splashPitch: "OnePage baut und betreibt die Website, die dein Geschäft längst haben sollte. Du beschreibst, was du machst; es schreibt die Seiten, stellt sie online und hält sie aktuell. Kein Template zum Kämpfen und niemand, dem man wegen einer Änderung hinterherlaufen muss.",
      termsTitle: "Bevor du OnePage nutzt",
      termsP1: "Inhalte und Domain gehören dir. Du kannst beides mitnehmen.",
      termsP2: "Veröffentlichte Änderungen gehen sofort live — es gibt keine Vorschaustufe.",
    },
    ru: {
      site: "Сайт",
      edit: "Редактировать",
      plan: "Тариф",
      splashHead: "Ваш сайт уже готов.",
      splashSub: "Поменяйте строку и нажмите «Опубликовать». Без агентства и очереди заявок.",
      splashPitch: "OnePage создаёт и ведёт сайт, который у вашего бизнеса давно должен быть. Вы описываете, чем занимаетесь; он пишет страницы, публикует их и поддерживает в актуальном виде. Ни шаблонов, с которыми надо воевать, ни людей, за которыми надо бегать ради правки.",
      termsTitle: "Прежде чем пользоваться OnePage",
      termsP1: "Контент и домен принадлежат вам. И то и другое можно забрать с собой.",
      termsP2: "Опубликованные изменения появляются сразу — промежуточной среды нет.",
    },
    zh: {
      site: "网站",
      edit: "编辑",
      plan: "套餐",
      splashHead: "您的网站，已经建好了。",
      splashSub: "改一行字，点击发布。不用找外包，也不用排队等工单。",
      splashPitch: "OnePage 为您搭建并运营您的生意早该有的网站。您说清楚自己是做什么的，它来写页面、上线并保持内容最新。不用跟模板较劲，也不用为改一处内容追着人跑。",
      termsTitle: "使用 OnePage 前请了解",
      termsP1: "内容和域名都归您所有，随时可以带走。",
      termsP2: "发布的改动会立即生效 — 没有预发布环节。",
    },
    pt: {
      site: "Site",
      edit: "Editar",
      plan: "Plano",
      splashHead: "Seu site, já pronto.",
      splashSub: "Mude uma linha e publique. Sem agência, sem fila de chamados.",
      splashPitch: "O OnePage constrói e mantém o site que o seu negócio já deveria ter. Você descreve o que faz; ele escreve as páginas, coloca no ar e mantém tudo atualizado. Sem template para brigar e sem ninguém para caçar por causa de uma alteração.",
      termsTitle: "Antes de usar o OnePage",
      termsP1: "O conteúdo e o domínio são seus. Você pode levar os dois com você.",
      termsP2: "As alterações publicadas entram no ar na hora — não há etapa de homologação.",
    },
  }),
};

export const ONEAPP: AppConfig = {
  key: "oneapp",
  wordmark: { ink: "ne", brand: "App", tagline: "Built for you", markSrc: "/mark-oneapp.png" },
  hue: HUES.oneapp,
  tabs: [
    { to: p("oneapp"),           labelKey: "build", icon: "device" },
    { to: p("oneapp", "/edit"),  labelKey: "edit",  icon: "compose" },
    { to: p("oneapp", "/plan"),  labelKey: "plan",  icon: "billing" },
  ],
  notificationsPath: p("oneapp", "/alerts"),
  drawerExtras: [
    { to: p("oneapp", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2"], url: terms("oneapp") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      build: "Your app", edit: "Edit", plan: "Plan",
      splashHead: "An app of your own.",
      splashSub: "Built, hosted and updated — you just say what it should do.",
      splashPitch: "OneApp gives your business its own app, built and run for you. Your customers book, pay and message you in one place with your name on it. It is being built now, and your One ID already works here.",
      termsTitle: "Before you use OneApp",
      termsP1: "You own what gets built. Export it at any time.",
      termsP2: "App-store submissions are handled by One World Labs and can take weeks.",
    },
    co: {
      build: "Su app", edit: "Editar", plan: "Plan",
      splashHead: "Una app propia.",
      splashSub: "Construida, alojada y actualizada — usted solo dice qué debe hacer.",
      splashPitch: "OneApp le da a su negocio su propia aplicación, construida y operada por nosotros. Sus clientes reservan, pagan y le escriben en un solo lugar, con el nombre de usted. Se está construyendo ahora, y su One ID ya funciona aquí.",
      termsTitle: "Antes de usar OneApp",
      termsP1: "Lo que se construye es suyo. Puede exportarlo cuando quiera.",
      termsP2: "One World Labs gestiona los envíos a las tiendas y pueden tardar semanas.",
    },
    es: {
      build: "Tu app", edit: "Editar", plan: "Plan",
      splashHead: "Una app tuya.",
      splashSub: "Construida, alojada y actualizada — tú solo dices qué debe hacer.",
      splashPitch: "OneApp le da a tu negocio su propia aplicación, construida y gestionada por nosotros. Tus clientes reservan, pagan y te escriben en un solo sitio, con tu nombre. Se está construyendo ahora, y tu One ID ya funciona aquí.",
      termsTitle: "Antes de usar OneApp",
      termsP1: "Lo que se construye es tuyo. Puedes exportarlo cuando quieras.",
      termsP2: "One World Labs gestiona los envíos a las tiendas y pueden tardar semanas.",
    },
    de: {
      build: "Deine App",
      edit: "Bearbeiten",
      plan: "Tarif",
      splashHead: "Eine eigene App.",
      splashSub: "Gebaut, gehostet und gepflegt — du sagst nur, was sie können soll.",
      splashPitch: "OneApp gibt deinem Geschäft eine eigene App, gebaut und betrieben für dich. Deine Kunden buchen, zahlen und schreiben dir an einem Ort — mit deinem Namen drauf. Sie wird gerade gebaut; deine One ID funktioniert hier schon.",
      termsTitle: "Bevor du OneApp nutzt",
      termsP1: "Was gebaut wird, gehört dir. Du kannst es jederzeit exportieren.",
      termsP2: "Einreichungen im App Store übernimmt One World Labs und können Wochen dauern.",
    },
    ru: {
      build: "Ваше приложение",
      edit: "Редактировать",
      plan: "Тариф",
      splashHead: "Собственное приложение.",
      splashSub: "Собрано, размещено и обновляется — вы только говорите, что оно должно делать.",
      splashPitch: "OneApp даёт вашему бизнесу собственное приложение, которое создают и ведут за вас. Ваши клиенты записываются, платят и пишут вам в одном месте — под вашим именем. Сервис сейчас в разработке, но ваш One ID здесь уже работает.",
      termsTitle: "Прежде чем пользоваться OneApp",
      termsP1: "Всё созданное принадлежит вам. Выгрузить можно в любой момент.",
      termsP2: "Публикацию в магазинах приложений берёт на себя One World Labs, и она может занять недели.",
    },
    zh: {
      build: "您的应用",
      edit: "编辑",
      plan: "套餐",
      splashHead: "属于自己的一款应用。",
      splashSub: "我们负责搭建、托管和更新 — 您只要说它该做什么。",
      splashPitch: "OneApp 给您的生意一个专属应用，由我们为您搭建和运营。您的客户在同一个地方预订、付款、给您留言，而且用的是您的名字。目前正在开发中，您的 One ID 已经可以在这里使用。",
      termsTitle: "使用 OneApp 前请了解",
      termsP1: "构建出来的成果归您所有，随时可以导出。",
      termsP2: "应用商店提交由 One World Labs 处理，可能需要数周。",
    },
    pt: {
      build: "Seu app",
      edit: "Editar",
      plan: "Plano",
      splashHead: "Um app só seu.",
      splashSub: "Construído, hospedado e atualizado — você só diz o que ele deve fazer.",
      splashPitch: "O OneApp dá ao seu negócio um app próprio, construído e mantido para você. Seus clientes reservam, pagam e falam com você em um só lugar, com o seu nome nele. Está sendo construído agora, e o seu One ID já funciona aqui.",
      termsTitle: "Antes de usar o OneApp",
      termsP1: "O que for construído é seu. Exporte quando quiser.",
      termsP2: "O envio para as lojas de apps é feito pela One World Labs e pode levar semanas.",
    },
  }),
};

/**
 * Deep-merge the shell's words with the product's, per language.
 *
 * A shallow spread would silently drop every shell string in any language the product also
 * writes copy for — so Spanish would lose "Sign in" the moment a product added a Spanish label.
 * That is a one-character bug with an invisible symptom, so it gets a named function.
 */

/**
 * ONERENTAL — the sixth consumer app, opened 10 Aug 2026.
 * ============================================================================================
 * Lee: *"It's gonna be ninety percent OneJob, but it's gonna be ten percent tweaked… this one
 * here will be six point nine nine percent, which is way cheaper than Airbnb."*
 *
 * The market it is aimed at is already doing this in Colombian WhatsApp groups: an agent posts an
 * apartment with a wall of photos, people reply, and the contract, the signature and the deposit
 * all happen over chat and bank transfer with nothing enforcing either side. OneRental is that
 * exact flow with a real contract, a real payment rail, and a credibility score on both parties.
 *
 * ── THE FOOTER, DICTATED BY LEE 10 AUG 2026 ─────────────────────────────────────────────────
 * *"You get your home, it's the feed. Second button is searching agents… the third button is
 * where a user would go and start creating listings, basically. Kinda like creating events…
 * the fourth button is your messages, and your fifth button is your profile page."*
 *
 *   1 Home      the public feed of listings, newest first
 *   2 Agents    search agents — each row shows active-listing count and their OneScore
 *   3 List      ★ the raised centre: create a listing. The money button.
 *   4 Messages  shell
 *   5 Profile   shell
 *
 * That satisfies the canon exactly (Home first, Profile last, Messages fourth, primary middle),
 * so `assertConfig` passes without an exception being carved for it — worth noting, because
 * OneScore needed one.
 *
 * ── Why `calendar` is a drawer extra here ───────────────────────────────────────────────────
 * The 8-Aug footer locks put Calendar on Job/Event/Agent only, and OneRental does not take a
 * footer slot for it. But a nightly listing without an availability calendar is a product that
 * double-books, so it lives in the drawer. The calendar is not the source of truth either way —
 * overlap is refused by a database exclusion constraint, not by a screen.
 */
export const ONERENTAL: AppConfig = {
  key: "onerental",
  /* ONE THING TO TURN ON. See `AppConfig.entitlement` — both halves of OneHome grant and revoke
     the single `onehome` entitlement, so a member never sees two rows for one app. */
  entitlement: "onehome",
  /* The tagline is SPANISH because this product is Colombia-only and opens in Spanish. The
     shell renders `wordmark.tagline` as a plain string — it is the one piece of product copy the
     dictionary does not reach — so an English tagline would sit above a Spanish headline on the
     splash of a product whose entire market is Colombian. Noted for Thread A: translating the
     tagline is a small shell change that would benefit every product, and is deliberately not
     made from this lane. */
  /* ONE HOME, both halves. Lee, 10 Aug 2026: *"It's just gonna say One Home, for now. And then
     when you go to that app, it's gonna have the two sections, which are for rent and for sale…
     but the app itself will be One Home."* The wordmark is therefore identical on `/rentals` and
     `/sales`; the segment strip inside the screen — For rent / For sale — is what distinguishes
     them, and the hue does the rest. "OneRental" and "OneSale" survive ONLY as route keys and
     internal identifiers. Nothing a member reads says either word. */
  wordmark: { ink: "ne", brand: "Home", tagline: "Arriendo con contrato", markSrc: "/mark-onerental.png" },
  hue: HUES.onerental,   // ← sky blue #0EA5E9. Lee's call, 10 Aug. NOT the state teal — see hues.ts.
  /**
   * COLOMBIA FIRST. Lee, 10 Aug 2026: *"it's gonna be Colombia only for right now. It's the only
   * app that is Colombia only for now. So it's gonna be defaulted to Latin American Spanish…
   * and you can always switch it to US if you want."*
   *
   * `co` is the shell's Colombian-Spanish key (usted-form, Colombian vocabulary — `arriendo`,
   * not `alquiler`). This is a DEFAULT, not a lock: a person who has ever chosen a language keeps
   * it, and the flag picker in the header works exactly as it does everywhere else.
   */
  defaultLang: "co",
  tabs: [
    { to: p("onerental"),               labelKey: "home",       icon: "feed" },
    { to: p("onerental", "/agents"),    labelKey: "agents",     icon: "people" },
    { to: p("onerental", "/list"),      labelKey: "list",       icon: "property", primary: true },
    { to: p("onerental", "/messages"),  labelKey: "messages",   icon: "messages" },
    { to: p("onerental", "/profile"),   labelKey: "profile",    icon: "profile" },
  ],
  notificationsPath: p("onerental", "/alerts"),
  drawerExtras: [
    { to: p("onerental", "/properties"), labelKey: "properties", icon: "keys" },
    { to: p("onerental", "/calendar"),   labelKey: "calendar",   icon: "calendar" },
    { to: p("onerental", "/plans"),      labelKey: "plans",      icon: "plans" },
    { to: p("onerental", "/settings"),   labelKey: "settings",   icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onerental") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      agents: "Agents", list: "List a place", properties: "My properties",
      calendar: "Calendar", plans: "Plans",
      splashHead: "Rent in Colombia, with a contract behind it.",
      splashSub: "Medellín, Bogotá, Cali, Cartagena — a signed lease, no deposit we ever touch, and photo evidence both sides agreed to.",
      splashPitch: `OneHome never holds your money. If a host asks for a deposit you pay it to them directly — it does not pass through us, we take no fee on it, and on a home lease of thirty days or more Colombian law does not allow one to be required at all, which we tell both sides on the listing itself. You also see what the place genuinely last sold for, straight from the national registry, and before you move in you and the owner agree every photograph one by one, so nobody can argue about a mark on the wall later. Monthly fees: ${RENTAL_HOST_FEE_PCT} host + ${RENTAL_GUEST_FEE_PCT} guest (${RENTAL_FEE_PCT} total); listing, messaging and signing are free.`,
      termsTitle: "Before you use OneHome",
      /* These three are the SUMMARY, in the words a member would use. The fee sentence is first
         on purpose: it is the thing a property manager most needs to know before they list, and
         burying it is how a platform gets accused of a hidden charge. */
      termsP1: `Listing, messaging and signing are free. Each monthly payment has a ${RENTAL_HOST_FEE_PCT} host fee and a ${RENTAL_GUEST_FEE_PCT} guest fee (${RENTAL_FEE_PCT} total).`,
      termsP2: "We never hold a deposit. Most homes here ask for none, and on a lease of 30 days or more Colombian law does not allow one to be required.",
      termsP3: "Before move-in you both agree the photos of the place. If it is not in a photo, it is not evidence.",
    },
    co: {
      agents: "Agentes", list: "Publicar", properties: "Mis propiedades",
      calendar: "Calendario", plans: "Planes",
      splashHead: "Arriende en Colombia, con un contrato de respaldo.",
      splashSub: "Medellín, Bogotá, Cali, Cartagena — contrato firmado, ningún depósito que nosotros toquemos, y fotos que ambas partes aceptaron.",
      splashPitch: `OneHome nunca retiene su dinero. Si un arrendador pide depósito, usted se lo paga directamente a él — no pasa por nosotros, no cobramos comisión sobre él, y en un arriendo de vivienda de treinta días o más la ley colombiana no permite exigirlo, cosa que le decimos a ambas partes en el anuncio mismo. Además ve por cuánto se vendió realmente el inmueble, según el registro nacional, y antes de la entrega usted y el propietario aceptan cada foto una por una, para que después nadie discuta por una marca en la pared. Comisiones mensuales: ${RENTAL_HOST_FEE_PCT.replace(".", ",")} anfitrión + ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} huésped (${RENTAL_FEE_PCT.replace(".", ",")} total); publicar, escribir y firmar es gratis.`,
      termsTitle: "Antes de usar OneHome",
      termsP1: `Publicar, escribir y firmar es gratis. Cada pago mensual tiene una comisión de ${RENTAL_HOST_FEE_PCT.replace(".", ",")} para el anfitrión y ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} para el huésped (${RENTAL_FEE_PCT.replace(".", ",")} total).`,
      termsP2: "Nosotros nunca retenemos un depósito. La mayoría de los inmuebles aquí no piden ninguno, y en un arriendo de 30 días o más la ley colombiana no permite exigirlo.",
      termsP3: "Antes de la entrega ambos aceptan las fotos del inmueble. Lo que no esté en una foto, no es prueba.",
    },
    es: {
      agents: "Agentes", list: "Publicar", properties: "Mis propiedades",
      calendar: "Calendario", plans: "Planes",
      splashHead: "Alquilar en Colombia, con un contrato detrás.",
      splashSub: "Medellín, Bogotá, Cali, Cartagena — contrato firmado, ninguna fianza que nosotros toquemos, y fotos que ambas partes aceptaron.",
      splashPitch: `OneHome nunca retiene tu dinero. Si el propietario pide una fianza, se la pagas directamente a él — no pasa por nosotros y no cobramos comisión sobre ella. En Colombia, en un arriendo de vivienda de treinta días o más la ley no permite exigirla, y así se lo decimos a ambas partes en el anuncio. Además ves por cuánto se vendió realmente la vivienda, según el registro nacional, y antes de la entrada tú y el propietario aceptáis cada foto una por una, para que luego nadie discuta por una marca en la pared. Comisiones mensuales: ${RENTAL_HOST_FEE_PCT.replace(".", ",")} propietario + ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} inquilino (${RENTAL_FEE_PCT.replace(".", ",")} total); publicar, escribir y firmar es gratis.`,
      termsTitle: "Antes de usar OneHome",
      termsP1: `Publicar, escribir y firmar es gratis. Cada pago mensual tiene una comisión de ${RENTAL_HOST_FEE_PCT.replace(".", ",")} para el propietario y ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} para el inquilino (${RENTAL_FEE_PCT.replace(".", ",")} total).`,
      termsP2: "Nosotros nunca retenemos una fianza. La mayoría de las viviendas aquí no piden ninguna, y en Colombia, en un arriendo de 30 días o más, la ley no permite exigirla.",
      termsP3: "Antes de la entrada ambos aceptáis las fotos del inmueble. Lo que no esté en una foto, no es prueba.",
    },
    de: {
      agents: "Makler", list: "Inserieren", properties: "Meine Objekte",
      calendar: "Kalender", plans: "Tarife",
      splashHead: "Mieten, mit einem Vertrag dahinter.",
      splashSub: "Ein echter Vertrag, keine Kaution in unseren Händen und eine Bewertung für beide Seiten.",
      splashPitch: `OneHome hält dein Geld nie. Verlangt ein Vermieter eine Kaution, zahlst du sie ihm direkt — sie läuft nicht über uns und wir nehmen dafür keine Gebühr. In Kolumbien darf bei einem Wohnraummietvertrag ab dreißig Tagen gar keine Kaution verlangt werden, und genau das sagen wir beiden Seiten im Inserat selbst. Du siehst außerdem, wofür die Wohnung wirklich zuletzt verkauft wurde, direkt aus dem nationalen Register, und vor dem Einzug bestätigt ihr beide jedes Foto einzeln, damit später niemand über einen Fleck an der Wand streitet. Monatliche Gebühren: ${RENTAL_HOST_FEE_PCT.replace(".", ",")} für Vermieter + ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} für Mieter (${RENTAL_FEE_PCT.replace(".", ",")} gesamt); Inserieren, Schreiben und Unterschreiben sind kostenlos.`,
      termsTitle: "Bevor du OneHome nutzt",
      termsP1: `Inserieren, Schreiben und Unterschreiben sind kostenlos. Jede Monatszahlung hat ${RENTAL_HOST_FEE_PCT.replace(".", ",")} Vermietergebühr und ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} Mietergebühr (${RENTAL_FEE_PCT.replace(".", ",")} gesamt).`,
      termsP2: "Wir halten nie eine Kaution. Die meisten Wohnungen hier verlangen keine, und in Kolumbien darf ab dreißig Tagen keine verlangt werden.",
      termsP3: "Vor dem Einzug bestätigen beide die Fotos der Wohnung. Was auf keinem Foto ist, ist kein Nachweis.",
    },
    ru: {
      agents: "Агенты", list: "Разместить", properties: "Мои объекты",
      calendar: "Календарь", plans: "Тарифы",
      splashHead: "Аренда, за которой стоит договор.",
      splashSub: "Настоящий договор, залог никогда не проходит через нас, и рейтинг для обеих сторон.",
      splashPitch: `OneHome никогда не удерживает ваши деньги. Если владелец просит залог, вы платите его напрямую владельцу — он не проходит через нас, и мы не берём с него комиссию. В Колумбии при аренде жилья на тридцать дней и дольше закон вообще не разрешает требовать залог, и мы говорим об этом обеим сторонам прямо в объявлении. Вы также видите, за сколько жильё действительно продавалось в последний раз, прямо из государственного реестра, а перед заселением вы и владелец подтверждаете каждую фотографию по очереди, чтобы потом никто не спорил о пятне на стене. Ежемесячная комиссия: ${RENTAL_HOST_FEE_PCT.replace(".", ",")} с владельца + ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} с арендатора (${RENTAL_FEE_PCT.replace(".", ",")} всего); размещение, переписка и подписание бесплатны.`,
      termsTitle: "Прежде чем пользоваться OneHome",
      termsP1: `Размещать, переписываться и подписывать — бесплатно. Каждый ежемесячный платёж включает ${RENTAL_HOST_FEE_PCT.replace(".", ",")} комиссии владельца и ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} комиссии арендатора (${RENTAL_FEE_PCT.replace(".", ",")} всего).`,
      termsP2: "Мы никогда не удерживаем залог. Большинство объявлений здесь его не просят, а в Колумбии при аренде на 30 дней и дольше требовать залог запрещено.",
      termsP3: "Перед заселением обе стороны утверждают фотографии жилья. Чего нет на фото — то не доказательство.",
    },
    zh: {
      agents: "经纪人", list: "发布房源", properties: "我的房源",
      calendar: "日历", plans: "套餐",
      splashHead: "租房，背后有合同。",
      splashSub: "真实的合同、押金从不经过我们，双方都有信用分。",
      splashPitch: `OneHome 从不代持您的钱。如果房东要求押金，您直接付给房东——不经过我们，我们也不从中抽取任何费用。在哥伦比亚，三十天及以上的住宅租约根本不允许要求押金，这一点我们会在房源页面上同时告知双方。您还能查到这套房子上一次真实的成交价格，数据直接来自国家产权登记系统。入住前，您和房东会逐张确认房屋照片，日后就不会为墙上的一处痕迹起争执。每月费用：房东 ${RENTAL_HOST_FEE_PCT} + 租客 ${RENTAL_GUEST_FEE_PCT}（合计 ${RENTAL_FEE_PCT}）；发布、沟通和签约免费。`,
      termsTitle: "使用 OneHome 前请了解",
      termsP1: `发布、沟通、签约均免费。每月付款包含房东 ${RENTAL_HOST_FEE_PCT} 和租客 ${RENTAL_GUEST_FEE_PCT} 的费用（合计 ${RENTAL_FEE_PCT}）。`,
      termsP2: "我们从不代持押金。这里大多数房源不收押金；在哥伦比亚，30 天及以上的租约不允许要求押金。",
      termsP3: "入住前双方共同确认房屋照片。照片上没有的，就不算证据。",
    },
    pt: {
      agents: "Corretores", list: "Anunciar", properties: "Meus imóveis",
      calendar: "Calendário", plans: "Planos",
      splashHead: "Alugar, com um contrato por trás.",
      splashSub: "Um contrato de verdade, nenhum depósito que passe por nós, e nota para os dois lados.",
      splashPitch: `O OneHome nunca retém o seu dinheiro. Se o proprietário pedir um depósito, você paga a ele diretamente — não passa por nós e não cobramos comissão sobre isso. Na Colômbia, num contrato de moradia de trinta dias ou mais a lei não permite exigir depósito, e dizemos isso aos dois lados no próprio anúncio. Você também vê por quanto o imóvel realmente foi vendido da última vez, direto do registro nacional, e antes da entrada você e o proprietário aprovam cada foto uma a uma, para que depois ninguém discuta por uma marca na parede. Taxas mensais: ${RENTAL_HOST_FEE_PCT.replace(".", ",")} para o proprietário + ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} para o inquilino (${RENTAL_FEE_PCT.replace(".", ",")} no total); anunciar, conversar e assinar é grátis.`,
      termsTitle: "Antes de usar o OneHome",
      termsP1: `Anunciar, conversar e assinar é grátis. Cada pagamento mensal tem taxa de ${RENTAL_HOST_FEE_PCT.replace(".", ",")} para o proprietário e ${RENTAL_GUEST_FEE_PCT.replace(".", ",")} para o inquilino (${RENTAL_FEE_PCT.replace(".", ",")} no total).`,
      termsP2: "Nós nunca retemos um depósito. A maioria dos imóveis aqui não pede nenhum, e na Colômbia, num contrato de 30 dias ou mais, a lei não permite exigi-lo.",
      termsP3: "Antes da entrada os dois lados aprovam as fotos do imóvel. O que não está numa foto não é prova.",
    },
  }),
};


/**
 * ONESALE — the buying half of ONE HOME. Opened 10 Aug 2026 on Lee's ruling.
 * ============================================================================================
 * Lee: *"out of One Home there'll be two segments — properties for sale and for rent… For sale
 * will be coming soon, and this is the for rent, so they'll always click for rent for now."*
 *
 * ── WHY IT IS A SECOND PRODUCT AND NOT A TAB ────────────────────────────────────────────────
 * It looks like a twin and Lee is right that most of the code is the same — a listing is a
 * listing. But the MONEY is a different animal, and that is what decides the boundary: a
 * Colombian sale closes through attorneys, and the purchase price cannot and should not move
 * through Stripe. What CAN move through the app is the agent's commission and the earnest money.
 * A product where the headline number never passes through us needs its own footer, its own
 * copy and its own honesty about what it does — a tab inside OneRental would have inherited
 * "deposit held safely" language that is simply untrue of a sale.
 *
 * ── WHAT IT IS FOR, BEYOND LISTINGS (Lee's real insight) ────────────────────────────────────
 * *"Colombia doesn't have a place to show property history… this will be the first app that does
 * track sales."* So the thing worth building is not another Zillow clone — it is the RECORD:
 * what this property sold for, when, and the document that proves it. That is why `sale_history`
 * exists from day one while the transaction does not.
 *
 * COMING_SOON is true in `routes.ts` and the app says so. Listing a property for sale works.
 */
export const ONESALE: AppConfig = {
  key: "onesale",
  /* Same single entitlement as the rent half. See ONERENTAL above. */
  entitlement: "onehome",
  wordmark: { ink: "ne", brand: "Home", tagline: "Compra y venta con historial", markSrc: "/mark-onesale.png" },
  hue: HUES.onesale,
  defaultLang: "co",
  tabs: [
    { to: p("onesale"),              labelKey: "home",     icon: "feed" },
    { to: p("onesale", "/agents"),   labelKey: "agents",   icon: "people" },
    { to: p("onesale", "/list"),     labelKey: "list",     icon: "property", primary: true },
    { to: p("onesale", "/messages"), labelKey: "messages", icon: "messages" },
    { to: p("onesale", "/profile"),  labelKey: "profile",  icon: "profile" },
  ],
  notificationsPath: p("onesale", "/alerts"),
  drawerExtras: [
    { to: p("onesale", "/properties"), labelKey: "properties", icon: "keys" },
    { to: p("onesale", "/plans"),      labelKey: "plans",      icon: "plans" },
    { to: p("onesale", "/settings"),   labelKey: "settings",   icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onesale") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      agents: "Agents", list: "List a property", properties: "My properties", plans: "Plans",
      splashHead: "Property for sale in Colombia.",
      splashSub: "With the sale history nobody else keeps — what it sold for, when, and the document that proves it.",
      splashPitch: "OneHome shows you the registered sale history of a property — what it genuinely last sold for, from the national registry — which nobody in Colombia has been able to show a buyer before. Filter on the things listings never state, and see every price in pesos or dollars at the official daily rate.",
      termsTitle: "Before you use OneHome",
      termsP1: "Listing, messaging and documents are free. We are not part of the closing.",
      termsP2: "A sale closes through your attorney. We hold the record, not the purchase price.",
      termsP3: "What a property sold for becomes part of its permanent history here.",
    },
    co: {
      agents: "Agentes", list: "Publicar inmueble", properties: "Mis inmuebles", plans: "Planes",
      splashHead: "Inmuebles en venta en Colombia.",
      splashSub: "Con el historial de ventas que nadie más guarda — por cuánto se vendió, cuándo, y el documento que lo prueba.",
      splashPitch: "OneHome le muestra el historial de ventas registrado de un inmueble: por cuánto se vendió realmente la última vez, según el registro nacional, algo que en Colombia nadie le había podido mostrar a un comprador. Filtre por lo que los anuncios nunca dicen y vea cada precio en pesos o en dólares a la tasa oficial del día.",
      termsTitle: "Antes de usar OneHome",
      termsP1: "Publicar, escribir y guardar documentos es gratis. No hacemos parte del cierre.",
      termsP2: "La venta se cierra con su abogado. Nosotros guardamos el registro, no el precio de venta.",
      termsP3: "Por cuánto se vendió un inmueble queda en su historial permanente aquí.",
    },
    es: {
      agents: "Agentes", list: "Publicar inmueble", properties: "Mis inmuebles", plans: "Planes",
      splashHead: "Inmuebles en venta en Colombia.",
      splashSub: "Con el historial de ventas que nadie más guarda — por cuánto se vendió, cuándo, y el documento que lo prueba.",
      splashPitch: "OneHome te muestra el historial de ventas registrado de un inmueble: por cuánto se vendió realmente la última vez, según el registro nacional, algo que en Colombia nadie había podido enseñar a un comprador. Filtra por lo que los anuncios nunca dicen y ve cada precio en pesos o en dólares al cambio oficial del día.",
      termsTitle: "Antes de usar OneHome",
      termsP1: "Publicar, escribir y guardar documentos es gratis. No hacemos parte del cierre.",
      termsP2: "La venta se cierra con su abogado. Nosotros guardamos el registro, no el precio de venta.",
      termsP3: "Por cuánto se vendió un inmueble queda en su historial permanente aquí.",
    },
    de: { agents: "Makler", list: "Objekt inserieren", properties: "Meine Objekte", plans: "Tarife",
      splashHead: "Immobilien zum Kauf in Kolumbien.",
      splashSub: "Mit der Verkaufshistorie, die sonst niemand führt.",
      splashPitch: "OneHome zeigt dir die eingetragene Verkaufshistorie einer Immobilie — wofür sie zuletzt wirklich verkauft wurde, aus dem nationalen Register — was in Kolumbien bisher niemand einem Käufer zeigen konnte. Filtere nach den Dingen, die Inserate nie angeben, und sieh jeden Preis in Pesos oder Dollar zum offiziellen Tageskurs.",
      termsTitle: "Bevor du OneHome nutzt",
      termsP1: "Inserieren, Schreiben und Dokumente sind kostenlos. Wir sind nicht Teil des Abschlusses.",
      termsP2: "Der Verkauf wird über deinen Anwalt abgeschlossen. Wir führen das Register, nicht den Kaufpreis.",
      termsP3: "Der erzielte Preis wird Teil der dauerhaften Historie des Objekts." },
    ru: { agents: "Агенты", list: "Разместить объект", properties: "Мои объекты", plans: "Тарифы",
      splashHead: "Недвижимость на продажу в Колумбии.",
      splashSub: "С историей продаж, которую больше никто не ведёт.",
      splashPitch: "OneHome показывает зарегистрированную историю продаж недвижимости — за сколько она действительно продавалась в последний раз, по данным национального реестра, — чего в Колумбии покупателю раньше не мог показать никто. Фильтруйте по тому, о чём объявления никогда не пишут, и смотрите каждую цену в песо или долларах по официальному дневному курсу.",
      termsTitle: "Прежде чем пользоваться OneHome",
      termsP1: "Размещение, переписка и документы бесплатны. Мы не участвуем в сделке.",
      termsP2: "Сделку закрывает ваш юрист. Мы храним запись, а не деньги покупателя.",
      termsP3: "Цена продажи становится частью постоянной истории объекта." },
    zh: { agents: "经纪人", list: "发布房源", properties: "我的房源", plans: "套餐",
      splashHead: "哥伦比亚待售房产。",
      splashSub: "附带别处没有的成交历史。",
      splashPitch: "OneHome 向您展示房产的官方成交记录——上一次真实的成交价，来自国家登记处——这是在哥伦比亚以前没人能给买家看的。按房源信息里从来不写的条件筛选，每个价格都能按官方当日汇率以比索或美元查看。",
      termsTitle: "使用 OneHome 前请了解",
      termsP1: "发布、沟通与保存文件均免费。我们不参与过户。",
      termsP2: "过户由您的律师完成。我们保存记录，不经手房款。",
      termsP3: "成交价将永久记入该房产的历史。" },
    pt: { agents: "Corretores", list: "Anunciar imóvel", properties: "Meus imóveis", plans: "Planos",
      splashHead: "Imóveis à venda na Colômbia.",
      splashSub: "Com o histórico de vendas que mais ninguém guarda.",
      splashPitch: "O OneHome mostra o histórico registrado de venda de um imóvel — por quanto ele realmente foi vendido pela última vez, direto do registro nacional — algo que ninguém na Colômbia conseguia mostrar a um comprador antes. Filtre pelo que os anúncios nunca informam e veja cada preço em pesos ou dólares pelo câmbio oficial do dia.",
      termsTitle: "Antes de usar o OneHome",
      termsP1: "Anunciar, conversar e guardar documentos é grátis. Não participamos do fechamento.",
      termsP2: "A venda fecha com o seu advogado. Guardamos o registro, não o valor do imóvel.",
      termsP3: "Por quanto um imóvel foi vendido entra no seu histórico permanente aqui." },
  }),
};

function merge(
  shell: Record<string, Record<string, string>>,
  own: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const k of new Set([...Object.keys(shell), ...Object.keys(own)])) {
    out[k] = { ...(shell[k] ?? {}), ...(own[k] ?? {}) };
  }
  return out;
}

/** Every shell, by key. A router can look up the product it is standing in and mount it. */
/**
 * ONEHOME — the app a member names, as a config in its own right.
 * ============================================================================================
 * It is the rent section's config re-keyed. That is not laziness; it is the point. `/home` is a
 * doorway that lands on the rent segment, so if it ever renders chrome of its own that chrome
 * must be byte-identical to what the person is about to see. Spreading ONERENTAL means a footer
 * or dictionary change on the rent side can never leave the doorway showing last week's tabs.
 *
 * `key` is `onehome` so the drawer and switcher highlight the APP, and the entitlement is the
 * same single `onehome` row either section grants.
 */
/* The APP wears its own hue. Everything else about it is the rent section's config — same tabs,
   same footer, same dictionary — but the launcher surfaces (drawer row, switcher tile, Your World
   card, marketing card) paint `key`'s hue, and Lee moved the APP to a medium teal on 11 Aug while
   leaving `/rentals` sky and `/sales` petrol. Spreading ONERENTAL wholesale silently kept the app
   on sky, which is the bug this line existed to avoid in the other direction. */
export const ONEHOME: AppConfig = {
  ...ONERENTAL, key: "onehome", entitlement: "onehome", hue: HUES.onehome,
};

/**
 * ONEPAY — the seventh app (Lee, 7 Sep 2026). Merchant payments for Colombia, phone-first.
 * ============================================================================================
 * Footer: Overview · Activity · CHARGE (centre) · Messages · Profile. Charge is the one action
 * the product exists for. Catalog, staff, devices and the daily closeout live in the drawer.
 * Phone tap acceptance is NOT promised by any label here — it lights up on the Charge screen
 * only when the merchant's provider is configured (the light-up-when-configured pattern).
 */
export const ONEPAY: AppConfig = {
  key: "onepay",
  wordmark: { ink: "ne", brand: "Pay", tagline: "Paid, and on record", markSrc: "/mark-onepay.png" },
  hue: HUES.onepay,
  tabs: [
    { to: p("onepay"),              labelKey: "overview", icon: "home" },
    { to: p("onepay", "/activity"), labelKey: "activity", icon: "feed" },
    { to: p("onepay", "/charge"),   labelKey: "charge",   icon: "money", primary: true },
    { to: p("onepay", "/messages"), labelKey: "messages", icon: "messages" },
    { to: p("onepay", "/profile"),  labelKey: "profile",  icon: "profile" },
  ],
  notificationsPath: p("onepay", "/alerts"),
  drawerExtras: [
    { to: p("onepay", "/closeout"), labelKey: "closeout", icon: "billing" },
    { to: p("onepay", "/catalog"),  labelKey: "catalog",  icon: "plans" },
    { to: p("onepay", "/staff"),    labelKey: "staff",    icon: "people" },
    { to: p("onepay", "/devices"),  labelKey: "devices",  icon: "device" },
    { to: p("onepay", "/settings"), labelKey: "settings", icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onepay") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      overview: "Overview", activity: "Activity", charge: "Charge", closeout: "Closeout",
      catalog: "Catalog", staff: "Staff", devices: "Devices",
      splashHead: "Get paid. Keep the record.",
      splashSub: "Take a payment, know what happened to it, and hand over a receipt — from your phone.",
      splashPitch: "OnePay brings taking a payment, its real status, the receipt and the day's totals into one place. Cash and transfers today; card acceptance on your phone as soon as it is switched on for your business.",
      termsTitle: "Before you use OnePay",
      termsP1: "Every amount is calculated and recorded on our servers, never in your browser.",
      termsP2: "A payment counts as paid only when the money is confirmed, not when a screen says so.",
      termsP3: "Refunds, voids and closeouts are kept forever; nothing is edited after the fact.",
    },
    es: {
      overview: "Resumen", activity: "Actividad", charge: "Cobrar", closeout: "Cierre",
      catalog: "Catálogo", staff: "Equipo", devices: "Dispositivos",
      splashHead: "Cobre. Y quede registrado.",
      splashSub: "Reciba un pago, sepa qué pasó con él y entregue un recibo — desde su teléfono.",
      splashPitch: "OnePay reúne el cobro, su estado real, el recibo y los totales del día en un solo lugar. Efectivo y transferencias hoy; pago con tarjeta en su teléfono en cuanto se active para su negocio.",
      termsTitle: "Antes de usar OnePay",
      termsP1: "Cada monto se calcula y registra en nuestros servidores, nunca en su navegador.",
      termsP2: "Un pago cuenta como pagado solo cuando el dinero está confirmado, no cuando una pantalla lo dice.",
      termsP3: "Reembolsos, anulaciones y cierres se conservan para siempre; nada se edita después.",
    },
    co: {
      overview: "Resumen", activity: "Actividad", charge: "Cobrar", closeout: "Cierre",
      catalog: "Catálogo", staff: "Equipo", devices: "Dispositivos",
      splashHead: "Cobre. Y quede registrado.",
      splashSub: "Reciba un pago, sepa qué pasó con él y entregue un recibo — desde su teléfono.",
      splashPitch: "OnePay reúne el cobro, su estado real, el recibo y los totales del día en un solo lugar. Efectivo y transferencias hoy; pago con tarjeta en su teléfono en cuanto se active para su negocio.",
      termsTitle: "Antes de usar OnePay",
      termsP1: "Cada monto se calcula y registra en nuestros servidores, nunca en su navegador.",
      termsP2: "Un pago cuenta como pagado solo cuando el dinero está confirmado, no cuando una pantalla lo dice.",
      termsP3: "Reembolsos, anulaciones y cierres se conservan para siempre; nada se edita después.",
    },
    de: {
      overview: "Übersicht", activity: "Aktivität", charge: "Kassieren", closeout: "Tagesabschluss",
      catalog: "Katalog", staff: "Team", devices: "Geräte",
      splashHead: "Bezahlt werden. Belegt bleiben.",
      splashSub: "Zahlung annehmen, ihren Stand kennen und einen Beleg aushändigen — vom Handy aus.",
      termsTitle: "Bevor Sie OnePay nutzen",
      termsP1: "Jeder Betrag wird auf unseren Servern berechnet und gespeichert, nie in Ihrem Browser.",
      termsP2: "Eine Zahlung gilt erst als bezahlt, wenn das Geld bestätigt ist, nicht wenn ein Bildschirm es sagt.",
      termsP3: "Erstattungen, Stornierungen und Abschlüsse bleiben dauerhaft; nichts wird nachträglich geändert.",
    },
    ru: {
      overview: "Обзор", activity: "Операции", charge: "Принять оплату", closeout: "Закрытие дня",
      catalog: "Каталог", staff: "Сотрудники", devices: "Устройства",
      splashHead: "Получайте оплату. Храните запись.",
      splashSub: "Примите платёж, узнайте его статус и выдайте чек — с телефона.",
      termsTitle: "Прежде чем использовать OnePay",
      termsP1: "Каждая сумма рассчитывается и сохраняется на наших серверах, а не в вашем браузере.",
      termsP2: "Платёж считается оплаченным только после подтверждения денег, а не по надписи на экране.",
      termsP3: "Возвраты, отмены и закрытия хранятся вечно; ничего не редактируется задним числом.",
    },
    zh: {
      overview: "概览", activity: "交易记录", charge: "收款", closeout: "日结",
      catalog: "商品目录", staff: "员工", devices: "设备",
      splashHead: "收到款，留好账。",
      splashSub: "用手机收款、随时知道款项状态并出具收据。",
      termsTitle: "使用 OnePay 之前",
      termsP1: "每一笔金额都在我们的服务器上计算和记录，而不是在您的浏览器中。",
      termsP2: "只有在款项确认后才算已支付，而不是屏幕显示时。",
      termsP3: "退款、作废和日结永久保存；事后不会被修改。",
    },
    pt: {
      overview: "Resumo", activity: "Atividade", charge: "Cobrar", closeout: "Fechamento",
      catalog: "Catálogo", staff: "Equipe", devices: "Dispositivos",
      splashHead: "Receba. E deixe registrado.",
      splashSub: "Receba um pagamento, saiba o que aconteceu com ele e entregue um recibo — pelo celular.",
      termsTitle: "Antes de usar o OnePay",
      termsP1: "Cada valor é calculado e registrado nos nossos servidores, nunca no seu navegador.",
      termsP2: "Um pagamento só conta como pago quando o dinheiro é confirmado, não quando uma tela diz isso.",
      termsP3: "Reembolsos, cancelamentos e fechamentos ficam guardados para sempre; nada é editado depois.",
    },
  }),
};

/**
 * ONE BUSINESS — the eighth app (Lee, 7 Sep 2026). The customer app for every One World Labs
 * service: OneVoice (flagship), OnePage, OneApp and the rest of the catalog, one account.
 * ============================================================================================
 * Footer: Overview · Leads · SERVICES (centre) · Messages · Profile. Results and the paid
 * sales pipeline live in the drawer; the pipeline is server-gated by its own entitlement.
 */
export const ONEBUSINESS: AppConfig = {
  key: "onebusiness",
  wordmark: { ink: "ne", brand: "Business", tagline: "Every service, one account", markSrc: "/mark-onebusiness.png" },
  hue: HUES.onebusiness,
  tabs: [
    { to: p("onebusiness"),              labelKey: "overview", icon: "home" },
    { to: p("onebusiness", "/leads"),    labelKey: "leads",    icon: "people" },
    { to: p("onebusiness", "/services"), labelKey: "services", icon: "discover", primary: true },
    { to: p("onebusiness", "/messages"), labelKey: "messages", icon: "messages" },
    { to: p("onebusiness", "/profile"),  labelKey: "profile",  icon: "profile" },
  ],
  notificationsPath: p("onebusiness", "/alerts"),
  drawerExtras: [
    { to: p("onebusiness", "/voice"),      labelKey: "voiceModule", icon: "calls" },
    { to: p("onebusiness", "/results"),    labelKey: "results",     icon: "score" },
    { to: p("onebusiness", "/pipeline"),   labelKey: "pipeline",    icon: "deals" },
    { to: p("onebusiness", "/businesses"), labelKey: "businesses",  icon: "property" },
    { to: p("onebusiness", "/settings"),   labelKey: "settings",    icon: "settings" },
  ],
  splash: { headlineKey: "splashHead", subKey: "splashSub", pitchKey: "splashPitch" },
  terms: { titleKey: "termsTitle", pointKeys: ["termsP1", "termsP2", "termsP3"], url: terms("onebusiness") },
  dictionary: merge(shellDict(LANGS), {
    en: {
      overview: "Overview", leads: "Leads", services: "Services", results: "Results",
      pipeline: "Sales pipeline", businesses: "Businesses", voiceModule: "OneVoice",
      splashHead: "Your business, in one place.",
      splashSub: "The calls, the website, the leads and the results from every service you buy from us.",
      splashPitch: "One Business is where a business owner sees what One World Labs is doing for them: the receptionist's calls and bookings, the website's inquiries, the app's progress, and the numbers that come from all of it — one login, one account, every service.",
      termsTitle: "Before you use One Business",
      termsP1: "Each service is priced and activated by One World Labs; a request here is not a charge.",
      termsP2: "Your business's calls, leads and results are visible only to people you add to that business.",
      termsP3: "Numbers come from connected accounts and say when they were last refreshed; nothing is estimated.",
    },
    es: {
      overview: "Resumen", leads: "Prospectos", services: "Servicios", results: "Resultados",
      pipeline: "Embudo de ventas", businesses: "Negocios", voiceModule: "OneVoice",
      splashHead: "Su negocio, en un solo lugar.",
      splashSub: "Las llamadas, el sitio web, los prospectos y los resultados de cada servicio que nos contrata.",
      splashPitch: "One Business es donde el dueño de un negocio ve lo que One World Labs hace por él: las llamadas y citas de la recepcionista, las consultas del sitio web, el avance de la app y los números que salen de todo eso — un inicio de sesión, una cuenta, todos los servicios.",
      termsTitle: "Antes de usar One Business",
      termsP1: "Cada servicio lo cotiza y activa One World Labs; una solicitud aquí no es un cobro.",
      termsP2: "Las llamadas, prospectos y resultados de su negocio solo los ven las personas que usted agregue a ese negocio.",
      termsP3: "Los números vienen de cuentas conectadas e indican cuándo se actualizaron; nada se estima.",
    },
    co: {
      overview: "Resumen", leads: "Prospectos", services: "Servicios", results: "Resultados",
      pipeline: "Embudo de ventas", businesses: "Negocios", voiceModule: "OneVoice",
      splashHead: "Su negocio, en un solo lugar.",
      splashSub: "Las llamadas, el sitio web, los prospectos y los resultados de cada servicio que nos contrata.",
      splashPitch: "One Business es donde el dueño de un negocio ve lo que One World Labs hace por él: las llamadas y citas de la recepcionista, las consultas del sitio web, el avance de la app y los números que salen de todo eso — un inicio de sesión, una cuenta, todos los servicios.",
      termsTitle: "Antes de usar One Business",
      termsP1: "Cada servicio lo cotiza y activa One World Labs; una solicitud aquí no es un cobro.",
      termsP2: "Las llamadas, prospectos y resultados de su negocio solo los ven las personas que usted agregue a ese negocio.",
      termsP3: "Los números vienen de cuentas conectadas e indican cuándo se actualizaron; nada se estima.",
    },
    de: {
      overview: "Übersicht", leads: "Anfragen", services: "Leistungen", results: "Ergebnisse",
      pipeline: "Vertriebspipeline", businesses: "Unternehmen", voiceModule: "OneVoice",
      splashHead: "Ihr Unternehmen, an einem Ort.",
      splashSub: "Anrufe, Website, Anfragen und Ergebnisse jeder Leistung, die Sie bei uns buchen.",
      termsTitle: "Bevor Sie One Business nutzen",
      termsP1: "Jede Leistung wird von One World Labs bepreist und aktiviert; eine Anfrage hier ist keine Buchung.",
      termsP2: "Anrufe, Anfragen und Ergebnisse Ihres Unternehmens sehen nur Personen, die Sie hinzufügen.",
      termsP3: "Zahlen stammen aus verbundenen Konten und nennen ihren Stand; nichts wird geschätzt.",
    },
    ru: {
      overview: "Обзор", leads: "Обращения", services: "Услуги", results: "Результаты",
      pipeline: "Воронка продаж", businesses: "Компании", voiceModule: "OneVoice",
      splashHead: "Ваш бизнес в одном месте.",
      splashSub: "Звонки, сайт, обращения и результаты каждой услуги, которую вы у нас заказываете.",
      termsTitle: "Прежде чем использовать One Business",
      termsP1: "Каждую услугу оценивает и активирует One World Labs; запрос здесь — не оплата.",
      termsP2: "Звонки, обращения и результаты вашей компании видят только те, кого вы добавили.",
      termsP3: "Цифры берутся из подключённых аккаунтов с датой обновления; ничего не оценивается на глаз.",
    },
    zh: {
      overview: "概览", leads: "潜在客户", services: "服务", results: "成果",
      pipeline: "销售漏斗", businesses: "企业", voiceModule: "OneVoice",
      splashHead: "您的生意，尽在一处。",
      splashSub: "您向我们购买的每项服务的来电、网站、线索和成果。",
      termsTitle: "使用 One Business 之前",
      termsP1: "每项服务由 One World Labs 定价并开通；此处的申请不是扣费。",
      termsP2: "您企业的来电、线索和成果只有您添加的人可以看到。",
      termsP3: "数据来自已连接的账户并标明更新时间；没有任何估算。",
    },
    pt: {
      overview: "Resumo", leads: "Contatos", services: "Serviços", results: "Resultados",
      pipeline: "Funil de vendas", businesses: "Empresas", voiceModule: "OneVoice",
      splashHead: "Seu negócio, em um só lugar.",
      splashSub: "As ligações, o site, os contatos e os resultados de cada serviço que você contrata conosco.",
      termsTitle: "Antes de usar o One Business",
      termsP1: "Cada serviço é precificado e ativado pela One World Labs; um pedido aqui não é uma cobrança.",
      termsP2: "As ligações, contatos e resultados da sua empresa só são vistos por quem você adicionar.",
      termsP3: "Os números vêm de contas conectadas e informam quando foram atualizados; nada é estimado.",
    },
  }),
};

export const CONFIGS: Record<AppKey, AppConfig> = {
  onejob: ONEJOB, onescore: ONESCORE, oneevent: ONEEVENT,
  onesocial: ONESOCIAL, oneagent: ONEAGENT,
  onehome: ONEHOME, onerental: ONERENTAL, onesale: ONESALE,
  onevoice: ONEVOICE, onepage: ONEPAGE, oneapp: ONEAPP,
  onepay: ONEPAY, onebusiness: ONEBUSINESS,
};
