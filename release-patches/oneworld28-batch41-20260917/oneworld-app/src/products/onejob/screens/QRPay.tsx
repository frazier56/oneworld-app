import { ScreenHeading } from "@oneworld/shell";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useQuery } from "@job/lib/query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import ContractForm from "@job/components/ContractForm";
import InfoTip from "@job/components/InfoTip";
import { useI18n, W } from "@job/lib/i18n";
import Chevron from "@job/components/Chevron";
import { hireLink } from "@job/lib/oneWorld";
import { IconWrite, IconPhoto, IconToolbox } from "@job/components/ActionIcons";

/**
 * "Start a job" — the center (cash-bag) tab. Full screen, not a modal.
 *  - Top: readiness (Wallet + Payout) so you're ready to hire OR get paid in <60s later.
 *  - Three ways to begin, each its own surface: Create a contract, Send a link, Show a QR.
 * (Get-discovered toggle lives on Find Work, not here. No metrics dashboard — that's My Jobs.)
 */
export default function QRPay() {
  const { lang } = useI18n();
  const { user, session } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const draftParam = params.get("draft");
  const [mode, setMode] = useState<"home" | "contract" | "qr">(draftParam ? "contract" : "home");

  // deep-link: /jobs/qr?draft=<id> resumes that draft in the contract form
  useEffect(() => {
    if (draftParam) setMode("contract");
  }, [draftParam]);

  /**
   * /jobs/qr?claim=<token> — the other half of the anonymous-stash flow in ContractForm.
   *
   * A signed-out visitor filled in a whole contract on /hire/:proId, we parked it in
   * quick_hire_drafts under an unguessable token, and sent them to sign up. They are back and now
   * have an account. Turn the parked row into a real agreement they own, then drop them exactly
   * where they were going: the preview/payment step of that contract.
   *
   * Uses the 1-ARGUMENT claim_quick_hire_draft. The 2-arg version takes the destination account as
   * a parameter, which is why it is no longer callable from a browser at all — it let anyone mint
   * a contract in somebody else's name. This one reads auth.uid() from the caller's own session.
   *
   * Idempotent by design: the function returns the existing agreement_id if the token was already
   * claimed, so a refresh or a double-mount cannot produce two contracts.
   */
  const claimToken = params.get("claim");
  const claimed = useRef(false);
  const [claimErr, setClaimErr] = useState("");
  useEffect(() => {
    if (!claimToken || !user || claimed.current) return;
    claimed.current = true;
    (async () => {
      const { data, error } = await supabase.rpc("claim_quick_hire_draft", { p_resume_token: claimToken });
      try { localStorage.removeItem("onejob-anon-draft-token"); } catch { /* ignore */ }
      const next = new URLSearchParams(params);
      next.delete("claim");
      if (error || !data) {
        // Expired (24h TTL), already purged, or self-contract. Say so instead of dumping them on
        // an empty form and letting them think the platform ate their work.
        setClaimErr(W(lang, "That contract expired before you finished signing up — here it is again to fill in.", "Ese contrato venció antes de que terminaras de registrarte — aquí está de nuevo para completarlo."));
        setMode("contract");
        setParams(next, { replace: true });
        return;
      }
      next.set("draft", String(data));
      next.set("preview", "1");
      setMode("contract");
      setParams(next, { replace: true });
    })();
  }, [claimToken, user?.id]);

  const closeContract = () => {
    setMode("home");
    if (draftParam || params.get("preview")) { params.delete("draft"); params.delete("preview"); setParams(params, { replace: true }); }
  };
  const [hireUrl, setHireUrl] = useState("");
  const qrBig = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [payoutErr, setPayoutErr] = useState("");
  const [hasMethod, setHasMethod] = useState<boolean | null>(null);
  const [setupOpen, setSetupOpen] = useState(true); // "Get your money right" expand/collapse

  useEffect(() => {
    const h = (e: PageTransitionEvent) => { if (e.persisted) setConnecting(false); };
    window.addEventListener("pageshow", h);
    return () => window.removeEventListener("pageshow", h);
  }, []);

  // hire link (points at this app's hire page)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = Math.random().toString(36).slice(2, 14);
      await supabase.from("quick_hire_qr_scans").insert({ professional_id: user.id, token });
      setHireUrl(`${hireLink(user.id)}?ref=qr_${token}`);
    })();
  }, [user?.id]);

  // wallet readiness
  useEffect(() => {
    if (!user) return;
    supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setHasMethod((count ?? 0) > 0));
  }, [user?.id]);

  // payout readiness
  const { data: payout } = useQuery({
    queryKey: ["payout", user?.id], enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (error) return null;
      return data as { payouts_enabled?: boolean };
    },
  });
  const payoutReady = !!payout?.payouts_enabled;
  const ready = (hasMethod ? 1 : 0) + (payoutReady ? 1 : 0);
  // Auto-collapse the setup section once both are ready (keeps it expanded to nudge new users).
  useEffect(() => { if (ready === 2) setSetupOpen(false); }, [ready]);

  const connectStripe = async () => {
    if (connecting) return;
    if (!session?.access_token) { setPayoutErr(W(lang, "Please sign in again to set up payouts.", "Inicia sesión de nuevo para configurar tus pagos.")); return; }
    setConnecting(true); setPayoutErr("");
    try {
      // NOTE: the function reads `returnPath` (camelCase) — sending return_path silently no-ops the redirect.
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        headers: { Authorization: `Bearer ${session.access_token}` }, body: { returnPath: "/jobs/qr" },
      });
      if (error) {
        // Surface the function's friendly error instead of silently doing nothing.
        let msg = W(lang, "Couldn’t open Stripe payouts. Try again in a moment.", "No pudimos abrir los pagos de Stripe. Inténtalo de nuevo en un momento.");
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* no body */ }
        setPayoutErr(msg); setConnecting(false); return;
      }
      if (data?.url) { window.location.href = data.url as string; return; }
      setPayoutErr((data as any)?.error || W(lang, "Couldn’t open Stripe payouts. Try again in a moment.", "No pudimos abrir los pagos de Stripe. Inténtalo de nuevo en un momento."));
    } catch (e: any) {
      setPayoutErr(e?.message || W(lang, "Couldn’t open Stripe payouts. Try again in a moment.", "No pudimos abrir los pagos de Stripe. Inténtalo de nuevo en un momento."));
    }
    setConnecting(false);
  };

  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: W(lang, "Let’s set up a job", "Vamos a crear un trabajo"), url: hireUrl }); return; } catch {} }
    await navigator.clipboard.writeText(hireUrl); setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (mode === "qr" && qrBig.current && hireUrl)
      QRCode.toCanvas(qrBig.current, hireUrl, { width: 240, margin: 2, color: { dark: "#0B0F1A", light: "#ffffff" } }, () => {});
  }, [mode, hireUrl]);

  if (mode === "contract")
    return (
      <>
        {claimErr && (
          <div className="mb-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
            {claimErr}
          </div>
        )}
        <ContractForm initialDraftId={draftParam} autoPreview={params.get("preview") === "1"} onClose={closeContract} onSent={closeContract} />
      </>
    );

  // ---------- QR sub-screen ----------
  if (mode === "qr") {
    return (
      <div className="space-y-4">
        <button onClick={() => setMode("home")} className="flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">‹ {W(lang, "Back", "Atrás")}</button>
        <div className="card p-6 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-xl font-extrabold">{W(lang, "Scan to start", "Escanea para empezar")}</h1>
            <InfoTip title={W(lang, "Scan to start", "Escanea para empezar")} text={W(lang, "This QR is how people Quick-Hire you. Show it, share it, print it — anyone who scans can hire and pay you in about a minute.", "Este QR es como te contratan al instante. Muéstralo, compártelo, imprímelo — cualquiera que lo escanee puede contratarte y pagarte en un minuto.")} />
          </div>
          <p className="mt-1 text-sm opacity-60">{W(lang, "Have them scan this with their phone camera.", "Pídeles que escaneen esto con la cámara de su teléfono.")}</p>
          <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-4"><canvas ref={qrBig} /></div>
          <button onClick={share} className="btn-ghost mt-5 w-full">{copied ? W(lang, "✓ Link copied", "✓ Enlace copiado") : W(lang, "Share the link instead", "Mejor compartir el enlace")}</button>
        </div>
      </div>
    );
  }

  // ---------- HOME: readiness + 3 options ----------
  /**
   * A readiness row is ALWAYS tappable — including once it's green. (Lee, 31 Jul 2026.)
   *
   * It used to render a dead `✓` badge the moment a thing was set up, which meant the only
   * route to "manage my wallet" or "manage my payout" disappeared exactly when you started
   * having money to manage. Done is not the end of a payment method's life: cards expire, banks
   * change, people want to look. A row that answers a question should also let you act on it.
   *
   * `manageTo` is where a FINISHED row goes; `onClick` still owns the not-yet-set-up path, so
   * the Stripe onboarding round trip is untouched.
   */
  const Ready = ({ icon, title, sub, ok, cta, onClick, manageTo, manageLabel }:
    { icon: string; title: string; sub: string; ok: boolean; cta: string; onClick: () => void;
      manageTo: string; manageLabel: string }) => (
    <button
      type="button"
      onClick={() => (ok ? nav(manageTo) : onClick())}
      aria-label={ok ? `${title} — ${manageLabel}` : `${title} — ${cta}`}
      className="flex w-full items-center gap-3 rounded-2xl py-2.5 pl-1 pr-1 text-left transition hover:bg-brand/[0.06] active:scale-[.995]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-base">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs opacity-55">
          <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${ok ? "bg-teal" : "bg-amber-500"}`} />
          {ok ? W(lang, `Ready · ${manageLabel}`, `Listo · ${manageLabel}`) : sub}
        </span>
      </span>
      {ok
        ? <>
            <span className="rounded-full bg-teal/15 px-2.5 py-1 text-[11px] font-bold text-teal-dark dark:text-teal">✓</span>
            <Chevron dir="right" className="opacity-40" />
          </>
        : <span className="rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white"
                style={{
                  background: "linear-gradient(160deg, #4A4038 0%, #241E19 100%)",
                  boxShadow: "0 6px 14px -8px rgba(36,30,25,.55), inset 0 1px 0 rgba(255,255,255,.16)",
                }}>{cta}</span>}
    </button>
  );

  /* `icon` is a component, not an emoji string. Same reason as everywhere else: an
     emoji is a different shape on every device, and this is the screen where a job
     starts. (Lee's P1, 2 Aug 2026.) */
  const Opt = ({ icon: Icon, title, sub, primary, onClick }:
    { icon: (p: { size?: number; className?: string }) => JSX.Element; title: string; sub: string; primary?: boolean; onClick: () => void }) => (
    <button onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-3xl p-4 text-left transition active:scale-[0.99] ${primary
        ? "border border-brand/35 bg-gradient-to-br from-brand/15 to-brand/[0.04] shadow-lg shadow-brand/10"
        : "card"}`}>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${primary ? "bg-brand text-white" : "bg-brand/10 text-brand-deep dark:text-brand-light"}`}><Icon size={22} /></span>
      <span className="min-w-0 flex-1">
        <span className={`block font-bold ${primary ? "text-lg" : ""}`}>{title}</span>
        <span className="block text-xs opacity-55">{sub}</span>
      </span>
      <Chevron dir="right" className="opacity-40" />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* The VAIA "Tap for insights" pill used to sit on this row. It is SHELL chrome now —
          AppShell renders one on every screen of every product — and keeping the local copy put
          two of them side by side on this screen. (Caught in the 9 Aug visual pass.) */}
      <ScreenHeading right={
        <InfoTip title={W(lang, "Start a job", "Iniciar un trabajo")} text={W(lang, "Write a contract, or scan a QR in person.", "Escribe un contrato, o escanea un QR en persona.")} />
      }>{W(lang, "Start a job", "Iniciar un trabajo")}</ScreenHeading>

      {/* Get your money right — collapsible readiness (tap the header to expand/collapse) */}
      <div className="card p-4">
        <div role="button" tabIndex={0} onClick={() => setSetupOpen(o => !o)}
          className="flex cursor-pointer items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold">⚡ {W(lang, "Get your money right", "Deja tu dinero listo")}</span>
            <InfoTip title={W(lang, "Get your money right", "Deja tu dinero listo")} text={W(lang, "Set up your wallet to hire, and your payout to get paid — each takes under 60 seconds.", "Configura tu billetera para contratar, y tu cuenta de pagos para cobrar — cada una toma menos de 60 segundos.")} />
          </span>
          <span className="flex items-center gap-2">
            <span className={`text-xs font-bold ${ready === 2 ? "text-teal-dark dark:text-teal" : "opacity-50"}`}>{ready} {W(lang, "of 2", "de 2")}</span>
            <Chevron color="#0FB5A6" open={setupOpen} />
          </span>
        </div>
        {setupOpen && (
          <div className="mt-2">
            {/* Wallet goes to the Vault either way — the row is the way in, set up or not. */}
            <Ready icon="💳" title={W(lang, "Wallet", "Billetera")} sub={W(lang, "Add a method to hire", "Agrega un método para contratar")} ok={!!hasMethod}
                   cta={W(lang, "Add", "Agregar")} onClick={() => nav("/jobs/wallet")}
                   manageTo="/jobs/wallet" manageLabel={W(lang, "manage your methods", "gestiona tus métodos")} />
            <div className="h-px bg-ink/5 dark:bg-white/10" />
            {/* Payout: unfinished still runs the Stripe onboarding round trip exactly as before;
                finished goes to Settings, which is where the payout panel actually lives. */}
            <Ready icon="🏦" title={W(lang, "Payout", "Cobros")} sub={W(lang, "Add it to get paid", "Agrégalo para que te paguen")} ok={payoutReady}
                   cta={connecting ? "…" : W(lang, "Set up", "Configurar")} onClick={connectStripe}
                   manageTo="/jobs/settings" manageLabel={W(lang, "manage payouts", "gestiona tus cobros")} />
            {payoutErr && <p className="mt-2 px-1 text-xs font-semibold text-red-500">{payoutErr}</p>}
          </div>
        )}
      </div>

      {/* Options — a job always starts with a contract; you share it after preview.
          (Standalone "Send a link" removed per Lee: nothing to send without a contract.) */}
      <div className="space-y-3">
        <p className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] opacity-40">{W(lang, "How do you want to begin?", "¿Cómo quieres empezar?")}</p>
        <Opt icon={IconWrite} title={W(lang, "Create a contract", "Crear un contrato")} sub={W(lang, "Write the job, set the price, then preview & share.", "Describe el trabajo, pon el precio, luego revisa y comparte.")} primary onClick={() => setMode("contract")} />
        <Opt icon={IconPhoto} title={W(lang, "Show a QR code", "Mostrar un código QR")} sub={W(lang, "In person — they scan to begin.", "En persona — escanean para empezar.")} onClick={() => setMode("qr")} />
        <Opt icon={IconToolbox} title={W(lang, "My Jobs", "Mis trabajos")} sub={W(lang, "Pending, active, drafts — pick up where you left off.", "Pendientes, activos, borradores — retoma donde lo dejaste.")} onClick={() => nav("/jobs/jobs")} />
      </div>
    </div>
  );
}
