import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase, useOneId, W, Wt, useAccountGate, useResumeIntent, resumeHref } from "@oneworld/shell";

/* ============================================================================================
 * FOLLOW AN AGENT — on the public profile, above their homes.
 *
 * Lee, 2 Oct 2026: "Follow, I guess, makes more sense" for agents (Connect stays the word for
 * people). Following means: tell me when this agent posts a new home — a bell notification, and a
 * text if I turned texts on (Settings → Text messages → "New homes from agents I follow").
 * The notifying is done by the database when a listing is first published; this only reads and
 * writes the follow.
 * ==========================================================================================*/
export default function FollowAgent({ agentId, name, lang }: { agentId: string; name?: string | null; lang: string }) {
  const { userId } = useOneId();
  const here = useLocation().pathname;
  const { ask, gate } = useAccountGate();
  const [st, setSt] = useState<{ following: boolean; followers: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [who, setWho] = useState<string | null>(name ?? null);

  useEffect(() => {
    let live = true;
    void supabase.rpc("agent_follow_state", { p_agent: agentId }).then(({ data }) => { if (live && data) setSt(data as any); });
    if (!name) void supabase.from("profiles").select("full_name").eq("id", agentId).maybeSingle()
      .then(({ data }) => { if (live && data?.full_name) setWho(data.full_name); });
    return () => { live = false; };
  }, [agentId, userId]);

  /* Back from sign-up (look but don't touch): follow, never un-follow. */
  useResumeIntent(`follow:${agentId}`, () => { if (st && !st.following) void toggle(); }, !!st && !!userId);
  if (!st || userId === agentId) return null;
  const first = (who ?? "").trim().split(/\s+/)[0] || W(lang, "this agent", "este agente");

  async function toggle() {
    if (!userId) { ask(resumeHref(here, `follow:${agentId}`)); return; }
    if (!st) return;
    setBusy(true); setErr(false);
    const res = st.following
      ? await supabase.from("agent_follows").delete().eq("follower_id", userId).eq("agent_id", agentId)
      : await supabase.from("agent_follows").insert({ follower_id: userId, agent_id: agentId });
    setBusy(false);
    if (res.error && res.error.code !== "23505") { setErr(true); return; }
    setSt({ following: !st.following, followers: Math.max(0, st.followers + (st.following ? -1 : 1)) });
  }

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      {gate}
      <p className="min-w-0 text-[12px] leading-snug opacity-65">
        {st.following
          ? Wt(lang, "You'll hear when {0} posts a new home.", "Le avisaremos cuando {0} publique un inmueble nuevo.", [first])
          : Wt(lang, "Get an alert when {0} posts a new home.", "Reciba un aviso cuando {0} publique un inmueble nuevo.", [first])}
        {st.followers > 0 && <span className="block text-[11px] opacity-80">
          {Wt(lang, "{0} following", "{0} siguiendo", [st.followers])}</span>}
        {err && <span role="alert" className="block font-semibold text-red-600 dark:text-red-400">
          {W(lang, "That didn't save. Try again.", "No se guardó. Intente de nuevo.")}</span>}
      </p>
      <button type="button" disabled={busy} onClick={() => void toggle()} aria-pressed={st.following}
        className={`${st.following ? "btn-ghost" : "btn-primary"} shrink-0 whitespace-nowrap px-4 text-[13px] disabled:opacity-50`}>
        {st.following ? W(lang, "Following", "Siguiendo") : W(lang, "Follow", "Seguir")}
      </button>
    </div>
  );
}
