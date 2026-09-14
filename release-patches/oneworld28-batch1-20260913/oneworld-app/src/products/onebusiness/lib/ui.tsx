import type { SubState } from "./data";
import { useT } from "./dict";
export function LoadError() {
  const { copy } = useT();
  return <div role="alert" className="card m-4 space-y-3 p-4">
    <p>{copy("We couldn’t load the business information. Please try again.", "No pudimos cargar la información del negocio. Intente de nuevo.")}</p>
    <button type="button" className="btn-primary" onClick={() => window.location.reload()}>{copy("Try again", "Intentar de nuevo")}</button>
  </div>;
}

/** One vocabulary for service states, everywhere in the app. */
export function StatePill({ state }: { state: SubState }) {
  const { t } = useT();
  const label: Record<SubState, string> = { requested: t("stRequested"), awaiting_info: t("stAwaiting"), quoted: t("stQuoted"), building: t("stBuilding"), ready_for_review: t("stReview"), active: t("stActive"), paused: t("stPaused"), failed: t("stFailed"), cancelled: t("stCancelled") };
  const tone: Record<SubState, string> = {
    requested: "bg-ink/10", awaiting_info: "bg-amber-500/15 text-amber-800 dark:text-amber-200", quoted: "bg-brand/15 text-brand-deep dark:text-brand-light",
    building: "bg-brand/15 text-brand-deep dark:text-brand-light", ready_for_review: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    active: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200", paused: "bg-ink/10", failed: "bg-rose-500/15 text-rose-700 dark:text-rose-200", cancelled: "bg-ink/10 opacity-60",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${tone[state]}`}>{label[state]}</span>;
}
export const CARD = "card !rounded-2xl !p-4";
export const Loading = () => { const { t } = useT(); return <p className="px-4 py-10 text-center text-sm opacity-50">{t("loading")}</p>; };
