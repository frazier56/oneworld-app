/**
 * PROVIDER DOORS — Google and Apple, in Lee's order, rendered from ONE file.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Lee, 10 Aug 2026, on the create-account screen missing a Google button while sign-in had one:
 * the two screens must not drift. So they don't get two implementations. `/signin` and `/join`
 * both render this component, and a change to the door order or the Apple treatment happens
 * once, here, for every product in the ecosystem.
 *
 * THE ORDER (Lee, 10 Aug): *"I think Google should be first and then Apple second."*
 *
 *   1. Google — primary emphasis. It is the door the 58 migrating onesocial.ai members will
 *      actually use, and `claim_migrated_profile` matches them on the Google email.
 *   2. Apple  — rendered, visibly DISABLED, with small grey "Coming soon" beneath it.
 *
 * WHY A DISABLED APPLE BUTTON IS NOT A BROKEN ONE.
 * Lee: *"Just put the button up there, and then just put… 'coming soon' in, like, small gray
 * writing. Because it's gonna be active. By the time I launch this, it's gonna be active."*
 *
 * The standing rule — never render a button that cannot work — is intact. What made the PREVIOUS
 * Apple button dishonest is that it looked live and returned "Unsupported provider" on tap: a
 * broken control. This one is visibly disabled and says why: an announced control. Different
 * things, and only the first one lies.
 *
 * NOTHING HERE IS HARD-CODED. `useEnabledProviders()` asks `/auth/v1/settings` which providers
 * are actually live. The day Lee configures the Apple provider in Lovable Cloud, the button goes
 * live and the "Coming soon" note disappears BY ITSELF, with no code change and no deploy. There
 * is nothing to remember at launch — which is the whole point, because launch is exactly when a
 * "remember to flip the flag" note gets forgotten.
 *
 * Turning Apple on is a launch task, not a code task: Apple Developer account, Services ID, key,
 * and the redirect on the allowlist.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON } from "../lib/supabase";
import { useI18n } from "../lib/i18n";

const AUTH_SETTINGS = `${SUPABASE_URL}/auth/v1/settings`;

/**
 * THE ONE ID DISCLOSURE SURVIVES THE OAUTH ROUND TRIP IN HERE.
 * It cannot be recorded before the redirect: the caller is still `anon`, so `auth.uid()` is null,
 * `record_one_id_notice` raises "not signed in", and `anon` has no EXECUTE on it anyway. So the
 * LOCALE is parked in localStorage on the way out and `useOneIdNoticeStamp()` (mounted by
 * AppShell, i.e. on whatever screen the person lands on) records it on the way back.
 *
 * It lives here, not on a screen, because `/join` now has OAuth doors too — one key, both doors,
 * or an account created from the create-account screen comes back with no consent row. That row
 * is the GDPR Art. 13 / Ley 1581 evidence, so a second key would be a silent compliance hole.
 */
export const PENDING_NOTICE_KEY = "oneworld-pending-one-id-notice";

/** Park the locale for `useOneIdNoticeStamp()` to pick up after the provider redirects back. */
export function stampPendingNotice(lang: string) {
  try { localStorage.setItem(PENDING_NOTICE_KEY, lang); } catch { /* private mode */ }
}

/**
 * Which OAuth providers the project actually has configured, straight from the auth server.
 * Fails OPEN on google: a network blip must not remove the primary door from the screen.
 */
export function useEnabledProviders() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ google: true });
  useEffect(() => {
    let alive = true;
    fetch(AUTH_SETTINGS, { headers: { apikey: SUPABASE_ANON } })
      .then(r => r.json())
      .then(d => { if (alive && d?.external) setEnabled(d.external); })
      .catch(() => { /* fail open — leave the default */ });
    return () => { alive = false; };
  }, []);
  return enabled;
}

export const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-3.9 6.8-9.8 6.8-17.1z"/>
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-3.7-13.5-9.1l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
);

export const AppleMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-4-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.2 2.6 1.3-.05 1.8-.8 3.3-.8s2 .8 3.4.8 2.3-1.3 3.1-2.6c1-1.5 1.4-2.9 1.4-3-.03-.01-2.7-1.05-2.7-4.1zM14 4.9c.7-.85 1.2-2 1-3.2-1 .04-2.3.7-3 1.5-.65.75-1.2 1.9-1.05 3.05 1.15.1 2.3-.55 3.05-1.35z"/>
  </svg>
);

/**
 * THE SHARED OAUTH CALL — identical on both screens, including the Apple POST handling.
 *
 * APPLE RETURNS VIA POST, NOT GET. Lee, 2 Aug 2026: *"the Apple button takes you to some type of
 * black screen."* That black screen is Apple POSTing its response (`response_mode=form_post`) to
 * a host that only answers GET — and a static host only answers GET. Letting Supabase own the
 * callback keeps the POST at its `/auth/v1/callback`, which does accept it, and it redirects back
 * here with a normal GET. Nothing static ever has to answer a POST.
 *
 * Still required OUTSIDE this file when Apple is switched on, and neither is optional:
 *   · Apple's own Return URLs list (separate from Supabase's) must contain
 *     `https://<ref>.supabase.co/auth/v1/callback`.
 *   · Service ID, Team ID, Key ID and the .p8 private key must all be right in the provider
 *     settings. A wrong key also renders as a blank page. Test it on a real iPhone.
 */
export async function oauthSignIn(
  provider: "google" | "apple",
  redirectTo: string,
): Promise<{ error: unknown | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      ...(provider === "apple" ? { queryParams: { response_mode: "form_post" } } : {}),
    },
  });
  return { error: error ?? null };
}

/**
 * The two doors. `onPick` runs BEFORE the redirect (both screens stamp the One ID disclosure
 * locale there), then the caller performs the round trip.
 */
export default function ProviderDoors({ onPick, busy, afterGoogle }: {
  onPick: (provider: "google" | "apple") => void;
  busy?: boolean;
  /** Optional sign-in choices that must appear after Google but before Apple. */
  afterGoogle?: ReactNode;
}) {
  const { t } = useI18n();
  const providers = useEnabledProviders();

  return (
    <div className="space-y-3">
      {/* 1 — GOOGLE. Primary emphasis: it is the door, not a door. */}
      {providers.google && (
        <button type="button" onClick={() => onPick("google")} disabled={!!busy}
          className="ow-tap btn-primary flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-4 text-[15px] font-bold disabled:opacity-60">
          <GoogleMark /> {t("continueGoogle")}
        </button>
      )}

      {afterGoogle}

      {/* 2 — APPLE. Announced, not broken. Goes live by itself when the provider is configured. */}
      <div>
        <button type="button" onClick={() => onPick("apple")} disabled={!providers.apple || !!busy}
          className="ow-tap card flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 text-[15px] font-semibold disabled:opacity-50">
          <AppleMark /> {t("continueApple")}
        </button>
        {!providers.apple && (
          <p className="pt-1 text-center text-[11px] font-medium opacity-40">{t("comingSoon")}</p>
        )}
      </div>
    </div>
  );
}
