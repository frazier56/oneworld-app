import { useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n, W } from "../lib/i18n";
import { supabase } from "../lib/supabase";

/**
 * A MESSAGE THAT CONTAINS A PROPERTY SHOWS THE PROPERTY.
 * ============================================================================================
 * Lee's backlog item, 16 August 2026: *"booking links in messages."*
 *
 * Today a message body is one line: `<p …>{m.content}</p>`. So when a host sends a tenant the
 * flat they are talking about, the tenant receives thirty-eight characters of hexadecimal:
 *
 *     https://app.oneworldlabs.ai/rentals/p/9f2c1e04-…
 *
 * — which is not a link (it is plain text inside a `<p>`, so it does not even open), does not say
 * which flat it is, and drops the reader who copies it into the address bar out of the thread they
 * were in. The single most common thing two people on a property platform send each other is a
 * property, and it was the one thing the thread could not render.
 *
 * ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────
 * It reads the words, finds any in-app property link, and renders the property under them: cover
 * photo, title, city, price with its unit. Tapping it navigates INSIDE the app — no reload, no
 * lost thread, and the back arrow returns to the conversation. Any other URL becomes an ordinary
 * link. Text with no links renders exactly as it does today, through the same `<p>`.
 *
 * ── ⚠️ THE PRICE IS THE LISTING'S OWN CURRENCY AND IS NEVER CONVERTED ───────────────────────
 * Standing rule: *the TRM is the only authority on the peso; a missing rate is a missing number,
 * never a guessed one.* A card inside a message is exactly where a helpfully-converted figure
 * would do the most damage — two people negotiating, quoting a number at each other that neither
 * of them typed. So the card shows what the listing says, in the currency the listing says it in,
 * and if there is no price it shows no price. It does not read the viewer's currency at all.
 *
 * ── AND WHY IT DOES NOT SAY "BOOK" ──────────────────────────────────────────────────────────
 * The card carries no action of its own. Tapping it opens the listing, and the listing already
 * owns every action a property has — the dates, the showing request, the contract. A second
 * button here would be a second implementation of the same decision, in a component that cannot
 * see whether the reader is the host, the tenant, or a third person added to the thread. One
 * destination, decided in one place.
 *
 * ── FAILURE IS QUIET, BECAUSE A MESSAGE MUST ALWAYS RENDER ──────────────────────────────────
 * If the row is gone, private, or the lookup fails, the link falls back to being a link and the
 * words are untouched. A conversation that cannot be read because a card would not load is a far
 * worse bug than a card that did not appear.
 */

/* Both halves of OneHome, because they are twins and a control built for one of them has never
   once reached the other by accident. `sale` reads `asking_price`; `rental` reads `price`. */
const PROPERTY_PATH = /\/(rentals|sales)\/p\/([0-9a-fA-F-]{16,})/;
/* Split on whitespace so a URL glued to punctuation still resolves; trailing `.,;:)` is trimmed
   below rather than being matched here, because a closing bracket is far more often prose than
   part of the address. */
const URLISH = /(https?:\/\/[^\s]+|\/(?:rentals|sales)\/p\/[0-9a-fA-F-]{16,})/g;
const IMAGE_URL = /\.(?:jpe?g|png|webp|gif|heic|heif)(?:[?#].*)?$/i;
const VIDEO_URL = /\.(?:mp4|mov|webm)(?:[?#].*)?$/i;
const AUDIO_URL = /\.(?:mp3|m4a|aac|wav|ogg|oga|webm)(?:[?#].*)?$/i;
const MEDIA_LABEL = /^(Photo|Foto|Video|Attachment|Adjunto|Voice message|Mensaje de voz)(?::|\s|·|$)/i;

type Card = {
  kind: "rental" | "sale";
  id: string;
  path: string;
  title: string | null;
  city: string | null;
  price: number | null;
  unit: string | null;
  ccy: string | null;
  photo: string | null;
};

/** `/rentals/p/<id>` out of a full URL or a bare path, or null if it is not one of ours. */
export function propertyRef(href: string): { kind: "rental" | "sale"; id: string; path: string } | null {
  const m = PROPERTY_PATH.exec(href);
  if (!m) return null;
  return { kind: m[1] === "sales" ? "sale" : "rental", id: m[2], path: `/${m[1]}/p/${m[2]}` };
}

/** Trailing sentence punctuation is prose, not address. Kept out of the href AND out of the text. */
export function trimTrailingPunctuation(s: string): [string, string] {
  const m = /[.,;:!?)\]]+$/.exec(s);
  return m ? [s.slice(0, m.index), m[0]] : [s, ""];
}

export default function MessageBody({
  text, mine, highlight = "", messageType,
}: {
  text: string;
  /** Own messages sit on brand ink, so links and the card border have to invert. */
  mine: boolean;
  highlight?: string;
  messageType?: string | null;
}) {
  const { lang } = useI18n();
  const nav = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);

  /* Every distinct property this message points at, in the order they appear. A host who sends
     three flats gets three cards; a host who sends the same flat twice gets one. */
  const refs = dedupe(
    (text.match(URLISH) ?? [])
      .map(raw => propertyRef(trimTrailingPunctuation(raw)[0]))
      .filter((r): r is NonNullable<typeof r> => r != null));
  const rendered = renderedMessageParts(text, messageType === "audio");
  const media = rendered.media;

  useEffect(() => {
    let live = true;
    if (!refs.length) { setCards([]); return; }

    (async () => {
      const out: Card[] = [];
      for (const r of refs) {
        try {
          const { data, error } = r.kind === "rental"
            ? await supabase.from("rental_properties")
                .select("id,title,city,price,price_unit,currency,photos").eq("id", r.id).maybeSingle()
            : await supabase.from("sale_properties")
                .select("id,title,city,asking_price,currency,photos").eq("id", r.id).maybeSingle();
          /* Quiet on purpose. A row that is gone or not readable by this member is not an error
             worth showing anybody — the link below still works. */
          if (error || !data) continue;
          const d = data as Record<string, unknown>;
          out.push({
            kind: r.kind, id: r.id, path: r.path,
            title: str(d.title), city: str(d.city),
            price: num(r.kind === "rental" ? d.price : d.asking_price),
            unit: r.kind === "rental" ? str(d.price_unit) : null,
            ccy: str(d.currency),
            photo: Array.isArray(d.photos) && d.photos.length ? str(d.photos[0]) : null,
          });
        } catch { /* see above — a card is an enhancement, never the delivery mechanism */ }
      }
      if (live) setCards(out);
    })();

    return () => { live = false; };
    /* Keyed on the ids, not on `refs` — a fresh array every render would re-query on every
       keystroke in the composer above. */
  }, [refs.map(r => r.path).join("|")]);

  return (
    <>
      {rendered.text && (
        <p className="whitespace-pre-wrap break-words">{linkify(rendered.text, mine, nav, highlight)}</p>
      )}

      {cards.map(c => (
        <button key={c.path} type="button" onClick={() => nav(c.path)}
          className={`ow-tap mt-2 flex w-full items-stretch gap-0 overflow-hidden rounded-xl text-left ${
            mine ? "bg-white/15" : "bg-white/70 dark:bg-white/[0.06]"}`}>
          {/* Fixed 64px square, reserved whether or not the photo arrives — a card that resizes
              when an image loads shoves every later message down the thread mid-read. */}
          <span className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden ${
            mine ? "bg-white/15" : "bg-ink/[0.06] dark:bg-white/10"}`}>
            {c.photo
              ? <img src={c.photo} alt="" className="h-full w-full object-cover"
                     onError={e => { e.currentTarget.style.display = "none"; }} />
              : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-1.5">
            <span className="truncate text-[13px] font-bold">
              {c.title ?? W(lang, "Property", "Propiedad")}
            </span>
            {c.city && <span className="truncate text-[11.5px] opacity-60">{c.city}</span>}
            {/* No price is no line. It is never a zero and never a guess. */}
            {c.price != null && (
              <span className="truncate text-[12px] font-black tabular-nums">
                {money(c.price, c.ccy, lang)}
                {c.unit ? <span className="font-semibold opacity-60">{unitSuffix(c.unit, lang)}</span> : null}
              </span>
            )}
          </span>
        </button>
      ))}

      {media.map(m => (
        <a key={m.href} href={m.href} target="_blank" rel="noreferrer noopener"
          className={`ow-tap mt-2 block overflow-hidden rounded-xl border ${
            mine ? "border-white/20 bg-white/15" : "border-ink/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.06]"}`}>
          {m.kind === "image" ? (
            <img src={m.href} alt="" loading="lazy" className="max-h-72 w-full object-cover" />
          ) : m.kind === "video" ? (
            <video src={m.href} controls className="max-h-72 w-full bg-black" />
          ) : (
            <span className="block px-3 py-2">
              <audio src={m.href} controls className="w-full" />
            </span>
          )}
        </a>
      ))}
    </>
  );
}

/* ── plumbing ──────────────────────────────────────────────────────────────────────────────── */

function str(v: unknown): string | null { return typeof v === "string" && v.trim() ? v : null; }
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function dedupe<T extends { path: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter(x => (seen.has(x.path) ? false : (seen.add(x.path), true)));
}

function renderedMessageParts(text: string, forceAudio = false): {
  text: string;
  media: { href: string; kind: "image" | "video" | "audio" }[];
} {
  const seen = new Set<string>();
  const hiddenLines = new Set<number>();
  const lines = text.split(/\r?\n/);
  const media: { href: string; kind: "image" | "video" | "audio" }[] = [];

  lines.forEach((line, i) => {
    const matches = line.match(URLISH) ?? [];
    for (const raw of matches) {
      const [href] = trimTrailingPunctuation(raw);
      if (propertyRef(href)) continue;
      const kind = mediaKind(href, forceAudio);
      if (!kind) continue;
      if (!seen.has(href)) {
        media.push({ href, kind });
        seen.add(href);
      }

      const isOnlyMediaUrl = line.trim() === raw || line.trim() === href;
      if (isOnlyMediaUrl) {
        hiddenLines.add(i);
        const previous = lines[i - 1]?.trim() ?? "";
        if (previous && MEDIA_LABEL.test(previous)) hiddenLines.add(i - 1);
      }
    }
  });

  return {
    text: lines.filter((_, i) => !hiddenLines.has(i)).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    media,
  };
}

function mediaKind(href: string, forceAudio = false): "image" | "video" | "audio" | null {
  if (forceAudio && (AUDIO_URL.test(href) || VIDEO_URL.test(href))) return "audio";
  if (IMAGE_URL.test(href)) return "image";
  if (VIDEO_URL.test(href)) return "video";
  if (AUDIO_URL.test(href)) return "audio";
  return null;
}

/** The listing's own currency, formatted for the reader's locale. Never converted. */
function money(v: number, ccy: string | null, lang: string): string {
  const locale = lang === "en" ? "en-US" : lang === "co" || lang === "es" ? "es-CO" : lang;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: ccy ?? "USD", maximumFractionDigits: 0,
    }).format(v);
  } catch {
    /* An unknown currency code is not a reason to print a bare number that looks like dollars. */
    return `${ccy ?? ""} ${Math.round(v).toLocaleString(locale)}`.trim();
  }
}

function unitSuffix(unit: string, lang: string): string {
  if (unit === "night") return W(lang, " / night", " / noche");
  if (unit === "month") return W(lang, " / month", " / mes");
  return "";
}

/**
 * Turn bare URLs into real links, leaving every other character exactly where it was.
 *
 * ⚠️ Which pieces are links is decided by INDEX PARITY, not by re-testing each piece. `URLISH`
 * carries the `g` flag, and a `g` regex keeps `lastIndex` between calls, so `URLISH.test(part)`
 * inside a loop answers a different question every other iteration and silently renders half the
 * links as plain text. `String.split` with one capture group always yields separators at the odd
 * indices, which needs no regex state at all.
 */
function linkify(text: string, mine: boolean, nav: (to: string) => void, highlight: string) {
  const cls = mine ? "underline decoration-white/50 underline-offset-2"
                   : "text-brand underline decoration-brand/40 underline-offset-2";
  const mark = highlight.trim();
  return text.split(URLISH).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{highlightText(part, mark, mine)}</Fragment>;
    const [href, tail] = trimTrailingPunctuation(part);
    const ref = propertyRef(href);
    return (
      <Fragment key={i}>
        {ref
          /* In-app destinations navigate rather than reload — the thread stays behind the back
             arrow, which is the whole reason a bare URL was the wrong answer. */
          ? <a href={ref.path} className={cls}
               onClick={e => { e.preventDefault(); nav(ref.path); }}>{highlightText(href, mark, mine)}</a>
          : <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>{highlightText(href, mark, mine)}</a>}
        {highlightText(tail, mark, mine)}
      </Fragment>
    );
  });
}

function highlightText(text: string, query: string, mine: boolean) {
  if (!query) return text;
  const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
  return text.split(re).map((part, i) => {
    if (!part) return null;
    return part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className={`rounded px-0.5 ${mine ? "bg-white/25 text-white" : "bg-brand/20 text-inherit"}`}>{part}</mark>
      : <Fragment key={i}>{part}</Fragment>;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
