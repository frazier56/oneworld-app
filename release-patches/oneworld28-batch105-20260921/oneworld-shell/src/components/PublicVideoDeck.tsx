import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { uploadVideoResumable, videoPath } from "../lib/mediaUpload";
import { W, Wt } from "../lib/i18n";
import { IconTrash, IconUpload, IconVideo } from "./ActionIcons";

const MAX_VIDEOS = 5;
const MAX_BYTES = 300 * 1024 * 1024;
const MAX_DURATION_MS = 5 * 60 * 1000;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];

type Progress = { name: string; done: number; total: number; sent: number; bytes: number } | null;

function duration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const ms = Math.round(video.duration * 1000);
      URL.revokeObjectURL(url);
      Number.isFinite(ms) ? resolve(ms) : reject(new Error(`Could not read ${file.name}.`));
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name}.`)); };
    video.src = url;
  });
}

/**
 * PUBLIC VIDEO DECK — resumable (tus) uploads of up to `max` public videos, 300 MB and five
 * minutes each. Shell since 20 Sep 2026 (OneEvent 30): rent, sale and events share this one
 * uploader. `max` defaults to 5; a product passes its plan limit.
 */
export default function PublicVideoDeck({ videos, onChange, folder, lang, max = MAX_VIDEOS }: {
  videos: string[]; onChange: (next: string[]) => void; folder: string; lang: string; max?: number;
}) {
  const [uid, setUid] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);
  /* Tap a tile to watch it. Lee, 2 Oct 2026: "if you play them, it still doesn't do anything." */
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    if (!playing) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setPlaying(null); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [playing]);
  useEffect(() => { void supabase.auth.getUser().then(result => setUid(result.data.user?.id ?? "")); }, []);

  async function choose(files: FileList | null) {
    if (!files?.length || !uid) return;
    setError(null);
    const room = max - videos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length> room) setError(Wt(lang, "You can add {0} more videos.", "Puede agregar {0} videos más.", [room]));
    const valid: File[] = [];
    for (const file of picked) {
      if (!ALLOWED.includes(file.type)) { setError(Wt(lang, "{0} is not MP4, WebM, or MOV.", "{0} no es MP4, WebM ni MOV.", [file.name])); continue; }
      /* Says how big it is and what to do — a phone file name like "inbound1080…mp4" and "exceeds
         300 MB" told the person nothing they could act on. */
      if (file.size> MAX_BYTES) { setError(Wt(lang,
        "That video is {0} MB and the limit is 300 MB. Record at 1080p instead of 4K, or trim it, then add it again.",
        "Ese video pesa {0} MB y el límite es 300 MB. Grábelo en 1080p en vez de 4K, o recórtelo, y vuelva a agregarlo.",
        [Math.round(file.size / 1048576).toLocaleString(lang === "en" ? "en-US" : "es-CO")])); continue; }
      try {
        if (await duration(file)> MAX_DURATION_MS) { setError(Wt(lang, "{0} is longer than five minutes.", "{0} dura más de cinco minutos.", [file.name])); continue; }
        valid.push(file);
      } catch { setError(Wt(lang, "{0} couldn't be read. Try another video.", "No se pudo leer {0}. Pruebe con otro video.", [file.name])); }
    }
    if (!valid.length) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) { setError(W(lang, "Please sign in again before uploading.", "Inicie sesión de nuevo antes de subir.")); return; }
    const totalBytes = valid.reduce((sum, file) => sum + file.size, 0);
    const landed: string[] = [];
    let completedBytes = 0;
    setProgress({ name: valid[0].name, done: 0, total: valid.length, sent: 0, bytes: totalBytes });
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      try {
        landed.push(await uploadVideoResumable(file, videoPath(uid, folder, file), token,
          sent => setProgress({ name: file.name, done: i, total: valid.length, sent: completedBytes + sent, bytes: totalBytes })));
        completedBytes += file.size;
        setProgress({ name: file.name, done: i + 1, total: valid.length, sent: completedBytes, bytes: totalBytes });
      } catch { setError(Wt(lang, "{0} didn't finish uploading. Check your connection and try again.", "{0} no terminó de subir. Revise su conexión e inténtelo de nuevo.", [file.name])); break; }
    }
    if (landed.length) onChange([...videos, ...landed]);
    setProgress(null);
  }

  return <div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {videos.map((url, index) => <div key={url} className="relative overflow-hidden rounded-2xl border border-white/50 bg-black">
        {/* ⚠️ BLACK TILES — Lee, 2 Oct 2026, from Instagram's in-app browser: two uploaded videos
            showing as solid black. `preload="metadata"` loads the duration but many mobile
            engines (Android WebView, iOS) never paint a frame until playback. The `#t=0.1`
            media fragment asks for a seek, and a seek paints that frame. The play glyph says
            "this is a video" while it loads. */}
        <button type="button" onClick={() => setPlaying(url)} className="block w-full"
          aria-label={Wt(lang, "Play video {0}", "Reproducir video {0}", [index + 1])}>
          <video src={`${url}#t=0.1`} className="pointer-events-none aspect-[9/16] w-full object-cover" preload="metadata" muted playsInline />
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black text-white">{index + 1}</span>
        <button type="button" onClick={() => onChange(videos.filter(item => item !== url))}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-white" aria-label={W(lang, "Remove video", "Eliminar video")}>
          <IconTrash size={16} />
        </button>
      </div>)}
 <label className="ow-edge grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed p-4 text-center">
        <input type="file" accept="video/mp4,video/webm,video/quicktime" multiple className="hidden"
          disabled={!uid || !!progress || videos.length>= max} onChange={e => { void choose(e.target.files); e.currentTarget.value = ""; }} />
        <span className="space-y-2"><IconUpload className="mx-auto" size={22} /><strong className="block text-sm">{W(lang, "Add videos", "Agregar videos")}</strong><small className="block opacity-55">{videos.length} / {max}</small></span>
      </label>
    </div>
    {progress && <div className="mt-3 rounded-2xl bg-white/45 p-3 dark:bg-white/10" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-bold"><IconVideo size={16} />{W(lang, "Uploading", "Subiendo")} {progress.done} / {progress.total}</div>
      <p className="mt-1 truncate text-xs opacity-60">{progress.name}</p>
      <progress className="mt-2 h-2 w-full" max={progress.bytes} value={progress.sent} />
    </div>}
    {error && <p className="mt-2 text-sm font-bold text-red-600 dark:text-red-400" role="alert">{error}</p>}
    {playing && createPortal(
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black" role="dialog" aria-modal="true"
        aria-label={W(lang, "Video preview", "Vista previa del video")}>
        <video src={playing} controls autoPlay playsInline className="max-h-full max-w-full object-contain" />
        <button type="button" onClick={() => setPlaying(null)} aria-label={W(lang, "Close", "Cerrar")}
          className="absolute right-3 top-[calc(12px+env(safe-area-inset-top,0px))] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl font-bold leading-none text-white">×</button>
      </div>, document.body)}
    <p className="mt-2 text-xs opacity-55">{Wt(lang, "Up to {0} videos · 5 minutes and 300 MB each · resumable uploads", "Hasta {0} videos · 5 minutos y 300 MB cada uno · cargas reanudables", [max])}</p>
  </div>;
}
