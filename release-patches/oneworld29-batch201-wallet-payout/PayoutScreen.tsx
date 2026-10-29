import { PayoutMethods, ScreenHeading, W, useI18n, useOneId } from "@oneworld/shell";
import LocalPayout from "./LocalPayout";

/* PAYOUT — how you get paid (Lee, 28 Oct 2026: "it should just be a section, just like the
   wallet"). Every app mounts this same screen at its own `…/payout` route, so the Payout row
   lands HERE, never on Settings. Pesos first (Colombia), then the international options. */
export default function PayoutScreen({ productLabel, returnPath }: { productLabel: string; returnPath: string }) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  return (
    <div className="space-y-4 pb-8" data-ow="payout-screen">
      <ScreenHeading>
        {W(lang, "Payout", "Cobros")} <span className="text-[0.62em] font-bold opacity-55">{W(lang, "(how you get paid)", "(cómo le pagan)")}</span>
      </ScreenHeading>
      <LocalPayout />
      <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] opacity-45">{W(lang, "Outside Colombia", "Fuera de Colombia")}</p>
      <PayoutMethods userId={userId} productLabel={productLabel} stripeReturnPath={returnPath} />
    </div>
  );
}
