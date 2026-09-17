import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HomeTop, Avatar, useI18n, useOneId, useAsync, supabase, productHref, W,
} from "@oneworld/shell";

/**
 * /onescore — HOME: the community LEADERBOARD.
 * ============================================================================================
 * Lee (9 Aug): "We want people to know what their scores are relative to other people in their
 * industry, their location, and industry+location." So home is a ranked board, not a generic
 * feed: your own row pinned at the top with your rank, then everyone above and below you,
 * filterable to your industry and your city.
 *
 * v24 DR (Lee, 18 Aug): the board carries REAL leaderboard furniture now —
 *  · column headers (Rank · User · Score) with a # on every rank,
 *  · every score shows exactly one decimal, the tenth as a half-size superscript
 *    ("some of them with a tenth of a digit, some not — they ALL always have it"),
 *  · every row shows its percentile inside the current cohort (Top 1% / 5% / 10% / 25% / 50%),
 *  · a percentile filter row so you can see just the top slice.
 *
 * `profiles` is column-granted: named columns only, never select('*').
 */
type Row = {
  id: string; full_name: string | null; photo_url: string | null; job_title: string | null;
  industry: string | null; location: string | null; score_v9_snapshot: number | null;
};

type Cohort = "everyone" | "industry" | "city";
type PctFilter = 0 | 1 | 5 | 10 | 25;

const city = (loc: string | null) => (loc ?? "").split(",")[0].trim().toLowerCase();

/** Percentile of a rank position inside its cohort (1-based rank / total). */
const topPct = (rank1: number, total: number) => (total > 0 ? Math.ceil((rank1 / total) * 100) : 100);
const pctLabel = (p: number): string | null =>
  p <= 1 ? "Top 1%" : p <= 5 ? "Top 5%" : p <= 10 ? "Top 10%" : p <= 25 ? "Top 25%" : p <= 50 ? "Top 50%" : null;

/** v24 DR: every score renders whole number + superscript tenth, always. */
function ScoreNum({ v, className = "text-lg" }: { v: number | null; className?: string }) {
  if (v == null) return <span className={`${className} font-extrabold`}>—</span>;
  const whole = Math.floor(v);
  const tenth = Math.max(0, Math.min(9, Math.round((v - whole) * 10)));
  return (
    <span className={`${className} font-extrabold leading-none`}>
      {whole}
      <sup className="text-[0.55em] font-bold" style={{ verticalAlign: "super" }}>.{tenth}</sup>
    </span>
  );
}

export default function Feed() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [q, setQ] = useState("");
  const [cohort, setCohort] = useState<Cohort>("everyone");
  const [pctFilter, setPctFilter] = useState<PctFilter>(0);

  const rows = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title, industry, location, score_v9_snapshot")
      .eq("is_public", true)
      .order("score_v9_snapshot", { ascending: false, nullsFirst: false })
      .limit(200);
    return (data ?? []) as Row[];
  }, []);

  const me = useMemo(() => (rows ?? []).find(r => r.id === userId) ?? null, [rows, userId]);

  const { board, myRank, myPct, cohortTotal } = useMemo(() => {
    /* Sort HERE, not just in the query — a leaderboard that trusts the transport for its
       ranking shows wrong ranks the first time anything reorders the payload. */
    const scored = (rows ?? []).filter(r => r.score_v9_snapshot != null)
      .sort((a, b) => (b.score_v9_snapshot ?? 0) - (a.score_v9_snapshot ?? 0));
    const needle = q.trim().toLowerCase();
    const inCohort = (r: Row) =>
      cohort === "everyone" ? true
      : cohort === "industry" ? !!me?.industry && r.industry === me.industry
      : !!me?.location && city(r.location) === city(me.location);
    const ranked = scored.filter(inCohort);           // rank inside the chosen cohort
    const total = ranked.length;
    const rank = me ? ranked.findIndex(r => r.id === me.id) + 1 : 0;
    const visible = ranked
      .map((r, idx) => ({ r, rank1: idx + 1, pct: topPct(idx + 1, total) }))
      .filter(x => pctFilter === 0 || x.pct <= pctFilter)
      .filter(x => !needle
        || (x.r.full_name ?? "").toLowerCase().includes(needle)
        || (x.r.industry ?? "").toLowerCase().includes(needle)
        || (x.r.job_title ?? "").toLowerCase().includes(needle));
    return { board: visible, myRank: rank, myPct: rank > 0 ? topPct(rank, total) : 0, cohortTotal: total };
  }, [rows, me, q, cohort, pctFilter]);

  const PILLS = [
    { key: "everyone", label: W(lang, "Everyone", "Todos") },
    ...(me?.industry ? [{ key: "industry", label: me.industry }] : []),
    ...(me?.location ? [{ key: "city", label: (me.location ?? "").split(",")[0] }] : []),
  ];

  const PCT_CHIPS: { key: PctFilter; label: string }[] = [
    { key: 0, label: W(lang, "All", "Todos") },
    { key: 1, label: "Top 1%" },
    { key: 5, label: "Top 5%" },
    { key: 10, label: "Top 10%" },
    { key: 25, label: "Top 25%" },
  ];

  return (
    <HomeTop
      product="onescore"
      /* No Video/Photo/Live composer on a leaderboard — the single-strip variant asks the one
         question this app answers, and routes into the Simulator. */
      composerLabel={W(lang, "What could your score be?", "¿Cuál podría ser tu puntaje?")}
      composeTo={productHref("onescore", "/simulator")}
      onSearch={setQ}
      pills={PILLS}
      activePill={cohort}
      onPill={k => setCohort(k as Cohort)}
      feedSlot={
        rows === undefined ? (
          <div className="card p-6 text-center text-sm opacity-60">…</div>
        ) : (
          <div className="space-y-3">
            {/* Your own row, pinned. One glance = my number, my place, my percentile. */}
            {me && (
              <Link to={productHref("onescore", "/score")}
                className="card flex items-center gap-3 border-teal/40 p-3.5 ring-1 ring-teal/30">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal/15 text-[13px] font-extrabold text-teal-deep dark:text-teal-light">
                  {myRank > 0 ? `#${myRank}` : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{W(lang, "You", "Tú")}</p>
                  <p className="truncate text-[12.5px] opacity-55">
                    {me.score_v9_snapshot == null
                      ? W(lang, "No published score yet — tap to build it", "Sin puntaje publicado — toca para construirlo")
                      : cohort === "everyone"
                        ? W(lang, "Your place overall", "Tu lugar general")
                        : W(lang, "Your place in this group", "Tu lugar en este grupo")}
                  </p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <ScoreNum v={me.score_v9_snapshot} className="text-xl" />
                  {myRank > 0 && pctLabel(myPct) && (
                    <span className="rounded-full bg-teal/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-deep dark:text-teal-light">
                      {pctLabel(myPct)}
                    </span>
                  )}
                </span>
              </Link>
            )}

            {/* v24 DR: percentile filter row. */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {PCT_CHIPS.map(c => (
                <button key={c.key} onClick={() => setPctFilter(c.key)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    pctFilter === c.key
                      ? "border-teal/50 bg-teal/15 text-teal-deep dark:text-teal-light"
                      : "border-ink/10 text-ink/55 hover:text-ink dark:border-white/12 dark:text-white/55 dark:hover:text-white"
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>

            {board.length ? (
              <div className="overflow-hidden rounded-2xl border border-ink/10 dark:border-white/10">
                {/* v24 DR: real leaderboard headers. */}
                <div className="flex items-center gap-3 border-b border-ink/10 bg-ink/[0.03] px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider opacity-55 dark:border-white/10 dark:bg-white/[0.04]">
                  <span className="w-9 shrink-0 text-center">{W(lang, "Rank", "Puesto")}</span>
                  <span className="flex-1">{W(lang, "User", "Usuario")}</span>
                  <span className="shrink-0">{W(lang, "Score", "Puntaje")}</span>
                </div>
                {board.map((x, i) => (
                  <Link key={x.r.id} to={productHref("onescore", `/p/${x.r.id}`)}
                    className={`flex items-center gap-3 px-4 py-3 transition hover:bg-brand/5 ${i ? "border-t border-ink/5 dark:border-white/5" : ""} ${x.r.id === userId ? "bg-teal/5" : ""}`}>
                    <span className="w-9 shrink-0 text-center text-[13px] font-extrabold opacity-45">#{x.rank1}</span>
                    <Avatar src={x.r.photo_url} name={x.r.full_name} size={40} rounded="rounded-full" textSize="text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{x.r.full_name ?? W(lang, "Member", "Miembro")}</p>
                      <p className="truncate text-[12.5px] opacity-55">
                        {[x.r.job_title ?? x.r.industry, (x.r.location ?? "").split(",")[0]].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <ScoreNum v={x.r.score_v9_snapshot} />
                      {pctLabel(x.pct) && (
                        <span className="rounded-full bg-teal/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-deep dark:text-teal-light">
                          {pctLabel(x.pct)}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-sm font-bold">
                  {cohort === "everyone" && pctFilter === 0
                    ? W(lang, "Nobody matches that yet.", "Nadie coincide todavía.")
                    : W(lang, "Nobody in this slice has a published score yet.", "Nadie en este grupo tiene puntaje publicado aún.")}
                </p>
                <p className="mt-1 text-[12.5px] opacity-55">
                  {W(lang, "Be the first — your score makes the board.", "Sé el primero — tu puntaje abre la tabla.")}
                </p>
              </div>
            )}
            {cohortTotal > 0 && (
              <p className="text-center text-[11px] opacity-45">
                {cohortTotal} {W(lang, "scored members in this view", "miembros con puntaje en esta vista")}
              </p>
            )}
          </div>
        )
      }
    />
  );
}
