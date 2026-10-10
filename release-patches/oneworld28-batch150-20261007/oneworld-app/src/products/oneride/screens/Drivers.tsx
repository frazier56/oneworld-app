import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n, useOneId, useAsync, productHref, W, Wt, ScreenHeading } from "@oneworld/shell";
import { listDrivers, type PublicDriver } from "../lib/data";

/** /rides/drivers — every driver with a car on file (never the plate: the server does not send it).
 *  Tap the circle to pick drivers, then send them one request. Lee, 9 Oct: "users can just handpick
 *  who they want to send it to." The picked set lives in the address (?to=), so the request form,
 *  a reload and the back button all agree on it. */
export default function Drivers() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const picked = useMemo(() => new Set((params.get("to") ?? "").split(",").filter(Boolean)), [params]);
  const rows = useAsync(() => listDrivers(), []);
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else if (next.size < 10) next.add(id);
    const p = new URLSearchParams(params);
    if (next.size) p.set("to", [...next].join(",")); else p.delete("to");
    setParams(p, { replace: true });
  };
  return (
    <div className={`px-4 ${picked.size ? "pb-32" : "pb-10"}`}>
      <ScreenHeading>{W(lang, "Drivers", "Conductores")}</ScreenHeading>
      <p className="mt-1 text-[13px] opacity-65">{W(lang, "Pick one or more drivers to ask.", "Elija uno o más conductores.")}</p>
      <div className="mt-4 space-y-2">
        {rows === undefined && [0, 1, 2].map(i => <div key={i} className="card ow-shimmer h-[76px]" />)}
        {rows?.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm font-bold">{W(lang, "No drivers yet.", "Todavía no hay conductores.")}</p>
            <Link to={productHref("oneride", "/vehicle")} className="mt-3 inline-block text-[13.5px] font-bold underline underline-offset-4">{W(lang, "Add my car", "Agregar mi carro")}</Link>
          </div>
        )}
        {rows?.map(d => <DriverRow key={d.driver_id} d={d} lang={lang} self={d.driver_id === userId}
          on={picked.has(d.driver_id)} onToggle={() => toggle(d.driver_id)} />)}
      </div>
      {picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(var(--ow-tabs,84px)+env(safe-area-inset-bottom)+10px)] z-40 px-4">
          <button type="button" onClick={() => nav(productHref("oneride", `/request?to=${[...picked].join(",")}`))}
            className="btn-primary mx-auto block w-full max-w-lg shadow-glass">
            {Wt(lang, "Request a ride · {0}", "Pedir un viaje · {0}", [picked.size])}
          </button>
        </div>
      )}
    </div>
  );
}

function DriverRow({ d, lang, on, self, onToggle }: { d: PublicDriver; lang: string; on: boolean; self: boolean; onToggle: () => void }) {
  const name = d.full_name?.trim() || W(lang, "Driver", "Conductor");
  return (
    <div className={`card flex items-center gap-3 !rounded-2xl !p-3 ${on ? "ring-2 ring-teal" : ""}`}>
      <Link to={productHref("oneride", `/p/${d.driver_id}`)} className="ow-tap flex min-w-0 flex-1 items-center gap-3">
        {d.photo_url
          ? <img src={d.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-[17px] font-black text-white dark:bg-brand-light dark:text-ink">{name.charAt(0).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold leading-tight">{name}</p>
          <p className="mt-0.5 truncate text-[12.5px] opacity-65">{d.year} {d.make} {d.model} · {d.colour}</p>
          {d.verified && <span className="mt-1 inline-block rounded-full bg-teal/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-teal-deep dark:text-teal">{W(lang, "Verified", "Verificado")}</span>}
        </div>
      </Link>
      {!self && (
        <button type="button" onClick={onToggle} aria-pressed={on} aria-label={name}
          className={`ow-tap grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 ${on ? "border-teal bg-teal text-white" : "ow-edge border"}`}>
          {on && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>}
        </button>
      )}
    </div>
  );
}
