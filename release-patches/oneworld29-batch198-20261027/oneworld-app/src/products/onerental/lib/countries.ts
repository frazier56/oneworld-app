/* ── WHERE A LISTING IS — ANY COUNTRY (Lee, 2 Oct 2026) ──────────────────────────────────────
   *"It should recognize the country when you start typing anywhere. I don't care if you're in
   Thailand… Bali, America, South America."* Every address field used to be locked to Colombia
   (`countries={["co"]}`), so "1010 Grace Hill Drive" returned nothing at all while Google itself
   had five matches. The country now comes from the place the host picks (Google's own address
   components), and this list is only the manual fallback / correction.
   Names come from `Intl.DisplayNames` in the reader's language, so no strings to translate. */
const ISO2 = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU " +
  "MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB " +
  "SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY " +
  "UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");

const LOCALE: Record<string, string> = { co: "es-CO", es: "es", en: "en", de: "de", pt: "pt", ru: "ru", zh: "zh" };

export function countryLabel(iso2: string | null | undefined, lang = "en"): string {
  const cc = (iso2 ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  try { const n = new Intl.DisplayNames([LOCALE[lang] ?? "en"], { type: "region" }).of(cc); return n && n !== cc ? n : cc; }
  catch { return cc; }
}

/** Options for a searchable country picker, alphabetical in the reader's language. */
export function countryOptions(lang = "en") {
  return ISO2.map(c => ({ value: c, label: countryLabel(c, lang) }))
    .sort((a, b) => a.label.localeCompare(b.label, LOCALE[lang] ?? "en"))
    .map(o => ({ ...o, search: `${o.label} ${o.value}` }));
}

/** Older sale rows stored the NAME ("Colombia"); the database wants ISO-2. */
export function normaliseCountry(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  if (/^colombia$/i.test(s)) return "CO";
  return "";
}

/** Google's second line ends with the country ("Roswell, GA, USA" / "Medellín, Antioquia, Colombia").
 *  With two or more parts the last one IS the country, whatever country it is. */
export function withoutCountry(secondary?: string): string[] {
  const parts = (secondary ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(0, -1) : parts;
}
