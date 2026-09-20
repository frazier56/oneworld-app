/**
 * PAY LINKS — the shared manual receiving rails (PayPal.me / Wise pay-me), owned by the shell.
 * ============================================================================================
 * Moved here from OneJob's Wallet on 11 Sep 2026 (OneHome 27, Batch 2) so OneHome, OneJob and
 * OneEvent parse a receiving link with ONE parser and ONE allow-list. `payment_methods.handle`
 * carries the same CHECK constraint on the table, so a link that this function returns is a link
 * the database will accept, and nothing else is.
 *
 * A pay link is "on file" — never "verified". Nobody has proven it works or that it belongs to the
 * person who typed it; the tenant or client sends money through the provider and the RECIPIENT
 * confirms receipt. That wording is a rule, not a style choice.
 */
export type PayLinkRail = "paypal" | "wise";
export const PAY_LINK_RAILS: readonly PayLinkRail[] = ["paypal", "wise"] as const;
export const isPayLinkRail = (v: unknown): v is PayLinkRail => v === "paypal" || v === "wise";
export const payLinkLabel = (rail: PayLinkRail): string => (rail === "paypal" ? "PayPal" : "Wise");

/**
 * Turn whatever the pro typed into a link that actually opens.
 *
 * People type "@johana", "paypal.me/johana", "https://paypal.me/johana" and "johana" — all four mean
 * the same thing and all four should work, because a pro who mistypes this doesn't get paid.
 *
 * NOTE the amount is deliberately NOT appended. The legacy paydirect path built
 * `paypal.me/<handle>/<price>USD`, which on a Colombian contract priced in COP asked the client to
 * send US DOLLARS — a 4,000x error, on the platform's own launch market.
 */
/**
 * EXACT hosts only. A suffix test (`/(^|\.)paypal\.(me|com)$/`) lets `evil.paypal.com` through, and
 * the old schemeless shortcut — `if (v.startsWith("paypal.me")) return "https://" + v` — didn't parse
 * at all, so `paypal.me@evil.com` was stored verbatim and the browser sent the client to evil.com
 * while the preview line read "Clients will be sent to https://paypal.me@evil.com". That is a
 * payment-phishing primitive, aimed at the person about to hand over money.
 */
const PAY_HOSTS: Record<"paypal" | "wise", string[]> = {
  paypal: ["paypal.me", "www.paypal.me", "paypal.com", "www.paypal.com"],
  wise: ["wise.com", "www.wise.com"],
};

export function normalizePayHandle(raw: string, type: "paypal" | "wise"): string | null {
  const v = raw.trim().replace(/\s+/g, "");
  if (!v) return null;

  // Everything goes through the SAME parser. A schemeless string is not a special case, it's a string
  // missing a scheme — and `new URL()` is the only thing that agrees with the browser about where
  // "paypal.me@evil.com" actually points.
  const candidate = /^https?:\/\//i.test(v) ? v : null;
  if (candidate) {
    let u: URL;
    try { u = new URL(candidate); } catch { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Userinfo is how `https://paypal.me@evil.com` disguises itself; a port is never legitimate here.
    if (u.username || u.password || u.port) return null;
    if (!PAY_HOSTS[type].includes(u.hostname.toLowerCase().replace(/\.$/, ""))) return null;
    // Re-serialise from parts rather than echoing what the user typed.
    return `https://${u.hostname.toLowerCase().replace(/\.$/, "")}${u.pathname}${u.search}`;
  }

  // No scheme: treat it as a bare handle, and build the URL ourselves. `paypal.me/johana` and
  // `wise.com/pay/me/johana` are handled by stripping the host prefix rather than trusting it.
  let handle = v.replace(/^@/, "");
  for (const h of PAY_HOSTS[type]) {
    const lower = handle.toLowerCase();
    if (lower.startsWith(h + "/")) { handle = handle.slice(h.length + 1); break; }
    if (lower === h) return null;
  }
  if (type === "wise") handle = handle.replace(/^pay\/me\//i, "");
  if (!/^[A-Za-z0-9._-]{2,60}$/.test(handle)) return null;
  return type === "paypal"
    ? `https://paypal.me/${encodeURIComponent(handle)}`
    : `https://wise.com/pay/me/${encodeURIComponent(handle)}`;
}
