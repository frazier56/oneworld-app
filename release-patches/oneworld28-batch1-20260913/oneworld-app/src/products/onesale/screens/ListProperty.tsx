import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useI18n, useOneId, supabase, productHref, W, SALE_FEE_PCT, ScreenHeading, PhotoDeck,
  FormSection, Field, Row, ChoiceChips, MultiChips, Stepper, Toggle, FormActions, MoneyInput,
  IconPlus, IconCheck, IconPhoto, AiTextField,
  GlassSelect, GlassDate, PlacesInput, fetchTrm, fmtCop, type Trm, displayPointFor,
  ShowingWindows, DEFAULT_NOTICE_HOURS, DEFAULT_SLOT_MINUTES,
} from "@oneworld/shell";
import { CO_CITIES, CO_NEIGHBOURHOODS, coCityKey, KIND_LABEL, usd, cop, commissionAmount, earnestFee, earnestNet, type SaleKind } from "../lib/sale";
/* The SAME vocabulary the rent side uses. Renting and buying ask identical questions about the
   PLACE and differ only in the money, so a second copy of "washer-dryer combo" here would be a
   second chance for the two halves of OneHome to describe the same home differently. */
import {
  masterBeds, laundryOptions, securityLevels, petsOptions, amenities,
  type MasterBed, type Laundry, type SecurityLevel, type PetsAllowed, type AmenityKey,
} from "../../onerental/lib/attributes";

/**
 * /sales/list — put a property up for sale. The raised centre.
 *
 * Lee: *"the main thing is that can someone list the house for sale — that's the easy part."*
 * It is, and this is it. The part that earns its place is the MONEY BOX at the bottom, which
 * says plainly which of these numbers can move through the app and which cannot. A seller who
 * discovers at closing that we never touched the purchase price is a seller we lied to by
 * omission.
 */

/* Section glyphs — one path each, so every chip in the form is the same weight and size.
   Shared with the rent form so the two halves of OneHome look like one product. */
const I = {
  photos:  "M3 7a2 2 0 0 1 2-2h2l1.5-2h7L17 5h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  place:   "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5",
  rooms:   "M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 18v2M21 18v2M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3",
  inside:  "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  outside: "M12 3v3M5.6 5.6l2.1 2.1M3 12h3M5.6 18.4l2.1-2.1M12 21v-3M18.4 18.4l-2.1-2.1M21 12h-3M18.4 5.6l-2.1 2.1M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  safety:  "M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z M9.5 12l1.8 1.8L15 10",
  where:   "M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  price:   "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  earnest: "M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 8l2-4h12l2 4M12 12v4M10 14h4",
  legal:   "M12 3v18M5 7h14M7 7l-3 6h6zM17 7l3 6h-6z",
  /* Visibility used to borrow the map pin, which put the SAME glyph on two sections once
     "Where it is" became a section of its own. An eye, for who can see it. */
  eye:     "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  /* A clock, for when the seller will open the door. Deliberately NOT the calendar glyph — the
     rent form's Availability section already owns that, and these two sections answer different
     questions that must not look like the same one. */
  viewings: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2",
};

/**
 * EDIT MODE, 12 Aug 2026 — the twin of the rent form's.
 *
 * Lee: *"I can't edit my listing."* That was fixed on the rent side first, which left the sale
 * form as the only listing on the platform that could be created and never corrected — a worse
 * asymmetry than the cosmetic ones, because a wrong asking price is not a thing anybody is
 * willing to leave standing.
 *
 * Same shape as the rent form: `editId` in, update-vs-insert on save, and one hydration effect
 * that reads every field the payload writes. The hydration list is deliberately kept in the SAME
 * ORDER as the payload, so a field added to one and forgotten in the other is visible as a gap
 * rather than as a value that silently reverts to its default the next time somebody saves.
 */
export default function ListProperty({ onClose, editId }: { onClose?: () => void; editId?: string | null } = {}) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const es = lang === "es" || lang === "co";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  /* The rate is FETCHED, never typed. Lee: "we can't allow the user to input the conversion
     because it could be wrong, and that could be very deceptive." See `lib/trm.ts` — the old
     hard-coded 4,000 default overstated every peso price by about 28%. */
  const [trm, setTrm] = useState<Trm | null | "loading">("loading");
  const [kind, setKind] = useState<SaleKind>("apartment");
  /* Free text from Google Places rather than a key from a fixed list — see the rent form. */
  const [cityText, setCityText] = useState<string>(CO_CITIES.find(c => c.key === "medellin")?.label ?? "Medellín");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [matricula, setMatricula] = useState("");
  const [beds, setBeds] = useState(""); const [baths, setBaths] = useState("");
  const [area, setArea] = useState(""); const [parking, setParking] = useState("");
  const [estrato, setEstrato] = useState("");
  /* Lee, 12 Aug: two attributes buyers search by that no Colombian listing states. */
  const [penthouse, setPenthouse] = useState(false);
  const [openView, setOpenView] = useState(false);
  /* Asked in years, stored as a year — see the rent form and the migration note. */
  const [buildingAge, setBuildingAge] = useState<number | null>(null);
  const [acInMaster, setAcInMaster] = useState(false);
  const [adminFee, setAdminFee] = useState("");
  const [commissionPct, setCommissionPct] = useState("3");
  const [paidBy, setPaidBy] = useState<"seller" | "buyer" | "shared">("seller");
  const [earnest, setEarnest] = useState("");
  /* What the AGENT types in. What a reader SEES is chosen on the feed — see the note by the
     toggle. Defaults to USD because that is what the form asked for before today, so an agent
     mid-draft does not find their number reinterpreted. */
  const [listCcy, setListCcy] = useState<"USD" | "COP">("USD");
  const [isPublic, setIsPublic] = useState(true);
  const [allowShare, setAllowShare] = useState(true);
  /* Viewings, on the sale side. Lee, 15 Aug 2026: *"there definitely should be a request-a-
     showing button."* There now is, on the buyer's page — but it only appears when the seller has
     actually opened windows, so this section is what makes that button reachable at all. */
  const [showingsEnabled, setShowingsEnabled] = useState(false);
  const [showingNotice, setShowingNotice] = useState<number>(DEFAULT_NOTICE_HOURS);
  const [showingSlot, setShowingSlot] = useState<number>(DEFAULT_SLOT_MINUTES);
  const [allowComments, setAllowComments] = useState(true);
  /* The shared attribute block — see `onerental/lib/attributes.ts`. */
  const [floor, setFloor] = useState<number | null>(null);
  const [floorsInBuilding, setFloorsInBuilding] = useState<number | null>(null);
  const [furnished, setFurnished] = useState(false);
  const [masterBed, setMasterBed] = useState<MasterBed | null>(null);
  const [walkInCloset, setWalkInCloset] = useState(false);
  const [dualVanities, setDualVanities] = useState(false);
  const [laundry, setLaundry] = useState<Laundry | null>(null);
  const [acUnits, setAcUnits] = useState<number | null>(null);
  /* Four columns in the database, ONE selected set in the form — see the rent form. */
  const [outsideKeys, setOutsideKeys] = useState<string[]>([]);
  const has = (k: string) => outsideKeys.includes(k);
  const [amenityKeys, setAmenityKeys] = useState<AmenityKey[]>([]);
  const [security, setSecurity] = useState<SecurityLevel | null>(null);
  const [pets, setPets] = useState<PetsAllowed | null>(null);
  const [schoolsNearby, setSchoolsNearby] = useState(false);
  const [schoolZone, setSchoolZone] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { fetchTrm().then(setTrm); }, []);
  const fxRate = trm && trm !== "loading" ? trm.rate : 0;

  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const ask = Number(price) || 0;
  const earnestAmt = Number(earnest) || 0;
  /* Strip Google's country tail: "Medellín, Antioquia, Colombia" -> "Medellín". */
  const cityLabel = cityText.split(",")[0].trim() || cityText.trim();
  /* Barrio suggestions for whichever city is in the box. Same helper the rent form uses, so the
     two forms suggest the same names — which is what makes the neighbourhood filter possible. */
  const hoods = CO_NEIGHBOURHOODS[coCityKey(cityText)] ?? [];
  const commission = useMemo(
    () => commissionAmount({ asking_price: ask, commission_pct: Number(commissionPct) || null }),
    [ask, commissionPct]);

  /* ── THE SAME VALIDATION MODEL AS THE RENTAL FORM ───────────────────────────────────────
     A blocker carries the SECTION it belongs to, so the panel can go red and the page can scroll
     to it. Lee: *"it needs to highlight the section that it's applicable to."* Nothing is red
     until Publish is actually pressed. */
  const [tried, setTried] = useState(false);
  const blockers = [
    photos.length === 0 && { sec: "photos", msg: W(lang, "Add at least one photo", "Agregue al menos una foto") },
    title.trim().length < 3 && { sec: "place", msg: W(lang, "Give it a title", "Póngale un título") },
    ask <= 0 && { sec: "price", msg: W(lang, "Add the asking price", "Agregue el precio de venta") },
  ].filter(Boolean) as { sec: string; msg: string }[];
  const blocking = blockers[0]?.msg ?? null;
  const bad = (sec: string) => tried && blockers.some(b => b.sec === sec);
  const attempt = (go: () => void) => {
    if (blockers.length) {
      setTried(true);
      requestAnimationFrame(() => {
        document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    go();
  };

  async function save(publish: boolean) {
    if (!userId) return;
    setBusy(true); setErr(null);

    /* The map point, geocoded and blurred in the browser — see the rent form for the full note. */
    const geo = await displayPointFor({
      address: addressLine, neighbourhood, city: cityLabel,
      addressIsPublic: false,
      seed: `${userId}:${addressLine || neighbourhood}:${title}`,
    });
    const payload = {
      agent_id: userId, title: title.trim(), description: description.trim() || null, photos,
      asking_price: ask,
      display_currency: fxRate > 0 ? "COP" : null,
      display_fx_rate: fxRate > 0 ? fxRate : null,
      commission_pct: n(commissionPct), commission_paid_by: paidBy, earnest_money: n(earnest),
      kind, country: "Colombia", city: cityLabel, neighbourhood: neighbourhood.trim() || null,
      address_line: [buildingName.trim(), addressLine.trim()].filter(Boolean).join(" — ") || null,
      address_is_public: false,
      display_lat: geo?.lat ?? null, display_lng: geo?.lng ?? null,
      geo_precision: geo?.precision ?? null,
      bedrooms: n(beds), bathrooms: n(baths), area_m2: n(area), parking_spaces: n(parking),
      year_built: buildingAge == null ? null : new Date().getFullYear() - buildingAge,
      ac_in_master: acInMaster,
      estrato: n(estrato), admin_fee_monthly: n(adminFee),
      matricula_inmobiliaria: matricula.trim() || null,
      /* Lee, 12 Aug — filterable attributes nobody else's listing states. */
      penthouse, open_view: openView,
      /* The shared attribute block. Same column names as `rental_properties` — one migration put
         them on both tables so one detail screen and one filter can read either. */
      property_type: kind === "apartment" ? "apartment" : kind === "house" ? "house" : kind,
      floor_number: floor, floors_in_building: floorsInBuilding, furnished,
      master_bed: masterBed, walk_in_closet: walkInCloset, dual_vanities: dualVanities,
      laundry, air_conditioning_units: acUnits,
      has_balcony: has("balcony"), has_patio: has("patio"),
      has_backyard: has("backyard"), has_grill: has("grill"),
      amenities: amenityKeys,
      security_level: security, pets_allowed: pets,
      schools_nearby: schoolsNearby, school_zone: schoolZone.trim() || null,
      available_from: availableFrom || null,
      allow_public_share: allowShare,
      allow_comments: allowComments,
      showings_enabled: showingsEnabled,
      showing_notice_hours: showingNotice,
      showing_slot_minutes: showingSlot,
      is_public: isPublic, status: publish ? "published" : "draft",
    };

    /* `updated_at` is what the detail page shows as "Edited on …". `.eq("agent_id", userId)` is
       belt and braces over RLS — a policy is the wrong place to find out you had a bug. */
    const { data, error } = editId
      ? await supabase.from("sale_properties")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editId).eq("agent_id", userId)
          .select("id").single()
      : await supabase.from("sale_properties").insert(payload).select("id").single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    nav(productHref("onesale", `/s/${data!.id}?owner=1`));
  }

  /* ── LOADING AN EXISTING LISTING BACK INTO THE FORM ────────────────────────────────────────
     Every field `payload` writes, read back once on mount, in the same order it is written. */
  useEffect(() => {
    if (!editId || !userId) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase.from("sale_properties")
        .select("*").eq("id", editId).eq("agent_id", userId).maybeSingle<any>();
      if (!alive || !data) return;
      setTitle(data.title ?? "");
      setShowingsEnabled(!!data.showings_enabled);
      /* `?? DEFAULT`, never `|| DEFAULT` — a seller who deliberately chose same-day viewings stored
         0, and `||` would silently overwrite that with 24 every time they opened the form. */
      setShowingNotice(data.showing_notice_hours ?? DEFAULT_NOTICE_HOURS);
      setShowingSlot(data.showing_slot_minutes ?? DEFAULT_SLOT_MINUTES);
      setDescription(data.description ?? "");
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
      setPrice(data.asking_price == null ? "" : String(data.asking_price));
      setCommissionPct(data.commission_pct == null ? "" : String(data.commission_pct));
      setPaidBy(data.commission_paid_by ?? "seller");
      setEarnest(data.earnest_money == null ? "" : String(data.earnest_money));
      setKind(data.kind ?? "apartment");
      setCityText(data.city ?? "");
      setNeighbourhood(data.neighbourhood ?? "");
      /* address_line is stored as "Building — Street" when both were given. Split it back the
         same way it was joined, or the building name lands in the address box on every edit. */
      {
        const parts = String(data.address_line ?? "").split(" — ");
        if (parts.length > 1) { setBuildingName(parts[0]); setAddressLine(parts.slice(1).join(" — ")); }
        else { setBuildingName(""); setAddressLine(parts[0] ?? ""); }
      }
      setBeds(data.bedrooms == null ? "" : String(data.bedrooms));
      setBaths(data.bathrooms == null ? "" : String(data.bathrooms));
      setArea(data.area_m2 == null ? "" : String(data.area_m2));
      setParking(data.parking_spaces == null ? "" : String(data.parking_spaces));
      setBuildingAge(data.year_built == null ? null : new Date().getFullYear() - data.year_built);
      setAcInMaster(!!data.ac_in_master);
      setEstrato(data.estrato == null ? "" : String(data.estrato));
      setAdminFee(data.admin_fee_monthly == null ? "" : String(data.admin_fee_monthly));
      setMatricula(data.matricula_inmobiliaria ?? "");
      setPenthouse(!!data.penthouse);
      setOpenView(!!data.open_view);
      setFloor(data.floor_number ?? null);
      setFloorsInBuilding(data.floors_in_building ?? null);
      setFurnished(!!data.furnished);
      setMasterBed(data.master_bed ?? null);
      setWalkInCloset(!!data.walk_in_closet);
      setDualVanities(!!data.dual_vanities);
      setLaundry(data.laundry ?? null);
      setAcUnits(data.air_conditioning_units ?? null);
      setOutsideKeys([
        data.has_balcony ? "balcony" : "", data.has_patio ? "patio" : "",
        data.has_backyard ? "backyard" : "", data.has_grill ? "grill" : "",
      ].filter(Boolean));
      setAmenityKeys(Array.isArray(data.amenities) ? data.amenities : []);
      setSecurity(data.security_level ?? null);
      setPets(data.pets_allowed ?? null);
      setSchoolsNearby(!!data.schools_nearby);
      setSchoolZone(data.school_zone ?? "");
      setAvailableFrom(data.available_from ?? "");
      setAllowShare(data.allow_public_share !== false);
      setAllowComments(data.allow_comments !== false);
      setIsPublic(data.is_public !== false);
      setListCcy(data.display_currency === "COP" ? "COP" : "USD");
    })();
    return () => { alive = false; };
  }, [editId, userId]);

  return (
    <div className="space-y-4">
      <ScreenHeading>
        {editId
          ? W(lang, "Edit this listing", "Editar este anuncio")
          : /* v88.1 · U29 · the old heading was four words too long and truncated mid-word.
             Inside OneSale, naming the sale repeats what the screen already says. */
          W(lang, "List a property", "Publicar inmueble")}
      </ScreenHeading>

      <FormSection icon={I.photos} title={W(lang, "Photos", "Fotos")} invalid={bad("photos")}
        hint={W(lang, "Up to 50. The first is the cover.", "Hasta 50. La primera es la portada.")}>
        <PhotoDeck photos={photos} onChange={setPhotos} folder="sales" lang={lang} />
      </FormSection>

      {/* ── 2 · WHERE IT IS — ITS OWN SECTION ON BOTH FORMS, 12 Aug 2026 ──────────────────
          Lee: *"the address is buried at the very bottom of the form"* (about the rent form), and
          separately *"these are twin forms — literally copy the code and make them identical when
          they have the same things."*

          These five fields were living inside "The property" here and inside a section-7 "Where it
          is" over on the rent form, so the two forms asked the same questions in different places
          under different headings. Now both ask them in a section of their own, second, straight
          after the photos. Same order, same labels, same hints, same neighbourhood list.

          The neighbourhood also gained the curated barrio list the rent form has had since 11 Aug.
          It was a bare text box here, which meant "Poblado", "El Poblado" and "el poblado" all
          went into the database as different places — and the neighbourhood filter and the
          comparables strip both depend on them being one. */}
      <FormSection icon={I.where} title={W(lang, "Where it is", "Dónde queda")}>
        {/* Google Places on both the city and the address — Lee's third ask. See the rent form. */}
        <Field label={W(lang, "City", "Ciudad")}
          hint={W(lang, "Start typing — this comes from Google.", "Empiece a escribir — esto viene de Google.")}>
          <PlacesInput variant="city" countries={["co"]}
            value={cityText} onChange={setCityText}
            onSelectParts={({ name }) => setCityText(name)}
            placeholder="Medellín" />
        </Field>
        <Field label={W(lang, "Neighbourhood", "Barrio")}>
          <input className="input w-full" value={neighbourhood} list="ow-hoods"
            onChange={e => setNeighbourhood(e.target.value)} placeholder={hoods[0] ?? ""} />
          <datalist id="ow-hoods">{hoods.map(h => <option key={h} value={h} />)}</datalist>
        </Field>
        <Field label={W(lang, "Building or complex name", "Nombre del edificio o unidad")} optional>
          <PlacesInput variant="establishment" countries={["co"]} bias={cityLabel}
            value={buildingName} onChange={setBuildingName}
            onSelectParts={({ name, address: addr, full }) => {
              setBuildingName(name || full);
              if (addr && !addressLine.trim()) setAddressLine(addr);
            }}
            placeholder={W(lang, "e.g. Torre Bahía", "Ej.: Torre Bahía")} />
        </Field>
        <Field label={W(lang, "Address", "Dirección")}
          hint={W(lang, "Private until a buyer is serious.", "Privada hasta que haya un comprador serio.")}>
          <PlacesInput variant="address" countries={["co"]} bias={cityLabel}
            value={addressLine} onChange={setAddressLine}
            onSelectParts={({ full }) => setAddressLine(full)}
            placeholder="Carrera 43A #7-50, El Poblado" />
        </Field>

        {/* ── MATRÍCULA INMOBILIARIA — WHAT IT IS, IN WORDS ANYBODY CAN READ ─────────────────
            Lee, 11 Aug 2026: *"I don't know what matricula inmobiliaria is… No one's gonna know
            what that is."*

            He is right that the label alone is useless — it was a bare technical term with a hint
            that said, in effect, "it is what lets this property keep one history", which explains
            nothing to somebody who has never held one.

            But the field STAYS, and the research is why. Colombia has no MLS, so the obvious
            conclusion is that property history is impossible here. It isn't. The matrícula is the
            permanent legal identity of a parcel, issued by the Superintendencia de Notariado y
            Registro (format: three-digit registry office, dash, serial — `001-121`). And IGAC
            publishes a dataset on datos.gov.co with roughly 30.9 million notarial transactions in
            it, of which about 1.5 million are Medellín, chained BY MATRÍCULA — real sale prices,
            real dates, real deed numbers.

            So this one number is the difference between OneHome holding a list of listings and
            OneHome holding a property's actual history. Lee, on that exact point: *"these people
            don't have properties with history on them and prices are all over the place. For that
            reason."*

            What changed is only the asking: it is now explained in a sentence, it says exactly
            where to find the number, and it is explicitly optional so nobody is blocked by a
            document they have to go and dig out. */}
        <Field label={W(lang, "Property registry number", "Matrícula inmobiliaria")} optional
          hint={W(lang,
            "It's on the top of the certificado de tradición y libertad, and it looks like 001-1234567.",
            "Está en la parte superior del certificado de tradición y libertad, y se ve así: 001-1234567.")}>
          <input className="input w-full" value={matricula} onChange={e => setMatricula(e.target.value)}
            inputMode="numeric" placeholder="001-1234567" />
        </Field>

        {/* ── SAY WHAT THIS NUMBER BUYS, AND SAY THE ADDRESS WILL NOT DO IT ────────────────
            Lee, 15 Aug 2026: *"we need to just show on the form that you must provide the
            matrícula number in order to pull and display the sales history. The address is not
            sufficient — it must be the matrícula number. That way everyone who lists a property
            knows that they need that number."*

            It is not a preference, it is the shape of the data. The national registry chains
            transfers by matrícula, and `numero_catastral` is NULL for 100 percent of Medellín
            rows — so there is no address index to fall back on and no clever lookup to write.
            Without this number the sale history cannot be fetched by anyone, at any price.

            The panel turns GREEN once the field is filled, so the reward is visible at the moment
            the number goes in rather than three screens later. Still OPTIONAL: blocking a listing
            on a document somebody has to dig out of a drawer is how listings get abandoned. */}
        <div className={`rounded-xl border p-3 transition ${
          matricula.trim()
            ? "border-brand/40 bg-brand/[0.07]"
            : "border-amber-500/40 bg-amber-500/[0.08]"}`}>
          <p className="text-[12.5px] font-bold">
            {matricula.trim()
              ? W(lang, "This property will show its real sale history",
                        "Este inmueble mostrará su historial real de ventas")
              : W(lang, "Without this number there is no sale history",
                        "Sin este número no hay historial de ventas")}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-75">
            {matricula.trim()
              ? W(lang,
                  "Every registered sale on this folio — what it actually changed hands for, the deed number and the notaría — is pulled from the national registry and shown on your listing. Nobody else in Colombia puts that in front of a buyer.",
                  "Cada venta registrada en esta matrícula — por cuánto se transfirió realmente, el número de escritura y la notaría — se trae del registro nacional y se muestra en su anuncio. Nadie más en Colombia le pone eso al frente a un comprador.")
              : W(lang,
                  "The national registry chains sales by matrícula and by nothing else — the address will not find it, and neither will the cadastral number, which is blank for every Medellín record. You can publish without it, but the sale history stays empty until it is added.",
                  "El registro nacional encadena las ventas por matrícula y por nada más — la dirección no la encuentra, y el número catastral tampoco, que viene vacío en todos los registros de Medellín. Puede publicar sin ella, pero el historial de ventas queda vacío hasta que la agregue.")}
          </p>
        </div>
      </FormSection>


      <FormSection icon={I.place} title={W(lang, "The property", "El inmueble")} invalid={bad("place")}>
        <Field label={W(lang, "Title", "Título")}>
          <input className="input w-full" value={title} maxLength={120} onChange={e => setTitle(e.target.value)}
            placeholder={W(lang, "3-bedroom apartment in Laureles", "Apartamento de 3 hab. en Laureles")} />
        </Field>
        <Field label={W(lang, "Description", "Descripción")}>
          {/* This box had NO placeholder at all — a completely blank field on the screen that
              decides whether a property sells. Now it has both an example and a voice. */}
          <AiTextField
            kind="property" fieldLabel={W(lang, "Property description", "Descripción del inmueble")}
            subject={W(lang, "this property", "este inmueble")}
            format="text" rows={5} charLimit={1500} offerChooser
            title={title} category={W(lang, "for sale", "en venta")}
            excludeFacts={["asking price", "commission", "earnest money"]}
            notesPlaceholder={W(lang,
              "E.g. three bedrooms, 120 square metres, eighth floor with a balcony, renovated kitchen, two parking spaces, estrato 5, building from 2015.",
              "Ej.: tres habitaciones, 120 metros cuadrados, piso octavo con balcón, cocina remodelada, dos parqueaderos, estrato 5, edificio de 2015.")}
            value={description} onChange={setDescription}
            placeholder={W(lang,
              "What makes this one worth seeing — the light, the layout, what the neighbourhood is like.",
              "Qué hace que valga la pena verlo — la luz, la distribución, cómo es el barrio.")} />
        </Field>
        {/* Type is a dropdown, not a native <select> — see the rent form's header note and
            `Pickers.tsx`. Full width, because "Apartaestudio" is a long word in a half-column. */}
        <Field label={W(lang, "Type of property", "Tipo de inmueble")}>
          <GlassSelect<SaleKind>
            value={kind} ariaLabel={W(lang, "Type of property", "Tipo de inmueble")}
            onChange={setKind}
            options={(Object.keys(KIND_LABEL) as SaleKind[]).map(k => ({
              value: k, label: KIND_LABEL[k][es ? "es" : "en"],
            }))} />
        </Field>


        {/* Two per row, never three. Three steppers across a phone is nine controls in 328px —
            the "train wreck" Lee saw on the rent form, and it was here too. */}
        {/* ── U31 · THE ATTRIBUTE ROWS, TWO PER ROW, IN LEE'S ORDER (17 Aug 2026) ─────────
            *"They just need to line up and look symmetrical. If we have enough to where we can do
            two per row, then that's what we should do… it should be bedroom, bathroom, then the
            square metres and the age of the building, and then the floor, and then the total floors
            in the building, then the parking space, air conditioners, then Estrato."*

            This SUPERSEDES 12 Aug's *"move the size in square metres down by itself"*, which read
            again with the above was never about Size — it was about pairing. Size was alone only
            because Estrato had taken Building age.

            ⚠️ THE ORDER IS A RULE, NOT A LAYOUT. The two forms do not hold the same fields —
            rent has Sleeps, sale does not — so both take ONE sequence and pair off whatever they
            actually have. Estrato sits LAST in that sequence on purpose: when a form has an odd
            number of fields, Estrato is the one left alone, which is the case Lee named. Adding a
            field to either form must keep that property. */}
        <Row>
          <Field label={W(lang, "Bedrooms", "Habitaciones")}>
            <Stepper value={beds === "" ? null : Number(beds)} onChange={v => setBeds(v === null ? "" : String(v))} min={0} max={12} />
          </Field>
          <Field label={W(lang, "Bathrooms", "Baños")}>
            <Stepper value={baths === "" ? null : Number(baths)} onChange={v => setBaths(v === null ? "" : String(v))} min={0} max={12} step={0.5} />
          </Field>
        </Row>
        <Row>
          {/* ⚠️ A STEPPER, LIKE THE RENT FORM'S — 15 Aug 2026.
              Lee, looking at this screen: *"the little attribute buttons aren't lined up. It's
              almost like it reverted to a previous copy — we had already made changes here."*
              He is right that the change was made and right that it is missing: v50 turned the
              rent form's size field into a stepper and this twin was never brought along, which
              is the same drift that left this side with no filters until 12 Aug and no map until
              today.

              Ten per press, for the reason v50 gives: nobody means 86 square metres precisely,
              and stepping by one is forty taps to a normal flat. A stepper beside a stepper is
              also what makes the ROW line up — a text box and a stepper are different heights,
              which is half of what he photographed. */}
          <Field label={W(lang, "Size (m²)", "Área (m²)")}>
            <Stepper value={area === "" ? null : Number(area)}
              onChange={v => setArea(v === null ? "" : String(v))}
              min={0} max={2000} step={1} coarse={10} suffix="m²" />
          </Field>
          <Field label={W(lang, "Building age (years)", "Antigüedad (años)")} optional
            hint={buildingAge != null
              ? W(lang, `Built around ${new Date().getFullYear() - buildingAge}`,
                        `Construido cerca de ${new Date().getFullYear() - buildingAge}`)
              : undefined}>
            <Stepper value={buildingAge} onChange={setBuildingAge} min={0} max={150} />
          </Field>
        </Row>
        <Row>
          <Field label={W(lang, "Floor the unit is on", "Piso en el que está")} optional>
            <Stepper value={floor} onChange={setFloor} min={-1} max={80} />
          </Field>
          <Field label={W(lang, "Total floors in building", "Pisos totales del edificio")} optional>
            <Stepper value={floorsInBuilding} onChange={setFloorsInBuilding} min={1} max={80} />
          </Field>
        </Row>
        <Row>
          <Field label={W(lang, "Parking spaces", "Parqueaderos")}>
            <Stepper value={parking === "" ? null : Number(parking)} onChange={v => setParking(v === null ? "" : String(v))} min={0} max={10} />
          </Field>
          <Field label={W(lang, "Air conditioners", "Aires acondicionados")} optional>
            <Stepper value={acUnits} onChange={setAcUnits} min={0} max={15} />
          </Field>
        </Row>
        <Row>
          <Field label={W(lang, "Estrato", "Estrato")} optional
            hint={W(lang, "Colombia's utilities band, 1 to 6.", "La banda de servicios públicos, 1 a 6.")}>
            <Stepper value={estrato === "" ? null : Number(estrato)} onChange={v => setEstrato(v === null ? "" : String(v))} min={1} max={6} />
          </Field>
        </Row>


        {/* ── "MINIMUM MINUTE ADMINISTRATION" ────────────────────────────────────────────────
            Lee's transcription of what he read, and the fact that it came out as nonsense is the
            finding: *"minimum minute administration… what does that mean?… put that in
            parenthesis."*

            "Administración" is completely ordinary to a Colombian — it is the monthly building
            fee, and everybody pays one. To everybody else, including the foreign buyers OneHome
            exists to serve, it is a word with no meaning attached to a number. The gloss goes in
            parentheses right in the label, where it is read, rather than in a hint underneath,
            where it is not. */}
        <Field label={W(lang, "Monthly administration (building / HOA fee, USD)",
                              "Administración mensual (cuota del edificio, USD)")}
          hint={W(lang,
            "What the owner pays the building every month for security, lifts, common areas and repairs. Buyers compare this as closely as the price.",
            "Lo que el propietario paga al edificio cada mes por vigilancia, ascensores, zonas comunes y mantenimiento. Los compradores lo comparan tanto como el precio.")}>
          <MoneyInput value={adminFee} onChange={setAdminFee} currency={listCcy}
            ariaLabel={W(lang, "Monthly administration", "Administración mensual")} />
        </Field>
      </FormSection>

      <FormSection icon={I.price} title={W(lang, "Price and commission", "Precio y comisión")} required invalid={bad("price")}>
        {/* ── ONE ROW, BOTH FORMATTED, AND THE LISTER PICKS THE CURRENCY ─────────────────
               Lee, 12 Aug 2026: *"I think you can put the asking price and the earnest money
               really on the same line, because you don't need a full line for both of those."*
               And: *"you should put a toggle switch on the price — do you gonna advertise this
               in Colombian pesos or US dollars? I think they should be able to put either or,
               because they may feel comfortable putting in US dollars."*

               The toggle sets what the AGENT types in. What a READER sees is a separate question
               and is answered on the feed, not here — a Colombian agent who thinks in pesos and a
               foreign buyer who thinks in dollars are both entitled to their own units, and the
               official rate is what reconciles them. */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="label">{W(lang, "Listing currency", "Moneda del anuncio")}</span>
          <div className="inline-flex rounded-xl border border-ink/12 p-0.5 dark:border-white/15">
            {(["USD", "COP"] as const).map(c => (
              <button key={c} type="button" onClick={() => setListCcy(c)}
                aria-pressed={listCcy === c}
                className={`ow-tap min-h-[36px] rounded-[10px] px-3.5 text-[12.5px] font-bold transition ${
                  listCcy === c ? "bg-ink text-paper dark:bg-white dark:text-ink" : "opacity-60"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <Row>
          <Field label={W(lang, "Asking price", "Precio de venta")}>
            <MoneyInput value={price} onChange={setPrice} currency={listCcy}
              placeholder={listCcy === "COP" ? "700.000.000" : "180,000"}
              ariaLabel={W(lang, "Asking price", "Precio de venta")} />
          </Field>
          <Field label={W(lang, "Earnest money", "Arras")}
            hint={W(lang, "Secures the property while closing is arranged.",
                          "Asegura el inmueble mientras se organiza el cierre.")}>
            <MoneyInput value={earnest} onChange={setEarnest} currency={listCcy}
              ariaLabel={W(lang, "Earnest money", "Arras")} />
          </Field>
        </Row>
        {/* Not a field. The official TRM, stated with its date and its source. */}
        <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
          {trm === "loading" ? (
            <p className="text-[12px] font-semibold opacity-55">
              {W(lang, "Getting today's official rate…", "Obteniendo la tasa oficial de hoy…")}
            </p>
          ) : trm ? (
            <>
              <p className="text-[12.5px] font-bold">
                {W(lang, "Today's official rate", "Tasa oficial de hoy")}{" · "}
                <span className="tabular-nums">
                  {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(trm.rate)}
                </span>{" "}
                <span className="font-semibold opacity-60">COP / USD</span>
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-60">
                {W(lang,
                  `TRM certified by the Superintendencia Financiera, in force ${trm.from}.`,
                  `TRM certificada por la Superintendencia Financiera, vigente desde ${trm.from}.`)}
              </p>
              {ask > 0 && <p className="mt-1.5 text-[13px] font-black">≈ {fmtCop(ask, trm.rate)}</p>}
            </>
          ) : (
            <p className="text-[12px] font-semibold leading-relaxed text-amber-600 dark:text-amber-400">
              {W(lang,
                "We couldn't reach the official rate just now, so this listing will show US dollars only. Nothing is estimated.",
                "No pudimos obtener la tasa oficial en este momento, así que este anuncio mostrará solo dólares. Nada se estima.")}
            </p>
          )}
        </div>

        {/* THE HONEST MONEY BOX. */}
        {ask > 0 && (
          <div className="mt-2 rounded-2xl border border-brand/25 bg-brand/[0.06] p-4 text-[13px]">
            <p className="text-[11px] font-black uppercase tracking-wide opacity-55">
              {W(lang, "What moves through the app", "Lo que pasa por la app")}
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="opacity-70">{W(lang, "Asking price", "Precio de venta")}</span>
              <span className="font-bold">{usd(ask)}{fxRate > 0 && <span className="ml-1 text-[11px] opacity-55">≈ {fmtCop(ask, fxRate)}</span>}</span>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-60">
              {W(lang,
                "This never passes through us. A Colombian sale closes through attorneys and the purchase price goes where they direct it.",
                "Esto nunca pasa por nosotros. Una venta en Colombia se cierra con abogados y el precio va donde ellos indiquen.")}
            </p>
            {commission != null && commission > 0 && (
              <div className="mt-3 border-t border-brand/20 pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="opacity-70">{W(lang, "Commission", "Comisión")}</span>
                  <span className="font-bold">{usd(commission)}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-60">
                  {W(lang,
                    "Routed through the app it arrives whole — we take nothing from the commission.",
                    "Si pasa por la app, llega completa: no tomamos nada de la comisión.")}
                </p>
              </div>
            )}
            {/* The ONE fee this side of One Home charges, and the only base it may be charged on.
                Lee, 10 Aug 2026: six percent of the earnest money, nothing else. */}
            {earnestAmt > 0 && (
              <div className="mt-3 border-t border-brand/20 pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="opacity-70">{W(lang, "Earnest money in the vault", "Arras en la bóveda")}</span>
                  <span className="font-bold">{usd(earnestAmt)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="opacity-70">{W(lang, `Our fee (${SALE_FEE_PCT})`, `Nuestra comisión (${SALE_FEE_PCT})`)}</span>
                  <span className="font-bold opacity-70">− {usd(earnestFee(earnestAmt))}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between border-t border-brand/20 pt-1.5">
                  <span className="font-bold">{W(lang, "Goes to the closing", "Va al cierre")}</span>
                  <span className="text-[17px] font-black tracking-tight text-brand">{usd(earnestNet(earnestAmt))}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed opacity-55">
                  {W(lang,
                    "Held until the closing date, up to six months. Every movement is timestamped and both sides see it.",
                    "Se retienen hasta la fecha de cierre, hasta seis meses. Cada movimiento queda con fecha y hora y ambas partes lo ven.")}
                </p>
              </div>
            )}
          </div>
        )}
      </FormSection>

      {/* ── THE SAME QUESTIONS THE RENT SIDE ASKS ────────────────────────────────────────────
          Lee, 11 Aug 2026: *"we have both sides to do — the for-sale is gonna be a little bit
          different than the rental side."* The MONEY is different, and that is above. What a home
          IS does not change because somebody is buying rather than renting it, so these sections
          are the same components reading the same vocabulary and writing the same columns. A
          buyer wants to know about the washer-dryer and the walk-in closet exactly as much as a
          tenant does. */}
      <FormSection icon={I.rooms} title={W(lang, "Rooms", "Habitaciones")}>
        {/* ── FURNISHED FIRST (Lee, 12 Aug 2026) ──────────────────────────────────────────
               *"I would put sold-as-furnished as the first thing you put under Rooms so it makes
               more sense, and then you can move into bed in the master."* It is the fact that
               reframes everything below it — whether the bed you are about to describe is even
               included. */}
        <Toggle on={furnished} onChange={setFurnished}
          label={W(lang, "Sold furnished", "Se vende amoblado")}
          note={W(lang, "Say so here — it is almost never on a sale listing and it changes the price.",
                        "Dígalo aquí — casi nunca aparece en un anuncio de venta y cambia el precio.")} />

        {/* The hint Lee asked to appear on BOTH forms — it was only on the rental one. */}
        <Field label={W(lang, "Bed in the master", "Cama en la principal")} optional
          hint={W(lang, "Worth answering — almost no listing does, and everybody wonders.",
                        "Vale la pena responderlo — casi ningún anuncio lo hace, y todos se lo preguntan.")}>
          <GlassSelect<MasterBed | "">
            value={(masterBed ?? "") as MasterBed | ""}
            ariaLabel={W(lang, "Bed in the master", "Cama en la principal")}
            onChange={v => setMasterBed(v === "" ? null : (v as MasterBed))}
            options={[
              { value: "" as const, label: W(lang, "Prefer not to say", "Prefiero no decirlo") },
              ...masterBeds(lang).map(o => ({ value: o.value as MasterBed | "", label: o.label })),
            ]} />
        </Field>

        {/* ── LEE'S ORDER, 12 Aug: AC → walk-in closet → two sinks ─────────────────────────
               And ungated, for the same reason it was ungated on the rental form: hiding it
               behind an optional count meant an option he had seen before simply vanished. */}
        <Toggle on={acInMaster} onChange={setAcInMaster}
          label={W(lang, "Air conditioning in the master bedroom", "Aire acondicionado en la habitación principal")}
          note={W(lang, "The one that matters at 3am.", "El que importa a las 3 de la mañana.")} />
        <Toggle on={walkInCloset} onChange={setWalkInCloset}
          label={W(lang, "Walk-in closet in the master", "Vestier en la habitación principal")} />
        <Toggle on={dualVanities} onChange={setDualVanities}
          label={W(lang, "Two sinks in the main bathroom", "Doble lavamanos en el baño principal")} />

        {/* ── "Of" WAS THE CONFUSING LABEL ────────────────────────────────────────────────
               Lee: *"It looks like in the rooms you say floor optional. I don't understand the
               floor and the o-f of optional… is that office? And speaking of which, I don't think
               office is an attribute, because that could be a bedroom."*

               There is no office attribute and there never was. The field was labelled `Of` — an
               abbreviation of "of [how many floors]" — sitting immediately beside the word
               OPTIONAL, so `Of OPTIONAL` read as a word he did not recognise. Spelled out, and
               matched to the rental form's wording, which was already correct. */}
        {/* ── THE SECOND FLOOR FIELD IS GONE (Lee, 12 Aug 2026) ─────────────────────────
            *"It looks like in the rooms you say floor optional. The floor is the attribute of the
            overall building, and we have that… you have it again on the room, and I don't
            understand it."*

            He was right and it was worse than a labelling problem: this form asked for Floor and
            Total floors TWICE — once under The property, once here — bound to the same state, so
            the two pairs moved together and one of them looked broken. Only the copy under The
            property survives, which is where a building-level fact belongs. */}

        {/* ── TWO ATTRIBUTES PEOPLE ACTUALLY SEARCH FOR (Lee, 12 Aug 2026) ────────────────
               *"You're gonna put penthouse — a yes or no, like a radio button. Penthouse is gonna
               show up in the attribute, right, so if people look for penthouses. And people look
               for unobstructed views too… I think those would be radio buttons really. But if
               you make it a toggle switch, they feel better about it, because people don't want
               to put No."*

               Toggles, per his own conclusion, and it is the right one: an unset toggle says
               nothing, whereas an explicit "No" on a radio pair is a claim the seller has to make
               about their own property and will avoid making. Both are filterable. */}
        <div className="grid grid-cols-2 gap-2.5">
          <Toggle on={penthouse} onChange={setPenthouse}
            label={W(lang, "Penthouse", "Penthouse")} />
          <Toggle on={openView} onChange={setOpenView}
            label={W(lang, "Unobstructed view", "Vista despejada")} />
        </div>
      </FormSection>

      <FormSection icon={I.inside} title={W(lang, "Inside", "Interior")}>
        <Field label={W(lang, "Laundry", "Lavandería")}
          hint={W(lang, "One machine that washes and dries is not the same as two — say which.",
                        "Una máquina que lava y seca no es lo mismo que dos — indique cuál.")}>
          <GlassSelect<Laundry | "">
            value={(laundry ?? "") as Laundry | ""}
            ariaLabel={W(lang, "Laundry", "Lavandería")}
            onChange={v => setLaundry(v === "" ? null : (v as Laundry))}
            options={[
              { value: "" as const, label: W(lang, "Prefer not to say", "Prefiero no decirlo") },
              ...laundryOptions(lang).map(o => ({ value: o.value as Laundry | "", label: o.label })),
            ]} />
        </Field>
      </FormSection>

      <FormSection icon={I.outside} title={W(lang, "Outside & the building", "Exterior y el edificio")}>
        {/* Lee, 11 Aug 2026: *"you don't do the same thing when it comes to the outside of the
            building… I don't know why you changed the design up there. Keep the same consistent
            design."* Four `Toggle` rows in a 2×2 give four switches at four different x-positions;
            chips line up. Same control as the amenities directly below, same as the rent form. */}
        <Field label={W(lang, "Outside this property", "Exterior del inmueble")} optional>
          <MultiChips
            values={outsideKeys} onChange={setOutsideKeys}
            options={[
              { value: "balcony",  label: W(lang, "Balcony", "Balcón") },
              { value: "patio",    label: W(lang, "Patio", "Patio") },
              { value: "backyard", label: W(lang, "Backyard", "Jardín") },
              { value: "grill",    label: W(lang, "Grill", "Asador") },
            ]} />
        </Field>
        <Field label={W(lang, "What the building has", "Qué tiene el edificio")} optional>
          <MultiChips values={amenityKeys} onChange={setAmenityKeys} options={amenities(lang)} />
        </Field>
      </FormSection>

      <FormSection icon={I.safety} title={W(lang, "Safety, pets & schools", "Seguridad, mascotas y colegios")}>
        <Field label={W(lang, "Security", "Seguridad")}>
          <ChoiceChips value={security} onChange={setSecurity} options={securityLevels(lang)} allowClear />
        </Field>
        <Field label={W(lang, "Pets", "Mascotas")}>
          <ChoiceChips value={pets} onChange={setPets} options={petsOptions(lang)} allowClear />
        </Field>
        <Toggle on={schoolsNearby} onChange={setSchoolsNearby}
          label={W(lang, "Schools nearby", "Colegios cerca")} />
        {schoolsNearby && (
          <Field label={W(lang, "Which ones", "Cuáles")} optional>
            <input className="input w-full" value={schoolZone} maxLength={160}
              onChange={e => setSchoolZone(e.target.value)}
              placeholder={W(lang, "e.g. Columbus School, 10 minutes", "Ej.: Colegio Columbus, 10 minutos")} />
          </Field>
        )}
        <Field label={W(lang, "Possession from", "Entrega desde")} optional
          hint={W(lang, "When the buyer can actually move in.", "Cuándo puede mudarse realmente el comprador.")}>
          {/* Not `<input type="date">` — that is the black OS calendar Lee photographed.
              `min=""` because a possession date can legitimately be in the past. */}
          <GlassDate value={availableFrom} onChange={setAvailableFrom} min="" />
        </Field>
      </FormSection>

      <FormSection icon={I.eye} title={W(lang, "Visibility", "Visibilidad")}>
        <Toggle on={isPublic} onChange={setIsPublic}
          label={W(lang, "Show in the public feed", "Mostrar en el feed público")}
          note={W(lang, "Off, it lives on your page only and you can share the link.",
                        "Desactivado, vive solo en su página y usted comparte el enlace.")} />
        <Toggle on={allowShare} onChange={setAllowShare}
          label={W(lang, "Let other people share it", "Permitir que otros lo compartan")}
          note={W(lang,
            "Adds a share button for anyone viewing it. Turn it off and only you can send the link.",
            "Agrega un botón de compartir para quien lo vea. Desactívelo y solo usted puede enviar el enlace.")} />
        {/* ── THE COMMENT SWITCH (Lee, 13 Aug 2026) ─────────────────────────────────────────
            *"The host should have a toggle button on the form that says allow the public to
            comment on this listing. So if the person listing doesn't want people to post
            comments, then she could post comments when no one else can."*

            Note the second half — it is the whole design. OFF does not silence the listing, it
            silences EVERYONE ELSE: the lister can still post, so an agent who wants to publish
            notices ("viewings Saturday 10am") without opening a public Q&A can. That rule is in
            the database, not just here — the insert policy allows a write when the listing has
            comments open OR the author is the lister.

            Existing comments stay readable when this is switched off. Closing a conversation is
            not the same act as deleting what people already said, and the lister has a per-comment
            delete for that. */}
        <Toggle on={allowComments} onChange={setAllowComments}
          label={W(lang, "Let the public comment on this listing",
                         "Permitir comentarios públicos en este anuncio")}
          note={W(lang,
            "Questions and answers show under the listing, where the next person can read them. Turn it off and only you can post — anything already there stays visible.",
            "Las preguntas y respuestas aparecen bajo el anuncio, donde la siguiente persona puede leerlas. Desactívelo y solo usted puede publicar — lo que ya está sigue visible.")} />

      </FormSection>

      {/* ── VIEWINGS ─────────────────────────────────────────────────────────────────────────
          Its own section, not a line inside Availability, for the same reason as on the rent
          form: Availability is when the PLACE is free, this is when the PERSON is free to show
          it. Someone reading both in one box has to work out which one a buyer is booking.

          Viewing a place you are thinking of buying is the more consequential of the two
          appointments in this product, and until v54 the sale half had no way to offer one. */}
      <FormSection icon={I.viewings} title={W(lang, "Viewings", "Visitas")}>
        <ShowingWindows
          propertyId={editId ?? null}
          enabled={showingsEnabled} onEnabledChange={setShowingsEnabled}
          notice={showingNotice} onNoticeChange={setShowingNotice}
          slotMinutes={showingSlot} onSlotChange={setShowingSlot}
          lang={lang} />
      </FormSection>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}

      {/* ── IDENTICAL TO THE RENTAL FORM, BY CONSTRUCTION ─────────────────────────────────
             Lee, 12 Aug 2026: *"These are twin forms. If you have a Save-as-draft button on one,
             it needs to look the same as the Save-as-draft button on the other. Literally copy
             the code and make them identical when they have the same things."*

             There is nothing to copy — `FormActions` is one component in the shell and both forms
             call it with the same shape. That is the only version of "identical" that stays
             identical after the next change to either of them. */}
      <FormActions
        hint={blocking}
        invalid={tried && blockers.length > 0}
        cancel={{
          label: W(lang, "Cancel", "Cancelar"),
          onClick: () => {
            const typed = !!(String(title).trim() || String(description).trim() || photos.length);
            if (typed && !window.confirm(W(lang,
              "Leave without saving? Anything you have typed here will be lost.",
              "¿Salir sin guardar? Se perderá lo que haya escrito aquí."))) return;
            if (onClose) onClose(); else nav(productHref("onesale", "/list"));
          },
        }}
        draft={{ label: W(lang, "Save draft", "Guardar borrador"), onClick: () => save(false) }}
        primary={{
          label: W(lang, "Publish", "Publicar"),
          onClick: () => attempt(() => save(true)),
          busy,
        }} />
    </div>
  );
}
