import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  useI18n, useOneId, supabase, appDoorway, W, ScreenHeading,
  FormSection, Field, Row, ChoiceChips, Stepper, Toggle, StickyActions,
  GlassDate, GlassSelect, AiTextField,
} from "@oneworld/shell";
import {
  incomeBands, employmentOptions, creditBands, completeness,
  type IncomeBand, type Employment, type CreditBand,
} from "../lib/renter";

/**
 * THE RENTER'S SIDE — fill it in once, apply in one tap, or show a QR.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"maybe a QR code… a quick application with a QR code, so all my information
 * would just populate. That's how a setup on OneJob. So you should look at it."*
 *
 * I did. `screens/QRPay.tsx` is the model and three things are taken from it directly:
 *
 *   · THE MODE. `mode: "form" | "qr"` — the QR is a sub-screen of this one, not a separate route,
 *     exactly as OneJob's QR is a mode of Start-a-job.
 *   · THE READINESS ROW. OneJob shows "Get your money right · 1 of 2" and auto-collapses once
 *     both are done. This shows how complete the profile is and stops nagging at 100%.
 *   · THE TOKEN. OneJob mints a token per QR so a scan is traceable. This stores ONE rotatable
 *     token, because a renter's code goes on a flyer or into a WhatsApp thread and has to be
 *     cancellable without deleting the profile behind it.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────────────────────
 * An agent in Medellín gets forty messages a day that say "is this still available?" and nothing
 * else. They cannot triage that, so they answer the ones with a photo they recognise. A renter with
 * a complete profile jumps that queue on merit rather than on familiarity, which is the whole
 * argument for a credibility platform being in this market.
 *
 * ── WHAT IS NOT ON THIS SCREEN ──────────────────────────────────────────────────────────────
 * No salary box, no credit score, no document number, no bank details. Bands only — the reasoning
 * is on the migration. An agent needs "can they afford it"; a band answers that, and the exact
 * figure only adds something worth stealing.
 */
export default function RenterProfile() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [mode, setMode] = useState<"form" | "qr">("form");

  const [householdSize, setHouseholdSize] = useState<number | null>(1);
  const [hasPets, setHasPets] = useState(false);
  const [petNote, setPetNote] = useState("");
  const [parkingNeeded, setParkingNeeded] = useState<number | null>(null);
  const [moveInFrom, setMoveInFrom] = useState("");
  const [leaseMonths, setLeaseMonths] = useState<number | null>(12);
  const [incomeBand, setIncomeBand] = useState<IncomeBand | null>(null);
  const [employment, setEmployment] = useState<Employment | null>(null);
  const [creditBand, setCreditBand] = useState<CreditBand | null>(null);
  const [intro, setIntro] = useState("");
  const [hasCodeudor, setHasCodeudor] = useState(false);
  const [hasGuarantee, setHasGuarantee] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let dead = false;
    (async () => {
      const { data } = await supabase.from("renter_profiles")
        .select("household_size, has_pets, pet_note, parking_needed, move_in_from, lease_months, " +
                "income_band, employment, credit_band, intro, has_codeudor, has_rent_guarantee, " +
                "share_token, share_enabled")
        .eq("user_id", userId).maybeSingle<any>();
      if (dead) return;
      if (data) {
        setHouseholdSize(data.household_size ?? 1);
        setHasPets(!!data.has_pets);
        setPetNote(data.pet_note ?? "");
        setParkingNeeded(data.parking_needed ?? null);
        setMoveInFrom(data.move_in_from ?? "");
        setLeaseMonths(data.lease_months ?? 12);
        setIncomeBand((data.income_band as IncomeBand) ?? null);
        setEmployment((data.employment as Employment) ?? null);
        setCreditBand((data.credit_band as CreditBand) ?? null);
        setIntro(data.intro ?? "");
        setHasCodeudor(!!data.has_codeudor);
        setHasGuarantee(!!data.has_rent_guarantee);
        setShareEnabled(!!data.share_enabled);
        setShareToken(data.share_token ?? null);
      }
      setLoaded(true);
    })();
    return () => { dead = true; };
  }, [userId]);

  const draft = {
    household_size: householdSize, has_pets: hasPets, pet_note: petNote.trim() || null,
    parking_needed: parkingNeeded, move_in_from: moveInFrom || null, lease_months: leaseMonths,
    income_band: incomeBand, employment, credit_band: creditBand,
    intro: intro.trim() || null, has_codeudor: hasCodeudor, has_rent_guarantee: hasGuarantee,
  };
  const pct = Math.round(completeness(draft) * 100);

  async function save(nextShare?: boolean) {
    if (!userId) return;
    setBusy(true); setErr(null); setSaved(false);
    const { data, error } = await supabase.from("renter_profiles")
      .upsert({
        user_id: userId, ...draft,
        share_enabled: nextShare ?? shareEnabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("share_token, share_enabled").single<any>();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setShareToken(data?.share_token ?? null);
    setShareEnabled(!!data?.share_enabled);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  /* ROTATING THE TOKEN IS THE REVOKE. Every printed code and every pasted link dies at once, and
     the profile itself is untouched — which is the point of it being a column rather than the
     user's id. */
  async function rotate() {
    if (!userId) return;
    setBusy(true);
    const fresh = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const { data, error } = await supabase.from("renter_profiles")
      .update({ share_token: fresh, updated_at: new Date().toISOString() })
      .eq("user_id", userId).select("share_token").single<any>();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setShareToken(data?.share_token ?? null);
  }

  const shareUrl = shareToken ? `${appDoorway("onehome")}/apply/${shareToken}` : "";

  if (mode === "qr") {
    return <QrScreen lang={lang} url={shareUrl} onBack={() => setMode("form")} onRotate={rotate} busy={busy} />;
  }

  return (
    <div className="space-y-1 pb-28">
      <ScreenHeading>{W(lang, "Your renter profile", "Su perfil de arrendatario")}</ScreenHeading>
      <p className="text-[12.5px] leading-relaxed opacity-60">
        {W(lang,
          "Fill this in once. Every place you enquire about gets a complete application instead of a message asking if it's still available — which is how you get answered first.",
          "Complételo una vez. Cada inmueble por el que pregunte recibe una solicitud completa en vez de un mensaje preguntando si sigue disponible — que es como logra que le respondan primero.")}
      </p>

      {/* THE READINESS ROW, borrowed from OneJob's "Get your money right". It stops nagging at
          100% rather than sitting there congratulating itself. */}
      {loaded && pct < 100 && (
        <div className="mt-3 rounded-2xl border border-brand/30 bg-brand/[0.06] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold">
              {W(lang, "Profile completeness", "Perfil completo")}
            </span>
            <span className="text-[12.5px] font-black tabular-nums">{pct}%</span>
          </div>
          <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-white/15">
            <span className="block h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${pct}%` }} />
          </span>
          <p className="mt-1.5 text-[11.5px] leading-relaxed opacity-65">
            {W(lang,
              "Agents answer complete profiles first. \"Rather not say\" counts as answered — declining is a decision, not a gap.",
              "Los agentes responden primero a los perfiles completos. \"Prefiero no decirlo\" cuenta como respondido — no responder es una decisión, no un vacío.")}
          </p>
        </div>
      )}

      <FormSection title={W(lang, "Who's moving in", "Quién se muda")}
        icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8">
        <Row>
          <Field label={W(lang, "People", "Personas")}>
            <Stepper value={householdSize} onChange={setHouseholdSize} min={1} max={20} />
          </Field>
          <Field label={W(lang, "Parking spaces needed", "Parqueaderos necesarios")} optional>
            <Stepper value={parkingNeeded} onChange={setParkingNeeded} min={0} max={6} />
          </Field>
        </Row>
        <Toggle on={hasPets} onChange={setHasPets}
          label={W(lang, "I have pets", "Tengo mascotas")}
          note={W(lang, "Say so up front — it's the single most common reason an application gets rejected late.",
                        "Dígalo desde el principio — es la razón más común de un rechazo tardío.")} />
        {hasPets && (
          <Field label={W(lang, "Tell them about your pets", "Cuénteles sobre sus mascotas")} optional>
            <input className="input w-full" maxLength={200} value={petNote}
              onChange={e => setPetNote(e.target.value)}
              placeholder={W(lang, "One small dog, 6kg, house-trained", "Un perro pequeño, 6 kg, entrenado")} />
          </Field>
        )}
      </FormSection>

      <FormSection title={W(lang, "When, and for how long", "Cuándo y por cuánto tiempo")}
        icon="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z">
        <Field label={W(lang, "I can move in from", "Puedo mudarme desde")}>
          <GlassDate value={moveInFrom} onChange={setMoveInFrom} />
        </Field>
        <Field label={W(lang, "How long I'd like to stay", "Cuánto me gustaría quedarme")}
          hint={W(lang,
            "Longer than six months matters here — Colombian residential leases work differently from short stays.",
            "Más de seis meses importa aquí — los arriendos de vivienda funcionan distinto a las estadías cortas.")}>
          <Stepper value={leaseMonths} onChange={setLeaseMonths} min={1} max={60}
            suffix={W(lang, "months", "meses")} />
        </Field>
      </FormSection>

      {/* ── THE MONEY QUESTIONS ───────────────────────────────────────────────────────────────
          Framed as bands, and the screen says WHY it is asking. A financial question with no
          stated purpose is the point at which people abandon a form. */}
      <FormSection title={W(lang, "Affordability", "Capacidad de pago")}
        icon="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3"
        hint={W(lang,
          "Bands only — never an exact figure, and nothing here is verified or shared beyond the agents you apply to.",
          "Solo rangos — nunca una cifra exacta, y nada de esto se verifica ni se comparte más allá de los agentes a los que aplique.")}>
        <Field label={W(lang, "Monthly income", "Ingresos mensuales")}>
          <GlassSelect<IncomeBand | "">
            value={(incomeBand ?? "") as IncomeBand | ""}
            ariaLabel={W(lang, "Monthly income", "Ingresos mensuales")}
            onChange={v => setIncomeBand(v === "" ? null : (v as IncomeBand))}
            options={[
              { value: "" as const, label: W(lang, "Choose…", "Elegir…") },
              ...incomeBands(lang).map(o => ({ value: o.value as IncomeBand | "", label: o.label })),
            ]} />
        </Field>
        <Field label={W(lang, "What you do", "A qué se dedica")}>
          <ChoiceChips value={employment} onChange={setEmployment} options={employmentOptions(lang)} allowClear />
        </Field>
        <Field label={W(lang, "Credit", "Historial crediticio")} optional
          hint={W(lang, "A band, not a score — we don't check it and we don't pretend to.",
                        "Un rango, no un puntaje — no lo verificamos ni pretendemos hacerlo.")}>
          <ChoiceChips value={creditBand} onChange={setCreditBand} options={creditBands(lang)} allowClear />
        </Field>

        {/* Colombia's actual alternatives to a cash deposit. These matter more than they look:
            Ley 820 Art. 16 appears to prohibit cash deposits on residential leases, so a codeudor
            or a rent-guarantee policy is what a Colombian landlord asks for instead. A renter who
            already has one is a much stronger applicant and had no way to say so. */}
        <Toggle on={hasCodeudor} onChange={setHasCodeudor}
          label={W(lang, "I have a co-signer (codeudor)", "Tengo codeudor")}
          note={W(lang, "Someone in Colombia who'll guarantee the lease.",
                        "Alguien en Colombia que respalde el contrato.")} />
        <Toggle on={hasGuarantee} onChange={setHasGuarantee}
          label={W(lang, "I can get a rent guarantee policy", "Puedo obtener póliza de arrendamiento")}
          note={W(lang, "A seguro de arrendamiento from an insurer — the usual alternative to a deposit here.",
                        "Un seguro de arrendamiento — la alternativa habitual al depósito aquí.")} />
      </FormSection>

      <FormSection title={W(lang, "About you", "Sobre usted")}
        icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5">
        <Field label={W(lang, "A short introduction", "Una breve presentación")} optional
          hint={W(lang,
            "Two or three lines. This is what makes an agent reply — who you are, why you're moving, how long you plan to stay.",
            "Dos o tres líneas. Esto es lo que hace que un agente responda — quién es, por qué se muda, cuánto planea quedarse.")}>
          <AiTextField
            kind="bio" fieldLabel={W(lang, "Renter introduction", "Presentación del arrendatario")}
            subject={W(lang, "yourself as a tenant", "usted como arrendatario")}
            format="text" rows={4} charLimit={800} offerChooser
            excludeFacts={["income", "credit"]}
            notesPlaceholder={W(lang,
              "E.g. software engineer working remotely, moving from Chicago, quiet, no smoking, looking for somewhere for at least a year in Laureles.",
              "Ej.: ingeniero de software que trabaja remoto, me mudo desde Chicago, tranquilo, no fumo, busco algo por al menos un año en Laureles.")}
            value={intro} onChange={setIntro}
            placeholder={W(lang, "Who you are and what you're looking for.",
                                 "Quién es usted y qué está buscando.")} />
        </Field>
      </FormSection>

      {/* ── THE QR ────────────────────────────────────────────────────────────────────────────
          Off by default. A shareable link to your income band and moving plans should be something
          you switch on deliberately, not something that exists because you filled in a form. */}
      <FormSection title={W(lang, "Share it with a QR", "Compartir con código QR")}
        icon="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z">
        <Toggle on={shareEnabled} onChange={v => { setShareEnabled(v); save(v); }}
          label={W(lang, "Let me share this with a code or link", "Permitir compartir con código o enlace")}
          note={W(lang,
            "An agent scans it at a viewing and has your whole application. Anyone holding the link can see it, so turn it off when you're done — or roll it to kill every code you've already given out.",
            "Un agente lo escanea en una visita y tiene toda su solicitud. Cualquiera con el enlace puede verlo, así que desactívelo cuando termine — o renuévelo para anular todos los códigos ya entregados.")} />
        {shareEnabled && shareToken && (
          <button type="button" onClick={() => setMode("qr")} className="btn-primary mt-2 w-full">
            {W(lang, "Show my code", "Mostrar mi código")}
          </button>
        )}
      </FormSection>

      {err && <p className="mt-3 text-center text-[12.5px] font-semibold text-red-500">{err}</p>}

      <StickyActions
        hint={saved ? W(lang, "Saved", "Guardado") : null}
        primary={{ label: W(lang, "Save profile", "Guardar perfil"), onClick: () => save(), busy }} />
    </div>
  );
}

/* ── THE QR SUB-SCREEN. OneJob's, adapted: same layout, same "share the link instead" fallback. */
function QrScreen({ lang, url, onBack, onRotate, busy }: {
  lang: string; url: string; onBack: () => void; onRotate: () => void; busy: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvas.current && url) {
      QRCode.toCanvas(canvas.current, url,
        { width: 240, margin: 2, color: { dark: "#0B0F1A", light: "#ffffff" } }, () => {});
    }
  }, [url]);

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: W(lang, "My renter profile", "Mi perfil de arrendatario"), url }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4 pb-28">
      <button onClick={onBack}
        className="ow-tap flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">
        ‹ {W(lang, "Back", "Atrás")}
      </button>
      <div className="card p-6 text-center">
        <h1 className="text-xl font-extrabold">{W(lang, "Scan to see my application", "Escanea para ver mi solicitud")}</h1>
        <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed opacity-60">
          {W(lang,
            "Show this at a viewing. The agent gets your whole profile without you typing it out again.",
            "Muéstrelo en una visita. El agente recibe todo su perfil sin que usted lo escriba de nuevo.")}
        </p>
        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-4"><canvas ref={canvas} /></div>
        <button onClick={share} className="btn-ghost mt-5 w-full">
          {copied ? W(lang, "✓ Link copied", "✓ Enlace copiado") : W(lang, "Share the link instead", "Mejor compartir el enlace")}
        </button>
        {/* The revoke, said in plain words rather than called "rotate token". */}
        <button onClick={onRotate} disabled={busy}
          className="ow-tap mt-3 w-full text-[12px] font-bold text-red-500 disabled:opacity-40">
          {W(lang, "Cancel every code I've shared and make a new one",
                   "Anular todos los códigos compartidos y crear uno nuevo")}
        </button>
      </div>
    </div>
  );
}
