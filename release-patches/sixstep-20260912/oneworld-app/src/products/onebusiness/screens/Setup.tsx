import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OneWorldHomeLink, ScreenHeading, productHref, GlassSelect, PhoneField, PlacesInput } from "@oneworld/shell";
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { businessError, useT } from "../lib/dict";
import { createBusiness, updateBusiness, writeBusinessId, type Business } from "../lib/data";

export default function Setup({ onCreated, business, onSaved, onCancel }: { onCreated?: () => void; business?: Business; onSaved?: () => void; onCancel?: () => void }) {
  const { t, lang, locale, copy } = useT(); const nav = useNavigate(); const es = lang === "es";
  const initialPhone = business?.phone ? parsePhoneNumberFromString(business.phone) : undefined;
  const [f, setF] = useState({ name: business?.name ?? "", industry: business?.industry ?? "", phone: initialPhone?.nationalNumber ?? business?.phone ?? "", email: business?.email ?? "", website: business?.website ?? "", city: business?.city ?? "" });
  const [country, setCountry] = useState<string>(initialPhone?.country ?? (es ? "CO" : "US"));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<Error | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const phone = f.phone ? parsePhoneNumberFromString(f.phone, country as CountryCode) : undefined;
  const countryOptions = useMemo(() => {
    const names = new Intl.DisplayNames([locale === "co" ? "es-CO" : locale], { type: "region" });
    return getCountries().map(iso => ({ iso, name: names.of(iso) ?? iso, dial: `+${getCountryCallingCode(iso)}` }))
      .sort((a, b) => a.name.localeCompare(b.name, locale === "co" ? "es-CO" : locale));
  }, [locale]);
  const nameError = submitted && f.name.trim().length < 2;
  const phoneError = submitted && !!f.phone && !phone?.isValid();
  const up = (k: keyof typeof f, value: string) => setF(x => ({ ...x, [k]: value }));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSubmitted(true);
    if (busy) return;
    const invalidField = f.name.trim().length < 2 ? "business-name" : f.phone && !phone?.isValid() ? "business-phone" : null;
    if (invalidField) {
      const input = e.currentTarget.querySelector<HTMLInputElement>(`#${invalidField}`);
      requestAnimationFrame(() => {
        if (!input?.isConnected) return;
        input.focus({ preventScroll: true });
        input.scrollIntoView({ block: "center", behavior: "instant" });
      });
      return;
    }
    setBusy(true); setErr(null);
    try {
      if (business) {
        await updateBusiness(business.id, f.name.trim(), f.industry, phone?.number ?? "", f.email.trim(), f.website.trim(), f.city.trim());
        onSaved?.(); return;
      }
      const created = await createBusiness(f.name.trim(), f.industry, phone?.number ?? "", f.email.trim(), f.website.trim(), f.city.trim());
      writeBusinessId(created.id); onCreated?.(); nav(productHref("onebusiness", "/services"), { replace: true });
    } catch (x) { setErr(x as Error); } finally { setBusy(false); }
  }
  const field = (k: "name" | "email" | "website", label: string, type = "text") => (
    <div>
      <label htmlFor={`business-${k}`} className="mb-1.5 block text-[14px] font-semibold opacity-70">{label}</label>
      <input id={`business-${k}`} className={`input text-base invalid:!border-rose-500 ${k === "name" && nameError ? "!border-rose-500" : ""}`} type={type}
        autoComplete={k === "name" ? "organization" : k === "website" ? "url" : "email"}
        value={f[k]} onChange={e => up(k, e.target.value)} maxLength={k === "name" ? 120 : 254}
        aria-required={k === "name" || undefined} aria-invalid={k === "name" && nameError || undefined}
        aria-describedby={k === "name" && nameError ? "business-name-error" : undefined} />
      {k === "name" && nameError && <p id="business-name-error" role="alert" className="mt-1 text-sm text-rose-600">{copy("Enter at least two characters.", "Escriba al menos dos caracteres.")}</p>}
    </div>
  );
  return (
    <div className="px-4 pb-10">
      <ScreenHeading className="[&_h1>span]:whitespace-normal [&_h1>span]:overflow-visible [&_h1>span]:break-words max-[360px]:flex-wrap max-[360px]:[&_h1]:w-full max-[360px]:[&>div]:ml-auto">{business ? (copy("Edit business", "Editar negocio")) : (copy("Your business", "Su negocio"))}</ScreenHeading>
      {!business && <p className="mt-1 text-sm opacity-70">{copy("Add your business to choose your services.", "Agregue su negocio para elegir sus servicios.")}</p>}
      <form onSubmit={submit} className="card mt-4 !rounded-2xl !p-4">
        <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-60">
          {field("name", t("bizName"))}
          <div><span className="mb-1.5 block text-[14px] font-semibold opacity-70">{t("industry")}</span>
            <GlassSelect className="w-full" ariaLabel={t("industry")} value={f.industry} onChange={value => up("industry", value)}
              options={[{value:"",label:copy("Choose industry", "Elegir industria")},{value:"Real estate",label:t("industryRealEstate")},{value:"Home & professional services",label:t("industryServices")},{value:"Health & wellness",label:t("industryHealth")},{value:"Shop or restaurant",label:t("industryRetail")},{value:"Other",label:t("industryOther")}]} />
          </div>
          <PhoneField inputClassName="input min-w-0 flex-1 !px-2 !py-3.5 text-base" id="business-phone" label={`${t("phone")} (${copy("optional", "opcional")})`} countryIso={country} onCountry={value => { if (!busy) setCountry(value); }} countryOptions={countryOptions}
            displayValue={new AsYouType(country as CountryCode).input(f.phone)} onPasteNumber={value => {
              if (!value.trim().startsWith("+")) return false;
              const parsed = parsePhoneNumberFromString(value); if (!parsed?.country) return false;
              setCountry(parsed.country); up("phone", parsed.nationalNumber); return true;
            }}
            value={f.phone} onChange={value => up("phone", value)} countryLabel={copy("Country calling code", "Código de país")}
            invalid={phoneError} describedBy={phoneError ? "business-phone-error" : undefined} />
          {phoneError && <p id="business-phone-error" role="alert" className="text-sm text-rose-600">{copy("Check the number and country calling code.", "Revise el número y el código de país.")}</p>}
          {field("email", `${t("email")} (${copy("optional", "opcional")})`, "email")}
          {field("website", `${t("website")} (${copy("optional", "opcional")})`, "url")}
          <div><label htmlFor="business-city" className="mb-1.5 block text-[14px] font-semibold opacity-70">{t("city")} ({copy("optional", "opcional")})</label>
            <PlacesInput id="business-city" ariaLabel={t("city")} disabled={busy} variant="city" value={f.city} onChange={value => up("city", value)} placeholder={copy("Search for a city", "Buscar ciudad")} />
          </div>
          {err && <p role="alert" className="text-sm font-bold text-rose-600 dark:text-rose-300">{businessError(err, locale)}</p>}
          <button type="submit" disabled={busy} aria-busy={busy} className="btn-primary w-full disabled:opacity-50">{busy ? t("loading") : business ? t("save") : t("create")}</button>
          {onCancel && <button type="button" className="ow-tap w-full rounded-xl border border-brand/25 py-3" onClick={onCancel}>{copy("Cancel", "Cancelar")}</button>}
        </fieldset>
      </form>
      {!business && <OneWorldHomeLink />}
    </div>
  );
}
