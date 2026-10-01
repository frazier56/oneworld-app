import { useEffect, useRef } from "react";
import { MessageSquare, CalendarDays } from "lucide-react";

/**
 * MESSAGE AND SCHEDULE A SHOWING — PINNED, ON EVERY LISTING.
 * ============================================================================================
 * Lee, 17 September 2026: *"Message and Schedule a showing pinned at the bottom of every
 * listing."* Rentals and sales both — a fix asked for once applies to every screen, and the
 * single most repeated defect in this product's history is fixing one half of OneHome.
 *
 * Why pinned at all: the two things a person does after deciding they like a place are ask a
 * question and go and see it, and both of them lived most of a scroll below the fold. Never make
 * somebody scroll to find out whether they can act — the rule underneath almost every Airbnb
 * pattern, and the reason the booking bar was pinned in the first place.
 *
 * ⚠️ HOW IT AVOIDS LANDING ON TOP OF THE BOOKING BAR. Both are sticky and both clear the footer
 * tabs. `BookingBar` now publishes its own measured height as `--ow-bookbar`, exactly as
 * `BottomTabs` publishes `--ow-tabs`, so this sits above whichever of them exist. Nothing here
 * hard-codes a height — a translated label or a second line would falsify it the same day.
 *
 * ⚠️ TWO LABELS ON ONE ROW IS THE DEFECT LEE HAS NAMED TWICE. It is allowed here only because
 * both labels are single short words that are set `whitespace-nowrap` and allowed to shrink
 * rather than wrap, and because the alternative — two stacked full-width rows — is a pinned
 * block half the height of a phone screen sitting over the listing. It is checked at 390px.
 */
export default function ListingContactBar({
  messageLabel, showingLabel, onMessage, onShowing, busy,
}: {
  messageLabel: string;
  /** Omitted entirely when the host does not take viewings — never a button leading nowhere. */
  showingLabel?: string;
  onMessage: () => void;
  onShowing?: () => void;
  busy?: boolean;
}) {
  /* Publish our height the same way `BottomTabs` publishes `--ow-tabs` and `BookingBar` now
     publishes `--ow-bookbar`, so the back-to-top button can clear us instead of sitting on our
     left-hand button — which is exactly what it did in the first screenshot of this bar. */
  const barRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty("--ow-contactbar", el.offsetHeight + "px");
    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); document.documentElement.style.removeProperty("--ow-contactbar"); };
  }, []);

  const button =
    "ow-tap flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 " +
    "text-[clamp(12px,3.3vw,14px)] font-black whitespace-nowrap disabled:opacity-45";
  return (
    <div ref={barRef} className="sticky bottom-[calc(var(--ow-tabs,0px)+var(--ow-bookbar,0px)+env(safe-area-inset-bottom))] z-20 mt-3">
      <div className="flex items-center gap-2 rounded-[24px] border border-ink/12 bg-paper/95 p-2 shadow-lg dark:border-white/15 dark:bg-slate-950/95">
        <button type="button" onClick={onMessage} disabled={busy}
          className={`${button} bg-brand text-white`}>
          <MessageSquare size={16} className="shrink-0" />
          <span className="min-w-0 truncate">{messageLabel}</span>
        </button>
        {showingLabel && onShowing && (
          <button type="button" onClick={onShowing} disabled={busy}
            className={`${button} border ow-edge`}>
            <CalendarDays size={16} className="shrink-0" />
            <span className="min-w-0 truncate">{showingLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
