/* The version stamped onto a property when it is published. It lives here, beside the
   documents themselves, because two places that publish (the form and the preview bar)
   must never record different versions for the same act. */
export const ONEHOME_TERMS_VERSION = "OH-2026-09-06.1";

import terms from '../../../legal/onehome-terms-20260906.md?raw';
import privacy from '../../../legal/platform-privacy-20260906.md?raw';
import type { AgreementDocument } from '../components/AgreementAcceptance';

const SPANISH_TERMS = '## Español — Términos de arriendo de OneHome';
const SPANISH_PRIVACY = '## Español — Política de privacidad';

function localizedText(source: string, spanishHeading: string, locale: string): string {
  const split = source.indexOf(spanishHeading);
  const english = (split < 0 ? source : source.slice(0, split)).trim();
  if (locale === 'es' || locale === 'co') {
    if (split < 0) return english;
    return source.slice(split).trim().replace(/^## Español — /, '# ');
  }
  if (locale === 'fr') {
    return `> Traduction française vérifiée non disponible. Le texte juridique officiel est présenté en anglais ci-dessous.\n\n${english}`;
  }
  return english;
}

// Published versions stay fixed; only the displayed language changes.
/* Overlay 50: each document links to its PUBLISHED page, which serves these same files
   (App.tsx: /onehome/terms ← onehome-terms-20260906.md, /privacy ← platform-privacy-20260906.md).
   Absolute, so it opens on the open web from the app as well as from a browser. */
const PUBLISHED = 'https://app.oneworldlabs.ai';
const TITLES: Record<string, { terms: string; privacy: string }> = {
  en: { terms: 'OneHome Rental Terms', privacy: 'Privacy Policy' },
  es: { terms: 'Términos de arriendo de OneHome', privacy: 'Política de privacidad' },
  fr: { terms: 'Conditions de location OneHome', privacy: 'Politique de confidentialité' },
  de: { terms: 'OneHome-Mietbedingungen', privacy: 'Datenschutzerklärung' },
  pt: { terms: 'Termos de aluguel da OneHome', privacy: 'Política de privacidade' },
  ru: { terms: 'Условия аренды OneHome', privacy: 'Политика конфиденциальности' },
  zh: { terms: 'OneHome 租赁条款', privacy: '隐私政策' },
};

export function getRentalLegalDocuments(locale: string): AgreementDocument[] {
  const t = TITLES[locale === 'co' ? 'es' : locale] ?? TITLES.en;
  return [
    {
      id: 'onehome-terms',
      version: 'OH-2026-09-06.1',
      title: t.terms,
      text: localizedText(terms, SPANISH_TERMS, locale),
      href: `${PUBLISHED}/onehome/terms`,
    },
    {
      id: 'privacy',
      version: 'OWL-2026-09-06.1',
      title: t.privacy,
      text: localizedText(privacy, SPANISH_PRIVACY, locale),
      href: `${PUBLISHED}/privacy`,
    },
  ];
}
