import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useI18n, useOneId, supabase, productHref, W, ScreenHeading,
  FormSection, Field, StickyActions, Toggle,
} from "@oneworld/shell";
import { RentalTiles } from "../../onerental/screens/ProfileSlots";

/* Same stroke-path icon set the sale listing form uses — `FormSection` requires one, and reusing
   these keeps the two sale screens drawn from one vocabulary rather than two. */
const I = {
  contact: "M4 4h16v16H4z M4 7l8 6 8-6",
  person:  "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6 8-6s8 2 8 6",
  home:    "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5",
};

/**
 * SELLER AND BUYER PROFILES — one screen, two roles.
 * ============================================================================================
 * The sale side had neither. The rent side has had `/host-profile` and `/renter` for weeks, and
 * a credibility-first marketplace with nothing to establish who you are buying a house from is a
 * hole you can see from the street.
 *
 * ── ⚠️ WHY THIS IS NOT A COPY OF THE RENT PROFILES, AND LEE SAID SO ─────────────────────────
 * Lee, 28 September 2026: *"A buyer profile is effectively nothing. It's their name, email
 * address, and phone number until they actually build it out with other stuff. That's my
 * immediate thought on a buyer. Seller, obviously, same thing, but they can do more, right? They
 * can list multiple properties."*
 *
 * He is right, and the rent profiles are the evidence. `HostProfile` collects an identity
 * document, a payout method and a Stripe Connect state — because OneHome carries the lease and
 * moves the rent, so it has to know who it is paying. `RenterProfile` collects household size,
 * pets and an income band — because a landlord is deciding whether to hand somebody their flat.
 *
 * A sale asks neither question of us. The purchase price never touches OneHome (Lee, 10 Aug), so
 * we are not paying a seller and not vetting a buyer. Cloning either form would have demanded a
 * passport scan to list a house we take no money for — the kind of friction that reads as a data
 * grab rather than a service.
 *
 * So: name, email, phone, and the things a person volunteers. No new table and no migration —
 * every field is already on `profiles`, the One ID row shared across the family, which is also
 * why filling this in here improves the person's profile in every other product at once.
 *
 * ── THE ONE REAL DIFFERENCE BETWEEN THE TWO ROLES ───────────────────────────────────────────
 * A seller has properties and a buyer does not. That is the whole of it, and it is why the
 * listings grid is rendered only for the seller. Everything above it is identical, because a
 * person is the same person in both directions — most Colombians selling a flat are buying one.
 */
export default function SaleProfile({ role = "seller" }: { role?: "seller" | "buyer" }) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const isSeller = role === "seller";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) { setLoading(false); return; }
      const { data } = await supabase.from("profiles")
        .select("full_name, email, phone, job_title, location, bio, is_public")
        .eq("id", userId).maybeSingle();
      if (!alive) return;
      if (data) {
        setFullName(data.full_name ?? ""); setEmail(data.email ?? "");
        setPhone(data.phone ?? ""); setJobTitle(data.job_title ?? "");
        setLocation(data.location ?? ""); setBio(data.bio ?? "");
        setIsPublic(data.is_public !== false);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  async function save() {
    if (!userId) return;
    setBusy(true); setErr(null); setSaved(false);
    /* ⚠️ `full_name` and `email` are NOT NULL on `profiles`. Sending an empty string would store a
       nameless member rather than fail, which is worse — so the guard is here and it names the
       field rather than saying "something went wrong". */
    if (!fullName.trim()) {
      setBusy(false);
      setErr(W(lang, "Your name cannot be empty.", "Su nombre no puede quedar vacío."));
      return;
    }
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      /* Email is left alone on purpose: it is the One ID sign-in address, and changing it here
         would desynchronise the login from the profile. Shown, not edited. */
      phone: phone.trim() || null,
      job_title: jobTitle.trim() || null,
      location: location.trim() || null,
      bio: bio.trim() || null,
      is_public: isPublic,
    }).eq("id", userId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  if (loading) {
    return (
      <div className="space-y-3 pb-28" aria-busy="true">
        {[0, 1, 2].map(i => <div key={i} className="ow-panel ow-shimmer h-28 rounded-3xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <Link to={productHref("onesale", "/list")}
        className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to Properties", "Volver a Inmuebles")}
      </Link>

      <ScreenHeading>
        {isSeller
          ? W(lang, "My seller profile", "Mi perfil de vendedor")
          : W(lang, "My buyer profile", "Mi perfil de comprador")}
      </ScreenHeading>

      <p className="text-[12.5px] leading-relaxed opacity-65">
        {isSeller
          ? W(lang,
              "This is what a buyer sees beside your properties. It is the same One ID profile the rest of One World uses, so filling it in here fills it in everywhere.",
              "Esto es lo que ve un comprador junto a sus inmuebles. Es el mismo perfil One ID que usa el resto de One World, así que llenarlo aquí lo llena en todas partes.")
          : W(lang,
              "This is what a seller sees when you ask about their property. It is the same One ID profile the rest of One World uses, so filling it in here fills it in everywhere.",
              "Esto es lo que ve un vendedor cuando usted pregunta por su inmueble. Es el mismo perfil One ID que usa el resto de One World, así que llenarlo aquí lo llena en todas partes.")}
      </p>

      <FormSection icon={I.contact} title={W(lang, "How to reach you", "Cómo contactarlo")}
        hint={W(lang,
          "A name and one way to reach you is the whole requirement. Everything else is yours to add when you want to.",
          "Un nombre y una forma de contactarlo es todo lo que se necesita. Lo demás es suyo para agregar cuando quiera.")}>
        <Field label={W(lang, "Full name", "Nombre completo")}>
          <input className="input w-full" value={fullName} maxLength={120}
            onChange={e => setFullName(e.target.value)}
            placeholder={W(lang, "María Restrepo", "María Restrepo")} />
        </Field>

        {/* Shown and not editable — see the note in `save()`. A field somebody can type into and
            that silently does nothing is the control-that-half-works Lee has ruled out. */}
        <Field label={W(lang, "Email (your sign-in)", "Correo (su inicio de sesión)")}
          hint={W(lang,
            "This is the address you sign in with, so it is changed in Settings rather than here.",
            "Es la dirección con la que inicia sesión, así que se cambia en Ajustes y no aquí.")}>
          <input className="input w-full opacity-60" value={email} readOnly disabled />
        </Field>

        <Field label={W(lang, "Phone", "Teléfono")} optional>
          <input className="input w-full" value={phone} maxLength={32} inputMode="tel"
            onChange={e => setPhone(e.target.value)} placeholder="+57 300 000 0000" />
        </Field>
      </FormSection>

      <FormSection icon={I.person} title={W(lang, "About you", "Sobre usted")}
        hint={W(lang,
          "Optional, and it is what turns a name into somebody a stranger will answer.",
          "Opcional, y es lo que convierte un nombre en alguien a quien un desconocido responde.")}>
        <Field label={W(lang, "What you do", "A qué se dedica")} optional>
          <input className="input w-full" value={jobTitle} maxLength={80}
            onChange={e => setJobTitle(e.target.value)}
            placeholder={isSeller
              ? W(lang, "Real estate advisor", "Asesora inmobiliaria")
              : W(lang, "Architect", "Arquitecta")} />
        </Field>
        <Field label={W(lang, "Where you are", "Dónde está")} optional>
          <input className="input w-full" value={location} maxLength={80}
            onChange={e => setLocation(e.target.value)} placeholder="Medellín, Antioquia" />
        </Field>
        <Field label={W(lang, "A line about you", "Una línea sobre usted")} optional>
          <textarea className="input w-full" rows={3} value={bio} maxLength={400}
            onChange={e => setBio(e.target.value)}
            placeholder={isSeller
              ? W(lang, "Twelve years in El Poblado. I answer messages the same day.",
                        "Doce años en El Poblado. Respondo los mensajes el mismo día.")
              : W(lang, "Looking for a three-bedroom near the metro, ready to move in January.",
                        "Busco un apartamento de tres alcobas cerca del metro, listo para enero.")} />
        </Field>
        <Field label={W(lang, "Show my profile publicly", "Mostrar mi perfil públicamente")}
          hint={W(lang,
            "Off means your name still appears on your own listings — it is the profile PAGE that stops being reachable.",
            "Apagado significa que su nombre sigue apareciendo en sus anuncios — lo que deja de ser visible es la PÁGINA de perfil.")}>
          <Toggle on={isPublic} onChange={setIsPublic}
            label={W(lang, "Public", "Público")} />
        </Field>
      </FormSection>

      {/* ── THE PROPERTIES, FOR A SELLER ONLY ─────────────────────────────────────────────────
          Lee, 28 September 2026: *"Seller, obviously, same thing, but they can do more, right?
          They can list multiple properties. And we need to make sure that every time there's a
          folder or an image on their page, if it's a property, then that image takes them to the
          property listing page."*

          `RentalTiles` is that grid and it already does exactly this — one tile per property, the
          whole tile a link to that property's own page, a For-rent / For-sale tag in the corner,
          and filter chips for each. Reused rather than rebuilt, so the seller's own view and the
          public view of the same person cannot answer "what has this agent got" differently. */}
      {isSeller && (
        <FormSection icon={I.home} title={W(lang, "My properties", "Mis inmuebles")}
          hint={W(lang,
            "Everything you have listed, to let and to sell. Tap any one to open its listing.",
            "Todo lo que tiene publicado, en arriendo y en venta. Toque cualquiera para abrir su anuncio.")}>
          <RentalTiles />
        </FormSection>
      )}

      {err && (
        <p role="alert" className="rounded-xl border border-red-500/35 bg-red-500/[0.08] p-3 text-[12.5px] font-semibold text-red-600">
          {err}
        </p>
      )}

      <StickyActions
        hint={saved ? W(lang, "Saved", "Guardado") : null}
        primary={{ label: W(lang, "Save profile", "Guardar perfil"), onClick: () => save(), busy }} />
    </div>
  );
}
