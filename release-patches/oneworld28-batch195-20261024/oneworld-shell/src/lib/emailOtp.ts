import { SUPABASE_URL, SUPABASE_ANON } from "./supabase";

/**
 * SEND A SIX-DIGIT EMAIL CODE THAT CAN ACTUALLY BE VERIFIED.
 * ============================================================================================
 * Lee, 11 Aug 2026, trying to create an account: he received a code and typed it in seconds, and
 * got back **"Token has expired or is invalid"**. It had happened to him at least three times —
 * `frazierlee0123@gmail.com` and `frazierlee0125@gmail.com` on 4 Aug and `frazierlee+1@gmail.com`
 * on 11 Aug are all sitting in `auth.users` with `confirmed_at: null`. **Nobody has been able to
 * create an account with an email address since at least 4 August.**
 *
 * ── I GUESSED WRONG FIRST, AND THE LOGS SAID SO ─────────────────────────────────────────────
 * My first explanation was Gmail prefetching the login link in the same email and burning the
 * one-time token — the classic cause of this exact error, and I put it at 80% and told Max to go
 * check the email template. **The auth logs disproved it.** There is not a single `GET /verify`
 * in the whole window; a prefetch would be exactly that. What the logs actually show is:
 *
 *     22:02:55  POST /otp     200   ← the code is sent
 *     22:03:13  POST /verify  403   "token has expired or is invalid"   ← 18 seconds later
 *
 * Eighteen seconds. Nothing expires in eighteen seconds. It was never a timing problem.
 *
 * ── THE REAL CAUSE, FROM THE DATABASE AND THEN FROM THE SDK SOURCE ──────────────────────────
 * `auth.one_time_tokens` stores the token for every one of those three failed sign-ups with a
 * **`pkce_` prefix**. `@supabase/auth-js` 2.112.2, `GoTrueClient.js` line 1849:
 *
 *     if (this.flowType === 'pkce') {
 *       [codeChallenge, codeChallengeMethod, flowId] = await this._getCodeChallengeAndMethod()
 *     }
 *
 * Our shared client sets `flowType: "pkce"` — correctly, for OAuth. But that flag is read on
 * EVERY `signInWithOtp`, with no way to opt out per call. So the send posts a `code_challenge`,
 * GoTrue stores a PKCE token, and `verifyOtp` (line 2039) posts the bare six digits with no
 * `code_verifier` anywhere in its body. **The stored token and the submitted token are two
 * different kinds of thing.** They cannot match, they never could, and the 403 is instant and
 * total — which is precisely what we observe.
 *
 * ── WHY THIS FUNCTION EXISTS INSTEAD OF FLIPPING THE FLAG ───────────────────────────────────
 * The one-line fix is `flowType: "implicit"` on the shared client. It is the wrong fix: implicit
 * flow hands OAuth tokens back in the URL fragment, where they land in browser history and in
 * any Referer that leaks — a real security downgrade to Google sign-in, which is not broken, in
 * order to repair email sign-in, which is.
 *
 * So the flag stays on PKCE and the ONE broken call bypasses the SDK helper. This posts to
 * `/auth/v1/otp` directly with no `code_challenge`, which is the ordinary OTP path, so GoTrue
 * mints an ordinary six-digit token that `verifyOtp` matches. Everything downstream is unchanged:
 * verification still goes through `supabase.auth.verifyOtp`, so the session is saved by the
 * shared client into the shared storage key exactly as before.
 *
 * **This is NOT a second Supabase client.** It is one `fetch` to one endpoint. The one-client
 * doctrine in `supabase.ts` — and the test that guards it — is about session storage, and no
 * session is created here.
 *
 * ── WHAT MUST BE TRUE IN THE PROJECT FOR THIS TO WORK ───────────────────────────────────────
 * The Magic Link email template has to render `{{ .Token }}`. It does: Lee received `147251`.
 * Nothing about the template needs to change, and I no longer think it ever did.
 */

export type SendOtpResult = { error: { message: string } | null };

export async function sendEmailOtp(
  email: string,
  opts?: { captchaToken?: string | null; shouldCreateUser?: boolean },
): Promise<SendOtpResult> {
  const body: Record<string, unknown> = {
    email: email.trim(),
    create_user: opts?.shouldCreateUser ?? true,
  };
  /* Server-side captcha enforcement is ON for this project — the auth log carries real
     `400: captcha protection: request disallowed` rejections, which is worth knowing because our
     own code comments still describe it as decorative. The token has to ride along or the send
     is refused. */
  if (opts?.captchaToken) body.gotrue_meta_security = { captcha_token: opts.captchaToken };

  /* NO `redirect_to`. We are not sending a link and we do not want one — Lee asked for six boxes,
     and a link in the same email is the thing that makes an email scanner able to burn the code
     before the human types it. That was the wrong diagnosis here, but it is a real hazard and
     there is no reason to carry it. */
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { error: null };
    /* GoTrue's own sentence, never a friendly summary of it. Lee, on an earlier auth bug:
       "an error a customer cannot read is the same as no error at all." */
    const j = await res.json().catch(() => null as any);
    const message =
      j?.msg || j?.message || j?.error_description || j?.error ||
      `Sign-in service returned ${res.status}.`;
    return { error: { message: String(message) } };
  } catch (e: any) {
    return { error: { message: String(e?.message ?? e ?? "Network error") } };
  }
}
