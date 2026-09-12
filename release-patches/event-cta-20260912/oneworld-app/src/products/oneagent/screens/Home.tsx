import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HomeTop, useOneId } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import {
  fetchActivity, fetchRoster, fetchUpcoming,
  type ActivityRow, type DealRow, type RosterRow,
} from "../lib/data";

/**
 * HOME — shared HomeTop (search · composer · pills), OneAgent's feed underneath.
 * ============================================================================================
 * The feed is deals/roster activity: recent stage changes and new members (agent_activity),
 * pending consent requests (roster rows still 'invited') and upcoming bookings (deals with a
 * start_date). All of it reads the agent-owned tables, which DO NOT EXIST yet — a failed read
 * renders the onboarding empty state with the honest one-line pending note. Never a crash,
 * never a swallowed error (data.ts logs the server's literal text).
 */

type FeedCat = "deals" | "roster" | "consent";
interface FeedItem {
  id: string;
  cat: FeedCat;
  label: string;   // translated kind chip
  text: string;    // person/deal line
  when: string | null;
  to: string;
}

export default function Home() {
  const { t, lang } = useT();
  const { userId } = useOneId();
  const [pill, setPill] = useState("all");
  const [q, setQ] = useState("");
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [upcoming, setUpcoming] = useState<DealRow[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    let alive = true;
    (async () => {
      const [a, r, u] = await Promise.all([
        fetchActivity(userId), fetchRoster(userId), fetchUpcoming(userId),
      ]);
      if (!alive) return;
      setActivity(a.rows); setRoster(r.rows); setUpcoming(u.rows);
      setPending(a.pending || r.pending || u.pending);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [userId]);

  const items = useMemo<FeedItem[]>(() => {
    const fmt = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString(dateLocale(lang), { month: "short", day: "numeric" }) : null;
    const kindMeta = (k: string): { cat: FeedCat; label: string } => {
      if (k === "deal_created") return { cat: "deals", label: t("actDealCreated") };
      if (k === "deal_stage") return { cat: "deals", label: t("actDealStage") };
      if (k === "roster_removed" || k === "disconnected") return { cat: "roster", label: t("actRosterRemoved") };
      if (k === "consent") return { cat: "consent", label: t("actConsent") };
      return { cat: "roster", label: t("actRosterAdded") };
    };
    const out: FeedItem[] = [
      /* Pending invites — first rung of the partner ladder, waiting on the invited person. */
      ...roster.filter(m => m.partner_status === "invited").map(m => ({
        id: `c-${m.id}`, cat: "consent" as FeedCat, label: t("awaitingConsent"),
        text: m.full_name, when: fmt(m.updated_at), to: `/agent/roster/${m.id}`,
      })),
      /* Upcoming bookings — deals with a start date, soonest first. */
      ...upcoming.slice(0, 5).map(d => ({
        id: `u-${d.id}`, cat: "deals" as FeedCat, label: t("startsOn"),
        text: `${fmt(d.start_date)} — ${d.title}`, when: null, to: "/agent/deals",
      })),
      /* The activity log itself. */
      ...activity.map(a => {
        const m = kindMeta(a.kind);
        return {
          id: a.id, cat: m.cat, label: m.label, text: a.summary,
          when: fmt(a.created_at),
          to: m.cat === "roster" && a.roster_member_id ? `/agent/roster/${a.roster_member_id}` : "/agent/deals",
        };
      }),
    ];
    const needle = q.trim().toLowerCase();
    return out
      .filter(i => pill === "all" || i.cat === pill)
      .filter(i => !needle || i.text.toLowerCase().includes(needle) || i.label.toLowerCase().includes(needle));
  }, [activity, roster, upcoming, pill, q, t, lang]);

  const empty = loaded && activity.length === 0 && roster.length === 0 && upcoming.length === 0;

  return (
    <HomeTop
      product="oneagent"
      pills={[
        { key: "all", label: t("pillAll") },
        { key: "deals", label: t("pillDeals") },
        { key: "roster", label: t("pillRoster") },
        { key: "consent", label: t("pillConsent") },
      ]}
      activePill={pill}
      onPill={setPill}
      onSearch={setQ}
      composeTo="/agent/partner"
      composerLabel={t("composer")}
      feedSlot={
        <div className="space-y-3">
          {pending && <p className="text-[13px] opacity-50">{t("pendingNote")}</p>}

          {!loaded && <p className="text-[13px] opacity-50">{t("loading")}</p>}

          {/* Empty state — the warm "bring your roster" onboarding card, two doors in. */}
          {empty && (
            <div className="card !rounded-3xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand">OneAgent</p>
              <h2 className="mt-1 text-xl font-extrabold leading-tight">{t("onboardTitle")}</h2>
              <p className="mt-2 text-[13.5px] leading-snug opacity-70">{t("onboardBody")}</p>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/agent/roster" className="btn-primary ow-tap w-full text-sm">{t("onboardRoster")}</Link>
                <Link to="/agent/deals"
                      className="ow-tap inline-flex w-full items-center justify-center rounded-2xl border border-ink/10 px-5 py-3 text-sm font-semibold dark:border-white/15">
                  {t("onboardDeals")}
                </Link>
              </div>
            </div>
          )}

          {/* The feed */}
          {items.map(i => (
            <Link key={i.id} to={i.to} className="card ow-tap block !rounded-2xl">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  i.cat === "consent"
                    ? "bg-brand/10 text-brand"
                    : "bg-ink/5 opacity-70 dark:bg-white/10"
                }`}>
                  {i.label}
                </span>
                {i.when && <span className="text-[12px] opacity-40">{i.when}</span>}
              </div>
              <p className="mt-2 text-[13.5px] font-semibold leading-snug">{i.text}</p>
            </Link>
          ))}
        </div>
      }
    />
  );
}
