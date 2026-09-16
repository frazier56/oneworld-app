import { useState } from "react";
import { ScreenHeading } from "@oneworld/shell";
import { industryLabel, useT } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { CARD, Loading } from "../lib/ui";
import Setup from "./Setup";

export default function Businesses() {
  const { t, lang } = useT();
  const b = useBusiness();
  const [adding, setAdding] = useState(false);
  if (b.status === "loading") return <Loading />;
  if (adding || b.status === "none") return <Setup onCreated={() => { setAdding(false); b.refresh(); }} />;
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("businessesTitle")}</ScreenHeading>
      <ul className="mt-4 space-y-2">{b.businesses.map(x => (
        <li key={x.id} className={`${CARD} flex items-center justify-between`}>
          <div><p className="text-[13.5px] font-black">{x.name}</p><p className="text-[11.5px] opacity-60">{[industryLabel(x.industry, lang), x.city].filter(Boolean).join(" · ")}</p></div>
          {x.id === b.business?.id ? <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10.5px] font-bold text-brand-deep dark:text-brand-light">{t("current")}</span>
            : <button type="button" onClick={() => b.select(x.id)} className="ow-tap rounded-full border border-ink/15 px-3 py-1 text-[11.5px] font-bold dark:border-white/15">{t("switchTo")}</button>}
        </li>
      ))}</ul>
      <button type="button" onClick={() => setAdding(true)} className="btn-primary mt-4 w-full">{t("addAnother")}</button>
    </div>
  );
}
