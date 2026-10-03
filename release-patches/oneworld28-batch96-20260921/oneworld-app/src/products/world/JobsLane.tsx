/* ⚠️ THE `error` FROM POSTGREST WAS BEING DROPPED ON EVERY LANE. — 22 Sep 2026
   `const { data } = await supabase.from(...)` resolves successfully when the request FAILED —
   RLS rejection, a 500, a dropped connection — with `data: null`. That became `[]`, which
   became `ready: true, total: 0`, which rendered "No events here yet. Be the first one here."
   The product told the member their world was empty because the query broke, and there was no
   state anywhere in the union that could ever say otherwise. Throwing lets `useAsyncResult`
   see it, and the feed now offers a retry. */
import { useMemo, useState } from "react";
import { supabase, useAsync, useAsyncResult, productHref, W, type MapPin } from "@oneworld/shell";
import type { LaneCard } from "./laneCard";

import { useTiers } from "./laneTiers";

/**
 * THE JOBS LANE — two kinds of thing in one lane.
 * ============================================================================================
 * Lee, 20 September 2026: the Jobs lane carries jobs AND people advertising themselves for hire.
 * They are different records with different buttons — **Apply** opens the job, **Hire** opens the
 * person — and they share one lane because a person looking for work wants both.
 *
 * ⚠️ JOBS HAVE NO MEDIA YET, AND THIS FILE DOES NOT PRETEND OTHERWISE. The media stack (photos,
 * videos, a chosen cover, a feed lead, the AI cover through the existing flyer studio) is the
 * NEXT batch: it needs columns on the job table, a guard trigger twin and a step in the create
 * form. A job with a `background_image_url` (the job's own photo) leads with it (30 Sep 2026);
 * one without is a DRAWN card in the lane's green with its title on it — never a blank screen.
 *
 * A person for hire already has a photograph: their profile photo. That is the fallback Lee
 * asked for and it works today, so it is wired today.
 */
type JobRow = {
  id: string; title: string; description: string | null; location: string | null;
  pay_type: string | null; pay_range: string | null; fixed_pay_amount: number | null;
  category: string | null; created_at: string | null; background_image_url: string | null;
};
type ProRow = {
  id: string; full_name: string; job_title: string | null; category: string | null;
  location: string | null; photo_url: string | null; score_v9_snapshot: number | null; bio: string | null;
};

/** "1,200 dollars" or the range the poster typed, or nothing. Never an invented number. */
function payLine(j: JobRow, lang: string) {
  if (j.fixed_pay_amount != null && j.fixed_pay_amount> 0) {
    return `$${j.fixed_pay_amount.toLocaleString(lang === "en" ? "en-US" : "es-CO")}`;
  }
  return (j.pay_range ?? "").trim() || null;
}

export type JobsKind = "jobs" | "people";

const PAGE = 24;
const NO_LEADS: Record<string, { kind: "photo" | "video"; url: string; poster: string | null }> = {};

/** `enabled` keeps this lane asleep until somebody swipes to it — see the note in EventsLane. */
export function useJobsLane(lang: string, query: string, enabled: boolean) {
  /* The classic Jobs screen puts these two behind a segmented control, so the feed does too —
     the same two sets, not a merged third thing whose ordering nobody could explain. */
  const [kind, setKind] = useState<JobsKind>("jobs");
  /* A page at a time, as the reader nears the end — see the note in HomesLane. */
  const [take, setTake] = useState(PAGE);

  const jobsQ = useAsyncResult(async () => {
    const { data, error } = await supabase.from("jobs")
      .select("id, title, description, location, pay_type, pay_range, fixed_pay_amount, category, created_at, latitude, longitude, background_image_url")
      .in("status", ["live", "published"]).is("direct_recipient_id", null)
      .order("created_at", { ascending: false }).limit(take);
    if (error) throw error;
    return (data ?? []) as JobRow[];
  }, [enabled, take], enabled);
  /* `jobs` keeps its old shape for every reader below; the failure rides alongside it. */
  const jobs = jobsQ.data;

  /* ⚠️ THE PEOPLE HALF MUST REPORT FAILURE TOO — see the same note in HomesLane. A `profiles`
     rejection with the jobs table healthy used to hang this whole lane in shimmer with no
     error and no working retry. */
  const prosQ = useAsyncResult(async () => {
    const { data, error } = await supabase.from("profiles")
      .select("id, full_name, job_title, category, location, photo_url, score_v9_snapshot, bio")
      .eq("onejob_discoverable", true)
      .order("score_v9_snapshot", { ascending: false, nullsFirst: false }).limit(take);
    if (error) throw error;
    return (data ?? []) as ProRow[];
  }, [enabled, take], enabled);
  const pros = prosQ.data;

  /* A PERSON FOR HIRE LEADS WITH THEIR OWN WORK (30 Sep 2026). Lee: *"realistic videos for
     people that are trying to put themselves out there for work."* Their newest visible post in
     `media_posts` — a video first, else a photo — and the profile photo only when they have
     posted nothing. One query for the whole page, public read. */
  const proIds = (pros ?? []).map(p => p.id);
  const leadQ = useAsync(async () => {
    if (!proIds.length) return {} as Record<string, { kind: "photo" | "video"; url: string; poster: string | null }>;
    const { data } = await supabase.from("media_posts")
      .select("user_id, media_type, media_url, thumbnail_url, created_at")
      .in("user_id", proIds).eq("moderation_status", "visible").not("media_url", "is", null)
      .order("created_at", { ascending: false }).limit(proIds.length * 4);
    const out: Record<string, { kind: "photo" | "video"; url: string; poster: string | null }> = {};
    for (const r of (data ?? []) as { user_id: string; media_type: string; media_url: string; thumbnail_url: string | null }[]) {
      if (!r.media_url || !/^(video|photo|image)$/i.test(r.media_type)) continue;   // text posts, or a row with no file
      const video = /^video$/i.test(r.media_type);
      const cur = out[r.user_id];
      if (!cur || (video && cur.kind === "photo"))
        out[r.user_id] = { kind: video ? "video" : "photo", url: r.media_url, poster: r.thumbnail_url };
    }
    return out;
  }, [proIds.join(","), enabled && kind === "people"], enabled && kind === "people");
  const leads = leadQ ?? NO_LEADS;

  /* R16 note 5 — badge tiers for the professionals on screen. The jobs half of this lane has
     no face on the card at all, so it asks for nothing. */
  const tiers = useTiers((pros ?? []).map(p => p.id), enabled && kind === "people");

  const needle = query.trim().toLowerCase();

  const cards: LaneCard[] = useMemo(() => {
    if (kind === "jobs") {
      return (jobs ?? [])
        .filter(j => !needle || [j.title, j.description, j.category, j.location]
          .some(v => (v ?? "").toLowerCase().includes(needle)))
        .map(j => ({
          id: j.id,
          /* The job's photo when it has one (30 Sep); a DRAWN card only when it has none. */
          media: j.background_image_url ? { kind: "photo" as const, url: j.background_image_url } : null,
          poster: j.background_image_url,
          who: null,
          title: j.title,
          price: payLine(j, lang),
          sub: [j.category, j.location].filter(Boolean).join(" · ") || null,
          cta: W(lang, "Apply", "Postularse"),
          href: productHref("onejob", `/j/${j.id}`),
          /* R18 note 1 — a job posting is savable, likable and shareable like anything else.
             `job` is a new value in the open `media_source` / `item_type` discriminators. */
          engagement: { source: "job" as const, savesAs: "job" as const },
        }));
    }
    return (pros ?? [])
      .filter(p => !needle || [p.full_name, p.job_title, p.category, p.bio, p.location]
        .some(v => (v ?? "").toLowerCase().includes(needle)))
      .map(p => ({
        id: p.id,
        /* The profile photo IS the cover for a person with no other media — Lee's fallback. */
        media: leads[p.id] ? { kind: leads[p.id].kind, url: leads[p.id].url }
          : p.photo_url ? { kind: "photo" as const, url: p.photo_url } : null,
        poster: leads[p.id]?.poster ?? p.photo_url,
        who: {
          name: p.full_name, photo: p.photo_url,
          score: typeof p.score_v9_snapshot === "number" ? p.score_v9_snapshot : null,
          tier: tiers[p.id] ?? null,
        },
        title: p.job_title || p.full_name,
        price: null,
        sub: [p.category, p.location].filter(Boolean).join(" · ") || null,
        cta: W(lang, "Hire", "Contratar"),
        href: productHref("onejob", `/p/${p.id}`),
        /* A person you want to hire later is exactly what a save is for. */
        engagement: { source: "profile" as const, savesAs: "profile" as const },
      }));
  }, [kind, jobs, pros, needle, lang, leads]);

  /* R22 — `MapPin`s for the shell's real map. `exact: false` for the same reason as Events:
     `jobs` carries no precision column, and a circle over a neighbourhood is honest where a pin
     on an unverified address is not. The people half has no pins at all — a professional is not
     at an address, they travel to one. */
  const pins: MapPin[] = useMemo(() => (kind === "jobs" ? (jobs ?? []) : [])
    .filter(j => typeof (j as any).latitude === "number" && typeof (j as any).longitude === "number")
    .map(j => ({
      id: j.id, lat: (j as any).latitude as number, lng: (j as any).longitude as number,
      exact: false,
      priceLabel: payLine(j, lang) ?? "",
      title: j.title,
      photo: null,
      facts: [j.category, j.location].filter(Boolean).join(" · ") || null,
      href: productHref("onejob", `/j/${j.id}`),
    })), [jobs, kind, lang]);

  return {
    pins,
    ready: jobs !== undefined && pros !== undefined,
    /* ⚠️ `failed` MEANS "NOTHING TO SHOW", NOT "SOMETHING WENT WRONG". — 22 Sep 2026
       `useAsyncResult` now keeps the last good page when a refresh fails, so an error can sit
       next to twelve perfectly good cards — which happens the moment a reader near the end of a
       lane asks for the next page on a flaky connection. Reading `failed` off the error alone
       replaced those twelve cards with the full-screen "That didn't load" panel and lost their
       position: the feed they were reading, destroyed by a page they had not reached.

       So the full-screen failure is for a lane that has nothing, and a page that fails while
       cards are on screen is `pageFailed` — a line in the footer and a retry on the next
       scroll, not a wipe. */
    failed: (!!jobsQ.error || !!prosQ.error) && cards.length === 0,
    pageFailed: (!!jobsQ.error || !!prosQ.error) && cards.length > 0,
    retry: () => { jobsQ.retry(); prosQ.retry(); },
    total: kind === "jobs" ? (jobs?.length ?? 0) : (pros?.length ?? 0),
    atEnd: (kind === "jobs" ? (jobs?.length ?? 0) : (pros?.length ?? 0)) < take,
    more: () => setTake(t => t + PAGE),
    resetKey: `${query}|${kind}`,
    cards, kind, setKind,
  };
}
