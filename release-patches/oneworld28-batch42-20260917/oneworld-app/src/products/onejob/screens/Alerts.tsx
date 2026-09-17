import { ScreenHeading } from "@oneworld/shell";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useOneId, W, useI18n as useShellI18n } from "@oneworld/shell";
import { IconChat } from "@job/components/ActionIcons";
import { useI18n } from "@job/lib/i18n";

/**
 * ALERTS — `/jobs/alerts`. The list behind the header's bell (`ONEJOB.notificationsPath`).
 * ============================================================================================
 * Reads the same `notifications` rows `jobloop.ts` writes through the `send_notification` RPC:
 * user_id, type, title, body, action_url, read_at. Tapping a row marks it read and follows its
 * action_url.
 *
 * ── WHY `rebaseAlertUrl` EXISTS ─────────────────────────────────────────────────────────────
 * Every notification OneJob has ever written carries an OLD-WORLD path — `/app/my-jobs`,
 * `/app/calendar`, `/app/home` — from when OneJob was its own deployment. Those rows are in the
 * database now and cannot be rewritten from the client. Under the single origin they resolve to
 * nothing, so without this every historical alert would be a dead tap. New rows are written with
 * `/jobs/…` by the ported `jobloop.ts`; this only rescues the ones already sent.
 */
export interface AlertRow {
  id: string; type: string | null; title: string; body: string | null;
  action_url: string | null; read_at: string | null; created_at: string;
}

/** Old OneJob deployment paths → the product's routes under the single origin. */
export function rebaseAlertUrl(url: string): string {
  if (url.startsWith("/jobs")) return url;
  const detail = url.match(/^\/app\/jobs\/([^/?#]+)(.*)$/);
  if (detail) return `/jobs/j/${detail[1]}${detail[2] || ""}`;
  const profile = url.match(/^\/p\/([^/?#]+)(.*)$/);
  if (profile) return `/jobs/p/${profile[1]}${profile[2] || ""}`;
  return url
    .replace(/^\/app\/my-jobs\b/, "/jobs/jobs")
    .replace(/^\/app\/qr\b/, "/jobs/qr")
    .replace(/^\/app\/calendar\b/, "/jobs/calendar")
    .replace(/^\/app\/settings\b/, "/jobs/settings")
    .replace(/^\/app\/wallet\b/, "/jobs/wallet")
    .replace(/^\/app\/reviews\b/, "/jobs/reviews")
    .replace(/^\/app\/plans\b/, "/jobs/plans")
    .replace(/^\/app\/messages\b/, "/jobs/messages")
    .replace(/^\/app\/jobs\b/, "/jobs/find")
    .replace(/^\/app\/home\b/, "/jobs")
    .replace(/^\/app\b/, "/jobs");
}

export default function Alerts() {
  const { userId } = useOneId();
  const { t } = useI18n();
  const { lang } = useShellI18n();
  const nav = useNavigate();
  const [rows, setRows] = useState<AlertRow[] | null>(null);

  useEffect(() => {
    if (!userId) { setRows([]); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("notifications")
        .select("id, type, title, body, action_url, read_at, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      /* The server's own words, never a friendly catch-all — a swallowed error here is how an
         empty list gets mistaken for "you have no notifications". */
      if (error) console.error("[onejob] alerts load failed:", error.message);
      if (alive) setRows(((data as AlertRow[] | null) ?? []));
    })();
    return () => { alive = false; };
  }, [userId]);

  const fmt = (s: string) => new Date(s).toLocaleString(lang === "es" || lang === "co" ? "es" : "en",
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  /* Close and navigate FIRST; marking read is bookkeeping and must never gate the tap. */
  const open = async (r: AlertRow) => {
    setRows(prev => (prev ?? []).map(x => x.id === r.id ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x));
    if (r.action_url) nav(rebaseAlertUrl(r.action_url));
    if (!r.read_at) {
      const { error } = await supabase.from("notifications")
        .update({ read_at: new Date().toISOString() }).eq("id", r.id);
      if (error) console.warn("[onejob] mark-read failed:", error.message);
    }
  };

  const unread = (rows ?? []).filter(r => !r.read_at).length;

  const markAll = async () => {
    const stamp = new Date().toISOString();
    setRows(prev => (prev ?? []).map(x => ({ ...x, read_at: x.read_at ?? stamp })));
    const { error } = await supabase.from("notifications")
      .update({ read_at: stamp }).eq("user_id", userId!).is("read_at", null);
    if (error) console.warn("[onejob] mark-all-read failed:", error.message);
  };

  return (
    <div className="space-y-3">
      <ScreenHeading right={unread > 0 && userId ? (
        <button onClick={markAll}
          className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold dark:border-white/15">
          {W(lang, "Mark all read", "Marcar todo como leído")}
        </button>
      ) : null}>{W(lang, "Notifications", "Notificaciones")}</ScreenHeading>

      {rows === null ? (
        <div className="card h-24 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm opacity-60">{t("noNotifs")}</div>
      ) : (
        rows.map(r => (
          <button key={r.id} onClick={() => open(r)} className="card flex w-full items-start gap-3 !rounded-2xl p-4 text-left">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${r.read_at ? "bg-ink/5 opacity-50 dark:bg-white/10" : "bg-brand/15 text-brand"}`}>
              <IconChat size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm leading-tight ${r.read_at ? "font-semibold opacity-70" : "font-bold"}`}>{r.title}</span>
              {r.body && <span className="mt-0.5 block truncate text-xs opacity-60">{r.body}</span>}
              <span className="mt-0.5 block text-[11px] opacity-45">{fmt(r.created_at)}</span>
            </span>
            {/* teal = STATE. Unread is live state, so it keeps the family's state colour. */}
            {!r.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" aria-label="unread" />}
          </button>
        ))
      )}
    </div>
  );
}
