/**
 * Shim: the ported OneJob screens' client IS the shell's — ONE client, ONE session, eight
 * products. OneJob's own `createClient` is deleted, not re-pointed: a second client would mean a
 * second session and a second sign-in, which is the exact failure the single-origin shell exists
 * to delete.
 *
 * FEE_RATE is re-exported for the same reason. The fee is 5.99% and it lives in exactly one
 * place (`@oneworld/shell` → `lib/supabase.ts`), mirroring the database's `platform_fee_rate()`.
 * Nothing under this folder may type a fee literal.
 */
export { supabase, FEE_RATE, FEE_PCT } from "@oneworld/shell";
