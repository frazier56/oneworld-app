import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavIcon, useOneId } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { fetchDeals, fetchRoster, fetchUpcoming, type DealRow } from "../lib/data";

/**
 * PROFILE SLOTS — the app-specific holes in the shared ProfileScreen.
 * ============================================================================================
 * Tiles: Roster · Deals · Scout (→ /agent/partner). Stats: Roster · Deals closed · Reviews.
 * Calendar: the next 3 upcoming deal dates, linking to /agent/calendar.
 *
 * The agent tables do not exist yet — a failed count renders the stat WITHOUT a number ("—")
 * rather than a fake zero; the reviews count has no agent table at all yet, so it is always
 * numberless. Failures are logged with the server's literal text by data.ts.
 */

const TILE =
  "card ow-tap flex min-h-[92px] flex-col items-start justify-between !rounded-2xl !p-4";

export default function ProfileTiles() {
  const { t } = useT();
  return (
    <section className="grid grid-cols-3 gap-2">
      <Link to="/agent/roster" className={TILE}>
        <NavIcon name="people" className="text-brand" />
        <span className="text-[13px] font-bold leading-tight">{t("tileRoster")}</span>
      </Link>
      <Link to="/agent/deals" className={TILE}>
        <NavIcon name="deals" className="text-brand" />
        <span className="text-[13px] font-bold leading-tight">{t("tileDeals")}</span>
      </Link>
      <Link to="/agent/partner" className={TILE}>
        <NavIcon name="search" className="text-brand" />
        <span className="text-[13px] font-bold leading-tight">{t("tileScout")}</span>
      </Link>
    </section>
  );
}

export function ProfileStats() {
  const { t } = useT();
  const { userId } = useOneId();
  const [rosterN, setRosterN] = useState<number | null>(null);
  const [closedN, setClosedN] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [r, d] = await Promise.all([fetchRoster(userId), fetchDeals(userId)]);
      if (!alive) return;
      setRosterN(r.pending ? null : r.rows.length);
      setClosedN(d.pending ? null : d.rows.filter(x => x.stage === "closed").length);
    })();
    return () => { alive = false; };
  }, [userId]);

  const stats: { label: string; value: number | null }[] = [
    { label: t("statRoster"), value: rosterN },
    { label: t("statClosed"), value: closedN },
    /* No agent-owned reviews table yet — render without a number, honestly. */
    { label: t("statReviews"), value: null },
  ];

  return (
    <section className="card grid grid-cols-3 gap-2 !rounded-2xl text-center">
      {stats.map(s => (
        <div key={s.label}>
          <p className="text-xl font-extrabold">{s.value ?? "—"}</p>
          <p className="text-[12px] opacity-60">{s.label}</p>
        </div>
      ))}
    </section>
  );
}

export function ProfileCalendarSlot() {
  const { t, lang } = useT();
  const { userId } = useOneId();
  const [next, setNext] = useState<DealRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchUpcoming(userId).then(r => {
      if (!alive) return;
      setNext(r.rows.slice(0, 3)); setLoaded(true);
    });
    return () => { alive = false; };
  }, [userId]);

  if (!loaded || next.length === 0) return null;

  return (
    <section className="card !rounded-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{t("nextUp")}</h2>
        <Link to="/agent/calendar" className="text-[13px] font-bold text-brand">{t("openCalendar")}</Link>
      </div>
      <div className="mt-2 space-y-2">
        {next.map(d => (
          <Link key={d.id} to="/agent/calendar"
                className="ow-tap flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
            <span className="w-1 self-stretch rounded-full bg-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold">{d.title}</p>
              <p className="text-[12.5px] opacity-60">
                {d.start_date && new Date(`${d.start_date}T00:00:00`).toLocaleDateString(dateLocale(lang), {
                  weekday: "short", month: "short", day: "numeric",
                })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
