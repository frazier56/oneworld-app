import { useEffect, useRef, useState } from "react";
import { supabase, useOneId, Avatar, W, type EngagementSource } from "@oneworld/shell";

/**
 * COMMENTS, IN A SHEET — R24.
 * ============================================================================================
 * Lee: *"the comment section is not polished at all. It just disjoints everything — the whole
 * right side rail icons move crazy. We need a very polished comment section where people can
 * make comments. Viewing comments, I don't know where people will view the comments."*
 *
 * Both halves of that are one cause. `ListingEngagement` opens its comments INLINE, directly
 * under the three controls, because on a listing card that is exactly right — the card is in a
 * scrolling page and it can grow. In the world feed those three controls are a fixed column
 * pinned to the right edge of a full-screen video, so growing them pushed save, comment and
 * share up the screen every time somebody tapped comment. That is the rail moving crazy, and
 * there was nowhere to read anything because the list was squeezed into a 56-pixel column.
 *
 * So the feed takes the comment button over — `ListingEngagement` accepts `onComments` for
 * exactly this — and opens a sheet instead. The rail never changes height. The reading happens
 * where reading is possible.
 *
 * ── SAME ROWS, NOT A SECOND COMMENT SYSTEM ──────────────────────────────────────────────────
 * `media_comments`, keyed by `(media_item_id, media_source)` — the same two columns the classic
 * screens write and read. A comment left here is the comment they see there.
 */

type Row = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string | null; photo_url: string | null } | null;
};

function ago(iso: string, lang: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return W(lang, "just now", "ahora");
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function CommentSheet({ itemId, source, title, lang, onClose }: {
  itemId: string; source: EngagementSource; title: string; lang: string; onClose: () => void;
}) {
  const { userId, displayName, photoUrl } = useOneId();
  const me = { full_name: displayName ?? null, photo_url: photoUrl ?? null };
  const [rows, setRows] = useState<Row[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  /* Resting, then writing — Instagram's two steps. */
  const [writing, setWriting] = useState(false);

  /* One read, then one more after every successful post. Comments on a feed item are counted in
     tens, not thousands, so paging would be machinery for a problem nobody has. */
  const load = async () => {
    const { data, error } = await supabase
      .from("media_comments")
      .select("id, user_id, content, created_at")
      .eq("media_item_id", itemId).eq("media_source", source)
      .order("created_at", { ascending: true });
    if (error) { setRows([]); return; }
    const list = (data ?? []) as Row[];
    const ids = [...new Set(list.map(r => r.user_id))];
    if (ids.length) {
      const { data: people } = await supabase
        .from("profiles").select("id, full_name, photo_url").in("id", ids);
      const by = Object.fromEntries((people ?? []).map((p: any) => [p.id, p]));
      list.forEach(r => { r.author = by[r.user_id] ?? null; });
    }
    setRows(list);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [itemId, source]);

  /* Escape closes, and the page behind must not scroll while a sheet is over it. */
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => {
    if (rows) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [rows?.length]);

  /* Tapping the invitation must put the caret where the person expects it, not just paint a box. */
  useEffect(() => { if (writing) field.current?.focus(); }, [writing]);

  const send = async () => {
    const body = text.trim();
    if (!body || !userId || sending) return;
    setSending(true); setFailed(false);
    const { error } = await supabase.from("media_comments")
      .insert({ media_item_id: itemId, media_source: source, user_id: userId, content: body });
    setSending(false);
    if (error) { setFailed(true); return; }
    setText(""); setWriting(false);
    await load();
    /* The classic screens read their count off this table too, so they update by themselves. */
    window.dispatchEvent(new CustomEvent("ow-comments-changed", { detail: { itemId, source } }));
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={W(lang, "Comments", "Comentarios")}
      className="absolute inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}>
      <div aria-hidden className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

      {/* Seventy-two percent of the screen: tall enough to read a conversation, short enough
          that the slide underneath is still visible, so the sheet reads as being ON the post
          rather than as a page you were taken to. */}
      <div onClick={e => e.stopPropagation()}
        className="relative flex h-[72%] w-full flex-col rounded-t-3xl border-t ow-edge bg-paper
          text-ink dark:bg-ink dark:text-paper">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/20 dark:bg-white/25" />
          <b className="text-[16px] font-extrabold tracking-tight">
            {W(lang, "Comments", "Comentarios")}
            {rows?.length ? <span className="ml-1.5 opacity-45">{rows.length}</span> : null}
          </b>
          <button type="button" onClick={onClose}
            className="ow-tap rounded-full border ow-edge px-3 py-1.5 text-[13px] font-bold">
            {W(lang, "Close", "Cerrar")}
          </button>
        </div>
        <p className="line-clamp-1 px-4 pb-2 text-[12.5px] opacity-55">{title}</p>

        <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 pb-3">
          {rows === null && <p className="py-6 text-center text-[13px] opacity-50">{W(lang, "Loading…", "Cargando…")}</p>}
          {rows?.length === 0 && (
            <p className="py-8 text-center text-[13.5px] opacity-55">
              {W(lang, "No comments yet. Be the first.", "Sin comentarios todavía. Sé el primero.")}
            </p>
          )}
          {rows?.map(r => (
            <div key={r.id} className="flex gap-2.5">
              <Avatar name={r.author?.full_name ?? "—"} src={r.author?.photo_url ?? null} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold leading-tight">
                  {r.author?.full_name ?? W(lang, "Someone", "Alguien")}
                  <span className="ml-1.5 text-[11.5px] font-semibold opacity-45">{ago(r.created_at, lang)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{r.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── THE COMPOSER HAS TWO STATES (R25) ─────────────────────────────────────────────
            Lee: *"when you tap comment you see all the comments, and at the very bottom you
            have to tap into the field where it says join the conversation. You tap it again,
            you've got your picture on the left side, emojis and stuff on the right, then you
            leave your comment."*

            So it rests as ONE LINE — avatar, the invitation, a sticker glyph — and the emoji row
            and the Post button do not exist until somebody has said they want to write. That is
            the whole reason Instagram does it: a full composer sitting open under every post is
            a keyboard's worth of furniture in front of the thing you came to read.

            ⚠️ AND THE FOOTER IS GONE WHILE THIS IS OPEN. Lee: *"I don't think the comment
            section can be exactly the same, because we have our footer."* Right — Instagram has
            no tab bar on a reel. Ours is a floating pill at the bottom of the screen and the
            composer would have landed underneath it. The feed hides its own chrome for the life
            of the sheet (see WorldFeed), so the bottom of the screen belongs to the composer
            while you are writing and comes back when you close. */}
        <div className="border-t ow-edge px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
          {!userId ? (
            <p className="py-2 text-center text-[13px] opacity-60">
              {W(lang, "Sign in to comment.", "Inicia sesión para comentar.")}
            </p>
          ) : !writing ? (
            <button type="button" onClick={() => setWriting(true)}
              className="ow-tap flex w-full items-center gap-2.5 rounded-full border ow-edge bg-white/70
                px-3 py-2.5 text-left dark:bg-white/10">
              <Avatar name={me.full_name ?? "—"} src={me.photo_url} size={30} />
              <span className="flex-1 text-[14.5px] opacity-55">
                {W(lang, "Join the conversation…", "Únete a la conversación…")}
              </span>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 opacity-50" aria-hidden>
                <path d="M20 13.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7.5z" />
                <path d="M13.5 20v-4.5a2 2 0 0 1 2-2H20z" />
                <path d="M9 10h.01M15 10h.01M9.2 14.2a4 4 0 0 0 5.6 0" />
              </svg>
            </button>
          ) : (
            <>
              {/* One tap posts a reaction. Most people want to react, not write, and making
                  them type it loses the reaction. */}
              <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
                {["❤️", "🙌", "🔥", "👏", "🥰", "😍", "😮", "😂"].map(e => (
                  <button key={e} type="button" onClick={() => setText(t => t + e)}
                    className="ow-tap grid h-9 w-9 place-items-center rounded-full text-[21px] leading-none"
                    aria-label={e}>{e}</button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <span className="shrink-0 pb-1">
                  <Avatar name={me.full_name ?? "—"} src={me.photo_url} size={32} />
                </span>
                <textarea ref={field} value={text} onChange={e => setText(e.target.value)} rows={1}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  onBlur={() => { if (!text.trim()) setWriting(false); }}
                  placeholder={W(lang, "Add a comment…", "Escribe un comentario…")}
                  className="max-h-24 min-h-[44px] flex-1 resize-none rounded-2xl border ow-edge bg-white/70
                    px-3.5 py-2.5 text-[14.5px] outline-none dark:bg-white/10" />
                <button type="button" onClick={() => void send()} disabled={!text.trim() || sending}
                  className="ow-tap grid h-[44px] shrink-0 place-items-center rounded-2xl bg-clay px-4
                    text-[14px] font-extrabold text-white disabled:opacity-40">
                  {sending ? W(lang, "Sending…", "Enviando…") : W(lang, "Post", "Publicar")}
                </button>
              </div>
            </>
          )}
          {failed && (
            <p className="pt-1.5 text-[12.5px] font-semibold text-red-500">
              {W(lang, "That didn't send. Try again.", "No se envió. Inténtalo de nuevo.")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
