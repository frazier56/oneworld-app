import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar, ScoreDonut, useI18n, useAsync, supabase, productHref, W, IconSearch, ScreenHeading,
} from "@oneworld/shell";
import type { RentalAgent } from "../lib/rental";

/**
 * /rentals/agents — TAB 2. Search the people who list.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"Second button is searching agents, and it's gonna show agent got five
 * listings, three active listings… it's gonna show their score. It's gonna show their OneScore.
 * Basically, how many active listings. And then the person can click on that person and go
 * straight to their listings."*
 *
 * That is exactly this screen, and the counts come from ONE server-side function
 * (`rental_agents`) rather than N queries — a directory that fires a query per row is a
 * directory that gets slower every week it succeeds.
 *
 * `rental_agents` counts PUBLIC listings only, so an agent cannot inflate their number with
 * private drafts. That is a small thing that decides whether the number means anything.
 */
export default function Agents() {
  const { lang } = useI18n();
  const [q, setQ] = useState("");

  const agents = useAsync(async () => {
    const { data, error } = await supabase.rpc("rental_agents", { q: q.trim() || null, lim: 60 });
    /* Show the server's own sentence rather than an empty list — OneSocial's Messages screen
       said "No conversations yet" over 475 real conversations for weeks, because a failed read
       and an empty result looked identical. Not repeating that. */
    if (error) throw new Error(error.message);
    return (data ?? []) as RentalAgent[];
  }, [q]);

  return (
    <div className="space-y-4">
      {/* This tab had NO heading at all, so the shell fell back to a standalone VAIA row above an
          unlabelled search box — Lee, 10 Aug: *"sometimes they're just not present."* */}
      <ScreenHeading>{W(lang, "Agents", "Agentes")}</ScreenHeading>
      <label className="relative block">
        <span className="sr-only">{W(lang, "Search agents", "Buscar agentes")}</span>
        {/* Absolutely positioned inside the field. The first pass pulled the icon up with a
            negative margin and left a stray glyph floating above the box — visible in the very
            first UAT screenshot, which is the entire reason the screenshots exist. */}
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-45">
          <IconSearch size={16} />
        </span>
        <input
          className="input w-full pl-10"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={W(lang, "Search by name…", "Buscar por nombre…")}
          autoComplete="off"
        />
      </label>

      <p className="mt-3 text-[12px] leading-relaxed opacity-55">
        {W(lang,
          "Every agent here carries a OneScore built from work they have actually completed — across renting, jobs and events. It is the part a WhatsApp group cannot give you.",
          "Cada agente aquí tiene un OneScore construido con trabajo realmente completado — en arriendos, trabajos y eventos. Es lo que un grupo de WhatsApp no le puede dar.")}
      </p>

      <div className="mt-4 space-y-2">
        {agents === undefined ? (
          [0, 1, 2, 3].map(i => <div key={i} className="card ow-shimmer h-[74px]" />)
        ) : agents.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-bold">
              {q ? W(lang, "Nobody by that name yet.", "Nadie con ese nombre todavía.")
                 : W(lang, "No agents listing yet.", "Aún no hay agentes publicando.")}
            </p>
            <p className="mt-1 text-[12.5px] opacity-55">
              {W(lang, "An agent appears here as soon as they publish their first place.",
                       "Un agente aparece aquí en cuanto publica su primer inmueble.")}
            </p>
          </div>
        ) : (
          agents.map(a => (
            <Link
              key={a.agent_id}
              to={productHref("onerental", `/p/${a.agent_id}`)}
              className="card ow-tap flex items-center gap-3 p-3"
            >
              <Avatar src={a.photo_url} name={a.full_name} size={44} rounded="rounded-full" textSize="text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-bold">
                  {a.full_name ?? W(lang, "Member", "Miembro")}
                </p>
                <p className="text-[12.5px] opacity-60">
                  {/* ACTIVE first, because it is the number that tells you whether talking to
                      this person can get you a place this month. Total is context. */}
                  <span className="font-bold opacity-100">
                    {W(lang, `${a.active_listings} active`, `${a.active_listings} activos`)}
                  </span>
                  {" · "}
                  {W(lang, `${a.total_listings} in total`, `${a.total_listings} en total`)}
                </p>
              </div>
              <ScoreDonut score={a.score == null ? null : Number(a.score)} size={44} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
