import { useState, type ReactNode } from "react";
import { W, Wt, FormActions } from "@oneworld/shell";

/**
 * PUBLISH GATE, SALE SIDE — DRAFT, for Lee to react to. 28 September 2026.
 * ============================================================================================
 * The sale form published straight from the button: `status: publish ? "published" : "draft"`
 * and nothing in between. The rent side has had a gate for two weeks. Lee: *"if one feature is on
 * one side, then it needs to be on the other in the same exact way."*
 *
 * ── HE ASKED WHAT ACTUALLY DIFFERS BETWEEN THE TWO SIDES. THIS IS THE ANSWER. ────────────────
 * Three things, and they are the reason this is not a copy of the rent gate.
 *
 * 1 · THE RENT GATE'S DOCUMENTS DO NOT EXIST HERE, AND THAT IS CORRECT.
 *     `getRentalLegalDocuments()` is a set of LEASE documents — the agreement a tenant and a
 *     landlord will actually sign through us. A host accepts them because OneHome carries that
 *     contract.
 *
 *     A Colombian sale does not work that way, and Lee already ruled on it (10 Aug): *"the sales
 *     purchase price won't go through it — the big money won't be able to go through."* A sale
 *     closes at a notary, between attorneys, and the purchase price never touches us. There is no
 *     OneHome document governing that transaction, so there is nothing honest to make a seller
 *     accept. Inventing a sale "agreement" to match the rent side's shape would claim we govern a
 *     transaction we have no part in, which is worse than having no document at all.
 *
 *     ⚠️ SO THIS SHIPS WITH NO DOCUMENT SET, DELIBERATELY, AND IT IS THE ONE THING THAT NEEDS
 *     COUNSEL. What a seller should formally agree to — a listing agreement, an earnest-money
 *     holding term, an exclusivity or non-exclusivity statement — is a legal question, not a
 *     porting job. When there is a document set it drops in above the boxes exactly as on the
 *     rent side, and this note plus the amber panel below come out together.
 *
 * 2 · THE MONEY STATEMENT IS ABOUT COMMISSION AND EARNEST MONEY, NOT ABOUT THE PRICE.
 *     Those two DO pass through us. A seller has typed a commission percentage and said who pays
 *     it, and a buyer's agent will rely on that number — a promise to a third party, which belongs
 *     in front of the seller before it goes live. The figures arrive already formatted in the
 *     LISTING's own currency, because a seller confirming a number they cannot see on the same
 *     screen is confirming nothing.
 *
 * 3 · THE AUTHORISATION STATEMENT IS THE SAME, AND IT IS THE POINT.
 *     Verbatim the rent side's reasoning: this is our only protection against somebody listing a
 *     property they do not control. The right to SELL is a higher bar than the right to let — a
 *     property with three heirs on the deed cannot be sold by one of them — so the wording names
 *     the owner rather than just the lister.
 */
export default function SalePublishGate({
  lang, busy, error, errorAction, onBack, onPublish, commission, earnest,
}: {
  lang: string;
  busy: boolean;
  error?: string | null;
  errorAction?: ReactNode;
  onBack: () => void;
  onPublish: () => void;
  /** Already formatted in the LISTING's currency by the caller — see `saleMoney`. */
  commission?: string | null;
  earnest?: string | null;
}) {
  const [authorised, setAuthorised] = useState(false);
  const [moneyOk, setMoneyOk] = useState(false);

  const Box = ({ checked, onChange, children }: {
    checked: boolean; onChange: (v: boolean) => void; children: ReactNode;
  }) => (
    <label className="ow-edge flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/60 p-3 dark:bg-white/5">
      {/* Live, never `disabled`. Lee's standing rule: a control that half works reads as a broken
          app. The BUTTON is what is gated, and the hint below names which box is outstanding. */}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--teal-depth)]" />
      <span className="text-[11.5px] leading-relaxed opacity-75">{children}</span>
    </label>
  );

  return (
    <div className="mt-6 space-y-3 border-t border-ink/10 pt-5 dark:border-white/10">
      <p className="text-[13.5px] font-black">{W(lang, "Ready to publish", "Listo para publicar")}</p>
      <p className="text-[12px] leading-relaxed opacity-65">
        {W(lang, "Everything above is exactly what a buyer will see.",
                 "Todo lo de arriba es exactamente lo que verá un comprador.")}
      </p>

      <Box checked={authorised} onChange={v => { setAuthorised(v); if (!v) setMoneyOk(false); }}>
        {W(lang,
          "I am the owner of this property, or authorised by the owner to offer it for sale, and everything in this listing is accurate.",
          "Soy el propietario de este inmueble, o estoy autorizado por el propietario para ofrecerlo en venta, y todo lo que dice este anuncio es cierto.")}
      </Box>

      <Box checked={moneyOk} onChange={setMoneyOk}>
        {Wt(lang, "The purchase price is settled outside OneHome, between attorneys. What passes through OneHome is{0}{1}, and I accept those as stated.", "El precio de venta se paga fuera de OneHome, entre abogados. Lo que pasa por OneHome es{2}{3}, y los acepto como están.", [commission ? ` the commission of ${commission}` : " the commission", earnest ? ` and earnest money of ${earnest}` : "", commission ? ` la comisión de ${commission}` : " la comisión", earnest ? ` y las arras de ${earnest}` : ""])}
      </Box>

      {/* ⚠️ VISIBLE ON PURPOSE WHILE THIS IS A DRAFT. A seller should not find out later that
          nothing they agreed to covers the listing itself. Comes out with the note above when
          counsel supplies a document set. */}
      <p className="rounded-xl border border-amber-400/40 bg-amber-300/[0.12] p-3 text-[11.5px] leading-relaxed">
        {W(lang,
          "OneHome does not hold the purchase price and is not a party to the sale. Listing here does not create an exclusive arrangement with us.",
          "OneHome no retiene el precio de venta y no es parte de la compraventa. Publicar aquí no crea ninguna exclusividad con nosotros.")}
      </p>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/35 bg-red-500/[0.08] p-3 text-[12.5px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {error && errorAction}
      <FormActions
        cancel={{ label: W(lang, "Keep editing", "Seguir editando"), onClick: onBack }}
        hint={!authorised
          ? W(lang, "Confirm you are authorised to sell this property before publishing.",
                    "Confirme que está autorizado para vender este inmueble antes de publicar.")
          : !moneyOk
            ? W(lang, "Confirm the commission and earnest money above.",
                      "Confirme la comisión y las arras de arriba.")
            : null}
        invalid={!authorised || !moneyOk}
        primary={{ label: W(lang, "Publish", "Publicar"), onClick: onPublish, busy,
                   disabled: !authorised || !moneyOk }} />
    </div>
  );
}
