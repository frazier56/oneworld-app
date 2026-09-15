/**
 * PASSWORD RULES — one source of truth, shared by sign-up and reset.
 * ============================================================================================
 * The sign-up wizard and the reset-password screen must enforce the SAME password policy — two
 * different rules for "a good password" is exactly the kind of drift that ships one screen at
 * 8 chars and another at 10. So the policy, the live checklist model, and the breach check all
 * live here and both screens import them.
 */

export type PwRule = { key: string; label: string; ok: boolean; pending?: boolean };

/** The live rules, in display order. `breached`: null = not checked yet, false = clear, true = found. */
export function passwordRules(pw: string, pw2: string, breached: boolean | null): PwRule[] {
  return [
    { key: "len", label: "At least 10 characters", ok: pw.length >= 10 },
    { key: "upper", label: "An uppercase letter (A–Z)", ok: /[A-Z]/.test(pw) },
    { key: "lower", label: "A lowercase letter (a–z)", ok: /[a-z]/.test(pw) },
    { key: "num", label: "A number (0–9)", ok: /\d/.test(pw) },
    { key: "sym", label: "A symbol (! ? @ # …)", ok: /[^A-Za-z0-9]/.test(pw) },
    { key: "breach", label: "Not found in a known data breach",
      ok: breached === false && pw.length > 0, pending: breached === null && pw.length >= 10 },
    { key: "match", label: "Both passwords match", ok: pw.length > 0 && pw === pw2 },
  ];
}

/** The five character rules + match are the HARD gate; a KNOWN breach blocks, an unreachable
 *  service does not (fail-open). */
export function passwordAcceptable(pw: string, pw2: string, breached: boolean | null): boolean {
  return pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw) && pw === pw2 && breached !== true;
}

/**
 * HaveIBeenPwned k-anonymity: only the first 5 chars of the SHA-1 hash leave the device, never
 * the password. Returns true only on a real match; any failure resolves to false (fail-open).
 */
export async function isPasswordBreached(pw: string): Promise<boolean> {
  try {
    const bytes = new TextEncoder().encode(pw);
    const hash = await crypto.subtle.digest("SHA-1", bytes);
    const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`);
    if (!res.ok) return false;
    const body = await res.text();
    const suffix = hex.slice(5);
    return body.split("\n").some((line) => line.split(":")[0].trim() === suffix);
  } catch { return false; }
}
