import { useState } from "react";
import { W, FormActions } from "@oneworld/shell";
import AgreementAcceptance from "./AgreementAcceptance";
import { getRentalLegalDocuments } from "../lib/legalDocuments";

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
export default function PublishGate({ lang, busy, error, onBack, onPublish }: {
  lang: string;
  busy: boolean;
  error?: string | null;
  onBack: () => void;
  onPublish: () => void;
}) {
  const [documentsAccepted, setDocumentsAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const documents = getRentalLegalDocuments(lang);

  return (
    <div className="mt-6 space-y-3 border-t border-ink/10 pt-5 dark:border-white/10">
      <p className="text-[13.5px] font-black">{W(lang, "Ready to publish", "Listo para publicar")}</p>
      <p className="text-[12px] leading-relaxed opacity-65">
        {W(lang, "Everything above is exactly what a tenant will see.",
                 "Todo lo de arriba es exactamente lo que verá un arrendatario.")}
      </p>

      <AgreementAcceptance documents={documents} locale={lang}
        onChange={docs => {
          const all = docs.length === documents.length;
          setDocumentsAccepted(all);
          if (!all) setTermsAccepted(false);
        }} />

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
        <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--teal-depth)]" />
        {/* ── ⚠️ I RECOMMENDED CUTTING THIS AND I WAS WRONG — HERE IS WHY IT STAYS ───────────
            Lee asked which of the two acceptances could go. Reading them properly: the documents
            above are the LEGAL record — read to the end, agreed per document, version stamped.
            This box is a different statement, and the only one that says it: that the host has
            the RIGHT to let this property and that what they wrote is true. That is our protection
            against somebody listing a flat they do not control, and no document above carries it.

            So neither goes. What DID go is the overlap: this line used to end "and I agree to the
            OneHome Host terms", which the documents had already captured a moment earlier. One
            control, one sentence, no repetition — which is the actual complaint. */}
        <span className="text-[11.5px] leading-relaxed opacity-75">
          {W(lang,
            "I am authorized to offer this property and everything in this listing is accurate.",
            "Estoy autorizado para ofrecer este inmueble y todo lo que dice este anuncio es cierto.")}
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/35 bg-red-500/[0.08] p-3 text-[12.5px] font-semibold text-red-600">
          {error}
        </p>
      )}

      <FormActions
        cancel={{ label: W(lang, "Keep editing", "Seguir editando"), onClick: onBack }}
        hint={!documentsAccepted
          ? W(lang, "Open each document above and agree to it — that is what unlocks Publish.",
                    "Abra cada documento de arriba y acéptelo — eso es lo que habilita Publicar.")
          : !termsAccepted
            ? W(lang, "Tick the confirmation above before publishing.",
                      "Marque la confirmación de arriba antes de publicar.")
            : null}
        invalid={!documentsAccepted || !termsAccepted}
        primary={{ label: W(lang, "Publish", "Publicar"), onClick: onPublish, busy,
                   disabled: !documentsAccepted || !termsAccepted }} />
    </div>
  );
}
