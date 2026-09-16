import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W } from "@oneworld/shell";

/**
 * OneSocial's profile SLOTS — quick tiles + stats row. No calendar (locked: Social has none).
 * Counts are facts about the person: they come from the database, never a device flag.
 */
export function SocialTiles() {
  const { lang } = useI18n();
  /* The profile is the at-a-glance dashboard (Lee, 9 Aug): connected apps up front. The
     detailed manage view is the centre Connect button; Post lives in the home composer. */
  const T = [
    { to: "/connect", en: "My platforms", es: "Mis plataformas" },
    { to: "", en: "Feed", es: "Feed" },
    { to: "/people", en: "Connections", es: "Conexiones" },
    { to: "/messages", en: "Messages", es: "Mensajes" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {T.map(t => (
        <Link key={t.en} to={productHref("onesocial", t.to)}
          className="card p-3.5 text-center font-bold transition hover:bg-brand/5">
          {W(lang, t.en, t.es)}
        </Link>
      ))}
    </div>
  );
}

export function SocialStats() {
  const { lang } = useI18n();
  const { userId } = useOneId();

  const connections = useAsync(async () => {
    const { count } = await supabase.from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
    return count ?? 0;
  }, [userId], !!userId);

  const platforms = useAsync(async () => {
    const { count } = await supabase.from("social_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId!).eq("is_active", true);
    return count ?? 0;
  }, [userId], !!userId);

  const reviews = useAsync(async () => {
    const { count } = await supabase.from("job_reviews")
      .select("id", { count: "exact", head: true }).eq("reviewee_id", userId!);
    return count ?? 0;
  }, [userId], !!userId);

  const CELLS = [
    { label: W(lang, "Connections", "Conexiones"), value: connections },
    { label: W(lang, "Platforms", "Plataformas"), value: platforms },
    { label: W(lang, "Reviews", "Reseñas"), value: reviews },
  ];
  return (
    <div className="card grid grid-cols-3 divide-x divide-ink/5 p-0 dark:divide-white/5">
      {CELLS.map(c => (
        <div key={c.label} className="p-3 text-center">
          <p className="text-lg font-extrabold">{c.value != null ? String(c.value) : "—"}</p>
          <p className="text-[11.5px] opacity-55">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
