import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W } from "@oneworld/shell";

/**
 * OneSocial's profile SLOTS — the six tiles. No calendar (locked: Social has none).
 * Counts are facts about the person: they come from the database, never a device flag.
 *
 * ── REBUILT 8 OCTOBER 2026, ON LEE'S OWN READING OF THE SCREEN ─────────────────────────────
 *
 * It was four tiles: "My platforms", "Feed", "Connections", "Messages". All four were wrong.
 *
 *   **"Feed" was already dead.** Its `to` was the empty string, so the tile navigated to the
 *   product root — nowhere. It rendered as a real control on every OneSocial profile and did
 *   nothing. Lee reached the same conclusion from the outside: *"that feed is no longer a
 *   thing, it's at the bottom left footer."* It is now **Bio**, which answers his next line:
 *   *"where the hell is bio?"*
 *
 *   **"Messages" was spent too** — messages live in the footer. It is now **Websites**.
 *
 *   **"My platforms" drops the "my"** (all of them did) and stops opening a separate screen.
 *   Lee: *"my platforms is really connected apps — that should zoom down the page to that
 *   section."* It scrolls to the social media section, where the connected apps are the chips.
 *
 *   **Two tiles added, and each one deletes a section below it.** Reviews and Passport open as
 *   their own screens, so the page stops carrying a card for each: *"that would eliminate the
 *   passport section, because it would be in a square — you just click it to get to it."*
 *
 *   **The counts strip underneath is gone.** It printed Connections / Platforms / Reviews — the
 *   same three numbers now sitting on the tiles. Lee: *"below that you have this thing that says
 *   the same thing, which you could just eliminate."*
 *
 * Every tile carries its own number, because a tile that makes you tap to find out whether there
 * is anything behind it is a worse control than one that tells you.
 */

const jump = (id: string) => {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  /* No element means the section is not on this screen — do nothing rather than scroll the page
     to the top, which reads as the tile being broken. */
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

export function SocialTiles() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [sheet, setSheet] = useState<null | "bio" | "reviews">(null);

  const me = useAsync(async () => {
    const { data } = await supabase.from("profiles").select("bio").eq("id", userId!).maybeSingle();
    return (data as { bio: string | null } | null) ?? null;
  }, [userId], !!userId);

  const platforms = useAsync(async () => {
    const { count } = await supabase.from("social_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId!).eq("is_active", true);
    return count ?? 0;
  }, [userId], !!userId);

  const connections = useAsync(async () => {
    const { count } = await supabase.from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
    return count ?? 0;
  }, [userId], !!userId);

  const websites = useAsync(async () => {
    const { count } = await supabase.from("one_world_promo_links")
      .select("id", { count: "exact", head: true }).eq("user_id", userId!);
    return count ?? 0;
  }, [userId], !!userId);

  const reviews = useAsync(async () => {
    const { data } = await supabase.from("job_reviews")
      .select("rating, comment, created_at").eq("reviewee_id", userId!)
      .order("created_at", { ascending: false }).limit(50);
    const rows = (data ?? []) as { rating: number | null; comment: string | null; created_at: string }[];
    const rated = rows.filter(r => typeof r.rating === "number");
    const avg = rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : null;
    return { rows, n: rows.length, avg };
  }, [userId], !!userId);

  const n = (v: number | null | undefined) => v == null ? "—" : String(v);

  const T: { t: string; k: string; go: () => void }[] = [
    { t: W(lang, "Platforms", "Plataformas"), k: `${n(platforms)} ${W(lang, "connected", "conectadas")}`, go: () => jump("ow-social") },
    { t: W(lang, "Bio", "Biografía"), k: me?.bio ? W(lang, "Read it", "Léela") : W(lang, "Not written yet", "Sin escribir"), go: () => setSheet("bio") },
    { t: W(lang, "Websites", "Sitios web"), k: n(websites), go: () => jump("ow-websites") },
    { t: W(lang, "Connections", "Conexiones"), k: n(connections), go: () => {} },
    { t: W(lang, "Reviews", "Reseñas"), k: reviews?.n ? `${reviews.avg?.toFixed(1)} ★ · ${reviews.n}` : W(lang, "None yet", "Ninguna"), go: () => setSheet("reviews") },
    { t: W(lang, "Passport", "Pasaporte"), k: W(lang, "Open", "Abrir"), go: () => jump("ow-passport") },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {T.map((t, i) => i === 3 ? (
          <Link key={t.t} to={productHref("onesocial", "/people")}
            className="card p-3 text-left transition hover:bg-brand/5">
            <span className="block text-[13.5px] font-extrabold">{t.t}</span>
            <span className="mt-0.5 block text-[10.5px] font-semibold opacity-45">{t.k}</span>
          </Link>
        ) : (
          <button key={t.t} type="button" onClick={t.go}
            className="card p-3 text-left transition hover:bg-brand/5">
            <span className="block text-[13.5px] font-extrabold">{t.t}</span>
            <span className="mt-0.5 block text-[10.5px] font-semibold opacity-45">{t.k}</span>
          </button>
        ))}
      </div>

      {sheet && (
        <Sheet onClose={() => setSheet(null)}
          title={sheet === "bio" ? W(lang, "Bio", "Biografía") : W(lang, "Reviews", "Reseñas")}>
          {sheet === "bio" ? (
            me?.bio
              ? <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{me.bio}</p>
              : <p className="py-4 text-center text-[13px] opacity-55">
                  {W(lang, "Nothing written yet.", "Aún no has escrito nada.")}
                </p>
          ) : (
            <ReviewsBody lang={lang} data={reviews} />
          )}
        </Sheet>
      )}
    </>
  );
}

function ReviewsBody({ lang, data }: {
  lang: string;
  data: { rows: { rating: number | null; comment: string | null; created_at: string }[]; n: number; avg: number | null } | undefined;
}) {
  if (!data || data.n === 0) return (
    <p className="py-4 text-center text-[13px] opacity-55">{W(lang, "No reviews yet.", "Aún no hay reseñas.")}</p>
  );
  const five = data.rows.filter(r => (r.rating ?? 0) >= 5).length;
  const withWords = data.rows.filter(r => (r.comment ?? "").trim().length > 0).length;
  const K = [
    { v: data.avg ? data.avg.toFixed(1) : "—", l: W(lang, "Rating", "Nota") },
    { v: String(data.n), l: W(lang, "Reviews", "Reseñas") },
    { v: String(five), l: W(lang, "Five star", "Cinco estrellas") },
    { v: String(withWords), l: W(lang, "Written", "Escritas") },
  ];
  return (
    <>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {K.map(k => (
          <div key={k.l} className="rounded-xl border border-ink/8 bg-ink/[0.02] p-2 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-[15px] font-extrabold">{k.v}</p>
            <p className="text-[9.5px] opacity-50">{k.l}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {data.rows.filter(r => (r.comment ?? "").trim()).slice(0, 20).map((r, i) => (
          <div key={i} className="border-t border-ink/6 pt-2 dark:border-white/8">
            <p className="text-[11px] font-bold opacity-55">{"★".repeat(Math.max(0, Math.min(5, r.rating ?? 0)))}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed">{r.comment}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/** A sheet over the page, not a route — the person keeps their place on the profile. */
function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" onClick={onClose}
        className="absolute inset-0 bg-ink/55 dark:bg-black/65" />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="ow-scroll absolute inset-x-0 bottom-0 mx-auto max-h-[86vh] w-full max-w-[520px] overflow-auto rounded-t-3xl border border-ink/10 bg-paper p-4 pb-7 dark:border-white/12 dark:bg-ink">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-ink/15 dark:bg-white/20" />
        <h3 className="mb-2.5 text-[15px] font-extrabold">{title}</h3>
        {children}
        <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">
          {W("en", "Close", "Cerrar")}
        </button>
      </div>
    </div>
  );
}
