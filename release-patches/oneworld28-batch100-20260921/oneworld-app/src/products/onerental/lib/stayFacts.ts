import { D, counted, NIGHTS } from './detailCopy';

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
 * ⚠️ ARRIVAL AND DEPARTURE EACH CARRY THEIR DATE AND THEIR TIME ON ONE LINE. Not a span with
 * "(checkout)" bolted onto the end, and not five separate rows where two would do — Lee, 17 Sep:
 * *"you literally duplicate it… that needs to be consolidated down."*
 *
 * Where a host set no time, the house default applies: three in the afternoon, eleven in the
 * morning. That is a real platform rule enforced in `stamp_request_stay_times()`, so saying it on
 * the page promises nothing that is not true.
 */
export type StayFacts = {
  starts_on: string;
  ends_on: string;
  nights: number;
  check_in_time?: string | null;
  check_out_time?: string | null;
  /** Fees included. This is the number somebody is deciding on. */
  guest_total?: number | null;
  /** The host's flat cleaning charge, when they set one. Null or zero renders no line. */
  cleaning_fee?: number | null;
  currency?: string | null;
  expires_at?: string | null;
};

/** The house defaults, matching `rental_private.stamp_request_stay_times()`. Three in the
    afternoon and eleven in the morning, the same pair every traveller already expects. A host's
    own value overrides them; these only fill a silence, so nothing is ever shown as unknown. */
export const DEFAULT_CHECK_IN = '15:00';
export const DEFAULT_CHECK_OUT = '11:00';

/** `14:00:00` → local clock text. Null stays null; callers fall back to the constants above. */
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
  /* ⛔ NO "not stated by the host" ANY MORE. A guest who reads that has been handed a question
     instead of an answer, on the one screen whose job is to answer it. The house default fills a
     silence; a host's own value overrides it. `muted` now means "this is the standard time, the
     host did not pick it", which is a different claim and an honest one. */
  const inAt = clockTime(f.check_in_time, lang) ?? clockTime(DEFAULT_CHECK_IN, lang)!;
  const outAt = clockTime(f.check_out_time, lang) ?? clockTime(DEFAULT_CHECK_OUT, lang)!;
  const rows: FactRow[] = [
    { label: D(lang, 'stayFrom'), value: `${f.starts_on} · ${inAt}` },
    { label: D(lang, 'stayTo'), value: `${f.ends_on} · ${outAt}` },
    /* ⚠️ A BARE NUMBER IS NOT A FACT. This read "Length of stay  31" — thirty-one what?
       `counted` carries the plural rules for all seven languages, including Russian's three. */
    { label: D(lang, 'lengthOfStay'), value: counted(lang, dayCount(f), NIGHTS) },
  ];
  if (f.guest_total != null && Number.isFinite(Number(f.guest_total))) {
    rows.push({ label: D(lang, 'totalWithFees'), value: money(Number(f.guest_total)) });
  }
  /* AFTER the total, and muted, because it is not part of it — it falls due when the stay ends.
     Above the total it read as a component of it, which is the misreading the wording now fixes. */
  if (f.cleaning_fee != null && Number(f.cleaning_fee) > 0) {
    rows.push({ label: D(lang, 'cleaningFee'), value: money(Number(f.cleaning_fee)), muted: true });
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
