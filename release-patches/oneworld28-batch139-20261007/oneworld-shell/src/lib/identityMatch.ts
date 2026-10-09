/**
 * IDENTITY MATCH — how sure are we that this account belongs to this person? (SHELL)
 * ============================================================================================
 * Lee, 9 October 2026:
 *
 *   *"Even though the platform will map to the person's account and they can click yes, this is
 *   my account — it could be a STOLEN account. So it's still good to match the percent confidence
 *   against their name, their location, email address and phone number. If the location's in
 *   Aruba but they originated their account in Texas, that's not good unless there's a secondary
 *   match after that. We might need to say, hey, we got a 90 percent match, a 75 percent match.
 *   If it's not 100 percent, maybe there's a secondary capture match — solve a puzzle. Because
 *   when people hack accounts, this is what happens."*
 *
 * He is right, and the reason is worth writing down: **"Yes, that's me" is pressed on the device
 * holding the session, not by the person who owns the name.** Somebody who has taken over an
 * Instagram account can complete the platform's own approval perfectly. The approval proves
 * CONTROL of the account. It does not prove the account is THEIRS. This file is the second
 * question — does the account look like this person? — and it is asked AFTER the approval, every
 * time, never instead of it.
 *
 * ── WHAT THIS FILE IS ──────────────────────────────────────────────────────────────────────
 * One pure function. No network, no database, no React, no clock. Four signals in, a score and a
 * verdict out, the same answer every time for the same input, which is what makes it testable
 * and what makes a disputed result explainable to the member afterwards.
 *
 * ── THREE RULES IT ENFORCES, EACH FROM A WAY THIS GOES WRONG ───────────────────────────────
 *
 * 1. **A MISSING SIGNAL IS NOT A FAILED SIGNAL.** Most platforms hand back no email and no phone
 *    at all. Scoring those as zero would put every honest person at about forty percent and send
 *    the whole population to the step-up, which trains people to click through it. A signal we
 *    cannot see is DROPPED and the remaining weights are renormalised — the same active-bucket
 *    renormalisation OneScore uses, for the same reason.
 *
 * 2. **A CONTRADICTION IS NOT A LOW SCORE, IT IS A FLAG.** Aruba against Texas is not "slightly
 *    less confident". It is two facts that cannot both be true, and averaging it away is exactly
 *    how a stolen account slips through on the strength of a matching name. Any contradicted
 *    signal caps the verdict at `check` no matter what the other three say.
 *
 * 3. **ONE HUNDRED PERCENT IS RESERVED.** It requires every one of the four signals to be present
 *    AND to match. Three out of four with nothing contradicting is a `pass`, and it reads as 90
 *    or 95 percent — which is the honest number, and is the number Lee asked to see.
 */

export type MatchSignal = "name" | "email" | "phone" | "location";

/** What we know about the member, from their One ID. Any field may be missing. */
export interface KnownPerson {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Free text as the member wrote it — "Medellín, Colombia", "Dallas, TX". */
  location?: string | null;
}

/** What the platform handed back about the account being claimed. Any field may be missing. */
export interface ClaimedAccount {
  platform: string;
  /** The handle, e.g. "Frazierstrong". Used as a weak stand-in when no real name is given. */
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
}

export interface SignalResult {
  signal: MatchSignal;
  /** 0 to 1. Only meaningful when `state` is "match" or "weak". */
  score: number;
  /** match = agrees · weak = partly agrees · conflict = both known and they disagree ·
   *  unknown = one side or both did not give it, so it is not counted at all. */
  state: "match" | "weak" | "conflict" | "unknown";
  /** One plain sentence, shown to the member and kept for a dispute. */
  why: string;
}

export interface MatchVerdict {
  /** 0 to 100, already rounded — this is the number Lee asked to put on the screen. */
  percent: number;
  /** pass = connect it · check = connect only after the second step · refuse = do not connect. */
  verdict: "pass" | "check" | "refuse";
  signals: SignalResult[];
  /** The signals that actually counted. Everything else was missing on one side. */
  counted: MatchSignal[];
  /** Signals where the two sides contradict each other. Non-empty always forces "check". */
  conflicts: MatchSignal[];
  /** One sentence for the member, in plain words. */
  headline: string;
}

/* Weights BEFORE renormalisation. Name is heaviest because it is the only one almost every
   platform returns; phone and email are the hardest to fake and so are worth more than location,
   which changes honestly all the time — people move, and people travel. */
const WEIGHT: Record<MatchSignal, number> = { name: 35, email: 25, phone: 25, location: 15 };

/* ── the small comparers ─────────────────────────────────────────────────────────────────── */

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (s: string) => strip(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const digits = (s: string) => s.replace(/\D+/g, "");
const squash = (s: string) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

function nameScore(known: string, claimedName: string | null | undefined, handle: string | null | undefined): SignalResult {
  const a = words(known);
  const bName = claimedName ? words(claimedName) : [];
  if (a.length && bName.length) {
    const A = new Set(a), B = new Set(bName);
    const shared = [...A].filter(w => B.has(w));
    if (shared.length === A.size && A.size === B.size)
      return { signal: "name", score: 1, state: "match", why: "The name on the account is the same name." };
    if (shared.length >= 2)
      return { signal: "name", score: 0.9, state: "match", why: "First and last name both match." };
    /* First initial plus a matching surname — "L. Frazier" against "Lee Frazier". */
    const surname = a[a.length - 1], bSurname = bName[bName.length - 1];
    if (surname === bSurname && bName[0]?.[0] === a[0]?.[0])
      return { signal: "name", score: 0.75, state: "match", why: "Surname matches and the first initial agrees." };
    if (shared.length === 1)
      return { signal: "name", score: 0.5, state: "weak", why: "Only one part of the name matches." };
    return { signal: "name", score: 0, state: "conflict", why: "The name on the account is a different name." };
  }
  /* No real name from the platform. A handle is a hint, never proof: "frazierstrong" carries the
     surname, and that is worth something, but it is never a full match on its own. */
  if (a.length && handle) {
    const h = squash(handle);
    const hits = a.filter(w => w.length > 2 && h.includes(w));
    if (hits.length >= 2) return { signal: "name", score: 0.8, state: "match", why: "The handle contains their first and last name." };
    if (hits.length === 1) return { signal: "name", score: 0.55, state: "weak", why: "The handle contains part of their name." };
    return { signal: "name", score: 0, state: "unknown", why: "The account gave no name, and the handle does not resemble theirs." };
  }
  return { signal: "name", score: 0, state: "unknown", why: "The account gave no name." };
}

function emailScore(known: string, claimed: string): SignalResult {
  const a = known.trim().toLowerCase(), b = claimed.trim().toLowerCase();
  if (a === b) return { signal: "email", score: 1, state: "match", why: "Same email address." };
  const [al, ad] = a.split("@"), [bl, bd] = b.split("@");
  /* PUB30 (TESTING OS4 P0-3): anyone can register the same local part at another provider, so
     it is not evidence either way. */
  if (al && al === bl) return { signal: "email", score: 0, state: "unknown", why: `Same name at a different provider (${ad} and ${bd}) — not proof either way.` };
  return { signal: "email", score: 0, state: "conflict", why: "A different email address is on the account." };
}

function phoneScore(known: string, claimed: string): SignalResult {
  const a = digits(known), b = digits(claimed);
  if (!a || !b) return { signal: "phone", score: 0, state: "unknown", why: "No phone number to compare." };
  /* Last ten digits, so a country code written one way here and another way there is not a
     mismatch. Seven is the local number — right area, almost certainly the same line. */
  if (a.slice(-10) === b.slice(-10)) return { signal: "phone", score: 1, state: "match", why: "Same phone number." };
  if (a.slice(-7) === b.slice(-7)) return { signal: "phone", score: 0.6, state: "weak", why: "The local part of the number matches." };
  return { signal: "phone", score: 0, state: "conflict", why: "A different phone number is on the account." };
}

/* Deliberately small and deliberately generous. The question is not "is this the same street",
   it is "is this the same part of the world" — Lee's Aruba-against-Texas test. People move and
   people travel, so a mismatch is a flag to look twice, never a refusal on its own. */
function placeScore(known: string, claimed: string): SignalResult {
  const a = words(known), b = words(claimed);
  if (!a.length || !b.length) return { signal: "location", score: 0, state: "unknown", why: "No location to compare." };
  const A = new Set(a), shared = b.filter(w => A.has(w));
  if (shared.length >= 2) return { signal: "location", score: 1, state: "match", why: "Same place." };
  if (shared.length === 1) return { signal: "location", score: 0.7, state: "match", why: `Same ${shared[0].length > 2 ? "city or country" : "area"}.` };
  return { signal: "location", score: 0, state: "conflict", why: `The account says ${claimed.trim()}, their profile says ${known.trim()}.` };
}

/* ── the one exported function ───────────────────────────────────────────────────────────── */

function hasStrongPair(counted: SignalResult[]): boolean {
  const strong = counted.some(s => (s.signal === "email" || s.signal === "phone") && s.state === "match" && s.score === 1);
  const matches = counted.filter(s => s.state === "match").length;
  return strong && matches >= 2;
}

export function matchIdentity(person: KnownPerson, account: ClaimedAccount): MatchVerdict {
  const signals: SignalResult[] = [];

  signals.push(person.name?.trim()
    ? nameScore(person.name, account.displayName, account.username)
    : { signal: "name", score: 0, state: "unknown", why: "No name on their One ID yet." });

  signals.push(person.email?.trim() && account.email?.trim()
    ? emailScore(person.email, account.email)
    : { signal: "email", score: 0, state: "unknown", why: "The account did not give an email address." });

  signals.push(person.phone?.trim() && account.phone?.trim()
    ? phoneScore(person.phone, account.phone)
    : { signal: "phone", score: 0, state: "unknown", why: "The account did not give a phone number." });

  signals.push(person.location?.trim() && account.location?.trim()
    ? placeScore(person.location, account.location)
    : { signal: "location", score: 0, state: "unknown", why: "The account did not give a location." });

  const counted = signals.filter(s => s.state !== "unknown");
  const conflicts = signals.filter(s => s.state === "conflict").map(s => s.signal);

  /* RULE 1 — renormalise over what we can actually see. A signal nobody gave us is not evidence
     against the person. */
  const avg = (set: SignalResult[]) => {
    const w = set.reduce((n, s) => n + WEIGHT[s.signal], 0);
    return w === 0 ? 0 : set.reduce((n, s) => n + WEIGHT[s.signal] * s.score, 0) / w;
  };

  /* ⚠️ RULE 1b — AGREEING EVIDENCE MAY NEVER COUNT AGAINST THE PERSON. Found by running the
     cases, not by reading the formula.

     "Lee Frazier" with `frazierlee@gmail.com` on the account scored 100 and passed. The SAME
     person, same name, with `frazierlee@outlook.com` — the same address at a different provider,
     which agrees with them, just not perfectly — scored 88 and was sent to the second step. The
     extra evidence, all of it pointing the right way, made them worse off than giving us nothing
     at all. That is backwards, and in a product it reads as a punishment for having more
     accounts.

     So a signal that AGREES can only ever raise the number. Drop the weakest agreeing signal
     while dropping it helps, and keep the best figure. Anything CONTRADICTING is pinned in and
     can never be dropped — a conflict is the whole point of this file. */
  let keep = counted.slice();
  for (;;) {
    const droppable = keep.filter(s => s.state !== "conflict" && s.score < 1);
    if (keep.length <= 1 || droppable.length === 0) break;
    const weakest = droppable.reduce((a, b) => (a.score <= b.score ? a : b));
    const without = keep.filter(s => s !== weakest);
    if (without.length === 0 || avg(without) <= avg(keep)) break;
    keep = without;
  }
  const raw = avg(keep);

  /* RULE 3 — a hundred is reserved for all four present and all four matching. Anything less is
     capped at 95, so the number on the screen never over-promises. */
  const everything = counted.length === 4 && counted.every(s => s.score === 1);
  let percent = Math.round((everything ? 1 : Math.min(raw, 0.95)) * 100);

  /* RULE 2 — a contradiction is a flag, not an average. It caps the number as well, so the
     screen can never show a comfortable 90 next to a warning triangle. */
  if (conflicts.length) percent = Math.min(percent, 70);

  /* PUB30: without a strong private signal the number must not read like a pass either. */
  if (!hasStrongPair(counted)) percent = Math.min(percent, 80);

  let verdict: MatchVerdict["verdict"];
  if (conflicts.length) verdict = percent >= 40 ? "check" : "refuse";
  else if (counted.length === 0) verdict = "check";          // nothing to go on is not a pass
  /* PUB30 (TESTING OS4 P0-2): a pass needs a strong private signal — the exact same email or
     phone — plus one more independent match. A copied public name can never pass on its own. */
  else if (percent >= 90) verdict = "pass";
  else if (percent >= 55) verdict = "check";
  else verdict = "refuse";

  const headline =
    verdict === "pass" ? "Everything we can check about this account matches you."
    : conflicts.length ? "Most of this account matches you, but something does not add up."
    : counted.length === 0 ? "This account did not tell us enough about itself to be sure."
    : "This account partly matches you.";

  return { percent, verdict, signals, counted: counted.map(s => s.signal), conflicts, headline };
}
