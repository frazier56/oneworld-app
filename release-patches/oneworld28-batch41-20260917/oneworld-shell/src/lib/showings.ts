/**
 * SHOWINGS — turning a host's weekly availability into bookable slots, and the states a booked
 * one may pass through.
 * ============================================================================================
 * Lee, 15 August 2026:
 *
 *   *"They can click schedule a showing… as long as the host designates the blocks in the
 *   calendar where the user can book times automatically, then they can just automatically book
 *   them. It may require twenty four hours notice, so the host would say — do you want six hours,
 *   twelve, twenty four, forty eight hours notice? So a user can't book it to tonight, one hour
 *   from now."*
 *
 * That is three rules, and every one of them is a way a slot can be offered that should not be:
 *
 *   1. It must fall inside a window the host actually offered.
 *   2. It must be far enough ahead to respect the host's notice period.
 *   3. It must not already be taken.
 *
 * All three live here, in one function, because a slot list generated one way on the guest's
 * screen and checked another way on the server is how somebody ends up at a stranger's door at a
 * time the host never agreed to.
 *
 * ── ⚠️ AND THE DATABASE IS THE REAL AUTHORITY ON RULE 3 ─────────────────────────────────────
 * `property_showings` carries an exclusion constraint over `(property_id, tstzrange)`. This file
 * filters taken slots out of the list so the guest never SEES one, but two guests tapping the
 * same slot in the same second both pass this check and only the constraint stops the second
 * write. Treat a 23P01 from the insert as "somebody just took it" and re-draw — never as an error.
 *
 * ── ⚠️ AND THE DATABASE IS THE REAL AUTHORITY ON WHO MAY CONFIRM ────────────────────────────
 * v54 added `showing_state_guard_t`, a trigger enforcing the transitions in `MAY` below. Until
 * it existed the RLS policy said only *"the guest or the host may update this row"*, and a guest
 * is a party to their own request — so a guest could set their own showing to `confirmed` and
 * turn up. The tables below are the CLIENT's copy of that rule, kept only so a screen can grey
 * out a button rather than let somebody press it and read a Postgres error. **The trigger is the
 * rule. If these ever disagree, the trigger is right and this file is the bug.**
 */

export type ShowingWindow = {
  /** 0 = Sunday, matching JavaScript's getDay(), so nothing has to be converted at the boundary. */
  weekday: number;
  /** "09:00:00" — as Postgres `time` gives it. */
  starts_at: string;
  ends_at: string;
};

export type TakenShowing = { starts_at: string; ends_at: string };

export type Slot = {
  /** Absolute instant the viewing begins. */
  start: Date;
  end: Date;
  /** ISO for the insert. */
  startIso: string;
  endIso: string;
};

const MIN = 60_000;

/** "09:30:00" → minutes past local midnight. Seconds are ignored; nobody offers a 09:30:15 viewing. */
function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Every slot a guest may actually take, for the next `days` days.
 *
 * ⚠️ EVERYTHING HERE IS IN THE VIEWER'S LOCAL TIME, ON PURPOSE. A viewing is a physical
 * appointment at a physical address, and both people are standing in Colombia. Windows are stored
 * as bare `time` values precisely so "10am" means ten in the morning at the property, not ten
 * UTC. Constructing the Date from local parts is what makes that true — and it is the same class
 * of mistake as the registry dates that rendered a day early because a bare date string parses as
 * UTC midnight.
 */
export function slotsFor(opts: {
  windows: ShowingWindow[];
  taken: TakenShowing[];
  slotMinutes: number;
  noticeHours: number;
  /** How far ahead to offer. Two weeks is enough to plan and short enough to stay accurate. */
  days?: number;
  /** Injectable for tests. Defaults to now. */
  now?: Date;
}): Slot[] {
  const { windows, taken, slotMinutes, noticeHours } = opts;
  const days = opts.days ?? 14;
  const now = opts.now ?? new Date();
  if (!windows.length || !(slotMinutes > 0)) return [];

  /* The earliest instant a guest may book. This is the whole point of the notice period, and it
     is a single comparison — resist any temptation to also round it up to the next hour, because
     a host who said "six hours" meant six hours, not "six hours and then whenever is tidy". */
  const earliest = new Date(now.getTime() + noticeHours * 60 * MIN);

  /* Taken slots as plain millisecond ranges — comparing Dates in a loop is slower and reads worse. */
  const busy = taken.map(t => [Date.parse(t.starts_at), Date.parse(t.ends_at)] as const)
                    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));

  const out: Slot[] = [];
  for (let d = 0; d < days; d++) {
    /* Local midnight of the day being considered. Built from parts for the reason in the note
       above: `new Date("2026-08-20")` would be UTC midnight and shift the whole day. */
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const weekday = base.getDay();

    for (const w of windows) {
      if (w.weekday !== weekday) continue;
      const from = timeToMinutes(w.starts_at);
      const to = timeToMinutes(w.ends_at);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;

      /* Only WHOLE slots are offered. A window of 09:00–10:20 with 30-minute viewings yields two
         slots, not two and a stub — offering a 20-minute viewing when the host said 30 is
         quietly changing what they agreed to. */
      for (let m = from; m + slotMinutes <= to; m += slotMinutes) {
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, m);
        const end = new Date(start.getTime() + slotMinutes * MIN);

        if (start < earliest) continue;                       // rule 2 — notice period
        if (busy.some(([a, b]) => start.getTime() < b && end.getTime() > a)) continue;  // rule 3

        out.push({ start, end, startIso: start.toISOString(), endIso: end.toISOString() });
      }
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Group a flat slot list into days, for a screen that shows one column per day. */
export function slotsByDay(slots: Slot[]): { day: Date; slots: Slot[] }[] {
  const map = new Map<string, { day: Date; slots: Slot[] }>();
  for (const s of slots) {
    const key = `${s.start.getFullYear()}-${s.start.getMonth()}-${s.start.getDate()}`;
    if (!map.has(key)) {
      map.set(key, { day: new Date(s.start.getFullYear(), s.start.getMonth(), s.start.getDate()), slots: [] });
    }
    map.get(key)!.slots.push(s);
  }
  return [...map.values()];
}

/** The notice periods a host may choose. Lee named these four. */
export const NOTICE_CHOICES = [0, 6, 12, 24, 48] as const;

export const noticeLabel = (h: number, es: boolean): string =>
  h === 0 ? (es ? "Mismo día" : "Same day")
  : h === 1 ? (es ? "1 hora" : "1 hour")
  : es ? `${h} horas` : `${h} hours`;

/**
 * A host who never chose gets 24 hours, not zero. The default has to be the SAFE answer: a
 * seeded listing with no preference recorded should not let a stranger book a 7am viewing for
 * tomorrow because a column happened to be NULL.
 */
export const DEFAULT_NOTICE_HOURS = 24;
export const DEFAULT_SLOT_MINUTES = 30;

/* ════════════════════════════════════════════════════════════════════════════════════════════
   THE STATE MACHINE — the client's copy of `showing_state_guard_t`.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

export type ShowingState = "requested" | "confirmed" | "declined" | "cancelled" | "completed";
export type ShowingRole = "host" | "guest";

/**
 * Every move each side is allowed. Read it as: *from this state, this person may reach these.*
 *
 * Note what is NOT here and cannot be added by accident:
 *   · A guest reaching `confirmed`. Only the host opens their own door.
 *   · Anything at all out of `declined`, `cancelled` or `completed`. A closed showing stays
 *     closed — re-opening a declined request is a way to pester somebody who already said no.
 *   · `completed` from `requested`. A viewing nobody confirmed did not happen.
 */
const MAY: Record<ShowingRole, Partial<Record<ShowingState, ShowingState[]>>> = {
  host:  { requested: ["confirmed", "declined"], confirmed: ["cancelled", "completed"] },
  guest: { requested: ["cancelled"],             confirmed: ["cancelled"] },
};

export function canMove(role: ShowingRole, from: ShowingState, to: ShowingState, opts?: {
  /** Required for `completed`: the viewing must actually be over. */
  endsAt?: string | Date | null;
  now?: Date;
}): boolean {
  if (!(MAY[role][from] ?? []).includes(to)) return false;
  if (to === "completed") {
    const end = opts?.endsAt ? new Date(opts.endsAt as any) : null;
    if (!end || !Number.isFinite(end.getTime())) return false;
    if (end > (opts?.now ?? new Date())) return false;   // it has not happened yet
  }
  return true;
}

/** Is this showing still holding its slot? Matches the exclusion constraint's predicate exactly. */
export const holdsSlot = (s: ShowingState) => s === "requested" || s === "confirmed";

/**
 * What each state is called on screen, from the point of view of the person reading it.
 *
 * The two sides genuinely need different words. "Waiting for you" and "Waiting for the host" are
 * the same row — telling a guest a request is "waiting for you" would have them sitting on a
 * screen expecting to press something that is not theirs to press.
 */
export function showingStateLabel(s: ShowingState, role: ShowingRole, es: boolean): string {
  switch (s) {
    case "requested":
      return role === "host" ? (es ? "Esperando su respuesta" : "Waiting on you")
                             : (es ? "Esperando al anfitrión" : "Waiting on the host");
    case "confirmed": return es ? "Confirmada" : "Confirmed";
    case "declined":  return es ? "Rechazada" : "Declined";
    case "cancelled": return es ? "Cancelada" : "Cancelled";
    case "completed": return es ? "Realizada" : "Done";
  }
}

/** The dot beside a showing. Amber = somebody has to act; teal = settled; grey = closed. */
export function showingStateTone(s: ShowingState): "wait" | "good" | "closed" {
  return s === "requested" ? "wait" : s === "confirmed" ? "good" : "closed";
}
