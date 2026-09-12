import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ScreenHeading, productHref, GlassSelect } from "@oneworld/shell";
import { useBusinessLoad } from "../lib/useBusinessLoad";
import { businessError, serviceTitle, industryLabel, useT } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { listServices, listSubscriptions, canEditBusiness, requestService, cancelRequest, type Business, type Service, type Subscription } from "../lib/data";
import { StatePill, CARD, Loading, LoadError } from "../lib/ui";
import Setup from "./Setup";

const summaries: Record<string, [string, string]> = {
  onevoice: ["Answer calls and book appointments.", "Conteste llamadas y agende citas."],
  onepage: ["Turn website visits into inquiries.", "Convierta visitas web en consultas."],
  oneapp: ["Keep your business on customers’ phones.", "Lleve su negocio al celular de sus clientes."],
  reputation: ["Collect and manage customer reviews.", "Reúna y gestione reseñas de clientes."],
  search_ai: ["Help customers find your business.", "Ayude a los clientes a encontrar su negocio."],
  winback: ["Bring past customers back.", "Recupere clientes anteriores."],
  missed_call: ["Follow up when you miss a call.", "Dé seguimiento a llamadas perdidas."],
  ai_chat: ["Answer questions and capture inquiries.", "Responda preguntas y capture consultas."],
  automation: ["Keep customer follow-ups on time.", "Dé seguimiento a sus clientes a tiempo."],
  custom_ai: ["Connect AI to the way you work.", "Conecte la IA con su forma de trabajar."],
  ads_reporting: ["See your ad spend and results.", "Vea su inversión publicitaria y resultados."],
  pipeline: ["Track inquiries through to a sale.", "Siga cada consulta hasta la venta."],
};
const title = (s: Service, locale: string) => serviceTitle(s, locale);
const productEntry: Record<string, string> = { onevoice: "https://www.oneworldlabs.ai/onevoice/get-started/", onepage: "https://onepage.oneworldlabs.ai/#builder", oneapp: "https://oneapp.oneworldlabs.ai/#builder" };
// These calendars were read from the live product flows, then opened without booking.
const calendars: Record<string, string> = { onevoice: "https://api.leadconnectorhq.com/widget/booking/TkMyWsq0YqMLbpJuP1Tn", onepage: "https://api.leadconnectorhq.com/widget/booking/rghlggjZP931B1mISGls", oneapp: "https://api.leadconnectorhq.com/widget/booking/rghlggjZP931B1mISGls" };

export default function Services() {
  const { t, lang, locale, copy } = useT(); const es = lang === "es";
  const b = useBusiness(); const { serviceKey: routeServiceKey } = useParams(); const location = useLocation(); const serviceKey = routeServiceKey || location.hash.slice(1); const [search, setSearch] = useSearchParams();
  const wanted = search.get("business");
  const [tick, setTick] = useState(0); const [editing, setEditing] = useState<string | null>(null);
  const editQuery = useBusinessLoad(async () => b.business ? canEditBusiness(b.business.id) : false, [b.business?.id]);
  const servicesQuery = useBusinessLoad(listServices, []);
  const subsQuery = useBusinessLoad(async () => b.business ? listSubscriptions(b.business.id) : [], [b.business?.id, tick]);
  // A return link names a business, but membership is always checked against the server list.
  useEffect(() => {
    if (wanted && b.status === "ready" && b.business?.id !== wanted && b.businesses.some(x => x.id === wanted)) b.select(wanted);
  }, [wanted, b.status, b.business?.id, b.businesses]);
  if (b.status === "error" || servicesQuery.error || subsQuery.error) return <LoadError />;
  if (b.status === "loading" || !servicesQuery.data || !subsQuery.data) return <Loading />;
  if (!b.userId) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  if (b.status === "none") return <Setup onCreated={b.refresh} />;
  if (!b.business) return null;
  if (wanted && !b.businesses.some(x => x.id === wanted)) return <LoadError />;
  if (wanted && b.business.id !== wanted) return <Loading />;
  const business = b.business;
  const editKey = `${b.userId}:${business.id}`;
  if (editing === editKey && editQuery.data) return <Setup key={editKey} business={business} onSaved={() => { setEditing(null); b.refresh(); }} onCancel={() => setEditing(null)} />;
  const subFor = (key: string) => subsQuery.data?.find(s => s.service_key === key && s.state !== "cancelled");
  const detail = servicesQuery.data.find(s => s.key === serviceKey);
  if (serviceKey) return detail ? <ServiceDetail key={`${b.userId}:${business.id}:${detail.key}`} business={business} service={detail}
    subscription={subFor(detail.key)} refresh={() => setTick(x => x + 1)} /> : <div className="px-4"><p role="alert">{copy("Service unavailable.", "Servicio no disponible.")}</p><Link to={productHref("onebusiness", "/services")} className="btn-primary mt-4 inline-block">{copy("Back to services", "Volver a servicios")}</Link></div>;
  const ordered = [...servicesQuery.data].sort((a, z) => Number(z.flagship) - Number(a.flagship) || a.sort - z.sort);
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("servicesTitle")}</ScreenHeading>
      <div className={`${CARD} mb-4`}>
        <div className="flex items-center justify-between gap-3"><div className="min-w-0 flex-1">{b.businesses.length > 1 ? <GlassSelect className="w-full" value={business.id} onChange={id => { setSearch({ business: id }); b.select(id); }} ariaLabel={t("businessesTitle")} options={b.businesses.map(x => ({ value: x.id, label: x.name }))} /> : <p className="break-words text-sm font-bold">{business.name}</p>}</div>
        {editQuery.data && <button type="button" onClick={() => setEditing(editKey)} className="ow-tap shrink-0 rounded-full border border-brand/25 px-3 py-2 text-sm font-semibold">{copy("Edit", "Editar")}</button>}</div>
        <p className="mt-1 text-xs opacity-65">{[industryLabel(business.industry, locale), business.city].filter(Boolean).join(" · ")}</p>

      </div>
      <p className="text-sm opacity-70">{copy("Choose what your business needs.", "Elija lo que necesita su negocio.")}</p>
      <ul className="mt-3 space-y-2">
        {ordered.map(s => { const sub = subFor(s.key); return (
          <li key={s.key} id={s.key}>
            <Link to={productHref("onebusiness", `/services/${encodeURIComponent(s.key)}?business=${encodeURIComponent(business.id)}`)}
              className={`${CARD} ow-tap flex items-center gap-3 border border-brand/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand`}>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">{title(s, locale)}</p>
                <p className="mt-1 text-sm leading-snug opacity-70">{Object.prototype.hasOwnProperty.call(summaries, s.key) ? copy(summaries[s.key][0], summaries[s.key][1]) : (es ? s.blurb_es : s.blurb_en)}</p>
                {sub && <div className="mt-2"><StatePill state={sub.state} /></div>}
              </div>
              <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 5 7 7-7 7" /></svg>
            </Link>
          </li>
        ); })}
      </ul>
    </div>
  );
}

function ServiceDetail({ business, service, subscription, refresh }: { business: Business; service: Service; subscription?: Subscription; refresh: () => void }) {
  const { t, lang, locale, copy } = useT(); const es = lang === "es";
  const [help, setHelp] = useState(!productEntry[service.key]);
  const [needs, setNeeds] = useState(""); const [tools, setTools] = useState(""); const [timing, setTiming] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<{ cause: unknown; action: "request" | "withdraw" } | null>(null);
  async function run(action: () => Promise<unknown>, kind: "request" | "withdraw" = "request") {
    if (busy) return; setBusy(true); setError(null);
    try { await action(); refresh(); } catch (e) { setError({ cause: e, action: kind }); } finally { setBusy(false); }
  }
  // This component remounts on identity, business or service changes, isolating drafts and errors.
  const request = (e: React.FormEvent) => {
    e.preventDefault(); if (!needs.trim()) return;
    const note = `${es ? "Objetivo" : "Goal"}: ${needs.trim()}\n${es ? "Herramientas / volumen" : "Tools / volume"}: ${tools.trim()}\n${es ? "Inicio / idioma" : "Timing / language"}: ${timing.trim()}`;
    void run(() => requestService(business.id, service.key, note));
  };
  const marketing = (() => { try { const url = new URL(service.marketing_url ?? ""); return url.protocol === "https:" ? url.href : null; } catch { return null; } })();
  return (
    <div className="px-4 pb-10">
      <Link to={productHref("onebusiness", `/services?business=${encodeURIComponent(business.id)}`)} className="ow-tap mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 px-3 py-2 text-sm font-semibold">
        <span aria-hidden="true">‹</span>{copy("Services", "Servicios")}
      </Link>
      <ScreenHeading className="[&_h1>span]:whitespace-normal [&_h1>span]:overflow-visible [&_h1>span]:break-words max-[360px]:flex-wrap max-[360px]:[&_h1]:w-full max-[360px]:[&>div]:ml-auto">{title(service, locale)}</ScreenHeading>
      <p className="mb-4 break-words text-xs opacity-65">{copy("For", "Para")}: {business.name}</p>
      <section className={CARD}>
        <h2 className="text-base font-bold">{copy("What it does", "Qué puede hacer")}</h2>
        <p className="mt-2 text-sm leading-relaxed">{es ? service.blurb_es : service.blurb_en}</p>
        <h2 className="mt-4 text-base font-bold">{copy("Pricing and setup", "Precio y configuración")}</h2>
        <p className="mt-2 text-sm opacity-75">{copy("We’ll confirm the scope and price for your business before activating the service.", "Confirmaremos el alcance y el precio para su negocio antes de activar el servicio.")}</p>
        {subscription?.quote_note && <p className="mt-2 whitespace-pre-wrap text-sm">{subscription.quote_note}</p>}
        {marketing && <a href={marketing} target="_blank" rel="noreferrer" className="ow-tap mt-3 inline-block rounded-xl border border-brand/25 px-3 py-2 text-sm font-semibold">{copy("Explore the product", "Ver información del producto")}<span className="sr-only">{copy(" (new tab)", " (nueva pestaña)")}</span></a>}
      </section>
      {!subscription && productEntry[service.key] && <section className={`${CARD} mt-3`}>
        <p className="text-sm opacity-75">{copy("Review the options and current price on the product page. Your business stays here for when you return.", "Revise las opciones y el precio actual en la página del producto. Esta página conserva su negocio para cuando vuelva.")}</p>
        <a href={productEntry[service.key]} target="_blank" rel="noreferrer" className="btn-primary mt-3 block text-center">{service.key === "onevoice" ? (copy("See plans and sign up", "Ver planes y registrarse")) : service.key === "onepage" ? (copy("Preview my website", "Ver mi sitio web")) : (copy("Preview my app", "Ver mi app"))}<span className="sr-only">{copy(" (new tab)", " (nueva pestaña)")}</span></a>
        {!help && <button type="button" onClick={() => setHelp(true)} className="ow-tap mt-2 w-full py-2 text-sm font-semibold">{copy("Prefer a setup call?", "¿Prefiere una llamada de configuración?")}</button>}
      </section>}
      {subscription ? <section className={`${CARD} mt-3`}>
        <StatePill state={subscription.state} />
        {["requested", "awaiting_info", "quoted"].includes(subscription.state) && <>
          <p className="mt-2 text-sm">{copy("Your request is saved. The team will review your needs; no appointment or charge is confirmed yet.", "Su solicitud está guardada. El equipo revisará sus necesidades; aún no hay una cita confirmada ni un cargo.")}</p>
          {calendars[service.key] && <a href={calendars[service.key]} target="_blank" rel="noreferrer" className="btn-primary mt-3 block text-center">{copy("Choose a call time", "Elegir hora para la llamada")}<span className="sr-only">{copy(" (new tab)", " (nueva pestaña)")}</span></a>}
          <button type="button" disabled={busy} onClick={() => void run(() => cancelRequest(subscription.id), "withdraw")} className="ow-tap mt-3 rounded-xl border border-ink/15 px-3 py-2 text-sm disabled:opacity-50">{t(busy ? "loading" : "cancelRequest")}</button>
        </>}
      </section> : help ? <form onSubmit={request} className={`${CARD} mt-3`}>
        <h2 className="text-base font-bold">{copy("Let’s prepare your service", "Preparemos su servicio")}</h2>
        <p className="mt-1 text-sm opacity-70">{copy("Give us a few details to prepare a setup call.", "Cuéntenos lo necesario para preparar una llamada de configuración.")}</p>
        <fieldset disabled={busy} className="mt-3 min-w-0 space-y-3">
          <label className="block text-sm font-semibold">{copy("What would you like to improve?", "¿Qué quiere mejorar?")}<textarea className="input mt-1 font-normal" required rows={2} maxLength={220} value={needs} onChange={e => setNeeds(e.target.value)} /></label>
          <label className="block text-sm font-semibold">{copy("Current tools, locations and approximate volume", "Herramientas actuales, ubicaciones y volumen aproximado")}<textarea className="input mt-1 font-normal" rows={2} maxLength={120} value={tools} onChange={e => setTools(e.target.value)} /></label>
          <label className="block text-sm font-semibold">{copy("Preferred start date and language", "Fecha de inicio e idioma preferidos")}<input className="input mt-1 font-normal" maxLength={80} value={timing} onChange={e => setTiming(e.target.value)} /></label>
          <p className="text-xs opacity-65">{copy("Submitting a request does not charge you or activate the service.", "La solicitud no genera un cargo ni activa el servicio.")}</p>
          <button className="btn-primary w-full" type="submit" disabled={busy} aria-busy={busy}>{busy ? t("loading") : copy("Request setup", "Solicitar configuración")}</button>
        </fieldset>
      </form> : null}
      {error && <p role="alert" className="mt-3 text-sm font-bold text-rose-600 dark:text-rose-300">{businessError(error.cause, locale, error.action)}</p>}
    </div>
  );
}
