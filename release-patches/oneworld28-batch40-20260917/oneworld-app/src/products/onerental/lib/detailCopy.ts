import { WA, type Localized } from "@oneworld/shell";

/**
 * THE PUBLIC LISTING PAGE, IN ALL SEVEN LANGUAGES — Max's locale addendum, 12 September 2026.
 * ============================================================================================
 * *"DE/RU/ZH/PT detail app body stays English while shared shell translates: Home details,
 *  photos/See all, amenities, host/contact, monthly panel and history."*
 *
 * He is describing the worst kind of half-translation, because it is the kind that LOOKS
 * deliberate. The chrome around the page changes language, so the reader concludes the English
 * in the middle is a choice somebody made. It is not. It is `W(lang, en, es)` — a two-language
 * helper — used on a page that is offered in seven. Every call site returned English to anyone
 * outside the two markets that existed when the screen was written.
 *
 * ── WHY THIS IS A FILE AND NOT SEVEN MORE ARGUMENTS AT EACH CALL SITE ───────────────────────
 * A seven-way inline ternary at forty call sites is unreadable and unreviewable, and the next
 * language makes it worse rather than better. Here every string is one entry, a missing
 * translation degrades to English rather than to `undefined`, and adding a language is one
 * column rather than forty edits.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────────────────────
 * **Anything the host wrote.** Title, description, neighbourhood, house rules. Max drew this
 * line himself — *"exclude user-authored sample description"* — and it is the right one: a host
 * writing in Spanish has said what they meant, and machine-flipping their words into German
 * would misrepresent a person, not translate an interface.
 *
 * **Anything the shell already owns.** Screen titles, Discover, Messages, Profile. Those are in
 * the frozen locale release and are OneWorld 27's. Nothing here writes into it.
 */

/* ── PLURALS, WHICH ARE NOT A ONE-AND-MANY PROBLEM IN EVERY LANGUAGE ────────────────────────
   Max: *"English also shows '1 bedrooms' and '1 bathrooms'; include correct English singular
   forms alongside CO/ES."* Right, and my earlier fix did the Spanish pair and left English as a
   bare `s`, which is how "1 bedrooms" survived a plural correction.

   Russian is the reason this is a function and not two strings: it has three forms, chosen by
   the last digit and the teens exception, so 1 and 21 take one form, 2-4 and 22-24 another, and
   5-20 a third. Chinese has one form and no plural at all. Writing `n === 1 ? a : b` here would
   produce "21 спален" where a Russian reader expects "21 спальня" — a small wrongness that
   reads as a machine wrote the page, which is exactly the impression the whole file exists to
   avoid. */
type Forms = { one: string; few?: string; many: string };
export type PluralSet = { en: Forms } & Partial<Record<string, Forms>>;

const ruIndex = (n: number): "one" | "few" | "many" => {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return "many";
  if (mod10 === 1) return "one";
  if (mod10 >= 2 && mod10 <= 4) return "few";
  return "many";
};

export function plural(lang: string, n: number, set: PluralSet): string {
  const key = lang === "co" ? "es" : lang;
  const forms = (set as Record<string, Forms | undefined>)[key] ?? set.en;
  if (key === "zh") return forms.one;                 // Chinese does not inflect for number
  if (key === "ru") {
    const which = ruIndex(n);
    return which === "one" ? forms.one : which === "few" ? (forms.few ?? forms.many) : forms.many;
  }
  return n === 1 ? forms.one : forms.many;
}

/** `n` and the right word for `n`, which is what a fact line actually needs. */
export const counted = (lang: string, n: number, set: PluralSet): string =>
  `${n} ${plural(lang, n, set)}`;

export const BEDROOMS: PluralSet = {
  en: { one: "bedroom", many: "bedrooms" },
  es: { one: "habitación", many: "habitaciones" },
  de: { one: "Schlafzimmer", many: "Schlafzimmer" },
  ru: { one: "спальня", few: "спальни", many: "спален" },
  zh: { one: "间卧室", many: "间卧室" },
  pt: { one: "quarto", many: "quartos" },
};
export const BATHROOMS: PluralSet = {
  en: { one: "bathroom", many: "bathrooms" },
  es: { one: "baño", many: "baños" },
  de: { one: "Badezimmer", many: "Badezimmer" },
  ru: { one: "ванная", few: "ванные", many: "ванных" },
  zh: { one: "间浴室", many: "间浴室" },
  pt: { one: "banheiro", many: "banheiros" },
};
export const GUESTS: PluralSet = {
  en: { one: "guest", many: "guests" },
  es: { one: "huésped", many: "huéspedes" },
  de: { one: "Gast", many: "Gäste" },
  ru: { one: "гость", few: "гостя", many: "гостей" },
  zh: { one: "位房客", many: "位房客" },
  pt: { one: "hóspede", many: "hóspedes" },
};
export const PARKING: PluralSet = {
  en: { one: "parking space", many: "parking spaces" },
  es: { one: "parqueadero", many: "parqueaderos" },
  de: { one: "Stellplatz", many: "Stellplätze" },
  ru: { one: "парковочное место", few: "парковочных места", many: "парковочных мест" },
  zh: { one: "个车位", many: "个车位" },
  pt: { one: "vaga de garagem", many: "vagas de garagem" },
};
export const NIGHTS: PluralSet = {
  en: { one: "night", many: "nights" },
  es: { one: "noche", many: "noches" },
  de: { one: "Nacht", many: "Nächte" },
  ru: { one: "ночь", few: "ночи", many: "ночей" },
  zh: { one: "晚", many: "晚" },
  pt: { one: "noite", many: "noites" },
};
export const PHOTOS: PluralSet = {
  en: { one: "photo", many: "photos" },
  es: { one: "foto", many: "fotos" },
  de: { one: "Foto", many: "Fotos" },
  ru: { one: "фотография", few: "фотографии", many: "фотографий" },
  zh: { one: "张照片", many: "张照片" },
  pt: { one: "foto", many: "fotos" },
};

/* ── DATES · MAX'S SECOND ITEM ──────────────────────────────────────────────────────────────
   *"German shows 'Edited 8 de sept de 2026' and 'Joined marzo de 2026'."* A German label with a
   Spanish date under it is worse than either language alone, because the reader cannot tell
   which part of the page is addressing them.

   The cause is a hardcoded locale argument. `Intl` already knows how to write a date in every
   language we offer, so the fix is to hand it the language the reader actually chose. `co` is
   Colombian Spanish and gets `es-CO`, which differs from Spain in month abbreviations. */
const DATE_LOCALE: Record<string, string> = {
  en: "en-US", es: "es-ES", co: "es-CO", de: "de-DE", ru: "ru-RU", zh: "zh-CN", pt: "pt-BR",
};
export const dateLocale = (lang: string): string => DATE_LOCALE[lang] ?? "en-US";

/** A day, written the way the reader's language writes days. Invalid input renders nothing
 *  rather than "Invalid Date", which is a string no reader can act on. */
export function fullDate(lang: string, value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" });
}

/** A month and a year — "joined", "available from". Same rule. */
export function monthYear(lang: string, value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" });
}

/* ── THE STRINGS ────────────────────────────────────────────────────────────────────────────
   `{n}`, `{title}`, `{name}`, `{amount}` are filled by `fill` below. A placeholder rather than
   string concatenation, because word order is not the same in seven languages and concatenation
   silently assumes English order. */
const COPY = {
  homeDetails:   { en: "Home details", es: "Alojamiento", de: "Unterkunft", ru: "О жилье", zh: "房源详情", pt: "Detalhes do imóvel" },
  backToFeed:    { en: "Back to the feed", es: "Volver al feed", de: "Zurück zur Übersicht", ru: "Назад к списку", zh: "返回列表", pt: "Voltar à lista" },
  listingGone:   { en: "This listing is gone.", es: "Este anuncio ya no está.", de: "Dieses Inserat gibt es nicht mehr.", ru: "Это объявление удалено.", zh: "该房源已下架。", pt: "Este anúncio não existe mais." },

  publishedLive: { en: "Published · Live", es: "Publicado · Visible", de: "Veröffentlicht · Sichtbar", ru: "Опубликовано · Видно всем", zh: "已发布 · 公开", pt: "Publicado · Visível" },
  draftPrivate:  { en: "Draft · Private", es: "Borrador · Privado", de: "Entwurf · Privat", ru: "Черновик · Скрыто", zh: "草稿 · 私密", pt: "Rascunho · Privado" },
  edit:          { en: "Edit", es: "Editar", de: "Bearbeiten", ru: "Изменить", zh: "编辑", pt: "Editar" },
  unpublish:     { en: "Unpublish", es: "Retirar", de: "Zurückziehen", ru: "Снять с публикации", zh: "取消发布", pt: "Despublicar" },
  reviewPublish: { en: "Review & publish", es: "Revisar y publicar", de: "Prüfen & veröffentlichen", ru: "Проверить и опубликовать", zh: "检查并发布", pt: "Revisar e publicar" },
  edited:        { en: "Edited", es: "Editado", de: "Bearbeitet", ru: "Изменено", zh: "编辑于", pt: "Editado" },
  joined:        { en: "Joined", es: "Se unió en", de: "Dabei seit", ru: "С нами с", zh: "加入于", pt: "Desde" },

  chargedInUsd:  { en: "charged in USD", es: "se cobra en USD", de: "Abrechnung in USD", ru: "оплата в долларах США", zh: "以美元结算", pt: "cobrado em USD" },
  from:          { en: "From", es: "Desde", de: "Ab", ru: "От", zh: "起价", pt: "A partir de" },
  furnished:     { en: "Furnished", es: "Amoblado", de: "Möbliert", ru: "С мебелью", zh: "带家具", pt: "Mobiliado" },
  unfurnished:   { en: "Unfurnished", es: "Sin amoblar", de: "Unmöbliert", ru: "Без мебели", zh: "无家具", pt: "Sem mobília" },
  minNights:     { en: "{n} minimum", es: "mínimo {n}", de: "mindestens {n}", ru: "минимум {n}", zh: "最少 {n}", pt: "mínimo de {n}" },
  currentlyReserved: { en: "Currently reserved — ask the host about future availability. Existing reservations remain protected.", es: "Actualmente reservado — consulte al anfitrión por disponibilidad futura. Las reservas existentes siguen protegidas.", de: "Derzeit reserviert — fragen Sie den Gastgeber nach späteren Terminen. Bestehende Reservierungen bleiben geschützt.", ru: "Сейчас забронировано — спросите хозяина о свободных датах. Существующие брони сохраняются.", zh: "目前已被预订——可向房东询问后续可租日期。已有预订不受影响。", pt: "Atualmente reservado — pergunte ao anfitrião sobre datas futuras. As reservas existentes seguem protegidas." },

  howProtected:  { en: "How this is protected", es: "Cómo se protege esto", de: "Wie das abgesichert ist", ru: "Как это защищено", zh: "保障方式", pt: "Como isto é protegido" },
  depositConv:   { en: "Deposit conversion", es: "Conversión del depósito", de: "Umrechnung der Kaution", ru: "Пересчёт депозита", zh: "押金换算", pt: "Conversão do depósito" },
  depositInfo:   { en: "Important information about deposits in Colombia", es: "Información importante sobre depósitos en Colombia", de: "Wichtige Hinweise zu Kautionen in Kolumbien", ru: "Важная информация о депозитах в Колумбии", zh: "关于哥伦比亚押金的重要信息", pt: "Informação importante sobre depósitos na Colômbia" },
  depositCoTtl:  { en: "Deposits on Colombian home rentals", es: "Depósitos en arriendos de vivienda en Colombia", de: "Kautionen bei Wohnungsmieten in Kolumbien", ru: "Депозиты при аренде жилья в Колумбии", zh: "哥伦比亚住宅租赁押金", pt: "Depósitos em aluguéis residenciais na Colômbia" },
  noDeposit:     { en: "No deposit on this one.", es: "Sin depósito en este.", de: "Für dieses Objekt keine Kaution.", ru: "Здесь без депозита.", zh: "此房源无需押金。", pt: "Sem depósito neste imóvel." },
  /* ⚠️ SHORT ON PURPOSE — these are COLLAPSED SUMMARY LINES, not sentences. They sit beside a
     caret on one row with a value on the right, so anything longer than two words wraps on a
     phone and the row stops looking like a row. `noDeposit` above stays a full sentence because
     it is also used inside the panel, where it is prose. */
  depositNone:   { en: "None", es: "Ninguno", de: "Keine", ru: "Нет", zh: "无", pt: "Nenhum" },
  history:       { en: "Property history", es: "Historial del inmueble", de: "Objekthistorie", ru: "История объекта", zh: "房产历史", pt: "Histórico do imóvel" },
  similar:       { en: "Comparable places", es: "Inmuebles comparables", de: "Vergleichbare Objekte", ru: "Похожие объекты", zh: "同类房源", pt: "Imóveis comparáveis" },
  insurer:       { en: "Insurer: {name}.", es: "Aseguradora: {name}.", de: "Versicherer: {name}.", ru: "Страховщик: {name}.", zh: "承保方：{name}。", pt: "Seguradora: {name}." },
  statedCover:   { en: "Stated cover: {amount}.", es: "Cobertura declarada: {amount}.", de: "Angegebene Deckung: {amount}.", ru: "Заявленное покрытие: {amount}.", zh: "声明保额：{amount}。", pt: "Cobertura declarada: {amount}." },

  close:         { en: "Close", es: "Cerrar", de: "Schließen", ru: "Закрыть", zh: "关闭", pt: "Fechar" },
  gotIt:         { en: "Got it", es: "Entendido", de: "Verstanden", ru: "Понятно", zh: "知道了", pt: "Entendi" },

  askAboutPlace: { en: "Ask about this place", es: "Preguntar por este inmueble", de: "Zu dieser Unterkunft fragen", ru: "Спросить об этом жилье", zh: "咨询该房源", pt: "Perguntar sobre este imóvel" },
  stillAvailable:{ en: 'Hi — is "{title}" still available?', es: 'Hola — ¿"{title}" sigue disponible?', de: 'Hallo — ist "{title}" noch verfügbar?', ru: 'Здравствуйте — «{title}» ещё свободно?', zh: '您好，请问"{title}"还可以租吗？', pt: 'Olá — "{title}" ainda está disponível?' },
  sendMessage:   { en: "Send message", es: "Enviar mensaje", de: "Nachricht senden", ru: "Отправить сообщение", zh: "发送消息", pt: "Enviar mensagem" },
  requestShowing:{ en: "Request a showing", es: "Solicitar una visita", de: "Besichtigung anfragen", ru: "Запросить показ", zh: "预约看房", pt: "Solicitar uma visita" },
  contactAgent:  { en: "Contact the agent", es: "Contactar al agente", de: "Makler kontaktieren", ru: "Связаться с агентом", zh: "联系经纪人", pt: "Falar com o corretor" },
  signInContact: { en: "Sign in to contact agent", es: "Iniciar sesión para contactar", de: "Zum Kontakt anmelden", ru: "Войдите, чтобы связаться", zh: "登录后联系", pt: "Entre para falar com o corretor" },

  reviewRequests:{ en: "Review requests & create tenant contract", es: "Revisar solicitudes y crear contrato", de: "Anfragen prüfen & Mietvertrag erstellen", ru: "Проверить заявки и создать договор", zh: "查看申请并创建租约", pt: "Ver solicitações e criar contrato" },
  setUpPayments: { en: "Set up rent payments", es: "Configurar el pago del arriendo", de: "Mietzahlungen einrichten", ru: "Настроить приём арендной платы", zh: "设置租金收款", pt: "Configurar o pagamento do aluguel" },
  agreeAmounts:  { en: "Agree the amounts with the tenant before anything is charged.", es: "Acuerde los montos con el arrendatario antes de cobrar nada.", de: "Stimmen Sie die Beträge mit dem Mieter ab, bevor etwas abgebucht wird.", ru: "Согласуйте суммы с арендатором до любого списания.", zh: "在扣款之前先与租客确认金额。", pt: "Combine os valores com o inquilino antes de qualquer cobrança." },

  whereItIs:     { en: "Where it is", es: "Dónde queda", de: "Wo es liegt", ru: "Где это", zh: "位置", pt: "Onde fica" },
  pinIsBuilding: { en: "The host has published this address, so the pin is the building.", es: "El anfitrión publicó esta dirección, así que el marcador es el edificio.", de: "Der Gastgeber hat diese Adresse veröffentlicht, der Marker zeigt also das Gebäude.", ru: "Хозяин опубликовал этот адрес, поэтому метка указывает на само здание.", zh: "房东已公开该地址，因此地图标记即为该建筑。", pt: "O anfitrião publicou este endereço, então o marcador é o prédio." },
  circleIsArea:  { en: "The circle is the area, not the building. The exact address goes to the tenant once there is a contract.", es: "El círculo es la zona, no el edificio. La dirección exacta se entrega al inquilino cuando hay contrato.", de: "Der Kreis zeigt die Gegend, nicht das Gebäude. Die genaue Adresse erhält der Mieter, sobald ein Vertrag besteht.", ru: "Круг обозначает район, а не здание. Точный адрес арендатор получает после заключения договора.", zh: "圆圈表示区域而非具体建筑。签约后会将确切地址提供给租客。", pt: "O círculo é a região, não o prédio. O endereço exato é entregue ao inquilino quando houver contrato." },

  grpSpace:      { en: "The space", es: "El espacio", de: "Die Wohnung", ru: "Помещение", zh: "空间", pt: "O espaço" },
  grpInside:     { en: "Inside", es: "Adentro", de: "Innen", ru: "Внутри", zh: "室内", pt: "Dentro" },
  grpOutside:    { en: "Outside", es: "Afuera", de: "Außen", ru: "Снаружи", zh: "室外", pt: "Fora" },
  grpBuilding:   { en: "The building and around it", es: "El edificio y su entorno", de: "Das Gebäude und die Umgebung", ru: "Дом и его окружение", zh: "楼栋与周边", pt: "O prédio e o entorno" },
  grpRules:      { en: "House rules", es: "Reglas de la casa", de: "Hausordnung", ru: "Правила дома", zh: "房屋守则", pt: "Regras da casa" },
  whatItHas:     { en: "What this place has", es: "Lo que tiene este inmueble", de: "Was diese Unterkunft bietet", ru: "Что есть в этом жилье", zh: "房源配置", pt: "O que este imóvel tem" },
  showLess:      { en: "Show less", es: "Ver menos", de: "Weniger anzeigen", ru: "Свернуть", zh: "收起", pt: "Ver menos" },
  /* ⚠️ "Show all 12" NAMED A NUMBER AND NOT A THING. Lee, 16 Sep 2026: *"It should say show all
     attributes, or show all details, or show all property details. They click it and they see
     everything else."* A count tells you how much is behind the button; it does not tell you
     WHAT. On a page that already has four visible headings, "12" could be anything. */
  showAll:       { en: "Show all property details", es: "Ver todos los detalles", de: "Alle Objektdetails anzeigen", ru: "Показать все детали", zh: "查看全部房源详情", pt: "Ver todos os detalhes" },
  descTitle:     { en: "Property description", es: "Descripción del inmueble", de: "Objektbeschreibung", ru: "Описание объекта", zh: "房源描述", pt: "Descrição do imóvel" },
  historyAndComps: { en: "History and comparables", es: "Historial y comparables", de: "Historie und Vergleichsobjekte", ru: "История и аналоги", zh: "历史与同类房源", pt: "Histórico e comparáveis" },

  /* Card abbreviations. A feed card has no room for "Schlafzimmer", so these are the short
     forms each language actually uses in a listing card - not truncations of the long word. */
  /* ── THE DISCOVERY BAR ─────────────────────────────────────────────────────────────────────
     The search chips are the first thing anyone sees, so an English chip row above a German
     page is the sentence that decides whether a reader believes the app speaks their language. */
  fltAll:        { en: "All", es: "Todos", de: "Alle", ru: "Все", zh: "全部", pt: "Todos" },
  fltWhere:      { en: "Where", es: "Dónde", de: "Wo", ru: "Где", zh: "地点", pt: "Onde" },
  fltAnywhere:   { en: "Anywhere", es: "En cualquier lugar", de: "Überall", ru: "Где угодно", zh: "不限地点", pt: "Qualquer lugar" },
  fltWhen:       { en: "When", es: "Cuándo", de: "Wann", ru: "Когда", zh: "日期", pt: "Quando" },
  fltAnyDates:   { en: "Any dates", es: "Cualquier fecha", de: "Beliebige Daten", ru: "Любые даты", zh: "不限日期", pt: "Qualquer data" },
  fltWho:        { en: "Who", es: "Quiénes", de: "Wer", ru: "Кто", zh: "人数", pt: "Quem" },
  fltAddGuests:  { en: "Add guests", es: "Agregar huéspedes", de: "Gäste hinzufügen", ru: "Добавить гостей", zh: "添加房客", pt: "Adicionar hóspedes" },
  fltHood:       { en: "Neighbourhood", es: "Barrio", de: "Viertel", ru: "Район", zh: "街区", pt: "Bairro" },
  loadingMore:   { en: "Loading more", es: "Cargando más", de: "Mehr wird geladen", ru: "Загружается ещё", zh: "正在加载更多", pt: "Carregando mais" },
  noPlacesYet:   { en: "No places here yet.", es: "Aún no hay lugares aquí.", de: "Hier gibt es noch keine Unterkünfte.", ru: "Здесь пока нет объявлений.", zh: "这里还没有房源。", pt: "Ainda não há imóveis aqui." },
  startingInCo:  { en: "OneHome is starting in Colombia — Medellín, Bogotá, Cali and Cartagena. If you manage a place, yours can be the first one here.", es: "OneHome está comenzando en Colombia — Medellín, Bogotá, Cali y Cartagena. Si usted administra un inmueble, el suyo puede ser el primero aquí.", de: "OneHome startet in Kolumbien — Medellín, Bogotá, Cali und Cartagena. Wenn Sie eine Unterkunft verwalten, kann Ihre die erste hier sein.", ru: "OneHome начинает работу в Колумбии — Медельин, Богота, Кали и Картахена. Если вы управляете жильём, ваше может стать здесь первым.", zh: "OneHome 正在哥伦比亚起步——麦德林、波哥大、卡利和卡塔赫纳。如果您管理房源，您的房源可以成为这里的第一个。", pt: "A OneHome está começando na Colômbia — Medellín, Bogotá, Cali e Cartagena. Se você administra um imóvel, o seu pode ser o primeiro aqui." },
  listAPlace:    { en: "List a place", es: "Publicar un inmueble", de: "Unterkunft einstellen", ru: "Разместить объявление", zh: "发布房源", pt: "Anunciar um imóvel" },
  bdAbbr:        { en: "bd", es: "hab", de: "Zi.", ru: "сп.", zh: "室", pt: "qts" },
  baAbbr:        { en: "ba", es: "baños", de: "Bad", ru: "вн.", zh: "卫", pt: "ban" },
  seeAllPhotos:  { en: "See all {n}", es: "Ver las {n}", de: "Alle {n} ansehen", ru: "Смотреть все ({n})", zh: "查看全部 {n}", pt: "Ver todas as {n}" },
  openPhoto:     { en: "Open photo {n} of {total}", es: "Abrir la foto {n} de {total}", de: "Foto {n} von {total} öffnen", ru: "Открыть фото {n} из {total}", zh: "打开第 {n} 张，共 {total} 张", pt: "Abrir a foto {n} de {total}" },
  /* ── THE LONGER COPY · the promises, the deposit law, the money lines, the failures ────────
     Max's addendum named the visible body. These are the rest of it: the four promise lines a
     tenant reads before deciding, the Colombian deposit statement, the payout and cancellation
     lines, and the messages shown when a request does not go through. The failures matter most
     of the four - a person who cannot read WHY their request failed submits it again, and a
     duplicate rental request is a real cost to a real host. */
  signRealContract: { en: "You both sign a real contract in the app, and both of you can pull up the signed copy at any time.", es: "Ambos firman un contrato real en la app, y los dos pueden abrir la copia firmada cuando quieran.", de: "Sie unterschreiben beide einen echten Vertrag in der App, und beide können die unterschriebene Fassung jederzeit aufrufen.", ru: "Вы оба подписываете настоящий договор в приложении, и каждый может открыть подписанный экземпляр в любой момент.", zh: "双方在应用内签署正式合同，任何一方随时都可以调出已签署的副本。", pt: "Vocês dois assinam um contrato de verdade no app, e ambos podem abrir a cópia assinada quando quiserem." },
  photosBeforeMoveIn: { en: "Before you move in you both agree the photos of the place. If damage is not in those photos, it cannot be charged to you.", es: "Antes de mudarse, ambos acuerdan las fotos del inmueble. Si un daño no aparece en esas fotos, no se le puede cobrar.", de: "Vor dem Einzug einigen Sie sich beide auf die Fotos der Wohnung. Ein Schaden, der nicht auf diesen Fotos ist, kann Ihnen nicht berechnet werden.", ru: "До заселения вы вдвоём согласовываете фотографии жилья. Если повреждения нет на этих фотографиях, его нельзя вам предъявить.", zh: "入住前双方共同确认房屋照片。照片上没有的损坏，不能向您收费。", pt: "Antes da mudança, vocês dois combinam as fotos do imóvel. Se um dano não estiver nessas fotos, não pode ser cobrado de você." },
  threadTagged:  { en: "This opens a thread with the agent and tags it with this place, so you both always know which unit you are talking about.", es: "Esto abre una conversación con el agente y la etiqueta con este inmueble, para que ambos sepan siempre de qué unidad se habla.", de: "Das öffnet einen Verlauf mit dem Makler und verknüpft ihn mit dieser Unterkunft, damit Sie beide immer wissen, um welche Einheit es geht.", ru: "Откроется переписка с агентом с пометкой об этом объекте, чтобы вы оба всегда знали, о какой квартире речь.", zh: "这会与经纪人开启一个对话，并标注为此房源，双方随时都清楚在谈哪一套。", pt: "Isto abre uma conversa com o corretor marcada com este imóvel, para que ambos sempre saibam de qual unidade se trata." },
  signInToMessage: { en: "Sign in with One ID to message the agent or request a showing. We tag the conversation with this place so nobody has to explain which one.", es: "Inicie sesión con One ID para escribirle al agente o solicitar una visita. Etiquetamos la conversación con este inmueble para que nadie tenga que explicar cuál es.", de: "Melden Sie sich mit One ID an, um dem Makler zu schreiben oder eine Besichtigung anzufragen. Wir verknüpfen das Gespräch mit dieser Unterkunft, damit niemand erklären muss, welche gemeint ist.", ru: "Войдите через One ID, чтобы написать агенту или запросить показ. Мы пометим переписку этим объектом, чтобы никому не пришлось объяснять, о каком идёт речь.", zh: "使用 One ID 登录即可联系经纪人或预约看房。我们会将对话标注为此房源，无需再解释是哪一套。", pt: "Entre com o One ID para falar com o corretor ou solicitar uma visita. Marcamos a conversa com este imóvel para ninguém precisar explicar qual é." },
  payoutTiming:  { en: "Payouts to the manager arrive in about {first} days the first time, then about {later} days.", es: "Los pagos al administrador llegan en unos {first} días la primera vez, y luego en unos {later} días.", de: "Auszahlungen an den Verwalter kommen beim ersten Mal nach etwa {first} Tagen an, danach nach etwa {later} Tagen.", ru: "Выплаты управляющему приходят примерно через {first} дней в первый раз и примерно через {later} дней в дальнейшем.", zh: "首次向管理方付款约需 {first} 天，之后约需 {later} 天。", pt: "Os repasses ao administrador chegam em cerca de {first} dias na primeira vez, e depois em cerca de {later} dias." },
  cancelPolicy:  { en: "Everything back if you cancel at least five days before you arrive. Half back up to the day before.", es: "Todo se devuelve si cancela al menos cinco días antes de llegar. La mitad hasta el día anterior.", de: "Volle Erstattung, wenn Sie mindestens fünf Tage vor Anreise stornieren. Bis zum Vortag die Hälfte.", ru: "Полный возврат при отмене не позднее чем за пять дней до заезда. До дня накануне — половина.", zh: "入住前至少五天取消可全额退款，前一天之前取消退还一半。", pt: "Reembolso total se cancelar pelo menos cinco dias antes da chegada. Metade até o dia anterior." },
  depositLawBody: { en: "On a stay of 30 days or more this is a home lease, and Colombian law (Ley 820 de 2003, Article 16) does not allow a cash deposit to be required. You can ask for it back at any time and the clause has no force. OneHome does not collect, hold or return it.", es: "En una estadía de 30 días o más esto es un arriendo de vivienda, y la ley colombiana (Ley 820 de 2003, artículo 16) no permite exigir un depósito en dinero. Usted puede pedir su devolución en cualquier momento y la cláusula no tiene efecto. OneHome no lo cobra, custodia ni devuelve.", de: "Bei einem Aufenthalt von 30 Tagen oder mehr ist dies ein Wohnraummietvertrag, und das kolumbianische Gesetz (Ley 820 de 2003, Artikel 16) erlaubt es nicht, eine Barkaution zu verlangen. Sie können sie jederzeit zurückfordern; die Klausel ist unwirksam. OneHome zieht sie weder ein noch verwahrt oder erstattet sie.", ru: "При проживании от 30 дней это договор найма жилья, и колумбийский закон (Ley 820 de 2003, статья 16) не допускает требования денежного депозита. Вы можете потребовать его возврата в любой момент, и такое условие не имеет силы. OneHome его не взимает, не хранит и не возвращает.", zh: "住满 30 天及以上属于住宅租赁，哥伦比亚法律（Ley 820 de 2003 第 16 条）不允许要求现金押金。您随时可以要求退还，该条款没有法律效力。OneHome 不收取、不保管、也不退还押金。", pt: "Em uma estadia de 30 dias ou mais isto é uma locação residencial, e a lei colombiana (Ley 820 de 2003, artigo 16) não permite exigir depósito em dinheiro. Você pode pedir a devolução a qualquer momento e a cláusula não tem efeito. A OneHome não o cobra, guarda nem devolve." },

  errSaveRequest:{ en: "The request could not be saved. Try again.", es: "No se pudo guardar la solicitud. Reintente.", de: "Die Anfrage konnte nicht gespeichert werden. Bitte erneut versuchen.", ru: "Не удалось сохранить заявку. Попробуйте ещё раз.", zh: "申请未能保存，请重试。", pt: "Não foi possível salvar a solicitação. Tente novamente." },
  errIdNotSent:  { en: "Your ID could not be uploaded, so the request was not submitted. Please try again.", es: "No se pudo cargar su identificación, por lo que la solicitud no se envió. Inténtelo de nuevo.", de: "Ihr Ausweis konnte nicht hochgeladen werden, daher wurde die Anfrage nicht gesendet. Bitte erneut versuchen.", ru: "Не удалось загрузить документ, поэтому заявка не отправлена. Попробуйте ещё раз.", zh: "证件未能上传，申请未提交，请重试。", pt: "Não foi possível enviar seu documento, então a solicitação não foi enviada. Tente novamente." },
  errIdDraftLeft:{ en: "Your ID could not be uploaded, and OneHome could not confirm that the draft request was removed. Do not submit again; reopen this listing and check the existing request first.", es: "No se pudo cargar su identificación y OneHome no pudo confirmar que se eliminó la solicitud en borrador. No vuelva a enviarla; abra de nuevo este anuncio y revise primero la solicitud existente.", de: "Ihr Ausweis konnte nicht hochgeladen werden, und OneHome konnte nicht bestätigen, dass der Anfrageentwurf entfernt wurde. Senden Sie nicht erneut; öffnen Sie dieses Inserat erneut und prüfen Sie zuerst die vorhandene Anfrage.", ru: "Не удалось загрузить документ, и OneHome не смог подтвердить, что черновик заявки удалён. Не отправляйте повторно: откройте объявление снова и сначала проверьте существующую заявку.", zh: "证件未能上传，且 OneHome 无法确认草稿申请已删除。请勿重复提交；请重新打开该房源并先查看已有申请。", pt: "Não foi possível enviar seu documento e a OneHome não pôde confirmar que o rascunho da solicitação foi removido. Não envie de novo; reabra este anúncio e verifique primeiro a solicitação existente." },
  errIdRecord:   { en: "Your request was saved, but OneHome could not confirm the ID record. The private upload was preserved. Do not submit again; reopen this listing and check the existing request first.", es: "Su solicitud se guardó, pero OneHome no pudo confirmar el registro de identificación. Se conservó la carga privada. No vuelva a enviarla; abra de nuevo este anuncio y revise primero la solicitud existente.", de: "Ihre Anfrage wurde gespeichert, aber OneHome konnte den Ausweiseintrag nicht bestätigen. Der private Upload blieb erhalten. Senden Sie nicht erneut; öffnen Sie dieses Inserat erneut und prüfen Sie zuerst die vorhandene Anfrage.", ru: "Заявка сохранена, но OneHome не смог подтвердить запись о документе. Приватная загрузка сохранена. Не отправляйте повторно: откройте объявление снова и сначала проверьте существующую заявку.", zh: "您的申请已保存，但 OneHome 无法确认证件记录。私密上传已保留。请勿重复提交；请重新打开该房源并先查看已有申请。", pt: "Sua solicitação foi salva, mas a OneHome não pôde confirmar o registro do documento. O envio privado foi preservado. Não envie de novo; reabra este anúncio e verifique primeiro a solicitação existente." },
  errIdReview:   { en: "Your request and private ID were saved, but OneHome could not confirm that identity review started. Do not submit again; reopen this listing and check the existing request.", es: "Su solicitud y su identificación privada se guardaron, pero OneHome no pudo confirmar que inició la revisión de identidad. No vuelva a enviarla; abra de nuevo este anuncio y revise la solicitud existente.", de: "Ihre Anfrage und Ihr privater Ausweis wurden gespeichert, aber OneHome konnte den Start der Identitätsprüfung nicht bestätigen. Senden Sie nicht erneut; öffnen Sie dieses Inserat erneut und prüfen Sie die vorhandene Anfrage.", ru: "Заявка и приватный документ сохранены, но OneHome не смог подтвердить начало проверки личности. Не отправляйте повторно: откройте объявление снова и проверьте существующую заявку.", zh: "您的申请与私密证件已保存，但 OneHome 无法确认身份审核已开始。请勿重复提交；请重新打开该房源并查看已有申请。", pt: "Sua solicitação e seu documento privado foram salvos, mas a OneHome não pôde confirmar o início da verificação de identidade. Não envie de novo; reabra este anúncio e verifique a solicitação existente." },
  errLatestState:{ en: "OneHome could not confirm the request's latest state. Do not submit again; reopen this listing and check for the existing request first.", es: "OneHome no pudo confirmar el estado actual de la solicitud. No vuelva a enviarla; abra de nuevo este anuncio y revise primero si existe la solicitud.", de: "OneHome konnte den aktuellen Stand der Anfrage nicht bestätigen. Senden Sie nicht erneut; öffnen Sie dieses Inserat erneut und prüfen Sie zuerst, ob die Anfrage bereits besteht.", ru: "OneHome не смог подтвердить текущее состояние заявки. Не отправляйте повторно: откройте объявление снова и сначала проверьте, есть ли уже заявка.", zh: "OneHome 无法确认申请的最新状态。请勿重复提交；请重新打开该房源并先确认是否已有申请。", pt: "A OneHome não pôde confirmar o estado atual da solicitação. Não envie de novo; reabra este anúncio e verifique primeiro se a solicitação já existe." },
  hostAsksDeposit: { en: "This host asks for a {amount} {ccy} deposit. You pay it to them directly — it does not go through OneHome, and OneHome does not hold it or return it.", es: "Este arrendador pide un depósito de {amount} {ccy}. Usted se lo paga directamente a él — no pasa por OneHome, y OneHome no lo custodia ni lo devuelve.", de: "Dieser Vermieter verlangt eine Kaution von {amount} {ccy}. Sie zahlen sie direkt an ihn — sie läuft nicht über OneHome, und OneHome verwahrt oder erstattet sie nicht.", ru: "Этот арендодатель просит депозит {amount} {ccy}. Вы платите его напрямую — он не проходит через OneHome, и OneHome его не хранит и не возвращает.", zh: "房东要求 {amount} {ccy} 的押金。您直接支付给房东——不经由 OneHome，OneHome 也不代为保管或退还。", pt: "Este locador pede um depósito de {amount} {ccy}. Você paga diretamente a ele — não passa pela OneHome, e a OneHome não o guarda nem o devolve." },
  errStripeAuth: { en: "Stripe returned, but the authorization could not be verified. Your card will not be captured until this is resolved.", es: "Stripe regresó, pero no se pudo verificar la autorización. Su tarjeta no se cobrará hasta resolverlo.", de: "Stripe hat geantwortet, aber die Autorisierung konnte nicht bestätigt werden. Ihre Karte wird nicht belastet, solange das nicht geklärt ist.", ru: "Stripe вернул ответ, но авторизацию подтвердить не удалось. Списание с карты не произойдёт, пока это не решено.", zh: "Stripe 已返回，但授权无法验证。在此问题解决之前不会从您的卡扣款。", pt: "O Stripe retornou, mas a autorização não pôde ser verificada. Seu cartão não será cobrado até isso ser resolvido." },
  openListing:   { en: "Open {title}", es: "Abrir {title}", de: "{title} öffnen", ru: "Открыть «{title}»", zh: "打开{title}", pt: "Abrir {title}" },

  /* ── THE BOOKING REQUEST (17 September 2026) ───────────────────────────────────────────────
     Lee: *"the only valuable piece is that when you submit a request, you know you asked for this
     start date, this end date and time."* Every string below exists to state one of those facts,
     or to keep two facts from being read as one. */
  rentedMonthly: { en: "Rented by the month", es: "Se arrienda por mes", de: "Monatsweise vermietet", ru: "Сдаётся помесячно", zh: "按月出租", pt: "Alugado por mês" },
  requestBooking:{ en: "Request a booking", es: "Solicitar una reserva", de: "Buchung anfragen", ru: "Запросить бронирование", zh: "申请预订", pt: "Solicitar uma reserva" },
  bookingAsked:  { en: "Booking request sent", es: "Solicitud de reserva enviada", de: "Buchungsanfrage gesendet", ru: "Заявка на бронирование отправлена", zh: "预订申请已发送", pt: "Solicitação de reserva enviada" },
  oneAtATime:    { en: "While this request is open, messaging and showings are paused. Withdraw it to ask for something else.", es: "Mientras esta solicitud esté abierta, los mensajes y las visitas quedan en pausa. Retírela para pedir otra cosa.", de: "Solange diese Anfrage offen ist, pausieren Nachrichten und Besichtigungen. Ziehen Sie sie zurück, um etwas anderes anzufragen.", ru: "Пока заявка открыта, сообщения и показы приостановлены. Отзовите её, чтобы попросить другое.", zh: "此申请未结束前，留言与看房暂停。撤回后可再提出其他请求。", pt: "Enquanto esta solicitação estiver aberta, mensagens e visitas ficam pausadas. Retire-a para pedir outra coisa." },
  stayFrom:      { en: "Arrive", es: "Llegada", de: "Anreise", ru: "Заезд", zh: "入住", pt: "Chegada" },
  stayTo:        { en: "Leave", es: "Salida", de: "Abreise", ru: "Выезд", zh: "退房", pt: "Saída" },
  checkInTime:   { en: "Check-in time", es: "Hora de entrada", de: "Check-in-Zeit", ru: "Время заезда", zh: "入住时间", pt: "Hora de entrada" },
  checkOutTime:  { en: "Check-out time", es: "Hora de salida", de: "Check-out-Zeit", ru: "Время выезда", zh: "退房时间", pt: "Hora de saída" },
  timeNotSet:    { en: "Not stated by the host", es: "El anfitrión no la indicó", de: "Vom Gastgeber nicht angegeben", ru: "Хозяин не указал", zh: "房东未说明", pt: "Não informado pelo anfitrião" },
  lengthOfStay:  { en: "Length of stay", es: "Duración", de: "Aufenthaltsdauer", ru: "Длительность", zh: "住宿天数", pt: "Duração" },
  totalWithFees: { en: "Total, fees included", es: "Total, comisiones incluidas", de: "Gesamt, Gebühren inbegriffen", ru: "Итого с комиссией", zh: "含费用总额", pt: "Total, taxas incluídas" },
  respondBy:     { en: "The host has until {when} to answer. After that this request lapses.", es: "El anfitrión tiene hasta {when} para responder. Después, la solicitud caduca.", de: "Der Gastgeber hat bis {when} Zeit zu antworten. Danach verfällt die Anfrage.", ru: "Хозяин должен ответить до {when}. После этого заявка аннулируется.", zh: "房东须在 {when} 前回复，逾期此申请失效。", pt: "O anfitrião tem até {when} para responder. Depois disso a solicitação caduca." },
  requestLapsed: { en: "This request has lapsed. The host did not answer in time.", es: "Esta solicitud caducó. El anfitrión no respondió a tiempo.", de: "Diese Anfrage ist verfallen. Der Gastgeber hat nicht rechtzeitig geantwortet.", ru: "Заявка аннулирована: хозяин не ответил вовремя.", zh: "此申请已失效，房东未在期限内回复。", pt: "Esta solicitação caducou. O anfitrião não respondeu a tempo." },
  askedFor:      { en: "What you asked for", es: "Lo que usted solicitó", de: "Worum Sie gebeten haben", ru: "Что вы запросили", zh: "您的申请内容", pt: "O que você solicitou" },

  /* ⚠️ TWO SENTENCES, NEVER ONE. Lee, 17 September 2026: "pending approval" and "payment not
     confirmed" were rendered as one grey line joined by a dot, so a tenant read them as one
     status and could not tell which half was theirs to act on. They are different facts about
     different people, and the advice that follows only makes sense once they are apart. */
  notAcceptedYet:{ en: "The host has not accepted this yet.", es: "El anfitrión aún no la ha aceptado.", de: "Der Gastgeber hat dies noch nicht angenommen.", ru: "Хозяин пока не принял заявку.", zh: "房东尚未接受。", pt: "O anfitrião ainda não aceitou." },
  acceptedByHost:{ en: "The host has accepted this.", es: "El anfitrión la aceptó.", de: "Der Gastgeber hat dies angenommen.", ru: "Хозяин принял заявку.", zh: "房东已接受。", pt: "O anfitrião aceitou." },
  noPaymentYet:  { en: "No payment has been confirmed.", es: "No se ha confirmado ningún pago.", de: "Es wurde keine Zahlung bestätigt.", ru: "Ни один платёж не подтверждён.", zh: "尚未确认任何付款。", pt: "Nenhum pagamento foi confirmado." },
  paymentIsIn:   { en: "Payment has been confirmed.", es: "El pago está confirmado.", de: "Die Zahlung ist bestätigt.", ru: "Платёж подтверждён.", zh: "付款已确认。", pt: "O pagamento está confirmado." },
  waitToPay:     { en: "Wait for the host to accept before you send any money.", es: "Espere a que el anfitrión acepte antes de enviar dinero.", de: "Warten Sie die Zusage des Gastgebers ab, bevor Sie Geld senden.", ru: "Не отправляйте деньги, пока хозяин не примет заявку.", zh: "请等房东接受后再付款。", pt: "Espere o anfitrião aceitar antes de enviar dinheiro." },

  /* ── TERMS THE HOST ACTUALLY SET ───────────────────────────────────────────────────────────
     Replaces three sentences that were written into the code and shown on every property on the
     platform, identical, agreed by nobody. Every line here is a number a host typed. Where the
     host typed nothing, the section does not appear. */
  hostTerms:     { en: "Terms set by this host", es: "Términos fijados por este anfitrión", de: "Vom Gastgeber festgelegte Bedingungen", ru: "Условия, заданные хозяином", zh: "房东设定的条款", pt: "Termos definidos por este anfitrião" },
  termNotice:    { en: "{n} days' notice to end the tenancy, from either side.", es: "Aviso de {n} días para terminar el arriendo, de cualquiera de las partes.", de: "{n} Tage Kündigungsfrist, von beiden Seiten.", ru: "Уведомление о расторжении за {n} дней, с любой стороны.", zh: "任一方终止租约须提前 {n} 天通知。", pt: "Aviso de {n} dias para encerrar a locação, de qualquer das partes." },
  termPayWindow: { en: "Rent is due within {n} business days of each period starting.", es: "El canon se paga dentro de los {n} días hábiles siguientes al inicio de cada período.", de: "Die Miete ist innerhalb von {n} Werktagen nach Beginn jedes Zeitraums fällig.", ru: "Оплата вносится в течение {n} рабочих дней с начала каждого периода.", zh: "每期开始后 {n} 个工作日内须付租金。", pt: "O aluguel vence em {n} dias úteis após o início de cada período." },
  termBreach:    { en: "Leaving early costs the equivalent of {n} month's rent.", es: "Terminar anticipadamente cuesta el equivalente a {n} mes de canon.", de: "Ein vorzeitiger Auszug kostet das Äquivalent von {n} Monatsmiete.", ru: "Досрочный выезд стоит {n} месячной арендной платы.", zh: "提前退租需支付相当于 {n} 个月租金的费用。", pt: "Sair antes do prazo custa o equivalente a {n} mês de aluguel." },
  termBreachPl:  { en: "Leaving early costs the equivalent of {n} months' rent.", es: "Terminar anticipadamente cuesta el equivalente a {n} meses de canon.", de: "Ein vorzeitiger Auszug kostet das Äquivalent von {n} Monatsmieten.", ru: "Досрочный выезд стоит {n} месяцев арендной платы.", zh: "提前退租需支付相当于 {n} 个月租金的费用。", pt: "Sair antes do prazo custa o equivalente a {n} meses de aluguel." },
  termsFromHost: { en: "These are this host's own terms, not OneHome's.", es: "Estos son los términos del propio anfitrión, no de OneHome.", de: "Dies sind die eigenen Bedingungen des Gastgebers, nicht die von OneHome.", ru: "Это собственные условия хозяина, а не OneHome.", zh: "以上为房东自设条款，非 OneHome 条款。", pt: "Estes são os termos do próprio anfitrião, não da OneHome." },
  requestInChat: { en: "A copy of this request is in your Messages, so you can always pull it up.", es: "Hay una copia de esta solicitud en sus Mensajes, para que siempre pueda consultarla.", de: "Eine Kopie dieser Anfrage liegt in Ihren Nachrichten, damit Sie sie jederzeit aufrufen können.", ru: "Копия заявки сохранена в ваших Сообщениях — её всегда можно открыть.", zh: "该申请的副本已存入您的消息，随时可以查看。", pt: "Uma cópia desta solicitação está nas suas Mensagens, para você consultar quando quiser." },
} as const satisfies Record<string, Localized>;

export type CopyKey = keyof typeof COPY;

const fill = (s: string, vars?: Record<string, string | number>): string =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

/** The one accessor. `D(lang, "homeDetails")`, or `D(lang, "showAll", { n: 12 })`. */
export const D = (lang: string, key: CopyKey, vars?: Record<string, string | number>): string =>
  fill(WA(lang, COPY[key]), vars);
