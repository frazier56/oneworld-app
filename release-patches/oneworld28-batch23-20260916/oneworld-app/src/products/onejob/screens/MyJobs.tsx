import { ScreenHeading } from "@oneworld/shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@job/lib/query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n } from "@job/lib/i18n";
import { GlassSelect } from "@job/components/Pickers";
import SearchBar from "@job/components/SearchBar";
import JobDetailModal, { type JobItem } from "@job/components/JobDetailModal";
import { timeLeft } from "@job/lib/acceptWindow";
import { fetchPendingAgreements, fetchActiveExecutions, acceptAgreement, declineAgreement, markComplete, rolesOf, type Agreement, type Execution } from "@job/lib/jobloop";
import ReviewModal from "@job/components/ReviewModal";
import { IconToolbox, IconCalendar, IconPin } from "@job/components/ActionIcons";

/** My Jobs (Lee, Jul 24): horizontal filter tabs + a clickable KPI strip at the top,
 *  every job carries a status tag, tap any card into the rich detail (swipe prev/next).
 *  Filters map to real data: Pending (sent/received contracts), Active (scheduled/in-progress),
 *  Completed (finished/cancelled), Declined, Drafts. Metrics dashboard lives HERE, not Start-a-job.
 *  NOTE: "Disputed" is intentionally omitted — no dispute state exists in the data model yet. */
type Filter = "all" | "pending" | "active" | "completed" | "declined" | "drafts" | "recurring";
type SortKey = "recent" | "oldest" | "amount" | "amountLow";

export default function MyJobs({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  /**
   * WHICH SIDE OF THE MONEY WERE YOU ON.
   *
   * Lee, 1 Aug 2026: *"can you filter on what position you were in — were you a professional, or
   * were you the hirer? I don't think we have that filter, and we should, because that's where all
   * the jobs are."*
   *
   * It's the one cut the status tabs can't make. "Completed" mixes the two jobs you were paid for
   * with the two you paid for, and those are different questions: one is your track record, the
   * other is your spend. It's also what makes the profile's "Hires made" number clickable — that
   * count has no destination without this.
   *
   * Deliberately a SECOND axis rather than more status chips. Seven status tabs times two roles is
   * fourteen chips; a status tab plus a role switch is seven plus two, and either can be "all".
   * Reads off `youAre`, which comes from payer_id/payee_id — never sender/recipient, which invert
   * on any contract the professional started.
   */
  const [role, setRole] = useState<"all" | "hiring" | "working">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [cycleBusy, setCycleBusy] = useState<string | null>(null);

  /* ─────────────────────────────────────────────────────────────────────────
     ACCEPT / DECLINE / MARK-COMPLETE — the actions that actually move a job
     through its lifecycle and release the held payment.
     UAT Jul 25 2026: these buttons existed ONLY in `components/ContractsAndJobs.tsx`,
     which nothing imported. So no contract could ever be accepted, no job_executions
     row was ever created, capture-contract-payment was never called, the payment was never
     released, and Active/Completed/Reviews were structurally empty. They live here now,
     on the cards the user actually looks at.
     ───────────────────────────────────────────────────────────────────────── */
  /**
   * A COUNTDOWN THAT DOESN'T TICK IS A LIE THAT GETS WORSE EVERY MINUTE.
   *
   * `timeLeft()` is a pure function evaluated during render, and nothing re-rendered this page — no
   * refetchInterval, no timer. Leave My Jobs open on "⏳ 1h 5m left" and it still says 1h 5m an hour
   * later, while the Accept button below it stays live long past the deadline. One cheap tick per
   * 30 seconds re-renders the clocks and re-evaluates the expiry guards with them. (UAT Jul 26 2026)
   */
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const [actBusy, setActBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState<string>("");
  const [actNote, setActNote] = useState<string>("");
  const [review, setReview] = useState<{ executionId: string; revieweeId: string; revieweeIsHost: boolean; jobTitle: string } | null>(null);

  const refreshJobs = () => {
    qc.invalidateQueries({ queryKey: ["agreements-pending", user?.id] });
    qc.invalidateQueries({ queryKey: ["executions-active", user?.id] });
    qc.invalidateQueries({ queryKey: ["past-jobs", user?.id] });
    qc.invalidateQueries({ queryKey: ["my-declined", user?.id] });
    qc.invalidateQueries({ queryKey: ["agreements-pending"] });
  };

  const onAccept = async (a: Agreement) => {
    if (actBusy || !user) return;
    setActBusy(`ag-${a.id}`); setActErr(""); setActNote("");
    try {
      const r = await acceptAgreement(a, user.id);
      // An expired hold means the payee would be working for free — say so instead of "accepted".
      if (!r.ok) { setActErr(r.error || "Couldn't accept that contract. Try again."); setActBusy(null); return; }
      setActNote(
        r.captured
          ? "Contract accepted — the payment is now in the OneJob Vault until you both mark the job complete."
          : r.external
            // `external` covers two different situations, and they must not share a sentence: a
            // free promo contract (FOUNDERFREE) has nothing to collect, while a genuinely
            // off-platform one means the two of them settle up privately.
            ? (a.payment_rail === "promo"
                ? "Contract accepted — this one's free, so there's nothing to collect."
                : "Contract accepted — you two are settling payment outside OneJob.")
            : "Contract accepted — the job is scheduled.",
      );
      refreshJobs();
    }
    catch (e: any) { setActErr(e?.message || "Couldn't accept that contract. Try again."); }
    setActBusy(null);
  };

  const onDecline = async (a: Agreement) => {
    if (actBusy || !user) return;
    setActBusy(`ag-${a.id}`); setActErr(""); setActNote("");
    try {
      const r = await declineAgreement(a, user.id);
      // Never silently imply the money moved — say exactly what happened to the hold.
      if (r.released) setActNote("Declined. The card hold has been released.");
      else { setActNote("Declined."); if (r.error) setActErr(r.error); }
      refreshJobs();
    } catch (e: any) { setActErr(e?.message || "Couldn't decline that contract. Try again."); }
    setActBusy(null);
  };

  const onMarkComplete = async (e: Execution) => {
    if (actBusy || !user) return;
    setActBusy(`ex-${e.id}`); setActErr(""); setActNote("");
    try {
      const r = await markComplete(e, user.id);
      if (r.error) setActErr(r.error);
      if (!r.both) setActNote("Marked complete — waiting on the other side to confirm before the money is released.");
      else {
        setActNote(r.external ? "Job complete. This one was paid outside OneJob, so there's nothing to release."
          // `released` not `captured`: captured only means the charge cleared into OneJob's balance.
          // Saying "released" when the transfer never happened told a payer they'd paid a pro who
          // had received nothing. (UAT Jul 26 2026)
          : r.released ? "Job complete — the payment has been released to the professional. 🎉"
          : r.captured
            ? (r.blockedReason === "payouts_not_enabled"
                ? "Job complete. The payment is in the OneJob Vault and will reach the professional automatically as soon as their payout account is verified."
                : r.blockedReason === "zero_share"
                  ? "Job complete. This contract was fully discounted, so there's no payment to release."
                  : "Job complete. The payment is in the OneJob Vault — we're completing the transfer to the professional and will keep trying.")
          : "Job complete. We're releasing the payment.");
        const isHost = e.host_id === user.id;
        setReview({
          executionId: e.id,
          revieweeId: isHost ? e.talent_id : e.host_id,
          revieweeIsHost: !isHost,
          jobTitle: e.agreement?.title ?? "the job",
        });
      }
      refreshJobs();
    } catch (err: any) { setActErr(err?.message || "Couldn't mark that complete. Try again."); }
    setActBusy(null);
  };

  // Drag-to-reorder the filter chips (press-and-hold, persisted). Lee, Jul 24.
  const [order, setOrder] = useState<Filter[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("myjobs-tab-order") || "null");
      if (Array.isArray(raw)) {
        const valid = raw.filter((x: any): x is Filter => DEFAULT_TAB_ORDER.includes(x));
        return [...valid, ...DEFAULT_TAB_ORDER.filter(x => !valid.includes(x))];
      }
    } catch { /* ignore bad storage */ }
    return DEFAULT_TAB_ORDER;
  });
  const [dragId, setDragId] = useState<Filter | null>(null);
  const dragRef = useRef<Filter | null>(null);
  const holdT = useRef<any>(null);
  const dragged = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);

  /**
   * TAP vs DRAG — rewritten 29 Jul 2026 because the chips could swallow a tap.
   *
   * The old version decided "was that a tap?" inside onClick by reading a `dragged` ref, and
   * cancelled the press-and-hold timer on ANY pointermove. Both are fragile:
   *   • a pointermove of 1px — which every touch device emits on a normal tap, and which a mouse
   *     emits just from the cursor settling — killed the hold timer;
   *   • the tap/drag verdict lived in a mutable ref read by a LATER event, so any path where the
   *     click didn't fire (drag released off-chip, pointercancel from a scroll gesture, the OS
   *     stealing the gesture) left the ref stale and ate the next interaction.
   *
   * Now: remember where the pointer went down, treat movement under SLOP as noise, and COMMIT THE
   * FILTER ON pointerup — the same event that ends the gesture, so there is no second event to
   * miss. onClick is gone entirely, which also removes the 300ms tap delay on touch.
   */
  const SLOP = 8; // px of finger/mouse jitter that still counts as a tap
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const startHold = (id: Filter, x: number, y: number) => {
    dragged.current = false;
    downAt.current = { x, y };
    holdT.current = setTimeout(() => {
      dragRef.current = id; setDragId(id);
      try { (navigator as any).vibrate?.(12); } catch { /* no haptics */ }
    }, 280);
  };
  const cancelHoldIfMoving = (x: number, y: number) => {
    if (dragRef.current || !holdT.current || !downAt.current) return;
    const dx = x - downAt.current.x, dy = y - downAt.current.y;
    if (Math.hypot(dx, dy) < SLOP) return;      // jitter, not a drag — keep the hold alive
    clearTimeout(holdT.current); holdT.current = null;
    dragged.current = true;                      // a real swipe: this is a scroll, not a tap
  };
  const moveHold = (clientX: number) => {
    if (!dragRef.current || !rowRef.current) return;
    dragged.current = true;
    const chips = Array.from(rowRef.current.querySelectorAll<HTMLElement>("[data-chip]"));
    let target = chips.length - 1;
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) { target = i; break; }
    }
    const from = order.indexOf(dragRef.current);
    if (from < 0 || from === target) return;
    const next = [...order]; next.splice(from, 1); next.splice(target, 0, dragRef.current);
    setOrder(next);
  };
  /** Ends the gesture. `tapId` is passed only from a chip's own pointerup, so a release that
   *  happens off the chip (or on the window listener during a drag) can never select a filter. */
  const endHold = (tapId?: Filter) => {
    if (holdT.current) { clearTimeout(holdT.current); holdT.current = null; }
    const wasDragging = !!dragRef.current;
    if (wasDragging) { try { localStorage.setItem("myjobs-tab-order", JSON.stringify(order)); } catch { /* ignore */ } }
    dragRef.current = null; setDragId(null); downAt.current = null;
    // A tap is: released on the chip it started on, never dragged, never reordered.
    if (tapId && !wasDragging && !dragged.current) setFilter(tapId);
    dragged.current = false;
  };
  useEffect(() => {
    if (!dragId) return;
    const mv = (e: PointerEvent) => { e.preventDefault(); moveHold(e.clientX); };
    const up = () => endHold();
    window.addEventListener("pointermove", mv, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragId, order]);

  // Shared query keys with ContractsAndJobs → one fetch, cached.
  const { data: pending } = useQuery({ queryKey: ["agreements-pending", user?.id], enabled: !!user, queryFn: () => fetchPendingAgreements(user!.id) });
  const { data: active } = useQuery({ queryKey: ["executions-active", user?.id], enabled: !!user, queryFn: () => fetchActiveExecutions(user!.id) });

  const { data: past } = useQuery({
    queryKey: ["past-jobs", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: ex } = await supabase.from("job_executions")
        .select("id, agreement_id, host_id, talent_id, scheduled_start, status, completed_at")
        .or(`host_id.eq.${user!.id},talent_id.eq.${user!.id}`)
        .in("status", ["completed", "cancelled"])
        .order("scheduled_start", { ascending: false }).limit(50);
      const ids = (ex ?? []).map(e => e.agreement_id).filter(Boolean);
      let ags: any[] = [];
      if (ids.length) { const { data } = await supabase.from("agreements").select("id, title, description, payment_amount, platform_fee, currency, start_date, end_date, start_time, end_time, location, is_recurring, created_at, updated_at, accept_window_hours, accept_deadline, sent_at, authorized_at, accepted_at, captured_at, payee_done_at, payer_done_at, released_at, paid_out_at, expired_at, payout_arrival_date, payout_status, payout_failure_message, payment_rail, payment_status, sender_id, recipient_id, payer_id, payee_id").in("id", ids); ags = data ?? []; }
      const map = Object.fromEntries(ags.map(a => [a.id, a]));
      return (ex ?? []).map(e => ({ ...e, agreement: e.agreement_id ? map[e.agreement_id] : null }));
    },
  });

  /* ── Hidden agreements ────────────────────────────────────────────────────────────────
     Ported back from production 1 Aug 2026 — the rebuild had branched before this shipped, so a
     draft you no longer wanted was stuck on your list forever.

     `hide_agreement` does NOT delete the row. Agreements carry money history (authorisations,
     captures, transfers), so nothing here is ever hard-deleted — it is marked hidden for THIS
     user and filtered out. The copy says "delete" because that is what the user means; the
     database keeps the record because that is what an audit needs. */
  const { data: hiddenIds } = useQuery({
    queryKey: ["agreement-hidden", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("agreement_hidden").select("agreement_id");
      return new Set((data ?? []).map((r: any) => r.agreement_id as string));
    },
  });
  const [askDelete, setAskDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  // Drafts = agreements I saved with status "draft" (ContractForm autosaves these).
  const { data: drafts } = useQuery({
    queryKey: ["my-drafts", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("agreements")
        .select("id, title, description, payment_amount, currency, start_date, end_date, start_time, end_time, location, is_recurring, created_at, updated_at")
        .eq("sender_id", user!.id).eq("status", "draft")
        .order("updated_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // Declined = agreements (either side) that were turned down.
  const { data: declined } = useQuery({
    queryKey: ["my-declined", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("agreements")
        .select("id, title, description, payment_amount, currency, start_date, end_date, start_time, end_time, location, is_recurring, sender_id, recipient_id, payer_id, payee_id, created_at, updated_at")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`).in("status", ["declined", "expired"])
        .order("updated_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // Recurring-payment contracts (with their per-cycle ledger).
  const { data: recurring } = useQuery({
    queryKey: ["my-recurring", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("agreements")
        .select("id, title, payment_amount, currency, start_date, recurrence, status, payer_id, payee_id, sender_id, recipient_id")
        .eq("is_recurring", true)
        .or(`payer_id.eq.${user!.id},payee_id.eq.${user!.id},sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .not("status", "in", "(draft,declined,cancelled)")
        .order("updated_at", { ascending: false }).limit(50);
      const rows = (data ?? []).filter((a: any) => a.recurrence?.payments);
      const ids = rows.map((r: any) => r.id);
      const byAg: Record<string, any[]> = {};
      if (ids.length) {
        const { data: cy } = await supabase.from("agreement_cycles").select("*").in("agreement_id", ids).order("cycle_index", { ascending: true });
        for (const c of cy ?? []) (byAg[c.agreement_id] ??= []).push(c);
      }
      return rows.map((r: any) => ({ ...r, cycles: byAg[r.id] ?? [] }));
    },
  });

  // Mark one cycle complete (my side). complete-cycle captures + pays out once both sides mark it.
  const markCycle = async (cycleId: string) => {
    setCycleBusy(cycleId);
    try { await supabase.functions.invoke("complete-cycle", { body: { cycleId } }); }
    finally { setCycleBusy(null); qc.invalidateQueries({ queryKey: ["my-recurring", user?.id] }); }
  };
  /**
   * Pause / resume a recurring contract — THE PAYER'S CONTROL, AND ONLY THE PAYER'S.
   *
   * Resuming is a money act: `recurring-engine` skips a contract while `recurrence.paused` is
   * true, so clearing that flag puts the payer's saved card back in the daily billing run. The
   * button below is already payer-only; this second check exists because a guard that lives only
   * in a render condition is one refactor away from being gone, and because the SERVER does not
   * enforce it (see below).
   *
   * ✅ THE SERVER SIDE IS CLOSED TOO, 9 Aug 2026. `agreements.recurrence` was not in
   * `guard_agreement_money_columns`' frozen list and the table's UPDATE policy is a PARTY check
   * (`sender OR recipient OR payer OR payee`), so a PAYEE calling PostgREST directly could clear
   * `paused` and put the payer's card back in the next daily billing run. Migration
   * `guard_agreement_recurrence_accept_window_and_price` now refuses that — proven with an
   * adversarial probe: the payee is refused, the payer still works, and a professional can still
   * build a recurring draft. See `MONEY_GUARD_PATCH_recurrence_2026-08-09.sql` for the record.
   */
  const togglePause = async (a: any) => {
    const payer = a.payer_id ?? a.sender_id ?? null;
    if (!user || payer !== user.id) return;   // only the person paying may pause or resume
    const rec = { ...(a.recurrence || {}), paused: !a.recurrence?.paused };
    const { error } = await supabase.from("agreements").update({ recurrence: rec }).eq("id", a.id);
    /* The server's own words, never a friendly catch-all. */
    if (error) { console.warn("[onejob] pause/resume failed:", error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-recurring", user?.id] });
  };
  // Duplicate a completed contract into a fresh draft (completed contracts stay immutable).
  const duplicateContract = async (agreementId: string) => {
    const { data: a } = await supabase.from("agreements").select("*").eq("id", agreementId).single();
    if (!a || !user) return;
    const clone: any = {
      sender_id: user.id, recipient_id: null,
      payer_id: a.payer_id === user.id ? user.id : null,
      payee_id: a.payee_id === user.id ? user.id : null,
      title: a.title, description: a.description,
      compensation: a.compensation, compensation_type: a.compensation_type,
      payment_amount: a.payment_amount, payment_rail: a.payment_rail,
      start_date: a.start_date, end_date: a.end_date, start_time: a.start_time, end_time: a.end_time,
      is_recurring: a.is_recurring, recurrence: a.recurrence ? { ...a.recurrence, paused: false } : null,
      location: a.location, location_place: a.location_place, attachment_url: a.attachment_url,
      status: "draft", payment_status: "pending",
    };
    const { data: ins } = await supabase.from("agreements").insert(clone).select("id").single();
    if (ins?.id) nav(`/jobs/qr?draft=${ins.id}`);
  };

  // counterparty names
  const otherIds = useMemo(() => {
    const s = new Set<string>();
    (pending ?? []).forEach(a => { s.add(a.sender_id); s.add(a.recipient_id); });
    (active ?? []).forEach(e => { s.add(e.host_id); s.add(e.talent_id); });
    (past ?? []).forEach(e => { s.add(e.host_id); s.add(e.talent_id); });
    (declined ?? []).forEach((a: any) => { s.add(a.sender_id); s.add(a.recipient_id); });
    if (user) s.delete(user.id);
    return [...s].filter(Boolean).sort();
  }, [pending, active, past, declined, user?.id]);

  const { data: names } = useQuery({
    queryKey: ["job-names", otherIds.join(",")], enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", otherIds);
      return Object.fromEntries((data ?? []).map(p => [p.id, p.full_name ?? "—"])) as Record<string, string>;
    },
  });
  const nameOf = (id: string) => names?.[id] ?? "—";
  /** "You" when it's the viewer, their name otherwise, and nothing at all when the id is missing —
   *  an execution can outlive the agreement row it came from. */
  const sideName = (id?: string | null) => (id ? (id === user?.id ? "You" : nameOf(id)) : null);

  const fmtD = (s?: string | null) => s ? new Date(s).toLocaleDateString(lang === "es" ? "es" : "en", { month: "short", day: "numeric", year: "numeric" }) : "";
  const fmtDT = (s?: string | null) => s ? new Date(s).toLocaleString(lang === "es" ? "es" : "en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  type Cat = "pending" | "active" | "completed";
  type Row = JobItem & { cat: Cat };

  // ordered list feeding the detail modal's prev/next + the card list
  const rows = useMemo<Row[]>(() => {
    if (!user) return [];
    const out: Row[] = [];
    (pending ?? []).forEach(a => {
      // Money role comes from payer_id/payee_id, NOT sender/recipient — those invert on
      // payee-initiated contracts and would show "You pay" to the person getting paid.
      const { payer } = rolesOf(a as any);
      const iAmPayer = payer === user.id;
      const iAmRecipient = a.recipient_id === user.id;
      const otherId = iAmRecipient ? a.sender_id : a.recipient_id;
      out.push({
        cat: "pending", key: `ag-${a.id}`, section: "pending", statusTone: "amber",
        statusLabel: iAmRecipient ? t("statusAwaitingYou") : t("statusAwaitingThem"),
        title: a.title ?? "—", amount: a.payment_amount ?? null,
        amountLabel: iAmPayer ? t("youPay") : t("youEarn"),
        dateText: draftWhen(a) || fmtD(a.start_date), description: a.description ?? null,
        withName: nameOf(otherId), withRole: iAmPayer ? t("rolePro") : t("roleHost"),
        currency: a.currency ?? "USD", location: a.location ?? null,
        createdAt: a.created_at ?? null, updatedAt: a.updated_at ?? null,
        counterRole: iAmPayer ? "Payee" : "Payer",
        // Only the RECIPIENT of a contract accepts or declines it — you can't accept your own.
        canRespond: iAmRecipient, raw: a,
        money: a, youAre: iAmPayer ? "payer" : "payee",
        payerName: iAmPayer ? "You" : (payer ? nameOf(payer) : "—"), payeeName: iAmPayer ? nameOf(otherId) : "You",
        // Sent/accepted are SENDER and RECIPIENT acts, not payer/payee ones — those two pairs come
        // apart on any contract the professional initiated.
        senderName: a.sender_id === user.id ? "You" : nameOf(a.sender_id),
        recipientName: a.recipient_id === user.id ? "You" : nameOf(a.recipient_id),
      } as any);
    });
    (active ?? []).forEach(e => {
      const isHost = e.host_id === user.id; // host_id = the PAYER (see rolesOf)
      const otherId = isHost ? e.talent_id : e.host_id;
      const mine = isHost ? e.host_completed : e.talent_completed;
      out.push({
        cat: "active", key: `ex-${e.id}`, section: "active", statusTone: "teal",
        statusLabel: mine ? "Waiting on them" : t("activeJob"),
        title: e.agreement?.title ?? t("activeJob"), amount: e.agreement?.payment_amount ?? null,
        amountLabel: isHost ? t("youPay") : t("youEarn"),
        dateText: draftWhen(e.agreement) || fmtDT(e.scheduled_start), description: e.agreement?.description ?? null,
        withName: nameOf(otherId), withRole: isHost ? t("rolePro") : t("roleHost"),
        currency: e.agreement?.currency ?? "USD", location: e.agreement?.location ?? null,
        createdAt: e.agreement?.created_at ?? null, updatedAt: e.agreement?.updated_at ?? null,
        counterRole: isHost ? "Payee" : "Payer",
        canComplete: !mine, rawExec: e, executionId: e.id,
        money: e.agreement ?? null, youAre: isHost ? "payer" : "payee",
        payerName: isHost ? "You" : nameOf(e.host_id), payeeName: isHost ? nameOf(e.talent_id) : "You",
        senderName: sideName(e.agreement?.sender_id),
        recipientName: sideName(e.agreement?.recipient_id),
      } as any);
    });
    (past ?? []).forEach(e => {
      const isHost = e.host_id === user.id;
      const otherId = isHost ? e.talent_id : e.host_id;
      const done = e.status === "completed";
      out.push({
        cat: "completed", key: `px-${e.id}`, section: "past", statusTone: done ? "teal" : "red",
        statusLabel: `${done ? "✓ Completed" : "✕ Cancelled"}`,
        title: e.agreement?.title ?? t("activeJob"), amount: e.agreement?.payment_amount ?? null,
        amountLabel: isHost ? t("paid") : t("earned"),
        dateText: draftWhen(e.agreement) || fmtD(e.scheduled_start), description: e.agreement?.description ?? null,
        withName: nameOf(otherId), withRole: isHost ? t("rolePro") : t("roleHost"),
        currency: e.agreement?.currency ?? "USD", location: e.agreement?.location ?? null,
        createdAt: e.agreement?.created_at ?? null, updatedAt: e.agreement?.updated_at ?? null,
        counterRole: isHost ? "Payee" : "Payer",
        agreementId: e.agreement_id ?? undefined,
        /* Reviews hang off the EXECUTION, not the agreement — a recurring contract can produce
           several executions and each is reviewed on its own. */
        executionId: e.id,
        money: e.agreement ?? null, youAre: isHost ? "payer" : "payee",
        payerName: isHost ? "You" : nameOf(e.host_id), payeeName: isHost ? nameOf(e.talent_id) : "You",
        senderName: sideName(e.agreement?.sender_id),
        recipientName: sideName(e.agreement?.recipient_id),
      } as any);
    });
    return out;
  }, [pending, active, past, names, user?.id, lang]);

  const counts = {
    pending: pending?.length ?? 0,
    active: active?.length ?? 0,
    completed: past?.length ?? 0,
    declined: declined?.length ?? 0,
    drafts: drafts?.length ?? 0,
    recurring: recurring?.length ?? 0,
  };

  /**
   * SEARCH AND SORT (Lee, Jul 31 2026)
   *
   * "What if you've got 35 contracts and they're in the completed folder? Maybe we give them some
   * parameters — do you want to search all boxes, or just completed?"
   *
   * I went the other way on the parameters, deliberately. The filter chips ARE the scope: whatever
   * box you're standing in is what you search. A second scope control would mean answering the same
   * question twice — once by picking a chip, once in a popup — before typing a single letter, and
   * the popup would appear every time even though the common case is "search what I'm looking at".
   *
   * The failure that picker was meant to prevent — searching Completed for something that's in
   * Drafts and seeing an empty screen — is handled after the fact instead: if a search comes up
   * empty here but matches elsewhere, the empty state says where the matches are and takes you
   * there in one tap. Zero cost when you're right, one tap when you're wrong, versus a modal every
   * single time.
   *
   * Matching covers title, the other person's name, the description and the location: Lee asked for
   * "the name of the contract, the name of a person or whatever", and location is what you actually
   * reach for when you can't remember either.
   */
  const matches = (r: Row, needle: string) => {
    if (!needle) return true;
    const hay = [r.title, r.withName, r.description, (r as any).location, r.dateText]
      .filter(Boolean).join(" ").toLowerCase();
    return needle.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  };

  /** Money sorts on the real number, never the formatted string — "$1,000" sorts below "$9" as text. */
  const sortRows = (list: Row[]) => {
    const by = [...list];
    if (sort === "amount") return by.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1));
    if (sort === "amountLow") return by.sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity));
    const t = (r: Row) => new Date((r as any).updatedAt || (r as any).createdAt || 0).getTime();
    if (sort === "oldest") return by.sort((a, b) => t(a) - t(b));
    return by.sort((a, b) => t(b) - t(a));
  };

  const scopedRows = useMemo(() => {
    const byStatus =
      filter === "all" ? rows
      : (filter === "pending" || filter === "active" || filter === "completed") ? rows.filter(r => r.cat === filter)
      : [];
    if (role === "all") return byStatus;
    // "hiring" = you were the payer. "working" = you were the payee.
    return byStatus.filter(r => (r as any).youAre === (role === "hiring" ? "payer" : "payee"));
  }, [rows, filter, role]);

  const visibleRows = useMemo(
    () => sortRows(scopedRows.filter(r => matches(r, q.trim()))),
    [scopedRows, q, sort],
  );

  /** When the current box comes up empty, where ELSE does this search hit? */
  const elsewhere = useMemo(() => {
    const needle = q.trim();
    if (!needle || visibleRows.length) return null;
    const inRows = rows.filter(r => matches(r, needle));
    const draftHits = (drafts ?? []).filter((a: any) =>
      [a.title, plainText(a.description), a.location].filter(Boolean).join(" ").toLowerCase().includes(needle.toLowerCase())).length;
    const buckets: { f: Filter; label: string; n: number }[] = [
      { f: "pending", label: "Pending", n: inRows.filter(r => r.cat === "pending").length },
      { f: "active", label: "Active", n: inRows.filter(r => r.cat === "active").length },
      { f: "completed", label: "Completed", n: inRows.filter(r => r.cat === "completed").length },
      { f: "drafts", label: "Drafts", n: draftHits },
    ].filter((b): b is { f: Filter; label: string; n: number } => b.n > 0 && b.f !== filter);
    return buckets.length ? buckets : null;
  }, [q, visibleRows.length, rows, drafts, filter]);

  const openByKey = (key: string) => {
    const i = visibleRows.findIndex(it => it.key === key);
    if (i >= 0) setDetailIdx(i);
  };

  /**
   * DEEP LINK FROM A NOTIFICATION: /jobs/jobs?c=<agreement id> must OPEN that contract.
   *
   * Every "Contract accepted ✅" and "Job marked complete ✔️" notification has been sending that
   * URL since the notifications were written — and NOTHING in the app read the `c` param. The tap
   * landed on the generic My Jobs list on the "All" tab, with no indication which contract it was
   * about. (Lee, Jul 28 2026: "it took me to the right page…")
   *
   * Fires once. `filter` is forced to "all" first because detailIdx indexes visibleRows, and on
   * any other tab the row may be filtered out from under the modal. The param is stripped
   * afterwards so a back-navigation or reload doesn't re-open the sheet on top of the user.
   */
  const [sp, setSp] = useSearchParams();

  /* Deep links from the profile's three stat cards: ?tab=completed&role=hiring etc.
     Read ONCE on mount — re-reading would fight the user the moment they touch a chip.

     EMBEDDED MODE MUST NOT TOUCH THE URL. Lee, 2 Aug 2026: *"the last toggle on the right is
     my jobs. That toggle does not work right now… you can also get to my jobs from the create
     a job screen, the middle button, and it works fine there."*

     That difference is the whole tell. Standalone worked; embedded did not. The Jobs screen
     keeps its segmented control in `?tab=` (pros | find | me), and this component — mounted
     INSIDE that screen — also read `?tab=`, failed to match any of its own filters, and then
     deleted the param anyway. Deleting it flipped the parent straight back to its default
     tab, so "My jobs" rendered for a frame and snapped away.

     A child that rewrites its parent's routing state is the bug, not the toggle. Embedded,
     this component owns no URL state at all. */
  const paramsApplied = useRef(false);
  useEffect(() => {
    if (embedded) return;
    if (paramsApplied.current) return;
    const tab = sp.get("tab"); const r = sp.get("role");
    if (!tab && !r) return;
    paramsApplied.current = true;
    if (tab === "pending" || tab === "active" || tab === "completed" || tab === "drafts"
        || tab === "declined" || tab === "recurring" || tab === "all") setFilter(tab as Filter);
    if (r === "hiring" || r === "working" || r === "all") setRole(r);
    const next = new URLSearchParams(sp);
    next.delete("tab"); next.delete("role");
    setSp(next, { replace: true });
  }, [sp, embedded]);

  const deepLinked = useRef(false);
  useEffect(() => {
    if (embedded) return;                 // same reason as above — no URL writes from a child
    const c = sp.get("c");
    if (!c || deepLinked.current || !rows.length) return;
    const i = rows.findIndex((r: any) => r.raw?.id === c || r.rawExec?.agreement_id === c || r.agreementId === c);
    if (i < 0) return;
    deepLinked.current = true;
    setFilter("all");
    setDetailIdx(i);
    const next = new URLSearchParams(sp);
    next.delete("c");
    setSp(next, { replace: true });
  }, [sp, rows]);

  const toneClass = (tone?: string) =>
    tone === "teal" ? "bg-brand/10 text-brand"
      : tone === "amber" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : tone === "red" ? "bg-red-500/10 text-red-500"
      : "bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-white/60";

  const TAB_MAP: Record<Filter, { label: string; count?: number }> = {
    all: { label: "All" },
    pending: { label: "Pending", count: counts.pending },
    active: { label: "Active", count: counts.active },
    completed: { label: "Completed", count: counts.completed },
    recurring: { label: "Recurring", count: counts.recurring },
    declined: { label: "Declined", count: counts.declined },
    drafts: { label: "Drafts", count: counts.drafts },
  };

  const Kpi = ({ label, value, f, tone }: { label: string; value: number; f: Filter; tone: string }) => (
    <button onClick={() => setFilter(f)}
      className={`card flex min-w-0 flex-1 flex-col items-center px-1 py-3 transition active:scale-[.97] ${filter === f ? "ring-2 ring-brand/50" : ""}`}>
      <span className={`text-xl font-extrabold ${tone}`}>{value}</span>
      <span className="mt-0.5 text-[11px] font-semibold opacity-55">{label}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* No back link. In the 5-Aug build My jobs was reached from a profile tile, so "‹ Home"
          was the way out. It is FOOTER TAB TWO now — you are not deeper than anywhere else, and
          no sibling product puts a back control on a tab. (9 Aug visual pass.) */}
      {!embedded && (
        /* VAIA's pill is shell chrome (AppShell renders it) — a second one here made two. */
        <ScreenHeading icon={<IconToolbox size={24} className="text-brand-deep dark:text-brand-light" />}>{t("myJobs")}</ScreenHeading>
      )}

      {/* KPI dashboard — clickable, drives the filter */}
      <div className="flex gap-2">
        <Kpi label="Pending" value={counts.pending} f="pending" tone="text-amber-500" />
        <Kpi label="Active" value={counts.active} f="active" tone="text-brand" />
        <Kpi label="Completed" value={counts.completed} f="completed" tone="text-brand" />
        <Kpi label="Drafts" value={counts.drafts} f="drafts" tone="opacity-70" />
      </div>

      {/* ── Search + sort ──────────────────────────────────────────────────────────────
          Between the counts and the chips, which is where Lee put it and where it belongs: the
          tiles tell you HOW MANY you have, the chips narrow to a kind, and search is how you get
          to one specific thing. It reads top to bottom as "how many → which kind → which one".

          The sort control only appears once there is enough to sort. Three contracts don't need
          an ordering menu, and a permanent dropdown next to a two-item list is just clutter. */}
      <SearchBar
        value={q} onChange={setQ}
        placeholder="Search jobs, people, places…"
        /* My Jobs has no location filter, so sort takes the paired slot. Same shape as the other
           two screens: search left, one control right. */
        primary={rows.length + (drafts?.length ?? 0) > 3 ? (
          <GlassSelect
            value={sort} onChange={v => setSort(v as SortKey)}
            className="w-full !py-2.5 text-sm"
            options={[
              { value: "recent", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "amount", label: "$ High–low" },
              { value: "amountLow", label: "$ Low–high" },
            ]}
          />
        ) : undefined}
      />

      {/* Horizontal filter tabs — press-and-hold a chip to drag it into a new order */}
      <div ref={rowRef}
        className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        style={{ touchAction: dragId ? "none" : "pan-x" }}>
        {order.map(id => {
          const tab = TAB_MAP[id];
          const isDrag = dragId === id;
          return (
            <button key={id} data-chip type="button"
              onPointerDown={e => startHold(id, e.clientX, e.clientY)}
              onPointerMove={e => cancelHoldIfMoving(e.clientX, e.clientY)}
              onPointerUp={() => endHold(id)}
              onPointerCancel={() => { dragged.current = true; endHold(); }}
              onLostPointerCapture={() => { if (holdT.current) { clearTimeout(holdT.current); holdT.current = null; } }}
              /* onClick is gone, so keyboard activation has to be wired explicitly. */
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilter(id); } }}
              aria-pressed={filter === id}
              className={`shrink-0 select-none rounded-full px-3.5 py-1.5 text-sm font-bold transition ${isDrag ? "scale-105 shadow-lg ring-2 ring-brand/50" : ""} ${filter === id
                /* SELECTION, not State. COLOUR_RULES v3 §5: "A selected filter chip is #0B0F1A
                   with white text. Not teal, not the product hue, not green." A filter is a
                   switch — giving it the State colour made it compete with the money actions on
                   the same screen, which on My Jobs is exactly the fight the button has to win.
                   Dark mode inverts to paper-on-ink: #0B0F1A IS the dark page, so painting the
                   SELECTED chip with it made it vanish while the unselected ones looked raised. */
                ? "bg-selection text-white shadow-sm dark:bg-paper dark:text-ink"
                : "border border-ink/10 opacity-70 dark:border-white/15"}`}>
              {tab.label}{tab.count ? <span className={`ml-1.5 ${filter === id ? "opacity-80" : "opacity-50"}`}>{tab.count}</span> : null}
            </button>
          );
        })}
      </div>

      {/* ── Which side were you on ──
          A second, narrower axis under the status chips. Kept visually quieter than them — smaller,
          no fill on the unselected states — because status is the primary cut and this is the
          qualifier. Hidden entirely when there is nothing to qualify: on an empty account it would
          be three controls filtering nothing. */}
      {rows.length > 0 && (
        <div className="flex items-center gap-1.5">
          {([
            ["all", lang === "es" ? "Todos" : "All"],
            ["hiring", lang === "es" ? "Contraté" : "I hired"],
            ["working", lang === "es" ? "Trabajé" : "I worked"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setRole(id)} aria-pressed={role === id}
              className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${role === id
                ? "bg-selection text-white dark:bg-paper dark:text-ink"
                : "border border-ink/10 opacity-60 dark:border-white/15"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Action feedback — a payments action must never look like it did nothing */}
      {(actNote || actErr) && (
        <div className="space-y-1.5">
          {actNote && (
            <div className="flex items-start justify-between gap-2 rounded-xl border border-brand/30 bg-brand/[0.08] px-3 py-2 text-xs font-semibold text-brand">
              <span>{actNote}</span>
              <button onClick={() => setActNote("")} aria-label="Dismiss" className="shrink-0 opacity-60">✕</button>
            </div>
          )}
          {actErr && (
            <div className="flex items-start justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs font-semibold text-red-500">
              <span>{actErr}</span>
              <button onClick={() => setActErr("")} aria-label="Dismiss" className="shrink-0 opacity-60">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Content: pending / active / completed rows (tap → detail) */}
      {(filter === "all" || filter === "pending" || filter === "active" || filter === "completed") && (
        visibleRows.length ? (
          <div className="space-y-2">
            {visibleRows.map(r => (
              <div key={r.key} className="space-y-1">
                <JobCard
                  tone={toneClass(r.statusTone)} label={r.statusLabel}
                  amountText={moneyFull(r.amount, r.currency)} title={r.title}
                  snippet={plainText(r.description).slice(0, 120)} when={r.dateText}
                  location={r.location} created={fmtDT(r.createdAt)} edited={r.updatedAt && r.updatedAt !== r.createdAt ? fmtDT(r.updatedAt) : ""}
                  withName={r.withName} counterRole={r.counterRole || r.withRole}
                  onClick={() => openByKey(r.key)} />

                {/* The accept clock, right where the decision is made. A pending contract is holding
                    someone's card, and `expire-stale-contracts` closes it on the deadline — so the
                    deadline belongs next to the Accept button, not buried in a detail sheet. */}
                {r.cat === "pending" && (r as any).money?.accept_deadline && (() => {
                  const left = timeLeft((r as any).money.accept_deadline);
                  if (!left) return null;
                  return (
                    <p className={`rounded-xl px-3 py-1.5 text-center text-[11px] font-bold ${
                      left.expired ? "bg-red-500/10 text-red-500"
                        : left.urgent ? "bg-amber-400/15 text-amber-600 dark:text-amber-400"
                          : "bg-ink/5 opacity-65 dark:bg-white/10"
                    }`}>
                      {left.expired ? "Time to accept has run out — closing" : `⏳ ${left.text} to accept`}
                    </p>
                  );
                })()}

                {/* Accept / Decline — only the recipient, only while pending, and only while the
                    accept window is still open. Offering Accept on an expired contract just produced
                    a server 409 and an error toast on a button that shouldn't have been there. */}
                {r.cat === "pending" && (r as any).canRespond
                  && !timeLeft((r as any).money?.accept_deadline)?.expired && (
                  <div className="flex gap-2">
                    <button disabled={actBusy === r.key} onClick={() => onAccept((r as any).raw)}
                      className="flex-1 rounded-xl bg-clay py-2 text-xs font-bold text-white transition active:scale-[.98] disabled:opacity-40">
                      {actBusy === r.key ? "…" : `✓ ${t("accept")}`}
                    </button>
                    <button disabled={actBusy === r.key} onClick={() => onDecline((r as any).raw)}
                      className="flex-1 rounded-xl border border-ink/15 py-2 text-xs font-bold transition active:scale-[.98] disabled:opacity-40 dark:border-white/20">
                      {t("decline")}
                    </button>
                  </div>
                )}

                {/* Mark complete — either side; money releases only when BOTH have marked it */}
                {r.cat === "active" && (
                  (r as any).canComplete ? (
                    <button disabled={actBusy === r.key} onClick={() => onMarkComplete((r as any).rawExec)}
                      className="w-full rounded-xl bg-clay py-2 text-xs font-bold text-white transition active:scale-[.98] disabled:opacity-40">
                      {actBusy === r.key ? "…" : "✓ Mark this job complete"}
                    </button>
                  ) : (
                    <p className="rounded-xl border border-brand/25 bg-brand/[0.06] py-2 text-center text-[11px] font-semibold text-brand">
                      You marked this complete — waiting on {r.withName} to confirm.
                    </p>
                  )
                )}

                {r.cat === "completed" && (r as any).agreementId && (
                  <button onClick={() => duplicateContract((r as any).agreementId)}
                    className="w-full rounded-xl border border-brand/30 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/5">
                    ⧉ Duplicate as new draft
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : q.trim() ? (
          /* The empty state does the work the scope picker would have done, only after the fact and
             only when it's needed. "Nothing here" is a dead end; "nothing here, 3 in Drafts" is a
             next step. (Lee, Jul 31 2026) */
          <div className="card p-6 text-center">
            <p className="text-sm font-bold">No matches for “{q.trim()}”{filter !== "all" ? ` in ${filter}` : ""}.</p>
            {elsewhere ? (
              <>
                <p className="mt-1 text-[12.5px] opacity-60">Found in other folders:</p>
                <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                  {elsewhere.map(b => (
                    <button key={b.f} onClick={() => setFilter(b.f)}
                      className="rounded-full border border-brand/35 px-3 py-1.5 text-[12.5px] font-bold text-brand transition active:scale-95 hover:bg-brand/10">
                      {b.label} ({b.n}) →
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1 text-[12.5px] opacity-60">Nothing anywhere — try fewer words.</p>
            )}
          </div>
        ) : <Empty label={filter === "all" ? "No jobs yet." : `No ${filter} jobs.`} />
      )}

      {/* Declined */}
      {filter === "declined" && (
        (declined?.length ?? 0) ? (
          <div className="space-y-2">
            {(declined as any[]).map(a => {
              const otherId = [a.sender_id, a.recipient_id].find((id: string) => id && id !== user?.id) || "";
              const counterRole = a.payer_id === user?.id ? "Payee" : a.payee_id === user?.id ? "Payer" : "";
              return (
                <JobCard key={a.id}
                  tone="bg-red-500/10 text-red-500" label="✕ Declined"
                  amountText={moneyFull(a.payment_amount, a.currency)} title={a.title ?? "—"}
                  snippet={plainText(a.description).slice(0, 120)} when={draftWhen(a) || fmtD(a.start_date)}
                  location={a.location} created={fmtDT(a.created_at)} edited={a.updated_at && a.updated_at !== a.created_at ? fmtDT(a.updated_at) : ""}
                  withName={otherId ? nameOf(otherId) : ""} counterRole={counterRole} />
              );
            })}
          </div>
        ) : <Empty label="No declined contracts." />
      )}

      {/* Recurring — contracts with recurring payments + their per-cycle ledger */}
      {filter === "recurring" && (
        (recurring?.length ?? 0) ? (
          <div className="space-y-3">
            {(recurring as any[]).map(a => {
              const iAmPayer = a.payer_id === user?.id;
              const paused = !!a.recurrence?.paused;
              const cur = a.currency || "USD";
              const money2 = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
              const cycleTone = (s: string) =>
                ["transferred", "captured", "completed"].includes(s) ? "bg-brand/10 text-brand"
                  : s === "authorized" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : ["failed", "needs_method", "abandoned"].includes(s) ? "bg-red-500/10 text-red-500"
                  : "bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-white/60";
              const cycleLabel = (s: string) =>
                s === "transferred" || s === "captured" ? "✓ Paid"
                  : s === "authorized" ? "Awaiting completion"
                  : s === "completed" ? "Completing…"
                  : s === "needs_method" ? "Needs a card — retrying"
                  : s === "failed" ? "Payment failed — retrying"
                  : s === "abandoned" ? "Stopped — update card"
                  : "Upcoming";
              return (
                <div key={a.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold leading-tight">🔁 {a.title || "Recurring contract"}</p>
                      <p className="mt-0.5 text-xs opacity-55">
                        {money2(Number(a.payment_amount))} · {a.recurrence?.freq || "weekly"} · {iAmPayer ? "you pay" : "you get paid"}
                        {a.recurrence?.trigger === "scheduled" ? " · autopay" : " · on completion"}
                      </p>
                    </div>
                    {iAmPayer && (
                      <button onClick={() => togglePause(a)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${paused ? "bg-brand/10 text-brand" : "bg-ink/5 opacity-70 dark:bg-white/10"}`}>
                        {paused ? "▶ Resume" : "⏸ Pause"}
                      </button>
                    )}
                  </div>
                  {paused && <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">Paused — no new cycles until you resume.</p>}

                  <div className="mt-3 space-y-1.5">
                    {a.cycles.length === 0 && <p className="text-xs opacity-50">No cycles yet — the first opens on {a.start_date || "the start date"}.</p>}
                    {a.cycles.map((c: any) => {
                      const mineMarked = iAmPayer ? c.payer_marked_complete : c.payee_marked_complete;
                      const open = ["authorized", "scheduled", "completed"].includes(c.status) && c.status !== "transferred";
                      const canMark = open && !mineMarked && a.recurrence?.trigger !== "scheduled";
                      return (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-ink/8 px-3 py-2 dark:border-white/10">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">Cycle {c.cycle_index} · {c.scheduled_date || "—"}</p>
                            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${cycleTone(c.status)}`}>{cycleLabel(c.status)}</span>
                            {mineMarked && open && <span className="ml-1.5 text-[10px] text-brand">✓ you marked done</span>}
                          </div>
                          {canMark
                            ? <button onClick={() => markCycle(c.id)} disabled={cycleBusy === c.id}
                                className="shrink-0 rounded-full bg-clay px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                                {cycleBusy === c.id ? "…" : "Mark complete"}
                              </button>
                            : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Empty label="No recurring contracts yet." />
      )}

      {/* Drafts */}
      {filter === "drafts" && (() => {
        // Drafts are a different shape from Row (no counterparty yet), so they match on their own
        // fields rather than going through `matches`.
        const needle = q.trim().toLowerCase();
        const filtered = (drafts as any[] ?? []).filter(a => !hiddenIds?.has(a.id)).filter(a => !needle ||
          [a.title, plainText(a.description), a.location].filter(Boolean).join(" ").toLowerCase().includes(needle));
        // Same ordering rules as the contract list — a sort control that silently ignored the
        // biggest pile on the screen would be worse than not having one.
        const dt = (a: any) => new Date(a.updated_at || a.created_at || 0).getTime();
        const list = [...filtered].sort((a, b) =>
          sort === "amount" ? (b.payment_amount ?? -1) - (a.payment_amount ?? -1)
          : sort === "amountLow" ? (a.payment_amount ?? Infinity) - (b.payment_amount ?? Infinity)
          : sort === "oldest" ? dt(a) - dt(b)
          : dt(b) - dt(a));
        return list.length ? (
          <div className="space-y-2">
            {list.map(a => {
              const snippet = plainText(a.description).slice(0, 120);
              const when = draftWhen(a);
              return (
                <button key={a.id} onClick={() => nav(`/jobs/qr?draft=${a.id}`)} className="card block w-full p-4 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-bold opacity-60 dark:bg-white/10">✎ Draft</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {a.payment_amount != null && <span className="text-sm font-bold text-brand">{moneyFull(a.payment_amount, a.currency)}</span>}
                      {/* A div, not a button — this sits inside the card's own <button>, and nesting
                          interactive elements is invalid HTML. The click is stopped so removing a
                          draft never also opens it. */}
                      <span role="button" tabIndex={0} aria-label="Delete draft"
                        onClick={e => { e.stopPropagation(); setAskDelete(a); setDeleteErr(""); }}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setAskDelete(a); setDeleteErr(""); } }}
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-full opacity-40 transition hover:bg-red-500/10 hover:text-red-500 hover:opacity-100">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />
                        </svg>
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 font-bold leading-tight">{a.title || "Untitled contract"}</p>
                  {snippet && <p className="mt-1 line-clamp-2 text-xs opacity-65">{snippet}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-70">
                    {when && <span className="inline-flex items-center gap-1"><IconCalendar size={12} />{when}</span>}
                    {a.location && <span className="inline-flex max-w-[60%] items-center gap-1 truncate"><IconPin size={12} className="shrink-0" />{a.location}</span>}
                  </div>
                  <p className="mt-2 text-[11px] opacity-40">
                    {a.created_at ? `Created ${fmtDT(a.created_at)}` : ""}
                    {a.updated_at && a.updated_at !== a.created_at ? ` · edited ${fmtDT(a.updated_at)}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        ) : q.trim() ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-bold">No drafts match “{q.trim()}”.</p>
            {elsewhere && (
              <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                {elsewhere.map(b => (
                  <button key={b.f} onClick={() => setFilter(b.f)}
                    className="rounded-full border border-brand/35 px-3 py-1.5 text-[12.5px] font-bold text-brand transition active:scale-95 hover:bg-brand/10">
                    {b.label} ({b.n}) →
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : <Empty label="No saved drafts." />;
      })()}

      {/* Delete-draft confirm. Ported from production. */}
      {askDelete && (
        <div className="fixed inset-0 z-[150] grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/55" onClick={() => { if (!deleting) { setAskDelete(null); setDeleteErr(""); } }} />
          <div className="oj-glass-modal relative w-full max-w-sm rounded-3xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">Delete this draft?</h3>
            <p className="mt-1 text-sm opacity-70">
              “{askDelete.title || "Untitled contract"}” will be removed from your list. This can’t be undone.
            </p>
            {deleteErr && (
              <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">{deleteErr}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1" disabled={deleting}
                onClick={() => { setAskDelete(null); setDeleteErr(""); }}>Cancel</button>
              <button
                className="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true); setDeleteErr("");
                  const { error } = await supabase.rpc("hide_agreement", { p_agreement_id: askDelete.id });
                  setDeleting(false);
                  if (error) { setDeleteErr(error.message || "Couldn't delete that."); return; }
                  setAskDelete(null);
                  qc.invalidateQueries({ queryKey: ["agreement-hidden", user?.id] });
                  qc.invalidateQueries({ queryKey: ["my-drafts", user?.id] });
                }}>
                {deleting ? "…" : "Delete draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailIdx != null && visibleRows[detailIdx] && (
        <JobDetailModal items={visibleRows} index={detailIdx} onIndex={setDetailIdx} onClose={() => setDetailIdx(null)}
          meId={user?.id}
          /* The durable way in to leaving a review. The old one — the sheet that appears for a
             moment after the second party marks complete — is still there, but it is a prompt, not
             a path: miss it and there was no way back from the job. (Lee, 1 Aug) */
          onLeaveReview={it => {
            const ex = (it as any).rawExec ?? (past ?? []).find(p => p.id === (it as any).executionId);
            if (!ex || !user) return;
            const isHost = ex.host_id === user.id;
            setReview({
              executionId: ex.id,
              revieweeId: isHost ? ex.talent_id : ex.host_id,
              revieweeIsHost: !isHost,
              jobTitle: it.title,
            });
          }} />
      )}

      {review && user && (
        <ReviewModal executionId={review.executionId} reviewerId={user.id} revieweeId={review.revieweeId}
          revieweeIsHost={review.revieweeIsHost} jobTitle={review.jobTitle}
          onClose={() => { setReview(null); refreshJobs(); }} />
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="card p-8 text-center text-sm opacity-50">{label}</div>;
}

const DEFAULT_TAB_ORDER: Filter[] = ["all", "pending", "active", "completed", "recurring", "declined", "drafts"];

// Currency-aware, locale-grouped, whole-dollar price with the currency code appended.
// USD 300000 → "$300,000 USD"; COP 300000 → "$300.000 COP". (Lee, Jul 24)
const CARD_CUR_LOCALE: Record<string, string> = { USD: "en-US", EUR: "de-DE", COP: "es-CO", MXN: "es-MX", BRL: "pt-BR", THB: "th-TH", INR: "en-IN", RUB: "ru-RU" };
function moneyFull(n?: number | null, cur?: string | null): string {
  if (n == null) return "";
  const c = (cur || "USD").toUpperCase();
  const loc = CARD_CUR_LOCALE[c] || "en-US";
  let s: string;
  try { s = new Intl.NumberFormat(loc, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n); }
  catch { s = `$${Math.round(n).toLocaleString("en-US")}`; }
  return `${s} ${c}`;
}

// Shared rich job card — same info density across pending / active / completed / declined.
function JobCard({ tone, label, amountText, title, snippet, when, location, created, edited, withName, counterRole, onClick }: {
  tone: string; label: string; amountText: string; title: string; snippet?: string; when?: string;
  location?: string | null; created?: string; edited?: string; withName?: string; counterRole?: string; onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{label}</span>
        {amountText && <span className="shrink-0 text-sm font-extrabold text-brand">{amountText}</span>}
      </div>
      <p className="mt-2 font-bold leading-tight">{title}</p>
      {snippet && <p className="mt-1 line-clamp-2 text-xs opacity-65">{snippet}</p>}
      {(when || location) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-70">
          {when && <span className="inline-flex items-center gap-1"><IconCalendar size={12} />{when}</span>}
          {location && <span className="inline-flex max-w-[55%] items-center gap-1 truncate"><IconPin size={12} className="shrink-0" />{location}</span>}
        </div>
      )}
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0 flex-1 text-[11px] opacity-40">
          {created ? `Created ${created}` : ""}{edited ? `${created ? " · " : ""}edited ${edited}` : ""}
        </p>
        {withName && withName !== "—" && (
          <p className="shrink-0 text-right text-[11px] leading-tight">
            {counterRole && <span className="opacity-45">{counterRole}</span>}
            <br />
            <span className="font-semibold opacity-75">{withName}</span>
          </p>
        )}
      </div>
    </>
  );
  return onClick
    ? <button onClick={onClick} className="card block w-full p-4 text-left">{body}</button>
    : <div className="card block w-full p-4">{body}</div>;
}

// Strip rich-text/HTML to a clean one-line snippet.
function plainText(s?: string | null) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
// 24h "HH:MM" → "9:00 PM"
function t12(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m || 0).padStart(2, "0")} ${ap}`;
}
// Compact schedule line for a draft card.
function draftWhen(a: any) {
  const d = (s?: string | null) => s ? new Date(s + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "";
  if (!a?.start_date) return "";
  if (a.is_recurring) return `Recurring from ${d(a.start_date)}${a.end_date ? ` to ${d(a.end_date)}` : ""}`;
  const time = a.start_time ? ` · ${t12(a.start_time)}${a.end_time ? `–${t12(a.end_time)}` : ""}` : "";
  const range = a.end_date && a.end_date !== a.start_date ? `${d(a.start_date)} → ${d(a.end_date)}` : d(a.start_date);
  return `${range}${time}`;
}
