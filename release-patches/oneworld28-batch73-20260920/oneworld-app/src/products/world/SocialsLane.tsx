import { useMemo, useState } from "react";
import { supabase, useAsync, productHref, W, type MapPin } from "@oneworld/shell";
import type { LaneCard } from "./laneCard";

import { useTiers } from "./laneTiers";

/**
 * THE SOCIALS LANE — OneSocial's own posts.
 * ============================================================================================
 * The same rows the OneSocial feed reads: visible posts, newest first, with the platform each
 * one came from. The platform pills below are built from what is actually in the feed, so a
 * filter never appears for a platform with nothing behind it — the classic feed's rule.
 *
 * ⚠️ THE BUTTON SAYS "VIEW PROFILE", NOT "FOLLOW", AND THAT IS DELIBERATE. The design called the
 * button Follow. There is no following anywhere in this codebase — no table, no function, no
 * screen — so a Follow button could only have opened the person's profile while claiming to have
 * done something. That is the control-that-half-works rule. It opens the profile and says so.
 * When OneSocial builds following, this label changes and the button does the real thing.
 */
type Post = {
  id: string; user_id: string; media_type: string | null; media_url: string | null;
  thumbnail_url: string | null; caption: string | null;
  likes_count: number | null; comments_count: number | null;
  created_at: string | null; source: string | null; source_platform: string | null;
};
type Author = { id: string; full_name: string; photo_url: string | null; job_title: string | null; score: number | null };

const PAGE = 24;

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook",
  x: "X", linkedin: "LinkedIn", onesocial: "OneSocial",
};

/** `enabled` keeps this lane asleep until somebody swipes to it — see the note in EventsLane. */
export function useSocialsLane(lang: string, query: string, enabled: boolean) {
  const [platforms, setPlatforms] = useState<string[]>([]);
  /* A page at a time, as the reader nears the end — see the note in HomesLane. */
  const [take, setTake] = useState(PAGE);

  const posts = useAsync(async () => {
    const { data } = await supabase.from("media_posts")
      .select("id, user_id, media_type, media_url, thumbnail_url, caption, likes_count, comments_count, created_at, source, source_platform")
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: false }).limit(take);
    return (data ?? []) as Post[];
  }, [enabled, take], enabled);

  const authors = useAsync(async () => {
    const ids = [...new Set((posts ?? []).map(p => p.user_id))];
    if (!ids.length) return {} as Record<string, Author>;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title, score_v9_snapshot").in("id", ids);
    return Object.fromEntries(((data ?? []) as any[]).map(a => [a.id, {
      id: a.id, full_name: a.full_name, photo_url: a.photo_url, job_title: a.job_title,
      score: typeof a.score_v9_snapshot === "number" ? a.score_v9_snapshot : null,
    } as Author]));
  }, [posts?.length], enabled && posts !== undefined);

  /* R16 note 5 — badge tiers for the authors on screen; the donut colours itself from them. */
  const tiers = useTiers(Object.keys(authors ?? {}), enabled);

  const platformOf = (p: Post) =>
    (p.source_platform ?? "").toLowerCase() || (p.source === "upload" || !p.source ? "onesocial" : p.source.toLowerCase());

  const present = useMemo(
    () => [...new Set((posts ?? []).map(platformOf))],
    [posts]);

  const needle = query.trim().toLowerCase();

  /* ── ONE CARD PER UPLOAD, NOT ONE PER PHOTO (R24) ──────────────────────────────────────
     Lee: *"if someone uploaded 10 pictures, you've got to scroll 10 times to get past that
     person, and you might not want to. At the master feed level it should be one picture, with
     a little icon at the top right like Instagram's that says there are multiple."*

     `media_posts` stores one ROW PER FILE, so a ten-photo upload was ten full-screen slides of
     one person. There is no batch column to group on, so the group is inferred the way the
     upload actually happens: same author, same caption, and created within two minutes of each
     other. A person posting two separate things two minutes apart with the identical caption is
     the only false positive available, and it collapses to one card rather than losing either.

     The NEWEST of a group is the card, so the feed's order does not change. */
  const GROUP_MS = 120_000;
  const grouped = useMemo(() => {
    const out: { head: Post; count: number }[] = [];
    for (const p of posts ?? []) {
      const last = out[out.length - 1];
      const sameBatch = last
        && last.head.user_id === p.user_id
        && (last.head.caption ?? "") === (p.caption ?? "")
        && Math.abs(Date.parse(last.head.created_at ?? "") - Date.parse(p.created_at ?? "")) <= GROUP_MS;
      if (sameBatch) last.count += 1;
      else out.push({ head: p, count: 1 });
    }
    return out;
  }, [posts]);

  const cards: LaneCard[] = useMemo(() => grouped.map(g => g.head)
    .filter(p => platforms.length === 0 || platforms.includes(platformOf(p)))
    .filter(p => {
      if (!needle) return true;
      const a = authors?.[p.user_id];
      return [p.caption, a?.full_name, a?.job_title].some(v => (v ?? "").toLowerCase().includes(needle));
    })
    .map(p => {
      const a = authors?.[p.user_id];
      const isVideo = (p.media_type ?? "").toUpperCase() === "VIDEO";
      return {
        id: p.id,
        media: p.media_url ? { kind: (isVideo ? "video" : "photo") as "video" | "photo", url: p.media_url } : null,
        poster: p.thumbnail_url,
        who: a ? { name: a.full_name, photo: a.photo_url, score: a.score, tier: tiers[a.id] ?? null } : null,
        /* A post's title IS its caption. A post with no caption gets the poster's line of work,
           because a card with no words at all is a card nobody can search for. */
        title: (p.caption ?? "").trim() || a?.job_title || W(lang, "A post", "Una publicación"),
        price: null,
        sub: [
          PLATFORM_LABEL[platformOf(p)] ?? platformOf(p),
          a?.job_title,
        ].filter(Boolean).join(" · ") || null,
        cta: W(lang, "View profile", "Ver perfil"),
        href: productHref("onesocial", `/p/${p.user_id}`),
        /* Posts DO have a real heart, comment count and share — the same `media_likes` and
           `media_shares` rows the classic feed writes. */
        /* R27 — a post is savable too, so the Socials rail carries the same six as the rest. */
        engagement: { source: "media_post" as const, savesAs: "media_post" as const },
        /* How many files this upload had. 1 draws nothing. */
        group: grouped.find(g => g.head.id === p.id)?.count ?? 1,
      };
    }), [grouped, authors, platforms, needle, lang, tiers]);

  return {
    /* R18 note 4 — a post has no place. The map control is still on this lane's rail, because
       Lee asked for the same five everywhere, and it opens a map that says so plainly rather
       than a control that is missing on one lane and present on three. */
    pins: [] as MapPin[],
    ready: posts !== undefined,
    total: posts?.length ?? 0,
    atEnd: (posts?.length ?? 0) < take,
    more: () => setTake(t => t + PAGE),
    resetKey: `${query}|${platforms.join(",")}`,
    cards,
    platforms, setPlatforms,
    platformPills: present.map(k => ({ key: k, label: PLATFORM_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1) })),
  };
}
