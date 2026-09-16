import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useOneId } from "../lib/oneId";
import { productHref } from "../routes";
import { getAppLinks } from "../lib/appLinks";
import { useAsync } from "../lib/useAsync";
import { PUBLIC_SECTIONS, isSectionPublic, setSectionPublic, type SectionKey } from "../lib/publicSections";
import type { AppKey } from "../lib/oneWorld";
import ScreenHeading from "../components/ScreenHeading";
import LanguageSelect from "../components/LanguageSelect";
import CurrencyPicker from "../components/CurrencyPicker";
import { getNotifPrefs, setNotifPref, NOTIF_DEFAULTS, type NotifPrefs, type NotifKey } from "../lib/notificationPrefs";
import { supabase } from "../lib/supabase";
import { isPasswordBreached, passwordAcceptable, passwordRules } from "../lib/passwordRules";
import Turnstile from "../components/Turnstile";

/** A real switch, not a coloured rectangle — role + accessible name (audit, Jul 25). */
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} aria-label={label}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const inputClass = "w-full rounded-xl border border-ink/10 bg-white/75 px-3 py-2.5 text-[14px] outline-none transition focus:border-teal dark:border-white/15 dark:bg-white/5";
const PASSWORD_RESULT_KEY = "oneworld-password-change-result";
const PASSWORD_RESULT_EVENT = "oneworld-password-change-result";
const PASSWORD_RESULT_TTL_MS = 60_000;

function readPasswordResult() {
  const stored = window.sessionStorage.getItem(PASSWORD_RESULT_KEY);
  if (!stored) return "";
  try {
    const result = JSON.parse(stored) as { message?: unknown; createdAt?: unknown };
    if (typeof result.message === "string" && typeof result.createdAt === "number"
      && Date.now() - result.createdAt <= PASSWORD_RESULT_TTL_MS) return result.message;
  } catch {
    // Ignore the pre-TTL string format left by an older bundle.
  }
  window.sessionStorage.removeItem(PASSWORD_RESULT_KEY);
  return "";
}

function AccountDetails({ userId, email, isEs }: { userId: string; email: string | null; isEs: boolean }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_my_account_settings").maybeSingle().then(({ data }) => {
      if (!active) return;
      const account = data as { full_name?: string | null; phone?: string | null } | null;
      const parts = String(account?.full_name || "").trim().split(/\s+/).filter(Boolean);
      setFirstName(parts.shift() || "");
      setLastName(parts.join(" "));
      setPhone(String(account?.phone || ""));
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const save = async () => {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setMessage(isEs ? "Escribe tu nombre y apellido." : "Enter both your first and last name.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && digits.length < 7) {
      setMessage(isEs ? "Revisa el número de teléfono." : "Check the phone number.");
      return;
    }
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("profiles").update({
      full_name: `${first} ${last}`,
      phone: phone.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    setSaving(false);
    setMessage(error
      ? (isEs ? "No se pudieron guardar los cambios." : "We couldn't save those changes.")
      : (isEs ? "Datos de cuenta guardados." : "Account details saved."));
    if (!error) void supabase.auth.refreshSession();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[13px] font-bold">{isEs ? "Datos de la cuenta" : "Account details"}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold opacity-65">{isEs ? "Nombre" : "First name"}
          <input className={`${inputClass} mt-1`} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" disabled={loading || saving} />
        </label>
        <label className="text-[11px] font-semibold opacity-65">{isEs ? "Apellido" : "Last name"}
          <input className={`${inputClass} mt-1`} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" disabled={loading || saving} />
        </label>
      </div>
      <label className="block text-[11px] font-semibold opacity-65">{isEs ? "Teléfono" : "Phone"}
        <input className={`${inputClass} mt-1`} value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" disabled={loading || saving} />
      </label>
      <label className="block text-[11px] font-semibold opacity-65">Email
        <input className={`${inputClass} mt-1 opacity-60`} value={email || ""} readOnly aria-readonly="true" autoComplete="email" />
      </label>
      <p className="text-[11px] opacity-55">{isEs ? "El email es tu One ID y no se cambia aquí." : "Your email is your One ID and is read-only here."}</p>
      {message && <p role="status" className="text-[12px] font-semibold text-teal">{message}</p>}
      <button type="button" onClick={() => void save()} disabled={loading || saving}
        className="w-full rounded-xl bg-teal px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
        {saving ? (isEs ? "Guardando…" : "Saving…") : (isEs ? "Guardar datos" : "Save details")}
      </button>
    </div>
  );
}

function PasswordChange({ email, isEs }: { email: string; isEs: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [breached, setBreached] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaStatus, setCaptchaStatus] = useState<"loading" | "ok" | "expired" | "error" | "unavailable">("loading");
  const [captchaNonce, setCaptchaNonce] = useState(0);

  /* Re-verifying the current password emits SIGNED_IN. The shared auth provider may remount this
     screen before updateUser and the notification request finish, which used to erase the success
     message and leave a silently cleared form. Carry the one-shot result across that secure
     session refresh, and remove it as soon as the mounted screen has shown it. */
  useEffect(() => {
    const receiveResult = () => {
      const result = readPasswordResult();
      if (!result) return;
      setMessage(result);
    };
    receiveResult();
    window.addEventListener(PASSWORD_RESULT_EVENT, receiveResult);
    const expiry = window.setTimeout(() => {
      window.sessionStorage.removeItem(PASSWORD_RESULT_KEY);
      setMessage("");
    }, PASSWORD_RESULT_TTL_MS);
    return () => {
      window.removeEventListener(PASSWORD_RESULT_EVENT, receiveResult);
      window.clearTimeout(expiry);
    };
  }, []);

  const remintCaptcha = () => {
    setCaptcha(null);
    setCaptchaStatus("loading");
    setCaptchaNonce(value => value + 1);
  };

  useEffect(() => {
    if (next.length < 10) { setBreached(null); return; }
    let active = true;
    setBreached(null);
    const timer = window.setTimeout(() => {
      void isPasswordBreached(next).then(value => { if (active) setBreached(value); });
    }, 450);
    return () => { active = false; window.clearTimeout(timer); };
  }, [next]);

  const change = async () => {
    if (!current) { setMessage(isEs ? "Escribe tu contraseña actual." : "Enter your current password."); return; }
    if (!passwordAcceptable(next, confirm, breached)) { setMessage(isEs ? "La nueva contraseña aún no cumple los requisitos." : "The new password does not meet every requirement yet."); return; }
    setBusy(true);
    window.sessionStorage.removeItem(PASSWORD_RESULT_KEY);
    setMessage("");
    const verified = await supabase.auth.signInWithPassword({
      email,
      password: current,
      options: captcha ? { captchaToken: captcha } : undefined,
    });
    remintCaptcha();
    if (verified.error) {
      setBusy(false);
      const captchaFailed = /captcha/i.test(verified.error.message || "");
      setMessage(captchaFailed
        ? (isEs ? "Completa la verificación de seguridad e inténtalo de nuevo." : "Complete the security check and try again.")
        : (isEs ? "La contraseña actual no es correcta." : "The current password is not correct."));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    setCurrent(""); setNext(""); setConfirm(""); setBreached(null);
    const notice = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "notification-alert",
        recipientEmail: email,
        idempotencyKey: `password-changed-${crypto.randomUUID()}`,
        templateData: {
          userName: email.split("@")[0],
          notificationType: "security",
          title: "Your One World password was changed",
          body: "Your password was changed from One World Settings. If this wasn't you, reset your password immediately and contact support.",
          actionUrl: "/reset-password",
        },
      },
    });
    const resultMessage = notice.error
      ? (isEs ? "Contraseña cambiada. No pudimos enviar el aviso por email." : "Password changed. We couldn't send the confirmation email.")
      : (isEs ? "Contraseña cambiada. Revisa tu email de confirmación." : "Password changed. Check your email for confirmation.");
    window.sessionStorage.setItem(PASSWORD_RESULT_KEY, JSON.stringify({ message: resultMessage, createdAt: Date.now() }));
    window.dispatchEvent(new Event(PASSWORD_RESULT_EVENT));
    setBusy(false);
    setMessage(resultMessage);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[13px] font-bold">{isEs ? "Cambiar contraseña" : "Change password"}</p>
      <input className={inputClass} type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder={isEs ? "Contraseña actual" : "Current password"} autoComplete="current-password" />
      <input className={inputClass} type="password" value={next} onChange={e => setNext(e.target.value)} placeholder={isEs ? "Nueva contraseña" : "New password"} autoComplete="new-password" />
      <input className={inputClass} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={isEs ? "Confirma la nueva contraseña" : "Confirm new password"} autoComplete="new-password" />
      {next && <ul className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
        {passwordRules(next, confirm, breached).map(rule => <li key={rule.key} className={rule.ok ? "text-teal" : "opacity-55"}>{rule.ok ? "✓" : rule.pending ? "…" : "○"} {rule.label}</li>)}
      </ul>}
      <Turnstile key={captchaNonce} onToken={(token, status) => {
        setCaptcha(token);
        setCaptchaStatus(status);
        if (status === "expired") setCaptchaNonce(value => value + 1);
      }} />
      {captchaStatus === "loading" && (
        <p className="text-center text-[12px] font-medium opacity-55">
          {isEs ? "Comprobando su navegador…" : "Checking your browser…"}
        </p>
      )}
      {message && <p role="status" className="text-[12px] font-semibold text-teal">{message}</p>}
      <button type="button" onClick={() => void change()} disabled={busy || captchaStatus === "loading" || !passwordAcceptable(next, confirm, breached)}
        className="w-full rounded-xl bg-ink px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 dark:bg-paper dark:text-ink">
        {busy ? (isEs ? "Actualizando…" : "Updating…") : (isEs ? "Cambiar contraseña" : "Change password")}
      </button>
    </div>
  );
}

/**
 * SETTINGS — a shell screen (drawer + the profile actions point here). Appearance (language +
 * theme), Privacy (the same public-profile switches as the profile, through one predicate), and
 * Account. Identical on every app; the product passes only its key. Copied from OneJob's Settings,
 * made config-free.
 */
export default function SettingsScreen({ product }: { product: AppKey }) {
  const { lang } = useI18n();
  const { theme, toggle } = useTheme();
  const { userId, email, signOutEverywhere, signOutError } = useOneId();
  const isEs = lang === "es" || lang === "co";
  const [links, setLinks] = useState<Record<string, boolean>>({});

  useAsync(async () => { if (!userId) return {}; const l = await getAppLinks(userId); setLinks(l); return l; }, [userId], !!userId);

  /* NOTIFICATIONS — `notification_preferences` already existed, correctly RLS'd, and nothing in
     the shell read it. So a member had no way to stop the platform pushing at them, which is the
     most common reason somebody mutes or deletes an app. */
  const [notif, setNotif] = useState<NotifPrefs>(NOTIF_DEFAULTS);
  useAsync(async () => {
    if (!userId) return null;
    const p = await getNotifPrefs(userId);
    setNotif(p);
    return p;
  }, [userId], !!userId);
  const flipNotif = async (k: NotifKey, next: boolean) => {
    if (!userId) return;
    setNotif(n => ({ ...n, [k]: next }));           // optimistic — a switch must move on tap
    const res = await setNotifPref(userId, k, next);
    if ("error" in res) setNotif(n => ({ ...n, [k]: !next }));   // revert on a real failure
  };

  const label = (k: SectionKey): string => ({
    show_score: isEs ? "Mi puntaje" : "My score", show_world: isEs ? "Mi mundo" : "My World",
    // This controls the public One World identity card, never a government ID document.
    // Calling it "My passport" beside "What the public sees" made the privacy surface
    // appear to publish a member's uploaded passport photo.
    show_passport: isEs ? "Mi tarjeta de identidad de One World" : "My One World identity card", show_events: isEs ? "Mis eventos" : "My events",
  } as Record<SectionKey, string>)[k];

  const toggleSection = async (k: SectionKey, next: boolean) => {
    if (!userId) return;
    setLinks(l => ({ ...l, [k]: next }));
    await setSectionPublic(userId, k, next);
  };

  const Section = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
    <section className={`card p-4 ${className}`}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] opacity-45">{title}</p>
      <div className="space-y-1">{children}</div>
    </section>
  );

  return (
    <div className="space-y-4">
      <ScreenHeading>{isEs ? "Ajustes" : "Settings"}</ScreenHeading>

      {/* The frosted cards create sibling stacking contexts. Keep this one above the next card
          so its language listbox remains clickable when it extends over Privacy. */}
      <Section title={isEs ? "Apariencia" : "Appearance"} className="relative z-10">
        {/* Seven flags in a row wrapped on a 390px screen and grew with every language added
            (Lee, 10 Aug: *"just put those in a dropdown"*). */}
        <div className="flex items-center justify-between py-1.5">
          <span className="font-medium">{isEs ? "Idioma" : "Language"}</span>
          <LanguageSelect />
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="font-medium">{isEs ? "Tema" : "Theme"}</span>
          <button onClick={toggle} className="rounded-lg border border-ink/10 px-3 py-1.5 text-[13px] font-semibold dark:border-white/15">
            {theme === "light" ? (isEs ? "☀️ Claro" : "☀️ Light") : (isEs ? "🌙 Oscuro" : "🌙 Dark")}
          </button>
        </div>

        {/* ── THE CURRENCY THE READER READS IN (Lee, 12 Aug 2026) ────────────────────────────
            *"They should be able to choose their currency… on the feed and in their settings."*
            The same preference the feeds carry, so changing it in either place changes both.

            It sits under Appearance rather than under Money on purpose: Money is about what this
            platform charges and pays out, which is denominated in dollars and is not a matter of
            taste. This is about what the reader is shown, which is. The full picker is used here
            rather than the compact one so the "i" is present — Settings is the one place with
            room to read where the rate comes from. */}
        <div className="py-1.5">
          <CurrencyPicker />
        </div>
      </Section>

      <Section title={isEs ? "Privacidad" : "Privacy"}>
        <p className="mb-1 text-[12px] opacity-55">{isEs ? "Qué ve el público en tu perfil." : "What the public sees on your profile."}</p>
        {PUBLIC_SECTIONS.map(sec => {
          const on = isSectionPublic(links, sec.key);
          return (
            <div key={sec.key} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2 font-medium"><span>{sec.emoji}</span>{label(sec.key)}</span>
              <Toggle on={on} onClick={() => toggleSection(sec.key, !on)} label={label(sec.key)} />
            </div>
          );
        })}
      </Section>

      {/* ── NOTIFICATIONS ── the gap Lee asked me to find. Backed by a real table that already
             existed; no row means everything ON, so a missing row must not read as all-off. */}
      <Section title={isEs ? "Notificaciones" : "Notifications"}>
        <div className="flex items-center justify-between py-1.5">
          <span className="font-medium">{isEs ? "Notificaciones push" : "Push notifications"}</span>
          <Toggle on={notif.push_enabled} onClick={() => void flipNotif("push_enabled", !notif.push_enabled)}
            label={isEs ? "Notificaciones push" : "Push notifications"} />
        </div>
        {/* The per-event switches are meaningless while the master is off — dim them rather than
            hide them, so it is obvious WHY they stopped mattering. */}
        <div className={notif.push_enabled ? "" : "pointer-events-none opacity-40"}>
          {([
            ["push_new_message",       isEs ? "Mensajes nuevos" : "New messages"],
            ["push_contract_received", isEs ? "Contratos recibidos" : "Contracts received"],
            ["push_payment_received",  isEs ? "Pagos recibidos" : "Payments received"],
            ["push_new_job_in_area",   isEs ? "Trabajos cerca de ti" : "Jobs near you"],
            ["push_new_event_in_area", isEs ? "Eventos cerca de ti" : "Events near you"],
            ["push_score_milestone",   isEs ? "Hitos de tu OneScore" : "OneScore milestones"],
          ] as [NotifKey, string][]).map(([k, lbl]) => (
            <div key={k} className="flex items-center justify-between py-1.5">
              <span className="font-medium">{lbl}</span>
              <Toggle on={notif[k]} onClick={() => void flipNotif(k, !notif[k])} label={lbl} />
            </div>
          ))}
        </div>
      </Section>

      {/* ── YOUR WORLD ── the cross-app surfaces. These existed as routes with nothing pointing
             at them from Settings, which is where a person goes looking for "what am I signed
             up to". */}
      <Section title={isEs ? "Tu mundo" : "Your world"}>
        <Link to="/yourworld" className="block rounded-xl px-1 py-2 font-medium hover:bg-brand/5">
          {isEs ? "Apps conectadas" : "Connected apps"}
        </Link>
        <Link to={productHref(product, "/plans")} className="block rounded-xl px-1 py-2 font-medium hover:bg-brand/5">
          {isEs ? "Plan y facturación" : "Plan & billing"}
        </Link>
      </Section>

      {/* ── MONEY ── one money layer, so both rows point at OneJob's wallet from every product
             rather than each app growing its own payment settings. */}
      <Section title={isEs ? "Dinero" : "Money"}>
        <Link to="/jobs/wallet" className="block rounded-xl px-1 py-2 font-medium hover:bg-brand/5">
          {isEs ? "Métodos de pago" : "Payment methods"}
        </Link>
        <Link to="/jobs/wallet" className="block rounded-xl px-1 py-2 font-medium hover:bg-brand/5">
          {isEs ? "Cuenta de cobro" : "Payout account"}
        </Link>
      </Section>

      <Section title={isEs ? "Legal" : "Legal"}>
        <Link to="/terms" className="block rounded-xl px-1 py-2 font-medium hover:bg-brand/5">{isEs ? "Términos" : "Terms"}</Link>
        <Link to="/privacy" className="block rounded-xl px-1 py-2 font-medium hover:bg-brand/5">{isEs ? "Privacidad" : "Privacy"}</Link>
      </Section>

      <Section title={isEs ? "Cuenta" : "Account"}>
        {userId && <AccountDetails userId={userId} email={email} isEs={isEs} />}
        {email && <PasswordChange email={email} isEs={isEs} />}
        {/* The profile IS the editor now (§4.11) — one Edit button on the page itself. Sending
            people to the old standalone form would be two ways to do one thing. */}
        <Link to={productHref(product, "/profile")} className="block rounded-xl px-1 py-2 font-medium hover:bg-brand/5">{isEs ? "Editar perfil" : "Edit profile"}</Link>
        <Link to="/account/delete" className="block rounded-xl px-1 py-2 font-medium text-ink/70 hover:bg-brand/5 dark:text-paper/70">{isEs ? "Eliminar cuenta" : "Delete account"}</Link>
        {/* One ID = one session across all five apps, so there is no per-device list to show and
            signing out is global by definition. Saying so is the honest version of a
            "sessions & devices" row. */}
        <button onClick={() => signOutEverywhere()} className="block w-full rounded-xl px-1 py-2 text-left font-medium text-red-500 hover:bg-red-500/10">
          {isEs ? "Cerrar sesión en todos los dispositivos" : "Sign out on all devices"}
        </button>
        {signOutError && <p role="alert" className="text-xs leading-relaxed text-red-500">{signOutError}</p>}
      </Section>
    </div>
  );
}
