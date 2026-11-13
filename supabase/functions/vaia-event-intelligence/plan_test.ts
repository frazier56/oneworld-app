// Proof for v19: free mode lifts the AI Rolodex Pro gate; paid/legacy plans keep working; failures never widen v18.
import { PRO_PLUS, rolodexPlan } from "./plan.ts";
const eq = (a: unknown, b: unknown, m: string) => { if (a !== b) throw new Error(`${m}: ${a} !== ${b}`); };
const legacy = (p: string) => async () => p;
Deno.test("free mode on: resolver says vip -> allowed", async () => {
  const plan = await rolodexPlan(async () => ({ data: "vip", error: null }), legacy("free"));
  eq(PRO_PLUS.includes(plan), true, "free-mode member allowed");
});
Deno.test("free mode off, free member -> still gated (the Pro message stays for plans-on)", async () => {
  const plan = await rolodexPlan(async () => ({ data: "free", error: null }), legacy("free"));
  eq(PRO_PLUS.includes(plan), false, "free member gated");
});
Deno.test("free mode off, paid pro via app_subscriptions -> allowed", async () => {
  eq(PRO_PLUS.includes(await rolodexPlan(async () => ({ data: "pro", error: null }), legacy("free"))), true, "pro");
});
Deno.test("resolver error -> falls back to the v18 profiles.plan read, never wider", async () => {
  eq(await rolodexPlan(async () => ({ data: null, error: { message: "x" } }), legacy("free")), "free", "error->legacy free");
  eq(await rolodexPlan(async () => { throw new Error("net"); }, legacy("VIP")), "vip", "throw->legacy vip");
});
