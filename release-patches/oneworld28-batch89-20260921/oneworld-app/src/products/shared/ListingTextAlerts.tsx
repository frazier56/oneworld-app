import { useEffect, useState } from "react";
import { supabase, useOneId, Toggle, W } from "@oneworld/shell";

/* ============================================================================================
 * TEXT ME ABOUT SHOWINGS AND MESSAGES — one member-level switch, shown inside the listing form.
 *
 * Lee, 2 Oct 2026 (relayed by Studio): *"receive text notifications to your phone when someone
 * books a showing or sends a message … configured inside the listing when you're creating it."*
 *
 * The SENDING lives in the database (triggers on viewings and messages queue the texts; the
 * existing dispatcher sends them through Twilio), so no screen has to remember to send anything.
 * This component only reads and writes the switch — `onehome_listing_alerts()` /
 * `set_onehome_listing_alerts(on)` — and, because Studio's rule is "never a dead toggle", it
 * verifies the phone right here when the member has no verified number yet (the same add-a-phone
 * code path sign-up uses: updateUser({ phone }) then verifyOtp type "phone_change").
 *
 * It is the member's setting, not the listing's: switching it on in one listing switches it on for
 * all of them, and the note says so.
 * ==========================================================================================*/
type State = { on: boolean; sms_ready: boolean; phone_last4?: string | null };

export default function ListingTextAlerts({ lang }: { lang: string }) {
  const { userId } = useOneId();
  const [s, setS] = useState<State | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  /* inline phone verification */
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoadErr(false);
    void supabase.rpc("onehome_listing_alerts").then(({ data, error }) => {
      if (!live) return;
      if (error || !data) setLoadErr(true); else setS(data as State);
    });
    return () => { live = false; };
  }, [userId, retry]);

  if (!userId) return null;

  async function save(on: boolean) {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("set_onehome_listing_alerts", { p_on: on });
    setBusy(false);
    if (error || !data) { setErr(W(lang, "Your choice was not saved. Please try again.", "Su preferencia no se guardó. Intente de nuevo.")); return; }
    setS(data as State);
  }

  const e164 = () => "+" + phone.replace(/\D/g, "");
  async function sendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) { setErr(W(lang, "Enter your mobile number with the country code, e.g. +57 300 123 4567.", "Ingrese su celular con el indicativo del país, ej.: +57 300 123 4567.")); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ phone: e164() });
    setBusy(false);
    if (error) {
      setErr(/already|exists/i.test(error.message)
        ? W(lang, "That number is already used by another account.", "Ese número ya lo usa otra cuenta.")
        : W(lang, "We couldn't send the code. Check the number and try again.", "No pudimos enviar el código. Revise el número e inténtelo de nuevo."));
      return;
    }
    setSent(true);
  }
  async function verify() {
    if (code.trim().length < 6) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.verifyOtp({ phone: e164(), token: code.trim(), type: "phone_change" });
    setBusy(false);
    if (error) { setErr(W(lang, "That code didn't work. Check it, or send a new one.", "Ese código no funcionó. Revíselo o pida uno nuevo.")); return; }
    setSent(false); setCode("");
    /* They verified in order to turn this on — do it, then show the result. */
    await save(true);
  }

  return (
    <div className="mt-4 space-y-2" aria-label={W(lang, "Text alerts", "Alertas por SMS")}>
      {loadErr ? (
        <div role="alert" className="flex items-center justify-between gap-3 text-[13px]">
          <span>{W(lang, "Couldn't load your text alerts.", "No se pudieron cargar sus alertas por SMS.")}</span>
          <button type="button" className="btn-ghost text-[13px]" onClick={() => setRetry(x => x + 1)}>{W(lang, "Try again", "Reintentar")}</button>
        </div>
      ) : !s ? (
        <div className="ow-shimmer h-12 rounded-xl" />
      ) : (
        <>
          <fieldset disabled={busy || (!s.sms_ready && !s.on)} className="disabled:opacity-60">
            <Toggle on={s.on} onChange={v => void save(v)}
              label={W(lang, "Text me about showings and messages", "Envíenme SMS sobre visitas y mensajes")}
              note={s.sms_ready
                ? W(lang,
                    `To the phone ending ${s.phone_last4 ?? "····"}: viewings booked, requested or cancelled, and new messages. All your listings. Message rates may apply; turn off any time.`,
                    `Al teléfono terminado en ${s.phone_last4 ?? "····"}: visitas agendadas, solicitadas o canceladas, y mensajes nuevos. Todos sus anuncios. Pueden aplicar tarifas de mensajes; desactívelo cuando quiera.`)
                : W(lang, "Verify your phone below to turn this on.", "Verifique su teléfono abajo para activar esta opción.")} />
          </fieldset>

          {!s.sms_ready && (
            <div className="space-y-2 pt-1">
              {!sent ? (
                <div className="flex gap-2">
                  <input className="input h-11 min-w-0 flex-1 text-[14px]" type="tel" inputMode="tel" autoComplete="tel"
                    placeholder="+57 300 123 4567" value={phone} onChange={e => setPhone(e.target.value)}
                    aria-label={W(lang, "Mobile number", "Número de celular")} />
                  <button type="button" disabled={busy} onClick={() => void sendCode()}
                    className="btn-primary shrink-0 whitespace-nowrap px-4 text-[13.5px] disabled:opacity-50">
                    {W(lang, "Send code", "Enviar código")}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className="input h-11 min-w-0 flex-1 text-center text-[16px] tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={6} placeholder="••••••" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                    aria-label={W(lang, "6-digit code", "Código de 6 dígitos")} />
                  <button type="button" disabled={busy || code.length < 6} onClick={() => void verify()}
                    className="btn-primary shrink-0 whitespace-nowrap px-4 text-[13.5px] disabled:opacity-50">
                    {W(lang, "Verify", "Verificar")}
                  </button>
                </div>
              )}
              {sent && (
                <button type="button" className="text-[12px] font-bold text-brand-deep dark:text-brand-light" onClick={() => { setSent(false); setCode(""); }}>
                  {W(lang, "Change number or resend", "Cambiar número o reenviar")}
                </button>
              )}
            </div>
          )}
          {busy && <p role="status" className="text-[12px] opacity-60">{W(lang, "Saving…", "Guardando…")}</p>}
          {err && <p role="alert" className="text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
        </>
      )}
    </div>
  );
}
