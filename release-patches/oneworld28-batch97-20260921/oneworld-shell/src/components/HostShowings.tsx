import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import { SegTabs } from "./FormKit";
import { intlLocale, monthYearLabel } from "../lib/fx";
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
  /* LIST or CALENDAR (Lee, 2 Oct 2026: "I have a showing at this property on this day" — on a
     calendar). One component, so rent and sale — host and guest — all get it at once. */
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(12, 0, 0, 0); return d; });
  const [day, setDay] = useState<string | null>(null);

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
      .limit(view === "calendar" ? 200 : limit);
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
  useEffect(() => { if (userId) void load(); /* eslint-disable-next-line */ }, [userId, role, view]);

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
      <p className="ow-panel rounded-2xl px-3 py-4 text-center text-[12.5px] leading-relaxed opacity-60">
        {role === "host"
          ? W(lang, "No one has asked to view your places yet.",
                    "Todavía nadie ha pedido visitar sus inmuebles.")
          : W(lang, "You have not asked to view anywhere yet.",
                    "Aún no ha pedido visitar ningún inmueble.")}
      </p>
    );
  }

  const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const byDay = new Map<string, Row[]>();
  for (const r of rows) { const k = dayKey(r.starts_at); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const shown = view === "calendar" ? (day ? (byDay.get(day) ?? []) : []) : rows;
  const loc = intlLocale(lang);
  const first = new Date(month); const lead = (first.getDay() + 6) % 7;      // Monday first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayK = dayKey(new Date().toISOString());
  const weekdays = [...Array(7)].map((_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(loc, { weekday: "narrow" }));
  const shiftMonth = (n: number) => { const d = new Date(month); d.setMonth(d.getMonth() + n); setMonth(d); setDay(null); };

  return (
    <div className="space-y-2">
      {err && <p className="text-[12.5px] font-semibold text-red-500">{err}</p>}

      <SegTabs<"list" | "calendar"> size="sm" value={view} onChange={v => { setView(v); setDay(null); }}
        options={[{ value: "list", label: W(lang, "List", "Lista") }, { value: "calendar", label: W(lang, "Calendar", "Calendario") }]} />

      {view === "calendar" && (
        <section className="ow-panel rounded-2xl p-3" aria-label={W(lang, "Showings calendar", "Calendario de visitas")}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label={W(lang, "Previous month", "Mes anterior")}
              className="ow-tap grid h-9 w-9 place-items-center rounded-full text-[18px] font-bold">‹</button>
            <p className="text-[14px] font-black">{monthYearLabel(month, lang)}</p>
            <button type="button" onClick={() => shiftMonth(1)} aria-label={W(lang, "Next month", "Mes siguiente")}
              className="ow-tap grid h-9 w-9 place-items-center rounded-full text-[18px] font-bold">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((w, i) => <span key={i} className="pb-1 text-[10.5px] font-bold uppercase opacity-45">{w}</span>)}
            {[...Array(lead)].map((_, i) => <span key={`b${i}`} />)}
            {[...Array(daysIn)].map((_, i) => {
              const k = `${month.getFullYear()}-${month.getMonth()}-${i + 1}`;
              const items = byDay.get(k) ?? [];
              const waiting = items.some(r => r.state === "requested");
              const on = day === k;
              return (
                <button key={k} type="button" disabled={!items.length} onClick={() => setDay(on ? null : k)}
                  aria-pressed={on}
                  aria-label={`${i + 1}${items.length ? ` · ${items.length} ${W(lang, items.length === 1 ? "showing" : "showings", items.length === 1 ? "visita" : "visitas")}` : ""}`}
                  className={`relative grid h-10 place-items-center rounded-xl text-[13px] font-semibold transition ${
                    on ? "bg-ink text-white dark:bg-white dark:text-ink"
                    : items.length ? "bg-brand/10 font-black text-brand-deep dark:text-brand-light"
                    : "opacity-45"} ${k === todayK && !on ? "ring-1 ring-brand/50" : ""}`}>
                  {i + 1}
                  {items.length > 0 && (
                    <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${waiting ? "bg-amber-500" : "bg-teal"}`} />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[11.5px] opacity-55">
            {day ? null : W(lang, "Tap a marked day to see its showings.", "Toque un día marcado para ver sus visitas.")}
          </p>
        </section>
      )}

      {shown.map(row => {
        const other = people[role === "host" ? row.guest_id : row.host_id];
        const when = fmt(row.starts_at);
        const tone = showingStateTone(row.state);
        const past = new Date(row.ends_at) < new Date();

        return (
          <article key={row.id}
            /* ⚠️ THIS ROW HAD NO BACKGROUND — a hairline border on the aurora, which reads as
               nothing at all beside the request cards it now shares a toggle with. Lee, 20 Sep
               2026: *"your viewings are too translucent, they're like 100 percent translucency,
               which is too much… request and viewing should look similar."* `.ow-panel` is the
               one surface both lists use now; see shell/tokens.css. */
            className="ow-panel rounded-2xl p-3">
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
                : "border-ink/[0.12] opacity-55 dark:border-white/15"}`}>
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
 className="ow-edge ow-tap rounded-xl border px-3 text-[12.5px] font-bold ">
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
 className="ow-edge ow-tap rounded-xl border px-3 py-2 text-[12.5px] font-bold ">
                    {W(lang, "Decline", "Rechazar")}
                  </button>
                )}
                {/* ⚠️ `completed` ONLY ONCE THE END TIME HAS PASSED — `canMove` checks it and so
                    does the trigger. "Done" on a viewing that has not happened is a word a host
                    can type, not a fact. */}
                {canMove(role, row.state, "completed", { endsAt: row.ends_at }) && (
                  <button onClick={() => move(row, "completed")} disabled={busy === row.id}
 className="ow-edge ow-tap rounded-xl border px-3 py-2 text-[12.5px] font-bold ">
                    {W(lang, "It happened", "Sí se realizó")}
                  </button>
                )}
                {/* ⚠️ THREE CONTROLS IN ONE ROW AT THREE DIFFERENT WEIGHTS — Confirm solid,
                    Decline outlined, and these two as bare 55-percent text with no edge at all.
                    That is the control-contrast rule from batch 44 (*"if those buttons are
                    supposed to be greyed out, they don't look greyed out"*) broken inside a
                    single row: a reader cannot tell whether "Message" is a button, a label, or
                    something disabled. Every control in the row carries an edge now; importance
                    is still legible because exactly one of them is filled. */}
                {canMove(role, row.state, "cancelled") && !past && (
                  <button onClick={() => move(row, "cancelled")} disabled={busy === row.id}
                    className="ow-edge ow-tap rounded-xl border px-3 py-2 text-[12.5px] font-bold opacity-75">
                    {W(lang, "Cancel", "Cancelar")}
                  </button>
                )}
                {/* Talking is always available, in every state. A declined viewing is very often
                    the start of arranging a better one. */}
                <Link to={`/${product}/p/${role === "host" ? row.guest_id : row.host_id}`}
                  className="ow-edge ow-tap rounded-xl border px-3 py-2 text-[12.5px] font-bold">
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
