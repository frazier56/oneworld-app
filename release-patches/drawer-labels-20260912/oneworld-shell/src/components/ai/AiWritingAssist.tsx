import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../lib/i18n";
import { SUPABASE_URL, SUPABASE_ANON } from "../../lib/supabase";
import VaiaFace from "../VaiaFace";
import { useVoiceTranscription } from "./useVoiceTranscription";
import { RichTextEditor, stripRichTextHtml } from "./RichTextEditor";
import { markdownToHtml } from "./mdToHtml";

/**
 * AI WRITING ASSIST — one implementation, every long-text field, every product.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"Look at OneJob and see how the description field is set up for when you
 * create a contract — that's the capability we need to have really anywhere that there's a box…
 * your profile bio, your property description."*
 *
 * ── WHY THIS IS IN THE SHELL AND NOT COPIED AGAIN ───────────────────────────────────────────
 * It was already copied three times. OneEvent carries an older fork of OneJob's modal missing
 * the refine chips, an inline variant that nothing imports, and a button-only variant. Nobody
 * did anything wrong; a good component in a product directory just gets copied when the next
 * product needs it, and then the fixes only ever land in one of them. So it lives here now, and
 * the products import it.
 *
 * The audit that preceded this found **27 long-text fields across the app and only 3 with any
 * assistance at all** — including OneHome's rental contract terms box, which is the longest and
 * most legally consequential text in the product and had nothing.
 *
 * ── WHAT CHANGED IN THE LIFT, AND WHY EACH ONE MATTERED ─────────────────────────────────────
 * 1. `kind` replaces a hard-coded noun map that defaulted every unknown value to "your event".
 *    The server does the same thing, which is the dangerous half: point the old component at a
 *    property description and the copy comes back written as a party invitation. The server
 *    branches ship with this.
 * 2. `format` — the original always returned HTML for a rich-text editor. The bio, both property
 *    descriptions and every enquiry field are plain textareas. Returning HTML into those would
 *    have printed tags at people.
 * 3. `onBeforeApply` — applying used to overwrite whatever the person had typed with no way back.
 *    Tolerable for a contract being drafted; not for a bio someone has kept for a year.
 * 4. Errors are surfaced. The original swallowed every failure and silently returned to the notes
 *    screen, so a dead API key looked exactly like a slow network.
 */

/** The surface being written. Each value maps to a system prompt on the server. */
export type AssistKind =
  | "contract" | "bio" | "event" | "property" | "post" | "message" | "review" | "notes";

/** What the host field accepts. Decides whether `onApply` receives HTML or plain text. */
export type AssistFormat = "html" | "text";

export interface RefineAction {
  key: string;
  label: string;
  /** Server-canned verb. Preferred — it carries the preservation rule. */
  action?: "shorter" | "longer" | "plainer" | "firmer";
  /** Free text, for something a product genuinely needs and the verbs do not cover. */
  instruction?: string;
}

export interface AiWritingAssistProps {
  open: boolean;
  onClose: () => void;
  kind: AssistKind;
  /** Header text — "Contract description", "Your bio", "Property description". */
  fieldLabel: string;
  /** Second-person noun for the prompt copy: "the job", "yourself", "this place". */
  subject: string;
  notesPlaceholder?: string;
  title?: string;
  category?: string;
  /** Facts that live in their OWN fields and must not be restated in the prose. */
  excludeFacts?: readonly string[];
  format: AssistFormat;
  charLimit?: number;
  /** Existing content — the source when the notes box is empty. The "just polish what I have" path. */
  currentValue?: string;
  onApply: (value: string) => void;
  /** Receives the pre-assist value so the host can offer an undo. */
  onBeforeApply?: (previousValue: string) => void;
  autoRecord?: boolean;
  maxSeconds?: number;
  refineActions?: readonly RefineAction[];
}

const COMPOSE_URL = `${SUPABASE_URL}/functions/v1/compose-description`;

/**
 * WHICH KINDS THE **DEPLOYED** FUNCTION ACTUALLY UNDERSTANDS.
 * ============================================================================================
 * Max, 10 Aug 2026: *"v8 requires the compose-description edge patch to deploy with it, and I
 * will not push a client that depends on an undeployed edge-function patch."* He is right, and
 * the reason is worse than a missing feature.
 *
 * The live function (v10) chooses its writing style from `type` and sends **anything it does not
 * recognise to the EVENT prompt** — "a vivid, COMPELLING public event listing that makes people
 * want to attend." So against the deployed function, a Medellín apartment comes back written as
 * a party invitation. Not an error, not an empty box: confident, wrong, promotional copy about
 * somebody's home, on a platform whose promise is that listings here are straight.
 *
 * So this is not gated on a preference. It is gated on what is really deployed, and it uses the
 * pattern Lee has already approved twice — Apple sign-in and Google Places both light up when the
 * thing behind them exists, with no code change and no second deploy:
 *
 *   · With the patch NOT deployed (today), a kind outside this set renders **nothing at all** —
 *     no button, no modal, no dead control. The field is a plain description box, exactly as it
 *     was before, and nobody is offered a feature that would lie to them.
 *   · Set `VITE_COMPOSE_V11=1` at build time the moment Lee deploys `PATCH_v11.md`, and every
 *     kind lights up. One env var, no code change.
 *
 * `contract`, `bio` and `event` are NOT gated: those three are the branches the live function has
 * handled correctly for weeks on OneJob and OneEvent, and gating them would take a working
 * feature away from two shipped products to solve a problem they do not have.
 */
export const COMPOSE_V11_DEPLOYED =
  String((import.meta as any).env?.VITE_COMPOSE_V11 ?? "") === "1";

const SERVER_KNOWN_KINDS: readonly AssistKind[] = ["contract", "bio", "event"];

/** Can the deployed function write this kind without turning it into an event advert? */
export const canAssist = (kind: AssistKind): boolean =>
  COMPOSE_V11_DEPLOYED || SERVER_KNOWN_KINDS.includes(kind);

/* Defaults per kind. A contract wants "firmer"; a bio does not — offering a bio a "more legal"
   button is how you get a bio that reads like a contract. */
const DEFAULT_REFINE: Record<AssistKind, RefineAction[]> = {
  contract: [
    { key: "firmer", label: "More precise", action: "firmer" },
    { key: "shorter", label: "Shorter", action: "shorter" },
    { key: "longer", label: "Longer", action: "longer" },
  ],
  bio:      [{ key: "shorter", label: "Shorter", action: "shorter" },
             { key: "plainer", label: "Simpler", action: "plainer" },
             { key: "longer",  label: "Longer",  action: "longer"  }],
  property: [{ key: "shorter", label: "Shorter", action: "shorter" },
             { key: "longer",  label: "More detail", action: "longer" },
             { key: "plainer", label: "Simpler", action: "plainer" }],
  event:    [{ key: "shorter", label: "Shorter", action: "shorter" },
             { key: "longer",  label: "Longer",  action: "longer"  }],
  post:     [{ key: "shorter", label: "Shorter", action: "shorter" },
             { key: "plainer", label: "Simpler", action: "plainer" }],
  message:  [{ key: "shorter", label: "Shorter", action: "shorter" },
             { key: "plainer", label: "Warmer",  action: "plainer" }],
  review:   [{ key: "shorter", label: "Shorter", action: "shorter" },
             { key: "plainer", label: "Simpler", action: "plainer" }],
  notes:    [{ key: "shorter", label: "Shorter", action: "shorter" }],
};

type Stage = "input" | "generating" | "review";

export default function AiWritingAssist({
  open, onClose, kind, fieldLabel, subject, notesPlaceholder,
  title, category, excludeFacts, format, charLimit,
  currentValue, onApply, onBeforeApply,
  autoRecord = false, maxSeconds = 120, refineActions,
}: AiWritingAssistProps) {
  const { lang } = useI18n();
  /* See `canAssist` above. Rendering nothing is deliberate and is checked BEFORE any other hook
     runs would be wrong — hooks must not be conditional — so the guard sits at the return below,
     next to the `open` guard it belongs with. */
  const es = lang === "es" || lang === "co";
  const [stage, setStage] = useState<Stage>("input");
  const [notes, setNotes] = useState("");
  const [resultHtml, setResultHtml] = useState("");
  const [refining, setRefining] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const {
    listening, transcript, visualizerBars, startRecording, stopRecording,
  } = useVoiceTranscription() as any;

  const chips = refineActions ?? DEFAULT_REFINE[kind];

  useEffect(() => {
    if (!open) { setStage("input"); setNotes(""); setResultHtml(""); setErr(null); return; }
    if (autoRecord) { try { startRecording?.(); } catch { /* mic refused; typing still works */ } }
  }, [open, autoRecord]);

  const liveNotes = useMemo(
    () => (listening && transcript ? transcript : notes),
    [listening, transcript, notes]);

  /**
   * The call. Kept as a raw `fetch` rather than `supabase.functions.invoke` on purpose — the
   * response is SSE-streamed and `invoke` buffers it, which would turn a progressive answer into
   * a long silence followed by a wall of text.
   */
  async function compose(body: Record<string, unknown>): Promise<string> {
    let out = "";
    const resp = await fetch(COMPOSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ ...body, lang }),
    });
    if (!resp.ok) {
      /* 429 is the new per-user rate limit. Say so plainly rather than looking broken. */
      throw new Error(resp.status === 429
        ? (es ? "Demasiadas solicitudes. Espere un momento e inténtelo de nuevo."
              : "Too many requests just now. Give it a moment and try again.")
        : (es ? "No se pudo generar el texto. Inténtelo de nuevo."
              : "Could not generate the text. Please try again."));
    }
    if (!resp.body) return out;
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const js = line.slice(6).trim();
        if (js === "[DONE]") break;
        try { out += JSON.parse(js).choices?.[0]?.delta?.content || ""; } catch { /* partial frame */ }
      }
    }
    return out.trim();
  }

  const asOutput = (raw: string) => {
    const capped = charLimit ? raw.slice(0, charLimit) : raw;
    return format === "html" ? markdownToHtml(capped) : capped;
  };

  async function generate() {
    const raw = (listening ? liveNotes : notes).trim()
      || stripRichTextHtml(currentValue || "").trim();
    if (!raw) return;
    if (listening) stopRecording?.();
    setErr(null);
    setStage("generating");
    try {
      const out = await compose({
        notes: raw, type: kind, subject, title, category, charLimit,
        excludeFacts: excludeFacts ?? [],
      });
      if (!out) throw new Error(es ? "No llegó texto." : "No text came back.");
      setResultHtml(asOutput(out));
      setStage("review");
    } catch (e: any) {
      setErr(e?.message || (es ? "Algo salió mal." : "Something went wrong."));
      setStage("input");
    }
  }

  async function refine(r: RefineAction) {
    const current = format === "html" ? stripRichTextHtml(resultHtml).trim() : resultHtml.trim();
    if (!current || refining) return;
    setRefining(r.key);
    setErr(null);
    try {
      /* The server's own refine mode, which carries the preservation rule — "every commitment,
         obligation, deliverable and condition present in the original MUST still be present".
         The original client faked refine by stuffing an instruction into a compose call, which
         meant a "make it shorter" could quietly drop a contractual obligation. */
      const out = await compose({
        mode: "refine", type: kind, subject, existing: current,
        action: r.action, instruction: r.instruction, charLimit,
      });
      if (out) setResultHtml(asOutput(out));
    } catch (e: any) {
      setErr(e?.message || (es ? "No se pudo ajustar." : "Could not refine that."));
    } finally {
      setRefining(null);
    }
  }

  function apply() {
    onBeforeApply?.(currentValue ?? "");
    onApply(resultHtml);
    onClose();
  }

  /* Not open, or the deployed function cannot write this kind — render nothing. Placed here,
     AFTER every hook, because a conditional early return above them would break the rules of
     hooks the moment somebody adds one. */
  if (!open || !canAssist(kind)) return null;

  const secondsLeft = Math.max(0, maxSeconds - Math.floor((visualizerBars?.length ?? 0) / 8));

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => stage !== "generating" && onClose()}>
      <div className="glass-modal max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-black tracking-tight">{fieldLabel}</h2>
            <p className="text-[12.5px] opacity-60">
              {es ? `Describa ${subject} en voz alta y VAIA lo redacta.`
                  : `Describe ${subject} out loud and VAIA writes it for you.`}
            </p>
          </div>
          {stage !== "generating" && (
            <button onClick={onClose} aria-label={es ? "Cerrar" : "Close"}
              className="ow-tap shrink-0 rounded-full p-1.5 text-xl leading-none opacity-55">×</button>
          )}
        </div>

        {err && (
          <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] font-semibold text-red-600 dark:text-red-400">
            {err}
          </p>
        )}

        {stage === "input" && (
          <>
            <textarea
              className="input mt-3 min-h-[140px] w-full"
              value={listening ? liveNotes : notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={notesPlaceholder
                || (es ? "Hable o escriba sus notas…" : "Speak or type your notes…")} />

            <div className="mt-2 flex items-center gap-2">
              <button type="button"
                onClick={() => (listening ? stopRecording?.() : startRecording?.())}
                className={`ow-tap flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold transition active:scale-95 ${
                  listening ? "bg-red-500/15 text-red-600 dark:text-red-400"
                            : "border border-brand/35 text-brand hover:bg-brand/10"}`}>
                <span className={listening ? "inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" : ""} />
                {listening ? (es ? `Detener · ${secondsLeft}s` : `Stop · ${secondsLeft}s`)
                           : (es ? "Hablar" : "Speak")}
              </button>
              <span className="text-[11.5px] opacity-55">
                {es ? "Hablar es más rápido que escribir." : "Talking is faster than typing."}
              </span>
            </div>

            {/* The "I already wrote this somewhere else" path, made visible. It worked before but
                only if you guessed that pasting into the notes box and pressing Generate on an
                otherwise-empty box would polish it. Nobody guesses that. */}
            {!!(currentValue && stripRichTextHtml(currentValue).trim()) && !notes.trim() && (
              <p className="mt-2 text-[11.5px] leading-relaxed opacity-60">
                {es ? "¿Ya lo tiene escrito? Péguelo arriba, o pulse Generar y VAIA mejorará lo que ya está en el campo."
                    : "Already written it somewhere? Paste it above, or press Generate and VAIA will polish what is already in the field."}
              </p>
            )}

            <button type="button" onClick={generate}
              disabled={!((listening ? liveNotes : notes).trim() || stripRichTextHtml(currentValue || "").trim())}
              className="btn-primary mt-4 w-full disabled:opacity-40">
              {es ? "Generar" : "Generate"}
            </button>
          </>
        )}

        {stage === "generating" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <VaiaFace size={80} />
            <p className="text-[13.5px] font-semibold opacity-70">
              {es ? "VAIA está redactando…" : "VAIA is writing…"}
            </p>
          </div>
        )}

        {stage === "review" && (
          <>
            <div className="mt-3">
              {format === "html"
                ? <RichTextEditor value={resultHtml} onChange={setResultHtml} />
                : <textarea className="input min-h-[180px] w-full" value={resultHtml}
                    onChange={e => setResultHtml(e.target.value)} />}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map(c => (
                <button key={c.key} type="button" onClick={() => refine(c)} disabled={!!refining}
                  className="ow-tap rounded-full border border-brand/35 px-3 py-1.5 text-[12px] font-bold text-brand transition hover:bg-brand/10 disabled:opacity-40">
                  {refining === c.key ? (es ? "…" : "…") : c.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStage("input")}
                className="ow-tap flex-1 rounded-2xl border border-ink/20 py-3 text-[14px] font-bold dark:border-white/20">
                {es ? "Volver" : "Back"}
              </button>
              <button type="button" onClick={apply} className="btn-primary flex-[2]">
                {es ? "Usar este texto" : "Use this text"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body);
}
