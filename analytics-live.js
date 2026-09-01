(() => {
  const root = document.documentElement;
  const mark = (state, status = "") => {
    root.dataset.owAnalytics = state;
    if (status) root.dataset.owAnalyticsStatus = status;
  };

  if (location.pathname.startsWith("/admin")) {
    mark("skipped-admin-route");
    return;
  }

  try {
    if (localStorage.getItem("ow_platform_admin_v1") === "true" || localStorage.getItem("onesocial_is_admin") === "true") {
      mark("skipped-admin-browser");
      return;
    }
  } catch {
    // Storage can be unavailable in hardened browsers; collection can still
    // continue without using persistent identifiers.
  }

  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) {
    mark("skipped-privacy-signal");
    return;
  }

  const endpoint = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/track-oneworld-event";
  const visitorKey = "ow_analytics_visitor_v1";
  const sessionKey = "ow_analytics_session_v1";
  const uuid = () => {
    try { return crypto.randomUUID(); }
    catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
  };
  const getId = (store, key) => {
    try {
      let value = store.getItem(key);
      if (value && value.length >= 16) return value;
      value = uuid();
      store.setItem(key, value);
      return value;
    } catch {
      return uuid();
    }
  };
  const safePath = (path) => (path || "/").split("/").map((segment) => {
    if (!segment) return segment;
    let value = segment;
    try { value = decodeURIComponent(segment); } catch {}
    if (/^\d+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) return ":id";
    if (value.includes("@")) return ":email";
    if (value.length >= 24 && /^[a-z0-9_-]+$/i.test(value)) return ":token";
    return value.slice(0, 80);
  }).join("/").slice(0, 300) || "/";
  const product = (path) => path.startsWith("/events") ? "oneevent"
    : path.startsWith("/jobs") ? "onejob"
    : path.startsWith("/rentals") || path.startsWith("/sale") ? "onehome"
    : path.startsWith("/social") ? "onesocial"
    : path.startsWith("/score") ? "onescore"
    : "oneworld";

  let last = "";
  const send = () => {
    if (location.pathname.startsWith("/admin")) return;
    const pagePath = safePath(location.pathname);
    const key = `${product(pagePath)}:${pagePath}`;
    if (key === last) return;
    last = key;
    let referrer = "";
    try {
      const url = new URL(document.referrer);
      referrer = url.origin === location.origin ? `${url.origin}${safePath(url.pathname)}` : url.origin;
    } catch {}

    mark("sending");
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_name: "page_view",
        event_category: "navigation",
        product: product(pagePath),
        page_path: pagePath,
        referrer,
        visitor_id: getId(localStorage, visitorKey),
        session_id: getId(sessionStorage, sessionKey),
        screen_width: screen.width || 0,
        screen_height: screen.height || 0,
        metadata: { collector_version: "20260901-parity2" },
      }),
      keepalive: true,
    }).then((response) => {
      mark(response.ok ? "active" : "error", String(response.status));
      if (!response.ok) console.warn(`[OneWorld analytics] Collector returned ${response.status}.`);
    }).catch(() => {
      mark("error", "network");
      console.warn("[OneWorld analytics] Collector request could not be completed.");
    });
  };

  const push = history.pushState;
  const replace = history.replaceState;
  history.pushState = function(...args) { push.apply(this, args); queueMicrotask(send); };
  history.replaceState = function(...args) { replace.apply(this, args); queueMicrotask(send); };
  addEventListener("popstate", send);
  addEventListener("pageshow", send);
  mark("ready");
  send();
})();
