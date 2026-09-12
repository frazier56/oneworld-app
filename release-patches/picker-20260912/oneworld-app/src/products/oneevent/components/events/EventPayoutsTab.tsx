import { useEffect, useState, useCallback, useMemo } from "react";
import { useMicro } from "@evt/i18n/LanguageContext";
import { supabase } from "@evt/integrations/supabase/client";
import { PayoutStatusCard } from "@evt/components/payouts/PayoutStatusCard";
import { CURRENCIES } from "@evt/lib/currencies";
import { getFxRates, convertCents, canConvert, type FxSnapshot } from "@evt/lib/fxRates";
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Banknote,
  CreditCard,
  ChevronDown,
  ExternalLink,
  ShieldAlert,
  XCircle,
} from "lucide-react";

interface Props {
  eventId: string;
}

interface Transaction {
  id: string;
  payment_intent: string | null;
  created_at: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
  captured: boolean;
  paid: boolean;
  refunded: boolean;
  disputed: boolean;
  dispute_status: string | null;
  failure_message: string | null;
  receipt_url: string | null;
  customer_email: string | null;
  customer_name: string | null;
  ticket_type: string | null;
  quantity: number;
  ticket_amount: number;
  platform_fee: number;
  net_to_host: number;
  stripe_fee: number | null;
  /* v20 CG: founder $1 test charges skip the Connect transfer — flagged so the row can say so. */
  founder_test?: boolean;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: string;
  created_at: string;
  method: string | null;
  type: string | null;
  description: string | null;
  failure_message: string | null;
  bank_last4: string | null;
}

interface Activity {
  event: { id: string; title: string; currency: string };
  has_connect_account: boolean;
  connect_error: string | null;
  totals: {
    gross: number;
    refunded: number;
    net_to_host: number;
    platform_fees: number;
    tickets_sold: number;
    successful: number;
    failed: number;
    refunded_count: number;
    disputed: number;
  };
  transactions: Transaction[];
  balance: { available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] } | null;
  payouts: Payout[];
}

const fmt = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const payoutTime = (p: Payout) => {
  const t = Date.parse(p.arrival_date || p.created_at || "");
  return Number.isFinite(t) ? t : 0;
};

function StatusPill({ tx }: { tx: Transaction }) {
  const m = useMicro(); // v15: StatusPill is its own component — needs its own hook

  if (tx.disputed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
        <ShieldAlert className="w-3 h-3" />{m("Disputed")}</span>
    );
  }
  if (tx.refunded || tx.amount_refunded > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <RefreshCw className="w-3 h-3" /> {tx.amount_refunded === tx.amount ? "Refunded" : "Partial refund"}
      </span>
    );
  }
  if (tx.status === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3" />{m("Paid")}</span>
    );
  }
  if (tx.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
        <XCircle className="w-3 h-3" />{m("Failed")}</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
      <Clock className="w-3 h-3" /> {tx.status}
    </span>
  );
}

function PayoutStatusPill({ p }: { p: Payout }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    paid: { label: "In your bank", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
    in_transit: { label: "On the way", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30", Icon: Clock },
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock },
    canceled: { label: "Canceled", cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
    failed: { label: "Failed", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: AlertTriangle },
  };
  const m = map[p.status] || { label: p.status, cls: "bg-muted text-muted-foreground border-border", Icon: Clock };
  const Icon = m.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.cls}`}>
      <Icon className="w-3 h-3" /> {m.label}
    </span>
  );
}

interface ManualRailSummary {
  count: number;
  total_usd: number;
  pending_payer: number;
  pending_payee: number;
  reconciled: number;
}

interface ManualRails {
  acceptsWise: boolean;
  acceptsPaypal: boolean;
  wise: ManualRailSummary;
  paypal: ManualRailSummary;
}

const emptyManualSummary = (): ManualRailSummary => ({
  count: 0,
  total_usd: 0,
  pending_payer: 0,
  pending_payee: 0,
  reconciled: 0,
});

const summarizeManualLogs = (logs: any[]): ManualRailSummary => ({
  count: logs.length,
  total_usd: logs.reduce((s, l) => s + Number(l.amount_usd || 0), 0),
  pending_payer: logs.filter((l) => !l.confirmed_by_payer_at).length,
  pending_payee: logs.filter((l) => l.confirmed_by_payer_at && !l.confirmed_by_payee_at).length,
  reconciled: logs.filter((l) => l.reconciled_at || l.confirmed_by_payee_at).length,
});

export default function EventPayoutsTab({ eventId }: Props) {
  const m = useMicro(); // v15: seven-language host-panel strings
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualRails, setManualRails] = useState<ManualRails>({
    acceptsWise: false,
    acceptsPaypal: false,
    wise: emptyManualSummary(),
    paypal: emptyManualSummary(),
  });
  /* v25 EA (Lee): the money view is a TIMELINE that matches how money actually moves for
     THIS event (OneJob's money-movement model). On approval-gated paid events there's a
     real first stage — authorized holds waiting on the host. */
  const [gatedInfo, setGatedInfo] = useState<{ gated: boolean; authorizedCount: number }>({ gated: false, authorizedCount: 0 });
  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase
        .from("events")
        .select("requires_application, application_requires_approval")
        .eq("id", eventId)
        .maybeSingle();
      const gated = !!((ev as any)?.requires_application && (ev as any)?.application_requires_approval);
      let authorizedCount = 0;
      if (gated) {
        const { count } = await supabase
          .from("event_applications")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("payment_status", "authorized")
          .eq("approval_status", "pending");
        authorizedCount = count || 0;
      }
      setGatedInfo({ gated, authorizedCount });
    })();
  }, [eventId]);

  // Display-currency override (host-chosen, not what Stripe charged in).
  // Persisted per-browser so it sticks across refreshes.
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    try { return localStorage.getItem("onesocial:payout-display-currency") || ""; } catch { return ""; }
  });
  const [fxSnap, setFxSnap] = useState<FxSnapshot | null>(null);
  useEffect(() => {
    getFxRates().then(setFxSnap).catch(() => setFxSnap(null));
  }, []);
  const setDisplayCurrencyPersistent = (c: string) => {
    setDisplayCurrency(c);
    try { localStorage.setItem("onesocial:payout-display-currency", c); } catch { /* ignore */ }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sign in required");
        return;
      }
      const { data: res, error: invokeErr } = await supabase.functions.invoke("stripe-event-activity", {
        body: { event_id: eventId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (invokeErr) throw invokeErr;
      if (res?.error) throw new Error(res.error);
      setData(res as Activity);

      const { data: eventSettings } = await supabase
        .from("events")
        .select("accept_wise, accept_paypal")
        .eq("id", eventId)
        .maybeSingle();

      // Manual-rail summary: join wise_payout_logs -> event_registrations for this event.
      // PayPal shares the historical table with rail="paypal"; null/empty rail means Wise.
      const { data: regIds } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", eventId);
      const ids = (regIds ?? []).map((r: any) => r.id);
      let wiseSummary = emptyManualSummary();
      let paypalSummary = emptyManualSummary();
      if (ids.length) {
        let { data: manualLogs, error: manualErr } = await supabase
          .from("wise_payout_logs" as any)
          .select("amount_usd, rail, confirmed_by_payer_at, confirmed_by_payee_at, reconciled_at")
          .in("event_order_id", ids);
        if (manualErr) {
          const fallback = await supabase
            .from("wise_payout_logs" as any)
            .select("amount_usd, confirmed_by_payer_at, confirmed_by_payee_at, reconciled_at")
            .in("event_order_id", ids);
          manualLogs = fallback.data;
        }
        const logs = (manualLogs as any[]) ?? [];
        wiseSummary = summarizeManualLogs(logs.filter((l) => !l.rail || l.rail === "wise"));
        paypalSummary = summarizeManualLogs(logs.filter((l) => l.rail === "paypal"));
      }
      setManualRails({
        acceptsWise: (eventSettings as any)?.accept_wise === true,
        acceptsPaypal: (eventSettings as any)?.accept_paypal === true,
        wise: wiseSummary,
        paypal: paypalSummary,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payout activity");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const currency = data?.event.currency || "USD";
  // What currency to *display* totals in. Defaults to the event currency.
  const effectiveDisplay = (displayCurrency || currency).toUpperCase();
  const isConverted = effectiveDisplay !== currency.toUpperCase();
  const dfmt = useMemo(() => {
    return (cents: number, sourceCurrency: string) => {
      const src = (sourceCurrency || currency).toUpperCase();
      if (effectiveDisplay === src) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: src }).format((cents || 0) / 100);
      }
      if (!canConvert(src, effectiveDisplay, fxSnap)) {
        // Fall back to source currency if we can't convert (don't lie).
        return new Intl.NumberFormat("en-US", { style: "currency", currency: src }).format((cents || 0) / 100);
      }
      const converted = convertCents(cents || 0, src, effectiveDisplay, fxSnap);
      return new Intl.NumberFormat("en-US", { style: "currency", currency: effectiveDisplay }).format(converted / 100);
    };
  }, [effectiveDisplay, currency, fxSnap]);
  const usdFmt = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }), []);

  const renderManualRail = (
    rail: "wise" | "paypal",
    title: string,
    accepted: boolean,
    summary: ManualRailSummary,
  ) => {
    if (!accepted && summary.count === 0) {
      return (
        <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{m(title)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {rail === "wise"
              ? m("Wise payments are not accepted for this event.")
              : m("PayPal payments are not accepted for this event.")}
          </p>
        </div>
      );
    }

    return (
      <details className="group rounded-2xl border border-border bg-secondary/30 p-4" open={summary.count > 0}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-bold text-foreground">{m(title)}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {accepted
                ? m("Accepted for this event. Configure it from Edit Event, Tickets & Capacity.")
                : m("No longer accepted for this event. Historical payments stay visible here.")}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-bold text-foreground tabular-nums">
              {summary.count}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Orders")}</p>
            <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{summary.count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Total (USD)")}</p>
            <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{usdFmt.format(summary.total_usd)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Awaiting buyer paid")}</p>
            <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{summary.pending_payer}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Awaiting your confirmation")}</p>
            <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{summary.pending_payee}</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          {m(`${title} payments go directly from buyer to host. OneEvent does not touch the money. Confirm receipt in Tickets to release tickets.`)}
        </p>
      </details>
    );
  };

  return (
    <div className="space-y-6">
      {/* Connect status / setup card */}
      <PayoutStatusCard returnPath={`/events/events/${eventId}/manage?payouts=connected`} />

      {/* Header — title + display-currency selector + refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">{m("Money for this event")}</h2>
          <p className="text-xs text-muted-foreground">{m("Live data pulled from Stripe — no need to log in over there.")}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{m("View amounts in")}</label>
            <select
              value={displayCurrency || currency.toUpperCase()}
              onChange={(e) => setDisplayCurrencyPersistent(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {/* Always include the event's source currency first so hosts can return to it. */}
              <option value={currency.toUpperCase()}>
                {currency.toUpperCase()} — event currency
              </option>
              {CURRENCIES.filter((c) => c.code.toUpperCase() !== currency.toUpperCase()).map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary border border-border text-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>

      {/* FX disclosure — only when we're actually converting */}
      {isConverted && (
        <p className="text-[11px] text-muted-foreground -mt-3">{m("Converted from")}<span className="font-semibold text-foreground">{currency.toUpperCase()}</span> to{" "}
          <span className="font-semibold text-foreground">{effectiveDisplay}</span> for display only.
          {fxSnap ? (
            <> Rate sourced from {fxSnap.source} on{" "}
              <time dateTime={fxSnap.fetched_at}>
                {new Date(fxSnap.fetched_at).toLocaleString()}
              </time>.</>
          ) : (
            <>{m("Loading FX rate…")}</>
          )}{" "}
          Stripe will pay you out in the local currency of your connected bank — they handle the actual conversion at the time of transfer.
        </p>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-200">{m("Couldn't load Stripe activity")}</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6 rounded-2xl border border-border bg-secondary/30">
          <Loader2 className="w-4 h-4 animate-spin" />{m("Pulling latest from Stripe…")}</div>
      )}

      {data && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Tickets sold")}</p>
              <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{data.totals.tickets_sold}</p>
              <p className="text-[10px] text-muted-foreground">{data.totals.successful} order{data.totals.successful === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Gross sales")}</p>
              <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{dfmt(data.totals.gross, currency)}</p>
              <p className="text-[10px] text-muted-foreground">{m("Before fees & refunds")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Your net")}</p>
              <p className="text-xl font-bold text-emerald-300 mt-1 tabular-nums">{dfmt(data.totals.net_to_host, currency)}</p>
              <p className="text-[10px] text-muted-foreground">{m("After the 5.99% platform fee")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m("Refunded")}</p>
              <p className="text-xl font-bold text-amber-300 mt-1 tabular-nums">{dfmt(data.totals.refunded, currency)}</p>
              <p className="text-[10px] text-muted-foreground">
                {data.totals.refunded_count} refund{data.totals.refunded_count === 1 ? "" : "s"}
                {data.totals.disputed ? ` · ${data.totals.disputed} dispute${data.totals.disputed === 1 ? "" : "s"}` : ""}
                {data.totals.failed ? ` · ${data.totals.failed} failed` : ""}
              </p>
            </div>
          </div>

          {/* "Held by OneEvent" warning — Stripe collected funds but host hasn't connected yet */}
          {!data.has_connect_account && data.totals.net_to_host > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-200">
                  {dfmt(data.totals.net_to_host, currency)} held in OneEvent — finish your payout setup to release it
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Your ticket buyers were charged successfully, but the money cannot move into a bank account until
                  you finish connecting Stripe (or set up Wise) in the panel above.
                </p>
              </div>
            </div>
          )}

          {/* v25 EA (Lee): "show the actual flow, like a timeline" — the OneJob money-movement
              model, DYNAMIC to how this event sells. Approval-gated paid events get the real
              first stage (authorized holds waiting on the host); everyone gets buyer → Stripe
              clearing → ready to pay out → bank, in order, top to bottom. */}
          {data.has_connect_account && data.balance && (() => {
            const paidPayouts = (data.payouts || []).filter((p) => p.status === "paid");
            const bankTotal = paidPayouts.reduce((s, p) => s + (p.amount || 0), 0);
            const latestPaidPayout = paidPayouts
              .filter((p) => !!p.arrival_date)
              .sort((a, b) => payoutTime(b) - payoutTime(a))[0] || null;
            const availableStr = data.balance.available.length === 0
              ? dfmt(0, currency)
              : data.balance.available.map((b) => dfmt(b.amount, b.currency)).join(" · ");
            const pendingStr = data.balance.pending.length === 0
              ? dfmt(0, currency)
              : data.balance.pending.map((b) => dfmt(b.amount, b.currency)).join(" · ");
            const hasPending = data.balance.pending.some((b) => (b.amount || 0) > 0);
            const steps: { title: string; amount: string; tone: string; note: string }[] = [
              gatedInfo.gated
                ? {
                    title: m("Card authorized — waiting on your approval"),
                    amount: gatedInfo.authorizedCount > 0
                      ? `${gatedInfo.authorizedCount} ${gatedInfo.authorizedCount === 1 ? m("hold") : m("holds")}`
                      : m("None right now"),
                    tone: "border-amber-500/70 bg-amber-500/5",
                    note: m("The buyer's card is on hold, not charged. When you approve, it's charged and your share moves into your Stripe pending balance — minus the 5.99% platform fee."),
                  }
                : {
                    title: m("Buyer pays at checkout"),
                    amount: "",
                    tone: "border-border",
                    note: m("When the buyer checks out, your share moves into your Stripe pending balance — minus the 5.99% platform fee."),
                  },
              {
                title: m("In your Stripe account — clearing"),
                amount: pendingStr,
                tone: "border-emerald-500/70 bg-emerald-500/5",
                note: hasPending
                  ? m("Charged and sitting in your Stripe account while the card networks clear it — usually about 2 business days. Your very first sale on a new Stripe account takes up to 7 days while Stripe verifies the account. After that first one, it's the 2-day pace.")
                  : m("No card money is clearing right now."),
              },
              {
                title: m("Ready to pay out"),
                amount: availableStr,
                tone: "border-emerald-500/70 bg-emerald-500/5",
                note: m("Cleared and ready. You don't have to do anything — Stripe sends it to your bank automatically every business day."),
              },
              {
                title: m("In your bank account"),
                amount: dfmt(bankTotal, currency),
                tone: "border-emerald-500/70 bg-emerald-500/5",
                note: latestPaidPayout
                  ? `${m("Last deposit:")} ${dfmt(latestPaidPayout.amount, latestPaidPayout.currency || currency)} ${m("sent")} ${fmtDay(latestPaidPayout.arrival_date)} — ${m("banks post it the same or next business day.")}`
                  : m("Nothing deposited yet — your first deposit arrives automatically once funds finish clearing. A brand-new Stripe account's first deposit can take up to 7 days; after that they arrive on a rolling 2-business-day pace."),
              },
            ];
            return (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-4 h-4 text-emerald-300" />
                  <h3 className="text-sm font-bold text-foreground">{m("How your money moves")}</h3>
                </div>
                <div className="relative pl-1">
                  {steps.map((st, i) => (
                    <div key={st.title} className="relative flex gap-3 pb-4 last:pb-0">
                      {/* connector */}
                      {i < steps.length - 1 && (
                        <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" aria-hidden />
                      )}
                      <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-[11px] font-extrabold text-primary">
                        {i + 1}
                      </span>
                      <details className="group min-w-0 flex-1 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-2 [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0">
                            <span className="block text-[13px] font-bold text-foreground leading-tight">{st.title}</span>
                            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {m("Tap for details")}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {/* v31 (Lee): yellow/green TEXT was invisible on the light background — the
                                amount is now BLACK text inside a colored outline pill. */}
                            {st.amount && (
                              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums text-foreground ${st.tone}`}>{st.amount}</span>
                            )}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                          </span>
                        </summary>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{st.note}</p>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="space-y-3">
            <div className="px-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                {m("Manual payment rails")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {m("Wise and PayPal acceptance is managed from Edit Event, Tickets & Capacity. This section only reports what happened.")}
              </p>
            </div>
            {renderManualRail("wise", "Paid via Wise (manual)", manualRails.acceptsWise, manualRails.wise)}
            {renderManualRail("paypal", "Paid via PayPal (manual)", manualRails.acceptsPaypal, manualRails.paypal)}
          </div>


          {/* Payouts to bank */}
          {data.has_connect_account && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">{m("Bank transfers")}</h3>
              </div>
              {data.payouts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payouts yet. Once Stripe settles a ticket sale, your first transfer will appear here with an arrival date.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.payouts.map((p) => (
                    <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground tabular-nums">{dfmt(p.amount, p.currency)}</span>
                          <PayoutStatusPill p={p} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {p.status === "paid" ? "Arrived" : "Arrives"} {fmtDay(p.arrival_date)}
                          {p.bank_last4 ? ` · •••• ${p.bank_last4}` : ""}
                          {p.failure_message ? ` · ${p.failure_message}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Transactions timeline */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">{m("Ticket transactions")}</h3>
            {data.transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No transactions yet. As soon as someone buys a ticket, it'll show up here in real time.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.transactions.map((tx) => (
                  <li key={tx.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {tx.customer_name || tx.customer_email || "Guest"}
                        </span>
                        <StatusPill tx={tx} />
                        {tx.founder_test && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border">
                            {m("Founder test — stays with platform")}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {fmtDate(tx.created_at)} · {tx.quantity}× {tx.ticket_type === "vip" ? "VIP" : "General"}
                        {tx.customer_email && tx.customer_name ? ` · ${tx.customer_email}` : ""}
                      </div>
                      {tx.failure_message && (
                        <p className="text-[11px] text-red-300 mt-1">{tx.failure_message}</p>
                      )}
                      {tx.dispute_status && (
                        <p className="text-[11px] text-red-300 mt-1">Dispute status: {tx.dispute_status}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-foreground tabular-nums">{dfmt(tx.amount, tx.currency)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        net <span className="text-emerald-300 tabular-nums">{dfmt(tx.net_to_host || 0, tx.currency)}</span>
                      </div>
                      {tx.receipt_url && (
                        <a
                          href={tx.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1"
                        >{m("Receipt")}<ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.connect_error && (
            <p className="text-[11px] text-muted-foreground">
              Note: couldn't load full Stripe balance ({data.connect_error}). Transactions above are still accurate.
            </p>
          )}
        </>
      )}
    </div>
  );
}
