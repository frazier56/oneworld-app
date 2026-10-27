/**
 * "You're inside Instagram" — the door out (W:P0-AUTH, 19 Oct 2026).
 * Shown on /signin and /join only when `detectInAppBrowser()` finds an embedded browser. Google is
 * hidden there (it refuses embedded browsers) and the email code becomes the first choice, so this
 * panel only explains why and offers the way out to a real browser:
 *   · Android: "Open in Chrome" (a fixed intent URL) plus Copy link, for phones without Chrome or
 *     where the app blocks intents.
 *   · iPhone: there is no reliable programmatic way into Safari, so the panel says exactly what
 *     to tap and offers Copy link. It never promises to open Safari itself.
 */
import { useState } from "react";
import { useI18n, WA } from "../lib/i18n";
import { CHROME_INTENT_URL, SIGNIN_URL, type InAppBrowser } from "../lib/inAppBrowser";

export default function InAppBrowserNotice({ browser }: { browser: InAppBrowser }) {
  const { lang } = useI18n();
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const app = browser.app || WA(lang, { en: "this app", es: "esta app", de: "dieser App", ru: "этом приложении", zh: "此应用", pt: "este app" });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SIGNIN_URL);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  };

  return (
    <div role="note" className="card space-y-2.5 rounded-2xl px-4 py-3.5 text-[13.5px] leading-snug">
      <p className="font-bold">
        {WA(lang, {
          en: `You're in ${app}'s browser, where Google sign-in doesn't work.`,
          es: `Está en el navegador de ${app}, donde el ingreso con Google no funciona.`,
          de: `Sie sind im Browser von ${app}. Dort funktioniert die Anmeldung mit Google nicht.`,
          ru: `Вы во встроенном браузере ${app}, где вход через Google не работает.`,
          zh: `您正在 ${app} 的内置浏览器中，这里无法使用 Google 登录。`,
          pt: `Você está no navegador do ${app}, onde o login com Google não funciona.`,
        })}
      </p>
      <p className="opacity-70">
        {browser.platform === "ios"
          ? WA(lang, {
              en: "Use an email code below, or tap ··· (or the share icon) and choose Open in Safari.",
              es: "Use un código por correo aquí abajo, o toque ··· (o el ícono de compartir) y elija Abrir en Safari.",
              de: "Nutzen Sie unten einen E-Mail-Code oder tippen Sie auf ··· (oder Teilen) und wählen Sie „In Safari öffnen“.",
              ru: "Войдите по коду из письма ниже или нажмите ··· (или «Поделиться») и выберите «Открыть в Safari».",
              zh: "请使用下方的邮箱验证码，或点按 ···（或分享图标）并选择“在 Safari 中打开”。",
              pt: "Use um código por e-mail abaixo, ou toque em ··· (ou no ícone de compartilhar) e escolha Abrir no Safari.",
            })
          : WA(lang, {
              en: "Use an email code below, or open this page in Chrome to continue with Google.",
              es: "Use un código por correo aquí abajo, o abra esta página en Chrome para continuar con Google.",
              de: "Nutzen Sie unten einen E-Mail-Code oder öffnen Sie diese Seite in Chrome, um mit Google fortzufahren.",
              ru: "Войдите по коду из письма ниже или откройте эту страницу в Chrome, чтобы войти через Google.",
              zh: "请使用下方的邮箱验证码，或在 Chrome 中打开此页面以继续使用 Google。",
              pt: "Use um código por e-mail abaixo, ou abra esta página no Chrome para continuar com o Google.",
            })}
      </p>
      <div className="flex flex-wrap gap-2">
        {browser.platform === "android" && (
          <a href={CHROME_INTENT_URL}
            className="ow-tap card inline-flex min-h-[44px] items-center rounded-xl px-3.5 text-[13.5px] font-bold">
            {WA(lang, { en: "Open in Chrome", es: "Abrir en Chrome", de: "In Chrome öffnen", ru: "Открыть в Chrome", zh: "在 Chrome 中打开", pt: "Abrir no Chrome" })}
          </a>
        )}
        <button type="button" onClick={() => void copy()}
          className="ow-tap card inline-flex min-h-[44px] items-center rounded-xl px-3.5 text-[13.5px] font-bold">
          {copied === "ok"
            ? WA(lang, { en: "Link copied", es: "Enlace copiado", de: "Link kopiert", ru: "Ссылка скопирована", zh: "链接已复制", pt: "Link copiado" })
            : WA(lang, { en: "Copy link", es: "Copiar enlace", de: "Link kopieren", ru: "Копировать ссылку", zh: "复制链接", pt: "Copiar link" })}
        </button>
      </div>
      {copied === "fail" && (
        <p className="text-[12.5px] opacity-70">{SIGNIN_URL}</p>
      )}
    </div>
  );
}
