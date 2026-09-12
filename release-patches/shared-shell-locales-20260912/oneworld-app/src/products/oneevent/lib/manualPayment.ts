const HOSTS: Record<"wise" | "paypal", ReadonlySet<string>> = {
  wise: new Set(["wise.com", "www.wise.com"]),
  paypal: new Set(["paypal.me", "www.paypal.me", "paypal.com", "www.paypal.com"]),
};

/** Convert a stored manual-payment handle into a safe, clickable provider URL. */
export function manualPaymentUrl(raw: unknown, rail: "wise" | "paypal"): string | null {
  const value = String(raw || "").trim().replace(/\s+/g, "");
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || !HOSTS[rail].has(host)) return null;
      return `https://${host}${parsed.pathname}${parsed.search}`;
    } catch {
      return null;
    }
  }

  let handle = value.replace(/^@/, "");
  for (const host of HOSTS[rail]) {
    if (handle.toLowerCase().startsWith(`${host}/`)) {
      handle = handle.slice(host.length + 1);
      break;
    }
  }
  if (rail === "wise") handle = handle.replace(/^pay\/me\//i, "");
  if (rail === "paypal") handle = handle.replace(/^paypalme\//i, "");
  if (!/^[A-Za-z0-9._-]{2,60}$/.test(handle)) return null;
  return rail === "wise"
    ? `https://wise.com/pay/me/${encodeURIComponent(handle)}`
    : `https://paypal.me/${encodeURIComponent(handle)}`;
}
