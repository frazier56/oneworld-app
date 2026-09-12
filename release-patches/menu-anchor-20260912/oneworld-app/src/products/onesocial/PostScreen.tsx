import { ScreenHeading } from "@oneworld/shell";
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, supabase, productHref, W,
  IconVideo, IconPhoto, IconWrite, IconLive,
} from "@oneworld/shell";

/**
 * /social/post — THE RAISED CENTRE SLOT: compose.
 * ============================================================================================
 * Honours HomeTop's `?mode=` (video · photo · write · live), uploads media to the public
 * `media` bucket, inserts the `media_posts` row, and READS THE WRITE BACK before declaring
 * success — a migration that reported success and changed nothing has happened twice on this
 * platform, and a post is the same class of write.
 *
 * "Go Live" is honest about its state: it takes a title and posts a live-intent card; real
 * streaming is a later leg, and pretending otherwise on a credibility platform is a defect.
 */
type Mode = "video" | "photo" | "write" | "live";

export default function PostScreen() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initial = (["video", "photo", "write", "live"].includes(params.get("mode") ?? "")
    ? params.get("mode") : "write") as Mode;
  const [mode, setMode] = useState<Mode>(initial);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "posting" | "failed">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const MODES: { id: Mode; label: string; icon: JSX.Element }[] = [
    { id: "video", label: W(lang, "Video", "Video"), icon: <IconVideo size={16} /> },
    { id: "photo", label: W(lang, "Photo", "Foto"), icon: <IconPhoto size={16} /> },
    { id: "write", label: W(lang, "Write", "Escribir"), icon: <IconWrite size={16} /> },
    { id: "live", label: W(lang, "Go Live", "En vivo"), icon: <IconLive size={16} /> },
  ];

  const needsMedia = mode === "video" || mode === "photo";
  const canPost = !!userId && state !== "posting"
    && (needsMedia ? !!file : caption.trim().length > 0);

  const post = async () => {
    if (!canPost || !userId) return;
    setState("posting");
    try {
      let mediaUrl: string | null = null;
      let mediaType = mode === "video" ? "VIDEO" : mode === "photo" ? "PHOTO" : "TEXT";
      if (needsMedia && file) {
        const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, file);
        if (upErr) throw upErr;
        mediaUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }
      if (mode === "live") mediaType = "LIVE";
      const { data: inserted, error } = await supabase.from("media_posts")
        .insert({ user_id: userId, media_type: mediaType, media_url: mediaUrl, caption: caption.trim() || null })
        .select("id").single();
      if (error || !inserted?.id) throw error ?? new Error("no id back");
      /* Read the write back before celebrating. */
      const { data: check } = await supabase.from("media_posts")
        .select("id").eq("id", inserted.id).maybeSingle();
      if (!check) throw new Error("write did not read back");
      nav(productHref("onesocial"));
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="space-y-4">
      <ScreenHeading>{W(lang, "Post", "Publicar")}</ScreenHeading>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
              mode === m.id ? "bg-teal text-white" : "border border-ink/10 dark:border-white/15"}`}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>

      <div className="card space-y-3 p-4">
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={mode === "write" ? 6 : 3}
          placeholder={mode === "live"
            ? W(lang, "What's your live about?", "¿De qué trata tu directo?")
            : W(lang, "Say something…", "Di algo…")}
          className="w-full resize-none rounded-xl border border-ink/10 bg-transparent px-3 py-2.5 text-[14px] outline-none placeholder:opacity-50 dark:border-white/15"
        />

        {needsMedia && (
          <>
            <input ref={fileRef} type="file"
              accept={mode === "video" ? "video/*" : "image/*"}
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="btn-ghost w-full">
              {file
                ? file.name
                : mode === "video"
                  ? W(lang, "Choose a video", "Elige un video")
                  : W(lang, "Choose a photo", "Elige una foto")}
            </button>
          </>
        )}

        {mode === "live" && (
          <p className="text-[12.5px] leading-snug opacity-55">
            {W(lang,
              "This posts a live announcement to the feed. Streaming itself is coming — we don't fake it.",
              "Esto publica un anuncio en vivo en el feed. La transmisión llegará pronto — no la simulamos.")}
          </p>
        )}

        <button onClick={post} disabled={!canPost} className="btn-brand w-full disabled:opacity-50">
          {state === "posting" ? "…" : W(lang, "Post", "Publicar")}
        </button>
        {state === "failed" && (
          <p className="text-center text-[12.5px] font-bold text-red-500">
            {W(lang, "That didn't save. Nothing was posted — try again.", "No se guardó. No se publicó nada — reintenta.")}
          </p>
        )}
        {!userId && (
          <p className="text-center text-[12.5px] opacity-55">
            {W(lang, "Sign in to post.", "Inicia sesión para publicar.")}
          </p>
        )}
      </div>
    </div>
  );
}
