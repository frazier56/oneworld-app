import { ScreenHeading } from "@oneworld/shell";
/**
 * ALERTS — /events/alerts. A simple notifications list off the `notifications` table for the
 * signed-in member (same table lib/notificationHelpers.ts writes: user_id, type, title, body,
 * action_url, read_at). Tapping a row marks it read and follows its action_url; legacy rows
 * written with old-world paths (/app/…, /discover-events/…) are rebased onto /events/* here.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "@evt/lib/supabase";
import { useAuth } from "@evt/hooks/useAuth";
import { useI18n } from "@evt/lib/i18n";
import { markAllNotificationsRead, markNotificationRead } from "@evt/lib/notificationHelpers";

interface AlertRow {
  id: string;
  type: string | null;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

/** Old-world action_url values still live in the table — rebase them onto the /events/* map. */
export function rebaseAlertUrl(url: string): string {
  if (url.startsWith("/events/")) return url;
  const m = url.match(/^\/discover-events\/([^/?#]+)(.*)$/);
  if (m) return `/events/e/${m[1]}${m[2] || ""}`;
  if (url === "/discover-events") return "/events";
  const app = url.match(/^\/app\/events\/([^/?#]+)\/manage(.*)$/);
  if (app) return `/events/events/${app[1]}/manage${app[2] || ""}`;
  return url
    .replace(/^\/app\/home\b/, "/events")
    .replace(/^\/app\/events\b/, "/events/events")
    .replace(/^\/app\/tickets\b/, "/events/tickets")
    .replace(/^\/app\/calendar\b/, "/events/calendar")
    .replace(/^\/app\/pricing\b/, "/events/pricing")
    .replace(/^\/app\/messages\b/, "/events/messages")
    .replace(/^\/app\b/, "/events");
}

export default function Alerts() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [rows, setRows] = useState<AlertRow[] | null>(null);

  useEffect(() => {
    if (!user?.id) { setRows([]); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id, type, title, body, action_url, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) console.error("[oneevent] alerts load failed:", error);
      if (alive) setRows(((data as any[]) || []) as AlertRow[]);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const fmt = (s: string) =>
    new Date(s).toLocaleString(lang === "es" ? "es" : "en", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const open = async (r: AlertRow) => {
    if (!r.read_at) {
      setRows(prev => (prev || []).map(x => x.id === r.id ? { ...x, read_at: new Date().toISOString() } : x));
      await markNotificationRead(r.id);
    }
    if (r.action_url) nav(rebaseAlertUrl(r.action_url));
  };

  const unread = (rows || []).filter(r => !r.read_at).length;

  return (
    <div className="space-y-3">
      <ScreenHeading right={unread > 0 && user?.id ? (
        <button
          onClick={async () => {
            setRows(prev => (prev || []).map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
            await markAllNotificationsRead(user.id);
          }}
          className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold dark:border-white/15"
        >
          {t("markAllRead")}
        </button>
      ) : null}>{t("alertsTitle")}</ScreenHeading>

      {rows === null ? (
        <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
      ) : rows.length === 0 ? (
        <div className="card grid place-items-center gap-2 !rounded-3xl py-14 text-center">
          <BellOff size={36} className="opacity-40" />
          <p className="text-sm opacity-60">{t("noAlerts")}</p>
        </div>
      ) : (
        rows.map(r => (
          <button key={r.id} onClick={() => open(r)} className="card flex w-full items-start gap-3 !rounded-2xl p-4 text-left">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${r.read_at ? "bg-ink/5 opacity-50 dark:bg-white/10" : "bg-brand/15 text-brand"}`}>
              <Bell size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm leading-tight ${r.read_at ? "font-semibold opacity-70" : "font-bold"}`}>{r.title}</span>
              {r.body && <span className="mt-0.5 block truncate text-xs opacity-60">{r.body}</span>}
              <span className="mt-0.5 block text-[11px] opacity-45">{fmt(r.created_at)}</span>
            </span>
            {/* teal = STATE: the unread dot is live state, so it keeps the family colour */}
            {!r.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" aria-label="unread" />}
          </button>
        ))
      )}
    </div>
  );
}
