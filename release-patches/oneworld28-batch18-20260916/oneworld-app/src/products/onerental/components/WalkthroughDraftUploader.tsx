import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { PinchZoom, SUPABASE_ANON, SUPABASE_URL, supabase, W } from "@oneworld/shell";

const BUCKET = "rental-walkthrough-drafts";
const MAX_PHOTOS = 100;
const MAX_VIDEOS = 10;
const IMAGE_BYTES = 25 * 1024 * 1024;
const VIDEO_BYTES = 300 * 1024 * 1024;
const MAX_VIDEO_DURATION_MS = 5 * 60 * 1000;
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;
const LANES = 3;

type DraftItem = {
  id: string;
  ordinal: number;
  storage_path: string;
  original_name: string;
  media_kind: "image" | "video";
  mime_type: string;
  byte_size: number;
  room: string | null;
  host_note: string | null;
  captured_at: string | null;
  created_at: string;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  preview?: string;
};

type Progress = {
  done: number;
  total: number;
  name: string;
  sentBytes: number;
  totalBytes: number;
} | null;

type QueueItem = {
  key: string;
  file: File;
  kind: "image" | "video";
  ordinal: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

function storageTusEndpoint() {
  const url = new URL(SUPABASE_URL);
  url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
  return `${url.origin}/storage/v1/upload/resumable`;
}

function inspectFile(file: File, kind: "image" | "video") {
  return new Promise<{ durationMs: number | null; width: number | null; height: number | null }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const finish = (value: { durationMs: number | null; width: number | null; height: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}.`));
    };
    if (kind === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => finish({
        durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
      video.onerror = fail;
      video.src = url;
      return;
    }
    const image = new Image();
    image.onload = () => finish({ durationMs: null, width: image.naturalWidth || null, height: image.naturalHeight || null });
    image.onerror = fail;
    image.src = url;
  });
}

function resumableUpload(file: File, path: string, token: string, onProgress: (sent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: storageTusEndpoint(),
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON, "x-upsert": "false" },
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: TUS_CHUNK_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: bytesSent => onProgress(bytesSent),
      onError: reject,
      onSuccess: () => resolve(),
    });
    void upload.findPreviousUploads().then(previous => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}

function friendlyUploadError(error: unknown, fileName: string, lang: string) {
  const detail = error instanceof Error ? error.message : String(error);
  if (/maximum allowed size|entity too large|413/i.test(detail)) {
    return W(lang,
      `${fileName} exceeds the current storage limit. Nothing was lost. Ask an administrator to raise the OneHome walkthrough limit to 300 MB, then retry.`,
      `${fileName} supera el límite actual de almacenamiento. No se perdió nada. Pida a un administrador aumentar el límite del acta de OneHome a 300 MB y vuelva a intentar.`);
  }
  return `${fileName}: ${detail}`;
}

function stamp(item: DraftItem, lang: string) {
  const raw = item.captured_at || item.created_at;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return W(lang, "Time unavailable", "Hora no disponible");
  return new Intl.DateTimeFormat(lang === "es" || lang === "co" ? "es-CO" : "en-US", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

export default function WalkthroughDraftUploader({
  propertyId, userId, lang, savingDraft, onCreateDraft,
}: {
  propertyId: string | null;
  userId: string | null;
  lang: string;
  savingDraft: boolean;
  onCreateDraft: () => Promise<string | null>;
}) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const swipeStart = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!propertyId || !userId) return;
    const { data, error: readError } = await supabase
      .from("rental_walkthrough_draft_items")
      .select("id, ordinal, storage_path, original_name, media_kind, mime_type, byte_size, room, host_note, captured_at, created_at, duration_ms, width, height")
      .eq("property_id", propertyId)
      .order("ordinal", { ascending: true });
    if (readError) { setError(readError.message); return; }
    const rows = (data ?? []) as DraftItem[];
    if (!rows.length) { setItems([]); return; }
    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET).createSignedUrls(rows.map(row => row.storage_path), 3600);
    if (signedError) { setError(signedError.message); return; }
    const byPath = new Map((signed ?? []).map(entry => [entry.path, entry.signedUrl]));
    setItems(rows.map(row => ({ ...row, preview: byPath.get(row.storage_path) ?? "" })));
  }, [propertyId, userId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (openIndex == null) return;
    const y = window.scrollY;
    const prior = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowLeft") setOpenIndex(index => index == null ? null : Math.max(0, index - 1));
      if (event.key === "ArrowRight") setOpenIndex(index => index == null ? null : Math.min(items.length - 1, index + 1));
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      Object.assign(document.body.style, prior);
      window.scrollTo(0, y);
    };
  }, [openIndex, items.length]);

  async function chooseFiles(files: FileList | null) {
    if (!files?.length || !userId) return;
    let id = propertyId;
    if (!id) id = await onCreateDraft();
    if (!id) return;

    setError(null); setMessage(null);
    let images = items.filter(item => item.media_kind === "image").length;
    let videos = items.filter(item => item.media_kind === "video").length;
    const queue: QueueItem[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("video/") ? "video" : "image";
      const allowed = kind === "video"
        ? ["video/mp4", "video/webm", "video/quicktime"].includes(file.type)
        : ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type);
      if (!allowed) { rejected.push(W(lang, `${file.name} is not a supported photo or video.`, `${file.name} no es una foto o un video compatible.`)); continue; }
      if (kind === "image" && images >= MAX_PHOTOS) { rejected.push(W(lang, "The walkthrough is limited to 100 photos.", "El acta admite hasta 100 fotos.")); continue; }
      if (kind === "video" && videos >= MAX_VIDEOS) { rejected.push(W(lang, "The walkthrough is limited to 10 videos.", "El acta admite hasta 10 videos.")); continue; }
      if (file.size > (kind === "video" ? VIDEO_BYTES : IMAGE_BYTES)) {
        rejected.push(W(lang, `${file.name} is too large.`, `${file.name} es demasiado grande.`)); continue;
      }
      try {
        const media = await inspectFile(file, kind);
        if (kind === "video" && media.durationMs != null && media.durationMs > MAX_VIDEO_DURATION_MS) {
          rejected.push(W(lang, `${file.name} is longer than five minutes.`, `${file.name} dura más de cinco minutos.`));
          continue;
        }
        if (kind === "image") images += 1; else videos += 1;
        queue.push({ key: crypto.randomUUID(), file, kind, ordinal: items.length + queue.length + 1, ...media });
      } catch (inspectError) {
        rejected.push(inspectError instanceof Error ? inspectError.message : String(inspectError));
      }
    }
    if (!queue.length) { if (rejected[0]) setError(rejected[0]); return; }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (sessionError || !token) { setError(sessionError?.message || W(lang, "Please sign in again before uploading.", "Inicie sesión de nuevo antes de subir archivos.")); return; }

    const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    const sentByFile = new Map(queue.map(item => [item.key, 0]));
    let cursor = 0, done = 0;
    const failures = [...rejected];
    setProgress({ done: 0, total: queue.length, name: queue[0].file.name, sentBytes: 0, totalBytes });
    const lane = async () => {
      while (cursor < queue.length) {
        const current = queue[cursor++];
        const ext = (current.file.name.split(".").pop() || (current.kind === "video" ? "mp4" : "jpg")).replace(/[^a-z0-9]/gi, "").toLowerCase();
        const path = `${userId}/${id}/${current.key}.${ext}`;
        const capturedAt = current.file.lastModified ? new Date(current.file.lastModified).toISOString() : new Date().toISOString();
        try {
          await resumableUpload(current.file, path, token, sent => {
            sentByFile.set(current.key, sent);
            const sentBytes = [...sentByFile.values()].reduce((sum, value) => sum + value, 0);
            setProgress({ done, total: queue.length, name: current.file.name, sentBytes, totalBytes });
          });
          const { error: rowError } = await supabase.from("rental_walkthrough_draft_items").insert({
            property_id: id, uploader_id: userId, ordinal: current.ordinal,
            storage_path: path, original_name: current.file.name, media_kind: current.kind,
            mime_type: current.file.type, byte_size: current.file.size, captured_at: capturedAt,
            duration_ms: current.durationMs, width: current.width, height: current.height,
          });
          if (rowError) {
            await supabase.storage.from(BUCKET).remove([path]);
            throw rowError;
          }
        } catch (uploadError) {
          failures.push(friendlyUploadError(uploadError, current.file.name, lang));
        }
        done += 1;
        sentByFile.set(current.key, current.file.size);
        const sentBytes = [...sentByFile.values()].reduce((sum, value) => sum + value, 0);
        setProgress({ done, total: queue.length, name: current.file.name, sentBytes, totalBytes });
      }
    };
    await Promise.all(Array.from({ length: Math.min(LANES, queue.length) }, lane));
    setProgress(null);
    if (failures.length) setError(failures[0]);
    else setMessage(W(lang, `${queue.length} walkthrough file${queue.length === 1 ? "" : "s"} uploaded privately.`, `${queue.length} archivo${queue.length === 1 ? "" : "s"} del acta se subieron de forma privada.`));
    await load();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    const a = next[target], b = next[index];
    const [{ error: first }, { error: second }] = await Promise.all([
      supabase.from("rental_walkthrough_draft_items").update({ ordinal: index + 1 }).eq("id", b.id),
      supabase.from("rental_walkthrough_draft_items").update({ ordinal: target + 1 }).eq("id", a.id),
    ]);
    if (first || second) { setError((first || second)!.message); await load(); }
  }

  async function remove(item: DraftItem) {
    if (!window.confirm(W(lang, "Remove this private walkthrough file?", "¿Quitar este archivo privado del acta?"))) return;
    const { error: rowError } = await supabase.from("rental_walkthrough_draft_items").delete().eq("id", item.id);
    if (rowError) { setError(rowError.message); return; }
    await supabase.storage.from(BUCKET).remove([item.storage_path]);
    const remaining = items.filter(row => row.id !== item.id);
    await Promise.all(remaining.map((row, index) => supabase.from("rental_walkthrough_draft_items").update({ ordinal: index + 1 }).eq("id", row.id)));
    await load();
  }

  async function share(item: DraftItem) {
    if (!item.preview) return;
    const data = { title: W(lang, "Private move-in evidence", "Evidencia privada de ingreso"), text: stamp(item, lang), url: item.preview };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(item.preview); setMessage(W(lang, "A private one-hour viewing link was copied.", "Se copió un enlace privado válido por una hora.")); }
    } catch (shareError) {
      if ((shareError as DOMException)?.name !== "AbortError") setError(String(shareError));
    }
  }

  const photos = items.filter(item => item.media_kind === "image").length;
  const videos = items.filter(item => item.media_kind === "video").length;
  const current = openIndex == null ? null : items[openIndex];
  const pct = progress ? Math.min(100, Math.round(progress.sentBytes / Math.max(1, progress.totalBytes) * 100)) : 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-brand/25 bg-brand/[0.06] p-4 shadow-sm backdrop-blur-xl">
        <p className="text-[13px] font-black">{W(lang, "Private move-in evidence", "Evidencia privada de ingreso")}</p>
        <p className="mt-1 text-[12px] leading-relaxed opacity-75">
          {W(lang,
            "These are not public listing photos. Upload detailed room, appliance and condition photos now; the owner and tenant will review them one by one and approve the frozen move-in record before the lease starts.",
            "Estas no son fotos públicas del anuncio. Suba ahora fotos detalladas de habitaciones, electrodomésticos y estado; propietario y arrendatario las revisarán una por una y aprobarán el acta congelada antes de iniciar el contrato.")}
        </p>
        <p className="mt-2 text-[11.5px] font-semibold opacity-65">
          {W(lang, "Up to 100 photos and 10 videos (five minutes each). Select large batches; original evidence quality is retained for pinch-to-zoom.", "Hasta 100 fotos y 10 videos (cinco minutos cada uno). Seleccione lotes grandes; se conserva la calidad original para ampliar con los dedos.")}
        </p>
      </div>

      {!propertyId ? (
        <button type="button" disabled={savingDraft || !userId} onClick={() => void onCreateDraft()} className="btn-primary w-full disabled:opacity-50">
          {savingDraft ? "…" : W(lang, "Save draft and add walkthrough files", "Guardar borrador y agregar archivos del acta")}
        </button>
      ) : (
        <>
          <label className="block cursor-pointer rounded-2xl border border-dashed border-brand/40 bg-white/30 p-4 text-center backdrop-blur-xl dark:bg-white/[0.03]">
            <input type="file" className="hidden" multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
              disabled={!!progress} onChange={event => { void chooseFiles(event.target.files); event.currentTarget.value = ""; }} />
            <strong className="block text-[13.5px]">{W(lang, "Choose photos or videos", "Elegir fotos o videos")}</strong>
            <span className="mt-1 block text-[11.5px] opacity-60">{W(lang, "Select 20–30 photos or several videos at once", "Seleccione 20–30 fotos o varios videos a la vez")}</span>
          </label>
          <div className="flex justify-between text-[11.5px] font-bold opacity-65">
            <span>{photos} / 100 {W(lang, "photos", "fotos")}</span>
            <span>{videos} / 10 {W(lang, "videos", "videos")}</span>
          </div>
          {progress && (
            <div className="rounded-2xl border border-ink/10 bg-white/45 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]" aria-live="polite">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12px] font-bold">{W(lang, "Uploading", "Subiendo")} {progress.done} / {progress.total}</p>
                <span className="text-[12px] font-black tabular-nums text-brand">{pct}%</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] opacity-55">{progress.name}</p>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                <span className="block h-full rounded-full bg-brand transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((item, index) => (
                <article key={item.id} className="relative overflow-hidden rounded-2xl border border-ink/10 bg-white/40 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                  <button type="button" onClick={() => setOpenIndex(index)} aria-label={`${W(lang, "Open evidence", "Abrir evidencia")} ${index + 1}`} className="relative block aspect-square w-full bg-ink/5 dark:bg-white/5">
                    {item.media_kind === "video"
                      ? <video src={item.preview} muted preload="metadata" className="h-full w-full object-cover" />
                      : <img src={item.preview} alt={item.host_note || stamp(item, lang)} className="h-full w-full object-cover" />}
                    <span className="absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-black/65 px-2 text-[11px] font-black text-white">{index + 1}</span>
                    {item.media_kind === "video" && <span className="absolute inset-0 grid place-items-center text-3xl text-white drop-shadow">▶</span>}
                  </button>
                  <div className="p-2">
                    <p className="truncate text-[10.5px] font-bold">{stamp(item, lang)}</p>
                    <div className="mt-1 flex justify-between gap-1">
                      <button type="button" aria-label={W(lang, "Move earlier", "Mover antes")} disabled={index === 0} onClick={() => void move(index, -1)} className="ow-tap px-2 disabled:opacity-25">‹</button>
                      <button type="button" aria-label={W(lang, "Remove", "Quitar")} onClick={() => void remove(item)} className="ow-tap px-2 text-red-500">×</button>
                      <button type="button" aria-label={W(lang, "Move later", "Mover después")} disabled={index === items.length - 1} onClick={() => void move(index, 1)} className="ow-tap px-2 disabled:opacity-25">›</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {message && <p className="text-[12px] font-semibold text-brand">✓ {message}</p>}
      {error && <p role="alert" className="text-[12px] font-semibold text-red-500">{error}</p>}

      {current && openIndex != null && (
        <div role="dialog" aria-modal="true" aria-label={W(lang, "Private walkthrough viewer", "Visor privado del acta")}
          className="fixed inset-0 z-[150] grid place-items-center overflow-hidden bg-black/95 p-2 text-white"
          onClick={event => { if (event.target === event.currentTarget) setOpenIndex(null); }}
          onPointerDown={event => { if (!zoomed) swipeStart.current = event.clientX; }}
          onPointerUp={event => {
            if (zoomed || swipeStart.current == null) return;
            const delta = event.clientX - swipeStart.current;
            swipeStart.current = null;
            if (Math.abs(delta) < 45) return;
            setOpenIndex(Math.max(0, Math.min(items.length - 1, openIndex + (delta < 0 ? 1 : -1))));
          }}>
          <div className="absolute left-3 top-3 z-20 rounded-full bg-black/60 px-3 py-2 text-[12px] font-black">{openIndex + 1} / {items.length}</div>
          <div className="absolute right-3 top-3 z-20 flex gap-2">
            <button type="button" aria-label={W(lang, "Share", "Compartir")} onClick={() => void share(current)} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-xl">↗</button>
            <button type="button" aria-label={W(lang, "Close", "Cerrar")} onClick={() => setOpenIndex(null)} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl">×</button>
          </div>
          <div className="h-[calc(100dvh-7rem)] w-full max-w-5xl overflow-hidden">
            {current.media_kind === "video"
              ? <video src={current.preview} controls autoPlay playsInline className="h-full w-full object-contain" />
              : <PinchZoom key={current.id} max={5} onZoomChange={setZoomed}>
                  <img src={current.preview} alt={current.host_note || stamp(current, lang)} draggable={false} className="max-h-full max-w-full select-none object-contain" />
                </PinchZoom>}
          </div>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/65 p-1.5">
            <button type="button" aria-label={W(lang, "Previous", "Anterior")} disabled={openIndex === 0} onClick={() => setOpenIndex(openIndex - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-2xl disabled:opacity-25">‹</button>
            <span className="max-w-[55vw] truncate px-2 text-[11px] font-bold">{stamp(current, lang)}</span>
            <button type="button" aria-label={W(lang, "Next", "Siguiente")} disabled={openIndex === items.length - 1} onClick={() => setOpenIndex(openIndex + 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-2xl disabled:opacity-25">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
