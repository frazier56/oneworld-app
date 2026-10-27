import { Link, useNavigate } from "react-router-dom";
import { useI18n, W, ScreenHeading, signUpHref, safeAuthReturn } from "@oneworld/shell";
import SegmentToggle from "./SegmentToggle";

/**
 * WHAT LISTING A PLACE INVOLVES — before anyone is asked for an account (UX review #1, 22 Oct 2026).
 * ============================================================================================
 * A signed-out visitor who tapped the raised centre button used to get a bare, frameless
 * "Create an account to continue" card, and "Keep looking" left them on it. This is the first
 * step of the property-manager journey, so it now opens INSIDE the normal OneHome frame (header,
 * menu, tab bar) and says what the steps are — host profile, the place, how you get paid — before
 * the account is asked for. Create account brings them straight back to the listing form.
 *
 * One component for the rent hub and the sale hub: same experience, same code.
 */
export default function HostPreview({ side }: { side: "rent" | "sale" }) {
  const { lang } = useI18n();
  const nav = useNavigate();
  const base = side === "rent" ? "/rentals" : "/sales";
  const next = safeAuthReturn(`${base}/list?form=1`);
  const steps = [
    {
      t: W(lang, "Your host profile", "Su perfil de anfitrión"),
      s: W(lang, "Your name, ID and a private address for notices. You fill it in once.",
        "Su nombre, documento y una dirección privada para notificaciones. Se llena una sola vez."),
    },
    {
      t: side === "rent" ? W(lang, "Your place", "Su inmueble") : W(lang, "Your property", "Su inmueble"),
      s: side === "rent"
        ? W(lang, "Photos, rent, dates and house rules. You can save a draft and finish later.",
          "Fotos, arriendo, fechas y reglas. Puede guardar un borrador y terminar después.")
        : W(lang, "Photos, price and the details buyers ask for. You can save a draft and finish later.",
          "Fotos, precio y los datos que piden los compradores. Puede guardar un borrador y terminar después."),
    },
    {
      t: W(lang, "How you get paid", "Cómo recibe el pago"),
      s: W(lang, "The account the money goes to. Requests and messages then come to you here.",
        "La cuenta a la que llega el dinero. Las solicitudes y los mensajes le llegan aquí."),
    },
  ];
  /* Back where they came from when there is an in-app page to go back to; otherwise the feed. */
  const keepLooking = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1); else nav(base, { replace: true });
  };
  return (
    <div data-ow="host-preview" className="space-y-4 pb-28">
      <ScreenHeading>{W(lang, "Properties", "Inmuebles")}</ScreenHeading>
      <SegmentToggle current={side} lang={lang} context="manage" />
      <section className="card p-5">
        <p className="text-[19px] font-black leading-snug tracking-tight">
          {side === "rent"
            ? W(lang, "List your place in three steps", "Publique su inmueble en tres pasos")
            : W(lang, "List your property in three steps", "Publique su inmueble en tres pasos")}
        </p>
        <ol className="mt-4 space-y-3">
          {steps.map((x, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-black text-white">{i + 1}</span>
              <span>
                <span className="block text-[14.5px] font-bold">{x.t}</span>
                <span className="block text-[13px] leading-snug opacity-70">{x.s}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] leading-snug opacity-70">
          {W(lang, "You need a free account to start. We bring you straight back here.",
            "Necesita una cuenta gratuita para empezar. Lo traemos de vuelta aquí.")}
        </p>
        <div className="mt-4 grid gap-2">
          <Link to={signUpHref(next)} className="btn-primary block text-center">{W(lang, "Create account", "Crear cuenta")}</Link>
          <Link to={"/signin?next=" + encodeURIComponent(next)} className="btn-ghost block text-center">{W(lang, "Sign in", "Ingresar")}</Link>
          <button type="button" onClick={keepLooking} className="ow-tap mt-1 text-[13px] font-semibold opacity-60">
            {W(lang, "Keep looking", "Seguir mirando")}</button>
        </div>
      </section>
    </div>
  );
}
