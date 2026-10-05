/** Links are built on the app's own origin (app.oneworldlabs.ai) under the /events/* map.
 *  The old onesocial.ai short domain is gone — one origin, one address. */
const ORIGIN = () => (typeof window !== "undefined" ? window.location.origin : "https://app.oneworldlabs.ai");

function uuidToBase64Url(uuid: string) {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(hex)) return uuid.trim();

  let binary = "";
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function eventCodeToUuid(code: string) {
  const normalized = code.trim();
  if (/^[a-f0-9-]{36}$/i.test(normalized)) return normalized;
  if (!/^[A-Za-z0-9_-]{22}$/.test(normalized)) return normalized;

  try {
    const padded = normalized.replace(/-/g, "+").replace(/_/g, "/").padEnd(24, "=");
    const binary = atob(padded);
    const hex = Array.from(binary, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    if (!/^[a-f0-9]{32}$/.test(hex)) return normalized;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return normalized;
  }
}

export function buildCleanEventLink(eventId: string) {
  /* /events/e/:id — EventDetail decodes base64url codes via eventCodeToUuid, so the compact
     form stays scannable on printed flyers while resolving on the new route. */
  return `${ORIGIN()}/events/e/${uuidToBase64Url(eventId)}`;
}

export function buildTrackedEventLink(eventId: string, src: string) {
  return `${buildCleanEventLink(eventId)}?src=${src}`;
}

export function normalizeEventSlugInput(slug: string) {
  return slug.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function buildEventVanityLink(slug: string, src?: string) {
  /* NOTE for the integrator: no slug route is mounted under /events yet
     (pages/EventSlugRedirect.tsx exists but routes.tsx is fixed). Until it is, vanity
     links resolve nowhere — the clean /events/e/:id link is used as the primary. */
  const cleanSlug = normalizeEventSlugInput(slug);
  const base = `${ORIGIN()}/events/${encodeURIComponent(cleanSlug)}`;
  return src ? `${base}?src=${encodeURIComponent(src)}` : base;
}