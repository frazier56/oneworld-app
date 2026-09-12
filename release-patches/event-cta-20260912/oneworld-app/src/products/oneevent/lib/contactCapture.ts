/**
 * INTELLIGENT CONTACT CAPTURE — v14 (Lee, 18 Aug 2026).
 * ============================================================================================
 * *"If someone put their name in somewhere, or their email and their phone number, that
 * should persist anywhere else that a name, email, or phone number is asked, so they don't
 * have to enter it twice... the most frustrating thing is to keep entering your name, your
 * phone number, your email address."*
 *
 * Every OneEvent form that asks for name / email / phone WRITES here as the person types,
 * and READS here as its initial value. sessionStorage: survives navigation within the visit,
 * clears when the tab closes — a guest's details never outlive their session on a shared
 * device. Signed-in people still get profile values first; this fills the gaps.
 */
export type CapturedContact = {
  name?: string;
  email?: string;
  phone?: string;        // formatted national number, e.g. "(770) 552-1868"
  phoneCountry?: string; // ISO, e.g. "US"
};

const KEY = "ow.evt.contact";

export function readContact(): CapturedContact {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function captureContact(patch: CapturedContact): void {
  try {
    const cur = readContact();
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v != null && String(v).trim() !== "")
    );
    if (!Object.keys(clean).length) return;
    sessionStorage.setItem(KEY, JSON.stringify({ ...cur, ...clean }));
  } catch { /* storage unavailable (private mode) — capture is best-effort */ }
}
