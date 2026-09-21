import { useMemo, useState } from "react";
import { supabase, useAsync, productHref, W } from "@oneworld/shell";
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
 * form. Until then a job is a DRAWN card in the lane's green with its title on it — never a
 * blank screen and never a stock photograph standing in for one.
 *
 * A person for hire already has a photograph: their profile photo. That is the fallback Lee
 * asked for and it works today, so it is wired today.
 */
type JobRow = {
  id: string; title: string; description: string | null; location: string | null;
  pay_type: string | null; pay_range: string | null; fixed_pay_amount: number | null;
  category: string | null; created_at: string | null;
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

/** `enabled` keeps this lane asleep until somebody swipes to it — see the note in EventsLane. */
export function useJobsLane(lang: string, query: string, enabled: boolean) {
  /* The classic Jobs screen puts these two behind a segmented control, so the feed does too —
     the same two sets, not a merged third thing whose ordering nobody could explain. */
  const [kind, setKind] = useState<JobsKind>("jobs");
  /* A page at a time, as the reader nears the end — see the note in HomesLane. */
  const [take, setTake] = useState(PAGE);

  const jobs = useAsync(async () => {
    const { data } = await supabase.from("jobs")
      .select("id, title, description, location, pay_type, pay_range, fixed_pay_amount, category, created_at")
      .in("status", ["live", "published"]).is("direct_recipient_id", null)
      .order("created_at", { ascending: false }).limit(take);
    return (data ?? []) as JobRow[];
  }, [enabled, take], enabled);

  const pros = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("id, full_name, job_title, category, location, photo_url, score_v9_snapshot, bio")
      .eq("onejob_discoverable", true)
      .order("score_v9_snapshot", { ascending: false, nullsFirst: false }).limit(take);
    return (data ?? []) as ProRow[];
  }, [enabled, take], enabled);

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
          media: null,                       // drawn card — see the note at the top of this file
          poster: null,
          who: null,
          title: j.title,
          price: payLine(j, lang),
          sub: [j.category, j.location].filter(Boolean).join(" · ") || null,
          cta: W(lang, "Apply", "Postularse"),
          href: productHref("onejob", `/j/${j.id}`),
          engagement: null,
        }));
    }
    return (pros ?? [])
      .filter(p => !needle || [p.full_name, p.job_title, p.category, p.bio, p.location]
        .some(v => (v ?? "").toLowerCase().includes(needle)))
      .map(p => ({
        id: p.id,
        /* The profile photo IS the cover for a person with no other media — Lee's fallback. */
        media: p.photo_url ? { kind: "photo" as const, url: p.photo_url } : null,
        poster: p.photo_url,
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
        engagement: null,
      }));
  }, [kind, jobs, pros, needle, lang]);

  return {
    ready: jobs !== undefined && pros !== undefined,
    total: kind === "jobs" ? (jobs?.length ?? 0) : (pros?.length ?? 0),
    atEnd: (kind === "jobs" ? (jobs?.length ?? 0) : (pros?.length ?? 0)) < take,
    more: () => setTake(t => t + PAGE),
    resetKey: `${query}|${kind}`,
    cards, kind, setKind,
  };
}
