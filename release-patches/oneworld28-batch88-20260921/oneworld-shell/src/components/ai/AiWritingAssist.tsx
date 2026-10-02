import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../lib/i18n";
import { SUPABASE_URL, SUPABASE_ANON, supabase } from "../../lib/supabase";
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
  | "contract" | "bio" | "event" | "property" | "sale_listing"
  | "post" | "message" | "review" | "notes";

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
  /** Shown under VAIA's draft when it is at the field's limit — e.g. "Your free plan holds 1,000
   *  characters, so VAIA kept the most important parts. Pro holds 2,000 and VIP 6,000." Without
   *  it, two minutes of talking that came back as two paragraphs looked like VAIA was broken. */
  capNote?: string;
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

/* ── PROPERTY IS ON THE LIST NOW, BECAUSE THE DEPLOYED FUNCTION LEARNED IT ────────────────
   Max, 12 Sep 2026, reporting his inspection of the LIVE function rather than the patch note:
   *"The live compose-description is v21 ACTIVE... It already supports property/rental/listing/
   sale_listing compose/refine prompts and structured-field guards. No stale-v11 backend
   deployment is needed for property routing."*

   That retires the reason `property` was held back. The gate above was never about a preference;
   it was about v10 sending an unknown `type` to the EVENT prompt, so a Medellín apartment came
   back written as a party invitation. v21 has the property branch, so the gate has done its job
   and letting it stand now withholds a working feature from the one product that needs it most.

   `post`, `message`, `review` and `notes` STAY OUT. Max in the same note: *"Do NOT enable global
   VITE_COMPOSE_V11: it exposes post/message/review/notes which still fall back to event on
   current v21."* This is why the correction is a list and not the flag — the flag is all or
   nothing and four of those kinds are still wrong.

   ⚠️ IF ONEWORLD 27's ACCEPTED property-assist v2 CANDIDATE ALREADY MAKES THIS EXACT EDIT, TAKE
   THEIRS. It is the same one-line widening and the two must not both land as separate changes. */
const SERVER_KNOWN_KINDS: readonly AssistKind[] = ["contract", "bio", "event", "property", "sale_listing"];
/* `sale_listing` IS here now, and the reason is a build break rather than a preference. The app
   already passes `kind="sale_listing"` from `onesale/screens/ListProperty.tsx` (app 5876fd6 —
   Max's own finding that a sale is not a rental). The matching widening never landed in the
   shell, so `oneworld-app` did not typecheck AT ALL and nothing could be pushed. Holding a
   one-word union open for another lane's candidate cost the whole app its build.
   It is additive: no existing kind changes behaviour, and if OneWorld 27's property-assist v2
   candidate makes the same edit the two are identical and either may win. */

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
  /* A sale listing is read by a buyer, not a tenant. Same three refinements: the difference
     lives in the server prompt, not in the buttons. */
  sale_listing: [{ key: "shorter", label: "Shorter", action: "shorter" },
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

/* The chips were English on a Spanish screen — a half-translated sheet. Keyed by the English label
   so a product passing its own `refineActions` with these words is covered too. */
const ES_CHIP: Record<string, string> = {
  "Shorter": "Más corto", "Longer": "Más largo", "More detail": "Más detalle",
  "Simpler": "Más simple", "More precise": "Más preciso", "Warmer": "Más cálido",
};

type Stage = "input" | "generating" | "review";

export default function AiWritingAssist({
  open, onClose, kind, fieldLabel, subject, notesPlaceholder,
  title, category, excludeFacts, format, charLimit,
  currentValue, onApply, onBeforeApply,
  autoRecord = false, maxSeconds = 120, refineActions, capNote,
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

  /* ── THE DICTATION, RE-PORTED FROM ONEJOB'S WORKING MODAL (2 Oct 2026) ──────────────────────
     Lee, on OneHome's description: *"it says speak it, but then when you speak it, you have to push
     speak again… I see where it says stop 115 seconds, but I don't think it's really working."*
     The 10 Aug lift kept the hook and lost the wiring around it. Four faults, all here:
       1. Stop called `stopRecording`, which the hook never had — `as any` hid it, so Stop did
          nothing and the recogniser ran on.
       2. The countdown was `visualizerBars.length / 8`. The bar array is always 40 long, so it
          read "115s" forever — a frozen clock that made a live microphone look dead.
       3. Nothing moved the transcript into the notes when listening ended, so what you said
          vanished and Generate stayed grey.
       4. "Speak it" opened the modal without `autoRecord`, so you were asked twice.
     The flow below is OneJob's (`onejob/components/app/VaiaDescriptionModal.tsx`): base notes +
     live transcript, a real one-second clock, one big Stop, and the text committed on every way
     listening can end — Stop, the time limit, or the browser giving up. */
  const voice = useVoiceTranscription();
  const listening: boolean = voice.listening;
  const [remaining, setRemaining] = useState(maxSeconds);
  const baseNotesRef = useRef("");
  const committedRef = useRef(true);
  const wasListeningRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const chips = refineActions ?? DEFAULT_REFINE[kind];

  const stopTimer = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  function startMic() {
    baseNotesRef.current = notes;
    committedRef.current = false;
    setErr(null);
    voice.startRecording();
    setRemaining(maxSeconds);
    stopTimer();
    tickRef.current = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
  }

  /** Base notes + what was heard → the editable notes. Runs once per recording, however it ended. */
  function commitMic() {
    if (committedRef.current) return;
    committedRef.current = true;
    stopTimer();
    const heard = voice.confirm();
    const base = baseNotesRef.current.trim();
    setNotes(base ? (heard ? `${base} ${heard}` : base) : heard);
  }

  // Reset on open; on close, drop the microphone.
  useEffect(() => {
    if (open) { setStage("input"); setNotes(""); setResultHtml(""); setErr(null); setRemaining(maxSeconds); return; }
    committedRef.current = true;
    stopTimer();
    voice.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Straight into listening when the person already chose to speak. One short delay lets the sheet
     paint first — starting the mic on the mount tick races the Android permission prompt and the
     first word is lost (OneJob, 31 Jul). */
  useEffect(() => {
    if (!open || !autoRecord) return;
    const id = setTimeout(() => startMic(), 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRecord]);

  // Listening ended without Stop — time limit, blocked microphone, browser gave up. Keep the words.
  useEffect(() => {
    if (wasListeningRef.current && !listening) commitMic();
    wasListeningRef.current = listening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  useEffect(() => { if (listening && remaining === 0) commitMic(); /* eslint-disable-line */ }, [remaining]);
  useEffect(() => () => stopTimer(), []);

  const liveNotes = useMemo(() => {
    if (!listening) return notes;
    const base = baseNotesRef.current.trim();
    const t = String(voice.transcript || "").trim();
    return base ? (t ? `${base} ${t}` : base) : t;
  }, [listening, notes, voice.transcript]);

  useEffect(() => { if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight; }, [liveNotes]);

  // The newest word lit up — the "it heard that" cue Lee asked for on 22 Jul.
  const liveWords = useMemo(() => {
    const w = liveNotes.trim().split(/\s+/).filter(Boolean);
    return w.length ? { head: w.slice(0, -1).join(" "), last: w[w.length - 1] } : { head: "", last: "" };
  }, [liveNotes]);

  const micError = voice.error === "blocked"
    ? (es ? "El micrófono está bloqueado. Permítalo para este sitio en el navegador, o escriba." : "The microphone is blocked. Allow it for this site in your browser, or type instead.")
    : voice.error === "no-mic"
    ? (es ? "No se encontró un micrófono. Puede escribir." : "No microphone found. You can type instead.")
    : voice.error === "unsupported"
    ? (es ? "La voz no funciona en este navegador. Use Chrome, o escriba." : "Voice doesn't work in this browser. Use Chrome, or type instead.")
    : null;

  /**
   * The call. Kept as a raw `fetch` rather than `supabase.functions.invoke` on purpose — the
   * response is SSE-streamed and `invoke` buffers it, which would turn a progressive answer into
   * a long silence followed by a wall of text.
   */
  /* A stalled stream must never lock the sheet: one minute, or the person's own Cancel. */
  const abortRef = useRef<AbortController | null>(null);
  const failText = es ? "No se pudo generar el texto. Inténtelo de nuevo." : "Could not generate the text. Please try again.";
  async function compose(body: Record<string, unknown>): Promise<string> {
    let out = "";
    const ctl = new AbortController(); abortRef.current = ctl;
    const timer = setTimeout(() => ctl.abort(), 60_000);
    try {
    /* The member's own session when there is one, so the server can tell who is asking (and
       limit per person); the public key only when signed out. */
    const token = (await supabase.auth.getSession().catch(() => null))?.data?.session?.access_token ?? SUPABASE_ANON;
    const resp = await fetch(COMPOSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
      body: JSON.stringify({ ...body, lang }),
      signal: ctl.signal,
    });
    /* A JSON answer is the function talking about a problem ("No notes provided.", "Composer
       temporarily unavailable.") — even on a 200. Reading it as a stream found no `data:` lines
       and reported "No text came back", which told nobody anything. */
    if (resp.ok && !/event-stream/.test(resp.headers.get("content-type") || "")) {
      await resp.json().catch(() => null);   // the server's English wording is never shown as-is
      throw new Error(failText);
    }
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
    } catch (e: any) {
      /* Network drops ("Failed to fetch"), time-outs and cancels arrive in English from the
         browser. Only our own, already-translated messages pass through. */
      if (e?.name === "AbortError") throw Object.assign(new Error(es ? "Se canceló. Puede intentarlo de nuevo." : "Stopped. You can try again."), { mine: true });
      if (e?.message === failText || /Demasiadas|Too many|No llegó|No text/.test(e?.message ?? "")) throw Object.assign(e, { mine: true });
      throw Object.assign(new Error(failText), { mine: true });
    } finally { clearTimeout(timer); if (abortRef.current === ctl) abortRef.current = null; }
  }

  /* The server writes Markdown. A plain-text field (both property descriptions, the bio) used to
     receive it raw, so the listing read "## The Space" and "**balcony**" with the symbols
     showing. Plain fields now get plain text: headings become their own line, bullets become "•". */
  const toPlain = (md: string) => md
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.*?\S|\S)\*(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const asOutput = (raw: string) => {
    const capped = charLimit ? raw.slice(0, charLimit) : raw;
    return format === "html" ? markdownToHtml(capped) : toPlain(capped);
  };

  async function generate() {
    if (listening) return; // Generate is off while the microphone is open — Stop first.
    const raw = notes.trim() || stripRichTextHtml(currentValue || "").trim();
    if (!raw) return;
    setErr(null);
    setStage("generating");
    try {
      const req = { notes: raw, type: kind, subject, title, category, charLimit, excludeFacts: excludeFacts ?? [] };
      /* One quiet retry on an empty answer: the model occasionally ends a stream with nothing in
         it, and a second ask almost always lands. Two empties is a real fault and is shown. */
      let out = await compose(req);
      if (!out) out = await compose(req);
      if (!out) throw new Error(es ? "No llegó texto." : "No text came back.");
      setResultHtml(asOutput(out));
      setStage("review");
    } catch (e: any) {
      setErr(e?.mine ? e.message : failText);
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
      setErr(e?.mine ? e.message : (es ? "No se pudo ajustar." : "Could not refine that."));
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

  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const urgent = remaining <= 20;
  const canGenerate = !listening && !!(notes.trim() || stripRichTextHtml(currentValue || "").trim());

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => stage !== "generating" && onClose()}>
      <div className="glass-modal max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
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

        {micError && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] font-semibold text-amber-700 dark:text-amber-300">
            {micError}
          </p>
        )}

        {stage === "input" && (
          <>
            {/* While listening the box is READ-ONLY and shows what is being heard. Lee: *"once you
                click it… you can still enter it in and start typing, which is a little weird."*
                Typing into a box the microphone is also writing to is two hands on one pen. Stop,
                and it becomes an ordinary editable box with everything you said in it. */}
            {listening ? (
              <div ref={liveRef} aria-live="polite"
                className="mt-3 max-h-[240px] min-h-[140px] w-full overflow-y-auto rounded-2xl border border-brand/40 bg-brand/[0.04] px-4 py-3 text-[15px] leading-relaxed">
                {liveWords.last ? (
                  <p className="whitespace-pre-wrap break-words">
                    <span>{liveWords.head}{liveWords.head && " "}</span>
                    <span className="rounded bg-brand/25 px-0.5 font-bold text-brand">{liveWords.last}</span>
                  </p>
                ) : (
                  <span className="opacity-45">{es ? "Escuchando… empiece a hablar y sus palabras aparecen aquí." : "Listening… start talking and your words appear here."}</span>
                )}
              </div>
            ) : (
              <textarea
                className="input mt-3 min-h-[140px] w-full"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={notesPlaceholder
                  || (es ? "Hable o escriba sus notas…" : "Speak or type your notes…")} />
            )}

            {listening ? (
              <div className="mt-3 rounded-2xl border border-brand/40 bg-brand/[0.06] px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-brand">
                    <span className="relative flex h-2.5 w-2.5" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    {es ? "Escuchando" : "Listening"}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${urgent ? "animate-pulse text-amber-500" : "opacity-45"}`}>{mmss}</span>
                </div>
                <div className="mt-3 flex h-10 items-center justify-center gap-[2px]" aria-hidden>
                  {((voice.visualizerBars as number[])?.length ? voice.visualizerBars as number[] : new Array(40).fill(0.06)).map((v, i) => (
                    <span key={i} className="w-[3px] shrink-0 rounded-full bg-brand transition-[height] duration-75"
                      style={{ height: `${Math.max(3, v * 40)}px`, opacity: 0.35 + v * 0.65 }} />
                  ))}
                </div>
                <button type="button" onClick={commitMic}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-[15px] font-bold text-white transition active:scale-[.98]">
                  <span className="inline-block h-3 w-3 rounded-[3px] bg-current" aria-hidden />
                  {es ? "Detener" : "Stop"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={startMic}
                className="ow-tap mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand bg-brand/10 py-3 text-[15px] font-bold text-brand transition active:scale-[.98]">
                <MicGlyph />
                {notes.trim() ? (es ? "Seguir hablando" : "Keep talking") : (es ? "Hablar" : "Speak")}
              </button>
            )}

            {/* The "I already wrote this somewhere else" path, made visible. */}
            {!listening && !!(currentValue && stripRichTextHtml(currentValue).trim()) && !notes.trim() && (
              <p className="mt-2 text-[11.5px] leading-relaxed opacity-60">
                {es ? "¿Ya lo tiene escrito? Pulse Generar y VAIA mejorará lo que ya está en el campo."
                    : "Already written it? Press Generate and VAIA polishes what is already in the field."}
              </p>
            )}

            <button type="button" onClick={generate} disabled={!canGenerate}
              className="btn-primary mt-3 w-full disabled:opacity-40">
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
            <button type="button" onClick={() => abortRef.current?.abort()}
              className="ow-edge ow-tap mt-1 rounded-full border px-4 py-2 text-[13px] font-bold">
              {es ? "Cancelar" : "Cancel"}
            </button>
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

            {!!(capNote && charLimit && stripRichTextHtml(resultHtml).length >= charLimit * 0.9) && (
              <p className="mt-2 rounded-xl bg-brand/[0.07] px-3 py-2 text-[12px] leading-snug opacity-80">{capNote}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map(c => (
                <button key={c.key} type="button" onClick={() => refine(c)} disabled={!!refining}
                  className="ow-tap rounded-full border border-brand/35 px-3 py-1.5 text-[12px] font-bold text-brand transition hover:bg-brand/10 disabled:opacity-40">
                  {refining === c.key ? "…" : (es ? (ES_CHIP[c.label] ?? c.label) : c.label)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStage("input")}
 className="ow-edge ow-tap flex-1 rounded-2xl border py-3 text-[14px] font-bold ">
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

/** Microphone, drawn inline — the shell carries no icon library. */
export function MicGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
    </svg>
  );
}
