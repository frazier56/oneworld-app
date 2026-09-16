import { ScreenHeading } from "@oneworld/shell";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOneId } from "@oneworld/shell";
import { useT, dateLocale, type AgentKey } from "../lib/dict";
import { fetchUpcoming, type DealRow } from "../lib/data";

/**
 * CALENDAR — upcoming bookings and deal dates, read from agent_deals.start_date.
 * ============================================================================================
 * OneEvent's calendar shape: a simple list grouped by date, each group wearing the product's
 * accent bar (wine — identity accent only, never body text, never a button).
 */
export default function CalendarScreen() {
  const { t, lang } = useT();
  const { userId } = useOneId();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    let alive = true;
    fetchUpcoming(userId).then(r => {
      if (!alive) return;
      setDeals(r.rows); setPending(r.pending); setLoaded(true);
    });
    return () => { alive = false; };
  }, [userId]);

  const groups = useMemo(() => {
    const by = new Map<string, DealRow[]>();
    deals.forEach(d => {
      if (!d.start_date) return;
      const list = by.get(d.start_date) ?? [];
      list.push(d);
      by.set(d.start_date, list);
    });
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [deals]);

  if (!userId) {
    return <p className="text-sm opacity-60">{t("signInFirst")}</p>;
  }

  return (
    <div className="space-y-3">
      <ScreenHeading>{t("calTitle")}</ScreenHeading>

      {pending && <p className="text-[13px] opacity-50">{t("pendingNote")}</p>}
      {!loaded && <p className="text-[13px] opacity-50">{t("loading")}</p>}

      {loaded && groups.length === 0 && (
        <p className="text-[13.5px] opacity-60">{t("noUpcoming")}</p>
      )}

      {groups.map(([date, list]) => (
        <section key={date} className="card !rounded-2xl !p-0 overflow-hidden">
          {/* The wine accent bar — the identity hue marking the date spine. */}
          <div className="flex">
            <div className="w-1.5 shrink-0 bg-brand" aria-hidden />
            <div className="min-w-0 flex-1 p-4">
              <p className="text-[12px] font-bold uppercase tracking-widest text-brand">
                {new Date(`${date}T00:00:00`).toLocaleDateString(dateLocale(lang), {
                  weekday: "long", month: "long", day: "numeric",
                })}
              </p>
              <div className="mt-2 space-y-2">
                {list.map(d => (
                  <Link key={d.id} to="/agent/deals"
                        className="ow-tap flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold">{d.title}</p>
                      {d.counterpart_name && <p className="truncate text-[12.5px] opacity-60">{d.counterpart_name}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
                      {t(`stage_${d.stage}` as AgentKey)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
