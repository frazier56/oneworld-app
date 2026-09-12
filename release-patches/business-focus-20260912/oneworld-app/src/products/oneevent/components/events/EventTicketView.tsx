import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket, Calendar, MapPin, Download, Share2, ArrowLeft, ExternalLink } from "lucide-react";
import { downloadICS, buildGoogleCalendarUrl } from "@evt/lib/calendarExport";
import { useLanguage } from "@evt/i18n/LanguageContext";
import QRCode from "qrcode";
import EventFoodDrinkRedemptions from "@evt/components/events/EventFoodDrinkRedemptions";
import MapsPin from "@evt/components/events/MapsPin";
import { formatEventDateTimeRange, normalizeEventTimeZone } from "@evt/lib/eventTime";

interface Props {
  event: {
    id: string;
    title: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    timezone?: string | null;
    cover_image_url?: string;
  };
  registration: {
    id: string;
    qr_code: string | null;
    quantity: number;
    status: string;
    /* v13 (Lee): the ticket is also the RECEIPT — what was paid and when. */
    amount_paid_cents?: number | null;
    paid_at?: string | null;
    registered_at?: string | null;
  };
  currency?: string;
  userName: string;
  userCategory?: string;
  onBack: () => void;
  backLabel?: string;
}

export default function EventTicketView({ event, registration, userName, userCategory, onBack, backLabel = "Back to Tickets", currency = "USD" }: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);

  const confirmationId = `OS-${registration.id.slice(0, 10).toUpperCase()}-${registration.id.slice(-3).toUpperCase()}`;
  const qrData = JSON.stringify({ ticketId: registration.id, eventId: event.id, hash: registration.qr_code ?? registration.id });
  const publicEventUrl = `${window.location.origin}/events/e/${event.id}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrData, { width: 240, margin: 2, color: { dark: "#000", light: "#fff" } }, (err) => {
        if (!err) setQrReady(true);
      });
    }
  }, [qrData]);

  /* TBD FIX (Lee's live E2E, 16 Aug 2026): an event with no date is TBD — the old
     `: new Date()` fallback stamped the ticket with WHATEVER MOMENT THE SCREEN OPENED
     ("August 17, 2:15 AM – 4:15 AM" on a Date-TBD event), which reads as a real start
     time to an attendee. TBD tickets now say TBD, and calendar links hide until a date
     exists — a calendar entry for a fabricated time is worse than none. */
  const isTbd = !event.start_date;
  const startDate = event.start_date ? new Date(event.start_date) : new Date();
  const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 2 * 3600000);
  const eventTimezone = normalizeEventTimeZone(event.timezone);
  const schedule = formatEventDateTimeRange(event.start_date, event.end_date, eventTimezone);

  const calendarEvent = {
    title: event.title,
    location: event.location ?? "",
    startDate,
    endDate,
    description: `Event: ${event.title}\nConfirmation: ${confirmationId}`,
  };

  const dateDisplay = isTbd ? "Date TBD" : schedule.date;

  /* v13 RECEIPT LINES (Lee, 18 Aug 2026): "you should definitely know what you paid for the
     ticket" — price + a real numeric timestamp, like a receipt. Falls back to the
     registration moment for rows that predate paid_at. Legacy rows with no amount show no
     price rather than a guessed one. */
  const paidCents = registration.amount_paid_cents;
  const priceLabel = paidCents == null ? null
    : paidCents === 0 ? "Free"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(paidCents / 100);
  const paidTs = registration.paid_at ?? registration.registered_at;
  const stamp = paidTs ? new Date(paidTs) : null;
  const stampDate = stamp ? stamp.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).replace(/\//g, "-") : null;
  const stampTime = stamp ? stamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : null;
  const mapsUrl = event.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : null;
  const timeDisplay = isTbd ? "Time TBD" : schedule.time;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <button onClick={onBack} className="mb-2 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </button>

      {/* Event Header Card */}
      <div className="rounded-2xl bg-card border border-border p-6 text-center">
        <h2 className="text-xl font-bold text-foreground mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>{event.title}</h2>
        {/* Receipt line: tickets · price paid, then the numeric paid stamp, centred. */}
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground">
          <Ticket className="w-4 h-4 text-primary" /> {registration.quantity} Ticket{registration.quantity > 1 ? "s" : ""}{priceLabel ? <> · {priceLabel}</> : null}
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap mt-3">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {dateDisplay}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{timeDisplay}</p>
        {event.location && (
          /* v13 (Lee): the address is a DOOR, not decoration — one tap opens Google Maps. */
          /* v14 (Lee): a BIG coloured Google-style pin — the address is obviously tappable. */
          <a href={mapsUrl!} target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 text-xs text-primary underline-offset-2 hover:underline mt-2">
            <MapsPin size={26} /> <span className="text-left">{event.location}</span>
          </a>
        )}
      </div>

      {/* User Info */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{userName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Professional</span>
              {userCategory && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{userCategory}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">ORDER ID</span>
          <span className="text-primary font-mono text-[11px]">{confirmationId}</span>
        </div>
        {/* v14 (Lee): the paid timestamp lives WITH the order id — a receipt line, not a header line. */}
        {stampDate && (
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Paid</span>
            <span className="text-muted-foreground">{stampDate} · {stampTime}</span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">Ticket is valid only for this account.</p>
      </div>

      {/* QR Code */}
      <div className="rounded-2xl bg-card border border-border px-4 py-6 text-center sm:p-6">
        <h3 className="text-base font-bold text-foreground mb-1">Your Entry Pass</h3>
        <p className="text-xs text-muted-foreground mb-4">Present this QR code at check-in</p>
        <div className="flex w-full justify-center overflow-hidden">
          <div className="grid w-fit max-w-full place-items-center rounded-xl bg-white p-3">
            <canvas ref={canvasRef} className="mx-auto block h-auto w-full max-w-[240px]" />
          </div>
        </div>
        <p className="text-xs text-primary font-mono mt-3">Confirmation #{registration.id.slice(0, 10)}</p>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Show this QR code at the event entrance.<br />
          Your ticket is non-transferable and valid only for the registered account.
        </p>
      </div>

      {/* Food & Drink Vouchers (if any) */}
      <EventFoodDrinkRedemptions registrationId={registration.id} eventId={event.id} />

      {/* Actions */}
      <div className="space-y-3">
        {/* v18 CF (Lee, 18 Aug): "on their ticket, there should be a link that says view
            public event" — after buying, this is the way back to the event page itself. */}
        <button
          onClick={() => navigate(`/events/e/${event.id}`)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all"
        >
          <ExternalLink className="w-4 h-4" /> {t("tix.view_event", "View event page")}
        </button>

        {/* View in OneEvent Calendar */}
        <button
          onClick={() => navigate("/events/calendar")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
        >
          <Calendar className="w-4 h-4" /> View in Calendar
        </button>

        {/* Add to Google Calendar — hidden for TBD events (no real time to book) */}
        {!isTbd && (
          <a
            href={buildGoogleCalendarUrl(calendarEvent)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Add to Google Calendar
          </a>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Share */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: event.title, text: `Check out ${event.title}!`, url: publicEventUrl }).catch(() => {});
              } else {
                navigator.clipboard.writeText(publicEventUrl);
                import("sonner").then(m => m.toast.success("Link copied!"));
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>

          {/* Download .ics — disabled for TBD events */}
          {!isTbd && <button
            onClick={() => downloadICS(calendarEvent)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Download .ics
          </button>}
        </div>
      </div>
    </div>
  );
}
