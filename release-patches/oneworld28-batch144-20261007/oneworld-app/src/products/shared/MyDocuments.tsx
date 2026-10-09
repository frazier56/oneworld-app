import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsyncResult, supabase, productHref, W, ScreenHeading, intlLocale } from "@oneworld/shell";

/**
 * My documents — every agreement this person is part of, sale AND rent, in one list.
 * ============================================================================================
 * Lee, 29 Sep 2026: *"they should have a folder that says like my documents. So they can keep
 * track of, they can pull up an old sale document they need or whatever document."*
 *
 * One screen mounted under both /rentals/documents and /sales/documents — twins, not copies. It
 * reads the two tables the agreements actually live in; row-level security already limits each
 * to the parties, so there is no second access rule here to get wrong.
 */
type Doc = {
  kind: "rent" | "sale"; id: string; title: string; who: string; status: string;
  date: string; href: string;
};

const STATUS: Record<string, { en: string; es: string; tone: "ok" | "wait" | "off" }> = {
  signed: { en: "Signed", es: "Firmado", tone: "ok" },
  active: { en: "Signed · active", es: "Firmado · vigente", tone: "ok" },
  awaiting_first_payment: { en: "Signed · awaiting payment", es: "Firmado · esperando pago", tone: "ok" },
  ended: { en: "Signed · ended", es: "Firmado · terminado", tone: "ok" },
  sent: { en: "Waiting for signatures", es: "Esperando firmas", tone: "wait" },
  draft: { en: "Draft", es: "Borrador", tone: "wait" },
  declined: { en: "Declined", es: "Rechazado", tone: "off" },
  cancelled: { en: "Cancelled", es: "Cancelado", tone: "off" },
  expired: { en: "Expired", es: "Vencido", tone: "off" },
};

export default function MyDocuments({ product }: { product: "onerental" | "onesale" }) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const es = lang === "es" || lang === "co";
  const L: "es" | "en" = es ? "es" : "en";
  const [tab, setTab] = useState<"all" | "rent" | "sale">("all");

  const { data: result, error, retry } = useAsyncResult(async () => {
    if (!userId) return { ownerId: userId, docs: [] as Doc[] };
    const [rc, sa] = await Promise.all([
      supabase.from("rental_contracts")
        .select("id, property_id, status, tenant_name, agent_signed_name, agent_id, created_at, tenant_signed_at")
        .or(`agent_id.eq.${userId},tenant_id.eq.${userId}`).order("created_at", { ascending: false }).limit(200),
      supabase.from("sale_agreements")
        .select("id, property_id, status, seller_name, buyer_name, created_at, completed_at")
        .order("created_at", { ascending: false }).limit(200),
    ]);
    if (rc.error) throw rc.error;
    if (sa.error) throw sa.error;
    const rent = (rc.data ?? []) as any[];
    const sale = (sa.data ?? []) as any[];
    const [rp, sp] = await Promise.all([
      rent.length ? supabase.from("rental_properties").select("id, title").in("id", [...new Set(rent.map(r => r.property_id))]) : Promise.resolve({ data: [] as any[], error: null }),
      sale.length ? supabase.from("sale_properties").select("id, title").in("id", [...new Set(sale.map(r => r.property_id))]) : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (rp.error) throw rp.error;
    if (sp.error) throw sp.error;
    const rt = new Map(((rp.data ?? []) as any[]).map(x => [x.id, x.title]));
    const st = new Map(((sp.data ?? []) as any[]).map(x => [x.id, x.title]));
    return { ownerId: userId, docs: [
      ...rent.map(r => ({
        kind: "rent" as const, id: r.id, status: r.status,
        title: rt.get(r.property_id) ?? W(lang, "Lease", "Arriendo"),
        who: r.agent_id === userId ? (r.tenant_name ?? "") : (r.agent_signed_name ?? ""),
        date: r.tenant_signed_at ?? r.created_at, href: productHref("onerental", `/c/${r.id}`),
      })),
      ...sale.map(r => ({
        kind: "sale" as const, id: r.id, status: r.status,
        title: st.get(r.property_id) ?? W(lang, "Sale agreement", "Promesa de compraventa"),
        who: `${r.seller_name} → ${r.buyer_name}`,
        date: r.completed_at ?? r.created_at, href: productHref("onesale", `/a/${r.id}`),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)) };
  }, [userId, lang]);
  const docs = result?.ownerId === userId ? result.docs : undefined;

  const shown = useMemo(() => (docs ?? []).filter(d => tab === "all" || d.kind === tab), [docs, tab]);
  const count = (k: "all" | "rent" | "sale") => (docs ?? []).filter(d => k === "all" || d.kind === k).length;

  return (
    <div className="space-y-4 pb-28">
      <Link to={productHref(product, product === "onesale" ? "/seller" : "/host-profile")}
        className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to my profile", "Volver a mi perfil")}
      </Link>
      <ScreenHeading>{W(lang, "My documents", "Mis documentos")}</ScreenHeading>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([["all", W(lang, "All", "Todos")], ["rent", W(lang, "Rent", "Arriendo")], ["sale", W(lang, "Sale", "Venta")]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-bold ${tab === k ? "bg-brand text-white" : "ow-edge opacity-75"}`}>
            {label} · {count(k)}
          </button>
        ))}
      </div>

      {!error && docs === undefined && <p className="py-8 text-center opacity-55">…</p>}
      {!error && docs && shown.length === 0 && (
        <div className="ow-panel p-6 text-center">
          <p className="font-bold">{W(lang, "No documents yet", "Aún no hay documentos")}</p>
          <p className="mt-1 text-[13px] opacity-60">
            {W(lang, "Every lease and sale agreement you sign lands here, ready to share or print.",
              "Cada contrato y promesa que firme llega aquí, lista para compartir o imprimir.")}
          </p>
        </div>
      )}

      {!!error && <div role="alert" className="ow-panel p-4">
        <p>{W(lang, "Could not load documents.", "No se pudieron cargar los documentos.")}</p>
        <button type="button" className="btn-ghost mt-2" onClick={retry}>{W(lang, "Try again", "Reintentar")}</button>
      </div>}
      <ul className="space-y-2">
        {shown.map(d => {
          const st = STATUS[d.status] ?? { en: d.status, es: d.status, tone: "wait" as const };
          return (
            <li key={`${d.kind}-${d.id}`}>
              <Link to={d.href} className="ow-panel ow-tap flex items-center gap-3 p-3.5">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-black ${
                  d.kind === "sale" ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" : "bg-teal-500/15 text-teal-700 dark:text-teal-300"}`}>
                  PDF
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{d.title}</span>
                  <span className="block truncate text-[12px] opacity-60">
                    {d.kind === "sale" ? W(lang, "Sale", "Venta") : W(lang, "Rent", "Arriendo")}
                    {d.who ? ` · ${d.who}` : ""}
                  </span>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    st.tone === "ok" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : st.tone === "off" ? "bg-slate-500/15 opacity-70" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>
                    {W(lang, st.en, st.es)}
                  </span>
                  {/* The date sits under the title, not beside it — beside it, it took half the row
                      and cut every property name to three words. */}
                  <span className="ml-2 text-[11.5px] opacity-50">
                    {new Date(d.date).toLocaleDateString(intlLocale(lang), { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
