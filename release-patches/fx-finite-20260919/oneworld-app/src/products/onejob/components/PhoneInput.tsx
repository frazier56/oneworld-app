import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Chevron from "./Chevron";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Phone entry with a real country picker and live, per-country formatting.
 *
 * Lee, Jul 25 2026: "the phone number needs to have a country code that they can select — a dropdown
 * and/or a type search. And then based on that, the phone number needs to be formatted in the proper
 * formatting based on the country, with parentheses and dashes or whatever."
 *
 * A plain text box was wrong for a product that already has Colombian, Mexican and US users: a
 * bare "3001234567" is unroutable without knowing the country, and we were storing whatever people
 * typed. This component:
 *   - picks a sensible default country (the signed-in user's, else the browser locale, else US)
 *   - formats AS THE USER TYPES using libphonenumber-js, so US shows (601) 555-1234 and Colombia
 *     shows 300 1234567 — each country's own convention, not a US mask forced on everyone
 *   - hands the parent a clean **E.164** string (+16015551234), which is what SMS providers and
 *     Stripe actually require
 *   - tells the parent whether the number is valid so the caller can block an unsendable invite
 *
 * The country list is searchable by name, ISO code, or dial code — typing "colom", "co" or "57"
 * all land on Colombia.
 */

type Props = {
  /** E.164 value, e.g. "+16015551234". Empty string when unset. */
  value: string;
  /** Fires with the E.164 string (or "" while incomplete) plus a validity flag. */
  onChange: (e164: string, isValid: boolean) => void;
  /** ISO-2 country to start on. Falls back to the browser locale, then US. */
  defaultCountry?: string;
  placeholder?: string;
  className?: string;
  id?: string;
};

/** English display names for every ISO-2 region the library knows about. */
const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

const countryName = (cc: string) => {
  try {
    return REGION_NAMES?.of(cc) || cc;
  } catch {
    return cc;
  }
};

/** ISO-2 -> 🇺🇸. Regional-indicator maths; no image assets, no extra bytes. */
const flagOf = (cc: string) =>
  cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

/** Countries we put at the top because they're where our users actually are. */
const PRIORITY = ["US", "CO", "MX", "CA", "GB", "ES", "BR", "AR", "PE", "CL"];

function detectCountry(preferred?: string): CountryCode {
  const all = getCountries() as string[];
  const tryIt = (v?: string | null) => {
    const up = (v || "").toUpperCase();
    return up.length === 2 && all.includes(up) ? (up as CountryCode) : null;
  };
  if (tryIt(preferred)) return tryIt(preferred)!;
  try {
    // "en-CO" / "es-MX" -> region
    for (const loc of navigator.languages ?? [navigator.language]) {
      const region = new Intl.Locale(loc).region;
      const hit = tryIt(region);
      if (hit) return hit;
    }
  } catch { /* older browsers */ }
  return "US";
}

export default function PhoneInput({
  value,
  onChange,
  defaultCountry,
  placeholder = "Phone number",
  className = "",
  id,
}: Props) {
  const [country, setCountry] = useState<CountryCode>(() => detectCountry(defaultCountry));
  const [national, setNational] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Adopt an incoming E.164 value once (edit an existing draft, or a value restored from autosave).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !value) return;
    const parsed = parsePhoneNumberFromString(value);
    if (parsed) {
      if (parsed.country) setCountry(parsed.country);
      setNational(parsed.formatNational());
      seeded.current = true;
    }
  }, [value]);

  const dial = useMemo(() => {
    try { return `+${getCountryCallingCode(country)}`; } catch { return "+1"; }
  }, [country]);

  const emit = (rawNational: string, cc: CountryCode) => {
    const digits = rawNational.replace(/\D/g, "");
    if (!digits) { onChange("", false); return; }
    const parsed = parsePhoneNumberFromString(digits, cc);
    onChange(parsed ? parsed.number : `+${getCountryCallingCode(cc)}${digits}`, !!parsed?.isValid());
  };

  const handleType = (raw: string) => {
    // AsYouType inserts the country's own separators — parentheses for the US, spaces for Colombia.
    // Deleting must not fight the formatter, so a shrinking value is passed through unformatted
    // and re-formatted from its digits.
    const formatted = new AsYouType(country).input(raw);
    const next = formatted.length < raw.length && raw.endsWith(" ") ? raw : formatted;
    setNational(next);
    emit(next, country);
  };

  const pickCountry = (cc: CountryCode) => {
    setCountry(cc);
    setOpen(false);
    setQuery("");
    // Re-format what they already typed under the new country's rules.
    const digits = national.replace(/\D/g, "");
    const reformatted = digits ? new AsYouType(cc).input(digits) : "";
    setNational(reformatted);
    emit(reformatted, cc);
  };

  const list = useMemo(() => {
    const all = (getCountries() as CountryCode[]).map((cc) => ({
      cc,
      name: countryName(cc),
      dial: (() => { try { return `+${getCountryCallingCode(cc)}`; } catch { return ""; } })(),
    }));
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    const matched = q
      ? all.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.cc.toLowerCase().startsWith(q) ||
          c.dial.replace("+", "").startsWith(q))
      : all;
    // Priority countries float to the top of the unfiltered list.
    if (q) return matched.sort((a, b) => a.name.localeCompare(b.name));
    const top = PRIORITY.map((p) => matched.find((c) => c.cc === p)).filter(Boolean) as typeof all;
    const rest = matched.filter((c) => !PRIORITY.includes(c.cc)).sort((a, b) => a.name.localeCompare(b.name));
    return [...top, ...rest];
  }, [query]);

  // Anchor the menu in a portal so it escapes the form's overflow/stacking contexts — the same
  // problem the InfoTip portal solved.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setMenuPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 280) });
    };
    place();
    setTimeout(() => searchRef.current?.focus(), 40);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const example = useMemo(() => {
    // Show the country's shape as a placeholder hint rather than a generic "Phone number".
    try {
      const sample = country === "US" || country === "CA" ? "2015550123" : "3001234567";
      return new AsYouType(country).input(sample);
    } catch { return placeholder; }
  }, [country, placeholder]);

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Country code: ${countryName(country)} ${dial}`}
        className="input flex shrink-0 items-center gap-1.5 !w-auto !px-3 font-semibold"
      >
        <span className="text-base leading-none">{flagOf(country)}</span>
        <span className="text-sm">{dial}</span>
        <Chevron size="sm" className="opacity-50" />
      </button>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="input min-w-0 flex-1"
        value={national}
        placeholder={example}
        onChange={(e) => handleType(e.target.value)}
      />

      {open && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[201] max-h-[320px] overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-2xl dark:border-white/15 dark:bg-[#141824]"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            <div className="border-b border-ink/10 p-2 dark:border-white/10">
              <input
                ref={searchRef}
                className="input !py-2 text-sm"
                placeholder="Search country or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-[252px] overflow-y-auto overscroll-contain">
              {list.length === 0 && <p className="px-3 py-4 text-center text-sm opacity-50">No match</p>}
              {list.map((c) => (
                <button
                  key={c.cc}
                  type="button"
                  onClick={() => pickCountry(c.cc)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-brand/5 ${c.cc === country ? "bg-brand/10 font-bold" : ""}`}
                >
                  <span className="text-base leading-none">{flagOf(c.cc)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 text-xs opacity-50">{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
