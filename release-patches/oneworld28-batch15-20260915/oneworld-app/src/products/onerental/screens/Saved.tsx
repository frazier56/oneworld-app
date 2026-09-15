import { Link } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading, thumbFor,
} from "@oneworld/shell";
import { priceLabel, type Property } from "../lib/rental";
import { coverOf } from "../lib/media";

/**
 * SAVED — the properties you hearted, rent and sale in one place.
 * ============================================================================================
 * Lee, 11 Aug 2026, on what the centre tab should open with: *"you can have view my saved
 * properties, my favorites, a property pending…"*
 *
 * `saved_items` already existed — `user_id · item_type · item_id` — and nothing in OneHome read
 * it. So the heart on a listing card had nowhere to lead. This is the other end of it.
 *
 * ── TWO READS, NOT A JOIN ───────────────────────────────────────────────────────────────────
 * `saved_items` is polymorphic (`item_type` decides which table `item_id` points at), so there is
 * no foreign key to embed through and PostgREST cannot join it. Fetch the ids, then fetch each
 * table's rows by id: two round trips, both batched, instead of one per card.
 *
 * A saved row whose listing has since been unpublished or deleted simply does not come back, and
 * it is dropped rather than rendered as a broken tile. The saved row is left alone: an agent who
 * pauses a listing for a fortnight should not silently empty everybody's favourites.
 */
export default function Saved() {
  const { lang } = useI18n();
  const { userId } = useOneId();

  const items = useAsync(async () => {
    const { data: saved } = await supabase.from("saved_items")
      .select("item_type, item_id, created_at")
      .eq("user_id", userId!)
      .in("item_type", ["rental_property", "sale_property"])
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = saved ?? [];
    if (!rows.length) return [];

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
            .select("id, title, photos, asking_price, city, neighbourhood, bedrooms, bathrooms, area_m2, status")
            .in("id", saleIds).eq("status", "published")
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const byId = new Map<string, any>();
    for (const r of rent.data ?? []) byId.set(`rental_property:${r.id}`, { ...r, _kind: "rent" });
    for (const r of sale.data ?? []) byId.set(`sale_property:${r.id}`, { ...r, _kind: "sale" });

    /* Keep the ORDER OF SAVING, not the order the two tables came back in. */
    return rows.map(r => byId.get(`${r.item_type}:${r.item_id}`)).filter(Boolean);
  }, [userId], !!userId);

  return (
    <div className="space-y-4 pb-28">
      <ScreenHeading>{W(lang, "Saved", "Guardados")}</ScreenHeading>

      {items === undefined ? (
        <div className="grid grid-cols-2 gap-2.5" aria-busy="true">
          {[0, 1, 2, 3].map(i => <div key={i} className="ow-shimmer aspect-[4/5] rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-bold">{W(lang, "Nothing saved yet.", "Todavía no ha guardado nada.")}</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed opacity-55">
            {W(lang,
              "Tap the heart on any listing and it lands here — so you can put four places side by side instead of scrolling back to find them.",
              "Toque el corazón en cualquier anuncio y aparece aquí — así puede comparar cuatro inmuebles en vez de volver a buscarlos.")}
          </p>
          <Link to={productHref("onerental", "/")} className="btn-primary mt-4 inline-block">
            {W(lang, "Browse places", "Ver inmuebles")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((p: any) => {
            const rent = p._kind === "rent";
            const href = productHref(rent ? "onerental" : "onesale", `${rent ? "/r/" : "/s/"}${p.id}`);
            const where = [p.neighbourhood, p.city].filter(Boolean).join(", ");
            const price = rent
              ? priceLabel(p as Property, lang)
              : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
                  .format(Number(p.asking_price) || 0);
            return (
              <Link key={`${p._kind}-${p.id}`} to={href}
                className="ow-tap overflow-hidden rounded-2xl border border-ink/[0.08] dark:border-white/10">
                <div className="relative aspect-[4/3] bg-ink/5 dark:bg-white/5">
                  {coverOf(p) && (
                    <img src={thumbFor(coverOf(p)!)} alt="" loading="lazy"
                      onError={e => { const t = e.currentTarget; if (t.src !== coverOf(p)) t.src = coverOf(p)!; }}
                      className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/70 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
                    {rent ? W(lang, "For rent", "Arriendo") : W(lang, "For sale", "Venta")}
                  </span>
                </div>
                <div className="px-2 pb-2 pt-1.5">
                  <p className="truncate text-[13px] font-black tracking-tight">{price}</p>
                  <p className="truncate text-[11.5px] opacity-60">{p.title}</p>
                  {where && <p className="truncate text-[11px] opacity-45">{where}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
