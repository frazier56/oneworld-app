/* ── THE PRIVATE ADDRESS IS ONE COLUMN HOLDING THREE FACTS ────────────────────────────────
   `rental_private.property_addresses.address_line` is a single text column, so the building, the
   street and the unit travel together in it. This module is the only place that encoding is
   known.

   ⚠️ TWO CORRECTIONS FROM MAX LIVE HERE, AND BOTH WERE RIGHT.

   ── ABB-1, first correction: dropping the empty fields ────────────────────────────────────
   The original joined the three with " — " and dropped the empties, which made the result
   AMBIGUOUS. A host with no building name who filled in a street and an apartment produced

       "Carrera 43A #7-50 — Apto 1003"

   — two parts, indistinguishable from a building plus a street. Reading it back put the real
   street in the BUILDING box and the apartment in the STREET box, and the autosave that follows
   wrote that corruption back as the truth. Splitting from the right does not fix it: two parts
   are ambiguous from either end. Dropping the empties was the bug.

   ── ABB-1, second correction: ARITY IS NOT A VERSION ──────────────────────────────────────
   My first fix always emitted three slots and treated "exactly three parts" as the version
   marker. Max: *"historical street/building data can already contain two separators. For example
   a legacy raw street 'Street — Sector — Entrance' is read as three structured fields."* He is
   right, and the failure is the same corruption in a new costume — a real one-part street would
   be sliced into three labelled boxes. He also caught that the write path replaced a literal
   separator inside a field with a comma, so **the host's own text was not preserved exactly**.

   So the encoding is now explicit and versioned, and nothing is normalised away:

       v2|<building>|<street>|<unit>

   with `\` escaped as `\\` and `|` escaped as `\|` inside each field. A value that does not begin
   with `v2|` is legacy, whatever it contains and however many separators it happens to have.

   ── WHY A PREFIX IS SAFE NOW, WHEN IT WAS NOT BEFORE ──────────────────────────────────────
   I rejected a version prefix the first time for a real reason: this column is the `direccion`
   printed on the Colombian lease and the query behind the contract view's Maps link, so `v2|`
   would have appeared verbatim in a lease. **That objection was removed by my own fix** — every
   human-facing reader now goes through `formatStoredAddress`, which returns
   "Carrera 43A #7-50, Apto 1003". Once the raw column stops reaching a person, a marker costs
   nothing and buys certainty. It is worth noticing that the constraint I designed around had
   already been dissolved by the change sitting next to it.

   ── READING A LEGACY VALUE: DO NOT GUESS ──────────────────────────────────────────────────
   Anything without the `v2|` prefix goes **whole into the street box**, with building and unit
   empty. That is deliberate and it is the whole safety property. A legacy value genuinely cannot
   be resolved — "A — B" is as likely to be street plus unit as building plus street, and
   "A — B — C" is as likely to be one street containing two dashes as three fields — and a wrong
   guess puts real data in a wrongly labelled box where the next autosave makes it permanent.
   Showing the whole line in the street box loses a split; the host sees their own address intact,
   separates it in one edit, and that edit saves in the unambiguous encoding.

   **A lost split is recoverable. A field silently moved into the wrong box is not.** */

const V2 = "v2|";
const SEP = "|";

/** Escape so a field can contain anything at all, including the separator and a backslash. */
const encField = (s: string): string =>
  String(s ?? "").trim().replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

/** Split on unescaped separators only, then unescape. One pass, no regex lookbehind. */
function decodeV2(body: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && i + 1 < body.length) { cur += body[i + 1]; i++; continue; }
    if (c === SEP) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

export function joinStoredAddress(building: string, street: string, unit: string): string {
  const b = encField(building), s = encField(street), u = encField(unit);
  /* All three empty means there is no address at all, and an empty column must stay empty rather
     than become a bare marker, which would read as an address that exists and is blank. */
  if (!b && !s && !u) return "";
  return V2 + [b, s, u].join(SEP);
}

export function splitStoredAddress(stored: string): { building: string; street: string; unit: string } {
  const raw = stored ?? "";
  if (!raw.trim()) return { building: "", street: "", unit: "" };

  if (raw.startsWith(V2)) {
    const parts = decodeV2(raw.slice(V2.length));
    /* A v2 value always has exactly three fields. Anything else carrying the marker was not
       written by this function, and the safe reading is the same as for a legacy value. */
    if (parts.length === 3) {
      return { building: parts[0].trim(), street: parts[1].trim(), unit: parts[2].trim() };
    }
  }
  return { building: "", street: raw.trim(), unit: "" };
}

/** The address as a PERSON should see it — on a lease, in a Maps query, in a message. Never show
 *  the raw column: it carries the version marker, the separators and any escaping. */
export function formatStoredAddress(stored: string): string {
  const a = splitStoredAddress(stored);
  return [a.building, a.street, a.unit].map(x => x.trim()).filter(Boolean).join(", ");
}
