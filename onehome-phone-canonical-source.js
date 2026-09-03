import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

// This is the OneJob phone contract, presented with the current OneEvent control:
// searchable all-country picker, live regional formatting, E.164 storage, and
// libphonenumber validation. Keep this in sync with PhoneInput.tsx and
// QuickHirePhoneInput.tsx rather than introducing a OneHome-only phone model.
const PRIORITY = ["US", "CO", "MX", "CA", "GB", "ES", "BR", "AR", "PE", "CL"];

const REGION_NAMES = (() => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }); }
  catch { return null; }
})();

const countryName = (country) => {
  try { return REGION_NAMES?.of(country) || country; }
  catch { return country; }
};

const flagOf = (country) => country.replace(/./g, (letter) =>
  String.fromCodePoint(127397 + letter.charCodeAt(0)));

function detectCountry(preferred) {
  const countries = getCountries();
  const tryCountry = (value) => {
    const normalized = String(value || "").toUpperCase();
    return normalized.length === 2 && countries.includes(normalized) ? normalized : null;
  };
  const preferredCountry = tryCountry(preferred);
  if (preferredCountry) return preferredCountry;
  try {
    for (const locale of navigator.languages || [navigator.language]) {
      const found = tryCountry(new Intl.Locale(locale).region);
      if (found) return found;
    }
  } catch { /* Older browsers fall back to US. */ }
  return "US";
}

function listCountries(query) {
  const search = String(query || "").trim().toLowerCase().replace(/^\+/, "");
  const all = getCountries().map((country) => ({
    country,
    name: countryName(country),
    dial: `+${getCountryCallingCode(country)}`,
  }));
  const matched = search
    ? all.filter((entry) => entry.name.toLowerCase().includes(search) ||
        entry.country.toLowerCase().startsWith(search) ||
        entry.dial.slice(1).startsWith(search))
    : all;
  if (search) return matched.sort((a, b) => a.name.localeCompare(b.name));
  const top = PRIORITY.map((country) => matched.find((entry) => entry.country === country)).filter(Boolean);
  const rest = matched.filter((entry) => !PRIORITY.includes(entry.country))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...top, ...rest];
}

function setReactInput(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function normalizeEnteredNumber(value, selectedCountry) {
  const raw = String(value || "").trim();
  if (!raw) return { country: selectedCountry, national: "" };

  const digits = raw.replace(/\D/g, "");
  const callingCode = getCountryCallingCode(selectedCountry);
  const looksInternational = raw.startsWith("+") ||
    (digits.startsWith(callingCode) && digits.length > callingCode.length + 6);
  const international = looksInternational
    ? parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${digits}`)
    : null;

  if (international?.country && international.isPossible()) {
    return {
      country: international.country,
      national: international.formatNational(),
    };
  }

  return {
    country: selectedCountry,
    national: new AsYouType(selectedCountry).input(digits),
  };
}

function mount(source, options = {}) {
  if (!source || source.dataset.ohqaPhone === "true") return source?.nextElementSibling || null;
  source.dataset.ohqaPhone = "true";
  source.classList.add("ohqa-phone-source");
  source.setAttribute("aria-hidden", "true");
  source.tabIndex = -1;

  let country = detectCountry(options.defaultCountry);
  let national = "";
  const initial = parsePhoneNumberFromString(source.value || "");
  if (initial) {
    country = initial.country || country;
    national = initial.formatNational();
  }

  const wrap = document.createElement("div");
  wrap.className = "ohqa-phone-field ohqa-phone-canonical";
  wrap.innerHTML = `
    <button type="button" class="ohqa-phone-country" aria-haspopup="dialog"></button>
    <div class="ohqa-phone-number">
      <span class="ohqa-phone-dial" aria-hidden="true"></span>
      <input type="tel" inputmode="tel" autocomplete="tel-national">
    </div>
    <div class="ohqa-phone-status" aria-live="polite"></div>`;
  source.insertAdjacentElement("afterend", wrap);
  const trigger = wrap.querySelector(".ohqa-phone-country");
  const dial = wrap.querySelector(".ohqa-phone-dial");
  const input = wrap.querySelector("input");
  const status = wrap.querySelector(".ohqa-phone-status");

  const exampleFor = () => {
    try {
      const sample = country === "US" || country === "CA" ? "2015550123" : "3001234567";
      return new AsYouType(country).input(sample);
    } catch { return options.placeholder || "Phone number"; }
  };

  const renderCountry = () => {
    const callingCode = `+${getCountryCallingCode(country)}`;
    trigger.innerHTML = `<span>${flagOf(country)}</span><span class="ohqa-phone-chevron" aria-hidden="true">⌄</span>`;
    trigger.setAttribute("aria-label", `Country: ${countryName(country)} ${callingCode}`);
    dial.textContent = callingCode;
    input.placeholder = exampleFor();
  };

  const emit = () => {
    const digits = national.replace(/\D/g, "");
    if (!digits) {
      wrap.dataset.valid = "false";
      wrap.dataset.e164 = "";
      status.textContent = "";
      setReactInput(source, "");
      return;
    }
    const parsed = parsePhoneNumberFromString(digits, country);
    const e164 = parsed?.number || `+${getCountryCallingCode(country)}${digits}`;
    const valid = !!parsed?.isValid();
    wrap.dataset.valid = String(valid);
    wrap.dataset.e164 = e164;
    status.textContent = valid ? (options.validText || "Valid phone number") : (options.invalidText || "Enter a valid phone number");
    status.classList.toggle("is-valid", valid);
    status.classList.toggle("is-invalid", !valid);
    setReactInput(source, e164);
  };

  const closeMenu = () => document.querySelector("#ohqa-phone-menu")?.remove();
  const openMenu = () => {
    closeMenu();
    const overlay = document.createElement("div");
    overlay.id = "ohqa-phone-menu";
    overlay.className = "ohqa-phone-menu";
    overlay.innerHTML = `<button type="button" class="ohqa-phone-menu-backdrop" aria-label="Close country list"></button>
      <section class="ohqa-phone-menu-card" role="dialog" aria-modal="true" aria-label="Choose country">
        <input type="search" class="ohqa-phone-search" placeholder="Search country or code…" aria-label="Search country or calling code">
        <div class="ohqa-phone-options"></div>
      </section>`;
    document.body.append(overlay);
    const search = overlay.querySelector(".ohqa-phone-search");
    const optionsList = overlay.querySelector(".ohqa-phone-options");
    const renderList = () => {
      const countries = listCountries(search.value);
      optionsList.innerHTML = countries.length ? countries.map((entry) =>
        `<button type="button" data-country="${entry.country}" class="${entry.country === country ? "is-current" : ""}">
          <span>${flagOf(entry.country)}</span><strong>${entry.name}</strong><small>${entry.dial}</small>
        </button>`).join("") : `<p>No match</p>`;
      optionsList.querySelectorAll("[data-country]").forEach((button) => button.addEventListener("click", () => {
        country = button.dataset.country;
        const digits = national.replace(/\D/g, "");
        national = digits ? new AsYouType(country).input(digits) : "";
        input.value = national;
        renderCountry();
        emit();
        closeMenu();
        input.focus();
      }));
    };
    search.addEventListener("input", renderList);
    overlay.querySelector(".ohqa-phone-menu-backdrop").addEventListener("click", closeMenu);
    overlay.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
    renderList();
    search.focus();
  };

  trigger.addEventListener("click", openMenu);
  input.addEventListener("input", () => {
    const normalized = normalizeEnteredNumber(input.value, country);
    const countryChanged = normalized.country !== country;
    country = normalized.country;
    national = normalized.national;
    input.value = national;
    if (countryChanged) renderCountry();
    emit();
  });
  input.value = national;
  renderCountry();
  emit();
  return wrap;
}

window.OneHomeCanonicalPhone = { mount };
