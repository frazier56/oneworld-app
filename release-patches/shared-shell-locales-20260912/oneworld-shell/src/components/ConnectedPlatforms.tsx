import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";

const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);

/**
 * CONNECTED PLATFORMS — metrics ONLY (SHELL). Matrix: "Connected platforms (metrics only, no
 * imported media)". The platforms the person linked, with follower/like/post COUNTS — never the
 * imported posts themselves (those live in OneSocial). Identical on every app. Config-free.
 */
export default function ConnectedPlatforms({ userId }: { userId: string }) {
  const { lang } = useI18n();
  const isEs = lang === "es";

  const rows = useAsync(async () => {
    const { data: conns } = await supabase.from("social_connections_public")
      .select("id, platform, username, is_verified").eq("user_id", userId).eq("is_active", true);
    const out: { platform: string; username: string | null; verified: boolean; followers: number; likes: number; posts: number }[] = [];
    for (const c of (conns ?? [])) {
      const { data: snap } = await supabase.from("social_snapshots")
        .select("followers, total_likes, total_posts").eq("connection_id", c.id)
        .order("captured_at", { ascending: false }).limit(1).maybeSingle();
      out.push({
        platform: String(c.platform), username: c.username as string | null, verified: !!c.is_verified,
        followers: (snap as any)?.followers ?? 0, likes: (snap as any)?.total_likes ?? 0, posts: (snap as any)?.total_posts ?? 0,
      });
    }
    return out;
  }, [userId], !!userId);

  const list = rows ?? [];
  if (!list.length) return (
    <section className="card p-4">
      <h2 className="mb-1 font-bold">{isEs ? "Plataformas conectadas" : "Connected platforms"}</h2>
      <p className="py-2 text-center text-[13px] opacity-50">{isEs ? "Ninguna conectada todavía." : "None connected yet."}</p>
    </section>
  );

  return (
    <section className="card p-4">
      <h2 className="mb-2.5 font-bold">{isEs ? "Plataformas conectadas" : "Connected platforms"}</h2>
      <div className="space-y-2">
        {list.map((r, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-ink/8 bg-ink/[0.02] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold capitalize">{r.platform}{r.verified && <span className="ml-1 text-brand">✓</span>}</p>
              {r.username && <p className="truncate text-[11px] opacity-55">@{r.username}</p>}
            </div>
            <div className="flex shrink-0 gap-4 text-center">
              <div><p className="text-sm font-extrabold text-brand">{fmt(r.followers)}</p><p className="text-[9px] uppercase tracking-wide opacity-50">{isEs ? "Seguidores" : "Followers"}</p></div>
              <div><p className="text-sm font-extrabold text-brand">{fmt(r.likes)}</p><p className="text-[9px] uppercase tracking-wide opacity-50">{isEs ? "Me gusta" : "Likes"}</p></div>
              <div><p className="text-sm font-extrabold text-brand">{fmt(r.posts)}</p><p className="text-[9px] uppercase tracking-wide opacity-50">{isEs ? "Posts" : "Posts"}</p></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
