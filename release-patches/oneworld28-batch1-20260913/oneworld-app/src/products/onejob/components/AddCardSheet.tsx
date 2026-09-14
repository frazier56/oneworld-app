import { useEffect, useRef, useState } from "react";
import { supabase } from "@job/lib/supabase";
import { loadStripeJs } from "@job/lib/stripeClient";
import { fnError, thrownError } from "@job/lib/fnError";
import { useI18n, W } from "@job/lib/i18n";

/**
 * Add a card to the wallet via Stripe Elements + a SetupIntent (no raw PAN ever touches us).
 * create-setup-intent → mount Payment Element → confirmSetup → save-payment-method(pm id).
 * A small validation auth may appear and is released by Stripe automatically.
 */
export default function AddCardSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const { lang } = useI18n();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-setup-intent", { body: {} });
        if (error) throw error;
        if (!data?.publishableKey) {
          setErr(W(lang, "Card payments aren’t switched on yet. (Admin: add STRIPE_PUBLISHABLE_KEY to the function secrets.)", "Los pagos con tarjeta aún no están activos. (Admin: agrega STRIPE_PUBLISHABLE_KEY a los secretos de la función.)"));
          return;
        }
        const s = await loadStripeJs(data.publishableKey);
        if (dead) return;
        const dark = document.documentElement.classList.contains("dark");
        const els = s.elements({
          clientSecret: data.clientSecret,
          appearance: { theme: dark ? "night" : "stripe", /* the TEXT step: Stripe paints links and focused labels with colorPrimary, so the
               identity green (3.23:1) would fail inside the iframe where we cannot override it */
            variables: { colorPrimary: "#0E8248", borderRadius: "12px" } },
        });
        const pe = els.create("payment", { layout: "tabs" });
        pe.mount(elRef.current);
        pe.on("ready", () => setReady(true));
        // Surface Stripe's own load failures (e.g. pk/sk account mismatch) instead of
        // an eternal "Loading…". Without this, a fatal config error is invisible.
        pe.on("loaderror", (ev: any) => {
          console.error("[AddCardSheet] Stripe loaderror:", ev?.error);
          setErr(ev?.error?.message || W(lang, "The secure card form couldn’t load. Please try again.", "El formulario seguro de tarjeta no pudo cargar. Inténtalo de nuevo."));
        });
        setStripe(s); setElements(els);
      } catch (e: any) { if (!dead) setErr(e?.message || String(e)); }
    })();
    return () => { dead = true; };
  }, []);

  const save = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr("");
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (error) { setErr(await fnError(error, W(lang, "That card couldn’t be saved. Try again.", "No se pudo guardar esa tarjeta. Inténtalo de nuevo."))); setBusy(false); return; }
    const pmId = typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;
    const { error: sErr } = await supabase.functions.invoke("save-payment-method", { body: { paymentMethodId: pmId } });
    if (sErr) { setErr(W(lang, "Card saved, but we couldn’t add it to your wallet — try again.", "Tarjeta guardada, pero no pudimos agregarla a tu billetera — inténtalo de nuevo.")); setBusy(false); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* SOLID background (no backdrop-filter) — a blurred ancestor makes Stripe's card
          iframe non-interactive (you can't type). This container must stay filter-free. */}
      {/* SOLID on purpose — see .oj-solid-sheet. Stripe's Elements iframe breaks under any
          ancestor carrying backdrop-filter: the card fields render blank or lose the caret.
          Every other sheet in the app is glass; this one can't be, and that's not an oversight.
          (Paid for once, Jul 24 2026.) */}
      <div className="oj-solid-sheet relative w-full max-w-lg rounded-t-3xl p-6 sm:m-4 sm:rounded-3xl">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={onClose} className="flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">‹ {W(lang, "Back", "Atrás")}</button>
          <h2 className="text-xl font-extrabold">{W(lang, "Add a card", "Agregar una tarjeta")}</h2>
        </div>
        <div ref={elRef} className="min-h-[52px] rounded-xl" />
        {!ready && !err && (
          <div className="mt-3 flex items-center gap-2 text-sm text-brand">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <span className="animate-pulse font-semibold">{W(lang, "Loading secure card form…", "Cargando el formulario seguro…")}</span>
          </div>
        )}
        <p className="mt-3 text-[11px] opacity-50">{W(lang, "🔒 Stripe handles your card details. The contract’s selected currency is shown before payment; OneJob does not convert it automatically.", "🔒 Stripe procesa los datos de tu tarjeta. La moneda elegida en el contrato aparece antes del pago; OneJob no la convierte automáticamente.")}</p>
        {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
        <button onClick={save} disabled={busy || !ready} className="btn-primary mt-4 w-full text-lg">{busy ? "…" : W(lang, "Save card", "Guardar tarjeta")}</button>
      </div>
    </div>
  );
}
