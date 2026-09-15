import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, X, Check, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@evt/lib/i18n";

const MAX_DURATION_MS = 2 * 60 * 1000; // 2 minutes

function normalizeTranscriptText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function mergeTranscriptText(existing: string, incoming: string) {
  const base = normalizeTranscriptText(existing);
  const next = normalizeTranscriptText(incoming);

  if (!next) return base;
  if (!base) return next;
  if (base === next || base.endsWith(` ${next}`)) return base;

  const baseWords = base.split(" ");
  const nextWords = next.split(" ");
  const maxOverlap = Math.min(baseWords.length, nextWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    const baseTail = baseWords.slice(-overlap).join(" ").toLowerCase();
    const nextHead = nextWords.slice(0, overlap).join(" ").toLowerCase();

    if (baseTail === nextHead) {
      return normalizeTranscriptText([...baseWords, ...nextWords.slice(overlap)].join(" "));
    }
  }

  return `${base} ${next}`;
}

interface VoiceTranscribeButtonProps {
  onTranscript: (text: string) => void;
  onPreviewChange?: (text: string) => void;
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
  size?: number;
  /** If true, the component renders the full recording overlay. If false, just the mic button. */
  showTranscriptPreview?: boolean;
  /** External control: render recording UI externally */
  renderRecordingUI?: boolean;
}

/** Hook to manage voice transcription state */
export function useVoiceTranscription() {
  const { lang } = useI18n();
  const [recording, setRecording] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [visualizerBars, setVisualizerBars] = useState<number[]>([]);
  const recognitionRef = useRef<any>(null);
  const stoppingRef = useRef(false);
  // True while the user wants to keep dictating. Mobile Web Speech quietly ends
  // after a short pause; we use this to auto-restart so capture never drops out
  // mid-sentence and the panel doesn't "listen" to nothing. (Lee, Jul 22)
  const wantListeningRef = useRef(false);
  const transcriptRef = useRef("");
  const interimRef = useRef("");
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopVisualizer = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setVisualizerBars([]);
  }, []);

  const startVisualizer = useCallback(() => {
    let phase = 0;
    const count = 40;
    const tick = () => {
      phase += 0.18;
      const bars = Array.from({ length: count }, (_, index) => {
        const wave = (Math.sin(phase + index * 0.42) + 1) / 2;
        const jitter = Math.random() * 0.18;
        return Math.max(0.1, Math.min(0.95, wave * 0.58 + jitter));
      });
      setVisualizerBars(bars);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const finalizeRecognition = useCallback((keepPanelOpen: boolean) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    recognitionRef.current = null;
    setListening(false);
    stopVisualizer();
    if (!keepPanelOpen) {
      setRecording(false);
    }
    stoppingRef.current = false;
  }, [stopVisualizer]);

  const stopRecognition = useCallback((keepPanelOpen: boolean) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    stoppingRef.current = true;
    wantListeningRef.current = false;

    if (!recognition) {
      finalizeRecognition(keepPanelOpen);
      return;
    }

    recognition.onend = () => finalizeRecognition(keepPanelOpen);
    recognition.onerror = null;

    try {
      recognition.stop();
    } catch {
      finalizeRecognition(keepPanelOpen);
    }
  }, [finalizeRecognition]);

  // Build a fresh SpeechRecognition instance wired to our handlers. Kept separate
  // so onend can transparently spin up a new one when the browser ends the
  // session after a pause — the accumulated transcriptRef is preserved across
  // restarts, so the user can pause to think and keep going. (Lee, Jul 22)
  const buildRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang === "es" ? "es-ES" : (navigator.language || "en-US");

    recognition.onresult = (event: any) => {
      let nextFinal = transcriptRef.current;
      let nextInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const txt = normalizeTranscriptText(event.results[i][0]?.transcript ?? "");
        if (!txt) continue;

        if (event.results[i].isFinal) {
          nextFinal = mergeTranscriptText(nextFinal, txt);
        } else {
          nextInterim = mergeTranscriptText(nextInterim, txt);
        }
      }

      transcriptRef.current = nextFinal;
      interimRef.current = nextInterim;
      setTranscript(mergeTranscriptText(transcriptRef.current, interimRef.current));
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      if (event.error === "aborted" && stoppingRef.current) return;
      // Transient error (e.g. network) while the user still wants to talk — let
      // onend handle the restart instead of tearing the panel down.
      if (wantListeningRef.current && !stoppingRef.current) return;
      finalizeRecognition(true);
    };

    recognition.onend = () => {
      // The user is still dictating and didn't press Stop → the browser ended the
      // session on a pause. Fold any pending interim into the final transcript and
      // start a new session so capture continues seamlessly.
      if (wantListeningRef.current && !stoppingRef.current) {
        transcriptRef.current = mergeTranscriptText(transcriptRef.current, interimRef.current);
        interimRef.current = "";
        try {
          const next = buildRecognition();
          if (next) {
            recognitionRef.current = next;
            next.start();
            return;
          }
        } catch { /* fall through to finalize */ }
      }
      finalizeRecognition(true);
    };

    return recognition;
  }, [finalizeRecognition, lang]);

  const startRecording = useCallback((options?: { appendTranscript?: string }) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (recognitionRef.current) return;

    const initialTranscript = normalizeTranscriptText(options?.appendTranscript ?? "");

    const recognition = buildRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    stoppingRef.current = false;
    wantListeningRef.current = true;
    transcriptRef.current = initialTranscript;
    interimRef.current = "";
    setTranscript(initialTranscript);

    try {
      recognition.start();
      setRecording(true);
      setListening(true);
      startVisualizer();
      timerRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          stopRecognition(true);
        }
      }, MAX_DURATION_MS);
    } catch (err: any) {
      recognitionRef.current = null;
      wantListeningRef.current = false;
      setRecording(false);
      setListening(false);
      if (err.name === "NotAllowedError") {
        alert("Microphone permission denied. Please allow microphone access in your browser settings.");
      }
      stopVisualizer();
    }
  }, [buildRecognition, startVisualizer, stopRecognition, stopVisualizer]);

  const getTranscriptText = useCallback(() => {
    return normalizeTranscriptText(mergeTranscriptText(transcriptRef.current, interimRef.current));
  }, []);

  const setTranscriptText = useCallback((text: string) => {
    const normalized = normalizeTranscriptText(text);
    transcriptRef.current = normalized;
    interimRef.current = "";
    setTranscript(normalized);
  }, []);

  const stopListening = useCallback(() => {
    const text = getTranscriptText();
    stopRecognition(true);
    return text;
  }, [getTranscriptText, stopRecognition]);

  const confirm = useCallback(() => {
    const text = getTranscriptText();
    stopRecognition(false);
    setTranscript("");
    transcriptRef.current = "";
    interimRef.current = "";
    return text;
  }, [getTranscriptText, stopRecognition]);

  const cancel = useCallback(() => {
    stopRecognition(false);
    setTranscript("");
    transcriptRef.current = "";
    interimRef.current = "";
  }, [stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch {}
      }
      stopVisualizer();
    };
  }, [stopVisualizer]);

  return { recording, listening, transcript, visualizerBars, startRecording, stopListening, confirm, cancel, setTranscriptText };
}

/** Recording overlay UI — render this ABOVE the input bar */
export function VoiceRecordingOverlay({
  transcript,
  visualizerBars,
  isListening = true,
  onCancel,
  onConfirm,
  onResume,
  onTranscriptChange,
  onSend,
}: {
  transcript: string;
  visualizerBars: number[];
  isListening?: boolean;
  onCancel: () => void;
  /** Called when user clicks the check mark — puts text into input for editing */
  onConfirm: () => void;
  onResume?: () => void;
  onTranscriptChange?: (text: string) => void;
  /** @deprecated Use onConfirm instead. Legacy send shortcut. */
  onSend?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript to bottom as words populate
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex flex-col gap-2 w-full px-3 pb-2"
    >
      {/* Transcript preview above visualizer */}
      {(transcript || !isListening) && (
        <div ref={scrollRef} className="w-full max-h-[40vh] overflow-y-auto rounded-xl bg-muted/40 border border-border p-3">
          {isListening || !onTranscriptChange ? (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              {transcript || "Listening…"}
            </p>
          ) : (
            <textarea
              value={transcript}
              onChange={(event) => onTranscriptChange(event.target.value)}
              className="min-h-[160px] w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Review and edit your transcript before using it."
            />
          )}
        </div>
      )}

      {/* Visualizer row with cancel and confirm (check mark) */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={onCancel}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          title="Cancel"
          type="button"
        >
          <X size={18} />
        </button>

        <div className="flex-1 flex items-center min-w-0 overflow-hidden rounded-full bg-muted/60 px-3 py-2 border border-border">
          <div className="flex items-center justify-center gap-[1.5px] h-8 w-full">
            {isListening && visualizerBars.length > 0 ? (
              visualizerBars.map((v, i) => (
                <div
                  key={i}
                  className="bg-primary rounded-sm"
                  style={{
                    width: '2px',
                    height: `${Math.max(8, v * 100)}%`,
                    opacity: 0.4 + v * 0.6,
                    transition: 'height 50ms linear, opacity 50ms linear',
                  }}
                />
              ))
            ) : !isListening ? (
              onResume ? (
                <button
                  type="button"
                  onClick={onResume}
                  className="flex items-center justify-center gap-2 w-full rounded-full px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Mic size={14} />
                  Continue dictation
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">Review your transcript, then confirm.</span>
              )
            ) : (
              <div className="flex items-center justify-center gap-2 w-full">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-[11px] text-muted-foreground">Listening…</span>
              </div>
            )}
          </div>
        </div>

        {isListening ? (
          <button
            onClick={onConfirm}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground transition-colors hover:opacity-90"
            title="Stop listening"
            type="button"
          >
            <Check size={18} />
          </button>
        ) : (
          <button
            onClick={onSend ?? onConfirm}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground transition-colors hover:opacity-90"
            title="Use transcript"
            type="button"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** Simple mic button — just triggers recording start */
export default function VoiceTranscribeButton({
  onTranscript,
  onPreviewChange,
  onRecordingChange,
  disabled,
  size = 20,
  showTranscriptPreview = true,
}: VoiceTranscribeButtonProps) {
  const { recording, listening, transcript, visualizerBars, startRecording, stopListening, confirm, cancel, setTranscriptText } = useVoiceTranscription();

  // Sync recording state up
  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  // Sync transcript preview up
  useEffect(() => {
    onPreviewChange?.(transcript);
  }, [transcript, onPreviewChange]);

  if (!recording) {
    return (
      <button
        onClick={() => startRecording()}
        disabled={disabled}
        className="p-2 rounded-lg text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 flex-shrink-0"
        title="Voice input"
        type="button"
      >
        <Mic size={size} />
      </button>
    );
  }

  // When recording, render the overlay inline (legacy fallback — AppMessages uses external overlay)
  if (!showTranscriptPreview) {
    // Minimal: just show recording indicator, parent handles UI
    return (
      <button
        onClick={() => {
          const text = confirm();
          if (text) onTranscript(text);
        }}
        className="p-2 rounded-lg text-primary transition-colors flex-shrink-0"
        title="Stop recording"
        type="button"
      >
        <Mic size={size} className="animate-pulse text-destructive" />
      </button>
    );
  }

  return (
    <VoiceRecordingOverlay
      transcript={transcript}
      visualizerBars={visualizerBars}
      isListening={listening}
      onCancel={cancel}
      onConfirm={() => {
        stopListening();
      }}
      onResume={() => {
        startRecording({ appendTranscript: transcript });
      }}
      onTranscriptChange={setTranscriptText}
      onSend={() => {
        const text = confirm();
        if (text) onTranscript(text);
      }}
    />
  );
}
