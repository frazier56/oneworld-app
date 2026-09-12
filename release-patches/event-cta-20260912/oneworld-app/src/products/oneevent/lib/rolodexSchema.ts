// Canonical Rolodex schema — 16 fields. Native columns vs custom_fields JSONB keys.
// Keep this in sync with .lovable/memory/features/events/rolodex-schema.md

export type RolodexFieldKey =
  | "photo_url"
  | "name"
  | "whatsapp_link" // WhatsApp link / wa.me shortcut
  | "phone"
  | "email"
  | "location"
  | "profession"
  | "business_name"
  | "website"
  | "sells_something" // Yes/No
  | "what_they_sell"  // conditional on sells_something === Yes
  | "who_they_help"
  | "niche"
  | "current_bottleneck"
  | "pays_referral_fees"
  | "monthly_revenue"
  | "offer_price"
  | "notes";

export const ROLODEX_NATIVE_KEYS = ["photo_url", "name", "phone", "email", "location"] as const;
export const ROLODEX_CUSTOM_KEYS = [
  "whatsapp_link",
  "profession",
  "business_name",
  "website",
  "sells_something",
  "what_they_sell",
  "who_they_help",
  "niche",
  "current_bottleneck",
  "pays_referral_fees",
  "monthly_revenue",
  "offer_price",
] as const;

export interface RolodexField {
  key: RolodexFieldKey;
  label: string;
  placeholder?: string;
  type: "text" | "email" | "tel" | "url" | "textarea" | "select" | "image";
  options?: string[];
  storage: "native" | "custom";
}

export const ROLODEX_FIELDS: RolodexField[] = [
  { key: "photo_url",          label: "Photo",                placeholder: "Upload a photo (optional)",        type: "image",    storage: "native" },
  { key: "name",               label: "Full Name",            placeholder: "Enter their full name",            type: "text",     storage: "native" },
  { key: "whatsapp_link",      label: "WhatsApp Link",        placeholder: "wa.me/15551234567 or https://wa.me/...", type: "url", storage: "custom" },
  { key: "phone",              label: "Phone Number",         placeholder: "Enter phone number",               type: "tel",      storage: "native" },
  { key: "email",              label: "Email",                placeholder: "name@example.com",                 type: "email",    storage: "native" },
  { key: "location",           label: "Location",             placeholder: "City, country",                    type: "text",     storage: "native" },
  { key: "profession",         label: "Profession",           placeholder: "e.g. High-ticket closer, coach",   type: "text",     storage: "custom" },
  { key: "business_name",      label: "Business Name",        placeholder: "Enter business name",              type: "text",     storage: "custom" },
  { key: "website",            label: "Website",              placeholder: "https://",                         type: "url",      storage: "custom" },
  { key: "sells_something",    label: "Do they sell something?", type: "select", storage: "custom", options: ["", "Yes", "No"] },
  { key: "what_they_sell",     label: "What do they sell?",   placeholder: "Describe their offer",             type: "text",     storage: "custom" },
  { key: "who_they_help",      label: "Who do they help?",    placeholder: "Describe their ideal customer",    type: "text",     storage: "custom" },
  { key: "niche",              label: "Niche",                placeholder: "Industry / niche",                 type: "text",     storage: "custom" },
  { key: "current_bottleneck", label: "Current Bottleneck",   placeholder: "What's holding them back?",        type: "textarea", storage: "custom" },
  { key: "pays_referral_fees", label: "Pays Referral Fees",   type: "select",   storage: "custom", options: ["", "Yes", "No", "Maybe"] },
  { key: "monthly_revenue",    label: "Monthly Revenue (range)", placeholder: "e.g. $5k–$10k",               type: "text",     storage: "custom" },
  { key: "offer_price",        label: "Offer Price",          placeholder: "e.g. $2,500",                      type: "text",     storage: "custom" },
  { key: "notes",              label: "Notes",                placeholder: "Anything else worth remembering",  type: "textarea", storage: "native" },
];

// CSV header → canonical key (loose match, normalized)
export function guessRolodexFieldFromHeader(header: string): RolodexFieldKey | "ignore" {
  const h = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^(photo|image|picture|avatar|foto)$/.test(h)) return "photo_url";
  if (/^(name|full name|fullname|nombre)$/.test(h)) return "name";
  if (/(whatsapp.*(link|url)|wa\.me)/.test(h)) return "whatsapp_link";
  if (/(whatsapp|wa$|phone|mobile|cell|tel|telefono|movil|celular)/.test(h)) return "phone";
  if (/(email|e mail|correo)/.test(h)) return "email";
  if (/(location|city|country|address|ciudad|pais)/.test(h)) return "location";
  if (/(profession|occupation|job title|profesion|titulo)/.test(h)) return "profession";
  if (/(business|company|empresa|negocio)/.test(h)) return "business_name";
  if (/(website|url|site|web)/.test(h)) return "website";
  if (/(sells?.*(something|product)|do.*sell|vende algo)/.test(h)) return "sells_something";
  if (/(what.*(sell|offer)|product|service|que vende|oferta)/.test(h)) return "what_they_sell";
  if (/(who.*(help|serve|target)|client|customer|audience|cliente)/.test(h)) return "who_they_help";
  if (/(niche|industry|industria)/.test(h)) return "niche";
  if (/(bottleneck|challenge|problem|pain|reto|problema)/.test(h)) return "current_bottleneck";
  if (/(referr?al.*fee|pays?.*referr|comision|comisi)/.test(h)) return "pays_referral_fees";
  if (/(monthly.*revenue|mrr|revenue|ingreso|facturacion)/.test(h)) return "monthly_revenue";
  if (/(offer.*price|price|precio)/.test(h)) return "offer_price";
  if (/(note|comment|remark|nota|comentario)/.test(h)) return "notes";
  return "ignore";
}

export interface RolodexFormValues {
  photo_url?: string;
  name?: string;
  whatsapp_link?: string;
  phone?: string;
  email?: string;
  location?: string;
  profession?: string;
  business_name?: string;
  website?: string;
  sells_something?: string;
  what_they_sell?: string;
  who_they_help?: string;
  niche?: string;
  current_bottleneck?: string;
  pays_referral_fees?: string;
  monthly_revenue?: string;
  offer_price?: string;
  notes?: string;
}

// Split a flat values object into the native columns + custom_fields JSONB shape.
export function splitRolodexValues(values: RolodexFormValues): {
  native: { name?: string; phone?: string; email?: string; location?: string; photo_url?: string };
  custom_fields: Record<string, string>;
  notes?: string;
} {
  const native: any = {};
  const custom_fields: Record<string, string> = {};
  for (const field of ROLODEX_FIELDS) {
    const val = values[field.key];
    if (val == null || String(val).trim() === "") continue;
    if (field.key === "notes") continue; // handled separately
    if (field.storage === "native") native[field.key] = String(val).trim();
    else custom_fields[field.key] = String(val).trim();
  }
  return { native, custom_fields, notes: values.notes?.trim() || undefined };
}
