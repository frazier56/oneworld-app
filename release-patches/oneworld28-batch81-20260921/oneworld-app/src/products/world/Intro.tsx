import { useEffect, useState } from "react";
import { W, useI18n } from "@oneworld/shell";

/**
 * THE THREE INTRO CARDS.
 * ============================================================================================
 * Lee's wording, 20 September 2026, unchanged:
 *   1. Swipe up for the next one — every post is a real home, event, job or person near you.
 *   2. Swipe sideways to change lanes.
 *   3. One button takes you there — book it, get the ticket, hire them, follow them.
 *
 * Shown once, and — the part Lee asked for on his phone — REPLAYABLE from the menu, because he
 * needs to watch it over and over while it is being designed and there was no way back to it.
 *
 * ── WHERE "SEEN" IS REMEMBERED, AND WHY IT IS NOT THE DATABASE YET ──────────────────────────
 * A fact about a person belongs in the database, not on a device. This one is on the device for
 * exactly one release, deliberately: the events media migration is still unapplied on the live
 * project, and the sandbox writes to that same live database, so adding a second migration today
 * would put another thing in the way of Lee seeing his own feed. The lane preferences need a
 * column of their own in the next batch; this flag moves across in that SAME migration, so one
 * change carries both instead of two changes carrying one each.
 *
 * Until then it is wrapped in try/catch and a failure just means the intro shows again — the
 * harmless direction to fail in.
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

/**
 * The gesture, DRAWN — an arrow up, arrows both ways, or a tap ring.
 *
 * ⚠️ Deliberately not animated. The first draft named three keyframes that do not exist in this
 * app's stylesheet, which is an animation that silently never runs — a dead class shipped as
 * decoration. A drawn arrow says the same thing and cannot rot.
 */
function Gesture({ kind }: { kind: "up" | "side" | "tap" }) {
  return (
    <div className="mx-auto mb-3.5 grid h-16 w-16 place-items-center rounded-full border-2 border-white/60" aria-hidden>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        {kind === "up" && <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>}
        {kind === "side" && <><path d="M4 12h16" /><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /></>}
        {kind === "tap" && <><circle cx="12" cy="12" r="3.2" /><path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2" /></>}
      </svg>
    </div>
  );
}

export default function Intro({ open, onClose }: { open: boolean; onClose: () => void }) {
  /* ⚠️ The reader's OWN language. The first draft passed "en" to every one of these, which is a
     half-translated screen — the defect Lee has named by name. */
  const { lang } = useI18n();
  const [step, setStep] = useState(0);
  /* Every replay starts at the first card. Reopening on card three would be a replay of nothing. */
  useEffect(() => { if (open) setStep(0); }, [open]);
  if (!open) return null;

  const cards = [
    { kind: "up" as const,
      en: "Swipe up for the next one",
      es: "Deslice hacia arriba para ver el siguiente",
      enBody: "Every post is a real home, event, job or person near you.",
      esBody: "Cada publicación es una casa, un evento, un trabajo o una persona real cerca de usted." },
    { kind: "side" as const,
      en: "Swipe sideways to change lanes",
      es: "Deslice de lado para cambiar de carril",
      enBody: "Homes, Events, Jobs, Socials. Up and down stays where you are.",
      esBody: "Casas, Eventos, Trabajos, Sociales. Arriba y abajo se queda donde está." },
    { kind: "tap" as const,
      en: "One button takes you there",
      es: "Un botón lo lleva allí",
      enBody: "Book it, get the ticket, hire them, follow them.",
      esBody: "Resérvelo, obtenga la entrada, contrátelos, síganlos." },
  ];
  const c = cards[step];
  const last = step === cards.length - 1;

  return (
    <div role="dialog" aria-modal="true"
      /* ── PHONE WIDTH, EVEN ON A DESKTOP (R19) ───────────────────────────────────────────
         Lee: *"the little three-step instruction guide is the full length of your desktop,
         which is way too wide. It should be limited to a mobile aspect ratio, width-wise at
         least."* `items-center` plus a capped inner column does it: on a phone the cap is wider
         than the screen and changes nothing at all; on a desktop the card stops at 440 and sits
         in the middle where a phone would hold it. */
      className="absolute inset-0 z-50 flex flex-col items-center justify-end bg-ink/60 px-[18px] pb-[110px] backdrop-blur-md">
      {/* ── A LIGHTER FROSTED PANEL, NOT A NAVY SLAB (R19) ─────────────────────────────────
         Lee: *"make the panel like a frosted lighter colour, more like a glassmorphism panel,
         and then make the button espresso."* It was `#151C2C`, a flat fill one shade off the
         backdrop behind it, so the card and its background read as one dark mass and the blue
         button was the only thing with any life in it. Now it is real glass — a white wash at
         low alpha over the blur that is already there, a bright hairline along the top edge
         where the light would catch, and a shadow under it so it sits ABOVE the screen rather
         than in it. The espresso button then has something to be the warm thing against. */}
      {/* ── MORE FROST, LESS SEE-THROUGH (22 Sep) ──────────────────────────────────────────
         Lee: *"way too translucent… the same type of translucent that we have in our footer, or
         maybe even a little darker… the button probably should be white."* The footer's carved
         glass is a white hairline over a heavy blur; here it sits on a darker smoked fill so the
         feed behind reads as colour and light only, never as legible content. */}
      <div className="w-full max-w-[440px] rounded-3xl border border-white/[0.18] p-[18px]
        text-white backdrop-blur-3xl backdrop-saturate-150"
        style={{ background: "linear-gradient(180deg, rgba(38,44,58,.72), rgba(16,20,30,.80))",
                 boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 18px 46px rgba(0,0,0,.55)" }}>
        <div className="mb-3 flex gap-1.5" aria-hidden>
          {cards.map((_, i) => (
            <i key={i} className={`h-[3px] flex-1 rounded ${i <= step ? "bg-white" : "bg-white/20"}`} />
          ))}
        </div>
        <Gesture kind={c.kind} />
        {/* A LABEL on the button, and a heading that is one idea. The body carries the rest. */}
        <b className="mb-1 block text-[18px] font-extrabold tracking-tight">{W(lang, c.en, c.es)}</b>
        <p className="mb-3.5 text-[13px] leading-relaxed text-white/70">{W(lang, c.enBody, c.esBody)}</p>
        {/* WHITE (22 Sep): Lee — "the button probably should be white." Was espresso (R19):
            ESPRESSO, NOT BLUE (R19). Lee: *"the blue button that says Next should be more
            espresso colour — espresso is our main call-to-action button."* `btn-brand` paints
            the HOST PRODUCT's hue, and on this screen the host is One World blue, which is why
            it came out blue. `bg-clay` is the company's call-to-action colour and it is the
            same warm brown the feed's own plus button and every View listing button already
            wear, so the first button a new member ever presses matches every button after it. */}
        <button type="button"
          className="ow-tap grid h-[50px] w-full place-items-center rounded-2xl bg-white text-[15px] font-extrabold text-ink transition active:scale-[.98]"
          onClick={() => { if (last) { markIntroSeen(); onClose(); } else setStep(s => s + 1); }}>
          {last ? W(lang, "Start", "Comenzar") : W(lang, "Next", "Siguiente")}
        </button>
        {!last && (
          <button type="button" onClick={() => { markIntroSeen(); onClose(); }}
            className="mt-2 w-full text-[12.5px] font-semibold text-white/60">
            {W(lang, "Skip", "Omitir")}
          </button>
        )}
      </div>
    </div>
  );
}
