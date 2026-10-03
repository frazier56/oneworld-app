/**
 * Detects contact information (phone numbers, emails, websites, addresses)
 * in user-generated text. Catches common evasion tricks like spacing,
 * dot substitution, etc. — similar to Airbnb's approach.
 *
 * Tuned to AVOID false positives on normal event/job copy. Common words like
 * "Instagram", "WhatsApp", "contact me", "message me" are NOT triggers on
 * their own — only when paired with an actual handle, number, or email-like
 * pattern. Event hosts routinely write "DM me on Instagram for the address"
 * and that should NOT be blocked.
 */

/** Normalize text: strip whitespace/zero-width chars between alphanumeric chars */
function normalize(text: string): string {
  // Remove zero-width characters
  let t = text.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "");
  // Collapse spaces/dots/dashes between single characters: "5 5 5 - 1 2 3 4" → "5551234"
  for (let i = 0; i < 3; i++) {
    t = t.replace(/(\d)[\s.\-_\u2010\u2011\u2012\u2013\u2014()]+(\d)/g, "$1$2");
  }
  return t;
}

/** Normalize for word-based detection (email/url tricks with spaces) */
function normalizeForWords(text: string): string {
  let t = text.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "");
  // Collapse spaces around @ and dots for email detection: "user @ gmail . com"
  t = t.replace(/\s*@\s*/g, "@");
  t = t.replace(/\s*\.\s*/g, ".");
  // Common substitutions
  t = t.replace(/\[at\]/gi, "@");
  t = t.replace(/\(at\)/gi, "@");
  t = t.replace(/\{at\}/gi, "@");
  t = t.replace(/\[dot\]/gi, ".");
  t = t.replace(/\(dot\)/gi, ".");
  t = t.replace(/\{dot\}/gi, ".");
  // "user at gmail" → treat the word "at" before a known provider as @
  t = t.replace(/\b([A-Za-z0-9._%+\-]+)\s+at\s+(gmail|yahoo|hotmail|outlook|icloud|aol|protonmail|ymail|live|msn|zoho|gmx|fastmail|tutanota)\b/gi, "$1@$2");
  return t;
}

/** Well-known email providers (used only for contextual evasion detection) */
const EMAIL_PROVIDERS = [
  "gmail", "yahoo", "hotmail", "outlook", "icloud", "aol",
  "protonmail", "ymail", "msn", "zoho", "gmx", "fastmail", "tutanota",
];

/**
 * Detects contextual email evasion. Requires BOTH a contact-intent verb AND
 * a known email-provider mention in close proximity, OR an explicit
 * "<word> at <provider>" / "<word> at <word> dot com" pattern.
 *
 * Just the word "gmail" alone is fine ("we use Gmail for invites") — we only
 * flag when there's a clear handoff signal.
 */
function detectContextualEmail(text: string): boolean {
  const lower = text.toLowerCase();
  const providerPattern = new RegExp(`\\b(${EMAIL_PROVIDERS.join("|")})\\b`, "i");
  // "<word> at <provider>" - clear handoff
  const wordAtProvider = new RegExp(`\\b[a-z0-9._-]{2,}\\s+at\\s+(${EMAIL_PROVIDERS.join("|")})\\b`, "i");
  if (wordAtProvider.test(lower)) return true;
  // "<word> at <word> dot com" - obfuscated email
  if (/\b[a-z0-9._-]{2,}\s+at\s+[a-z0-9._-]{2,}\s+dot\s+(com|net|org|io|co)\b/i.test(lower)) return true;
  // "email me at <something>" with a provider in the same sentence
  const emailMeAt = /\b(email|e-mail|mail)\s+(me|us)?\s*(at|@)\s*[a-z0-9._-]+/i;
  if (emailMeAt.test(lower) && providerPattern.test(lower)) return true;
  return false;
}

export interface ContactDetectionResult {
  hasContactInfo: boolean;
  detectedTypes: string[];
  message: string;
}

const PHONE_PATTERNS = [
  // Formatted: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx
  /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/,
  // International with + prefix and at least 8 digits total
  /\+\d{1,3}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}/,
];

const EMAIL_PATTERNS = [
  // Real email: word@domain.tld
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  // Obfuscated with brackets: "user [at] gmail [dot] com"
  /[a-zA-Z0-9._%+\-]+\s*(?:\[at\]|\(at\))\s*[a-zA-Z0-9.\-]+\s*(?:\.|\[dot\]|\(dot\))\s*[a-zA-Z]{2,}/i,
];

/**
 * URL detection. Real URLs have protocol or www. Plain "something.com" is
 * also flagged but ONLY if it's a 4+ char host so we don't catch e.g.
 * "U.S." or sentence-final "etc." with the next sentence's word.
 */
const URL_PATTERNS = [
  /https?:\/\/[^\s]+/i,
  /\bwww\.[a-z0-9\-]+\.[a-z]{2,}/i,
  // Bare domain — must be 4+ char SLD and a real TLD, no false-trigger TLDs
  /\b[a-zA-Z0-9\-]{4,}\.(?:com|net|org|io|app|co\.uk|com\.co)\b/i,
];

/**
 * Social handle patterns. Tightened to require an actual handle (not just
 * mentioning a platform name). "DM me on Instagram" alone is OK; "DM me on
 * Instagram @joshcooks" is flagged.
 */
const SOCIAL_HANDLE_PATTERNS = [
  // @username — must be 4+ char and not a known email provider, so "@gmail" doesn't trigger
  /(?<![a-zA-Z0-9._-])@[a-zA-Z][a-zA-Z0-9_.]{3,}\b(?!\.(com|net|org|io|co))/,
  // Platform name immediately followed by a handle: "instagram @joshcooks", "telegram @group", "snap: bobby1"
  /\b(instagram|ig|snapchat|telegram|whatsapp|signal)\s*[:@]\s*[a-zA-Z][a-zA-Z0-9_.]{2,}/i,
  // "find me on instagram joshcooks" / "add me on telegram bobby1" — explicit handoff with handle following
  // Require an @-prefixed or :-prefixed handle so plain "DM me on Instagram for the address" doesn't trigger.
  /\b(find|add|reach|message|msg|dm|hit)\s+me\s+(on|at|@)\s+(instagram|ig|snapchat|snap|telegram|whatsapp|signal)\s*[@:]\s*[a-zA-Z][a-zA-Z0-9_.]{2,}/i,
];

const ADDRESS_KEYWORD_PATTERNS = [
  // "call me at 555..." / "text me at +57..." — intent verb followed by digit-rich payload
  /\b(call|text|ring|dial)\s+(me|us)?\s*(at|on)?\s*[\d(+][\d\s().\-+]{6,}/i,
  // Payment-handle solicitation with an actual handle: "venmo @bobby", "zelle: 555..."
  /\b(venmo|cashapp|cash\s*app|paypal|zelle|pay\s+me)[\s:@]+[a-zA-Z0-9._-]{3,}/i,
];

export function detectContactInfo(text: string): ContactDetectionResult {
  const detectedTypes: string[] = [];

  // Phone detection: only flag well-formed phone-shaped patterns OR a long digit run paired with a phone-intent verb.
  const lower = text.toLowerCase();
  let phoneDetected = false;
  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(text)) { phoneDetected = true; break; }
  }
  if (!phoneDetected) {
    const normalizedDigits = normalize(text);
    // Long run of digits (10+) is suspicious on its own (likely a phone)
    if (/\d{10,}/.test(normalizedDigits)) {
      phoneDetected = true;
    }
  }
  if (!phoneDetected) {
    // 7+ digits + explicit "call/text me" intent
    const digits = text.replace(/\D/g, "");
    const hasPhoneIntent = /\b(call|text|dial|ring)\s+(me|us)\b/i.test(lower);
    if (digits.length >= 7 && hasPhoneIntent) phoneDetected = true;
  }
  if (phoneDetected) detectedTypes.push("phone number");

  // Email detection
  const normalizedWords = normalizeForWords(text);
  let emailDetected = false;
  for (const pattern of EMAIL_PATTERNS) {
    if (pattern.test(normalizedWords) || pattern.test(text)) { emailDetected = true; break; }
  }
  if (!emailDetected && detectContextualEmail(text)) emailDetected = true;
  if (emailDetected) detectedTypes.push("email address");

  // URL detection — skip onesocial.ai (our own domain)
  const textWithoutOwnDomain = text.replace(/\bonesocial\.ai\b/gi, "OneSocial");
  for (const pattern of URL_PATTERNS) {
    if (pattern.test(textWithoutOwnDomain)) {
      detectedTypes.push("website or link");
      break;
    }
  }

  // Social handle detection
  for (const pattern of SOCIAL_HANDLE_PATTERNS) {
    if (pattern.test(text)) { detectedTypes.push("social media handle"); break; }
  }

  // Payment / explicit phone-handoff solicitation
  for (const pattern of ADDRESS_KEYWORD_PATTERNS) {
    if (pattern.test(text)) {
      if (!detectedTypes.includes("phone number")) detectedTypes.push("contact solicitation");
      break;
    }
  }

  if (detectedTypes.length === 0) {
    return { hasContactInfo: false, detectedTypes: [], message: "" };
  }

  const typeList = detectedTypes.join(", ");
  return {
    hasContactInfo: true,
    detectedTypes,
    message: `Your text appears to contain ${typeList}. For everyone's safety, all communication must stay on the OneEvent platform. Please remove any contact information before continuing.`,
  };
}

/** Quick boolean check */
export function hasContactInfo(text: string): boolean {
  return detectContactInfo(text).hasContactInfo;
}
