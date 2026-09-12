/**
 * EventActivityTab — v20 CA (Lee, 18 Aug 2026): *"anything happened in that event relative
 * to that host, they should see it pop up. So-and-so just signed in at 3:32 PM… just used
 * their food ticket. Someone just checked in."*
 *
 * A live timeline assembled from what the host can already read under RLS: applications
 * (submitted / approved / rejected), registrations, check-ins, and food & drink
 * redemptions. Realtime subscriptions refresh the feed as rows change, so it updates
 * while the host watches the door.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useMicro } from "@evt/i18n/LanguageContext";
import { Activity, CheckCircle2, ChevronDown, ClipboardList, Ticket, ThumbsUp, ThumbsDown, Utensils, Wine } from "lucide-react";

interface Item {
  key: string;
  at: string;
  icon: "reg" | "checkin" | "app" | "approved" | "rejected" | "food" | "drink";
  text: string;
  summary: string;
  details: { label: string; value: string | null | undefined }[];
}

const ICONS = {
  reg: { I: Ticket, cls: "bg-primary/15 text-primary" },
  checkin: { I: CheckCircle2, cls: "bg-green-500/15 text-green-500" },
  app: { I: ClipboardList, cls: "bg-blue-500/15 text-blue-400" },
  approved: { I: ThumbsUp, cls: "bg-green-500/15 text-green-500" },
  rejected: { I: ThumbsDown, cls: "bg-destructive/15 text-destructive" },
  food: { I: Utensils, cls: "bg-amber-500/15 text-amber-500" },
  drink: { I: Wine, cls: "bg-blue-500/15 text-blue-400" },
} as const;

const fmtWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export default function EventActivityTab({ eventId }: { eventId: string }) {
  const m = useMicro();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const load = useCallback(async () => {
    const [{ data: regs }, { data: apps }, { data: fdItems }] = await Promise.all([
      supabase
        .from("event_registrations")
        .select("id, user_id, guest_name, guest_email, registered_at, checked_in_at, status, quantity")
        .eq("event_id", eventId),
      supabase
        .from("event_applications")
        .select("id, applicant_name, applicant_email, applicant_user_id, created_at, approval_status, approved_at, updated_at, payment_status, ticket_type, quantity")
        .eq("event_id", eventId),
      supabase
        .from("event_food_drink_items")
        .select("id, name, item_type")
        .eq("event_id", eventId),
    ]);

    const regList: any[] = regs || [];
    const uids = regList.map((r) => r.user_id).filter(Boolean);
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", uids)
      : { data: [] as any[] };
    const profById = new Map<string, { full_name?: string | null }>((profs || []).map((p: any) => [p.id, p]));
    const regName = (r: any) => profById.get(r.user_id)?.full_name || r.guest_name || m("An attendee");
    const regEmail = (r: any) => r.guest_email || "";

    const fdMap = new Map((fdItems || []).map((i: any) => [i.id, i]));
    const regIds = regList.map((r) => r.id);
    const { data: reds } = regIds.length
      ? await supabase
          .from("event_food_drink_redemptions")
          .select("id, registration_id, item_id, redeemed_at")
          .in("registration_id", regIds)
          .not("redeemed_at", "is", null)
      : { data: [] as any[] };
    const regById = new Map(regList.map((r) => [r.id, r]));

    const out: Item[] = [];
    for (const r of regList) {
      const name = regName(r);
      const email = regEmail(r);
      out.push({
        key: `reg-${r.id}`,
        at: r.registered_at,
        icon: "reg",
        text: `${name} ${m("registered")}`,
        summary: m("A ticket registration was created for this event."),
        details: [
          { label: m("Person"), value: email ? `${name} · ${email}` : name },
          { label: m("Tickets"), value: `${r.quantity || 1}` },
          { label: m("Status"), value: r.status },
          { label: m("Registered at"), value: fmtWhen(r.registered_at) },
          { label: m("Record ID"), value: r.id },
        ],
      });
      if (r.checked_in_at) {
        out.push({
          key: `ci-${r.id}`,
          at: r.checked_in_at,
          icon: "checkin",
          text: `${name} ${m("checked in")}`,
          summary: m("The attendee was checked in for this event."),
          details: [
            { label: m("Person"), value: email ? `${name} · ${email}` : name },
            { label: m("Tickets"), value: `${r.quantity || 1}` },
            { label: m("Checked in at"), value: fmtWhen(r.checked_in_at) },
            { label: m("Registration"), value: r.id },
          ],
        });
      }
    }
    for (const a of (apps || []) as any[]) {
      const name = a.applicant_name || m("Someone");
      out.push({
        key: `app-${a.id}`,
        at: a.created_at,
        icon: "app",
        text: `${name} ${m("submitted an application")}`,
        summary: m("An application was submitted and is ready for host review."),
        details: [
          { label: m("Person"), value: a.applicant_email ? `${name} · ${a.applicant_email}` : name },
          { label: m("Ticket"), value: `${a.quantity || 1}x ${a.ticket_type === "vip" ? "VIP" : m("General Admission")}` },
          { label: m("Application status"), value: a.approval_status },
          { label: m("Payment"), value: a.payment_status },
          { label: m("Submitted at"), value: fmtWhen(a.created_at) },
          { label: m("Application"), value: a.id },
        ],
      });
      if (a.approval_status === "approved" || a.approval_status === "auto_approved") {
        out.push({
          key: `appr-${a.id}`,
          at: a.approved_at || a.updated_at,
          icon: "approved",
          text: `${name} ${m("was approved")}`,
          summary: m("The application was approved."),
          details: [
            { label: m("Person"), value: a.applicant_email ? `${name} · ${a.applicant_email}` : name },
            { label: m("Ticket"), value: `${a.quantity || 1}x ${a.ticket_type === "vip" ? "VIP" : m("General Admission")}` },
            { label: m("Application status"), value: a.approval_status },
            { label: m("Payment"), value: a.payment_status },
            { label: m("Approved at"), value: fmtWhen(a.approved_at || a.updated_at) },
            { label: m("Application"), value: a.id },
          ],
        });
      }
      if (a.approval_status === "rejected") {
        out.push({
          key: `rej-${a.id}`,
          at: a.updated_at,
          icon: "rejected",
          text: `${name} ${m("was declined")}`,
          summary: m("The application was declined."),
          details: [
            { label: m("Person"), value: a.applicant_email ? `${name} · ${a.applicant_email}` : name },
            { label: m("Application status"), value: a.approval_status },
            { label: m("Declined at"), value: fmtWhen(a.updated_at) },
            { label: m("Application"), value: a.id },
          ],
        });
      }
    }
    for (const rd of (reds || []) as any[]) {
      const it: any = fdMap.get(rd.item_id);
      const reg = regById.get(rd.registration_id);
      if (!it || !reg) continue;
      out.push({
        key: `fd-${rd.id}`,
        at: rd.redeemed_at,
        icon: it.item_type === "drink" ? "drink" : "food",
        text: `${regName(reg)} ${m("used a voucher")} · ${it.name}`,
        summary: m("A food or drink voucher was redeemed from this attendee's ticket."),
        details: [
          { label: m("Person"), value: regEmail(reg) ? `${regName(reg)} · ${regEmail(reg)}` : regName(reg) },
          { label: m("Voucher"), value: `${it.name} · ${it.item_type === "drink" ? m("Drink") : m("Food")}` },
          { label: m("Redeemed at"), value: fmtWhen(rd.redeemed_at) },
          { label: m("Registration"), value: rd.registration_id },
        ],
      });
    }
    out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    setItems(out.slice(0, 100));
    setLoading(false);
  }, [eventId, m]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`evt-activity-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations", filter: `event_id=eq.${eventId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_applications", filter: `event_id=eq.${eventId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_food_drink_redemptions" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (loading) {
    return <div className="py-12 text-center text-xs text-muted-foreground">{m("Loading…")}</div>;
  }
  if (items.length === 0) {
    return (
      <div className="p-12 rounded-2xl text-center bg-secondary/50 border border-border">
        <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{m("Nothing yet — activity shows up here the moment it happens.")}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">{m("Live activity")}</h3>
        <p className="text-xs text-muted-foreground">{m("Registrations, approvals, check-ins and voucher use — as they happen.")}</p>
      </div>
      <div className="divide-y divide-border max-h-[32rem] overflow-y-auto">
        {items.map((it) => {
          const { I, cls } = ICONS[it.icon];
          const isOpen = expanded.has(it.key);
          const panelId = `event-activity-detail-${it.key}`;
          const dateText = it.at ? new Date(it.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
          return (
            <div key={it.key}>
              <button
                type="button"
                onClick={() => toggle(it.key)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-3 px-5 py-3 text-left hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 sm:flex"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${cls}`}><I className="w-4 h-4" /></span>
                <span className="min-w-0 sm:flex sm:flex-1 sm:items-center sm:gap-3">
                  <span className="block break-words text-sm leading-snug text-foreground sm:flex-1 sm:truncate">{it.text}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums sm:mt-0 sm:shrink-0">
                    {dateText}
                  </span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background/70">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {isOpen && (
                <div id={panelId} className="px-5 pb-4 sm:pl-16">
                  <div className="rounded-xl border border-border bg-background/45 p-3">
                    <p className="text-xs font-semibold text-foreground">{it.summary}</p>
                    <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {it.details.filter((d) => d.value).map((d) => (
                        <div key={`${it.key}-${d.label}`}>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                          <dd className="mt-0.5 break-words text-xs text-foreground">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
