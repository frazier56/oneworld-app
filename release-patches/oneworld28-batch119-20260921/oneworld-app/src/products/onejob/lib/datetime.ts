/**
 * ONE place for how OneJob writes dates and times. Lee's rules, repeatedly:
 *  - Dates read MONTH, DAY, YEAR — never the ISO "2026-07-27".
 *  - Times are 12-hour with AM/PM — never "21:00" military.
 * Every surface imports from here so a fix lands everywhere at once instead of one screen at a time.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07-27" -> "Jul 27, 2026". Parsed as a LOCAL date (a bare `new Date("2026-07-27")` is
 *  UTC midnight and shows the previous day west of Greenwich). */
export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-07-27" -> "Mon, Jul 27, 2026" */
export function fmtDateLong(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()];
  return `${dow}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "21:00" -> "9:00 PM" · "08:00" -> "8:00 AM" · "00:30" -> "12:30 AM" */
export function fmtTime(hhmm?: string | null): string {
  if (!hhmm) return "";
  const [hStr, mStr] = String(hhmm).split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return String(hhmm);
  const m = (mStr ?? "00").padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

/**
 * Timestamp for a chat row or bubble, the way every messaging app people already use writes it.
 *
 * Lee, Jul 25 2026: "the thing that's missing from the message list is a timestamp — I didn't know
 * what time this last message came through... did I send that? I don't know."
 *
 * Today       -> "9:41 PM"      (the time is what you want for something recent)
 * Yesterday   -> "Yesterday"
 * Last 7 days -> "Tue"
 * Older       -> "Jul 24, 2026"
 */
export function fmtChatStamp(iso?: string | null, locale = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return locale.startsWith("es") ? "Ayer" : "Yesterday";
  if (days < 7) return d.toLocaleDateString(locale, { weekday: "short" });
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Day divider inside a thread: "Today" · "Yesterday" · "Mon, Jul 20, 2026". */
export function fmtDayDivider(iso?: string | null, locale = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return locale.startsWith("es") ? "Hoy" : "Today";
  if (days === 1) return locale.startsWith("es") ? "Ayer" : "Yesterday";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${dow}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "08:00","11:00" -> "8:00 AM – 11:00 AM". Returns just the start if there's no end. */
export function fmtTimeRange(from?: string | null, to?: string | null): string {
  if (!from) return "";
  return to ? `${fmtTime(from)} – ${fmtTime(to)}` : fmtTime(from);
}

/**
 * The unabbreviated stamp: "Jul 27, 2026 · 4:19 AM". Nothing is dropped — not the year, not the
 * date when it happened today.
 *
 * `fmtDateTimeShort` below is the right call in a list, where a bare "3:14 PM" reads as "just now"
 * and saves a line. It is the WRONG call in the money timeline, where the whole promise of the panel
 * is that a person can point at a row and say exactly when their money moved. A stamp that silently
 * omits the year is fine right up until someone opens a contract from last December.
 *
 * Lee's house style, non-negotiable: month-day-year, 12-hour with AM/PM. Never ISO, never military.
 */
export function fmtDateTimeFull(input?: string | null, locale = "en"): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  // SECONDS ARE DELIBERATE (Lee, Jul 27 2026: "date, hour, minute and seconds on every stamped row").
  // Two steps of the money timeline can land inside the same minute — a client marking a job complete
  // seconds after the pro does is the normal case, not the edge case. Without seconds those two rows
  // carry the identical stamp and the order they're drawn in becomes unfalsifiable.
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", second: "2-digit" });
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${time}`;
}

/**
 * A future calendar day with no time on it: "Wed, Jul 29, 2026".
 *
 * Stripe's `payout.arrival_date` is a DATE, not a moment — it is the day the money is expected to
 * land, and banks post whenever they post. Rendering it with a time attached would invent a
 * precision Stripe never gave us, in the one panel that promises nothing is a guess.
 */
export function fmtArrivalDay(input?: string | null): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  // READ IN UTC, NOT LOCAL. Stripe's `arrival_date` is a calendar DAY that we store as UTC midnight.
  // Read with local getters, every timezone west of Greenwich renders the day BEFORE: in Bogotá
  //   2026-07-29T00:00:00Z  ->  "Tue, Jul 28, 2026"   (real arrival: Wed, Jul 29)
  // A Colombian pro would be told their money lands Tuesday, see nothing on Tuesday, and conclude the
  // payout failed — in the launch market, on the one row that promises a real date from Stripe.
  // `fmtDate` above documents and avoids exactly this trap; this function had reintroduced it.
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  return `${dow}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Compact date + time for an audit trail: "Jul 26, 3:14 PM" (today drops the date entirely).
 *
 * Used by the money timeline, where the whole point is that a person can see WHEN each step
 * happened. Month-day-year and 12-hour AM/PM, per Lee's house style.
 */
export function fmtDateTimeShort(iso?: string | null, locale = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(locale, sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" });
  return `${date}, ${time}`;
}
