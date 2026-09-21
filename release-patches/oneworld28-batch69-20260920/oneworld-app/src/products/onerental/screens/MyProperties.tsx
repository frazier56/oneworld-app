import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W, IconPlus, ScreenHeading,
  HostShowings } from "@oneworld/shell";
import { type Property, PROPERTY_COLUMNS, priceLabel } from "../lib/rental";
import { coverOf } from "@oneworld/shell";
import { rentalMoney, contractStatus } from "../lib/requestDisplay";
import { MoreVertical, Eye, Pencil, Camera, EyeOff, Trash2, X, Clock } from "lucide-react";

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
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");
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

  /* ── ARCHIVE EXISTS NOW, BECAUSE I PROMISED IT AND IT DID NOT — Max's G-1 ────────────────
     The delete dialog told a host to "Archive it instead" and this screen had no Archive. The
     nearest thing was Unpublish, which sets status=draft and leaves the listing sitting in the
     All and Drafts filters — so the sentence promised removal and delivered a listing that had
     not moved. Promising an action that does not exist is worse than the raw Postgres error it
     replaced: that at least did not lie about what to do next.

      was already in the status enum and in LISTING_STATUSES; nothing existed to reach
     it. It is not a delete and must never read as one: the listing, its lease and its walkthrough
     evidence are all intact, it simply leaves the working list. So there is an Archived filter
     too — a place a host cannot get back to is a place they will assume was deleted. */
  const archive = async (p: Property) => {
    setBusy(true); setActionError("");
    const { error } = await supabase.from("rental_properties")
      .update({ status: "archived", is_public: false }).eq("id", p.id).eq("agent_id", userId!);
    setBusy(false);
    if (error) { setActionError(error.message); return; }
    setDeleteTarget(null); window.location.reload();
  };

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
    if (error) {
      /* Verified live on 12 Sep 2026: rental_contracts.property_id is ON DELETE RESTRICT while
         eighteen other children cascade. So the data is already safe and what the host got was the
         raw Postgres line about a foreign key constraint - unreadable outside this file, and the
         shape of refusal Lee calls gaslighting: it does not say what was refused. */
      /* ⚠️ Max G-2: this said "a signed lease" for EVERY 23503. The code checks no particular
         constraint, and a contract in this list may be a draft nobody has signed. Saying a host
         has a signed lease when they have a draft is a new false statement replacing an
         unreadable true one. Name the general fact, which is the one we actually know. */
      setActionError(error.code === "23503"
        ? W(lang, "Something on OneHome still points at this place - usually a contract - so it cannot be deleted. That link is what keeps those records readable for everyone on them. Archive it instead: it leaves your working list and public search, and every record stays intact.",
                  "Algo en OneHome todavía apunta a este inmueble - normalmente un contrato - así que no se puede eliminar. Ese vínculo es lo que mantiene esos registros legibles para todos los implicados. Archívelo: sale de su lista de trabajo y de las búsquedas públicas, y cada registro queda intacto.")
        : error.message);
      return;
    }
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
      /* `tenant_signed_at` is here because Max G-2 caught me inferring "signed" from
         `status !== "draft"`, which calls a SENT contract signed while it is still waiting for
         the tenant. The signature timestamp is the authoritative evidence and it costs one
         column. Never infer a signature from a status again. */
      .select("id, property_id, status, starts_on, ends_on, rent_amount, currency, tenant_name, tenant_signed_at")
      .eq("agent_id", userId).order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  }, [userId]);

  const byProp = (pid: string) => (contracts ?? []).filter((c: any) => c.property_id === pid);
  const publishedCount = (mine ?? []).filter(p => p.status === "published").length;
  const draftCount = (mine ?? []).filter(p => p.status === "draft").length;
  const activeLeaseCount = (contracts ?? []).filter((c: any) => c.status === "active").length;
  /* "All" means everything a host is still working on. An archived listing is reachable only
     through its own filter — otherwise Archive would move a row from one list into the same list
     and the word would mean nothing. */
  const archivedCount = (mine ?? []).filter(p => p.status === "archived").length;
  const workingCount = (mine ?? []).filter(p => p.status !== "archived").length;
  const shown = (mine ?? []).filter(p => filter === "all" ? p.status !== "archived" : p.status === filter);

  /* One call, the shared resolver — never `profiles.plan`, which since 18 Sep 2026 only carries
     the account-wide grant and would show a OneHome Pro host as Free. */
  const plan = useAsync(async () => {
    if (!userId) return "free";
    const { data } = await supabase.rpc("my_plan", { p_app: "onerental" });
    return typeof data === "string" ? data : "free";
  }, [userId]) ?? "free";

  return (
    /* `pb-28` clears the floating tab bar — the last listing card sat underneath it. */
    <div className="space-y-4 pb-28">
      <Link to={productHref("onerental", "/list")} className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to property tools", "Volver a herramientas")}
      </Link>
      {/* Keep the title legible on a 390px phone. VAIA already owns the right side of the heading;
          placing a second button there reduced “My properties” to “My …”. */}
      <ScreenHeading>
        {W(lang, "My rental properties", "Mis inmuebles en arriendo")}
      </ScreenHeading>

      {/* ── ⚠️ THE TWO REQUEST QUEUES LEFT THIS PAGE (Lee, 20 September 2026) ───────────────
          *"You got viewing requests as a section, then you got rental requests as a section, and
          then whatever this bottom section is, which is your actual listings… You can't be
          showing all this on the screen at one time."*

          He is right, and it was worse than crowded: `/requests` rendered the SAME two
          components, so the identical queue existed twice, one tap apart, with nothing saying
          which was authoritative. Two copies of a queue is how a host answers a request on one
          screen and still sees it waiting on the other.

          `/requests` is now the requests page — both queues, one toggle, see the note there —
          and this page is the portfolio. What stays here is the one line a host actually needs
          from it: how many are waiting, and a way through. */}
      <Link to={productHref("onerental", "/requests")}
        /* ⚠️ AMBER, AND NEAR THE TOP. Lee, 20 Sep 2026: *"you should colour the section that
           says showings and requests — that should be like yellow, maybe even with a little blue
           outline or something, because it needs to stand out. The requests are kind of big. It
           should almost be at the top."*

           He is right about the priority: a request has a person waiting on the other end and
           expires by becoming the past, while a listing sits there indefinitely. It was rendered
           as a `card`, identical to everything else on the page, three scrolls down.

           Amber fill, amber edge, and the brand ring he asked for — which also keeps it legible
           as a TAPPABLE thing rather than a warning banner. The ring is brand rather than a flat
           blue so it stays right in both themes and on both hues of OneHome. */
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
              : W(lang, "Rental requests and viewing appointments.",
                        "Solicitudes de arriendo y citas para visitas.")}
          </span>
        </span>
        {pending > 0 && (
          <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-amber-500 px-1.5 text-[11.5px] font-black tabular-nums text-white">
            {pending}
          </span>
        )}
      </Link>


      {/* ── ⚠️ "YOUR PLAN" LEFT THIS PAGE (Lee, 20 September 2026) ──────────────────────────
          *"I don't know if your plan should be at the top. Your plan should be at the bottom, not
          even on this page. Your plan should be within your profile — when you go to your profile
          you should have my host profile, my renter profile, saved properties, calendar, and your
          plan."*

          Right, and it corrects something I got wrong on 18 September. He had asked for a way IN
          to subscriptions, and I put the door on the busiest page in the product rather than on
          the page about him. What you are paying for is a fact about the ACCOUNT, not about the
          rental portfolio — which is the whole argument for VIP being account-wide. It now sits
          under My profile on the hub, beside the other things that belong to the person.

          The limit-side doors are untouched: the photo, description and house-rule caps in the
          listing form each still carry a `PlanUpsell`, which is the moment somebody actually
          wants a bigger plan. */}
      {/* ⚠️ IT WAS A GHOST BUTTON PUSHED TO THE RIGHT MARGIN, with half the row empty beside it
          and nothing explaining why it sat there rather than anywhere else. This is the primary
          action of the page a host opens to manage their places, so it is full width and it is
          the brand colour — the alignment rule Lee has asked for on every screen: a control is
          either in a row with something else or it takes the row. */}
      <Link to={productHref("onerental", "/list")}
        className="btn-brand ow-tap flex w-full items-center justify-center gap-2">
        <IconPlus size={15} />{W(lang, "New property", "Nueva propiedad")}
      </Link>

      {/* ── ⚠️ THE NUMBERS AND THE FILTERS WERE THE SAME FOUR NUMBERS, TWICE ───────────────
          Lee, 20 September 2026: *"The buttons should be sortable on the My Rental Property
          section… those should be active buttons where it has those four sections there. And I
          really think you could probably put all four of those buttons on one row — you're taking
          up a lot of space. You can make those buttons smaller."*

          He is pointing at a redundancy I had not seen: a 2×2 block of tiles reading "Properties
          2 · Published 1" sat directly above a pill bar reading "All 2 · Published 1 · Drafts 1 ·
          Archived 0". The same counts, rendered twice, one set inert and one set live — and the
          inert ones were the bigger, more prominent pair.

          One row now, four tiles, each one the filter it is counting. Smaller, as he asked, and
          the pill bar is gone because it was the second copy.

          `Active leases` was the one number here that is not a filter, so it is a line of text
          under the row rather than a tile you can press and have nothing happen. */}
      <div className="grid grid-cols-4 gap-1.5">
        {([
          ["all", (mine ?? []).length, W(lang, "All", "Todos")],
          ["published", publishedCount, W(lang, "Live", "Activos")],
          ["draft", draftCount, W(lang, "Drafts", "Borradores")],
          ["archived", archivedCount, W(lang, "Archived", "Archivados")],
        ] as const).map(([value, count, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`ow-tap rounded-2xl px-1 py-2.5 text-center transition ${
              filter === value
                ? "bg-brand text-white shadow-sm"
                : "ow-panel"}`}>
            <span className="block text-[17px] font-black tabular-nums leading-none">{count}</span>
            <span className={`mt-1 block truncate text-[10px] font-bold leading-tight ${
              filter === value ? "opacity-90" : "opacity-55"}`}>{label}</span>
          </button>
        ))}
      </div>
      {activeLeaseCount > 0 && (
        <p className="-mt-2 px-1 text-[12px] font-semibold opacity-55">
          {activeLeaseCount === 1
            ? W(lang, "1 active lease.", "1 contrato activo.")
            : W(lang, `${activeLeaseCount} active leases.`, `${activeLeaseCount} contratos activos.`)}
        </p>
      )}

      {/* The count still has to come from somewhere. `HostShowings` is the thing that knows, so
          it is mounted with no height — it reports the number and draws nothing. Cheaper than a
          second query that could disagree with the one on the requests page. */}
      {userId && (
        <div hidden aria-hidden>
          <HostShowings userId={userId} role="host" lang={lang} product="rentals"
            onCount={setPending} />
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
        {mine !== undefined && shown.length === 0 && mine.length> 0 && (
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
                  ? <img decoding="async" src={coverOf(p)!} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                  : <div className="h-20 w-24 shrink-0 rounded-xl bg-ink/5 dark:bg-white/5" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold">{p.title}</p>
                  <p className="text-[12.5px] opacity-60">{priceLabel(p, lang)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Tag>{p.status === "published"
                      ? W(lang, "Published", "Publicado")
                      : p.status === "draft" ? W(lang, "Draft", "Borrador") : p.status}</Tag>
                    {!p.is_public && <Tag>{W(lang, "Private", "Privado")}</Tag>}
                    {active> 0 && <Tag brand>{W(lang, `${active} rented`, `${active} arrendado`)}</Tag>}
                    {/* The state that would otherwise be invisible until someone chased it. */}
                    {waiting> 0 && <Tag warn>{W(lang, `${waiting} awaiting deposit`, `${waiting} esperando depósito`)}</Tag>}
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
                    {p.status !== "archived" && (
                      <button type="button" disabled={busy} onClick={() => { setMenuId(null); void archive(p); }} className="ow-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold hover:bg-ink/5 dark:hover:bg-white/5">
                        <EyeOff size={16}/>{W(lang,"Archive","Archivar")}
                      </button>
                    )}
                    <button type="button" onClick={() => { setMenuId(null); setDeleteTarget(p); }} className="ow-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-red-600 hover:bg-red-500/10">
                      <Trash2 size={16}/>{W(lang,"Delete property","Eliminar inmueble")}
                    </button>
                    </div>
                  </>, document.body
                )}
              {cs.length> 0 && (
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
            {/* This screen already loads every contract for every property, so it KNOWS the
                database will refuse. Offering a red Delete button that cannot work, and then
                explaining the refusal afterwards, is a worse version of the same conversation:
                say it before the tap, and name the thing the host actually wants instead. */}
            {byProp(deleteTarget.id).length> 0 ? (
              <p className="mt-2 text-sm opacity-65" data-testid="delete-blocked-by-lease">{(() => {
                const cs = byProp(deleteTarget.id);
                const signed = cs.filter((c: any) => !!c.tenant_signed_at).length;
                const name = deleteTarget.title || W(lang, "Untitled property", "Inmueble sin título");
                /* Max G-2: byProp carries contracts in EVERY status, so "a signed lease" was a
                   guess. Count them and say which kind, or say the general thing. */
                return signed> 0
                  ? W(lang, `“${name}” has a lease on it, so it cannot be deleted — that is what keeps the signed contract readable for both of you. Archive it instead: it leaves your working list and public search, and the lease itself is untouched.`,
                            `“${name}” tiene un contrato, así que no se puede eliminar — eso mantiene el contrato firmado legible para ambos. Archívelo: sale de su lista de trabajo y de las búsquedas públicas, y el contrato queda intacto.`)
                  : W(lang, `“${name}” has a contract on it, so it cannot be deleted. Archive it instead: it leaves your working list and public search, and every record stays readable to the people on it.`,
                            `“${name}” tiene un contrato, así que no se puede eliminar. Archívelo: sale de su lista de trabajo y de las búsquedas públicas, y cada registro sigue siendo legible para quienes figuran en él.`);
              })()}</p>
            ) : (
              <p className="mt-2 text-sm opacity-65">{W(lang,`“${deleteTarget.title || "Untitled property"}” and its listing data will be permanently removed.`, `“${deleteTarget.title || "Inmueble sin título"}” y sus datos se eliminarán permanentemente.`)}</p>
            )}
            {actionError && <p className="mt-3 text-sm font-bold text-red-600">{actionError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => setDeleteTarget(null)} className="btn-ghost">{W(lang,"Cancel","Cancelar")}</button>{/* ⚠️ Max G-2: a DISABLED red button is still a red button. Lee's rule is hidden, not
                    disabled - a greyed control advertises a feature and then refuses it, which reads
                    as a broken app. When the delete cannot work, the slot carries the action the
                    host actually wants instead of a corpse of the one they cannot have. */}
                {byProp(deleteTarget.id).length> 0 ? (
                  <button type="button" disabled={busy} onClick={() => void archive(deleteTarget)} data-testid="delete-dialog-archive" className="rounded-2xl bg-ink px-4 py-3 font-black text-paper dark:bg-white dark:text-ink">{busy ? "…" : W(lang,"Archive","Archivar")}</button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => void deleteProperty()} className="rounded-2xl bg-red-600 px-4 py-3 font-black text-white">{busy ? "…" : W(lang,"Delete","Eliminar")}</button>
                )}</div>
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

function Tag({ children, brand, warn }: { children: React.ReactNode; brand?: boolean; warn?: boolean }) {
  const tone = brand ? "border-brand/40 text-brand"
    : warn ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
    : "border-ink/12 opacity-65 dark:border-white/15";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>{children}</span>
  );
}
