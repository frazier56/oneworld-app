import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@evt/hooks/useAuth";
import { supabase } from "@evt/integrations/supabase/client";
import { Navbar } from "@evt/components/Navbar";
import { Footer } from "@evt/components/Footer";
import { ArrowLeft, Calendar, MapPin, Ticket, Share2, Download, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { buildGoogleCalendarUrl, downloadICS } from "@evt/lib/calendarExport";
import QRCode from "qrcode";
import { useLanguage } from "@evt/i18n/LanguageContext";
import MapsPin from "@evt/components/events/MapsPin";
import { ScreenHeading } from "@oneworld/shell";
import { toast } from "sonner";

export default function EventReceipt() {
  const { t, locale } = useLanguage();
  const { id: eventId, orderId } = useParams<{ id: string; orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [event, setEvent] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [notifySheet, setNotifySheet] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrReady, setQrReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: ev }, { data: reg }, { data: prof }] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId!).single(),
        supabase.from("event_registrations").select("*").eq("id", orderId!).single(),
        /* Granted columns only — select("*") on profiles throws 42501. E-mail comes off the
           One ID session (user.email), never off the profiles row. */
        supabase.from("profiles").select("id, full_name, photo_url").eq("id", user?.id || "").single(),
      ]);
      setEvent(ev);
      setRegistration(reg);
      setProfile(prof);
      setLoading(false);
    };
    if (eventId && orderId) load();
  }, [eventId, orderId, user]);

  useEffect(() => {
    if (canvasRef.current && registration) {
      const qrData = JSON.stringify({
        ticketId: registration.id,
        eventId,
        hash: registration.qr_code || registration.id,
      });
      QRCode.toCanvas(canvasRef.current, qrData, { width: 220, margin: 2, color: { dark: "#000", light: "#fff" } }, (err) => {
        if (!err) setQrReady(true);
      });
    }
  }, [registration, eventId]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!event || !registration) {
    return (
      <div>
        <Navbar />
        <div className="py-10 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">{t("rcpt.not_found", "Receipt not found")}</h1>
          <p className="text-sm text-muted-foreground mb-5">
            {t("rcpt.not_found_desc", "We couldn't find this order. It may have been cancelled or the link expired.")}
          </p>
          <button onClick={() => navigate("/events/tickets")} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            {t("rcpt.view_tickets", "View my tickets")}
          </button>
        </div>
      </div>
    );
  }

  const confirmationId = `OS-${registration.id.slice(0, 10).toUpperCase()}-${registration.id.slice(-3).toUpperCase()}`;
  const paidCents = (registration as any).amount_paid_cents as number | null;
  const priceLabel = paidCents == null ? null
    : paidCents === 0 ? t("checkout.free", "Free")
    : new Intl.NumberFormat("en-US", { style: "currency", currency: event.currency || "USD" }).format(paidCents / 100);
  const paidTsRaw = (registration as any).paid_at ?? registration.registered_at;
  const stampD = paidTsRaw ? new Date(paidTsRaw) : null;
  const stampDate = stampD ? stampD.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).replace(/\//g, "-") : null;
  const stampTime = stampD ? stampD.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : null;
  /* TBD FIX (same class as EventTicketView): no date means TBD, not "whenever you looked". */
  const isTbd = !event.start_date;
  const startDate = event.start_date ? new Date(event.start_date) : new Date();
  const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 2 * 3600000);
  const dateDisplay = isTbd ? t("ev.date_tbd", "Date TBD") : startDate.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });

  const calendarEvent = {
    title: event.title,
    location: event.location ?? "",
    startDate,
    endDate,
    description: `Event: ${event.title}\nConfirmation: ${confirmationId}`,
  };

  return (
    <div>
      <Navbar />
      {/* AppShell provides the max-w-lg column — the old min-h-screen/pt-24 page chrome is gone. */}
      <div className="pb-8">
        {/* AP (Lee, 18 Aug 2026): every screen carries its name — this one is the receipt. */}
        <ScreenHeading>{t("rcpt.title", "Receipt")}</ScreenHeading>
        <button onClick={() => navigate("/events")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("rcpt.back", "Back to Events")}
        </button>

        {/* Success header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle className="w-8 h-8" style={{ color: "#22C55E" }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>{t("rcpt.youre_in", "You're in!")}</h1>
          <p className="text-sm text-muted-foreground">{t("rcpt.confirmed", "Your ticket has been confirmed")}</p>
        </div>

        {/* Event info card */}
        <div className="rounded-2xl bg-card border border-border p-6 text-center mb-4">
          <h2 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>{event.title}</h2>
          {/* AM (Lee, 18 Aug 2026): a receipt says what you PAID and WHEN — quantity · price
              on the first line, then a real numeric timestamp, all centred. */}
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground">
            <Ticket className="w-4 h-4 text-primary" /> {registration.quantity} {registration.quantity > 1 ? t("rcpt.tickets", "Tickets") : t("rcpt.ticket", "Ticket")}{priceLabel ? <> · {priceLabel}</> : null}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap mt-3">
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {dateDisplay}</span>
          </div>
          {event.location && (
            /* AN (Lee): the address opens Google Maps in one tap. */
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
               target="_blank" rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 text-xs text-primary underline-offset-2 hover:underline mt-2">
              <MapsPin size={26} /> <span className="text-left">{event.location}</span>
            </a>
          )}
        </div>

        {/* Attendee info */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{(profile?.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-foreground">{profile?.full_name || t("rcpt.attendee", "Attendee")}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("rcpt.order_id", "ORDER ID")}</span>
            <span className="text-primary font-mono text-[11px]">{confirmationId}</span>
          </div>
          {/* v14 (Lee): the paid timestamp belongs WITH the order id, like a receipt line. */}
          {stampDate && (
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="text-muted-foreground">{t("rcpt.paid", "Paid")}</span>
              <span className="text-muted-foreground">{stampDate} · {stampTime}</span>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="rounded-2xl bg-card border border-border px-4 py-6 text-center mb-4 sm:p-6">
          <h3 className="text-base font-bold text-foreground mb-1">{t("rcpt.entry_pass", "Your Entry Pass")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("rcpt.present_qr", "Present this QR code at check-in")}</p>
          <div className="flex w-full justify-center overflow-hidden">
            <div className="grid w-fit max-w-full place-items-center rounded-xl bg-white p-3">
              <canvas ref={canvasRef} className="mx-auto block h-auto w-full max-w-[220px]" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            {t("rcpt.show_qr", "Show this QR code at the event entrance.")}<br />
            {t("rcpt.nontransfer", "Your ticket is non-transferable and valid only for the registered account.")}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 mb-4">
          {/* View in OneEvent Calendar */}
          <button
            onClick={() => navigate("/events/calendar")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all"
          >
            <Calendar className="w-4 h-4" /> {t("rcpt.view_calendar", "View in Calendar")}
          </button>

          {/* Add to Google Calendar */}
          <a
            href={buildGoogleCalendarUrl(calendarEvent)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> {t("rcpt.add_gcal", "Add to Google Calendar")}
          </a>

          <div className="grid grid-cols-2 gap-3">
            {/* Share */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/events/e/${eventId}`;
                if (navigator.share) {
                  navigator.share({ title: event.title, text: `Check out ${event.title}!`, url }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(url);
                  import("sonner").then(m => m.toast.success(t("rcpt.link_copied", "Link copied!")));
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
            >
              <Share2 className="w-4 h-4" /> {t("rcpt.share", "Share")}
            </button>

            {/* Download .ics */}
            <button
              onClick={() => downloadICS(calendarEvent)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
            >
              <Download className="w-4 h-4" /> {t("rcpt.download_ics", "Download .ics")}
            </button>
          </div>
        </div>

        {/* View My Tickets */}
        <button
          onClick={() => navigate("/events/tickets")}
          className="w-full py-3 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
        >
          <Ticket className="w-4 h-4" /> {t("rcpt.view_my_tickets", "View My Tickets")}
        </button>

        {/* HOW TO FIND YOUR TICKET LATER (Lee, 17 Aug 2026): first-time buyers need to be
            SHOWN the door, not told — a mock of the app's own footer with the centre ticket
            button highlighted, plus the three steps for event day. */}
        <div className="mt-4 rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("rcpt.find_title", "On event day — how to pull up your ticket")}</h3>
          {/* AO (Lee, 18 Aug 2026): "the orange centre button is more of a square than a
              circle... make it realistic." The mock now mirrors the real bottom bar: a
              ROUNDED-SQUARE gradient ticket button, and a clean arrow above it instead of
              the old off-corner teal dot. */}
          <div className="rounded-xl bg-secondary/50 border border-border px-6 pt-6 pb-3 mb-3">
            <div className="relative flex items-center justify-between max-w-[260px] mx-auto">
              <span className="w-6 h-6 rounded-md bg-foreground/10" />
              <span className="w-6 h-6 rounded-md bg-foreground/10" />
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-b from-primary to-primary/80 shadow-lg shadow-primary/30 ring-4 ring-primary/25">
                <Ticket className="w-5 h-5 text-primary-foreground" />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-primary animate-bounce" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                </span>
              </span>
              <span className="w-6 h-6 rounded-md bg-foreground/10" />
              <span className="w-6 h-6 rounded-md bg-foreground/10" />
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2">{t("rcpt.find_btn", "The orange ticket button, centre of the bottom bar")}</p>
          </div>
          <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
            <li>{t("rcpt.find_step1_pre", "Open ")}<span className="font-semibold text-foreground">app.oneworldlabs.ai/events</span>{t("rcpt.find_step1_post", " and sign in")}</li>
            <li>{t("rcpt.find_step2", "Tap the orange centre button → My Tickets")}</li>
            <li>{t("rcpt.find_step3", "Open your ticket and show the QR code at the door")}</li>
          </ol>
          <p className="mt-3 text-[10px] text-muted-foreground">{t("rcpt.find_email", "Your ticket is in your email too — that link always opens it.")}</p>
        </div>
      </div>

      {/* NOTIFICATION OPT-IN SHEET (Lee, 17 Aug 2026): the buyer is a member now (express
          join happens before payment), so the post-ticket ask is about NOTIFICATIONS for
          this event — recorded on the registration, never a nag. */}
      {registration && registration.notify_optin == null && notifySheet && (
        <div className="fixed inset-x-0 bottom-20 z-40 p-3 sm:p-4">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5">
            <p className="text-sm font-bold text-foreground mb-1">{t("rcpt.notify_q", "Want notifications about this event?")}</p>
            <p className="text-xs text-muted-foreground mb-3">{t("rcpt.notify_sub", "Reminders, changes and messages from the host.")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const { error } = await supabase.rpc("set_event_notify_optin", { p_registration_id: registration.id, p_on: true });
                  if (!error) toast.success(t("rcpt.notify_on", "You'll get updates about this event."));
                  setNotifySheet(false);
                }}
                className="py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground">{t("rcpt.yes", "Yes")}</button>
              <button
                onClick={async () => {
                  await supabase.rpc("set_event_notify_optin", { p_registration_id: registration.id, p_on: false });
                  setNotifySheet(false);
                }}
                className="py-2.5 rounded-xl text-sm font-semibold bg-secondary border border-border text-foreground">{t("rcpt.no_thanks", "No thanks")}</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
