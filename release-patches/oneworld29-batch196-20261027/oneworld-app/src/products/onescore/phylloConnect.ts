import { supabase } from "@oneworld/shell";

/**
 * ONE-TAP CONNECT THROUGH PHYLLO (24 Oct 2026)
 * ============================================================================================
 * Lee: "you click it and you connect, we route it to Phyllo, you put your authentication in, and
 * it brings the information back and it lands in your media." No codes, no handles to type.
 *
 * 1. The server (`phyllo-connect`, action `token`) finds or creates this member's Phyllo user and
 *    returns a short-lived SDK token plus the list of platforms Phyllo has switched on.
 * 2. Phyllo's own Connect window opens on the platform the member tapped; they sign in THERE.
 * 3. On `accountConnected` the server (action `sync`) checks the account belongs to this member,
 *    writes the connection with the strong proof, and pulls recent posts into their media.
 * Secrets never reach the browser — only the SDK token does.
 */
const SDK_URL = "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js";

type TokenReply = {
  sdk_token: string; phyllo_user_id: string; environment: string; user_name: string;
  platforms?: Record<string, string>;
};
export type ConnectResult =
  | { ok: true; platform: string; postsAdded: number }
  | { ok: false; reason: "cancelled" | "unsupported" | "failed" | "signin" };

let cachedPlatforms: Record<string, string> | null = null;
let sdkLoading: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if ((window as any).PhylloConnect) return Promise.resolve();
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { sdkLoading = null; reject(new Error("sdk")); };
    document.head.appendChild(s);
  });
  return sdkLoading;
}

const KEY: Record<string, string> = { twitter: "x", "x (twitter)": "x" };
const norm = (k: string) => { const l = k.toLowerCase().trim(); return KEY[l] ?? l; };

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke("phyllo-connect", { body: { action, ...extra } });
  if (error) return null;
  return data as T;
}

/** Is this platform one Phyllo can connect with a tap? Known after the first token call. */
export function phylloSupports(platform: string): boolean | null {
  if (!cachedPlatforms) return null;
  return !!cachedPlatforms[norm(platform)];
}

/** Warm the platform list so tiles know whether to offer the one-tap button. */
export async function primePhylloPlatforms(): Promise<Record<string, string> | null> {
  if (cachedPlatforms) return cachedPlatforms;
  const r = await call<{ platforms?: Record<string, string> }>("platforms");
  if (r?.platforms) cachedPlatforms = r.platforms;
  return cachedPlatforms;
}

export async function connectWithPhyllo(platform: string, lang: string): Promise<ConnectResult> {
  const t = await call<TokenReply>("token");
  if (!t?.sdk_token) return { ok: false, reason: "failed" };
  if (t.platforms) cachedPlatforms = t.platforms;
  const workPlatformId = t.platforms?.[norm(platform)];
  if (!workPlatformId) return { ok: false, reason: "unsupported" };
  try { await loadSdk(); } catch { return { ok: false, reason: "failed" }; }

  return new Promise<ConnectResult>((resolve) => {
    let settled = false;
    const done = (r: ConnectResult) => { if (!settled) { settled = true; resolve(r); } };
    const PC = (window as any).PhylloConnect;
    const pc = PC.initialize({
      clientDisplayName: "One World",
      environment: t.environment,
      userId: t.phyllo_user_id,
      token: t.sdk_token,
      workPlatformId,
      language: lang && lang.startsWith("e") && lang !== "en" ? "es" : (lang === "co" ? "es" : "en"),
    });
    pc.on("accountConnected", async (accountId: string) => {
      const s = await call<{ connected?: string; posts_added?: number; error?: string }>("sync", { account_id: accountId });
      if (s?.connected) done({ ok: true, platform: s.connected, postsAdded: s.posts_added ?? 0 });
      else done({ ok: false, reason: "failed" });
    });
    pc.on("accountDisconnected", () => { /* nothing to do here */ });
    pc.on("tokenExpired", () => done({ ok: false, reason: "failed" }));
    pc.on("connectionFailure", () => done({ ok: false, reason: "failed" }));
    pc.on("exit", () => done({ ok: false, reason: "cancelled" }));
    pc.open();
  });
}
