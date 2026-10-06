import { W, useI18n } from "@oneworld/shell";

export default function ListingLoadError({ retry }: { retry: () => void }) {
  const { lang } = useI18n();
  return <div role="alert" className="card p-6 text-center">
    <p className="text-sm font-bold">{W(lang, "We couldn't load the listings.", "No pudimos cargar los inmuebles.")}</p>
    <p className="mt-1 text-sm opacity-60">{W(lang, "Check your connection and try again.", "Revise su conexión e inténtelo de nuevo.")}</p>
    <button type="button" className="btn-brand mt-4" onClick={retry}>{W(lang, "Try again", "Intentar de nuevo")}</button>
  </div>;
}
