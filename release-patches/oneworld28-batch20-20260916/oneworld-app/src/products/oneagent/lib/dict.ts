import { useI18n as useShellI18n } from "@oneworld/shell";

/**
 * ONEAGENT STRINGS — the local dictionary, OneEvent's pattern exactly.
 * ============================================================================================
 * en + es, complete. The shell's language picker is the ONLY picker (`oneworld-lang`); this
 * module derives from it and only supplies the OneAgent copy. `co` is Spanish — a bare
 * `=== "es"` test served English to every user in Colombia once (shell i18n's own warning).
 *
 * OPEN TASK (matches OneEvent's state): de / ru / zh / pt fall back to English until that copy
 * is written. Every screen string lives HERE — no English-only hard-coding in JSX.
 *
 * Voice note: the product is a HUMAN middleman (Lee, 8 Aug 2026). Every line below describes a
 * person working for you, never software.
 */
const dict = {
  en: {
    /* ── Shared ── */
    pendingNote: "Lovable Cloud tables pending — showing empty state",
    loading: "Loading…",
    signInFirst: "Sign in to use OneAgent.",

    /* ── Home ── */
    pillAll: "All", pillDeals: "Deals", pillRoster: "Roster", pillConsent: "Invites",
    /* The composer walks to the centre action, which is PARTNER / grow the book (Lee's ruling,
       9 Aug 2026) — the label has to promise what the screen behind it does. */
    composer: "Grow your book…",
    onboardTitle: "Bring your roster",
    onboardBody:
      "You represent people — get them on the platform. Import your whole roster in minutes, then start working deals for them. One agent, forty members: that's the play.",
    onboardRoster: "Add your roster",
    onboardDeals: "Start a pipeline",
    actDealCreated: "New deal",
    actDealStage: "Stage change",
    actRosterAdded: "Added to roster",
    actRosterRemoved: "Removed from roster",
    actConsent: "Partner",
    awaitingConsent: "Invite pending",
    startsOn: "Starts",

    /* ── Grow your book (the centre action — /agent/ask) ── */
    growTitle: "Grow your book.",
    growSub: "Share your code. Everyone who joins through it lands in your book.",
    growQrHint: "Anyone who scans signs up in OneJob — as a professional or as a hirer, their choice — and is tied to you automatically.",
    growBothSides: "Both directions land in OneJob connected to you: talent you'll find work for, and companies you'll find talent for.",
    copyLink: "Copy",
    copiedOk: "Copied",
    shareLink: "Share",
    howWorks: "How it works",
    growStep1: "Share your QR or link — on set, in DMs, on your cards.",
    growStep2: "They sign up in OneJob as a professional or a hirer — their choice.",
    growStep3: "They appear here, connected to you. Start working deals for them.",
    recentJoins: "Recent joins",
    noJoins: "Nobody has joined through your link yet.",

    /* ── Partner with someone already on the platform ── */
    partnerOnTitle: "Partner with someone on the platform",
    partnerOnSub: "Already here? Invite them straight into your book — no QR needed.",
    searchPeoplePh: "Search people by name…",
    inviteCta: "Invite",
    noResults: "No one found by that name.",

    /* ── The partner ladder (invite → connected → contract → partnered) ── */
    ladderTitle: "Partnership",
    psInvited: "Invited", psConnected: "Connected", psPartnered: "Partnered", psEnded: "Disconnected",
    sendContract: "Send contract",
    sendContractRule: "Available once connected — contracts can only go to people connected to you.",
    viaMessages: "Contract proposals arrive via Messages.",
    disconnect: "Disconnect",
    disconnectNote: "Disconnecting also ends any active contract.",
    disconnectRight: "Either side can disconnect at any time.",

    /* ── Contracts section (Deals tab) ── */
    contractsTitle: "Contracts",
    grpActive: "Active", grpPending: "Pending", grpEnded: "Completed & ended",
    emptyContracts: "No contracts yet. Contracts start from a partner's profile and arrive via Messages.",
    jobsDealsTitle: "Jobs & deals",

    /* ── Deal intake (New deal, on the pipeline) ── */
    askTitle: "Work a deal on someone's behalf",
    askSub: "One ask. A real person takes it from here.",
    modeTalent: "Find me work",
    modeTalentSub: "You're talent. Your agent goes out, negotiates, and brings back the offer.",
    modeCompany: "Find talent",
    modeCompanySub: "You work the company side. Start a talent search on a client's behalf.",
    fWhat: "What's the work?",
    whatPh: "Campaign, show, listing, placement…",
    fWhere: "Where",
    wherePh: "City — or remote",
    fRate: "Rate expectation",
    fCut: "Agent cut %",
    cutHint: "Inside the talent's rate. Visible to talent and agent only — the client sees one total price.",
    fCounterpart: "Counterpart (if known)",
    counterpartPh: "Company, brand or client",
    fFor: "For roster member",
    optNone: "— not linked yet —",
    fNotes: "Notes",
    notesPh: "Anything your agent should know",
    workedByTalent: "This deal will be worked by your agent, for you.",
    workedByCompany: "You'll work this deal on the company's behalf.",
    createDeal: "Create deal",
    createdOk: "Deal created — it's in intake.",
    viewPipeline: "View pipeline",
    needWhat: "Add a short title for the work.",
    createFailed: "Couldn't save the deal.",

    /* ── Deals ── */
    dealsTitle: "Deal pipeline",
    newDeal: "Start a deal",
    stage_intake: "Intake", stage_matched: "Matched", stage_negotiating: "Negotiating",
    stage_signed: "Signed", "stage_in-progress": "In progress", stage_closed: "Closed",
    dirTalent: "Talent-side", dirCompany: "Company-side",
    rate: "Rate", agentCut: "Agent cut", platformFee: "Platform fee", netTalent: "Net to talent",
    clientTotal: "Client sees one total",
    eyesOnly: "Visible to talent and agent only",
    moveTo: "Move to",
    onejobNotice: "Contracts and payment run through OneJob — coming when consent review completes.",
    emptyDealsTitle: "No deals yet",
    emptyDealsBody: "Start your first ask and the pipeline builds itself.",

    /* ── Roster ── */
    rosterTitle: "Your roster",
    addMember: "Add member",
    fName: "Full name",
    fEmail: "Email",
    fCategory: "Category",
    catPh: "Model, actor, DJ, developer…",
    saveMember: "Add to roster",
    needNameEmail: "Name and email are required.",
    addFailed: "Couldn't add the member.",
    bulkTitle: "Bulk import",
    bulkHint: "Paste CSV — one person per line: name, email, category. Or upload a .csv file.",
    csvPh: "Ana Ruiz, ana@example.com, Model\nLuis Vega, luis@example.com, DJ",
    uploadCsv: "Upload .csv",
    previewReady: "ready to import",
    skippedRows: "skipped (missing name or email)",
    importNow: "Import",
    importedOk: "imported",
    importFailed: "Couldn't import the list.",
    csInvited: "Invited", csGranted: "Granted", csRevoked: "Revoked", csRemoved: "Removed",
    resend: "Resend invite",
    resent: "Invite resent",
    emptyRosterTitle: "Nobody on the roster yet",
    emptyRosterBody: "Add your people one by one — or paste your whole list at once.",

    /* ── Roster member ── */
    memberNotFound: "Member not found.",
    backToRoster: "Back to roster",
    consentTitle: "Consent",
    consentSub: "What this member allows their agent to do",
    scopeApply: "Apply", scopeNegotiate: "Negotiate", scopeSign: "Sign",
    notGranted: "Not granted",
    counselLine: "Consent records are under legal review — scopes become binding after counsel sign-off.",
    theirDeals: "Deals",
    noMemberDeals: "No deals for this member yet.",
    removeMember: "Remove from roster",
    removeConfirm: "Tap again to confirm",
    removedOk: "Removed from roster.",

    /* ── Representation contract (display only — zero write path until counsel signs off) ── */
    repTitle: "Representation contract",
    repNone: "No contract yet.",
    repCommission: "Commission",
    repStarts: "Starts",
    repEnds: "Ends",
    repStatus_proposed: "Proposed", repStatus_active: "Active",
    repStatus_ended: "Ended", repStatus_revoked: "Revoked",
    repNote: "No money moves at signing. When deals pay through OneJob, the hirer's one payment pays the professional and the agent.",

    /* ── Calendar ── */
    calTitle: "Calendar",
    noUpcoming: "No upcoming dates yet. Deals with a start date show up here.",

    /* ── Alerts ── */
    alertsTitle: "Notifications",
    noAlerts: "No notifications yet.",

    /* ── Profile slots ── */
    tileRoster: "Roster", tileDeals: "Deals", tileScout: "Scout",
    statRoster: "Roster", statClosed: "Deals closed", statReviews: "Reviews",
    nextUp: "Next up",
    openCalendar: "Open calendar",
  },
  es: {
    /* ── Compartido ── */
    pendingNote: "Tablas de Lovable Cloud pendientes — mostrando estado vacío",
    loading: "Cargando…",
    signInFirst: "Inicia sesión para usar OneAgent.",

    /* ── Inicio ── */
    pillAll: "Todo", pillDeals: "Negocios", pillRoster: "Roster", pillConsent: "Invitaciones",
    composer: "Haz crecer tu cartera…",
    onboardTitle: "Trae tu roster",
    onboardBody:
      "Tú representas personas — súbelas a la plataforma. Importa todo tu roster en minutos y empieza a trabajar negocios para ellos. Un agente, cuarenta miembros: esa es la jugada.",
    onboardRoster: "Agregar mi roster",
    onboardDeals: "Iniciar un pipeline",
    actDealCreated: "Nuevo negocio",
    actDealStage: "Cambio de etapa",
    actRosterAdded: "Agregado al roster",
    actRosterRemoved: "Quitado del roster",
    actConsent: "Socio",
    awaitingConsent: "Invitación pendiente",
    startsOn: "Comienza",

    /* ── Haz crecer tu cartera (la acción central — /agent/ask) ── */
    growTitle: "Haz crecer tu cartera.",
    growSub: "Comparte tu código. Todos los que se unan con él entran a tu cartera.",
    growQrHint: "Quien lo escanee se registra en OneJob — como profesional o como contratante, ellos eligen — y queda vinculado a ti automáticamente.",
    growBothSides: "Ambas direcciones llegan a OneJob conectadas contigo: talento al que buscarás trabajo, y empresas a las que buscarás talento.",
    copyLink: "Copiar",
    copiedOk: "Copiado",
    shareLink: "Compartir",
    howWorks: "Cómo funciona",
    growStep1: "Comparte tu QR o enlace — en el set, por mensajes, en tus tarjetas.",
    growStep2: "Se registran en OneJob como profesional o contratante — ellos eligen.",
    growStep3: "Aparecen aquí, conectados a ti. Empieza a trabajar negocios para ellos.",
    recentJoins: "Ingresos recientes",
    noJoins: "Aún nadie se ha unido con tu enlace.",

    /* ── Asóciate con alguien ya en la plataforma ── */
    partnerOnTitle: "Asóciate con alguien en la plataforma",
    partnerOnSub: "¿Ya está aquí? Invítalo directo a tu cartera — sin QR.",
    searchPeoplePh: "Buscar personas por nombre…",
    inviteCta: "Invitar",
    noResults: "No se encontró a nadie con ese nombre.",

    /* ── La escalera de asociación (invitación → conectado → contrato → socio) ── */
    ladderTitle: "Asociación",
    psInvited: "Invitado", psConnected: "Conectado", psPartnered: "Socio", psEnded: "Desconectado",
    sendContract: "Enviar contrato",
    sendContractRule: "Disponible al estar conectados — los contratos solo pueden enviarse a personas conectadas contigo.",
    viaMessages: "Las propuestas de contrato llegan por Mensajes.",
    disconnect: "Desconectar",
    disconnectNote: "Al desconectar también termina cualquier contrato activo.",
    disconnectRight: "Cualquiera de las dos partes puede desconectarse en cualquier momento.",

    /* ── Sección de contratos (pestaña Negocios) ── */
    contractsTitle: "Contratos",
    grpActive: "Activos", grpPending: "Pendientes", grpEnded: "Completados y terminados",
    emptyContracts: "Aún no hay contratos. Los contratos parten del perfil de un socio y llegan por Mensajes.",
    jobsDealsTitle: "Trabajos y negocios",

    /* ── Nuevo negocio (en el pipeline) ── */
    askTitle: "Trabaja un negocio en nombre de alguien",
    askSub: "Una solicitud. Una persona real se encarga desde aquí.",
    modeTalent: "Encuéntrame trabajo",
    modeTalentSub: "Eres talento. Tu agente sale, negocia y te trae la oferta.",
    modeCompany: "Encontrar talento",
    modeCompanySub: "Trabajas del lado de la empresa. Inicia una búsqueda de talento para un cliente.",
    fWhat: "¿Cuál es el trabajo?",
    whatPh: "Campaña, desfile, propiedad, colocación…",
    fWhere: "Dónde",
    wherePh: "Ciudad — o remoto",
    fRate: "Expectativa de tarifa",
    fCut: "Comisión del agente %",
    cutHint: "Dentro de la tarifa del talento. Visible solo para talento y agente — el cliente ve un solo precio total.",
    fCounterpart: "Contraparte (si se conoce)",
    counterpartPh: "Empresa, marca o cliente",
    fFor: "Para miembro del roster",
    optNone: "— sin vincular aún —",
    fNotes: "Notas",
    notesPh: "Lo que tu agente deba saber",
    workedByTalent: "Este negocio lo trabajará tu agente, para ti.",
    workedByCompany: "Trabajarás este negocio en nombre de la empresa.",
    createDeal: "Crear negocio",
    createdOk: "Negocio creado — está en admisión.",
    viewPipeline: "Ver pipeline",
    needWhat: "Agrega un título corto del trabajo.",
    createFailed: "No se pudo guardar el negocio.",

    /* ── Negocios ── */
    dealsTitle: "Pipeline de negocios",
    newDeal: "Iniciar un negocio",
    stage_intake: "Admisión", stage_matched: "Emparejado", stage_negotiating: "En negociación",
    stage_signed: "Firmado", "stage_in-progress": "En curso", stage_closed: "Cerrado",
    dirTalent: "Lado talento", dirCompany: "Lado empresa",
    rate: "Tarifa", agentCut: "Comisión del agente", platformFee: "Comisión de la plataforma",
    netTalent: "Neto para el talento",
    clientTotal: "El cliente ve un solo total",
    eyesOnly: "Visible solo para talento y agente",
    moveTo: "Pasar a",
    onejobNotice: "Los contratos y el pago corren por OneJob — llegará cuando termine la revisión legal del consentimiento.",
    emptyDealsTitle: "Aún no hay negocios",
    emptyDealsBody: "Haz tu primera solicitud y el pipeline se arma solo.",

    /* ── Roster ── */
    rosterTitle: "Tu roster",
    addMember: "Agregar miembro",
    fName: "Nombre completo",
    fEmail: "Correo",
    fCategory: "Categoría",
    catPh: "Modelo, actor, DJ, desarrollador…",
    saveMember: "Agregar al roster",
    needNameEmail: "Nombre y correo son obligatorios.",
    addFailed: "No se pudo agregar al miembro.",
    bulkTitle: "Importación masiva",
    bulkHint: "Pega CSV — una persona por línea: nombre, correo, categoría. O sube un archivo .csv.",
    csvPh: "Ana Ruiz, ana@example.com, Modelo\nLuis Vega, luis@example.com, DJ",
    uploadCsv: "Subir .csv",
    previewReady: "listos para importar",
    skippedRows: "omitidos (falta nombre o correo)",
    importNow: "Importar",
    importedOk: "importados",
    importFailed: "No se pudo importar la lista.",
    csInvited: "Invitado", csGranted: "Otorgado", csRevoked: "Revocado", csRemoved: "Eliminado",
    resend: "Reenviar invitación",
    resent: "Invitación reenviada",
    emptyRosterTitle: "Aún no hay nadie en el roster",
    emptyRosterBody: "Agrega a tu gente uno por uno — o pega toda tu lista de una vez.",

    /* ── Miembro del roster ── */
    memberNotFound: "Miembro no encontrado.",
    backToRoster: "Volver al roster",
    consentTitle: "Consentimiento",
    consentSub: "Lo que este miembro permite hacer a su agente",
    scopeApply: "Postular", scopeNegotiate: "Negociar", scopeSign: "Firmar",
    notGranted: "No otorgado",
    counselLine: "Los registros de consentimiento están en revisión legal — los alcances serán vinculantes tras la aprobación del abogado.",
    theirDeals: "Negocios",
    noMemberDeals: "Aún no hay negocios para este miembro.",
    removeMember: "Quitar del roster",
    removeConfirm: "Toca de nuevo para confirmar",
    removedOk: "Quitado del roster.",

    /* ── Contrato de representación (solo lectura — sin escritura hasta el visto legal) ── */
    repTitle: "Contrato de representación",
    repNone: "Aún no hay contrato.",
    repCommission: "Comisión",
    repStarts: "Inicia",
    repEnds: "Termina",
    repStatus_proposed: "Propuesto", repStatus_active: "Activo",
    repStatus_ended: "Terminado", repStatus_revoked: "Revocado",
    repNote: "No se mueve dinero al firmar. Cuando los negocios se pagan por OneJob, el único pago del contratante paga al profesional y al agente.",

    /* ── Calendario ── */
    calTitle: "Calendario",
    noUpcoming: "Aún no hay fechas próximas. Los negocios con fecha de inicio aparecen aquí.",

    /* ── Alertas ── */
    alertsTitle: "Notificaciones",
    noAlerts: "Aún no hay notificaciones.",

    /* ── Perfil ── */
    tileRoster: "Roster", tileDeals: "Negocios", tileScout: "Buscar",
    statRoster: "Roster", statClosed: "Negocios cerrados", statReviews: "Reseñas",
    nextUp: "Próximos",
    openCalendar: "Abrir calendario",
  },
} as const;

export type AgentKey = keyof typeof dict.en;

/** Derives from the shell's picker; supplies only the OneAgent dictionary. */
export function useT() {
  const { lang: shellLang } = useShellI18n();
  const lang: "en" | "es" = shellLang === "es" || shellLang === "co" ? "es" : "en";
  const t = (k: AgentKey) => (dict[lang] as Record<AgentKey, string>)[k] ?? dict.en[k];
  return { lang, t };
}

/** Locale for Date formatting, following the same mapping. */
export const dateLocale = (lang: "en" | "es") => (lang === "es" ? "es" : "en");

/* Shared input styling — kept here (not a product .css file) so OneAgent leans only on the
   shell's tokens.css and never on a sibling product's stylesheet being in the bundle. */
export const INPUT =
  "w-full rounded-xl border border-ink/25 bg-ink/[0.025] px-4 py-3 text-sm outline-none " +
  "focus:ring-2 focus:ring-brand/40 focus:border-brand/50 dark:bg-white/5 dark:border-white/20 " +
  "placeholder:text-ink/30 dark:placeholder:text-white/25";
export const LABEL = "block text-[13px] font-medium mb-1.5 opacity-70";
