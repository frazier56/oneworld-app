import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreVertical, Eye, Pencil, EyeOff, Trash2, X } from "lucide-react";
import { useI18n, useOneId, useAsync, supabase, productHref, W, IconPlus, ScreenHeading } from "@oneworld/shell";
import { type SaleProperty, SALE_COLUMNS, usd } from "../lib/sale";

/** /sales/properties — my listings, in every state. Drafts and private listings live here only. */
export default function MyListings() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [refresh, setRefresh] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaleProperty | null>(null);
  const mine = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("sale_properties").select(SALE_COLUMNS)
      .eq("agent_id", userId).order("created_at", { ascending: false });
    return (data ?? []) as unknown as SaleProperty[];
  }, [userId, refresh]);

  const unpublish = async (p: SaleProperty) => {
    await supabase.from("sale_properties").update({ status: "draft", is_public: false }).eq("id", p.id).eq("agent_id", userId!);
    setOpenId(null); setRefresh(v => v + 1);
  };

  const remove = async () => {
    if (!deleteTarget || !userId) return;
    await supabase.from("sale_properties").delete().eq("id", deleteTarget.id).eq("agent_id", userId);
    setDeleteTarget(null); setRefresh(v => v + 1);
  };

  return (
    <div className="space-y-4">
      <Link to={productHref("onesale", "/")} className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to buying and selling", "Volver a comprar y vender")}
      </Link>
      <ScreenHeading>{W(lang, "My listings for sale", "Mis anuncios en venta")}</ScreenHeading>
      <div className="-mt-2 flex justify-end">
        <Link to={productHref("onesale", "/list")} className="btn-ghost inline-flex items-center gap-1.5">
          <IconPlus size={14} />{W(lang, "New", "Nuevo")}
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {mine === undefined && [0, 1].map(i => <div key={i} className="card ow-shimmer h-28" />)}
        {mine?.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm font-bold">{W(lang, "Nothing listed yet.", "Aún no ha publicado nada.")}</p>
            <Link to={productHref("onesale", "/list")} className="btn-brand mt-4 inline-block">
              {W(lang, "List your first property", "Publicar su primer inmueble")}
            </Link>
          </div>
        )}
        {mine?.map(p => (
          <article key={p.id} className={`card relative overflow-visible p-3 ${openId === p.id ? "z-40" : "z-0"}`}>
          <Link to={productHref("onesale", `/s/${p.id}?owner=1`)} className="ow-tap flex gap-3 pr-10">
            {p.photos[0] ? <img src={p.photos[0]} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                         : <div className="h-20 w-24 shrink-0 rounded-xl bg-ink/5 dark:bg-white/5" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold">{p.title}</p>
              <p className="text-[12.5px] opacity-60">{usd(p.asking_price)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Tag>{p.status === "published" ? W(lang, "Published", "Publicado")
                    : p.status === "draft" ? W(lang, "Draft", "Borrador")
                    : p.status === "under_offer" ? W(lang, "Under offer", "En negociación")
                    : p.status === "sold" ? W(lang, "Sold", "Vendido") : p.status}</Tag>
                {!p.is_public && <Tag>{W(lang, "Private", "Privado")}</Tag>}
                {!p.matricula_inmobiliaria && <Tag warn>{W(lang, "No matrícula", "Sin matrícula")}</Tag>}
              </div>
            </div>
          </Link>
          <button type="button" aria-label={W(lang, "Property actions", "Acciones del inmueble")}
            onClick={() => setOpenId(openId === p.id ? null : p.id)}
            className="ow-tap absolute bottom-0 right-0 top-0 grid w-14 place-items-center text-ink/60 transition hover:text-ink dark:text-white/65 dark:hover:text-white">
            <MoreVertical size={20} />
          </button>
          {openId === p.id && <div className="absolute right-3 top-1/2 z-50 w-64 overflow-hidden rounded-2xl border border-ink/10 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#182328]">
            <MenuLink to={productHref("onesale", `/s/${p.id}?owner=1`)} icon={<Eye size={17} />}>{W(lang, "View listing", "Ver anuncio")}</MenuLink>
            <MenuLink to={productHref("onesale", `/list?edit=${p.id}`)} icon={<Pencil size={17} />}>{W(lang, "Edit listing", "Editar anuncio")}</MenuLink>
            {p.status === "published" && <MenuButton icon={<EyeOff size={17} />} onClick={() => unpublish(p)}>{W(lang, "Unpublish to draft", "Retirar a borrador")}</MenuButton>}
            <MenuButton danger icon={<Trash2 size={17} />} onClick={() => { setOpenId(null); setDeleteTarget(p); }}>{W(lang, "Delete", "Eliminar")}</MenuButton>
          </div>}
          </article>
        ))}
      </div>
      {deleteTarget && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-5" onClick={() => setDeleteTarget(null)}>
        <div className="card relative w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
          <button type="button" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink/5 dark:bg-white/10" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
          <h2 className="pr-9 text-xl font-black">{W(lang, "Delete this listing?", "¿Eliminar este anuncio?")}</h2>
          <p className="mt-2 text-sm opacity-65">{W(lang, "This permanently removes the property. Unpublish it instead if you may need it later.", "Esto elimina el inmueble permanentemente. Retírelo a borrador si podría necesitarlo después.")}</p>
          <div className="mt-5 flex gap-2"><button type="button" className="btn-ghost flex-1" onClick={() => setDeleteTarget(null)}>{W(lang, "Cancel", "Cancelar")}</button><button type="button" className="flex-1 rounded-2xl bg-red-600 px-4 py-3 font-bold text-white" onClick={remove}>{W(lang, "Delete", "Eliminar")}</button></div>
        </div>
      </div>}
    </div>
  );
}
function MenuLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link to={to} className="ow-tap flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-ink/5 dark:hover:bg-white/5">{icon}{children}</Link>;
}
function MenuButton({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`ow-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-ink/5 dark:hover:bg-white/5 ${danger ? "text-red-600" : ""}`}>{icon}{children}</button>;
}
function Tag({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
    warn ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "border-ink/12 opacity-65 dark:border-white/15"}`}>{children}</span>;
}
