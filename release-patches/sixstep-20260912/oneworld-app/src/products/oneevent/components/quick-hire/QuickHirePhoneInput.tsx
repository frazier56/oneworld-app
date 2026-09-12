import { countryPhoneData, findCountryByIso } from "@evt/lib/country-phone-data";
import { GlassSelect } from "@evt/components/Pickers";
import { captureContact } from "@evt/lib/contactCapture";

/**
 * THE one phone control for OneEvent (Lee's clean-sweep ruling, 18 Aug 2026):
 * *"the phone number panels need to look the same everywhere... country code, then the rest
 * of the number... same code everywhere."*
 *
 * 17 Aug: selector = flag + dial. 18 Aug v14, from Lee's screenshots: the CLOSED trigger is
 * the FLAG ALONE with the chevron — *"no dot dot dot. Just the flag by itself and a little
 * drop down arrow."* (Windows renders flag emoji as letter pairs, which then ellipsized to
 * "US …".) The dial code lives in the OPEN sheet rows (flag + dial) and next to the number
 * via the placeholder/format. The number formats as you type, by region: +1 gets
 * "(770) 552-1868"; other codes keep digits in groups of three.
 *
 * Every keystroke also feeds the contact-capture store (v14 intelligent capture), so the
 * next form that asks for a phone starts pre-filled.
 */
function formatNational(dial: string, raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (dial === "+1") {
    const t = d.slice(0, 10);
    if (t.length === 0) return "";
    if (t.length <= 3) return `(${t}`;
    if (t.length <= 6) return `(${t.slice(0, 3)}) ${t.slice(3)}`;
    return `(${t.slice(0, 3)}) ${t.slice(3, 6)}-${t.slice(6)}`;
  }
  // Generic international grouping: blocks of 3 (e.g. "601 555 010")
  return d.slice(0, 14).replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export default function QuickHirePhoneInput({ countryCode, phone, onCountryChange, onPhoneChange, countryAriaLabel = "Country", phoneAriaLabel = "Phone", phonePlaceholder }: {
  countryCode: string; phone: string; onCountryChange: (iso: string) => void; onPhoneChange: (formatted: string) => void;
  countryAriaLabel?: string; phoneAriaLabel?: string; phonePlaceholder?: string;
}) {
  const country = findCountryByIso(countryCode);
  const dial = country?.code || "+1";
  /* v16 (Lee): the sheet rows carry flag + NAME + dial so 200 codes are scannable, and the
     sheet is SEARCHABLE by country name, dial code, or ISO ("usually those boxes have a
     search"). The closed trigger stays flag-only — now with room to breathe (w-20; the
     flag was visibly squished at 4.5rem). */
  const opts = countryPhoneData.map(c => ({
    value: c.iso,
    label: (
      <span className="flex items-center gap-2">
        <span className="text-base leading-none">{c.flag || c.iso}</span>
        <span className="min-w-0 flex-1 truncate">{c.name}</span>
        <span className="shrink-0 opacity-60">{c.code}</span>
      </span>
    ),
    search: `${c.name} ${c.code} ${c.iso}`,
  }));
  return (
    <div className="flex min-w-0 gap-2">
      <div className="w-20 shrink-0">
        <GlassSelect
          value={countryCode}
          options={opts as any}
          onChange={(v: string) => { onCountryChange(v); captureContact({ phoneCountry: v }); }}
          ariaLabel={countryAriaLabel}
          searchable
          triggerLabel={<span className="text-xl leading-none">{country?.flag || countryCode}</span>}
        />
      </div>
      {/* v24 DT (Lee, global ruling): the flag alone doesn't tell you the country CODE —
          the dial code now rides WITH the number, as a fixed prefix inside the field
          ("+57 300 620…"). Flag stays alone in the dropdown trigger. */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3 dark:bg-white/5 dark:border-white/15">
        <span className="shrink-0 select-none text-[15px] font-semibold text-ink/60 dark:text-white/60">{dial}</span>
        <input value={phone}
               onChange={e => {
                 const formatted = formatNational(dial, e.target.value);
                 onPhoneChange(formatted);
                 captureContact({ phone: formatted, phoneCountry: countryCode });
               }}
               aria-label={phoneAriaLabel}
               placeholder={phonePlaceholder || (dial === "+1" ? "(555) 123-4567" : "Phone")}
               className="w-full min-w-0 flex-1 bg-transparent py-2.5 outline-none" inputMode="tel" />
      </div>
    </div>
  );
}
