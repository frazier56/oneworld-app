import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading, IconCheck,
} from "@oneworld/shell";
import { rentalMoney } from "../lib/requestDisplay";
import { rentalError } from "../lib/rental";

/**
 * /rentals/c/:id/manage — the host changes a stay that is already running.
 * ============================================================================================
 * Lee, 17 September 2026: *"the property host can always remove the cleaning fee … So the host
 * should have a way to edit an active listing — for edit an active stay. Maybe that's another
 * screen we have to build."*
 *
 * Three things a host actually needs after a lease goes live: give this tenant a break on the
 * rent, waive their cleaning fee, and keep them for longer.
 *
 * ── THE LINE THIS SCREEN DRAWS ──────────────────────────────────────────────────────────────
 * A signed lease is an agreement between two people, so what the host may do alone is not a
 * matter of taste:
 *
 *   · **Cheaper is unilateral.** Nobody needs permission to charge somebody less. A discount and
 *     a waived cleaning fee take effect the moment the host confirms them.
 *   · **Longer is not.** More weeks is more rent and a longer commitment — the tenant's money and
 *     the tenant's calendar. So an extension is an OFFER. It changes nothing until the tenant
 *     accepts it on their own screen.
 *
 * The database enforces both. `rental_host_discount_rent` refuses a rent RISE outright, so this
 * screen cannot become a way to put somebody's rent up without asking them.
 *
 * ── EVERY CHANGE LEAVES A ROW ───────────────────────────────────────────────────────────────
 * Each one writes to `rental_contract_amendments`: what it was, what it became, who did it, when
 * and why. Six months later "why am I being charged this" has an answer that is not somebody's
 * memory. The history is at the bottom of this screen and both sides can read it.
 */
export default function ManageStay() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const es = lang === "es" || lang === "co";
  const T = (en: string, sp: string) => W(lang, en, sp);

  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const c = useAsync(async () => {
    const { data } = await supabase.from("rental_contracts")
      .select("id, property_id, agent_id, tenant_id, tenant_name, starts_on, ends_on, rent_amount, " +
              "currency, status, cleaning_fee, cleaning_fee_waived_at, cleaning_fee_settled_at")
      .eq("id", id).maybeSingle();
    return data as any;
  }, [id, tick]);

  const prop = useAsync(async () => {
    if (!c) return null;
    const { data } = await supabase.from("rental_properties")
      .select("id, title").eq("id", c.property_id).maybeSingle();
    return data as any;
  }, [c?.property_id], !!c);

  const history = useAsync(async () => {
    const { data } = await supabase.from("rental_contract_amendments")
      .select("id, kind, state, old_rent, new_rent, effective_on, old_ends_on, new_ends_on, reason, created_at")
      .eq("contract_id", id).order("created_at", { ascending: false });
    return (data ?? []) as any[];
  }, [id, tick]);

  const money = (n: number) => rentalMoney(n, c?.currency, lang);
  const iAmHost = !!userId && c?.agent_id === userId;
  const active = c?.status === "active";

  /* Form state. The rent field starts EMPTY rather than pre-filled with the current rent: a
     pre-filled amount invites a nudge, and a blank one asks for a decision. */
  const [newRent, setNewRent] = useState("");
  const [rentFrom, setRentFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [rentWhy, setRentWhy] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [endWhy, setEndWhy] = useState("");
  const [feeWhy, setFeeWhy] = useState("");

  async function run(key: string, fn: () => PromiseLike<{ error: unknown }>, done: string) {
    setBusy(key); setErr(null); setOkMsg(null);
    const { error } = await fn();
    setBusy(null);
    if (error) { setErr(rentalError(error, lang)); return; }
    setOkMsg(done); setTick(x => x + 1);
  }

  if (c === undefined) {
    return <div className="mx-auto w-full max-w-[720px] px-4 py-6 text-[13.5px] opacity-60">{T("Loading…", "Cargando…")}</div>;
  }
  if (!c) {
    return <div className="mx-auto w-full max-w-[720px] px-4 py-6 text-[13.5px]">{T("That stay could not be found.", "No se encontró esa estadía.")}</div>;
  }
  if (!iAmHost) {
    /* Not an error page. A tenant who lands here has simply followed a host's link, and the thing
       they want — their own copy of the agreement — is one tap away. */
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-6">
        <section className="card">
          <p className="text-[14px]">{T("Only the host of this stay can change it.", "Solo el anfitrión de esta estadía puede cambiarla.")}</p>
          <Link to={productHref("onerental", `/c/${id}`)} className="btn-ghost mt-3 inline-flex px-4">
            {T("Open the agreement", "Abrir el contrato")}
          </Link>
        </section>
      </div>
    );
  }

  const feeWaived = !!c.cleaning_fee_waived_at;
  const feeSettled = !!c.cleaning_fee_settled_at;
  const hasFee = Number(c.cleaning_fee ?? 0)> 0;
  const openOffer = (history ?? []).find(a => a.kind === "extension" && a.state === "offered");

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-2">
      <ScreenHeading>{T("Manage this stay", "Gestionar esta estadía")}</ScreenHeading>

      <section className="card mt-3">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{T("The stay", "La estadía")}</h2>
        <p className="mt-2 text-[15px] font-black leading-tight">{prop?.title ?? "—"}</p>
        <p className="mt-1 text-[13px] opacity-70">{c.tenant_name || T("Tenant", "Arrendatario")}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 text-[13.5px]">
          <span className="opacity-60">{T("Rent", "Arriendo")}</span>
          <span className="font-bold tabular-nums">{money(Number(c.rent_amount))}</span>
          <span className="opacity-60">{T("Runs", "Va de")}</span>
          <span className="font-bold tabular-nums">{c.starts_on} → {c.ends_on ?? "—"}</span>
        </div>
        {!active && (
          <p className="mt-3 text-[12.5px] opacity-65">
            {T("This stay is not active, so it cannot be changed here.",
               "Esta estadía no está activa, así que no se puede cambiar aquí.")}
          </p>
        )}
      </section>

      {err && <p className="mt-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">{err}</p>}
      {okMsg && <p className="mt-3 rounded-2xl border border-brand/35 bg-brand/10 px-4 py-3 text-[13px] font-semibold text-brand-deep dark:text-brand-light">{okMsg}</p>}

      {/* ── 1 · A DISCOUNT ─────────────────────────────────────────────────────────────────── */}
      <section className="card mt-3">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{T("Give a discount", "Dar un descuento")}</h2>
        <p className="mt-1.5 text-[12.5px] opacity-65">
          {T("This lowers the rent from the date you choose. It applies straight away — your tenant does not have to agree to pay less. To raise the rent you need a new agreement.",
             "Esto baja el arriendo desde la fecha que elijas. Se aplica de inmediato: tu arrendatario no tiene que aceptar pagar menos. Para subirlo se necesita un contrato nuevo.")}
        </p>
        <label className="mt-3 block text-[12px] font-bold opacity-70">{T("New rent", "Nuevo arriendo")}</label>
        <input className="input mt-1 w-full" inputMode="decimal" value={newRent} disabled={!active}
          onChange={e => setNewRent(e.target.value)}
          placeholder={T(`less than ${money(Number(c.rent_amount))}`, `menos de ${money(Number(c.rent_amount))}`)} />
        <label className="mt-3 block text-[12px] font-bold opacity-70">{T("Starting on", "A partir de")}</label>
        <input className="input mt-1 w-full" type="date" value={rentFrom} disabled={!active}
          min={new Date().toISOString().slice(0, 10)} onChange={e => setRentFrom(e.target.value)} />
        <label className="mt-3 block text-[12px] font-bold opacity-70">{T("Why (optional)", "Motivo (opcional)")}</label>
        <input className="input mt-1 w-full" value={rentWhy} disabled={!active} maxLength={140}
          onChange={e => setRentWhy(e.target.value)}
          placeholder={T("Long-stay discount", "Descuento por estadía larga")} />
        <button type="button" className="btn-primary ow-tap mt-3 w-full px-4 py-3 disabled:opacity-45"
          disabled={!active || busy === "rent" || !newRent.trim()}
          onClick={() => void run("rent",
            () => supabase.rpc("rental_host_discount_rent", {
              p_contract: id, p_new_rent: Number(newRent), p_effective_on: rentFrom, p_reason: rentWhy || null,
            }).then(r => ({ error: r.error })),
            T("Rent lowered.", "Arriendo reducido."))}>
          {busy === "rent" ? "…" : T("Lower the rent", "Bajar el arriendo")}
        </button>
      </section>

      {/* ── 2 · THE CLEANING FEE ───────────────────────────────────────────────────────────── */}
      <section className="card mt-3">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{T("Cleaning fee", "Tarifa de limpieza")}</h2>
        {!hasFee ? (
          <p className="mt-1.5 text-[12.5px] opacity-65">{T("This stay has no cleaning fee.", "Esta estadía no tiene tarifa de limpieza.")}</p>
        ) : feeSettled ? (
          <p className="mt-1.5 text-[12.5px] opacity-65">
            {T("Already settled at checkout, so it can no longer be changed.",
               "Ya se liquidó en el checkout, así que ya no se puede cambiar.")}
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[12.5px] opacity-65">
              {T("Charged once, when the tenant checks out. If they book again before the stay ends, it carries over instead.",
                 "Se cobra una sola vez, cuando el arrendatario hace el checkout. Si reserva de nuevo antes de que termine la estadía, se traslada.")}
            </p>
            <p className="mt-2 text-[14px] font-bold tabular-nums">
              {money(Number(c.cleaning_fee))}
              {feeWaived && <span className="ml-2 text-[12px] font-bold text-brand">{T("waived", "exonerada")}</span>}
            </p>
            <input className="input mt-3 w-full" value={feeWhy} maxLength={140} onChange={e => setFeeWhy(e.target.value)}
              placeholder={T("Why (optional)", "Motivo (opcional)")} />
            <button type="button" className="btn-ghost ow-tap mt-3 w-full px-4 py-3 disabled:opacity-45"
              disabled={busy === "fee"}
              onClick={() => void run("fee",
                () => supabase.rpc("rental_host_waive_cleaning_fee", {
                  p_contract: id, p_waive: !feeWaived, p_reason: feeWhy || null,
                }).then(r => ({ error: r.error })),
                feeWaived ? T("Cleaning fee put back.", "Tarifa de limpieza restablecida.")
                          : T("Cleaning fee waived.", "Tarifa de limpieza exonerada."))}>
              {busy === "fee" ? "…" : feeWaived
                ? T("Put the cleaning fee back", "Restablecer la tarifa")
                : T("Waive the cleaning fee", "Exonerar la tarifa")}
            </button>
          </>
        )}
      </section>

      {/* ── 3 · AN EXTENSION ───────────────────────────────────────────────────────────────── */}
      <section className="card mt-3">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{T("Extend the stay", "Extender la estadía")}</h2>
        <p className="mt-1.5 text-[12.5px] opacity-65">
          {T("This is an offer, not a change. More weeks means more rent and a longer commitment, so nothing moves until your tenant accepts it.",
             "Esto es una oferta, no un cambio. Más semanas significa más arriendo y un compromiso más largo, así que nada cambia hasta que tu arrendatario lo acepte.")}
        </p>
        {openOffer && (
          <p className="mt-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[12.5px] font-semibold text-amber-700 dark:text-amber-300">
            {T(`Waiting on your tenant to answer an offer to run until ${openOffer.new_ends_on}. Sending a new one replaces it.`,
               `Esperando que tu arrendatario responda una oferta hasta ${openOffer.new_ends_on}. Enviar otra la reemplaza.`)}
          </p>
        )}
        <label className="mt-3 block text-[12px] font-bold opacity-70">{T("New end date", "Nueva fecha de fin")}</label>
        <input className="input mt-1 w-full" type="date" value={newEnd} disabled={!active}
          min={c.ends_on ?? undefined} onChange={e => setNewEnd(e.target.value)} />
        <label className="mt-3 block text-[12px] font-bold opacity-70">{T("Why (optional)", "Motivo (opcional)")}</label>
        <input className="input mt-1 w-full" value={endWhy} disabled={!active} maxLength={140}
          onChange={e => setEndWhy(e.target.value)} />
        <button type="button" className="btn-ghost ow-tap mt-3 w-full px-4 py-3 disabled:opacity-45"
          disabled={!active || busy === "ext" || !newEnd}
          onClick={() => void run("ext",
            () => supabase.rpc("rental_host_offer_extension", {
              p_contract: id, p_new_ends_on: newEnd, p_reason: endWhy || null,
            }).then(r => ({ error: r.error })),
            T("Offer sent to your tenant.", "Oferta enviada a tu arrendatario."))}>
          {busy === "ext" ? "…" : T("Offer the extension", "Ofrecer la extensión")}
        </button>
      </section>

      {/* ── WHAT HAS BEEN CHANGED ──────────────────────────────────────────────────────────── */}
      <section className="card mt-3">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{T("Changes to this stay", "Cambios en esta estadía")}</h2>
        {!history?.length ? (
          <p className="mt-1.5 text-[12.5px] opacity-65">{T("Nothing has been changed yet.", "Todavía no se ha cambiado nada.")}</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {history.map(a => (
              <li key={a.id} className="flex gap-2.5 text-[13px] leading-snug">
                <span className="mt-0.5 shrink-0 text-brand"><IconCheck size={14} /></span>
                <span className="min-w-0">
                  <span className="font-bold">{amendmentLine(a, lang, money)}</span>
                  {a.reason && <span className="opacity-70"> — {a.reason}</span>}
                  <span className="block text-[11.5px] opacity-50 tabular-nums">
                    {new Date(a.created_at).toLocaleDateString(es ? "es-CO" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to={productHref("onerental", `/c/${id}`)} className="btn-ghost ow-tap mt-3 flex w-full justify-center px-4 py-3">
        {T("Back to the agreement", "Volver al contrato")}
      </Link>
    </div>
  );
}

/** One sentence per change, in the reader's language — never the raw enum. */
function amendmentLine(a: any, lang: string, money: (n: number) => string) {
  const T = (en: string, sp: string) => W(lang, en, sp);
  if (a.kind === "rent_discount") {
    return T(`Rent lowered from ${money(Number(a.old_rent))} to ${money(Number(a.new_rent))}, from ${a.effective_on}`,
             `Arriendo bajado de ${money(Number(a.old_rent))} a ${money(Number(a.new_rent))}, desde ${a.effective_on}`);
  }
  if (a.kind === "cleaning_fee_waiver") {
    return T("Cleaning fee changed", "Tarifa de limpieza cambiada");
  }
  const to = `${a.old_ends_on} → ${a.new_ends_on}`;
  if (a.state === "accepted") return T(`Stay extended, ${to}`, `Estadía extendida, ${to}`);
  if (a.state === "declined") return T(`Extension declined, ${to}`, `Extensión rechazada, ${to}`);
  if (a.state === "withdrawn") return T(`Extension offer replaced, ${to}`, `Oferta de extensión reemplazada, ${to}`);
  return T(`Extension offered, ${to}`, `Extensión ofrecida, ${to}`);
}
