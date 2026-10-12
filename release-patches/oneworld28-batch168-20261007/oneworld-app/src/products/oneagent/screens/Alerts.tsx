import { ScreenHeading } from "@oneworld/shell";
import { useEffect, useState } from "react";
import { useOneId } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { fetchNotifications, type NotificationRow } from "../lib/data";

/**
 * ALERTS — the signed-in user's notifications, from the EXISTING shared `notifications` table.
 * ============================================================================================
 * READ-ONLY from OneAgent: this product writes only to its own agent_* tables. Unread rows get
 * the teal dot — teal is the family's STATE colour and unread is a state.
 */
export default function Alerts() {
  const { t, lang } = useT();
  const { userId } = useOneId();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    let alive = true;
    fetchNotifications(userId).then(r => {
      if (!alive) return;
      setRows(r.rows); setPending(r.pending); setLoaded(true);
    });
    return () => { alive = false; };
  }, [userId]);

  if (!userId) {
    return <p className="text-sm opacity-60">{t("signInFirst")}</p>;
  }

  return (
    <div className="space-y-3">
      <ScreenHeading>{t("alertsTitle")}</ScreenHeading>

      {pending && <p className="text-[13px] opacity-50">{t("pendingNote")}</p>}
      {!loaded && <p className="text-[13px] opacity-50">{t("loading")}</p>}

      {loaded && rows.length === 0 && (
        <p className="text-[13.5px] opacity-60">{t("noAlerts")}</p>
      )}

      {rows.map(n => (
        <div key={n.id} className="card !rounded-2xl">
          <div className="flex items-start gap-3">
            {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal" aria-hidden />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className={`truncate text-[13.5px] leading-snug ${n.read_at ? "font-semibold opacity-70" : "font-bold"}`}>
                  {n.title}
                </p>
                <span className="shrink-0 text-[12px] opacity-40">
                  {new Date(n.created_at).toLocaleDateString(dateLocale(lang), { month: "short", day: "numeric" })}
                </span>
              </div>
              {n.body && <p className="mt-1 text-[13px] leading-snug opacity-60">{n.body}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
