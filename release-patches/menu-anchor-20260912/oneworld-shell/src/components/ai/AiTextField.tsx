import { useState } from "react";
import { useI18n } from "../../lib/i18n";
import AiWritingAssist, { canAssist, type AiWritingAssistProps } from "./AiWritingAssist";

/**
 * AI TEXT FIELD — the field, the trigger, and the undo, so 27 call sites do not each rebuild them.
 * ============================================================================================
 * `AiWritingAssist` is the modal. This is what a screen actually drops in. It exists because the
 * OneJob original had ~70 lines of surrounding JSX — the "Speak it / Type it" chooser over an
 * empty field, the little "Speak with AI" pill once there is text, and the state to track which
 * — and copying that to every field is how the three OneEvent forks happened.
 *
 * ── THE UNDO ────────────────────────────────────────────────────────────────────────────────
 * The original had none: applying overwrote whatever you had typed, permanently. That is fine
 * for a contract you are drafting in the next thirty seconds and genuinely bad for a bio someone
 * has curated for a year. This keeps the previous value and offers it back until the field is
 * next edited by hand.
 */

export interface AiTextFieldProps
  extends Omit<AiWritingAssistProps, "open" | "onClose" | "onApply" | "currentValue" | "onBeforeApply"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  rows?: number;
  className?: string;
  /**
   * Show the "How do you want to write this?" chooser over an empty field. On for the long ones
   * — a bio, a property description, a contract scope — where a blank box is genuinely daunting.
   * OFF for short ones: putting a two-button chooser in front of a one-line note costs more
   * attention than it saves.
   */
  offerChooser?: boolean;
}

export default function AiTextField({
  value, onChange, placeholder, error, rows = 5, className = "",
  offerChooser = false, ...assist
}: AiTextFieldProps) {
  const { lang } = useI18n();
  const es = lang === "es" || lang === "co";
  const [open, setOpen] = useState(false);
  const [typingChosen, setTypingChosen] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);

  const empty = !value.trim();
  /* THE CHOOSER AND THE ASSIST BUTTON BOTH DEPEND ON THE DEPLOYED FUNCTION.
     `AiWritingAssist` already refuses to render for a kind the live edge function would turn into
     an event advert (see `canAssist` there) — but that is the modal. Without this line the field
     would still offer "Speak it" and a VAIA button that open nothing, which is a worse failure
     than not offering them: a dead control reads as a broken app, not as a pending deploy.
     One flag, `VITE_COMPOSE_V11`, lights up the whole feature the moment Lee deploys the patch. */
  const assistAvailable = canAssist(assist.kind);
  const showChooser = offerChooser && empty && !typingChosen && assistAvailable;

  return (
    <div className={className}>
      {showChooser ? (
        <div className="rounded-2xl border border-ink/10 bg-brand/[0.035] p-4 dark:border-white/10">
          <p className="text-center text-[13px] font-semibold opacity-70">
            {es ? "¿Cómo quiere escribirlo?" : "How do you want to write this?"}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setOpen(true)}
              className="btn-primary flex-[3] !py-3.5 !text-[15px]">
              {es ? "Hablarlo" : "Speak it"}
            </button>
            <button type="button" onClick={() => setTypingChosen(true)}
              className="ow-tap flex-[2] rounded-2xl border border-ink/20 px-3 py-3.5 text-[15px] font-bold transition active:scale-95 dark:border-white/20">
              {es ? "Escribirlo" : "Type it"}
            </button>
          </div>
          <p className="mt-2.5 text-center text-[11.5px] leading-snug opacity-55">
            {es ? `Hablar es más rápido — describa ${assist.subject} en voz alta y VAIA lo redacta.`
                : `Talking is faster — describe ${assist.subject} out loud and VAIA writes it.`}
          </p>
        </div>
      ) : (
        <>
          {/* ── THE GRIP ────────────────────────────────────────────────────────────────────
              Lee, 11 Aug 2026, on OneHome's description box: *"you still have a little dot in the
              bottom right hand corner of that screen, which is supposed to be like an expand
              collapse section, but it's so tiny as, like, literally a dot."*

              That dot is Chrome's NATIVE textarea resizer. OneJob solved this on 31 Jul: paint the
              native one out and draw a real one — two diagonal strokes on a soft chip, tucked
              inside the rounded corner. The rule lived in OneJob's own index.css, so this field —
              which every product uses — never got it. `.ow-ta` is that rule, in the shell, so the
              fix lands in all six apps at once.

              `pointer-events-none` on the glyph: the native resizer is still underneath doing the
              actual dragging. We are only replacing what it LOOKS like. */}
          <div className="relative">
            <textarea
              className={`ow-ta input w-full ${error ? "ring-1 ring-red-500" : ""}`}
              style={{ minHeight: `${rows * 24 + 24}px` }}
              value={value}
              placeholder={placeholder}
              onChange={e => { onChange(e.target.value); if (previous !== null) setPrevious(null); }} />
            <span aria-hidden
              className="pointer-events-none absolute bottom-[7px] right-[5px] grid h-[18px] w-[18px] place-items-center rounded-[7px] rounded-br-[10px] bg-ink/[0.06] text-ink/45 dark:bg-white/10 dark:text-white/50">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M10 3.5 L3.5 10" /><path d="M10 7.6 L7.6 10" />
              </svg>
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Hidden, not disabled, when the deployed function cannot write this kind. A greyed
                "Write with VAIA" would advertise a feature and then refuse it; no button at all
                is simply the plain description field this screen had last week. */}
            {assistAvailable && (
            <button type="button" onClick={() => setOpen(true)}
              className="ow-tap inline-flex items-center gap-1.5 rounded-full border border-brand/35 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/10 active:scale-95">
              {es ? "Escribir con VAIA" : "Write with VAIA"}
            </button>
            )}

            {previous !== null && (
              <button type="button"
                onClick={() => { onChange(previous); setPrevious(null); }}
                className="ow-tap inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-bold opacity-70 transition active:scale-95 dark:border-white/20">
                {es ? "Deshacer" : "Undo"}
              </button>
            )}
          </div>
        </>
      )}

      <AiWritingAssist
        {...assist}
        open={open}
        onClose={() => setOpen(false)}
        currentValue={value}
        onBeforeApply={prev => setPrevious(prev)}
        onApply={v => { onChange(v); setTypingChosen(true); }} />
    </div>
  );
}
