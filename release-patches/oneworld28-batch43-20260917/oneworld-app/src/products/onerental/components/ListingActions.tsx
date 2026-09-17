import { MessageSquare, CalendarDays, Home } from "lucide-react";
import { D } from "../lib/detailCopy";

/**
 * THREE ACTIONS, THREE ROWS, THREE ICONS — AND ONE ORDER THEY HAVE TO HAPPEN IN.
 * ============================================================================================
 * ⛔ TWO LABELS ON ONE ROW IS THE DEFECT LEE NAMED TWICE. "Request a showing" ran off the edge
 * beside "Send message" in batch 41. Three full-width rows; a full-width button cannot run off
 * the edge whatever the label, in whatever language, and this app ships in seven.
 *
 * ── WHY MESSAGE LOOKS DIFFERENT FROM THE OTHER TWO ──────────────────────────────────────────
 * Lee, 17 September 2026: *"maybe you have the send message in espresso, and then you have the
 * two other buttons in a blue colour."* He is separating them by KIND, not by importance:
 * messaging costs nothing and is always open, while the other two are requests that put you in a
 * queue and can close each other. Two colours, two kinds of thing.
 *
 * ── ⚠️ THE ORDER, AND WHERE THE LINE ACTUALLY FALLS ─────────────────────────────────────────
 * Lee's concern, in his words: *"if someone requested a booking, and then they get approved, and
 * then they want to see the showing, and they realize okay, I don't want to book anymore — then
 * that messes up the money. That's why the showing has to be first."*
 *
 * The risk is real. The line he drew is one step earlier than the risk, and I moved it, so this
 * is the reasoning written down where the next person will find it:
 *
 *   · A booking REQUEST holds nothing. No dates, no money. The sheet says so in as many words:
 *     "Submitting this request does not hold the dates. The hold starts when the host pre-approves."
 *   · PRE-APPROVAL is the moment everything he is worried about begins — the dates are held, the
 *     guest is told to send the rent, and a change of mind from there is a refund.
 *
 * So viewings close at PRE-APPROVAL, not at request. Blocking at request would refuse a viewing
 * to somebody whose request the host has not even read yet — a person who wants to look before
 * committing, which is the person you most want to let look. Nothing that costs money is exposed
 * by that window, because in it no money and no dates exist.
 *
 * The warning he asked for still fires at REQUEST time, where it can change what somebody does,
 * rather than afterwards where it is only an excuse.
 */
export type ListingActionState = "open" | "requested";

function Row({ icon, label, onClick, disabled, tone }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean;
  tone: "espresso" | "request";
}) {
  const paint = tone === "espresso"
    ? "btn-primary"
    : "ow-tap w-full rounded-2xl border border-brand/35 bg-brand/[0.10] px-4 py-3 text-[14px] font-black text-brand-deep dark:text-brand-light";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`${paint} w-full disabled:cursor-not-allowed disabled:opacity-40`}>
      <span className="inline-flex items-center gap-2">{icon}{label}</span>
    </button>
  );
}

export default function ListingActions({
  lang, showingsOn, showingBlocked, bookingBlocked, busy, sending,
  onMessage, onShowing, onBook, note,
}: {
  lang: string;
  /** The host switched viewings on AND set a notice period. Otherwise there is no calendar to
      send anybody to, and a button that leads to an empty one is worse than no button. */
  showingsOn: boolean;
  /** The host is holding dates for this person. See the note above for why it is this moment. */
  showingBlocked: boolean;
  /** There is already a live request. You cannot ask for the same thing twice. */
  bookingBlocked: boolean;
  busy?: boolean;
  sending?: boolean;
  onMessage: () => void;
  onShowing: () => void;
  onBook: () => void;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      {/* 1 · ALWAYS OPEN. Never disabled by either of the others — a person with a live request
             is the person most likely to need to reach a human. */}
      <Row tone="espresso" icon={<MessageSquare size={15} />}
        label={sending ? "…" : D(lang, "sendMessage")} onClick={onMessage} disabled={!!sending} />

      {/* 2 · VIEWINGS — before the dates are held, not after. */}
      {showingsOn && (
        <Row tone="request" icon={<CalendarDays size={15} />}
          label={D(lang, "requestShowing")} onClick={onShowing} disabled={showingBlocked || busy} />
      )}

      {/* 3 · THE BOOKING. */}
      <Row tone="request" icon={<Home size={15} />}
        label={D(lang, "requestBooking")} onClick={onBook} disabled={bookingBlocked || busy} />

      {note && <p className="text-[11.5px] leading-relaxed opacity-60">{note}</p>}
    </div>
  );
}
