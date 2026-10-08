import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useOneId } from "../lib/oneId";
import { useI18n } from "../lib/i18n";
import { NavIcon } from "./NavIcons";

/**
 * THE BELL — first of the header trio, in all eight products.
 * ============================================================================================
 * Lee, 2 Aug 2026: the header reads **bell → flag → hamburger**, and *"you don't interrupt those
 * three."* Leaving the bell in OneJob would have given seven of eight products a two-item header,
 * which is a difference a person feels immediately even if they cannot name it.
 *
 * ── Why it lives in the shell despite the data being per-product ─────────────────────────────
 * `notifications` is a shared table on the shared database, keyed by `user_id`, and every product
 * writes to it. So the QUERY is genuinely family-wide; only the `action_url` inside each row is
 * product-specific, and that is just a path under one origin now. There is nothing here for a
 * product to own.
 *
 * ── The scoping, and why it is explicit ──────────────────────────────────────────────────────
 * `.eq("user_id", userId)` rather than trusting RLS to narrow it. This is the bug that made the
 * badge read 41 instead of 6: an admin policy widened what RLS returned and the query had no
 * opinion of its own. A query that only works because of a policy elsewhere is a query that
 * breaks the day the policy changes, on a screen nobody was looking at.
 *
 * ── No react-query ───────────────────────────────────────────────────────────────────────────
 * OneJob's version used `@tanstack/react-query`. Taking that dependency would force all eight
 * products onto it and put a provider requirement above `AppShell`. A 30-second interval and one
 * piece of state costs nothing and keeps the package's peer dependencies at four.
 */
export default function NotificationBell({ to }: { to: string }) {
  const { userId } = useOneId();
  const { t } = useI18n();
  const [rows, setRows] = useState<{ id: string; read_at: string | null }[]>([]);
  /* True once the FIRST poll has answered — the seeding guard keys off this, not row count,
     so an empty inbox still seeds and the next real notification still buzzes. */
  const fetchedOnce = useRef(false);

  useEffect(() => {
    setRows([]);
    fetchedOnce.current = false;
    seeded.current = false;
    topId.current = null;
    if (!userId) { setRows([]); return; }
    let alive = true;

    const pull = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, read_at")
        .eq("user_id", userId)              // ← explicit. See above.
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      /* A failed poll leaves the previous count alone rather than zeroing it. Flashing an unread
         badge off and back on as the network wobbles trains people to distrust it. */
      if (alive && !error) { fetchedOnce.current = true; setRows(data ?? []); }
    };

    pull();
    const id = setInterval(pull, 30_000);
    window.addEventListener('ow-notifications-changed', pull);
    return () => { alive = false; clearInterval(id); window.removeEventListener('ow-notifications-changed', pull); };
  }, [userId]);

  /* Buzz the phone when something NEW lands — bell and vibration, never an SMS. Seeded on the
     first load so history does not buzz on every cold start. Android vibrates; iOS ignores it,
     which is fine — this is a bonus, not the notification. */
  const topId = useRef<string | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    /* SEEDING FIX (Lee, 16 Aug 2026): the old guard seeded on the MOUNT run, when `rows` was
       still the initial empty array — the first real fetch of existing history then looked like
       "something new landed" and buzzed on every cold start (blocked-vibrate console errors on
       plain page loads). Seed after the first COMPLETED poll instead. */
    if (!seeded.current) {
      if (fetchedOnce.current) { seeded.current = true; topId.current = rows[0]?.id ?? null; }
      return;
    }
    const top = rows[0];
    if (top && top.id !== topId.current) {
      topId.current = top.id;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { (navigator as any).vibrate([120, 60, 120]); } catch { /* unsupported, and fine */ }
      }
    }
  }, [rows]);

  if (!userId) return null;
  const unread = rows.length;
  const accessibleLabel = unread
    ? t("notificationsUnread").replace("{count}", String(unread))
    : t("notifications");

  /* A LINK, not a panel that opens over the page.
     OneJob's dropdown had to learn the hard way that marking-as-read must never gate the
     navigation: it used to `await` a network write BEFORE closing, so on a slow connection the
     full-screen backdrop sat over everything and every tap landed on it — Lee, 28 Jul: *"it took
     me to the right page, but it's not clickable. The buttons are kinda stuck."* A route has no
     backdrop to get stuck behind, and the destination screen owns its own read bookkeeping. */
  return (
    <Link to={to} aria-label={accessibleLabel}
      className="ow-tap relative grid min-h-[44px] min-w-[44px] place-items-center rounded-lg px-2">
      <NavIcon name="bell" size={20} className="opacity-70" />
      {!!unread && (
        <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
