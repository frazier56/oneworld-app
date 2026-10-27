import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { W, useI18n, trackEvent } from "@oneworld/shell";

/**
 * THE THREE FIRST-VISIT TIPS — redesigned 27 October 2026.
 * ============================================================================================
 * Lee, on the canvas: no panel around the graphic, *"just show the icon or the graphic itself"*;
 * no bold "Swipe up and down" title, *"that's pretty obvious… just put it all in one sentence"*,
 * in the smaller font; and never "this world" — *"it's all one world… see more of this
 * application."* Light AND dark mode on every step.
 *
 *   1. The up/down track.         "Swipe up or down to see more of this app, one post at a time."
 *   2. The SAME track, turned.    "Swipe left or right to switch apps. All the way left is Everything."
 *   3. The real middle button.    "Tap the middle button to create your profile."
 *
 * Tip 3 shows the footer's ACTUAL middle button (the One World mark) — the footer is not
 * restyled to match the mockup (Lee, 27 Oct: "keep the footer that we have").
 *
 * Shown once per device, replayable from the menu. Where "seen" lives is unchanged — see below.
 * A failure to store it only means the tips show again, the harmless direction to fail in.
 */
const KEY = "ow.worldfeed.intro.seen";

export function introSeen(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function markIntroSeen() {
  try { localStorage.setItem(KEY, "1"); } catch { /* showing it again is the safe failure */ }
}
export function clearIntroSeen() {
  try { localStorage.removeItem(KEY); } catch { /* the caller opens it directly anyway */ }
}

/** The up/down track: a pill outline, up chevron, dot, down chevron. Tip 2 turns the same one. */
function Track({ sideways }: { sideways?: boolean }) {
  return (
    <svg width="48" height="84" viewBox="0 0 34 60" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={sideways ? "rotate-90" : ""}>
      <rect x="3" y="3" width="28" height="54" rx="14" />
      <path d="M11 17l6-6 6 6M11 43l6 6 6-6" />
      <circle cx="17" cy="30" r="3.6" fill="currentColor" />
    </svg>
  );
}

export default function Intro({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const [step, setStep] = useState(0);
  const nextBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) setStep(0); }, [open]);
  /* Focus the main button on every step, so Enter/Space walks the tips without a mouse. */
  useEffect(() => { if (open) nextBtn.current?.focus({ preventScroll: true }); }, [open, step]);
  if (!open) return null;

  const done = (how: "finished" | "skipped") => {
    trackEvent("feed_tips_" + how, "onboarding", { step: step + 1 });
    markIntroSeen(); onClose();
  };
  const mark = `${(import.meta as any).env?.BASE_URL ?? "/"}mark-oneworld.png`;

  /* Each line breaks where the sentence breaks, never mid-phrase. */
  const tips = [
    { art: <Track />,
      en: ["Swipe up or down to see more of this app,", "one post at a time."],
      es: ["Deslice arriba o abajo para ver más de esta app,", "una publicación a la vez."] },
    { art: <Track sideways />,
      en: ["Swipe left or right to switch apps.", "All the way left is Everything."],
      es: ["Deslice a los lados para cambiar de app.", "Al fondo a la izquierda está Todo."] },
    { art: <img src={mark} alt="" aria-hidden decoding="async" className="h-[76px] w-auto object-contain"
               style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,.35))" }} />,
      en: ["Tap the middle button to create your profile.", "Each app has its own button here."],
      es: ["Toque el botón del medio para crear su perfil.", "Cada app tiene su propio botón aquí."] },
  ];
  const t = tips[step];
  const last = step === tips.length - 1;
  const lines = lang === "es" ? t.es : t.en;

  /* Portalled to <body>: inside the feed, the post rail and caption sat ABOVE the scrim. */
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={W(lang, "How the feed works", "Cómo funciona el feed")}
      data-ow="intro"
      className="fixed inset-0 z-[150] flex flex-col items-center justify-center px-6 text-center
        text-ink backdrop-blur-md dark:text-white
        bg-[rgba(244,243,250,.70)] dark:bg-[rgba(8,10,22,.55)]">
      <button type="button" onClick={() => done("skipped")}
        className="ow-tap absolute right-[18px] top-[max(16px,env(safe-area-inset-top))] px-1 py-1 text-[14px] font-bold opacity-80">
        {W(lang, "Skip", "Omitir")}
      </button>

      <div className="flex h-[100px] items-center justify-center">{t.art}</div>
      <p className="m-0 mt-5 whitespace-nowrap text-[clamp(13px,3.9vw,15.5px)] font-semibold leading-[1.5]">
        {lines[0]}<br />{lines[1]}
      </p>
      <button type="button" ref={nextBtn}
        onClick={() => (last ? done("finished") : setStep(s => s + 1))}
        className="ow-tap mt-5 h-[50px] rounded-full px-[34px] text-[16px] font-extrabold transition active:scale-[.98]
          bg-[#2C2622] text-white dark:bg-white dark:text-[#201B16]">
        {last ? W(lang, "Start exploring", "Empezar") : W(lang, "Next", "Siguiente")}
      </button>
      <div className="mt-5 flex gap-1.5" aria-hidden>
        {tips.map((_, i) => (
          <i key={i} className={`h-1.5 rounded bg-current ${i === step ? "w-[18px]" : "w-1.5 opacity-35"}`} />
        ))}
      </div>

      {/* Tip 3 points at the real middle button in the footer below. */}
      {last && (
        <svg width="18" height="96" viewBox="0 0 18 96" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeDasharray="3 7" aria-hidden
          className="absolute left-1/2 -translate-x-1/2 bottom-[calc(max(22px,env(safe-area-inset-bottom))+76px)]">
          <path d="M9 4v80M3 76l6 10 6-10" />
        </svg>
      )}
    </div>,
    document.body,
  );
}
