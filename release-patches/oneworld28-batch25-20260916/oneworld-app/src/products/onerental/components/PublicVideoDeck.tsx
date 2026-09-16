import { useEffect, useState } from "react";
import * as tus from "tus-js-client";
import { SUPABASE_ANON, SUPABASE_URL, supabase, W } from "@oneworld/shell";
import { Trash2, Upload, Video } from "lucide-react";

const MAX_VIDEOS = 5;
const MAX_BYTES = 300 * 1024 * 1024;
const MAX_DURATION_MS = 5 * 60 * 1000;
const CHUNK_BYTES = 6 * 1024 * 1024;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];

type Progress = { name: string; done: number; total: number; sent: number; bytes: number } | null;

function endpoint() {
  const url = new URL(SUPABASE_URL);
  url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
  return `${url.origin}/storage/v1/upload/resumable`;
}

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

function upload(file: File, path: string, token: string, onProgress: (sent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const task = new tus.Upload(file, {
      endpoint: endpoint(),
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON, "x-upsert": "false" },
      metadata: { bucketName: "media", objectName: path, contentType: file.type, cacheControl: "3600" },
      chunkSize: CHUNK_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: onProgress,
      onError: reject,
      onSuccess: () => resolve(),
    });
    void task.findPreviousUploads().then(previous => {
      if (previous[0]) task.resumeFromPreviousUpload(previous[0]);
      task.start();
    }).catch(reject);
  });
}

export default function PublicVideoDeck({ videos, onChange, folder, lang }: {
  videos: string[]; onChange: (next: string[]) => void; folder: string; lang: string;
}) {
  const [uid, setUid] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(result => setUid(result.data.user?.id ?? "")); }, []);

  async function choose(files: FileList | null) {
    if (!files?.length || !uid) return;
    setError(null);
    const room = MAX_VIDEOS - videos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError(W(lang, `You can add ${room} more videos.`, `Puede agregar ${room} videos más.`));
    const valid: File[] = [];
    for (const file of picked) {
      if (!ALLOWED.includes(file.type)) { setError(W(lang, `${file.name} is not MP4, WebM, or MOV.`, `${file.name} no es MP4, WebM ni MOV.`)); continue; }
      if (file.size > MAX_BYTES) { setError(W(lang, `${file.name} exceeds 300 MB.`, `${file.name} supera 300 MB.`)); continue; }
      try {
        if (await duration(file) > MAX_DURATION_MS) { setError(W(lang, `${file.name} is longer than five minutes.`, `${file.name} dura más de cinco minutos.`)); continue; }
        valid.push(file);
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
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
      const ext = (file.name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const path = `${uid}/${folder}/videos/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      try {
        await upload(file, path, token, sent => setProgress({ name: file.name, done: i, total: valid.length, sent: completedBytes + sent, bytes: totalBytes }));
        landed.push(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
        completedBytes += file.size;
        setProgress({ name: file.name, done: i + 1, total: valid.length, sent: completedBytes, bytes: totalBytes });
      } catch (e) { setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`); break; }
    }
    if (landed.length) onChange([...videos, ...landed]);
    setProgress(null);
  }

  return <div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {videos.map((url, index) => <div key={url} className="relative overflow-hidden rounded-2xl border border-white/50 bg-black">
        <video src={url} className="aspect-[9/16] w-full object-cover" preload="metadata" muted playsInline />
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black text-white">{index + 1}</span>
        <button type="button" onClick={() => onChange(videos.filter(item => item !== url))}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-white" aria-label={W(lang, "Remove video", "Eliminar video")}>
          <Trash2 size={16} />
        </button>
      </div>)}
      <label className="grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed border-ink/20 p-4 text-center dark:border-white/20">
        <input type="file" accept="video/mp4,video/webm,video/quicktime" multiple className="hidden"
          disabled={!uid || !!progress || videos.length >= MAX_VIDEOS} onChange={e => { void choose(e.target.files); e.currentTarget.value = ""; }} />
        <span className="space-y-2"><Upload className="mx-auto" size={22} /><strong className="block text-sm">{W(lang, "Add videos", "Agregar videos")}</strong><small className="block opacity-55">{videos.length} / {MAX_VIDEOS}</small></span>
      </label>
    </div>
    {progress && <div className="mt-3 rounded-2xl bg-white/45 p-3" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-bold"><Video size={16} />{W(lang, "Uploading", "Subiendo")} {progress.done} / {progress.total}</div>
      <p className="mt-1 truncate text-xs opacity-60">{progress.name}</p>
      <progress className="mt-2 h-2 w-full" max={progress.bytes} value={progress.sent} />
    </div>}
    {error && <p className="mt-2 text-sm font-bold text-red-600" role="alert">{error}</p>}
    <p className="mt-2 text-xs opacity-55">{W(lang, "Up to 5 videos · 5 minutes and 300 MB each · resumable uploads", "Hasta 5 videos · 5 minutos y 300 MB cada uno · cargas reanudables")}</p>
  </div>;
}
