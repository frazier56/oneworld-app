/**
 * WHAT A MEMBER IS TOLD WHEN SIGN-IN, SIGN-UP OR RESET FAILS — one formatter for all three.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Security, 19 Oct 2026 (P0 auth review, item 3): the three screens printed whatever text the
 * auth server or SDK returned. That text is not ours to vouch for — a provider error can echo a
 * URL, an email address or a token-shaped string — so it must not reach the page unfiltered.
 *
 * Two older lessons are kept, not traded away:
 *   · "Never render an error object" (Lee, 4 Aug): the person always gets a sentence.
 *   · "A catch-all hid four root causes in a week": an unrecognised failure is still traceable —
 *     the generic sentence carries the allow-listed error CODE (never the server's prose), and the
 *     console line carries kind + allow-listed code + bounded HTTP status only (Security P0R2-B,
 *     20 Oct: a blacklist cannot certify arbitrary server text safe, so none is shown or logged).
 */
import { WA, type Localized } from "./i18n";

export type AuthErrorKind =
  | "badCredentials" | "rateLimit" | "spentToken" | "notConfirmed" | "alreadyRegistered"
  | "weakPassword" | "samePassword" | "network" | "captcha" | "browserUnavailable" | "other";

const TEXT: Record<Exclude<AuthErrorKind, "other">, Localized> = {
  badCredentials: { en: "That email and password don't match. Try again, or use a 6-digit email code.", es: "El correo y la contraseña no coinciden. Inténtelo de nuevo o use un código de 6 dígitos por correo.", de: "E-Mail und Passwort passen nicht zusammen. Versuchen Sie es erneut oder nutzen Sie einen 6-stelligen E-Mail-Code.", ru: "Почта и пароль не совпадают. Попробуйте ещё раз или войдите по 6-значному коду из письма.", zh: "邮箱和密码不匹配。请重试，或使用 6 位邮箱验证码。", pt: "O e-mail e a senha não conferem. Tente de novo ou use um código de 6 dígitos por e-mail." },
  rateLimit: { en: "Too many tries for now. Wait a minute, then try again.", es: "Demasiados intentos por ahora. Espere un minuto e inténtelo de nuevo.", de: "Zu viele Versuche. Warten Sie eine Minute und versuchen Sie es erneut.", ru: "Слишком много попыток. Подождите минуту и попробуйте снова.", zh: "尝试次数过多。请稍等一分钟再试。", pt: "Tentativas demais por agora. Espere um minuto e tente de novo." },
  spentToken: { en: "That code or link has expired or was already used. Ask for a new one.", es: "Ese código o enlace venció o ya se usó. Pida uno nuevo.", de: "Dieser Code oder Link ist abgelaufen oder wurde schon verwendet. Fordern Sie einen neuen an.", ru: "Срок действия кода или ссылки истёк, или они уже использованы. Запросите новые.", zh: "该验证码或链接已过期或已被使用。请重新获取。", pt: "Esse código ou link expirou ou já foi usado. Peça um novo." },
  notConfirmed: { en: "This email isn't confirmed yet. Use a 6-digit email code to finish.", es: "Este correo aún no está confirmado. Use un código de 6 dígitos para terminar.", de: "Diese E-Mail ist noch nicht bestätigt. Schließen Sie mit einem 6-stelligen E-Mail-Code ab.", ru: "Эта почта ещё не подтверждена. Завершите вход по 6-значному коду из письма.", zh: "此邮箱尚未确认。请使用 6 位邮箱验证码完成。", pt: "Este e-mail ainda não foi confirmado. Use um código de 6 dígitos para concluir." },
  alreadyRegistered: { en: "There's already an account for this. Sign in instead.", es: "Ya existe una cuenta con estos datos. Ingrese en su lugar.", de: "Dafür gibt es bereits ein Konto. Melden Sie sich stattdessen an.", ru: "Для этих данных уже есть аккаунт. Войдите в него.", zh: "该信息已有账户。请直接登录。", pt: "Já existe uma conta com esses dados. Entre nela." },
  weakPassword: { en: "That password is too weak. Choose a longer one.", es: "Esa contraseña es muy débil. Elija una más larga.", de: "Dieses Passwort ist zu schwach. Wählen Sie ein längeres.", ru: "Пароль слишком простой. Выберите более длинный.", zh: "密码强度太弱。请设置更长的密码。", pt: "Essa senha é fraca demais. Escolha uma mais longa." },
  samePassword: { en: "That's your current password. Choose a new one.", es: "Esa es su contraseña actual. Elija una nueva.", de: "Das ist Ihr aktuelles Passwort. Wählen Sie ein neues.", ru: "Это ваш текущий пароль. Выберите новый.", zh: "这是您当前的密码。请设置新密码。", pt: "Essa é sua senha atual. Escolha uma nova." },
  network: { en: "We couldn't reach the server. Check your connection and try again.", es: "No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.", de: "Der Server ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.", ru: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.", zh: "无法连接服务器。请检查网络后重试。", pt: "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo." },
  captcha: { en: "The security check didn't go through. Restart it and try again.", es: "La verificación de seguridad no pasó. Reiníciela e inténtelo de nuevo.", de: "Die Sicherheitsprüfung ist fehlgeschlagen. Starten Sie sie neu und versuchen Sie es erneut.", ru: "Проверка безопасности не пройдена. Перезапустите её и попробуйте снова.", zh: "安全验证未通过。请重新验证后再试。", pt: "A verificação de segurança não passou. Reinicie e tente de novo." },
  browserUnavailable: { en: "We couldn't open the sign-in page. Try again, or use a 6-digit email code.", es: "No pudimos abrir la página de ingreso. Inténtelo de nuevo o use un código de 6 dígitos por correo.", de: "Die Anmeldeseite ließ sich nicht öffnen. Versuchen Sie es erneut oder nutzen Sie einen 6-stelligen E-Mail-Code.", ru: "Не удалось открыть страницу входа. Попробуйте снова или войдите по 6-значному коду из письма.", zh: "无法打开登录页面。请重试，或使用 6 位邮箱验证码。", pt: "Não conseguimos abrir a página de login. Tente de novo ou use um código de 6 dígitos por e-mail." },
};

/* Supabase Auth error codes we recognise. Only these ever reach a log line or the screen's
   reference tag; anything else is reported as "unknown". */
const KNOWN_CODES = new Set([
  "invalid_credentials", "email_not_confirmed", "otp_expired", "otp_disabled", "over_request_rate_limit",
  "over_email_send_rate_limit", "over_sms_send_rate_limit", "user_already_exists", "email_exists", "phone_exists",
  "weak_password", "same_password", "captcha_failed", "validation_failed", "bad_jwt", "session_not_found",
  "session_expired", "refresh_token_not_found", "refresh_token_already_used", "flow_state_not_found",
  "flow_state_expired", "bad_code_verifier", "bad_oauth_callback", "bad_oauth_state", "oauth_provider_not_supported",
  "provider_disabled", "signup_disabled", "email_provider_disabled", "user_not_found", "user_banned",
  "unexpected_failure", "request_timeout", "conflict", "reauthentication_needed", "native_browser_unavailable",
  "oauth_failed",
]);

function parts(e: unknown): { msg: string; code: string; status: number | null } {
  let o: Record<string, unknown> = {};
  try { o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>; } catch { /* hostile value */ }
  let raw: unknown = "", code: unknown = "", status: unknown = null;
  try { raw = o.message ?? o.error_description ?? o.error ?? (typeof e === "string" ? e : ""); code = o.code; status = o.status; } catch { /* getter threw */ }
  const n = typeof status === "number" ? status : typeof status === "string" && /^\d{3}$/.test(status) ? Number(status) : null;
  return {
    msg: typeof raw === "string" ? raw.trim().slice(0, 500) : "",
    code: typeof code === "string" && KNOWN_CODES.has(code) ? code : "",
    status: n !== null && Number.isInteger(n) && n >= 100 && n <= 599 ? n : null,
  };
}

export function authErrorKind(e: unknown): AuthErrorKind {
  const { msg, code, status } = parts(e);
  /* The message is read ONLY to classify, never to display or log. */
  const s = `${code} ${msg}`.toLowerCase();
  if (code === "native_browser_unavailable") return "browserUnavailable";
  if (code === "invalid_credentials" || /invalid login credentials/.test(s)) return "badCredentials";
  if (status === 429 || /rate.?limit|too many|over_request|over_email_send|over_sms_send/.test(s)) return "rateLimit";
  if (/otp_expired|token has expired|expired|invalid.*(token|otp|code)|flow_state|bad_code_verifier/.test(s)) return "spentToken";
  if (/email_not_confirmed|not confirmed/.test(s)) return "notConfirmed";
  if (/user_already_exists|already registered|email_exists|phone_exists/.test(s)) return "alreadyRegistered";
  if (/weak_password|password should|password is too/.test(s)) return "weakPassword";
  if (/same_password|different from the old/.test(s)) return "samePassword";
  if (/captcha/.test(s)) return "captcha";
  let isTypeError = false;
  try { isTypeError = e instanceof TypeError; } catch { /* ignore */ }
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|aborted/.test(s) || (isTypeError && !code)) return "network";
  return "other";
}

/** A controlled error object for helper boundaries: an allow-listed code, a bounded HTTP status and
 *  a fixed English message — never the server's prose. */
export function controlledAuthError(e: unknown, fallbackCode: string): { code: string; status?: number; message: string } {
  const { code, status } = parts(e);
  const c = code || (KNOWN_CODES.has(fallbackCode) ? fallbackCode : "oauth_failed");
  return status !== null ? { code: c, status, message: `auth error ${c}` } : { code: c, message: `auth error ${c}` };
}

/** The one sentence a member sees: our words for a recognised failure; the screen's own generic
 *  sentence otherwise, tagged with the allow-listed code (if any) so a new failure is still
 *  traceable without showing the server's text (Security P0R2-B, 20 Oct). */
export function authErrorText(e: unknown, lang: string, fallback: string): string {
  const kind = authErrorKind(e);
  const { code, status } = parts(e);
  try { console.warn("[auth]", kind, code || "unknown", status ?? "-"); } catch { /* no console */ }
  if (kind !== "other") return WA(lang, TEXT[kind]);
  return code ? `${fallback} (${code})` : fallback;
}

/** True when a shown sentence is the "expired or already used" one, in whatever language. */
export function isSpentTokenText(shown: string | null, lang: string): boolean {
  return !!shown && (shown === WA(lang, TEXT.spentToken) || /token has expired|invalid|expired/i.test(shown));
}
