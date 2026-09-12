import type { Lang } from "./i18n";

const en = {
  expandHeader: "Expand header", collapseHeader: "Collapse header",
  pin: "Pin", unpin: "Unpin", pinHelp: "Pin or unpin header",
  doubleTapHelp: "Double-tap to pin or unpin", doubleTapToPin: "Double-tap to pin",
  headerPinned: "Header pinned", autoHideRestored: "Auto-hide restored",
  moreInfo: "More info", gotIt: "Got it",
  apps: "Apps", appsHint: "Things you open and use", services: "Services", servicesHint: "Things we run for you", yourWorld: "Your World", admin: "Admin",
};
type ControlCopy = Record<keyof typeof en, string>;
const es: ControlCopy = {
  expandHeader: "Expandir encabezado", collapseHeader: "Contraer encabezado",
  pin: "Fijar", unpin: "Liberar", pinHelp: "Fijar o liberar encabezado",
  doubleTapHelp: "Doble toque para fijar o liberar", doubleTapToPin: "Doble toque para fijar",
  headerPinned: "Encabezado fijado", autoHideRestored: "Ocultación automática restaurada",
  moreInfo: "Más información", gotIt: "Entendido",
  apps: "Aplicaciones", appsHint: "Para abrir y usar", services: "Servicios", servicesHint: "Lo hacemos por ti", yourWorld: "Tu mundo", admin: "Administración",
};
const copy: Record<Lang, ControlCopy> = {
  en, co: es, es,
  de: {
    expandHeader: "Kopfzeile ausklappen", collapseHeader: "Kopfzeile einklappen",
    pin: "Anheften", unpin: "Lösen", pinHelp: "Kopfzeile anheften oder lösen",
    doubleTapHelp: "Zum Anheften oder Lösen doppelt tippen", doubleTapToPin: "Zum Anheften doppelt tippen",
    headerPinned: "Kopfzeile angeheftet", autoHideRestored: "Automatisches Ausblenden wieder aktiv",
    moreInfo: "Weitere Informationen", gotIt: "Verstanden",
    apps: "Apps", appsHint: "Zum Öffnen und Nutzen", services: "Dienste", servicesHint: "Wir erledigen das für Sie", yourWorld: "Deine Welt", admin: "Verwaltung",
  },
  ru: {
    expandHeader: "Развернуть верхнюю панель", collapseHeader: "Свернуть верхнюю панель",
    pin: "Закрепить", unpin: "Открепить", pinHelp: "Закрепить или открепить верхнюю панель",
    doubleTapHelp: "Двойное нажатие — закрепить или открепить", doubleTapToPin: "Дважды нажмите, чтобы закрепить",
    headerPinned: "Верхняя панель закреплена", autoHideRestored: "Автоматическое скрытие включено",
    moreInfo: "Подробнее", gotIt: "Понятно",
    apps: "Приложения", appsHint: "Открывайте и пользуйтесь", services: "Услуги", servicesHint: "Мы делаем это за вас", yourWorld: "Ваш мир", admin: "Администрирование",
  },
  zh: {
    expandHeader: "展开顶部栏", collapseHeader: "收起顶部栏",
    pin: "固定", unpin: "取消固定", pinHelp: "固定或取消固定顶部栏",
    doubleTapHelp: "双击可固定或取消固定", doubleTapToPin: "双击可固定",
    headerPinned: "顶部栏已固定", autoHideRestored: "已恢复自动隐藏",
    moreInfo: "更多信息", gotIt: "知道了",
    apps: "应用", appsHint: "打开即可使用", services: "服务", servicesHint: "由我们为您提供", yourWorld: "你的世界", admin: "管理",
  },
  pt: {
    expandHeader: "Expandir cabeçalho", collapseHeader: "Recolher cabeçalho",
    pin: "Fixar", unpin: "Soltar", pinHelp: "Fixar ou soltar cabeçalho",
    doubleTapHelp: "Toque duas vezes para fixar ou soltar", doubleTapToPin: "Toque duas vezes para fixar",
    headerPinned: "Cabeçalho fixado", autoHideRestored: "Ocultação automática restaurada",
    moreInfo: "Mais informações", gotIt: "Entendi",
    apps: "Aplicativos", appsHint: "Para abrir e usar", services: "Serviços", servicesHint: "Cuidamos disso para você", yourWorld: "Seu mundo", admin: "Administração",
  },
};

/** Shared control labels stay consistent regardless of a product dictionary's keys. */
export const shellControlCopy = (lang: Lang): ControlCopy => copy[lang] ?? en;
