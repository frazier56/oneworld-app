// vaia-event-intelligence v19 · the Pro gate decision, kept apart so it can be proven without a network.

/** Plans that unlock AI Rolodex search. "vip" is what one_world_plan() answers in free mode. */
export const PRO_PLUS = ["pro", "vip", "scout", "monster"];

/**
 * v19: the plan that gates Pro features, from the database's resolver (honours free mode).
 * `rpc` and `legacyPlan` are injected so the decision can be proven without a network.
 */
export async function rolodexPlan(
  rpc: () => Promise<{ data: unknown; error: unknown }>,
  legacyPlan: () => Promise<string>,
): Promise<string> {
  try {
    const { data, error } = await rpc();
    if (!error && typeof data === "string" && data) return data.toLowerCase();
  } catch { /* fall through to the v18 read */ }
  return (await legacyPlan()).toLowerCase();
}
