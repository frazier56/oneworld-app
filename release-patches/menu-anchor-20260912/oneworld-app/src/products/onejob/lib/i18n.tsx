/**
 * ONEJOB'S PRODUCT DICTIONARY — the app's own words, on the SHELL's language.
 * ============================================================================================
 * The 5 Aug OneJob build carried its own <I18nProvider>, its own `ONE_WORLD_LANGS` and its own
 * `os-lang` localStorage key. All three are SHELL now: one language choice, shared across the
 * whole family, set from the one flag picker in the shared header. A second provider here would
 * mean tapping the flag changed the chrome and left every OneJob screen in English — which is
 * the half-translated-screen defect, not a rough edge.
 *
 * So this file keeps ONLY the dictionary and the hook's SHAPE. `t()` reads the shell's current
 * language; `setLang` is the shell's setter. Ported screens keep calling `useI18n()` from here
 * and are none the wiser.
 */
import { useI18n as useShellI18n, W as shellW, type Lang } from "@oneworld/shell";


const base = {
  en: {
    tagline: "Secure your work|with contracts and payment held to completion",
    sub: "The simplest way for freelancers and small businesses to get paid, get reviewed, and build real credibility.",
    signin: "Sign in", join: "Join free", signout: "Sign out",
    continueGoogle: "Continue with Google", continueEmail: "Continue with email",
    emailPlaceholder: "you@example.com", sendCode: "Send code", enterCode: "Enter the 6-digit code",
    verify: "Verify", codeSent: "We emailed you a code.",
    home: "Home", jobs: "Jobs", qrpay: "Get paid", messages: "Messages", profile: "Profile", calendar: "Calendar",
    hi: "Hi", completeProfile: "Complete your profile", getBooked: "Get booked", yourScore: "Your OneScore",
    findWork: "Find work", getDiscovered: "Get discovered", search: "Search jobs…", apply: "View & apply",
    noJobs: "No open jobs match yet. Check back soon.",
    showQR: "Your payment QR", qrHint: "Anyone can scan this to hire and pay you — the payment stays in the Vault until you both mark the job complete.",
    share: "Share link", payoutSetup: "Set up payouts", payoutReady: "Payouts ready",
    payoutHint: "Connect your bank once to receive money.",
    howWorks: "How it works", step1: "They scan your QR", step2: "They describe the job & pay — money goes to the Vault", step3: "Both mark complete — you get paid",
    myJobs: "My jobs", pastJobs: "Past jobs", pendingReview: "Leave your review", revReceived: "Received", revGiven: "Given",
    noNotifs: "No notifications yet.", aiOrganize: "Organize with AI",
    bioSpeakHint: "Type — or tap the mic and just talk. Then let AI organize it.",
    tipQr: "This QR is how people Quick-Hire you. Show it, share it, print it — anyone who scans can hire and pay you in about a minute.",
    tipDiscovered: "Turn this on to appear in the Hire search. Your QR (Get paid tab) also lets anyone hire you directly.",
    badgeTier: "Badge tier",
    followers: "Followers", likes: "Likes", posts: "Posts", all: "All",
    mediaWall: "My work", addMedia: "Add photos/videos", mediaEmpty: "Show off your work — add photos or videos.",
    connectedPlatforms: "Connected platforms", passport: "Reputation Passport", platforms: "Platforms",
    viewPassport: "View full passport", sendContract: "Send a contract", photosVideos: "Photos & videos",
    camera: "Camera", document: "Document",
    attachJob: "Attach one of your posted jobs (optional)", attachJobNone: "No — write it fresh",
    yourJobs: "Your jobs", newContract: "New hire request", accept: "Accept", decline: "Decline",
    awaitingAccept: "Waiting for them to accept", activeJob: "Active job", markComplete: "Mark complete",
    secActive: "Active", secPending: "Pending", jobWith: "With", jobWhen: "When", roleHost: "Host", rolePro: "Professional", youEarn: "You earn", youPay: "You pay", earned: "Earned", paid: "Paid", statusAwaitingYou: "Awaiting your response", statusAwaitingThem: "Awaiting their acceptance", tapPlatformHint: "Tap a platform to see its metrics",
    waitingOther: "Done on your side — waiting for the other party", otherMarked: "They marked it complete — your turn!",
    heldNote: "Payment is already in the OneJob Vault.",
    reviewTitle: "Leave a review", reviewComment: "Private comment (optional)", reviewSubmit: "Submit review",
    reviewRateAll: "Rate all 7 categories to submit", reviewDupe: "You already reviewed this job.", later: "Later",
    fixFields: "Please fill the highlighted fields.",
    findPros: "Hire", searchPros: "Photographer, caterer, DJ…", noPros: "No professionals match yet.",
    showMore: "Show more", showLess: "Show less", locationLabel: "Location",
    linkScoreTitle: "Link your OneScore", 
    linkScoreBody: "OneScore is your portable credibility score — it lives in the OneScore app and updates as you complete jobs and get reviews here. Linking shows it on your profile so hirers can trust you at a glance.",
    linkScoreHave: "I have a OneScore — link it", linkScoreCreate: "Create my free OneScore",
    linkScoreNote: "You can unlink anytime in Profile → Your One World apps.",
    appearance: "Appearance", privacy: "Privacy", notifications: "Notifications",
    publicProfile: "Public profile", publicProfileHint: "Anyone can view your profile page",
    showInHire: "Show me in Hire", showInHireHint: "Appear in search when people look to hire",
    readReceipts: "Read receipts", readReceiptsHint: "Others see when you've read messages",
    emailUpdates: "Email updates", emailUpdatesHint: "Tips and reminders to grow your profile",
    vaiaShow: "VAIA assistant", vaiaShowHint: "Show the VAIA helper button in the app",
    dangerZone: "Danger zone", deleteAccount: "Delete my account",
    vaiaTag: "Your AI career assistant", vaiaHint: "Ask me anything — improving your profile, getting more jobs, how payments work…",
    vaiaAsk: "Ask VAIA…", vaiaErr: "Hmm, I couldn't reach VAIA just now. Try again in a moment.",
    tapInsights: "Tap for insights", vaiaSubtitle: "Your AI assistant",
    vaiaIntro: "Hi! I'm VAIA. Ask me anything about your jobs — getting hired, contracts, payments, your OneScore, and more.",
    vaiaChip1: "Help me plan a job", vaiaChip2: "How do I get hired?", vaiaChip3: "How can I raise my OneScore?",
    vaiaThinking: "Thinking…", vaiaTapTalk: "Tap to talk — or the keyboard icon to type",
    settings: "Settings", language: "Language", theme: "Theme", account: "Account",
    viewPublic: "View my public profile", linkScoreCta: "Link your OneScore",
    sortNewest: "Newest first", sortOldest: "Oldest first", sortPay: "Highest pay", sortNear: "Near me",
    locFilter: "Location", requirements: "Requirements",
    coverNote: "Add a short note (optional)", appliedOk: "Application sent",
    hireTitle: "Hire", jobWhat: "What do you need done?", from: "From", to: "To",
    price: "Price", payNow: "Review & pay", feeNote: "+ {fee} service fee · held in the Vault until the job is done",
    holdNote: "Your payment is held by OneJob and only released when you both mark the job complete.",
    paidTitle: "Payment held ✓", paidBody: "You're set. We'll notify you to mark the job complete when it's done.",
    sendMsg: "Message…", noMsgs: "No conversations yet.",
    msgSearch: "Search messages…", noMsgsFilter: "No conversations match.",
    message: "Message", connect: "Connect", connected: "Connected", requested: "Requested", ignore: "Ignore",
    connectionsLabel: "connections", mutualLabel: "mutual",
    connectionRequests: "Connection requests", wantsToConnect: "Wants to connect", view: "View",
    andNOthers: "and {n} other mutual connections", mutualConnections: "mutual connection",
    shareProfile: "Share profile", linkCopied: "Link copied",
    availableForWork: "I'm available for work — here's my OneJob profile, verified reviews and OneScore.",
    fAll: "All", fPros: "Professionals", fClients: "Clients", fConnections: "Connections", fOutNet: "Out of network",
    upcoming: "Upcoming", noEvents: "Nothing scheduled.",
    editProfile: "Edit profile", name: "Name", title: "What you do", bio: "Bio", save: "Save", saved: "Saved ✓",
    linkApps: "Show on my public profile", linkWorld: "Show my World", linkScore: "Show my OneScore", linkEvents: "Show my OneEvent events", linkPassport: "Show my Reputation Passport",
    showScoreLbl: "Show my score", showWorldLbl: "Show my World", showPassportLbl: "Show my passport", showEventsLbl: "Show my events",
    becomePro: "Start getting hired", becomeProHint: "Add what you do and turn on your profile to appear in search.",
    reviews: "Reviews", jobsDone: "Jobs completed", hiredCount: "Hires made", memberSince: "Member since",
    startPost: "Share your work or ask for help…", video: "Video", photo: "Photo", write: "Write", goLive: "Go Live", soon: "Soon",
    newPost: "New post", postPlaceholder: "Show off your work, share an update…",
    hiringPlaceholder: "e.g. Need a photographer this Saturday in Roswell, $200…",
    imHiring: "I'm hiring — post as a job", hiringHint: "This posts a real job — professionals can apply and you can hire them right here.",
    post: "Post", postJob: "Post job", postsPill: "Posts", nearMe: "Near me",
    nearNeedsCity: "Add your city in Profile to see what's near you.",
    feedEmpty: "Nothing here yet — be the first to post!",
    sharedWork: "shared {n} portfolio posts", sharedWork1: "shared 1 portfolio post", viewProfile: "View profile", hiringChip: "Hiring",
    payoutStripeNote: "To receive money, you'll be taken to Stripe (a third-party payment processor) to securely connect your bank. This is required before anyone can pay you.",
    payoutConnectCta: "Connect my bank with Stripe", payoutRedirecting: "Opening Stripe…",
    payoutWait: "Please wait — you'll be redirected to Stripe in a few moments.",
    payoutErr: "Couldn't reach Stripe just now. Tap to try again.",
    payoutReadyNote: "When someone pays you, the money goes straight to your bank after you both mark the job complete.",
    captionPlaceholder: "Write a description… (optional)", maxPerPost: "max 20 per post",
    today: "Today", tomorrow: "Tomorrow", startsAt: "Starts at", customTime: "Custom", seeMyEvents: "See my events on OneEvent",
    pickDate: "Pick a date", pickTime: "Pick a time", listen: "Listen",
    payDirectTitle: "Other ways to pay", payDirectHint: "Pay {name} directly — OneJob doesn't hold or guarantee direct payments, but your job, reviews, and scores still count.",
    iPaidDirect: "I've paid — create the contract", payoutLinks: "Direct payment links", payoutLinksHint: "Let clients without an international card pay you via PayPal or Wise. Paste your links — they appear on your hire page.",
    paypalHandle: "PayPal.Me username", wiseLink: "Wise payment link", currencyLabel: "Currency", reviewScore: "Review score", sharePassport: "Share my passport",
    plansTitle: "Pricing & Plans", plansSub: "Simple plans. Cancel anytime — manage everything yourself.",
    plan_basic: "Basic", plan_basic_desc: "Everything you need to get hired and get paid.",
    plan_pro: "Pro", plan_pro_desc: "Priority placement in search and the Hire directory, plus profile boosts.",
    plan_vip: "Elite", plan_vip_desc: "Top placement, maximum visibility, and premium support.",
    currentPlan: "Current plan", freeForever: "Free forever", perMonth: "mo",
    billedAs: "billed {amt} every {n} months", upgradeCta: "Upgrade",
    manageBilling: "Manage billing", aiAddonsDesc: "AI agents that find work and pitch clients for you — launching soon.",
    valueEyebrow: "Small business · Freelance · Side hustle",
    valueTitle: "Everything you need to be taken seriously.",
    valueSub: "Got a side gig you're trying to grow? This is where you get seen, prove you're credible, and get paid — all in one place.",
    pillar1T: "Get paid without chasing anyone", pillar1B: "No more half up front and hoping they pay the rest. Your client pays before you start — the money sits in the OneJob Vault and is released the moment you both mark the job complete.",
    pillar2T: "Contracts built in", pillar2B: "No job starts without it in writing. Who, what, when and where — one small page, agreed before you lift a finger.",
    pillar3T: "Get reviewed where you were hired", pillar3B: "Be found, get paid, get reviewed — all three in one place, for the first time.",
    cropTitle: "Adjust your photo", cropHint: "Drag to position · slide or pinch to zoom", cropSave: "Use photo",
    tipProsScore: "Everyone here shows a real OneScore — credibility you can trust before you hire.",
    tipCredScore: "This is your OneScore — it shows anyone, at a glance, that you're credible. Complete jobs and collect reviews to raise it.",
    tipReviewsValue: "Every review builds your credibility. The more you collect, the more clients trust you — and the higher your OneScore climbs.",
    tipGetPaidValue: "Get paid one professional way. Clients pay through your QR or hire page, the money is held safe, and your payout is released once the job's done — no chasing five payment apps.",
      reviewContract: "Review contract",
    jobWhatPlaceholder: "Describe the work — what needs doing and anything you expect. Skip the date, time and price; they have their own fields below.",
    speakWithAi: "Speak with AI",
    badgePro: "Professional",
  },
  es: {
    tagline: "Protege tu trabajo|con contratos y pago retenido hasta terminar",
    sub: "La forma más simple para freelancers y pequeños negocios de cobrar, recibir reseñas y construir credibilidad real.",
    signin: "Iniciar sesión", join: "Únete gratis", signout: "Cerrar sesión",
    continueGoogle: "Continuar con Google", continueEmail: "Continuar con email",
    emailPlaceholder: "tu@ejemplo.com", sendCode: "Enviar código", enterCode: "Ingresa el código de 6 dígitos",
    verify: "Verificar", codeSent: "Te enviamos un código por email.",
    home: "Inicio", jobs: "Trabajos", qrpay: "Cobrar", messages: "Mensajes", profile: "Perfil", calendar: "Calendario",
    hi: "Hola", completeProfile: "Completa tu perfil", getBooked: "Recibe reservas", yourScore: "Tu OneScore",
    findWork: "Buscar trabajo", getDiscovered: "Hazte visible", search: "Buscar trabajos…", apply: "Ver y aplicar",
    noJobs: "No hay trabajos abiertos todavía. Vuelve pronto.",
    showQR: "Tu QR de pago", qrHint: "Cualquiera puede escanearlo para contratarte y pagarte — el pago queda en la Bóveda hasta que ambos marquen el trabajo completo.",
    share: "Compartir enlace", payoutSetup: "Configurar cobros", payoutReady: "Cobros listos",
    payoutHint: "Conecta tu banco una vez para recibir dinero.",
    howWorks: "Cómo funciona", step1: "Escanean tu QR", step2: "Describen el trabajo y pagan — el dinero queda retenido", step3: "Ambos marcan completo — te pagan",
    myJobs: "Mis trabajos", pastJobs: "Trabajos pasados", pendingReview: "Deja tu reseña", revReceived: "Recibidas", revGiven: "Dadas",
    noNotifs: "Aún no hay notificaciones.", aiOrganize: "Organizar con IA",
    bioSpeakHint: "Escribe — o toca el micrófono y habla. Luego deja que la IA lo organice.",
    tipQr: "Este QR es cómo te contratan al instante. Muéstralo, compártelo — quien lo escanee puede contratarte y pagarte en un minuto.",
    tipDiscovered: "Actívalo para aparecer en la búsqueda de Contratar. Tu QR (pestaña Cobrar) también permite que te contraten directo.",
    badgeTier: "Nivel de insignia",
    followers: "Seguidores", likes: "Me gusta", posts: "Publicaciones", all: "Todo",
    mediaWall: "Mi trabajo", addMedia: "Agregar fotos/videos", mediaEmpty: "Muestra tu trabajo — agrega fotos o videos.",
    connectedPlatforms: "Plataformas conectadas", passport: "Pasaporte de Reputación", platforms: "Plataformas",
    viewPassport: "Ver pasaporte completo", sendContract: "Enviar contrato", photosVideos: "Fotos y videos",
    camera: "Cámara", document: "Documento",
    attachJob: "Adjunta uno de tus trabajos publicados (opcional)", attachJobNone: "No — escribirlo nuevo",
    yourJobs: "Tus trabajos", newContract: "Nueva solicitud de contratación", accept: "Aceptar", decline: "Rechazar",
    awaitingAccept: "Esperando que acepten", activeJob: "Trabajo activo", markComplete: "Marcar completo",
    secActive: "Activos", secPending: "Pendientes", jobWith: "Con", jobWhen: "Cuándo", roleHost: "Anfitrión", rolePro: "Profesional", youEarn: "Ganas", youPay: "Pagas", earned: "Ganado", paid: "Pagado", statusAwaitingYou: "Esperando tu respuesta", statusAwaitingThem: "Esperando que acepten", tapPlatformHint: "Toca una plataforma para ver sus métricas",
    waitingOther: "Listo de tu lado — esperando a la otra parte", otherMarked: "Ya lo marcaron completo — ¡tu turno!",
    heldNote: "El pago ya está en la Bóveda de OneJob.",
    reviewTitle: "Deja una reseña", reviewComment: "Comentario privado (opcional)", reviewSubmit: "Enviar reseña",
    reviewRateAll: "Califica las 7 categorías para enviar", reviewDupe: "Ya reseñaste este trabajo.", later: "Después",
    fixFields: "Completa los campos marcados.",
    findPros: "Contratar", searchPros: "Fotógrafo, catering, DJ…", noPros: "No hay profesionales aún.",
    showMore: "Ver más", showLess: "Ver menos", locationLabel: "Ubicación",
    linkScoreTitle: "Vincula tu OneScore",
    linkScoreBody: "OneScore es tu puntaje de credibilidad portátil — vive en la app OneScore y se actualiza cuando completas trabajos y recibes reseñas aquí. Al vincularlo aparece en tu perfil para que te contraten con confianza.",
    linkScoreHave: "Tengo OneScore — vincularlo", linkScoreCreate: "Crear mi OneScore gratis",
    linkScoreNote: "Puedes desvincularlo cuando quieras en Perfil → Tus apps One World.",
    appearance: "Apariencia", privacy: "Privacidad", notifications: "Notificaciones",
    publicProfile: "Perfil público", publicProfileHint: "Cualquiera puede ver tu página de perfil",
    showInHire: "Mostrarme en Contratar pros", showInHireHint: "Aparece en búsquedas de contratación",
    readReceipts: "Confirmaciones de lectura", readReceiptsHint: "Otros ven cuando leíste sus mensajes",
    emailUpdates: "Correos de novedades", emailUpdatesHint: "Consejos y recordatorios para crecer",
    vaiaShow: "Asistente VAIA", vaiaShowHint: "Muestra el botón de ayuda VAIA en la app",
    dangerZone: "Zona de peligro", deleteAccount: "Eliminar mi cuenta",
    vaiaTag: "Tu asistente de carrera IA", vaiaHint: "Pregúntame lo que sea — mejorar tu perfil, conseguir más trabajos, cómo funcionan los pagos…",
    vaiaAsk: "Pregunta a VAIA…", vaiaErr: "No pude conectar con VAIA. Intenta de nuevo en un momento.",
    tapInsights: "Toca para ideas", vaiaSubtitle: "Tu asistente de IA",
    vaiaIntro: "¡Hola! Soy VAIA. Pregúntame lo que sea sobre tus trabajos: cómo te contratan, contratos, pagos, tu OneScore y más.",
    vaiaChip1: "Ayúdame a planear un trabajo", vaiaChip2: "¿Cómo consigo trabajo?", vaiaChip3: "¿Cómo subo mi OneScore?",
    vaiaThinking: "Pensando…", vaiaTapTalk: "Toca para hablar — o el teclado para escribir",
    settings: "Ajustes", language: "Idioma", theme: "Tema", account: "Cuenta",
    viewPublic: "Ver mi perfil público", linkScoreCta: "Vincula tu OneScore",
    sortNewest: "Más recientes", sortOldest: "Más antiguos", sortPay: "Mayor pago", sortNear: "Cerca de mí",
    locFilter: "Ubicación", requirements: "Requisitos",
    coverNote: "Agrega una nota corta (opcional)", appliedOk: "Solicitud enviada",
    hireTitle: "Contratar a", jobWhat: "¿Qué necesitas?", from: "Desde", to: "Hasta",
    price: "Precio", payNow: "Revisar y pagar", feeNote: "+ {fee} tarifa de servicio · retenido hasta terminar el trabajo",
    holdNote: "OneJob retiene tu pago y solo lo libera cuando ambos marcan el trabajo completo.",
    paidTitle: "Pago retenido ✓", paidBody: "Listo. Te avisaremos para marcar el trabajo completo.",
    sendMsg: "Mensaje…", noMsgs: "Aún no hay conversaciones.",
    msgSearch: "Buscar mensajes…", noMsgsFilter: "Ninguna conversación coincide.",
    message: "Mensaje", connect: "Conectar", connected: "Conectado", requested: "Solicitado", ignore: "Ignorar",
    connectionsLabel: "conexiones", mutualLabel: "en común",
    connectionRequests: "Solicitudes de conexión", wantsToConnect: "Quiere conectar", view: "Ver",
    andNOthers: "y {n} conexiones más en común", mutualConnections: "conexión en común",
    shareProfile: "Compartir perfil", linkCopied: "Enlace copiado",
    availableForWork: "Estoy disponible para trabajar — aquí está mi perfil de OneJob, con reseñas verificadas y mi OneScore.",
    fAll: "Todos", fPros: "Profesionales", fClients: "Clientes", fConnections: "Conexiones", fOutNet: "Fuera de red",
    upcoming: "Próximo", noEvents: "Nada agendado.",
    editProfile: "Editar perfil", name: "Nombre", title: "A qué te dedicas", bio: "Bio", save: "Guardar", saved: "Guardado ✓",
    linkApps: "Mostrar en mi perfil público", linkWorld: "Mostrar mi mundo", linkScore: "Mostrar mi OneScore", linkEvents: "Mostrar mis eventos OneEvent", linkPassport: "Mostrar mi Pasaporte",
    showScoreLbl: "Mostrar mi puntaje", showWorldLbl: "Mostrar mi mundo", showPassportLbl: "Mostrar mi pasaporte", showEventsLbl: "Mostrar mis eventos",
    becomePro: "Empieza a recibir trabajos", becomeProHint: "Agrega lo que haces y activa tu perfil para aparecer en búsquedas.",
    reviews: "Reseñas", jobsDone: "Trabajos completados", hiredCount: "Contrataciones", memberSince: "Miembro desde",
    startPost: "Comparte tu trabajo o pide ayuda…", video: "Video", photo: "Foto", write: "Escribir", goLive: "En vivo", soon: "Pronto",
    newPost: "Nueva publicación", postPlaceholder: "Muestra tu trabajo, comparte una novedad…",
    hiringPlaceholder: "ej. Necesito fotógrafo este sábado en Roswell, $200…",
    imHiring: "Estoy contratando — publicar como trabajo", hiringHint: "Esto publica un trabajo real — los profesionales pueden aplicar y puedes contratarlos aquí mismo.",
    post: "Publicar", postJob: "Publicar trabajo", postsPill: "Publicaciones", nearMe: "Cerca de mí",
    nearNeedsCity: "Agrega tu ciudad en Perfil para ver lo que hay cerca.",
    feedEmpty: "Nada por aquí todavía — ¡sé el primero en publicar!",
    sharedWork: "compartió {n} publicaciones de portafolio", sharedWork1: "compartió 1 publicación de portafolio", viewProfile: "Ver perfil", hiringChip: "Contratando",
    payoutStripeNote: "Para recibir dinero, irás a Stripe (un procesador de pagos externo) para conectar tu banco de forma segura. Es obligatorio antes de que alguien pueda pagarte.",
    payoutConnectCta: "Conectar mi banco con Stripe", payoutRedirecting: "Abriendo Stripe…",
    payoutWait: "Espera — serás redirigido a Stripe en unos momentos.",
    payoutErr: "No pudimos conectar con Stripe. Toca para reintentar.",
    payoutReadyNote: "Cuando alguien te pague, el dinero va directo a tu banco después de que ambos marquen el trabajo completo.",
    captionPlaceholder: "Escribe una descripción… (opcional)", maxPerPost: "máx 20 por publicación",
    today: "Hoy", tomorrow: "Mañana", startsAt: "Empieza a las", customTime: "Otro", seeMyEvents: "Ver mis eventos en OneEvent",
    pickDate: "Elige una fecha", pickTime: "Elige una hora", listen: "Escuchar",
    payDirectTitle: "Otras formas de pagar", payDirectHint: "Págale a {name} directamente — OneJob no retiene ni garantiza pagos directos, pero tu trabajo, reseñas y puntajes sí cuentan.",
    iPaidDirect: "Ya pagué — crear el contrato", payoutLinks: "Enlaces de pago directo", payoutLinksHint: "Permite que clientes sin tarjeta internacional te paguen por PayPal o Wise. Pega tus enlaces — aparecen en tu página de contratación.",
    paypalHandle: "Usuario de PayPal.Me", wiseLink: "Enlace de pago de Wise", currencyLabel: "Moneda", reviewScore: "Puntaje de reseñas", sharePassport: "Compartir mi pasaporte",
    plansTitle: "Precios y Planes", plansSub: "Planes simples. Cancela cuando quieras — tú manejas todo.",
    plan_basic: "Básico", plan_basic_desc: "Todo lo que necesitas para conseguir trabajo y cobrar.",
    plan_pro: "Pro", plan_pro_desc: "Prioridad en búsquedas y Contratar pros, más impulsos de perfil.",
    plan_vip: "Elite", plan_vip_desc: "Máxima visibilidad, primeros lugares y soporte premium.",
    currentPlan: "Plan actual", freeForever: "Gratis para siempre", perMonth: "mes",
    billedAs: "se cobra {amt} cada {n} meses", upgradeCta: "Mejorar",
    manageBilling: "Administrar facturación", aiAddonsDesc: "Agentes de IA que buscan trabajo y contactan clientes por ti — muy pronto.",
    valueEyebrow: "Pequeño negocio · Freelance · Trabajo extra",
    valueTitle: "Todo lo que necesitas para que te tomen en serio.",
    valueSub: "¿Tienes un trabajo extra que quieres hacer crecer? Aquí te ven, demuestras que eres confiable y cobras — todo en un solo lugar.",
    pillar1T: "Sin confiar a ciegas — cobra sin perseguir a nadie", pillar1B: "Se acabó cobrar la mitad y cruzar los dedos por el resto. Tu cliente paga antes de empezar — el dinero queda en la Bóveda de OneJob y se libera en cuanto ambos marcan el trabajo completo.",
    pillar2T: "Contratos incluidos", pillar2B: "Ningún trabajo empieza sin algo por escrito. Quién, qué, cuándo y dónde — una página simple, acordada antes de mover un dedo.",
    pillar3T: "Recibe reseñas donde te contrataron", pillar3B: "Que te encuentren, cobrar y recibir reseñas — las tres cosas en un solo lugar, por primera vez.",
    cropTitle: "Ajusta tu foto", cropHint: "Arrastra para posicionar · desliza o pellizca para acercar", cropSave: "Usar foto",
    tipProsScore: "Cada profesional aquí muestra un OneScore real — credibilidad en la que puedes confiar antes de contratar.",
    tipCredScore: "Este es tu OneScore — le muestra a cualquiera, de un vistazo, que eres confiable. Completa trabajos y reúne reseñas para subirlo.",
    tipReviewsValue: "Cada reseña construye tu credibilidad. Mientras más reúnas, más confían los clientes — y más sube tu OneScore.",
    tipGetPaidValue: "Cobra de una forma profesional. Los clientes pagan por tu QR o página de contratación, el dinero queda seguro y tu pago se libera al terminar — sin perseguir cinco apps de pago.",
      reviewContract: "Revisar contrato",
    jobWhatPlaceholder: "Describe el trabajo — qué hay que hacer y lo que esperas. No pongas la fecha, la hora ni el precio; tienen sus propios campos abajo.",
    speakWithAi: "Hablar con la IA",
    badgePro: "Profesional",
  },
} as const;

/**
 * COLOMBIA RIDES SPAIN'S DICTIONARY — for now, and on purpose.
 *
 * The hub (www.oneworldlabs.ai) is the surface that holds the canon, and its language keys
 * are en · co · es · de · ru · zh · pt. Colombia has its OWN key there, not a shared "es".
 * This app had both Colombia and Spain mapped to `es`, which produced a live defect: the
 * picker listed two entries, both set `lang` to "es", and the header flag then resolved to
 * whichever entry came first in the array — so choosing Espana painted a Colombian flag.
 *
 * Aliasing here rather than duplicating 200 strings means the two are identical today and
 * can diverge one key at a time later. Colombian and Peninsular Spanish are not the same
 * Spanish, and the money copy in particular will eventually need to say different things.
 */
const dict = { ...base, co: base.es };


export type JobKey = keyof typeof base.en;

/** The product dictionary, keyed the way the shell keys its own: `co` is Colombian Spanish. */
export const jobDict = dict as Record<string, Record<string, string>>;

/**
 * The ported screens' hook. Same shape as the 5 Aug build's — `{ lang, setLang, t }` — with the
 * language coming from the shell so one flag changes the whole screen, chrome included.
 */
export function useI18n() {
  const { lang, setLang } = useShellI18n();
  const t = (k: JobKey): string =>
    (dict as any)[lang]?.[k] ?? (dict as any).en?.[k] ?? String(k);
  return { lang: lang as Lang, setLang, t };
}

/**
 * Inline bilingual copy, for strings that do NOT belong in the dictionary above — the money
 * surface builds its sentences from live database stamps, so the same slot says four different
 * things depending on where the money actually is. Re-exported from the shell so there is one
 * implementation of the "co is Spanish" rule, not two.
 */
export const W = shellW;
