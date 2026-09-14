import { Calendar, MapPin } from "lucide-react";
import { ReactNode } from "react";

/** Big-block event card (Lee, Jul 22): a full square-ish photo with a dark
 *  bottom→up gradient and the event's name / date / location overlaid in white
 *  at the bottom. Used by the grid ("big block") toggle on Discover and My
 *  Events. The whole card is just the photo until you tap into the event. */
export default function EventBlockCard({
  coverUrl,
  title,
  dateLabel,
  venueLabel,
  price,
  onClick,
  children,
  className = "",
}: {
  coverUrl?: string | null;
  title: string;
  dateLabel?: string | null;
  venueLabel?: string | null;
  price?: ReactNode;
  onClick?: () => void;
  /** Optional extra overlay in the top-left (e.g. a status badge). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative block w-full overflow-hidden rounded-3xl text-left shadow-sm transition active:scale-[.99] ${className}`}
    >
      <div className="aspect-[4/5] w-full bg-brand/10">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Calendar size={40} className="text-brand/40" />
          </div>
        )}
      </div>
      {/* Bottom dark gradient so overlaid white text is always legible */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      {children}
      {price != null && <div className="absolute right-3 top-3">{price}</div>}
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
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
    </button>
  );
}
