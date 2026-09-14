import { useEffect, useState } from "react";
import { supabase, FEE_RATE, FEE_PCT } from "@job/lib/supabase";
import { loadStripeJs } from "@job/lib/stripeClient";
import AddCardSheet from "@job/components/AddCardSheet";
import { fnError, thrownError } from "@job/lib/fnError";

/**
 * In-app payment sheet (no bounce-out). Pays a contract with a SAVED card via
 * pay-contract-saved (authorize/hold now, captured on acceptance). Handles:
 *  - no method yet → Add card
 *  - decline → "try another / add new"
 *  - 3DS (requiresAction) → confirmCardPayment via Stripe.js, then done.
 *
 * agreement = { agreementId, amount, recipientId, title, conversationId, currency }
 *
 * onStage (Lee, Jul 26 2026): "it says authorizing payment, and then once it authorizes, it's just
 * sent. It says successful, contract sent." The sheet reports its real milestones upward so the
 * caller can show a stepped progress overlay instead of one silent spinner — money moving with no
 * narration is the single most anxious moment in the product.
 */
type Method = { id: string; method_type: string; brand: string | null; last4: string | null; token: string; is_primary: boolean; is_secondary: boolean; alias: string | null };

export default function PaymentSheet({ agreement, onPaid, onClose, onStage }:
  { agreement: any; onPaid: (info?: { free?: boolean; chargedCents?: number }) => void; onClose: () => void; onStage?: (s: "authorizing" | "authorized" | "failed") => void }) {
  const [methods, setMethods] = useState<Method[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [err, setErr] = useState("");
  const [promo, setPromo] = useState("");
  const [promoTotalCents, setPromoTotalCents] = useState<number | null>(null);
  const [promoMsg, setPromoMsg] = useState("");
  /**
   * A 100%-off founder code (FOUNDERFREE / FOUNDER100) makes the total exactly zero. Stripe cannot
   * charge $0, so the server skips the card rail entirely — which means this sheet must stop asking
   * for a card and stop promising a hold that will never exist. (Lee, Jul 26 2026: "FOUNDERFREE —
   * that gives everything free, so no charge goes through.")
   */
  const [isFree, setIsFree] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from("payment_methods").select("*").eq("user_id", u.user!.id).order("is_primary", { ascending: false });
    const list = (data as Method[]) ?? [];
    setMethods(list);
    setSelId(s => s ?? list.find(m => m.is_primary)?.id ?? list[0]?.id ?? null);
    // DO NOT auto-open the add-card sheet. It ran on mount, before any promo code could be typed, so
    // a payer with no saved card was pushed into "add a card" and backing out closed the whole sheet —
    // there was no path from a cardless state to the FOUNDERFREE field, i.e. the one code meant to
    // remove all friction was unreachable. The "Add a payment method" row is right there instead.
    // (UAT Jul 26 2026)
  };
  useEffect(() => { load(); }, []);

  const fee = FEE_RATE;
  const total = Number(agreement.amount) > 0 ? Number(agreement.amount) * (1 + fee) : 0;
  const money = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: agreement.currency || "USD", maximumFractionDigits: 2 }).format(n);
  const effTotal = promoTotalCents != null ? promoTotalCents / 100 : total;
  const sel = methods.find(m => m.id === selId) || null;

  const applyPromo = async () => {
    if (!promo.trim()) return;
    setPromoMsg("");
    const { data, error } = await supabase.functions.invoke("validate-promo", { body: { code: promo, amount: agreement.amount, currency: agreement.currency } });
    // A server failure is NOT the same as a bad code — saying "invalid" sends people hunting a
    // typo that doesn't exist. (UAT Jul 25 2026)
    if (error) { setPromoTotalCents(null); setPromoMsg("Couldn't check that code right now — try again in a moment."); return; }
    if (data?.valid) {
      setPromoTotalCents(data.newTotalCents);
      setIsFree(!!data.free || data.newTotalCents === 0);
      setPromoMsg(data.free || data.newTotalCents === 0
        ? "Promo applied — this contract is free. No card will be charged."
        : `Promo applied — total ${money(data.newTotalCents / 100)}`);
    }
    else { setPromoTotalCents(null); setIsFree(false); setPromoMsg("That code isn’t valid."); }
  };

  const pay = async () => {
    /* A PAYMENT METHOD IS REQUIRED — including on a 100%-off promo. (Fixed 9 Aug 2026.)
       The two lines this replaces read `if (!sel && !isFree)`, so a free contract fell through
       with `sel === null` and then dereferenced `sel.token` twenty lines down: a TypeError on the
       screen where someone is paying. `strict: false` in the 5-Aug OneJob tsconfig hid it; the
       shared app compiles strict and it surfaced immediately.

       Opening the add-card sheet rather than sending nothing is what the SERVER actually requires:
       `pay-contract-saved` rejects a missing `paymentMethodId` with a 400 BEFORE it reaches its own
       free branch, so a cardless free contract could never have succeeded. If the intent is that a
       FOUNDERFREE contract needs no card at all, that is a server change and Lee's call — flagged,
       not made here. */
    if (!sel) { setAddOpen(true); return; }
    setBusy(true); setErr(""); setDeclined(false);
    // A free contract never touches a card, so claiming "asking your bank to hold the funds" would be
    // two false statements on the most anxious screen in the product. (UAT Jul 26 2026)
    if (!isFree) onStage?.("authorizing");
    const { data, error } = await supabase.functions.invoke("pay-contract-saved", {
      body: {
        agreementId: agreement.agreementId, amount: agreement.amount, recipientId: agreement.recipientId,
        title: agreement.title, conversationId: agreement.conversationId, currency: agreement.currency, paymentMethodId: sel.token,
        promoCode: promoTotalCents != null ? promo : undefined,
      },
    });
    if (error) {
      // Never show "Edge Function returned a non-2xx status code" to a person paying money.
      // The real decline reason is in the response body. (UAT Jul 25 2026)
      setErr(await fnError(error, "We couldn't take that payment. Try again, or use another card."));
      setBusy(false); onStage?.("failed"); return;
    }
    if (data?.declined) { setDeclined(true); setBusy(false); onStage?.("failed"); return; }
    if (data?.requiresAction && data?.clientSecret) {
      // 3-D Secure: confirm on the client, then it's authorized (the hold).
      try {
        const cfg = await supabase.functions.invoke("create-setup-intent", { body: {} }); // returns publishableKey
        const pk = (cfg as any)?.data?.publishableKey;
        if (!pk) throw new Error("We couldn't finish the secure check. Try again in a moment.");
        const s = await loadStripeJs(pk);
        const { error: cErr } = await s.confirmCardPayment(data.clientSecret);
        if (cErr) { setDeclined(true); setBusy(false); onStage?.("failed"); return; }
        // Recorded by the SERVER, which re-reads the PaymentIntent from Stripe before believing it.
        // This used to be a direct table write that (a) never stamped `authorized_at`, leaving the
        // money timeline showing step 1 undone beneath completed steps 2 and 3, and (b) is now blocked
        // outright by `guard_agreement_money_columns` since a party could otherwise forge the timeline.
        const { error: confErr } = await supabase.functions.invoke("confirm-contract-authorization", {
          body: { agreementId: agreement.agreementId, paymentIntentId: data.paymentIntentId },
        });
        if (confErr) {
          setErr(await fnError(confErr, "Your card was authorized but we couldn't record it. Contact support before retrying so you aren't charged twice."));
          setBusy(false); onStage?.("failed"); return;
        }
      } catch (e: any) { setErr(e?.message || String(e)); setBusy(false); onStage?.("failed"); return; }
    }
    // The hold exists now. Say so BEFORE the delivery work starts, because that's the fact the
    // payer cares about: their card is authorized, nothing has been taken.
    if (!(data as any)?.free && !isFree) onStage?.("authorized");
    // Tell the parent whether a card was actually involved. Without this it would overwrite the
    // server's `free_promo` payment_status with "held" and the contract would claim a hold that
    // doesn't exist.
    onPaid({ free: !!(data as any)?.free || isFree, chargedCents: (data as any)?.chargedCents });
  };

  const label = (m: Method) => m.alias || `${m.brand ?? "Card"} •••• ${m.last4 ?? "0000"}`;

  if (addOpen) return <AddCardSheet onClose={() => { setAddOpen(false); if (methods.length === 0) onClose(); }} onSaved={() => { setAddOpen(false); load(); }} />;

  return (
    <div className="fixed inset-0 z-[88] grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="glass-modal relative w-full max-w-lg rounded-t-3xl p-6 shadow-2xl sm:m-4 sm:rounded-3xl">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={onClose} className="flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">‹ Back</button>
          <h2 className="text-xl font-extrabold">Review &amp; pay</h2>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-sm opacity-70"><span>{agreement.title}</span><span>{money(Number(agreement.amount))}</span></div>
          <div className="mt-1 flex items-center justify-between text-sm opacity-70"><span>Service fee ({FEE_PCT})</span><span>{money(total - Number(agreement.amount))}</span></div>
          <div className="my-2 h-px bg-ink/10 dark:bg-white/10" />
          <div className="flex items-center justify-between font-bold"><span>Total</span>
            <span>{promoTotalCents != null ? (<><span className="mr-2 font-normal line-through opacity-40">{money(total)}</span>{money(effTotal)}</>) : money(total)}</span></div>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={promo} onChange={e => {
              // BUG THIS FIXES (UAT Jul 26 2026): editing the code after tapping Apply left `isFree`
              // and `promoTotalCents` from the PREVIOUS code in place. Type FOUNDERFREE, apply, then
              // fix a typo without re-applying, and the button still said "Send contract — free" and
              // promised no card would be charged — while pay() sent an unmatched code and the server
              // placed a real authorization for the full amount. Any edit invalidates the preview.
              setPromo(e.target.value.toUpperCase());
              setPromoTotalCents(null); setIsFree(false); setPromoMsg("");
            }} placeholder="Promo code" className="input flex-1 py-2 text-sm" />
          <button onClick={applyPromo} className="btn-ghost px-4 py-2 text-sm">Apply</button>
        </div>
        {promoMsg && <p className="mt-1 text-xs text-brand">{promoMsg}</p>}

        {declined ? (
          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-red-500">
              {err || "That card was declined. Banks often decline a first attempt on a new merchant — retrying usually works."}
            </p>
            <div className="card divide-y divide-ink/5 p-2 dark:divide-white/5">
              {/* Retry the SAME card. With only one saved card the list below was empty, leaving
                  a dead end with nothing to tap. (UAT Jul 25 2026) */}
              {sel && (
                <button onClick={() => { setDeclined(false); setErr(""); pay(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-brand/5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">↻</span>
                  <span className="flex-1 text-sm font-semibold">Try {label(sel)} again</span>
                </button>
              )}
              {methods.filter(m => m.id !== selId).map(m => (
                <button key={m.id} onClick={() => { setSelId(m.id); setDeclined(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-brand/5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink/5 dark:bg-white/10">💳</span>
                  <span className="flex-1 text-sm font-semibold">{label(m)}</span><span className="opacity-30">›</span>
                </button>
              ))}
              <button onClick={() => setAddOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-brand/5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink/5 text-brand dark:bg-white/10">＋</span>
                <span className="flex-1 text-sm font-semibold">Add a new payment method</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 mb-2 text-xs opacity-50">Paying with</div>
            <button onClick={() => setAddOpen(true)} className="card flex w-full items-center gap-3 p-3.5 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-lg dark:bg-white/10">💳</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{sel ? label(sel) : "Add a payment method"}</span>
                {sel && <span className="block text-[11px] opacity-55">Primary</span>}
              </span>
              <span className="opacity-30">›</span>
            </button>
            {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
            <button onClick={pay} disabled={busy} className="btn-primary mt-4 w-full text-lg">
              {busy ? (isFree ? "Sending…" : "Authorizing payment…")
                    : isFree ? "Send contract — free" : `Authorize & send — ${money(effTotal)}`}
            </button>
            {/* The old copy said the money was "released to the pro when the job's accepted", which
                was wrong twice over: acceptance moves it into OneJob's holding account, not to the pro, and
                the pro is only paid once BOTH sides mark the job complete. */}
            {isFree ? (
              <p className="mt-2 text-center text-[11px] leading-snug opacity-55">
                This contract is free — no card is charged and no hold is placed. Nothing will be paid
                out either, so use this for testing the flow rather than a real job.
              </p>
            ) : (
              <p className="mt-2 text-center text-[11px] leading-snug opacity-55">
                A hold goes on your card now — nothing is taken. On acceptance it's collected and
                held by OneJob, and it only reaches the professional after you both mark the job complete.
                {agreement.acceptHours ? ` If they don't accept within ${agreement.acceptHours} hours, the hold is released automatically.` : ""}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
