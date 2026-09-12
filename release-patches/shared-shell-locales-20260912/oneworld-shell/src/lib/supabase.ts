import { createClient } from "@supabase/supabase-js";
import { SHARED_STORAGE_KEY } from "./sessionStorage";

/**
 * ONE CLIENT, ONE SESSION, EIGHT PRODUCTS.
 * ============================================================================================
 * Supabase keeps the session in `localStorage` by default, and localStorage is scoped to an
 * ORIGIN. While every app lived under `www.oneworldlabs.ai/<app>/` they shared one origin and
 * therefore one session BY ACCIDENT. The moment each app got its own hostname that accident
 * ended — `onejob.oneworldlabs.ai` and `onescore.oneworldlabs.ai` are different origins and
 * cannot see each other's storage.
 *
 * That is why Lee is signed into OneJob and OneScore says "guest".
 *
 * Cookies are scoped to a DOMAIN, not an origin. A cookie written for `.oneworldlabs.ai` is
 * readable by every subdomain, so the session lives there instead. Same model as Google: you
 * authenticate once and mail/drive/calendar all see it.
 *
 * `userStorage` splits the user object out to localStorage so the cookie carries tokens only —
 * a full Supabase session can exceed the ~4KB cookie cap, and a silently truncated cookie
 * produces a session that looks present and fails to parse, which reads as "randomly logged
 * out". `sessionStorage.ts` also chunks anything still too large.
 *
 * ── UPDATED 3 Aug 2026: THE COOKIE IS GONE, AND THAT IS THE FIX, NOT A REGRESSION ──────────
 * Everything now serves from ONE origin. Same origin means the session is simply shared — the
 * whole problem the cookie existed to solve no longer exists.
 *
 * Keeping it was not free, and an audit was right to call it a liability:
 *   · The refresh token rode along on EVERY request to every *.oneworldlabs.ai host, including
 *     the marketing site and static-asset fetches to hosts whose logs we do not control.
 *   · It cannot be HttpOnly (the client has to read it), so any script on ANY oneworldlabs.ai
 *     host could read it — and the marketing site is the most likely place someone pastes an
 *     analytics or ad tag.
 *   · The token existed in three places at once: cookie, chunked cookie, and a localStorage
 *     mirror.
 *
 * One credential unlocks held money across eight products. Storing it in the widest possible
 * place, in triplicate, to solve a problem we no longer have, is the wrong trade. Default
 * localStorage on one origin is both simpler and tighter.
 *
 * `onesocial.ai` remains a different registrable domain and cannot share a session by any
 * mechanism — see RETIRED_PATHS.
 *
 * ── PKCE, NOT IMPLICIT ──────────────────────────────────────────────────────────────────────
 * The library defaults to the implicit flow, which returns the access token AND the refresh
 * token in the URL fragment. On a static host that means long-lived credentials land in the
 * address bar and in browser history — and if the redirect target is ever wrong, they land in
 * someone else's origin.
 *
 * PKCE returns a short-lived one-time code in the query string and keeps the verifier in local
 * storage, so the URL never carries a credential. It is the correct flow for a static site and
 * it is not the default. Setting it explicitly.
 */
export const SUPABASE_URL = "https://wseblryyqxawvbjmylbo.supabase.co";
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SHARED_STORAGE_KEY,
    flowType: "pkce",
    /* ── PASSKEYS ARE OPT-IN AT THE CLIENT, NOT JUST AT THE PROJECT ─────────────────────
       Lee's fourth biometrics test printed the answer verbatim:

         "@supabase/auth-js: the passkey API is experimental and disabled by default.
          Enable it by passing `auth: { experimental: { passkey: true } }` to createClient."

       So there were THREE gates in front of `registerPasskey`, and each one hid the next:
         1. the project's Passkeys switch (turned on 4 Aug),
         2. calling the passkey API instead of the MFA API (fixed 4 Aug),
         3. this flag — the SDK refuses to expose the method at all without it.

       Nothing about the earlier fixes was wasted; each was genuinely required. But it is worth
       naming the pattern: every round cost a full test cycle, and every round was solved the
       moment the real error text reached the screen instead of a polite summary of it. */
    experimental: { passkey: true },
  } as any,
});

/**
 * THE PLATFORM FEE: 5.99%. Settled, final, and not open for discussion.
 *
 * The database now derives this from a single immutable function, `platform_fee_rate()`, and
 * every backend caller reads it from there rather than carrying its own literal. This constant
 * is the display copy of that one number.
 *
 * If you are about to type a fee rate anywhere else: don't. Two functions once carried their own
 * literal and quietly paid out on a different rate than the app quoted.
 */
export const FEE_RATE = 0.0599;
export const FEE_PCT = (FEE_RATE * 100).toFixed(2) + "%";

/**
 * ONEHOME'S MONTHLY FEE SPLIT: HOST 1.50% + GUEST 7.50% = 9.00% TOTAL.
 * ============================================================================================
 * Lee set this shape on 21 Aug 2026. It is deliberately three named values, not one flat fee:
 * the host fee is deducted from the host's rent, while the guest fee is added to the guest's
 * payment. The total is derived so it cannot drift away from the two amounts people actually
 * pay. This mirrors `rental_host_fee_rate()`, `rental_guest_fee_rate()` and the derived
 * `rental_fee_rate()` in the database.
 *
 * Every lease row freezes BOTH side-specific rates at signing. Billing or rendering an existing
 * lease must therefore read `host_fee_rate` and `guest_fee_rate` from that row. These constants
 * describe only a new quote before a contract exists.
 *
 * The fee is due on every monthly rent payment. The rent itself continues directly from tenant
 * to landlord; OneHome collects its own fees separately and never holds or takes a fee on a
 * deposit. Listing, messaging, contracts and signatures remain free.
 */
export const RENTAL_HOST_FEE_RATE = 0.0150;
export const RENTAL_GUEST_FEE_RATE = 0.0750;
export const RENTAL_FEE_RATE = RENTAL_HOST_FEE_RATE + RENTAL_GUEST_FEE_RATE;
export const RENTAL_HOST_FEE_PCT = (RENTAL_HOST_FEE_RATE * 100).toFixed(2) + "%";
export const RENTAL_GUEST_FEE_PCT = (RENTAL_GUEST_FEE_RATE * 100).toFixed(2) + "%";
export const RENTAL_FEE_PCT = (RENTAL_FEE_RATE * 100).toFixed(2) + "%";

/**
 * ONESALE'S FEE: 5.99%. A THIRD constant, and — more importantly — a rate on a DIFFERENT BASE.
 * ============================================================================================
 * Lee, 10 Aug 2026, first: *"The only thing that we're taking commission on is the earnest
 * money."* Then, correcting the rate: *"A percent is saying five point nine nine. It's not six
 * percent. So we're gonna keep it consistent. Five point nine nine for the earnest money hold."*
 *
 * ── Why this is STILL its own constant when the number equals FEE_RATE ──────────────────────
 * Because the BASE is different, and the base is what a refactor loses. `FEE_RATE` multiplies a
 * whole transfer; this multiplies earnest money only. Aliasing them would read as "same fee" and
 * the first person to change the OneJob rate would silently change what OneSale charges on a
 * Colombian arras deposit. Two numbers that happen to be equal today are not one number.
 *
 * ── The base matters more than the digits ───────────────────────────────────────────────────
 * The other two rates attach to a transfer of the whole amount. This one does not. A Colombian
 * sale closes through attorneys and the PURCHASE PRICE NEVER PASSES THROUGH US — claiming
 * otherwise would be the most damaging thing this product could say. What passes through is the
 * earnest money, captured into the vault, and 6.00% of THAT is ours.
 *
 * So a screen that multiplies this rate by an asking price, or by an agent's commission, is
 * wrong even when the arithmetic is right. `saleFeeOnEarnest()` below takes the earnest amount
 * by name so a call site cannot quietly hand it the wrong number.
 *
 * ── Why a third constant rather than a third branch ─────────────────────────────────────────
 * Same reason as the second: one number that means three things fails silently, on real money,
 * months later. Three plain literals. `tests/shell.products.cjs` asserts the SHAPE, not just
 * the digits, so a future refactor into `FEE_RATE(product)` fails the suite immediately.
 */
export const SALE_FEE_RATE = 0.0599;
export const SALE_FEE_PCT = (SALE_FEE_RATE * 100).toFixed(2) + "%";

/** Our cut of earnest money held in the vault. Named for its base so it cannot be misapplied. */
export function saleFeeOnEarnest(earnestAmount: number): number {
  return Math.round(earnestAmount * SALE_FEE_RATE * 100) / 100;
}

/**
 * NOTHING IS CHARGED ON A REFUND.
 *
 * Under Colombian law arras are, by default, arras de RETRACTACIÓN — either side may withdraw
 * (Código Civil art. 1859). Lee's framing: *"it's kind of a good news thing because you get it
 * back if you don't go through with the sale."* Charging a fee on money we are handing back
 * would turn that into a bad-news thing and would be indefensible in a dispute. The fee attaches
 * to RELEASE at completion, never to a refund — the same shape as the family rule that nothing
 * is billed until money actually moves to a counterparty.
 */
export const SALE_FEE_ON_REFUND = 0;

/**
 * The rate a given product charges. For DISPLAY — a fee line, a Terms page, a net-to-you figure.
 *
 * Money code must not call this. An edge function that needs a rate names the constant, so that
 * reading the function tells you which product's money it is moving.
 *
 * Note that for `onesale` the rate alone is not the whole truth — it applies to earnest money
 * only. A caller rendering a bare percentage for OneSale must say what it is charged on.
 */
export function productFeeRate(product: string): number {
  if (product === "onerental") return RENTAL_FEE_RATE;
  if (product === "onesale") return SALE_FEE_RATE;
  return FEE_RATE;
}
