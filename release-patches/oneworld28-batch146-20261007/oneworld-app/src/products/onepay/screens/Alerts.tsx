import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading } from "@oneworld/shell";

/** /pay/alerts — the bell. Reads the shared `notifications` table; nothing product-specific is invented. */
export default function Alerts() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const rows = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("notifications").select("id, title, body, created_at, read_at, link")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    return (data ?? []) as { id: string; title: string; body: string | null; created_at: string; link: string | null }[];
  }, [userId]);
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{W(lang, "Alerts", "Avisos")}</ScreenHeading>
      <div className="mt-4 space-y-2">
        {rows === undefined && [0, 1].map(i => <div key={i} className="card ow-shimmer h-16" />)}
        {rows?.length === 0 && <div className="card p-8 text-center"><p className="text-sm font-bold">{W(lang, "Nothing yet.", "Nada todavía.")}</p></div>}
        {rows?.map(n => (
          <Link key={n.id} to={n.link ?? productHref("onepay")} className="card ow-tap block p-3">
            <p className="text-[13.5px] font-bold">{n.title}</p>
            {n.body && <p className="mt-0.5 text-[12.5px] opacity-70">{n.body}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
