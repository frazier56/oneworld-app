import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import AddCardSheet from "@job/components/AddCardSheet";
import { fmtDateTimeFull } from "@job/lib/datetime";
import MoneyPlaceIcon from "@job/components/MoneyIcons";

import { useI18n, W } from "@job/lib/i18n";
/**
 * THE ONEJOB VAULT — where your money is, and how you pay.
 *
 * Lee has asked for this name twice and it has never shipped (task #142): "rename the wallet surface
 * to the OneJob Vault everywhere in the UI, and put the Vault on the timeline so people can see when
 * money is in it."
 *
 * WHY THE RENAME IS MORE THAN A WORD. This screen used to be a list of saved cards called "My
 * Wallet" — a name that describes the least interesting half of it. The half that actually matters
 * to somebody working a job is the money OneJob is holding for them RIGHT NOW, and that had no home
 * anywhere in the app: you could only find it by opening a specific contract and scrolling to the
 * timeline. So the Vault is now the top of this screen, with a real figure in it, and the payment
 * methods sit underneath as the supporting act they always were.
 *
 * WHAT "THE VAULT" MEANS, PRECISELY. Money collected from a client and held by OneJob, in OneJob's
 * own Stripe balance, until both sides mark the job complete. It is deliberately NOT a euphemism for
 * "your Stripe balance": once a payment is released, it belongs to the pro and OneJob is out of it,
 * and the copy on this screen and in MoneyTimeline both stop claiming otherwise at that exact moment.
 * (Lee, Jul 27 2026: once money reaches the pro's Stripe account it is out of the Vault and the copy
 * must stop implying OneJob holds it.)
 *
 * And the word we do NOT use for any of this is "escrow" — see VOCABULARY_BANNED_WORDS.md. Stripe's
 * own policy lists escrow services as a restricted business, and several states license internet
 * escrow agents separately. The mechanic is fine; the label is the exposure.
 *
 * ---------------------------------------------------------------------------------------------
 * THE MANUAL RAIL (PayPal / Wise). Colombia is the launch market, dLocal is months away, and a
 * Colombian pro with no Stripe-payable bank needs some way to transact today. So PayPal and Wise are
 * real `payment_methods` rows — the same table and the same screen as cards, not a parallel
 * "paydirect" system — and OneJob earns NO fee on them, because the money goes client → PayPal → pro
 * and OneJob never touches it. That also means OneJob cannot protect it, and the copy says so in
 * plain words rather than hiding it.
 *
 * Two rules that are easy to get wrong and expensive to ship wrong:
 *   · A handle is PRIVATE. `payment_methods` RLS is select-own-only, and the only way a link reaches
 *     a client is the `resolve-pay-link` edge function, which refuses unless a real agreement exists
 *     between exactly those two people.
 *   · The label is "PayPal on file", never "Verified". There is no OAuth here. We know the pro typed
 *     a link; we do not know it works, and "verified" is a word we haven't earned.
 *
 * Shared surface for OneJob / OneEvent / OneSocial / OneScore — saved once, persists across apps
 * (stored on the profile via `payment_methods`, keyed by user_id).
 *
 * TODO i18n: strings are English for now (translation pass after screens finalize, per Lee).
 */

type Method = {
  id: string;
  provider: string;
  method_type: string;
  brand: string | null;
  last4: string | null;
  exp: string | null;
  alias: string | null;
  handle: string | null;
  is_primary: boolean;
  token?: string | null;          // Stripe payment_method id — needed to detach on delete
  is_secondary: boolean;
};

type Held = {
  id: string;
  title: string | null;
  payment_amount: number | null;
  currency: string | null;
  captured_at: string | null;
  payer_id: string | null;
  payee_id: string | null;
};

const ICON: Record<string, string> = { card: "💳", bancolombia: "🏦", nequi: "📲", cash: "🧾", paypal: "🅿️", wise: "🌍" };
/* Lang-aware because these sit UNDER the method name on the money screen — an English subtitle
   beneath a Spanish heading is exactly the seam that makes a payment screen feel untrustworthy.
   "on file" stays deliberately weak in both languages: there is no OAuth behind a PayPal/Wise
   row, only a link the professional typed, and calling it "verified" would be a lie. */
const TYPE_LABEL = (lang: string): Record<string, string> => ({
  card: W(lang, "Credit", "Crédito"), bancolombia: "Bancolombia", nequi: "Nequi",
  cash: W(lang, "Cash voucher", "Bono en efectivo"),
  paypal: W(lang, "PayPal on file", "PayPal registrado"), wise: W(lang, "Wise on file", "Wise registrado"),
});
const labelFor = (m: Method, lang: string) =>
  m.alias || (m.method_type === "card" ? `${m.brand ?? W(lang, "Card", "Tarjeta")} •••• ${m.last4 ?? "0000"}` :
    m.method_type === "paypal" ? "PayPal" : m.method_type === "wise" ? "Wise" :
    m.method_type === "bancolombia" ? "Bancolombia" : m.method_type === "nequi" ? "Nequi"
    : W(lang, "Cash voucher", "Bono en efectivo"));

const money = (amount: number, currency: string, lang: string) =>
  new Intl.NumberFormat(lang === "co" ? "es-CO" : lang === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: currency || "USD",
    currencyDisplay: "code",
    // COP is quoted in whole pesos in Colombia; "COP 400,000.00" reads as a conversion error to
    // exactly the users this market is being built for.
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);

/**
 * Turn whatever the pro typed into a link that actually opens.
 *
 * People type "@johana", "paypal.me/johana", "https://paypal.me/johana" and "johana" — all four mean
 * the same thing and all four should work, because a pro who mistypes this doesn't get paid.
 *
 * NOTE the amount is deliberately NOT appended. The legacy paydirect path built
 * `paypal.me/<handle>/<price>USD`, which on a Colombian contract priced in COP asked the client to
 * send US DOLLARS — a 4,000x error, on the platform's own launch market.
 */
/**
 * EXACT hosts only. A suffix test (`/(^|\.)paypal\.(me|com)$/`) lets `evil.paypal.com` through, and
 * the old schemeless shortcut — `if (v.startsWith("paypal.me")) return "https://" + v` — didn't parse
 * at all, so `paypal.me@evil.com` was stored verbatim and the browser sent the client to evil.com
 * while the preview line read "Clients will be sent to https://paypal.me@evil.com". That is a
 * payment-phishing primitive, aimed at the person about to hand over money.
 */
const PAY_HOSTS: Record<"paypal" | "wise", string[]> = {
  paypal: ["paypal.me", "www.paypal.me", "paypal.com", "www.paypal.com"],
  wise: ["wise.com", "www.wise.com"],
};

export function normalizePayHandle(raw: string, type: "paypal" | "wise"): string | null {
  const v = raw.trim().replace(/\s+/g, "");
  if (!v) return null;

  // Everything goes through the SAME parser. A schemeless string is not a special case, it's a string
  // missing a scheme — and `new URL()` is the only thing that agrees with the browser about where
  // "paypal.me@evil.com" actually points.
  const candidate = /^https?:\/\//i.test(v) ? v : null;
  if (candidate) {
    let u: URL;
    try { u = new URL(candidate); } catch { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Userinfo is how `https://paypal.me@evil.com` disguises itself; a port is never legitimate here.
    if (u.username || u.password || u.port) return null;
    if (!PAY_HOSTS[type].includes(u.hostname.toLowerCase().replace(/\.$/, ""))) return null;
    // Re-serialise from parts rather than echoing what the user typed.
    return `https://${u.hostname.toLowerCase().replace(/\.$/, "")}${u.pathname}${u.search}`;
  }

  // No scheme: treat it as a bare handle, and build the URL ourselves. `paypal.me/johana` and
  // `wise.com/pay/me/johana` are handled by stripping the host prefix rather than trusting it.
  let handle = v.replace(/^@/, "");
  for (const h of PAY_HOSTS[type]) {
    const lower = handle.toLowerCase();
    if (lower.startsWith(h + "/")) { handle = handle.slice(h.length + 1); break; }
    if (lower === h) return null;
  }
  if (type === "wise") handle = handle.replace(/^pay\/me\//i, "");
  if (!/^[A-Za-z0-9._-]{2,60}$/.test(handle)) return null;
  return type === "paypal"
    ? `https://paypal.me/${encodeURIComponent(handle)}`
    : `https://wise.com/pay/me/${encodeURIComponent(handle)}`;
}

export default function Wallet() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const returnTo = sp.get("return");                 // came here to add a method for a contract
  const back = () => (returnTo ? nav(returnTo) : nav(-1));
  const [methods, setMethods] = useState<Method[]>([]);
  const [held, setHeld] = useState<Held[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addManual, setAddManual] = useState<null | "paypal" | "wise">(null);
  const [expanded, setExpanded] = useState(false);
  const [sel, setSel] = useState<Method | null>(null);      // method being managed
  const [renaming, setRenaming] = useState(false);
  const [alias, setAlias] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("payment_methods").select("*").eq("user_id", user.id)
      .order("is_primary", { ascending: false });
    setMethods((data as Method[]) ?? []);

    /**
     * What OneJob is holding for this person right now.
     *
     * `captured_at` set and `released_at` still null IS the definition of "in the Vault" — money we
     * took from a client and have not sent on. Note what this does NOT do: it never reads
     * `payment_status`. Four legacy rows carry payment_status='released' with a null released_at and
     * no completions at all, and a screen that trusted the status string would put phantom money in
     * somebody's Vault.
     */
    const { data: hd } = await supabase
      .from("agreements")
      .select("id, title, payment_amount, currency, captured_at, payer_id, payee_id")
      .not("captured_at", "is", null)
      .is("released_at", null)
      // Money that came BACK is not money we are holding. `captured_at` is never cleared, so without
      // these two a refunded or reversed contract would sit in someone's Vault total permanently.
      .is("refunded_at", null)
      .is("transfer_reversed_at", null)
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`)
      .order("captured_at", { ascending: false });
    setHeld((hd as Held[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const shown = expanded ? methods : methods.slice(0, 2);
  const canSecondary = methods.length >= 2;

  // Sum per currency — a COP job and a USD job cannot be added together, and pretending otherwise on
  // a screen about where money is would be the exact failure this whole pass exists to fix.
  const totals = (rows: Held[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      if (r.payment_amount == null) return acc;
      const c = (r.currency || "USD").toUpperCase();
      acc[c] = (acc[c] ?? 0) + Number(r.payment_amount);
      return acc;
    }, {});
  const incoming = held.filter(h => h.payee_id === user?.id);
  const outgoing = held.filter(h => h.payer_id === user?.id);
  const incomingTotals = totals(incoming);
  const outgoingTotals = totals(outgoing);
  const anythingHeld = held.length > 0;

  const setPrimary = async (m: Method) => {
    await supabase.from("payment_methods").update({ is_primary: false }).eq("user_id", user!.id);
    await supabase.from("payment_methods").update({ is_primary: true, is_secondary: false }).eq("id", m.id);
    await load(); setSel(s => s && { ...s, is_primary: true });
  };
  const setSecondary = async (m: Method) => {
    if (!canSecondary || m.is_primary) return;
    await supabase.from("payment_methods").update({ is_secondary: false }).eq("user_id", user!.id);
    await supabase.from("payment_methods").update({ is_secondary: !m.is_secondary }).eq("id", m.id);
    await load();
  };
  const rename = async (m: Method) => {
    await supabase.from("payment_methods").update({ alias: alias.trim() || null }).eq("id", m.id);
    setRenaming(false); await load();
  };
  const [delErr, setDelErr] = useState("");
  const del = async (m: Method) => {
    setDelErr("");
    // A PayPal/Wise row is just a link on our side — there is nothing to detach at Stripe, and
    // calling detach-payment-method with a null token would fail and strand the user with a method
    // they can't remove.
    if (m.method_type === "paypal" || m.method_type === "wise") {
      const { error } = await supabase.from("payment_methods").delete().eq("id", m.id);
      if (error) { setDelErr(W(lang, "We couldn't remove that. Try again in a moment.", "No pudimos quitarlo. Inténtalo de nuevo en un momento.")); return; }
      setSel(null); await load(); return;
    }
    // Detach at Stripe FIRST, then drop the row. Deleting only the local row left the card
    // fully chargeable at Stripe — a user who "removed" a card could still be charged on it.
    // (UAT Jul 25 2026)
    try {
      const { error } = await supabase.functions.invoke("detach-payment-method", {
        body: { paymentMethodId: m.token, id: m.id },
      });
      if (error) {
        let msg = ""; try { const b = await (error as any).context?.json?.(); msg = b?.error; } catch { /* no body */ }
        setDelErr(msg || W(lang, "We couldn't remove that card. Try again in a moment.", "No pudimos quitar esa tarjeta. Inténtalo de nuevo en un momento."));
        return;
      }
    } catch (e: any) {
      setDelErr(e?.message || W(lang, "We couldn't remove that card. Try again in a moment.", "No pudimos quitar esa tarjeta. Inténtalo de nuevo en un momento."));
      return;
    }
    setSel(null); await load();
  };

  const addCard = () => setShowAdd(true);

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <button onClick={back} className="mb-4 flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">‹ {returnTo ? W(lang, "Back to your contract", "Volver a tu contrato") : W(lang, "Back", "Atrás")}</button>

      {/* ---------------- THE VAULT ---------------- */}
      <div className="flex items-center gap-3">
        {/* The rendered vault mark replaced `onejob-vault.webp` on 31 Jul 2026. Lee: that seal
            was never the chosen artwork, and it carried the OneSocial logo across its middle —
            wrong product, wrong colour, on the one screen whose whole job is to make you believe
            your money is safe. Drawn rather than photographed so it stays sharp at any size,
            costs no download, and follows the theme: brand-green body (the product), teal dial
            (state — this is where money is held). */}
        <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
          style={{
            background: "linear-gradient(155deg, #17A45C 0%, #0E8248 48%, #073F23 100%)",
            boxShadow: "0 12px 26px -10px rgba(11,101,57,.85), inset 0 1.5px 0 rgba(255,255,255,.40)",
          }}>
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden>
            {/* door */}
            <rect x="4.5" y="5.5" width="31" height="29" rx="7"
                  stroke="rgba(255,255,255,.72)" strokeWidth="2.2" />
            {/* hinge edge */}
            <path d="M11 5.5v29" stroke="rgba(255,255,255,.34)" strokeWidth="2.2" strokeLinecap="round" />
            {/* dial — teal, because the vault holding money is a state, not a brand flourish */}
            <circle cx="24" cy="20" r="6.4" stroke="#5EEAD4" strokeWidth="2.4" />
            <circle cx="24" cy="20" r="1.8" fill="#5EEAD4" />
            <path d="M24 13.6v-2.2M24 28.6v-2.2M30.4 20h2.2M15.6 20h-2.2"
                  stroke="#5EEAD4" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{W(lang, "The OneJob Vault", "La Bóveda de OneJob")}</h1>
          <p className="mt-0.5 text-sm opacity-60">{W(lang, "Where your job money is held — and how you pay.", "Donde se resguarda el dinero de tus trabajos — y cómo pagas.")}</p>
        </div>
      </div>

      {!loading && (
        <div className="card mt-5 p-4">
          <div className="flex items-start gap-3">
            <MoneyPlaceIcon place="vault" state={anythingHeld ? "current" : "pending"} size={38} />
            <div className="min-w-0 flex-1">
              <p className="oj-eyebrow oj-eyebrow--state">{W(lang, "In the Vault right now", "En la Bóveda ahora mismo")}</p>
              {anythingHeld ? (
                <>
                  {Object.keys(incomingTotals).length > 0 && (
                    <p className="mt-0.5 text-[22px] font-extrabold leading-tight">
                      {Object.entries(incomingTotals).map(([c, v]) => money(v, c, lang)).join(" · ")}
                    </p>
                  )}
                  <p className="mt-0.5 text-[12px] leading-snug opacity-70">
                    {incoming.length > 0 && (
                      <>{W(lang, `Collected and held by OneJob for ${incoming.length} job${incoming.length === 1 ? "" : "s"} you're working. It's released to your own Stripe account as soon as you and the client both mark the job complete.`, `Cobrado y resguardado por OneJob para ${incoming.length} trabajo${incoming.length === 1 ? "" : "s"} que estás haciendo. Se libera a tu propia cuenta de Stripe en cuanto tú y el cliente marquen el trabajo como completado.`)}</>
                    )}
                    {incoming.length === 0 && outgoing.length > 0 && (
                      <>{W(lang, `You've put ${Object.entries(outgoingTotals).map(([c, v]) => money(v, c, lang)).join(" · ")} into the Vault for ${outgoing.length} job${outgoing.length === 1 ? "" : "s"}. It stays there until you mark the work complete.`, `Has puesto ${Object.entries(outgoingTotals).map(([c, v]) => money(v, c, lang)).join(" · ")} en la Bóveda para ${outgoing.length} trabajo${outgoing.length === 1 ? "" : "s"}. Se queda ahí hasta que marques el trabajo como completado.`)}</>
                    )}
                  </p>
                  {incoming.length > 0 && outgoing.length > 0 && (
                    <p className="mt-1 text-[12px] leading-snug opacity-70">
                      {W(lang, `You've also put ${Object.entries(outgoingTotals).map(([c, v]) => money(v, c, lang)).join(" · ")} in for ${outgoing.length} job${outgoing.length === 1 ? "" : "s"} you're paying for.`, `También has puesto ${Object.entries(outgoingTotals).map(([c, v]) => money(v, c, lang)).join(" · ")} para ${outgoing.length} trabajo${outgoing.length === 1 ? "" : "s"} que estás pagando.`)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-0.5 text-[22px] font-extrabold leading-tight opacity-45">{W(lang, "Empty", "Vacía")}</p>
                  <p className="mt-0.5 text-[12px] leading-snug opacity-60">
                    {W(lang, "Nothing is being held for you at the moment. When a client pays for a job, the money is collected and held here until you both mark it complete.", "Ahora mismo no hay nada resguardado para ti. Cuando un cliente paga un trabajo, el dinero se cobra y se resguarda aquí hasta que ambos lo marquen como completado.")}
                  </p>
                </>
              )}
            </div>
          </div>

          {anythingHeld && (
            <ul className="mt-3 divide-y divide-ink/5 border-t border-ink/5 pt-1 dark:divide-white/5 dark:border-white/10">
              {held.slice(0, 4).map(h => (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{h.title || W(lang, "Untitled job", "Trabajo sin título")}</span>
                    <span className="block text-[11px] opacity-55">
                      {h.payee_id === user?.id ? W(lang, "Waiting for you", "Esperándote") : W(lang, "You're paying", "Estás pagando")}
                      {" · "}{W(lang, "in the Vault since", "en la Bóveda desde")} {fmtDateTimeFull(h.captured_at)}
                    </span>
                  </span>
                  {h.payment_amount != null && (
                    <span className="shrink-0 text-[13px] font-extrabold">{money(Number(h.payment_amount), h.currency || "USD", lang)}</span>
                  )}
                </li>
              ))}
              {held.length > 4 && (
                <li className="py-2 text-center text-[11px] opacity-55">{W(lang, `and ${held.length - 4} more — open a job to see its full money trail`, `y ${held.length - 4} más — abre un trabajo para ver todo su recorrido del dinero`)}</li>
              )}
            </ul>
          )}
        </div>
      )}

      {returnTo && methods.length > 0 && (
        <button onClick={back} className="mt-3 text-sm font-semibold text-brand">{W(lang, "✓ Method saved — back to your contract →", "✓ Método guardado — volver a tu contrato →")}</button>
      )}

      {delErr && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs font-semibold text-red-500">{delErr}</div>
      )}

      {/* ---------------- HOW YOU PAY ---------------- */}
      {!loading && methods.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-3 text-xs opacity-50">
            <span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />{W(lang, "Your payment methods", "Tus métodos de pago")}<span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />
          </div>
          <div className="card divide-y divide-ink/5 p-2 dark:divide-white/5">
            {shown.map(m => (
              <button key={m.id} onClick={() => { setSel(m); setAlias(m.alias ?? ""); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-brand/5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-lg dark:bg-white/10">{ICON[m.method_type] ?? "💳"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{labelFor(m, lang)}</span>
                  <span className="block text-[11px] opacity-55">{TYPE_LABEL(lang)[m.method_type] ?? m.method_type}</span>
                </span>
                {m.is_primary && <span className="rounded-full border border-teal/60 px-2 py-0.5 text-[10px] font-bold text-teal-dark dark:text-teal">{W(lang, "Primary", "Principal")}</span>}
                {m.is_secondary && !m.is_primary && <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-bold opacity-70 dark:border-white/20">{W(lang, "Backup", "Respaldo")}</span>}
                <span className="opacity-30">›</span>
              </button>
            ))}
          </div>
          {methods.length > 2 && (
            <button onClick={() => setExpanded(e => !e)} className="mx-auto mt-2 block px-3 py-2 text-xs font-semibold opacity-80">
              {expanded ? W(lang, "See less ⌃", "Ver menos ⌃") : W(lang, "See more ⌄", "Ver más ⌄")}
            </button>
          )}
        </div>
      )}

      {/* ---------------- ADD ---------------- */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-3 text-xs opacity-50">
          <span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />{W(lang, "Add new payment method", "Agregar método de pago")}<span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />
        </div>
        <div className="card divide-y divide-ink/5 p-2 dark:divide-white/5">
          <button onClick={addCard} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-brand/5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-lg dark:bg-white/10">💳</span>
            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-[15px] font-semibold">{W(lang, "Credit or debit card", "Tarjeta de crédito o débito")}</span>
              <span className="mt-1.5 flex items-center gap-1.5"><Logos /></span>
            </span>
            <span className="w-6 shrink-0 text-center text-2xl text-brand">+</span>
          </button>
          <Row icon="🅿️" title="PayPal" sub={W(lang, "Get paid directly — not held by OneJob", "Te pagan directo — no lo resguarda OneJob")} onClick={() => setAddManual("paypal")}
            trailing={<span className="w-6 shrink-0 text-center text-2xl text-brand">+</span>} />
          <Row icon="🌍" title="Wise" sub={W(lang, "Get paid directly — not held by OneJob", "Te pagan directo — no lo resguarda OneJob")} onClick={() => setAddManual("wise")}
            trailing={<span className="w-6 shrink-0 text-center text-2xl text-brand">+</span>} />
          <Row icon="🅰️" title="AstroPay" sub={W(lang, "Coming soon", "Pronto")} muted trailing={<span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-bold opacity-60 dark:border-white/20">{W(lang, "SOON", "PRONTO")}</span>} />
          <Row icon="🏦" title="Bancolombia" sub={W(lang, "Coming soon", "Pronto")} muted trailing={<span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-bold opacity-60 dark:border-white/20">{W(lang, "SOON", "PRONTO")}</span>} />
          <Row icon="📲" title="Nequi" sub={W(lang, "Coming soon", "Pronto")} muted trailing={<span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-bold opacity-60 dark:border-white/20">{W(lang, "SOON", "PRONTO")}</span>} />
        </div>
        <p className="mt-3 text-center text-[10px] leading-relaxed opacity-45">
          {W(lang, "🔒 Card details are handled by Stripe · Other listed methods show their availability", "🔒 Stripe procesa los datos de la tarjeta · Los demás métodos indican su disponibilidad")}
          <br />
          {W(lang, "Eligible card-funded contracts show whether funds were authorized, collected or released. OneJob doesn’t hold or guarantee direct payments.", "Los contratos elegibles pagados con tarjeta muestran si el dinero fue autorizado, cobrado o liberado. OneJob no resguarda ni garantiza los pagos directos.")}
        </p>
      </div>

      {/* Method details sheet */}
      {sel && (
        <div className="fixed inset-0 z-[85] grid place-items-end sm:place-items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setSel(null); setRenaming(false); }} />
          <div className="glass-modal relative w-full max-w-lg rounded-t-3xl p-6 shadow-2xl sm:m-4 sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => setSel(null)} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 dark:border-white/15">‹</button>
              <button onClick={() => del(sel)} className="grid h-8 w-8 place-items-center rounded-full border border-red-400/40 text-red-500">🗑</button>
            </div>

            {sel.method_type === "paypal" || sel.method_type === "wise" ? (
              <div className="mb-5">
                <div className="mx-auto flex h-[120px] w-[270px] max-w-full flex-col justify-center gap-1 rounded-2xl px-5"
                  style={{ background: "linear-gradient(135deg,#1b3350,#0b1420 70%)", boxShadow: "0 12px 30px rgba(0,0,0,.35)" }}>
                  <span className="text-[10px] tracking-widest text-white/60">{sel.method_type === "paypal" ? "PAYPAL" : "WISE"}</span>
                  <span className="truncate text-[14px] font-semibold text-white/90">{sel.handle ?? "—"}</span>
                  <span className="text-[11px] text-white/55">{W(lang, "On file · not verified by OneJob", "Registrado · no verificado por OneJob")}</span>
                </div>
                <p className="mt-3 text-[12px] leading-snug opacity-70">
                  {W(lang, "Only a client with a real contract with you can ever see this link — it is never shown on your profile or in search. Money sent this way goes straight to you.", "Solo un cliente con un contrato real contigo puede ver este enlace — nunca aparece en tu perfil ni en la búsqueda. El dinero enviado así te llega directo.")}
                  {" "}<strong>{W(lang, "OneJob doesn’t hold or guarantee direct payments.", "OneJob no resguarda ni garantiza los pagos directos.")}</strong>
                </p>
              </div>
            ) : (
              /* card face */
              <div className="relative mx-auto mb-5 flex h-[168px] w-[270px] max-w-full flex-col justify-between overflow-hidden rounded-2xl p-4"
                style={{ background: "linear-gradient(135deg,#294a80,#0f1a2e 70%)", boxShadow: "0 12px 30px rgba(0,0,0,.35)" }}>
                {sel.is_primary && <span className="absolute right-4 top-4 rounded-full border border-white/35 px-3 py-0.5 text-[11px] text-white/90">{W(lang, "Primary", "Principal")}</span>}
                <span className="text-[10px] tracking-widest text-white/60">{(sel.alias || sel.brand || "CARD").toUpperCase()}</span>
                <span className="font-mono text-[16px] tracking-widest text-white/90">•••• •••• •••• {sel.last4 ?? "0000"}</span>
                <span className="text-[11px] text-white/60">{sel.exp ?? "MM/YY"}</span>
              </div>
            )}

            {renaming ? (
              <div>
                <label className="label">{W(lang, "Name this method", "Nombra este método")}</label>
                <input className="input" value={alias} onChange={e => setAlias(e.target.value)} placeholder={W(lang, "e.g. My Visa", "p. ej. Mi Visa")} />
                <p className="mt-1 text-[11px] opacity-50">{W(lang, "You can change it anytime from here.", "Puedes cambiarlo cuando quieras desde aquí.")}</p>
                <button className="btn-primary mt-4 w-full" onClick={() => rename(sel)}>{W(lang, "Save", "Guardar")}</button>
              </div>
            ) : (
              <>
                <ToggleCard icon="💳" title={W(lang, "Primary method", "Método principal")} sub={W(lang, "We'll use this by default for your purchases across all of One World Labs.", "Lo usaremos por defecto para tus compras en todo One World Labs.")}
                  on={sel.is_primary} onClick={() => setPrimary(sel)} />
                <div className="mt-3">
                  <ToggleCard icon="🔁" title={W(lang, "Secondary method", "Método secundario")} sub={W(lang, "We'll use this as a backup if your primary method fails.", "Lo usaremos de respaldo si falla tu método principal.")}
                    on={sel.is_secondary} disabled={!canSecondary || sel.is_primary} onClick={() => setSecondary(sel)} />
                </div>
                <button onClick={() => setRenaming(true)} className="btn-ghost mt-4 w-full">{W(lang, "Rename", "Renombrar")}</button>
                {!canSecondary && <p className="mt-3 text-center text-[11px] opacity-50">{W(lang, "Add a second method to enable a backup.", "Agrega un segundo método para habilitar el respaldo.")}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {addManual && (
        <AddManualSheet
          type={addManual}
          userId={user?.id ?? null}
          onClose={() => setAddManual(null)}
          onSaved={async () => { setAddManual(null); await load(); if (returnTo) nav(returnTo); }}
        />
      )}

      {showAdd && <AddCardSheet onClose={() => setShowAdd(false)} onSaved={async () => {
        setShowAdd(false);
        await load();
        // Someone sent here mid-contract came for exactly one thing. Take them straight back to it
        // rather than leaving them on a wallet screen wondering what they were doing. (Lee, Jul 25 2026)
        if (returnTo) nav(returnTo);
      }} />}
    </div>
  );
}

/**
 * Adding a PayPal or Wise link.
 *
 * Deliberately blunt about what this is and isn't. A pro adding this is choosing a rail where OneJob
 * never touches the money, which means no Vault, no protection, and no fee. Saying that plainly here
 * is cheaper than saying it in a dispute.
 */
function AddManualSheet({ type, userId, onClose, onSaved }:
  { type: "paypal" | "wise"; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const { lang } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const name = type === "paypal" ? "PayPal" : "Wise";
  const preview = normalizePayHandle(value, type);

  const save = async () => {
    if (!userId) return;
    const link = normalizePayHandle(value, type);
    if (!link) {
      setErr(type === "paypal"
        ? W(lang, "That doesn't look like a PayPal link. Try your paypal.me name, like johana, or paste the whole link.",
                  "Eso no parece un enlace de PayPal. Prueba con tu nombre de paypal.me, como johana, o pega el enlace completo.")
        : W(lang, "That doesn't look like a Wise link. Paste the whole link from Wise, or your wise.com/pay/me name.",
                  "Eso no parece un enlace de Wise. Pega el enlace completo de Wise, o tu nombre de wise.com/pay/me."));
      return;
    }
    setBusy(true); setErr("");
    const { error } = await supabase.from("payment_methods").insert({
      user_id: userId, provider: type, method_type: type, handle: link,
      alias: null, is_primary: false, is_secondary: false,
    });
    setBusy(false);
    if (error) { setErr(W(lang, "We couldn't save that just now. Try again in a moment.", "No pudimos guardarlo ahora. Inténtalo de nuevo en un momento.")); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[86] grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="glass-modal relative w-full max-w-lg rounded-t-3xl p-6 shadow-2xl sm:m-4 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 dark:border-white/15">‹</button>
          <span className="text-sm font-extrabold">{W(lang, `Add ${name}`, `Agregar ${name}`)}</span>
          <span className="w-8" />
        </div>

        <label className="label">{type === "paypal" ? W(lang, "Your PayPal.Me name or link", "Tu nombre o enlace de PayPal.Me") : W(lang, "Your Wise pay link", "Tu enlace de pago de Wise")}</label>
        <input
          className="input"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={e => { setValue(e.target.value); setErr(""); }}
          placeholder={type === "paypal" ? "johana  ·  paypal.me/johana" : "wise.com/pay/me/johana"}
        />
        {preview && <p className="mt-1.5 text-[11px] font-semibold text-brand">{W(lang, `Clients will be sent to ${preview}`, `Los clientes irán a ${preview}`)}</p>}
        {err && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{err}</p>}

        <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3.5 dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-[12px] font-bold">{W(lang, "What this is", "Qué es esto")}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-75">
            {W(lang, `A way to get paid when a card won’t work. The client pays you straight through ${name} — the money never comes to OneJob, so `,
                     `Una forma de cobrar cuando una tarjeta no funciona. El cliente te paga directo por ${name} — el dinero nunca llega a OneJob, así que `)}
            <strong>{W(lang, "it’s never in the OneJob Vault", "nunca está en la Bóveda de OneJob")}</strong>{" "}
            {W(lang, "and", "y")}{" "}
            <strong>{W(lang, "OneJob doesn’t hold or guarantee direct payments.", "OneJob no resguarda ni garantiza los pagos directos.")}</strong>{" "}
            {W(lang, "There’s no OneJob fee on it either.", "Tampoco tiene comisión de OneJob.")}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed opacity-75">
            {W(lang, "The job only turns active once ", "El trabajo solo se activa cuando ")}<em>{W(lang, "you", "tú")}</em>
            {W(lang, " confirm the money actually arrived — a client saying they sent it isn’t enough.",
                     " confirmas que el dinero realmente llegó — que el cliente diga que lo envió no basta.")}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed opacity-75">
            {W(lang, "Your link stays private. It is never on your profile and never in search — only a client with a real contract with you can see it.",
                     "Tu enlace es privado. Nunca aparece en tu perfil ni en la búsqueda — solo un cliente con un contrato real contigo puede verlo.")}
          </p>
        </div>

        <button className="btn-primary mt-4 w-full" disabled={busy || !preview} onClick={save}>
          {busy ? W(lang, "Saving…", "Guardando…") : W(lang, `Save my ${name} link`, `Guardar mi enlace de ${name}`)}
        </button>
        <button onClick={onClose} className="mx-auto mt-3 block text-[12px] font-semibold underline underline-offset-2 opacity-70">{W(lang, "Not right now", "Ahora no")}</button>
      </div>
    </div>
  );
}

function Row({ icon, title, sub, trailing, onClick, muted }:
  { icon: string; title: string; sub?: string; trailing?: React.ReactNode; onClick?: () => void; muted?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition ${onClick ? "hover:bg-brand/5" : ""} ${muted ? "opacity-50" : ""}`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-lg dark:bg-white/10">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {sub && <span className="block text-[11px] opacity-55">{sub}</span>}
      </span>
      {trailing}
    </button>
  );
}
function ToggleCard({ icon, title, sub, on, onClick, disabled }:
  { icon: string; title: string; sub: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-lg dark:bg-white/10">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug opacity-60">{sub}</span>
      </span>
      <button onClick={disabled ? undefined : onClick} aria-disabled={disabled}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-teal" : "bg-ink/25 dark:bg-white/25"} ${disabled ? "opacity-40" : ""}`}>
        <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-[3px]"}`} />
      </button>
    </div>
  );
}
function Logos() {
  const chip = (bg: string, txt: string, color = "#fff", extra = "") =>
    <span className={`inline-flex h-[22px] min-w-[34px] items-center justify-center rounded-[5px] border border-black/10 bg-white px-1.5 text-[8.5px] font-extrabold ${extra}`} style={{ color: bg }}>{txt}</span>;
  return (
    <span className="flex items-center gap-1.5">
      {chip("#1434CB", "VISA", "#fff", "italic")}
      <span className="relative inline-flex h-[22px] min-w-[42px] items-center justify-center rounded-[5px] border border-black/10 bg-white">
        <span className="absolute left-1.5 top-[3.5px] h-[15px] w-[15px] rounded-full" style={{ background: "#eb001b" }} />
        <span className="absolute right-1.5 top-[3.5px] h-[15px] w-[15px] rounded-full" style={{ background: "#f79e0f", mixBlendMode: "multiply" }} />
      </span>
      {chip("#1F72CD", "AMEX")}
    </span>
  );
}
