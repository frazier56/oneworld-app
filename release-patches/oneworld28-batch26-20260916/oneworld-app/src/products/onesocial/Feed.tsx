import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HomeTop, Avatar, useI18n, useAsync, supabase, productHref, W,
  IconPlatform, IconChat, IconPhoto, IconVideo,
  useOneId, startConversation,
} from "@oneworld/shell";

/**
 * /social — HOME: ALL social media, ONE feed.
 * ============================================================================================
 * Lee (9 Aug): "You're seeing all social media coming together in one feed — a new YouTube
 * video right below a new TikTok post, right below a Facebook post, and that can be anybody.
 * That's powerful." So every card wears its SOURCE platform badge, and the pills are platform
 * filters built from what is actually in the feed — YouTube next to TikTok next to a native
 * OneSocial upload.
 *
 * The head (search · composer · pills) is the shared HomeTop; only this feed is ours.
 * Money copy stays out — always. `profiles` reads name their columns.
 */
type Post = {
  id: string; user_id: string; media_type: string; media_url: string | null;
  thumbnail_url: string | null; caption: string | null; likes_count: number;
  comments_count: number; created_at: string; source: string | null; source_platform: string | null;
};
type Author = { id: string; full_name: string | null; photo_url: string | null; job_title: string | null };

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
  x: "X", twitter: "X", twitch: "Twitch",
};

export default function Feed() {
  const { lang } = useI18n();
  const { userId: myId } = useOneId();
  const nav = useNavigate();
  /* §4.7 — reply opens a conversation. Shell helper, product button. */
  const [replying, setReplying] = useState<string | null>(null);
  const reply = async (authorId: string) => {
    if (!myId || authorId === myId) return;
    setReplying(authorId);
    const res = await startConversation(myId, authorId);
    setReplying(null);
    if ("error" in res) { console.error("[Feed] reply failed:", res.error); return; }
    nav(productHref("onesocial", `/messages/${res.conversationId}`));
  };

  const [q, setQ] = useState("");
  /* Multi-select (Lee, 9 Aug): "which platforms do I want in my home page — YouTube AND
     Instagram." Empty set = everything; "All" clears the set. */
  const [sel, setSel] = useState<string[]>([]);

  const posts = useAsync(async () => {
    const { data } = await supabase.from("media_posts")
      .select("id, user_id, media_type, media_url, thumbnail_url, caption, likes_count, comments_count, created_at, source, source_platform")
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Post[];
  }, []);

  const authors = useAsync(async () => {
    const ids = [...new Set((posts ?? []).map(p2 => p2.user_id))];
    if (!ids.length) return {} as Record<string, Author>;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title").in("id", ids);
    return Object.fromEntries(((data ?? []) as Author[]).map(a => [a.id, a]));
  }, [posts?.length], posts !== undefined);

  /* Which platform a post came FROM — the aggregated feed's whole story. */
  const platformOf = (p2: Post) =>
    (p2.source_platform ?? "").toLowerCase() || (p2.source === "upload" || !p2.source ? "onesocial" : p2.source.toLowerCase());

  /* Pills are built from the feed itself, so a platform only appears once someone's posts from
     it are actually here — no dead filters. */
  const pills = useMemo(() => {
    const present = [...new Set((posts ?? []).map(platformOf))];
    return [
      { key: "all", label: W(lang, "All", "Todo") },
      ...present.map(k => ({
        key: k,
        label: k === "onesocial" ? "OneSocial" : (PLATFORM_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1)),
      })),
    ];
  }, [posts, lang]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (posts ?? [])
      .filter(p2 => sel.length === 0 || sel.includes(platformOf(p2)))
      .filter(p2 => {
        if (!needle) return true;
        const a = authors?.[p2.user_id];
        return (p2.caption ?? "").toLowerCase().includes(needle)
          || (a?.full_name ?? "").toLowerCase().includes(needle);
      });
  }, [posts, authors, q, sel]);

  return (
    <HomeTop
      product="onesocial"
      composeTo={productHref("onesocial", "/post")}
      onSearch={setQ}
      pills={pills}
      activePills={sel.length ? sel : ["all"]}
      onPill={k => setSel(cur =>
        k === "all" ? [] : cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k])}
      feedSlot={
        posts === undefined ? (
          <div className="card p-6 text-center text-sm opacity-60">…</div>
        ) : list.length ? (
          <div className="space-y-3">
            {list.map(p2 => {
              const a = authors?.[p2.user_id];
              const plat = platformOf(p2);
              return (
                <article key={p2.id} className="card overflow-hidden p-0">
                  <div className="flex items-center gap-3 px-4 pt-3">
                    <Link to={productHref("onesocial", `/p/${p2.user_id}`)}
                      className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar src={a?.photo_url} name={a?.full_name} size={38} rounded="rounded-full" textSize="text-xs" />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold">{a?.full_name ?? W(lang, "Member", "Miembro")}</p>
                        {a?.job_title && <p className="truncate text-[12px] opacity-55">{a.job_title}</p>}
                      </div>
                    </Link>
                    {/* The source badge — the one extra thing each card earns, because "which
                        platform did this come from" IS the product. */}
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink/10 px-2.5 py-1 text-[11.5px] font-bold opacity-70 dark:border-white/15">
                      {plat !== "onesocial" && <IconPlatform name={plat} size={13} />}
                      {plat === "onesocial" ? "OneSocial" : (PLATFORM_LABEL[plat] ?? plat)}
                    </span>
                  </div>
                  {p2.caption && <p className="px-4 pt-2 text-[14px] leading-snug">{p2.caption}</p>}
                  {p2.media_url && (
                    p2.media_type.toUpperCase() === "VIDEO" ? (
                      <video src={p2.media_url} poster={p2.thumbnail_url ?? undefined} controls
                        className="mt-2 max-h-96 w-full bg-ink/5 object-contain dark:bg-white/5" />
                    ) : (
                      <img src={p2.media_url} alt={p2.caption ?? ""} loading="lazy"
                        className="mt-2 max-h-96 w-full bg-ink/5 object-cover dark:bg-white/5" />
                    )
                  )}
                  <div className="flex items-center gap-4 px-4 py-2.5 text-[12.5px] opacity-60">
                    <span className="flex items-center gap-1">
                      {p2.media_type.toUpperCase() === "VIDEO" ? <IconVideo size={14} /> : <IconPhoto size={14} />}
                      {p2.likes_count}
                    </span>
                    <span className="flex items-center gap-1"><IconChat size={14} />{p2.comments_count}</span>
                    {/* ── §4.7: REPLYING TO A POST OPENS A CONVERSATION ────────────────────────
                        *"Responding to a post routes to that person's Messages and starts a
                        thread."* It calls the SHELL's `startConversation`, the same helper the
                        inbox's New-message button and a profile's Message button use — so the
                        three entry points cannot create three subtly different conversation rows,
                        and `is_request` is computed the same way in all three (a reply to somebody
                        you are not connected to lands in THEIR Requests, not their main inbox). */}
                    <button onClick={() => void reply(p2.user_id)} disabled={replying === p2.user_id || !myId}
                      className="ow-tap ml-auto flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 text-[12px] font-bold opacity-100 transition hover:bg-brand/5 disabled:opacity-40 dark:border-white/15">
                      {replying === p2.user_id ? "…" : W(lang, "Reply", "Responder")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-sm font-bold">
              {W(lang, "Your feed starts with your platforms.", "Tu feed empieza con tus plataformas.")}
            </p>
            <p className="mt-1 text-[12.5px] opacity-55">
              {W(lang,
                "Connect Instagram, TikTok, YouTube and the rest — everything lands here, in one place.",
                "Conecta Instagram, TikTok, YouTube y más — todo llega aquí, en un solo lugar.")}
            </p>
            <Link to={productHref("onesocial", "/connect")} className="btn-brand mt-4 inline-block">
              {W(lang, "Connect your platforms", "Conecta tus plataformas")}
            </Link>
          </div>
        )
      }
    />
  );
}
