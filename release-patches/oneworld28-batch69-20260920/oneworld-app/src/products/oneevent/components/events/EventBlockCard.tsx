import { Calendar, MapPin } from "lucide-react";
import { ReactNode } from "react";
import { FeedSlideStrip, type FeedPreview } from "@oneworld/shell";

/** Big-block event card (Lee, Jul 22): a full square-ish photo with a dark
 *  bottom→up gradient and the event's name / date / location overlaid in white
 *  at the bottom. Used by the grid ("big block") toggle on Discover and My
 *  Events. The whole card is just the photo until you tap into the event.
 *
 *  OneEvent 30 (20 Sep 2026): the photo became the OneHome SLIDE STRIP from the shared shell —
 *  the host's chosen feed lead first (a photo, or a VIDEO that plays muted and looping while on
 *  screen), then the rest of the photos, swipeable, only the reachable slides mounted. A video
 *  slide opens the full-screen player with sound; a photo slide opens the event. Pass `slides`
 *  + `href` for that; `coverUrl` alone keeps the old single-image card for callers that have
 *  not adopted it (My Events). */
export default function EventBlockCard({
  coverUrl,
  slides,
  href,
  lang = "en",
  cta,
  title,
  dateLabel,
  venueLabel,
  price,
  onClick,
  children,
  className = "",
}: {
  coverUrl?: string | null;
  slides?: FeedPreview[];
  href?: string;
  lang?: string;
  /** The player's forward button, e.g. "View event". */
  cta?: string;
  title: string;
  dateLabel?: string | null;
  venueLabel?: string | null;
  price?: ReactNode;
  onClick?: () => void;
  /** Optional extra overlay in the top-left (e.g. a status badge). */
  children?: ReactNode;
  className?: string;
}) {
  const strip = slides && href;
  /* With a strip, the slides are the tap targets (a photo links, a video plays), so the card is a
     plain container and the overlay text is pointer-transparent. Without one, the old shape: the
     whole card is the button. */
  const Outer: any = strip ? "div" : "button";
  return (
    <Outer
      onClick={strip ? undefined : onClick}
      className={`relative block w-full overflow-hidden rounded-3xl text-left shadow-sm transition ${strip ? "" : "active:scale-[.99]"} ${className}`}
    >
      {strip ? (
        <FeedSlideStrip slides={slides!} poster={coverUrl ?? null} title={title} href={href!} lang={lang}
          aspect="aspect-[4/5]" cta={cta} className="bg-brand/10" />
      ) : (
        <div className="aspect-[4/5] w-full bg-brand/10">
          {coverUrl ? (
            <img decoding="async" src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <Calendar size={40} className="text-brand/40" />
            </div>
          )}
        </div>
      )}
      {/* Bottom dark gradient so overlaid white text is always legible */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      {children}
      {price != null && <div className={`absolute ${strip && slides!.length > 1 ? "right-3 top-12" : "right-3 top-3"}`}>{price}</div>}
      <div className={`absolute inset-x-0 bottom-0 p-4 text-white ${strip ? "pointer-events-none" : ""}`}>
        <p className="line-clamp-2 text-lg font-bold leading-tight" style={{ textShadow: "0 1px 6px rgba(0,0,0,.55)" }}>
          {title}
        </p>
        {dateLabel && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/90">
            <Calendar size={14} className="shrink-0 text-brand-light" />
            <span className="truncate">{dateLabel}</span>
          </p>
        )}
        {venueLabel && (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/90">
            <MapPin size={14} className="shrink-0 text-brand-light" />
            <span className="truncate">{venueLabel}</span>
          </p>
        )}
      </div>
    </Outer>
  );
}
