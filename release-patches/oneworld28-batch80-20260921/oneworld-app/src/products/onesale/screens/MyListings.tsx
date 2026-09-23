import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreVertical, Eye, Pencil, EyeOff, Trash2, X } from "lucide-react";
import { Clock } from "lucide-react";
import { useI18n, useOneId, useAsync, supabase, productHref, W, IconPlus, ScreenHeading, HostShowings } from "@oneworld/shell";
import { type SaleProperty, SALE_COLUMNS, usd } from "../lib/sale";

/** /sales/properties — my listings, in every state. Drafts and private listings live here only. */
export default function MyListings() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [refresh, setRefresh] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaleProperty | null>(null);
  /* Same four states, same one row, same amber row at the top as the rent side — see the notes on
     `onerental/MyProperties`. Lee, 20 Sep 2026: *"Even on the selling side and the properties for
     sale, same thing. Just go through them. Make sure that they're consistent."* Two pages one
     tap apart that lay their own controls out differently is the drift he keeps catching. */
  /* ⚠️ THE FOUR STATES ARE NOT THE SAME FOUR AS THE RENT SIDE. A rental is published, draft or
     archived; a sale is published, draft, under offer, sold or withdrawn. Copying the rent page's
     labels across would have given this page an "Archived" button counting a status that does not
     exist here, always reading zero. Consistent LAYOUT, honest LABELS. */
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "sold">("all");
  const [pending, setPending] = useState(0);
  const mine = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("sale_properties").select(SALE_COLUMNS)
      .eq("agent_id", userId).order("created_at", { ascending: false });
    return (data ?? []) as unknown as SaleProperty[];
  }, [userId, refresh]);

  const all = mine ?? [];
  const publishedCount = all.filter(p => p.status === "published").length;
  const draftCount = all.filter(p => p.status === "draft").length;
  const soldCount = all.filter(p => p.status === "sold").length;
  const shown = filter === "all" ? all.filter(p => p.status !== "withdrawn") : all.filter(p => p.status === filter);

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
    <div className="space-y-4 pb-28">
      <Link to={productHref("onesale", "/")} className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to Properties", "Volver a Inmuebles")}
      </Link>
      {/* Matched to the rent page and to the hub panel — see the note there. */}
      <ScreenHeading>{W(lang, "My properties for sale", "Mis inmuebles en venta")}</ScreenHeading>

      <Link to={productHref("onerental", "/requests")}
        className="ow-tap flex items-center gap-3 rounded-3xl border border-amber-400/55 bg-amber-300/25 px-4 py-3.5 ring-1 ring-brand/35 dark:border-amber-300/35 dark:bg-amber-300/[0.13]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/30 text-amber-800 dark:text-amber-200">
          <Clock size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold leading-tight">
            {W(lang, "Showings & requests", "Visitas y solicitudes")}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug opacity-55">
            {pending > 0
              ? W(lang, `${pending} waiting on you.`, `${pending} esperando su respuesta.`)
              : W(lang, "Viewing appointments on your listings.",
                        "Citas para visitar sus anuncios.")}
          </span>
        </span>
        {pending > 0 && (
          <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-amber-500 px-1.5 text-[11.5px] font-black tabular-nums text-white">
            {pending}
          </span>
        )}
      </Link>
      {/* The number comes from the one component that knows it, drawn at no height — the same
          pattern as the rent side, so the two pages cannot report different counts. */}
      {userId && (
        <div hidden aria-hidden>
          <HostShowings userId={userId} role="host" lang={lang} product="sales" onCount={setPending} />
        </div>
      )}
      {/* ⚠️ THE SAME ORPHANED GHOST BUTTON AS THE RENT SIDE, fixed the same way on the same
          day — a control either shares a row with something else or it takes the row. It also
          said "New", which is an adjective; the rent side says "New property" and this is the
          page where you would want to know new WHAT. */}
      <Link to={productHref("onesale", "/list")}
        className="btn-brand ow-tap flex w-full items-center justify-center gap-2">
        <IconPlus size={15} />{W(lang, "New listing", "Nuevo anuncio")}
      </Link>

      <div className="grid grid-cols-4 gap-1.5">
        {([
          ["all", all.length, W(lang, "All", "Todos")],
          ["published", publishedCount, W(lang, "Live", "Activos")],
          ["draft", draftCount, W(lang, "Drafts", "Borradores")],
          ["sold", soldCount, W(lang, "Sold", "Vendidos")],
        ] as const).map(([value, count, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`ow-tap rounded-2xl px-1 py-2.5 text-center transition ${
              filter === value ? "bg-brand text-white shadow-sm" : "ow-panel"}`}>
            <span className="block text-[17px] font-black tabular-nums leading-none">{count}</span>
            <span className={`mt-1 block truncate text-[10px] font-bold leading-tight ${
              filter === value ? "opacity-90" : "opacity-55"}`}>{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {mine === undefined && [0, 1].map(i => <div key={i} className="ow-panel ow-shimmer h-28 rounded-3xl" />)}
        {mine?.length === 0 && (
          <div className="ow-panel rounded-3xl p-8 text-center">
            <p className="text-sm font-bold">{W(lang, "Nothing listed yet.", "Aún no ha publicado nada.")}</p>
            <Link to={productHref("onesale", "/list")} className="btn-brand mt-4 inline-block">
              {W(lang, "List your first property", "Publicar su primer inmueble")}
            </Link>
          </div>
        )}
        {mine !== undefined && shown.length === 0 && all.length > 0 && (
          <div className="ow-panel rounded-3xl p-6 text-center text-[13px] font-semibold opacity-60">
            {W(lang, "No listings match this filter.", "Ningún anuncio coincide con este filtro.")}
          </div>
        )}
        {shown.map(p => (
          <article key={p.id} className={`ow-panel relative overflow-visible rounded-3xl p-3 ${openId === p.id ? "z-40" : "z-0"}`}>
          <Link to={productHref("onesale", `/s/${p.id}?owner=1`)} className="ow-tap flex gap-3 pr-10">
            {p.photos[0] ? <img decoding="async" src={p.photos[0]} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
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
