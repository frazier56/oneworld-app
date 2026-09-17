import { D } from './detailCopy';

/**
 * WHAT A BOOKING REQUEST SAYS — one builder, every screen.
 * ============================================================================================
 * Lee, 17 September 2026: *"the only valuable piece is that when you submit a request, you know
 * you asked for this start date, this end date and time."*
 *
 * Six facts, and they must read identically in all four places a request appears: the sheet
 * before you send it, the card after you send it, the message that lands in Messages, and the
 * host's review screen. The last time an instruction landed in two files, one copy got missed
 * every round for four rounds — that is why `CardText.tsx` is shared and why this is a function
 * and not six lines of JSX repeated four times.
 *
 * ⚠️ CHECK-IN AND CHECK-OUT ARE TWO FACTS WITH TIMES. Not one span with "(checkout)" bolted on
 * the end, which is what the monthly panel rendered. A time the host never stated is said to be
 * unstated — never filled in with a plausible-looking default, because a guest who reads 3pm and
 * arrives at 3pm has been told something nobody promised.
 */
export type StayFacts = {
  starts_on: string;
  ends_on: string;
  nights: number;
  check_in_time?: string | null;
  check_out_time?: string | null;
  /** Fees included. This is the number somebody is deciding on. */
  guest_total?: number | null;
  currency?: string | null;
  expires_at?: string | null;
};

/** `14:00:00` → `2:00 in the afternoon`-shaped local text. Null stays null. */
export function clockTime(value: string | null | undefined, lang: string): string | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  const d = new Date(Date.UTC(2000, 0, 1, h, min));
  try {
    return new Intl.DateTimeFormat(lang === 'es' || lang === 'co' ? 'es-CO' : lang, {
      hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
    }).format(d);
  } catch { return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`; }
}

export function dayCount(f: Pick<StayFacts, 'starts_on' | 'ends_on' | 'nights'>): number {
  if (Number.isFinite(f.nights) && f.nights > 0) return f.nights;
  const span = (Date.parse(f.ends_on) - Date.parse(f.starts_on)) / 86400000;
  return Number.isFinite(span) && span > 0 ? Math.round(span) : 0;
}

export type FactRow = { label: string; value: string; muted?: boolean };

/**
 * The six rows, in the order a person asks them: when do I arrive, when do I leave, how long is
 * that, what time is the door open, what time must I be out, what does it cost.
 */
export function stayFactRows(f: StayFacts, lang: string, money: (n: number) => string): FactRow[] {
  const inAt = clockTime(f.check_in_time, lang);
  const outAt = clockTime(f.check_out_time, lang);
  const rows: FactRow[] = [
    { label: D(lang, 'stayFrom'), value: f.starts_on },
    { label: D(lang, 'stayTo'), value: f.ends_on },
    { label: D(lang, 'lengthOfStay'), value: String(dayCount(f)) },
    { label: D(lang, 'checkInTime'), value: inAt ?? D(lang, 'timeNotSet'), muted: !inAt },
    { label: D(lang, 'checkOutTime'), value: outAt ?? D(lang, 'timeNotSet'), muted: !outAt },
  ];
  if (f.guest_total != null && Number.isFinite(Number(f.guest_total))) {
    rows.push({ label: D(lang, 'totalWithFees'), value: money(Number(f.guest_total)) });
  }
  return rows;
}

/**
 * The same six facts as plain text, for the copy that goes into Messages.
 *
 * It is plain text on purpose: a message body is read in a list, quoted in a reply and played
 * aloud by a screen reader, and none of those render markup.
 */
export function stayFactsMessage(f: StayFacts, lang: string, money: (n: number) => string, title: string): string {
  const rows = stayFactRows(f, lang, money);
  return [D(lang, 'askedFor') + ' — ' + title, ...rows.map(r => `${r.label}: ${r.value}`)].join('\n');
}
