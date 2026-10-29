import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase, W, useI18n } from "@oneworld/shell";

/* ============================================================================================
 * PAY IN PESOS — Nequi and PSE on One World's own screens (Lee, 28 Oct 2026).
 * *"Wompi is in the back end processing payments… in the front end, people just select Nequi
 * or PSE, click, click, and boom. They don't realize Wompi is handling it."*
 *
 * ONE sheet for every app. The app passes WHAT is being paid (`purpose` + its record id); the
 * server works out the amount from that record — the browser never sends a price it chose.
 *
 *   Nequi → phone number → "Pay" → the customer approves the push in their Nequi app → this
 *           sheet sees the result by itself.
 *   PSE   → bank, ID, name, phone → "Pay" → the customer's own bank page (PSE always does this;
 *           no app can avoid it) → back to `returnPath`, where `useLocalPayReturn` shows the result.
 *
 * Wompi's name appears once, in the legal line under the button, because Colombian data law
 * makes the customer accept Wompi's terms before paying. Nowhere else.
 * ============================================================================================ */

export type LocalPayResult = { id: string; status: string; status_message?: string | null };
type Config = { env: string; terms_url: string; personal_data_url: string; banks: { code: string; name: string }[] };
type Method = "NEQUI" | "PSE";

const FINAL = new Set(["APPROVED", "DECLINED", "VOIDED", "ERROR"]);
const PENDING_KEY = "ow.localpay.pending";

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("wompi-pay", { body });
  if (error) {
    let code = "network";
    try { code = (await (error as any).context?.json())?.error ?? code; } catch { /* keep generic */ }
    throw new Error(code);
  }
  return data;
}

function errorText(code: string, lang: string): string {
  const t: Record<string, [string, string]> = {
    nequi_phone_invalid: ["Enter the 10-digit phone number of your Nequi account.", "Escriba el celular de 10 dígitos de su cuenta Nequi."],
    pse_bank_invalid: ["Choose your bank.", "Elija su banco."],
    pse_id_invalid: ["Enter your ID number.", "Escriba su número de documento."],
    pse_name_required: ["Enter your full name.", "Escriba su nombre completo."],
    pse_phone_required: ["Enter your 10-digit phone number.", "Escriba su celular de 10 dígitos."],
    terms_not_accepted: ["Tick the box to accept the payment terms.", "Marque la casilla para aceptar los términos de pago."],
    sign_in_required: ["Sign in to pay.", "Ingrese para pagar."],
    email_required: ["Enter your email for the receipt.", "Escriba su correo para el recibo."],
    name_required: ["Enter your full name.", "Escriba su nombre completo."],
    already_paid: ["This was already paid.", "Esto ya se pagó."],
    pay_link_closed: ["This payment was cancelled by the business.", "El negocio canceló este cobro."],
    pay_link_invalid: ["This payment link isn't valid.", "Este enlace de pago no es válido."],
    payment_in_progress: ["A payment is already in progress. Check your Nequi app or bank.", "Ya hay un pago en curso. Revise su app Nequi o su banco."],
    wompi_not_configured: ["Paying in pesos isn't switched on yet.", "El pago en pesos aún no está activo."],
  };
  const hit = t[code];
  return hit ? W(lang, hit[0], hit[1]) : W(lang, "The payment didn't go through. Try again.", "El pago no se pudo hacer. Intente de nuevo.");
}

const INPUT = `h-[50px] w-full rounded-[16px] border border-ink/15 bg-white/80 px-4 text-[15.5px] font-semibold
  outline-none focus:border-ink/50 dark:border-white/20 dark:bg-white/[0.08] dark:focus:border-white/60`;
const SHEET = `w-full max-w-[440px] rounded-[30px] border p-5 pt-[22px] text-ink shadow-[0_20px_50px_rgba(0,0,0,.4)]
  backdrop-blur-2xl dark:text-white
  border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,.96),rgba(242,240,252,.94))]
  dark:border-white/20 dark:bg-[linear-gradient(160deg,rgba(28,31,56,.97),rgba(15,17,32,.95))]`;
const PRIMARY = `ow-tap grid h-[52px] w-full place-items-center rounded-[18px] bg-[#2C2622] text-[16px] font-extrabold
  text-white transition active:scale-[.98] disabled:opacity-40 dark:bg-white dark:text-[#201B16]`;

export function LocalPaySheet({ purpose, purposeRef, amountLabel, extra, returnPath, onClose, onDone, payToken }: {
  purpose: string;
  /** Guest checkout (OnePay QR): the scanned token is the customer's only key; no account needed. */
  payToken?: string;
  purposeRef?: string;
  /** Shown on the button, e.g. "COP 120.000". Display only — the server sets the real amount. */
  amountLabel: string;
  /** Purpose-specific fields the server resolver reads (never a price for a real purpose). */
  extra?: Record<string, unknown>;
  /** Where PSE brings the customer back to. Must be an in-app path. */
  returnPath: string;
  onClose: () => void;
  onDone: (r: LocalPayResult) => void;
}) {
  const { lang } = useI18n();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [cfgErr, setCfgErr] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("NEQUI");
  const [phone, setPhone] = useState("");
  const [bank, setBank] = useState("");
  const [idType, setIdType] = useState("CC");
  const [idNum, setIdNum] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const guest = !!payToken;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<LocalPayResult | null>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    call({ action: "config" }).then(setCfg).catch(e => setCfgErr((e as Error).message));
    first.current?.focus({ preventScroll: true });
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Nequi: the customer approves on their phone; we watch for the answer. */
  useEffect(() => {
    if (!waiting || FINAL.has(waiting.status)) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const r = await call({ action: "status", payment_id: waiting.id, pay_token: payToken });
        if (FINAL.has(r.status)) { setWaiting(r); onDone(r); return; }
      } catch { /* keep waiting; a blip is not a failure */ }
      if (Date.now() - started < 10 * 60_000) setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 3000);
    return () => { stop = true; clearTimeout(t); };
  }, [waiting, onDone]);

  const digits = (s: string) => s.replace(/\D/g, "");
  const guestOk = !guest || (name.trim().length >= 3 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()));
  const ready = terms && !!cfg && guestOk && (method === "NEQUI"
    ? /^3\d{9}$/.test(digits(phone))
    : !!bank && idNum.trim().length >= 5 && name.trim().length >= 3 && /^3\d{9}$/.test(digits(phone)));

  async function pay() {
    setBusy(true); setErr(null);
    try {
      const r = await call({
        action: "create", purpose, purpose_ref: purposeRef, ...extra, method, pay_token: payToken,
        ...(guest ? { email: email.trim(), full_name: name.trim() } : {}),
        accepted_terms: terms, phone: digits(phone), return_path: returnPath,
        ...(method === "PSE" ? { bank_code: bank, legal_id_type: idType, legal_id: idNum.trim(), full_name: name.trim() } : {}),
      });
      if (method === "PSE") {
        if (r.redirect_url) {
          try { sessionStorage.setItem(PENDING_KEY, r.id); if (payToken) sessionStorage.setItem(PENDING_KEY + ".token", payToken); } catch { /* the return URL carries the id too */ }
          window.location.assign(r.redirect_url);
          return;
        }
        if (FINAL.has(r.status)) { onDone(r); setWaiting(r); } else setErr("network");
      } else {
        setWaiting(r);
        if (FINAL.has(r.status)) onDone(r);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Method, label: string) => (
    <button type="button" ref={m === "NEQUI" ? first : undefined} onClick={() => { setMethod(m); setErr(null); }}
      aria-pressed={method === m}
      className={`ow-tap h-[46px] flex-1 rounded-[14px] text-[15px] font-extrabold transition
        ${method === m ? "bg-[#2C2622] text-white dark:bg-white dark:text-[#201B16]" : "border border-ink/20 dark:border-white/25"}`}>
      {label}
    </button>
  );

  let body;
  if (cfgErr) {
    body = <p className="m-0 text-[14.5px]">{errorText(cfgErr, lang)}</p>;
  } else if (waiting) {
    const s = waiting.status;
    body = (
      <div className="flex flex-col items-center gap-3 py-2 text-center" aria-live="polite">
        {s === "APPROVED" ? (
          <><p className="m-0 text-[20px] font-black">{W(lang, "Paid", "Pagado")}</p>
            <p className="m-0 text-[14px] opacity-75">{W(lang, "Your payment went through.", "Su pago se realizó.")}</p></>
        ) : FINAL.has(s) ? (
          <><p className="m-0 text-[20px] font-black">{W(lang, "Not paid", "No se pagó")}</p>
            <p className="m-0 text-[14px] opacity-75">{W(lang, "Nothing was charged. You can try again.", "No se cobró nada. Puede intentar de nuevo.")}</p></>
        ) : (
          <><span className="h-9 w-9 animate-spin rounded-full border-[3px] border-current border-t-transparent" aria-hidden />
            <p className="m-0 text-[17px] font-extrabold">{W(lang, "Open Nequi to approve", "Abra Nequi para aprobar")}</p>
            <p className="m-0 text-[14px] opacity-75">{W(lang, "We sent the payment to your Nequi app.", "Le enviamos el pago a su app Nequi.")}</p></>
        )}
        <button type="button" onClick={() => (FINAL.has(s) && s !== "APPROVED" ? setWaiting(null) : onClose())} className={`${PRIMARY} mt-1`}>
          {s === "APPROVED" ? W(lang, "Done", "Listo") : FINAL.has(s) ? W(lang, "Try again", "Intentar de nuevo") : W(lang, "Close", "Cerrar")}
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex gap-2">{tab("NEQUI", "Nequi")}{tab("PSE", "PSE")}</div>
        <div className="mt-3.5 flex flex-col gap-2.5">
          {guest && (
            <>
              <input value={name} onChange={e => setName(e.target.value)} autoComplete="name"
                placeholder={W(lang, "Your full name", "Su nombre completo")} className={INPUT} />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" inputMode="email"
                placeholder={W(lang, "Email for your receipt", "Correo para su recibo")} className={INPUT} />
            </>
          )}
          {method === "PSE" && (
            <>
              <select value={bank} onChange={e => setBank(e.target.value)} className={INPUT} aria-label={W(lang, "Your bank", "Su banco")}>
                <option value="">{cfg ? W(lang, "Your bank", "Su banco") : W(lang, "Loading banks…", "Cargando bancos…")}</option>
                {cfg?.banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
              <div className="flex gap-2">
                <select value={idType} onChange={e => setIdType(e.target.value)} className={`${INPUT} w-[92px] shrink-0 px-3`} aria-label={W(lang, "ID type", "Tipo de documento")}>
                  <option value="CC">CC</option><option value="CE">CE</option><option value="NIT">NIT</option>
                </select>
                <input value={idNum} onChange={e => setIdNum(e.target.value)} inputMode="numeric" autoComplete="off"
                  placeholder={W(lang, "ID number", "Número de documento")} className={INPUT} />
              </div>
              {!guest && <input value={name} onChange={e => setName(e.target.value)} autoComplete="name"
                placeholder={W(lang, "Full name", "Nombre completo")} className={INPUT} />}
            </>
          )}
          <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national"
            placeholder={method === "NEQUI" ? W(lang, "Nequi phone number", "Celular Nequi") : W(lang, "Phone number", "Celular")}
            className={INPUT} />
        </div>
        <label className="mt-3 flex items-start gap-2.5 text-[12.5px] leading-snug opacity-85">
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#2C2622]" />
          <span>
            {W(lang, "I accept the ", "Acepto los ")}
            <a href={cfg?.terms_url} target="_blank" rel="noopener noreferrer" className="underline">{W(lang, "payment terms", "términos de pago")}</a>
            {W(lang, " and the ", " y la ")}
            <a href={cfg?.personal_data_url} target="_blank" rel="noopener noreferrer" className="underline">{W(lang, "use of my data", "autorización de datos")}</a>
            {W(lang, " of Wompi, who processes this payment.", " de Wompi, que procesa este pago.")}
          </span>
        </label>
        {err && <p role="alert" className="m-0 mt-2.5 text-[13.5px] font-bold text-[#C0392B] dark:text-[#FF8A80]">{errorText(err, lang)}</p>}
        <button type="button" disabled={!ready || busy} onClick={pay} className={`${PRIMARY} mt-3.5`}>
          {busy ? W(lang, "One moment…", "Un momento…") : `${W(lang, "Pay", "Pagar")} ${amountLabel}`}
        </button>
        {cfg?.env === "sandbox" && (
          <p className="m-0 mt-2 text-center text-[11.5px] font-bold opacity-60">{W(lang, "Test mode — no real money", "Modo prueba — sin dinero real")}</p>
        )}
      </>
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={W(lang, "Pay in pesos", "Pagar en pesos")}
      className="fixed inset-0 z-[190] flex items-end justify-center bg-black/30 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:items-center"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={SHEET}>
        <p className="m-0 mb-3.5 text-[22px] font-black tracking-[-0.01em]">{W(lang, "Pay in pesos", "Pagar en pesos")}</p>
        {body}
      </div>
    </div>,
    document.body,
  );
}

/** On the page PSE returns to: reads `?ow_pay=`, waits for the bank's answer, returns it once. */
export function useLocalPayReturn(): LocalPayResult | null | "checking" {
  const [state, setState] = useState<LocalPayResult | null | "checking">(null);
  useEffect(() => {
    let id: string | null = null;
    try { id = new URLSearchParams(window.location.search).get("ow_pay"); } catch { /* none */ }
    if (!id) { try { id = sessionStorage.getItem(PENDING_KEY); } catch { /* none */ } }
    if (!id) return;
    setState("checking");
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        let tok: string | undefined;
        try { tok = sessionStorage.getItem(PENDING_KEY + ".token") ?? undefined; } catch { /* none */ }
        const r = await call({ action: "status", payment_id: id, pay_token: tok });
        if (FINAL.has(r.status)) {
          try { sessionStorage.removeItem(PENDING_KEY); } catch { /* fine */ }
          setState(r); return;
        }
      } catch { /* retry */ }
      if (Date.now() - started < 3 * 60_000) setTimeout(tick, 2500); else setState({ id: id!, status: "PENDING" });
    };
    tick();
    return () => { stop = true; };
  }, []);
  return state;
}
