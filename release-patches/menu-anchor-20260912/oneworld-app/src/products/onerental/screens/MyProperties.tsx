import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W, IconPlus, ScreenHeading,
  HostShowings } from "@oneworld/shell";
import { type Property, PROPERTY_COLUMNS, priceLabel } from "../lib/rental";
import { coverOf } from "../lib/media";
import { rentalMoney, contractStatus } from "../lib/requestDisplay";
import RentalRequests from "../components/RentalRequests";
import { MoreVertical, Eye, Pencil, Camera, EyeOff, Trash2, X } from "lucide-react";

/**
 * /rentals/properties — the manager's own listings, in every state.
 * ============================================================================================
 * Drafts and private listings are visible HERE and nowhere else, which is the whole difference
 * between this screen and the feed. RLS enforces it rather than the query: `agent_id = auth.uid()`
 * is in the select policy, so a mistake in this file cannot leak somebody's drafts.
 */
export default function MyProperties() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  /* How many viewings are waiting on this person. Reported up by `HostShowings` so the count and
     the list can never disagree — a badge computed by a second query is a badge that eventually
     says "2" over an empty list. */
  const [pending, setPending] = useState(0);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 12, right: 12 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const closeMenu = (restoreFocus = false) => {
    setMenuId(null);
    if (restoreFocus) window.setTimeout(() => menuTriggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!menuId) return;
    menuRef.current?.querySelector<HTMLElement>("a, button:not([disabled])")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuId]);

  /* Measure the menu after it is rendered. Its contents differ for draft and published
     properties, so a guessed height can strand the final actions below the phone viewport.
     Re-run while the page/visual viewport moves so browser chrome and the fixed footer are
     accounted for as well. */
  useLayoutEffect(() => {
    if (!menuId) return;
    const placeMenu = () => {
      const menu = menuRef.current;
      const trigger = menuTriggerRef.current;
      if (!menu || !trigger) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom = viewportTop + viewportHeight;
      const margin = 12;
      const footerClearance = 76;
      const availableBottom = viewportBottom - footerClearance;
      const menuHeight = Math.min(menu.scrollHeight, Math.max(160, availableBottom - viewportTop - margin * 2));
      const rect = trigger.getBoundingClientRect();
      const desiredTop = rect.top + rect.height / 2 - menuHeight / 2;
      setMenuPosition(current => ({
        top: Math.max(viewportTop + margin, Math.min(desiredTop, availableBottom - menuHeight - margin)),
        right: current.right,
      }));
    };
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    window.visualViewport?.addEventListener("resize", placeMenu);
    window.visualViewport?.addEventListener("scroll", placeMenu);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      window.visualViewport?.removeEventListener("resize", placeMenu);
      window.visualViewport?.removeEventListener("scroll", placeMenu);
    };
  }, [menuId]);

  const unpublish = async (p: Property) => {
    setBusy(true); setActionError("");
    const { error } = await supabase.from("rental_properties")
      .update({ status: "draft", is_public: false }).eq("id", p.id).eq("agent_id", userId!);
    setBusy(false);
    if (error) { setActionError(error.message); return; }
    window.location.reload();
  };

  const deleteProperty = async () => {
    if (!deleteTarget) return;
    setBusy(true); setActionError("");
    const { error } = await supabase.from("rental_properties")
      .delete().eq("id", deleteTarget.id).eq("agent_id", userId!);
    setBusy(false);
    if (error) { setActionError(error.message); return; }
    setDeleteTarget(null); window.location.reload();
  };

  const mine = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("rental_properties")
      .select(PROPERTY_COLUMNS).eq("agent_id", userId).order("created_at", { ascending: false });
    return (data ?? []) as unknown as Property[];
  }, [userId]);

  const contracts = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("rental_contracts")
      .select("id, property_id, status, starts_on, ends_on, rent_amount, currency, tenant_name")
      .eq("agent_id", userId).order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  }, [userId]);

  const byProp = (pid: string) => (contracts ?? []).filter((c: any) => c.property_id === pid);
  const publishedCount = (mine ?? []).filter(p => p.status === "published").length;
  const draftCount = (mine ?? []).filter(p => p.status === "draft").length;
  const activeLeaseCount = (contracts ?? []).filter((c: any) => c.status === "active").length;
  const shown = (mine ?? []).filter(p => filter === "all" || p.status === filter);

  return (
    <div className="space-y-4">
      <Link to={productHref("onerental", "/list")} className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to property tools", "Volver a herramientas")}
      </Link>
      {/* Keep the title legible on a 390px phone. VAIA already owns the right side of the heading;
          placing a second button there reduced “My properties” to “My …”. */}
      <ScreenHeading>
        {W(lang, "My rental properties", "Mis inmuebles en arriendo")}
      </ScreenHeading>
      <div className="-mt-2 flex justify-end">
        <Link to={productHref("onerental", "/list")} className="btn-ghost inline-flex items-center gap-1.5">
          <IconPlus size={14} />{W(lang, "New property", "Nueva propiedad")}
        </Link>
      </div>

      <section aria-label={W(lang, "Portfolio summary", "Resumen del portafolio")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric value={(mine ?? []).length} label={W(lang, "Properties", "Inmuebles")} />
        <Metric value={publishedCount} label={W(lang, "Published", "Publicados")} brand />
        <Metric value={activeLeaseCount} label={W(lang, "Active leases", "Contratos activos")} />
        <Metric value={pending} label={W(lang, "Viewing requests", "Solicitudes de visita")} warn={pending > 0} />
      </section>

      {/* ── WHO WANTS TO SEE YOUR PLACES ────────────────────────────────────────────────────
          ABOVE the listings, and that ordering is the point. A viewing request has somebody
          waiting on the other end of it and expires by simply becoming the past; a listing sits
          there indefinitely. The thing with a clock on it goes first.

          It renders itself away when there is nothing to show — see the empty state in
          HostShowings — so this section costs a host with no requests exactly one line. */}
      {userId && (
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-black uppercase tracking-wide opacity-55">
            {W(lang, "Viewing requests", "Solicitudes de visita")}
            {pending > 0 && (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-black tabular-nums text-white">
                {pending}
              </span>
            )}
          </h2>
          <HostShowings userId={userId} role="host" lang={lang} product="rentals"
            onCount={setPending} />
        </section>
      )}

      <RentalRequests />
      {mine && mine.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-white/40 bg-white/35 p-1.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
          {([
            ["all", W(lang, `All ${mine.length}`, `Todos ${mine.length}`)],
            ["published", W(lang, `Published ${publishedCount}`, `Publicados ${publishedCount}`)],
            ["draft", W(lang, `Drafts ${draftCount}`, `Borradores ${draftCount}`)],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
              className={`ow-tap whitespace-nowrap rounded-xl px-3 py-2 text-[12px] font-black ${filter === value ? "bg-brand text-white shadow-sm" : "opacity-60"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {mine === undefined && [0, 1].map(i => <div key={i} className="card ow-shimmer h-28" />)}
        {mine?.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm font-bold">{W(lang, "Nothing listed yet.", "Aún no ha publicado nada.")}</p>
            <Link to={productHref("onerental", "/list")} className="btn-brand mt-4 inline-block">
              {W(lang, "List your first place", "Publicar su primer inmueble")}
            </Link>
          </div>
        )}
        {mine !== undefined && shown.length === 0 && mine.length > 0 && (
          <div className="card p-6 text-center text-[13px] font-semibold opacity-60">
            {W(lang, "No properties match this filter.", "Ningún inmueble coincide con este filtro.")}
          </div>
        )}
        {shown.map(p => {
          const cs = byProp(p.id);
          const active = cs.filter((c: any) => c.status === "active").length;
          const waiting = cs.filter((c: any) => c.status === "awaiting_first_payment").length;
          return (
            <article key={p.id} className={`card relative overflow-visible p-0 ${menuId === p.id ? "z-40" : "z-0"}`}>
              {/* `?owner=1` — this is the surface that grants the owner's view of a listing. The feed
                  deliberately does not. See PropertyDetail. */}
              <Link to={productHref("onerental", `/r/${p.id}?owner=1`)} className="flex gap-3 p-3 pr-14">
                {coverOf(p)
                  ? <img src={coverOf(p)!} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                  : <div className="h-20 w-24 shrink-0 rounded-xl bg-ink/5 dark:bg-white/5" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold">{p.title}</p>
                  <p className="text-[12.5px] opacity-60">{priceLabel(p, lang)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Tag>{p.status === "published"
                      ? W(lang, "Published", "Publicado")
                      : p.status === "draft" ? W(lang, "Draft", "Borrador") : p.status}</Tag>
                    {!p.is_public && <Tag>{W(lang, "Private", "Privado")}</Tag>}
                    {active > 0 && <Tag brand>{W(lang, `${active} rented`, `${active} arrendado`)}</Tag>}
                    {/* The state that would otherwise be invisible until someone chased it. */}
                    {waiting > 0 && <Tag warn>{W(lang, `${waiting} awaiting deposit`, `${waiting} esperando depósito`)}</Tag>}
                  </div>
                </div>
              </Link>
              <button type="button" aria-label={W(lang, "Property actions", "Acciones del inmueble")}
                  onClick={(event) => {
                    if (menuId === p.id) { closeMenu(true); return; }
                    menuTriggerRef.current = event.currentTarget;
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenuPosition({
                      top: 12,
                      right: Math.max(12, window.innerWidth - rect.right + 6),
                    });
                    setMenuId(p.id);
                  }}
                  className="ow-tap absolute bottom-0 right-0 top-0 grid w-14 place-items-center text-ink/60 transition hover:text-ink dark:text-white/65 dark:hover:text-white">
                  <MoreVertical size={19} />
                </button>
                {menuId === p.id && createPortal(
                  <>
                    <div aria-hidden="true" className="fixed inset-0 z-[999]" onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      closeMenu(true);
                    }} />
                    <div ref={menuRef} role="menu" aria-label={W(lang, "Property actions", "Acciones del inmueble")}
                      className="fixed z-[1000] max-h-[calc(100dvh-100px)] w-64 overscroll-contain overflow-y-auto rounded-2xl border border-ink/10 bg-white p-1.5 shadow-2xl dark:border-white/15 dark:bg-zinc-900"
                      style={{ top: menuPosition.top, right: menuPosition.right }}>
                    <MenuLink icon={<Eye size={16}/>} to={`/r/${p.id}?owner=1`} label={W(lang,"View listing","Ver anuncio")} />
                    <MenuLink icon={<Pencil size={16}/>} to={`/list?form=1&edit=${p.id}`} label={W(lang,"Edit listing","Editar anuncio")} />
                    <MenuLink icon={<Camera size={16}/>} to={`/list?form=1&edit=${p.id}&section=walkthrough`}
                      label={W(lang,"Manage move-in evidence","Administrar evidencia de entrega")}
                      sub={W(lang,"Private photos and videos for owner–tenant sign-off.","Fotos y videos privados para aprobación.")} />
                    {p.status === "published" && (
                      <button type="button" disabled={busy} onClick={() => void unpublish(p)} className="ow-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold hover:bg-ink/5 dark:hover:bg-white/5">
                        <EyeOff size={16}/>{W(lang,"Unpublish to draft","Retirar y guardar como borrador")}
                      </button>
                    )}
                    {p.status === "draft" && (
                      <MenuLink icon={<Eye size={16}/>} to={`/list?form=1&edit=${p.id}&publish=1`}
                        label={W(lang,"Review & publish","Revisar y publicar")}
                        sub={W(lang,"Confirm the listing and required terms before it goes live.","Confirme el anuncio y los términos requeridos antes de publicarlo.")} />
                    )}
                    <button type="button" onClick={() => { setMenuId(null); setDeleteTarget(p); }} className="ow-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-red-600 hover:bg-red-500/10">
                      <Trash2 size={16}/>{W(lang,"Delete property","Eliminar inmueble")}
                    </button>
                    </div>
                  </>, document.body
                )}
              {cs.length > 0 && (
                <div className="border-t border-ink/[0.07] px-3 py-2 dark:border-white/10">
                  {cs.slice(0, 3).map((c: any) => (
                    <Link key={c.id} to={productHref("onerental", `/c/${c.id}`)}
                      className="ow-tap flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                      <span className="min-w-0 opacity-75">
                        <span className="block font-bold">{contractStatus(c.status, lang)}</span>
                        {c.tenant_name ?? W(lang, "Tenant", "Arrendatario")} · {c.starts_on} → {c.ends_on}
                      </span>
                      <span className="font-bold">{rentalMoney(Number(c.rent_amount), c.currency || p.currency, lang)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-5" role="dialog" aria-modal="true" aria-labelledby="delete-property-title">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3"><h2 id="delete-property-title" className="text-lg font-black">{W(lang,"Delete this property?","¿Eliminar este inmueble?")}</h2><button type="button" onClick={() => setDeleteTarget(null)} aria-label="Close"><X/></button></div>
            <p className="mt-2 text-sm opacity-65">{W(lang,`“${deleteTarget.title || "Untitled property"}” and its listing data will be permanently removed.`, `“${deleteTarget.title || "Inmueble sin título"}” y sus datos se eliminarán permanentemente.`)}</p>
            {actionError && <p className="mt-3 text-sm font-bold text-red-600">{actionError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => setDeleteTarget(null)} className="btn-ghost">{W(lang,"Cancel","Cancelar")}</button><button type="button" disabled={busy} onClick={() => void deleteProperty()} className="rounded-2xl bg-red-600 px-4 py-3 font-black text-white">{busy ? "…" : W(lang,"Delete","Eliminar")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ icon, to, label, sub }: { icon: React.ReactNode; to: string; label: string; sub?: string }) {
  return <Link to={productHref("onerental", to)} className="ow-tap flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-ink/5 dark:hover:bg-white/5">
    <span className="mt-0.5 shrink-0">{icon}</span><span><span className="block text-[13px] font-bold">{label}</span>{sub && <span className="block text-[10.5px] leading-snug opacity-55">{sub}</span>}</span>
  </Link>;
}

function Metric({ value, label, brand, warn }: { value: number; label: string; brand?: boolean; warn?: boolean }) {
  const tone = brand ? "text-brand" : warn ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <div className="rounded-2xl border border-white/45 bg-white/45 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
      <p className={`text-[22px] font-black tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[10.5px] font-bold leading-tight opacity-55">{label}</p>
    </div>
  );
}

function Tag({ children, brand, warn }: { children: React.ReactNode; brand?: boolean; warn?: boolean }) {
  const tone = brand ? "border-brand/40 text-brand"
    : warn ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
    : "border-ink/12 opacity-65 dark:border-white/15";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>{children}</span>
  );
}
