/* ============================================================================================
 * CITY INPUT — now Google Places, everywhere it is used.
 * ============================================================================================
 * Lee's global rule, 14 September 2026: *"Anytime there is a user entering in a city or a state,
 * any location field — Google Places needs to be integrated. That's a global rule."*
 *
 * ⚠️ WHAT THIS USED TO BE. A `fetch` of a static `cities.json` shipped with the app, filtered by
 * prefix then by substring, capped at eight. It looked like autocomplete and behaved like a
 * spell-checker: a city that was not in the file could be typed but never confirmed, the file has
 * no regions, no countries and no disambiguation, and nothing kept it in step with the Places
 * predictions the OneHome screens already used. So two products were offering two different
 * answers to "which cities exist", and only one of them was real.
 *
 * The component KEEPS ITS NAME AND ITS PROPS on purpose: every caller — `Jobs.tsx` today, and the
 * shell export anything else reaches for — gets the fix without being edited, which is the whole
 * point of the rule being global rather than a list of screens to visit.
 *
 * `PlacesInput` already degrades correctly: with no Google key, or with Google refused or slow,
 * the field is an ordinary text box and whatever is typed is kept. That is the "light up when
 * configured" pattern, not a dead control.
 *
 * `countries` is deliberately NOT defaulted to Colombia here. OneHome passes `["co"]` at its own
 * call sites because OneHome is a Colombian product; OneJob is not, and a hidden country filter in
 * a shared component is exactly the kind of drift the shell exists to prevent.
 */
import PlacesInput from "./PlacesInput";

export default function CityInput({
  value, onChange, placeholder, className = "input", countries, ariaLabel, id, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** ISO country codes to restrict predictions to. Omit for worldwide. */
  countries?: string[];
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <PlacesInput
      variant="city"
      value={value}
      onChange={onChange}
      /* A prediction's main text is the city on its own ("Medellín"); its secondary text is the
         department and country. Callers of this component store a city NAME, so the name is what
         is written back — never the full "Medellín, Antioquia, Colombia" string, which would then
         fail every equality check against a stored city. */
      onSelectParts={({ name, full }) => onChange((name || full).split(",")[0].trim())}
      placeholder={placeholder}
      className={className}
      countries={countries}
      ariaLabel={ariaLabel}
      id={id}
      disabled={disabled}
    />
  );
}
