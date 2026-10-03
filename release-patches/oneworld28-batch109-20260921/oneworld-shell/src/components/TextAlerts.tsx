import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOneId } from "../lib/oneId";
import { W, Wt } from "../lib/i18n";

/* The same switch Settings uses for push notifications, so the two lists on one screen read as
   one list (UAT, 2 Oct 2026: the boxed checkbox rows looked like a different product there). */
function SwitchRow({ on, onChange, label, note, strong }: { on: boolean; onChange: (v: boolean) => void; label: string; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className={`block text-[14px] ${strong ? "font-bold" : "font-medium"}`}>{label}</span>
        {note && <span className="mt-0.5 block text-[11.5px] leading-relaxed opacity-60">{note}</span>}
      </span>
      <button type="button" onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

/* ============================================================================================
 * TEXT ALERTS — one switch for the whole of One World, then the types underneath.
 *
 * Lee, 2 Oct 2026: *"they should get alerts anytime they get a message … no matter the alert …
 * they should be able to configure their notifications … jobs, events, homes … within each one
 * a subset."* Until the phone app exists, the website cannot wake a phone — a text can.
 *
 * ONE component, used in two places (same experience = same code):
 *   · Settings → every type        (scope "all")
 *   · the listing form → the Homes types only (scope "homes"), because that is the question a
 *     host has at that moment. It is the same member-level setting, and the note says so.
 *
 * The SENDING lives in the database: triggers on messages, viewings and contracts queue the
 * texts and the existing dispatcher sends them. This only reads and writes the choice through
 * `my_text_alerts()` / `set_text_alerts(on, off)`. "Never a dead toggle": with no verified phone
 * the master is replaced by an inline add-a-phone step (the sign-up code path: updateUser({phone})
 * then verifyOtp type "phone_change"), and turning on happens the moment the code is accepted.
 * ==========================================================================================*/
type State = { on: boolean; off: string[]; sms_ready: boolean; phone_last4?: string | null; stopped?: boolean };
type Kind = "msg_homes" | "msg_jobs" | "msg_events" | "msg_other" | "homes_showings" | "homes_bookings" | "contracts" | "homes_follows";

const KINDS: { k: Kind; en: string; es: string; homes: boolean }[] = [
  { k: "msg_homes",      en: "Messages about homes",                es: "Mensajes sobre inmuebles",           homes: true },
  { k: "homes_showings", en: "Viewings: requested, booked, changed", es: "Visitas: solicitadas, agendadas, cambios", homes: true },
  /* Overlay 29: reservation texts used to have their own switch on the listing form (two "text me"
     switches on one screen). They are a kind of this one switch now. */
  { k: "homes_bookings", en: "Stay requests and bookings",          es: "Solicitudes de estadía y reservas", homes: true },
  { k: "contracts",      en: "Contracts and leases to sign",        es: "Contratos y arriendos para firmar",  homes: true },
  { k: "homes_follows",  en: "New homes from agents I follow",       es: "Inmuebles nuevos de agentes que sigo", homes: true },
  { k: "msg_jobs",       en: "Messages in OneJob",                  es: "Mensajes en OneJob",                 homes: false },
  { k: "msg_events",     en: "Messages in OneEvent",                es: "Mensajes en OneEvent",               homes: false },
  { k: "msg_other",      en: "All other messages",                  es: "Todos los demás mensajes",           homes: false },
];

export default function TextAlerts({ lang, scope = "all" }: { lang: string; scope?: "all" | "homes" }) {
  const { userId } = useOneId();
  const [s, setS] = useState<State | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoadErr(false);
    void supabase.rpc("my_text_alerts").then(({ data, error }) => {
      if (!live) return;
      if (error || !data) setLoadErr(true); else setS(data as State);
    });
    return () => { live = false; };
  }, [userId, retry]);

  if (!userId) return null;

  async function save(on: boolean | null, off: string[] | null) {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("set_text_alerts", { p_on: on, p_off: off });
    setBusy(false);
    if (error?.code === "OH013") {
      /* They replied STOP to one of our texts: the carrier blocks every text until they reply START. */
      setErr(W(lang, "You replied STOP to one of our texts. Reply START to it first, then turn this on.",
                     "Usted respondió STOP a uno de nuestros SMS. Responda START a ese mensaje y luego actívelo aquí."));
      return;
    }
    if (error || !data) { setErr(W(lang, "Your choice was not saved. Please try again.", "Su preferencia no se guardó. Intente de nuevo.")); return; }
    setS(data as State);
  }

  const e164 = () => "+" + phone.replace(/\D/g, "");
  async function sendCode() {
    if (phone.replace(/\D/g, "").length < 8) { setErr(W(lang, "Enter your mobile number with the country code, e.g. +57 300 123 4567.", "Ingrese su celular con el indicativo del país, ej.: +57 300 123 4567.")); return; }
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
    await save(true, null);            // they verified in order to turn this on
  }

  const kinds = KINDS.filter(x => scope === "all" || x.homes);
  const flip = (k: Kind, on: boolean) => {
    if (!s) return;
    const off = on ? s.off.filter(x => x !== k) : [...new Set([...s.off, k])];
    setS({ ...s, off });               // a switch moves on tap; save() replaces it with the truth
    void save(null, off);
  };

  return (
    <div className="space-y-2" aria-label={W(lang, "Text alerts", "Alertas por SMS")}>
      {loadErr ? (
        <div role="alert" className="flex items-center justify-between gap-3 text-[13px]">
          <span>{W(lang, "Couldn't load your text alerts.", "No se pudieron cargar sus alertas por SMS.")}</span>
          <button type="button" className="btn-ghost text-[13px]" onClick={() => setRetry(x => x + 1)}>{W(lang, "Try again", "Reintentar")}</button>
        </div>
      ) : !s ? (
        <div className="ow-shimmer h-12 rounded-xl" />
      ) : (
        <>
          {s.sms_ready ? (
            <fieldset disabled={busy} className="disabled:opacity-60">
              <SwitchRow strong on={s.on} onChange={v => void save(v, null)}
                label={W(lang, "Text me", "Envíenme SMS")}
                note={Wt(lang, "To the phone ending {0}. Never the message itself, just who and a link. Rates may apply; turn off any time.", "Al teléfono terminado en {0}. Nunca el mensaje, solo quién y un enlace. Pueden aplicar tarifas; desactívelo cuando quiera.", [s.phone_last4 ?? "····"])} />
              {/* Overlay 33: a STOP reply is honoured here too, not only at the carrier. */}
              {s.stopped && (
                <p className="pt-1 text-[11.5px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
                  {W(lang, "Paused: you replied STOP to one of our texts. Reply START to it to allow texts again.",
                           "En pausa: usted respondió STOP a uno de nuestros SMS. Responda START para volver a recibirlos.")}
                </p>
              )}
            </fieldset>
          ) : (
            <div className="space-y-2">
              <p className="text-[13.5px] font-bold">{W(lang, "Get a text when something happens", "Reciba un SMS cuando pase algo")}</p>
              <p className="text-[11.5px] leading-relaxed opacity-60">{W(lang, "Verify your mobile number to turn texts on. Rates may apply; turn off any time.", "Verifique su celular para activar los SMS. Pueden aplicar tarifas; desactívelo cuando quiera.")}</p>
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
                <>
                  <div className="flex gap-2">
                    <input className="input h-11 min-w-0 flex-1 text-center text-[16px] tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code"
                      maxLength={6} placeholder="••••••" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                      aria-label={W(lang, "6-digit code", "Código de 6 dígitos")} />
                    <button type="button" disabled={busy || code.length < 6} onClick={() => void verify()}
                      className="btn-primary shrink-0 whitespace-nowrap px-4 text-[13.5px] disabled:opacity-50">
                      {W(lang, "Verify", "Verificar")}
                    </button>
                  </div>
                  <button type="button" className="text-[12px] font-bold text-brand-deep dark:text-brand-light" onClick={() => { setSent(false); setCode(""); }}>
                    {W(lang, "Change number or resend", "Cambiar número o reenviar")}
                  </button>
                </>
              )}
            </div>
          )}

          {s.on && (
            <fieldset disabled={busy} className="border-t border-ink/10 pt-3 dark:border-white/10"
              aria-label={scope === "homes" ? W(lang, "Text me about", "Envíenme SMS sobre") : W(lang, "What to text me about", "Sobre qué enviarme SMS")}>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] opacity-50">
                {scope === "homes" ? W(lang, "Text me about", "Envíenme SMS sobre") : W(lang, "What to text me about", "Sobre qué enviarme SMS")}
              </p>
              {kinds.map(x => (
                <SwitchRow key={x.k} on={!s.off.includes(x.k)} onChange={v => flip(x.k, v)} label={W(lang, x.en, x.es)} />
              ))}
              {scope === "homes" && (
                <p className="pt-1 text-[11.5px] leading-relaxed opacity-55">
                  {W(lang, "This is your setting for all your listings. Jobs, events and other messages are in Settings.",
                           "Es su ajuste para todos sus anuncios. Trabajos, eventos y otros mensajes están en Ajustes.")}
                </p>
              )}
            </fieldset>
          )}
          {busy && <p role="status" className="text-[12px] opacity-60">{W(lang, "Saving…", "Guardando…")}</p>}
          {err && <p role="alert" className="text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
        </>
      )}
    </div>
  );
}
