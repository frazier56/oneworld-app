import { readPref, writePref } from "./safeStorage";
import { productFromPath } from "../routes";
import { supabase } from "./supabase";

/**
 * HOW DID THIS PERSON GET HERE?
 * ============================================================================================
 * Lee, 4 Aug 2026: *"We gotta make sure we document thoroughly all of these types of ways that
 * people can come in... Was it a QR code? Was it a contract? Did they click the hire button? In
 * my dashboard I need to see which users are on which accounts, total users and users per
 * account, and then who's generating revenue."*
 *
 * The database has had `entry_product`, `entry_campaign`, `referral_source` and `entry_at` for
 * weeks. Nothing has ever written them: 0 of 70 profiles carry an entry product. The dashboard
 * question was unanswerable not because the model was missing but because the PIPE was never
 * connected — which is the worst version of the problem, because everything looks ready.
 *
 * ── THE ORDER PROBLEM, AND WHY THIS IS TWO HALVES ───────────────────────────────────────────
 * The interesting facts are all known BEFORE there is an account: which product's URL they
 * opened, which campaign brought them, whether they arrived on a QR code or a shared contract.
 * By the time there is a `profiles` row to write them to, the browser has been to Google and
 * back and the original URL is long gone.
 *
 * So: CAPTURE on first load, into device storage. FLUSH after sign-in. Exactly the shape the One
 * ID disclosure stamp already uses, and for exactly the same reason — that one shipped as a
 * guaranteed no-op the first time because it was written before the redirect.
 *
 * Nothing here may ever break a sign-in. Every write is best-effort, every failure is swallowed,
 * and the server ignores values it does not recognise rather than raising. Telemetry that can
 * take down the front door is not worth having.
 */

const KEY = "ow.entry";

export interface EntryContext {
  product?: string;    // which product's address they opened first
  campaign?: string;   // ?utm_campaign= / ?c=
  source?: string;     // qr · contract · hire · profile · referral · <domain> · direct
  intent?: string;     // OneJob's hiring/working question, when the link carried it
}

/**
 * Work out where this visit came from, and remember it — ONCE per device.
 *
 * `once` is the whole design. Somebody who arrives on a OneEvent QR code, browses, leaves, and
 * comes back a week later through a OneJob advert entered through OneEvent. Overwriting on the
 * second visit would quietly turn first-touch attribution into last-touch and nobody would ever
 * notice, because both produce a plausible number.
 */
export function captureEntry(): void {
  try {
    if (readPref(KEY)) return;                       // already answered on this device

    const url = new URL(window.location.href);
    const q = url.searchParams;
    const path = url.pathname;

    /* SOURCE, most specific first. Each of these is a real doorway Lee named, and each leaves a
       different mark on the URL:
         · a QR code carries ?qr= (printed on cards, flyers and job sheets)
         · a shared contract is /contract/<token> — openable with no account, by design
         · a hire link is /hire/<token>, minted by `hireLink()`
         · a public profile is /<product>/p/<id>, the thing people paste into a message
       Anything else falls back to the referring site, and finally to "direct". */
    const explicit = q.get("ref") || q.get("src") || q.get("utm_source") || undefined;
    let source: string | undefined = explicit;
    if (!source) {
      if (q.has("qr")) source = "qr";
      else if (/\/contract\//.test(path)) source = "contract";
      else if (/\/hire\//.test(path)) source = "hire";
      else if (/\/p\//.test(path)) source = "profile";
      else {
        const r = document.referrer;
        if (!r) source = "direct";
        else {
          try {
            const h = new URL(r).hostname;
            /* Our own marketing site and doorway subdomains are not "referrals" — treating them
               as such would file every advert click under oneworldlabs.ai and hide the campaign
               that actually paid for it. */
            source = /(^|\.)oneworldlabs\.ai$/.test(h) ? "oneworld" : h;
          } catch { source = "direct"; }
        }
      }
    }

    /* PRODUCT. `productFromPath` returns null on the shared surfaces — the origin, Your World,
       the sign-in screen — and that null is meaningful rather than missing: it means they came
       to One World itself with no product in mind, which is precisely the case the One World
       splash exists for. Recorded as "oneworld" so it shows up in the dashboard as its own
       bucket instead of vanishing into the unrecorded pile. */
    const product = productFromPath(path) ?? "oneworld";

    const ctx: EntryContext = {
      product,
      campaign: q.get("utm_campaign") || q.get("c") || undefined,
      source,
      intent: q.get("intent") || undefined,
    };
    writePref(KEY, JSON.stringify(ctx));
  } catch {
    /* A malformed URL, storage disabled, Lockdown Mode. None of it matters enough to throw on
       the first line of the first screen. */
  }
}

/** Send it once there is an account to attach it to. Idempotent server-side, so calling this on
 *  every sign-in is cheaper than working out whether it is the first one. */
export async function flushEntry(): Promise<void> {
  try {
    const raw = readPref(KEY);
    if (!raw) return;
    const c = JSON.parse(raw) as EntryContext;
    await supabase.rpc("record_entry_context", {
      p_product: c.product ?? null,
      p_campaign: c.campaign ?? null,
      p_source: c.source ?? null,
      p_intent: c.intent ?? null,
    });
    /* Deliberately NOT cleared. The server takes first touch and ignores the rest, so replaying
       is harmless — and keeping it means a member who signs in on this device again still has
       the record if the first call failed on a bad connection. */
  } catch { /* best effort, always */ }
}

/** For the tests and for anyone debugging an attribution question on a real device. */
export function readEntry(): EntryContext | null {
  try { const r = readPref(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
