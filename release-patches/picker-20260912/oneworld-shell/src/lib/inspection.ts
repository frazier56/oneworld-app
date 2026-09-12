/**
 * MOVE-IN INSPECTION — the steps, the states, and who may do what
 * ============================================================================================
 * Lee's flow, 13 August 2026, in his order:
 *
 *   The host photographs the place. After the tenant has paid, the tenant walks round and goes
 *   through those photographs one at a time — agree, agree, agree. A disagreement carries a
 *   written note AND a photograph of its own: *"there's a scratch on this TV, in the middle"* is
 *   not a claim until there is a picture of the scratch. The tenant may also add photographs of
 *   things the host never shot. Anything the tenant adds or disputes goes back to the host to
 *   accept or reject. If the host rejects, the form stops and it becomes a conversation in
 *   Messages — and from there either side can restart with fresh photographs.
 *
 * ── THE ORIGINALS ARE NEVER EDITED ──────────────────────────────────────────────────────────
 * A restart is a NEW ROUND. Round 1 stays exactly as it was, permanently. A photograph that can
 * be swapped after the fact proves nothing, and that is the precise reason every damage system on
 * the market ends in an argument: everyone demands before-and-after evidence and nobody can show
 * a record both sides accepted at the time.
 */

export type InspectionState =
  | "draft"            // the host is still adding photographs; nothing is visible to the tenant
  | "awaiting_tenant"  // sent — the tenant is going through it
  | "tenant_responded" // the tenant finished and raised something
  | "host_reviewing"   // the host is looking at what the tenant raised
  | "agreed"           // settled, both sides
  | "disputed"         // the host rejected the tenant's items — goes to Messages
  | "superseded";      // a later round replaced this one

export type ItemVerdict = "pending" | "agreed" | "disputed";
export type Party = "host" | "tenant";

/** Lee: up to one hundred photographs. Also enforced by the database. */
export const MAX_PHOTOS = 100;

/* ── THE CHECKLIST ────────────────────────────────────────────────────────────────────────────
   Lee: *"pay your money, step one. Review the contract details, agree to it. Confirm entry
   details — probably confirm keys is up there before check-in. We need to have a checklist, and
   every step along the way they can check: yes, I completed. Timestamp, timestamp."*

   Order matters and so does who does it. `confirm_entry` sits BEFORE `check_in` on his
   instruction, and it is right: knowing how you get in is what makes arriving possible, and a
   tenant who lands at the door without it has already had the bad experience. */
export type StepKey =
  | "review_contract" | "agree_contract" | "pay" | "confirm_entry"
  | "check_in" | "inspection" | "settled";

export type Step = { key: StepKey; ordinal: number; actor: Party | "both" };

export const CHECKLIST: Step[] = [
  { key: "review_contract", ordinal: 1, actor: "tenant" },
  { key: "agree_contract",  ordinal: 2, actor: "both"   },
  { key: "pay",             ordinal: 3, actor: "tenant" },
  { key: "confirm_entry",   ordinal: 4, actor: "both"   },
  { key: "check_in",        ordinal: 5, actor: "tenant" },
  { key: "inspection",      ordinal: 6, actor: "both"   },
  { key: "settled",         ordinal: 7, actor: "both"   },
];

type L = "en" | "es";
const P = (en: string, es: string) => ({ en, es });

export const STEP_COPY: Record<StepKey, { title: Record<L, string>; hint: Record<L, string> }> = {
  review_contract: { title: P("Read the agreement", "Lea el contrato"),
    hint: P("The whole thing, before anything is signed.", "Completo, antes de firmar nada.") },
  agree_contract:  { title: P("Both sides accept it", "Ambas partes lo aceptan"),
    hint: P("Signed and timestamped by each of you.", "Firmado y con fecha por cada uno.") },
  pay:             { title: P("Pay", "Pague"),
    hint: P("The first payment, and the card hold if there is one.", "El primer pago, y la retención en la tarjeta si aplica.") },
  confirm_entry:   { title: P("Confirm how you get in", "Confirme cómo entrar"),
    hint: P("Keys, codes, the doorman, the exact address.", "Llaves, códigos, portería, la dirección exacta.") },
  check_in:        { title: P("Check in", "Haga el check-in"),
    hint: P("Tell us you have arrived and are inside.", "Confírmenos que ya llegó y está adentro.") },
  inspection:      { title: P("Walk round and agree the photos", "Recorra y acepte las fotos"),
    hint: P("Go through the host's photographs one at a time.", "Revise una por una las fotos del anfitrión.") },
  settled:         { title: P("Move-in settled", "Entrada finalizada"),
    hint: P("Both sides agreed the record. Nothing outside it can be charged later.", "Ambas partes aceptaron el registro. Nada fuera de él puede cobrarse después.") },
};

/** What the tenant may do to a photograph, given where the round is. */
export const tenantCanRespond = (s: InspectionState) => s === "awaiting_tenant";
/** Lee: *"do you wanna add any new photos?"* — only while they are going through it. */
export const tenantCanAdd = (s: InspectionState) => s === "awaiting_tenant";
/** The host reviews only what came back. */
export const hostCanReview = (s: InspectionState) => s === "tenant_responded" || s === "host_reviewing";
/** Editing the evidence is possible only before it is sent. Also enforced by a database trigger. */
export const roundIsEditable = (s: InspectionState) => s === "draft";
/** Lee: *"either party can"* restart — but only once the round is actually finished with. */
export const canRestart = (s: InspectionState) => s === "disputed" || s === "agreed";

export type Item = { verdict: ItemVerdict; added_by_role: Party };

/**
 * Where a round goes when the tenant presses "done".
 *
 * *"So that's one option: tenant agreed with all items, did not submit any new items. The second
 * option is they disagree with an item, or they wanted to add new photos — that gets sent back
 * over to the listing agent to agree or deny."*
 *
 * An untouched photograph counts as a disagreement, not as consent. Silence is not agreement when
 * the whole point of the record is that both sides looked.
 */
export function afterTenant(items: Item[]): InspectionState {
  const anyDisputed = items.some(i => i.verdict === "disputed");
  const anyAdded    = items.some(i => i.added_by_role === "tenant");
  const anyPending  = items.some(i => i.verdict === "pending");
  if (anyPending) return "awaiting_tenant";
  return anyDisputed || anyAdded ? "tenant_responded" : "agreed";
}

/** Where it goes when the host answers. Rejecting ends the form and opens Messages. */
export const afterHost = (accepted: boolean): InspectionState => (accepted ? "agreed" : "disputed");

/** How far through the tenant is — for the progress line above the photographs. */
export function progress(items: Item[]) {
  const host = items.filter(i => i.added_by_role === "host");
  const done = host.filter(i => i.verdict !== "pending").length;
  return { done, total: host.length, pct: host.length ? Math.round((done / host.length) * 100) : 0 };
}

/** May this photograph be saved as disputed? Mirrors the database constraint. */
export const disputeIsComplete = (note?: string | null, photo?: string | null) =>
  !!(note && note.trim() && photo);
