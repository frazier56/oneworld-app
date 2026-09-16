import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  GlassSelect, PayoutMethods, PlacesInput, ScreenHeading, W, productHref, supabase, useI18n, useOneId,
} from "@oneworld/shell";
import type { HostDocumentKind, HostPayoutMethod, HostRole } from "../lib/hostProfile";

/* ⚠️ THE PAYOUT CHOOSER IS GONE, AND SO IS THE LABEL MAP THAT FED IT (Lee, 14 Sep 2026:
   *"No one knows Stripe ... we should be using the vault"*).

   What stood here: a four-option dropdown (Remitly / Wise / bank transfer / "Card or bank
   account") and, for the three manual ones, a tick box reading "I confirm my Wise account is
   ready." Between them they stored a PREFERENCE and a PROMISE. Neither is a destination — a
   host could tick the box with no Wise account at all and read as ready to list.

   The vault holds destinations: a Stripe Connect account Stripe itself reports as
   `payouts_enabled`, or a PayPal / Wise pay link in the shared `payment_methods` table that
   OneJob already writes. One surface, `<PayoutMethods>`, owned by the shell, mounted by every
   product. A host who added a Wise link in OneJob does nothing here at all.

   `payout_method` survives as a RECORD of which destination is in use — never a chooser —
   because `rental_host_profile_readiness()` returns it and the contract screen reads it. */
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
  /* The destination the vault actually holds, re-asked whenever <PayoutMethods> changes one.
     `null` = not answered yet, and that is NOT the same as "none": a host must never be told
     they have no way to be paid while we are still looking. */
  const [vaultLinks, setVaultLinks] = useState<number | null>(null);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);
  const [storedMethod, setStoredMethod] = useState<HostPayoutMethod | null>(null);
  const [manualConfirmedAt, setManualConfirmedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [pendingCleanupPath, setPendingCleanupPath] = useState("");
  const [previousIdentityPath, setPreviousIdentityPath] = useState("");

  /* ── WHERE THIS HOST IS ACTUALLY PAID ────────────────────────────────────────────────
     Two reads, because the vault is two tables: pay links live in `payment_methods` (shared
     with OneJob) and bank payouts live in `stripe_connect_accounts`. Both are asked with named
     columns and scoped to this user — `payment_methods` also holds CARDS, which are money
     coming IN and must never satisfy "can this host be paid", so the rails are filtered in the
     query, not afterwards where a future edit can drop the filter.

     A FAILED read is not an empty vault: on failure the counts stay `null`, `payoutAnswered`
     stays false, and the screen says it is still checking rather than telling a host with a
     perfectly good Wise link that they have nowhere to be paid. */
  const refreshPayout = useCallback(async () => {
    if (!userId) { setVaultLinks(0); setStripeReady(false); return; }
    const [links, connect] = await Promise.all([
      supabase.from("payment_methods").select("id", { count: "exact", head: true })
        .eq("user_id", userId).in("method_type", ["wise", "paypal"]),
      supabase.from("stripe_connect_accounts").select("payouts_enabled")
        .eq("user_id", userId).maybeSingle<{ payouts_enabled: boolean }>(),
    ]);
    if (!links.error) setVaultLinks(links.count ?? 0);
    if (!connect.error) setStripeReady(!!connect.data?.payouts_enabled);
  }, [userId]);

  useEffect(() => {
    setVaultLinks(null); setStripeReady(null);
    void refreshPayout();
  }, [refreshPayout]);

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
          setStoredMethod(data.payout_method); setManualConfirmedAt(data.manual_payout_confirmed_at);
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

  /* ⚠️ THIS MUST ASK THE SAME QUESTION `rental_host_profile_readiness()` ASKS, or the Save
     button and the server disagree and the host is bounced with no explanation. The server:
        payout_ok = stripe_payouts_ready OR vault_link_ready OR manual_payout_confirmed_at is not null
     A card in `payment_methods` never counts — that is money coming IN. `vaultLinks` is
     already filtered to the pay-link rails for exactly that reason.

     The third arm keeps every host who ticked the old box before this batch: their
     `manual_payout_confirmed_at` is set, the server still honours it, and so does this. It is
     never written again — see save(). */
  const payoutAnswered = vaultLinks !== null && stripeReady !== null;
  const payoutReady = payoutAnswered
    && (stripeReady || vaultLinks > 0 || manualConfirmedAt !== null);
  /* What the row records, derived from what the vault holds — not from a dropdown. A host with
     both keeps `stripe`, because that is the route money moves through when it exists. */
  const payoutMethod: HostPayoutMethod | null =
    stripeReady ? "stripe" : (vaultLinks ?? 0) > 0 ? "vault" : manualConfirmedAt ? storedMethod : null;
  const identityReady = !!existingPath || !!identityFile;
  const missing = useMemo(() => [
    !legalName.trim() && W(lang, "your legal name", "su nombre legal"),
    !documentNumber.trim() && W(lang, "your ID number", "su número de identificación"),
    !identityReady && W(lang, "a photo or PDF of your ID", "una foto o PDF de su identificación"),
    !address.trim() && W(lang, "your private address", "su dirección privada"),
    !city.trim() && W(lang, "your city", "su ciudad"),
    !payoutReady && W(lang, "somewhere to be paid", "un destino para sus pagos"),
  ].filter(Boolean) as string[], [legalName, documentNumber, identityReady, address, city, payoutReady, lang]);

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
        private_postal_code: postal.trim() || null, private_country: country.toUpperCase(),
        /* RECORD, not a choice. `payoutMethod` is derived above from what the vault holds; when
           the vault holds nothing and only the legacy tick box makes this host ready, the stored
           value is left exactly as it was. */
        payout_method: payoutMethod ?? storedMethod ?? "vault",
        /* ⚠️ NEVER STAMPED HERE AGAIN. The old code wrote `now` into this column for any method
           that was not Stripe, which is how "I promise my account is ready" became a permanent
           server-side fact. Existing stamps are preserved so no current host is un-readied; no
           new one is ever created. */
        manual_payout_confirmed_at: manualConfirmedAt, updated_at: now,
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
        {/* ⚠️ THIS COLUMN WAS A FIXED 125px AND THE LONGEST OPTION DID NOT FIT IN IT. Lee, 14
            September 2026: *"The passport dropdown is not long enough — it cuts the word off."*
            "Cédula extranjería" is 18 characters; the box was measured against "Passport".
            `auto` lets the select take exactly the width of its widest option in whatever
            language is loaded, and `minmax(0,1fr)` still gives the number field everything left,
            so this cannot come back the first time somebody adds a longer document type or
            switches to German. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
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
        {/* ── ⚠️ WHY WE ASK AT ALL — Lee, 14 Sep 2026: *"You're asking for the property manager's
             physical address. Do you need their private address? If not, then don't put it."*

             We do need it, and the old sentence never said why, which is exactly why it read as
             nosy. A Colombian lease has to name each party and an address for NOTIFICATIONS — the
             place a legal notice is delivered — and for a landlord or manager that cannot be the
             flat being let, because the person living there is the other party. Without it the
             lease OneHome generates is not a document either side can serve on the other.
             So: keep the field, and say what it is for in one line the host can check. */}
        <p className="text-[11.5px] leading-relaxed opacity-60">{W(lang,
          "Where a legal notice about a lease reaches you. Colombian leases must name one for each side, and it cannot be the property you are letting. Never public, never shown on a listing, and it appears only on a lease you have signed.",
          "Donde le llega una notificación legal sobre un contrato. Los contratos colombianos deben señalar una por cada parte, y no puede ser el inmueble que usted arrienda. Nunca es pública, nunca aparece en un anuncio, y solo figura en un contrato que usted haya firmado.")}</p>
        {/* Google Places on every location field — Lee's global rule, 14 Sep 2026. These three were
            bare text boxes, which is how a lease ends up naming "medellin", "Medellín" and
            "Medellin, Antioquia" as three different notification addresses. Picking a street fills
            the city and department underneath it; typing by hand still works, because a legal
            address that Google does not resolve is still somebody's real address. */}
        <Field label={W(lang, "Street address", "Dirección")}>
          <PlacesInput variant="address" countries={["co"]} bias={city || null}
            value={address} onChange={setAddress}
            onSelectParts={({ name, address: addr, full }) => {
              setAddress(name || full);
              const parts = (addr || "").split(",").map(x => x.trim()).filter(Boolean);
              if (parts[0] && !city.trim()) setCity(parts[0]);
              if (parts[1] && !region.trim()) setRegion(parts[1]);
            }}
            placeholder={W(lang, "e.g. Carrera 43A #7-50", "Ej.: Carrera 43A #7-50")} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={W(lang, "City", "Ciudad")}>
            <PlacesInput variant="city" countries={["co"]}
              value={city} onChange={setCity}
              onSelectParts={({ name, address: addr }) => {
                setCity(name.split(",")[0].trim());
                const dept = (addr || "").split(",").map(x => x.trim()).filter(Boolean)[0];
                if (dept && !region.trim()) setRegion(dept);
              }}
              placeholder={W(lang, "City", "Ciudad")} />
          </Field>
          <Field label={W(lang, "State / department", "Departamento")}>
            <PlacesInput variant="city" countries={["co"]}
              value={region} onChange={setRegion}
              onSelectParts={({ name }) => setRegion(name.split(",")[0].trim())}
              placeholder={W(lang, "Department", "Departamento")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={W(lang, "Postal code", "Código postal")}><input className="input w-full" value={postal} onChange={e => setPostal(e.target.value)} /></Field>
          <Field label={W(lang, "Country", "País")}><input className="input w-full uppercase" maxLength={2} placeholder="CO" value={country} onChange={e => setCountry(e.target.value)} /></Field>
        </div>
      </HostSection>

      <HostSection title={W(lang, "Where you are paid", "Dónde recibe sus pagos")}>
        <p className="text-[11.5px] leading-relaxed opacity-60">{W(lang,
          /* The card-and-bank-numbers promise lives on <PayoutMethods> below, beside the controls
             it is about. Saying it twice on one screen is the redundancy Lee keeps striking. */
          "The same payout details you use across One World — add one here and OneJob has it too.",
          "Los mismos datos de pago que usa en todo One World — agregue uno aquí y OneJob también lo tendrá.")}</p>
        <PayoutMethods
          userId={userId}
          productLabel="OneHome"
          stripeReturnPath={productHref("onerental", "/host-profile")}
          rails={["wise", "paypal"]}
          onChanged={refreshPayout}
          /* OneHome charges nothing on rent a tenant pays you through a link — the fee is on the
             booking, not on the transfer (Lee, 30 Aug 2026). The shell refuses to guess this. */
          feeNote={{
            en: "OneHome charges no fee on rent paid this way.",
            es: "OneHome no cobra comisión sobre el arriendo pagado por esta vía.",
          }}
        />
        {manualConfirmedAt && !stripeReady && (vaultLinks ?? 0) === 0 && (
          /* A host who ticked the old confirmation box before this batch. The server still
             accepts them, so they are not blocked — but nobody can see where their money goes,
             including them, so say so plainly and once. */
          <p className="rounded-xl bg-amber-500/10 p-3 text-[12px] font-semibold leading-relaxed text-amber-800 dark:text-amber-200">
            {W(lang,
              "You confirmed a receiving account earlier, so you can still list. Adding it above means a tenant can actually be shown where to pay you.",
              "Antes confirmó una cuenta receptora, así que aún puede publicar. Si la agrega arriba, un inquilino podrá ver dónde pagarle.")}
          </p>
        )}
      </HostSection>

      {err && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-[12.5px] font-bold text-red-600 dark:text-red-300">{err}</p>}
      {saved && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-[12.5px] font-bold text-emerald-700">{W(lang, "Host profile saved.", "Perfil guardado.")}</p>}
      {pendingCleanupPath && <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => void retryCleanup()}>{W(lang, "Retry secure cleanup", "Reintentar limpieza segura")}</button>}
      {missing.length > 0 && <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">{W(lang, "Still needed: ", "Falta: ")}{missing.join(", ")}.</p>}
      <button type="button" className="btn-primary w-full" disabled={busy || !payoutAnswered || missing.length > 0} onClick={() => void save()}>{busy ? "…" : W(lang, "Save and continue", "Guardar y continuar")}</button>
    </div>
  );
}

function HostSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card space-y-3 p-4"><h2 className="text-[16px] font-black">{title}</h2>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
