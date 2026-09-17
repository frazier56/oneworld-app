import { MessageSquare, CalendarDays, Home } from "lucide-react";
import { D } from "../lib/detailCopy";

/**
 * THREE ACTIONS, THREE ROWS, THREE ICONS.
 * ============================================================================================
 * ⛔ WHAT WAS WRONG IN BATCH 40, in Lee's words, 17 September 2026: *"right now you got send a
 * message and request showing on the same row and it's too long, and so the word showing runs off
 * the page. So again, you should know better than that. There's not enough space on a mobile
 * phone to show that."*
 *
 * He is right and it is the same defect twice: a pair of unequal labels side by side in half a
 * phone. Clamping the font was a patch on a layout that should never have been a row. **Three
 * full-width rows.** A full-width button cannot run off the edge, whatever the label, in whatever
 * language — and this app ships in seven, where "Besichtigung anfragen" is half again as long as
 * "Request a showing".
 *
 * ORDER, AND WHY: *"you should always be able to send someone a message."* Send message sits with
 * the box you type into, because a button that submits a field belongs beside that field. Then
 * Request a showing, then Request a booking — smallest commitment to largest, which is also the
 * order somebody actually moves through them.
 *
 * QUIETING: a live booking request quiets the two REQUEST actions, because you cannot ask for the
 * same thing twice. **Messaging is never quieted.** You must always be able to reach a human.
 */
export type ListingActionState = "open" | "requested";

function Row({ icon, label, onClick, disabled, primary }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`${primary ? "btn-primary" : "btn-ghost"} w-full disabled:cursor-not-allowed disabled:opacity-45`}>
      <span className="inline-flex items-center gap-2">{icon}{label}</span>
    </button>
  );
}

export default function ListingActions({
  lang, state, showingsOn, busy, sending, onMessage, onShowing, onBook, note,
}: {
  lang: string;
  state: ListingActionState;
  /** The host switched showings on AND set a notice period. A button that leads to an empty
      calendar is worse than no button. */
  showingsOn: boolean;
  busy?: boolean;
  sending?: boolean;
  onMessage: () => void;
  onShowing: () => void;
  onBook: () => void;
  note?: string;
}) {
  const quiet = state === "requested";
  return (
    <div className="space-y-2">
      {/* 1 · ALWAYS AVAILABLE. Never quieted, never disabled by another request. */}
      <Row icon={<MessageSquare size={15} />} label={sending ? "…" : D(lang, "sendMessage")}
        onClick={onMessage} disabled={!!sending} primary />

      {/* 2 · Only where the host really takes viewings. */}
      {showingsOn && (
        <Row icon={<CalendarDays size={15} />} label={D(lang, "requestShowing")}
          onClick={onShowing} disabled={quiet || busy} />
      )}

      {/* 3 · The big one. */}
      <Row icon={<Home size={15} />} label={D(lang, "requestBooking")}
        onClick={onBook} disabled={quiet || busy} />

      {note && <p className="text-[11.5px] leading-relaxed opacity-60">{note}</p>}
    </div>
  );
}
