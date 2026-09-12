/**
 * COLOMBIAN GEOGRAPHY — one list, both halves of OneHome.
 * ============================================================================================
 * Lee, 12 Aug 2026: *"These are twin forms… literally copy the code and make them identical when
 * they have the same things."*
 *
 * They were not identical, and this is the least visible way they diverged. The rent form and the
 * sale form each carried their OWN `CO_CITIES`, and the two lists disagreed:
 *
 *     rent  → Medellín, Bogotá, Cartagena, Cali, Pereira, Bucaramanga
 *     sale  → Medellín, Bogotá, Cartagena, Cali, Barranquilla, Santa Marta
 *
 * So a person could list a flat in Pereira for rent and find no Pereira in the sale form, and
 * neither list was wrong on its own — nobody had ever seen them side by side. Only one of the two
 * carried the barrio suggestions at all, which is worse than a cosmetic split: a free-typed
 * neighbourhood is what makes "El Poblado", "Poblado" and "el poblado" three different places in
 * the database, and the neighbourhood FILTER and the comparables strip both need them to be one.
 *
 * The union of the two lists lives here. Both products import it, so the next city is added once.
 *
 * ── THESE ARE SUGGESTIONS, NEVER A CLOSED LIST ──────────────────────────────────────────────
 * Both fields still accept anything typed. Colombia has more than six cities that matter and a
 * closed dropdown would simply refuse the seventh. The list exists to make the common case one
 * tap and to make the common spellings agree — not to decide where people are allowed to live.
 */

export const CO_CITIES = [
  { key: "medellin",     label: "Medellín" },
  { key: "bogota",       label: "Bogotá" },
  { key: "cartagena",    label: "Cartagena" },
  { key: "cali",         label: "Cali" },
  { key: "barranquilla", label: "Barranquilla" },
  { key: "santa-marta",  label: "Santa Marta" },
  { key: "pereira",      label: "Pereira" },
  { key: "bucaramanga",  label: "Bucaramanga" },
] as const;

export type CoCityKey = (typeof CO_CITIES)[number]["key"];

/** The neighbourhoods an expatriate actually searches by. Suggestions, never a closed list. */
export const CO_NEIGHBOURHOODS: Record<string, string[]> = {
  medellin:     ["El Poblado", "Laureles", "Envigado", "Sabaneta", "Belén", "La Candelaria"],
  bogota:       ["Chapinero", "Usaquén", "Zona T", "Chicó", "La Candelaria", "Cedritos"],
  cartagena:    ["Centro Histórico", "Getsemaní", "Bocagrande", "Castillogrande", "Manga"],
  cali:         ["Granada", "San Antonio", "El Peñón", "Ciudad Jardín"],
  barranquilla: ["El Prado", "Alto Prado", "Riomar", "Villa Country"],
  "santa-marta": ["El Rodadero", "Bello Horizonte", "Centro Histórico", "Pozos Colorados"],
  pereira:      ["Pinares", "Álamos", "Circunvalar", "Cerritos"],
  bucaramanga:  ["Cabecera", "Sotomayor", "Ciudad Jardín", "La Aurora"],
};

/**
 * Match whatever is in a city box back to a curated key, purely so the barrio suggestions can be
 * chosen. Google returns "Medellín, Antioquia, Colombia"; a person types "medellin" without the
 * accent. Both have to land on `medellin`, and anything unrecognised has to be allowed through
 * with no suggestions rather than blocked.
 */
export function coCityKey(cityText: string): string {
  /* Escaped, not literal. A combining-mark range written as raw characters is invisible in a
     diff and one careless editor save away from becoming a different regex. */
  const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const t = strip(cityText);
  if (!t) return "";
  return CO_CITIES.find(c => {
    const l = strip(c.label);
    return t === l || t.startsWith(l) || t.includes(l);
  })?.key ?? "";
}
