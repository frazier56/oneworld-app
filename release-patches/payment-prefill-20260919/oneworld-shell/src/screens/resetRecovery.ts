/**
 * RECOVERY STATE MACHINE — the decisions behind the forgot/reset flow, pulled out of the
 * component so they can be EXECUTED in a test rather than grepped (Max `MAX-20260805-1703`).
 * ============================================================================================
 * None of this imports React or the Supabase client. The client is passed in, so a test can
 * drive `performRequest` / `performReset` against a stub and prove the returned-`{ error }`
 * branches — the exact paths the first suite could not see. `ResetPassword.tsx` is a thin UI
 * over these functions; it must not re-implement any of this logic inline.
 *
 * Three corrections encoded here:
 *   1. A returned request error (rate-limit / provider / config) is a service failure, never a
 *      "sent" — and never an account-existence signal.
 *   2. A returned global sign-out error falls back to a local sign-out; we never claim global
 *      revocation that did not happen.
 *   3. Set-password mode unlocks ONLY on real recovery context — never on a generic existing
 *      session or an ordinary SIGNED_IN.
 */

/* A minimal shape of the one shared Supabase auth client — only the three methods this flow
   touches, so the module stays client-agnostic and a stub satisfies it. */
export interface RecoveryAuthClient {
  auth: {
    resetPasswordForEmail: (
      email: string,
      opts: { redirectTo: string },
    ) => Promise<{ error: unknown }>;
    updateUser: (attrs: { password: string }) => Promise<{ error: unknown }>;
    signOut: (opts: { scope: "global" | "local" }) => Promise<{ error: unknown }>;
  };
}

/* ── 1. Mount decision ──────────────────────────────────────────────────────────────────────
   From the first getSession() answer and whether the URL is a recovery landing. A session that
   did NOT arrive through a recovery link must never unlock set mode — that was the bug. */
export type MountDecision = "set" | "request" | "await";

export function decideMountPhase(hasSession: boolean, isRecoveryLanding: boolean): MountDecision {
  if (hasSession && isRecoveryLanding) return "set"; // the recovery code already exchanged
  if (isRecoveryLanding) return "await"; // recovery landing, exchange not settled — wait, then set/expired
  return "request"; // no recovery context at all (even if a generic session exists)
}

/* ── 2. Which auth events prove recovery ────────────────────────────────────────────────────
   `PASSWORD_RECOVERY` is the authoritative signal. The PKCE `?code=` exchange can instead surface
   as `SIGNED_IN` with a session — but that only counts as recovery when the URL was a recovery
   landing. A bare `SIGNED_IN` (ordinary sign-in in another tab) must not unlock set mode. */
export function recoveryEventUnlocks(
  event: string,
  hasSession: boolean,
  isRecoveryLanding: boolean,
): boolean {
  if (event === "PASSWORD_RECOVERY") return true;
  if (event === "SIGNED_IN" && hasSession && isRecoveryLanding) return true;
  return false;
}

/* ── 3. Request outcome ─────────────────────────────────────────────────────────────────────
   resetPasswordForEmail returns `{ error }` for rate-limit / provider / config failures and
   resolves with no error for BOTH known and unknown emails (that is the anti-enumeration
   guarantee). So a non-null error is always a service condition, never "this address is unknown"
   — safe to surface generically. */
export type RequestOutcome = "sent" | "serviceError";

export function classifyRequestResult(error: unknown): RequestOutcome {
  return error ? "serviceError" : "sent";
}

/* ── 4. Sign-out disposition after a successful password change ──────────────────────────────
   Prefer global revocation; if it returns an error, fall back to local so this device is at
   least signed out. Never claim global revocation that did not happen. */
export type SignOutDisposition = "global" | "local-fallback";

export function nextSignOutStep(globalError: unknown): SignOutDisposition {
  return globalError ? "local-fallback" : "global";
}

/* ── 5. The two client operations, executable against a stub ─────────────────────────────────*/

export async function performRequest(
  client: RecoveryAuthClient,
  email: string,
  origin: string,
): Promise<RequestOutcome> {
  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset`,
    });
    return classifyRequestResult(error);
  } catch {
    // A thrown transport error is a service failure too — still non-enumerating.
    return "serviceError";
  }
}

export interface ResetResult {
  ok: boolean;
  disposition: SignOutDisposition | null; // null when the password change itself failed
  error: unknown; // the updateUser error when ok === false
}

export async function performReset(
  client: RecoveryAuthClient,
  password: string,
): Promise<ResetResult> {
  const { error } = await client.auth.updateUser({ password });
  if (error) return { ok: false, disposition: null, error };

  // Password is changed. Revoke sessions — global preferred, local as the documented fallback.
  let disposition: SignOutDisposition = "global";
  try {
    const { error: outErr } = await client.auth.signOut({ scope: "global" });
    disposition = nextSignOutStep(outErr);
    if (disposition === "local-fallback") {
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        /* the password is already changed; nothing more to do here */
      }
    }
  } catch {
    disposition = "local-fallback";
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      /* the password is already changed */
    }
  }
  return { ok: true, disposition, error: null };
}

/* Account setup links deliberately keep the newly recovered session. The person has just proved
   control of a one-time recovery link and should land in the existing account they were invited
   to finish setting up, rather than being sent through sign-in a second time. */
export async function performAccountSetup(
  client: RecoveryAuthClient,
  password: string,
): Promise<{ ok: boolean; error: unknown }> {
  const { error } = await client.auth.updateUser({ password });
  return { ok: !error, error };
}
