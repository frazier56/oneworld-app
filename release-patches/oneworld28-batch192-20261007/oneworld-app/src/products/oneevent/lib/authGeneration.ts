import { supabase } from "@oneworld/shell";

/**
 * AUTH GENERATION — E6-SESSION-GENERATION (ONEEVENT 31, 20 Oct 2026, Max P1 follow-up).
 * ============================================================================================
 * The first E6 fix asked "is the same user still signed in, and is the screen still mounted?"
 * Max showed that is not enough: A → B → A inside one React batch, or A signing out and back in,
 * ends with the same user id on a hub that never unmounted — so a save A started BEFORE those
 * transitions still ran its dependent write and jumped to the event page.
 *
 * So every save now carries a GENERATION, and the generation changes on every real identity
 * transition, counted straight off the auth client's own event stream (synchronously, one event
 * at a time — React batching cannot merge two transitions into "nothing happened"):
 *   · SIGNED_OUT always advances it;
 *   · any event whose user differs from the last one seen advances it (A → B, B → A);
 *   · a repeat of the same user (token refresh, USER_UPDATED, a re-emitted SIGNED_IN on tab focus)
 *     does not — so a normal save is never cancelled by housekeeping.
 * Module level, subscribed once at import, so it is live before any screen can start a save.
 * Kept in the product, not the shell, until ONE WORLD decides whether the shell's AuthGate epoch
 * should be exported for every app (asked in the E6 note).
 */
let generation = 0;
let lastUserId: string | null | undefined; // undefined = no event seen yet

supabase.auth.onAuthStateChange((event, session) => {
  const uid = session?.user?.id ?? null;
  if (event === "SIGNED_OUT" || (lastUserId !== undefined && uid !== lastUserId)) generation += 1;
  lastUserId = uid;
});

/** Take at the START of an operation. */
export const captureAuthGeneration = (): number => generation;
/** Ask after EVERY await, before any dependent write, state change, toast or navigation. */
export const isAuthGenerationCurrent = (g: number): boolean => g === generation;
