/**
 * EventApplicantsTab — Host-only view of applicants who submitted the event's application form.
 * Sortable by VAIA fit score, status filter, and detail drawer with full answers + Approve/Reject.
 */
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useLanguage, useMicro } from "@evt/i18n/LanguageContext";
import { Loader2, Sparkles, CheckCircle2, Clock, X, Mail, Phone, ThumbsUp, ThumbsDown, Wand2 } from "lucide-react";
import { cn } from "@evt/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@evt/components/ui/sheet";
import { Button } from "@evt/components/ui/button";
import { toast } from "sonner";
import EventIcpEditor from "./EventIcpEditor";

interface Application {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  answers: Record<string, any>;
  payment_status: "pending" | "authorized" | "paid" | "failed" | "cancelled";
  approval_status: "pending" | "approved" | "rejected" | "auto_approved";
  vaia_fit_score: number | null;
  vaia_reasoning: string | null;
  ticket_type: string;
  quantity: number;
  created_at: string;
  paid_at: string | null;
}

interface QuestionDef {
  id: string;
  label: string;
  type: string;
}

type SortKey = "fit_desc" | "fit_asc" | "newest" | "oldest";
type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function EventApplicantsTab({ eventId, onChanged }: { eventId: string; onChanged?: () => void }) {
  const { lang } = useLanguage();
  const m = useMicro(); // v15: seven-language micro layer
  const [apps, setApps] = useState<Application[]>([]);
  const [questions, setQuestions] = useState<QuestionDef[]>([]);
  const [icp, setIcp] = useState<string | null>(null);
  const [isPaidEvent, setIsPaidEvent] = useState(false); // v31: gates the "no card yet" hint
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("fit_desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [actioning, setActioning] = useState<"approve" | "reject" | null>(null);
  const [scoring, setScoring] = useState(false);
  const [proactive, setProactive] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActioning, setBulkActioning] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  const REJECT_TEMPLATES = [
    { label: "At capacity", text: "We've reached capacity for this event. We'd love to see you at a future one." },
    { label: "Not the right fit", text: "After reviewing, we don't think this event is quite the right fit for what you're looking for." },
    { label: "Wrong date/time", text: "Schedules didn't line up this round — please apply again for our next event." },
    { label: "Need more details", text: "Your application was missing details we needed to confirm a spot. Feel free to reapply with more info." },
    { label: "Custom (write your own)", text: "" },
  ];

  const reloadApps = async () => {
    const { data: appData } = await supabase
      .from("event_applications")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setApps((appData as any) ?? []);
  };

  const runVaiaScoring = async (force = false) => {
    if (!icp || icp.trim().length < 10) {
      toast.error(m("Define your ICP first", "Define tu ICP primero"));
      return;
    }
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("vaia-event-intelligence", {
        body: { action: "applicant_score", eventId, force },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      toast.success(`VAIA scored ${d.scored} applicant${d.scored === 1 ? "" : "s"}`);
      setProactive(d.proactive || null);
      await reloadApps();
    } catch (e: any) {
      toast.error(e.message || "VAIA scoring failed");
    } finally {
      setScoring(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setActioning("approve");
    try {
      const { data, error } = await supabase.functions.invoke("approve-event-application", {
        body: { applicationId: selected.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      /* v32 (Lee): approve-as-nudge — approving an unpaid application no longer blocks;
         it notifies the applicant (app + email + text) to complete payment, and their
         card is charged automatically the moment they authorize. */
      if ((data as any)?.awaitingPayment) {
        toast.success(m("Approved — payment requested. They've been notified by app, email and text."));
      } else {
        toast.success(m("Applicant approved", "Solicitante aprobado"));
      }
      onChanged?.();  /* v25 EB: registration just got created — refresh the other tabs */
      setApps(prev => prev.map(a => a.id === selected.id ? { ...a, approval_status: "approved", payment_status: (data as any)?.captured ? "paid" : a.payment_status } : a));
      setSelected(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActioning("reject");
    try {
      const { data, error } = await supabase.functions.invoke("reject-event-application", {
        body: { applicationId: selected.id, reason: rejectReason.trim() || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(m("Applicant rejected", "Solicitante rechazado"));
      onChanged?.();
      setApps(prev => prev.map(a => a.id === selected.id ? { ...a, approval_status: "rejected", payment_status: "cancelled" } : a));
      setSelected(null);
      setRejectOpen(false);
      setRejectReason("");
    } catch (e: any) {
      toast.error(e.message || "Failed to reject");
    } finally {
      setActioning(null);
    }
  };

  /* v18: reverse a mistaken decision. RLS lets the host update applications on their own
     events directly. Undoing an APPROVAL also cancels the registration it created (hosts
     can update but not delete registration rows — cancelled keeps the audit trail). */
  const [undoing, setUndoing] = useState(false);
  const undoDecision = async (app: Application) => {
    setUndoing(true);
    try {
      const wasApproved = app.approval_status === "approved" || app.approval_status === "auto_approved";
      const { error } = await supabase
        .from("event_applications")
        .update({
          approval_status: "pending",
          rejection_reason: null,
          approved_at: null,
          approved_by: null,
          ...(app.approval_status === "rejected" ? { payment_status: "pending" } : {}),
        } as any)
        .eq("id", app.id);
      if (error) throw error;
      if (wasApproved) {
        // Cancel the registration the approval created (matched by applicant user).
        const { data: appRow } = await supabase
          .from("event_applications")
          .select("applicant_user_id")
          .eq("id", app.id)
          .maybeSingle();
        const uid = (appRow as any)?.applicant_user_id;
        if (uid) {
          await supabase
            .from("event_registrations")
            .update({ status: "cancelled" })
            .eq("event_id", eventId)
            .eq("user_id", uid)
            .neq("status", "checked-in");
        }
      }
      toast.success(m("Decision undone — back to pending", "Decisión deshecha — vuelve a pendiente"));
      onChanged?.();
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, approval_status: "pending" } : a));
      setSelected(null);
    } catch (e: any) {
      toast.error(e.message || "Could not undo");
    } finally {
      setUndoing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Approve ${ids.length} applicant${ids.length === 1 ? "" : "s"}?`)) return;
    setBulkActioning(true);
    let ok = 0; let fail = 0;
    for (const id of ids) {
      try {
        const { data, error } = await supabase.functions.invoke("approve-event-application", { body: { applicationId: id } });
        if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
        ok++;
      } catch { fail++; }
    }
    toast.success(`Approved ${ok}${fail ? ` · ${fail} failed` : ""}`);
    setSelectedIds(new Set());
    setBulkActioning(false);
    await reloadApps();
    onChanged?.();
  };

  const handleBulkReject = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkActioning(true);
    let ok = 0; let fail = 0;
    for (const id of ids) {
      try {
        const { data, error } = await supabase.functions.invoke("reject-event-application", {
          body: { applicationId: id, reason: bulkRejectReason.trim() || null },
        });
        if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
        ok++;
      } catch { fail++; }
    }
    toast.success(`Rejected ${ok}${fail ? ` · ${fail} failed` : ""}`);
    setSelectedIds(new Set());
    setBulkRejectOpen(false);
    setBulkRejectReason("");
    setBulkActioning(false);
    onChanged?.();
    await reloadApps();
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      const [{ data: appData }, { data: formData }, { data: ev }] = await Promise.all([
        supabase
          .from("event_applications")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),
        supabase
          .from("event_application_forms")
          .select("questions")
          .eq("event_id", eventId)
          .maybeSingle(),
        supabase
          .from("events")
          .select("application_icp_description, ticket_type, ticket_price, ga_ticket_price")
          .eq("id", eventId)
          .maybeSingle(),
      ]);
      if (!alive) return;
      setApps((appData as any) ?? []);
      const qs = (formData as any)?.questions ?? [];
      setQuestions(Array.isArray(qs) ? qs : []);
      setIcp((ev as any)?.application_icp_description ?? null);
      // v31: know whether this is a PAID event so the detail sheet only says
      // "no card authorized yet" where a card is actually expected.
      setIsPaidEvent(
        (ev as any)?.ticket_type !== "free" &&
        (((ev as any)?.ticket_price || 0) > 0 || ((ev as any)?.ga_ticket_price || 0) > 0)
      );
      setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, [eventId]);

  const filtered = useMemo(() => {
    let list = [...apps];
    if (statusFilter !== "all") {
      if (statusFilter === "pending") list = list.filter(a => a.approval_status === "pending");
      else if (statusFilter === "approved") list = list.filter(a => a.approval_status === "approved" || a.approval_status === "auto_approved");
      else if (statusFilter === "rejected") list = list.filter(a => a.approval_status === "rejected");
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case "fit_desc": return (b.vaia_fit_score ?? -1) - (a.vaia_fit_score ?? -1);
        case "fit_asc": return (a.vaia_fit_score ?? 999) - (b.vaia_fit_score ?? 999);
        case "newest": return +new Date(b.created_at) - +new Date(a.created_at);
        case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
      }
    });
    return list;
  }, [apps, statusFilter, sortKey]);

  const pendingCount = apps.filter(a => a.approval_status === "pending").length;
  const approvedCount = apps.filter(a => a.approval_status === "approved" || a.approval_status === "auto_approved").length;
  const unscoredCount = apps.filter(a => a.vaia_fit_score == null).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ICP editor — always at top */}
      <EventIcpEditor eventId={eventId} initialIcp={icp} onSaved={setIcp} />

      {/* VAIA Score button — only when ICP set + applicants exist */}
      {icp && apps.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground">
            {unscoredCount > 0
              ? `${unscoredCount} unscored applicant${unscoredCount === 1 ? "" : "s"}`
              : "All applicants scored against your ICP"}
          </p>
          <Button
            onClick={() => runVaiaScoring(unscoredCount === 0)}
            disabled={scoring}
            size="sm"
            className="rounded-full bg-primary text-primary-foreground"
          >
            {scoring ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
            {unscoredCount === 0 ? "Re-score with VAIA" : `Score ${unscoredCount} with VAIA`}
          </Button>
        </div>
      )}

      {/* VIP proactive panel */}
      {proactive && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">VAIA insights · VIP</h3>
          </div>
          <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">{proactive}</p>
        </div>
      )}

      {apps.length === 0 && (
        <div className="p-12 rounded-2xl text-center bg-secondary/50 border border-border">
          <p className="text-sm text-muted-foreground">
            {m("No applications yet. When someone submits the form, they'll show up here.", "Aún no hay solicitudes. Cuando alguien envíe el formulario, aparecerá aquí.")}
          </p>
        </div>
      )}

      {apps.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label={m("Total", "Total")} value={apps.length} />
          <StatBox label={m("Pending", "Por revisar")} value={pendingCount} highlight />
          <StatBox label={m("Approved", "Aprobados")} value={approvedCount} />
        </div>
      )}

      {/* Filters — v23 CY (Lee): auto-width pills with the chevron sitting NEXT to the
          text instead of the native arrow floating at the far right edge. */}
      <div className="flex items-center gap-2 flex-wrap">
        <PillSelect value={statusFilter} onChange={v => setStatusFilter(v as StatusFilter)}>
          <option value="all">{m("All status", "Todos")}</option>
          <option value="pending">{m("Pending review", "Por revisar")}</option>
          <option value="approved">{m("Approved", "Aprobados")}</option>
          <option value="rejected">{m("Rejected", "Rechazados")}</option>
        </PillSelect>
        <PillSelect value={sortKey} onChange={v => setSortKey(v as SortKey)}>
          <option value="fit_desc">{m("Best VAIA fit", "Mejor calce VAIA")}</option>
          <option value="fit_asc">{m("Worst fit", "Peor calce")}</option>
          <option value="newest">{m("Newest", "Más recientes")}</option>
          <option value="oldest">{m("Oldest", "Más antiguos")}</option>
        </PillSelect>
      </div>

      {/* Bulk toolbar */}
      {filtered.some(a => a.approval_status === "pending") && (() => {
        const pendingVisible = filtered.filter(a => a.approval_status === "pending");
        const allSelected = pendingVisible.length > 0 && pendingVisible.every(a => selectedIds.has(a.id));
        return (
          /* v23 CY (Lee): the checkbox lines up with the row checkboxes below (same px-4
             offset) and the count sits UNDER it — no more mid-toolbar text wrap. */
          <div className="flex items-start gap-3 px-4">
            <div className="flex flex-col items-start gap-1 shrink-0 pt-0.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (allSelected) pendingVisible.forEach(a => next.delete(a.id));
                    else pendingVisible.forEach(a => next.add(a.id));
                    return next;
                  });
                }}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[10px] font-semibold text-muted-foreground leading-none whitespace-nowrap">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : m("Select all", "Todos")}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <div className="ml-auto flex gap-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkActioning}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <ThumbsUp className="w-3 h-3 inline mr-1" /> Approve
                </button>
                <button
                  onClick={() => { setBulkRejectReason(""); setBulkRejectOpen(true); }}
                  disabled={bulkActioning}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 disabled:opacity-50"
                >
                  <ThumbsDown className="w-3 h-3 inline mr-1" /> Reject
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary border border-border text-foreground"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* v31 (Lee): the 7-day-hold clock lives HERE as one quiet general note, not as a
          chip repeated on every row. Shown only while at least one pending card hold exists. */}
      {apps.some(a => a.approval_status === "pending" && a.payment_status === "authorized") && (
        <p className="px-1 text-[11px] text-muted-foreground leading-snug">
          {m("Card authorizations are held for about 7 days — review pending requests before the hold expires.")}
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        {filtered.map((app, idx) => {
          const checked = selectedIds.has(app.id);
          const canSelect = app.approval_status === "pending";
          return (
            <div
              key={app.id}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left",
                idx > 0 && "border-t border-border",
                checked && "bg-primary/5"
              )}
            >
              {canSelect && (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelect(app.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 accent-primary flex-shrink-0"
                />
              )}
              <button
                onClick={() => setSelected(app)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <FitBadge score={app.vaia_fit_score} />
                {/* v31 (Lee): ONE status chip per row — the per-row "Card hold" chip is gone
                    (the 7-day hold is a single general note above the list now), the chip
                    wraps compactly, and the person's NAME gets the space back. */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{app.applicant_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate leading-snug">{app.applicant_email}</p>
                </div>
                <ApprovalPill status={app.approval_status} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Bulk reject modal */}
      {bulkRejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBulkRejectOpen(false)}>
          <div className="bg-background border border-border rounded-2xl p-5 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground">Reject {selectedIds.size} applicant{selectedIds.size === 1 ? "" : "s"}</h3>
            <p className="text-xs text-muted-foreground">Pick a reason — applicants will see this in their notification.</p>
            <div className="space-y-1.5">
              {REJECT_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => setBulkRejectReason(t.text)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors",
                    bulkRejectReason === t.text ? "bg-primary/10 border-primary/40 text-foreground" : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                  )}
                >
                  <span className="font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
            <textarea
              value={bulkRejectReason}
              onChange={e => setBulkRejectReason(e.target.value)}
              placeholder="Custom reason (optional)"
              rows={3}
              className="w-full text-xs bg-secondary/50 border border-border rounded-lg p-2 text-foreground"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setBulkRejectOpen(false)} disabled={bulkActioning}>Cancel</Button>
              <Button size="sm" onClick={handleBulkReject} disabled={bulkActioning} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {bulkActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Reject ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selected.applicant_name}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Contact */}
                <div className="rounded-xl bg-secondary/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={`mailto:${selected.applicant_email}`} className="text-foreground hover:underline">
                      {selected.applicant_email}
                    </a>
                  </div>
                  {selected.applicant_phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <a href={`tel:${selected.applicant_phone}`} className="text-foreground hover:underline">
                        {selected.applicant_phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Status + ticket */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-secondary/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Status</p>
                    {/* v31 (Lee): ONE status here too. The payment truth (card actually on
                        hold vs no card entered yet) moves to a small line below — that's the
                        real difference between two "pending" applicants, and the host needs
                        it to know who is approvable. */}
                    <div className="mt-1">
                      <ApprovalPill status={selected.approval_status} />
                    </div>
                    {selected.approval_status === "approved" && selected.payment_status === "pending" && isPaidEvent && (
                      <p className="mt-1 text-[10px] leading-snug text-primary">
                        {m("Approved — awaiting payment. Their card is charged the moment they authorize.")}
                      </p>
                    )}
                    {selected.approval_status === "pending" && selected.payment_status === "authorized" && (
                      <p className="mt-1 text-[10px] leading-snug text-amber-600">
                        {m("Card on hold — charged only when you approve.")}
                      </p>
                    )}
                    {isPaidEvent && selected.approval_status === "pending" && selected.payment_status === "pending" && (
                      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                        {m("No card authorized yet — they'll authorize before you can approve.")}
                      </p>
                    )}
                    {selected.payment_status === "failed" && (
                      <p className="mt-1 text-[10px] leading-snug text-destructive">
                        {m("Payment failed — the applicant was asked to re-authorize.")}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Ticket</p>
                    {/* v23 CX (Lee): "People don't know what GA is" — never abbreviate. */}
                    <p className="text-sm font-semibold text-foreground mt-1 leading-tight">
                      {selected.quantity}× {selected.ticket_type === "vip" ? "VIP" : m("General Admission", "Entrada general")}
                    </p>
                  </div>
                </div>

                {/* VAIA */}
                {selected.vaia_fit_score !== null && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <p className="text-xs font-bold text-primary">VAIA fit · {fitTen(selected.vaia_fit_score)}/10</p>
                    </div>
                    {selected.vaia_reasoning && (
                      <p className="text-xs text-foreground/80 leading-relaxed">{selected.vaia_reasoning}</p>
                    )}
                  </div>
                )}

                {/* Answers */}
                <div className="space-y-3">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-bold">
                    {m("Application answers", "Respuestas del formulario")}
                  </p>
                  {/* v23 CW (Lee): question BOLD and prominent, answer in espresso amber a
                      shade lighter — and a real outline instead of white-on-light-gray. */}
                  {questions.length > 0 ? (
                    questions.map((q, i) => {
                      const v = selected.answers?.[q.id];
                      const display = Array.isArray(v) ? v.join(", ") : (v ?? "—");
                      return (
                        <div key={q.id} className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                          <p className="text-xs font-bold text-foreground mb-1.5 leading-snug">
                            {i + 1}. {q.label}
                          </p>
                          <p className="text-sm font-medium text-primary whitespace-pre-wrap break-words leading-relaxed">
                            {String(display) || "—"}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    Object.entries(selected.answers || {}).map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                        <p className="text-xs font-bold text-foreground mb-1.5 leading-snug">{k}</p>
                        <p className="text-sm font-medium text-primary break-words">{Array.isArray(v) ? v.join(", ") : String(v)}</p>
                      </div>
                    ))
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  {m("Submitted", "Enviada el")} {new Date(selected.created_at).toLocaleString()}
                </p>

                {/* Approve / Reject actions */}
                {(selected.approval_status === "pending") && (
                  <div className="grid grid-cols-2 gap-2 pt-2 sticky bottom-0 bg-background pb-2">
                    <Button
                      variant="outline"
                      onClick={() => { setRejectReason(""); setRejectOpen(true); }}
                      disabled={actioning !== null}
                      className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <ThumbsDown className="w-4 h-4 mr-1" /> {m("Reject", "Rechazar")}
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={actioning !== null}
                      className="rounded-full bg-primary text-primary-foreground"
                    >
                      {actioning === "approve" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isPaidEvent && selected.payment_status === "pending" ? (
                        /* v32.1 (Lee): the long label spilled out of the pill on phones —
                           stacked layout: "Approve" on top, "& request payment" smaller below. */
                        <span className="flex items-center gap-2">
                          <ThumbsUp className="w-4 h-4 shrink-0" />
                          <span className="flex flex-col items-start text-left">
                            <span className="text-sm font-bold leading-none">{m("Approve", "Aprobar")}</span>
                            <span className="text-[9.5px] font-medium opacity-90 leading-tight mt-0.5">{m("& request payment")}</span>
                          </span>
                        </span>
                      ) : (
                        <><ThumbsUp className="w-4 h-4 mr-1" /> {m("Approve", "Aprobar")}</>
                      )}
                    </Button>
                  </div>
                )}
                {selected.approval_status !== "pending" && (
                  <div className="space-y-2 pt-2">
                    <div className="text-center text-xs text-muted-foreground">
                      <ApprovalPill status={selected.approval_status} />
                    </div>
                    {/* v18 UNDO (Lee: "if you click approve and you didn't mean to, you should
                        be able to undo it"). Reject → back to pending is always safe (the card
                        hold was released; a paid applicant may need to re-authorize). Approve →
                        back to pending only while no money was captured — once the card was
                        charged, reversing means a refund, which stays a deliberate Stripe step. */}
                    {selected.approval_status === "rejected" && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => undoDecision(selected)}
                        disabled={undoing}
                        className="w-full rounded-full"
                      >
                        {undoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : m("Undo rejection — back to pending", "Deshacer rechazo — vuelve a pendiente")}
                      </Button>
                    )}
                    {(selected.approval_status === "approved" || selected.approval_status === "auto_approved") && selected.payment_status !== "paid" && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => undoDecision(selected)}
                        disabled={undoing}
                        className="w-full rounded-full"
                      >
                        {undoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : m("Undo approval — back to pending", "Deshacer aprobación — vuelve a pendiente")}
                      </Button>
                    )}
                    {(selected.approval_status === "approved" || selected.approval_status === "auto_approved") && selected.payment_status === "paid" && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        {m("Card already charged — to reverse this, refund the payment from the Payouts tab.", "La tarjeta ya fue cobrada — para revertir, reembolsa el pago desde Pagos.")}
                      </p>
                    )}
                  </div>
                )}
              </div>

      {/* Rejection reason picker — v25 DU (Lee: "reject doesn't respond at all").
          This overlay used to render OUTSIDE the Radix Sheet, whose focus trap makes
          everything outside it inert — the modal painted but no tap landed. It now lives
          INSIDE SheetContent, so it's part of the trapped tree and fully interactive. */}
      {rejectOpen && selected && (
        <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !actioning && setRejectOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-5 w-full max-w-md">
            <h3 className="text-base font-bold text-foreground mb-1">Reject {selected.applicant_name}?</h3>
            <p className="text-xs text-muted-foreground mb-4">Pick a reason — the applicant will see it. Any payment hold is released.</p>
            <div className="space-y-1.5 mb-3">
              {REJECT_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => setRejectReason(t.text)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors",
                    rejectReason === t.text
                      ? "bg-primary/10 border-primary/40 text-foreground"
                      : "bg-secondary/50 border-border text-foreground/85 hover:border-primary/30"
                  )}
                >
                  <span className="font-semibold">{t.label}</span>
                  {t.text && <span className="text-muted-foreground"> — {t.text}</span>}
                </button>
              ))}
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Add or edit your message…"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground resize-none mb-3"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectOpen(false)}
                disabled={actioning !== null}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={actioning !== null}
                className="rounded-full bg-destructive text-destructive-foreground hover:opacity-90"
              >
                {actioning === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send rejection</>}
              </Button>
            </div>
          </div>
        </div>
      )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* v23 CY: a styled select pill — appearance-none kills the browser's far-right arrow;
   our chevron hugs the label. Width follows the content. */
function PillSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none cursor-pointer text-xs font-semibold rounded-full bg-secondary border border-border pl-3.5 pr-8 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {children}
      </select>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
        className="pointer-events-none absolute right-3 text-muted-foreground">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border p-3 text-center",
      highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"
    )}>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

/* v23 DD (Lee): the score reads 0–10 and turns red → yellow → green, right on the row.
   (Stored 0–100 from vaia-event-intelligence; displayed on Lee's 10-point scale.) */
export function fitTen(score: number) { return Math.max(0, Math.min(10, Math.round(score / 10))); }
function FitBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0">
        <Clock className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }
  const ten = fitTen(score);
  const color =
    ten >= 7 ? "bg-green-500/15 border-green-500/40 text-green-600 dark:text-green-400" :
    ten >= 4 ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-600 dark:text-yellow-400" :
    "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400";
  return (
    <div className={cn("w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0", color)}>
      <span className="text-base font-bold leading-none">{ten}<span className="text-[9px] font-semibold opacity-70">/10</span></span>
      <span className="text-[8px] uppercase opacity-70 mt-0.5">fit</span>
    </div>
  );
}

/* v31 (Lee): the status chip was eating half the row — it now wraps into a compact
   two-line chip (max ~84px) so the applicant's NAME gets the space. One chip, one status. */
function ApprovalPill({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string; Icon: any }> = {
    approved: { label: "Approved", cls: "bg-primary/15 text-primary border-primary/30", Icon: CheckCircle2 },
    auto_approved: { label: "Auto-approved", cls: "bg-primary/15 text-primary border-primary/30", Icon: CheckCircle2 },
    pending: { label: "Pending review", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30", Icon: Clock },
    rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: X },
  };
  const c = config[status] || config.pending;
  const I = c.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 max-w-[84px] shrink-0 text-[9.5px] font-semibold leading-[1.15]", c.cls)}>
      <I className="w-2.5 h-2.5 shrink-0" />
      <span className="whitespace-normal text-left">{c.label}</span>
    </span>
  );
}
