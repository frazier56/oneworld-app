import { useEffect, useRef, useState } from "react";
import { useI18n } from "@evt/lib/i18n";

/** Voice input — 2-min cap w/ countdown + waveform that jumps as words land.
 *  IMPORTANT (Jul 11 fix): NO getUserMedia here — opening a second mic stream
 *  starves SpeechRecognition on mobile (mic vibrated but nothing transcribed).
 *  The animation is driven by recognition events instead, so the recognizer
 *  keeps exclusive mic access and transcription always works. */
const MAX_DURATION_MS = 2 * 60 * 1000;

export default function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { lang } = useI18n();
  const [rec, setRec] = useState(false);
  const [left, setLeft] = useState(MAX_DURATION_MS / 1000);
  const [hot, setHot] = useState(0); // 0..1, spikes on each result, decays
  const recRef = useRef<any>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const cleanup = () => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    if (capRef.current) clearTimeout(capRef.current);
    if (decayRef.current) clearInterval(decayRef.current);
    setRec(false); setHot(0); setLeft(MAX_DURATION_MS / 1000);
  };
  useEffect(() => cleanup, []);
  /* v29 EU (Rules of Hooks): this early return used to sit ABOVE the useEffect — a
     conditional render before a hook is exactly what mints React error #310 ("rendered
     fewer hooks than expected"). All hooks first, THEN bail. */
  if (!SR) return null;

  const toggle = () => {
    if (rec) { cleanup(); return; }
    const r = new SR();
    r.lang = lang === "es" ? "es-ES" : "en-US";
    r.continuous = true; r.interimResults = true;
    let finalText = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      onTranscript((finalText + " " + interim).replace(/\s+/g, " ").trim());
      setHot(1); // words landing → full-energy waveform
    };
    r.onspeechstart = () => setHot(1);
    r.onend = () => cleanup();
    r.onerror = () => cleanup();
    recRef.current = r; r.start(); setRec(true);
    decayRef.current = setInterval(() => setHot(h => Math.max(0.15, h * 0.82)), 120);
    const t0 = Date.now();
    setLeft(MAX_DURATION_MS / 1000);
    tickRef.current = setInterval(() => setLeft(Math.max(0, Math.ceil((MAX_DURATION_MS - (Date.now() - t0)) / 1000))), 500);
    capRef.current = setTimeout(cleanup, MAX_DURATION_MS);
  };

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const bars = [0.55, 1, 0.75, 1, 0.55]; // relative max heights

  return (
    <span className="relative inline-flex flex-col items-center">
      <button type="button" onClick={toggle} aria-label="Voice input"
        className={`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border transition ${rec ? "border-red-400 bg-red-500/10" : "border-ink/10 dark:border-white/15"}`}>
        {rec ? (
          /* live waveform — bars bounce hard when it hears you */
          <span className="flex h-5 items-center gap-[3px]">
            {bars.map((b, i) => (
              <span key={i} className="w-[3px] rounded-full bg-red-500 transition-all duration-100"
                style={{
                  height: `${4 + b * hot * 16}px`,
                  animation: `micbar ${0.55 + i * 0.09}s ease-in-out infinite alternate`,
                }} />
            ))}
          </span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/>
          </svg>
        )}
      </button>
      {rec && (
        <span className={`absolute -bottom-4 whitespace-nowrap text-[10px] font-bold tabular-nums ${left <= 15 ? "text-red-500" : "text-red-400/80"}`}>
          ⏱ {mmss}
        </span>
      )}
    </span>
  );
}
