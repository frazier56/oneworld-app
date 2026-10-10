import { useEffect, useMemo, useState } from "react";
import { W, useI18n } from "../lib/i18n";
import {
  MAX_VIDEO_MS, isVideo, publishPost, screenFiles, videoDuration, type Rejected,
} from "../lib/mediaPosts";

/**
 * NEW POST — pick files, see them, write a caption, publish (SHELL).
 * ============================================================================================
 * Ported from the original OneSocial app's `MediaUploadPreviewDialog` (July 2026 backup),
 * which existed for one reason Lee named: *"it wasn't just upload it, it worked out."*
 *
 * ── WHY A CAPTION STEP AT ALL, WHEN A STRAIGHT UPLOAD IS ONE TAP FEWER ─────────────────────
 * Because the alternative is a post with no words on a profile whose whole job is credibility,
 * and the only way to add them afterwards is to find the post and edit it. The original put the
 * caption BEFORE the publish and that is the right order: the person is looking at the picture
 * at the moment they know what to say about it.
 *
 * ── THE FOUR KINKS THIS SCREEN EXISTS TO ABSORB ────────────────────────────────────────────
 *
 * 1. ⚠️ EVERY `URL.createObjectURL` MUST BE REVOKED. The original had this and it is not a
 *    nicety: a member who opens and cancels this sheet six times with four 200 MB videos each
 *    has pinned nearly five gigabytes of blobs into the tab, and the next upload fails for
 *    reasons that look like the network. Revoked when the file set changes and on unmount.
 *
 * 2. ⚠️ THE PICKER DOES NOT ENFORCE THE BUCKET'S MIME LIST. `screenFiles` splits the selection
 *    before a byte is sent and the refused files are named here — the one thing worse than a
 *    rejected file is six files going up and the person never learning which of them did not.
 *
 * 3. ⚠️ A SILENT MINUTE READS AS A HUNG APP. A 300 MB clip on a phone connection is a long
 *    nothing, so publishing reports which file of how many is going up right now.
 *
 * 4. ⚠️ CANCEL MUST NOT WORK MID-UPLOAD. Half a carousel is a post the member did not make.
 *    The sheet refuses to close while it is publishing — including on the backdrop and on
 *    Escape, which are the two ways a dialog gets dismissed by accident.
 */
export default function MediaPostComposer({ userId, files, onCancel, onDone }: {
  userId: string;
  /** Straight from the file input. Already picked, not yet screened. */
  files: File[];
  onCancel: () => void;
  /** Fired once the post exists, so the caller can re-read the grid. */
  onDone: (added: number, failed: string[]) => void;
}) {
  const { lang } = useI18n();
  const [caption, setCaption] = useState("");
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number; name: string; pct: number | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const screened = useMemo(() => screenFiles(files), [files]);
  const { rejected, needConversion } = screened;

  /* ⚠️ FIVE MINUTES, CHECKED BEFORE A BYTE MOVES — and the check is asynchronous, which is why
     it cannot live in `screenFiles`. The only way to read a clip's length in a browser is to
     load its metadata into a throwaway <video> element and wait. `PublicVideoDeck` already
     enforces the same ceiling on listing video; a portfolio should not be looser than a listing.

     ⚠️ AND AN UNREADABLE FILE IS REJECTED, NOT WAVED THROUGH. A clip whose metadata will not
     load is a clip no browser will play either, so uploading it produces a permanent black tile
     on a public profile. Better to say so here. */
  const [tooLong, setTooLong] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const clips = screened.ok.filter(f => isVideo(f.type, f.name));
    if (!clips.length) { setTooLong([]); return; }
    let dead = false;
    setChecking(true);
    void (async () => {
      const bad: string[] = [];
      for (const f of clips) {
        try { if (await videoDuration(f) > MAX_VIDEO_MS) bad.push(f.name); }
        catch { bad.push(f.name); }
      }
      if (!dead) { setTooLong(bad); setChecking(false); }
    })();
    return () => { dead = true; };
  }, [screened]);

  const ok = useMemo(() => screened.ok.filter(f => !tooLong.includes(f.name)), [screened, tooLong]);

  /* Kink 1 — one object URL per accepted file, revoked when the set changes or this unmounts. */
  const previews = useMemo(
    () => ok.map(f => ({ url: URL.createObjectURL(f), video: isVideo(f.type, f.name), name: f.name })),
    [ok],
  );
  useEffect(() => () => { previews.forEach(p => URL.revokeObjectURL(p.url)); }, [previews]);

  /* Kink 4 — Escape is a dismissal, and a dismissal mid-upload would orphan the files. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Everything they picked was refused. Saying so and offering the way out beats an empty sheet
     with a Publish button that cannot do anything. */
  const nothingUsable = !ok.length;

  const publish = async () => {
    if (!ok.length || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await publishPost(userId, ok, caption, setStep);
      onDone(res.uploaded, res.failed);
    } catch {
      setErr(W(lang, "That didn't publish. Nothing was posted — try again.",
                     "No se publicó. No se guardó nada — reintenta."));
      setBusy(false);
    }
  };

  const cur = previews[at];

  return (
    <div className="fixed inset-0 z-[1001] flex items-end justify-center sm:items-center"
      role="dialog" aria-modal="true" aria-label={W(lang, "New post", "Nueva publicación")}>
      {/* The scrim carries NO hue — brand rule. A tap on it cancels, but only when idle. */}
      <button aria-label={W(lang, "Cancel", "Cancelar")} onClick={() => { if (!busy) onCancel(); }}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
      <div className="ow-sheet relative flex max-h-[90svh] w-full max-w-[520px] flex-col overflow-hidden
        rounded-t-3xl sm:rounded-3xl">

        <div className="flex items-center gap-2 border-b border-ink/8 px-4 py-3 dark:border-white/10">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold">
            {W(lang, "New post", "Nueva publicación")}
          </h3>
          <span className="shrink-0 text-[11.5px] font-semibold opacity-50">
            {ok.length} {ok.length === 1 ? W(lang, "file", "archivo") : W(lang, "files", "archivos")}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {nothingUsable ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13.5px] font-bold">
                {W(lang, "None of those can be posted.", "Ninguno de esos se puede publicar.")}
              </p>
              <p className="mt-1 text-[12.5px] opacity-60">
                {W(lang, "Photos as JPG, PNG, WEBP or GIF. Video as MP4, MOV or WEBM.",
                         "Fotos en JPG, PNG, WEBP o GIF. Video en MP4, MOV o WEBM.")}
              </p>
            </div>
          ) : (
            <>
              {/* What they are about to post, big enough to judge. */}
              <div className="relative grid aspect-square w-full place-items-center overflow-hidden bg-ink/5 dark:bg-white/5">
                {cur && (cur.video ? (
                  /* ⚠️ `playsInline` or iOS takes the clip fullscreen the moment it plays, on top
                     of this sheet, and the person loses the caption they were writing. Muted so
                     a preview never starts talking; controls so they can check it anyway. */
                  <video key={cur.url} src={cur.url} controls playsInline muted preload="metadata"
                    className="h-full w-full object-contain" />
                ) : (
                  <img key={cur.url} src={cur.url} alt={cur.name} className="h-full w-full object-contain" />
                ))}
              </div>

              {previews.length > 1 && (
                <div className="ow-scroll flex gap-1.5 overflow-x-auto px-4 py-2.5">
                  {previews.map((p, i) => (
                    <button key={p.url} type="button" onClick={() => setAt(i)}
                      aria-label={`${W(lang, "File", "Archivo")} ${i + 1}`} aria-pressed={i === at}
                      className={`ow-tap relative h-14 w-14 shrink-0 overflow-hidden rounded-lg
                        ${i === at ? "ring-2 ring-brand" : "opacity-55"}`}>
                      {p.video
                        ? <video src={p.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        : <img src={p.url} alt="" className="h-full w-full object-cover" />}
                      {p.video && (
                        <span className="absolute bottom-0.5 right-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="px-4 pb-3 pt-2.5">
                <textarea value={caption} disabled={busy}
                  onChange={e => setCaption(e.target.value.slice(0, 500))} rows={3}
                  placeholder={W(lang, "Say something about this…", "Di algo sobre esto…")}
                  /* ⚠️ `.ow-edge`, NOT an inline faint border. A caption box is a CONTROL, and the
                     measured floor for a control's edge is 3 to 1 — `border-ink/10` is a card
                     divider at about 1.2 to 1, and `dark:border-white/12` was invisible in the
                     dark screenshot. One class, already swept through 21 other controls for
                     exactly this complaint. */
                  className="ow-edge w-full resize-none rounded-xl border bg-transparent px-3 py-2.5
                    text-[13px] leading-relaxed outline-none focus:border-brand/50" />
                <p className="pt-1 text-right text-[10.5px] font-semibold opacity-40 tabular-nums">
                  {caption.length}/500
                </p>
              </div>
            </>
          )}

          {/* Kink 2 — name the file and the reason, never a count. */}
          {rejected.length > 0 && (
            <div className="mx-4 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
              <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">
                {rejected.length === 1
                  ? W(lang, "One file was left out", "Se omitió un archivo")
                  : W(lang, `${rejected.length} files were left out`, `Se omitieron ${rejected.length} archivos`)}
              </p>
              <ul className="mt-1 space-y-0.5">
                {rejected.slice(0, 5).map((r: Rejected) => (
                  <li key={r.name} className="text-[11.5px] opacity-75">
                    <span className="font-semibold">{r.name}</span>{" — "}
                    {/* ⚠️ THE MEGABYTES AND WHAT TO DO ABOUT THEM. Already learned once in this
                        shell: *"a phone file name like inbound1080…mp4 and 'exceeds 300 MB' told
                        the person nothing they could act on."* */}
                    {r.why === "size"
                      ? W(lang, `${r.mb} MB — the limit is 300. Record at 1080p instead of 4K, or trim it.`,
                               `${r.mb} MB — el límite es 300. Grábalo en 1080p en vez de 4K, o recórtalo.`)
                      : W(lang, "not a photo or video we can post", "no es una foto o video que podamos publicar")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* HEIC uploads and then will not paint for most of the people looking. Said once,
              here, rather than discovered later as a broken tile. */}
          {needConversion.length > 0 && (
            <p className="mx-4 mb-3 text-[11.5px] opacity-60">
              {W(lang, "iPhone photos (HEIC) may not show for everyone. JPG is safer.",
                       "Las fotos de iPhone (HEIC) pueden no verse para todos. JPG es más seguro.")}
            </p>
          )}

          {tooLong.length > 0 && (
            <div className="mx-4 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
              <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">
                {W(lang, "Too long to post", "Demasiado largo para publicar")}
              </p>
              <ul className="mt-1 space-y-0.5">
                {tooLong.slice(0, 5).map(n => (
                  <li key={n} className="text-[11.5px] opacity-75">
                    <span className="font-semibold">{n}</span>{" — "}
                    {W(lang, "longer than five minutes, or it couldn't be read. Trim it and add it again.",
                             "dura más de cinco minutos, o no se pudo leer. Recórtalo y vuelve a agregarlo.")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {err && <p className="mx-4 mb-3 text-[12px] font-bold text-red-500">{err}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-ink/8 px-4 py-3 dark:border-white/10">
          {/* Kink 3 — which file of how many, right now. */}
          {busy && step ? (
            /* Kink 3 — which file of how many, and for a video the percentage, because tus
               reports real bytes and a long clip otherwise looks stuck. */
            <p className="min-w-0 flex-1 truncate text-[12px] font-semibold opacity-65">
              {step.done >= step.total
                ? W(lang, "Finishing…", "Terminando…")
                : `${W(lang, "Uploading", "Subiendo")} ${step.done + 1}/${step.total}`
                  + (step.pct !== null ? ` · ${step.pct}%` : "")
                  + (step.name ? ` · ${step.name}` : "")}
            </p>
          ) : (
            <button type="button" onClick={onCancel}
              className="ow-tap rounded-xl px-3 py-2 text-[12.5px] font-bold opacity-60">
              {W(lang, "Cancel", "Cancelar")}
            </button>
          )}
          <button type="button" onClick={() => void publish()} disabled={busy || nothingUsable || checking}
            className="ow-tap ml-auto shrink-0 rounded-xl bg-brand px-4 py-2 text-[12.5px] font-bold text-white
              disabled:opacity-40">
            {busy ? W(lang, "Posting…", "Publicando…")
              : checking ? W(lang, "Checking…", "Revisando…")
              : W(lang, "Post", "Publicar")}
          </button>
        </div>
      </div>
    </div>
  );
}
