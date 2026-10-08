import { Link } from "react-router-dom";
import {
  useI18n, useOneId, useBadgeTier, useAsync, supabase, productHref, getTierInfo, W,
} from "@oneworld/shell";
import { useScoreData } from "./useScoreData";

/**
 * OneScore's profile SLOTS — the only parts of the profile screen that are the app's own.
 * Quick tiles + the stats row. No calendar (locked: Score has none). Every number here is a
 * fact about the person and comes from the database — the score is the published snapshot,
 * the tier is the activity ladder, reviews are counted rows.
 */
export function ScoreTiles() {
  const { lang } = useI18n();
  const T = [
    { to: "/score", en: "My score", es: "Mi puntaje" },
    { to: "/connect", en: "Connect", es: "Conectar" },
    { to: "/simulator", en: "Simulator", es: "Simulador" },
    { to: "/how", en: "How it works", es: "Cómo funciona" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {T.map(t => (
        <Link key={t.to} to={productHref("onescore", t.to)}
          className="card p-3.5 text-center font-bold transition hover:bg-brand/5">
          {W(lang, t.en, t.es)}
        </Link>
      ))}
    </div>
  );
}

export function ScoreStats() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const { tier } = useBadgeTier(userId);
  const { published } = useScoreData();
  /* "Where I am in my industry" — the dashboard stat Lee asked for (9 Aug). Rank = position
     among published scores in the same industry, straight from the database. */
  const rank = useAsync(async () => {
    const { data: mine } = await supabase.from("profiles")
      .select("industry, score_v9_snapshot").eq("id", userId!).maybeSingle();
    if (!mine?.industry || mine.score_v9_snapshot == null) return null;
    const { count } = await supabase.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("industry", mine.industry)
      .gt("score_v9_snapshot", mine.score_v9_snapshot);
    return { pos: (count ?? 0) + 1, industry: mine.industry };
  }, [userId], !!userId);
  const tierInfo = getTierInfo(tier ?? "member");

  const CELLS = [
    { label: W(lang, "Score", "Puntaje"), value: published != null ? String(published) : "—" },
    { label: W(lang, "Tier", "Nivel"), value: W(lang, tierInfo.label, tierInfo.labelEs) },
    { label: rank ? rank.industry : W(lang, "Industry rank", "Rango industria"),
      value: rank ? `#${rank.pos}` : "—" },
  ];
  return (
    <div className="card grid grid-cols-3 divide-x divide-ink/5 p-0 dark:divide-white/5">
      {CELLS.map(c => (
        <div key={c.label} className="p-3 text-center">
          <p className="text-lg font-extrabold">{c.value}</p>
          <p className="text-[11.5px] opacity-55">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
