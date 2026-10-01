import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading, GlassDate, GlassSelect,
} from "@oneworld/shell";
import { SALE_COLUMNS, type SaleProperty } from "../lib/sale";
import { renderPromesa, AGREEMENT_DRAFT_NOTE, type AgreementValues } from "../lib/agreementTemplate";

/**
 * /sales/s/:id/agreement — start the sale agreement (promesa de compraventa).
 * ============================================================================================
 * Lee, 29 Sep 2026: buyer, seller and agent sign; DocuSign is the standard. So this screen does
 * what DocuSign's "prepare" step does: fill the fields, show the exact text, send it. Everything
 * after this is the view screen, which is the same screen for every signer.
 *
 * Only the person who LISTED the property can start one (the database refuses anyone else).
 * The lister is either the seller or their agent, and says which — that decides whose name is
 * already known and whose email the app still needs.
 *
 * The text is frozen and fingerprinted by the SERVER on send (send_sale_agreement), so nobody —
 * including the sender — can change a word after the first person has read it.
 */
export default function AgreementNew() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId, displayName, email } = useOneId();
  const nav = useNavigate();
  const es = lang === "es" || lang === "co";

  const p = useAsync(async () => {
    const { data } = await supabase.from("sale_properties").select(SALE_COLUMNS).eq("id", id).maybeSingle();
    return (data ?? null) as SaleProperty | null;
  }, [id]);

  const [role, setRole] = useState<"seller" | "agent">("seller");
  const [docLang, setDocLang] = useState<"es" | "en">(es ? "es" : "en");
  const [sellerName, setSellerName] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [withAgent, setWithAgent] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [price, setPrice] = useState<string>("");
  const [down, setDown] = useState<string>("");
  const [downDue, setDownDue] = useState("");
  const [arras, setArras] = useState<"confirmatorias" | "retracto">("confirmatorias");
  const [closing, setClosing] = useState("");
  const [notary, setNotary] = useState("");
  const [commission, setCommission] = useState<string>("");
  const [paidBy, setPaidBy] = useState<"seller" | "buyer" | "split">("seller");
  const [penalty, setPenalty] = useState("10");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Prefill once from the listing — the listing is the source for price, deposit and commission.
  if (p && !seeded) {
    setSeeded(true);
    setPrice(String(p.asking_price ?? ""));
    if (p.earnest_money) setDown(String(p.earnest_money));
    if (p.commission_pct != null) setCommission(String(p.commission_pct));
    /* The listing form only knows "seller" or "shared"; shared is split equally here. */
    if (p.commission_paid_by === "shared") setPaidBy("split");
  }

  const agentOn = role === "agent" || withAgent;
  const me = displayName ?? "";
  const values: AgreementValues | null = p ? {
    lang: docLang,
    sellerName: role === "seller" ? me : sellerName.trim(),
    sellerEmail: role === "seller" ? email : sellerEmail.trim(),
    buyerName: buyerName.trim(), buyerEmail: buyerEmail.trim(),
    agentName: agentOn ? (role === "agent" ? me : agentName.trim()) : null,
    agentEmail: agentOn ? (role === "agent" ? email : agentEmail.trim()) : null,
    propertyTitle: p.title ?? "",
    address: p.address_line || [p.neighbourhood].filter(Boolean).join(", "),
    city: p.city ?? "",
    matricula: p.matricula_inmobiliaria,
    price: Number(price) || 0,
    currency: (p.currency || "USD").toUpperCase(),
    downPayment: Number(down) || null,
    downPaymentDue: downDue || null,
    arrasKind: arras,
    closingDate: closing,
    notary: notary.trim(),
    commissionPct: agentOn && commission !== "" ? Number(commission) : null,
    commissionPaidBy: agentOn ? paidBy : null,
    penaltyPct: Number(penalty) || 0,
    extraTerms: extra.trim() || null,
  } : null;

  const problems = useMemo(() => {
    if (!values) return [];
    const out: string[] = [];
    const okMail = (s?: string | null) => !!s && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
    if (values.sellerName.length < 2) out.push(W(lang, "Seller's full name", "Nombre completo del vendedor"));
    if (role === "agent" && !okMail(values.sellerEmail)) out.push(W(lang, "Seller's email", "Correo del vendedor"));
    if (values.buyerName.length < 2) out.push(W(lang, "Buyer's full name", "Nombre completo del comprador"));
    if (!okMail(values.buyerEmail)) out.push(W(lang, "Buyer's email", "Correo del comprador"));
    if (agentOn && (values.agentName ?? "").length < 2) out.push(W(lang, "Agent's name", "Nombre del agente"));
    if (agentOn && role === "seller" && !okMail(values.agentEmail)) out.push(W(lang, "Agent's email", "Correo del agente"));
    if (!(values.price > 0)) out.push(W(lang, "Price", "Precio"));
    if ((values.downPayment ?? 0) > values.price) out.push(W(lang, "Down payment is more than the price", "Las arras superan el precio"));
    if (!values.closingDate) out.push(W(lang, "Deed date", "Fecha de la escritura"));
    if (values.notary.length < 3) out.push(W(lang, "Notary", "Notaría"));
    return out;
  }, [values, role, agentOn, lang]);

  const text = values ? renderPromesa(values) : "";

  async function send() {
    if (!p || !values || problems.length) return;
    setBusy(true); setErr(null);
    const { data: row, error } = await supabase.from("sale_agreements").insert({
      property_id: p.id, lister_role: role,
      seller_name: values.sellerName, seller_email: values.sellerEmail || null,
      buyer_name: values.buyerName, buyer_email: values.buyerEmail,
      agent_name: values.agentName, agent_email: values.agentEmail,
      price: values.price, currency: values.currency,
      down_payment: values.downPayment, down_payment_due: values.downPaymentDue,
      arras_kind: values.arrasKind, closing_date: values.closingDate, notary: values.notary,
      commission_pct: values.commissionPct, commission_paid_by: values.commissionPaidBy,
      penalty_pct: values.penaltyPct, extra_terms: values.extraTerms, lang: docLang,
    }).select("id").single();
    if (error || !row) { setBusy(false); setErr(error?.message ?? "error"); return; }
    const { error: e2 } = await supabase.rpc("send_sale_agreement", { p_id: row.id, p_snapshot: text });
    setBusy(false);
    if (e2) { setErr(e2.message); return; }
    nav(productHref("onesale", `/a/${row.id}`));
  }

  if (p === undefined) return <p className="py-10 text-center opacity-55">…</p>;
  if (!p || p.agent_id !== userId) {
    return (
      <div className="py-10 text-center">
        <p className="opacity-70">{W(lang, "Only the person who listed this property can start its agreement.",
          "Solo quien publicó este inmueble puede iniciar su promesa.")}</p>
        <Link className="mt-3 inline-block font-bold text-brand underline" to={productHref("onesale", `/s/${id}`)}>
          {W(lang, "Back to the listing", "Volver al inmueble")}
        </Link>
      </div>
    );
  }

  const field = "input w-full";
  const label = "text-[12px] font-bold opacity-70";
  const ccy = (p.currency || "USD").toUpperCase();

  return (
    <div className="space-y-4 pb-28">
      <Link to={productHref("onesale", `/s/${p.id}`)} className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to the listing", "Volver al inmueble")}
      </Link>
      {/* Short on purpose: the long name truncated beside the header avatar at phone width. */}
      <ScreenHeading>{W(lang, "Agreement", "Promesa")}</ScreenHeading>
      <p className="-mt-2 text-[13px] opacity-65">{p.title}</p>

      <section className="ow-panel space-y-3 p-4">
        <p className={label}>{W(lang, "You are the", "Usted es el")}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["seller", "agent"] as const).map(r => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={role === r ? "btn-primary" : "btn-ghost"}>
              {r === "seller" ? W(lang, "Seller", "Vendedor") : W(lang, "Agent", "Agente")}
            </button>
          ))}
        </div>
      </section>

      <section className="ow-panel space-y-3 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{W(lang, "Who signs", "Quién firma")}</h2>
        {role === "agent" && (<>
          <label className="block"><span className={label}>{W(lang, "Seller's full name", "Nombre completo del vendedor")}</span>
            <input className={field} value={sellerName} onChange={e => setSellerName(e.target.value)} /></label>
          <label className="block"><span className={label}>{W(lang, "Seller's email", "Correo del vendedor")}</span>
            <input className={field} type="email" inputMode="email" value={sellerEmail} onChange={e => setSellerEmail(e.target.value)} /></label>
        </>)}
        <label className="block"><span className={label}>{W(lang, "Buyer's full name", "Nombre completo del comprador")}</span>
          <input className={field} value={buyerName} onChange={e => setBuyerName(e.target.value)} /></label>
        <label className="block"><span className={label}>{W(lang, "Buyer's email", "Correo del comprador")}</span>
          <input className={field} type="email" inputMode="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} /></label>
        {role === "seller" && (
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={withAgent} onChange={e => setWithAgent(e.target.checked)} />
            {W(lang, "An agent is involved", "Hay un agente inmobiliario")}
          </label>
        )}
        {role === "seller" && withAgent && (<>
          <label className="block"><span className={label}>{W(lang, "Agent's name", "Nombre del agente")}</span>
            <input className={field} value={agentName} onChange={e => setAgentName(e.target.value)} /></label>
          <label className="block"><span className={label}>{W(lang, "Agent's email", "Correo del agente")}</span>
            <input className={field} type="email" inputMode="email" value={agentEmail} onChange={e => setAgentEmail(e.target.value)} /></label>
        </>)}
        <p className="text-[11.5px] opacity-55">
          {W(lang, "Each person signs from their own account, using this email.", "Cada persona firma desde su propia cuenta, con este correo.")}
        </p>
      </section>

      <section className="ow-panel space-y-3 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{W(lang, "Money", "Dinero")}</h2>
        <label className="block"><span className={label}>{W(lang, "Price", "Precio")} · {ccy}</span>
          <input className={field} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
        <label className="block"><span className={label}>{W(lang, "Down payment (arras)", "Arras")} · {ccy}</span>
          <input className={field} inputMode="decimal" value={down} onChange={e => setDown(e.target.value.replace(/[^\d.]/g, ""))} /></label>
        <label className="block"><span className={label}>{W(lang, "Down payment due", "Fecha límite de las arras")}</span>
          <GlassDate value={downDue} onChange={setDownDue} /></label>
        <label className="block"><span className={label}>{W(lang, "Kind of down payment", "Tipo de arras")}</span>
          <GlassSelect value={arras} onChange={setArras} options={[
            { value: "confirmatorias", label: W(lang, "Confirmatory", "Confirmatorias") },
            { value: "retracto", label: W(lang, "Withdrawal", "De retracto") },
          ]} />
          <span className="mt-1 block text-[11.5px] opacity-55">
            {arras === "confirmatorias"
              ? W(lang, "Counts toward the price. Nobody can walk away.", "Se abonan al precio. Nadie puede retractarse.")
              : W(lang, "Either side can walk away: the buyer loses it, or the seller pays it back doubled.", "Cualquiera puede retractarse: el comprador las pierde, o el vendedor las devuelve dobladas.")}
          </span></label>
        {agentOn && (<>
          <label className="block"><span className={label}>{W(lang, "Agent commission, % of price", "Comisión del agente, % del precio")}</span>
            <input className={field} inputMode="decimal" value={commission} onChange={e => setCommission(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          <label className="block"><span className={label}>{W(lang, "Commission paid by", "Comisión a cargo de")}</span>
            <GlassSelect value={paidBy} onChange={setPaidBy} options={[
              { value: "seller", label: W(lang, "Seller", "Vendedor") },
              { value: "buyer", label: W(lang, "Buyer", "Comprador") },
              { value: "split", label: W(lang, "Split equally", "Por partes iguales") },
            ]} /></label>
        </>)}
        <label className="block"><span className={label}>{W(lang, "Penalty for breach, % of price", "Cláusula penal, % del precio")}</span>
          <input className={field} inputMode="decimal" value={penalty} onChange={e => setPenalty(e.target.value.replace(/[^\d.]/g, ""))} /></label>
      </section>

      <section className="ow-panel space-y-3 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{W(lang, "Closing at the notary", "Escritura ante notario")}</h2>
        <label className="block"><span className={label}>{W(lang, "Deed date", "Fecha de la escritura")}</span>
          <GlassDate value={closing} onChange={setClosing} /></label>
        <label className="block"><span className={label}>{W(lang, "Notary", "Notaría")}</span>
          <input className={field} value={notary} placeholder={W(lang, "e.g. Notaría 25 de Medellín", "p. ej. Notaría 25 de Medellín")}
            onChange={e => setNotary(e.target.value)} /></label>
        <label className="block"><span className={label}>{W(lang, "Anything else agreed (optional)", "Otros acuerdos (opcional)")}</span>
          <textarea className={`${field} min-h-[88px]`} maxLength={4000} value={extra} onChange={e => setExtra(e.target.value)} /></label>
        <label className="block"><span className={label}>{W(lang, "Language of the document", "Idioma del documento")}</span>
          <GlassSelect value={docLang} onChange={setDocLang} options={[
            { value: "es", label: "Español" }, { value: "en", label: "English" },
          ]} /></label>
      </section>

      <details className="ow-panel p-4">
        <summary className="cursor-pointer text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "Read the full agreement", "Leer la promesa completa")}
        </summary>
        <p className="mt-2 rounded-xl bg-amber-500/10 p-2.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
          {AGREEMENT_DRAFT_NOTE[docLang]}
        </p>
        <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed opacity-90">{text}</pre>
      </details>

      {problems.length > 0 && (
        <p className="text-[12.5px] opacity-70">
          {W(lang, "Still needed:", "Falta:")} {problems.join(" · ")}
        </p>
      )}
      {err && <p className="rounded-xl bg-red-500/10 p-3 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
      <button type="button" className="btn-primary w-full" disabled={busy || problems.length > 0} onClick={send}>
        {busy ? "…" : W(lang, "Send for signatures", "Enviar para firmas")}
      </button>
      <p className="text-center text-[11.5px] opacity-55">
        {W(lang, "Once sent, nobody can change a word. Everyone signs the same text.", "Una vez enviada, nadie puede cambiar una palabra. Todos firman el mismo texto.")}
      </p>
    </div>
  );
}
