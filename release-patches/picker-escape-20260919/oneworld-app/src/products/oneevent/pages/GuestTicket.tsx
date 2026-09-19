/**
 * GUEST TICKET — /events/gt/:token (PUBLIC — the token IS the key).
 * ============================================================================================
 * Lee's Luma-style ruling (17 Aug 2026): a guest buys with just name/email/phone, gets the
 * ticket RIGHT HERE (and by email), can save it to their calendar — and only THEN is offered
 * an account, in a bottom sheet, for event updates and notifications. Never a wall.
 * A signed-in member opening this link can claim the ticket into their account, which is how
 * the guest's later sign-up adopts the ticket (the sheet's buttons return here via ?next=).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ticket, Calendar, Bell, X, Download, ExternalLink } from "lucide-react";
import { supabase } from "@oneworld/shell";
import { useAuth } from "@evt/hooks/useAuth";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { downloadICS, buildGoogleCalendarUrl } from "@evt/lib/calendarExport";
import { formatEventDateTimeRange, normalizeEventTimeZone } from "@evt/lib/eventTime";
import QRCode from "qrcode";
import { toast } from "sonner";

interface GuestTicketRow {
  registration_id: string; event_id: string; event_title: string; event_location: string | null;
  start_date: string | null; end_date: string | null; guest_name: string; qr_code: string | null;
  status: string; quantity: number; claimed: boolean; timezone: string | null;
}

export default function GuestTicket() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [row, setRow] = useState<GuestTicketRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!token) { setMissing(true); return; }
    (async () => {
      const { data, error } = await supabase.rpc("guest_ticket", { p_token: token });
      const r = Array.isArray(data) ? data[0] : data;
      if (error || !r) { setMissing(true); return; }
      setRow(r as GuestTicketRow);
    })();
  }, [token]);

  useEffect(() => {
    if (row && canvasRef.current) {
      const qrData = JSON.stringify({ ticketId: row.registration_id, eventId: row.event_id, hash: row.qr_code ?? row.registration_id });
      QRCode.toCanvas(canvasRef.current, qrData, { width: 240, margin: 2, color: { dark: "#000", light: "#fff" } }, () => {});
    }
  }, [row]);

  const claim = async () => {
    if (!token) return;
    setClaiming(true);
    const { error } = await supabase.rpc("claim_guest_ticket", { p_token: token });
    setClaiming(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("gt.claimed", "Ticket added to your account — you'll get event updates here."));
    setRow(r => (r ? { ...r, claimed: true } : r));
  };

  if (missing) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="card !rounded-3xl p-8">
          <Ticket className="mx-auto mb-3 h-8 w-8 opacity-40" />
          <h1 className="text-lg font-bold mb-1">{t("tix.not_found", "Ticket not found")}</h1>
          <p className="text-sm opacity-60">{t("gt.not_found_desc", "This ticket link isn't valid.")}</p>
        </div>
      </div>
    );
  }
  if (!row) return <div className="py-16 text-center text-sm opacity-50">…</div>;

  const isTbd = !row.start_date;
  const startDate = row.start_date ? new Date(row.start_date) : new Date();
  const endDate = row.end_date ? new Date(row.end_date) : new Date(startDate.getTime() + 2 * 3600000);
  const eventTimezone = normalizeEventTimeZone(row.timezone);
  const schedule = formatEventDateTimeRange(row.start_date, row.end_date, eventTimezone, locale);
  const dateDisplay = isTbd ? t("ev.date_tbd", "Date TBD") : schedule.date;
  const timeDisplay = isTbd ? t("ev.time_tbd", "Time TBD") : schedule.time;
  const calendarEvent = { title: row.event_title, location: row.event_location ?? "", startDate, endDate, description: `Event: ${row.event_title}` };
  const returnHere = `/events/gt/${token}`;

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-4 pb-40">
      {/* Header */}
      <div className="rounded-2xl bg-card border border-border p-6 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{row.event_title}</h2>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Ticket className="w-3.5 h-3.5 text-primary" /> {row.quantity} {row.quantity > 1 ? t("rcpt.tickets", "Tickets") : t("rcpt.ticket", "Ticket")}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {dateDisplay}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{timeDisplay}</p>
        {row.event_location && <p className="text-xs text-muted-foreground mt-2">{row.event_location}</p>}
        <p className="text-xs text-muted-foreground mt-2">{t("gt.holder", "Ticket holder:")} <span className="font-semibold text-foreground">{row.guest_name}</span></p>
      </div>

      {/* QR entry pass */}
      <div className="rounded-2xl bg-card border border-border p-6 text-center">
        <h3 className="text-base font-bold text-foreground mb-1">{t("rcpt.entry_pass", "Your Entry Pass")}</h3>
        <p className="text-xs text-muted-foreground mb-4">{t("rcpt.present_qr", "Present this QR code at check-in")}</p>
        <div className="flex w-full justify-center overflow-hidden">
          <div className="grid w-fit max-w-full place-items-center rounded-xl bg-white p-3">
            <canvas ref={canvasRef} className="mx-auto block h-auto w-full max-w-[240px]" />
          </div>
        </div>
        <p className="text-xs text-primary font-mono mt-3">{t("gt.confirmation", "Confirmation")} #{row.registration_id.slice(0, 10)}</p>
        <p className="text-[10px] text-muted-foreground mt-2">{t("gt.emailed", "We've also emailed this ticket to you — the email link always brings you back here.")}</p>
      </div>

      {/* Save options */}
      {!isTbd && (
        <div className="grid grid-cols-2 gap-3">
          <a href={buildGoogleCalendarUrl(calendarEvent)} target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border">
            <ExternalLink className="w-4 h-4" /> {t("gt.gcal", "Google Calendar")}
          </a>
          <button onClick={() => downloadICS(calendarEvent)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border">
            <Download className="w-4 h-4" /> {t("gt.ics", "Apple / .ics")}
          </button>
        </div>
      )}

      {/* The OPTIONAL account moment — a bottom sheet, after the ticket, never before. */}
      {!row.claimed && sheetOpen && (
        <div className="fixed inset-x-0 bottom-20 z-40 p-3 sm:p-4">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 relative">
            <button aria-label="Dismiss" onClick={() => setSheetOpen(false)}
                    className="absolute right-3 top-3 opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Bell className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground mb-1">{t("gt.updates_q", "Want updates about this event?")}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("gt.updates_sub", "Create a free account to get reminders, changes and messages from the host — your ticket attaches automatically. Totally optional.")}
                </p>
                {user?.id ? (
                  <button onClick={claim} disabled={claiming}
                          className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold">
                    {claiming ? t("gt.adding", "Adding…") : t("gt.add_ticket", "Add this ticket to my account")}
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => navigate(`/join?next=${encodeURIComponent(returnHere)}`)}
                            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold">{t("gt.create_account", "Create account")}</button>
                    <button onClick={() => navigate(`/signin?next=${encodeURIComponent(returnHere)}`)}
                            className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-secondary border border-border">{t("gt.sign_in", "Sign in")}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {row.claimed && (
        <div className="rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
          {t("gt.attached", "This ticket is attached to an account — event updates arrive in the app and by notification.")}
        </div>
      )}
    </div>
  );
}
