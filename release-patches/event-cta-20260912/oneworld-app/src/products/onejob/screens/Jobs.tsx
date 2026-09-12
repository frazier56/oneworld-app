import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n } from "@job/lib/i18n";
import { GlassSelect } from "@job/components/Pickers";
import CityInput from "@job/components/CityInput";
import Coachmark from "@job/components/Coachmark";
import Avatar from "@job/components/Avatar";
import ScoreDonut from "@job/components/ScoreDonut";

import SegTabs from "@job/components/SegTabs";
import SearchBar from "@job/components/SearchBar";
import { ScreenHeading, W } from "@oneworld/shell";
import InfoTip from "@job/components/InfoTip";
import MyJobs from "./MyJobs";

/** Every hire row is exactly this tall, and the photo is exactly this wide. One number,
 *  so the photo can never be smaller than the panel beside it and no row can outgrow its
 *  neighbours. (Lee, 2 Aug 2026 — "keep it the same vertical size".) */
const ROW_H = 96;
import type { BadgeTier } from "@job/lib/badgeTiers";
import { IconSparkle, IconPin, IconCalendar } from "@job/components/ActionIcons";

type Sort = "newest" | "oldest" | "pay" | "near";
type Tab = "find" | "pros" | "me";

export default function Jobs() {
  const { t, lang } = useI18n();
  const { profile, refreshProfile } = useAuth();
  const [sp, setSp] = useSearchParams();
  // E-lite (Lee, Jul 16): Hire pros first + default; 3rd tab = My jobs home.
  const tab = (sp.get("tab") as Tab) || "pros";
  const setTab = (k: Tab) => setSp(k === "pros" ? {} : { tab: k }, { replace: true });
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const myCity = (profile?.location || "").split(",")[0].trim();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs", q, loc, sort, myCity],
    enabled: tab === "find",
    queryFn: async () => {
      let query = supabase.from("jobs")
        .select("id, title, description, location, pay_type, pay_range, fixed_pay_amount, category, created_at, start_date")
        .in("status", ["live", "published"]).is("direct_recipient_id", null).limit(50);
      if (q.trim()) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
      const effLoc = sort === "near" && myCity ? myCity : loc.split(",")[0].trim();
      if (effLoc) query = query.ilike("location", `%${effLoc}%`);
      if (sort === "oldest") query = query.order("created_at", { ascending: true });
      else if (sort === "pay") query = query.order("fixed_pay_amount", { ascending: false, nullsFirst: false });
      else query = query.order("created_at", { ascending: false });
      const { data } = await query;
      return data ?? [];
    },
  });

  const { data: pros, isLoading: prosLoading } = useQuery({
    queryKey: ["pros", q, loc],
    enabled: tab === "pros",
    queryFn: async () => {
      let query = supabase.from("profiles")
        .select("id, full_name, job_title, category, location, photo_url, score_v9_snapshot, bio")
        .eq("onejob_discoverable", true).limit(30)
        .order("score_v9_snapshot", { ascending: false, nullsFirst: false });
      if (q.trim()) query = query.or(`full_name.ilike.%${q}%,job_title.ilike.%${q}%,category.ilike.%${q}%,bio.ilike.%${q}%`);
      const effLoc = loc.split(",")[0].trim();
      if (effLoc) query = query.ilike("location", `%${effLoc}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  // Real badge tier per pro drives the OneScore donut color (member/verified/
  // trusted/authority). Uses the same compute_badge_tier RPC as the passport.
  const proIds = (pros ?? []).map(p => p.id);
  const { data: tierMap } = useQuery({
    queryKey: ["pro-tiers", proIds.join(",")],
    enabled: proIds.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(proIds.map(async (id) => {
        const { data } = await supabase.rpc("compute_badge_tier", { p_user_id: id });
        return [id, (typeof data === "string" ? data : "member")] as const;
      }));
      return Object.fromEntries(entries) as Record<string, BadgeTier>;
    },
  });

  const togglePublic = async () => {
    if (!profile) return;
    if (!profile.onejob_discoverable && !profile.job_title?.trim()) {
      setProfileError(W(lang,
        "Add what you do before you list yourself as a professional.",
        "Agrega a qué te dedicas antes de aparecer como profesional."));
      return;
    }
    setProfileError(null);
    setSaving(true);
    await supabase.from("profiles").update({ onejob_discoverable: !profile.onejob_discoverable }).eq("id", profile.id);
    await refreshProfile(); setSaving(false);
  };

  return (
    <div className="space-y-3">
      {/* No heading existed here at all, so the shell rendered a bare VAIA row above the
          segmented control. Title left, VAIA right, one row — same as every other screen. */}
      <ScreenHeading>{W(lang, "My jobs", "Mis trabajos")}</ScreenHeading>
      {/* Same sliding control as One-time / Recurring on the contract form. These three tabs are
          the most-tapped segmented control in the app and had their own look; now there's one.
          (Lee, Jul 31 2026) */}
      <SegTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "pros", label: t("findPros") },
          { value: "find", label: t("findWork") },
          { value: "me", label: t("myJobs") },
        ]}
      />

      {/* ── Get discovered ─────────────────────────────────────────────────────────────
          Moved from Find work to HIRE (Lee, Jul 31 2026): "that toggle really needs to be in the
          hire section, because that's what it's referring to."

          It reads better here than the logic first suggests. The instinct is that a worker toggles
          this, and workers live on Find work — but the toggle's whole subject is THIS list. Seeing
          it while looking at the directory you'd appear in turns it into "I could be in here too",
          which is a far stronger prompt than an abstract switch on a different tab.

          Copy cut to two words. "Get discovered — show me in Hire Pros" wrapped to two lines on
          Lee's phone, and the explanation earns its place in an info tip instead of the row. */}
      {tab === "pros" && (
        <div>
          <div className="flex items-center justify-between gap-3 rounded-full border border-ink/10 bg-ink/[0.02] px-4 py-2 dark:border-white/10 dark:bg-white/[0.03]">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <IconSparkle size={15} className="text-teal" /> Get discovered
              <InfoTip text="Turn this on to appear in this Hire list when people search for someone to hire. Your profile, OneScore and location become visible to them. Off by default." />
            </span>
            <button onClick={togglePublic} disabled={saving} aria-pressed={!!profile?.onejob_discoverable}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${profile?.onejob_discoverable ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
              <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${profile?.onejob_discoverable ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>
          {profileError && <p className="mt-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
            {profileError} <Link to="/jobs/profile" className="underline">{W(lang, "Complete my OneJob profile", "Completar mi perfil de OneJob")}</Link>
          </p>}
        </div>
      )}

      {tab !== "me" && (
        <SearchBar
          value={q} onChange={setQ}
          placeholder={tab === "pros" ? t("searchPros") : t("search")}
          /* Location takes the paired slot on both tabs — filtering beats sorting for the prominent
             position, and it means Hire and Find work open identically. */
          primary={
            <CityInput
              value={loc}
              onChange={v => { setLoc(v); if (sort === "near") setSort("newest"); }}
              placeholder={t("locFilter")}
              className="input w-full !py-2.5 text-sm"
            />
          }
          /* Only Find work has a third control, so only Find work gets a second row. */
          secondary={tab === "find" ? (
            <GlassSelect
              value={sort} onChange={v => setSort(v as Sort)}
              className="w-full !py-2.5 text-sm"
              options={[
                { value: "newest", label: t("sortNewest") },
                { value: "oldest", label: t("sortOldest") },
                { value: "pay", label: t("sortPay") },
              ]}
            />
          ) : undefined}
        />
      )}

      {tab === "find" && (isLoading ? <div className="py-10 text-center opacity-50">…</div> :
        !jobs?.length ? <p className="py-10 text-center opacity-50">{t("noJobs")}</p> : (
          <div className="space-y-3">
            {jobs.map(j => (
              <Link to={`/jobs/j/${j.id}`} key={j.id} className="card block p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{j.title}</h3>
                  <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
                    {j.fixed_pay_amount ? `$${j.fixed_pay_amount}` : j.pay_range || "$—"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs opacity-50">
                  {j.location && <><IconPin size={12} className="mr-0.5 inline-block align-[-1px]" />{j.location}</>}
                  {j.location && j.start_date ? " · " : ""}
                  {j.start_date && <><IconCalendar size={12} className="mr-0.5 inline-block align-[-1px]" />{new Date(j.start_date).toLocaleDateString()}</>}
                </p>
                {j.description && <p className="mt-2 text-sm opacity-70 line-clamp-3">{j.description}</p>}
                <span className="mt-2 inline-block text-sm font-semibold text-brand">{t("apply")} →</span>
              </Link>
            ))}
          </div>
        ))}

      {tab === "pros" && (prosLoading ? <div className="py-10 text-center opacity-50">…</div> :
        !pros?.length ? <p className="py-10 text-center opacity-50">{t("noPros")}</p> : (
          <div className="space-y-3">
            <Coachmark id="pros-score" textKey="tipProsScore" />
            {pros.map(p => (
              /**
               * TWO sections, not three (Lee, Jul 31 2026 — restoring what's live).
               *
               * This card had drifted into three competing blocks: the avatar, an inner panel, and
               * the score donut floating outside it. The score is the whole reason this directory
               * exists, so it belongs INSIDE the panel with the person it describes, not orbiting
               * the card. Two blocks: who they are, and everything you know about them.
               *
               * The Connect pill is gone. It was doing real damage in a narrow column — it pushed
               * the panel's width down far enough that "Lifestyle Photographer" truncated to
               * "Lifestyle Photo…", so the card hid the one fact a person is scanning this list
               * for. Connect still lives on the profile, one tap away, which is the right place to
               * decide to connect with someone anyway.
               *
               * `break-words` rather than `truncate` on the role for the same reason: a job title
               * that wraps to two lines is readable; one that ends in an ellipsis is not.
               */
              /* ── ONE surface per person ──
                 Lee, 1 Aug 2026, on the white windows in this list: *"do we really need these
                 nested windows? They would basically look like they are floating."*

                 The inner tinted panel is gone. It was a box inside a box — the card already says
                 "this is one person", and the panel drew a second edge around most of the same
                 content while leaving the avatar outside it, which split each row into two blocks
                 that had to be read separately.

                 The CARD stays rather than the panel, deliberately. This is the buying screen, the
                 one place someone compares strangers before spending money: the card edge is what
                 says the whole row is tappable, and it now wraps the avatar too, so the person and
                 their score read as a single object. (Fully boxless versions are in
                 onejob-hire-list-options.html if that's the direction.) */
              /* TWO FLOATING WINDOWS PER ROW — Lee, 2 Aug 2026, with a marked-up screenshot:
                 the photo gets its own window, everything else gets a second one beside it,
                 and the photo is bigger and the same height as the panel next to it.

                 This reverses the previous pass, which had merged them into one card. The
                 earlier note argued a single card says "this is one person" — but on the
                 screen where someone compares strangers before spending money, the face is
                 what they scan first, and giving it its own frame is what makes it scannable.
                 `items-stretch` is what equalises the two heights; the avatar then fills its
                 window rather than floating in the middle of it. */
              /* ROW_H is the single number that keeps this list straight. The photo and the
                 panel both take it, so they cannot drift apart, and no row can grow to fit
                 its own text. See the HIRE ROWS block in index.css for why each rule is here. */
              <Link to={`/jobs/p/${p.id}`} key={p.id} className="flex gap-2.5" style={{ height: ROW_H }}>
                {/* The photo, on its own. No pane behind it — it IS the object. */}
                <Avatar src={p.photo_url} name={p.full_name} size={ROW_H}
                        rounded="rounded-3xl oj-photo" textSize="text-3xl" />
                <div className="card oj-card-warm oj-row flex min-w-0 flex-1 items-center gap-2 overflow-hidden !rounded-3xl px-3.5">
                  <div className="min-w-0 flex-1">
                    {/* One line each, faded — never wrapped. A row that wraps is a row that
                        grows, and then the list is ragged. */}
                    <h3 className="oj-fade font-bold leading-tight">{p.full_name}</h3>
                    <p className="oj-fade text-sm font-semibold leading-snug text-brand">{p.job_title || p.category}</p>
                    {p.location && <p className="oj-fade text-xs opacity-50">{p.location}</p>}
                  </div>
                  {p.score_v9_snapshot != null ? (
                    <ScoreDonut score={p.score_v9_snapshot} size={56} tier={(tierMap?.[p.id] as BadgeTier) || undefined} />
                  ) : (
                    <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold opacity-50 dark:bg-white/10">New</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ))}

      {tab === "me" && (
        <div className="space-y-3">
          <MyJobs embedded />
        </div>
      )}
    </div>
  );
}
