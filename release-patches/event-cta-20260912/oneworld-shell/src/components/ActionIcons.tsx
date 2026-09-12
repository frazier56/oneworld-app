/**
 * Flat line icons for the composer and the profile section headers.
 *
 * These replace emoji that were doing real interface work — 🎬 📷 ✍️ 🔴 and friends.
 * Emoji were the wrong tool here for three measured reasons:
 *   1. They render from the operating system's font, so the same button is a
 *      different shape and weight on iPhone, Android and Windows.
 *   2. Several read badly on the dark theme — the Reputation Passport glyph is a
 *      blue-and-white block sitting on near-black.
 *   3. They overflow their own line box (the theme toggle was clipping by 4px on
 *      every screen), because an emoji's glyph box is not a text box.
 *
 * All of these inherit `currentColor` and scale cleanly, so one icon works in both
 * themes at any size, and they match the drawn icons the One World hub already uses.
 */
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type P = { size?: number; className?: string };
const wrap = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    {children}
  </svg>
);

export const IconVideo = ({ size = 18, className }: P) =>
  wrap(size, className, <><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 10.5 6-3.2v9.4l-6-3.2z" /></>);

export const IconPhoto = ({ size = 18, className }: P) =>
  wrap(size, className, <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><circle cx="8.5" cy="10.5" r="1.8" /><path d="m3 16.5 5-4.2 4.5 3.8 3-2.4 5.5 4.3" /></>);

export const IconWrite = ({ size = 18, className }: P) =>
  wrap(size, className, <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M14.5 6.5 17.5 9.5" /></>);

export const IconLive = ({ size = 18, className }: P) =>
  wrap(size, className, <><circle cx="12" cy="12" r="3.2" /><path d="M6.5 6.5a7.8 7.8 0 0 0 0 11M17.5 17.5a7.8 7.8 0 0 0 0-11" /></>);

export const IconBriefcase = ({ size = 18, className }: P) =>
  wrap(size, className, <><rect x="2.5" y="7" width="19" height="12.5" rx="2.5" /><path d="M8.5 7V5.6A1.6 1.6 0 0 1 10.1 4h3.8a1.6 1.6 0 0 1 1.6 1.6V7" /><path d="M2.5 12.5h19" /></>);

export const IconStar = ({ size = 18, className }: P) =>
  wrap(size, className, <path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.95 6.75 19.7l1-5.85L3.5 9.75l5.9-.85z" />);

export const IconPassport = ({ size = 18, className }: P) =>
  wrap(size, className, <><rect x="4.5" y="2.8" width="15" height="18.4" rx="2.4" /><circle cx="12" cy="9.6" r="2.9" /><path d="M8.6 17.2h6.8" /></>);

export const IconPin = ({ size = 18, className }: P) =>
  wrap(size, className, <><path d="M12 21.2s6.6-6.1 6.6-10.6a6.6 6.6 0 1 0-13.2 0C5.4 15.1 12 21.2 12 21.2z" /><circle cx="12" cy="10.4" r="2.5" /></>);

export const IconPlus = ({ size = 18, className }: P) =>
  wrap(size, className, <path d="M12 5v14M5 12h14" />);
export const IconSearch = ({ size = 18, className }: P) =>
  wrap(size, className, <><circle cx="10.8" cy="10.8" r="6.6" /><path d="m15.6 15.6 4.4 4.4" /></>);

/* ── Second wave, 2 Aug 2026 ──────────────────────────────────────────────────
   Lee's P1: "emoji are doing real work in the interface — not decoration, they're
   the actual icons." These cover the rest of the sweep: the Hire screen, the feed,
   the home tiles, the location lines and the default avatar. Same rules as above —
   currentColor, 24x24, 1.9 stroke — so they drop in anywhere the emoji was.        */

export const IconSparkle = ({ size = 18, className }: P) =>
  wrap(size, className, <><path d="M12 3.2 13.7 8l4.8 1.7-4.8 1.7L12 16.2l-1.7-4.8L5.5 9.7 10.3 8z" /><path d="M18.5 15.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" /></>);

export const IconBulb = ({ size = 18, className }: P) =>
  wrap(size, className, <><path d="M9.2 17.2a6.2 6.2 0 1 1 5.6 0" /><path d="M9.6 17.4h4.8M10.3 20.4h3.4" /></>);

export const IconToolbox = ({ size = 18, className }: P) =>
  wrap(size, className, <><rect x="2.5" y="7.5" width="19" height="12" rx="2.4" /><path d="M8.4 7.5V6a1.6 1.6 0 0 1 1.6-1.6h4a1.6 1.6 0 0 1 1.6 1.6v1.5" /><path d="M2.5 12.6h19M10 11.4h4v2.4h-4z" /></>);

export const IconCash = ({ size = 18, className }: P) =>
  wrap(size, className, <><rect x="2.5" y="6" width="19" height="12" rx="2.4" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.6v4.8M18 9.6v4.8" /></>);

export const IconCalendar = ({ size = 18, className }: P) =>
  wrap(size, className, <><rect x="3" y="5" width="18" height="16" rx="2.4" /><path d="M8 2.8v4.4M16 2.8v4.4M3 10h18" /></>);

export const IconCheck = ({ size = 18, className }: P) =>
  wrap(size, className, <><circle cx="12" cy="12" r="9" /><path d="m8.2 12.3 2.6 2.6 5-5.4" /></>);

export const IconUser = ({ size = 18, className }: P) =>
  wrap(size, className, <><circle cx="12" cy="8.2" r="3.9" /><path d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0" /></>);

export const IconCamera = ({ size = 18, className }: P) =>
  wrap(size, className, <><path d="M3.6 7.8h3.1l1.5-2.2h7.6l1.5 2.2h3.1a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 17.4v-8a1.6 1.6 0 0 1 1.6-1.6z" /><circle cx="12" cy="13.2" r="3.4" /></>);

export const IconPlay = ({ size = 18, className }: P) =>
  wrap(size, className, <path d="M8.4 5.6 18.2 12l-9.8 6.4z" />);

/* ── Platform marks ───────────────────────────────────────────────────────────
   These replaced 📸 🎵 📘 ▶️ 💼, which were standing in for Instagram, TikTok,
   Facebook, YouTube and LinkedIn. Those are not stand-ins, they are wrong objects:
   a camera is not Instagram's mark, a musical note is not TikTok's, and a blue book
   is not Facebook's. On a credibility product, the row that says "this person's
   accounts are verified" is exactly the row that has to look like it knows what
   those accounts are.

   Drawn in the same line language as the rest of the set so a platform row reads as
   one family rather than a pasted-in brand kit, and so they inherit currentColor and
   work on both themes. */
const PLATFORM: Record<string, React.ReactNode> = {
  instagram: <><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" /><circle cx="12" cy="12" r="4.1" /><circle cx="17.1" cy="6.9" r=".9" fill="currentColor" /></>,
  tiktok:    <><path d="M14.2 3.4v10.9a3.7 3.7 0 1 1-3-3.63" /><path d="M14.2 3.4a5.2 5.2 0 0 0 5.1 4.3" /></>,
  facebook:  <><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" /><path d="M15.2 8.1h-1.5a1.6 1.6 0 0 0-1.6 1.6v11M10 12.6h4.6" /></>,
  youtube:   <><rect x="2.4" y="5.6" width="19.2" height="12.8" rx="4" /><path d="M10.4 9.4 15.6 12l-5.2 2.6z" /></>,
  linkedin:  <><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4" /><path d="M7.6 10.4v6.2M7.6 7.6v.1M11.6 16.6v-6.2M11.6 12.9a2.4 2.4 0 0 1 4.8 0v3.7" /></>,
  x:         <><path d="M4.4 4.4 19.6 19.6M19.6 4.4 4.4 19.6" /></>,
  twitter:   <><path d="M4.4 4.4 19.6 19.6M19.6 4.4 4.4 19.6" /></>,
  website:   <><circle cx="12" cy="12" r="8.8" /><path d="M3.4 12h17.2M12 3.2a13.6 13.6 0 0 1 0 17.6 13.6 13.6 0 0 1 0-17.6" /></>,
};

/** A platform's mark by key. Unknown keys fall back to a globe rather than to nothing,
 *  so a newly-supported platform never renders as an empty box. */
export const IconPlatform = ({ name, size = 18, className }: P & { name: string }) =>
  wrap(size, className, PLATFORM[name?.toLowerCase()] ?? PLATFORM.website);

export const IconUsers = ({ size = 18, className }: P) =>
  wrap(size, className, <><circle cx="9.4" cy="8.4" r="3.5" /><path d="M3 19.4a6.6 6.6 0 0 1 12.8 0" /><path d="M16.2 5.4a3.5 3.5 0 0 1 0 6.6M17.6 14.2a6.6 6.6 0 0 1 3.4 5.2" /></>);

export const IconFlame = ({ size = 18, className }: P) =>
  wrap(size, className, <><path d="M12 2.8c3.4 3.1 5.6 5.9 5.6 9.2a5.6 5.6 0 1 1-11.2 0c0-1.7.7-3.3 2-4.9.5 1.3 1.3 2 2.3 2.2-.4-2.4.1-4.5 1.3-6.5z" /></>);

export const IconChat = ({ size = 18, className }: P) =>
  wrap(size, className, <path d="M21 11.6a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-4.2A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.4z" />);

/* ── THREE ICONS THAT REPLACED EMOJI ON THE PROFILE ACTIONS ROW (11 Aug 2026) ─────────────────
   Lee: *"at the bottom where it says view public view, the text is all jumbled up and garbled up."*
   The row was `👁️ View public`, `🔗 Share`, `⚙️ Settings`. `👁️` is U+1F441 followed by a
   variation selector, and Windows plus several Android builds render that as the glyph and then a
   visible tofu box — which is literally the garbling he is describing. Emoji are also a different
   SIZE per platform, so the row's baseline moved device to device.

   His own rule, from OneJob on 2 Aug: *"an emoji is a different shape on every device."* These are
   stroked SVGs at the same weight as every other icon in this file. */
export const IconEye = ({ size = 18, className }: P) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>;

export const IconShare = ({ size = 18, className }: P) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>;

export const IconGear = ({ size = 18, className }: P) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>;

/* ── TWO MORE, 11 Aug 2026 — the "On my public profile" switch rows ───────────────────────────
   Those four rows were `🔥 My score`, `🌐 My World`, `🛂 My passport`, `🎟️ My events`, and Lee
   photographed them on an Android phone where they render at four different optical sizes with
   the labels no longer sharing a baseline. 🎟️ carries a variation selector, the same construction
   that produced the tofu box on the actions row. Flame, passport and pin already existed here;
   these two are what was missing to finish the row off. */
export const IconGlobe = ({ size = 18, className }: P) =>
  wrap(size, className, <><circle cx="12" cy="12" r="8.8" /><path d="M3.2 12h17.6" /><path d="M12 3.2c2.2 2.4 3.4 5.4 3.4 8.8S14.2 18.4 12 20.8c-2.2-2.4-3.4-5.4-3.4-8.8S9.8 5.6 12 3.2z" /></>);

export const IconTicket = ({ size = 18, className }: P) =>
  wrap(size, className, <><path d="M3 8.4V6.6A1.6 1.6 0 0 1 4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v1.8a3.6 3.6 0 0 0 0 7.2v1.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4v-1.8a3.6 3.6 0 0 0 0-7.2z" /><path d="M14 5v14" /></>);
