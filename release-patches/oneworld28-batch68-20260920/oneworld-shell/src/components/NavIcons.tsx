/**
 * THE NAVIGATION ICON SET — one registry, eight products.
 * ============================================================================================
 * `AppConfig` names an icon by string ("home", "calendar", "tickets"). This is where that string
 * becomes a shape. An app may not pass a component: if it could, the icons would drift, and
 * "the apps feel slightly different and nobody can say why" is exactly that drift.
 *
 * Adding an icon is a change to THIS file, reviewed once, and every product gets it.
 *
 * All paths are 24×24, stroke-only, `currentColor`. Stroke-only matters: a filled icon needs a
 * second colour decision per theme, and eight products making that decision independently is
 * how a family stops looking like one.
 */

export const NAV_ICONS: Record<string, string> = {
  /* ── Shared across every product ─────────────────────────────────────────────────────── */
  home:      "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z",
  messages:  "M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-4.2a8.38 8.38 0 0 1-1-4.3 8.5 8.5 0 1 1 17 0z",
  profile:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  settings:  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  calendar:  "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  plans:     "M2 8h20M2 12h20M6 16h4M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z",
  signin:    "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  signout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  search:    "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  bell:      "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  help:      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17.5h.01",

  /* ── OneJob ──────────────────────────────────────────────────────────────────────────── */
  jobs:      "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z",
  qr:        "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z",
  money:     "M8 6h8l1.8 2.2a6.5 6.5 0 0 1 1.4 4.05V15a5 5 0 0 1-5 5H9.8a5 5 0 0 1-5-5v-2.75A6.5 6.5 0 0 1 6.2 8.2zM9 6c0-1.2.6-3 3-3s3 1.8 3 3M12 11v4",

  /* ── OneEvent ────────────────────────────────────────────────────────────────────────── */
  tickets:   "M3 9.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2.5 2.5 0 0 0 0 5 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2.5 2.5 0 0 0 0-5zM14 7.5v9",
  discover:  "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm4.2-14.2-2.4 6-6 2.4 2.4-6z",

  /* ── OneRental ───────────────────────────────────────────────────────────────────────────
     `property` is the raised centre — listing a place. A BUILDING, not the `home` house: `home`
     already means "the first tab" in every product, and reusing it would make the footer say
     Home twice. `keys` is the tenant-side counterpart. */
  property:  "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01M9 13.5h.01M15 13.5h.01",
  keys:      "M15.5 3a5.5 5.5 0 1 0-4.6 8.5L4 18.4V21h2.6l1.4-1.4v-1.8h1.8l1.4-1.4v-1.8h1.8l.4-.4A5.5 5.5 0 0 0 15.5 3zM16.8 7.2h.01",

  /* ── OneSocial ───────────────────────────────────────────────────────────────────────── */
  feed:      "M4 5h16M4 12h16M4 19h10",
  compose:   "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 6.5 17.5 9.5",
  people:    "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",

  /* ── OneScore ────────────────────────────────────────────────────────────────────────── */
  score:     "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 12l4.5-4.5",
  connect:   "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  simulator: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  passport:  "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 16h6",

  /* ── OneAgent ────────────────────────────────────────────────────────────────────────── */
  agent:     "M12 3v3M8.5 6h7a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM9.5 11.5h.01M14.5 11.5h.01M9.5 15h5",
  deals:     "M20.5 12.5 12.5 20.5a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1-.5-1.9l1.4-5.3a2 2 0 0 1 1.4-1.4l5.3-1.4a2 2 0 0 1 1.9.5l6.2 6.2a2 2 0 0 1 0 2.8zM8.5 8.5h.01",

  /* ── The services ────────────────────────────────────────────────────────────────────── */
  calls:     "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.1z",
  minutes:   "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6.5V12l3.5 2",
  site:      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2.5 12h19M12 2.5a15 15 0 0 1 0 19 15 15 0 0 1 0-19z",
  device:    "M7.5 2h9a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM10.5 18.5h3",
  billing:   "M2 9h20M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM6 14h4",
};

/**
 * One icon. `size` is the only thing a caller may vary — weight, cap and join are fixed so a
 * OneJob icon and a OneVoice icon are visibly the same pen.
 */
export function NavIcon({
  name, size = 18, className = "",
}: { name: string; size?: number; className?: string }) {
  const d = NAV_ICONS[name];
  if (!d) {
    /* Loud in development, silent in production: a missing icon is a config typo, and a blank
       square in the tab bar is the kind of thing that ships. */
    if (import.meta.env?.DEV) console.warn(`[oneworld-shell] unknown icon "${name}"`);
    return null;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} aria-hidden>
      <path d={d} />
    </svg>
  );
}
