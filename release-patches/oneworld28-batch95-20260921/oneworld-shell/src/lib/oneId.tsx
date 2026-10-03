import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import { useI18n, W } from "./i18n";
import { sc } from "./shellCopy";

/**
 * ONE ID — one account for the whole One World Labs ecosystem.
 * ============================================================================================
 * Lee, 3 August 2026:
 *
 *   "When someone downloads OneJob and it's time for them to register, what they secretly are
 *    doing is creating a global account that will work on any of the five apps and the other
 *    three services. By the time they download that second app or log in to OneVoice, the login
 *    still works… we should tell them: you're signing into the ecosystem."
 *
 * The design is right and it is what Google, Adobe and Microsoft all do. Three corrections were
 * made to it before building, and each is load-bearing.
 *
 * ── 1. Delete the word "secretly" ───────────────────────────────────────────────────────────
 * Not a style note. An account created with broader scope than the person understands is a
 * transparency failure in every market this ships into: GDPR Art. 13 requires notice AT the
 * moment of collection; Colombia's Ley 1581/2012 Art. 9 requires authorization that is *previa,
 * expresa e informada* AND requires keeping proof of it; the FTC treats undisclosed enrolment as
 * a deceptive practice on its own.
 *
 * Lee's own instinct — show a short message — is exactly the right fix. It only has to move:
 * BEFORE the account is created, on the sign-up screen itself, naming the company and saying
 * plainly that one account covers all the products. `profiles.one_id_notice_seen_at` timestamps
 * that it happened, because "we showed it" is worth nothing without evidence.
 *
 * ── 2. Signed in everywhere ≠ entitled to everything ────────────────────────────────────────
 * This is the half that did not exist. One ID authenticates; `one_world_products` authorizes.
 * A OneVoice customer who opens OneJob should meet an invitation, not a paid surface. Without
 * the split, a single sign-on quietly becomes a single permission.
 *
 * ── 3. Duplicate accounts are already impossible — by construction, not by messaging ────────
 * Lee's worry is that someone signs up twice thinking the products are separate. But the same
 * email always resolves to the same Supabase user no matter which product they are standing in,
 * and OAuth is keyed on the verified email too. Attempting to "register again" simply signs them
 * in. So the notice is there for HONESTY and for the cross-sell, not as the mechanism that
 * prevents duplicates — the mechanism is the shared user table, and it already holds.
 *
 * That matters because it means the notice can stay short. It is not load-bearing for
 * correctness, so it does not need to interrupt anyone at the highest-drop-off moment in the
 * funnel. One line under the button; the full explanation after they have converted.
 */

/**
 * ONE UNION, NOT TWO. `Product` IS `AppKey`.
 * --------------------------------------------------------------------------------------------
 * `oneWorld.ts` has always said these "are the same set and are kept as one alias rather than two
 * unions that can drift apart" — and they were nonetheless two hand-written literal unions, which
 * drifted the moment `onehome` was added: `AppKey` had it, `Product` did not, and twenty-three
 * call sites failed to compile with "'onehome' is not assignable to type 'Product'".
 *
 * The comment was right and the code did not implement it. Now it does: adding a product is ONE
 * edit, in `oneWorld.ts`, and it is impossible for the two names to describe different sets.
 *
 * `import type` deliberately — it is erased at compile time, so this does not create a runtime
 * import cycle with `routes.ts`.
 */
import type { AppKey } from "./oneWorld";
export type Product = AppKey;

/** Bump when the disclosure wording changes, so a consent row says what was actually shown. */
export const ONE_ID_NOTICE_VERSION = "2026-08-03";

export interface OneIdState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  /**
   * How to greet them, and their face. The drawer needs BOTH and had neither — it rendered the
   * literal word "Menu" where a first name belongs, beside a permanent grey silhouette, for
   * every signed-in user in every product.
   *
   * These come from `profiles`, which is shared across the whole ecosystem, so one fetch here
   * serves all eight products rather than each one reaching for the same row.
   *
   * `displayName` is the FULL name. The drawer takes the first word of it — that is a rendering
   * decision belonging to the 218px drawer, not to identity.
   */
  displayName: string | null;
  photoUrl: string | null;
  /** Their headline, if they have one. The drawer's subtitle prefers it over the email. */
  jobTitle: string | null;
  /**
   * HOME. The product this person thinks of as "the app" — `profiles.signup_app`.
   *
   * Lee, 4 Aug 2026: *"the system needs to know what their primary download was, and it takes
   * them there... and people should have the ability to switch their primary. Let's say they
   * download OneJob and decide they like OneScore better. They may evolve over time."*
   *
   * Set once by `claim_product` at first entry, and now changeable — see `setPrimary`.
   */
  primary: Product | null;
  setPrimary: (p: Product) => Promise<void>;
  /** Products this person actually holds. Empty array is a real answer, not "unknown". */
  products: Product[];
  has: (p: Product) => boolean;
  /** Grant a FREE product after its terms are accepted. Paid products are refused server-side. */
  claimProduct: (p: Product) => Promise<void>;
  /**
   * Turn a FREE product back off. Nothing is deleted — the row survives with `ended_at` set, so
   * reconnecting is a revival and the person's profile, posts, jobs and score are untouched.
   * A paid service is refused server-side: swiping a row off a list must never cancel a
   * subscription. See `disconnect_product` in Postgres.
   */
  disconnectProduct: (p: Product) => Promise<void>;
  /** False means the server did not revoke the session; signOutError explains and retry is safe. */
  signOutEverywhere: () => Promise<boolean>;
  signOutError: string | null;
}

/* A named throw rather than `null as any`. The package publishes TopBar, Drawer, BottomTabs and
   SignIn as standalone exports, so a product CAN render one outside `<AppShell>` — and the old
   default turned that into "Cannot destructure property of null", a white screen with a stack
   trace pointing at React internals rather than at the mistake. */
const Ctx = createContext<OneIdState | null>(null);

export function OneIdProvider({ app, children }: { app: AppKey; children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const { lang } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; photo_url: string | null; job_title: string | null; signup_app: string | null } | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  /* Shared by startup, live auth events, and action-triggered refreshes. A generation scoped
     inside the auth effect cannot cancel work started by claim/disconnect/set-primary. */
  const authRevision = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const providerMounted = useRef(false);
  const lastAuthEvent = useRef<string | null>(null);
  const identityIsCurrent = useCallback((revision: number, uid: string | null) =>
    providerMounted.current && authRevision.current === revision && currentUserId.current === uid, []);

  const load = useCallback(async (uid: string | null, isCurrent: () => boolean) => {
    if (!uid) {
      if (isCurrent()) { setProducts([]); setProfile(null); }
      return;
    }
    /* ── READ ONLY. THE CLAIM MOVED, DELIBERATELY ──────────────────────────────────────────
       This used to call `claim_product(app)` on every mount, which meant TYPING A URL granted
       the product. A tour through the switcher granted all five. `one_world_products` became a
       log of pages visited rather than products chosen — which destroys the cross-sell signal
       the table exists for and makes `RequireProduct` meaningless.

       Worse, it granted BEFORE the product's own terms were shown, because this provider sits
       above TermsGate. Entitlement preceded consent, which inverts the whole point of the gate.

       The claim now happens when someone ACCEPTS the product's terms — a deliberate act, once,
       in the right order. See `claimProduct` below and its caller in TermsGate.

       It also used to re-run on every token refresh, rewriting a `profiles` row hourly per user
       forever. That is gone with it. */
    const { data } = await supabase
      .from("one_world_products")
      .select("product")
      .in("status", ["active", "trial"])
      .is("ended_at", null);
    if (!isCurrent()) return;
    setProducts((data ?? []).map(r => r.product as Product));

    /* The greeting. Explicitly scoped by `id` rather than trusting RLS to narrow it — an admin
       policy that widens what RLS returns would otherwise hand this query somebody else's row,
       which is exactly how the unread badge once read 41 instead of 6. `maybeSingle` is safe
       only because the filter can match at most one row. */
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, photo_url, job_title, signup_app")
      .eq("id", uid)
      .maybeSingle();
    if (!isCurrent()) return;
    setProfile(prof ?? null);
  }, [app]);

  useEffect(() => {
    providerMounted.current = true;

    /* One cookie, eight origins: a sign-out in ANY product must be seen here. The auth
       listener fires on cross-tab storage changes, which is what makes "sign out of one,
       signed out of all" true rather than aspirational. */
    /* ── NEVER AWAIT SUPABASE INSIDE THIS CALLBACK ─────────────────────────────────────────
       auth-js fires these callbacks while HOLDING the storage lock, and every PostgREST call
       resolves the session first — so awaiting `load()` here deadlocks against the lock that is
       currently calling us. auth-js says so in its own source.

       The symptom is the worst kind: an intermittent hang at startup with no error, which
       renders as a white screen because AuthGate returns null while it is still deciding. It
       would have made the sign-on test non-reproducible — passing sometimes, hanging others,
       with nothing in the console either way.

       Identity state is set synchronously (that is just React). The database work is deferred to
       the next macrotask, by which time the lock is released. */
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const eventRevision = ++authRevision.current;
      lastAuthEvent.current = event;
      const u = session?.user ?? null;
      currentUserId.current = u?.id ?? null;
      setUserId(u?.id ?? null);
      setEmail(u?.email ?? null);
      setTimeout(() => {
        if (!identityIsCurrent(eventRevision, u?.id ?? null)) return;
        void load(u?.id ?? null, () => identityIsCurrent(eventRevision, u?.id ?? null))
          .finally(() => { if (identityIsCurrent(eventRevision, u?.id ?? null)) setLoading(false); });
      }, 0);
    });

    const startupRevision = authRevision.current;
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      if (!providerMounted.current || authRevision.current !== startupRevision) return;
      currentUserId.current = u?.id ?? null;
      setUserId(u?.id ?? null);
      setEmail(u?.email ?? null);
      await load(u?.id ?? null, () => identityIsCurrent(startupRevision, u?.id ?? null));
      if (identityIsCurrent(startupRevision, u?.id ?? null)) setLoading(false);
    });

    return () => {
      providerMounted.current = false;
      authRevision.current++;
      currentUserId.current = null;
      sub.subscription.unsubscribe();
    };
  }, [identityIsCurrent, load]);

  /**
   * `scope: "global"` revokes every refresh token on the server, not just this device's.
   * Clearing the local cookie alone would leave live sessions on the other seven origins
   * and on other devices — which is the difference between logging out and appearing to.
   */
  const signOutEverywhere = useCallback(async () => {
    /* v21 CK: the OneEvent contact-capture store is per-person — clear it so the next
       sign-in on this browser doesn't inherit the previous person's name/phone. */
    try { sessionStorage.removeItem("ow.evt.contact"); } catch { /* ignore */ }
    /* Cancel every in-flight identity refresh before the network sign-out returns. */
    const attemptRevision = ++authRevision.current;
    setSignOutError(null);

    const recover = async (_problem: unknown) => {
      if (!providerMounted.current || authRevision.current !== attemptRevision) return false;
      /* Provider details stay out of the customer UI: auth services can include implementation
         text that is neither localized nor appropriate to expose. */
      const message = W(lang,
        "We couldn't confirm sign-out on all devices. Try again.",
        "No pudimos confirmar el cierre de sesión en todos los dispositivos. Inténtalo de nuevo.");
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!providerMounted.current || authRevision.current !== attemptRevision) return false;
        const u = data.session?.user ?? null;
        currentUserId.current = u?.id ?? null;
        setUserId(u?.id ?? null);
        setEmail(u?.email ?? null);
        await load(u?.id ?? null, () => identityIsCurrent(attemptRevision, u?.id ?? null));
      } catch {
        /* Keep the last known identity; the next auth event remains authoritative. */
      }
      if (providerMounted.current && authRevision.current === attemptRevision) {
        setLoading(false);
        setSignOutError(message);
      }
      return false;
    };

    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) return await recover(error);
    } catch (error) {
      return await recover(error);
    }

    /* Usually SIGNED_OUT already advanced the revision and cleared this state. This fallback
       handles a successful SDK response that produced no listener event. */
    if (!providerMounted.current) return false;
    if (authRevision.current !== attemptRevision) {
      /* The event emitted by this successful sign-out is authoritative. A newer signed-in or
         account-switch event is not this attempt's success and must block caller navigation. */
      return lastAuthEvent.current === "SIGNED_OUT" && currentUserId.current === null;
    }
    if (providerMounted.current) {
      currentUserId.current = null;
      setUserId(null); setEmail(null);
      await load(null, () => identityIsCurrent(attemptRevision, null));
      if (identityIsCurrent(attemptRevision, null)) setLoading(false);
    }
    return true;
  }, [identityIsCurrent, lang, load]);

  const has = useCallback((p: Product) => products.includes(p), [products]);

  /**
   * Grant this person the product they just accepted terms for, and refresh what they hold.
   *
   * The five consumer apps are free, so accepting their terms grants them. `claim_product`
   * REFUSES any paid product server-side — I verified the function body against the live
   * database, it raises on anything outside the five. Paid products are granted only by
   * Stripe/GHL webhooks running as service_role. Client code cannot grant itself a paid product
   * by asking nicely, and `authenticated` has no INSERT grant on the table either.
   */
  const claimProduct = useCallback(async (p: Product) => {
    const revision = authRevision.current;
    const uid = currentUserId.current;
    const { error } = await supabase.rpc("claim_product", { p_product: p, p_source: p });
    if (!identityIsCurrent(revision, uid)) return;
    if (!error) await load(uid, () => identityIsCurrent(revision, uid));
  }, [identityIsCurrent, load]);

  /**
   * The other direction. Lee, 4 Aug 2026: *"if they accidentally select one or two just by
   * testing it, they can go back and put them back to not connected."*
   *
   * Errors are re-thrown rather than swallowed — the row animates away on success, so a silent
   * failure would leave the list saying something the database does not agree with. The caller
   * puts the row back and says why.
   */
  /**
   * Move HOME. The one field a person is choosing about themselves rather than about a product,
   * so it is a deliberate call rather than a side effect of visiting a route — the last version
   * of that idea turned `signup_app` into a log of pages visited.
   */
  const setPrimary = useCallback(async (p: Product) => {
    const revision = authRevision.current;
    const uid = currentUserId.current;
    const { error } = await supabase.rpc("set_primary_product", { p_product: p });
    if (!identityIsCurrent(revision, uid)) return;
    if (error) throw error;
    await load(uid, () => identityIsCurrent(revision, uid));
  }, [identityIsCurrent, load]);

  const disconnectProduct = useCallback(async (p: Product) => {
    const revision = authRevision.current;
    const uid = currentUserId.current;
    const { error } = await supabase.rpc("disconnect_product", { p_product: p });
    if (!identityIsCurrent(revision, uid)) return;
    if (error) throw error;
    await load(uid, () => identityIsCurrent(revision, uid));
  }, [identityIsCurrent, load]);

  return (
    <Ctx.Provider value={{
      loading, userId, email, products, has, claimProduct, disconnectProduct, signOutEverywhere, signOutError,
      primary: (profile?.signup_app as Product | null) ?? null,
      setPrimary,
      displayName: profile?.full_name ?? null,
      photoUrl: profile?.photo_url ?? null,
      jobTitle: profile?.job_title ?? null,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useOneId = (): OneIdState => {
  const v = useContext(Ctx);
  if (!v) throw new Error(
    "[oneworld-shell] useOneId() outside <OneIdProvider>. Mount <AppShell config={…}> — it " +
    "supplies the theme, language and identity providers the chrome reads.");
  return v;
};

/**
 * Gate a surface on ENTITLEMENT, not on being signed in.
 *
 * Deliberately renders an invitation rather than an error. Someone who came in through
 * OneVoice and lands on OneJob has not done anything wrong — they are the exact person the
 * ecosystem exists to move between products, and a wall is the wrong response to the best
 * moment to cross-sell.
 *
 * NOT A SECURITY BOUNDARY. This hides UI. The real enforcement is RLS on every table plus
 * `has_product()` inside the SECURITY DEFINER functions — because on static hosting there is
 * no server in front of the database, so anything the client decides can be bypassed by not
 * running the client.
 */
export function RequireProduct(
  { product, children, invite }:
  { product: Product; children: React.ReactNode; invite: React.ReactNode }
) {
  const { loading, has } = useOneId();
  if (loading) return null;
  return has(product) ? <>{children}</> : <>{invite}</>;
}

/**
 * The disclosure. Short on purpose.
 *
 * Sits UNDER the sign-up control, before the account exists. It names the company, says one
 * account covers everything, and links the detail — which is the minimum GDPR Art. 13 and
 * Ley 1581 Art. 9 ask for, and roughly what a person will actually read at this moment.
 *
 * Explicitly NOT a modal, NOT a checkbox, NOT an interstitial. Lee: *"we don't wanna disturb
 * their flow… we want them to continue to sign on and create their account like they were
 * planning on doing."* Correct — this is the highest-drop-off moment in the funnel, and the
 * duplicate-account problem it might otherwise be solving is already handled by the shared
 * user table.
 */
export function OneIdNotice({ className = "" }: { className?: string }) {
  const { lang } = useI18n();
  return (
    /* == THE LINK GETS ITS OWN LINE, AND IT ACTUALLY GOES SOMEWHERE ====================
       Lee, 5 Aug 2026: *"at the very bottom it says 'how your data is used'. That link doesn't
       work, and it should work. And that should be on its own line - it shouldn't be wrapped,
       since it's the last line."*

       Two separate faults in one sentence. The link pointed at `www.oneworldlabs.ai/privacy`,
       a page on the MARKETING site that does not exist - so the only place a member is told
       their data is explained turned out to be a dead end, which is exactly the sentence you
       do not want to be wrong about. It now points at the app's own `/privacy` route, on this
       origin, which the shell serves.

       And it was inline, so it wrapped mid-phrase at the end of a paragraph and read as part of
       the sentence rather than as something you can press. A block of its own, with vertical
       padding, makes it a target as well as a promise. */
    <div className={`px-2 text-center ${className}`}>
      <p className="text-[11.5px] leading-snug opacity-55">{sc(lang, "oneIdNotice")}</p>
      <a href="/privacy" className="ow-tap mt-0.5 inline-flex min-h-[40px] items-center py-1 text-[11.5px] font-medium underline underline-offset-2 opacity-70">
        {sc(lang, "dataUse")}
      </a>
    </div>
  );
}

/** Record that the notice was shown and log granular consents. Call right after sign-up.
 *
 * THE ERROR PROPAGATES. Max, 5 Aug 2026: *"`SignUp.tsx` wraps `recordOneIdNotice` in
 * `try/catch`, but `recordOneIdNotice` awaits `supabase.rpc(...)` without checking or throwing
 * its returned `{ error }`. Supabase RPC failures therefore resolve and the wizard advances."*
 *
 * He is right, and it is the subtle half of the swallowed-error lesson: supabase-js does NOT
 * reject on an RPC failure — it RESOLVES with `{ error }`. So every `try/catch` around this
 * helper was dead code, and a consent stamp that failed to write let the wizard advance
 * anyway. Under GDPR Art. 13 / Ley 1581 that is consent we cannot prove — indistinguishable,
 * a year from now, from consent never obtained. Same convention as `setPrimary` and
 * `disconnectProduct` above: `if (error) throw error`, so the caller shows the server's own
 * sentence and decides. `tests/shell.signup-wizard.cjs` executes this function against a
 * stubbed client and fails the build if a resolved `{ error }` ever stops propagating. */
export async function recordOneIdNotice(locale: string, consents: Record<string, boolean> = {}) {
  const { error } = await supabase.rpc("record_one_id_notice", {
    p_notice_version: ONE_ID_NOTICE_VERSION,
    p_locale: locale,
    p_consents: consents,
  });
  if (error) throw error;
}

