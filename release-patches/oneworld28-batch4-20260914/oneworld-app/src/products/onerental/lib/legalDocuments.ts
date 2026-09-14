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
export function getRentalLegalDocuments(locale: string): AgreementDocument[] {
  const es = locale === 'es' || locale === 'co';
  const fr = locale === 'fr';
  return [
    {
      id: 'onehome-terms',
      version: 'OH-2026-09-06.1',
      title: fr ? 'Conditions de location OneHome' : es ? 'Términos de arriendo de OneHome' : 'OneHome Rental Terms',
      text: localizedText(terms, SPANISH_TERMS, locale),
    },
    {
      id: 'privacy',
      version: 'OWL-2026-09-06.1',
      title: fr ? 'Politique de confidentialité' : es ? 'Política de privacidad' : 'Privacy Policy',
      text: localizedText(privacy, SPANISH_PRIVACY, locale),
    },
  ];
}
