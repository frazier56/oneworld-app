import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CONFIGS, Wordmark } from "@oneworld/shell";
import { useAuth } from "@job/hooks/useAuth";
import { supabase } from "@job/lib/supabase";
import { acceptAgreement, type Agreement } from "@job/lib/jobloop";
import { fmtDateLong, fmtDateTimeShort, fmtTimeRange } from "@job/lib/datetime";
import { fnError, thrownError } from "@job/lib/fnError";
import { sanitizeHtml } from "@job/lib/mdToHtml";
import { timeLeft, windowLabel } from "@job/lib/acceptWindow";
import PhoneInput from "@job/components/PhoneInput";
import { useI18n, W } from "@job/lib/i18n";

const SMS_CONSENT_TEXT_EN =
  "Text me about this job. I agree to receive text messages about this job, including a message " +
  "asking how it went. Message and data rates may apply. Message frequency varies. Reply STOP to " +
  "opt out, HELP for help.";
const SMS_CONSENT_TEXT_ES =
  "Envíame mensajes de texto sobre este trabajo. Acepto recibir mensajes de texto sobre este trabajo, " +
  "incluido un mensaje para preguntarme cómo salió. Pueden aplicarse tarifas de mensajes y datos. " +
  "La frecuencia de los mensajes varía. Responde STOP para cancelar, HELP para obtener ayuda.";

const OPEN_OFFER_STATUSES = new Set(["draft", "sent", "pending"]);

type SharedContractData = {
  id: string;
  title: string | null;
  description: string | null;
  amount: number;
  fee: number | null;
  total: number | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_recurring: boolean | null;
  location: string | null;
  status: string | null;
  accept_deadline?: string | null;
  accept_window_hours?: number | null;
  expired?: boolean;
  authorized?: boolean;
  payment_rail?: string | null;
  senderRole: "payer" | "payee";
  sender: { name: string | null; photo: string | null; title: string | null } | null;
};

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "USD"}`;
  }
};

/**
 * Public OneJob contract route. Reading needs no account; claiming and accepting always require
 * One ID. Every auth/payment detour carries this exact token back through the shared origin.
 */
export default function SharedContract() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const { lang } = useI18n();
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [contract, setContract] = useState<SharedContractData | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [moneyReady, setMoneyReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsPhoneValid, setSmsPhoneValid] = useState(false);

  const here = `/contract/${encodeURIComponent(token || "")}`;
  const offerOpen = !!contract && OPEN_OFFER_STATUSES.has(String(contract.status || "").toLowerCase());
  const smsConsentText = W(lang, SMS_CONSENT_TEXT_EN, SMS_CONSENT_TEXT_ES);

  useEffect(() => {
    if (!token) {
      setState("notfound");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("get-shared-contract", {
          body: { token },
        });
        if (!alive) return;
        if (invokeError) {
          let body: Record<string, unknown> | null = null;
          try { body = await (invokeError as any).context?.json?.(); } catch { /* not JSON */ }
          setState(body?.error === "not_found" ? "notfound" : "error");
          return;
        }
        const next = (data as { contract?: SharedContractData; error?: string } | null)?.contract;
        if (!next) {
          setState((data as { error?: string } | null)?.error === "not_found" ? "notfound" : "error");
          return;
        }
        setContract(next);
        setState("ok");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const youAre = contract?.senderRole === "payer" ? "payee" : "payer";

  useEffect(() => {
    if (!user || !contract || state !== "ok" || !offerOpen) {
      setMoneyReady(null);
      return;
    }
    let alive = true;
    (async () => {
      if (youAre === "payee") {
        const { data } = await supabase.functions.invoke("stripe-connect-status").catch(() => ({ data: null }));
        if (alive) setMoneyReady(!!(data?.payouts_enabled ?? data?.charges_enabled ?? data?.details_submitted));
      } else {
        const { data } = await supabase.from("payment_methods")
          .select("id").eq("user_id", user.id).limit(1);
        if (alive) setMoneyReady(!!data?.length);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, contract?.id, state, youAre, offerOpen]);

  const left = timeLeft(contract?.accept_deadline);
  const expired = !!contract?.expired || !!left?.expired;

  const schedule = useMemo(() => {
    if (!contract) return "—";
    if (contract.is_recurring) {
      return `${W(lang, "Recurring", "Recurrente")} · ${fmtDateLong(contract.start_date) || "—"}${
        contract.end_date ? ` – ${fmtDateLong(contract.end_date)}` : ""
      }`;
    }
    return `${fmtDateLong(contract.start_date) || "—"}${
      contract.start_time ? ` · ${fmtTimeRange(contract.start_time, contract.end_time)}` : ""
    }`;
  }, [contract, lang]);

  const claim = async () => {
    if (!user || !token) return false;
    const { data, error: claimError } = await supabase.rpc("claim_shared_contract", { p_token: token });
    if (claimError || !data || (Array.isArray(data) && data.length === 0)) {
      setError(claimError?.message || W(lang,
        "We couldn't attach this contract to your account. Ask the sender to resend it.",
        "No pudimos vincular este contrato a tu cuenta. Pide al remitente que lo reenvíe."));
      return false;
    }
    setClaimed(true);
    return true;
  };

  const setUpMoney = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    if (youAre === "payer") {
      nav(`/jobs/wallet?return=${encodeURIComponent(here)}`);
      return;
    }
    try {
      const { data, error: setupError } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { returnPath: here },
      });
      if (setupError) {
        setError(await fnError(setupError, W(lang,
          "We couldn't open payout setup. Try again in a moment.",
          "No pudimos abrir la configuración de pagos. Inténtalo de nuevo.")));
      } else if (data?.url) {
        window.location.assign(String(data.url));
        return;
      } else {
        setError(W(lang, "We couldn't open payout setup.", "No pudimos abrir la configuración de pagos."));
      }
    } catch (e) {
      setError(thrownError(e, W(lang, "We couldn't open payout setup.", "No pudimos abrir la configuración de pagos.")));
    }
    setBusy(false);
  };

  const accept = async () => {
    if (!contract || !user || busy) return;
    if (!offerOpen) {
      setError(W(lang,
        "This contract is no longer open for acceptance. Review its current status.",
        "Este contrato ya no está abierto para aceptación. Revisa su estado actual."));
      return;
    }
    if (expired) {
      setError(W(lang,
        "This contract's acceptance window has expired. Review its status or ask the sender for a new contract.",
        "El plazo para aceptar este contrato venció. Revisa su estado o pide al remitente un contrato nuevo."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!claimed && !(await claim())) {
        setBusy(false);
        return;
      }
      const { data: row, error: readError } = await supabase.from("agreements")
        .select("id, title, description, status, payment_amount, platform_fee, start_date, end_date, sender_id, recipient_id, conversation_id, payment_status, currency, location, start_time, end_time, is_recurring, created_at, updated_at, payer_id, payee_id, payment_rail, accept_window_hours, accept_deadline, sent_at, authorized_at, accepted_at, captured_at, payee_done_at, payer_done_at, released_at, paid_out_at, expired_at, payout_arrival_date, payout_status, payout_failure_message")
        .eq("id", contract.id).maybeSingle();
      if (readError || !row) throw new Error(W(lang,
        "We couldn't open this contract on your account.",
        "No pudimos abrir este contrato en tu cuenta."));

      const result = await acceptAgreement(row as Agreement, user.id);
      if (!result.ok) {
        setError(result.error || W(lang, "We couldn't accept this contract.", "No pudimos aceptar este contrato."));
        setBusy(false);
        return;
      }

      if (smsOptIn && smsPhoneValid) {
        const { error: consentError } = await supabase.from("agreements").update({
          sms_consent: true,
          sms_consent_at: new Date().toISOString(),
          sms_consent_phone: smsPhone,
          sms_consent_text: smsConsentText,
        }).eq("id", row.id);
        // Consent persistence is deliberately visible in diagnostics but cannot undo a contract
        // that was already accepted. With no stored consent, review-request will safely do nothing.
        if (consentError) console.warn("[contract-sms-consent] save failed", consentError.message);
      }
      nav(`/jobs/jobs?accepted=1${result.captured ? "&held=1" : ""}`);
    } catch (e) {
      setError(thrownError(e, W(lang, "We couldn't accept this contract.", "No pudimos aceptar este contrato.")));
      setBusy(false);
    }
  };

  if (state === "loading") return <Page><Status title={W(lang, "Loading contract…", "Cargando contrato…")} /></Page>;
  if (state !== "ok" || !contract) {
    return <Page><Status title={state === "notfound" ? W(lang, "This link isn't valid", "Este enlace no es válido") : W(lang, "Something went wrong", "Algo salió mal")} detail={W(lang, "Ask the sender to resend the contract, or try again in a moment.", "Pide al remitente que reenvíe el contrato o inténtalo de nuevo.")} /></Page>;
  }

  const step = !offerOpen ? "readonly" : expired ? "expired" : !user ? "signin" : moneyReady === null ? "checking" : moneyReady ? "ready" : "money";
  const readOnlyLabel = (() => {
    switch (String(contract.status || "").toLowerCase()) {
      case "accepted": return W(lang, "Contract accepted", "Contrato aceptado");
      case "completed": return W(lang, "Contract completed", "Contrato completado");
      case "cancelled": return W(lang, "Contract cancelled", "Contrato cancelado");
      case "declined":
      case "rejected": return W(lang, "Contract declined", "Contrato rechazado");
      default: return W(lang, "Contract is not open for acceptance", "El contrato no está abierto para aceptación");
    }
  })();

  return (
    <Page>
      <main className="mx-auto w-full max-w-lg px-4 pb-40 pt-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Wordmark wordmark={CONFIGS.onejob.wordmark} h={30} />
          <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-bold text-brand">
            {W(lang, "Contract invite", "Invitación de contrato")}
          </span>
        </div>

        <p className="mb-3 rounded-xl bg-brand/10 px-3 py-2 text-center text-sm font-semibold text-brand">
          {contract.sender?.name || W(lang, "Someone", "Alguien")} {W(lang, "sent you a OneJob contract.", "te envió un contrato de OneJob.")}
        </p>

        <section className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-xl dark:border-white/10 dark:bg-ink">
          <header className="bg-gradient-to-br from-brand/20 via-brand/5 to-transparent px-6 pb-5 pt-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">OneJob</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight">{contract.title || W(lang, "Untitled contract", "Contrato sin título")}</h1>
            <p className="mt-2 text-sm opacity-65">{contract.sender?.name || "—"}{contract.sender?.title ? ` · ${contract.sender.title}` : ""}</p>
          </header>

          <div className="space-y-4 px-6 py-6">
            {contract.description && (
              <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-40">{W(lang, "The job", "El trabajo")}</p>
                {/^\s*<\/?[a-z][\s\S]*>/i.test(contract.description)
                  ? <div className="text-[15px] leading-relaxed opacity-90 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(contract.description) }} />
                  : <p className="whitespace-pre-wrap text-[15px] leading-relaxed opacity-90">{contract.description}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label={W(lang, "When", "Cuándo")}>{schedule}</Field>
              <Field label={W(lang, "Location", "Lugar")}>{contract.location || "—"}</Field>
            </div>

            <div className="rounded-2xl bg-ink/[0.04] p-4 dark:bg-white/[0.06]">
              <MoneyLine label={W(lang, "Amount", "Monto")} value={money(contract.amount, contract.currency)} />
              <MoneyLine label={W(lang, "Service fee", "Comisión")} value={contract.fee === null ? W(lang, "Not recorded", "No registrada") : money(contract.fee, contract.currency)} />
              <div className="my-2 h-px bg-ink/10 dark:bg-white/10" />
              <MoneyLine strong label={youAre === "payer" ? W(lang, "You pay", "Pagas") : W(lang, "You receive", "Recibes")} value={youAre === "payer" && contract.total === null ? W(lang, "Not recorded", "No registrado") : money(youAre === "payer" ? contract.total! : contract.amount, contract.currency)} />
            </div>

            {contract.accept_deadline && (
              <div className={`rounded-2xl border p-4 text-sm ${expired ? "border-red-500/30 bg-red-500/[0.07]" : "border-ink/10 bg-ink/[0.03] dark:border-white/10 dark:bg-white/[0.05]"}`}>
                <p className={`font-semibold ${expired ? "text-red-500" : ""}`}>
                  {expired ? W(lang, "This contract has expired", "Este contrato venció") : `⏳ ${left?.text || ""}`}
                </p>
                {!expired && <p className="mt-1 text-xs opacity-65">{contract.accept_window_hours ? `${windowLabel(contract.accept_window_hours)} · ` : ""}{fmtDateTimeShort(contract.accept_deadline)}</p>}
              </div>
            )}

            {user && offerOpen && !expired && (
              <div className="rounded-2xl border border-ink/10 p-4 dark:border-white/10">
                <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed">
                  <input type="checkbox" checked={smsOptIn} onChange={(event) => setSmsOptIn(event.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-brand" />
                  <span>{smsConsentText}</span>
                </label>
                {smsOptIn && <div className="mt-3"><PhoneInput value={smsPhone} onChange={(value, valid) => { setSmsPhone(value); setSmsPhoneValid(valid); }} placeholder={W(lang, "Mobile number", "Número móvil")} /></div>}
                <p className="mt-2 text-[11px] opacity-50">{W(lang, "Optional. You can accept without it.", "Opcional. Puedes aceptar sin marcarlo.")}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg border-t border-ink/10 bg-paper/95 p-4 backdrop-blur dark:border-white/10 dark:bg-ink/95">
        {step === "readonly" && <button disabled className="btn-primary w-full opacity-50">{readOnlyLabel}</button>}
        {step === "expired" && <button disabled className="btn-primary w-full opacity-50">{W(lang, "Contract expired", "Contrato vencido")}</button>}
        {step === "signin" && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => nav(`/signin?next=${encodeURIComponent(here)}`)} className="btn-primary">{W(lang, "Sign in to accept", "Ingresar para aceptar")}</button>
            <button onClick={() => nav(`/join?next=${encodeURIComponent(here)}`)} className="btn-ghost">{W(lang, "Create One ID", "Crear One ID")}</button>
          </div>
        )}
        {step === "checking" && <button disabled className="btn-primary w-full opacity-60">{W(lang, "Checking your account…", "Verificando tu cuenta…")}</button>}
        {step === "money" && <button onClick={setUpMoney} disabled={busy} className="btn-primary w-full disabled:opacity-50">{busy ? W(lang, "Opening…", "Abriendo…") : youAre === "payee" ? W(lang, "Set up payouts", "Configurar pagos") : W(lang, "Add a payment method", "Agregar método de pago")}</button>}
        {step === "ready" && <button onClick={accept} disabled={busy || (smsOptIn && !smsPhoneValid)} className="btn-primary w-full disabled:opacity-50">{busy ? W(lang, "Accepting…", "Aceptando…") : W(lang, "Accept this contract", "Aceptar este contrato")}</button>}
        {error && <p className="mt-2 text-center text-xs font-semibold text-red-500">{error}</p>}
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-paper text-ink dark:bg-ink dark:text-paper">{children}</div>;
}

function Status({ title, detail }: { title: string; detail?: string }) {
  return <div className="mx-auto max-w-sm px-5 py-24 text-center"><h1 className="text-xl font-extrabold">{title}</h1>{detail && <p className="mt-2 text-sm opacity-60">{detail}</p>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-xl bg-ink/[0.03] px-3 py-2 dark:bg-white/[0.05]"><p className="text-[10px] font-bold uppercase tracking-wide opacity-40">{label}</p><p className="mt-0.5 text-sm font-semibold">{children}</p></div>;
}

function MoneyLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 text-sm ${strong ? "font-extrabold" : "opacity-70"}`}><span>{label}</span><span>{value}</span></div>;
}
