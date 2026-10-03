import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, Wt, ScreenHeading, thumbFor, coverOf,
  IconEye, IconWrite, IconSparkle, IconCheck,
} from "@oneworld/shell";
import { priceLabel, type Property } from "../lib/rental";
import { salePriceOnly } from "../../onesale/lib/sale";
import {
  setTier, setSeen, setNote, loadProfile, encodePick, COMPARE_MAX, type Tier, type SavedKind,
} from "../lib/homeCompare";
import { useHomeProduct } from "../lib/homeCompare";

/**
 * SAVED — the properties you hearted, rent and sale in one place, and now ORGANISED.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"you can have view my saved properties, my favorites…"* — and on 2 Oct:
 * *"they can organise… the properties that I like, the properties that I really, really like, and
 * the ones that I've actually seen… they can make notes, but beyond that, they can compare."*
 *
 *   · LOVE is a step up from the plain save (a heart is "like"). SEEN is separate on purpose: you
 *     can love a place you have not visited yet, and visit one you went off. One tap each.
 *   · A NOTE is private and saves when you leave the box.
 *   · Tick two or three and "Compare with VAIA" ranks them against YOUR ideal home.
 *
 * `saved_items` is polymorphic (`item_type` decides the table), so: two reads, not a join — see the
 * original note. A saved row whose listing was unpublished is dropped from view, not deleted.
 */
type Row = any & { _kind: SavedKind; _tier: Tier; _seen: boolean; _note: string };
type Filter = "all" | "love" | "seen" | "unseen";

const Heart = ({ on, size = 16 }: { on: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 5 6.4 5c2 0 3.3 1.1 4.1 2.4h3C14.3 6.1 15.6 5 17.6 5 21 5 22.8 8.3 21.2 11.4 19 15.6 12 20 12 20z" />
  </svg>
);

export default function Saved() {
  const { lang } = useI18n();
  const prod = useHomeProduct();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [pick, setPick] = useState<{ kind: SavedKind; id: string }[]>([]);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});

  const profile = useAsync(() => (userId ? loadProfile(userId) : Promise.resolve(null)), [userId], !!userId);

  const items = useAsync(async () => {
    const { data: saved } = await supabase.from("saved_items")
      .select("item_type, item_id, created_at, tier, seen_at, note")
      .eq("user_id", userId!)
      .in("item_type", ["rental_property", "sale_property"])
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = saved ?? [];
    if (!rows.length) return [] as Row[];
    const rentIds = rows.filter(r => r.item_type === "rental_property").map(r => r.item_id as string);
    const saleIds = rows.filter(r => r.item_type === "sale_property").map(r => r.item_id as string);
    const [rent, sale] = await Promise.all([
      rentIds.length
        ? supabase.from("rental_properties")
            .select("id, title, photos, cover_photo, price, price_unit, city, neighbourhood, bedrooms, bathrooms, area_m2, status, display_currency, display_fx_rate")
            .in("id", rentIds).eq("status", "published")
        : Promise.resolve({ data: [] as any[] }),
      saleIds.length
        ? supabase.from("sale_properties")
            .select("id, title, photos, cover_photo, asking_price, currency, city, neighbourhood, bedrooms, bathrooms, area_m2, status")
            .in("id", saleIds).eq("status", "published")
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const byId = new Map<string, any>();
    for (const r of rent.data ?? []) byId.set(`rental_property:${r.id}`, { ...r, _kind: "rent" });
    for (const r of sale.data ?? []) byId.set(`sale_property:${r.id}`, { ...r, _kind: "sale" });
    return rows.map(r => {
      const p = byId.get(`${r.item_type}:${r.item_id}`);
      return p ? { ...p, _tier: (r as any).tier === "love" ? "love" : "like", _seen: !!(r as any).seen_at, _note: (r as any).note ?? "" } : null;
    }).filter(Boolean) as Row[];
  }, [userId], !!userId);

  const key = (p: Row) => `${p._kind}:${p.id}`;
  const view = (p: Row): Row => ({ ...p, ...(edits[key(p)] ?? {}) });
  const all = (items ?? []).map(view);
  const counts = { all: all.length, love: all.filter(p => p._tier === "love").length, seen: all.filter(p => p._seen).length, unseen: all.filter(p => !p._seen).length };
  const shown = all.filter(p => filter === "all" ? true : filter === "love" ? p._tier === "love" : filter === "seen" ? p._seen : !p._seen);

  const patch = (p: Row, ch: Partial<Row>) => setEdits(e => ({ ...e, [key(p)]: { ...(e[key(p)] ?? {}), ...ch } }));
  /* Optimistic, but honest: if the write fails the card goes back to what is really stored. */
  const [saveErr, setSaveErr] = useState(false);
  const commit = (p: Row, ch: Partial<Row>, write: () => PromiseLike<{ error: unknown }>) => {
    const before: Partial<Row> = {}; for (const k of Object.keys(ch)) (before as any)[k] = (p as any)[k];
    patch(p, ch); setSaveErr(false);
    void Promise.resolve(write()).then(r => { if (r?.error) { patch(p, before); setSaveErr(true); } }, () => { patch(p, before); setSaveErr(true); });
  };
  const picked = (p: Row) => pick.some(x => x.kind === p._kind && x.id === p.id);
  const togglePick = (p: Row) => setPick(cur => picked(p)
    ? cur.filter(x => !(x.kind === p._kind && x.id === p.id))
    : cur.length >= COMPARE_MAX || (cur.length > 0 && cur[0].kind !== p._kind) ? cur : [...cur, { kind: p._kind, id: p.id }]);

  const prios = profile?.priorities ?? [];

  return (
    <div className="space-y-4 pb-36">
      <ScreenHeading>{W(lang, "Saved", "Guardados")}</ScreenHeading>

      {/* ── YOUR IDEAL HOME ─────────────────────────────────────────────────────────────── */}
      {items && items.length > 0 && (
        <Link to={productHref(prod, "/ideal-home")}
          className="ow-tap block rounded-2xl border border-brand/30 bg-brand/[0.06] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-black tracking-tight">{W(lang, "Your ideal home", "Su hogar ideal")}</p>
            <span className="text-[12px] font-bold text-brand-deep dark:text-brand-light">{prios.length ? W(lang, "Edit", "Editar") : W(lang, "Set it up", "Definirlo")}</span>
          </div>
          {prios.length ? (
            <ol className="mt-2 flex flex-wrap gap-1.5">
              {prios.map((p, i) => (
                <li key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11.5px] font-semibold dark:bg-white/10">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-brand text-[9.5px] font-black text-white">{i + 1}</span>{p.label}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-[12.5px] leading-snug opacity-65">
              {W(lang, "Tell VAIA the five things that matter most. Then it can rank your saved places against them.",
                       "Dígale a VAIA las cinco cosas que más le importan. Así podrá ordenar sus guardados según eso.")}
            </p>
          )}
        </Link>
      )}
      {/* Lee, 2 Oct 2026: a way back to every comparison VAIA has written. */}
      {items && items.length > 1 && prios.length > 0 && (
        <Link to={productHref(prod, "/compare/saved")} className="ow-tap -mt-1 inline-flex text-[12.5px] font-bold text-brand-deep underline dark:text-brand-light">
          {W(lang, "View saved results", "Ver resultados guardados")}</Link>
      )}

      {items && items.length > 0 && (
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {([["all", W(lang, "All", "Todos")], ["love", W(lang, "Love", "Me encanta")], ["seen", W(lang, "Seen", "Visitados")], ["unseen", W(lang, "Not seen yet", "Sin visitar")]] as [Filter, string][]).map(([f, label]) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`ow-tap shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                filter === f ? "border-ink bg-ink text-paper dark:border-white dark:bg-white dark:text-ink" : "ow-edge"}`}>
              {label} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {saveErr && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] font-semibold text-red-600 dark:text-red-400">
        {W(lang, "That change didn't save. Check your connection and try again.", "Ese cambio no se guardó. Revise su conexión e inténtelo de nuevo.")}</p>}
      {/* The hint STAYS while picking and only changes its words. Removing it on the first tick
          moved every card up by a line, so a quick second tap landed on the wrong card (UAT, 2 Oct). */}
      {items && items.length >= 2 && (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold opacity-60" aria-live="polite">
          <IconSparkle size={13} />{pick.length === 0
            ? W(lang, "Tick two or three to compare them with VAIA.", "Marque dos o tres para compararlos con VAIA.")
            : pick.length === 1
              ? W(lang, "1 picked. Tick one or two more.", "1 marcado. Marque uno o dos más.")
              : W(lang, `${pick.length} picked. Compare them below.`, `${pick.length} marcados. Compárelos abajo.`)}
        </p>
      )}

      {items === undefined ? (
        <div className="space-y-2.5" aria-busy="true">
          {[0, 1, 2].map(i => <div key={i} className="ow-shimmer h-28 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-bold">{W(lang, "Nothing saved yet.", "Todavía no ha guardado nada.")}</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed opacity-55">
            {W(lang,
              "Tap the heart on any listing and it lands here. Then mark the ones you love, the ones you've seen, and let VAIA compare them.",
              "Toque el corazón en cualquier anuncio y aparece aquí. Luego marque los que le encantan, los que ya visitó, y deje que VAIA los compare.")}
          </p>
          <Link to={productHref(prod, "/")} className="btn-primary mt-4 inline-block">
            {W(lang, "Browse places", "Ver inmuebles")}
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-[13px] opacity-55">{W(lang, "Nothing here yet.", "Nada aquí todavía.")}</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map(p => {
            const rent = p._kind === "rent";
            const href = productHref(rent ? "onerental" : "onesale", `${rent ? "/r/" : "/s/"}${p.id}`);
            const where = [p.neighbourhood, p.city].filter(Boolean).join(", ");
            const price = rent ? priceLabel(p as Property, lang) : salePriceOnly(p as any, (p as any).currency === "COP" ? "COP" : "USD", null);
            const isPicked = picked(p);
            /* Three at most, and like with like: a rent against a purchase has no honest winner. */
            const full = !isPicked && (pick.length >= COMPARE_MAX || (pick.length > 0 && pick[0].kind !== p._kind));
            return (
              <li key={key(p)} className={`overflow-hidden rounded-2xl border transition ${isPicked ? "border-brand ring-2 ring-brand/30" : "ow-edge"}`}>
                <div className="flex gap-3 p-2.5">
                  <Link to={href} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink/5 dark:bg-white/5">
                    {coverOf(p) && (
                      <img decoding="async" src={thumbFor(coverOf(p)!)} alt="" loading="lazy"
                        onError={e => { const t = e.currentTarget; if (t.src !== coverOf(p)) t.src = coverOf(p)!; }}
                        className="h-full w-full object-cover" />
                    )}
                    <span className="absolute left-1 top-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                      {rent ? W(lang, "Rent", "Arriendo") : W(lang, "Sale", "Venta")}
                    </span>
                  </Link>
                  <Link to={href} className="min-w-0 flex-1 py-0.5">
                    <p className="truncate text-[14px] font-black tracking-tight">{price}</p>
                    <p className="truncate text-[12.5px] opacity-70">{p.title}</p>
                    {where && <p className="truncate text-[11.5px] opacity-50">{where}</p>}
                    {p._note && noteOpen !== key(p) && <p className="mt-1 line-clamp-2 text-[11.5px] italic opacity-70">“{p._note}”</p>}
                  </Link>
                  <button type="button" onClick={() => togglePick(p)} disabled={full}
                    aria-pressed={isPicked} aria-label={W(lang, "Pick to compare", "Elegir para comparar")}
                    className={`ow-tap grid h-8 w-8 shrink-0 place-items-center self-start rounded-full border-2 transition disabled:opacity-30 ${
                      isPicked ? "border-brand bg-brand text-white" : "border-ink/25 dark:border-white/30"}`}>
                    {isPicked && <IconCheck size={15} />}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 border-t border-ink/[0.06] px-2.5 py-2 dark:border-white/[0.08]">
                  <button type="button" aria-pressed={p._tier === "love"}
                    onClick={() => { const t: Tier = p._tier === "love" ? "like" : "love"; commit(p, { _tier: t }, () => setTier(userId!, p._kind, p.id, t)); }}
                    className={`ow-tap inline-flex shrink-0 items-center whitespace-nowrap gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                      p._tier === "love" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "ow-edge border"}`}>
                    <Heart on={p._tier === "love"} size={14} />{W(lang, "Love", "Me encanta")}
                  </button>
                  <button type="button" aria-pressed={p._seen}
                    onClick={() => { const s = !p._seen; commit(p, { _seen: s }, () => setSeen(userId!, p._kind, p.id, s)); }}
                    className={`ow-tap inline-flex shrink-0 items-center whitespace-nowrap gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                      p._seen ? "bg-brand/10 text-brand-deep dark:text-brand-light" : "ow-edge border"}`}>
                    <IconEye size={14} />{W(lang, "Seen", "Visitado")}
                  </button>
                  <button type="button" onClick={() => setNoteOpen(noteOpen === key(p) ? null : key(p))}
                    className="ow-edge ow-tap ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-bold">
                    <IconWrite size={14} />{p._note ? W(lang, "Note", "Nota") : W(lang, "Add note", "Nota")}
                  </button>
                </div>
                {noteOpen === key(p) && (
                  <div className="px-2.5 pb-2.5">
                    <textarea autoFocus defaultValue={p._note} maxLength={2000} rows={3}
                      placeholder={W(lang, "Only you can see this — e.g. noisy street, ask about parking.", "Solo usted la ve — ej.: calle ruidosa, preguntar por el parqueadero.")}
                      onBlur={e => { const v = e.currentTarget.value; if (v !== p._note) commit(p, { _note: v }, () => setNote(userId!, p._kind, p.id, v)); setNoteOpen(null); }}
                      className="input w-full text-[13px]" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ── COMPARE BAR ──────────────────────────────────────────────────────────────────────
          Appears once something is picked, says how many, and only goes live at two. */}
      {pick.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom,0px))] z-40 mx-auto w-[min(calc(100%-24px),480px)]">
          <div className="flex items-center gap-2 rounded-2xl border border-brand/30 bg-paper/95 p-2 shadow-xl backdrop-blur dark:bg-[#12222D]/95">
            <button type="button" onClick={() => setPick([])} className="ow-tap px-2 text-[12px] font-bold opacity-60">{W(lang, "Clear", "Quitar")}</button>
            <button type="button" disabled={pick.length < 2}
              onClick={() => nav(productHref(prod, `/compare?ids=${encodeURIComponent(encodePick(pick))}`))}
              className="btn-primary inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-45">
              <IconSparkle size={16} />
              {pick.length < 2
                ? W(lang, "Pick 1 more", "Elija 1 más")
                : Wt(lang, "Compare {0} with VAIA", "Comparar {0} con VAIA", [pick.length])}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
