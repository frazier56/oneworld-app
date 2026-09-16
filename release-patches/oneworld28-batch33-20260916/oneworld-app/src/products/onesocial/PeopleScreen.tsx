import { ScreenHeading } from "@oneworld/shell";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar, useI18n, useOneId, useAsync, supabase, productHref, W, IconSearch,
} from "@oneworld/shell";

/**
 * /social/people — TAB 2: the people directory, and where connections start.
 * ============================================================================================
 * Real members from the shared `profiles` (named columns — the table is column-granted), with
 * live connection state from `user_connections`. Connect writes a real request row; the state
 * chip re-reads what the database says, never a local flag — CONNECTED is a fact about people,
 * and facts about people come from the database.
 */
type Person = {
  id: string; full_name: string | null; photo_url: string | null; job_title: string | null;
  industry: string | null; location: string | null; score_v9_snapshot: number | null;
};
type Conn = { requester_id: string; recipient_id: string; status: string };

export default function PeopleScreen() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [q, setQ] = useState("");
  const [bump, setBump] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const people = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title, industry, location, score_v9_snapshot")
      .eq("is_public", true).limit(200);
    return ((data ?? []) as Person[]).filter(p => p.id !== userId);
  }, [userId]);

  const conns = useAsync(async () => {
    const { data } = await supabase.from("user_connections")
      .select("requester_id, recipient_id, status")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
    return (data ?? []) as Conn[];
  }, [userId, bump], !!userId);

  const stateFor = (id: string): "none" | "pending" | "accepted" => {
    const c = (conns ?? []).find(c2 =>
      (c2.requester_id === id && c2.recipient_id === userId) ||
      (c2.recipient_id === id && c2.requester_id === userId));
    return c ? (c.status === "accepted" ? "accepted" : "pending") : "none";
  };

  const connect = async (id: string) => {
    if (!userId || busy) return;
    setBusy(id); setFailed(null);
    /* Never trust a write you have not read back — insert, then re-select. */
    const { error } = await supabase.from("user_connections")
      .insert({ requester_id: userId, recipient_id: id, status: "pending" });
    if (error) { setFailed(id); setBusy(null); return; }
    const { data: check } = await supabase.from("user_connections")
      .select("id").eq("requester_id", userId).eq("recipient_id", id).limit(1);
    if (!check?.length) setFailed(id);
    setBusy(null); setBump(b => b + 1);
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (people ?? []).filter(p => !needle
      || (p.full_name ?? "").toLowerCase().includes(needle)
      || (p.job_title ?? "").toLowerCase().includes(needle)
      || (p.industry ?? "").toLowerCase().includes(needle)
      || (p.location ?? "").toLowerCase().includes(needle));
  }, [people, q]);

  return (
    <div className="space-y-3">
      <ScreenHeading>{W(lang, "People", "Personas")}</ScreenHeading>

      <label className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-white/70 px-3 py-2.5 dark:border-white/15 dark:bg-white/10">
        <IconSearch size={18} className="opacity-50" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder={W(lang, "Name, role, industry, city", "Nombre, rol, industria, ciudad")}
          className="w-full bg-transparent text-sm outline-none placeholder:opacity-50" />
      </label>

      {people === undefined ? (
        <div className="card p-6 text-center text-sm opacity-60">…</div>
      ) : list.length ? (
        <div className="overflow-hidden rounded-2xl border border-ink/10 dark:border-white/10">
          {list.map((p, i) => {
            const st = stateFor(p.id);
            return (
              <div key={p.id}
                className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-ink/5 dark:border-white/5" : ""}`}>
                <Link to={productHref("onesocial", `/p/${p.id}`)} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={p.photo_url} name={p.full_name} size={44} rounded="rounded-full" textSize="text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.full_name ?? W(lang, "Member", "Miembro")}</p>
                    <p className="truncate text-[12.5px] opacity-55">
                      {[p.job_title, p.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {/* No score ring here — Lee, 9 Aug: name + score + badge + button on one
                      line is too much. Scores live on OneScore's board and the passport;
                      a People row is a person and one action. */}
                </Link>
                {st === "accepted" ? (
                  <span className="shrink-0 rounded-full bg-teal/15 px-2.5 py-1 text-[12px] font-extrabold text-teal-deep dark:text-teal-light">
                    {W(lang, "Connected", "Conectado")}
                  </span>
                ) : st === "pending" ? (
                  <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-[12px] font-bold opacity-60 dark:bg-white/10">
                    {W(lang, "Pending", "Pendiente")}
                  </span>
                ) : (
                  <button onClick={() => connect(p.id)} disabled={!userId || busy === p.id}
                    className="btn-brand shrink-0 !px-3.5 !py-1.5 text-[12.5px] disabled:opacity-50">
                    {busy === p.id ? "…" : W(lang, "Connect", "Conectar")}
                  </button>
                )}
                {failed === p.id && (
                  <span className="text-[11px] font-bold text-red-500">
                    {W(lang, "Didn't save — try again", "No se guardó — reintenta")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm font-bold">{W(lang, "No one matches that.", "Nadie coincide.")}</p>
        </div>
      )}
    </div>
  );
}
