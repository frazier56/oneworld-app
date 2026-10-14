import { Link } from "react-router-dom";
import { NavIcon, productHref, useI18n, W } from "@oneworld/shell";

const TILE = "card ow-tap flex min-h-[92px] flex-col items-start justify-between !rounded-2xl !p-4";
/** The profile's app tiles for OneRide (the shell's `tilesSlot`; no second profile screen). */
export default function ProfileTiles() {
  const { lang } = useI18n();
  return (
    <section className="grid grid-cols-3 gap-2">
      <Link to={productHref("oneride", "/vehicle")} className={TILE}><NavIcon name="keys" className="text-brand dark:text-brand-light" /><span className="text-[13px] font-bold leading-tight">{W(lang, "My car", "Mi carro")}</span></Link>
      <Link to={productHref("oneride", "/drivers")} className={TILE}><NavIcon name="people" className="text-brand dark:text-brand-light" /><span className="text-[13px] font-bold leading-tight">{W(lang, "Drivers", "Conductores")}</span></Link>
      <Link to={productHref("oneride", "/request")} className={TILE}><NavIcon name="car" className="text-brand dark:text-brand-light" /><span className="text-[13px] font-bold leading-tight">{W(lang, "Request", "Pedir")}</span></Link>
    </section>
  );
}
