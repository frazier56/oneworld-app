import { setAppLink, type AppLinks } from "./appLinks";

/**
 * WHAT THE PUBLIC SEES ON YOUR PROFILE — one source of truth for four switches.
 * ============================================================================================
 * The SWITCH (profile) and the GATE (public profile) must call ONE predicate, or they drift: an
 * earlier version had the switch render OFF for a new user (`!!links.onescore`) while the gate
 * rendered VISIBLE (`links.onescore !== false`), so "Show my score: off" sat next to a score that
 * was public the whole time. These keys mean exactly one thing — is this section visible to
 * strangers — and default to VISIBLE (`!== false`, never `=== true`): someone who never opened the
 * list expects their public page to match the page they are standing on.
 *
 * Order is Lee's: score, world, passport, events — the order the sections appear on the profile.
 */
export const PUBLIC_SECTIONS = [
  { key: "show_score",    labelKey: "showScoreLbl"    as const, emoji: "🔥" },
  { key: "show_world",    labelKey: "showWorldLbl"    as const, emoji: "🌐" },
  { key: "show_passport", labelKey: "showPassportLbl" as const, emoji: "🛂" },
  { key: "show_events",   labelKey: "showEventsLbl"   as const, emoji: "🎟️" },
] as const;

export type SectionKey = (typeof PUBLIC_SECTIONS)[number]["key"];

/** The ONLY predicate. Both the switch and the public gate call this, so they cannot drift. */
export function isSectionPublic(
  links: Record<string, boolean | null | undefined> | undefined,
  key: SectionKey,
): boolean {
  return links?.[key] !== false;
}

/** Flip one section. Thin wrapper so call sites never hand-roll the key string. */
export function setSectionPublic(userId: string, key: SectionKey, on: boolean) {
  return setAppLink(userId, key, on);
}

export type { AppLinks };
