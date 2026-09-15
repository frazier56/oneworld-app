/**
 * VOICE DICTATION — the hook only.
 * ============================================================================================
 * Lifted from OneJob's `VoiceTranscribeButton.tsx` on 10 Aug 2026 so every product can dictate,
 * not just OneJob. Deliberately the HOOK and nothing else: the original file also exported a
 * button and a recording overlay built on `lucide-react` and `framer-motion`, and lucide is
 * BANNED in the shell (see the architecture rules). Chrome belongs to the shell; icon libraries
 * do not. Products render their own trigger and pass this hook's state into it.
 *
 * The one piece of hard-won behaviour worth not losing: mobile Web Speech quietly ENDS after a
 * short pause, so a person who stops to think loses the rest of their sentence. `wantListening`
 * tracks intent separately from the recogniser's own state and restarts it, which is why a
 * two-minute dictation survives thinking pauses.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "../../lib/i18n";

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

  /**
   * A waveform driven by what the recogniser is ACTUALLY hearing — and nothing else touching the mic.
   *
   * History worth keeping, because I got this wrong twice in one day (Jul 31 2026):
   *
   * 1. Originally this was a sine wave plus Math.random(). It animated identically whether the mic
   *    was working, muted, or denied — answering "is this hearing me?" with a confident yes even
   *    when the answer was no.
   *
   * 2. So I replaced it with a real Web Audio AnalyserNode reading a getUserMedia stream. Honest,
   *    and it worked in desktop Chrome. On Lee's Android it BROKE TRANSCRIPTION OUTRIGHT: holding a
   *    second microphone stream alongside SpeechRecognition stops the recogniser receiving audio,
   *    so the panel sat on "Listening…" and captured nothing. A truthful visualiser that kills the
   *    feature it decorates is a bad trade — dictation is the point, the animation is not.
   *
   * So: no second stream, ever. The bars are driven by the recogniser's own output — how fast text
   * is arriving. Silence produces no new characters and the wave settles flat; speaking produces a
   * steady stream and it comes alive. That is arguably a better answer than amplitude anyway, since
   * it reflects words being UNDERSTOOD rather than just noise reaching the microphone. Nothing here
   * can interfere with capture, because it only reads state capture already produces.
   */
  const startVisualizer = useCallback(() => {
    const COUNT = 40;
    let lastLen = 0;
    let energy = 0;
    let phase = 0;
    let shown = new Array(COUNT).fill(0.05);

    const tick = () => {
      const len = (transcriptRef.current + interimRef.current).length;
      const grew = Math.max(0, len - lastLen);
      lastLen = len;
      // Each burst of recognised text tops the envelope up; it bleeds away in roughly a second of
      // quiet, so pauses between sentences read as dips rather than a dead stop.
      energy = Math.min(1, energy * 0.94 + grew * 0.09);

      phase += 0.22;
      const next = Array.from({ length: COUNT }, (_, i) => {
        const wave = (Math.sin(phase + i * 0.45) + 1) / 2;
        // Centre bars swing wider than the edges — reads as a voice, not a level meter.
        const envelope = 1 - Math.abs(i - (COUNT - 1) / 2) / ((COUNT - 1) / 2) * 0.55;
        return Math.max(0.05, Math.min(1, energy * wave * envelope * 1.35));
      });
      shown = shown.map((s, i) => s + (next[i] - s) * 0.3);
      setVisualizerBars([...shown]);
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
