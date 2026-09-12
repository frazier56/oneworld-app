import { useI18n, useOneId, useAsync, supabase, W } from "@oneworld/shell";

/**
 * OneSale's profile slots. ProfileScreen itself is SHELL and is never rebuilt.
 *
 * ── `SaleTiles` IS `RentalTiles` (11 Aug 2026) ───────────────────────────────────────────────
 * This used to be its own grid: sale listings only, no filter, no personal media, 60 rows in one
 * request. That is the drift Lee's consolidation was meant to end — *"let's just combine them
 * together… that way everything is in one area. It'll consolidate the real estate space."*
 *
 * An agent does not have a rental self and a sale self. They have properties, some to let and
 * some to sell, and OneHome is ONE app whose two halves are sections. Standing on `/sales/profile`
 * and seeing only half of your own portfolio is the same defect as standing on `/rentals/profile`
 * and seeing only the other half — which is exactly the regression I caught on the public page.
 *
 * `RentalTiles` already reads BOTH tables, tags every tile Rent or Sale, carries the
 * All · Properties · Personal filter, caps the profile at four rows with a See-all wall, and
 * pages the fetch. Re-exporting is the only way those five things stay true on both routes.
 */
export { RentalTiles as SaleTiles } from "../../onerental/screens/ProfileSlots";

export function SaleStats() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const s = useAsync(async () => {
    if (!userId) return null;
    const [{ count: live }, { count: sold }] = await Promise.all([
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId).in("status", ["published", "under_offer"]),
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId).eq("status", "sold"),
    ]);
    return { live: live ?? 0, sold: sold ?? 0 };
  }, [userId]);
  const Cell = ({ n, label }: { n: number; label: string }) => (
    <div className="flex-1 text-center">
      <p className="text-[20px] font-black tracking-tight">{n}</p>
      <p className="text-[11px] leading-tight opacity-55">{label}</p>
    </div>
  );
  return (
    <div className="card mt-3 flex p-3">
      <Cell n={s?.live ?? 0} label={W(lang, "For sale now", "En venta")} />
      <Cell n={s?.sold ?? 0} label={W(lang, "Sold", "Vendidos")} />
    </div>
  );
}
