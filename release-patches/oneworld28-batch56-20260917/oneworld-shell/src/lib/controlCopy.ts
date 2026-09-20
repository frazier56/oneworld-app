import type { Lang } from "./i18n";

const en = {
    darkMode: "Dark mode", lightMode: "Light mode", returnAccount: "Return to my account", returning: "Returning…", viewAsUser: "View as user", searchUsers: "Search name or email…", switching: "Switching…", noUsers: "No users found.",
  expandHeader: "Expand header", collapseHeader: "Collapse header",
  pin: "Pin", unpin: "Unpin", pinHelp: "Pin or unpin header",
  doubleTapHelp: "Double-tap to pin or unpin", doubleTapToPin: "Double-tap to pin",
  headerPinned: "Header pinned", autoHideRestored: "Auto-hide restored",
  moreInfo: "More info", gotIt: "Got it",
  apps: "Apps", appsHint: "Things you open and use", services: "Services", servicesHint: "Things we run for you", yourWorld: "Your World", admin: "Admin",
};
type ControlCopy = Record<keyof typeof en, string>;
const es: ControlCopy = {
    darkMode: "Modo oscuro", lightMode: "Modo claro", returnAccount: "Volver a mi cuenta", returning: "Volviendo…", viewAsUser: "Ver como usuario", searchUsers: "Buscar nombre o correo…", switching: "Cambiando…", noUsers: "No se encontraron usuarios.",
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
    darkMode: "Dunkler Modus", lightMode: "Heller Modus", returnAccount: "Zurück zu meinem Konto", returning: "Rückkehr läuft…", viewAsUser: "Als Benutzer ansehen", searchUsers: "Name oder E-Mail suchen…", switching: "Wechsel läuft…", noUsers: "Keine Benutzer gefunden.",
    expandHeader: "Kopfzeile ausklappen", collapseHeader: "Kopfzeile einklappen",
    pin: "Anheften", unpin: "Lösen", pinHelp: "Kopfzeile anheften oder lösen",
    doubleTapHelp: "Zum Anheften oder Lösen doppelt tippen", doubleTapToPin: "Zum Anheften doppelt tippen",
    headerPinned: "Kopfzeile angeheftet", autoHideRestored: "Automatisches Ausblenden wieder aktiv",
    moreInfo: "Weitere Informationen", gotIt: "Verstanden",
    apps: "Apps", appsHint: "Zum Öffnen und Nutzen", services: "Dienste", servicesHint: "Wir erledigen das für Sie", yourWorld: "Deine Welt", admin: "Verwaltung",
  },
  ru: {
    darkMode: "Тёмная тема", lightMode: "Светлая тема", returnAccount: "Вернуться в свой аккаунт", returning: "Возврат…", viewAsUser: "Просмотр от имени пользователя", searchUsers: "Поиск по имени или почте…", switching: "Переключение…", noUsers: "Пользователи не найдены.",
    expandHeader: "Развернуть верхнюю панель", collapseHeader: "Свернуть верхнюю панель",
    pin: "Закрепить", unpin: "Открепить", pinHelp: "Закрепить или открепить верхнюю панель",
    doubleTapHelp: "Двойное нажатие — закрепить или открепить", doubleTapToPin: "Дважды нажмите, чтобы закрепить",
    headerPinned: "Верхняя панель закреплена", autoHideRestored: "Автоматическое скрытие включено",
    moreInfo: "Подробнее", gotIt: "Понятно",
    apps: "Приложения", appsHint: "Открывайте и пользуйтесь", services: "Услуги", servicesHint: "Мы делаем это за вас", yourWorld: "Ваш мир", admin: "Администрирование",
  },
  zh: {
    darkMode: "深色模式", lightMode: "浅色模式", returnAccount: "返回我的账户", returning: "正在返回…", viewAsUser: "以用户身份查看", searchUsers: "搜索姓名或邮箱…", switching: "正在切换…", noUsers: "未找到用户。",
    expandHeader: "展开顶部栏", collapseHeader: "收起顶部栏",
    pin: "固定", unpin: "取消固定", pinHelp: "固定或取消固定顶部栏",
    doubleTapHelp: "双击可固定或取消固定", doubleTapToPin: "双击可固定",
    headerPinned: "顶部栏已固定", autoHideRestored: "已恢复自动隐藏",
    moreInfo: "更多信息", gotIt: "知道了",
    apps: "应用", appsHint: "打开即可使用", services: "服务", servicesHint: "由我们为您提供", yourWorld: "你的世界", admin: "管理",
  },
  pt: {
    darkMode: "Modo escuro", lightMode: "Modo claro", returnAccount: "Voltar à minha conta", returning: "Voltando…", viewAsUser: "Ver como usuário", searchUsers: "Buscar nome ou e-mail…", switching: "Alternando…", noUsers: "Nenhum usuário encontrado.",
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
