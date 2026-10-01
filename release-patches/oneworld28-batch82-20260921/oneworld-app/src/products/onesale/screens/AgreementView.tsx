import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsyncResult, supabase, productHref, W, ScreenHeading, IconCheck, SignaturePad,
} from "@oneworld/shell";
import { AGREEMENT_DRAFT_NOTE } from "../lib/agreementTemplate";
import SignedCopyActions from "../../shared/SignedCopyActions";
import { buildAgreementPdf, inviteLinks, safeFilename, type PdfSigner } from "../../shared/agreementPdf";

/**
 * /sales/a/:id — the sale agreement. The SAME screen for seller, buyer and agent.
 * ============================================================================================
 * Lee, 29 Sep 2026: *"they can sign it with their finger, and then it timestamps it, and then
 * they can save it."* The rent side's ContractView is the twin; this follows its shape — terms,
 * signatures, the signed copy, and one action panel that changes with who is looking.
 *
 * Signing goes through `sign_sale_agreement`, which checks the signer IS that party (account or
 * invited email), that they have not signed already, and that the fingerprint they were shown is
 * the one on record — so nobody signs a text that changed under them.
 */
type Role = "seller" | "buyer" | "agent";

export default function AgreementView() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId, email, displayName } = useOneId();
  const es = lang === "es" || lang === "co";
  const L: "es" | "en" = es ? "es" : "en";
  const [tick, setTick] = useState(0);
  const [name, setName] = useState("");
  const [png, setPng] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const res = useAsyncResult(async () => {
    const { data, error } = await supabase.from("sale_agreements").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Record<string, any> | null;
  }, [id, tick]);
  const a = res.data;

  if (a === undefined && !res.error) return <p className="py-10 text-center opacity-55">…</p>;
  if (!a) {
    return (
      <div className="py-10 text-center">
        <p className="opacity-70">{W(lang, "This agreement isn't available to your account. Sign in with the email it was sent to.",
          "Esta promesa no está disponible para su cuenta. Ingrese con el correo al que se envió.")}</p>
      </div>
    );
  }

  const hasAgent = !!(a.agent_id || a.agent_email);
  const mail = (email ?? "").toLowerCase();
  const isRole = (r: Role) => a[`${r}_id`] === userId || (!a[`${r}_id`] && !!mail && (a[`${r}_email`] ?? "").toLowerCase() === mail);
  const myRoles = (["seller", "buyer", "agent"] as Role[]).filter(r => (r !== "agent" || hasAgent) && isRole(r));
  const toSign = myRoles.find(r => !a[`${r}_signed_at`]);
  const isCreator = a.created_by === userId;
  const doc = (a.lang === "en" ? "en" : "es") as "es" | "en";

  const ROLE: Record<Role, { en: string; es: string }> = {
    seller: { en: "Seller", es: "Vendedor" },
    buyer: { en: "Buyer", es: "Comprador" },
    agent: { en: "Agent", es: "Agente" },
  };
  const roles = (["seller", "buyer", "agent"] as Role[]).filter(r => r !== "agent" || hasAgent);
  const signers: PdfSigner[] = roles.map(r => ({
    role: doc === "es" ? `${ROLE[r].es} · ${ROLE[r].en}` : `${ROLE[r].en} · ${ROLE[r].es}`,
    name: a[`${r}_signed_name`], at: a[`${r}_signed_at`], png: a[`${r}_signature`], ua: a[`${r}_signed_ua`],
  }));
  const signedCount = roles.filter(r => a[`${r}_signed_at`]).length;

  const STATUS: Record<string, { en: string; es: string }> = {
    sent: { en: `Waiting for signatures · ${signedCount} of ${roles.length}`, es: `Esperando firmas · ${signedCount} de ${roles.length}` },
    signed: { en: "Signed by everyone", es: "Firmada por todos" },
    cancelled: { en: "Cancelled", es: "Cancelada" },
    draft: { en: "Draft", es: "Borrador" },
  };

  const title = doc === "es" ? "Promesa de compraventa" : "Promise to buy and sell";
  const build = () => buildAgreementPdf({
    title, subtitle: `${a.seller_name} → ${a.buyer_name}`, body: a.contract_snapshot ?? "",
    signers, sha256: a.snapshot_sha256, sentAt: a.sent_at, completedAt: a.completed_at, lang: doc,
    draftNote: AGREEMENT_DRAFT_NOTE[doc],
  });
  const link = `${window.location.origin}${productHref("onesale", `/a/${a.id}`)}`;
  const invite = inviteLinks(link,
    W(lang, "Please review and sign our sale agreement on OneHome:", "Por favor revise y firme nuestra promesa de compraventa en OneHome:"),
    W(lang, "Sale agreement to sign", "Promesa de compraventa para firmar"));

  async function sign() {
    if (!toSign || !png) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("sign_sale_agreement", {
      p_id: a!.id, p_role: toSign, p_name: (name.trim() || displayName || "").trim(),
      p_signature: png, p_ua: navigator.userAgent, p_sha: a!.snapshot_sha256,
    });
    setBusy(false);
    if (error) { setErr(error.message.replace(/^sale_agreements:\s*/, "")); return; }
    setPng(null); setAgree(false); setTick(t => t + 1);
  }
  async function cancel() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("cancel_sale_agreement", { p_id: a!.id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setTick(t => t + 1);
  }

  const stamp = (iso: string) => new Date(iso).toLocaleString(es ? "es-CO" : "en-US",
    { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <div className="space-y-3 pb-28">
      <Link to={productHref("onesale", "/documents")} className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "My documents", "Mis documentos")}
      </Link>
      {/* Short on purpose: the long name truncated beside the header avatar at phone width. */}
      <ScreenHeading>{W(lang, "Agreement", "Promesa")}</ScreenHeading>
      <p className={`-mt-1 inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${
        a.status === "signed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : a.status === "cancelled" ? "bg-slate-500/15 opacity-70" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>
        {STATUS[a.status]?.[L] ?? a.status}
      </p>

      {/* ── SIGNATURES ── */}
      <section className="ow-panel space-y-2 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{W(lang, "Signatures", "Firmas")}</h2>
        {roles.map(r => (
          <div key={r} className="flex items-center gap-3">
            <div className="h-12 w-28 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-white">
              {a[`${r}_signature`] && <img src={a[`${r}_signature`]} alt="" className="h-full w-full object-contain" />}
            </div>
            <div className="min-w-0 text-[13px]">
              <p className="font-bold">{ROLE[r][L]} · <span className="font-semibold opacity-80">{a[`${r}_signed_name`] ?? a[`${r}_name`] ?? a[`${r}_email`]}</span></p>
              <p className="text-[12px] opacity-60">
                {a[`${r}_signed_at`]
                  ? <span className="inline-flex items-center gap-1"><span className="text-brand"><IconCheck size={12} /></span>{stamp(a[`${r}_signed_at`])}</span>
                  : W(lang, "Not signed yet", "Sin firmar")}
              </p>
            </div>
          </div>
        ))}
        {a.snapshot_sha256 && (
          <p className="pt-1 text-[10.5px] leading-relaxed opacity-45">
            {W(lang, "Document fingerprint", "Huella del documento")}: {String(a.snapshot_sha256).slice(0, 32)}…
          </p>
        )}
      </section>

      {/* ── SIGN ── */}
      {a.status === "sent" && toSign && (
        <section className="ow-panel space-y-3 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "Sign as", "Firmar como")} {ROLE[toSign][L]}
          </h2>
          <p className="text-[12px] opacity-60">{W(lang, "Read the agreement below first.", "Primero lea la promesa abajo.")}</p>
          <input className="input w-full" value={name} onChange={e => setName(e.target.value)}
            placeholder={displayName ?? W(lang, "Your full name", "Su nombre completo")} />
          <SignaturePad onChange={setPng} />
          <label className="flex items-start gap-2 text-[12.5px]">
            <input type="checkbox" className="mt-0.5" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>{W(lang, "I agree to sign this agreement electronically.", "Acepto firmar esta promesa electrónicamente.")}</span>
          </label>
          <button type="button" className="btn-primary w-full" disabled={busy || !png || !agree || !(name.trim() || displayName)} onClick={sign}>
            {busy ? "…" : W(lang, "Sign", "Firmar")}
          </button>
        </section>
      )}

      {/* ── INVITE (the sender, while others still have to sign) ── */}
      {a.status === "sent" && isCreator && signedCount < roles.length && (
        <section className="ow-panel space-y-2 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{W(lang, "Send the link", "Enviar el enlace")}</h2>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn-ghost text-center" href={invite.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a className="btn-ghost text-center" href={invite.email}>{W(lang, "Email", "Correo")}</a>
          </div>
          <button type="button" className="w-full text-[12px] font-bold text-red-600 underline dark:text-red-400" disabled={busy} onClick={cancel}>
            {W(lang, "Cancel this agreement", "Cancelar esta promesa")}
          </button>
        </section>
      )}

      {/* ── THE COPY ── */}
      {a.status !== "draft" && (
        <section className="ow-panel space-y-3 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {a.status === "signed" ? W(lang, "The signed copy", "La copia firmada") : W(lang, "The agreement", "La promesa")}
          </h2>
          <SignedCopyActions build={build} filename={`${safeFilename(title)}-${String(a.id).slice(0, 8)}.pdf`} title={title} />
          <p className="rounded-xl bg-amber-500/10 p-2.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300">{AGREEMENT_DRAFT_NOTE[doc]}</p>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed opacity-90">{a.contract_snapshot}</pre>
        </section>
      )}

      {err && <p className="rounded-xl bg-red-500/10 p-3 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
