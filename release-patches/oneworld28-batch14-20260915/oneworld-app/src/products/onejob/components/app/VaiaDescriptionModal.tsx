import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Mic, Square, Sparkles, X, Loader2 } from "lucide-react";
import { useVoiceTranscription } from "@job/components/ui/VoiceTranscribeButton";
import { RichTextEditor, stripRichTextHtml } from "@job/components/ui/rich-text-editor";
import { useAiAssistant } from "@job/contexts/AiAssistantContext";
import VaiaFace from "@job/components/VaiaFace";
import { useI18n } from "@job/lib/i18n";
import { markdownToHtml } from "@job/lib/mdToHtml";

// The OneSocial "VAIA • <field>" composer modal, rebuilt for OneEvent: speak-or-type
// notes → VAIA writes a full, richly-sectioned description → review & edit → use.
// Same working live transcription as the rest of OneEvent, dark + light mode. (Lee, Jul 22)
const CHAT_URL = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/compose-description";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";

const MAX_SECONDS = 120;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VaiaDescriptionModal({
  open, onClose, type, title, category, charLimit, currentDescription, fieldLabel, autoRecord, onApply,
}: {
  open: boolean;
  onClose: () => void;
  type?: string;
  title?: string;
  category?: string;
  charLimit?: number;
  currentDescription?: string;
  fieldLabel?: string;
  /**
   * Open straight into recording.
   *
   * When someone taps "Speak it" on the empty description they have ALREADY chosen to talk —
   * landing them on a screen with a mic button they must find and press again is asking the same
   * question twice, and the pause is exactly where people give up and type instead.
   * (Lee, Jul 31 2026)
   */
  autoRecord?: boolean;
  onApply: (html: string) => void;
}) {
  const { name } = useAiAssistant();
  const { lang } = useI18n();
  const voice = useVoiceTranscription();
  const listening = voice.recording;

  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<"input" | "generating" | "review">("input");
  const [resultHtml, setResultHtml] = useState("");
  const [remaining, setRemaining] = useState(MAX_SECONDS);

  const baseNotesRef = useRef("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // Reset when opened fresh.
  useEffect(() => {
    if (open) {
      setNotes("");
      setStage("input");
      setResultHtml("");
      setRemaining(MAX_SECONDS);
    } else {
      voice.cancel();
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // While listening, stream the live transcript into the notes box.
  const liveNotes = useMemo(() => {
    if (!listening) return notes;
    const base = baseNotesRef.current.trim();
    const t = voice.transcript.trim();
    return base ? (t ? `${base} ${t}` : base) : t;
  }, [listening, notes, voice.transcript]);

  // Auto-grow the textarea + keep the newest words in view (both the editable
  // textarea and the live listening panel).
  useEffect(() => {
    const ta = taRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 240) + "px"; ta.scrollTop = ta.scrollHeight; }
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [liveNotes, stage, listening]);

  // Split the live transcript so the single newest word renders highlighted — a
  // quick "that word was just heard" cue, cleared as the next word lands. (Lee, Jul 22)
  const liveWords = useMemo(() => {
    const words = liveNotes.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return { head: "", last: "" };
    return { head: words.slice(0, -1).join(" "), last: words[words.length - 1] };
  }, [liveNotes]);

  const startTimer = () => {
    setRemaining(MAX_SECONDS);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } return 0; }
        return r - 1;
      });
    }, 1000);
  };

  const onMic = () => {
    baseNotesRef.current = notes;
    voice.startRecording();
    startTimer();
  };

  /**
   * Straight into recording when the person already said "Speak it".
   *
   * Guarded on `open` transitioning true and on not already listening, so a re-render can't kick
   * off a second recogniser. One frame of delay lets the modal paint first — starting the mic on
   * the same tick as the portal mount races the permission prompt on Android and the first word
   * gets eaten.
   */
  useEffect(() => {
    if (!open || !autoRecord || voice.recording) return;
    const id = setTimeout(() => onMic(), 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRecord]);

  const onStopMic = () => {
    const t = voice.confirm();
    const base = baseNotesRef.current.trim();
    setNotes(base ? (t ? `${base} ${t}` : base) : t);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  /**
   * One trip to VAIA. Pulled out of `generate` so the refine chips on the review screen can reuse
   * exactly the same call — same endpoint, same streaming parse, same char limit. The only thing
   * that changes between "write me a description" and "make that one shorter" is what goes in
   * `notes`. (Jul 31 2026)
   */
  const compose = async (raw: string): Promise<string> => {
    let out = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ notes: raw, type: type || "event", title, category, charLimit, lang }),
      });
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
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
            try { out += JSON.parse(js).choices?.[0]?.delta?.content || ""; } catch { /* partial */ }
          }
        }
      }
    } catch { /* graceful */ }
    return out.trim();
  };

  const generate = async () => {
    const raw = (listening ? liveNotes : notes).trim() || stripRichTextHtml(currentDescription || "").trim();
    if (!raw) return;
    if (listening) onStopMic();
    setStage("generating");
    const out = await compose(raw);
    if (out) {
      setResultHtml(markdownToHtml(charLimit ? out.slice(0, charLimit) : out));
      setStage("review");
    } else {
      setStage("input"); // let them try again
    }
  };

  /**
   * Refine what VAIA just wrote, without starting over.
   *
   * Lee, Jul 31 2026 — he asked me not to lose these, and he was right that they belong here: the
   * first draft is almost never the last word. What you actually want after reading it is "same
   * thing, tighter" or "same thing, but it'd hold up if this went sideways" — not to re-dictate
   * your notes.
   *
   * The current draft goes back in as the source material with an instruction on top, so every
   * refine builds on what's on screen (including any hand edits). "Keep every fact" is in the
   * prompt on purpose: this is a CONTRACT. A rewrite that quietly drops a deliverable is worse
   * than no rewrite, and the person refining is not re-reading it line by line for omissions.
   *
   * If the call comes back empty the draft is left exactly as it was — silently reverting someone's
   * description to nothing would be unforgivable here.
   */
  const REFINE: { key: string; label: string; instruction: string }[] = [
    { key: "legal",   label: "More legal", instruction: "Rewrite it in firmer, more contractual language — clear obligations, unambiguous terms, no casual phrasing. Do not invent any new terms, prices, dates or penalties." },
    { key: "shorter", label: "Shorter",    instruction: "Rewrite it more concisely. Cut repetition and filler, keep every commitment and requirement." },
    { key: "longer",  label: "Longer",     instruction: "Expand it with more specific detail about the work described. Do not invent facts that aren't implied by what's already there." },
  ];
  const [refining, setRefining] = useState<string | null>(null);

  const refine = async (r: { key: string; instruction: string }) => {
    const current = stripRichTextHtml(resultHtml).trim();
    if (!current || refining) return;
    setRefining(r.key);
    const out = await compose(
      `Below is an existing ${type === "bio" ? "bio" : "job description"}. ${r.instruction} ` +
      `Preserve every fact, requirement and expectation it contains. Return only the rewritten version.\n\n---\n${current}`
    );
    if (out) setResultHtml(markdownToHtml(charLimit ? out.slice(0, charLimit) : out));
    setRefining(null);
  };

  const useResult = () => {
    onApply(resultHtml);
    onClose();
  };

  if (!open) return null;

  // Generate lights up only once you've stopped the mic and there's text — matches
  // OneSocial (the button stays greyed while listening). (Lee, Jul 22)
  const canGenerate = !listening && notes.trim().length > 0;
  const label = fieldLabel || "Event Description";
  // Context-aware wording so a CONTRACT/job doesn't say "your event". (Lee, Jul 24)
  const NOUN: Record<string, string> = { contract: "the job", job: "the job", bio: "yourself", event: "your event" };
  const PH: Record<string, string> = {
    contract: "Describe only the WORK itself — what will be done and any expectations: e.g. perform a 3-hour stand-up set, arrive 30 min early, smart-casual dress, greet the host, free drinks provided. Skip the date, time, location & price — those have their own fields.",
    job: "Describe only the WORK itself — what will be done and any expectations: e.g. perform a 3-hour stand-up set, arrive 30 min early, smart-casual dress, greet the host, free drinks provided. Skip the date, time, location & price — those have their own fields.",
    bio: "E.g.: I'm a wedding DJ with 8 years across Medellín — weddings, corporate, rooftop parties…",
    event: "E.g.: It's a summer rooftop party with live DJ, open bar, white dress code…",
  };
  const noun = NOUN[type || "event"] || "your event";
  const placeholder = PH[type || "event"] || PH.event;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
      onPointerDown={(e) => { if (e.target === e.currentTarget && stage !== "generating") onClose(); }}>
      <div className="glass-modal w-full max-w-[440px] overflow-hidden rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3 dark:border-white/10">
          <VaiaFace size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{name} · {label}</p>
            {charLimit ? <p className="text-xs text-ink/50 dark:text-white/50">Max {charLimit.toLocaleString()} characters</p> : null}
          </div>
          {stage !== "generating" && (
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5 dark:hover:bg-white/10">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        {stage === "input" && (
          <div className="space-y-3 p-4">
            <p className="text-sm text-ink/70 dark:text-white/70">Tell {name} about {noun} — speak or type:</p>
            <div className="relative">
              {listening ? (
                <div ref={liveRef}
                  className="min-h-[140px] max-h-[240px] w-full overflow-y-auto rounded-2xl border border-brand/40 bg-brand/[0.04] px-4 py-3 text-[15px] leading-relaxed">
                  {liveWords.last ? (
                    <p className="whitespace-pre-wrap break-words">
                      <span>{liveWords.head}{liveWords.head && " "}</span>
                      <span className="rounded bg-brand/25 px-0.5 font-bold text-brand">{liveWords.last}</span>
                    </p>
                  ) : (
                    <span className="opacity-40">Listening… start talking and your words will appear here.</span>
                  )}
                </div>
              ) : (
                <textarea
                  ref={taRef}
                  value={liveNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={placeholder}
                  className="min-h-[140px] w-full resize-none rounded-2xl border border-ink/20 bg-ink/[0.02] px-4 py-3 pr-14 text-[15px] leading-relaxed outline-none focus:border-brand/50 dark:border-white/15 dark:bg-white/5"
                />
              )}
              {!listening && (
                <button type="button" onClick={onMic} title="Speak"
                  className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-ink/5 text-ink/70 hover:bg-brand/15 hover:text-brand dark:bg-white/10 dark:text-white/80">
                  <Mic size={20} />
                </button>
              )}
            </div>

            {/* ── THE RECORDING PANEL ───────────────────────────────────────────────────────
                Rebuilt Jul 31 2026 on Lee's "think about how that interface looks as far as the
                record time and everything".

                Three deliberate choices:

                · THE WAVEFORM IS REAL. It's driven by the microphone through an AnalyserNode, so
                  silence is flat and speech isn't. The version this replaces was a sine wave with
                  random jitter — it danced identically whether the mic was working, muted, or
                  denied, which made the only question a person has here ("is it hearing me?")
                  unanswerable. A visualiser that always says yes is worse than none.

                · THE CLOCK STAYS QUIET UNTIL IT MATTERS. It shows elapsed-agnostic remaining time
                  in muted grey and only turns amber and starts pulsing in the last 20 seconds.
                  A red countdown ticking for two straight minutes makes people rush and think less
                  about the work they're describing; the deadline only deserves attention when it's
                  actually near.

                · ONE BIG STOP. It was an 8×8 icon square. This is the only thing you need to hit,
                  often one-handed, sometimes with gloves on a job site — so it's a full-width
                  target that says what happens next, not a symbol you have to interpret. */}
            {listening && (() => {
              const urgent = remaining <= 20;
              const bars = voice.visualizerBars;
              return (
                <div className="rounded-2xl border border-brand/40 bg-brand/[0.06] px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-brand">
                      <span className="relative flex h-2.5 w-2.5" aria-hidden>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                      Listening…
                    </span>
                    <span className={`tabular-nums text-sm font-bold ${urgent ? "animate-pulse text-amber-500" : "text-ink/45 dark:text-white/45"}`}>
                      {fmt(remaining)}{urgent ? " left" : ""}
                    </span>
                  </div>

                  {/* Mirrored around the centre line so it reads as a waveform rather than a bar
                      chart. min-height keeps the row from collapsing during silence. */}
                  <div className="mt-3 flex h-10 items-center justify-center gap-[2px]" aria-hidden>
                    {(bars.length ? bars : new Array(40).fill(0.06)).map((v, i) => (
                      <span key={i}
                        className="w-[3px] shrink-0 rounded-full bg-brand transition-[height] duration-75"
                        style={{ height: `${Math.max(3, v * 40)}px`, opacity: 0.35 + v * 0.65 }} />
                    ))}
                  </div>

                  <button type="button" onClick={onStopMic}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-[15px] font-bold text-white transition active:scale-[.98]">
                    <Square size={15} className="fill-current" /> Stop & use this
                  </button>
                </div>
              );
            })()}

            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-2xl bg-ink/5 px-4 py-3 text-sm font-semibold hover:bg-ink/10 dark:bg-white/10 dark:hover:bg-white/15">
                Cancel
              </button>
              <button type="button" onClick={generate} disabled={!canGenerate}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand/25 disabled:opacity-40">
                <Sparkles size={15} /> Generate
              </button>
            </div>
          </div>
        )}

        {stage === "generating" && (
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-14">
            <div className="relative">
              <VaiaFace size={80} />
              <span className="absolute inset-0 grid place-items-center">
                <Loader2 size={84} className="animate-spin text-brand/50" />
              </span>
            </div>
            <p className="flex items-center gap-2 text-ink/70 dark:text-white/70">
              <Loader2 size={16} className="animate-spin text-brand" /> {name} is writing your description…
            </p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-3 p-4">
            <p className="text-sm text-ink/70 dark:text-white/70">Review {name}'s generated description:</p>
            <RichTextEditor value={resultHtml} onChange={setResultHtml} />

            {/* Refine, in place. Quiet outlined chips, not buttons that compete with "Use this
                description" — this is an optional second pass, and the primary action stays the
                obvious one. Whichever chip is working shows the spinner in its own slot so you can
                see WHAT is being redone, and the others lock so two rewrites can't race. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink/40 dark:text-white/40">Refine</span>
              {REFINE.map((r) => (
                <button key={r.key} type="button" onClick={() => refine(r)} disabled={!!refining}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand/35 px-3 py-1.5 text-[13px] font-semibold text-brand transition active:scale-95 hover:bg-brand/10 disabled:opacity-40">
                  {refining === r.key
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Sparkles size={13} />}
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => setStage("input")}
                className="rounded-2xl bg-ink/5 px-4 py-3 text-sm font-semibold hover:bg-ink/10 dark:bg-white/10 dark:hover:bg-white/15">
                Redo
              </button>
              <button type="button" onClick={useResult}
                className="flex-1 rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand/25">
                Use this description
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
export default VaiaDescriptionModal;
