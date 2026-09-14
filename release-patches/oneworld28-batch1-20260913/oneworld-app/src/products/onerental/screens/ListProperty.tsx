import ReservationNotificationSettings from "../components/ReservationNotificationSettings";
import { useListingFeeWaiver } from "../lib/useListingFeeWaiver";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MoneyInput, fmtMoney, NoticeRow,
  useI18n, useOneId, supabase, productHref, W,
  AiTextField, ScreenHeading, PhotoDeck,
  FormSection, Field, Row, SegTabs, ChoiceChips, MultiChips, Stepper, Toggle, FormActions,
  GlassSelect, GlassDate, PlacesInput, fetchTrm, type Trm, displayPointFor,
  /* How the letting is secured, and the two covers. Both libraries already existed; this screen
     is the first thing to actually use them. See shell/lib/guarantee.ts and shell/lib/cover.ts. */
  RESIDENTIAL_DAYS, optionsFor, needsDepositAck, GUARANTEE_COPY, DEPOSIT_ACK,
  COVER_LIVE, PENDING_NOTE, DAMAGE_COVER, LIABILITY_COPY, LIABILITY_SUGGESTED_USD,
  coverFee, coverFeeOverTerm, coverLimits,
  type GuaranteeKind, type StayWindow,
  ShowingWindows, DEFAULT_NOTICE_HOURS, DEFAULT_SLOT_MINUTES,
} from "@oneworld/shell";
import {
  CO_CITIES, CO_NEIGHBOURHOODS, coCityKey, usd, usd2,
  hostFee, guestFee, netToManager, totalDueFromGuest, hostFeeOverTerm,
  type PriceUnit, type BillInterval,
} from "../lib/rental";
import {
  propertyTypes, masterBeds, laundryOptions, securityLevels, petsOptions, amenities, labelFor,
  type PropertyType, type MasterBed, type Laundry, type SecurityLevel, type PetsAllowed,
  type AmenityKey,
} from "../lib/attributes";
import WalkthroughDraftUploader from "../components/WalkthroughDraftUploader";
import PublicVideoDeck from "../components/PublicVideoDeck";
import MediaChoices from "../components/MediaChoices";
import type { FeedPreview } from "../lib/media";
import AgreementAcceptance from '../components/AgreementAcceptance';
import { getRentalLegalDocuments } from '../lib/legalDocuments';
import ContractImport, { type ContractImportApply } from '../components/ContractImport';
import { ownerTermsEnabledFromProperty } from '../lib/ownerTerms';

/**
 * Group the whole-number part with thousands separators, leaving anything after a decimal point
 * untouched so a half-typed "1900." or "1900.5" is not mangled mid-keystroke.
 *
 * Takes and returns a STRING on purpose. Round-tripping through Number() would turn "1900." into
 * "1900" and delete the decimal point the moment somebody typed it, which is the single most
 * infuriating bug in a money field.
 */
function groupDigits(v: string): string {
  if (!v) return "";
  const [whole, ...rest] = v.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length ? `${grouped}.${rest.join(".")}` : grouped;
}

type ListingCurrency = "USD" | "COP";
const ONEHOME_TERMS_VERSION = "OH-2026-09-06.1";

function convertedAmount(value: number, from: ListingCurrency, rate: number): number {
  if (!rate || rate <= 0) return 0;
  return from === "USD" ? value * rate : value / rate;
}

function listingMoney(value: number, currency: ListingCurrency): string {
  return fmtMoney(value, currency, { cents: currency === "USD" });
}

function prettyImportedKey(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

/* Section glyphs — one path each, so every chip in the form is the same weight and size. */
const I = {
  photos:   "M3 7a2 2 0 0 1 2-2h2l1.5-2h7L17 5h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  place:    "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5",
  rooms:    "M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 18v2M21 18v2M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3",
  inside:   "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  outside:  "M12 3v3M5.6 5.6l2.1 2.1M3 12h3M5.6 18.4l2.1-2.1M12 21v-3M18.4 18.4l-2.1-2.1M21 12h-3M18.4 5.6l-2.1 2.1M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  safety:   "M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z M9.5 12l1.8 1.8L15 10",
  where:    "M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  price:    "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  deposit:  "M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 8l2-4h12l2 4M12 12v4M10 14h4",
  when:     "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
};

/* The listing is one form, presented as six short screens. Keeping the data in this component
   means Back, direct step links and the review screen never create a second persistence path. */
const STEPS = ["where", "media", "place", "price", "when", "review"] as const;
type StepKey = typeof STEPS[number];
const STEP_TITLES: Record<StepKey, [string, string]> = {
  where: ["Where it is", "Dónde queda"],
  media: ["Photos & videos", "Fotos y videos"],
  place: ["The place", "El inmueble"],
  price: ["Price & protection", "Precio y protección"],
  when: ["Availability & viewings", "Disponibilidad y visitas"],
  review: ["Review", "Revisar"],
};
const isStep = (value: string | null): value is StepKey =>
  !!value && (STEPS as readonly string[]).includes(value);
const SECTION_STEP: Record<string, StepKey> = {
  photos: "media",
  where: "where",
  place: "place",
  price: "price",
  deposit: "price",
};

function StepPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <div hidden={!active} data-step-panel={active ? "active" : "hidden"}>{children}</div>;
}

/**
 * /rentals/list — CREATE A LISTING.
 * ============================================================================================
 * Lee, 11 Aug 2026, and this brief is the whole design:
 *
 *   "It's gonna be the main thing that guides the real estate agent to get the information
 *    correct, and they need to have a solid experience, a very intuitive experience about how to
 *    construct their listing. It needs to be like a very easy thing where they can just go through
 *    this form, click, click, click… Let's make it the nicest form that they've ever had to fill
 *    out. We have a very good form for OneJob — I would recommend you use the job creation form as
 *    your basis. Take that code, start from there."
 *
 * ── WHAT "CLICK, CLICK, CLICK" ACTUALLY MEANT FOR THE BUILD ─────────────────────────────────
 * The old version of this screen asked for THIRTEEN typed answers. Bedrooms was a text box.
 * Bathrooms was a text box. There is no version of a phone keyboard that makes typing "2" into
 * eleven boxes feel good, and every one of those boxes could be left blank — which is how a
 * listing ends up on the site with no bedroom count, invisible to every search.
 *
 * So every attribute here is now a TAP: a stepper for anything countable, a chip row for anything
 * with a fixed set of answers, a toggle for anything yes/no. Four fields still take typing, and
 * each one earns it — title, description, address and the two prices. That is the whole form.
 *
 * ── CHIPS OR DROPDOWNS: I GOT THIS WRONG THE FIRST TIME ─────────────────────────────────────
 * The first version made EVERY fixed-set answer a chip row, on the argument that the options are
 * the prompt — seeing "Washer-dryer combo" next to "Washer + dryer" is what makes somebody stop
 * and answer accurately, and that is the whole reason Lee wants these attributes at all.
 *
 * Lee, 11 Aug 2026, looking at the result: *"the type of place should be in a drop down menu"*,
 * *"the bed and master, that should be a drop down option"*, *"the washer and dryer option… should
 * be a drop down menu and the none. So it's, like, four options."*
 *
 * The argument was right and the application of it was not. It holds where the set is short and
 * the distinctions are the point — a chip row of four laundry options genuinely teaches you that
 * this platform distinguishes one machine from two. It collapses when the set is NINE property
 * types, where the same wall of chips is the longest thing on the screen and teaches nothing,
 * because nobody needs to be taught that "House" exists.
 *
 * So the rule is now length, not principle: up to about four options with meaningful distinctions
 * stay chips (security, pets); anything longer, or anything where the answer is obvious and the
 * user just needs to state it, is a `GlassSelect`. Laundry went to a dropdown despite being four,
 * because Lee asked for it by name and it needs an explicit "None" — and "None" as a chip reads
 * like a way to clear the field rather than an answer.
 *
 * `GlassSelect`, never a native `<select>`. See `Pickers.tsx` in the shell: the OS renders those
 * as archaic black wheels on a phone. The same rule is why the date field is a `GlassDate`.
 *
 * ── ONE THING DELIBERATELY NOT DONE ─────────────────────────────────────────────────────────
 * This is not a wizard. Lee asked for a form he can scroll, the way the OneJob contract form is a
 * form he can scroll — nine labelled panels, all visible, nothing hidden behind a Next button. A
 * wizard would hide the length rather than reduce it, and it would stop an agent filling in the
 * three things they know now and coming back for the rest.
 */
export default function ListProperty({ onClose, editId }: { onClose?: () => void; editId?: string | null } = {}) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const es = lang === "es" || lang === "co";
  const [step, setStepState] = useState<StepKey>(() => {
    const requested = params.get("step");
    return isStep(requested) ? requested : (editId ? "review" : "where");
  });
  const setStep = (next: StepKey) => {
    setStepState(next);
    setParams(previous => {
      const updated = new URLSearchParams(previous);
      updated.set("step", next);
      return updated;
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  useEffect(() => {
    const requested = params.get("step");
    const next = isStep(requested) ? requested : (editId ? "review" : "where");
    if (next !== step) {
      setStepState(next);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [params, editId, step]);
  const stepIndex = STEPS.indexOf(step);
  const [propertyId, setPropertyId] = useState<string | null>(editId ?? null);
  const [hostTermsAccepted, setHostTermsAccepted] = useState(false);

  /* ── THE PLACE ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  /* ── MEDIA CHOICES (7 Sep 2026, media lane) — see lib/media.ts ────────────────────────────
     Null cover = first photo. Null preview = the cover. `feedVisible` off keeps the listing
     public and openable but out of the Discover feed. The table's trigger nulls a cover or
     preview that points at media no longer on the listing, so a deleted photo never leaves a
     broken choice behind; the form does the same before it saves. */
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [feedPreview, setFeedPreview] = useState<FeedPreview | null>(null);
  const [feedVisible, setFeedVisible] = useState(true);
  const [propertyType, setPropertyType] = useState<PropertyType | null>("apartment");
  const [area, setArea] = useState("");
  const [floor, setFloor] = useState<number | null>(null);
  const [floorsInBuilding, setFloorsInBuilding] = useState<number | null>(null);
  const [furnished, setFurnished] = useState(true);
  const [estrato, setEstrato] = useState<number | null>(null);
  /* Lee, 11 Aug: *"how many years old is the building."* Asked as an AGE because that is how
     somebody standing in the building thinks about it; STORED as a year, because a stored age is
     wrong the day after it is written. */
  const [buildingAge, setBuildingAge] = useState<number | null>(null);
  /* Lee, 12 Aug: identical pair on both forms. */
  const [penthouse, setPenthouse] = useState(false);
  const [openView, setOpenView] = useState(false);

  /* ── ROOMS ── */
  /* 15 Aug 2026: how many people the place sleeps. It shipped as a read-only field first — the
     card and the detail page could show it, but no host could ever set it. This is the input. */
  const [maxGuests, setMaxGuests] = useState<number | null>(null);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [bathrooms, setBathrooms] = useState<number | null>(null);
  const [masterBed, setMasterBed] = useState<MasterBed | null>(null);
  const [walkInCloset, setWalkInCloset] = useState(false);
  const [dualVanities, setDualVanities] = useState(false);
  /* Lee: *"the question is where is the AC unit… a toggle to say AC in master bedroom."* Count and
     location are two different facts and only one of them matters at 3am. */
  const [acInMaster, setAcInMaster] = useState(false);

  /* ── INSIDE ── */
  const [laundry, setLaundry] = useState<Laundry | null>(null);
  const [acUnits, setAcUnits] = useState<number | null>(null);
  const [parking, setParking] = useState<number | null>(null);

  /* ── OUTSIDE + BUILDING ── */
  /* Four booleans in the database, ONE selected set in the form. The columns stay as they are —
     every other screen and the future filter already read them — but the control the agent touches
     is the same chip row as the amenities right under it. */
  const [outsideKeys, setOutsideKeys] = useState<string[]>([]);
  const has = (k: string) => outsideKeys.includes(k);
  const [amenityKeys, setAmenityKeys] = useState<AmenityKey[]>([]);

  /* ── SAFETY, PETS, SCHOOLS ── */
  const [security, setSecurity] = useState<SecurityLevel | null>(null);
  const [pets, setPets] = useState<PetsAllowed | null>(null);
  const [schoolsNearby, setSchoolsNearby] = useState(false);
  const [schoolZone, setSchoolZone] = useState("");

  /* ── WHERE ─────────────────────────────────────────────────────────────────────────────────
     The city is free text fed by Google Places rather than a key from a fixed list. The fixed
     list is still what drives the NEIGHBOURHOOD suggestions, so a Medellín listing still offers
     Medellín barrios — but "the city must be one of six" was a constraint the product does not
     actually have, and it is the thing that made the field a native <select>. */
  const [cityText, setCityText] = useState<string>(
    CO_CITIES.find(c => c.key === "medellin")?.label ?? "Medellín");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressReady, setAddressReady] = useState(!editId);
  /* The folio number. Optional, and the only key that reaches the registry — see the field. */
  const [matricula, setMatricula] = useState("");
  /* Match the typed/picked city back to a curated key when we can, purely to pick the barrio list.
     No match simply means no suggestions, never a blocked entry. */
  const city = useMemo(() => coCityKey(cityText), [cityText]);

  /* ── MONEY ─────────────────────────────────────────────────────────────────────────────────
     Lee, 11 Aug 2026: *"the conversion should be based on some type of general standard. We can't
     allow the user to input the conversion because it could be wrong, and that could be very
     deceptive… we could use Bank Colombia or some type of national government of Colombia
     conversion rate."*

     So there is no rate field on this form any more. The TRM — the Superintendencia Financiera's
     certified COP/USD rate — is fetched, shown, and saved with the listing so a March listing can
     still be read honestly in August. The number the agent used to type defaulted to 4,000, which
     against today's ~3,125 overstated every peso price by about 28%. Nobody typed a lie; the
     default WAS one. See `lib/trm.ts`. */
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<ListingCurrency>("USD");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("month");
  /* Default false preserves every existing listing's split-fee model. When enabled, the same
     9% total moves entirely to the host side; it never adds another fee or raises the rent. */
  const [hostPaysGuestFee, setHostPaysGuestFee] = useState(false);
  const listingFee = useListingFeeWaiver(propertyId);
  const [trm, setTrm] = useState<Trm | null | "loading">("loading");
  useEffect(() => { fetchTrm().then(setTrm); }, []);
  /* NULL IS A REAL ANSWER. When the official rate cannot be reached the listing shows dollars
     alone — never a guessed rate, because a silently-guessed peso price is the exact deception
     this change exists to prevent. */
  const fxRate = trm && trm !== "loading" ? trm.rate : 0;

  /* ── THE SECURITY DEPOSIT. Never "earnest money" — see the note on the section below. ── */
  /* ⚠️ 15 Aug 2026 — DEFAULT CHANGED FROM true TO false, AND IT IS A LEGAL CHANGE, NOT A TASTE ONE.
     Colombian law (Ley 820 de 2003, Article 16) says a cash deposit may not be required on a
     residential lease. A clause that does is void by operation of law — no judge needed — and the
     tenant can demand the money back. Lee decided on 13 August that OneHome takes no deposits: a
     card hold under thirty nights, cover at thirty nights or more. **That decision was made and
     never reached this screen**, which still opened with the deposit switched ON for every new
     listing. So the product was defaulting every Colombian landlord into a void clause. */
  /* `depositRequired` is no longer its own switch. It is derived from the chooser below, so the
     "is there a deposit" question has exactly one answer and cannot be true in the record while
     the host is looking at a screen that says cover. */
  const [depositBasis, setDepositBasis] = useState<"amount" | "months">("months");
  const [depositMonths, setDepositMonths] = useState<number | null>(1);
  const [deposit, setDeposit] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<ListingCurrency>("USD");
  const [depositReturnDays, setDepositReturnDays] = useState<number | null>(30);
  const [leaseNoticeDays, setLeaseNoticeDays] = useState<number | null>(15);
  const [paymentWindowDays, setPaymentWindowDays] = useState<number | null>(5);
  const [breachPenaltyMonths, setBreachPenaltyMonths] = useState<number | null>(1);
  const [depositLawOpen, setDepositLawOpen] = useState(false);

  useEffect(() => {
    if (!depositLawOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setDepositLawOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [depositLawOpen]);

  /* ── HOW THE LETTING IS SECURED — the chooser Lee decided on 13 August ────────────────────
     `guarantee.ts` has existed in the shell since that day, with all three options, the 30-day
     rule and the acknowledgement wording. **No screen ever imported it.** So the decision was
     written down, reviewed, and then the form carried on offering a bare deposit as if none of
     it had happened. That is the gap v44 closes.

     `null` means the host has not chosen yet. It is not defaulted, because each of the three has
     a real consequence and picking one silently on the host's behalf is how the deposit ended up
     switched on for everybody in the first place. */
  const [guaranteeKind, setGuaranteeKind] = useState<GuaranteeKind | null>(null);
  /* Ticked by the host, on this screen, before a deposit can be published. Stored with a
     timestamp: an acknowledgement nobody can date is an acknowledgement nobody can rely on. */
  const [depositAck, setDepositAck] = useState(false);
  /* Liability cover is the HOST's own product and is independent of how the stay is secured —
     a host taking a deposit still wants covering if a guest falls down their stairs. Default ON
     because the charge comes off the host's payout, not the guest's bill, and because a host
     arriving from Airbnb assumes it is there. */
  /* ⚠️ WAS A 1.49 PERCENT CHARGE FOR A COVER ONEHOME SUPPOSEDLY CARRIED. Not a product a
     marketplace can sell — the risk sits in a building we do not own or inspect. It is now the
     host declaring their OWN policy, plus a referral for hosts who have none. Default OFF,
     because a pre-ticked declaration is a declaration nobody made. */
  const [liabilityAttested, setLiabilityAttested] = useState(false);
  const [liabilityInsurer, setLiabilityInsurer] = useState("");
  const [liabilityAmount, setLiabilityAmount] = useState("");
  const [liabilityReferral, setLiabilityReferral] = useState(false);

  /* Dashboard deep links land on the private evidence section after the editor has painted. */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("section") !== "walkthrough") return;
    const timer = window.setTimeout(() => document.getElementById("onehome-walkthrough")
      ?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    return () => window.clearTimeout(timer);
  }, []);

  /* ── WHEN + WHO SEES IT ── */
  const [availableFrom, setAvailableFrom] = useState("");
  const [minTerm, setMinTerm] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [allowShare, setAllowShare] = useState(true);
  /* ── SHOWINGS: WHEN THE HOST IS WILLING TO OPEN THE DOOR (v54) ────────────────────────────
     v51 shipped the guest's booking sheet and seeded one sample's windows by hand, so until now
     no host could set their own. Three scalars live on the listing row; the weekly blocks live in
     `showing_windows` and are written by the editor itself as they are tapped — see the note on
     `persist()` there for why they save immediately rather than on submit. */
  const [showingsEnabled, setShowingsEnabled] = useState(false);
  const [showingNotice, setShowingNotice] = useState<number>(DEFAULT_NOTICE_HOURS);
  const [showingSlot, setShowingSlot] = useState<number>(DEFAULT_SLOT_MINUTES);
  const [allowComments, setAllowComments] = useState(true);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [ownerTermsEnabled, setOwnerTermsEnabled] = useState(false);
  const [importedTerms, setImportedTerms] = useState<Record<string, string>>({});
  const [importedUnmapped, setImportedUnmapped] = useState<{ label: string; value: string }[]>([]);
  const [importedDocKind, setImportedDocKind] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const rent = Number(price) || 0;
  const oppositeCurrency: ListingCurrency = currency === "USD" ? "COP" : "USD";

  const parseBoolean = (value: string) => /^(true|yes|si|sí|1)$/i.test(value.trim());
  const parseNumber = (value: string) => {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  async function invokeImporter(fn: string, body: unknown): Promise<unknown> {
    const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
    if (error) throw error;
    return data;
  }

  function applyImportedContract(payload: ContractImportApply) {
    const v = payload.fields;
    const numeric = (key: string, setter: (value: number | null) => void) => {
      if (v[key] != null) setter(parseNumber(v[key]));
    };
    const yesNo = (key: string, setter: (value: boolean) => void) => {
      if (v[key] != null) setter(parseBoolean(v[key]));
    };

    if (v.title) setTitle(v.title);
    if (v.property_type) setPropertyType(v.property_type as PropertyType);
    numeric("bedrooms", setBedrooms); numeric("bathrooms", setBathrooms);
    if (v.area_m2 != null) setArea(String(parseNumber(v.area_m2) ?? ""));
    numeric("max_guests", setMaxGuests); numeric("floor_number", setFloor);
    numeric("floors_in_building", setFloorsInBuilding); numeric("parking_spaces", setParking);
    numeric("estrato", setEstrato); numeric("air_conditioning_units", setAcUnits);
    if (v.year_built != null) {
      const year = parseNumber(v.year_built);
      setBuildingAge(year == null ? null : Math.max(0, new Date().getFullYear() - year));
    }
    yesNo("furnished", setFurnished); yesNo("penthouse", setPenthouse);
    yesNo("open_view", setOpenView); yesNo("walk_in_closet", setWalkInCloset);
    yesNo("dual_vanities", setDualVanities); yesNo("ac_in_master", setAcInMaster);
    yesNo("schools_nearby", setSchoolsNearby);
    if (v.master_bed) setMasterBed(v.master_bed as MasterBed);
    if (v.laundry) setLaundry(v.laundry as Laundry);
    if (v.security_level) setSecurity(v.security_level as SecurityLevel);
    if (v.pets_allowed) setPets(v.pets_allowed as PetsAllowed);
    if (v.school_zone) setSchoolZone(v.school_zone);
    if (v.amenities) setAmenityKeys(v.amenities.split(",").map(x => x.trim()).filter(Boolean) as AmenityKey[]);
    const importedOutside = ["balcony", "patio", "backyard", "grill"]
      .filter(key => parseBoolean(v[`has_${key}`] ?? "false"));
    if (importedOutside.length) setOutsideKeys(importedOutside);
    if (v.city) setCityText(v.city);
    if (v.neighbourhood) setNeighbourhood(v.neighbourhood);
    if (v.address_line) { setAddressLine(v.address_line); setAddressReady(true); }
    if (v.matricula_inmobiliaria) setMatricula(v.matricula_inmobiliaria);
    if (v.available_from) setAvailableFrom(v.available_from);
    numeric("min_term_days", setMinTerm);
    if (v.price != null) setPrice(groupDigits(v.price.replace(/,/g, "")));
    if (v.price_unit === "night" || v.price_unit === "month") setPriceUnit(v.price_unit);
    if (v.currency === "COP" || v.currency === "USD") setCurrency(v.currency);
    if (payload.description.trim()) setDescription(payload.description.trim());

    const mapped = new Set([
      "title","property_type","bedrooms","bathrooms","area_m2","furnished","max_guests",
      "floor_number","floors_in_building","penthouse","open_view","parking_spaces","estrato",
      "year_built","master_bed","walk_in_closet","dual_vanities","laundry",
      "air_conditioning_units","ac_in_master","has_balcony","has_patio","has_backyard","has_grill",
      "security_level","pets_allowed","schools_nearby","school_zone","amenities","city",
      "neighbourhood","address_line","available_from","min_term_days","price","price_unit","currency",
      "matricula_inmobiliaria",
    ]);
    const extraFields = Object.entries(v)
      .filter(([key]) => !mapped.has(key))
      .map(([key, value]) => ({ label: prettyImportedKey(key), value }));
    setImportedTerms(payload.terms);
    setImportedUnmapped([...payload.unmapped, ...extraFields]);
    setImportedDocKind(payload.docKind);
    setOwnerTermsEnabled(true);
    setImportNotice(W(lang,
      "Suggestions applied. Review the form, then save the draft or publish.",
      "Sugerencias aplicadas. Revise el formulario y luego guarde el borrador o publique."));
    setImportOpen(false);
  }

  /* The deposit in money, whichever way the agent expressed it. Months are resolved against the
     CURRENT rent, so editing the rent moves the deposit with it — which is what "one month's
     rent" means, and what a typed number silently stops meaning the moment the rent changes. */
  const depositValue = depositBasis === "months"
    ? Math.round(rent * (depositMonths ?? 0) * 100) / 100
    : Number(deposit) || 0;
  const effectiveDepositCurrency: ListingCurrency = depositBasis === "months" ? currency : depositCurrency;

  /* ── WHICH OPTIONS THIS LISTING MAY OFFER ────────────────────────────────────────────────
     Under 30 nights the law treats the stay as lodging (Decreto 2590 de 2009) and a card hold
     is the right instrument. At 30 days or more it is an urban housing lease and Ley 820 de 2003
     Art. 16 applies, which is where the deposit prohibition lives.

     Read from what the host actually typed, not from a separate question, because a separate
     question is one more thing to get wrong: a monthly price is a long let; a nightly price with
     a minimum term of 30 nights or more is also a long let; a nightly price with no minimum could
     be either, and "both" is the honest answer rather than a guess. */
  const stayWindow: StayWindow =
    priceUnit === "month" ? "long"
    : (minTerm ?? 0) >= RESIDENTIAL_DAYS ? "long"
    : (minTerm ?? 0) > 0 ? "short"
    : "both";
  const allowedGuarantees = optionsFor(stayWindow);
  /* A host who chose "deposit" and then switched the listing to nightly must not keep a deposit
     the new window does not allow. The choice is dropped rather than silently kept. */
  const guarantee: GuaranteeKind | null =
    guaranteeKind && allowedGuarantees.includes(guaranteeKind) ? guaranteeKind : null;
  const depositChosen = guarantee === "deposit";
  const coverChosen = guarantee === "insurance";
  const ackNeeded = needsDepositAck(guarantee, stayWindow);

  /* The two cover charges, per period and over the term. Placeholder rates — every invented
     number is in shell/lib/cover.ts, nothing is invented here. */
  const cycles = priceUnit === "month" ? 12 : 1;
  const damageFee = coverChosen ? coverFee(rent, DAMAGE_COVER) : 0;
  const damageTerm = coverChosen ? coverFeeOverTerm(rent, cycles, DAMAGE_COVER) : 0;
  /* Liability costs the host nothing THROUGH US now, so there is no fee and no payout line.
     Kept as zero rather than deleted so `NetToYou` keeps one shape. */
  const liabilityFee = 0;
  const liabilityTerm = 0;

  /* What gets SAVED is what the agent picked, cleaned of the country tail Google appends
     ("Medellín, Antioquia, Colombia" → "Medellín") — the listing already knows it is in Colombia. */
  const cityLabel = cityText.split(",")[0].trim() || cityText.trim();
  const hoods = CO_NEIGHBOURHOODS[city] ?? [];
  const billInterval: BillInterval = priceUnit === "night" ? "days" : "months";

  const money = useMemo(() => {
    const normalHostFee = listingFee.waived ? 0 : hostFee(rent);
    const normalGuestFee = listingFee.waived ? 0 : guestFee(rent);
    const fee = hostPaysGuestFee ? Math.round((normalHostFee + normalGuestFee) * 100) / 100 : normalHostFee;
    const tenantFee = hostPaysGuestFee ? 0 : normalGuestFee;
    /* ⚠️ `depositThroughUs` IS NOW ALWAYS FALSE, AND IT IS NOT A PRICING TWEAK.
       The old call passed `depositThroughUs: depositRequired`, so the form quoted the host a fee
       ON THE DEPOSIT. Charging a percentage of a sum implies receiving it — you cannot take
       8.99% of money that never touches you. That single argument was the arithmetic proof that
       the product believed it was holding deposits, and it would have been the first thing a
       regulator or a plaintiff's lawyer pointed at. The deposit is now, by decision and by code,
       money OneHome never sees, so it earns nothing. */
    const ourTotal = hostFeeOverTerm({ rent, cycles, rate: listingFee.waived ? 0 : hostPaysGuestFee ? 0.09 : undefined });
    /* This is a host-to-host comparison. Airbnb's typical host fee is about 3%; comparing its
       combined host+guest take to only OneHome's host fee would manufacture a saving. */
    const airbnbTotal = Math.round(rent * 0.03 * cycles * 100) / 100;
    /* What actually reaches the host per period: rent, less our fee, less the liability cover
       the host elected. Shown as one number because that is the number they care about. */
    const net = Math.round((rent - fee - liabilityFee) * 100) / 100;
    return {
      fee, tenantFee, tenantTotal: listingFee.waived || hostPaysGuestFee ? rent : totalDueFromGuest(rent), net,
      cycles, ourTotal, airbnbTotal, liabilityFee, liabilityTerm,
    };
  }, [rent, priceUnit, cycles, liabilityFee, liabilityTerm, hostPaysGuestFee, listingFee.waived]);

  /* ── WHAT IS STILL MISSING, AND WHERE IT LIVES ──────────────────────────────────────────
     Lee, 12 Aug 2026: *"If people try to publish and there's still something required, that text
     at the bottom needs to turn red like normal, and it needs to highlight the section that it's
     applicable to. Any applicable sections — they scroll back up and see, oh, this is the section
     I need to complete, because it turned red."*

     So a blocker is no longer just a sentence: it carries the SECTION it belongs to. One sentence
     at the foot of a nine-panel form tells you something is wrong and not where.

     `tried` is the other half. Nothing is red until somebody actually presses Publish — a form
     that opens already shouting about the fields you have not reached yet is a form that shouts
     at everybody, including the person who is doing it properly. */
  const [tried, setTried] = useState(false);
  const blockers = [
    photos.length === 0 && { sec: "photos", msg: W(lang, "Add at least one photo", "Agregue al menos una foto") },
    title.trim().length < 3 && { sec: "place", msg: W(lang, "Give it a title", "Póngale un título") },
    rent <= 0 && { sec: "price", msg: W(lang, "Add the rent", "Agregue el canon") },
    !guarantee && { sec: "deposit", msg: W(lang, "Choose how the letting is secured", "Elija cómo se garantiza el arriendo") },
    depositChosen && depositValue <= 0 && { sec: "deposit", msg: W(lang, "Set the deposit", "Defina el depósito") },
    /* The acknowledgement is a PUBLISH blocker, not a warning. Lee, 13 Aug: *"they just have to
       acknowledge what it is. It's illegal. If they click the box and they still do it, that's up
       to them."* A box that can be skipped is not an acknowledgement. */
    ackNeeded && !depositAck && { sec: "deposit", msg: W(lang, "Tick the deposit acknowledgement", "Marque el reconocimiento del depósito") },
  ].filter(Boolean) as { sec: string; msg: string }[];
  const blocking = blockers[0]?.msg ?? null;
  /* Every section carrying a blocker goes red, not just the first — "any applicable sections". */
  const bad = (sec: string) => tried && blockers.some(b => b.sec === sec);

  /* Pressing Publish with something missing should not feel like nothing happened. It marks the
     form as tried (which paints the panels) and then takes you to the first one, because asking
     somebody to hunt for the red panel is only marginally better than not colouring it. */
  const attempt = (go: () => void) => {
    if (blockers.length) {
      setTried(true);
      setStep(SECTION_STEP[blockers[0].sec] ?? "review");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
      return;
    }
    go();
  };

  async function save(publish: boolean, stay = false): Promise<string | null> {
    if (!userId) {
      setErr(W(lang, "Your session expired. Sign in again before publishing.",
                     "Su sesión venció. Inicie sesión de nuevo antes de publicar."));
      return null;
    }
    if (propertyId && !addressReady) {
      setErr(W(lang,
        "Reload this listing before saving so its private address cannot be accidentally cleared.",
        "Recargue este anuncio antes de guardar para que su dirección privada no se borre por accidente."));
      return null;
    }
    setBusy(true); setErr(null);

    /* ── THE MAP POINT ───────────────────────────────────────────────────────────────────────
       Geocoded here, then BLURRED here for any listing whose address is not public, so the exact
       coordinate never leaves the browser. `displayPointFor` does both; the database re-checks the
       precision on write because the promise must not depend on this line being right.

       `null` is a completely fine outcome: no coordinates means the listing is absent from the map
       and identical everywhere else. Geocoding must never block publishing — an agent whose
       building confuses Google still has a listing. */
    const geo = await displayPointFor({
      address: addressLine, neighbourhood, city: cityLabel,
      addressIsPublic: false,
      /* Seeded on the address itself, not on a random value: the same listing must always land on
         the same false point, or saving five times publishes five points whose centre IS the
         address. Two units in one building differ by their title. */
      seed: `${userId}:${addressLine || neighbourhood}:${title}`,
    });
    /* ── EDIT, NOT ONLY CREATE (Lee, 12 Aug 2026) ──────────────────────────────────────────
       *"I just noticed I can't edit my listing. That's something I should be able to do… but
       there's no edit section, so I can't even change what's on here."*

       He could not. This screen only ever INSERTED, so the only way to correct a typo was to
       publish a second listing and leave the first one wrong. The same payload now updates when
       an `editId` came in, which keeps exactly one description of what a listing is — a separate
       edit form is how the two drift and one of them starts missing a field. */
    const payload: Record<string, unknown> = {
      agent_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      photos,
      videos,
      cover_photo: coverPhoto && photos.includes(coverPhoto) ? coverPhoto : null,
      feed_preview: feedPreview && (feedPreview.kind === "photo" ? photos : videos).includes(feedPreview.url)
        ? feedPreview : null,
      feed_visible: feedVisible,
      price: rent,
      price_unit: priceUnit,
      host_pays_guest_fee: hostPaysGuestFee,
      currency,
      display_currency: fxRate > 0 ? oppositeCurrency : null,
      display_fx_rate: fxRate > 0 ? fxRate : null,
      display_fx_at: fxRate > 0 ? new Date().toISOString() : null,
      deposit_required: depositChosen,
      deposit_amount: depositChosen ? depositValue : null,
      deposit_currency: depositChosen ? effectiveDepositCurrency : null,
      deposit_basis: depositBasis,
      deposit_months: depositBasis === "months" ? depositMonths : null,
      deposit_return_days: depositReturnDays ?? 30,
      lease_notice_days: leaseNoticeDays ?? 15,
      payment_window_business_days: paymentWindowDays ?? 5,
      breach_penalty_months: breachPenaltyMonths ?? 1,
      /* ⚠️ WAS HARD-CODED "onehome_vault". Holding a tenant's money in the platform's own hands
         is the shape Colombian regulators look at — money that SITS rather than PASSES THROUGH —
         and the words "vault" and "held by" claim a custody role we have no licence for. The
         landlord is who holds it, and that is what the record now says. */
      deposit_held_by: "landlord",
      /* ── WHAT THE HOST ACTUALLY CHOSE ──────────────────────────────────────────────────
         ⚠️ THESE COLUMNS ALREADY EXISTED. `guarantee_kind` (a real Postgres enum),
         `guarantee_amount`, `insurance_rate_pct`, `deposit_ack_at` and `deposit_ack_by` were all
         migrated on 13 August, along with two CHECK constraints that refuse a deposit without an
         acknowledgement and refuse cover without a rate. The database has been enforcing this
         decision for two days. **No screen ever wrote to any of them.** So the form kept saving
         the old boolean pair and the enum stayed null on every listing — which is why this is a
         wiring job, not a schema job, and why the migration beside it only adds the liability
         side that genuinely did not exist.

         Rate and limits are copied ONTO THE ROW at publish time rather than read from code at
         display time. Same discipline as `display_fx_rate`: a rate change in shell/lib/cover.ts
         tomorrow must never rewrite what a host and a tenant already agreed to. */
      guarantee_kind: guarantee,
      guarantee_amount: depositChosen ? depositValue : coverChosen ? damageFee : null,
      /* `rental_insurance_requires_rate` refuses cover with no rate, so this is not optional. */
      insurance_rate_pct: coverChosen ? DAMAGE_COVER.ratePct : null,
      damage_cover_limit: coverChosen ? DAMAGE_COVER.limitUsd : null,
      damage_cover_excess: coverChosen ? DAMAGE_COVER.excessUsd : null,
      /* `rental_deposit_requires_ack` refuses a deposit with no acknowledgement date, which is
         why the tick is a publish blocker above rather than a warning. The wording is stored
         alongside it: knowing somebody acknowledged is worth much less than knowing what. */
      deposit_ack_at: depositChosen && depositAck ? new Date().toISOString() : null,
      deposit_ack_by: depositChosen && depositAck ? userId : null,
      deposit_ack_text: depositChosen && depositAck ? (es ? DEPOSIT_ACK.es : DEPOSIT_ACK.en) : null,
      /* The host's OWN liability policy, as declared by the host. Never "verified" anywhere. */
      liability_attested: liabilityAttested,
      liability_insurer: liabilityAttested ? (liabilityInsurer.trim() || null) : null,
      liability_amount_usd: liabilityAttested ? (Number(liabilityAmount) || null) : null,
      liability_attested_at: liabilityAttested ? new Date().toISOString() : null,
      liability_referral_optin: !liabilityAttested && liabilityReferral,
      /* RETIRED. Written false so no listing claims a cover OneHome never provided. */
      liability_cover: false,
      /* False until a carrier signs. Written per listing so a listing published today can be told
         apart from one published after placement — which is exactly the question a claim asks. */
      cover_placed: COVER_LIVE,
      /* The database stores ISO-2. "Colombia" violated rental_properties_country_iso2, so the
         preview swallowed the insert error and made Publish appear completely inert. */
      country: "CO",
      city: cityLabel,
      neighbourhood: neighbourhood.trim() || null,
      address_line: [buildingName.trim(), addressLine.trim()].filter(Boolean).join(" — ") || null,
      address_is_public: false,
      matricula_inmobiliaria: matricula.trim() || null,
      display_lat: geo?.lat ?? null,
      display_lng: geo?.lng ?? null,
      geo_precision: geo?.precision ?? null,
      property_type: propertyType,
      floor_number: floor,
      floors_in_building: floorsInBuilding,
      parking_spaces: parking,
      estrato,
      max_guests: maxGuests,
      bedrooms, bathrooms, area_m2: n(area),
      master_bed: masterBed,
      walk_in_closet: walkInCloset,
      dual_vanities: dualVanities,
      laundry,
      air_conditioning_units: acUnits,
      has_balcony: has("balcony"), has_patio: has("patio"),
      has_backyard: has("backyard"), has_grill: has("grill"),
      amenities: amenityKeys,
      security_level: security,
      pets_allowed: pets,
      schools_nearby: schoolsNearby,
      school_zone: schoolZone.trim() || null,
      furnished,
      /* Age in, year out. See the state declaration for why. */
      year_built: buildingAge == null ? null : new Date().getFullYear() - buildingAge,
      ac_in_master: acInMaster,
      /* Lee, 12 Aug — filterable attributes nobody else's listing states. */
      penthouse, open_view: openView,
      available_from: availableFrom || null,
      min_term_days: minTerm ?? 1,
      bill_interval: billInterval,
      bill_interval_count: 1,
      is_public: isPublic,
      allow_public_share: allowShare,
      allow_comments: allowComments,
      showings_enabled: showingsEnabled,
      showing_notice_hours: showingNotice,
      showing_slot_minutes: showingSlot,
      owner_terms_enabled: ownerTermsEnabled,
      imported_contract_terms: importedTerms,
      imported_contract_unmapped: importedUnmapped,
      imported_doc_kind: importedDocKind,
      imported_at: importedDocKind ? new Date().toISOString() : null,
      status: publish ? "published" : "draft",
      ...(publish ? {
        onehome_terms_version: ONEHOME_TERMS_VERSION,
        onehome_terms_accepted_at: new Date().toISOString(),
        onehome_terms_accepted_by: userId,
      } : {}),
    };

    /* `updated_at` is what the listing shows as "Edited on …". The column already existed, so
       there is no migration here — Lee: *"if I do edit it, it needs to have a time stamp so
       people know that, okay, when I looked at it last week, it looks like it was edited."* */
    const { data, error } = propertyId
      ? await supabase.from("rental_properties")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", propertyId).eq("agent_id", userId)   // RLS says this too; belt and braces
          .select("id").single()
      : await supabase.from("rental_properties").insert(payload).select("id").single();
    if (error) { setBusy(false); setErr(error.message); return null; }
    const savedId = data!.id as string;
    // Record the successful insert before the second RPC. If that RPC is temporarily unavailable,
    // Save-again updates this same listing instead of inserting a duplicate.
    setPropertyId(savedId);
    const privateAddress = [buildingName.trim(), addressLine.trim()].filter(Boolean).join(" — ") || null;
    const { error: addressError } = await supabase.rpc("set_rental_property_address", {
      p_property_id: savedId,
      p_address_line: privateAddress,
    });
    setBusy(false);
    if (addressError) {
      setErr(W(lang,
        "The listing was saved, but its private address could not be updated. Please try Save again.",
        "El anuncio se guardó, pero no se pudo actualizar su dirección privada. Vuelva a tocar Guardar."));
      return null;
    }
    setAddressReady(true);
    if (stay) return savedId;
    /* Straight after saving, the owner's view — they have just been editing it and the
       next thing they are likely to want is to edit it again. */
    nav(productHref("onerental", `/r/${savedId}?owner=1`));
    return savedId;
  }

  /* ── LOADING AN EXISTING LISTING BACK INTO THE FORM ────────────────────────────────────────
     Every field the form writes, read back once on mount. Anything missed here silently reverts
     to its default the moment somebody saves, which is worse than not offering editing at all —
     so this list is kept in the same order as the payload above, to make a gap visible. */
  useEffect(() => {
    if (!propertyId || !userId) return;
    let alive = true;
    void (async () => {
      const [{ data }, addressResult] = await Promise.all([
        supabase.from("rental_properties")
          .select("*").eq("id", propertyId).eq("agent_id", userId).maybeSingle<any>(),
        supabase.rpc("rental_property_address", { p_property_id: propertyId }),
      ]);
      if (!alive || !data) return;
      if (addressResult.error) {
        setAddressReady(false);
        setErr(W(lang,
          "Your listing loaded, but its private address did not. Reload before editing so it cannot be accidentally cleared.",
          "Su anuncio cargó, pero su dirección privada no. Recargue antes de editar para que no se borre por accidente."));
        return;
      }
      setTitle(data.title ?? "");
      setShowingsEnabled(!!data.showings_enabled);
      /* ⚠️ NULL MEANS "NEVER CHOSE", AND THE FALLBACK MUST BE THE CAUTIOUS ANSWER — 24 hours,
         not 0. `?? DEFAULT` rather than `|| DEFAULT` on purpose: a host who deliberately picked
         same-day viewings stored 0, and `||` would silently overwrite that with 24 every time
         they opened the form. */
      setShowingNotice(data.showing_notice_hours ?? DEFAULT_NOTICE_HOURS);
      setShowingSlot(data.showing_slot_minutes ?? DEFAULT_SLOT_MINUTES);
      setDescription(data.description ?? "");
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
      setVideos(Array.isArray(data.videos) ? data.videos : []);
      setCoverPhoto(typeof data.cover_photo === "string" ? data.cover_photo : null);
      setFeedPreview(data.feed_preview && typeof data.feed_preview === "object" && typeof data.feed_preview.url === "string"
        && (data.feed_preview.kind === "photo" || data.feed_preview.kind === "video")
        ? { kind: data.feed_preview.kind, url: data.feed_preview.url } : null);
      setFeedVisible(data.feed_visible !== false);
      setPrice(String(data.price ?? ""));
      setCurrency(data.currency === "COP" ? "COP" : "USD");
      setPriceUnit(data.price_unit ?? "month");
      setHostPaysGuestFee(data.host_pays_guest_fee === true);
      setDepositCurrency(data.deposit_currency === "COP" ? "COP" : "USD");
      /* An older listing has no `guarantee_kind`. Read its intent from what it does have rather
         than dropping the host into "choose one" with their own deposit invisible. */
      setGuaranteeKind(
        (data.guarantee_kind as GuaranteeKind | null)
        ?? (data.deposit_required ? "deposit" : null));
      setDepositAck(!!data.deposit_ack_at);
      setLiabilityAttested(!!data.liability_attested);
      setLiabilityInsurer(data.liability_insurer ?? "");
      setLiabilityAmount(data.liability_amount_usd != null ? String(data.liability_amount_usd) : "");
      setLiabilityReferral(!!data.liability_referral_optin);
      setDepositBasis(data.deposit_basis ?? "months");
      // Fixed-amount deposits have their own input state. Omitting this readback left the field
      // visibly blank on edit and made Preview/Publish fail validation even though the saved row
      // still contained the amount.
      setDeposit(data.deposit_amount == null ? "" : String(data.deposit_amount));
      setDepositMonths(data.deposit_months ?? null);
      setDepositReturnDays(data.deposit_return_days ?? null);
      setLeaseNoticeDays(data.lease_notice_days ?? 15);
      setPaymentWindowDays(data.payment_window_business_days ?? 5);
      setBreachPenaltyMonths(data.breach_penalty_months ?? 1);
      setPropertyType(data.property_type ?? null);
      setMaxGuests(data.max_guests ?? null);
      setBedrooms(data.bedrooms ?? null);
      setBathrooms(data.bathrooms ?? null);
      setArea(data.area_m2 == null ? "" : String(data.area_m2));
      setMasterBed(data.master_bed ?? null);
      setWalkInCloset(!!data.walk_in_closet);
      setDualVanities(!!data.dual_vanities);
      setAcInMaster(!!data.ac_in_master);
      setLaundry(data.laundry ?? null);
      setAcUnits(data.air_conditioning_units ?? null);
      setParking(data.parking_spaces ?? null);
      setFloor(data.floor ?? null);
      setFloorsInBuilding(data.floors_in_building ?? null);
      setEstrato(data.estrato ?? null);
      setBuildingAge(data.year_built == null ? null : new Date().getFullYear() - data.year_built);
      setFurnished(!!data.furnished);
      setPenthouse(!!data.penthouse);
      setOpenView(!!data.open_view);
      setSecurity(data.security ?? null);
      setPets(data.pets_allowed ?? null);
      setSchoolsNearby(!!data.schools_nearby);
      setCityText(data.city ?? "");
      setNeighbourhood(data.neighbourhood ?? "");
      setAddressLine(typeof addressResult.data === "string" ? addressResult.data : "");
      setAddressReady(true);
      setMatricula(data.matricula_inmobiliaria ?? "");
      setAvailableFrom(data.available_from ?? "");
      setMinTerm(data.min_term_days ?? null);
      setIsPublic(data.is_public !== false);
      setAllowShare(data.allow_public_share !== false);
      setAllowComments(data.allow_comments !== false);
      setOwnerTermsEnabled(ownerTermsEnabledFromProperty(data));
      setImportedTerms(data.imported_contract_terms && typeof data.imported_contract_terms === "object"
        ? data.imported_contract_terms : {});
      setImportedUnmapped(Array.isArray(data.imported_contract_unmapped)
        ? data.imported_contract_unmapped.filter((row: any) => row && typeof row.label === "string" && typeof row.value === "string")
        : []);
      setImportedDocKind(typeof data.imported_doc_kind === "string" ? data.imported_doc_kind : null);
      setHostTermsAccepted(data.onehome_terms_version === ONEHOME_TERMS_VERSION && !!data.onehome_terms_accepted_at);
    })();
    return () => { alive = false; };
  }, [propertyId, userId]);

  /* ── THE PREVIEW ────────────────────────────────────────────────────────────────────────
     Lee: *"once someone gets towards the bottom and they preview it, just like in the job
     creation, they can see how nice it looks to the public."* Same pattern as the contract
     form: a full screen, a way back to editing, and the real publish action on the bar. */
  if (previewOpen) {
    return (
      <ListingPreview
        lang={lang} es={es}
        onBack={() => setPreviewOpen(false)}
        onPublish={() => save(true)}
        termsAccepted={hostTermsAccepted}
        onTermsAccepted={setHostTermsAccepted}
        busy={busy}
        error={err}
        listing={{
          title, description, rent, priceUnit, currency, oppositeCurrency, fx: fxRate,
          /* Cover first, so the preview shows the listing the way the public will see it. */
          photos: coverPhoto && photos.includes(coverPhoto) ? [coverPhoto, ...photos.filter(u => u !== coverPhoto)] : photos,
          cityLabel, neighbourhood, propertyType, bedrooms, bathrooms, area: n(area),
          floor, furnished, masterBed, walkInCloset, dualVanities, laundry, acUnits, parking,
          hasBalcony: has("balcony"), hasPatio: has("patio"),
          hasBackyard: has("backyard"), hasGrill: has("grill"), amenityKeys, security, pets,
          schoolsNearby, schoolZone, depositValue, depositBasis, depositMonths,
          depositCurrency: effectiveDepositCurrency,
          depositReturnDays, availableFrom, minTerm,
          guarantee, depositChosen, coverChosen, damageFee,
          liabilityAttested, liabilityInsurer, liabilityAmount,
        }} />
    );
  }

  return (
    <div className="space-y-1">
      {/* When this form is a MODE of the hub (the QRPay pattern), it owns its own way back —
          the tab bar would otherwise be the only exit and that loses the draft silently. */}
      {onClose && (
        <button onClick={onClose}
          className="ow-tap mb-1 flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">
          ‹ {W(lang, "Back", "Atrás")}
        </button>
      )}
      <ScreenHeading>{W(lang, "List a place", "Publicar")}</ScreenHeading>
      <p className="text-[12.5px] leading-relaxed opacity-60">
        {W(lang,
          "Listing is free. Messaging is free. Signing is free. We only take a fee when money actually moves.",
          "Publicar es gratis. Escribir es gratis. Firmar es gratis. Solo cobramos cuando el dinero realmente se mueve.")}
      </p>

      <StepHeader lang={lang} step={step} onStep={setStep} />

      <StepPanel active={step === "media"}>
      {/* ── 1 · PHOTOS ─────────────────────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "Photos", "Fotos")} icon={I.photos} required invalid={bad("photos")}
        hint={W(lang, "Up to 50. The first one is the cover unless you choose another below.",
                      "Hasta 50. La primera es la portada a menos que elija otra más abajo.")}>
        <PhotoDeck photos={photos} onChange={setPhotos} folder="rentals" lang={lang} />
      </FormSection>

      <FormSection title={W(lang, "Listing videos", "Videos del anuncio")} icon={I.photos}
        hint={W(lang, "Up to 5 public videos. Portrait and landscape clips both open full screen.",
                      "Hasta 5 videos públicos. Los videos verticales y horizontales se abren en pantalla completa.")}>
        <PublicVideoDeck videos={videos} onChange={setVideos} folder="rentals" lang={lang} />
      </FormSection>

      {/* ── COVER & FEED PREVIEW (7 Sep 2026, media lane) ───────────────────────────────────
          Drawn only once there is a choice to make — two or more photos, or any video. With one
          photo and no video the section does not exist, which is the rule everywhere in this
          form: nothing disabled, nothing empty. The section lives right under the media it
          chooses from so the host can see what they are picking. */}
      {(photos.length > 1 || videos.length > 0) && (
        <FormSection title={W(lang, "Cover & feed preview", "Portada y vista previa del feed")} icon={I.photos}
          hint={W(lang, "Choose the still that leads the listing, and the photo or video that leads your card in Discover.",
                        "Elija la foto que encabeza el anuncio y la foto o video que encabeza su tarjeta en Descubrir.")}>
          <MediaChoices photos={photos} videos={videos}
            cover={coverPhoto} onCover={setCoverPhoto}
            preview={feedPreview} onPreview={setFeedPreview} lang={lang} />
        </FormSection>
      )}
      </StepPanel>

      <StepPanel active={step === "where"}>
      {/* ── 2 · WHERE IT IS — MOVED UP FROM THE BOTTOM, 12 Aug 2026 ──────────────────────
          Lee: *"the address is buried at the very bottom of the form."* It was section 7 of 10,
          under bedrooms, bathrooms, closets and grills. Two things were wrong with that.

          One, it is the field a renter cares about most and the one the lister knows without
          thinking — asking it late means scrolling past nine sections to type the thing you came
          to type. Two, the SALE form already asks for the address in its second section, and Lee
          ruled on 12 Aug that these are twin forms: *"literally copy the code and make them
          identical when they have the same things."* The rent form was the odd one out.

          Photos stay first, deliberately. They are the only section where an empty result is
          instantly obvious to the person filling the form, so they set the standard for the rest
          of it. */}
      {/* ── (see 2 above) ──────────────────────────────────────────────────────────────────────
          Lee, 11 Aug 2026, and this is the THIRD time he has asked:
            *"I'm telling you again for the second time that you should be able to use the Google
             places for any addresses for renting or buying."*
          and separately: *"the city should be based on Google places."*

          He was right to keep asking. A working, hardened `PlacesInput` has been sitting in
          `products/onejob` since July — portal dropdown so a blurred sibling card cannot paint over
          the suggestions, and a silent failure path so manual typing always works. It is in the
          shell now, and this screen uses it for both fields.

          Also: *"be sure you watch out for your spacing when it comes to the type, the city, the
          neighborhood, the address… For the address, you just don't have enough room."* An address
          is the longest string on the form and it was sharing a row. It gets the full width. */}
      <FormSection title={W(lang, "Where it is", "Dónde queda")} icon={I.where}>
        <Field label={W(lang, "City", "Ciudad")}
          hint={W(lang, "Start typing — this comes from Google.", "Empiece a escribir — esto viene de Google.")}>
          <PlacesInput
            variant="city" countries={["co"]}
            value={cityText} onChange={setCityText}
            onSelectParts={({ name }) => { setCityText(name); setNeighbourhood(""); }}
            placeholder={W(lang, "Medellín", "Medellín")} />
        </Field>

        {/* The neighbourhood keeps its curated list, because Google's idea of a Medellín barrio and
            a Medellín renter's idea of one are not the same thing — "El Poblado" is a comuna to
            Google and a search term to everybody else. Typing anything is still allowed. */}
        <Field label={W(lang, "Neighbourhood", "Barrio")}>
          <input className="input w-full" value={neighbourhood} list="ow-hoods"
            onChange={e => setNeighbourhood(e.target.value)} placeholder={hoods[0] ?? ""} />
          <datalist id="ow-hoods">{hoods.map(h => <option key={h} value={h} />)}</datalist>
        </Field>

        {/* Lee, 11 Aug: *"You should put building name on here also, and that should be
            optional."* The `establishment` variant searches business and building names, and
            picking one fills the street address underneath from the same prediction — one tap
            instead of two fields typed. Exactly what OneJob's contract form does with its venue
            field. */}
        <Field label={W(lang, "Building or complex name", "Nombre del edificio o unidad")} optional>
          <PlacesInput
            variant="establishment" countries={["co"]} bias={cityLabel}
            value={buildingName} onChange={value => { setBuildingName(value); setAddressReady(true); }}
            onSelectParts={({ name, address: addr, full }) => {
              setBuildingName(name || full);
              if (addr && !addressLine.trim()) setAddressLine(addr);
              setAddressReady(true);
            }}
            placeholder={W(lang, "e.g. Torre Bahía", "Ej.: Torre Bahía")} />
        </Field>

        <Field label={W(lang, "Address", "Dirección")}
          hint={W(lang,
            "Private. Only the neighbourhood is shown publicly — the exact address goes to the tenant once a contract exists.",
            "Privada. Públicamente solo se muestra el barrio — la dirección exacta se entrega al arrendatario cuando hay contrato.")}>
          <PlacesInput
            variant="address" countries={["co"]} bias={cityLabel}
            value={addressLine} onChange={value => { setAddressLine(value); setAddressReady(true); }}
            onSelectParts={({ full }) => { setAddressLine(full); setAddressReady(true); }}
            placeholder={W(lang, "Carrera 43A #7-50, El Poblado", "Carrera 43A #7-50, El Poblado")} />
        </Field>

        {/* ── MATRÍCULA INMOBILIARIA — COPIED FROM THE SALE FORM, WORD FOR WORD ─────────────
            Lee, 12 Aug 2026: *"These are twin forms… literally copy the code and make them
            identical when they have the same things."* This field was on the sale form only, and
            that asymmetry had a consequence beyond tidiness: the matrícula is the ONLY join key
            into IGAC's registry data, so a rental listing could never show the registered-sale
            half of its own history panel. A rented apartment has a folio exactly like a sold one.

            Optional, and explained in a sentence rather than named in jargon — his 11 Aug note
            ("no one's gonna know what that is") applies here identically. */}
        <Field label={W(lang, "Property registry number", "Matrícula inmobiliaria")} optional
          hint={W(lang,
            "The matrícula inmobiliaria — the property's permanent ID at the registry office. It's on the top of the certificado de tradición y libertad, and it looks like 001-1234567. Adding it is what lets this property carry its real sale history instead of starting from nothing.",
            "El número de matrícula inmobiliaria — la identidad permanente del inmueble en la Oficina de Registro. Está en la parte superior del certificado de tradición y libertad, y se ve así: 001-1234567. Agregarlo es lo que permite que este inmueble tenga su historial real de ventas en vez de empezar de cero.")}>
          <input className="input w-full" value={matricula} onChange={e => setMatricula(e.target.value)}
            inputMode="numeric" placeholder="001-1234567" />
        </Field>

        {/* Estrato used to be asked here as well. It moved up beside Building age on 12 Aug at
            Lee's request, and leaving this copy behind would have put the SAME control on the
            form twice, bound to the same state — two boxes that silently move together, which
            reads as a bug even though both are "right". Caught by auditing every `<Stepper>` in
            both forms after he confirmed the layout. */}
      </FormSection>
      </StepPanel>

      <StepPanel active={step === "place"}>
      {/* ── 3 · THE PLACE ──────────────────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "The place", "El inmueble")} icon={I.place} required invalid={bad("place")}>
        <Field label={W(lang, "Title", "Título")}>
          <input className="input w-full" value={title} maxLength={120}
            onChange={e => setTitle(e.target.value)}
            placeholder={W(lang, "Bright 2-bedroom in El Poblado", "Apartamento luminoso de 2 hab. en El Poblado")} />
        </Field>

        {/* Lee, 11 Aug 2026: *"the type of place should be in a drop down menu."* Overruling my own
            earlier note that chips teach the vocabulary — nine property types is past the length
            where a chip row is a menu and into where it is a wall. `GlassSelect` is the canon
            dropdown; a native <select> renders as a black OS wheel on a phone and is banned. */}
        <Field label={W(lang, "What kind of place is it?", "¿Qué tipo de inmueble es?")}>
          <GlassSelect<PropertyType>
            value={(propertyType ?? "apartment") as PropertyType}
            ariaLabel={W(lang, "Type of place", "Tipo de inmueble")}
            onChange={setPropertyType}
            options={propertyTypes(lang).map(o => ({ value: o.value, label: o.label }))} />
        </Field>

        {/* The description keeps the SAME assist window OneJob and OneEvent use — speak it, paste
            it, or let VAIA shape it. Lee: *"if we have a window for the description, that needs to
            be the same type of window that they see somewhere else."* */}
        <Field label={W(lang, "Description", "Descripción")}
          hint={W(lang, "Up to 2,000 characters. This is the caption people read in the feed.",
                        "Hasta 2.000 caracteres. Esto es lo que la gente lee en el feed.")}>
          <AiTextField
            kind="property" fieldLabel={W(lang, "Property description", "Descripción del inmueble")}
            subject={W(lang, "this place", "este inmueble")}
            format="text" rows={5} charLimit={2000} offerChooser
            title={title} category={W(lang, "long-term rental", "arriendo")}
            excludeFacts={["price", "deposit", "address", "availability dates"]}
            notesPlaceholder={W(lang,
              "E.g. two bedrooms, tenth floor, morning light, quiet street, five minutes' walk to Parque Lleras, building has a gym and 24-hour porter.",
              "Ej.: dos habitaciones, piso diez, luz de la mañana, calle tranquila, a cinco minutos del Parque Lleras, el edificio tiene gimnasio y portería 24 horas.")}
            value={description} onChange={setDescription}
            placeholder={W(lang,
              "Tell them what it is actually like to live there — the light, the noise, the walk to the shops.",
              "Cuénteles cómo es vivir allí de verdad — la luz, el ruido, la caminata a las tiendas.")} />
        </Field>

        <div className="rounded-[24px] border border-brand/20 bg-brand/[0.055] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)]">
          <p className="text-[14px] font-black">{W(lang, "Standard lease terms for this property", "Condiciones estándar para este inmueble")}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{W(lang,
            "These apply to every request. Change them here once; the tenant-review screen only shows them unless you choose a one-time edit.",
            "Se aplican a cada solicitud. Cámbielas aquí una vez; la pantalla de revisión solo las muestra, salvo que elija un cambio único.")}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
            <Field label={W(lang, "Notice before ending", "Aviso antes de terminar")}>
              <Stepper value={leaseNoticeDays} onChange={setLeaseNoticeDays} min={0} max={365} step={1} suffix={W(lang, "days", "días")} editable inputLabel={W(lang, "Lease notice days", "Días de aviso")} />
            </Field>
            <Field label={W(lang, "Payment window", "Plazo de pago")}>
              <Stepper value={paymentWindowDays} onChange={setPaymentWindowDays} min={1} max={30} step={1} suffix={W(lang, "business days", "días hábiles")} editable inputLabel={W(lang, "Payment window", "Plazo de pago")} />
            </Field>
          </div>
          <Field label={W(lang, "Breach penalty", "Sanción por incumplimiento")} hint={W(lang, "Expressed as months of rent.", "Expresada en meses de canon.")}>
            <Stepper value={breachPenaltyMonths} onChange={setBreachPenaltyMonths} min={0} max={12} step={0.5} suffix={W(lang, "months", "meses")} editable inputLabel={W(lang, "Penalty months", "Meses de sanción")} />
          </Field>
          <div className="my-4 border-t border-brand/15" />
          <Toggle on={ownerTermsEnabled} onChange={value => {
            setOwnerTermsEnabled(value);
            if (!value) setImportOpen(false);
          }} label={W(lang, "Include my own terms or contract? (optional)", "¿Incluir mis propias condiciones o contrato? (opcional)")} />
          <p className="mt-2 text-[12.5px] leading-relaxed opacity-65">{W(lang,
            "OneHome's standard rental agreement is already included. Leave this off unless you want to add a separate owner contract or extra terms.",
            "El contrato de arriendo estándar de OneHome ya está incluido. Déjelo desactivado salvo que quiera agregar otro contrato del propietario o condiciones adicionales.")}</p>
          {ownerTermsEnabled && <div className="mt-3 border-t border-brand/15 pt-3">
            <p className="text-[12px] font-bold">{W(lang, "Your supplemental terms", "Sus condiciones adicionales")}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{W(lang,
              "Upload, paste or link an existing document. You will review every suggestion before it becomes part of this property's agreement.",
              "Suba, pegue o enlace un documento existente. Revisará cada sugerencia antes de que forme parte del contrato de este inmueble.")}</p>
            <button type="button" className="btn-ghost mt-3 w-full border-brand/25 text-brand" onClick={() => setImportOpen(true)}>
              {W(lang, "Add or review my terms", "Agregar o revisar mis condiciones")}
            </button>
            {importNotice && <p className="mt-3 rounded-2xl bg-white/55 px-3 py-2 text-xs font-bold text-brand dark:bg-white/[0.06]">{importNotice}</p>}
            {importedDocKind && <p className="mt-2 text-[11.5px] opacity-60">{W(lang,
              `${Object.keys(importedTerms).length} approved owner term${Object.keys(importedTerms).length === 1 ? "" : "s"} will be added to the OneHome agreement.`,
              `${Object.keys(importedTerms).length} condición adicional${Object.keys(importedTerms).length === 1 ? "" : "es"} del propietario se agregará${Object.keys(importedTerms).length === 1 ? "" : "n"} al contrato de OneHome.`)}</p>}
          </div>}
          {!ownerTermsEnabled && importedDocKind && <p className="mt-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">{W(lang,
            "Your saved owner terms are kept, but they will not be included while this option is off.",
            "Sus condiciones guardadas se conservan, pero no se incluirán mientras esta opción esté desactivada.")}</p>}
        </div>

        {ownerTermsEnabled && importOpen && <ContractImport
          section="rentals"
          invoke={invokeImporter}
          onApply={applyImportedContract}
          onClose={() => setImportOpen(false)} />}

        {/* ── THE ROW THAT WAS A TRAIN WRECK ────────────────────────────────────────────────
            Lee, 11 Aug 2026: *"the bedroom, bathroom, square meters, that's all jumbled up. That
            entire section is jumbled up… it looks horrible. Like, it was a train wreck."*

            He is describing three separate faults that compounded:

            1. THREE STEPPERS ACROSS. A stepper is [−][value][+] — three boxes. Three of those in a
               grid-cols-3 on a 360px phone is NINE controls in 328px, about 30px each. They
               overlapped their labels and read as noise.
            2. MIXED CONTROL TYPES IN ONE ROW. "Size" was a typed box and its two neighbours were
               steppers, at different heights, so the row had no baseline.
            3. THE COUNTS WERE SCATTERED. Bedrooms and bathrooms were in "Rooms", size was here,
               parking was in "Inside", estrato was in "Where". The four numbers everybody filters
               by lived in four different panels.

            Fixed by the rule that a stepper is never narrower than half the screen: two per row,
            maximum, and the four counts are together where they belong. */}
        {/* ── THE SALE FORM'S LAYOUT WINS (Lee, 12 Aug 2026) ──────────────────────────────
            *"I do like the formatting of the attributes on the for-sale form, where you have how
            many bedrooms, bathrooms, the floors, the parking spaces. That design is better than
            the design that you chose to put onto the rental form. Again, they need to look
            identical — why do you have them look different?"*

            THIS REPLACES THE BORDERED CELLS I BUILT YESTERDAY, and it is worth being clear that
            it reverses his own earlier request rather than pretending the two notes agree. On 11
            Aug he drew rectangles round each label-and-stepper pair, asking for grouping; I built
            `CountField` and it did group them — at the cost of a border, a tint and 10px of
            padding per control, eight times over, which is what makes the rental form look
            heavier than its twin.

            The sale form gets the grouping for free and he spotted it: the label sits directly on
            top of ITS OWN stepper with nothing between them, and the rows line up because every
            label is one line. That is proximity doing the same job as a box, without the box.

            `Field` + `Stepper` in a `Row`, exactly as `onesale` has it. `CountField` stays in the
            shell — it is the right control for a form that genuinely needs the emphasis — it is
            just not this one. */}
        {/* GUESTS SITS ABOVE BEDROOMS, and it is worth saying why rather than leaving it to
            taste. A bedroom count does not answer the question a guest actually has. A two-bedroom
            with a sofa bed sleeps four; a four-bedroom with two singles in each sleeps eight. The
            person booking is counting people, not doors, and every competitor puts the people
            number first for that reason. Optional, because an existing listing has no answer and a
            guessed one is worse than a blank. */}
        {/* ── HOW BIG IS IT ─────────────────────────────────────────────────────────────
            Lee, 15 Aug 2026: *"you could bring the square meters up there and put the square
            meters to the left and the accommodation to the right, because those are both
            relevant. They're both how big is a place."*

            ⚠️ v93.2 · SUPERSEDED as a PAIRING RULE on 17 Aug 2026, and kept rather than deleted
            because it is the only record of why the order used to be what it was. Lee that day:
            *"they just need to line up and look symmetrical… it should be bedroom, bathroom, then
            the square metres and the age of the building, and then the floor, and then the total
            floors, then the parking space, air conditioners, then Estrato."*

            So the grouping is no longer by MEANING. It is Lee's stated order, two per row, with
            Estrato last so that a form with an odd number of fields leaves Estrato alone. Size
            sits beside Building age; Sleeps sits beside Estrato. See the U31 note below.

            ⚠️ WHAT SURVIVES FROM 15 AUG, AND STILL BINDS: every label in these rows fits on ONE
            line, so every stepper lands on the same horizontal. That was not a happy accident —
            "Sleeps how many" wrapping onto two lines is what pushed its stepper down a row and
            left Bathrooms stranded alone underneath, which is the defect Lee photographed. A new
            field here must keep its label to one line or the row breaks the same way again. */}
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
            <Stepper value={bedrooms} onChange={setBedrooms} min={0} max={12} />
          </Field>
          <Field label={W(lang, "Bathrooms", "Baños")}>
            <Stepper value={bathrooms} onChange={setBathrooms} min={0} max={12} step={0.5} />
          </Field>
        </Row>
        <Row>
          {/* ── ⚠️ SIZE IS A STEPPER NOW, AND IT MOVES IN TENS ────────────────────────────
              Lee, 15 Aug 2026: *"honestly, I think you can make the square meters a plus and
              minus, but you just do it by the tens instead of by the ones. So when they push
              plus it's 10, 20, 30, 40, 50, versus if you do all the rest of them there's like
              1, 2, 3, 4, 5. That way you can make the graphic the same as all the rest of them
              with the plus or minus graphic."*

              He is solving the exact defect the long comment above describes — a typed box beside
              a stepper gives the row no baseline — and he is solving it the right way round. The
              earlier fix regrouped the fields; this one makes the CONTROLS match, which is what
              was actually inconsistent.

              And the step size is the whole reason a stepper was wrong here before. Nobody types
              a flat as 86 square metres and means it precisely; they mean "about 85". Stepping by
              one would take forty taps to reach a normal apartment. Stepping by ten reaches it in
              nine, which is how people think about floor area anyway.

              `n(area)` on save is unchanged, so nothing downstream of the number cares that the
              control changed. */}
          <Field label={W(lang, "Size (m²)", "Tamaño (m²)")} optional>
            <Stepper
              value={area === "" ? null : Number(area)}
              onChange={v => setArea(v == null ? "" : String(v))}
              min={10} max={2000} step={1} coarse={10} suffix="m²" />
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
          <Field label={W(lang, "Parking spaces", "Parqueaderos")} optional>
            <Stepper value={parking} onChange={setParking} min={0} max={10} />
          </Field>
          <Field label={W(lang, "Air conditioners", "Aires acondicionados")} optional>
            <Stepper value={acUnits} onChange={setAcUnits} min={0} max={15} />
          </Field>
        </Row>
        <Row>
          <Field label={W(lang, "Sleeps", "Duermen")} optional>
            <Stepper value={maxGuests} onChange={setMaxGuests} min={1} max={30} />
          </Field>
          <Field label={W(lang, "Estrato", "Estrato")} optional
            hint={W(lang, "Colombia's utilities band, 1 to 6.", "La banda de servicios, de 1 a 6.")}>
            <Stepper value={estrato} onChange={setEstrato} min={1} max={6} />
          </Field>
        </Row>

        {/* v93.2 · Size lives in the attribute rows above, beside Building age — NOT here, and
            not beside Sleeps. It was paired with Sleeps from 15 to 17 Aug 2026; Lee's 17 Aug
            ordering moved it. The part of the 15 Aug note that still holds is the reason this
            marker exists at all: *"removed from here so there is only ever one box for it."*
            One box, one place. Do not reintroduce a second Size field on this screen. */}
        {/* Two attributes buyers and renters search by that no Colombian listing states. Toggles,
            per Lee: *"people don't want to put No, but if you make it a toggle they feel better
            about it."* Identical to the sale form. */}
        {/* ── v70 · THREE YES/NO ANSWERS ON ONE ROW, AND THE WHOLE CHIP IS THE TARGET ────────────
            Lee, 16 August 2026: *"see if you can get all three of those on the same row, and you
            could just touch them — the checkbox sometimes is just in the way."*

            `MultiChips` is the shell control this form already uses for amenities: fixed columns,
            a 44px minimum, and the entire chip is the button. Reusing it rather than writing a
            fourth control is the whole reason the twins stopped drifting.

            ⚠️ THE BOOLEANS ARE UNCHANGED. `penthouse`, `open_view` and `furnished` are three
            separate database columns and this does not touch what is saved — the chips are a view
            over them, mapped back on every change.

            ⚠️ The sales line that used to sit under Furnished is deleted. Lee: *"which is wrong
            in itself, but just take it away. Why? It doesn't matter."* A form field that argues
            with you about the answer is a form field that gets a worse answer. The exact wording
            is deliberately NOT quoted here — the post-check greps the file for it, and quoting it
            in a comment would make that check pass forever. That is the v63.1 mistake, and I have
            now walked into this family of it three times. */}
        <MultiChips
          cols={3}
          values={[
            ...(furnished ? ["furnished"] : []),
            ...(penthouse ? ["penthouse"] : []),
            ...(openView ? ["openView"] : []),
          ]}
          options={[
            { value: "furnished", label: W(lang, "Furnished", "Amoblado") },
            { value: "penthouse", label: W(lang, "Penthouse", "Penthouse") },
            { value: "openView", label: W(lang, "Unobstructed view", "Vista despejada") },
          ]}
          onChange={(v) => {
            setFurnished(v.includes("furnished"));
            setPenthouse(v.includes("penthouse"));
            setOpenView(v.includes("openView"));
          }} />
      </FormSection>

      {/* ── 4 · THE BEDROOM AND BATH ───────────────────────────────────────────────────────
          The counts moved up into "The place" with the rest of the numbers. What is left here is
          the stuff nobody else asks about, which is the entire reason Lee wanted these fields. */}
      <FormSection title={W(lang, "The bedroom & bath", "Alcoba y baño")} icon={I.rooms}
        hint={W(lang, "The things every other listing leaves you guessing about.",
                      "Lo que todos los demás anuncios te dejan adivinando.")}>
        {/* Lee, 11 Aug 2026: *"the bed and master, that should be a drop down option."* */}
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

        <Toggle on={walkInCloset} onChange={setWalkInCloset}
          label={W(lang, "Walk-in closet in the master", "Vestier en la habitación principal")} />
        <Toggle on={dualVanities} onChange={setDualVanities}
          label={W(lang, "Two sinks in the main bathroom", "Doble lavamanos en el baño principal")} />
        {/* ── UNGATED (Lee, 11 Aug 2026) ───────────────────────────────────────────────────
            *"I could have sworn there was an air conditioner button in the master… I thought you
            had three options — walk-in closet, two sinks, and air conditioner. This must not have
            updated."*

            It did update. It was here, and it was hidden behind `(acUnits ?? 0) > 0`. The
            reasoning was that the question only makes sense once there IS air conditioning, and
            that is true — but Air conditioners is OPTIONAL, so anyone who skipped it (Lee did)
            watched a third option he had seen before simply not exist. A form that silently
            changes shape based on a field you chose not to answer reads as broken, and the person
            has no way to discover the rule.

            It is always shown now. Ticking it is itself the statement that there is air
            conditioning; the count is a separate, finer fact. */}
        <Toggle on={acInMaster} onChange={setAcInMaster}
          label={W(lang, "Air conditioning in the master bedroom", "Aire acondicionado en la habitación principal")}
          note={W(lang, "The one that matters at 3am.", "El que importa a las 3 de la mañana.")} />
      </FormSection>

      {/* ── 5 · INSIDE ─────────────────────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "Inside", "Interior")} icon={I.inside}>
        {/* Lee, 11 Aug 2026: *"The washer and dryer option… should be a drop down menu and the
            none. So it's, like, four options."* Exactly four, and `none` is one of them — a blank
            laundry field is "the agent didn't answer", which is a different fact from "there is
            no laundry" and the one people actually need. */}
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

      {/* ── 6 · OUTSIDE AND THE BUILDING ───────────────────────────────────────────────── */}
      <FormSection title={W(lang, "Outside & the building", "Exterior y el edificio")} icon={I.outside}>
        {/* Lee, 11 Aug 2026: *"you don't do the same thing when it comes to the outside of the
            building. You got four options, and then you have the building has these optional
            things, but you don't put the same level of the same design. I don't know why you
            changed the design up there. Keep the same consistent design."*

            He is right and the reason is boring: these four were four `Toggle` rows in a 2×2, and
            a Toggle is a full-width row control — a label on the left and a switch on the right.
            Two of them side by side gives four different label lengths against four switches at
            four different x-positions, which is exactly the ragged look he is pointing at, while
            Safety/Pets right below uses chips and lines up perfectly.

            So these are chips now, the same `MultiChips` as the building amenities directly under
            them. Same control, same shape, same section — one design, as asked. */}
        <Field label={W(lang, "Outside this place", "Exterior de este inmueble")} optional>
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
          <MultiChips values={amenityKeys} onChange={setAmenityKeys} options={amenities(lang)} cols={2} />
        </Field>
      </FormSection>

      {/* ── 7 · SAFETY, PETS, SCHOOLS ──────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "Safety, pets & schools", "Seguridad, mascotas y colegios")} icon={I.safety}>
        <Field label={W(lang, "Security", "Seguridad")}>
          <ChoiceChips value={security} onChange={setSecurity} options={securityLevels(lang)} allowClear />
        </Field>
        <Field label={W(lang, "Pets", "Mascotas")}>
          <ChoiceChips value={pets} onChange={setPets} options={petsOptions(lang)} allowClear />
        </Field>
        <Toggle on={schoolsNearby} onChange={setSchoolsNearby}
          label={W(lang, "Schools nearby", "Colegios cerca")}
          note={W(lang, "Families search on this before anything else.",
                        "Las familias buscan esto antes que nada.")} />
        {schoolsNearby && (
          <Field label={W(lang, "Which ones", "Cuáles")} optional>
            <input className="input w-full" value={schoolZone} maxLength={160}
              onChange={e => setSchoolZone(e.target.value)}
              placeholder={W(lang, "e.g. Columbus School, 10 minutes", "Ej.: Colegio Columbus, 10 minutos")} />
          </Field>
        )}
      </FormSection>


      </StepPanel>
      <StepPanel active={step === "price"}>
      {/* ── 8 · PRICE ──────────────────────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "Price", "Precio")} icon={I.price} required invalid={bad("price")}>
        <Field label={W(lang, "Listing currency", "Moneda del anuncio")}>
          <SegTabs<ListingCurrency>
            value={currency} onChange={setCurrency}
            options={[
              { value: "USD", label: "USD · US dollars" },
              { value: "COP", label: "COP · Pesos colombianos" },
            ]} />
        </Field>
        <SegTabs<PriceUnit>
          value={priceUnit} onChange={setPriceUnit}
          options={[
            { value: "month", label: W(lang, "Per month", "Por mes") },
            { value: "night", label: W(lang, "Per night", "Por noche") },
          ]} />
        <Field label={W(lang, `Rent (${currency})`, `Canon (${currency})`)}>
          {/* ── ⚠️ THE NUMBER GROUPS ITSELF AS IT IS TYPED ────────────────────────────────
              Lee, 15 Aug 2026: *"the currency needs to be done when people are typing in a
              number."* A rent typed as `1900` and a rent typed as `19000` look almost identical
              in a plain box, and the mistake is a factor of ten on the most important field in
              the form. Grouped digits make the difference impossible to miss at a glance.

              ── WHAT IS DELIBERATELY NOT DONE HERE ────────────────────────────────────────
              No currency symbol is injected into the field. The unit is already stated by the
              tabs above and by the "USD" label, and a symbol inside the box is the classic way to
              end up with "$$1,900" the moment somebody pastes a formatted number in.

              The STATE stays a clean numeric string. Only the DISPLAY is grouped, and the caret
              is left alone: reformatting mid-word and then restoring the caret is a well-known
              source of the cursor jumping to the end on Android, so grouping is applied on every
              keystroke to the value only and the field stays uncontrolled about position. */}
          <MoneyInput value={price} onChange={setPrice} currency={currency}
            placeholder={currency === "COP" ? "8.600.000" : (priceUnit === "month" ? "1,900" : "85")} />
        </Field>

        {/* ── THE RATE IS NOT A FIELD ────────────────────────────────────────────────────────
            It used to be a text box defaulting to 4,000. The real TRM is around 3,125, so every
            listing that took the default overstated its peso price by roughly 28% — a five-million
            peso rent advertised as six and a half. This states the number, states whose number it
            is, and states the day, and gives the agent nothing to type. */}
        {(
          <div className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
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
                    `TRM certified by the Superintendencia Financiera, in force ${trm.from}. Saved with the listing so the price you set today still reads honestly in six months.`,
                    `TRM certificada por la Superintendencia Financiera, vigente desde ${trm.from}. Se guarda con el anuncio para que el precio que fije hoy siga siendo honesto en seis meses.`)}
                </p>
                {rent > 0 && (
                  <p className="mt-1.5 text-[13px] font-black">
                    ≈ {listingMoney(convertedAmount(rent, currency, trm.rate), oppositeCurrency)}{" "}
                    <span className="text-[11px] font-semibold opacity-55">
                      / {priceUnit === "month" ? W(lang, "month", "mes") : W(lang, "night", "noche")}
                    </span>
                  </p>
                )}
              </>
            ) : (
              /* No guessed fallback, ever. Dollars alone is honest; an invented rate is not. */
              <p className="text-[12px] leading-relaxed font-semibold text-amber-600 dark:text-amber-400">
                {W(lang,
                  `We couldn't reach the official rate just now. The listing will stay in ${currency}; no conversion will be guessed.`,
                  `No pudimos obtener la tasa oficial en este momento. El anuncio quedará en ${currency}; no se inventará ninguna conversión.`)}
              </p>
            )}
          </div>
        )}

        {listingFee.pending ? <p role="status">{W(lang, "Checking listing fees…", "Consultando comisiones…")}</p> : listingFee.error ? <button className="btn-ghost" onClick={listingFee.retry}>{W(lang, "Fees unavailable. Try again", "Comisiones no disponibles. Reintentar")}</button> : <NetToYou listingWaived={listingFee.waived} lang={lang} es={es} rent={rent} money={money}
          hostPaysGuestFee={hostPaysGuestFee} onHostPaysGuestFeeChange={setHostPaysGuestFee}
          priceUnit={priceUnit} currency={currency} fx={fxRate} />}
      </FormSection>

      {/* ── 9 · HOW THE LETTING IS SECURED ─────────────────────────────────────────────────
          This section used to be titled "Security deposit" and offered exactly one instrument.
          Lee, 11 Aug: *"it's really a security deposit. It's not earnest money or a down payment
          in a rental."* — still true, and the word "deposit" below is still the rental word, not
          the sale one. What changed is that a deposit is now one of three answers rather than the
          only one, because on a Colombian home lease it is the answer the law says least about
          approvingly.

          Lee, 15 Aug 2026: *"maybe you can request a deposit, but it's just not facilitated
          through the application… we can make a disclosure to tell them that security deposits
          for stays over thirty days is illegal."* That is exactly what this is:

            1. The host may state a deposit. We do not stop them.
            2. OneHome never collects it, never holds it, never returns it, and earns nothing on
               it. `deposit_held_by` is `landlord` and the fee call no longer counts it.
            3. The law is disclosed TWICE — to the host here, as a blocking acknowledgement, and
               to the tenant on the listing and in the contract.

          The three options and the 30-day rule come from shell/lib/guarantee.ts, which has held
          this decision since 13 August without a single screen reading it. */}
      <FormSection title={W(lang, "How the letting is secured", "Cómo se garantiza el arriendo")}
        icon={I.deposit} invalid={bad("deposit")}>

        <p className="text-[12px] leading-relaxed opacity-70">
          {stayWindow === "short"
            ? W(lang,
                "Stays under 30 nights are lodging, not a home lease, so a card hold is the right instrument and the only one offered here.",
                "Las estadías de menos de 30 noches son hospedaje, no arriendo de vivienda, así que la retención en tarjeta es el instrumento correcto y el único que se ofrece aquí.")
            : stayWindow === "long"
            ? W(lang,
                "This is a home lease, so Ley 820 de 2003 applies. Choose one.",
                "Esto es un arriendo de vivienda, así que aplica la Ley 820 de 2003. Elija una.")
            : W(lang,
                "This listing can take both short stays and long ones, so all three are offered — the card hold covers stays under 30 nights and your other choice covers the longer ones.",
                "Este anuncio acepta estadías cortas y largas, así que se ofrecen las tres — la retención cubre estadías de menos de 30 noches y su otra elección cubre las más largas.")}
        </p>

        {/* One card per option, each carrying its own consequence sentence. A radio list with
            three bare labels asks the host to already know what they mean. */}
        <div className="mt-2 space-y-2">
          {allowedGuarantees.map(k => {
            const copy = GUARANTEE_COPY[k];
            const on = guarantee === k;
            return (
              <button key={k} type="button" onClick={() => setGuaranteeKind(k)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  on ? "border-brand bg-brand/[0.07]" : "border-ink/12 hover:border-ink/25 dark:border-white/15 dark:hover:border-white/30"}`}>
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                    on ? "border-brand bg-brand" : "border-ink/25 dark:border-white/30"}`} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-black">{es ? copy.title.es : copy.title.en}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-75">
                      {es ? copy.blurb.es : copy.blurb.en}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">
                      {es ? copy.effect.es : copy.effect.en}
                    </p>
                    {k === "insurance" && rent > 0 && (
                      <p className="mt-1.5 text-[12px] font-bold">
                        {usd2(coverFee(rent, DAMAGE_COVER))}
                        <span className="opacity-60">
                          {" "}/ {priceUnit === "night"
                            ? W(lang, "stay", "estadía")
                            : W(lang, "month", "mes")}
                          {" · "}{coverLimits(lang, DAMAGE_COVER, usd2)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── THE DEPOSIT BRANCH ────────────────────────────────────────────────────────────
            Everything the old section had, minus the two claims that were the exposure:
            "the contract does not start until the deposit is in" (which is us conditioning a
            contract on money we never see) and "Held by the OneHome vault". */}
        {depositChosen && (
          <div className="mt-3 space-y-3 border-t border-ink/[0.08] pt-3 dark:border-white/[0.10]">
            <SegTabs<"months" | "amount">
              value={depositBasis} onChange={setDepositBasis}
              options={[
                { value: "months", label: W(lang, "Months of rent", "Meses de canon") },
                { value: "amount", label: W(lang, "A set amount", "Un monto fijo") },
              ]} />

            {depositBasis === "months" ? (
              <Field label={W(lang, "How many months", "Cuántos meses")}
                hint={rent > 0
                  ? W(lang, `That is ${listingMoney(depositValue, currency)} at today's rent — and it follows the rent if you change it.`,
                            `Son ${listingMoney(depositValue, currency)} con el canon actual — y sigue al canon si lo cambia.`)
                  : W(lang, "Set the rent above and this turns into a number.",
                            "Defina el canon arriba y esto se convierte en un número.")}>
                <Stepper value={depositMonths} onChange={setDepositMonths} min={0.5} max={6} step={0.5} />
              </Field>
            ) : (
              <div className="space-y-3">
                <Field label={W(lang, "Deposit currency", "Moneda del depósito")}>
                  <SegTabs<ListingCurrency>
                    value={depositCurrency} onChange={setDepositCurrency}
                    options={[
                      { value: "USD", label: "USD" },
                      { value: "COP", label: "COP" },
                    ]} />
                </Field>
                <Field label={W(lang, `Deposit (${depositCurrency})`, `Depósito (${depositCurrency})`)}>
                  <MoneyInput value={deposit} onChange={setDeposit} currency={depositCurrency}
                    placeholder={depositCurrency === "COP" ? "3.000.000" : "950"} />
                </Field>
                {depositValue > 0 && fxRate > 0 && (
                  <p className="-mt-1 text-right text-[12px] font-semibold opacity-60">
                    ≈ {listingMoney(
                      convertedAmount(depositValue, depositCurrency, fxRate),
                      depositCurrency === "USD" ? "COP" : "USD",
                    )}
                  </p>
                )}
              </div>
            )}

            {/* ⚠️ DISCLOSURE ONE OF TWO. The second is on the listing and in the contract.
                This panel used to say "Held by the OneHome vault. Not by you, and not by the
                tenant. Neither side can spend it." Two things were wrong with it and the second
                is the serious one:
                1. It advertised a clause Colombian law voids — Ley 820 de 2003, Art. 16 forbids
                   requiring a cash deposit on a residential lease, so the clause is ineffective
                   by operation of law and the tenant can demand the money back at any time.
                2. It claimed OneHome holds the money. Money that SITS with a platform rather than
                   PASSES THROUGH it is the shape Colombia's financial regulator looks at, and
                   "vault" and "held by" claim a custody role we hold no licence for. That is the
                   same class of unearned word as the "escrow" removed from OneJob on 26 July. */}
            <button type="button" onClick={() => setDepositLawOpen(true)} aria-haspopup="dialog"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-3 text-left">
              <span className="text-[12.5px] font-bold">
                {W(lang, "Important information about Colombian deposit law",
                         "Información importante sobre la ley colombiana de depósitos")}
              </span>
              <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-[13px] font-black">i</span>
            </button>

            {ackNeeded && (
              /* Lee, 13 Aug: *"All you gotta do is just — they just have to acknowledge what it
                 is. It's illegal. If they click the box and they still do it, that's up to them.
                 I would take away 'I'm gonna do it anyway'."* So the sentence acknowledges. It
                 does not confess, and it does not editorialise. Verbatim from guarantee.ts, and
                 the same sentence is stored with the listing and reproduced in the tenant's
                 terms — three copies of one sentence, from one constant. */
              <Toggle on={depositAck} onChange={setDepositAck}
                label={es ? DEPOSIT_ACK.es : DEPOSIT_ACK.en} />
            )}

            <Field label={W(lang, "Returned within", "Se devuelve en")}
              hint={W(lang,
                "Days after the agreed move-out. You return it, not us. Saying it up front is what stops the argument at the end.",
                "Días después de la entrega acordada. Usted lo devuelve, no nosotros. Decirlo desde el principio es lo que evita la discusión al final.")}>
              <Stepper value={depositReturnDays} onChange={setDepositReturnDays} min={0} max={90} step={1}
                suffix={W(lang, "days", "días")} editable
                inputLabel={W(lang, "Days to return the deposit", "Días para devolver el depósito")} />
            </Field>

            {depositLawOpen && (
              <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/45 p-4"
                onMouseDown={(event) => { if (event.target === event.currentTarget) setDepositLawOpen(false); }}>
                <div role="dialog" aria-modal="true" aria-labelledby="onehome-deposit-law-title"
                  className="max-h-[min(78vh,620px)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/35 bg-white/95 p-5 text-ink shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#132d32]/95 dark:text-white">
                  <div className="flex items-start justify-between gap-4">
                    <h3 id="onehome-deposit-law-title" className="text-[17px] font-black leading-tight">
                      {W(lang, "Colombian law does not allow this on a home rental",
                               "La ley colombiana no permite esto en un arriendo de vivienda")}
                    </h3>
                    <button type="button" onClick={() => setDepositLawOpen(false)} aria-label={W(lang, "Close", "Cerrar")}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/15 text-xl dark:border-white/20">×</button>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed opacity-80">
                    {W(lang,
                      "Ley 820 de 2003 (Article 16) says a landlord may not require a cash deposit on a residential lease of 30 days or more. A tenant can ask for it back at any time and the clause has no force. OneHome does not collect it, hold it, or return it, and takes no fee on it — it is paid to you directly and it is between you and the tenant. The tenant is told all of this on your listing.",
                      "La Ley 820 de 2003 (artículo 16) prohíbe exigir un depósito en dinero en un arriendo de vivienda de 30 días o más. El arrendatario puede pedirlo de vuelta en cualquier momento y la cláusula no tiene efecto. OneHome no lo recibe, no lo custodia y no lo devuelve, y no cobra comisión sobre él — se le paga a usted directamente y es un asunto entre usted y el arrendatario. Todo esto se le informa al arrendatario en su anuncio.")}
                  </p>
                  <button type="button" onClick={() => setDepositLawOpen(false)} className="mt-5 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white">
                    {W(lang, "I understand", "Entiendo")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── THE DAMAGE COVER BRANCH ───────────────────────────────────────────────────── */}
        {coverChosen && (
          <div className="mt-3 space-y-2 border-t border-ink/[0.08] pt-3 dark:border-white/[0.10]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-bold">
                {W(lang, "The tenant pays", "El arrendatario paga")}
              </span>
              <span className={`text-[15px] font-black ${COVER_LIVE ? "" : "line-through opacity-45"}`}>
                {listingMoney(damageFee, currency)}
              </span>
            </div>
            <p className="text-[11.5px] leading-relaxed opacity-70">
              {coverLimits(lang, DAMAGE_COVER, usd2)}{" "}
              {es ? DAMAGE_COVER.excludes.es : DAMAGE_COVER.excludes.en}
            </p>
            {cycles > 1 && (
              <p className="text-[11.5px] opacity-60">
                {W(lang, `${listingMoney(damageTerm, currency)} over a 12-month term.`,
                         `${listingMoney(damageTerm, currency)} en un contrato de 12 meses.`)}
              </p>
            )}
            {!COVER_LIVE && (
              <p className="rounded-xl border border-ink/12 bg-ink/[0.03] p-2.5 text-[11.5px] leading-relaxed opacity-75 dark:border-white/15 dark:bg-white/[0.04]">
                {es ? PENDING_NOTE.es : PENDING_NOTE.en}
              </p>
            )}
          </div>
        )}

        {/* ── LIABILITY — THE HOST'S OWN POLICY, DECLARED. NOT SOMETHING WE SELL ──────────
            Lee, 15 Aug 2026: *"the homeowner who's posting their property must have liability
            coverage for their house… we just need to make sure that homeowner has checked the
            box."* Correct, and the previous build had it backwards — it charged the host 1.49
            percent for a cover OneHome would carry, which no marketplace can actually buy.

            Airbnb is the proof: no real liability policy until January 2015, six years in, and
            even that one pays only AFTER the host's own homeowner policy. Liability belongs to
            whoever owns the building.

            NOTHING HERE BLOCKS PUBLISHING. A host without cover still lists; they get the
            referral instead of the badge. Making it a gate would push hosts to tick it falsely,
            which is worse than not asking. */}
        <div className="mt-3 border-t border-ink/[0.08] pt-3 dark:border-white/[0.10]">
          <p className="text-[12.5px] font-black">
            {es ? LIABILITY_COPY.title.es : LIABILITY_COPY.title.en}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-70">
            {es ? LIABILITY_COPY.what.es : LIABILITY_COPY.what.en}
          </p>

          <div className="mt-2">
            <Toggle on={liabilityAttested} onChange={setLiabilityAttested}
              label={es ? LIABILITY_COPY.attest.es : LIABILITY_COPY.attest.en} />
          </div>

          {liabilityAttested ? (
            <div className="mt-2 space-y-2 pl-1">
              <Row>
                <Field label={W(lang, "Insurer", "Aseguradora")}>
                  <input className="input w-full" value={liabilityInsurer}
                    onChange={e => setLiabilityInsurer(e.target.value)}
                    placeholder={W(lang, "Who wrote the policy", "Quién expidió la póliza")} />
                </Field>
                <Field label={W(lang, "Cover amount (USD)", "Monto asegurado (USD)")}
                  hint={W(lang, `Most hosts carry at least ${usd(LIABILITY_SUGGESTED_USD)}.`,
                                `La mayoría lleva al menos ${usd(LIABILITY_SUGGESTED_USD)}.`)}>
                  <MoneyInput value={liabilityAmount} onChange={setLiabilityAmount} placeholder="50000" />
                </Field>
              </Row>
              {/* ⚠️ THE HOST IS TOLD, IN ADVANCE, EXACTLY HOW THIS APPEARS TO A TENANT. A host
                  who believes OneHome vouched for their policy will say so to a guest, and then
                  we are the ones who appeared to vouch. */}
              <p className="rounded-xl border border-ink/12 bg-ink/[0.03] p-2.5 text-[11.5px] leading-relaxed opacity-75 dark:border-white/15 dark:bg-white/[0.04]">
                {W(lang,
                  "Your listing will say you told us this, and that OneHome has not checked the policy. We will never call it verified, because we have not seen it.",
                  "Su anuncio dirá que usted nos lo informó y que OneHome no ha verificado la póliza. Nunca diremos que está verificada, porque no la hemos visto.")}
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2 pl-1">
              <p className="text-[11.5px] leading-relaxed opacity-70">
                {es ? LIABILITY_COPY.referral.es : LIABILITY_COPY.referral.en}
              </p>
              <Toggle on={liabilityReferral} onChange={setLiabilityReferral}
                label={W(lang, "Yes, introduce me to an insurer",
                               "Sí, preséntenme una aseguradora")} />
            </div>
          )}
        </div>

      </FormSection>
      </StepPanel>
      <StepPanel active={step === "when"}>
      <div id="onehome-walkthrough" className="scroll-mt-24">
        <FormSection title={W(lang, "Private move-in walkthrough", "Acta privada de ingreso")} icon={I.photos}>
          <WalkthroughDraftUploader
            propertyId={propertyId}
            userId={userId}
            lang={lang}
            savingDraft={busy}
            onCreateDraft={() => save(false, true)}
          />
        </FormSection>
      </div>

      {/* ── 10 · WHEN, AND WHO SEES IT ─────────────────────────────────────────────────── */}
      <FormSection title={W(lang, "Availability", "Disponibilidad")} icon={I.when}>
        {/* ── THE BLACK CALENDAR ─────────────────────────────────────────────────────────────
            Lee, 11 Aug 2026: *"You see a black calendar in one of these pictures, and that's an old
            school calendar, and that's not the calendar we use. Remember to look at the OneJob app.
            It has all these standards already in place."*

            He is right, and the rule predates this screen by a month. `Pickers.tsx`, 11 Jul: *"the
            native OS dialogs are black/archaic and ignore our brand."* `<input type="date">` is
            that dialog. `GlassDate` is now in the shell so nobody has to remember.

            `min=""` unlocks the past: a place can already have been available since last month,
            and the picker's default today-floor is a OneJob rule about jobs, not a universal one.

            And the row: *"the availability where it's available from and how many days… next to
            it, you got the minimum stays, and that's not formatted properly."* A date button and a
            typed number are different heights and different shapes; stacking them gives each its
            full width and a straight left edge. */}
        <Field label={W(lang, "Available from", "Disponible desde")}>
          <GlassDate value={availableFrom} onChange={setAvailableFrom} min="" />
        </Field>
        <Field label={W(lang, "Minimum stay", "Estadía mínima")} optional
          hint={W(lang,
            "The shortest booking you'll take. Leave it empty for no minimum.",
            "La reserva más corta que aceptará. Déjelo vacío si no hay mínimo.")}>
          <Stepper value={minTerm} onChange={setMinTerm} min={1} max={730} step={1}
            suffix={W(lang, "days", "días")} />
        </Field>

        <Toggle on={isPublic} onChange={setIsPublic}
          label={W(lang, "Show it publicly", "Mostrarlo públicamente")}
          note={W(lang, "Off means only people you send the link to can open it.",
                        "Desactivado significa que solo quienes reciban el enlace pueden verlo.")} />

        {/* 7 Sep 2026 (media lane): the feed switch, separate from being public. A host letting
            a place quietly — or one with a tenant lined up — can keep the listing open by link
            and on their profile without it scrolling past every stranger in Discover. Drawn
            only while the listing is public: a private listing is out of the feed already. */}
        {isPublic && (
          <Toggle on={feedVisible} onChange={setFeedVisible}
            label={W(lang, "Show it in the Discover feed", "Mostrarlo en el feed de Descubrir")}
            note={W(lang, "Off keeps it public — the link and your profile still open it — but it stays out of the feed.",
                          "Desactivado sigue siendo público — el enlace y su perfil lo abren — pero no aparece en el feed.")} />
        )}

        {/* Lee: *"the user can enable through a toggle switch for the property to be shared by
            other people or not."* Separate from being public: a listing can be visible to
            everyone and still not be something a stranger may re-post. */}
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
          Lee: *"as long as the host designates the blocks in the calendar where the user can book
          times automatically, then they can just automatically book them."*

          Its own section rather than a line inside Availability, because the two answer different
          questions: Availability is when the PLACE is free to live in, this is when the PERSON is
          free to show it. A host reading "available from 1 September" and "Saturdays 9–12" in one
          box has to work out which one the tenant is booking.

          ⚠️ The weekly blocks need a row to hang off, so on a brand-new listing the editor shows
          the days greyed with a line saying they save on publish. Rather than block the section
          behind "save first" — which is how a host never finds it at all — the three settings
          above the blocks are live from the first keystroke and travel with the insert. */}
      <FormSection title={W(lang, "Viewings", "Visitas")} icon={I.when}>
        <ShowingWindows
          propertyId={propertyId}
          enabled={showingsEnabled} onEnabledChange={setShowingsEnabled}
          notice={showingNotice} onNoticeChange={setShowingNotice}
          slotMinutes={showingSlot} onSlotChange={setShowingSlot}
          lang={lang} onCreateDraft={() => save(false, true)} />
      </FormSection>

      <ReservationNotificationSettings lang={lang} />
      </StepPanel>

      <StepPanel active={step === "review"}>
        <ListingSummary lang={lang} es={es} onEdit={setStep} rows={[
          { step: "where", value: [neighbourhood.trim() || null, cityLabel || null, buildingName.trim() || null,
                                     addressLine.trim() ? W(lang, "private address on file", "dirección privada guardada") : null], missing: false },
          { step: "media", value: [photos.length ? W(lang, `${photos.length} photo${photos.length === 1 ? "" : "s"}`, `${photos.length} foto${photos.length === 1 ? "" : "s"}`) : null,
                                     videos.length ? W(lang, `${videos.length} video${videos.length === 1 ? "" : "s"}`, `${videos.length} video${videos.length === 1 ? "" : "s"}`) : null], missing: photos.length === 0 },
          { step: "place", value: [title.trim() || null, propertyType ? labelFor(propertyTypes(lang), propertyType) : null,
                                     bedrooms != null ? `${bedrooms} ${W(lang, "bd", "hab")}` : null,
                                     bathrooms != null ? `${bathrooms} ${W(lang, "ba", "baños")}` : null,
                                     n(area) != null ? `${n(area)} m²` : null], missing: title.trim().length < 3 },
          { step: "price", value: [rent > 0 ? `${fmtMoney(rent, currency, { cents: false })} / ${priceUnit === "month" ? W(lang, "month", "mes") : W(lang, "night", "noche")}` : null,
                                     guarantee ? GUARANTEE_COPY[guarantee].title[es ? "es" : "en"] : null],
                                     missing: blockers.some(blocker => blocker.sec === "price" || blocker.sec === "deposit") },
          { step: "when", value: [availableFrom ? W(lang, `from ${availableFrom}`, `desde ${availableFrom}`) : W(lang, "available now", "disponible ya"),
                                    minTerm ? W(lang, `min ${minTerm} days`, `mín. ${minTerm} días`) : null,
                                    showingsEnabled ? W(lang, "viewings bookable", "visitas reservables") : W(lang, "no self-booked viewings", "sin visitas autoreservadas")], missing: false },
        ]} />
      </StepPanel>

      {err && <p className="mt-3 text-center text-[12.5px] font-semibold text-red-500">{err}</p>}

      <FormActions
        hint={step === "review" || tried ? blocking : null}
        invalid={tried && blockers.length > 0}
        cancel={stepIndex > 0
          ? { label: W(lang, "Back", "Atrás"), onClick: () => setStep(STEPS[stepIndex - 1]) }
          : {
              label: W(lang, "Cancel", "Cancelar"),
              onClick: () => {
                const typed = !!(String(title).trim() || String(description).trim() || String(rent).trim() || photos.length);
                if (typed && !window.confirm(W(lang,
                  "Leave without saving? Anything you have typed here will be lost.",
                  "¿Salir sin guardar? Se perderá lo que haya escrito aquí."))) return;
                if (onClose) onClose(); else nav(productHref("onerental", "/list"));
              },
            }}
        draft={{ label: W(lang, "Save draft", "Guardar borrador"), onClick: () => save(false) }}
        /* NOT disabled. A disabled Publish cannot explain itself; a live one that paints the
           missing sections red and scrolls you to the first can. */
        primary={step !== "review"
          ? { label: W(lang, `Next: ${STEP_TITLES[STEPS[stepIndex + 1]][0]}`, `Siguiente: ${STEP_TITLES[STEPS[stepIndex + 1]][1]}`), onClick: () => setStep(STEPS[stepIndex + 1]), busy }
          : { label: W(lang, "Preview", "Vista previa"), onClick: () => attempt(() => setPreviewOpen(true)), busy }} />
    </div>
  );
}

function StepHeader({ lang, step, onStep }: { lang: string; step: StepKey; onStep: (next: StepKey) => void }) {
  const es = lang === "es" || lang === "co";
  const index = STEPS.indexOf(step);
  return (
    <nav aria-label={W(lang, "Listing steps", "Pasos del anuncio")} className="mt-3" data-step={step}>
      <p className="text-[14px] leading-snug">
        <span className="font-black">{W(lang, `Step ${index + 1} of ${STEPS.length}`, `Paso ${index + 1} de ${STEPS.length}`)}</span>
        <span className="font-semibold opacity-50">{" · "}{STEP_TITLES[step][es ? 1 : 0]}</span>
      </p>
      <ol className="mt-2 flex gap-1.5" role="list">
        {STEPS.map((item, itemIndex) => (
          <li key={item} className="min-w-0 flex-1">
            <button type="button" onClick={() => onStep(item)} aria-current={item === step ? "step" : undefined}
              aria-label={STEP_TITLES[item][es ? 1 : 0]}
              className={`block h-1.5 w-full rounded-full ${itemIndex <= index ? "bg-ink/70 dark:bg-white/70" : "bg-ink/15 dark:bg-white/15"}`} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ListingSummary({ lang, es, rows, onEdit }: {
  lang: string;
  es: boolean;
  rows: { step: StepKey; value: (string | null)[]; missing: boolean }[];
  onEdit: (step: StepKey) => void;
}) {
  return (
    <section id="listing-summary" className="mt-3 space-y-2" aria-label={W(lang, "Listing summary", "Resumen del anuncio")}>
      <p className="text-[12.5px] leading-relaxed opacity-60">
        {W(lang, "Check the facts, then preview it the way the public will see it.", "Revise los datos y luego véalo como lo verá el público.")}
      </p>
      {rows.map(row => {
        const text = row.value.filter(Boolean).join(" · ");
        return (
          <div key={row.step} className={`card flex items-start justify-between gap-3 p-3.5 ${row.missing ? "border border-red-400/50" : ""}`}
            data-summary-step={row.step} data-missing={row.missing ? "true" : "false"}>
            <div className="min-w-0">
              <p className="text-[12px] font-black">{STEP_TITLES[row.step][es ? 1 : 0]}</p>
              <p className={`mt-0.5 text-[12.5px] leading-snug ${text ? "" : "opacity-50"}`}>{text || W(lang, "Nothing yet", "Aún nada")}</p>
              {row.missing && <p className="mt-0.5 text-[11.5px] font-semibold text-red-500">{W(lang, "Something required is missing", "Falta algo obligatorio")}</p>}
            </div>
            <button type="button" className="btn-ghost shrink-0 px-3 py-1.5 text-[12.5px]" onClick={() => onEdit(row.step)}
              aria-label={W(lang, `Edit ${STEP_TITLES[row.step][0]}`, `Editar ${STEP_TITLES[row.step][1]}`)}>
              {W(lang, "Edit", "Editar")}
            </button>
          </div>
        );
      })}
    </section>
  );
}

/* ── THE BOX THAT DOES THE SELLING ─────────────────────────────────────────────────────────
   Rent in, net out, and the Airbnb comparison on the same lease. Everything here is computed
   from the side-specific OneHome constants — there is no OneHome percentage literal here. */
function NetToYou({ lang, es, rent, money, priceUnit, currency, fx,
  hostPaysGuestFee, onHostPaysGuestFeeChange, listingWaived = false }: {
  listingWaived?: boolean;
  lang: string; es: boolean; rent: number; priceUnit: PriceUnit;
  currency: ListingCurrency; fx: number;
  hostPaysGuestFee: boolean; onHostPaysGuestFeeChange: (value: boolean) => void;
  money: { fee: number; tenantFee: number; tenantTotal: number; net: number;
           cycles: number; ourTotal: number; airbnbTotal: number;
           liabilityFee: number; liabilityTerm: number };
}) {
  const per = priceUnit === "month" ? (es ? "mes" : "month") : (es ? "noche" : "night");
  const saved = Math.round((money.airbnbTotal - money.ourTotal) * 100) / 100;
  const otherCurrency: ListingCurrency = currency === "USD" ? "COP" : "USD";
  const native = (value: number) => listingMoney(value, currency);
  const converted = (value: number) => listingMoney(convertedAmount(value, currency, fx), otherCurrency);
  return (
    <div className="mt-3 rounded-2xl border border-brand/25 bg-brand/[0.06] p-4">
      <p className="text-[11px] font-black uppercase tracking-wide opacity-55">
        {W(lang, "What reaches your account", "Lo que llega a su cuenta")}
      </p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[13px] opacity-70">{W(lang, `Base rent / ${per}`, `Canon base / ${per}`)}</span>
        <span className="text-[14px] font-bold">{native(rent)}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] opacity-70">
          {W(lang, "Host fee", "Comisión del anfitrión")}
        </span>
        <span className="text-[14px] font-bold opacity-70">− {native(money.fee)}</span>
      </div>
      {/* ⚠️ THE LIABILITY LINE IS GONE FROM THIS PANEL ON PURPOSE, 15 Aug 2026.
          It used to subtract 1.49 percent from the host's payout for a cover OneHome would carry.
          We do not sell that and never will — liability is the host's own policy on their own
          building. Nothing about it belongs on a OneHome price breakdown, because nothing about
          it passes through OneHome. `money.liabilityFee` is now always zero; the field is kept so
          the shape of this component did not have to change, and so a reader finds this note. */}
      <div className="mt-1 flex items-baseline justify-between border-t border-brand/20 pt-2">
        <span className="text-[13.5px] font-bold">{W(lang, `You receive / ${per}`, `Usted recibe / ${per}`)}</span>
        <span className="text-[19px] font-black tracking-tight text-brand">{native(money.net)}</span>
      </div>
      <div className="mt-3 border-t border-brand/20 pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] opacity-70">
            {W(lang, "Guest fee", "Comisión del huésped")}
          </span>
          <span className="text-[14px] font-bold opacity-70">+ {native(money.tenantFee)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[13.5px] font-bold">{W(lang, `Tenant pays / ${per}`, `El arrendatario paga / ${per}`)}</span>
          <span className="text-[16px] font-black tracking-tight text-brand">{native(money.tenantTotal)}</span>
        </div>
        {fx > 0 && (
          <p className="mt-0.5 text-right text-[11.5px] font-semibold opacity-55">
            ≈ {converted(money.tenantTotal)}
          </p>
        )}
      </div>
      <div className="mt-3 border-t border-brand/20 pt-3">
        {listingWaived ? <p className="text-sm font-bold text-brand">{W(lang, "Host and guest fees are waived for this listing.", "Este anuncio está exento de comisiones para anfitrión y huésped.")}</p> : <Toggle
          on={hostPaysGuestFee}
          onChange={onHostPaysGuestFeeChange}
          label={W(lang, "Host pays the guest service fee", "El anfitrión paga la comisión de servicio del huésped")}
        />}
        <p className="mt-1 text-[11.5px] leading-relaxed opacity-65">
          {hostPaysGuestFee
            ? W(lang,
                `The tenant pays only the base rent. Your total OneHome fee is ${native(money.fee)} per payment and is already included in the net amount above.`,
                `El arrendatario paga solo el canon base. Su comisión total de OneHome es ${native(money.fee)} por pago y ya está incluida en el monto neto de arriba.`)
            : W(lang,
                `Your fee is ${native(money.fee)} per payment; the tenant pays a separate ${native(money.tenantFee)} guest fee.`,
                `Su comisión es ${native(money.fee)} por pago; el arrendatario paga una comisión separada de ${native(money.tenantFee)}.`)}
        </p>
      </div>
      {fx > 0 && (
        <p className="mt-1 text-right text-[11px] opacity-50">
          {W(lang, "You receive", "Usted recibe")}: ≈ {converted(money.net)}
        </p>
      )}

      {/* THE PITCH, in money rather than in an adjective. */}
      {saved > 0 && (
        <div className="mt-3 border-t border-brand/20 pt-3">
          {/* ── ONE LINE ABOUT THEIR MONEY, THE REST BEHIND THE INFO BUTTON ─────────────────
             Lee, 16 August 2026: *"The user doesn't care about us. They care about them. How much
             are they saving as a host? And write it better — talk more like eighth grade
             language."* What this replaces opened with what OneHome earns over a year, on the
             screen where somebody decides whether to list at all.

             The percentage is derived from the two totals, never typed in, so it follows
             side-specific constants. A percentage written into copy on a money screen goes stale the
             first time a rate moves, and then the screen is quietly lying.

             ⚠️ The deposit sentence is carried through deliberately. It is not marketing — it is
             the standing statement that OneHome never holds a deposit and takes no fee on one,
             and Ley 820 is why it is on this screen. The post-check refuses to write without it. */}
          <NoticeRow
            title={W(lang,
              `You keep about ${native(saved)} more a ${money.cycles === 1 ? "booking" : "year"}`,
              `Usted se queda con unos ${native(saved)} más ${money.cycles === 1 ? "por reserva" : "al año"}`)}
            body={W(lang,
              `On this rent, the estimated Airbnb host fee is about ${native(money.airbnbTotal)} a ${money.cycles === 1 ? "booking" : "year"}, `
              + `compared with about ${native(money.ourTotal)} in OneHome host fees. The tenant's separate guest fee is shown above. You are charged only when a tenant pays you — never for listing. `
              + `A deposit, if you take one, is paid to you directly: it does not pass through OneHome and we take no fee on it.`,
              `Con este canon, la comisión estimada de Airbnb para el anfitrión es de unos ${native(money.airbnbTotal)} ${money.cycles === 1 ? "por reserva" : "al año"}, `
              + `comparada con unos ${native(money.ourTotal)} en comisiones de OneHome para el anfitrión. La comisión separada del huésped aparece arriba. Solo se le cobra cuando un arrendatario le paga — nunca por publicar. `
              + `El depósito, si lo cobra, se le paga a usted directamente: no pasa por OneHome y no cobramos comisión sobre él.`)} />
        </div>
      )}
      {money.liabilityFee > 0 && !COVER_LIVE && (
        <p className="mt-1 text-[11px] leading-relaxed opacity-50">
          {es ? PENDING_NOTE.es : PENDING_NOTE.en}
        </p>
      )}
    </div>
  );
}


/* ============================================================================================
   THE PREVIEW — what the public will see, before it is public.
   ============================================================================================
   Lee: *"once someone gets towards the bottom and they preview it, just like in the job creation,
   they can see how nice it looks to the public."*

   Deliberately built from the SAME state the form holds rather than from a saved row: a preview
   that requires saving first is a preview of a listing that already exists, which is not a
   preview. Nothing is written until Publish. */
function ListingPreview({ lang, es, listing, onBack, onPublish, busy, error, termsAccepted, onTermsAccepted }: {
  lang: string; es: boolean; busy: boolean; error?: string | null;
  onBack: () => void; onPublish: () => void;
  termsAccepted: boolean; onTermsAccepted: (accepted: boolean) => void;
  listing: any;
}) {
  const [documentsAccepted, setDocumentsAccepted] = useState(false);
  const rentalLegalDocuments = getRentalLegalDocuments(lang);
  const L = listing;
  const per = L.priceUnit === "month" ? W(lang, "month", "mes") : W(lang, "night", "noche");

  /* The facts that go on TOP of the cover photo, exactly as they will on the feed card. */
  const quick = [
    L.bedrooms != null ? `${L.bedrooms} ${W(lang, "bd", "hab")}` : null,
    L.bathrooms != null ? `${L.bathrooms} ${W(lang, "ba", "baños")}` : null,
    L.area != null ? `${L.area} m²` : null,
  ].filter(Boolean).join(" · ");

  const rows: [string, string | null][] = [
    [W(lang, "Type", "Tipo"), labelFor(propertyTypes(lang), L.propertyType)],
    [W(lang, "Floor", "Piso"), L.floor != null ? String(L.floor) : null],
    [W(lang, "Furnished", "Amoblado"), L.furnished ? W(lang, "Yes", "Sí") : W(lang, "No", "No")],
    [W(lang, "Master bed", "Cama principal"), labelFor(masterBeds(lang), L.masterBed)],
    [W(lang, "Walk-in closet", "Vestier"), L.walkInCloset ? W(lang, "Yes", "Sí") : null],
    [W(lang, "Two sinks", "Doble lavamanos"), L.dualVanities ? W(lang, "Yes", "Sí") : null],
    [W(lang, "Laundry", "Lavandería"), labelFor(laundryOptions(lang), L.laundry)],
    [W(lang, "Air conditioning", "Aire acondicionado"),
      L.acUnits != null ? (L.acUnits === 0 ? W(lang, "None", "No") : `${L.acUnits}`) : null],
    [W(lang, "Parking", "Parqueadero"), L.parking != null ? String(L.parking) : null],
    [W(lang, "Security", "Seguridad"), labelFor(securityLevels(lang), L.security)],
    [W(lang, "Pets", "Mascotas"), labelFor(petsOptions(lang), L.pets)],
    [W(lang, "Schools nearby", "Colegios cerca"), L.schoolsNearby ? (L.schoolZone || W(lang, "Yes", "Sí")) : null],
    [W(lang, "Available from", "Disponible desde"), L.availableFrom || null],
  ];
  const outside = [
    L.hasBalcony && W(lang, "Balcony", "Balcón"),
    L.hasPatio && W(lang, "Patio", "Patio"),
    L.hasBackyard && W(lang, "Backyard", "Jardín"),
    L.hasGrill && W(lang, "Grill", "Asador"),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="ow-tap mb-1 flex h-10 items-center gap-1 rounded-full border border-ink/15 pl-2 pr-3.5 text-sm font-bold dark:border-white/20">
        ‹ {W(lang, "Back to edit", "Volver a editar")}
      </button>
      <p className="text-[12px] font-bold uppercase tracking-wide opacity-45">
        {W(lang, "Preview — this is how people will see it", "Vista previa — así lo verá la gente")}
      </p>

      {/* ── THE CARD, WITH THE FACTS ON THE PHOTOGRAPH ──────────────────────────────────────
          Lee: *"we're gonna try to put the attributes on the actual picture itself. We don't want
          the picture and then a white section below it that has all the stuff. Use a shading, let
          it get darker at the bottom so people can see the text against the background."*

          So: one scrim from transparent to near-black over the bottom third, beds/baths/size on
          the left and the price and city on the right. Nothing below the image but the words. */}
      <div className="overflow-hidden rounded-2xl border border-ink/[0.08] dark:border-white/10">
        <div className="relative aspect-[4/3] w-full bg-ink/5 dark:bg-white/5">
          {L.photos[0] && <img src={L.photos[0]} alt="" className="h-full w-full object-cover" />}
          {L.photos.length > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-ink/65 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
              1 / {L.photos.length}
            </span>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pb-2.5 pt-10">
            <div className="flex items-end justify-between gap-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-extrabold leading-tight">{L.title}</p>
                {quick && <p className="mt-0.5 text-[12.5px] font-semibold opacity-85">{quick}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[17px] font-black leading-none">{listingMoney(L.rent, L.currency)}<span className="text-[11px] font-bold opacity-80">/{per}</span></p>
                <p className="mt-1 truncate text-[11.5px] font-semibold opacity-85">
                  {L.neighbourhood ? `${L.neighbourhood}, ` : ""}{L.cityLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {L.fx > 0 && (
        <p className="-mt-2 text-right text-[12px] opacity-60">
          ≈ {listingMoney(convertedAmount(L.rent, L.currency, L.fx), L.oppositeCurrency)} / {per}
        </p>
      )}

      {L.description && (
        <div className="ow-form-sec">
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{L.description}</p>
        </div>
      )}

      <div className="ow-form-sec">
        <h3 className="mb-2 text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "The details", "Los detalles")}
        </h3>
        <dl className="divide-y divide-ink/[0.06] dark:divide-white/[0.08]">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-[12.5px] opacity-60">{k}</dt>
              <dd className="text-right text-[13px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        {(outside.length > 0 || L.amenityKeys.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink/[0.06] pt-3 dark:border-white/[0.08]">
            {outside.map(o => (
              <span key={o} className="rounded-full border border-ink/12 px-2.5 py-1 text-[11.5px] font-bold dark:border-white/15">{o}</span>
            ))}
            {L.amenityKeys.map((a: any) => (
              <span key={a} className="rounded-full border border-brand/35 bg-brand/[0.07] px-2.5 py-1 text-[11.5px] font-bold text-brand-deep dark:text-brand-light">
                {labelFor(amenities(lang), a)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ⚠️ THIS BLOCK STILL SAID "Held by the OneHome vault" AFTER v42 REMOVED IT FROM THE FORM.
          Worth naming, because it is the failure mode this whole section is about: v42 fixed the
          panel the host edits and missed the panel the host is shown as "what the tenant sees" —
          so the promise we had just decided we must never make was still being made, in the one
          place a host would quote back at us. Grep for the words, not for the component. */}
      {L.depositChosen && (
        <div className="ow-form-sec">
          <h3 className="mb-1.5 text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "Security deposit", "Depósito de garantía")}
          </h3>
          <p className="text-[15px] font-black">
            {listingMoney(L.depositValue, L.depositCurrency)}
            <span className="ml-1.5 rounded-full border border-ink/15 px-1.5 py-0.5 align-middle text-[9.5px] font-black tracking-wide opacity-60 dark:border-white/20">
              {L.depositCurrency}
            </span>
            {L.depositBasis === "months" && (
              <span className="ml-1.5 text-[12px] font-semibold opacity-60">
                ({L.depositMonths} {W(lang, "months of rent", "meses de canon")})
              </span>
            )}
          </p>
          {L.fx > 0 && (
            <p className="mt-0.5 text-[11.5px] font-semibold opacity-55">
              ≈ {listingMoney(
                convertedAmount(L.depositValue, L.depositCurrency, L.fx),
                L.depositCurrency === "USD" ? "COP" : "USD",
              )}
            </p>
          )}
          <p className="mt-1 text-[12px] leading-relaxed opacity-70">
            {W(lang,
              `Paid to the host directly and returned by the host within ${L.depositReturnDays} days of the agreed move-out. OneHome does not collect it, hold it or return it.`,
              `Se paga directamente al arrendador y él lo devuelve dentro de ${L.depositReturnDays} días después de la entrega acordada. OneHome no lo recibe, no lo custodia ni lo devuelve.`)}
          </p>
          {/* DISCLOSURE TWO OF TWO — the tenant's copy of the same fact the host acknowledged. */}
          <p className="mt-1.5 text-[11.5px] leading-relaxed opacity-60">
            {W(lang,
              "On a stay of 30 days or more, Colombian law (Ley 820 de 2003, Art. 16) does not allow a cash deposit to be required, and you may ask for it back.",
              "En una estadía de 30 días o más, la ley colombiana (Ley 820 de 2003, art. 16) no permite exigir un depósito en dinero, y usted puede pedir su devolución.")}
          </p>
        </div>
      )}

      {L.coverChosen && (
        <div className="ow-form-sec">
          <h3 className="mb-1.5 text-[13px] font-black uppercase tracking-wide opacity-60">
            {es ? DAMAGE_COVER.title.es : DAMAGE_COVER.title.en}
          </h3>
          <p className={`text-[15px] font-black ${COVER_LIVE ? "" : "line-through opacity-45"}`}>
            {listingMoney(L.damageFee, L.currency)}
            <span className="ml-1.5 text-[12px] font-semibold opacity-60">
              / {L.priceUnit === "night" ? W(lang, "stay", "estadía") : W(lang, "month", "mes")}
            </span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed opacity-70">
            {W(lang, "No deposit. ", "Sin depósito. ")}{coverLimits(lang, DAMAGE_COVER, usd2)}{" "}
            {es ? DAMAGE_COVER.excludes.es : DAMAGE_COVER.excludes.en}
          </p>
          {!COVER_LIVE && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed opacity-60">
              {es ? PENDING_NOTE.es : PENDING_NOTE.en}
            </p>
          )}
        </div>
      )}

      {/* The two things a viewer can do. Shown disabled in the preview so the agent sees exactly
          what the tenant will be offered, without the preview being able to message themselves. */}
      <div className="flex gap-2 opacity-55">
        <button disabled className="btn-ghost flex-1">{W(lang, "Message the agent", "Escribir al agente")}</button>
        <button disabled className="btn-primary flex-1">{W(lang, "Request a showing", "Solicitar visita")}</button>
      </div>
      <p className="text-center text-[11px] opacity-45">
        {W(lang, "These are what a viewer taps. They are inactive in the preview.",
                 "Esto es lo que toca un visitante. Están inactivos en la vista previa.")}
      </p>

      <AgreementAcceptance documents={rentalLegalDocuments} locale={lang}
        onChange={docs => { setDocumentsAccepted(docs.length === rentalLegalDocuments.length); if (docs.length !== rentalLegalDocuments.length) onTermsAccepted(false); }} />
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
        <input type="checkbox" disabled={!documentsAccepted} checked={termsAccepted} onChange={e => onTermsAccepted(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--teal-depth)]" />
        <span className="text-[11.5px] leading-relaxed opacity-75">
          {W(lang,
            "I confirm I am authorized to offer this property, the listing is accurate, and I agree to the OneHome Host terms and applicable local rental disclosures.",
            "Confirmo que estoy autorizado para ofrecer este inmueble, que el anuncio es correcto y que acepto los términos para anfitriones de OneHome y los avisos locales aplicables.")}
          {" "}<a href="/onehome/terms" target="_blank" rel="noreferrer"
            className="font-black text-brand-deep underline underline-offset-2 dark:text-brand-light">
            {W(lang, "Read the OneHome terms", "Leer los términos de OneHome")}
          </a>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/35 bg-red-500/[0.08] p-3 text-[12.5px] font-semibold text-red-600">
          {error}
        </p>
      )}

      <FormActions
        cancel={{ label: W(lang, "Keep editing", "Seguir editando"), onClick: onBack }}
        hint={!termsAccepted ? W(lang, "Accept the Host terms before publishing", "Acepte los términos para anfitriones antes de publicar") : null}
        invalid={!termsAccepted}
        primary={{ label: W(lang, "Publish", "Publicar"), onClick: onPublish, busy, disabled: !documentsAccepted || !termsAccepted }} />
    </div>
  );
}
