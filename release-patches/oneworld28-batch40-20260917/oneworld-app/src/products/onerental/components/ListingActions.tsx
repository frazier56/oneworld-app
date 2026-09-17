import { IconCalendar, IconChat } from "@oneworld/shell";
import { D } from "../lib/detailCopy";

/**
 * ONE CONTROL, THREE STATES — the public listing's whole action area.
 * ============================================================================================
 * Lee, 17 September 2026, looking at a live listing: *"Proposal sent, waiting for host to accept"*
 * sitting directly beside a live **Request a showing** button. Those are mutually exclusive. A
 * screen that offers you an action you have already taken, next to a status saying you took it,
 * is a screen that does not know what is happening.
 *
 * So the three actions are ONE control with THREE states, not three buttons that each decide for
 * themselves:
 *
 *   · **open**      — nothing asked for yet. Message, Request a showing, Request a booking.
 *   · **requested** — a booking request is live. The other two go quiet: they are shown as text,
 *                     not offered as buttons, with one line saying why.
 *   · **closed**    — the request lapsed or was withdrawn. Back to `open`.
 *
 * "Go quiet" is deliberately not "disappear". A control that vanishes reads as a bug; a control
 * that is visibly paused, with the reason beside it, reads as the product knowing where you are.
 *
 * ⚠️ BUTTONS CARRY LABELS, NOT SENTENCES. "Request a booking", never "I'd like to book this".
 * Any explanation belongs in the line underneath, which is why `note` exists.
 */
export type ListingActionState = "open" | "requested";

export default function ListingActions({
  lang, state, showingsOn, busy, onMessage, onShowing, onBook, note,
}: {
  lang: string;
  state: ListingActionState;
  /** The host switched showings on AND set a notice period. A button that leads to an empty
      calendar is worse than no button. */
  showingsOn: boolean;
  busy?: boolean;
  onMessage: () => void;
  onShowing: () => void;
  onBook: () => void;
  /** Shown under the group. One sentence, never two. */
  note?: string;
}) {
  const quiet = state === "requested";
  return (
    <div className="space-y-2">
      {quiet ? (
        <p className="rounded-2xl border border-brand/25 bg-brand/[0.08] px-4 py-3 text-[13px] font-black text-brand-deep dark:text-brand-light">
          {D(lang, "bookingAsked")}
        </p>
      ) : (
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={onBook}>
          {D(lang, "requestBooking")}
        </button>
      )}

      {/* ⚠️ THE PAIR BELOW WRAPS WHERE THE MEANING BREAKS, NOT WHERE THE BOX ENDS.
          Two labels of different lengths side by side is exactly the pair that has broken to two
          different heights twice before. `whitespace-nowrap` plus a clamped size means a narrow
          phone shrinks the type rather than adding a line to one of them. */}
      <div className={`flex gap-2 ${quiet ? "opacity-45" : ""}`}>
        <button type="button" disabled={quiet || busy} onClick={onMessage}
          className="btn-ghost flex-1 whitespace-nowrap text-[clamp(12.5px,3.4vw,14px)] disabled:cursor-not-allowed">
          <span className="inline-flex items-center gap-1.5"><IconChat size={14} />{D(lang, "sendMessage")}</span>
        </button>
        {showingsOn && (
          <button type="button" disabled={quiet || busy} onClick={onShowing}
            className="btn-ghost flex-1 whitespace-nowrap text-[clamp(12.5px,3.4vw,14px)] disabled:cursor-not-allowed">
            <span className="inline-flex items-center gap-1.5"><IconCalendar size={14} />{D(lang, "requestShowing")}</span>
          </button>
        )}
      </div>

      {note && <p className="text-[11.5px] leading-relaxed opacity-60">{note}</p>}
    </div>
  );
}
