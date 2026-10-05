/**
 * Read the REAL error message out of a Supabase Edge Function failure.
 *
 * WHY THIS EXISTS (Lee, screenshot 2026-07-26): `supabase.functions.invoke` rejects on any non-2xx
 * with the useless string **"Edge Function returned a non-2xx status code"**. The actual reason —
 * "Payouts aren't switched on yet", "Your card was declined", "Missing required fields" — is in the
 * JSON body, which you only get by awaiting `error.context.json()`.
 *
 * Every call site was rolling its own handling and most just printed `error.message`, so users saw
 * raw plumbing on money screens. This is the ONE place that knows how to unwrap it. Use it for
 * every `functions.invoke` error — never print `error.message` directly.
 *
 *   const { data, error } = await supabase.functions.invoke("thing", { body });
 *   if (error) { setErr(await fnError(error, "Couldn't do the thing — try again.")); return; }
 */
export async function fnError(error: unknown, fallback: string): Promise<string> {
  if (!error) return fallback;
  // 1) The function's own JSON body is the most useful thing available.
  try {
    const body = await (error as any)?.context?.json?.();
    const msg = body?.error || body?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  } catch { /* not JSON, or already consumed */ }
  // 2) Some deployments return plain text.
  try {
    const text = await (error as any)?.context?.text?.();
    if (typeof text === "string" && text.trim() && text.length < 300 && !/^\s*</.test(text)) return text;
  } catch { /* ignore */ }
  // 3) Fall back to the SDK message — but never surface the meaningless one.
  const raw = (error as any)?.message;
  if (typeof raw === "string" && raw.trim() && !/non-2xx status code/i.test(raw)) return raw;
  return fallback;
}

/** Same idea for a thrown exception in a catch block. */
export function thrownError(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (raw && !/non-2xx status code/i.test(raw) && !/^\[object/.test(raw)) return raw;
  return fallback;
}
