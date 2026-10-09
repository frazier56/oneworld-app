import { WA } from '@oneworld/shell';
import { useLayoutEffect, useState, type ReactNode } from 'react';

export type AgreementDocument = {
  id: string; version: string; title: string; text: string;
  /** The PUBLISHED page for this exact version — opened in a new tab / the phone's browser. */
  href: string;
};
type Props = {
  documents: AgreementDocument[];
  locale?: string;
  onChange: (accepted: AgreementDocument[]) => void;
  /** A statement agreed in the SAME tick, before the documents (the host's "I am authorized…"). */
  lead?: string;
};

const AND = { en: ' and ', es: ' y ', de: ' und ', pt: ' e ', ru: ' и ', zh: '和' };
const AGREE = { en: 'I agree to the ', es: 'Acepto: ', de: 'Ich stimme zu: ', pt: 'Eu aceito: ', ru: 'Я принимаю: ', zh: '我同意：' };
const AND_AGREE = { en: ', and I agree to the ', es: ', y acepto: ', de: ', und ich stimme zu: ', pt: ', e eu aceito: ', ru: ', и я принимаю: ', zh: '，并同意：' };

/**
 * ONE BOX, LINKED DOCUMENTS — overlay 50 (Lee, 8 Oct 2026).
 * ============================================================================================
 * Lee, with a screenshot of a standard sign-up consent: *"just one check mark and you have some
 * text and then you can click on the information if you want to read it and it opens up in a
 * separate window… on the internet… it's just one box and you check it versus the two boxes."*
 *
 * Before: one row per document, each opening a dialog that had to be scrolled to the end and
 * agreed separately — and on the publish step a THIRD control for "I am authorized". Now: one
 * checkbox whose sentence names each document as a link to its published page, at the same
 * version the screen records (`legalDocuments.ts`; the versions did not change, only how the
 * agreement is collected). `lead` lets the host's authorization ride in the same tick.
 *
 * A link inside a <label> does not toggle the box (interactive content is excluded from label
 * activation), so opening a document never ticks it by accident.
 * This component records local state only; it never writes consent to a server.
 */
export default function AgreementAcceptance({ documents, locale = 'en', onChange, lead }: Props) {
  const [checked, setChecked] = useState(false);
  const documentSet = JSON.stringify(documents.map(d => [d.id, d.version]));

  /* A different set of documents (a version bump) must be agreed again — never carried over. */
  useLayoutEffect(() => { setChecked(false); }, [documentSet]);
  useLayoutEffect(() => { onChange(checked ? documents : []); }, [checked, documentSet]); // callback identity is not a change

  const links: ReactNode[] = [];
  documents.forEach((d, i) => {
    if (i > 0) links.push(i === documents.length - 1 ? WA(locale, AND) : ', ');
    links.push(
      <a key={d.id} href={d.href} target="_blank" rel="noopener noreferrer"
        className="font-bold text-brand underline underline-offset-2">{d.title}</a>,
    );
  });

  return (
    <label data-ow="agreement-acceptance"
      className="ow-edge flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/60 p-3 dark:bg-white/5">
      <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--teal-depth)]" />
      <span className="text-[12.5px] leading-relaxed opacity-80">
        {lead ? <>{lead}{WA(locale, AND_AGREE)}</> : WA(locale, AGREE)}
        {links}{locale === 'zh' ? '。' : '.'}
      </span>
    </label>
  );
}
