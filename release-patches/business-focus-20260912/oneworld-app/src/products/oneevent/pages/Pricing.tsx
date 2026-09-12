import { useState, useEffect } from "react";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@evt/lib/supabase";
import { FEE_PCT } from "@oneworld/shell";
import { useAuth } from "@evt/hooks/useAuth";
import { PLANS, normalizePlan, quarterlyTotal, quarterlyPerMonth, money, type Plan } from "@evt/lib/plans";
import { cn } from "@evt/lib/utils";

const FREE_PROMO_CODES = new Set(["FOUNDER0001", "DEMO0001"]);
const DOLLAR_PROMO_CODES = new Set(["FOUNDER0002", "FOUNDER100"]);

function promoKind(code: string) {
  if (FREE_PROMO_CODES.has(code)) return "free";
  if (DOLLAR_PROMO_CODES.has(code)) return "dollar";
  return null;
}

function checkoutPromoCode(code: string) {
  return code === "FOUNDER0002" ? "FOUNDER100" : code;
}

function grantPromoCode(code: string) {
  return code === "DEMO0001" ? "FOUNDER0001" : code;
}

// Pricing framework. Stripe subscription checkout is wired separately — for now the
// Upgrade CTA acknowledges intent so the flow is complete end-to-end visually. (Lee, Jul 22)
export default function Pricing() {
  const { subscription, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPlan = normalizePlan(subscription?.plan);
  const [quarterly, setQuarterly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [promoMsg, setPromoMsg] = useState("");

  // Open the Stripe billing portal so a subscribed user can change or cancel their plan.
  // On cancel, profiles.plan syncs back to free on their next verify (portal-managed).
  const goPortal = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const origin = window.location.origin;
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const returnUrl = `${origin}${base}/events/pricing`;
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: { returnUrl } });
      if (error || !(data as any)?.url) {
        toast.error(((error as any)?.message as string) || "Couldn't open billing. Please try again.");
        setPortalBusy(false);
        return;
      }
      window.location.href = (data as any).url;
    } catch {
      toast.error("Couldn't open billing. Please try again.");
      setPortalBusy(false);
    }
  };

  // Plan promo codes (founder testing): FOUNDER0001 = free grant (no Stripe);
  // FOUNDER0002 = flat $1 real charge. Older aliases remain accepted.
  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    const kind = promoKind(code);
    if (kind) {
      setAppliedCode(code); setPromoMsg("");
      toast.success(kind === "free" ? `${code} applied — your upgrade will be free.` : `${code} applied — your upgrade will be $1.`);
    } else { setAppliedCode(""); setPromoMsg("That code isn't valid."); }
  };
  const clearPromo = () => { setAppliedCode(""); setPromoInput(""); setPromoMsg(""); };

  const returnTo = searchParams.get("return") || `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/events/events`;

  // Returning from Stripe checkout — verify & apply the plan, then continue to where
  // the user started (e.g. the create-event flyer studio). (Lee, Jul 23)
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (searchParams.get("upgraded") === "1" && sessionId) {
      (async () => {
        setBusy("verify");
        try {
          const { data } = await supabase.functions.invoke("verify-plan-checkout", { body: { sessionId } });
          if ((data as any)?.ok) {
            await refreshProfile();
            toast.success(`You're on ${String((data as any).plan).toUpperCase()} — everything's unlocked. Welcome!`, { duration: 7000 });
            const dest = searchParams.get("return");
            if (dest) { window.location.href = dest.startsWith("http") ? dest : window.location.origin + dest; return; }
          } else {
            toast.error("We couldn't confirm your upgrade yet. If you were charged, it'll apply shortly.");
          }
        } catch {
          toast.error("Could not verify the upgrade. If you were charged, refresh in a moment.");
        }
        setBusy(null);
        setSearchParams(prev => { prev.delete("upgraded"); prev.delete("session_id"); prev.delete("plan"); return prev; }, { replace: true });
      })();
    }
    if (searchParams.get("checkout") === "cancelled") {
      toast.info("Checkout cancelled — no charge was made.");
      setSearchParams(prev => { prev.delete("checkout"); return prev; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceLine = (p: Plan) => {
    if (p.monthly === 0) return { big: "Free", per: "", sub: "forever" };
    if (quarterly) return { big: `${money(quarterlyPerMonth(p))}`, per: "/mo", sub: `${money(quarterlyTotal(p))} billed every 3 months` };
    return { big: `${money(p.monthly)}`, per: "/mo", sub: "billed monthly" };
  };

  const onChoose = async (p: Plan) => {
    if (p.id === currentPlan || busy) return;
    if (p.id === "free") {
      if (currentPlan !== "free") { goPortal(); return; } // downgrade = manage/cancel in the portal
      toast.info("Basic is free — you're all set. Upgrade any time for more."); return;
    }
    setBusy(p.id);
    try {
      // Free founder grant — no Stripe; apply the plan directly.
      if (promoKind(appliedCode) === "free") {
        const { data, error } = await supabase.functions.invoke("grant-plan", { body: { plan: p.id, code: grantPromoCode(appliedCode) } });
        if (error || !(data as any)?.ok) { toast.error(((error as any)?.message as string) || "Couldn't redeem that code."); setBusy(null); return; }
        await refreshProfile();
        toast.success(`You're on ${p.name.toUpperCase()} — redeemed with ${appliedCode}. Welcome!`, { duration: 6000 });
        setBusy(null);
        return;
      }
      // Return to THIS pricing page (to verify) carrying the original destination,
      // so after checkout we can send the user back to where they started.
      const origin = window.location.origin;
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const returnUrl = `${origin}${base}/events/pricing?return=${encodeURIComponent(returnTo)}`;
      const { data, error } = await supabase.functions.invoke("create-plan-checkout", {
        body: { plan: p.id, interval: quarterly ? "quarterly" : "monthly", returnUrl, promoCode: appliedCode ? checkoutPromoCode(appliedCode) : undefined },
      });
      if (error || !(data as any)?.url) {
        toast.error("Couldn't start checkout. Please try again in a moment.");
        setBusy(null);
        return;
      }
      window.location.href = (data as any).url;
    } catch {
      toast.error("Couldn't start checkout. Please try again.");
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:pb-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">Choose your plan</h1>
        <p className="mt-1 text-sm text-ink/60 dark:text-white/60">
          Start free. Upgrade for richer AI descriptions and pro host tools — cancel anytime.
        </p>

        {/* Monthly / 3-month toggle */}
        <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-ink/15 bg-ink/[0.03] p-1 dark:border-white/15 dark:bg-white/5">
          <button type="button" onClick={() => setQuarterly(false)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition", !quarterly ? "bg-teal text-white shadow-sm" : "text-ink/60 dark:text-white/60")}>
            Monthly
          </button>
          <button type="button" onClick={() => setQuarterly(true)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition", quarterly ? "bg-teal text-white shadow-sm" : "text-ink/60 dark:text-white/60")}>
            3 months <span className="ml-1 text-[11px] font-bold text-brand">save up to 20%</span>
          </button>
        </div>
      </div>

      <div className="mx-auto mb-6 max-w-sm rounded-2xl border border-brand/15 bg-white/70 p-3 shadow-sm shadow-brand/5 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <label className="mb-1 block text-center text-xs font-bold uppercase tracking-wide text-brand">Have a founder code?</label>
        <div className="flex gap-2">
          <input type="text" value={promoInput}
            onChange={(e) => { setPromoInput(e.target.value); setPromoMsg(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
            placeholder="" disabled={!!appliedCode}
            className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-brand dark:border-white/15 dark:bg-white/5 disabled:opacity-60" />
          {appliedCode ? (
            <button type="button" onClick={clearPromo} className="rounded-xl border border-ink/15 px-3 py-2 text-sm font-semibold text-ink/60 dark:border-white/15 dark:text-white/60">Remove</button>
          ) : (
            <button type="button" onClick={applyPromo} disabled={!promoInput.trim()} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Apply</button>
          )}
        </div>
        {promoMsg && <p className="mt-1.5 text-center text-[11px] font-medium text-red-500">{promoMsg}</p>}
        {appliedCode && <p className="mt-1.5 text-center text-[11px] font-medium text-brand">✓ {appliedCode} applied — {promoKind(appliedCode) === "free" ? "your upgrade will be free" : "your upgrade will be $1"}. Now choose a plan below.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = p.id === currentPlan;
          const line = priceLine(p);
          const save = quarterly && p.quarterlyDiscount > 0;
          return (
            <div key={p.id}
              className={cn(
                "relative flex flex-col rounded-3xl border p-5",
                p.highlight
                  ? "border-brand/60 bg-brand/[0.04] shadow-lg shadow-brand/10 dark:bg-brand/[0.07]"
                  : "border-ink/15 bg-ink/[0.02] dark:border-white/15 dark:bg-white/[0.03]"
              )}>
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-bright to-brand-deep px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                  MOST POPULAR
                </span>
              )}
              <div className="mb-3">
                <p className="text-lg font-bold">{p.name}</p>
                <p className="mt-0.5 min-h-[32px] text-xs text-ink/55 dark:text-white/55">{p.tagline}</p>
              </div>

              {/* Price + /mo on ONE line; the billed-cadence note on the next (Lee, Jul 22) */}
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">{line.big}</span>
                {line.per && <span className="text-sm font-semibold text-ink/55 dark:text-white/55">{line.per}</span>}
              </div>
              <p className="mb-4 min-h-[16px] text-xs text-ink/55 dark:text-white/55">{line.sub}</p>

              <ul className="mb-5 space-y-2">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand" />
                    <span className="text-ink/80 dark:text-white/80">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA + discount pinned to the bottom of the card */}
              <div className="mt-auto">
                {save && (
                  <p className="mb-2 text-center text-[11px] font-semibold text-brand">
                    {Math.round(p.quarterlyDiscount * 100)}% off vs {money(p.monthly)}/mo
                  </p>
                )}
                <button type="button" onClick={() => onChoose(p)} disabled={isCurrent || busy !== null}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60",
                    isCurrent
                      ? "cursor-default bg-ink/10 text-ink/50 dark:bg-white/10 dark:text-white/50"
                      : p.id !== "free"
                        ? "bg-gradient-to-r from-brand-bright to-brand-deep text-white shadow-sm shadow-brand/25"
                        : "border border-brand/50 text-brand hover:bg-brand/10"
                  )}>
                  {busy === p.id ? <Loader2 size={14} className="animate-spin" /> : (!isCurrent && p.id !== "free" && <Sparkles size={14} />)}
                  {busy === p.id ? "Starting checkout…" : isCurrent ? "Current plan" : p.id === "free" ? "Downgrade to Basic" : `Choose ${p.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {currentPlan !== "free" && (
        <div className="mt-6 text-center">
          <button type="button" onClick={goPortal} disabled={portalBusy}
            className="text-sm font-semibold text-brand underline underline-offset-4 hover:opacity-80 disabled:opacity-60">
            {portalBusy ? "Opening billing…" : "Manage billing · change or cancel your plan"}
          </button>
        </div>
      )}

      {searchParams.get("onboarding") === "1" && (
        <div className="mt-4 text-center">
          <button type="button"
            onClick={() => { const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, ""); window.location.href = window.location.origin + base + "/events"; }}
            className="text-sm font-medium text-ink/55 underline underline-offset-4 hover:opacity-80 dark:text-white/55">
            Continue with Basic (free) →
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ink/45 dark:text-white/45">
        Prices in USD. 3-month plans are billed once, up front. OneEvent's platform fee ({FEE_PCT}) is separate and only applies to paid tickets.
      </p>
    </div>
  );
}
