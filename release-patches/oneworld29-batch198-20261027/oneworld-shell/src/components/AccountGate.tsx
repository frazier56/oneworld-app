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

/* ── JOIN ONE WORLD (Lee, 27 Oct 2026) ─────────────────────────────────────────────────────
   The canvas-approved sheet: "Join One World", one line, Sign up first, Sign in second, Keep
   browsing. See-through glass in light and dark — *"we want the glassmorphism to really show."*
   Sign up then offers Google, Apple and email on the existing `/join` screen. */
const COPY = {
  title: { en: "Join One World", es: "Únase a One World", de: "Treten Sie One World bei", pt: "Entre no One World", ru: "Присоединяйтесь к One World", zh: "加入 One World" },
  sub: { en: "Free. You come right back to where you were.", es: "Gratis. Vuelve justo a donde estaba.", de: "Kostenlos. Sie kommen direkt dorthin zurück, wo Sie waren.", pt: "Grátis. Você volta direto para onde estava.", ru: "Бесплатно. Вы вернётесь туда же, где были.", zh: "免费。完成后直接回到原处。" },
  join: { en: "Sign up", es: "Registrarse", de: "Registrieren", pt: "Cadastrar-se", ru: "Зарегистрироваться", zh: "注册" },
  signin: { en: "Sign in", es: "Ingresar", de: "Anmelden", pt: "Entrar", ru: "Войти", zh: "登录" },
  keep: { en: "Keep browsing", es: "Seguir mirando", de: "Weiter ansehen", pt: "Continuar olhando", ru: "Продолжить смотреть", zh: "继续浏览" },
} satisfies Record<string, Localized>;

const BTN = "ow-tap grid h-[52px] place-items-center rounded-[18px] text-[15.5px] font-extrabold transition active:scale-[.98]";

function Card({ next, onClose, lang }: { next: string; onClose?: () => void; lang: string }) {
  return (
    <div data-ow="account-needed"
      className="w-full max-w-[440px] rounded-[30px] border p-5 pt-[22px] text-left text-ink shadow-[0_20px_50px_rgba(0,0,0,.35)]
        backdrop-blur-2xl backdrop-saturate-[1.7] dark:text-white
        border-white/75 bg-[linear-gradient(160deg,rgba(255,255,255,.62),rgba(235,232,255,.42))]
        dark:border-white/20 dark:bg-[linear-gradient(160deg,rgba(40,44,80,.58),rgba(20,22,40,.50))]">
      <p className="m-0 text-[22px] font-black tracking-[-0.01em]">{WA(lang, COPY.title)}</p>
      <p className="m-0 mt-1 text-[14px] opacity-75">{WA(lang, COPY.sub)}</p>
      <div className="mt-4 grid gap-2.5">
        <Link to={signUpHref(next)} className={`${BTN} bg-[#2C2622] text-white dark:bg-[#F3F1EE] dark:text-[#201B16]`}>
          {WA(lang, COPY.join)}</Link>
        <Link to={"/signin?next=" + encodeURIComponent(safeAuthReturn(next))}
          className={`${BTN} border border-[#2C2622]/25 bg-white/55 backdrop-blur-xl dark:border-white/30 dark:bg-white/[0.10]`}>
          {WA(lang, COPY.signin)}</Link>
        {onClose && (
          <button type="button" onClick={onClose} className="ow-tap mt-0.5 py-1.5 text-center text-[14px] font-bold opacity-70">
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[180] flex items-end justify-center bg-black/20 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:items-center"
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
      {/* UX review #1 (22 Oct 2026): "Keep looking" left a guest on the same card. `history.length`
          counts pages from BEFORE the app (a new tab, the page that shared the link), so `nav(-1)`
          could leave the app or land on this same gated address. The router's own index says
          whether there is an in-app page to go back to; without one, the product's public front
          (`/rentals`, `/jobs` …) is where looking continues. */}
      <Card next={next} lang={lang} onClose={() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) { nav(-1); return; }
        const seg = safeAuthReturn(next).split(/[?#]/)[0].split("/").filter(Boolean)[0];
        nav(seg ? `/${seg}` : "/", { replace: true });
      }} />
    </div>
  );
}
