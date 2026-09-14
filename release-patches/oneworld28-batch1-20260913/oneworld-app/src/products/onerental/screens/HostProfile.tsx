import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  GlassSelect, ScreenHeading, W, productHref, supabase, useI18n, useOneId,
} from "@oneworld/shell";
import { usePayoutStatus } from "@evt/hooks/usePayoutStatus";
import type { HostDocumentKind, HostPayoutMethod, HostRole } from "../lib/hostProfile";

type HostRow = {
  user_id: string;
  role: HostRole;
  legal_name: string;
  document_kind: HostDocumentKind;
  document_number: string;
  identity_storage_path: string;
  identity_mime_type: string;
  identity_byte_size: number;
  private_address_line: string;
  private_city: string;
  private_region: string | null;
  private_postal_code: string | null;
  private_country: string;
  payout_method: HostPayoutMethod;
  manual_payout_confirmed_at: string | null;
};

const MAX_ID_BYTES = 15 * 1024 * 1024;
const ACCEPTED_ID_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function HostProfile() {
  const { lang } = useI18n();
  const { userId, displayName } = useOneId();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const payout = usePayoutStatus();
  const [role, setRole] = useState<HostRole>("owner");
  const [legalName, setLegalName] = useState("");
  const [documentKind, setDocumentKind] = useState<HostDocumentKind>("passport");
  const [documentNumber, setDocumentNumber] = useState("");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [existingPath, setExistingPath] = useState("");
  const [existingMime, setExistingMime] = useState("application/pdf");
  const [existingBytes, setExistingBytes] = useState(1);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("CO");
  const [payoutMethod, setPayoutMethod] = useState<HostPayoutMethod>("remitly");
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [pendingCleanupPath, setPendingCleanupPath] = useState("");
  const [previousIdentityPath, setPreviousIdentityPath] = useState("");

  const requestedReturn = params.get("return");
  const returnPath = requestedReturn?.startsWith("/rentals/")
    ? requestedReturn
    : productHref("onerental", "/list?form=1");

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void (async () => {
      try {
        const { data, error } = await supabase.from("rental_host_profiles")
          .select("user_id,role,legal_name,document_kind,document_number,identity_storage_path,identity_mime_type,identity_byte_size,private_address_line,private_city,private_region,private_postal_code,private_country,payout_method,manual_payout_confirmed_at")
          .eq("user_id", userId).maybeSingle<HostRow>();
        if (!alive) return;
        if (error) { setErr(error.message); return; }
        if (data) {
          setRole(data.role); setLegalName(data.legal_name); setDocumentKind(data.document_kind);
          setDocumentNumber(data.document_number); setExistingPath(data.identity_storage_path);
          setExistingMime(data.identity_mime_type); setExistingBytes(data.identity_byte_size);
          setAddress(data.private_address_line); setCity(data.private_city); setRegion(data.private_region ?? "");
          setPostal(data.private_postal_code ?? ""); setCountry(data.private_country);
          setPayoutMethod(data.payout_method); setManualConfirmed(!!data.manual_payout_confirmed_at);
        } else {
          setLegalName(displayName || "");
        }
      } catch (error: any) {
        if (alive) setErr(error?.message || W(lang, "Could not load your private host profile. Try again.", "No se pudo cargar su perfil privado de anfitrión. Inténtelo de nuevo."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, displayName, lang]);

  const payoutReady = payoutMethod === "stripe" ? payout.payouts_enabled : manualConfirmed;
  const identityReady = !!existingPath || !!identityFile;
  const missing = useMemo(() => [
    !legalName.trim() && W(lang, "your legal name", "su nombre legal"),
    !documentNumber.trim() && W(lang, "your ID number", "su número de identificación"),
    !identityReady && W(lang, "a photo or PDF of your ID", "una foto o PDF de su identificación"),
    !address.trim() && W(lang, "your private address", "su dirección privada"),
    !city.trim() && W(lang, "your city", "su ciudad"),
    !payoutReady && W(lang, "a ready payment route", "una forma de pago lista"),
  ].filter(Boolean) as string[], [legalName, documentNumber, identityReady, address, city, payoutReady, lang]);

  async function connectStripe() {
    setBusy(true); setErr("");
    try {
      const url = await payout.startOnboarding(productHref("onerental", "/host-profile"));
      if (url) window.location.assign(url);
      else setErr(W(lang, "Could not open secure payout setup. Try again.", "No se pudo abrir la configuración segura de pagos. Inténtelo de nuevo."));
    } catch (error: any) {
      setErr(error?.message || W(lang, "Could not open secure payout setup.", "No se pudo abrir la configuración segura de pagos."));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (pendingCleanupPath) { await retryCleanup(); return; }
    if (!userId || missing.length) { setErr(W(lang, "Complete the highlighted host details first.", "Complete primero los datos indicados del anfitrión.")); return; }
    if (identityFile && (!ACCEPTED_ID_TYPES.includes(identityFile.type) || identityFile.size > MAX_ID_BYTES)) {
      setErr(W(lang, "Use a JPG, PNG, WebP or PDF no larger than 15 MB.", "Use JPG, PNG, WebP o PDF de máximo 15 MB.")); return;
    }
    setBusy(true); setErr(""); setSaved(false);
    let nextPath = existingPath;
    let nextMime = identityFile?.type || existingMime;
    let nextBytes = identityFile?.size || existingBytes;
    let uploadedPath = "";
    let uploadConfirmed = false;
    try {
      if (identityFile) {
        const ext = identityFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        uploadedPath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("rental-host-identity").upload(uploadedPath, identityFile, { upsert: false, contentType: identityFile.type });
        if (error) { setErr(error.message); return; }
        uploadConfirmed = true;
        nextPath = uploadedPath; nextMime = identityFile.type; nextBytes = identityFile.size;
      }
      const now = new Date().toISOString();
      const row = {
        user_id: userId, role, legal_name: legalName.trim(), document_kind: documentKind,
        document_number: documentNumber.trim(), identity_storage_path: nextPath,
        identity_mime_type: nextMime, identity_byte_size: nextBytes,
        private_address_line: address.trim(), private_city: city.trim(), private_region: region.trim() || null,
        private_postal_code: postal.trim() || null, private_country: country.toUpperCase(), payout_method: payoutMethod,
        manual_payout_confirmed_at: payoutMethod === "stripe" ? null : now, updated_at: now,
      };
      const { data: savedRow, error } = await supabase.from("rental_host_profiles")
        .upsert(row, { onConflict: "user_id" }).select("user_id,identity_storage_path").single<{ user_id: string; identity_storage_path: string }>();
      if (error || !savedRow || savedRow.user_id !== userId || savedRow.identity_storage_path !== nextPath) {
        if (uploadedPath) {
          setPreviousIdentityPath(previousIdentityPath || existingPath);
          setExistingPath(uploadedPath); setExistingMime(nextMime); setExistingBytes(nextBytes); setIdentityFile(null);
        }
        // Returned errors can also mean a lost response after a committed write.
        setErr(W(lang, "OneHome could not confirm whether the profile saved. The private ID copy was preserved safely; retry Save to verify it.", "OneHome no pudo confirmar si el perfil se guardó. La copia privada de la identificación se conservó de forma segura; vuelva a Guardar para verificarla."));
        return;
      }
      const cleanupPath = previousIdentityPath || existingPath;
      if (cleanupPath && cleanupPath !== nextPath) {
        setPendingCleanupPath(cleanupPath);
        const { error: cleanupError } = await supabase.storage.from("rental-host-identity").remove([cleanupPath]);
        if (cleanupError) {
          setExistingPath(nextPath); setExistingMime(nextMime); setExistingBytes(nextBytes); setIdentityFile(null);
          setSaved(true);
          setErr(W(lang, "Your profile is saved, but the prior private ID copy still needs secure cleanup. Retry cleanup below.", "Su perfil está guardado, pero aún falta eliminar de forma segura la copia privada anterior. Reintente la limpieza abajo."));
          return;
        }
      }
      setPendingCleanupPath(""); setPreviousIdentityPath("");
      setExistingPath(nextPath); setExistingMime(nextMime); setExistingBytes(nextBytes); setIdentityFile(null); setSaved(true);
      nav(returnPath);
    } catch (error: any) {
      /* A thrown transport error is ambiguous: the upsert may have committed after the client
         lost the response. Never delete the uploaded object in that case. Retain its path so a
         retry verifies and attaches the same private object instead of creating another copy. */
      if (uploadedPath && uploadConfirmed) {
        setPreviousIdentityPath(previousIdentityPath || existingPath);
        setExistingPath(uploadedPath); setExistingMime(nextMime); setExistingBytes(nextBytes); setIdentityFile(null);
        setErr(W(lang, "OneHome could not confirm whether the profile saved. The private ID copy was preserved safely; retry Save to verify it.", "OneHome no pudo confirmar si el perfil se guardó. La copia privada de la identificación se conservó de forma segura; vuelva a Guardar para verificarla."));
      } else {
        setErr(error?.message || W(lang, "Could not save your private host profile. Try again.", "No se pudo guardar su perfil privado de anfitrión. Inténtelo de nuevo."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function retryCleanup() {
    if (!pendingCleanupPath) return;
    setBusy(true);
    try {
      const { error } = await supabase.storage.from("rental-host-identity").remove([pendingCleanupPath]);
      if (error) { setErr(error.message); return; }
      setPendingCleanupPath(""); setPreviousIdentityPath(""); setErr(""); nav(returnPath);
    } catch (error: any) {
      setErr(error?.message || W(lang, "Secure cleanup is still unavailable. Try again.", "La limpieza segura aún no está disponible. Inténtelo de nuevo."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-sm opacity-55">{W(lang, "Loading host setup…", "Cargando configuración…")}</div>;

  return (
    <div className="space-y-4 pb-28">
      <ScreenHeading>{W(lang, "Your host profile", "Su perfil de anfitrión")}</ScreenHeading>
      <p className="text-[12.5px] leading-relaxed opacity-65">{W(lang,
        "Complete this once before listing. OneHome uses it to prepare private rental documents, so you do not retype the same owner or manager details for every tenant.",
        "Complételo una vez antes de publicar. OneHome lo usa para preparar documentos privados de arriendo, para que no repita los mismos datos con cada inquilino.")}</p>

      <HostSection title={W(lang, "Who you are", "Quién es usted")}>
        <Field label={W(lang, "Your role for the property", "Su rol frente al inmueble")}>
          <GlassSelect<HostRole> value={role} onChange={setRole} ariaLabel={W(lang, "Property role", "Rol frente al inmueble")} options={[
            { value: "owner", label: W(lang, "Property owner", "Propietario") },
            { value: "property_manager", label: W(lang, "Property manager", "Administrador del inmueble") },
            { value: "agent", label: W(lang, "Property agent", "Agente inmobiliario") },
          ]} />
        </Field>
        <Field label={W(lang, "Legal name", "Nombre legal")}><input className="input w-full" value={legalName} onChange={e => setLegalName(e.target.value)} /></Field>
      </HostSection>

      <HostSection title={W(lang, "Government identity", "Identificación oficial")}>
        <p className="text-[11.5px] leading-relaxed opacity-60">{W(lang,
          "Private. It is never shown on your public profile or listing.",
          "Privado. Nunca aparece en su perfil público ni en el anuncio.")}</p>
        <div className="grid grid-cols-[125px_minmax(0,1fr)] gap-2">
          <GlassSelect<HostDocumentKind> value={documentKind} onChange={setDocumentKind} ariaLabel={W(lang, "ID type", "Tipo de documento")} options={[
            { value: "passport", label: W(lang, "Passport", "Pasaporte") },
            { value: "national_id", label: W(lang, "National ID", "Cédula") },
            { value: "residence_permit", label: W(lang, "Residence ID", "Cédula extranjería") },
            { value: "nit", label: "NIT" },
          ]} />
          <input className="input min-w-0 w-full" value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder={W(lang, "ID number", "Número")} />
        </div>
        <label className="ow-tap flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-brand/25 bg-brand/[0.05] px-3 text-[12.5px] font-bold text-brand-deep dark:text-brand-light">
          <span>{identityFile?.name || (existingPath ? W(lang, "ID on file · replace", "Identificación guardada · reemplazar") : W(lang, "Upload ID photo or PDF", "Subir foto o PDF"))}</span>
          <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setIdentityFile(e.target.files?.[0] ?? null)} />
        </label>
      </HostSection>

      <HostSection title={W(lang, "Your private address", "Su dirección privada")}>
        <p className="text-[11.5px] leading-relaxed opacity-60">{W(lang, "Used for legal documents only—not the property address and not public.", "Solo para documentos legales; no es la dirección del inmueble ni es pública.")}</p>
        <Field label={W(lang, "Street address", "Dirección")}><input className="input w-full" value={address} onChange={e => setAddress(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={W(lang, "City", "Ciudad")}><input className="input w-full" value={city} onChange={e => setCity(e.target.value)} /></Field>
          <Field label={W(lang, "State / department", "Departamento")}><input className="input w-full" value={region} onChange={e => setRegion(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={W(lang, "Postal code", "Código postal")}><input className="input w-full" value={postal} onChange={e => setPostal(e.target.value)} /></Field>
          <Field label={W(lang, "Country code", "País")}><input className="input w-full uppercase" maxLength={2} value={country} onChange={e => setCountry(e.target.value)} /></Field>
        </div>
      </HostSection>

      <HostSection title={W(lang, "How you receive rent", "Cómo recibe el arriendo")}>
        <p className="text-[11.5px] leading-relaxed opacity-60">{W(lang,
          "OneHome does not store full bank-account numbers. Stripe keeps bank details in its secure system; for Remitly, Wise or bank transfer, confirm that your receiving account is ready.",
          "OneHome no guarda números bancarios completos. Stripe conserva los datos bancarios en su sistema seguro; para Remitly, Wise o transferencia, confirme que su cuenta receptora está lista.")}</p>
        <GlassSelect<HostPayoutMethod> value={payoutMethod} onChange={value => { setPayoutMethod(value); setManualConfirmed(false); }} ariaLabel={W(lang, "Rent payment route", "Forma de recibir el arriendo")} options={[
          { value: "remitly", label: "Remitly" }, { value: "wise", label: "Wise" },
          { value: "bank_transfer", label: W(lang, "Bank transfer", "Transferencia bancaria") },
          { value: "stripe", label: "Stripe" },
        ]} />
        {payoutMethod === "stripe" ? (
          payout.payouts_enabled
            ? <p className="rounded-xl bg-emerald-500/10 p-3 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-300">✓ {W(lang, "Payout account ready", "Cuenta de pagos lista")}{payout.bank_last4 ? ` · •••• ${payout.bank_last4}` : ""}</p>
            : <button type="button" className="btn-primary w-full" disabled={busy || payout.loading} onClick={() => void connectStripe()}>{W(lang, "Connect secure payout account", "Conectar cuenta de pagos segura")}</button>
        ) : (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-ink/12 p-3 text-[12.5px] dark:border-white/15">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" checked={manualConfirmed} onChange={e => setManualConfirmed(e.target.checked)} />
            <span>{W(lang, `I confirm my ${payoutMethod === "bank_transfer" ? "bank transfer" : payoutMethod} receiving account is ready.`, `Confirmo que mi cuenta receptora de ${payoutMethod === "bank_transfer" ? "transferencia bancaria" : payoutMethod} está lista.`)}</span>
          </label>
        )}
      </HostSection>

      {err && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-[12.5px] font-bold text-red-600 dark:text-red-300">{err}</p>}
      {saved && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-[12.5px] font-bold text-emerald-700">{W(lang, "Host profile saved.", "Perfil guardado.")}</p>}
      {pendingCleanupPath && <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => void retryCleanup()}>{W(lang, "Retry secure cleanup", "Reintentar limpieza segura")}</button>}
      {missing.length > 0 && <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">{W(lang, "Still needed: ", "Falta: ")}{missing.join(", ")}.</p>}
      <button type="button" className="btn-primary w-full" disabled={busy || missing.length > 0} onClick={() => void save()}>{busy ? "…" : W(lang, "Save and continue", "Guardar y continuar")}</button>
    </div>
  );
}

function HostSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card space-y-3 p-4"><h2 className="text-[16px] font-black">{title}</h2>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
