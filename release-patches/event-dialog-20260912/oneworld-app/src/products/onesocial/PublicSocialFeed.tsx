import { useParams } from "react-router-dom";
import { useI18n, useAsync, supabase, W, IconPlatform } from "@oneworld/shell";

/**
 * The person's OWN cross-platform feed, on their PUBLIC profile (Lee, 9 Aug): "someone can
 * come look at your OneSocial profile and see anything you posted recently — your YouTube,
 * your Instagram, your TikTok, all in one place." Passed into the shell's PublicWorld as
 * `belowSlot` — the shell owns the header/hub/passport; what OneSocial is ABOUT is ours.
 */
type Post = {
  id: string; media_type: string; media_url: string | null; thumbnail_url: string | null;
  caption: string | null; created_at: string; source: string | null; source_platform: string | null;
};

const LABEL: Record<string, string> = {
  youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
  x: "X", twitter: "X", twitch: "Twitch",
};

export default function PublicSocialFeed() {
  const { lang } = useI18n();
  const { userId } = useParams();

  const posts = useAsync(async () => {
    const { data } = await supabase.from("media_posts")
      .select("id, media_type, media_url, thumbnail_url, caption, created_at, source, source_platform")
      .eq("user_id", userId!).eq("moderation_status", "visible")
      .order("created_at", { ascending: false }).limit(20);
    return (data ?? []) as Post[];
  }, [userId], !!userId);

  if (!posts?.length) return null;

  const plat = (p: Post) =>
    (p.source_platform ?? "").toLowerCase() || (p.source === "upload" || !p.source ? "onesocial" : p.source.toLowerCase());

  return (
    <section>
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest opacity-45">
        {W(lang, "Recent posts — all platforms", "Publicaciones recientes — todas las plataformas")}
      </p>
      <div className="space-y-3">
        {posts.map(p => {
          const k = plat(p);
          return (
            <article key={p.id} className="card overflow-hidden p-0">
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="flex items-center gap-1.5 rounded-full border border-ink/10 px-2.5 py-1 text-[11.5px] font-bold opacity-70 dark:border-white/15">
                  {k !== "onesocial" && <IconPlatform name={k} size={13} />}
                  {k === "onesocial" ? "OneSocial" : (LABEL[k] ?? k)}
                </span>
              </div>
              {p.caption && <p className="px-4 pt-2 text-[14px] leading-snug">{p.caption}</p>}
              {p.media_url && (
                p.media_type.toUpperCase() === "VIDEO"
                  ? <video src={p.media_url} poster={p.thumbnail_url ?? undefined} controls className="mt-2 max-h-96 w-full bg-ink/5 object-contain dark:bg-white/5" />
                  : <img src={p.media_url} alt={p.caption ?? ""} loading="lazy" className="mt-2 max-h-96 w-full bg-ink/5 object-cover dark:bg-white/5" />
              )}
              <div className="px-4 py-2.5" />
            </article>
          );
        })}
      </div>
    </section>
  );
}
