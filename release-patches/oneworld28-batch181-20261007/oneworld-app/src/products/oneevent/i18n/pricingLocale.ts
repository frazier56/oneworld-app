/**
 * THE PRICING PAGE, IN EVERY LANGUAGE THE APP OFFERS.
 * ============================================================================================
 * PUB30, on the 168 staging run: *"OneEvent's Pricing page is English-only (headings, 'Choose
 * your plan', '/mo billed monthly', feature lists) even with Spanish chosen — half-translated
 * screen; please translate it in the 7 languages."*
 *
 * They are right, and overlay 40 made it worse rather than better: the prices now read in the
 * member's own currency on a page whose every other word is English. A Colombian host sees
 * "COP 31.912" under the heading "Choose your plan" and the feature "Require a minimum OneScore
 * to register". That is the screen where somebody decides to pay us, so it is the last one that
 * should be asking them to read a second language.
 *
 * ── WHY A DICTIONARY OF ITS OWN ─────────────────────────────────────────────────────────────
 * The same reasoning `PhotoDeck` uses for its menu: this is ~45 strings that belong to one
 * screen, and folding them into `createEventLocale` would make the shared file heavier for every
 * screen that never shows a price. Keyed by the English string, so a missing translation shows
 * English rather than a key — the failure mode is "not yet translated", never "£{pricing.cta}".
 *
 * ── TWO THINGS THAT ARE DELIBERATELY NOT TRANSLATED ─────────────────────────────────────────
 * · The plan NAMES — Basic, Pro, VIP. They are what the plan is called in the database, in
 *   Stripe, in the admin console and in every support conversation. A member told their "plan
 *   Pro" became "plan Profesional" has to translate it back before anyone can help them.
 * · "TRM" and "Superintendencia Financiera" in the rate footnote: those are the Colombian
 *   institution's own names, and the whole point of citing them is that they are checkable.
 *
 * ── USTED, NOT TÚ ───────────────────────────────────────────────────────────────────────────
 * The rest of Create Event addresses the member as `usted`, and PUB30 flagged that my overlay-39
 * strings had drifted to `tú`. One screen cannot change how formally the product speaks to
 * somebody halfway through a flow, least of all the screen that asks for money. `usted` here, and
 * the overlay-39 lines corrected to match.
 */

type L = Record<string, string>;

/** `co` is Colombian Spanish and inherits `es` wholesale — same copy, different flag. */
const LANGS = ["en", "es", "de", "ru", "zh", "pt"] as const;

const D: Record<string, L> = {
  /* ── headings ────────────────────────────────────────────────────────────────────────── */
  "Choose your plan": {
    es: "Elija su plan", de: "Wählen Sie Ihren Tarif", ru: "Выберите тариф",
    zh: "选择您的方案", pt: "Escolha o seu plano",
  },
  "Start free. Upgrade for richer AI descriptions and pro host tools — cancel anytime.": {
    es: "Empiece gratis. Mejore su plan para descripciones con IA más completas y herramientas de anfitrión — cancele cuando quiera.",
    de: "Kostenlos starten. Upgraden Sie für ausführlichere KI-Beschreibungen und Profi-Werkzeuge — jederzeit kündbar.",
    ru: "Начните бесплатно. Перейдите на платный тариф ради более подробных описаний с ИИ и инструментов организатора — отмена в любой момент.",
    zh: "免费开始。升级可获得更丰富的 AI 描述和专业主办工具——随时可取消。",
    pt: "Comece grátis. Faça upgrade para descrições com IA mais completas e ferramentas de anfitrião — cancele quando quiser.",
  },

  /* ── billing cadence toggle ──────────────────────────────────────────────────────────── */
  "Monthly": { es: "Mensual", de: "Monatlich", ru: "Помесячно", zh: "按月", pt: "Mensal" },
  "3 months": { es: "3 meses", de: "3 Monate", ru: "3 месяца", zh: "3 个月", pt: "3 meses" },
  "save up to 20%": {
    es: "ahorre hasta 20%", de: "bis zu 20% sparen", ru: "экономия до 20%",
    zh: "最多省 20%", pt: "economize até 20%",
  },

  /* ── founder code ────────────────────────────────────────────────────────────────────── */
  "Have a founder code?": {
    es: "¿Tiene un código de fundador?", de: "Haben Sie einen Gründer-Code?",
    ru: "Есть код основателя?", zh: "有创始人代码吗？", pt: "Tem um código de fundador?",
  },
  "Apply": { es: "Aplicar", de: "Anwenden", ru: "Применить", zh: "使用", pt: "Aplicar" },
  "Remove": { es: "Quitar", de: "Entfernen", ru: "Убрать", zh: "移除", pt: "Remover" },
  "That code isn't valid.": {
    es: "Ese código no es válido.", de: "Dieser Code ist ungültig.",
    ru: "Этот код недействителен.", zh: "该代码无效。", pt: "Esse código não é válido.",
  },
  "your upgrade will be free": {
    es: "su mejora será gratis", de: "Ihr Upgrade ist kostenlos",
    ru: "ваше повышение тарифа будет бесплатным", zh: "您的升级将免费", pt: "o seu upgrade será grátis",
  },
  "your upgrade will be $1": {
    es: "su mejora costará 1 dólar", de: "Ihr Upgrade kostet 1 US-Dollar",
    ru: "повышение тарифа будет стоить 1 доллар", zh: "您的升级将收费 1 美元",
    pt: "o seu upgrade custará 1 dólar",
  },
  "Now choose a plan below.": {
    es: "Ahora elija un plan abajo.", de: "Wählen Sie jetzt unten einen Tarif.",
    ru: "Теперь выберите тариф ниже.", zh: "现在请在下方选择方案。", pt: "Agora escolha um plano abaixo.",
  },

  /* ── price lines ─────────────────────────────────────────────────────────────────────── */
  "MOST POPULAR": {
    es: "MÁS POPULAR", de: "AM BELIEBTESTEN", ru: "ПОПУЛЯРНЫЙ ВЫБОР",
    zh: "最受欢迎", pt: "MAIS POPULAR",
  },
  "Free": { es: "Gratis", de: "Kostenlos", ru: "Бесплатно", zh: "免费", pt: "Grátis" },
  "forever": { es: "para siempre", de: "dauerhaft", ru: "навсегда", zh: "永久", pt: "para sempre" },
  "/mo": { es: "/mes", de: "/Mon.", ru: "/мес", zh: "/月", pt: "/mês" },
  "billed monthly": {
    es: "facturado cada mes", de: "monatlich abgerechnet", ru: "оплата ежемесячно",
    zh: "按月计费", pt: "cobrado mensalmente",
  },
  /* {0} = the three-month total, already formatted in the reader's currency. */
  "{0} billed every 3 months": {
    en: "{0} billed every 3 months",
    es: "{0} facturado cada 3 meses", de: "{0} alle 3 Monate abgerechnet",
    ru: "{0} — оплата раз в 3 месяца", zh: "{0}，每 3 个月计费一次",
    pt: "{0} cobrado a cada 3 meses",
  },
  /* {0} = the dollar amount actually charged, e.g. "$9.99 USD". */
  "charged as {0}": {
    en: "charged as {0}",
    es: "se cobra {0}", de: "belastet werden {0}", ru: "списывается {0}",
    zh: "实际扣款 {0}", pt: "cobrado como {0}",
  },
  /* {0} = percent off, {1} = the monthly price. */
  "{0}% off vs {1}/mo": {
    en: "{0}% off vs {1}/mo",
    es: "{0}% menos que {1}/mes", de: "{0}% günstiger als {1}/Mon.",
    ru: "на {0}% дешевле, чем {1}/мес", zh: "比 {1}/月 便宜 {0}%",
    pt: "{0}% mais barato que {1}/mês",
  },

  /* ── buttons ─────────────────────────────────────────────────────────────────────────── */
  "Starting checkout…": {
    es: "Abriendo el pago…", de: "Bezahlvorgang wird geöffnet…", ru: "Открываем оплату…",
    zh: "正在打开结账…", pt: "Abrindo o pagamento…",
  },
  "Current plan": {
    es: "Plan actual", de: "Aktueller Tarif", ru: "Текущий тариф", zh: "当前方案", pt: "Plano atual",
  },
  "Downgrade to Basic": {
    es: "Cambiar a Basic", de: "Zu Basic wechseln", ru: "Перейти на Basic",
    zh: "降级到 Basic", pt: "Mudar para Basic",
  },
  /* {0} = the plan name, which is never translated. */
  "Choose {0}": {
    en: "Choose {0}",
    es: "Elegir {0}", de: "{0} wählen", ru: "Выбрать {0}", zh: "选择 {0}", pt: "Escolher {0}",
  },
  "Opening billing…": {
    es: "Abriendo la facturación…", de: "Abrechnung wird geöffnet…", ru: "Открываем счета…",
    zh: "正在打开账单…", pt: "Abrindo a faturação…",
  },
  "Manage billing · change or cancel your plan": {
    es: "Gestionar la facturación · cambiar o cancelar su plan",
    de: "Abrechnung verwalten · Tarif ändern oder kündigen",
    ru: "Управление оплатой · сменить или отменить тариф",
    zh: "管理账单 · 更改或取消方案",
    pt: "Gerir a faturação · mudar ou cancelar o seu plano",
  },
  "Continue with Basic (free) →": {
    es: "Continuar con Basic (gratis) →", de: "Mit Basic weiter (kostenlos) →",
    ru: "Продолжить с Basic (бесплатно) →", zh: "继续使用 Basic（免费）→",
    pt: "Continuar com Basic (grátis) →",
  },

  /* ── the rate footnote ───────────────────────────────────────────────────────────────── */
  /* {0} = currency code, {1} = the date the TRM took effect. "TRM" and the institution's name
     stay in Spanish in every language: they are what the thing is called, and the point of
     naming them is that a member can go and check. */
  "Shown in {0} at the official TRM in force from {1}, certified by the Superintendencia Financiera. Your card is charged in US dollars.": {
    en: "Shown in {0} at the official TRM in force from {1}, certified by the Superintendencia Financiera. Your card is charged in US dollars.",
    es: "Mostrado en {0} a la TRM oficial vigente desde {1}, certificada por la Superintendencia Financiera. Su tarjeta se cobra en dólares estadounidenses.",
    de: "Angezeigt in {0} zur offiziellen TRM, gültig ab {1}, zertifiziert von der Superintendencia Financiera. Ihre Karte wird in US-Dollar belastet.",
    ru: "Показано в {0} по официальному курсу TRM, действующему с {1}, заверенному Superintendencia Financiera. С карты списываются доллары США.",
    zh: "以 {0} 显示，采用自 {1} 起生效的官方 TRM 汇率，由哥伦比亚金融监管局认证。您的银行卡将以美元扣款。",
    pt: "Mostrado em {0} à TRM oficial em vigor desde {1}, certificada pela Superintendencia Financiera. O seu cartão é cobrado em dólares americanos.",
  },
  "Shown in {0} at today's published rate. Your card is charged in US dollars.": {
    en: "Shown in {0} at today's published rate. Your card is charged in US dollars.",
    es: "Mostrado en {0} a la tasa publicada de hoy. Su tarjeta se cobra en dólares estadounidenses.",
    de: "Angezeigt in {0} zum heute veröffentlichten Kurs. Ihre Karte wird in US-Dollar belastet.",
    ru: "Показано в {0} по сегодняшнему опубликованному курсу. С карты списываются доллары США.",
    zh: "以 {0} 显示，采用今日公布的汇率。您的银行卡将以美元扣款。",
    pt: "Mostrado em {0} à taxa publicada de hoje. O seu cartão é cobrado em dólares americanos.",
  },
  "Prices in USD.": {
    es: "Precios en dólares estadounidenses.", de: "Preise in US-Dollar.",
    ru: "Цены в долларах США.", zh: "价格以美元计。", pt: "Preços em dólares americanos.",
  },
  /* {0} = the platform fee percentage. */
  "3-month plans are billed once, up front. OneEvent's platform fee ({0}) is separate and only applies to paid tickets.": {
    en: "3-month plans are billed once, up front. OneEvent's platform fee ({0}) is separate and only applies to paid tickets.",
    es: "Los planes de 3 meses se cobran una sola vez, por adelantado. La comisión de OneEvent ({0}) es aparte y solo se aplica a las entradas de pago.",
    de: "3-Monats-Tarife werden einmalig im Voraus abgerechnet. Die OneEvent-Gebühr ({0}) kommt separat und gilt nur für bezahlte Tickets.",
    ru: "Трёхмесячные тарифы оплачиваются один раз, авансом. Комиссия OneEvent ({0}) взимается отдельно и только с платных билетов.",
    zh: "3 个月方案一次性预先收费。OneEvent 的平台费（{0}）单独计算，仅适用于付费门票。",
    pt: "Os planos de 3 meses são cobrados uma única vez, antecipadamente. A comissão da OneEvent ({0}) é à parte e só se aplica a bilhetes pagos.",
  },

  /* ── plan taglines ───────────────────────────────────────────────────────────────────── */
  "Everything you need to run your first events.": {
    es: "Todo lo necesario para organizar sus primeros eventos.",
    de: "Alles, was Sie für Ihre ersten Veranstaltungen brauchen.",
    ru: "Всё необходимое для первых мероприятий.",
    zh: "举办您头几场活动所需的一切。",
    pt: "Tudo o que precisa para realizar os seus primeiros eventos.",
  },
  "For active hosts who want more polish and control.": {
    es: "Para anfitriones activos que quieren más detalle y control.",
    de: "Für aktive Gastgeber, die mehr Feinschliff und Kontrolle wollen.",
    ru: "Для активных организаторов, которым нужно больше контроля и качества.",
    zh: "适合希望更精致、更可控的活跃主办方。",
    pt: "Para anfitriões ativos que querem mais acabamento e controlo.",
  },
  "Every tool unlocked for serious event businesses.": {
    es: "Todas las herramientas desbloqueadas para negocios de eventos.",
    de: "Alle Werkzeuge freigeschaltet für professionelle Veranstalter.",
    ru: "Все инструменты открыты для серьёзного событийного бизнеса.",
    zh: "为专业活动企业解锁全部工具。",
    pt: "Todas as ferramentas desbloqueadas para negócios de eventos.",
  },

  /* ── plan features ───────────────────────────────────────────────────────────────────── */
  "Create events, sell tickets & take RSVPs": {
    es: "Cree eventos, venda entradas y reciba confirmaciones",
    de: "Veranstaltungen erstellen, Tickets verkaufen, Zusagen sammeln",
    ru: "Создавайте мероприятия, продавайте билеты и собирайте отклики",
    zh: "创建活动、售票并收集报名",
    pt: "Crie eventos, venda bilhetes e receba confirmações",
  },
  "QR check-in at the door": {
    es: "Registro con código QR en la puerta", de: "QR-Einlass an der Tür",
    ru: "Регистрация по QR-коду на входе", zh: "门口扫码签到",
    pt: "Check-in com código QR à porta",
  },
  "Photo uploads & event media sharing": {
    es: "Subida de fotos y compartir el material del evento",
    de: "Fotos hochladen und Veranstaltungsmedien teilen",
    ru: "Загрузка фото и обмен материалами мероприятия",
    zh: "上传照片并分享活动素材",
    pt: "Envio de fotos e partilha do material do evento",
  },
  "Speak with AI (VAIA) — up to 1,000-character descriptions": {
    es: "Hable con la IA (VAIA) — descripciones de hasta 1.000 caracteres",
    de: "Mit der KI sprechen (VAIA) — Beschreibungen bis 1.000 Zeichen",
    ru: "Говорите с ИИ (VAIA) — описания до 1 000 символов",
    zh: "与 AI（VAIA）对话——描述最多 1,000 字符",
    pt: "Fale com a IA (VAIA) — descrições até 1.000 caracteres",
  },
  "Attendee Rolodex & group messaging": {
    es: "Directorio de asistentes y mensajes en grupo",
    de: "Teilnehmerkartei und Gruppennachrichten",
    ru: "Картотека гостей и групповые сообщения",
    zh: "参加者名册与群发消息",
    pt: "Diretório de participantes e mensagens em grupo",
  },
  "Everything in Basic": {
    es: "Todo lo de Basic", de: "Alles aus Basic", ru: "Всё из Basic",
    zh: "包含 Basic 的全部内容", pt: "Tudo do Basic",
  },
  "Speak with AI — richer, up to 3,000-character descriptions": {
    es: "Hable con la IA — más completo, descripciones de hasta 3.000 caracteres",
    de: "Mit der KI sprechen — ausführlicher, Beschreibungen bis 3.000 Zeichen",
    ru: "Говорите с ИИ — подробнее, описания до 3 000 символов",
    zh: "与 AI 对话——更丰富，描述最多 3,000 字符",
    pt: "Fale com a IA — mais completo, descrições até 3.000 caracteres",
  },
  "Require a minimum OneScore to register": {
    es: "Exija un OneScore mínimo para inscribirse",
    de: "Mindest-OneScore für die Anmeldung verlangen",
    ru: "Требовать минимальный OneScore для регистрации",
    zh: "要求达到最低 OneScore 才能报名",
    pt: "Exija um OneScore mínimo para se inscrever",
  },
  "Priority placement in Discover": {
    es: "Posición destacada en Descubrir", de: "Bevorzugte Platzierung in Entdecken",
    ru: "Приоритетное место в разделе «Обзор»", zh: "在「发现」中优先展示",
    pt: "Posição destacada em Descobrir",
  },
  "Everything in Pro": {
    es: "Todo lo de Pro", de: "Alles aus Pro", ru: "Всё из Pro",
    zh: "包含 Pro 的全部内容", pt: "Tudo do Pro",
  },
  "Speak with AI — full, up to 6,000-character descriptions": {
    es: "Hable con la IA — completo, descripciones de hasta 6.000 caracteres",
    de: "Mit der KI sprechen — voll, Beschreibungen bis 6.000 Zeichen",
    ru: "Говорите с ИИ — полностью, описания до 6 000 символов",
    zh: "与 AI 对话——完整，描述最多 6,000 字符",
    pt: "Fale com a IA — completo, descrições até 6.000 caracteres",
  },
  "Discount / promo codes for your tickets": {
    es: "Códigos de descuento para sus entradas", de: "Rabatt- und Aktionscodes für Ihre Tickets",
    ru: "Скидочные и промокоды для ваших билетов", zh: "门票折扣码与优惠码",
    pt: "Códigos de desconto para os seus bilhetes",
  },
  "Applications & request-to-join gating": {
    es: "Solicitudes y aprobación para participar",
    de: "Bewerbungen und Teilnahme auf Anfrage",
    ru: "Заявки и допуск по запросу",
    zh: "申请制与审核后加入",
    pt: "Candidaturas e aprovação para participar",
  },
  "Generate event flyers with VAIA": {
    es: "Genere carteles del evento con VAIA", de: "Veranstaltungsplakate mit VAIA erstellen",
    ru: "Создавайте афиши мероприятий с VAIA", zh: "用 VAIA 生成活动海报",
    pt: "Gere cartazes do evento com a VAIA",
  },

  /* ── things that can go wrong ────────────────────────────────────────────────────────── */
  "Couldn't open billing. Please try again.": {
    es: "No se pudo abrir la facturación. Inténtelo de nuevo.",
    de: "Abrechnung konnte nicht geöffnet werden. Bitte erneut versuchen.",
    ru: "Не удалось открыть счета. Попробуйте ещё раз.",
    zh: "无法打开账单，请重试。",
    pt: "Não foi possível abrir a faturação. Tente novamente.",
  },
  "Couldn't start checkout. Please try again.": {
    es: "No se pudo iniciar el pago. Inténtelo de nuevo.",
    de: "Bezahlvorgang konnte nicht gestartet werden. Bitte erneut versuchen.",
    ru: "Не удалось начать оплату. Попробуйте ещё раз.",
    zh: "无法开始结账，请重试。",
    pt: "Não foi possível iniciar o pagamento. Tente novamente.",
  },
  "Couldn't start checkout. Please try again in a moment.": {
    es: "No se pudo iniciar el pago. Inténtelo en un momento.",
    de: "Bezahlvorgang konnte nicht gestartet werden. Bitte gleich erneut versuchen.",
    ru: "Не удалось начать оплату. Попробуйте через минуту.",
    zh: "无法开始结账，请稍后再试。",
    pt: "Não foi possível iniciar o pagamento. Tente daqui a pouco.",
  },
  "Couldn't redeem that code.": {
    es: "No se pudo canjear ese código.", de: "Dieser Code konnte nicht eingelöst werden.",
    ru: "Не удалось применить этот код.", zh: "无法兑换该代码。",
    pt: "Não foi possível resgatar esse código.",
  },
  "We couldn't confirm your upgrade yet. If you were charged, it'll apply shortly.": {
    es: "Todavía no pudimos confirmar su mejora. Si le cobraron, se aplicará en breve.",
    de: "Ihr Upgrade konnte noch nicht bestätigt werden. Falls abgebucht wurde, gilt es in Kürze.",
    ru: "Пока не удалось подтвердить повышение тарифа. Если оплата прошла, оно применится вскоре.",
    zh: "尚无法确认您的升级。如已扣款，稍后即会生效。",
    pt: "Ainda não conseguimos confirmar o seu upgrade. Se foi cobrado, será aplicado em breve.",
  },
  "Could not verify the upgrade. If you were charged, refresh in a moment.": {
    es: "No se pudo verificar la mejora. Si le cobraron, actualice en un momento.",
    de: "Upgrade konnte nicht geprüft werden. Falls abgebucht wurde, gleich neu laden.",
    ru: "Не удалось проверить повышение тарифа. Если оплата прошла, обновите страницу через минуту.",
    zh: "无法验证升级。如已扣款，请稍后刷新。",
    pt: "Não foi possível verificar o upgrade. Se foi cobrado, atualize daqui a pouco.",
  },
  "Checkout cancelled — no charge was made.": {
    es: "Pago cancelado — no se hizo ningún cobro.",
    de: "Bezahlvorgang abgebrochen — es wurde nichts abgebucht.",
    ru: "Оплата отменена — списания не было.",
    zh: "已取消结账——未发生扣款。",
    pt: "Pagamento cancelado — não foi feita qualquer cobrança.",
  },
  "Basic is free — you're all set. Upgrade any time for more.": {
    es: "Basic es gratis — ya está listo. Mejore su plan cuando quiera.",
    de: "Basic ist kostenlos — Sie sind startklar. Upgrade jederzeit möglich.",
    ru: "Basic бесплатен — всё готово. Перейти на платный тариф можно в любой момент.",
    zh: "Basic 是免费的——您已就绪。随时可以升级。",
    pt: "O Basic é grátis — está tudo pronto. Faça upgrade quando quiser.",
  },
};

/** The plan NAMES stay as they are in every language — see the note at the top. */
export function pricingText(lang: string, english: string, args: (string | number)[] = []): string {
  const l = lang === "co" ? "es" : (LANGS as readonly string[]).includes(lang) ? lang : "en";
  const row = D[english];
  const out = (l === "en" ? row?.en ?? english : row?.[l]) ?? english;
  return args.reduce<string>((acc, v, i) => acc.split(`{${i}}`).join(String(v)), out);
}
