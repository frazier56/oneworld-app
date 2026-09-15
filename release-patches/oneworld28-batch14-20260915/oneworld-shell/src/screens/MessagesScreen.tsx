import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { productHref } from "../routes";
import Avatar from "../components/Avatar";
import type { AppKey } from "../lib/oneWorld";
import ScreenHeading from "../components/ScreenHeading";
import { screenTitle } from "../lib/screenTitles";
import NewMessageSheet from "../components/NewMessageSheet";

/**
 * MESSAGES — the shared inbox. ~100% shell (SHELL_CONTRACT): the same on every app, so it lives
 * here and every product mounts it. Inbox list + filter chips + search; a thread opens on tap.
 *
 * ── FIXED 9 Aug 2026: THIS SCREEN ASKED FOR SEVEN COLUMNS THAT DO NOT EXIST ─────────────────
 * It selected `owner_id, other_name, other_photo, last_message, last_at, unread, is_connection`
 * from `conversations`. Checked against the live database: NOT ONE of those columns is real. The
 * table is `id, participant_ids (uuid[]), last_message_text, last_message_at, category,
 * is_request, metadata, created_at, updated_at`.
 *
 * So the read failed on every call, `useAsync` swallowed the rejection into `undefined`, and the
 * screen rendered its empty state. Messages has therefore been blank for every member of every
 * one of the five apps — with 475 real conversations and 318 real messages sitting in the table.
 * Nobody saw an error because the empty state is indistinguishable from "you have no messages",
 * which is exactly the failure mode Lee means by "never show a control that only half works".
 *
 * Three consequences of the real shape, handled below:
 *   · The counterparty is not ON the conversation row. `participant_ids` is an array, so the
 *     other person is whichever id in it is not mine, and their name and photo come from
 *     `profiles` in a second, batched read. That read is column-named — `select('*')` on
 *     `profiles` throws 42501 for a signed-in member.
 *   · There is no `unread` column. Unread is counted from `messages`: rows in my conversations
 *     that somebody else sent and I have not read.
 *   · There is no `is_connection` column, so the old "Connections" filter could never have
 *     worked. `is_request` IS real and is the standard, useful inbox split — a message from
 *     somebody you do not know yet. The filter is now All · Unread · Requests, all three backed
 *     by real data instead of one backed by a column that was never there.
 */
type Filter = "all" | "unread" | "requests" | "listings";

type Row = {
  id: string;
  otherId: string | null;
  name: string | null;
  photo: string | null;
  last: string | null;
  at: string | null;
  unread: number;
  isRequest: boolean;
  /** Event group chat (17 Aug 2026): the row is a room, not a person — named after the event. */
  isGroup: boolean;
  /** Which listing this thread is about, when it is about one at all. */
  listingId: string | null;
  listingTitle: string | null;
};

export default function MessagesScreen({ product }: { product: AppKey }) {
  const { lang } = useI18n();
  const isEs = lang === "es" || lang === "co";
  const { userId } = useOneId();
  const [filter, setFilter] = useState<Filter>("all");
  /* Which specific listing is being narrowed to, when the reader has picked one. Null means
     "any listing" — the difference between "show me property enquiries" and "show me the ones
     about the Poblado flat", and a host with nine listings needs both. */
  const [listingId, setListingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  /* Lee, 10 Aug 2026: there was NO way to start a chat with anyone. Every thread in the database
     got there from a job, an event or a profile. This is the missing verb. */
  const [composing, setComposing] = useState(false);

  const threads = useAsync(async () => {
    /* 1. My conversations. RLS already restricts to `auth.uid() = ANY (participant_ids)`, and the
          filter is stated anyway — a query that leans on RLS to narrow it is one policy change
          away from returning somebody else's inbox. */
    const { data: convos, error } = await supabase.from("conversations")
      .select("id, participant_ids, last_message_text, last_message_at, is_request, metadata")
      .contains("participant_ids", [userId!])
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);
    /* The server's own words, never a friendly catch-all. A swallowed error here is precisely how
       a broken query spent weeks looking like an empty inbox. */
    if (error) { console.error("[shell] messages: conversations read failed —", error.message); return [] as Row[]; }
    const list = convos ?? [];
    if (!list.length) return [] as Row[];

    /* 2. Who am I talking to? Batched, and column-named. */
    const otherIds = [...new Set(list
      /* Group rows are named after their event, not a counterparty — no profile to fetch. */
      .filter(c => !(c.metadata as Record<string, unknown> | null)?.group)
      .map(c => (c.participant_ids as string[] | null)?.find(p => p !== userId) ?? null)
      .filter(Boolean) as string[])];
    const people = new Map<string, { full_name: string | null; photo_url: string | null }>();
    if (otherIds.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, full_name, photo_url").in("id", otherIds);
      for (const p of profs ?? []) people.set(p.id as string, p as any);
    }

    /* 3. Unread = messages in these conversations that someone else sent and I have not read.
          One read, counted client-side, rather than fifty count queries. */
    const unread = new Map<string, number>();
    const { data: unreadRows } = await supabase.from("messages")
      .select("conversation_id")
      .in("conversation_id", list.map(c => c.id as string))
      .neq("sender_id", userId!)
      .is("read_at", null)
      .is("deleted_at", null)
      .limit(500);
    for (const m of unreadRows ?? []) {
      const k = m.conversation_id as string;
      unread.set(k, (unread.get(k) ?? 0) + 1);
    }

    /* ── 4. WHICH LISTING IS THIS THREAD ABOUT? ────────────────────────────────────────────
       Lee, 15 Aug 2026: *"if you're a host looking at your messages, you could easily see if
       someone is writing to you about a listing, or they're just writing you about something
       else."*

       The link has existed since 10 August — `rental_conversation_tags` and
       `sale_conversation_tags`, written by the enquiry button on each detail screen — and
       NOTHING has ever read it. So a host with nine listings has been reading nine people's
       first messages trying to work out which flat each one means.

       ⚠️ TWO TABLES, ONE MAP, AND BOTH ARE ASKED. A thread is tagged on whichever side it
       started, and this screen is the SHELL's — it is the same inbox on all six products, so it
       cannot assume the reader arrived through the rent door. Titles are then read from both
       property tables; a missing row is normal (the listing was withdrawn) and simply leaves the
       thread untagged rather than erroring. */
    const ids = list.map(c => c.id as string);
    const tagOf = new Map<string, string>();
    const [rTags, sTags] = await Promise.all([
      supabase.from("rental_conversation_tags").select("conversation_id, property_id").in("conversation_id", ids),
      supabase.from("sale_conversation_tags").select("conversation_id, property_id").in("conversation_id", ids),
    ]);
    for (const t of [...(rTags.data ?? []), ...(sTags.data ?? [])]) {
      if (t.property_id) tagOf.set(t.conversation_id as string, t.property_id as string);
    }

    const titles = new Map<string, string>();
    const propIds = [...new Set(tagOf.values())];
    if (propIds.length) {
      const [rp, sp] = await Promise.all([
        supabase.from("rental_properties").select("id, title").in("id", propIds),
        supabase.from("sale_properties").select("id, title").in("id", propIds),
      ]);
      for (const r of [...(rp.data ?? []), ...(sp.data ?? [])]) {
        titles.set(r.id as string, r.title as string);
      }
    }

    return list.map(c => {
      const meta = (c.metadata as Record<string, unknown> | null) ?? null;
      const isGroup = !!meta?.group;
      const otherId = isGroup ? null
        : (c.participant_ids as string[] | null)?.find(p => p !== userId) ?? null;
      const lid = tagOf.get(c.id as string) ?? null;
      const who = otherId ? people.get(otherId) : undefined;
      return {
        id: c.id as string,
        otherId,
        isGroup,
        name: isGroup ? ((meta?.title as string | undefined) ?? "Event chat") : (who?.full_name ?? null),
        photo: who?.photo_url ?? null,
        last: (c.last_message_text as string | null) ?? null,
        at: (c.last_message_at as string | null) ?? null,
        unread: unread.get(c.id as string) ?? 0,
        isRequest: !!c.is_request,
        listingId: lid,
        listingTitle: lid ? titles.get(lid) ?? null : null,
      } as Row;
    });
  }, [userId], !!userId);

  /** "3m" · "4h" · "2d" · a date. A raw ISO timestamp was being printed into the row. */
  const when = (iso: string | null) => {
    if (!iso) return "";
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (Number.isNaN(mins)) return "";
    if (mins < 1) return isEs ? "ahora" : "now";
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString(isEs ? "es" : "en", { month: "short", day: "numeric" });
  };

  /* Every listing that actually appears in this inbox, so the picker can never offer a choice
     that yields an empty list. Same rule as the city pills on the feeds. */
  const listingsHere = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of threads ?? []) if (t.listingId) m.set(t.listingId, t.listingTitle ?? "—");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [threads]);

  /* ── v75 · R5b · ONE PREDICATE PER CHIP, USED TO COUNT AND TO FILTER ──────────────────────
     Lee: *"inbox filters with unread counts and dots."* The number on a chip and the list behind
     it come from the SAME function here, deliberately, because two implementations of "what does
     Unread mean" is two implementations that drift. */
  const matches = (t: Row, f: Filter) =>
    f === "all" ? true
    : f === "unread" ? t.unread > 0
    : f === "requests" ? t.isRequest
    : !!t.listingId;

  /* ⚠️ EVERYTHING THE READER HAS NARROWED TO, EXCEPT THE CHIP ITSELF. Counting before the search
     box and the listing picker are applied is how a chip ends up reading "Unread 3" above an
     empty screen. Tap it and you get exactly what it said, including mid-search. */
  const inScope = (threads ?? [])
    /* The specific-listing narrowing is independent of the chip, so it survives switching to
       Unread — "unread messages about the Poblado flat" is a real question. */
    .filter(t => !listingId || t.listingId === listingId)
    /* Search reads the listing title too. Somebody typing "Poblado" into the search box on a
       message screen means the property. */
    .filter(t => !q || [t.name, t.listingTitle, t.last]
      .some(v => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  const list = inScope.filter(t => matches(t, filter));
  const countOf = (f: Filter) => inScope.reduce((acc, t) => acc + (matches(t, f) ? 1 : 0), 0);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: isEs ? "Todos" : "All" },
    { id: "unread", label: isEs ? "No leídos" : "Unread" },
    { id: "requests", label: isEs ? "Solicitudes" : "Requests" },
    /* Only offered when at least one thread is about a listing — a chip that always returns
       nothing on OneJob or OneEvent is a chip that teaches people to ignore the row. */
    ...(listingsHere.length ? [{ id: "listings" as Filter, label: isEs ? "Sobre un inmueble" : "About a listing" }] : []),
  ];

  return (
    <div className="space-y-3">
      {/* Shell-owned title in all SEVEN languages. Was an en/es ternary, which showed English
          on the five other flags the header offers. See lib/screenTitles.ts. */}
      <ScreenHeading>{screenTitle(lang, "messages")}</ScreenHeading>

      {/* Search */}
      <label className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-white/70 px-3 py-2.5 dark:border-white/15 dark:bg-white/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-50"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={isEs ? "Buscar" : "Search"}
          className="w-full bg-transparent text-sm outline-none placeholder:opacity-50" />
      </label>

      {/* Filter chips */}
      <div className="ow-scroll flex gap-2 overflow-x-auto pb-1">
        {/* ⚠️ A chip with nothing behind it is DIMMED, not hidden and not disabled. Hidden makes
            the row jump under your thumb as you type in the search box; disabled reads as broken.
            Dimmed with a 0 on it tells you there is nothing there without making you go and look —
            which is the entire job of this row.

            ⚠️ And this note sits OUTSIDE the tag on purpose. A block comment inside a JSX
            attribute list is legal and it has already broken two of my own patch scripts, whose
            tag walkers stopped at the first angle bracket inside the prose. */}
        {FILTERS.map(f => {
          const count = countOf(f.id);
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                filter === f.id ? "ow-ink-sel" : "border border-ink/10 dark:border-white/15"} ${
                count === 0 && filter !== f.id ? "opacity-45" : ""}`}>
              {f.label}
              <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-extrabold tabular-nums ${
                filter === f.id ? "bg-white/25 dark:bg-ink/20" : "bg-ink/10 dark:bg-white/15"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── WHICH LISTING ────────────────────────────────────────────────────────────────
          Appears only under the listings chip and only when there is more than one to choose
          between. A dropdown offering a single option is a control that cannot change anything. */}
      {filter === "listings" && listingsHere.length > 1 && (
        <label className="relative flex items-center rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 dark:border-white/15 dark:bg-white/10">
          <span className="sr-only">{isEs ? "Inmueble" : "Listing"}</span>
          <select value={listingId ?? ""} onChange={e => setListingId(e.target.value || null)}
            className="w-full appearance-none bg-transparent pr-6 text-[13px] font-semibold outline-none">
            <option value="">{isEs ? "Todos los inmuebles" : "All listings"}</option>
            {listingsHere.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
      )}

      {/* Thread list */}
      {list.length ? (
        <div className="overflow-hidden rounded-2xl border border-ink/10 dark:border-white/10">
          {list.map((t, i) => (
            <Link key={t.id} to={productHref(product, `/messages/${t.id}`)}
              className={`flex items-center gap-3 px-4 py-3 transition hover:bg-brand/5 ${i ? "border-t border-ink/5 dark:border-white/5" : ""}`}>
              <Avatar src={t.photo} name={t.name} size={44} rounded="rounded-full" textSize="text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  {/* v75 · Read threads are no longer bold. Every name being bold meant the only
                      difference between a conversation you have dealt with and one you have not
                      was a badge on the far right-hand edge of the row. */}
                  <p className={`truncate ${t.unread > 0 ? "font-bold" : "font-semibold opacity-75"}`}>{t.name ?? (isEs ? "Alguien" : "Someone")}</p>
                  {t.at && <span className="shrink-0 text-[11px] opacity-50">{when(t.at)}</span>}
                </div>
                {/* ⚠️ THE LISTING ABOVE THE MESSAGE, NOT BELOW IT. What the thread is ABOUT is
                    what a host scanning nine conversations is looking for; the last line of
                    chat is detail. Reversing these two makes the row read as a message that
                    happens to have a label. */}
                {t.listingTitle && (
                  <p className="truncate text-[12px] font-bold text-brand">{t.listingTitle}</p>
                )}
                <p className="truncate text-[13px] opacity-60">{t.last ?? ""}</p>
              </div>
              {t.unread > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-extrabold text-white">{t.unread}</span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm opacity-60">
            {threads === undefined
              ? "…"
              : filter === "all"
                ? (isEs ? "No hay conversaciones todavía." : "No conversations yet.")
                : (isEs ? "Nada en este filtro." : "Nothing under this filter.")}
          </p>
          {filter === "all" && threads !== undefined && (
            <>
              <p className="mt-1 text-[12px] opacity-45">{isEs ? "Empieza una conversación con quien quieras." : "Start a conversation with anyone."}</p>
              {/* An empty inbox is exactly where the missing verb hurt most: nothing on the
                  screen told you what to do next. */}
              <button onClick={() => setComposing(true)} className="btn-primary mx-auto mt-3 px-5">
                {isEs ? "Nuevo mensaje" : "New message"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── NEW MESSAGE — bottom right, above the tab bar (Lee, 10 Aug 2026) ──────────────────
          A raised round action, the same shape language as the money button, sitting clear of
          the five-tab strip. SHELL, so it is on the inbox of all five products at once. */}
      <button onClick={() => setComposing(true)} aria-label={isEs ? "Nuevo mensaje" : "New message"}
        className="ow-tap ow-tab-primary fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full transition active:scale-95">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {composing && userId && (
        <NewMessageSheet product={product} myId={userId} onClose={() => setComposing(false)} />
      )}
    </div>
  );
}
