/**
 * ADMIN "VIEW AS USER" — ported from the OneSocial July-9 backup (Lee, 18 Aug 2026).
 * ============================================================================================
 * Lee: *"I had the ability to basically sign in as someone else… I can see the account from
 * their perspective, and I can go in and not only see what they see, but I can make changes.
 * Only when I'm logging in as frazierlee@gmail.com."*
 *
 * The drawer shows this section ONLY to the platform admin (and, while impersonating, the
 * "Return to my account" row so he can always get back). The server is the real gate: the
 * admin-impersonate edge function re-checks the caller's JWT against Lee's UID/email and
 * mints a session for the target via a server-side magiclink redeem — no password touched,
 * no email sent. Lee's own tokens are cached in sessionStorage for the one-tap return.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOneId } from "../lib/oneId";

const ADMIN_SESSION_KEY = "ow_admin_session";
const REAL_ADMIN_KEY = "ow_real_admin_id";
const ADMIN_EMAIL = "frazierlee@gmail.com";
/* v24-shell EO (Lee's UAT, 18 Aug 2026): "switch back signed me out completely." The cached
   admin tokens lived in sessionStorage — which a PHONE browser throws away whenever it
   recycles the tab (backgrounding the app is enough). Return then found no cache and fell
   to the splash. The cache now lives in localStorage with a 12-hour expiry (cleared the
   moment a restore succeeds); REAL_ADMIN_KEY is mirrored into sessionStorage so AppShell's
   interstitial-skip keeps reading it exactly as before. */
const ADMIN_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Keep View-as inside the product and screen where the admin started. Only a local path may be
 * restored; an absolute/protocol-relative value is rejected so session switching can never be
 * turned into an open redirect. Product route guards remain the authority if the target user is
 * not allowed to open that exact screen. */
export function currentSafeAppPath() {
  if (typeof window === "undefined") return "/";
  const candidate = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return candidate.startsWith("/") && !candidate.startsWith("//") && candidate.length <= 2048
    ? candidate
    : "/";
}

function writeAdminCache(tokens: { access_token: string; refresh_token: string }) {
  try { localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ ...tokens, cached_at: Date.now() })); } catch { /* private mode */ }
}
function readAdminCache(): { access_token: string; refresh_token: string } | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY) || sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.cached_at && Date.now() - parsed.cached_at > ADMIN_CACHE_TTL_MS) return null;
    return parsed.access_token && parsed.refresh_token ? parsed : null;
  } catch { return null; }
}
function clearAdminCache() {
  try { localStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(REAL_ADMIN_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(REAL_ADMIN_KEY); } catch { /* ignore */ }
}
function rememberRealAdmin(id: string) {
  try { localStorage.setItem(REAL_ADMIN_KEY, id); } catch { /* ignore */ }
  try { sessionStorage.setItem(REAL_ADMIN_KEY, id); } catch { /* ignore */ }
}

type Row = { id: string; full_name: string | null; email: string | null; photo_url: string | null };

export default function AdminViewAs({ onClose }: { onClose: () => void }) {
  const { userId, email } = useOneId();
  const isAdminNow = (email || "").toLowerCase() === ADMIN_EMAIL;
  const realAdminId = typeof window !== "undefined"
    ? (localStorage.getItem(REAL_ADMIN_KEY) || sessionStorage.getItem(REAL_ADMIN_KEY))
    : null;
  const impersonating = !!realAdminId && !isAdminNow && !!userId;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Remember that the admin was here, so the return row can appear mid-impersonation.
  useEffect(() => {
    if (isAdminNow && userId) rememberRealAdmin(userId);
  }, [isAdminNow, userId]);

  useEffect(() => {
    if (!open || !isAdminNow) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke("admin-impersonate", {
        body: { action: "list", q },
      });
      if (!error && data?.users) setRows(data.users);
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [open, q, isAdminNow]);

  const cacheAdminSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token && data.session?.refresh_token) {
      writeAdminCache({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
    if (userId) rememberRealAdmin(userId);
  };

  const impersonate = async (target: Row) => {
    setBusy(target.id);
    try {
      const returnPath = currentSafeAppPath();
      await cacheAdminSession();
      const { data, error } = await supabase.functions.invoke("admin-impersonate", {
        body: { action: "impersonate", target_user_id: target.id },
      });
      if (error || !data?.access_token) { setBusy(null); return; }
      /* LOCAL sign-out only — signOutEverywhere would revoke the cached admin tokens too
         and strand Lee inside the borrowed account. */
      /* v21 CK: the contact-capture store is per-PERSON, not per-browser — Lee's test phone
         number was prefilling JOEL's checkout through View-as. Clear it on every identity
         switch. */
      try { sessionStorage.removeItem("ow.evt.contact"); } catch { /* ignore */ }
      await supabase.auth.signOut({ scope: "local" } as any);
      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      onClose();
      window.location.href = returnPath;
    } catch { setBusy(null); }
  };

  const returnToAdmin = async () => {
    setBusy("return");
    try {
      const returnPath = currentSafeAppPath();
      /* v23 CO (Lee's UAT, 18 Aug 2026): the restore SUCCEEDED server-side (a fresh admin
         refresh token was minted) but Lee still landed on the splash signed out. Root cause:
         the shell and each product app run their OWN GoTrue client on the SAME storage key,
         and a late write from the product client during teardown clobbered the freshly
         restored admin session. So now: keep the cache until the restore is CONFIRMED,
         verify it actually persisted, re-assert once with the post-refresh tokens if the
         other client overwrote it, and only then clear the cache and redirect. */
      const tokens = readAdminCache();
      try { sessionStorage.removeItem("ow.evt.contact"); } catch { /* ignore */ }
      await supabase.auth.signOut({ scope: "local" } as any);
      if (tokens) {
        const { data: setData, error } = await supabase.auth.setSession({
          access_token: tokens.access_token, refresh_token: tokens.refresh_token,
        });
        if (!error) {
          // Give any racing client one beat, then make sure OUR session is what stuck.
          await new Promise((r) => setTimeout(r, 400));
          const { data: chk } = await supabase.auth.getSession();
          if (!chk.session && setData.session) {
            // Re-assert with the POST-REFRESH tokens (the cached refresh token may have
            // been rotated by the first setSession and cannot be redeemed twice).
            await supabase.auth.setSession({
              access_token: setData.session.access_token,
              refresh_token: setData.session.refresh_token,
            });
            await new Promise((r) => setTimeout(r, 200));
          }
          const { data: fin } = await supabase.auth.getSession();
          if (fin.session) {
            clearAdminCache();
            onClose();
            window.location.href = returnPath;
            return;
          }
        }
      }
      // Cached tokens gone/expired — land on the splash to sign back in normally.
      clearAdminCache();
      onClose();
      window.location.href = returnPath;
    } catch { setBusy(null); }
  };

  if (impersonating) {
    return (
      <button onClick={returnToAdmin} disabled={busy === "return"}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-amber-600 hover:bg-amber-500/10 disabled:opacity-50">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
        {busy === "return" ? "Returning…" : "Return to my account"}
      </button>
    );
  }

  if (!isAdminNow) return null;

  return (
    <div>
      {/* v24-shell ES/ET (Lee): the caret was "a dot on the screen" — now a real chevron in a
          visible chip. And opening the section auto-scrolls the drawer so the search box AND
          the results are on screen without a manual swipe. */}
      <button
        onClick={() => {
          setOpen(v => {
            const next = !v;
            if (next) setTimeout(() => {
              panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
            return next;
          });
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-brand/10">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
        View as user
        <span className="ml-auto grid h-8 w-8 place-items-center rounded-lg bg-ink/5 dark:bg-white/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-180 transition-transform" : "transition-transform"}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && (
        <div ref={panelRef} className="mt-1 space-y-1 rounded-xl border border-ink/10 p-2 dark:border-white/10" style={{ scrollMarginTop: 12 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email…"
            className="w-full rounded-lg border border-ink/10 bg-transparent px-2.5 py-1.5 text-sm outline-none dark:border-white/15" />
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {rows.map(r => (
              <button key={r.id} onClick={() => impersonate(r)} disabled={!!busy}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand/10 disabled:opacity-50">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[10px] font-bold">
                  {(r.full_name || r.email || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{busy === r.id ? "Switching…" : (r.full_name || "—")}</span>
                  <span className="block truncate text-[11px] opacity-55">{r.email}</span>
                </span>
              </button>
            ))}
            {rows.length === 0 && <p className="px-2 py-1.5 text-xs opacity-50">No users found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
