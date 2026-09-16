import { useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { useAsync } from "../../lib/useAsync";
import { useOneId } from "../../lib/oneId";
import type { AppKey } from "../../lib/oneWorld";
import ReputationPassport from "./ReputationPassport";
import { IconPassport } from "../ActionIcons";
import Chevron from "../Chevron";

/**
 * THE PASSPORT STRIP — the collapsible summary on the profile, opening the full passport.
 * ============================================================================================
 * Metrics are written INLINE (no bordered pills inside a bordered card — Lee, 1 Aug: "you could
 * just put the information directly on the screen"). "View full passport →" opens the modal, which
 * renders the shared ReputationPassport. Everything here is shell: the same object on every app.
 */
export interface PassportStripProps {
  product: AppKey;
  worldHref: string;
  userId: string;
  score: number | null;
  name?: string | null;
  photo?: string | null;
  title?: string | null;
  bio?: string | null;
  location?: string | null;
  /** Someone else's profile — show the passport only, never the owner's roadmap or checklist. */
  publicView?: boolean;
}

export default function PassportStrip({
  product, worldHref, userId, score, name, photo, title, bio, location, publicView = false,
}: PassportStripProps) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const [open, setOpen] = useState(true);   // expanded by default
  const [modal, setModal] = useState(false);
  const { userId: myId, email: myEmail } = useOneId();

  const own = !publicView && !!myId && myId === userId;

  /* Identity = a confirmed email on the auth record; payment = a usable money rail either
     direction. Both are the two real verification signals — owner-only. */
  const verified = useAsync(async () => {
    const [payout, method] = await Promise.all([
      supabase.functions.invoke("stripe-connect-status").catch(() => ({ data: null })),
      supabase.from("payment_methods").select("id").eq("user_id", userId).limit(1),
    ]);
    const d = (payout as { data?: Record<string, unknown> }).data;
    const canGetPaid = !!(d?.payouts_enabled ?? d?.charges_enabled ?? d?.details_submitted);
    return { hasPayout: canGetPaid || !!method.data?.length };
  }, [userId], own);

  /* Identity signal available at the shell level: an email on the One ID account. (The raw
     email_confirmed_at timestamp is not surfaced by useOneId; the account carrying an email is the
     signal we hold here.) */
  const emailConfirmed = own && !!myEmail;

  const s = useAsync(async () => {
    const [done, hired, revs, conns, medias] = await Promise.all([
      supabase.from("job_executions").select("id", { count: "exact", head: true }).eq("talent_id", userId).eq("status", "completed"),
      supabase.from("job_executions").select("id", { count: "exact", head: true }).eq("host_id", userId).eq("status", "completed"),
      supabase.from("job_reviews").select("rating").eq("reviewee_id", userId),
      supabase.from("social_connections_public").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
      supabase.from("media_posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const ratings = (revs.data ?? []).map(r => r.rating);
    const avgRaw = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const avg5 = ratings.length ? (avgRaw / 7 * 5).toFixed(1) : null;
    void hired;
    return { jobs: done.count ?? 0, reviews: ratings.length, avg: avg5, avgRaw, platforms: conns.count ?? 0, media: medias.count ?? 0 };
  }, [userId], !!userId);

  const Chip = ({ v, l }: { v: string | number; l: string }) => (
    <div className="min-w-0 text-center">
      <p className="text-lg font-extrabold leading-none text-brand">{v}</p>
      <p className="mt-1 w-full break-words text-[9px] uppercase leading-tight tracking-wide opacity-50">{l}</p>
    </div>
  );

  const completionPct = Math.min(100, Math.round(
    (((photo ? 1 : 0) + (title ? 1 : 0) + ((bio?.length ?? 0) >= 50 ? 1 : 0) + (location ? 1 : 0)) / 4) * 100));

  return (
    <div className="ow-passport overflow-hidden">
      {/* ── ICON, NOT 🛂, AND A REAL 44px HEADER ROW (11 Aug 2026) ──────────────────────────
          The emoji rendered at a different size on every platform beside a 14px label, and the
          ▾ was an 8px-wide character standing in for the only control that opens this card.
          Both are drawn now; the whole row is the tap target, which is what people aim at
          anyway. */}
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="ow-tap flex min-h-[44px] w-full items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-bold">
          <IconPassport size={16} className="shrink-0 opacity-70" />
          {isEs ? "Pasaporte" : "Passport"}
        </span>
        <Chevron size="sm" open={open} className="text-brand" />
      </button>
      {open && (
        <div className="border-t border-ink/5 p-3 dark:border-white/10">
          <div className="grid grid-cols-4 gap-3 px-1 py-1">
            <Chip v={s?.jobs ?? "—"} l={isEs ? "Trabajos" : "Jobs"} />
            <Chip v={s?.avg ?? "—"} l={isEs ? "Nota" : "Rating"} />
            <Chip v={s?.platforms ?? "—"} l={isEs ? "Apps" : "Apps"} />
            <Chip v={score != null ? Math.round(score) : "—"} l="OneScore" />
          </div>
          <button onClick={() => setModal(true)} className="ow-tap mt-2 block min-h-[44px] w-full text-center text-sm font-semibold text-brand">{isEs ? "Ver pasaporte completo" : "View full passport"} →</button>
        </div>
      )}
      {modal && createPortal(
        <div className="fixed inset-0 z-[90] overflow-y-auto ow-create-page">
          <div className="sticky top-0 z-10 border-b border-white/40 dark:border-white/10"
            style={{ background: "var(--glass-fill)", backdropFilter: "var(--frost-nav)",
                     WebkitBackdropFilter: "var(--frost-nav)", boxShadow: "var(--frostedge)" }}>
            <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
              {/* A real BACK control, not just an X — Lee, Aug 2026: "if you click on the passport,
                  you can go back." A glass pill with a chevron + label, matching the app's back
                  control, so closing the full passport returns you to the profile it opened from. */}
              <button onClick={() => setModal(false)} aria-label={isEs ? "Volver" : "Back"}
                className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 py-1.5 pl-2 pr-3.5 text-sm font-semibold shadow-sm backdrop-blur transition active:scale-95 hover:bg-brand/10 dark:border-white/15 dark:bg-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                {isEs ? "Volver" : "Back"}
              </button>
              <p className="flex flex-1 items-center justify-center gap-1.5 text-center font-extrabold">
                <IconPassport size={16} className="shrink-0 opacity-70" />{isEs ? "Pasaporte" : "Passport"}
              </p>
              <button onClick={() => setModal(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/25 text-xl dark:border-white/15" aria-label={isEs ? "Cerrar" : "Close"}>×</button>
            </div>
          </div>
          <div className="mx-auto max-w-lg px-4 py-4 pb-16">
            <ReputationPassport
              product={product}
              worldHref={worldHref}
              profile={{
                full_name: name ?? "", email: emailConfirmed ? (myEmail ?? "") : "",
                bio: bio ?? null, photo_url: photo ?? null, location: location ?? null,
                industry: null, category: null, subcategory: null, custom_expertise: null,
                job_title: title ?? null, phone: null,
              }}
              userId={userId} oneScore={score ?? 0} publicView={publicView}
              hasPayout={!!verified?.hasPayout}
              completionPct={completionPct}
              checklist={[]}
              completedJobs={s?.jobs ?? 0} reviewCount={s?.reviews ?? 0} avgRating={s?.avgRaw ?? 0}
              socialAppsConnected={s?.platforms ?? 0} photoCount={s?.media ?? 0}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
