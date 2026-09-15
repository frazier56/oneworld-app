import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import { W } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import {
  canMove, showingStateLabel, showingStateTone,
  type ShowingRole, type ShowingState,
} from "../lib/showings";

/**
 * THE OTHER END OF THE DOORBELL — the host's confirm / decline, and the guest's own list.
 * ============================================================================================
 * v51 shipped the guest half of showings and said so plainly in its note to Max: *"the host's
 * confirm/decline screen does not exist either. Naming it here so nobody assumes the feature is
 * complete because the guest half works."*
 *
 * It is the half that decides whether the feature is real. A guest can ask for a viewing, the
 * request lands in a table with an exclusion constraint holding the slot — and then nothing
 * happens, forever, because the host has no surface on which to say yes. Worse than missing: a
 * request that silently holds a time slot the host could have given to somebody else.
 *
 * ── ONE COMPONENT FOR BOTH SIDES, AND WHY THAT IS NOT LAZINESS ──────────────────────────────
 * The two lists are the same rows read from opposite ends. What differs is exactly three things —
 * whose name you see, which buttons you get, and what "waiting" means — and all three are
 * derived from `role` rather than duplicated. Two files would drift within a week: the guest's
 * copy would keep an old state label after the host's copy was corrected, and a guest would be
 * told a viewing was "pending" that the host had already declined.
 *
 * ── ⚠️ THE BUTTONS ARE A MIRROR, NOT THE RULE ───────────────────────────────────────────────
 * `canMove()` decides which actions render, and `showing_state_guard_t` in the database decides
 * which actually succeed. That is deliberate belt-and-braces, and the ORDER matters: until v54
 * the RLS policy allowed either party to write any column, so a guest could have set their own
 * request to `confirmed`. Hiding the button was never protection. If this file and the trigger
 * ever disagree, the trigger is right.
 */

type Row = {
  id: string;
  property_id: string;
  guest_id: string;
  host_id: string;
  starts_at: string;
  ends_at: string;
  state: ShowingState;
  guest_note: string | null;
  host_note: string | null;
};

type Person = { id: string; full_name: string | null; photo_url: string | null };

export default function HostShowings({
  userId, role, lang, product = "rentals", limit = 25, onCount,
}: {
  userId: string;
  /** "host" reads the showings ON your listings; "guest" reads the ones you asked for. */
  role: ShowingRole;
  lang: string;
  /** Which product's routes to link into. */
  product?: string;
  limit?: number;
  /** How many still need this person's attention — for a badge on the screen above. */
  onCount?: (n: number) => void;
}) {
  const es = lang === "es" || lang === "co";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** Which row has its decline box open. Declining without a word is a worse experience than a
      short reason, and a reason typed into a box that is always visible never gets typed. */
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    /* ── WHY THE WINDOW IS "FROM AN HOUR AGO", NOT "FROM NOW" ──────────────────────────────
       A viewing that started twenty minutes ago is the single most relevant row on this screen —
       somebody may be standing outside right now. Cutting at `now` makes it vanish exactly when
       it matters most. An hour of grace, then it drops off. */
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("property_showings")
      .select("id, property_id, guest_id, host_id, starts_at, ends_at, state, guest_note, host_note")
      .eq(role === "host" ? "host_id" : "guest_id", userId)
      .gte("starts_at", since)
      .order("starts_at", { ascending: true })
      .limit(limit);
    if (error) { setErr(error.message); setRows([]); return; }
    const list = (data ?? []) as Row[];
    setRows(list);
    onCount?.(list.filter(r => r.state === "requested").length);

    /* The other person, and which listing. Two small queries rather than a join, because
       `property_showings` is readable only by the two people in it and joining across an RLS
       boundary is how a screen ends up quietly showing nothing. */
    const otherIds = [...new Set(list.map(r => role === "host" ? r.guest_id : r.host_id))];
    const propIds = [...new Set(list.map(r => r.property_id))];
    if (otherIds.length) {
      const { data: p } = await supabase.from("profiles")
        .select("id, full_name, photo_url").in("id", otherIds);
      setPeople(Object.fromEntries((p ?? []).map((x: any) => [x.id, x])));
    }
    if (propIds.length) {
      /* A showing may be on either half of OneHome. Ask both tables and merge — a missing row on
         one side is normal, not an error. */
      const [r1, r2] = await Promise.all([
        supabase.from("rental_properties").select("id, title").in("id", propIds),
        supabase.from("sale_properties").select("id, title").in("id", propIds),
      ]);
      setTitles(Object.fromEntries(
        [...(r1.data ?? []), ...(r2.data ?? [])].map((x: any) => [x.id, x.title])));
    }
  }
  useEffect(() => { if (userId) void load(); /* eslint-disable-next-line */ }, [userId, role]);

  async function move(row: Row, to: ShowingState, hostNote?: string) {
    setBusy(row.id); setErr(null);
    const patch: Record<string, unknown> = { state: to };
    /* Only the host may write `host_note` — the trigger enforces it, so never send the field from
       the guest's side even as null, or an innocent decline turns into a permission error. */
    if (role === "host" && hostNote != null) patch.host_note = hostNote.trim() || null;

    const { error } = await supabase.from("property_showings").update(patch).eq("id", row.id);
    setBusy(null);
    if (error) {
      /* The trigger raises sentences written for people ("A showing cannot be marked as done
         before it has happened."), so the server's own words are the best thing to show. The one
         case worth translating is a stale screen: two tabs, or a guest who cancelled while the
         host was deciding. */
      setErr(/already closed/i.test(error.message)
        ? W(lang, "That showing has already been settled. Refreshing.",
                  "Esa visita ya se resolvió. Actualizando.")
        : error.message);
      void load();
      return;
    }
    setDeclining(null); setNote("");
    void load();
  }

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString(es ? "es" : "en", { weekday: "short", day: "numeric", month: "short" }),
      time: d.toLocaleTimeString(es ? "es" : "en", { hour: "numeric", minute: "2-digit" }),
    };
  };

  if (rows === null) return <div className="ow-shimmer h-24 rounded-2xl" />;

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-ink/[0.08] px-3 py-4 text-center text-[12.5px] leading-relaxed opacity-60 dark:border-white/10">
        {role === "host"
          ? W(lang, "No one has asked to view your places yet.",
                    "Todavía nadie ha pedido visitar sus inmuebles.")
          : W(lang, "You have not asked to view anywhere yet.",
                    "Aún no ha pedido visitar ningún inmueble.")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {err && <p className="text-[12.5px] font-semibold text-red-500">{err}</p>}

      {rows.map(row => {
        const other = people[role === "host" ? row.guest_id : row.host_id];
        const when = fmt(row.starts_at);
        const tone = showingStateTone(row.state);
        const past = new Date(row.ends_at) < new Date();

        return (
          <article key={row.id}
            className="rounded-2xl border border-ink/[0.08] p-3 dark:border-white/10">
            <div className="flex items-start gap-3">
              <Avatar src={other?.photo_url} name={other?.full_name} size={36} rounded="rounded-full" textSize="text-[12px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold">
                  {other?.full_name ?? W(lang, "Member", "Miembro")}
                </p>
                <p className="truncate text-[12px] opacity-70">
                  {titles[row.property_id] ?? W(lang, "A listing", "Un anuncio")}
                </p>
                <p className="mt-0.5 text-[12.5px] font-semibold">
                  {when.day} · {when.time}
                </p>
              </div>
              {/* The state, as a word plus a dot. Colour alone is not a label — about one man in
                  twelve cannot separate the amber from the teal. */}
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                tone === "wait" ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                : tone === "good" ? "border-teal-deep/40 text-teal-deep dark:text-teal-light"
                : "border-ink/12 opacity-55 dark:border-white/15"}`}>
                {showingStateLabel(row.state, role, es)}
              </span>
            </div>

            {row.guest_note && (
              <p className="mt-2 rounded-xl bg-ink/[0.04] px-2.5 py-1.5 text-[12px] leading-snug dark:bg-white/[0.06]">
                {row.guest_note}
              </p>
            )}
            {row.host_note && (
              <p className="mt-1.5 text-[12px] leading-snug opacity-70">
                {W(lang, "Host:", "Anfitrión:")} {row.host_note}
              </p>
            )}

            {declining === row.id ? (
              <div className="mt-2">
                <textarea className="input min-h-[54px] w-full" value={note} maxLength={300}
                  onChange={e => setNote(e.target.value)}
                  placeholder={W(lang, "Optional — a line about why, or a better time.",
                                       "Opcional — una línea sobre por qué, o una mejor hora.")} />
                <div className="mt-1.5 flex gap-1.5">
                  <button onClick={() => move(row, "declined", note)} disabled={busy === row.id}
                    className="btn-primary flex-1 disabled:opacity-45">
                    {W(lang, "Send decline", "Enviar rechazo")}
                  </button>
                  <button onClick={() => { setDeclining(null); setNote(""); }}
                    className="ow-tap rounded-xl border border-ink/12 px-3 text-[12.5px] font-bold dark:border-white/15">
                    {W(lang, "Back", "Atrás")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {canMove(role, row.state, "confirmed") && (
                  <button onClick={() => move(row, "confirmed")} disabled={busy === row.id}
                    className="btn-primary flex-1 disabled:opacity-45">
                    {W(lang, "Confirm", "Confirmar")}
                  </button>
                )}
                {canMove(role, row.state, "declined") && (
                  <button onClick={() => { setDeclining(row.id); setNote(""); }}
                    className="ow-tap rounded-xl border border-ink/12 px-3 py-2 text-[12.5px] font-bold dark:border-white/15">
                    {W(lang, "Decline", "Rechazar")}
                  </button>
                )}
                {/* ⚠️ `completed` ONLY ONCE THE END TIME HAS PASSED — `canMove` checks it and so
                    does the trigger. "Done" on a viewing that has not happened is a word a host
                    can type, not a fact. */}
                {canMove(role, row.state, "completed", { endsAt: row.ends_at }) && (
                  <button onClick={() => move(row, "completed")} disabled={busy === row.id}
                    className="ow-tap rounded-xl border border-ink/12 px-3 py-2 text-[12.5px] font-bold dark:border-white/15">
                    {W(lang, "It happened", "Sí se realizó")}
                  </button>
                )}
                {canMove(role, row.state, "cancelled") && !past && (
                  <button onClick={() => move(row, "cancelled")} disabled={busy === row.id}
                    className="ow-tap rounded-xl px-3 py-2 text-[12.5px] font-bold opacity-55">
                    {W(lang, "Cancel", "Cancelar")}
                  </button>
                )}
                {/* Talking is always available, in every state. A declined viewing is very often
                    the start of arranging a better one. */}
                <Link to={`/${product}/p/${role === "host" ? row.guest_id : row.host_id}`}
                  className="ow-tap rounded-xl px-3 py-2 text-[12.5px] font-bold opacity-55">
                  {W(lang, "Message", "Escribir")}
                </Link>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
