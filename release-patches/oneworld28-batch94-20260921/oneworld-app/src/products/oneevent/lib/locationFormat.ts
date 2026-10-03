/**
 * Extracts a short "City, State/Region" from a full address string.
 * Examples:
 *   "123 Main St, Miami, FL 33101, USA" → "Miami, FL"
 *   "El Poblado, Medellín, Colombia"    → "El Poblado, Medellín"
 *   "Miami, FL"                         → "Miami, FL"
 *   "Remote"                            → "Remote"
 */
export function shortLocation(full: string | null | undefined): string {
  if (!full) return "Remote";
  const trimmed = full.trim();
  if (!trimmed) return "Remote";

  // Split by comma
  const parts = trimmed.split(",").map(p => p.trim()).filter(Boolean);

  if (parts.length <= 2) return trimmed; // Already short enough

  // Common patterns:
  // "Street, City, State ZIP, Country" (US) → "City, State"
  // "Neighborhood, City, Country" (international) → "Neighborhood, City"
  // "Venue Name, Street, City, State ZIP, Country" → "City, State"

  // Try to find a US state abbreviation pattern (2 uppercase + optional ZIP)
  const stateZipRe = /^([A-Z]{2})\s*\d{0,5}$/;
  for (let i = 1; i < parts.length; i++) {
    const match = parts[i].match(stateZipRe);
    if (match && i > 0) {
      return `${parts[i - 1]}, ${match[1]}`;
    }
  }

  // For international: take the 2nd-to-last and 3rd-to-last parts
  // e.g. "Cra 43a #1-50, El Poblado, Medellín, Antioquia, Colombia"
  // → "El Poblado, Medellín"
  if (parts.length >= 3) {
    // Skip last part if it looks like a country (single word or known)
    return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
  }

  return `${parts[0]}, ${parts[1]}`;
}
