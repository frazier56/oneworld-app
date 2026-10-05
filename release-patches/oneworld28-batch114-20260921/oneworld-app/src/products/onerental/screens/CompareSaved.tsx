import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W, Wt, ScreenHeading } from "@oneworld/shell";
import { encodePick, useHomeProduct, type CompareResult, type SavedKind } from "../lib/homeCompare";

/* ============================================================================================
 * SAVED RESULTS — every comparison VAIA has written for this member, newest first.
 *
 * Lee, 2 Oct 2026: "once you do your analysis… you should be able to save the analysis so people
 * can go back to it. Right now when you click off of it, that's it… maybe 'View saved results'."
 * Nothing new is stored: `home_comparisons` already keeps every finished comparison (owner-only
 * read). This is the way back to them; opening one shows it on the Compare screen as it was.
 * ==========================================================================================*/
type Row = { id: string; items: { kind: SavedKind; id: string }[]; result: CompareResult; created_at: string };

export default function CompareSaved() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const prod = useHomeProduct();

  const data = useAsync(async () => {
    if (!userId) return null;
    const { data: rows } = await supabase.from("home_comparisons").select("id, items, result, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    const list = ((rows ?? []) as Row[]).filter(r => Array.isArray(r.items) && r.result?.ranking?.length);
    const ids = (k: SavedKind) => [...new Set(list.flatMap(r => r.items.filter(i => i.kind === k).map(i => i.id)))];
    const [rent, sale] = await Promise.all([
      ids("rent").length ? supabase.from("rental_properties").select("id, title").in("id", ids("rent")) : Promise.resolve({ data: [] as any[] }),
      ids("sale").length ? supabase.from("sale_properties").select("id, title").in("id", ids("sale")) : Promise.resolve({ data: [] as any[] }),
    ]);
    const title = new Map<string, string>([...(rent.data ?? []), ...(sale.data ?? [])].map((p: any) => [p.id, p.title ?? ""]));
    return { list, title };
  }, [userId]);

  const when = (iso: string) => new Date(iso).toLocaleString(lang === "en" ? "en" : "es", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-3 pb-28">
      <Link to={productHref(prod, "/saved")} className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Saved", "Guardados")}
      </Link>
      <ScreenHeading>{W(lang, "Saved results", "Resultados guardados")}</ScreenHeading>
      <p className="-mt-1 text-[12.5px] opacity-65">{W(lang,
        "Every comparison VAIA writes for you is kept here. Open one to read it again.",
        "Cada comparación que VAIA escribe para usted se guarda aquí. Abra una para leerla de nuevo.")}</p>

      {data === undefined ? <div className="ow-shimmer h-24 rounded-2xl" />
        : !data?.list.length ? (
          <div className="card p-4 text-[13px] opacity-75">{W(lang,
            "No saved results yet. Pick two or three saved homes and tap Compare.",
            "Aún no hay resultados. Elija dos o tres inmuebles guardados y toque Comparar.")}</div>
        ) : data.list.map(r => {
          const top = [...r.result.ranking].sort((a, b) => a.rank - b.rank)[0];
          const topName = top ? (data.title.get(top.id) || `${W(lang, "Home", "Inmueble")} ${top.letter}`) : "";
          return (
            <Link key={r.id} to={`${productHref(prod, "/compare")}?ids=${encodeURIComponent(encodePick(r.items))}&result=${r.id}`}
              className="card ow-tap block p-4">
              <p className="text-[11.5px] font-bold uppercase tracking-wide opacity-55">{when(r.created_at)}</p>
              <p className="mt-1 text-[14px] font-black leading-snug">{Wt(lang, "Top pick: {0}", "Mejor opción: {0}", [topName])}</p>
              <p className="mt-0.5 text-[12.5px] opacity-65">{r.items.map(i => data.title.get(i.id) || "—").join(" · ")}</p>
            </Link>
          );
        })}
    </div>
  );
}
