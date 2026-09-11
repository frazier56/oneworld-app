import { parsePhoneNumberFromString, type CountryCode } from "npm:libphonenumber-js@1.11.20";

export type WhatsAppSkipReason =
  | "missing_whatsapp_phone"
  | "whatsapp_opted_out"
  | "whatsapp_permission_missing"
  | "whatsapp_marketing_unavailable_us"
  | "duplicate_destination";

export interface SafetyContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  profilePhone?: string | null;
  whatsappLink?: string | null;
  whatsappOk?: boolean | null;
  tags?: string[] | null;
  updatedAt?: string | null;
  defaultCountry?: CountryCode | null;
}

export interface CanonicalPhone {
  e164: string;
  country: CountryCode | null;
}

export interface SafetyRow {
  id: string;
  name: string;
  maskedDestination: string;
  canonicalDestination: string;
  country: CountryCode | null;
  eligible: boolean;
  reason: WhatsAppSkipReason | null;
}

const SUPPRESSION_TAGS = new Set([
  "do_not_contact", "no_contact", "notification_opted_out",
  "no_whatsapp", "whatsapp_opted_out", "do_not_whatsapp",
]);

function extractWhatsAppNumber(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : null;
    if (url && /(^|\.)wa\.me$/i.test(url.hostname)) return `+${url.pathname.replace(/[^0-9]/g, "")}`;
  } catch {
    return "";
  }
  return raw.replace(/^whatsapp:/i, "").trim();
}

export function canonicalizePhone(value: unknown, defaultCountry?: CountryCode | null): CanonicalPhone | null {
  const raw = extractWhatsAppNumber(value);
  if (!raw) return null;
  // Fail closed for local-format numbers unless their source supplies an explicit country.
  const parsed = parsePhoneNumberFromString(raw, defaultCountry || undefined);
  if (!parsed?.isValid()) return null;
  return { e164: parsed.number, country: parsed.country || null };
}

export function normalizedTags(contact: SafetyContact): string[] {
  return (Array.isArray(contact.tags) ? contact.tags : [])
    .map((tag) => String(tag || "").trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter(Boolean);
}

export function canonicalDestination(contact: SafetyContact): CanonicalPhone | null {
  return canonicalizePhone(contact.whatsappLink, contact.defaultCountry)
    || canonicalizePhone(contact.phone, contact.defaultCountry)
    || canonicalizePhone(contact.profilePhone, contact.defaultCountry);
}

export function maskedDestination(e164: string): string {
  return e164 ? `••••${e164.slice(-4)}` : "Unavailable";
}

export async function fingerprintSafetyRows(rows: SafetyRow[]): Promise<string> {
  const input = rows
    .map((row) => `${row.id}|${row.eligible ? "1" : "0"}|${row.reason || "eligible"}|${row.canonicalDestination}`)
    .sort()
    .join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildWhatsAppSafetyPlan(
  contacts: SafetyContact[],
  optedOutCanonicalDestinations: ReadonlySet<string>,
) {
  const seen = new Set<string>();
  const rows: SafetyRow[] = contacts.map((contact) => {
    const canonical = canonicalDestination(contact);
    const destination = canonical?.e164 || "";
    const tagsSuppressed = normalizedTags(contact).some((tag) => SUPPRESSION_TAGS.has(tag));
    let reason: WhatsAppSkipReason | null = null;
    if (!canonical) reason = "missing_whatsapp_phone";
    // A prior STOP or suppression wins over all consent presentation.
    else if (tagsSuppressed || optedOutCanonicalDestinations.has(destination)) reason = "whatsapp_opted_out";
    else if (contact.whatsappOk !== true) reason = "whatsapp_permission_missing";
    // +1 is NANP, not synonymous with the United States. Use the parsed country.
    else if (canonical.country === "US") reason = "whatsapp_marketing_unavailable_us";
    else if (seen.has(destination)) reason = "duplicate_destination";
    if (!reason) seen.add(destination);
    return {
      id: contact.id,
      name: String(contact.name || "Contact").slice(0, 80),
      maskedDestination: maskedDestination(destination),
      canonicalDestination: destination,
      country: canonical?.country || null,
      eligible: reason == null,
      reason,
    };
  });

  const reasonCounts: Record<WhatsAppSkipReason, number> = {
    missing_whatsapp_phone: 0,
    whatsapp_opted_out: 0,
    whatsapp_permission_missing: 0,
    whatsapp_marketing_unavailable_us: 0,
    duplicate_destination: 0,
  };
  for (const row of rows) if (row.reason) reasonCounts[row.reason] += 1;
  const eligible = rows.filter((row) => row.eligible).length;
  return {
    selected: contacts.length,
    matched: contacts.length,
    eligible,
    skipped: contacts.length - eligible,
    reasonCounts,
    fingerprint: await fingerprintSafetyRows(rows),
    rows,
    publicRows: rows.map(({ canonicalDestination: _redacted, country: _country, ...safe }) => safe),
  };
}



