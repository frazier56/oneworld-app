/**
 * EventRegistrationsTab — v18 rework (Lee's host-side UAT, 18 Aug 2026).
 *
 * Lee: *"It should just have a status option… pending an approval, ready for check-in, or
 * checked in… you can't check-in anyone who has a pending approval… check-in is his own
 * screen."* So this tab now shows STATUS, not a bare "Check In" button:
 *
 *  - Pending approval  → amber chip, tap jumps to the Applicants tab (approval is the
 *                        prerequisite; the row cannot be checked in from anywhere).
 *  - Ready to check in → tap jumps to the Check-In tab, where check-in actually lives
 *                        (QR scanner / manual — its own flow, not a one-tap side effect).
 *  - Checked in        → green, with an ✕ UNDO (Lee: "you might click it by mistake").
 *
 * Wise/PayPal money confirmations stay as explicit actions — those are payment events,
 * not check-ins. Filters mirror the real statuses the host thinks in.
 */
import { useEffect, useRef, useState } from "react";
import { useMicro } from "@evt/i18n/LanguageContext";
import { Search, CheckCircle2, Clock, XCircle, Users, X, ChevronRight, MoreVertical, Clipboard, RotateCcw } from "lucide-react";
import { cn } from "@evt/lib/utils";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";

interface Registration {
  id: string;
  user_id: string;
  status: string;
  quantity: number;
  registered_at: string;
  checked_in_at: string | null;
  checked_in_count: number;
  qr_code: string | null;
  profile?: { full_name: string; email: string; photo_url: string | null };
}

interface Props {
  eventId: string;
  registrations: Registration[];
  onRefresh: () => void;
  pendingApps: { user_ids: Set<string>; emails: Set<string> };
  requiresApproval: boolean;
  onOpenApplicants: () => void;
  onOpenCheckIn: () => void;
}

type Derived = "pending-approval" | "ready" | "checked-in" | "pending_wise_confirmation" | "pending_paypal_confirmation" | "cancelled" | "approved_unpaid" | "other";

export default function EventRegistrationsTab({ eventId, registrations, onRefresh, pendingApps, requiresApproval, onOpenApplicants, onOpenCheckIn }: Props) {
  const m = useMicro(); // v15: seven-language host-panel strings
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuScopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuScopeRef.current && !menuScopeRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const derive = (r: Registration): Derived => {
    if (r.status === "checked-in") return "checked-in";
    if (r.status === "cancelled") return "cancelled";
    if (r.status === "pending_wise_confirmation" || r.status === "pending_paypal_confirmation" || r.status === "approved_unpaid") return r.status as Derived;
    if (r.status === "registered") {
      const email = (r.profile?.email || "").toLowerCase();
      const pending = requiresApproval && (pendingApps.user_ids.has(r.user_id) || (email && pendingApps.emails.has(email)));
      return pending ? "pending-approval" : "ready";
    }
    return "other";
  };

  const filtered = registrations.filter((r) => {
    if (filter !== "all" && derive(r) !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = r.profile?.full_name?.toLowerCase() ?? "";
      const email = r.profile?.email?.toLowerCase() ?? "";
      return name.includes(q) || email.includes(q);
    }
    return true;
  });

  /* UNDO check-in (Lee: "when you check someone in, you can't undo it… it needs an x"). */
  const handleUndoCheckIn = async (reg: Registration) => {
    setBusy(reg.id);
    const { error } = await supabase
      .from("event_registrations")
      .update({ status: "registered", checked_in_at: null, checked_in_count: Math.max(0, reg.checked_in_count - 1) })
      .eq("id", reg.id);
    setBusy(null);
    if (error) { toast.error(m("Could not undo the check-in")); return; }
    toast.success(m("Check-in undone"));
    onRefresh();
  };

  const handleConfirmWise = async (reg: Registration) => {
    if (!confirm(`Confirm you received the Wise payment from ${reg.profile?.full_name ?? "this attendee"}? This releases their ticket.`)) return;
    const { error } = await supabase
      .from("event_registrations")
      .update({ status: "registered" })
      .eq("id", reg.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("wise_payout_logs" as any)
      .update({ confirmed_by_payee_at: new Date().toISOString(), status: "outgoing_payment_received" })
      .eq("event_order_id", reg.id);
    await supabase.from("notifications").insert({
      user_id: reg.user_id,
      type: "wise_payment_confirmed",
      title: "Your Wise payment was confirmed",
      body: `The host confirmed your Wise payment — your ticket is now active.`,
      action_url: `/events/tickets`,
    });
    toast.success(m("Confirmed — ticket released."));
    onRefresh();
  };

  const handleConfirmPaypal = async (reg: Registration) => {
    if (!confirm(`Confirm you received the PayPal payment from ${reg.profile?.full_name ?? "this attendee"}? This releases their ticket.`)) return;
    const { error } = await supabase.from("event_registrations").update({ status: "registered" }).eq("id", reg.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("wise_payout_logs" as any)
      .update({ confirmed_by_payee_at: new Date().toISOString(), status: "outgoing_payment_received" })
      .eq("event_order_id", reg.id);
    await supabase.from("notifications").insert({
      user_id: reg.user_id,
      type: "paypal_payment_confirmed",
      title: "Your PayPal payment was confirmed",
      body: `The host confirmed your PayPal payment — your ticket is now active.`,
      action_url: `/events/tickets`,
    });
    toast.success(m("Confirmed — ticket released."));
    onRefresh();
  };

  const handleCopyEmail = async (reg: Registration) => {
    const email = reg.profile?.email?.trim();
    if (!email) { toast.info(m("No email on this attendee.")); return; }
    await navigator.clipboard.writeText(email);
    toast.success(m("Email copied"));
    setOpenMenu(null);
  };

  const count = (d: Derived) => registrations.filter((r) => derive(r) === d).length;
  const filters = [
    { key: "all", label: `${m("All")} (${registrations.length})` },
    /* v33 (Lee): "why do we have a pending tab for registrations?" — the state is real but
       RARE: it only happens when someone holds a registration while their application is
       still pending (e.g. free RSVP-then-review events). Approvals themselves live in the
       Applicants tab. So the filter now appears ONLY when at least one row is actually in
       that state, same rule as the Wise/PayPal filters — zero-count noise is gone. */
    ...(requiresApproval && count("pending-approval") > 0 ? [{ key: "pending-approval", label: `${m("Pending approval")} (${count("pending-approval")})` }] : []),
    { key: "ready", label: `${m("Ready to check in")} (${count("ready")})` },
    { key: "checked-in", label: `${m("Checked In")} (${count("checked-in")})` },
    ...(count("pending_wise_confirmation") ? [{ key: "pending_wise_confirmation", label: `${m("Pending Wise")} (${count("pending_wise_confirmation")})` }] : []),
    ...(count("pending_paypal_confirmation") ? [{ key: "pending_paypal_confirmation", label: `${m("Pending PayPal")} (${count("pending_paypal_confirmation")})` }] : []),
    ...(count("cancelled") ? [{ key: "cancelled", label: `${m("Cancelled")} (${count("cancelled")})` }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={m("Search by name or email...")}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border",
                filter === f.key ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attendee List */}
      <div ref={menuScopeRef} className="rounded-2xl bg-card border border-border overflow-visible">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{m("Attendees")} ({filtered.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{m("No attendees found")}</p>
            </div>
          ) : (
            filtered.map((reg) => {
              const d = derive(reg);
              return (
                /* v23 CZ (Lee): names were losing to the status chips — tighter row padding,
                   the avatar slides left, names get real room (wrap to 2 lines instead of
                   "Lee F…"), and the wide chips wrap their own text instead. */
                <div key={reg.id} className="flex items-center gap-3 px-3.5 py-3.5 hover:bg-secondary/50 transition-colors">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {reg.profile?.photo_url ? (
                      <img src={reg.profile.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {(reg.profile?.full_name ?? "?")[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground break-words leading-tight line-clamp-2">{reg.profile?.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate" title={reg.profile?.email ?? ""}>{reg.profile?.email ?? ""}</p>
                  </div>
                  {/* Status */}
                  {d === "pending_wise_confirmation" ? (
                    <button onClick={() => { setOpenMenu(null); handleConfirmWise(reg); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                    >{m("Confirm Wise paid")}</button>
                  ) : d === "pending_paypal_confirmation" ? (
                    <button onClick={() => { setOpenMenu(null); handleConfirmPaypal(reg); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                    >{m("Confirm PayPal paid")}</button>
                  ) : d === "pending-approval" ? (
                    /* v25 DW (Lee): one clean line whenever it fits — text, then the
                       chevron RIGHT next to it (no dead gap). Wraps only as a last resort. */
                    <button onClick={() => { setOpenMenu(null); onOpenApplicants(); }}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/25 transition-colors"
                      title={m("Review their application before check-in")}
                    ><Clock className="w-3.5 h-3.5 shrink-0" /> {m("Pending approval")} <ChevronRight className="w-3.5 h-3.5 shrink-0 -ml-0.5" /></button>
                  ) : d === "ready" ? (
                    <button onClick={() => { setOpenMenu(null); onOpenCheckIn(); }}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                    >{m("Ready to check in")} <ChevronRight className="w-3.5 h-3.5 shrink-0 -ml-0.5" /></button>
                  ) : d === "checked-in" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {m("Checked In")}
                      </span>
                      <button onClick={() => handleUndoCheckIn(reg)} disabled={busy === reg.id}
                        className="grid h-6 w-6 place-items-center rounded-full bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
                        title={m("Undo check-in")} aria-label={m("Undo check-in")}
                      ><X className="w-3.5 h-3.5" /></button>
                    </span>
                  ) : d === "approved_unpaid" ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                      <Clock className="w-3.5 h-3.5" /> {m("Approved · payment pending")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                      <XCircle className="w-3.5 h-3.5" /> {m("Cancelled")}
                    </span>
                  )}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu((v) => v === reg.id ? null : reg.id);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full border border-primary/25 bg-primary/[0.06] text-primary hover:border-primary/45 hover:bg-primary/15"
                      aria-label={m("Attendee actions", "Acciones del asistente")}
                      title={m("Attendee actions", "Acciones del asistente")}
                    >
                      <MoreVertical className="h-4 w-4" strokeWidth={2.6} />
                    </button>
                    {openMenu === reg.id && (
                      <div className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                        {d === "pending_wise_confirmation" && (
                          <AttendeeMenuItem icon={<CheckCircle2 className="w-4 h-4" />} label={m("Confirm Wise paid")} onClick={() => { setOpenMenu(null); handleConfirmWise(reg); }} />
                        )}
                        {d === "pending_paypal_confirmation" && (
                          <AttendeeMenuItem icon={<CheckCircle2 className="w-4 h-4" />} label={m("Confirm PayPal paid")} onClick={() => { setOpenMenu(null); handleConfirmPaypal(reg); }} />
                        )}
                        {d === "pending-approval" && (
                          <AttendeeMenuItem icon={<Clock className="w-4 h-4" />} label={m("View application")} onClick={() => { setOpenMenu(null); onOpenApplicants(); }} />
                        )}
                        {(d === "ready" || d === "approved_unpaid") && (
                          <AttendeeMenuItem icon={<ChevronRight className="w-4 h-4" />} label={m("Open check-in")} onClick={() => { setOpenMenu(null); onOpenCheckIn(); }} />
                        )}
                        {d === "checked-in" && (
                          <AttendeeMenuItem icon={<RotateCcw className="w-4 h-4" />} label={m("Undo check-in")} onClick={() => { setOpenMenu(null); handleUndoCheckIn(reg); }} />
                        )}
                        <AttendeeMenuItem icon={<Clipboard className="w-4 h-4" />} label={m("Copy email")} onClick={() => handleCopyEmail(reg)} disabled={!reg.profile?.email} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function AttendeeMenuItem({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
