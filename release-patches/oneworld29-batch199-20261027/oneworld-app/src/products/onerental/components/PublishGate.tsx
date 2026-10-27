import { useState, type ReactNode } from "react";
import { W, WA, FormActions } from "@oneworld/shell";
import AgreementAcceptance from "./AgreementAcceptance";
import { getRentalLegalDocuments } from "../lib/legalDocuments";

const AUTHORIZED = {
  en: "I am authorized to offer this property and everything in this listing is accurate",
  es: "Estoy autorizado para ofrecer este inmueble y todo lo que dice este anuncio es cierto",
  de: "Ich bin berechtigt, diese Immobilie anzubieten, und alle Angaben in diesem Inserat sind korrekt",
  pt: "Estou autorizado a oferecer este imóvel e tudo neste anúncio é verdadeiro",
  ru: "Я имею право сдавать этот объект, и всё в этом объявлении — правда",
  zh: "我有权出租此房产，且本房源中的所有信息均属实",
};

/**
 * PUBLISH GATE — the last thing between a finished draft and a live listing.
 * ============================================================================================
 * Lee, 15 Sep 2026: *"The preview screen should look exactly like how it does in the public view…
 * and I can't even get past the publish. You're supposed to click a little box at the bottom. I
 * can't click that. Therefore the publish doesn't work."*
 *
 * Both halves of that are fixed by moving this out of the form. The PREVIEW is now the real public
 * screen (`PropertyDetail` with `?preview=1`), so there is no second rendering to drift from it,
 * and this is the only thing added on top — the bar a host publishes from.
 *
 * ── ⚠️ THE BOX THAT COULD NOT BE TICKED ─────────────────────────────────────────────────────
 * The confirmation checkbox used to carry `disabled={!documentsAccepted}`: dead until every
 * document above had been opened, scrolled to the end and agreed to, with nothing anywhere saying
 * so. A host taps it, nothing moves, and the app looks broken — a control that half works, which
 * is the one thing he has said outright never to ship.
 *
 * The box is live. The DOCUMENTS still gate Publish, because that consent is the legally
 * meaningful one and it records the version each host agreed to — but the gate now announces
 * itself, and the hint names which of the two is actually outstanding instead of always blaming
 * the box.
 */
export default function PublishGate({ lang, busy, error, errorAction, onBack, onPublish }: {
  lang: string;
  busy: boolean;
  error?: string | null;
  errorAction?: ReactNode;
  onBack: () => void;
  onPublish: () => void;
}) {
  const [documentsAccepted, setDocumentsAccepted] = useState(false);
  const documents = getRentalLegalDocuments(lang);

  return (
    <div className="mt-6 space-y-3 border-t border-ink/10 pt-5 dark:border-white/10">
      <p className="text-[13.5px] font-black">{W(lang, "Ready to publish", "Listo para publicar")}</p>
      <p className="text-[12px] leading-relaxed opacity-65">
        {W(lang, "Everything above is exactly what a tenant will see.",
                 "Todo lo de arriba es exactamente lo que verá un arrendatario.")}
      </p>

      {/* Overlay 50 — ONE box (Lee, 8 Oct 2026). The authorization statement was kept on 15 Sep
          because no document carries it (it is what protects us from someone listing a flat
          they do not control). It still is agreed: it opens the same sentence, in the same tick
          as the linked Terms and Privacy Policy. Nothing the host agrees to was lost; two of the
          three controls were. */}
      <AgreementAcceptance documents={documents} locale={lang}
        lead={WA(lang, AUTHORIZED)}
        onChange={docs => setDocumentsAccepted(docs.length === documents.length)} />

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/35 bg-red-500/[0.08] p-3 text-[12.5px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {error && errorAction}
      <FormActions
        cancel={{ label: W(lang, "Keep editing", "Seguir editando"), onClick: onBack }}
        hint={!documentsAccepted
          ? W(lang, "Tick the box above to publish.", "Marque la casilla de arriba para publicar.")
          : null}
        invalid={!documentsAccepted}
        primary={{ label: W(lang, "Publish", "Publicar"), onClick: onPublish, busy,
                   disabled: !documentsAccepted }} />
    </div>
  );
}
