import { FN_ANON } from "./vaiaOrganize";

/** VAIA's REAL voice — ElevenLabs "Lily" (the brand voice profile from the engine),
 *  served by the already-deployed elevenlabs-tts edge fn. Falls back to the browser
 *  voice only if the fn fails. VAIO uses "Daniel". */
export const VAIA_VOICE = Object.freeze({
  name: "Lily",
  id: "pFZP5JQG7iQjIQuC4Bku",
  settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, speed: 1.12 },
});

const FN_URL = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/elevenlabs-tts";
let current: HTMLAudioElement | null = null;

export function stopVaiaSpeech() {
  try { current?.pause(); } catch {}
  current = null;
  try { speechSynthesis.cancel(); } catch {}
}

export async function speakVaia(text: string, lang: "en" | "es") {
  stopVaiaSpeech();
  const clean = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_#`]/g, "").slice(0, 1200);
  try {
    const r = await fetch(FN_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", apikey: FN_ANON, Authorization: `Bearer ${FN_ANON}` },
      body: JSON.stringify({
        text: clean,
        voiceId: VAIA_VOICE.id,
        stream: false,
        language: lang,
        ...VAIA_VOICE.settings,
        requestId: `${Date.now()}`,
      }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    current = audio;
    await audio.play();
    return;
  } catch {
    // graceful fallback: browser voice (better than silence)
    try {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang === "es" ? "es-ES" : "en-US";
      speechSynthesis.speak(u);
    } catch {}
  }
}
