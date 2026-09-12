/**
 * ONE SIGN-IN ACROSS EVERY ONE WORLD APP.
 *
 * Lee, 1 Aug 2026: *"If you sign in to one app, you sign in to all of the apps… you sign out of one
 * app, you sign out of all the apps. It's kinda like Google."*
 *
 * ── Why this file has to exist now ───────────────────────────────────────────────────────────
 * Supabase keeps the session in `localStorage` by default, and localStorage is scoped to an
 * ORIGIN — scheme + host + port. While every app lived under `www.oneworldlabs.ai/<app>/` they all
 * shared one origin and therefore one session by accident. The moment each app got its own
 * hostname, that accident ended: `onejob.oneworldlabs.ai` and `onescore.oneworldlabs.ai` are
 * different origins and cannot see each other's storage.
 *
 * That explains OneJob on its new hostname asking for a fresh sign-in, and it explains My World
 * showing three connected apps on a phone and one on a desktop.
 *
 * ── What it does NOT explain, and I got this wrong first ─────────────────────────────────────
 * OneScore's "Guest — tap to sign up" is a DIFFERENT bug. OneScore and OneEvent both run on
 * `www.oneworldlabs.ai`, the same origin, and one shows Lee signed in while the other says Guest —
 * so no origin argument can account for it. Reading OneScore's shipped bundle settles it:
 *
 *     children: i && o.name ? o.name : t("guest")
 *
 * `i` is the signed-in flag and `o` is a profile object OneScore keeps in its OWN localStorage
 * (`onescore-state-v2`, default `{name:"", …, photoDataUrl:null}`). Lee IS signed in — that is why
 * a "Sign out" button renders at all, since the "Sign in" button is gated on `!i`. What OneScore
 * lacks is a NAME, because it never reads the shared `profiles` table; it waits for you to fill in
 * OneScore's own form, on that device.
 *
 * So the session was never the problem there. The profile was. Fixing it means OneScore hydrating
 * its profile from `profiles` on sign-in, which belongs in OneScore's own thread — noted here so
 * nobody re-diagnoses it as an auth fault and "fixes" auth again.
 *
 * ── The mechanism ────────────────────────────────────────────────────────────────────────────
 * Cookies are scoped to a DOMAIN, not an origin. A cookie written for `.oneworldlabs.ai` is sent to
 * — and readable by — every subdomain of it. So the session moves to a cookie on the parent domain
 * and every app is signed in at once, with no handshake, no redirect dance, and no second login.
 *
 * This is exactly Google's model: you authenticate once and `mail.google.com`, `drive.google.com`
 * and the rest all see it, because the session cookie belongs to the parent domain.
 *
 * ── Why cookies need care, and what this does about it ───────────────────────────────────────
 * A cookie is capped near 4KB, and a Supabase session (access token + refresh token + the whole
 * user object) can exceed that. Two defences, both required:
 *
 *  1. `userStorage` (auth-js ≥ 2.108) splits the user object OUT of the session blob, so this
 *     cookie carries only tokens and a little metadata. The user object goes to localStorage, which
 *     is safe to keep per-origin because it is re-fetchable from the server at any time and holds
 *     nothing that grants access.
 *  2. CHUNKING. Anything still too large is split across `key.0`, `key.1`, … and rejoined on read.
 *     A silently truncated cookie is the worst possible failure here: it produces a session that
 *     looks present and fails to parse, which reads as "randomly logged out".
 *
 * ── Deliberate choices ───────────────────────────────────────────────────────────────────────
 * · `SameSite=Lax`, not `None`. The apps are same-site to each other, so Lax is sufficient and it
 *   keeps the cookie off genuinely cross-site requests. `None` would ship these tokens to any site
 *   that embeds us.
 * · `Secure` always, except on localhost where there is no HTTPS to be secure over.
 * · NOT `HttpOnly` — it cannot be. The browser SDK has to read the token to attach it to requests.
 *   That is the same exposure localStorage already had, not a new one.
 * · On a host that is not under `oneworldlabs.ai` (localhost, a preview deploy, a custom domain
 *   like `onesocial.ai`) this falls back to localStorage automatically. Nothing breaks; those
 *   contexts simply do not get cross-app SSO, which is honest — a cookie cannot cross a
 *   registrable-domain boundary and pretending otherwise would fail silently.
 *
 * ── The one gap this does NOT close ──────────────────────────────────────────────────────────
 * `onesocial.ai` is a DIFFERENT registrable domain. No cookie can span `oneworldlabs.ai` and
 * `onesocial.ai`. For OneSocial to join this, it has to serve from `onesocial.oneworldlabs.ai`
 * (the hostname now exists) or implement a redirect-based token handshake. Decide with Lee; do not
 * quietly assume it works.
 */

/** The parent domain every One World app shares. */
const SHARED_DOMAIN = "oneworldlabs.ai";

/** Cookie payloads are capped near 4KB; stay well under with room for the attributes. */
const CHUNK = 3200;

function canUseSharedCookie(): boolean {
  if (typeof document === "undefined") return false;
  const h = location.hostname;
  return h === SHARED_DOMAIN || h.endsWith("." + SHARED_DOMAIN);
}

const attrs = () => {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  /* Leading dot is redundant in RFC 6265 but harmless, and it makes the intent obvious to anyone
     reading the cookie jar: this belongs to the whole family, not to this host. */
  return `; Domain=.${SHARED_DOMAIN}; Path=/; Max-Age=34560000; SameSite=Lax${secure}`;
};

function readRaw(name: string): string | null {
  const target = encodeURIComponent(name) + "=";
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(target)) return decodeURIComponent(part.slice(target.length));
  }
  return null;
}

function writeRaw(name: string, value: string) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${attrs()}`;
}

function deleteRaw(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; Domain=.${SHARED_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Session storage that every One World app shares.
 *
 * Implements Supabase's `SupportedStorage` (getItem / setItem / removeItem). Values are written to
 * a parent-domain cookie, chunked when large, and read back by rejoining the chunks.
 */
export const sharedSessionStorage = {
  getItem(key: string): string | null {
    if (!canUseSharedCookie()) return localStorage.getItem(key);

    const single = readRaw(key);
    if (single !== null) return single;

    /* Chunked. Stop at the first gap rather than scanning a fixed range — a missing middle chunk
       means the value is incomplete, and returning a truncated JSON blob would hand the SDK a
       session it cannot parse. Better to report nothing and let it re-authenticate. */
    let out = "";
    for (let i = 0; ; i++) {
      const part = readRaw(`${key}.${i}`);
      if (part === null) break;
      out += part;
    }
    if (out) return out;

    /* MIGRATION: someone signed in before this shipped has a session sitting in this origin's
       localStorage and no cookie. Adopt it rather than forcing a fresh sign-in — the next write
       promotes it to the shared cookie automatically. */
    try { return localStorage.getItem(key); } catch { return null; }
  },

  setItem(key: string, value: string): void {
    if (!canUseSharedCookie()) { localStorage.setItem(key, value); return; }

    /* Clear whichever shape was there before, so switching between chunked and single never leaves
       an orphan chunk that `getItem` would happily append to the next value. */
    this.removeItem(key, { keepMirror: true });

    if (value.length <= CHUNK) writeRaw(key, value);
    else for (let i = 0, o = 0; o < value.length; i++, o += CHUNK) {
      writeRaw(`${key}.${i}`, value.slice(o, o + CHUNK));
    }

    /* ── MIRROR TO localStorage, ON PURPOSE ──
       Adoption of this file is incremental: OneJob has it, the others do not yet. An app still on
       the default storage reads localStorage on ITS origin and would see nothing if the session
       lived only in a cookie.

       Writing both means the cookie carries the session ACROSS hostnames while the mirror keeps it
       readable by any app that has not migrated — and it fires the `storage` event that OneScore
       (and anything like it) already listens for. The cookie is the source of truth; this is a
       compatibility shim that costs nothing and can be deleted once every app ships this file. */
    try { localStorage.setItem(key, value); } catch { /* private mode */ }
  },

  /**
   * `keepMirror` is used internally by `setItem` when it is about to rewrite the value — clearing
   * the mirror there would blank the session for a non-migrated app for the length of a write.
   * A real sign-out never passes it, so signing out still clears everything, everywhere.
   */
  removeItem(key: string, opts?: { keepMirror?: boolean }): void {
    if (!canUseSharedCookie()) { localStorage.removeItem(key); return; }
    deleteRaw(key);
    for (let i = 0; i < 24; i++) {
      if (readRaw(`${key}.${i}`) === null && i > 0) break;
      deleteRaw(`${key}.${i}`);
    }
    /* Clearing the mirror is what makes "sign out of one app signs you out of all of them" true
       for apps that have not migrated yet. Without it, sign-out would appear to work and the old
       session would reappear the next time that app loaded. */
    if (!opts?.keepMirror) {
      try { localStorage.removeItem(key); } catch { /* private mode */ }
    }
  },
};

/**
 * The user object, kept OUT of the cookie.
 *
 * Per-origin on purpose: it is re-fetched from the server whenever the session is validated, it
 * grants no access on its own, and keeping it here is what leaves room in the cookie for the
 * tokens that actually matter.
 */
export const userObjectStorage = {
  getItem: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/**
 * THE STORAGE KEY — deliberately the Supabase DEFAULT, not a custom name.
 *
 * I first named this `oneworld-auth`, which was wrong, and reading OneScore's shipped bundle is
 * what caught it. OneScore watches for cross-tab sign-in with:
 *
 *     key.indexOf("sb-") === 0 && key.indexOf("-auth-token") > -1
 *
 * A renamed key matches none of that. Renaming would have silently broken session detection in a
 * sibling app the moment it adopted this file — the exact "tangled web" failure this work exists
 * to prevent. Every app already agrees on this name because it is what the SDK generates from the
 * project ref; the agreement is free, and breaking it costs.
 *
 * If the project ref ever changes, this changes with it, in every app, together.
 */
export const SHARED_STORAGE_KEY = "sb-wseblryyqxawvbjmylbo-auth-token";
