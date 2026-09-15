import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Mic, Square, Sparkles, X, Loader2 } from "lucide-react";
import { useVoiceTranscription } from "@evt/components/ui/VoiceTranscribeButton";
import { RichTextEditor, stripRichTextHtml } from "@evt/components/ui/rich-text-editor";
import { useAiAssistant } from "@evt/contexts/AiAssistantContext";
import { useI18n } from "@evt/lib/i18n";
import { markdownToHtml } from "@evt/lib/mdToHtml";

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
  open, onClose, type, title, category, charLimit, currentDescription, fieldLabel, onApply, autoRecord,
}: {
  open: boolean;
  onClose: () => void;
  type?: string;
  title?: string;
  category?: string;
  charLimit?: number;
  currentDescription?: string;
  fieldLabel?: string;
  onApply: (html: string) => void;
  /** Open straight into recording — the person already chose to talk by tapping "Speak it"
      on the empty-box chooser (v19 port of OneJob's autoRecord). */
  autoRecord?: boolean;
}) {
  const { avatar, name } = useAiAssistant();
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
      if (autoRecord) {
        // They tapped "Speak it" — go straight to listening, no second tap.
        baseNotesRef.current = "";
        setTimeout(() => { voice.startRecording(); startTimerRef.current?.(); }, 150);
      }
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

  const startTimerRef = useRef<(() => void) | null>(null);
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

  startTimerRef.current = startTimer;

  const onMic = () => {
    baseNotesRef.current = notes;
    voice.startRecording();
    startTimer();
  };

  const onStopMic = () => {
    const t = voice.confirm();
    const base = baseNotesRef.current.trim();
    setNotes(base ? (t ? `${base} ${t}` : base) : t);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  /* v23 CR/CS: the ICP is a scoring rubric, not prose — it reviews as PLAIN text (no
     rich toolbar), and the compose call rides the fn's dedicated icp mode. */
  const isIcp = type === "icp";

  /** One trip to VAIA — shared by Generate and the refine chips (OneJob port, v23 CS). */
  const callComposer = async (payload: Record<string, unknown>): Promise<string> => {
    let out = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ type: type || "event", title, category, charLimit, lang, ...payload }),
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
    let out = await callComposer({ notes: raw });
    if (out) {
      if (charLimit) out = out.slice(0, charLimit);
      setResultHtml(isIcp ? out : markdownToHtml(out));
      setStage("review");
    } else {
      setStage("input"); // let them try again
    }
  };

  /* v23 CS: refine what VAIA just wrote without starting over (OneJob port). The current
     draft — including hand edits — goes back as the source; every criterion/commitment
     must survive (enforced by the fn's refine prompt). Empty response = draft untouched. */
  const REFINE_CHIPS: { key: string; label: string }[] = isIcp
    ? [{ key: "shorter", label: "Shorter" }, { key: "specific", label: "More specific" }]
    : [{ key: "shorter", label: "Shorter" }, { key: "longer", label: "Longer" }];
  const [refining, setRefining] = useState<string | null>(null);
  const refine = async (key: string) => {
    const current = isIcp ? resultHtml.trim() : stripRichTextHtml(resultHtml).trim();
    if (!current || refining) return;
    setRefining(key);
    let out = await callComposer({ mode: "refine", existing: current, action: key });
    if (out) {
      if (charLimit) out = out.slice(0, charLimit);
      setResultHtml(isIcp ? out : markdownToHtml(out));
    }
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
  /* v23 CR: context-aware wording — the ICP composer must never say "your event"
     (that's exactly the mix-up that had VAIA writing party invites as scoring rubrics). */
  const NOUN: Record<string, string> = { icp: "your ideal applicant", bio: "yourself", event: "your event" };
  const PH: Record<string, string> = {
    icp: "E.g.: Founders doing $20k+/month, actively running a business, open to sharing real numbers. Not: idea-stage explorers or people selling services to the room.",
    bio: "E.g.: I'm a wedding DJ with 8 years across Medellín — weddings, corporate, rooftop parties…",
    event: "E.g.: It's a summer rooftop party with live DJ, open bar, white dress code…",
  };
  const noun = NOUN[type || "event"] || "your event";
  const inputPlaceholder = PH[type || "event"] || PH.event;
  const resultNoun = isIcp ? "profile" : "description";

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
      onPointerDown={(e) => { if (e.target === e.currentTarget && stage !== "generating") onClose(); }}>
      <div className="glass-modal w-full max-w-[440px] overflow-hidden rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3 dark:border-white/10">
          <img src={avatar} alt={name} className="h-11 w-11 rounded-full object-cover ring-2 ring-teal/40" />
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
                  className="min-h-[140px] max-h-[240px] w-full overflow-y-auto rounded-2xl border border-teal/40 bg-teal/[0.04] px-4 py-3 text-[15px] leading-relaxed">
                  {liveWords.last ? (
                    <p className="whitespace-pre-wrap break-words">
                      <span>{liveWords.head}{liveWords.head && " "}</span>
                      <span className="rounded bg-teal/25 px-0.5 font-bold text-teal">{liveWords.last}</span>
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
                  placeholder={inputPlaceholder}
                  className="min-h-[140px] w-full resize-none rounded-2xl border border-ink/20 bg-ink/[0.02] px-4 py-3 pr-14 text-[15px] leading-relaxed outline-none focus:border-teal/50 dark:border-white/15 dark:bg-white/5"
                />
              )}
              {!listening && (
                <button type="button" onClick={onMic} title="Speak"
                  className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-ink/5 text-ink/70 hover:bg-teal/15 hover:text-teal dark:bg-white/10 dark:text-white/80">
                  <Mic size={20} />
                </button>
              )}
            </div>

            {listening && (
              <div className="flex items-center justify-between rounded-2xl border border-teal/40 bg-teal/[0.06] px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal">
                  <span className="flex items-end gap-[2px]" aria-hidden>
                    <span className="h-2.5 w-[3px] animate-pulse rounded-full bg-teal [animation-delay:-0.2s]" />
                    <span className="h-4 w-[3px] animate-pulse rounded-full bg-teal" />
                    <span className="h-2.5 w-[3px] animate-pulse rounded-full bg-teal [animation-delay:0.2s]" />
                    <span className="h-3.5 w-[3px] animate-pulse rounded-full bg-teal [animation-delay:0.1s]" />
                  </span>
                  Listening…
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-sm font-semibold text-ink/60 dark:text-white/60">{fmt(remaining)}</span>
                  <button type="button" onClick={onStopMic} title="Stop"
                    className="grid h-8 w-8 place-items-center rounded-md border-2 border-red-500 text-red-500 hover:bg-red-500/10">
                    <Square size={14} className="fill-current" />
                  </button>
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-2xl bg-ink/5 px-4 py-3 text-sm font-semibold hover:bg-ink/10 dark:bg-white/10 dark:hover:bg-white/15">
                Cancel
              </button>
              <button type="button" onClick={generate} disabled={!canGenerate}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-brand-bright to-brand-deep px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand/25 disabled:opacity-40">
                <Sparkles size={15} /> Generate
              </button>
            </div>
          </div>
        )}

        {stage === "generating" && (
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-14">
            <div className="relative">
              <img src={avatar} alt={name} className="h-20 w-20 rounded-full object-cover ring-2 ring-teal/40" />
              <span className="absolute inset-0 grid place-items-center">
                <Loader2 size={84} className="animate-spin text-teal/50" />
              </span>
            </div>
            <p className="flex items-center gap-2 text-ink/70 dark:text-white/70">
              <Loader2 size={16} className="animate-spin text-teal" /> {name} is writing your {resultNoun}…
            </p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-3 p-4">
            <p className="text-sm text-ink/70 dark:text-white/70">Review {name}'s generated {resultNoun}:</p>
            {/* v23 CR: the ICP reviews as plain text — a scoring rubric has no business
                carrying a formatting toolbar. */}
            {isIcp ? (
              <textarea
                value={resultHtml}
                onChange={(e) => setResultHtml(e.target.value)}
                rows={9}
                className="w-full resize-y rounded-2xl border border-ink/20 bg-ink/[0.02] px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-teal/50 dark:border-white/15 dark:bg-white/5"
              />
            ) : (
              <RichTextEditor value={resultHtml} onChange={setResultHtml} />
            )}
            {/* v23 CS: refine without starting over (OneJob port). */}
            <div className="flex flex-wrap items-center gap-1.5">
              {REFINE_CHIPS.map((r) => (
                <button key={r.key} type="button" disabled={!!refining} onClick={() => void refine(r.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal transition hover:bg-teal/10 disabled:opacity-50">
                  {refining === r.key ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => setStage("input")}
                className="rounded-2xl bg-ink/5 px-4 py-3 text-sm font-semibold hover:bg-ink/10 dark:bg-white/10 dark:hover:bg-white/15">
                Redo
              </button>
              <button type="button" onClick={useResult} disabled={!!refining}
                className="flex-1 rounded-2xl bg-gradient-to-r from-brand-bright to-brand-deep px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand/25 disabled:opacity-50">
                {isIcp ? "Use this profile" : "Use this description"}
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
