import type { Lang } from "./i18n";

/**
 * THE SIGN-UP WIZARD'S OWN WORDS, IN ALL SEVEN LANGUAGES.
 * ============================================================================================
 * ── Why this is not in `shellDict.ts` ────────────────────────────────────────────────────────
 * `SHELL_STRINGS` in `config.ts` is a CONTRACT: `assertConfig` requires every product to carry
 * every string in it, for every language that product offers. Adding thirty wizard keys to that
 * list would therefore throw at startup in all eight products until all eight configs were
 * edited — a very wide blast radius to open while three other lanes are frozen for independent
 * verification.
 *
 * The wizard is shell-owned, not product-owned. No product varies a word of it, and no product
 * supplies one. So its dictionary lives here, complete and self-contained, and the contract in
 * `config.ts` is left alone. `tests/shell.signup-wizard.cjs` asserts every language carries
 * every key — the same guarantee `assertConfig` gives, enforced at the same moment (build), just
 * without dragging eight product configs through a freeze.
 *
 * ── Register ─────────────────────────────────────────────────────────────────────────────────
 * `co` uses *usted*, `es` uses *tú*. That is not a style preference: Colombia is the larger
 * market and this is a platform people are PAID through — the usted/tú choice is the difference
 * between reading as a friend and reading as a business. Same rule as `shellDict.ts`.
 *
 * German, Russian and Chinese are carried because the shell offers those flags. They have not
 * been reviewed by a native speaker; the Spanish and Portuguese have. Flagged rather than
 * quietly shipped.
 */

export const WIZARD_KEYS = [
  "createTitle", "createSub",
  "emailLabel", "emailPlaceholder",
  "emailCodeTitle", "emailCodeSub", "resend", "resendIn",
  "phoneTitle", "phoneSub", "phoneLabel", "phonePlaceholder",
  "smsCodeTitle", "smsCodeSub",
  "nameTitle", "nameSub", "firstName", "lastName",
  "professionTitle", "professionSub", "professionLabel", "professionPlaceholder",
  "passwordTitle", "passwordSub", "password", "confirmPassword",
  "pwTooShort", "pwMismatch", "pwStrengthWeak", "pwStrengthOk", "pwStrengthStrong",
  "locationTitle", "locationSub", "locationLabel", "locationPlaceholder",
  "continue", "back", "finish", "skip", "startOver", "startOverHelp",
  "termsPre", "termsLink", "termsAnd", "privacyLink", "termsPost",
  "resumeTitle", "resumeSub",
] as const;

export type WizardKey = (typeof WIZARD_KEYS)[number];
type Row = Record<WizardKey, string>;

const EN: Row = {
  createTitle: "Create your One ID",
  createSub: "One account. Every One World product.",
  emailLabel: "Email", emailPlaceholder: "you@email.com",
  emailCodeTitle: "Check your email",
  emailCodeSub: "We sent a 6-digit code to",
  resend: "Send it again", resendIn: "Send it again in",
  phoneTitle: "Your phone number",
  phoneSub: "We text you when someone hires you, pays you, or shows up. It also keeps bots out.",
  phoneLabel: "Mobile number", phonePlaceholder: "300 000 0000",
  smsCodeTitle: "Check your messages",
  smsCodeSub: "We sent a 6-digit code to",
  nameTitle: "What should we call you?",
  nameSub: "This is the name people see when you work with them.",
  firstName: "First name", lastName: "Last name",
  professionTitle: "What do you do?",
  professionSub: "Your profession helps people understand how to work with you.",
  professionLabel: "Profession", professionPlaceholder: "Photographer, attorney, coach…",
  passwordTitle: "Set a password",
  passwordSub: "So you can get back in without waiting for a code.",
  password: "Password", confirmPassword: "Confirm password",
  pwTooShort: "Use at least 8 characters.",
  pwMismatch: "Those two do not match.",
  pwStrengthWeak: "Weak", pwStrengthOk: "Good", pwStrengthStrong: "Strong",
  locationTitle: "Your Location",
  locationSub: "So we can show you work near you. City is enough.",
  locationLabel: "City", locationPlaceholder: "Medellín, Colombia",
  continue: "Continue", back: "Back", finish: "Finish", skip: "Not now",
  startOver: "Return to sign in",
  startOverHelp: "Signs out only on this device. Your account and saved setup progress stay safe.",
  termsPre: "By finishing, you agree to our ", termsLink: "Terms",
  termsAnd: " and ", privacyLink: "Privacy Policy", termsPost: ".",
  resumeTitle: "Let's finish setting up",
  resumeSub: "You're signed in. A few things left.",
};

const CO: Row = {
  createTitle: "Cree su One ID",
  createSub: "Una cuenta. Todos los productos de One World.",
  emailLabel: "Correo", emailPlaceholder: "usted@correo.com",
  emailCodeTitle: "Revise su correo",
  emailCodeSub: "Enviamos un código de 6 dígitos a",
  resend: "Enviar de nuevo", resendIn: "Enviar de nuevo en",
  phoneTitle: "Su número de celular",
  phoneSub: "Le escribimos cuando alguien lo contrata, le paga o llega. También mantiene fuera a los bots.",
  phoneLabel: "Número de celular", phonePlaceholder: "300 000 0000",
  smsCodeTitle: "Revise sus mensajes",
  smsCodeSub: "Enviamos un código de 6 dígitos a",
  nameTitle: "¿Cómo lo llamamos?",
  nameSub: "Este es el nombre que ven las personas con las que trabaja.",
  firstName: "Nombre", lastName: "Apellido",
  professionTitle: "¿A qué se dedica?",
  professionSub: "Su profesión ayuda a las personas a entender cómo trabajar con usted.",
  professionLabel: "Profesión", professionPlaceholder: "Fotógrafo, abogado, coach…",
  passwordTitle: "Cree una contraseña",
  passwordSub: "Para volver a entrar sin esperar un código.",
  password: "Contraseña", confirmPassword: "Confirme la contraseña",
  pwTooShort: "Use al menos 8 caracteres.",
  pwMismatch: "Las dos no coinciden.",
  pwStrengthWeak: "Débil", pwStrengthOk: "Buena", pwStrengthStrong: "Fuerte",
  locationTitle: "Su ubicación",
  locationSub: "Para mostrarle trabajo cerca. Con la ciudad basta.",
  locationLabel: "Ciudad", locationPlaceholder: "Medellín, Colombia",
  continue: "Continuar", back: "Atrás", finish: "Finalizar", skip: "Ahora no",
  startOver: "Volver al inicio de sesión",
  startOverHelp: "Cierra la sesión solo en este dispositivo. Su cuenta y el progreso guardado permanecen seguros.",
  termsPre: "Al finalizar, acepta nuestros ", termsLink: "Términos",
  termsAnd: " y la ", privacyLink: "Política de Privacidad", termsPost: ".",
  resumeTitle: "Terminemos de configurar",
  resumeSub: "Ya inició sesión. Faltan unas cosas.",
};

const ES: Row = {
  createTitle: "Crea tu One ID",
  createSub: "Una cuenta. Todos los productos de One World.",
  emailLabel: "Correo electrónico", emailPlaceholder: "tu@correo.com",
  emailCodeTitle: "Revisa tu correo",
  emailCodeSub: "Enviamos un código de 6 dígitos a",
  resend: "Enviar de nuevo", resendIn: "Enviar de nuevo en",
  phoneTitle: "Tu número de móvil",
  phoneSub: "Te escribimos cuando alguien te contrata, te paga o llega. También mantiene fuera a los bots.",
  phoneLabel: "Número de móvil", phonePlaceholder: "600 00 00 00",
  smsCodeTitle: "Revisa tus mensajes",
  smsCodeSub: "Enviamos un código de 6 dígitos a",
  nameTitle: "¿Cómo te llamamos?",
  nameSub: "Este es el nombre que ven las personas con las que trabajas.",
  firstName: "Nombre", lastName: "Apellidos",
  professionTitle: "¿A qué te dedicas?",
  professionSub: "Tu profesión ayuda a las personas a entender cómo trabajar contigo.",
  professionLabel: "Profesión", professionPlaceholder: "Fotógrafo, abogado, coach…",
  passwordTitle: "Crea una contraseña",
  passwordSub: "Para volver a entrar sin esperar un código.",
  password: "Contraseña", confirmPassword: "Confirma la contraseña",
  pwTooShort: "Usa al menos 8 caracteres.",
  pwMismatch: "Las dos no coinciden.",
  pwStrengthWeak: "Débil", pwStrengthOk: "Buena", pwStrengthStrong: "Fuerte",
  locationTitle: "Tu ubicación",
  locationSub: "Para mostrarte trabajo cerca. Con la ciudad basta.",
  locationLabel: "Ciudad", locationPlaceholder: "Madrid, España",
  continue: "Continuar", back: "Atrás", finish: "Finalizar", skip: "Ahora no",
  startOver: "Volver al inicio de sesión",
  startOverHelp: "Cierra la sesión solo en este dispositivo. Tu cuenta y el progreso guardado permanecen seguros.",
  termsPre: "Al finalizar, aceptas nuestros ", termsLink: "Términos",
  termsAnd: " y la ", privacyLink: "Política de Privacidad", termsPost: ".",
  resumeTitle: "Terminemos de configurar",
  resumeSub: "Ya has iniciado sesión. Faltan unas cosas.",
};

const DE: Row = {
  createTitle: "Erstelle deine One ID",
  createSub: "Ein Konto. Alle One-World-Produkte.",
  emailLabel: "E-Mail", emailPlaceholder: "du@email.de",
  emailCodeTitle: "Sieh in deiner E-Mail nach",
  emailCodeSub: "Wir haben einen 6-stelligen Code gesendet an",
  resend: "Erneut senden", resendIn: "Erneut senden in",
  phoneTitle: "Deine Handynummer",
  phoneSub: "Wir schreiben dir, wenn dich jemand bucht, bezahlt oder ankommt. Hält außerdem Bots fern.",
  phoneLabel: "Handynummer", phonePlaceholder: "151 00000000",
  smsCodeTitle: "Sieh in deinen Nachrichten nach",
  smsCodeSub: "Wir haben einen 6-stelligen Code gesendet an",
  nameTitle: "Wie sollen wir dich nennen?",
  nameSub: "Diesen Namen sehen die Menschen, mit denen du arbeitest.",
  firstName: "Vorname", lastName: "Nachname",
  professionTitle: "Was machst du beruflich?",
  professionSub: "Dein Beruf hilft anderen zu verstehen, wie sie mit dir arbeiten können.",
  professionLabel: "Beruf", professionPlaceholder: "Fotograf, Anwältin, Coach…",
  passwordTitle: "Passwort festlegen",
  passwordSub: "Damit du ohne Code wieder hineinkommst.",
  password: "Passwort", confirmPassword: "Passwort bestätigen",
  pwTooShort: "Mindestens 8 Zeichen.",
  pwMismatch: "Die beiden stimmen nicht überein.",
  pwStrengthWeak: "Schwach", pwStrengthOk: "Gut", pwStrengthStrong: "Stark",
  locationTitle: "Dein Standort",
  locationSub: "Damit wir dir Arbeit in deiner Nähe zeigen. Die Stadt genügt.",
  locationLabel: "Stadt", locationPlaceholder: "Berlin, Deutschland",
  continue: "Weiter", back: "Zurück", finish: "Fertig", skip: "Jetzt nicht",
  startOver: "Zur Anmeldung zurückkehren",
  startOverHelp: "Meldet dich nur auf diesem Gerät ab. Dein Konto und dein gespeicherter Einrichtungsfortschritt bleiben erhalten.",
  termsPre: "Mit dem Abschluss akzeptierst du unsere ", termsLink: "AGB",
  termsAnd: " und die ", privacyLink: "Datenschutzerklärung", termsPost: ".",
  resumeTitle: "Lass uns fertig einrichten",
  resumeSub: "Du bist angemeldet. Es fehlen noch ein paar Dinge.",
};

const RU: Row = {
  createTitle: "Создайте One ID",
  createSub: "Один аккаунт. Все продукты One World.",
  emailLabel: "Почта", emailPlaceholder: "vy@pochta.ru",
  emailCodeTitle: "Проверьте почту",
  emailCodeSub: "Мы отправили 6-значный код на",
  resend: "Отправить снова", resendIn: "Отправить снова через",
  phoneTitle: "Ваш номер телефона",
  phoneSub: "Мы напишем, когда вас наняли, оплатили или к вам пришли. И это отсекает ботов.",
  phoneLabel: "Мобильный номер", phonePlaceholder: "900 000 00 00",
  smsCodeTitle: "Проверьте сообщения",
  smsCodeSub: "Мы отправили 6-значный код на",
  nameTitle: "Как к вам обращаться?",
  nameSub: "Это имя видят люди, с которыми вы работаете.",
  firstName: "Имя", lastName: "Фамилия",
  professionTitle: "Чем вы занимаетесь?",
  professionSub: "Профессия помогает людям понять, как с вами работать.",
  professionLabel: "Профессия", professionPlaceholder: "Фотограф, юрист, коуч…",
  passwordTitle: "Задайте пароль",
  passwordSub: "Чтобы входить, не дожидаясь кода.",
  password: "Пароль", confirmPassword: "Повторите пароль",
  pwTooShort: "Не менее 8 символов.",
  pwMismatch: "Пароли не совпадают.",
  pwStrengthWeak: "Слабый", pwStrengthOk: "Хороший", pwStrengthStrong: "Надёжный",
  locationTitle: "Ваше местоположение",
  locationSub: "Чтобы показывать работу рядом. Достаточно города.",
  locationLabel: "Город", locationPlaceholder: "Москва, Россия",
  continue: "Продолжить", back: "Назад", finish: "Готово", skip: "Не сейчас",
  startOver: "Вернуться ко входу",
  startOverHelp: "Вы выйдете только на этом устройстве. Аккаунт и сохранённый прогресс настройки останутся в безопасности.",
  termsPre: "Завершая, вы принимаете наши ", termsLink: "Условия",
  termsAnd: " и ", privacyLink: "Политику конфиденциальности", termsPost: ".",
  resumeTitle: "Давайте закончим настройку",
  resumeSub: "Вы вошли. Осталось немного.",
};

const ZH: Row = {
  createTitle: "创建您的 One ID",
  createSub: "一个账号，畅通所有 One World 产品。",
  emailLabel: "邮箱", emailPlaceholder: "you@email.com",
  emailCodeTitle: "请查收邮箱",
  emailCodeSub: "我们已将 6 位验证码发送至",
  resend: "重新发送", resendIn: "重新发送，还需",
  phoneTitle: "您的手机号",
  phoneSub: "有人雇用您、向您付款或到场时，我们会发短信通知。同时也能挡住机器人。",
  phoneLabel: "手机号码", phonePlaceholder: "+86 138 0000 0000",
  smsCodeTitle: "请查收短信",
  smsCodeSub: "我们已将 6 位验证码发送至",
  nameTitle: "怎么称呼您？",
  nameSub: "与您合作的人会看到这个名字。",
  firstName: "名", lastName: "姓",
  professionTitle: "您的职业是什么？",
  professionSub: "职业信息能帮助他人了解如何与您合作。",
  professionLabel: "职业", professionPlaceholder: "摄影师、律师、教练…",
  passwordTitle: "设置密码",
  passwordSub: "下次无需等待验证码即可登录。",
  password: "密码", confirmPassword: "确认密码",
  pwTooShort: "至少 8 个字符。",
  pwMismatch: "两次输入不一致。",
  pwStrengthWeak: "较弱", pwStrengthOk: "良好", pwStrengthStrong: "很强",
  locationTitle: "您在哪里？",
  locationSub: "以便向您推荐附近的工作。填城市即可。",
  locationLabel: "城市", locationPlaceholder: "北京，中国",
  continue: "继续", back: "返回", finish: "完成", skip: "暂不",
  startOver: "返回登录页",
  startOverHelp: "只会退出此设备。您的账号和已保存的设置进度都会保留。",
  termsPre: "完成即表示您同意我们的", termsLink: "服务条款",
  termsAnd: "与", privacyLink: "隐私政策", termsPost: "。",
  resumeTitle: "我们来完成设置",
  resumeSub: "您已登录，还差几步。",
};

const PT: Row = {
  createTitle: "Crie o seu One ID",
  createSub: "Uma conta. Todos os produtos One World.",
  emailLabel: "E-mail", emailPlaceholder: "voce@email.com",
  emailCodeTitle: "Confira seu e-mail",
  emailCodeSub: "Enviamos um código de 6 dígitos para",
  resend: "Enviar de novo", resendIn: "Enviar de novo em",
  phoneTitle: "Seu número de celular",
  phoneSub: "A gente te avisa por mensagem quando alguém te contrata, te paga ou chega. E ainda barra robôs.",
  phoneLabel: "Número de celular", phonePlaceholder: "+55 11 90000-0000",
  smsCodeTitle: "Confira suas mensagens",
  smsCodeSub: "Enviamos um código de 6 dígitos para",
  nameTitle: "Como podemos te chamar?",
  nameSub: "É o nome que as pessoas veem quando trabalham com você.",
  firstName: "Nome", lastName: "Sobrenome",
  professionTitle: "Qual é a sua profissão?",
  professionSub: "Sua profissão ajuda as pessoas a entender como trabalhar com você.",
  professionLabel: "Profissão", professionPlaceholder: "Fotógrafo, advogado, coach…",
  passwordTitle: "Defina uma senha",
  passwordSub: "Para entrar de novo sem esperar um código.",
  password: "Senha", confirmPassword: "Confirme a senha",
  pwTooShort: "Use pelo menos 8 caracteres.",
  pwMismatch: "As duas não conferem.",
  pwStrengthWeak: "Fraca", pwStrengthOk: "Boa", pwStrengthStrong: "Forte",
  locationTitle: "Onde você está?",
  locationSub: "Para mostrar trabalho perto de você. A cidade já basta.",
  locationLabel: "Cidade", locationPlaceholder: "São Paulo, Brasil",
  continue: "Continuar", back: "Voltar", finish: "Concluir", skip: "Agora não",
  startOver: "Voltar ao login",
  startOverHelp: "Sai da conta somente neste dispositivo. Sua conta e o progresso salvo da configuração permanecem seguros.",
  termsPre: "Ao concluir, você aceita nossos ", termsLink: "Termos",
  termsAnd: " e a ", privacyLink: "Política de Privacidade", termsPost: ".",
  resumeTitle: "Vamos terminar a configuração",
  resumeSub: "Você já está conectado. Faltam algumas coisas.",
};

export const WIZARD_DICT: Record<Lang, Row> = {
  en: EN, co: CO, es: ES, de: DE, ru: RU, zh: ZH, pt: PT,
};

/** Falls back to English rather than rendering a raw key. A missing word is a rough edge; a
 *  visible `wizard.phoneTitle` on a sign-up screen reads as the product being broken. */
export function wsay(lang: Lang, key: WizardKey): string {
  return WIZARD_DICT[lang]?.[key] ?? EN[key];
}
