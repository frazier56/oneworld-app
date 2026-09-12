import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading, GlassDate, GlassSelect } from "@oneworld/shell";

type Blackout = { id: string; property_id: string; starts_on: string; ends_on: string; note: string | null };

function isoDay(offset = 0) {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/**
 * /rentals/calendar — what is booked, and when.
 * ============================================================================================
 * A nightly listing without an availability view is a listing that double-books. It does not sit
 * in the footer (the 8-Aug locks put Calendar on Job/Event/Agent only), so it lives in the drawer.
 *
 * IMPORTANT: this screen is a VIEW, never the guard. Overlap is refused by a database exclusion
 * constraint (`rental_no_double_booking`) — a check written in a screen loses every race it is
 * ever in, and the second booking of a popular week is exactly a race.
 */
export default function CalendarScreen() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [refresh, setRefresh] = useState(0);
  const [propertyId, setPropertyId] = useState("");
  const [startsOn, setStartsOn] = useState(isoDay());
  const [endsOn, setEndsOn] = useState(isoDay(1));
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("rental_contracts")
      .select("id, property_id, starts_on, ends_on, status, tenant_name")
      .or(`agent_id.eq.${userId},tenant_id.eq.${userId}`)
      .in("status", ["awaiting_first_payment", "active"])
      .order("starts_on");
    return data ?? [];
  }, [userId]);

  const ownedResult = useAsync(async () => {
    if (!userId) return { data: [], error: null };
    return await supabase.from("rental_properties")
      .select("id, title").eq("agent_id", userId).order("title");
  }, [userId, refresh]);
  const owned = ownedResult?.data;
  const ownedKey = (owned ?? []).map((row: any) => row.id).join(",");

  useEffect(() => {
    if (!propertyId && owned?.[0]?.id) setPropertyId(owned[0].id);
  }, [ownedKey, propertyId]);

  const blackoutResult = useAsync(async () => {
    const ids = (owned ?? []).map((row: any) => row.id);
    if (!ids.length) return { data: [] as Blackout[], error: null };
    return await supabase.from("rental_blackout_dates")
      .select("id, property_id, starts_on, ends_on, note")
      .in("property_id", ids).order("starts_on");
  }, [ownedKey, refresh], !!owned);
  const blackouts = blackoutResult?.data as Blackout[] | null | undefined;
  const loadFailed = !!ownedResult?.error || !!blackoutResult?.error;

  const props = useAsync(async () => {
    const ids = [...new Set([...(rows ?? []).map((r: any) => r.property_id), ...(owned ?? []).map((p: any) => p.id)])];
    if (!ids.length) return {};
    const { data } = await supabase.from("rental_properties").select("id, title").in("id", ids);
    return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.title]));
  }, [(rows ?? []).map((r: any) => r.property_id).join(","), ownedKey], rows !== undefined && owned !== undefined);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const pad = (first.getDay() + 6) % 7;                 // Monday-first, as in Colombia
    const cells: (Date | null)[] = Array(pad).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    return cells;
  }, [month]);

  /* Half-open, exactly like the database constraint: a check-out day is free for the next
     check-in. Getting this wrong in the UI would show a conflict the database is happy with. */
  const busyOn = (d: Date) => [...(rows ?? []).map((row: any) => ({ ...row, kind: "reservation" })),
    ...(blackouts ?? []).map(row => ({ ...row, kind: "blackout" }))].filter((r: any) => {
    const s = new Date(r.starts_on + "T00:00:00");
    const e = new Date(r.ends_on + "T00:00:00");
    return d >= s && d < e;
  });

  const monthName = month.toLocaleDateString(lang === "es" || lang === "co" ? "es-CO" : "en-US",
    { month: "long", year: "numeric" });

  function clearEditor() {
    setEditingId(null);
    setStartsOn(isoDay());
    setEndsOn(isoDay(1));
    setNote("");
  }

  function editBlackout(row: Blackout) {
    setPropertyId(row.property_id);
    setStartsOn(row.starts_on);
    setEndsOn(row.ends_on);
    setNote(row.note ?? "");
    setEditingId(row.id);
    setError(null);
  }

  async function saveBlackout() {
    if (busy || loadFailed || !propertyId || !startsOn || !endsOn) return;
    if (endsOn <= startsOn) {
      setError(W(lang, "Available again must be after the first unavailable day.", "Disponible de nuevo debe ser posterior al primer día no disponible."));
      return;
    }
    setBusy(true); setError(null);
    const payload = { property_id: propertyId, starts_on: startsOn, ends_on: endsOn, note: note.trim() || null };
    const result = editingId
      ? await supabase.from("rental_blackout_dates").update(payload).eq("id", editingId).select("id")
      : await supabase.from("rental_blackout_dates").insert(payload).select("id");
    setBusy(false);
    if (result.error) {
      setError(result.error.code === "23P01"
        ? W(lang, "Those dates overlap another unavailable period, reservation, or preapproval hold.", "Esas fechas se superponen con otro período no disponible, una reserva o una preaprobación.")
        : result.error.message);
      return;
    }
    if (result.data?.length !== 1) {
      setError(W(lang, "Nothing was saved. This period may have changed or you may no longer have access. Refresh and try again.", "No se guardó nada. Este período puede haber cambiado o puede que ya no tenga acceso. Actualice e inténtelo de nuevo."));
      return;
    }
    clearEditor();
    setRefresh(value => value + 1);
  }

  async function removeBlackout(row: Blackout) {
    if (!window.confirm(W(lang, "Make these dates available again?", "¿Hacer que estas fechas estén disponibles de nuevo?"))) return;
    setBusy(true); setError(null);
    const { data, error: removeError } = await supabase.from("rental_blackout_dates").delete().eq("id", row.id).select("id");
    setBusy(false);
    if (removeError) { setError(removeError.message); return; }
    if (data?.length !== 1) {
      setError(W(lang, "Nothing was removed. This period may have changed or you may no longer have access. Refresh and try again.", "No se eliminó nada. Este período puede haber cambiado o puede que ya no tenga acceso. Actualice e inténtelo de nuevo."));
      return;
    }
    if (editingId === row.id) clearEditor();
    setRefresh(value => value + 1);
  }

  return (
    <div className="space-y-4">
      {loadFailed && <div role="alert" className="card p-4 text-sm">
        <p>{W(lang, "Unavailable dates could not be loaded. The calendar may be incomplete.", "No se pudieron cargar las fechas no disponibles. El calendario puede estar incompleto.")}</p>
        <button type="button" className="btn-ghost mt-2" onClick={() => setRefresh(value => value + 1)}>{W(lang, "Retry", "Reintentar")}</button>
      </div>}
      {/* The month arrows sit either side of the heading, and the heading carries the VAIA pill.
          `min-w-0 flex-1` on the heading is load-bearing: a flex item defaults to min-width:auto,
          so without it the row cannot shrink below title + pill + both arrows and a long Spanish
          month ("Septiembre De 2026") pushes the whole screen sideways at 390px. Caught by
          shots-rental.mjs as a horizontal scroll on 09-calendar, light and dark. */}
      <div className="flex items-center gap-1">
        <button className="btn-ghost shrink-0" aria-label={W(lang, "Previous month", "Mes anterior")}
          onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
        <ScreenHeading className="mb-0 min-w-0 flex-1 capitalize">{monthName}</ScreenHeading>
        <button className="btn-ghost shrink-0" aria-label={W(lang, "Next month", "Mes siguiente")}
          onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
      </div>

      <div className="card mt-3 p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-black uppercase opacity-45">
          {(lang === "es" || lang === "co" ? ["L","M","M","J","V","S","D"] : ["M","T","W","T","F","S","S"])
            .map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <span key={i} />;
            const b = busyOn(d);
            const manual = b.some((row: any) => row.kind === "blackout");
            return (
              <div key={i}
                className={`grid aspect-square place-items-center rounded-lg text-[12px] font-bold ${
                  manual ? "bg-ink/10 text-ink dark:bg-white/15 dark:text-white" : b.length ? "bg-brand/20 text-brand" : "opacity-50"}`}
                title={b.map((r: any) => `${(props as any)?.[r.property_id] ?? "—"}${r.kind === "blackout" ? ` · ${W(lang, "unavailable", "no disponible")}` : ""}`).join(", ")}>
                {d.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {!!owned?.length && <section className="card space-y-4 p-4" aria-labelledby="host-blackout-heading">
        <div>
          <h2 id="host-blackout-heading" className="font-black">{W(lang, "Mark dates unavailable", "Marcar fechas no disponibles")}</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-60">{W(lang,
            "Use this for repairs, personal stays, or any date you cannot host. The available-again date is not blocked.",
            "Úselo para reparaciones, estadías personales o cualquier fecha en que no pueda recibir huéspedes. La fecha disponible de nuevo no queda bloqueada.")}</p>
        </div>
        <label className="block space-y-1 text-xs font-bold">
          <span>{W(lang, "Property", "Propiedad")}</span>
          <GlassSelect value={propertyId} onChange={setPropertyId} ariaLabel={W(lang, "Choose property", "Elegir propiedad")}
            options={(owned ?? []).map((row: any) => ({ value: row.id, label: row.title }))} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-bold"><span>{W(lang, "Unavailable from", "No disponible desde")}</span><GlassDate value={startsOn} onChange={setStartsOn} /></label>
          <label className="block space-y-1 text-xs font-bold"><span>{W(lang, "Available again", "Disponible de nuevo")}</span><GlassDate value={endsOn} onChange={setEndsOn} min={startsOn} /></label>
        </div>
        <label className="block space-y-1 text-xs font-bold">
          <span>{W(lang, "Private note (optional)", "Nota privada (opcional)")}</span>
          <input className="input w-full" maxLength={160} value={note} onChange={event => setNote(event.target.value)}
            placeholder={W(lang, "e.g. Repairs", "Ej.: Reparaciones")} />
        </label>
        {error && <p role="alert" className="text-sm font-bold text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          {editingId && <button type="button" className="btn-ghost" onClick={clearEditor} disabled={busy}>{W(lang, "Cancel edit", "Cancelar edición")}</button>}
          <button type="button" className="btn-primary col-start-2" onClick={() => void saveBlackout()} disabled={busy || loadFailed || !propertyId}>
            {editingId ? W(lang, "Save changes", "Guardar cambios") : W(lang, "Block these dates", "Bloquear estas fechas")}
          </button>
        </div>

        {!!blackouts?.length && <div className="space-y-2 border-t border-ink/10 pt-4 dark:border-white/10">
          {(blackouts ?? []).map(row => <div key={row.id} className="rounded-2xl border border-ink/10 p-3 dark:border-white/10">
            <p className="text-sm font-black">{(props as any)?.[row.property_id] ?? "—"}</p>
            <p className="text-xs opacity-65">{row.starts_on} → {row.ends_on} · {W(lang, "available again", "disponible de nuevo")}</p>
            {row.note && <p className="mt-1 text-xs opacity-60">{row.note}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => editBlackout(row)} disabled={busy}>{W(lang, "Edit", "Editar")}</button>
              <button type="button" className="btn-ghost" onClick={() => void removeBlackout(row)} disabled={busy}>{W(lang, "Remove", "Quitar")}</button>
            </div>
          </div>)}
        </div>}
      </section>}

      <div className="mt-4 space-y-2">
        {(rows ?? []).length === 0 && (
          <p className="text-center text-[12.5px] opacity-55">
            {W(lang, "Nothing booked yet.", "Aún no hay reservas.")}
          </p>
        )}
        {(rows ?? []).map((r: any) => (
          <Link key={r.id} to={productHref("onerental", `/c/${r.id}`)} className="card ow-tap block p-3">
            <p className="text-[13.5px] font-bold">{(props as any)?.[r.property_id] ?? "—"}</p>
            <p className="text-[12.5px] opacity-65">
              {r.starts_on} → {r.ends_on}
              {r.status === "awaiting_first_payment" &&
                ` · ${W(lang, "awaiting first payment", "esperando el primer pago")}`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
