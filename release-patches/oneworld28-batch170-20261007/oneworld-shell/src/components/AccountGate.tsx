import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useI18n, WA, type Localized } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { signUpHref, safeAuthReturn } from "../lib/authReturn";

/**
 * LOOK BUT DON'T TOUCH — the one door every guest action goes through (Lee, 9 Oct 2026).
 * ============================================================================================
 * *"Any random person can come in and just see and look around. But they just can't interact…
 * Any interaction buttons should trigger sign in or sign up… once that person signed up, it takes
 * them right back… it opens the door, now you're messaging someone. It advances you ahead into
 * the next screen."*
 *
 * Three pieces, one behaviour everywhere:
 *  - `useAccountGate()` — a guest taps Message / Like / Save / Follow: a small sheet says what an
 *    account is for, with Create account first and Sign in second. Nothing is a dead button.
 *  - `resumeHref(path, intent)` — the return trip carries WHAT they were doing (`?ow_do=message`),
 *    so sign-up does not just bring them back to the page, it finishes the step:
 *  - `useResumeIntent(intent, run, ready)` — the page sees `ow_do` once there is a session, strips
 *    it, and runs the action: the conversation opens, the heart fills, the home is saved.
 *    Where the action IS a page (a messages thread), the return trip goes straight to that page.
 *  - `AccountNeeded` — the full-screen form of the same card, for a guest who deep-links into a
 *    signed-in page (AuthGate); after sign-up they land on exactly that page.
 */
export const RESUME_PARAM = "ow_do";

export function resumeHref(path: string, intent: string): string {
  const url = new URL(safeAuthReturn(path), "https://oneworld.invalid");
  url.searchParams.set(RESUME_PARAM, intent);
  return url.pathname + url.search + url.hash;
}

const COPY = {
  title: { en: "Create an account to continue", es: "Cree una cuenta para continuar", de: "Erstellen Sie ein Konto, um fortzufahren", pt: "Crie uma conta para continuar", ru: "Создайте аккаунт, чтобы продолжить", zh: "创建账户以继续" },
  sub: { en: "Looking is free. To message, save, book or buy, you need an account. It takes a minute, and we bring you right back.", es: "Mirar es gratis. Para escribir, guardar, reservar o comprar necesita una cuenta. Toma un minuto y lo traemos de vuelta.", de: "Ansehen ist kostenlos. Zum Schreiben, Speichern, Buchen oder Kaufen brauchen Sie ein Konto. Es dauert eine Minute, dann geht es direkt weiter.", pt: "Olhar é grátis. Para enviar mensagem, salvar, reservar ou comprar, você precisa de uma conta. Leva um minuto e você volta direto.", ru: "Смотреть можно бесплатно. Чтобы писать, сохранять, бронировать или покупать, нужен аккаунт. Это минута — и вы сразу вернётесь.", zh: "浏览免费。发消息、收藏、预订或购买需要账户。只需一分钟，然后直接带您回来。" },
  join: { en: "Create account", es: "Crear cuenta", de: "Konto erstellen", pt: "Criar conta", ru: "Создать аккаунт", zh: "创建账户" },
  signin: { en: "Sign in", es: "Ingresar", de: "Anmelden", pt: "Entrar", ru: "Войти", zh: "登录" },
  keep: { en: "Keep looking", es: "Seguir mirando", de: "Weiter ansehen", pt: "Continuar olhando", ru: "Продолжить смотреть", zh: "继续浏览" },
} satisfies Record<string, Localized>;

function Card({ next, onClose, lang }: { next: string; onClose?: () => void; lang: string }) {
  return (
    <div data-ow="account-needed" className="card w-full max-w-md p-5 text-center shadow-xl">
      <p className="text-[17px] font-black">{WA(lang, COPY.title)}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed opacity-70">{WA(lang, COPY.sub)}</p>
      <div className="mt-4 grid gap-2">
        <Link to={signUpHref(next)} className="btn-primary block text-center">{WA(lang, COPY.join)}</Link>
        <Link to={"/signin?next=" + encodeURIComponent(safeAuthReturn(next))} className="btn-ghost block text-center">
          {WA(lang, COPY.signin)}</Link>
        {onClose && (
          <button type="button" onClick={onClose} className="ow-tap mt-1 text-[13px] font-semibold opacity-60">
            {WA(lang, COPY.keep)}</button>
        )}
      </div>
    </div>
  );
}

/** The sheet a guest sees when they tap an action. `ask(next)` opens it; render `gate` once. */
export function useAccountGate(): { ask: (next: string) => void; gate: ReactNode } {
  const { lang } = useI18n();
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    if (!next) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNext(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);
  const gate = next && typeof document !== "undefined" ? createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[180] flex items-end justify-center bg-black/45 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur-sm sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) setNext(null); }}>
      <Card next={next} onClose={() => setNext(null)} lang={lang} />
    </div>, document.body) : null;
  return { ask: setNext, gate };
}

/* The intent as the page was FIRST opened. Some screens rewrite their own address on mount — the
   feed normalises `?lane=…&i=…` — and would wipe `ow_do` before the button that owns it has even
   loaded its card. So the arrival intent is captured once, when the app boots, and consumed once. */
let bootIntent: string | null = (() => {
  try {
    const h = window.location.hash, q = h.indexOf("?");
    return new URLSearchParams(window.location.search).get(RESUME_PARAM)
      ?? (q >= 0 ? new URLSearchParams(h.slice(q + 1)).get(RESUME_PARAM) : null);
  } catch { return null; }
})();

/** On the page a guest came back to: finish what they tapped, once, after sign-in. */
export function useResumeIntent(intent: string, run: () => void, ready = true): void {
  const { userId } = useOneId();
  const here = useLocation();
  const nav = useNavigate();
  const done = useRef(false);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (done.current || !userId || !ready) return;
    const params = new URLSearchParams(here.search);
    const inUrl = params.get(RESUME_PARAM) === intent;
    if (!inUrl && bootIntent !== intent) return;
    done.current = true;
    if (bootIntent === intent) bootIntent = null;
    if (inUrl) {
      params.delete(RESUME_PARAM);
      const q = params.toString();
      nav(here.pathname + (q ? "?" + q : "") + here.hash, { replace: true });
    }
    runRef.current();
  }, [userId, ready, intent, here.search, here.pathname, here.hash, nav]);
}

/** Full-screen form, for a guest who opened a signed-in page directly. */
export function AccountNeeded({ next }: { next: string }) {
  const { lang } = useI18n();
  const nav = useNavigate();
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-4">
      <Card next={next} lang={lang} onClose={() => (window.history.length > 1 ? nav(-1) : nav("/"))} />
    </div>
  );
}
