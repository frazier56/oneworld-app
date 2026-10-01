import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useI18n, W } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import Avatar from "./Avatar";

/**
 * LISTING COMMENTS — one conversation, wherever you are standing.
 * ============================================================================================
 * Lee, 13 Aug 2026:
 *
 *   *"If someone does make a comment on the posting, the comment should show below the actual
 *   panel, the actual picture… It'll show a limited amount of comments before you say show more.
 *   It'll show three comments, and then you can say show more and it would just expand."*
 *
 *   *"Everyone can reply to comments, really, just like on Instagram, but the host has the
 *   ability to delete comments if she doesn't like them."*
 *
 *   *"When you click on a listing at the bottom it says comments — apparently you can make
 *   comments from the listing itself, which should show up on the same comment section."*
 *
 * ── THE BUG UNDERNEATH THE REQUEST ──────────────────────────────────────────────────────────
 * That last sentence is the important one, and it was not a layout complaint. The two surfaces
 * were writing to TWO DIFFERENT TABLES:
 *
 *     the feed card's comment button  →  media_comments  (the generic social table)
 *     the property detail page        →  rental_property_comments
 *
 * So a question asked on the feed and a question asked on the listing were two conversations
 * that could never see each other, and an agent answering one left the other unanswered with no
 * way to know. It looked like a display bug and was a data bug. This component is the single
 * reader and writer of the property comment tables, and both surfaces now mount it.
 *
 * ── ONE LEVEL OF REPLIES, ON PURPOSE ────────────────────────────────────────────────────────
 * Instagram threads replies under a top-level comment and stops. Unbounded nesting on a 390px
 * screen indents itself into a column two words wide by the fourth reply. A reply to a reply is
 * therefore stored against the same parent — the database enforces the shape too, so a client
 * that gets clever cannot create a tree this cannot draw.
 *
 * ── DELETING IS THE OWNER'S, AND THE POLICY SAYS SO ─────────────────────────────────────────
 * The delete button appears for the comment's author and for the listing's owner. That is not
 * enforced here: `rental_comments_delete` and `sale_comments_delete` say exactly the same thing
 * in the database. The button is the affordance; the policy is the rule. Anybody calling the API
 * directly meets the policy.
 */

export type CommentTable = "rental_property_comments" | "sale_property_comments";

type Row = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  who?: { id: string; full_name: string | null; photo_url: string | null };
};

/** How many top-level comments show before "Show more". Lee named the number. */
const PAGE = 3;

export default function ListingComments({
  table, propertyId, ownerId, allowComments = true, lang: langProp,
  onCount, heading = true, className = "",
}: {
  table: CommentTable;
  propertyId: string;
  /** The listing's agent. They may delete anything on their own listing. */
  ownerId?: string | null;
  /** The lister's switch. False = only the lister may post; everyone still reads. */
  allowComments?: boolean;
  lang?: string;
  onCount?: (n: number) => void;
  heading?: boolean;
  className?: string;
}) {
  const i18n = useI18n();
  const lang = langProp ?? i18n.lang;
  const { userId } = useOneId();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    /* Two queries, never a join. `author_id` points at auth.users, not at profiles, so PostgREST
       has no foreign key to embed through — and `select("*")` on profiles throws 42501 under the
       column-level grants. Named columns, always. */
    const { data, error } = await supabase.from(table)
      .select("id, author_id, body, created_at, parent_id")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) { console.error("[shell] comments read failed —", error.message); setRows([]); return; }
    const ids = [...new Set((data ?? []).map(c => c.author_id))];
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids)
      : { data: [] as any[] };
    const by = new Map((people ?? []).map((p: any) => [p.id, p]));
    const merged = (data ?? []).map(c => ({ ...c, who: by.get(c.author_id) })) as Row[];
    setRows(merged);
    onCount?.(merged.length);
  }, [table, propertyId]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  async function post(text: string, parent: string | null) {
    const t = text.trim();
    if (!t || !userId || busy) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from(table).insert({
      property_id: propertyId, author_id: userId, body: t.slice(0, 2000), parent_id: parent,
    });
    setBusy(false);
    if (error) {
      /* A refusal here is almost always the lister having closed comments between the page
         loading and this tap. Say that, rather than printing a policy name at somebody. */
      setErr(/row-level security|violates/i.test(error.message)
        ? W(lang, "Comments are closed on this listing.", "Los comentarios están cerrados en este anuncio.")
        : error.message);
      return;
    }
    if (parent) { setReplyBody(""); setReplyTo(null); } else setBody("");
    void load();
  }

  async function remove(id: string) {
    if (!window.confirm(W(lang, "Delete this comment?", "¿Eliminar este comentario?"))) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    void load();
  }

  const all = rows ?? [];
  const tops = all.filter(c => !c.parent_id);
  const repliesOf = (id: string) => all.filter(c => c.parent_id === id);
  const shownTops = expanded ? tops : tops.slice(0, PAGE);
  const canPost = !!userId && (allowComments || userId === ownerId);
  const day = (iso: string) => new Date(iso).toLocaleDateString(
    lang === "es" || lang === "co" ? "es" : "en", { day: "numeric", month: "short" });

  const Line = ({ c, isReply }: { c: Row; isReply?: boolean }) => (
    <div className={`flex gap-2.5 ${isReply ? "ml-9 mt-2" : "mt-3"}`}>
      <Avatar src={c.who?.photo_url} name={c.who?.full_name} size={isReply ? 24 : 30}
        rounded="rounded-full" textSize="text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">
          <span className="font-bold">{c.who?.full_name ?? W(lang, "Member", "Miembro")}</span>
          {c.author_id === ownerId && (
            <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-px text-[9.5px] font-black uppercase tracking-wide text-brand">
              {W(lang, "Host", "Anfitrión")}
            </span>
          )}
          <span className="ml-1.5 text-[11px] opacity-45">{day(c.created_at)}</span>
        </p>
        <p className="whitespace-pre-line text-[13.5px] leading-snug opacity-90">{c.body}</p>
        <div className="mt-0.5 flex items-center gap-3">
          {userId && (
            <button type="button" onClick={() => { setReplyTo(c.parent_id ?? c.id); setReplyBody(""); }}
              className="ow-tap py-1 text-[11.5px] font-bold opacity-55">
              {W(lang, "Reply", "Responder")}
            </button>
          )}
          {/* Author or host. The database says the same thing — see the header. */}
          {userId && (userId === c.author_id || userId === ownerId) && (
            <button type="button" onClick={() => remove(c.id)}
              className="ow-tap py-1 text-[11.5px] font-bold text-red-500/80">
              {W(lang, "Delete", "Eliminar")}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <section className={className}>
      {heading && (
        <h3 className="text-[12px] font-black uppercase tracking-wide opacity-55">
          {W(lang, "Comments", "Comentarios")}
          {tops.length > 0 && <span className="ml-1.5 tabular-nums opacity-60">{all.length}</span>}
        </h3>
      )}

      {rows === null ? (
        <div className="ow-shimmer mt-2 h-10 rounded-xl" />
      ) : (
        <>
          {shownTops.map(c => (
            <div key={c.id}>
              <Line c={c} />
              {repliesOf(c.id).map(r => <Line key={r.id} c={r} isReply />)}
              {replyTo === c.id && (
                <div className="ml-9 mt-2 flex items-center gap-2">
                  <input className="input h-10 w-full text-[13px]" autoFocus
                    value={replyBody} onChange={e => setReplyBody(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void post(replyBody, c.id); }}
                    placeholder={W(lang, `Reply to ${c.who?.full_name ?? "this"}…`,
                                         `Responder a ${c.who?.full_name ?? "esto"}…`)} />
                  <button type="button" onClick={() => void post(replyBody, c.id)}
                    disabled={busy || !replyBody.trim()}
                    className="btn-ghost h-10 shrink-0 px-3 text-[13px] disabled:opacity-40">
                    {W(lang, "Post", "Enviar")}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* SHOW MORE — the count is on the button, so it is a decision rather than a guess. */}
          {tops.length > PAGE && (
            <button type="button" onClick={() => setExpanded(v => !v)}
              className="ow-tap mt-2.5 text-[12.5px] font-bold opacity-60">
              {expanded
                ? W(lang, "Show fewer", "Ver menos")
                : W(lang, `Show ${tops.length - PAGE} more comment${tops.length - PAGE === 1 ? "" : "s"}`,
                          `Ver ${tops.length - PAGE} comentario${tops.length - PAGE === 1 ? "" : "s"} más`)}
            </button>
          )}

          {tops.length === 0 && (
            <p className="mt-2 text-[12.5px] opacity-50">
              {canPost
                ? W(lang, "No comments yet — ask something.", "Sin comentarios aún — pregunte algo.")
                : W(lang, "No comments yet.", "Sin comentarios aún.")}
            </p>
          )}

          {/* THE COMPOSER. Hidden, not disabled, when the lister has closed comments — a greyed
              box advertises a conversation and then refuses it. The existing comments stay
              readable either way: closing comments stops new ones, it does not erase old ones. */}
          {canPost ? (
            <div className="mt-3 flex items-center gap-2">
              <input className="input h-11 w-full text-[13.5px]"
                value={body} onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void post(body, null); }}
                placeholder={W(lang, "Ask something publicly…", "Pregunte algo públicamente…")} />
              <button type="button" onClick={() => void post(body, null)}
                disabled={busy || !body.trim()}
                className="btn-ghost h-11 shrink-0 px-4 text-[13.5px] disabled:opacity-40">
                {W(lang, "Post", "Enviar")}
              </button>
            </div>
          ) : userId ? (
            <p className="mt-3 text-[12px] italic opacity-45">
              {W(lang, "The lister has turned off public comments on this listing.",
                       "Quien publicó este anuncio desactivó los comentarios públicos.")}
            </p>
          ) : null}

          {err && <p className="mt-2 text-[12px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
        </>
      )}
    </section>
  );
}
