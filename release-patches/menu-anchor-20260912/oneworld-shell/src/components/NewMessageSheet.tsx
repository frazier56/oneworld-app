import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { productHref } from "../routes";
import { startConversation } from "../lib/conversations";
import type { AppKey } from "../lib/oneWorld";
import Avatar from "./Avatar";

/**
 * NEW MESSAGE — pick a person, open the thread. SHELL, so it is the same in all five apps.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"there needs to be a button probably at the bottom right that says, like,
 * new or plus or something so people can basically start a new message. Because right now,
 * there's no button for people to start a new chat with anyone… that is a shell thing."*
 *
 * He is describing a hole, not a nicety: the inbox could only ever show conversations that
 * already existed. Every thread in the database got there from a job, an event or a profile —
 * there was no way to simply message a person. On a platform whose pitch is "find credible
 * people and work with them", that is the missing verb.
 *
 * WHO THE LIST SHOWS, AND WHY IT IS NOT "EVERYONE".
 * Connections first, because messaging someone you know is the common case and should need no
 * typing at all. Once you type, the search widens to every public profile — which is the whole
 * point of a credibility marketplace, and it is also how the 58 migrated members become
 * reachable before they have connected to anybody.
 *
 * Columns are named on every read: `select('*')` on `profiles` throws 42501 for a signed-in
 * member under the column-level grants.
 */
export default function NewMessageSheet({ product, myId, onClose }: {
  product: AppKey;
  myId: string;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const isEs = lang === "es" || lang === "co";
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  type Person = { id: string; full_name: string | null; photo_url: string | null; job_title: string | null; connected: boolean };

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const term = q.trim();

      /* Connections first — the people you already know, no typing required. */
      const { data: cons } = await supabase.from("user_connections")
        .select("requester_id, recipient_id")
        .or(`requester_id.eq.${myId},recipient_id.eq.${myId}`)
        .eq("status", "accepted")
        .limit(200);
      const connIds = [...new Set((cons ?? [])
        .map((c: any) => (c.requester_id === myId ? c.recipient_id : c.requester_id))
        .filter(Boolean))] as string[];

      let rows: any[] = [];
      if (connIds.length) {
        const { data } = await supabase.from("profiles")
          .select("id, full_name, photo_url, job_title")
          .in("id", connIds).limit(50);
        rows = (data ?? []).map(p => ({ ...p, connected: true }));
      }

      /* Typing widens the search to every public profile. Without this the sheet could only ever
         reach people you had already connected to, which is the same wall one level up. */
      if (term.length >= 2) {
        const { data } = await supabase.from("profiles")
          .select("id, full_name, photo_url, job_title")
          .eq("is_public", true)
          .or(`full_name.ilike.%${term}%,job_title.ilike.%${term}%`)
          .neq("id", myId)
          .limit(30);
        const have = new Set(rows.map(r => r.id));
        rows = rows.concat((data ?? []).filter(p => !have.has(p.id)).map(p => ({ ...p, connected: false })));
      }

      if (alive) setPeople(rows.filter(r => r.id !== myId) as Person[]);
    };
    const t = setTimeout(() => void run(), q ? 250 : 0);   // debounce the typed search
    return () => { alive = false; clearTimeout(t); };
  }, [q, myId]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = people ?? [];
    if (!term) return rows;
    return rows.filter(p => (p.full_name ?? "").toLowerCase().includes(term)
      || (p.job_title ?? "").toLowerCase().includes(term));
  }, [people, q]);

  const open = async (otherId: string) => {
    setBusy(otherId); setErr(null);
    const res = await startConversation(myId, otherId);
    setBusy(null);
    if ("error" in res) { setErr(res.error); return; }
    onClose();
    nav(productHref(product, `/messages/${res.conversationId}`));
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true"
      aria-label={isEs ? "Nuevo mensaje" : "New message"}>
      {/* The scrim carries NO hue — brand rule. */}
      <button aria-label={isEs ? "Cerrar" : "Close"} onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
      <div className="ow-sheet relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl p-4 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{isEs ? "Nuevo mensaje" : "New message"}</h2>
          <button onClick={onClose} className="ow-tap grid h-9 w-9 place-items-center rounded-full bg-ink/5 dark:bg-white/10"
            aria-label={isEs ? "Cerrar" : "Close"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <label className="mb-3 flex items-center gap-2 rounded-2xl border border-ink/10 bg-white/70 px-3 py-2.5 dark:border-white/15 dark:bg-white/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-50"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder={isEs ? "Busca a alguien" : "Search for someone"}
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-50" />
        </label>

        {err && <p className="mb-2 text-[13px] font-medium text-red-500">{err}</p>}

        <div className="ow-scroll min-h-0 flex-1 overflow-y-auto">
          {people === null ? (
            <p className="py-8 text-center text-sm opacity-50">…</p>
          ) : list.length ? (
            list.map((p, i) => (
              <button key={p.id} onClick={() => void open(p.id)} disabled={!!busy}
                className={`flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-brand/5 disabled:opacity-50 ${i ? "border-t border-ink/5 dark:border-white/5" : ""}`}>
                <Avatar src={p.photo_url} name={p.full_name} size={40} rounded="rounded-full" textSize="text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.full_name ?? (isEs ? "Miembro" : "Member")}</p>
                  {p.job_title && <p className="truncate text-[12.5px] opacity-55">{p.job_title}</p>}
                </div>
                {/* Teal = STATE, and "we're connected" is a state. */}
                {p.connected && (
                  <span className="shrink-0 rounded-full bg-teal/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-teal">
                    {isEs ? "Conectado" : "Connected"}
                  </span>
                )}
                {busy === p.id && <span className="shrink-0 text-[12px] opacity-50">…</span>}
              </button>
            ))
          ) : (
            <p className="py-8 text-center text-sm opacity-55">
              {q.trim().length >= 2
                ? (isEs ? "Nadie con ese nombre." : "Nobody by that name.")
                : (isEs ? "Escribe un nombre para buscar en todo One World." : "Type a name to search all of One World.")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
