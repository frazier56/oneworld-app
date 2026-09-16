import { DollarSign, Gift, MessageCircle, UserPlus } from "lucide-react";
import { cn } from "@evt/lib/utils";
import { useLanguage, useMicro } from "@evt/i18n/LanguageContext";
import { currencySymbol } from "@evt/lib/currencies";

interface EventOverviewProps {
  event: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    status: string;
    ticket_type?: string;
    ticket_price?: number;
    currency?: string | null;
    max_attendees?: number;
    attendee_count: number;
    paid_attendee_count?: number;
    complimentary_attendee_count?: number;
    revenue: number;
    cover_image_url?: string;
  };
  checkedInCount: number;
  onOpenPayouts: () => void;
  onOpenGuestList: () => void;
  onOpenAssignManager: () => void;
  onOpenGroupChat: () => void;
}

export default function EventOverviewTab({ event, checkedInCount, onOpenPayouts, onOpenGuestList, onOpenAssignManager, onOpenGroupChat }: EventOverviewProps) {
  const m = useMicro(); // v15: seven-language host-panel strings
  const { formatMoney, t } = useLanguage();
  const fill = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
  const sym = currencySymbol(event.currency);
  const fmt = (n: number) => event.currency ? `${sym}${(n || 0).toFixed(2)}` : formatMoney(n);
  const capacityPct = event.max_attendees ? Math.round((event.attendee_count / event.max_attendees) * 100) : 0;
  const checkInPct = event.attendee_count > 0 ? Math.round((checkedInCount / event.attendee_count) * 100) : 0;
  const paidTicketCount = event.paid_attendee_count ?? 0;
  const guestListCount = event.complimentary_attendee_count ?? 0;

  const quickActions = [
    { icon: DollarSign, label: t("mgmt.tab.payouts", "Payouts"), primary: true, onClick: onOpenPayouts },
    { icon: Gift, label: t("mgmt.guest_list", "Guest List"), primary: false, onClick: onOpenGuestList },
    { icon: UserPlus, label: t("mgmt.assign_manager", "Assign Manager"), primary: false, onClick: onOpenAssignManager },
    { icon: MessageCircle, label: t("mgmt.msg_attendees", "Group Chat"), primary: false, onClick: onOpenGroupChat },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={cn(
              "min-h-[92px] rounded-2xl border px-3 py-4 text-sm font-bold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_12px_30px_rgba(0,0,0,.08)] backdrop-blur-xl",
              action.primary
                ? "border-primary/70 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:opacity-95"
                : "border-white/55 bg-card/75 text-foreground hover:bg-primary/10 dark:border-white/10"
            )}
          >
            <span className="flex h-full flex-col items-center justify-center gap-2 text-center leading-tight">
              <action.icon className="h-5 w-5 shrink-0" />
              <span>{action.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Capacity */}
        <div className="rounded-2xl p-5 bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">{m("Capacity")}</span>
            <span className="text-2xl font-bold text-foreground">{capacityPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${capacityPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {fill(t("mgmt.capacity_summary", "{filled} of {capacity} spots filled"), { filled: event.attendee_count, capacity: event.max_attendees ?? "∞" })}
          </p>
        </div>

        {/* Check-In Rate */}
        <div className="rounded-2xl p-5 bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">{m("Check-In Rate")}</span>
            <span className="text-2xl font-bold text-primary">{checkInPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${checkInPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {fill(t("mgmt.checkin_summary", "{checked} of {total} attendees checked in"), { checked: checkedInCount, total: event.attendee_count })}
          </p>
        </div>
      </div>

      {/* Revenue (paid events) */}
      {event.ticket_type === "paid" && (
        <div className="rounded-2xl p-5 bg-card border border-border">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{m("Revenue")}</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{fmt(event.revenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {fill(t(paidTicketCount === 1 ? "mgmt.paid_ticket_one" : "mgmt.paid_ticket_many", paidTicketCount === 1 ? "{count} paid ticket" : "{count} paid tickets"), { count: paidTicketCount })} × {fmt(event.ticket_price ?? 0)}
            {guestListCount > 0 ? ` · ${fill(t(guestListCount === 1 ? "mgmt.guest_admission_one" : "mgmt.guest_admission_many", guestListCount === 1 ? "{count} guest-list admission" : "{count} guest-list admissions"), { count: guestListCount })}` : ""}
          </p>
        </div>
      )}

    </div>
  );
}
