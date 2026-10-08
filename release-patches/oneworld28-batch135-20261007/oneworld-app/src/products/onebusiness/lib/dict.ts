import { fixedCopy } from "./locales";
import { useI18n as useShellI18n } from "@oneworld/shell";

/** Published en/es copy (co = es), with additional fixed UI translations in locales.ts. */
const dict = {
  en: {
    loading: "Loading…", signInFirst: "Sign in to use One Business.", errGeneric: "Something went wrong.",
    setupTitle: "Add your business", setupBody: "Everything in One Business belongs to a business: its services, its calls, its leads. Add yours once. You can add more later.",
    bizName: "Business name", industry: "Industry", phone: "Phone", email: "Email", website: "Website", city: "City", create: "Add business",
    industryRealEstate: "Real estate", industryServices: "Home & professional services", industryHealth: "Health & wellness", industryRetail: "Shop or restaurant", industryOther: "Other",
    /* overview */
    yourServices: "Your services", noServices: "No services yet. Pick your first one.", browse: "Browse services", nextSteps: "What needs you", nothingPending: "Nothing waiting on you.",
    stRequested: "Requested", stAwaiting: "Needs your info", stQuoted: "Quote ready", stBuilding: "Being built", stReview: "Ready for your review", stActive: "Active", stPaused: "Paused", stFailed: "Needs attention", stCancelled: "Cancelled",
    open: "Open", flagship: "Flagship", connectedOn: "Connected", notConnected: "Not connected", lastSync: "Updated", never: "never",
    /* services */
    servicesTitle: "Services", servicesBody: "Every service One World Labs offers, priced and activated by our team. A request here is not a charge.",
    planPricing: "Plan pricing", quotePricing: "Quote-based", addonPricing: "Add-on", reportingPricing: "Included with a connected account",
    request: "Request this service", requested: "Requested", cancelRequest: "Withdraw request", requestNote: "Anything we should know? (optional)", learnMore: "Read about it", pricingPending: "Price confirmed with you before activation",
    /* leads */
    leadsTitle: "Leads", leadsBody: "Every inquiry that reaches your business — calls, forms, chats — in one list.", noLeads: "No leads yet.", noLeadsVoice: "Leads arrive from your connected services. OneVoice calls and website forms will appear here.",
    stage: "Stage", source: "Source", srcCall: "Call", srcForm: "Form", srcChat: "Chat", srcAds: "Ads", srcManual: "Added by you", srcOther: "Other",
    addLead: "Add a lead", leadName: "Name", leadPhone: "Phone", leadEmail: "Email", save: "Save", cancelAddLead: "Cancel adding lead", cancelEditStages: "Cancel editing stages", nextAction: "Next action", nextOn: "By", note: "Note", addNote: "Add note", moveTo: "Move to", value: "Value (COP)", history: "History",
    pipelineLocked: "The sales pipeline is an add-on. Stages, next actions and the funnel unlock when it is active for this business.", askPipeline: "Ask about the pipeline add-on",
    won: "Sale", lost: "Lost",
    /* pipeline */
    pipelineTitle: "Sales pipeline", funnel: "Funnel", stagesTitle: "Your stages", stagesBody: "Rename stages to match how you sell. A booking is not a sale until you say so.", editStages: "Edit stages", stageLabel: "Stage name", addStage: "Add stage", total: "Inquiries", attribution: "Counts come from linked calls, forms and chats. Anything handled outside is not counted.",
    /* results */
    resultsTitle: "Results", resultsBody: "Numbers from your connected accounts, with the date they were last refreshed. Nothing here is estimated.", noData: "No data yet — connect the service to see results.", period: "Period", thisWeek: "This week", thisMonth: "This month", today: "Today",
    /* voice */
    voiceTitle: "OneVoice", voiceBody: "Calls answered, leads captured, appointments booked.", calls: "Calls", missed: "Missed", withLead: "Became leads", appointments: "Appointments", followUps: "Follow-ups due", urgent: "Urgent",
    voiceNotActive: "OneVoice is not active for this business yet.", voiceNotConnected: "OneVoice is active but the phone system is not connected yet. Our team connects it during setup.", recentCalls: "Recent calls", noCalls: "No calls in this period.", summary: "Summary", recording: "Recording", urgencyWhy: "Why urgent",
    /* businesses */
    businessesTitle: "Businesses", switchTo: "Switch", current: "Current", addAnother: "Add another business",
    /* profile slots */
    tileServices: "Services", tileLeads: "Leads", tileResults: "Results", statServices: "Active services", statLeads: "Open leads", statCalls: "Calls today",
  },
  es: {
    loading: "Cargando…", signInFirst: "Inicie sesión para usar One Business.", errGeneric: "Algo salió mal.",
    setupTitle: "Agregue su negocio", setupBody: "Todo en One Business pertenece a un negocio: sus servicios, sus llamadas, sus prospectos. Agregue el suyo una vez. Puede agregar más después.",
    bizName: "Nombre del negocio", industry: "Sector", phone: "Teléfono", email: "Correo", website: "Sitio web", city: "Ciudad", create: "Agregar negocio",
    industryRealEstate: "Inmobiliaria", industryServices: "Servicios para el hogar y profesionales", industryHealth: "Salud y bienestar", industryRetail: "Tienda o restaurante", industryOther: "Otro",
    yourServices: "Sus servicios", noServices: "Aún no tiene servicios. Elija el primero.", browse: "Ver servicios", nextSteps: "Qué necesita de usted", nothingPending: "Nada pendiente de su parte.",
    stRequested: "Solicitado", stAwaiting: "Falta su información", stQuoted: "Cotización lista", stBuilding: "En construcción", stReview: "Listo para su revisión", stActive: "Activo", stPaused: "Pausado", stFailed: "Requiere atención", stCancelled: "Cancelado",
    open: "Abrir", flagship: "Principal", connectedOn: "Conectado", notConnected: "No conectado", lastSync: "Actualizado", never: "nunca",
    servicesTitle: "Servicios", servicesBody: "Todos los servicios de One World Labs, cotizados y activados por nuestro equipo. Una solicitud aquí no es un cobro.",
    planPricing: "Por plan", quotePricing: "Por cotización", addonPricing: "Complemento", reportingPricing: "Incluido con una cuenta conectada",
    request: "Solicitar este servicio", requested: "Solicitado", cancelRequest: "Retirar solicitud", requestNote: "¿Algo que debamos saber? (opcional)", learnMore: "Leer más", pricingPending: "Precio confirmado con usted antes de activar",
    leadsTitle: "Prospectos", leadsBody: "Cada consulta que llega a su negocio — llamadas, formularios, chats — en una lista.", noLeads: "Aún no hay prospectos.", noLeadsVoice: "Los prospectos llegan de sus servicios conectados. Las llamadas de OneVoice y los formularios del sitio aparecerán aquí.",
    stage: "Etapa", source: "Origen", srcCall: "Llamada", srcForm: "Formulario", srcChat: "Chat", srcAds: "Anuncios", srcManual: "Agregado por usted", srcOther: "Otro",
    addLead: "Agregar prospecto", leadName: "Nombre", leadPhone: "Teléfono", leadEmail: "Correo", save: "Guardar", cancelAddLead: "Cancelar creación del prospecto", cancelEditStages: "Cancelar edición de etapas", nextAction: "Próxima acción", nextOn: "Para el", note: "Nota", addNote: "Agregar nota", moveTo: "Mover a", value: "Valor (COP)", history: "Historial",
    pipelineLocked: "El embudo de ventas es un complemento. Las etapas, próximas acciones y el embudo se activan cuando esté activo para este negocio.", askPipeline: "Preguntar por el complemento de embudo",
    won: "Venta", lost: "Perdido",
    pipelineTitle: "Embudo de ventas", funnel: "Embudo", stagesTitle: "Sus etapas", stagesBody: "Renombre las etapas según cómo vende. Una cita no es una venta hasta que usted lo diga.", editStages: "Editar etapas", stageLabel: "Nombre de la etapa", addStage: "Agregar etapa", total: "Consultas", attribution: "Los conteos vienen de llamadas, formularios y chats vinculados. Lo que se maneja por fuera no se cuenta.",
    resultsTitle: "Resultados", resultsBody: "Números de sus cuentas conectadas, con la fecha de su última actualización. Nada aquí es estimado.", noData: "Sin datos aún — conecte el servicio para ver resultados.", period: "Periodo", thisWeek: "Esta semana", thisMonth: "Este mes", today: "Hoy",
    voiceTitle: "OneVoice", voiceBody: "Llamadas contestadas, prospectos captados, citas agendadas.", calls: "Llamadas", missed: "Perdidas", withLead: "Se volvieron prospectos", appointments: "Citas", followUps: "Seguimientos pendientes", urgent: "Urgentes",
    voiceNotActive: "OneVoice aún no está activo para este negocio.", voiceNotConnected: "OneVoice está activo pero el sistema telefónico aún no está conectado. Nuestro equipo lo conecta durante la configuración.", recentCalls: "Llamadas recientes", noCalls: "Sin llamadas en este periodo.", summary: "Resumen", recording: "Grabación", urgencyWhy: "Por qué es urgente",
    businessesTitle: "Negocios", switchTo: "Cambiar", current: "Actual", addAnother: "Agregar otro negocio",
    tileServices: "Servicios", tileLeads: "Prospectos", tileResults: "Resultados", statServices: "Servicios activos", statLeads: "Prospectos abiertos", statCalls: "Llamadas hoy",
  },
} as const;
export type BizKey = keyof typeof dict.en;
export function useT() {
  const { lang: shellLang } = useShellI18n();
  const lang: "en" | "es" = shellLang === "es" || shellLang === "co" ? "es" : "en";
  const t = (k: BizKey) => fixedCopy(shellLang, dict.en[k], dict.es[k]);
  return { lang, locale: shellLang, t, copy: (en: string, es: string) => fixedCopy(shellLang, en, es) };
}
export const dateLocale = (lang: string) => ({ en: "en-US", es: "es-CO", co: "es-CO", de: "de-DE", ru: "ru-RU", zh: "zh-CN", pt: "pt-BR" }[lang] ?? "en-US");

/** Controlled UI copy only. Never translate arbitrary business notes or backend text. */
export function businessError(error: unknown, lang: string, action: "save" | "request" | "withdraw" = "save") {
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  const known: Record<string, [string, string]> = {
    "Sign in first.": ["Sign in to continue.", "Inicie sesión para continuar."],
    "Only an owner or admin can edit this business.": ["Only an owner or admin can edit this business.", "Solo el propietario o un administrador puede editar este negocio."],
    "Only an owner or admin can change stages.": ["Only an owner or admin can change stages.", "Solo el propietario o un administrador puede cambiar las etapas."],
    "Only an owner or admin can request a service.": ["Only an owner or admin can request a service.", "Solo el propietario o un administrador puede solicitar este servicio."],
    "The sales pipeline is not active for this business.": ["The sales pipeline is not active for this business.", "El seguimiento de ventas no está activo para este negocio."],
    "Provide at least two stages.": ["Add at least two stages.", "Agregue al menos dos etapas."],
    "Unknown stage.": ["That stage is unavailable.", "Esa etapa no está disponible."],
    "Unknown service.": ["That service is unavailable.", "Ese servicio no está disponible."],
    "Lead not found.": ["This lead is unavailable or you do not have access.", "Este prospecto no está disponible o usted no tiene acceso."],
    "Not found.": ["This request is unavailable or you do not have access.", "Esta solicitud no está disponible o usted no tiene acceso."],
    "Business unavailable.": ["This business is unavailable or you do not have access.", "Este negocio no está disponible o usted no tiene acceso."],
    "Business name must contain 2 to 120 characters.": ["Business name must contain 2 to 120 characters.", "El nombre del negocio debe tener entre 2 y 120 caracteres."],
    "Not a member of this business.": ["You do not have access to this business.", "Usted no tiene acceso a este negocio."],
  };
  const fallback = {
    save: ["We couldn’t save the changes. Please try again.", "No pudimos guardar los cambios. Intente de nuevo."],
    request: ["We couldn’t submit the request. Please try again.", "No pudimos enviar la solicitud. Intente de nuevo."],
    withdraw: ["We couldn’t withdraw the request. Please try again.", "No pudimos retirar la solicitud. Intente de nuevo."],
  };
  const labels = Object.prototype.hasOwnProperty.call(known, message) ? known[message] : fallback[action];
  return fixedCopy(lang, labels[0], labels[1]);
}

const categories: Record<string, string> = {
  onevoice: "Recepcionista con IA", onepage: "Sitio web", oneapp: "App móvil",
  reputation: "Reseñas y reputación", search_ai: "Visibilidad en búsquedas e IA",
  winback: "Recuperación de clientes", missed_call: "Respuesta a llamadas perdidas",
  ai_chat: "Chat con IA", automation: "Automatización de seguimientos",
  custom_ai: "Agentes e integraciones de IA", ads_reporting: "Resultados de Google Ads", pipeline: "Proceso de ventas",
};
const categoryEnglish: Record<string, string> = { onevoice: "AI receptionist", onepage: "Website", oneapp: "Mobile app", reputation: "Reputation & reviews", search_ai: "Search & AI visibility", winback: "Customer win-back", missed_call: "Missed-call follow-up", ai_chat: "AI chat", automation: "Marketing & follow-up automation", custom_ai: "AI agents & integrations", ads_reporting: "Google Ads results", pipeline: "Sales pipeline" };
export const serviceCategory = (service: { key: string; name: string }, lang: string) =>
  lang === "co" || lang === "es" ? (Object.prototype.hasOwnProperty.call(categories, service.key) ? categories[service.key] : service.name)
    : ["de", "ru", "zh", "pt"].includes(lang) && Object.prototype.hasOwnProperty.call(categoryEnglish, service.key) ? fixedCopy(lang, categoryEnglish[service.key]) : service.name;
export const serviceTitle = (service: { key: string; name: string; brand?: string | null }, lang: string) =>
  service.brand || serviceCategory(service, lang);
export function industryLabel(industry: string | null | undefined, lang: string) {
  if (lang !== "co" && lang !== "es") return industry && ["Real estate", "Home & professional services", "Health & wellness", "Shop or restaurant", "Other"].includes(industry) ? fixedCopy(lang, industry) : industry;
  const labels: Record<string, string> = { "Real estate": "Inmobiliaria", "Home & professional services": "Servicios para el hogar y profesionales", "Health & wellness": "Salud y bienestar", "Shop or restaurant": "Tienda o restaurante", Other: "Otro" };
  return industry ? (Object.prototype.hasOwnProperty.call(labels, industry) ? labels[industry] : industry) : industry;
}
export function eventLabel(kind: string, lang: string) {
  const labels: Record<string, [string, string]> = { note: ["Note", "Nota"], stage: ["Stage change", "Cambio de etapa"], call: ["Call", "Llamada"], form: ["Form", "Formulario"], chat: ["Chat", "Chat"], ads: ["Ads", "Anuncios"], manual: ["Added manually", "Agregado manualmente"] };
  return (Object.prototype.hasOwnProperty.call(labels, kind) ? labels[kind] : ["Activity", "Actividad"])[lang === "co" || lang === "es" ? 1 : 0];
}
