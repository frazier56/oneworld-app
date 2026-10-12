/**
 * VOICE DICTATION — the ONE microphone every app uses.
 * ============================================================================================
 * Lifted from OneJob's `VoiceTranscribeButton.tsx` on 10 Aug 2026 so every product can dictate.
 * Deliberately the HOOK and nothing else: products render their own trigger and pass this state in.
 *
 * ── OVERLAY 48 (6 Oct 2026): IT WRITES DOWN THE LANGUAGE IT HEARS ─────────────────────────────
 * Lee: *"whatever it listens to, it should put it back that way… If someone is speaking in Russian
 * or German, it's transcribing in the language that it hears."*
 * Browser dictation (Web Speech) listens for ONE language per session and cannot detect one. It
 * listened for the FLAG's language, so a Colombian speaking fast Spanish on the English flag got
 * English nonsense, and the writer then "wrote in English" because the notes were English nonsense.
 *
 * So there are now two engines:
 *  1. SERVER (the default). One microphone stream, cut into clips at the speaker's own pauses
 *     (`speechClips.ts`), each clip written down by `transcribe-speech` in the language actually
 *     spoken, which it also names (`spokenLang`). Works the same in every browser, Safari included.
 *  2. BROWSER (the fallback) — the old Web Speech path, listening for the flag's language. Used only
 *     when the server is not switched on, no audio arrives, or the server stops answering.
 *
 * Hard-won rules kept from before:
 *  · NEVER two microphone streams at once. A second stream beside SpeechRecognition starved it on
 *    Lee's Android (31 Jul). The server engine owns the only stream; the browser engine owns none.
 *  · Mobile Web Speech ends on a pause; `wantListening` restarts it so thinking pauses survive.
 *  · Fatal errors (blocked / no microphone) END the session and say why; they never loop (2 Oct).
 *  · The waveform shows something REAL: the microphone's own loudness on the server engine, the
 *    arrival of recognised words on the browser engine.
 *
 * Ending a recording: `finish()` waits for the last clips to be written down and returns everything.
 * While those clips are in flight `finishing` is true and `listening` stays true, so a screen that
 * commits "when listening ends" gets the whole text, not all but the last sentence.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "../../lib/i18n";
import { supabase, SUPABASE_URL, SUPABASE_ANON } from "../../lib/supabase";
import { ClipCutter, downsample, encodeWav, bytesToBase64, CLIP_RATE } from "./speechClips";

const MAX_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const TRANSCRIBE_URL = `${SUPABASE_URL}/functions/v1/transcribe-speech`;

export type VoiceError = "unsupported" | "blocked" | "no-mic" | "lost";

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

/* ── Is the server engine switched on? Asked once per page load, then remembered. ───────────── */
let serverState: "unknown" | "on" | "off" = "unknown";
let serverProbe: Promise<boolean> | null = null;

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await supabase.auth.getSession().catch(() => null))?.data?.session?.access_token ?? SUPABASE_ANON;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON };
}

function probeServer(): Promise<boolean> {
  if (serverState !== "unknown") return Promise.resolve(serverState === "on");
  if (serverProbe) return serverProbe;
  serverProbe = (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(TRANSCRIBE_URL, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ probe: true }), signal: ctl.signal });
      clearTimeout(t);
      serverState = r.ok ? "on" : "off";
    } catch { serverState = "off"; }
    serverProbe = null;
    return serverState === "on";
  })();
  return serverProbe;
}

/** One clip → text. Throws on failure so the caller can retry once. */
async function transcribeClip(wavB64: string, lang: string, context: string): Promise<{ text: string; language: string | null }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    const r = await fetch(TRANSCRIBE_URL, {
      method: "POST", headers: await authHeaders(), signal: ctl.signal,
      body: JSON.stringify({ audio: wavB64, lang, context: context.slice(-300) }),
    });
    if (r.status === 503) { serverState = "off"; throw new Error("not_configured"); }
    if (!r.ok) throw new Error(`status_${r.status}`);
    const j = await r.json();
    return { text: normalizeTranscriptText(String(j?.text ?? "")), language: typeof j?.language === "string" ? j.language : null };
  } finally { clearTimeout(t); }
}

/** Hook to manage voice transcription state */
export function useVoiceTranscription() {
  const { lang } = useI18n();
  const [recording, setRecording] = useState(false);
  const [listening, setListening] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [visualizerBars, setVisualizerBars] = useState<number[]>([]);
  /** The main language the person SPOKE (ISO 639-1), when the server engine heard them. */
  const [spokenLang, setSpokenLang] = useState<string | null>(null);
  /* What went wrong, in words the screen can show. Was `alert()` — a browser dialog that blocks the
     page — or, for a blocked microphone, NOTHING: see `FATAL` below. */
  const [error, setError] = useState<VoiceError | null>(null);
  const restartsRef = useRef<number[]>([]);
  const recognitionRef = useRef<any>(null);
  const stoppingRef = useRef(false);
  // True while the user wants to keep dictating (both engines).
  const wantListeningRef = useRef(false);
  const transcriptRef = useRef("");
  const interimRef = useRef("");
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepPanelRef = useRef(true);

  /* Server engine. */
  const engineRef = useRef<"server" | "browser" | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const cutterRef = useRef<ClipCutter | null>(null);
  const levelRef = useRef(0);
  const framesRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const langWeightRef = useRef<Record<string, number>>({});
  const spokenLangRef = useRef<string | null>(null);
  const sessionRef = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;

  const stopVisualizer = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = 0;
    setVisualizerBars([]);
  }, []);

  /**
   * The waveform. Server engine: the real loudness of the one microphone stream we own. Browser
   * engine: how fast recognised text is arriving — a second stream beside SpeechRecognition broke
   * transcription on Android (31 Jul), so on that engine we only read state capture already makes.
   */
  const startVisualizer = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const COUNT = 40;
    let lastLen = 0;
    let energy = 0;
    let phase = 0;
    let shown = new Array(COUNT).fill(0.05);

    const tick = () => {
      if (engineRef.current === "server") {
        energy = Math.min(1, energy * 0.8 + Math.min(1, levelRef.current * 9) * 0.35);
      } else {
        const len = (transcriptRef.current + interimRef.current).length;
        const grew = Math.max(0, len - lastLen);
        lastLen = len;
        energy = Math.min(1, energy * 0.94 + grew * 0.09);
      }
      phase += 0.22;
      const next = Array.from({ length: COUNT }, (_, i) => {
        const wave = (Math.sin(phase + i * 0.45) + 1) / 2;
        const envelope = 1 - Math.abs(i - (COUNT - 1) / 2) / ((COUNT - 1) / 2) * 0.55;
        return Math.max(0.05, Math.min(1, energy * wave * envelope * 1.35));
      });
      shown = shown.map((s, i) => s + (next[i] - s) * 0.3);
      setVisualizerBars([...shown]);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const publish = useCallback(() => {
    setTranscript(mergeTranscriptText(transcriptRef.current, interimRef.current));
  }, []);

  /* ══════════════════════════════ SERVER ENGINE ══════════════════════════════ */

  const releaseMic = useCallback(() => {
    try { procRef.current?.disconnect(); } catch { /* gone */ }
    if (procRef.current) procRef.current.onaudioprocess = null;
    procRef.current = null;
    streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch { /* gone */ } });
    streamRef.current = null;
    const ctx = ctxRef.current; ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    levelRef.current = 0;
  }, []);

  const sendClip = useCallback((clip: Float32Array, rate: number) => {
    const session = sessionRef.current;
    const wav = bytesToBase64(encodeWav(downsample(clip, rate, CLIP_RATE), Math.min(rate, CLIP_RATE)));
    pendingRef.current += 1;
    queueRef.current = queueRef.current.then(async () => {
      if (session !== sessionRef.current) return; // cancelled meanwhile
      let out: { text: string; language: string | null } | null = null;
      for (let attempt = 0; attempt < 2 && !out; attempt++) {
        try { out = await transcribeClip(wav, langRef.current, transcriptRef.current); }
        catch (e) {
          if ((e as Error)?.message === "not_configured") break;
          if (attempt === 0) await new Promise(r => setTimeout(r, 700));
        }
      }
      if (session !== sessionRef.current) return;
      if (!out) { setError("lost"); return; }
      if (out.text) {
        transcriptRef.current = mergeTranscriptText(transcriptRef.current, out.text);
        if (out.language) {
          const w = langWeightRef.current;
          w[out.language] = (w[out.language] ?? 0) + out.text.length;
          spokenLangRef.current = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
          setSpokenLang(spokenLangRef.current);
        }
        publish();
      }
    }).finally(() => { pendingRef.current -= 1; });
  }, [publish]);

  /* ══════════════════════════════ BROWSER ENGINE ═════════════════════════════ */

  const finalizeRecognition = useCallback((keepPanelOpen: boolean) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    recognitionRef.current = null;
    setListening(false);
    setFinishing(false);
    stopVisualizer();
    if (!keepPanelOpen) setRecording(false);
    stoppingRef.current = false;
  }, [stopVisualizer]);

  // Build a fresh SpeechRecognition instance wired to our handlers. onend spins up a new one when the
  // browser ends the session after a pause — transcriptRef survives restarts. (Lee, Jul 22)
  const buildRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    /* FALLBACK ONLY. Browser dictation hears the one language it is told — the flag's. */
    const SPEECH: Record<string, string> = {
      en: "en-US", co: "es-CO", es: "es-ES", de: "de-DE", ru: "ru-RU", zh: "zh-CN", pt: "pt-BR",
    };
    recognition.lang = SPEECH[langRef.current] ?? (navigator.language || "en-US");

    recognition.onresult = (event: any) => {
      let nextFinal = transcriptRef.current;
      let nextInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const txt = normalizeTranscriptText(event.results[i][0]?.transcript ?? "");
        if (!txt) continue;
        if (event.results[i].isFinal) nextFinal = mergeTranscriptText(nextFinal, txt);
        else nextInterim = mergeTranscriptText(nextInterim, txt);
      }
      transcriptRef.current = nextFinal;
      interimRef.current = nextInterim;
      publish();
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      /* FATAL ERRORS END THE SESSION, THEY DO NOT RESTART IT (Lee, 2 Oct 2026). */
      const FATAL: Record<string, "blocked" | "no-mic" | "unsupported"> = {
        "not-allowed": "blocked", "service-not-allowed": "blocked",
        "audio-capture": "no-mic", "language-not-supported": "unsupported",
      };
      if (FATAL[event.error]) {
        setError(FATAL[event.error]);
        wantListeningRef.current = false;
        stoppingRef.current = true;
        finalizeRecognition(true);
        return;
      }
      if (event.error === "aborted" && stoppingRef.current) return;
      if (wantListeningRef.current && !stoppingRef.current) return; // transient: onend restarts
      finalizeRecognition(true);
    };

    recognition.onend = () => {
      const now = Date.now();
      restartsRef.current = [...restartsRef.current.filter(t => now - t < 3000), now];
      if (restartsRef.current.length > 5) wantListeningRef.current = false;
      if (wantListeningRef.current && !stoppingRef.current) {
        transcriptRef.current = mergeTranscriptText(transcriptRef.current, interimRef.current);
        interimRef.current = "";
        try {
          const next = buildRecognition();
          if (next) { recognitionRef.current = next; next.start(); return; }
        } catch { /* fall through to finalize */ }
      }
      finalizeRecognition(true);
    };

    return recognition;
  }, [finalizeRecognition, publish]);

  /** Start (or continue) on the browser engine. Returns false when this browser has none. */
  const startBrowser = useCallback((): boolean => {
    const recognition = buildRecognition();
    if (!recognition) return false;
    engineRef.current = "browser";
    recognitionRef.current = recognition;
    restartsRef.current = [];
    try {
      recognition.start();
      return true;
    } catch (err: any) {
      recognitionRef.current = null;
      setError(err?.name === "NotAllowedError" ? "blocked" : "unsupported");
      return false;
    }
  }, [buildRecognition]);

  /* ══════════════════════════════ STOPPING ══════════════════════════════════ */

  /** Stop listening. The server engine then writes down its last clips; `listening` ends after that. */
  const stopRecognition = useCallback((keepPanelOpen: boolean): Promise<void> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    wantListeningRef.current = false;
    stoppingRef.current = true;
    keepPanelRef.current = keepPanelOpen;

    if (engineRef.current === "server") {
      const rate = ctxRef.current?.sampleRate ?? CLIP_RATE;
      const tail = cutterRef.current?.flush() ?? null;
      cutterRef.current = null;
      releaseMic();
      stopVisualizer();
      if (tail) sendClip(tail, rate);
      const session = sessionRef.current;
      if (pendingRef.current > 0) setFinishing(true);
      return queueRef.current.then(() => {
        if (session !== sessionRef.current) return;
        engineRef.current = null;
        finalizeRecognition(keepPanelRef.current);
      });
    }

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    engineRef.current = null;
    if (!recognition) { finalizeRecognition(keepPanelOpen); return Promise.resolve(); }
    return new Promise<void>((resolve) => {
      recognition.onend = () => { finalizeRecognition(keepPanelOpen); resolve(); };
      recognition.onerror = null;
      try { recognition.stop(); } catch { finalizeRecognition(keepPanelOpen); resolve(); }
    });
  }, [finalizeRecognition, releaseMic, sendClip, stopVisualizer]);

  /** The server engine stopped working mid-session: carry on with the browser engine, words kept. */
  const fallBackToBrowser = useCallback(() => {
    if (engineRef.current !== "server" || !wantListeningRef.current) return;
    const rate = ctxRef.current?.sampleRate ?? CLIP_RATE;
    const tail = cutterRef.current?.flush() ?? null;
    cutterRef.current = null;
    releaseMic();
    if (tail && serverState === "on") sendClip(tail, rate);
    if (!startBrowser()) {
      setError(e => e ?? "unsupported");
      wantListeningRef.current = false;
      engineRef.current = null;
      void queueRef.current.then(() => finalizeRecognition(true));
    }
  }, [finalizeRecognition, releaseMic, sendClip, startBrowser]);

  /* ══════════════════════════════ STARTING ══════════════════════════════════ */

  const startRecording = useCallback((options?: { appendTranscript?: string }) => {
    if (engineRef.current || wantListeningRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
    const canServer = !!AC && !!navigator.mediaDevices?.getUserMedia && serverState !== "off";
    if (!canServer && !SR) { setError("unsupported"); return; }

    const initialTranscript = normalizeTranscriptText(options?.appendTranscript ?? "");
    sessionRef.current += 1;
    const session = sessionRef.current;
    setError(null);
    setFinishing(false);
    stoppingRef.current = false;
    wantListeningRef.current = true;
    transcriptRef.current = initialTranscript;
    interimRef.current = "";
    langWeightRef.current = {};
    spokenLangRef.current = null;
    setSpokenLang(null);
    setTranscript(initialTranscript);
    setRecording(true);
    setListening(true);
    timerRef.current = setTimeout(() => { if (wantListeningRef.current) void stopRecognition(true); }, MAX_DURATION_MS);

    const browserOrFail = () => {
      if (session !== sessionRef.current || !wantListeningRef.current) return; // stopped meanwhile
      if (!startBrowser()) {
        setError(e => e ?? "unsupported");
        wantListeningRef.current = false;
        engineRef.current = null;
        finalizeRecognition(true);
        return;
      }
      startVisualizer();
    };

    if (!canServer) { browserOrFail(); return; }

    /* The AudioContext is made HERE, inside the tap, because Safari only lets sound start from a
       person's gesture. Microphone permission and the server check then run side by side. */
    engineRef.current = "server";
    let ctx: AudioContext;
    try { ctx = new AC!(); } catch { engineRef.current = null; browserOrFail(); return; }
    ctxRef.current = ctx;
    void ctx.resume().catch(() => undefined);
    framesRef.current = 0;
    startVisualizer();

    void (async () => {
      let stream: MediaStream | null = null;
      try {
        const [on, s] = await Promise.all([
          probeServer(),
          navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
        ]);
        stream = s;
        if (session !== sessionRef.current || !wantListeningRef.current) { s.getTracks().forEach(t => t.stop()); return; }
        if (!on) { s.getTracks().forEach(t => t.stop()); releaseMic(); engineRef.current = null; browserOrFail(); return; }
      } catch (err: any) {
        stream?.getTracks().forEach(t => t.stop());
        /* Testing, 6 Oct (P2): a microphone that fails LATE — after the person already pressed Stop —
           must not start the browser engine. Stopped means stopped: check the session AND the intent. */
        if (session !== sessionRef.current || !wantListeningRef.current) return;
        releaseMic();
        const name = err?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") setError("blocked");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setError("no-mic");
        else { engineRef.current = null; browserOrFail(); return; }
        wantListeningRef.current = false;
        engineRef.current = null;
        finalizeRecognition(true);
        return;
      }

      streamRef.current = stream;
      const live = ctxRef.current;
      if (!live) { releaseMic(); return; }
      const source = live.createMediaStreamSource(stream);
      const proc = live.createScriptProcessor(4096, 1, 1);
      const mute = live.createGain(); mute.gain.value = 0; // Chrome only runs the processor when it is connected
      const cutter = new ClipCutter(live.sampleRate);
      cutterRef.current = cutter;
      proc.onaudioprocess = (e) => {
        if (session !== sessionRef.current || !cutterRef.current) return;
        framesRef.current += 1;
        const { level, clip } = cutter.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        levelRef.current = level;
        if (clip) sendClip(clip, live.sampleRate);
      };
      source.connect(proc); proc.connect(mute); mute.connect(live.destination);
      procRef.current = proc;

      // No sound at all after two seconds (a suspended audio context) → the browser engine takes over.
      setTimeout(() => {
        if (session === sessionRef.current && engineRef.current === "server" && wantListeningRef.current && framesRef.current === 0) fallBackToBrowser();
      }, 2000);
    })();
  }, [fallBackToBrowser, finalizeRecognition, releaseMic, sendClip, startBrowser, startVisualizer, stopRecognition]);

  // A clip failed twice → keep what we have and continue on the browser engine.
  useEffect(() => {
    if (error === "lost" && engineRef.current === "server" && wantListeningRef.current) fallBackToBrowser();
  }, [error, fallBackToBrowser]);

  /** The language heard so far — read after finish(), when the state may not have re-rendered yet. */
  const getSpokenLang = useCallback(() => spokenLangRef.current, []);

  const getTranscriptText = useCallback(() => {
    return normalizeTranscriptText(mergeTranscriptText(transcriptRef.current, interimRef.current));
  }, []);

  const setTranscriptText = useCallback((text: string) => {
    const normalized = normalizeTranscriptText(text);
    transcriptRef.current = normalized;
    interimRef.current = "";
    setTranscript(normalized);
  }, []);

  const resetText = useCallback(() => {
    setTranscript("");
    transcriptRef.current = "";
    interimRef.current = "";
  }, []);

  /** Stop and keep the panel open to review. Returns what is written so far; the server engine's last
   *  clips land in `transcript` a moment later (`finishing` is true until they do). */
  const stopListening = useCallback(() => {
    const text = getTranscriptText();
    void stopRecognition(true);
    return text;
  }, [getTranscriptText, stopRecognition]);

  /** Stop, wait until every clip is written down, and hand back the WHOLE text. Prefer this to confirm(). */
  const finishRef = useRef<Promise<string> | null>(null);
  const finish = useCallback((): Promise<string> => {
    if (finishRef.current) return finishRef.current; // a second tap on Stop gets the same answer
    const p = (async () => {
      try {
        await stopRecognition(false);
        const text = getTranscriptText();
        resetText();
        return text;
      } finally { finishRef.current = null; }
    })();
    finishRef.current = p;
    return p;
  }, [getTranscriptText, resetText, stopRecognition]);

  /** Synchronous: take what is written NOW. Right when listening has already ended; mid-recording use finish(). */
  /** Ends everything now. A clip still being written down is dropped (finish() waits for it instead). */
  const hardStop = useCallback(() => {
    sessionRef.current += 1;
    if (engineRef.current === "server") {
      cutterRef.current = null;
      releaseMic();
      engineRef.current = null;
      wantListeningRef.current = false;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      finalizeRecognition(false);
    } else {
      void stopRecognition(false);
    }
  }, [finalizeRecognition, releaseMic, stopRecognition]);

  const confirm = useCallback(() => {
    const text = getTranscriptText();
    hardStop();
    resetText();
    return text;
  }, [getTranscriptText, hardStop, resetText]);

  const cancel = useCallback(() => {
    hardStop();
    resetText();
  }, [hardStop, resetText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      wantListeningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch { /* gone */ }
      }
      releaseMic();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [releaseMic]);

  return {
    recording, listening, finishing, transcript, visualizerBars, error, spokenLang,
    startRecording, stopListening, finish, confirm, cancel, setTranscriptText, getSpokenLang,
  };
}
