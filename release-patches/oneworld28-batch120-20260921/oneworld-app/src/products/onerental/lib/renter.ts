import { W } from "@oneworld/shell";

/**
 * THE RENTER'S VOCABULARY — bands, never figures.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"a quick application with a QR code, so all my information would just
 * populate."*
 *
 * Every option here is a BAND. An agent deciding whether to show a flat needs to know "can they
 * afford it", and a band answers that completely. An exact salary answers it no better and turns
 * this table into something worth stealing — see the note on the migration.
 *
 * The keys match CHECK constraints in `onehome_renter_profiles_and_applications_v1`. Adding an
 * option means adding it in both places; the constraint will tell you if you forget.
 */

export type IncomeBand = "under_1k" | "1k_2k" | "2k_3k" | "3k_5k" | "5k_8k" | "over_8k" | "prefer_not";
export type Employment = "employed" | "self_employed" | "remote" | "retired" | "student" | "between";
export type CreditBand = "excellent" | "good" | "fair" | "building" | "prefer_not";

type Opt<T extends string> = { value: T; label: string; note?: string };

/* USD, because that is what the listings are priced in and a band in pesos would need re-reading
   against the TRM every time the rate moved. */
export const incomeBands = (lang: string): Opt<IncomeBand>[] => [
  { value: "under_1k",   label: W(lang, "Under $1,000 / month", "Menos de $1.000 / mes") },
  { value: "1k_2k",      label: "$1,000 – $2,000" },
  { value: "2k_3k",      label: "$2,000 – $3,000" },
  { value: "3k_5k",      label: "$3,000 – $5,000" },
  { value: "5k_8k",      label: "$5,000 – $8,000" },
  { value: "over_8k",    label: W(lang, "Over $8,000", "Más de $8.000") },
  { value: "prefer_not", label: W(lang, "Rather not say", "Prefiero no decirlo") },
];

/* "Remote" is its own answer rather than a flavour of employed. In Medellín it is a large share of
   the foreign tenant market and it changes what an agent asks for next — a foreign employment
   contract instead of a Colombian payslip. */
export const employmentOptions = (lang: string): Opt<Employment>[] => [
  { value: "employed",      label: W(lang, "Employed", "Empleado") },
  { value: "remote",        label: W(lang, "Remote / works abroad", "Remoto / trabaja para el exterior") },
  { value: "self_employed", label: W(lang, "Self-employed", "Independiente") },
  { value: "retired",       label: W(lang, "Retired", "Pensionado") },
  { value: "student",       label: W(lang, "Student", "Estudiante") },
  { value: "between",       label: W(lang, "Between roles", "Entre trabajos") },
];

/* Deliberately NOT a score. A number invites an agent to treat it as a Colombian DataCrédito
   figure, which it is not and which we have no way to verify. */
export const creditBands = (lang: string): Opt<CreditBand>[] => [
  { value: "excellent",  label: W(lang, "Excellent", "Excelente") },
  { value: "good",       label: W(lang, "Good", "Bueno") },
  { value: "fair",       label: W(lang, "Fair", "Regular") },
  { value: "building",   label: W(lang, "Still building it", "En construcción") },
  { value: "prefer_not", label: W(lang, "Rather not say", "Prefiero no decirlo") },
];

export function labelOf<T extends string>(opts: Opt<T>[], v: T | null | undefined): string | null {
  if (!v) return null;
  return opts.find(o => o.value === v)?.label ?? null;
}

/**
 * How complete is this, as a fraction?
 *
 * Drives the readiness row on the hub, the same way OneJob's "Get your money right" shows `1 of 2`.
 * `prefer_not` counts as ANSWERED — declining to say is a decision, and a bar that punishes it
 * would pressure people into disclosing income to move a progress meter.
 */
export function completeness(p: Record<string, any> | null): number {
  if (!p) return 0;
  const checks = [
    p.household_size != null,
    p.move_in_from != null,
    p.lease_months != null,
    !!p.income_band,
    !!p.employment,
    !!p.credit_band,
    !!(p.intro && String(p.intro).trim().length > 20),
  ];
  return checks.filter(Boolean).length / checks.length;
}
