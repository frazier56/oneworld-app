import { useEffect, useMemo, useRef, useState } from "react";
import { getHostReadiness } from "../lib/hostProfile";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Gallery, ListingEngagement, appDoorway, fmtMoney, ScreenHeading,
  Avatar, ScoreDonut, useI18n, useOneId, useAsync, supabase, productHref, W,
  IconPin, IconCheck, IconChat, IconCalendar, IconGlobe, startConversation,
  PropertyHistoryPanel, SimilarUnits, CurrencyPicker, useViewerCcy, fetchTrm, type Trm,
  BookingBar, HostTrust, drawPrice, type StayRules, type Booked,
  /* The tenant's half of the deposit decision, and the two covers. Same constants the host's
     form used, so the two sides of the same listing cannot describe the same money differently. */
  COVER_LIVE, PENDING_NOTE, DAMAGE_COVER, LIABILITY_COPY, coverFee, coverLimits,
  ShowingRequest,
  useAutoTranslate, tr, trList,
} from "@oneworld/shell";
import {
  type Property, PROPERTY_COLUMNS, priceLabel, cop, usd2, rentalError, locationLine, PAYOUT_FIRST_DAYS, PAYOUT_LATER_DAYS,
} from "../lib/rental";
import { amenityRows, GROUP_TITLE } from "../lib/amenities";
import { ListingRatings, useListingRatings } from "../../shared/ListingRatings";
import { D, counted, fullDate, BEDROOMS, BATHROOMS, GUESTS, NIGHTS } from "../lib/detailCopy";
import { Info, X } from "lucide-react";
import RentalRequestSheet, { type RentalRequestDetails, type RentalPaymentRail } from "../components/RentalRequestSheet";
import MyRequestCard from "../components/MyRequestCard";
import { coverOf, mediaRowOf, orderedPhotos } from "@oneworld/shell";
import PublishGate from "../components/PublishGate";
import ListingActions from "../components/ListingActions";
import ListingContactBar from "../../shared/ListingContactBar";
import StayFactsTable from "../components/StayFactsTable";
import { stayFactsMessage } from "../lib/stayFacts";
import { ONEHOME_TERMS_VERSION } from "../lib/legalDocuments";
import { monthlyStay } from '../lib/monthly';
import { shareUrl, canShare } from "../lib/shareLink";

/**
 * /rentals/r/:id — one property.
 * ============================================================================================
 * PHASE 2 LIVES HERE. Lee: *"a reply to a listing opens a Messages thread with the agent."*
 * That is the shared shell Messages spine — this screen creates (or finds) the conversation and
 * TAGS it with the property, so the agent's inbox says which unit the person is asking about.
 * Lee, 10 Aug: *"the message portal needs to know that that discussion is related to that
 * property."* An agent with nine listings and forty threads cannot work without that tag.
 *
 * The exact address is deliberately absent until a contract exists. Neighbourhood is public;
 * the street number is not something to publish to an open feed.
 */
/* The two-language plural helper that used to live here is gone. Max reported English
   "1 bedrooms" from a live audit, which was this helper: it did the Spanish pair and left
   English as a bare `s`. The rule now lives in `lib/detailCopy.ts` for all seven languages,
   where Russian gets its three forms and Chinese gets none. */

/* ⚠️ COLLAPSED BY DEFAULT IS THE POINT, NOT A FEATURE. Lee, 16 Sep 2026: *"Simple is better."*
   *"You don't need to have all that damage cover and house protected as a section — remember
   Airbnb doesn't have all that. You can have that little area where someone can click it and
   expand it if they want to."*

   A listing page had become nine open sections, every one of them shouting. What a reader wants
   on arrival is: what is it, where is it, what does it cost, who owns it. Everything else is
   something they go LOOKING for, and a thing you go looking for should be one line until you do.

   `<details>` rather than React state on purpose: it is the browser's own disclosure, so it is
   keyboard-operable, screen-reader-announced and findable by the browser's own in-page search
   without a line of code from us. */
function Fold({ title, note, children, defaultOpen = false }: {
  title: string; note?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="card mt-3 overflow-hidden p-0">
      <summary className="ow-tap flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span className="text-[13px] font-black uppercase tracking-wide opacity-70">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {note && <span className="text-[12.5px] font-bold tabular-nums opacity-60">{note}</span>}
          {/* Rotates on open. A caret that does not move leaves people unsure it did anything. */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="2.5" className="opacity-50 transition-transform [details[open]_&]:rotate-180"
            aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </summary>
      <div className="space-y-2.5 px-4 pb-4">{children}</div>
    </details>
  );
}

export default function PropertyDetail() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [sending, setSending] = useState(false);
  const [showingOpen, setShowingOpen] = useState(false);
  const [depositLawOpen, setDepositLawOpen] = useState(false);
  const [note, setNote] = useState("");
  /* ── IS THERE ALREADY A LIVE REQUEST ON THIS LISTING, FROM THIS PERSON? ───────────────────
     It decides whether the action control offers three things or one, so it is asked here rather
     than inferred from whatever `MyRequestCard` happens to be showing. "Live" means requested or
     pre-approved AND not past its expiry — a lapsed request must not keep the other two actions
     switched off, which is the failure Lee saw: a status about something that was already over,
     sitting next to a button it had disabled. */
  const [requestTick, setRequestTick] = useState(0);
  const [monthOpen, setMonthOpen] = useState(false);
  const [seeFirst, setSeeFirst] = useState(false);
  const [openBooking, setOpenBooking] = useState(0);
  const [month, setMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1, 12).toISOString().slice(0, 7);
  });
  const [err, setErr] = useState<string | null>(null);
  /* The reader's currency, and the official rate to draw it at. */
  const [viewCcy] = useViewerCcy();
  const [trm, setTrm] = useState<Trm | null>(null);
  useEffect(() => { void fetchTrm().then(setTrm); }, []);

  const [listingTick, setListingTick] = useState(0);
  const p = useAsync(async () => {
    const { data } = await supabase.from("rental_properties")
      .select(PROPERTY_COLUMNS).eq("id", id).maybeSingle();
    return (data as unknown as Property) ?? null;
  }, [id, listingTick]);
  /* One fetch for both stars, keyed by this listing and its host. Same hook the feed used before
     the ratings moved here, so the two screens can never disagree about a score. */
  const ratings = useListingRatings(p ? [p] : []);

  /* ── THE HOST'S OWN WORDS, IN THE READER'S LANGUAGE ────────────────────────────────────────
     Lee, 17 September 2026: *"Make sure the description is translating properly. Remember 100%
     of the page will translate with the flag."*

     Up to now the flag translated the app and left the listing. Every label on this screen came
     out of a dictionary while the title, the description and the house rules — the only text on
     the page that says which apartment this is — stayed in whatever language the host typed.

     `useAutoTranslate` asks the edge function once per listing per language; the function caches,
     so the four hundredth German reader costs a database row rather than a model call. It fails
     to the original on every path, so the worst case is the page we had before.

     `showSource` lets anyone read what the host actually wrote. It matters most exactly where
     translation matters most: a house rule is a rule, and somebody arguing about one at check-in
     needs the sentence the host signed their name to. */
  const xl = useAutoTranslate("rental_properties", p?.id ?? null, lang, !!p);
  const [showSource, setShowSource] = useState(false);
  const xlOn = xl.translated && !showSource;

  const agent = useAsync(async () => {
    if (!p) return null;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title, score_v9_snapshot").eq("id", p.agent_id).maybeSingle();
    return data as any;
  }, [p?.agent_id], !!p);

  /**
   * NIGHTS ALREADY TAKEN — so the calendar strikes them through rather than accepting them.
   *
   * Accepted bookings and host-preapproved requests hold dates. A submitted request does not.
   * Previously a REQUESTED one
   * holds them too until the host answers or the 24-hour window lapses. Selling the same night
   * twice while a request is outstanding is the single most expensive bug this screen can have,
   * and the database refuses it as well — `rental_request_no_overlap`. This query is the polite
   * version of that refusal: it stops somebody choosing the dates in the first place.
   */
  const booked = useAsync(async () => {
    const { data } = await supabase.rpc('rental_public_reserved_dates',{p_property_id:id});
    return (data ?? []) as Booked[];
  }, [id]);

  /* WHAT THE GUEST WILL ACTUALLY BE CHARGED. The database stamps the fee allocation on insert
     (standard rates, a host-paid fee, or a scoped waiver for one guest on one listing). Until
     7 Sep 2026 the estimate hard-coded 7.5%, so a waived guest was quoted a fee the server then
     did not charge. `rental_fee_preview` answers for the signed-in guest only. */
  const feePreview = useAsync(async () => {
    const { data } = await supabase.rpc('rental_fee_preview', { p_property_id: id });
    return (data ?? null) as { host_fee_rate: number; guest_fee_rate: number; waived: boolean } | null;
  }, [id, userId]);

  /* ── HOW CAN THIS HOST ACTUALLY BE PAID? ───────────────────────────────────────────────
     Rail NAMES only — 'stripe', 'wise', 'paypal' — from a server function that never returns a
     handle, a pay link or an account number. Those stay private and reach only somebody with a
     real agreement.

     ⚠️ WITHOUT THIS THE SHEET OFFERED ALL FOUR RAILS TO EVERY GUEST, defaulting to Remitly,
     with no reference to what the host could receive. A guest could choose Remitly for a host
     who has only a Wise link and the money had nowhere to land — and since 15 Sep nothing can
     even register Remitly as a destination, so the DEFAULT pointed at the one rail no host can
     have. `undefined` while it loads, so the sheet says it is checking rather than guessing. */
  const hostRails = useAsync(async () => {
    const { data, error } = await supabase.rpc("rental_property_payout_rails", { p_property_id: id });
    if (error) return [] as RentalPaymentRail[];
    return ((data ?? []) as string[]).filter(
      (r): r is RentalPaymentRail => r === "stripe" || r === "wise" || r === "paypal",
    );
  }, [id, userId]);

  /* How many places this host has published — one number, for the trust block below the agent
     card. `head: true` so the rows never travel; only the count does. */
  const hostListings = useAsync(async () => {
    if (!p) return null;
    const { count } = await supabase.from("rental_properties")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", p.agent_id).eq("status", "published").eq("is_public", true);
    return count ?? null;
  }, [p?.agent_id], !!p);

  const comments = useAsync(async () => {
    const { data } = await supabase.from("rental_property_comments")
      .select("id, author_id, body, created_at").eq("property_id", id)
      .order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  }, [id]);

  const mine = !!userId && p?.agent_id === userId;
  /**
   * ── OWNER CONTROLS ARE OFF UNLESS YOU CAME FROM MY-LISTINGS (Lee, 13 Aug 2026) ──────────
   * *"If you click on a public listing there and it's your listing, you don't see the public
   * version of it — you see your version. I see where it says Edit and Draft a contract, but I
   * don't need to see it there. That's the public view. If I want to see what everyone else is
   * seeing, I go to the feed. If I want to see my own listing I can go to My Listings."*
   *
   * `mine` still means what it always meant — you own this. What changed is that owning it is no
   * longer enough to SHOW you the owner's tools. The feed is a public surface: an agent checking
   * how their own advert looks to a renter was being shown an Edit button no renter can see, so
   * the one place they could preview their own work was the one place that lied to them about it.
   *
   * `?owner=1` is appended by My Listings and by the post-save redirect, and by nothing else. A
   * person who guesses the query string gets the buttons and then gets refused by RLS, which is
   * where that refusal belongs — this is a VIEW switch, never a permission.
   */
  const [params, setParams] = useSearchParams();
  const ownerView = mine && params.get("owner") === "1";
  /* ── ⚠️ THE PREVIEW IS THIS SCREEN NOW (Lee, 15 Sep 2026) ────────────────────────────────
     *"The preview screen should look exactly like how it does in the public view. I don't think
     it does like that right now."*

     It did not, and it structurally could not: the form drew its OWN ~250-line rendering of a
     listing and called it a preview. Two renderings of one thing drift within a week — that is
     the same class of defect as two lists of addendums or two answers to "which cities exist".

     So the form no longer draws a preview. It saves the draft and sends the host HERE, to the
     real public screen, with `?preview=1`. The match is now true by construction and stays true
     for every future change, because there is only one screen. All this flag adds is the publish
     bar at the bottom and the suppression of the viewer's own actions — a host should not be able
     to message or book themselves. */
  const previewing = mine && params.get("preview") === "1";
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const publishInFlight = useRef(false);
  const [hostSetupNeeded, setHostSetupNeeded] = useState(false);

  async function publishNow() {
    if (!p || !mine || !userId || publishInFlight.current) return;
    publishInFlight.current = true;
    setPublishing(true); setPublishError(null); setHostSetupNeeded(false);
    try {
    if (!(await getHostReadiness()).profile_ready) {
      setHostSetupNeeded(true);
      setPublishError(W(lang, "Your private draft is saved. Complete your host profile before publishing.", "Su borrador privado está guardado. Complete su perfil de anfitrión antes de publicar."));
      return;
    }
    const { error } = await supabase.from("rental_properties")
      /* Stamped EXACTLY as the form stamps it. Two publish paths that record different consent
         is worse than one publish path that is awkward. */
      .update({
        status: "published",
        updated_at: new Date().toISOString(),
        onehome_terms_version: ONEHOME_TERMS_VERSION,
        onehome_terms_accepted_at: new Date().toISOString(),
        onehome_terms_accepted_by: userId,
      })
      .eq("id", p.id).eq("agent_id", userId!).select("id").single();
    if (error) {
      if (error.code === "OH002") {
        setHostSetupNeeded(true);
        setPublishError(W(lang, "Publication was refused. Your private draft is saved; complete your host profile.", "Se rechazó la publicación. Su borrador privado está guardado; complete su perfil de anfitrión."));
      } else setPublishError(rentalError(error, lang));
      return;
    }
    setListingTick(tick => tick + 1);
    nav(productHref("onerental", `/r/${p.id}?owner=1`), { replace: true });
    } catch {
      setPublishError(W(lang, "Publication could not finish. Your draft is still saved; try again.", "No se pudo terminar la publicación. Su borrador sigue guardado; vuelva a intentarlo."));
    } finally { publishInFlight.current = false; setPublishing(false); }
  }
  const [ownerActionBusy, setOwnerActionBusy] = useState(false);
  const [paymentReturnHandled, setPaymentReturnHandled] = useState(false);

  async function unpublishOwnedListing() {
    if (!ownerView || !p || !userId || p.status !== "published") return;
    setOwnerActionBusy(true); setErr(null);
    const { error } = await supabase.from("rental_properties")
      .update({ status: "draft", is_public: false })
      .eq("id", p.id).eq("agent_id", userId);
    if (error) {
      setErr(error.message);
      setOwnerActionBusy(false);
      return;
    }
    window.location.reload();
  }

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!userId || !sessionId || params.get("rental_payment") !== "authorized" || paymentReturnHandled) return;
    setPaymentReturnHandled(true);
    setSending(true); setErr(null);
    void supabase.functions.invoke("rental-confirm-authorization", { body: { sessionId } }).then(({ error }) => {
      setSending(false);
      if (error) {
        setErr(D(lang, "errStripeAuth"));
        return;
      }
      const clean = new URLSearchParams(params);
      clean.delete("session_id"); clean.delete("rental_payment");
      clean.set("payment_confirmed", "1");
      setParams(clean, { replace: true });
    });
  }, [userId, params, paymentReturnHandled, lang, setParams]);

  /**
   * ASK ABOUT THIS PLACE — Phase 2 in one function.
   *
   * Find the existing thread with this agent before making a second one: two threads with the
   * same person is how an inbox stops being usable, and `participant_ids` is an array so the
   * containment check is one query rather than a scan.
   */
  /**
   * ASK ABOUT THIS PLACE — now through the SHARED helper.
   *
   * My own version already found an existing thread first and checked `participant_ids.length
   * === 2` so a `contains` superset could not open a group thread — the same two traps the shell
   * helper reached independently. The one real difference was that I hard-coded
   * `is_request: true`, which means "a message from somebody you do not know yet". A renter who
   * is already connected to the agent would have had their enquiry land in the Requests filter
   * instead of the inbox. The helper works it out from a real accepted connection, either way
   * round, so that stops being a per-product judgement call.
   *
   * There are four places a conversation can start now — the inbox button, a feed reply, a
   * profile Message, and this. One helper, so the next fix lands once.
   */
  async function ask() {
    if (!userId || !p || mine) return;
    setSending(true); setErr(null);
    const body = note.trim() ||
      D(lang, "stillAvailable", { title: p.title });
    const res = await startConversation(userId, p.agent_id, body);
    if ("error" in res) { setErr(res.error); setSending(false); return; }

    /* THE PROPERTY TAG STAYS OURS. The helper knows nothing about it and should not — it is a
       side table so the shared `conversations` row every product reads is untouched. Lee, 10 Aug:
       *"the message portal needs to know that that discussion is related to that property."* */
    await supabase.from("rental_conversation_tags")
      .upsert({ conversation_id: res.conversationId, property_id: p.id }, { onConflict: "conversation_id" });

    setSending(false);
    nav(productHref("onerental", "/messages"));
  }

  /**
   * REQUEST TO BOOK — what the pinned bar actually does.
   *
   * The first draft of this navigated to `/r/:id/book`, a route that does not exist. A button
   * that leads to a 404 is worse than no button, so it writes the request row directly instead —
   * which is the flow `booking.ts` was written for and the flow the database already enforces.
   *
   * Three things are deliberate:
   *   · `expires_at` is set here, not by a default, because REQUEST_WINDOW_HOURS is a product
   *     decision that belongs next to the other product decisions rather than in a column default
   *     nobody reads.
   *   · The overlap refusal comes from the DATABASE (`rental_request_no_overlap`), not from the
   *     check we already did in the calendar. Two people can pick the same nights three seconds
   *     apart; only the constraint can settle that, and `rentalError` turns 23P01 into a sentence.
   *   · It opens a Messages thread as well. A request the host has to answer inside 24 hours and
   *     no conversation attached to it is a request that gets missed.
   */
  const [booking, setBooking] = useState(false);
  const [pendingStay, setPendingStay] = useState<{ starts_on: string; ends_on: string; total: number; nights: number } | null>(null);
  const [monthlyRequest, setMonthlyRequest] = useState(false);

  /* ── ⚠️ TWO MESSAGE BUTTONS, AND THEY DID DIFFERENT THINGS ──────────────────────────────
     Lee, 17 September 2026: *"I don't know why you have a secondary message button… you got
     Send message at the top and then you got Message again. So what's the difference?"*

     There WAS a difference and it was the wrong one. The pinned button called the same send
     function directly, so pressing it fired off the canned "is this still available?" line
     immediately, while the button by the box sent whatever the person had typed. Two controls,
     the same word, one of them sending something you never wrote.

     The pinned bar's job is that you can always reach the action without scrolling — not that it
     is a second copy of it. So it now takes you TO the box and puts the cursor in it. One send,
     one place it happens, and the thing at the bottom of the screen is a way to get there. */
  function goToAsk() {
    const box = document.getElementById("ow-ask-box") as HTMLTextAreaElement | null;
    if (!box) return;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    /* After the smooth scroll, not during it — focusing mid-scroll cancels it in Safari. */
    window.setTimeout(() => box.focus({ preventScroll: true }), 420);
  }

  /* One entry point, so the sheet, the month chooser and the "see it first" box cannot drift. */
  function startBooking() {
    setSeeFirst(false);
    if (p && p.price_unit === "month") { setMonthOpen(true); return; }
    setOpenBooking(n => n + 1);
  }

  function requestToBook(r: { starts_on: string; ends_on: string; total: number; nights: number }) {
    if (!userId || !p || mine) { nav(productHref("onerental", "/profile")); return; }
    setMonthlyRequest(false); setPendingStay(r);
    setErr(null);
  }

  async function submitRentalRequest(details: RentalRequestDetails) {
    if (!userId || !p || !pendingStay || mine || !details.termsAccepted) return;
    setBooking(true); setErr(null);
    try {

    const { data: requestData, error } = await supabase.rpc(monthlyRequest ? "request_consented_monthly_rental" : "create_consented_rental_booking_request", monthlyRequest ? {
      p_property_id:p.id, p_starts_on:pendingStay.starts_on, p_payment_rail:details.paymentRail, p_accept_terms:details.termsAccepted, p_terms_version:"OH-2026-09-06.1",
    } : {
      p_property_id: p.id,
      p_starts_on: pendingStay.starts_on,
      p_ends_on: pendingStay.ends_on,
      p_payment_rail: details.paymentRail,
      p_cancel_policy: "moderate",
      p_accept_terms: details.termsAccepted, p_terms_version: "OH-2026-09-06.1",
    });
    const request = (Array.isArray(requestData) ? requestData[0] : requestData) as { id: string; guest_total?: number; currency?: string } | null;
    if (error) { setErr(rentalError(error as any, lang)); setBooking(false); return; }
    if (!request) { setErr(D(lang, "errSaveRequest")); setBooking(false); return; }

    if (details.identityFile && request) {
      const file = details.identityFile;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${request.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("rental-request-identity").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (uploadError) {
        const { data: deletedRequest, error: deleteError } = await supabase.from("rental_booking_requests")
          .delete().eq("id", request.id).eq("guest_id", userId).select("id").maybeSingle<{ id: string }>();
        setErr(deleteError || !deletedRequest
          ? D(lang, "errIdDraftLeft")
          : D(lang, "errIdNotSent"));
        setBooking(false);
        return;
      }
      const { error: documentError } = await supabase.from("rental_request_identity_documents").insert({
        request_id: request.id, guest_id: userId, storage_path: path,
        document_kind: details.documentKind, side: details.documentKind === "passport" ? "photo_page" : "front",
        mime_type: file.type, byte_size: file.size,
      }).select("id").single<{ id: string }>();
      if (documentError) {
        // A returned transport error can follow a committed insert. Keep its object and request.
        setErr(D(lang, "errIdRecord"));
        setBooking(false);
        return;
      }
      const { error: submittedError } = await supabase.rpc("mark_rental_identity_submitted", { p_request_id: request.id });
      if (submittedError) {
        /* The request row, exact document row and private object are already saved. A transport
           failure here is ambiguous: the state transition may have committed. Preserve all three
           so no retained metadata can point at a deleted identity object, and tell the guest not
           to create a duplicate request. */
        setErr(D(lang, "errIdReview"));
        setBooking(false);
        return;
      }
    }

    /* ── ⚠️ THE REQUEST NOW ACTUALLY REACHES MESSAGES. 17 September 2026. ─────────────────
       The line that used to sit here said "The database creates the request message and selected
       channel alerts atomically." Half of that was true. `track_request_hold()` fires a
       NOTIFICATION to the host and nothing else — there is no code anywhere in the database that
       writes a message, which is why a tenant could never pull their own request up again.

       Lee asked for exactly that: *"the request is delivered into Messages so the tenant can
       always pull it up."* So it is written here, from the same helper the Ask box uses, and
       tagged with the property like every other rental thread.

       It is deliberately NOT fatal. The request row is already committed and the host has already
       been alerted; failing the whole submission because a second write did not land would throw
       away a request that exists. The guest is taken to their request either way. */
    try {
      const stayText = stayFactsMessage(
        { starts_on: pendingStay.starts_on, ends_on: pendingStay.ends_on, nights: pendingStay.nights,
          check_in_time: (p as any).check_in_time, check_out_time: (p as any).check_out_time,
          /* ⚠️ THE AMOUNT COMES FROM THE ROW THE DATABASE JUST WROTE, NEVER FROM ARITHMETIC
             DONE HERE. The sheet's estimate and the stamped total are computed from different
             places, and a message is a durable artefact somebody will quote back. If the two ever
             disagreed, the version in writing would be the wrong one. */
          guest_total: (request as any).guest_total ?? null,
          currency: (request as any).currency ?? p.currency },
        lang,
        n => new Intl.NumberFormat(lang === "es" || lang === "co" ? "es-CO" : lang, { style: "currency", currency: p.currency || "USD", maximumFractionDigits: 0 }).format(n),
        p.title,
      );
      const thread = await startConversation(userId, p.agent_id, stayText);
      if ("conversationId" in thread) {
        await supabase.from("rental_conversation_tags")
          .upsert({ conversation_id: thread.conversationId, property_id: p.id }, { onConflict: "conversation_id" });
      }
    } catch (messageError: any) {
      /* ⚠️ NOT SWALLOWED. `catch {}` on anything next to a money path is a defect even when
         nothing is currently broken — four different causes producing one indistinguishable
         silence is how nobody ever diagnoses the fifth. The request itself stands (it is already
         committed and the host is already alerted), so this does not fail the submission, but the
         reason is recorded rather than discarded. */
      console.error("[onehome] request saved but the Messages copy did not land:",
        messageError?.code ?? "", messageError?.message ?? String(messageError));
    }

    setBooking(false);
    setPendingStay(null);
    setRequestTick(t => t + 1);
    nav(productHref("onerental", `/r/${p.id}?request=${request.id}`));
    } catch {
      setErr(D(lang, "errLatestState"));
    } finally {
      setBooking(false);
    }
  }

  const liveRequest = useAsync(async () => {
    if (!userId || !id) return null;
    const { data } = await supabase.from("rental_booking_requests")
      .select("id, starts_on, ends_on, nights, guest_total, currency, state, approval_stage, expires_at, check_in_time, check_out_time")
      .eq("property_id", id).eq("guest_id", userId)
      .in("state", ["requested", "preapproved"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle<any>();
    if (!data) return null;
    return new Date(data.expires_at).getTime()> Date.now() ? data : null;
  }, [id, userId, requestTick]);
  /* TWO DIFFERENT LINES, and they are crossed at different moments — see ListingActions.tsx.
     A booking cannot be asked for twice, so one live request closes that. Viewings close only
     once the host PRE-APPROVES, which is when the dates are actually held and money is asked
     for; until then nothing exists that a viewing could disturb. */
  const bookingBlocked = !!liveRequest;
  const showingBlocked = !!liveRequest
    && (String(liveRequest.approval_stage ?? "").startsWith("preapproved") || liveRequest.state === "accepted");

  /** Nightly listings use the stay calendar. Monthly listings use MonthlyRentalPanel below so a
   * 31- or 32-day calendar span can never inflate one agreed calendar month's rent. */
  const stayRules: StayRules = useMemo(() => ({
    base: p?.price ?? 0,
    minNights: p?.min_term_days && p.min_term_days> 1 ? p.min_term_days : null,
  }), [p?.price, p?.price_unit, p?.min_term_days]);

  /* ⚠️ EVERY HOOK MUST SIT ABOVE THE EARLY RETURNS BELOW. 15 Aug 2026: this `useMemo` was
     BELOW them, so the first render (while the listing was still loading) ran fifteen hooks and
     the second ran sixteen. React threw #310 — "rendered more hooks than during the previous
     render" — and the boundary caught it. Result: EVERY listing page crashed, every time, for
     everybody. Lee could not open his own listing.
     It is written this way, not because the memo needs to be early, but because a hook after a
     conditional return is a crash waiting for the data to arrive. Nothing may be added between
     here and the `return (` at the bottom except plain values. */

  if (p === undefined) return <div className="py-6"><div className="card ow-shimmer h-80" /></div>;
  if (p === null) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-bold">{D(lang, "listingGone")}</p>
        <Link to={productHref("onerental")} className="btn-ghost mt-4 inline-block">
          {D(lang, "backToFeed")}
        </Link>
      </div>
    );
  }

  /* One sentence, one source — see `locationLine` in lib/rental. This used to omit the
     department (never stored until 15 Sep) and the country (never shown anywhere at all). */
  const where = locationLine(p, lang);
  const depositCurrency = (p.deposit_currency || (p.currency === "COP" ? "COP" : "USD")).toUpperCase();
  const depositOpposite = p.deposit_required && p.deposit_amount != null && trm?.rate
    ? depositCurrency === "COP"
      ? `≈ ${fmtMoney(Number(p.deposit_amount) / trm.rate, "USD", { cents: true })} USD`
      : `≈ ${fmtMoney(Number(p.deposit_amount) * trm.rate, "COP", { cents: false })} COP`
    : null;

  return (
    <div className="space-y-4">
      <ScreenHeading>{D(lang, "homeDetails")}</ScreenHeading>
      {previewing && (
        <p className="rounded-xl border border-brand/30 bg-brand/[0.08] p-3 text-[12.5px] font-bold text-brand-deep dark:text-brand-light">
          {W(lang, "Preview — this is the listing exactly as a tenant sees it. It is not live yet.",
                   "Vista previa — así verá el anuncio un arrendatario. Todavía no está publicado.")}
        </p>
      )}
      {booked?.some(b=>b.starts_on<=new Date().toISOString().slice(0,10)&&b.ends_on>new Date().toISOString().slice(0,10)) && <p className="rounded-xl border border-brand/20 bg-brand/10 p-3 text-sm font-bold">{D(lang, "currentlyReserved")}</p>}
      {userId && !mine && <MyRequestCard propertyId={p.id} userId={userId} lang={lang} />}

      {/* ⚠️ NAME AND PLACE FIRST, THEN THE PICTURES. Lee, 16 Sep 2026, on the third asking:
          *"I still think you need the name of the property at the top and the city. That should
          be the first thing under home details. And then you'll see your videos and pictures, and
          then you get down to your price."*

          He is right and it is the ordinary order of a listing: what is this and where is it,
          then show me, then tell me what it costs. Opening on a photograph of an unnamed place
          makes somebody scroll down to find out what they are looking at — and on a feed where
          every card is a photograph, landing on another photograph reads as not having moved. */}
      <h1 className="text-[22px] font-black leading-tight tracking-tight">{xlOn ? tr(xl, "title", p.title) : p.title}</h1>
      {/* ⚠️ THE PIN IS GONE. Lee, 16 Sep 2026: *"That icon needs to be way more prominent... it's
          just a little blip on the screen. The other option is, do we even need it? If you left
          justify the location against the title, that might look even cleaner. Just try that."*

          Taking it away, because he is right about the underlying problem: a 13px glyph beside
          13px text is neither decoration nor information — it is a smudge. Making it bigger would
          have given the line a bullet it does not need, since a place name directly under a
          property title is already unmistakably the place. Left-justified against the title, the
          two lines share an edge and read as one block.

          Same wrapping rule as the cards: both names unbreakable, together on one line when they
          fit, each on its own line when they do not, never a break inside a name. */}
      {where && (() => {
        const cut = where.lastIndexOf(",");
        const city = cut === -1 ? where : where.slice(0, cut);
        const rest = cut === -1 ? "" : where.slice(cut + 1).trim();
        return (
          <p className="mb-3 mt-1 flex flex-wrap gap-x-1.5 text-[13px] opacity-65">
            <span className="whitespace-nowrap">{city}{rest ? "," : ""}</span>
            {rest && <span className="whitespace-nowrap">{rest}</span>}
          </p>
        );
      })()}

      {/* ⚠️ THE SEPARATE VIDEO SECTION IS GONE. Lee, 16 Sep 2026: *"Instead of having two
          categories at the top where we've got videos and then photos, let's just combine them.
          Videos show first, then photos. That way we don't have two sections for people to
          scroll into."*

          It was two strips stacked — a video shelf, then a photo gallery — so the page had two
          different swipe areas doing the same job, and the "see all" view only ever contained
          half the media. Now `Gallery` takes both and puts the videos first: one strip, one
          counter, one "see all", one fullscreen viewer. A listing with no video is identical to
          before. */}
      <Gallery
        /* Cover first: the host's chosen still leads the strip and is what "See all" opens on.
           `orderedPhotos` is every photo, reordered — nothing is hidden. */
        photos={orderedPhotos(p)} videos={p.videos ?? []} lang={lang} alt={p.title}
        />

      {ownerView && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/45 bg-white/40 p-2.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
          <span className={`rounded-full border px-3 py-1 text-[11.5px] font-black ${p.status === "published" ? "border-brand/35 bg-brand/10 text-brand" : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
            {p.status === "published"
              ? D(lang, "publishedLive")
              : D(lang, "draftPrivate")}
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <Link to={productHref("onerental", `/list?form=1&edit=${p.id}`)} className="btn-ghost inline-flex items-center gap-2 px-4">
              {D(lang, "edit")}
            </Link>
            {p.status === "published" ? (
              <button type="button" disabled={ownerActionBusy} onClick={() => void unpublishOwnedListing()}
                className="btn-ghost inline-flex items-center gap-2 px-4 disabled:opacity-55">
                {ownerActionBusy ? "…" : D(lang, "unpublish")}
              </button>
            ) : (
              <Link to={productHref("onerental", `/list?form=1&edit=${p.id}&publish=1`)} className="btn-primary inline-flex items-center gap-2 px-4">
                {D(lang, "reviewPublish")}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── THE LISTING NUMBER, AND WHEN IT LAST CHANGED (Lee, 12 Aug 2026) ─────────────────
             *"This page doesn't even have a title. The title to this page should be something…
             maybe we have a listing number. Every listing has a number — five digits is good, so
             if we start with ten thousand five hundred, the first listing would be 10501. We
             should have a listing number for real, just to keep track. If someone calls about a
             listing, I need to know okay, what's the listing number."*

             Assigned by the database on insert from one sequence shared by rentals and sales, so
             a number identifies a property across OneHome rather than only within one half. His
             own first listing came out as 10501.

             Beside it, when it was last edited — *"if I do edit it, it needs to have a time stamp
             so people know that, okay, when I looked at it last week, it looks like it was
             edited."* Only shown once it HAS been edited: on a listing that has never changed the
             stamp would just be the date it was created wearing a misleading word. */}
      {/* ⚠️ ONE ROW. Lee, 16 Sep 2026: *"Right now you have the heart, the share, the property
          number and the edited on different rows and that doesn't need to be the case — it's just
          taking up unnecessary space."*

          Four pieces of housekeeping were each claiming a full line on a phone. They are all the
          same kind of thing — facts ABOUT the listing rather than about the place — so they read
          as one line: identity on the left, actions on the right. */}
      {/* ⚠️ ONE ROW, AND LEE HAD TO ASK FOR IT MORE TIMES THAN I WANT TO COUNT. 16 Sep 2026:
          *"Put the property number and the edit timestamp on the same row as the heart and the
          share... reading from left to right you will see the property number, the edit
          timestamp, then a gap because the icons are right justified, then the share icon and
          then the heart."*

          What I kept missing: the heart and the share were never in this row to begin with. They
          were handed to the GALLERY as its footer, so they rendered under the photographs, a
          whole component away. Moving the number down would never have met him — the icons had to
          come out of the gallery, and now they have.

          Exactly his order: identity left, a gap, then share, then the heart furthest right —
          last because it is the one people reach for, and the outer edge is the easiest place on
          a phone for a thumb to land. */}
      {/* ── ONE PANEL UNDER THE WHOLE HEAD OF THE PAGE ─────────────────────────────────────
          Lee, 17 September 2026: *"the top piece where you have property, no reviews, you got
          the heart — the whole screen… there needs to be some background, probably like over
          this entire section, like a little panel that covers this, because it's sitting right
          on the true background."*

          He is right, and the reason it looked wrong is structural rather than cosmetic:
          everything BELOW this point — amenities, house rules, the map, the ask box — already
          sits on a card, so the page began with its most important facts (number, rating, price,
          description, size) as loose text on bare canvas and only acquired surfaces once you
          scrolled past them. The head of the page read as the least finished part of it.

          One panel, not five: the listing number, the ratings, the price, the description and
          the attribute chips are one thought — "what is this, and what does it cost" — and
          splitting them into separate cards would have made the same mistake in the other
          direction ("you only need panels when you need panels", 8 Aug). `card` is the shared
          class, so it carries the same fill, hairline and shadow as every other panel in every
          app, including the stronger control edge from batch 44. */}
      <section className="card mt-4 space-y-0">
      <div className="flex items-center gap-x-3 gap-y-1">
        {(p as any).listing_no && (
          <span className="rounded-md bg-ink/[0.06] px-2 py-0.5 text-[11.5px] font-black tabular-nums tracking-wide opacity-70 dark:bg-white/10">
            #{(p as any).listing_no}
          </span>
        )}
        {(p as any).updated_at && (p as any).created_at
          && new Date((p as any).updated_at).getTime() - new Date((p as any).created_at).getTime()> 60_000 && (
          <span className="text-[11.5px] font-semibold opacity-45">
            {D(lang, "edited")}{" "}
            {/* MAX, 12 Sep 2026: a German label over a Spanish date. `lang === "en" ? "en-US" :
                "es-CO"` sent every reader outside English to Colombian Spanish, so the page read
                "Bearbeitet 8 de sept de 2026". `fullDate` hands Intl the chosen language. */}
            {fullDate(lang, (p as any).updated_at)}
          </span>
        )}
        <div className="ml-auto shrink-0">
          <ListingEngagement
          itemId={p.id} source="rental_property" savesAs="rental_property"
          /* The CARD url, not the app deep link — a crawler cannot run the app's JavaScript,
             so every link shared from here used to arrive in WhatsApp as a bare URL. One
             place builds it: `lib/shareLink.ts`. */
          shareUrl={shareUrl(p.id)}
          shareTitle={p.title}
          allowShare={canShare((p as any).allow_public_share) && !!shareUrl(p.id)}
          hideComments
          onComments={() => {}}
          lang={lang} />
        </div>
      </div>
      {/* ⚠️ THE STARS LIVE HERE NOW, AND ONLY HERE. Lee, 16 Sep 2026: *"Below that should be the
          property review, five stars or whatever, and then the host review."*

          They came off the feed tile in the same batch. A tile answers "worth opening?"; a rating
          is how you judge a place you are already considering. Directly under the listing number
          and above the price is the right rung: it is the last piece of "can I trust this" before
          the first piece of "what does it cost". */}
      <div className="mt-2">
        <ListingRatings propertyId={p.id} hostId={p.agent_id} property={ratings.property} host={ratings.host} lang={lang} />
      </div>

      {/* ⚠️ THE TITLE AND THE CITY MOVED ABOVE THE MEDIA — see the block before <Gallery>. Lee
          asked for this three times before I did it. */}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="whitespace-nowrap text-[24px] font-black tracking-tight text-brand">
          {priceLabel(p, lang, viewCcy, trm?.rate)}
        </span>
        {/* ⚠️ NOT WHEN THE HEADLINE IS ALREADY IN PESOS. This line exists to tell a Colombian
            reader roughly what a dollar price comes to — but it did not check what the headline
            was actually showing, so a reader who had chosen COP in the currency picker got
            "COP 3.100.000 / month" and, directly underneath, "≈ COP 3.100.000 · charged in USD".
            The same number twice, the second time with a sentence contradicting the first.
            It now appears only when the price above it is NOT in pesos. */}
        {/* ⚠️ TODAY'S RATE, NOT THE RATE THE DAY THE HOST SAVED. Lee, 20 September 2026:
            *"the exchange rate changes every day, right? So we should have that function built
            in to where it's looking at the exchange rate, and it updates based on the daily
            exchange rate."*

            `display_fx_rate` is a column on the listing — a snapshot taken when the host last
            pressed save. Casa Cimazul carries 3100.45, and a listing saved months ago carries
            whatever the peso was doing then, so this line has been quoting a number that ages
            silently while the headline price beside it (which already uses `trm`) does not.
            Two figures on one row, computed at two different moments.

            `fetchTrm` reads the Superfinanciera's official TRM once per Bogotá day and caches
            it, so the live rate is free by the time this paints. The stored rate is the
            fallback for the case where that fetch failed — a slightly stale peso figure beats
            no peso figure — and `trm.until` is what tells us how fresh the live one is. */}
        {p.display_currency === "COP" && (trm?.rate || p.display_fx_rate) && viewCcy !== "COP" && (
          <span className="text-[12.5px] opacity-55">
            ≈ {cop(p.price, trm?.rate ?? Number(p.display_fx_rate))} · {D(lang, "chargedInUsd")}
          </span>
        )}
      </div>

      {/* ⚠️ THE DESCRIPTION MOVED UP, UNDER THE PRICE. 17 September 2026, Lee's order:
          price, then the description, then the attributes, then The space.

          The note that used to sit here argued the opposite — that Airbnb puts the description
          ninth because it is for somebody who has already half decided. That reasoning is sound
          for Airbnb and wrong for OneHome: a row of chips saying "2 bedrooms · 76 m² · furnished"
          is true of ten thousand apartments in Medellín, and the owner's own sentences are the
          only thing on the page that says which one this is. Lee asked for it, and the argument
          for it is better than the argument that was written against it.

          It keeps its heading. An unlabelled paragraph reads as something that escaped from
          somewhere else, which is what he said about it on 16 September. */}
      {/* ⚠️ THE PANEL ENDS HERE, AND THE DESCRIPTION GETS ITS OWN. Lee, 20 September 2026:
          *"I will put the description into a separate box. It seems like it belongs in a separate
          box. It's almost like it gets lost… why not put three white panels? Put a panel around
          the price and everything. Put a panel around the property description."*

          He is right, and the reason is what a panel is FOR. One panel says "these things are one
          thought". The number, the stars and the price are one thought — what is this and what
          does it cost. The host's own sentences are a different kind of thing entirely: they are
          the only text on the page written by a person rather than assembled from fields, and
          burying them in the same box as the price made them read as a caption on the price. */}
      </section>

      {p.description && (
        <section className="card mt-3">
          <h3 className="text-[11.5px] font-black uppercase tracking-wide opacity-45">{D(lang, "descTitle")}</h3>
          <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed">
            {xlOn ? tr(xl, "description", p.description) : p.description}
          </p>
          {/* ⚠️ THE MARK LIVES WITH THE TEXT, NOT IN A SETTING. It appears only when something was
              actually translated — a Spanish listing read on the Colombia flag shows nothing at
              all, because nothing happened. And it is a switch, not a notice: whoever wants the
              host's own sentence is one tap from it, in both directions. */}
          {xl.translated && (
            <button type="button" onClick={() => setShowSource(v => !v)}
              className="ow-tap mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-bold opacity-55 underline decoration-dotted underline-offset-4">
              <IconGlobe size={11} />
              {showSource ? D(lang, "showTranslated") : D(lang, "autoTranslated")}
              {!showSource && <span className="opacity-70">· {D(lang, "showOriginal")}</span>}
            </button>
          )}
        </section>
      )}

      {/* ⛔ THE ATTRIBUTE PILLS ARE GONE FROM HERE. 18 September 2026. Guests, bedrooms,
          bathrooms, square metres, furnished and the minimum stay moved into "The space", where
          they belong — see `coreSpaceRows` in lib/amenities.ts for Lee's reasoning and for the
          two labels that were deleted outright rather than moved ("Rented by the month" and
          "Available from"). What is left in this panel is the two questions a listing is opened
          with: is it any good, and what does it cost. */}

      {/* ── WHAT THIS PLACE HAS (Airbnb audit A4, 14 Aug 2026) ──────────────────────────────
             We filter on twenty-six attributes and used to display none of them: somebody could
             narrow a search to "air conditioning in the master bedroom", open the result, and find
             no mention of air conditioning anywhere on the page.

             Six rows, then the rest behind a tap — their shape, and it is right, because the list
             is long and the first six are the ones people scan for. Anything the host said this
             place does NOT have is struck through rather than left out, so silence never has to
             be interpreted. */}
      <Amenities p={p} lang={lang} />

      {/* ── HOUSE RULES — NUMBERED, NOT BULLETED ────────────────────────────────────────────
          Lee, 17 September 2026: *"when they show up, they show up as bullets — not bullets, but
          like one, two, three, four, five."* A numbered list, because a rule you can point at by
          number is a rule two people can talk about. Absent entirely when the host set none:
          an empty "House rules" heading says the host was careless when they simply had none. */}
      {Array.isArray((p as any).house_rules) && (p as any).house_rules.length> 0 && (
        <section className="card mt-3 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{D(lang, "houseRules")}</h2>
          <ol className="mt-2 space-y-1.5">
            {/* Translated line for line, and only when the count matches — see `trList`. A
                rulebook that came back with four rules instead of five is not a translation. */}
            {(xlOn ? trList(xl, "house_rules", (p as any).house_rules as string[]) : ((p as any).house_rules as string[])).map((rule, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                <span className="shrink-0 font-black opacity-45">{i + 1}.</span>
                <span className="min-w-0 break-words">{rule}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── THE AGENT ────────────────────────────────────────────────────────────────────── */}
      {agent && (
        <Link to={productHref("onerental", `/p/${p.agent_id}`)}
          className="card ow-tap mt-3 flex items-center gap-3 p-3">
          <Avatar src={agent.photo_url} name={agent.full_name} size={44} rounded="rounded-full" textSize="text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-bold">{agent.full_name}</p>
            {agent.job_title && <p className="truncate text-[12px] opacity-55">{agent.job_title}</p>}
          </div>
          <ScoreDonut score={agent.score_v9_snapshot == null ? null : Number(agent.score_v9_snapshot)} size={44} />
        </Link>
      )}

      {/* ── WHO AM I DEALING WITH (Airbnb audit A9) ─────────────────────────────────────────
             OneScore is the number, and it stays the number. This is everything around it —
             how long they have been here, how many places they list, and whether they answer.
             It draws NOTHING until each fact is earned: under three judged conversations there
             is no response figure at all, because a new platform promising "replies within an
             hour" for somebody who has never had a message is a promise the first guest tests. */}
      {agent && (
        <HostTrust hostId={p.agent_id} lang={lang} listingCount={hostListings ?? null} />
      )}

      {/* ⚠️ THIS SAT ABOVE THE HOST AND LEE ASKED TWICE FOR IT TO SIT BELOW. 16 Sep 2026: *"Where
          it says how this is protected, that belongs below the actual host information. So if the
          host is Lee Frazier, you put Lee Frazier, about this host, all that. And then below that
          you say how this property is protected."*

          The order is an argument: who am I dealing with, THEN what backs the arrangement up.
          Protection reassures you about a person you have already met; leading with it answers a
          question nobody has asked yet. */}
      {/* ⚠️ THIS WAS A FULL OPEN SECTION AND LEE IS RIGHT THAT IT SHOULD NOT BE. 16 Sep 2026:
          *"You don't need to have all that damage cover and house protected as a section —
          Airbnb doesn't have all that. It could just say Deposit, and on the right side it's
          going to say none or an amount."*

          The COLLAPSED line answers the only question most readers have: is money being asked for
          up front, and how much. Everything inside — the covers, the law, the photographs promise
          — is what somebody reads once they have decided they care, and it is all still here,
          one tap away, unchanged.

          ⚠️ The summary must never say "none" when a deposit IS required and we simply have no
          amount. Absent and zero are different facts and a listing page is not the place to
          guess. */}
      <Fold
        title={D(lang, "howProtected")}
        note={p.deposit_required
          ? (p.deposit_amount != null
              ? fmtMoney(p.deposit_amount, p.deposit_currency || (p.currency === "COP" ? "COP" : "USD"), { cents: (p.deposit_currency || p.currency) !== "COP" })
              : undefined)
          : D(lang, "depositNone")}>
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {/* heading moved to the fold's summary line */}
        </h2>
        <Promise text={D(lang, "signRealContract")} />
        {/* ── DISCLOSURE TWO OF TWO — the tenant's copy ──────────────────────────────────
            The host acknowledged the law on the listing form. This is the same fact told to the
            person it actually protects, on the screen where they decide, not buried in terms.

            ⚠️ WHAT THIS LINE USED TO SAY: *"The $X deposit is held — the lease does not start
            until it is actually in."* Every clause of that was a problem. "Is held" claims we
            hold it, which is a custody role we have no licence for. "The lease does not start
            until it is in" makes a void payment a condition of a contract — and under Ley 820
            de 2003 Art. 16 the tenant can demand that money back the day after they pay it,
            which would leave the sentence promising the lease then stops. We say the opposite
            now, in the tenant's favour, because it is both the truth and the better pitch. */}
        {p.deposit_required && p.deposit_amount != null && (
          <>
            <Promise text={D(lang, "hostAsksDeposit", {
              amount: fmtMoney(p.deposit_amount, p.deposit_currency || (p.currency === "COP" ? "COP" : "USD"), { cents: (p.deposit_currency || p.currency) !== "COP" }),
              ccy: (p.deposit_currency || p.currency || "USD").toUpperCase(),
            })} />
            {depositOpposite && (
              <p className="pl-6 text-[12px] font-semibold tabular-nums opacity-60" aria-label={D(lang, "depositConv")}>
                {depositOpposite}
              </p>
            )}
            <button type="button" onClick={() => setDepositLawOpen(true)} className="ow-tap flex w-full items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3 text-left text-[12px] font-bold">
              <Info size={17} className="shrink-0" />{D(lang, "depositInfo")}
            </button>
          </>
        )}

        {depositLawOpen && (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-5" role="dialog" aria-modal="true" aria-labelledby="deposit-law-title">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3"><h2 id="deposit-law-title" className="text-lg font-black">{D(lang, "depositCoTtl")}</h2><button type="button" onClick={() => setDepositLawOpen(false)} aria-label={D(lang, "close")}><X/></button></div>
              <p className="mt-3 text-sm leading-relaxed opacity-75">{D(lang, "depositLawBody")}</p>
              <button type="button" onClick={() => setDepositLawOpen(false)} className="btn-brand mt-5 w-full">{D(lang, "gotIt")}</button>
            </div>
          </div>
        )}

        {/* ── DAMAGE COVER — what the tenant pays INSTEAD of a deposit ─────────────────────
            Priced from the same constants the host's form quoted. Struck through and labelled
            while cover is unplaced: the flow is real, the charge is not live yet, and the tenant
            is told which. Never the word "insured" — see shell/lib/cover.ts. */}
        {(p as any).guarantee_kind === "insurance" && (
          <div className="rounded-xl border border-ink/12 p-3 dark:border-white/15">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-bold">
                {lang === "es" || lang === "co" ? DAMAGE_COVER.title.es : DAMAGE_COVER.title.en}
              </span>
              <span className={`text-[14px] font-black ${COVER_LIVE ? "" : "line-through opacity-45"}`}>
                {usd2(coverFee(Number(p.price) || 0, DAMAGE_COVER))}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed opacity-70">
              {D(lang, "noDeposit") + " "}
              {coverLimits(lang, DAMAGE_COVER, usd2)}{" "}
              {lang === "es" || lang === "co" ? DAMAGE_COVER.excludes.es : DAMAGE_COVER.excludes.en}
            </p>
            {!COVER_LIVE && (
              <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">
                {lang === "es" || lang === "co" ? PENDING_NOTE.es : PENDING_NOTE.en}
              </p>
            )}
          </div>
        )}

        {/* ── LIABILITY: WHAT THE HOST TOLD US, LABELLED AS EXACTLY THAT ──────────────────
            Not "verified". Not "covered". The host said it, we are repeating it, and we say so in
            the same sentence — because `one-world-counsel` is explicit that "verified" claims a
            check we did not perform, and this is a check we deliberately do not perform.
            Naming the insurer and the amount is what makes it useful to a tenant; naming the
            SOURCE of the claim is what keeps it honest. */}
        {(p as any).liability_attested && (
          <Promise text={
            (lang === "es" || lang === "co" ? LIABILITY_COPY.tenantLine.es : LIABILITY_COPY.tenantLine.en)
            + ((p as any).liability_insurer
                ? " " + D(lang, "insurer", { name: (p as any).liability_insurer })
                : "")
            + ((p as any).liability_amount_usd
                ? " " + D(lang, "statedCover", { amount: usd2(Number((p as any).liability_amount_usd)) })
                : "")
          } />
        )}

        {/* Lee's differentiator, stated to the tenant in the words that matter to them. The
            sentence used to end "…out of your deposit", which stopped being true the moment a
            listing could be secured three different ways. It is the PHOTOS that are the promise,
            not the instrument. */}
        <Promise text={D(lang, "photosBeforeMoveIn")} />
      </Fold>


      {/* ── ONE CONTROL, THREE STATES (17 September 2026) ──────────────────────────────────
          Lee found "Proposal sent, waiting for host to accept" sitting next to a live
          "Request a showing" button on the same screen. Mutually exclusive things offered at the
          same time. The three actions are one control now, and a live booking request quiets the
          other two rather than leaving them to be pressed. See `ListingActions.tsx`. */}
      {!mine && userId && p.status === "published" && (
        <section className="card mt-3 space-y-3 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {D(lang, "askAboutPlace")}
          </h2>

          {/* ⚠️ ALWAYS HERE. It was hidden while a booking request was open, which left a
              "Send message" button with nothing to type into — and messaging is the one action
              that is never paused, precisely because a person with a live request is the person
              most likely to need to reach a human. */}
          <textarea id="ow-ask-box" className="input min-h-[84px] w-full" value={note} onChange={e => setNote(e.target.value)}
            placeholder={D(lang, "stillAvailable", { title: p.title })} />

          <ListingActions
            lang={lang}
            showingsOn={!!(p as any).showings_enabled && (p as any).showing_notice_hours != null}
            showingBlocked={showingBlocked}
            bookingBlocked={bookingBlocked}
            busy={booking}
            sending={sending}
            note={showingBlocked ? D(lang, "showingClosed")
                 : bookingBlocked ? D(lang, "bookingOpen") : undefined}
            onMessage={() => void ask()}
            onShowing={() => setShowingOpen(true)}
            /* ⚠️ THE WARNING FIRES BEFORE THE REQUEST, not after it. Afterwards it is an excuse;
               before it, it is the one piece of information that changes what somebody does.
               Skipped entirely where the host takes no viewings — there is nothing to lose. */
            onBook={() => {
              setErr(null);
              if ((p as any).showings_enabled && (p as any).showing_notice_hours != null && !showingBlocked) {
                setSeeFirst(true); return;
              }
              startBooking();
            }}
          />

          {err && <p className="text-[12px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
        </section>
      )}

      {!mine && !userId && (
        <section className="card mt-3 space-y-2 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {D(lang, "contactAgent")}
          </h2>
          <p className="text-[13px] leading-relaxed opacity-65">
            {D(lang, "signInToMessage")}
          </p>
          <Link to={productHref("onerental", "/profile")} className="btn-primary block w-full text-center">
            {D(lang, "signInContact")}
          </Link>
        </section>
      )}

      {/* The sheet keeps the listing behind it: somebody choosing a viewing time is still deciding,
          and the thing they want to glance at while choosing is the listing. */}
      {showingOpen && (
        <ShowingRequest
          propertyId={p.id}
          hostId={p.agent_id}
          notice={Number((p as any).showing_notice_hours ?? 24)}
          slotMinutes={Number((p as any).showing_slot_minutes ?? 30)}
          onClose={() => setShowingOpen(false)}
          onMessage={() => { document.querySelector("textarea")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />
      )}

      {seeFirst && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
          role="dialog" aria-modal="true" aria-labelledby="ow-seefirst-title">
          <button type="button" aria-label={D(lang, "close")} className="absolute inset-0 cursor-default"
            onClick={() => setSeeFirst(false)} />
          <section className="relative z-10 w-full max-w-md rounded-t-[28px] border border-white/35 bg-white/95 p-5 dark:border-white/15 dark:bg-slate-950/95 sm:rounded-[28px]">
            <h2 id="ow-seefirst-title" className="text-xl font-black">{D(lang, "seeFirstTitle")}</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed opacity-75">{D(lang, "seeFirstBody")}</p>
            <button type="button" className="btn-primary mt-4 w-full"
              onClick={() => { setSeeFirst(false); setShowingOpen(true); }}>
              {D(lang, "seeFirstGo")}
            </button>
            <button type="button" className="btn-ghost mt-2 w-full" onClick={startBooking}>
              {D(lang, "seeFirstSkip")}
            </button>
          </section>
        </div>
      )}

      {/* ── ASKING FOR A MONTH ─────────────────────────────────────────────────────────────
          A monthly listing has no nightly calendar, so "Request a booking" needs somewhere to
          say WHICH month. This is that, and nothing else: one field, one label, one button.
          It used to be buried inside a panel that also carried a renewal dashboard and a
          move-out notice form, on a page belonging to people who have neither. */}
      {monthOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label={D(lang, "close")} className="absolute inset-0 cursor-default" onClick={() => setMonthOpen(false)} />
          <section className="relative z-10 max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/35 bg-white/95 p-5 dark:border-white/15 dark:bg-slate-950/95 sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black">{D(lang, "requestBooking")}</h2>
              <button type="button" onClick={() => setMonthOpen(false)} aria-label={D(lang, "close")}
                className="ow-tap grid h-10 w-10 shrink-0 place-items-center rounded-full"><X size={20} /></button>
            </div>
            <label className="mt-4 block text-sm font-bold">
              {W(lang, "First month", "Primer mes")}
              <input aria-label={W(lang, "First month", "Primer mes")} type="month" value={month}
                onChange={e => setMonth(e.target.value)} className="field mt-1 w-full" />
            </label>
            <button type="button" className="btn-primary mt-4 w-full" disabled={!month}
              onClick={() => {
                try {
                  const stay = monthlyStay(month + "-01", p.price);
                  setMonthOpen(false); setMonthlyRequest(true); setPendingStay(stay); setErr(null);
                } catch (e: any) { setErr(e.message); }
              }}>
              {D(lang, "requestBooking")}
            </button>
          </section>
        </div>
      )}

      {pendingStay && (
        <RentalRequestSheet
          lang={lang} stay={pendingStay} money={n => monthlyRequest ? new Intl.NumberFormat(lang==='es'?'es-CO':'en-US',{style:'currency',currency:p.currency || 'COP'}).format(n) : drawPrice(n, viewCcy, trm?.rate)} monthly={monthlyRequest}
          hostPaysGuestFee={p.host_pays_guest_fee}
          hostRails={hostRails}
          property={p}
          cleaningFee={(p as any).cleaning_fee ?? null}
          guestFeeRate={feePreview ? Number(feePreview.guest_fee_rate) : undefined} waived={!!feePreview?.waived}
          busy={booking} error={err} onClose={() => { if (!booking) setPendingStay(null); }}
          onSubmit={submitRentalRequest} />
      )}

      {ownerView && (
        /* Lee, 11 Aug 2026: *"Another example of that keep editing thing is where you have my
           properties and draft a contract. Same thing."* Two words against two, at the same size,
           in half a phone: one broke to a second line and grew, the other did not, so the pair sat
           at two different heights. Same fix as StickyActions — no wrap, allowed to shrink, and a
           font size that clamps down on a narrow screen instead of adding a line. */
        <div className="mt-3">
          <Link to={productHref("onerental", `/r/${p.id}/contract`)}
            className="btn-primary block w-full text-center text-[clamp(13px,3.6vw,15px)]">
            {D(lang, "reviewRequests")}
          </Link>
        </div>
      )}

      {ownerView && (
        /* Separate row rather than a third button on the pair above: three across is where labels
           start wrapping again, which is the defect Lee flagged twice. */
        <Link to={productHref("onerental", `/r/${p.id}/payments`)}
 className="ow-edge ow-tap mt-2 flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3">
          <span className="min-w-0">
            <span className="block text-[13.5px] font-bold">
              {D(lang, "setUpPayments")}
            </span>
            <span className="block text-[11.5px] leading-snug opacity-55">
              {D(lang, "agreeAmounts")}
            </span>
          </span>
          <span className="shrink-0 text-[13px] opacity-40">›</span>
        </Link>
      )}

      {/* ── THE HISTORY ────────────────────────────────────────────────────────────────────
          Two records on one panel: what the registry says this folio actually sold for, and what
          OneHome has watched it be advertised at. The second exists nowhere else in Colombia —
          nobody was keeping it — and the first was unreachable from a rental until 12 Aug 2026,
          because the rental table had no `matricula_inmobiliaria` column and the rental form
          never asked for one. Both fixed; this is the read side of that.

          The panel is ALWAYS rendered now, even with nothing to report. Lee could not find the
          feature precisely because it hid itself whenever it had no good news. */}
      {/* ⚠️ ONE SECTION, NOT TWO. Lee: *"Property history and comparables really should be one
          expandable collapsible section instead of two."* They answer the same question — what is
          this place worth, and on what evidence — so two separate rows made a reader open two
          things to get one answer, and left them wondering what the difference was. */}
      <Fold title={D(lang, "historyAndComps")}>
        <PropertyHistoryPanel
          listingKind="rental" listingId={p.id}
          matricula={p.matricula_inmobiliaria}
          areaM2={p.area_m2} currency={p.currency} lang={lang} />
        <SimilarUnits neighbourhood={p.neighbourhood} city={p.city} lang={lang} />
      </Fold>

      {/* Comparables — stamped "coming soon" rather than filled with places that are not
          actually comparable. Lee, 12 Aug 2026. */}


      {/* v77 · U12 · Comments removed from property listings. Reviews take this space. */}

      <p className="mt-6 text-center text-[11px] leading-relaxed opacity-45">
        {D(lang, "payoutTiming", { first: PAYOUT_FIRST_DAYS, later: PAYOUT_LATER_DAYS })}
      </p>

      {/* ══ THE BOOKING BAR — the missing mount (Airbnb audit A1 to A3, 14 Aug 2026) ═══════
             The reservation engine has been finished and passing its harnesses since 13 August,
             and nothing in the product imported a line of it. This is the whole of what was
             missing: dates, a live total, the price shown as arithmetic, and something to press.
             It stays pinned to the foot of the phone the entire way down the page, which is the
             one rule underneath almost every Airbnb pattern — never make somebody scroll to find
             out whether they can act.

             Last in the markup, first on the screen. It renders only where a stay can actually be
             booked: not on your own listing, and not on one that is not live. */}
      {!mine && p.status === "published" && p.price_unit === "night" && (
        <BookingBar
          lang={lang}
          earliestSelectableDate={p.id === "b8334d28-9200-4abb-b37a-716241ac09cb" && ["eeb6bced-c34b-4c73-8e3a-bd0498fe1b6c", "95692fe9-e1d3-4f89-9c50-b50e276b738d"].includes(userId ?? "") ? "2026-08-29" : undefined}
          /* ⚠️ THE ONLY TWO-LANGUAGE STRING LEFT ON THIS SCREEN, AND IT IS DELIBERATE.
              This is the hardcoded August proration and six-month commitment note pinned to
              one listing id and two user ids. Max ruled it a separate finding with an existing
              owner - *"Monthly August/six-month applicability remains separate with existing
              owner"* - so translating it into seven languages would be dressing up a note that
              should not be hardcoded at all. It stays in two languages until it is removed,
              and the locale guard asserts that it is the ONLY one, so a new two-language
              string cannot hide behind it. */
          existingStayNote={p.id === "b8334d28-9200-4abb-b37a-716241ac09cb" && ["eeb6bced-c34b-4c73-8e3a-bd0498fe1b6c", "95692fe9-e1d3-4f89-9c50-b50e276b738d"].includes(userId ?? "") ? W(lang,
            "Existing stay: August 29 onward is available. For September rent, select September 1 and October 1 (checkout). August proration is separate.",
            "Estadía existente: disponible desde el 29 de agosto. Para septiembre, seleccione el 1 de septiembre y el 1 de octubre (salida). El prorrateo de agosto es aparte.") : undefined}
          rules={stayRules}
          booked={booked ?? []}
          restingLabel={priceLabel(p, lang, viewCcy, trm?.rate)}
          money={n => drawPrice(n, viewCcy, trm?.rate)}
          mode="request"
          cancelLine={D(lang, "cancelPolicy")}
          busy={booking}
          openSignal={openBooking}
          onReserve={requestToBook}
        />
      )}

      {/* ── PINNED, ON EVERY LISTING ────────────────────────────────────────────────────────
          Last in the markup, first on the screen — the same rule as the booking bar, and it
          clears the booking bar by measurement rather than by a guessed number. Only for a
          signed-in person looking at somebody else's live listing: on your own listing the
          actions below are the owner's, and signed out there is a sign-in card instead. */}
      {!mine && userId && p.status === "published" && (
        <ListingContactBar
          messageLabel={D(lang, "barMessage")}
          showingLabel={(p as any).showings_enabled && (p as any).showing_notice_hours != null && !showingBlocked
            ? D(lang, "barShowing") : undefined}
          onMessage={goToAsk}
          onShowing={() => setShowingOpen(true)}
          busy={sending} />
      )}

      {previewing && (
        <PublishGate lang={lang} busy={publishing} error={publishError}
          errorAction={hostSetupNeeded ? <Link className="btn-primary block text-center" to={productHref("onerental", `/host-profile?return=${encodeURIComponent(`/rentals/r/${p.id}?preview=1`)}`)}>{W(lang, "Complete host profile", "Completar perfil de anfitrión")}</Link> : undefined}
          onBack={() => nav(productHref("onerental", `/list?edit=${p.id}&form=1&step=when`))}
          onPublish={() => void publishNow()} />
      )}
    </div>
  );
}

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-2.5 py-1 text-[12px] font-semibold opacity-75 dark:border-white/15">
      {children}
    </span>
  );
}

/**
 * WHAT THIS PLACE HAS — six rows, then the rest behind a tap.
 * ============================================================================================
 * Six is Airbnb's number and it is a good one: enough to answer the common questions, short
 * enough that nobody scrolls past it. Anything the host explicitly said this place does NOT have
 * is drawn struck through rather than omitted, because a missing row is ambiguous — it could mean
 * "no balcony" or "the host skipped that question" — and those are different facts.
 *
 * Anything the host never answered is not drawn at all. Three states, two of them shown.
 */
function Amenities({ p, lang }: { p: Property; lang: string }) {
  /* ⚠️ THIS WAS `useState(true)` AND IT IS WHY THE PAGE STILL OPENED FULLY EXPANDED. Lee, twice:
     *"It should only show The space, and everything beyond that they can click show more."*
     I built the grouping and then defaulted the switch to the wrong position, so the work was
     invisible. Collapsed is the default; The space is what you land on. */
  const [all, setAll] = useState(false);
  const rows = amenityRows(p, lang);
  if (rows.length === 0) return null;

  /* ⚠️ CLOSED IT IS "THE SPACE", NOT "THE FIRST SIX OF EVERYTHING". Lee: *"By default it should
     be collapsed to where you can only see The space — the basic stuff — and then you put show
     more and then you see the inside, outside and the building and everything else."*

     Slicing the first six was arbitrary: it cut wherever the list happened to end, so one listing
     showed two outdoor facts and the next showed none, for no reason a reader could see. A GROUP
     is a reason. The space is what somebody needs to decide whether to keep reading; the rest is
     detail they open when they have. */
  const GROUPS = ["space", "inside", "outside", "building", "rules"] as const;
  const groups = (all ? GROUPS : (["space"] as const))
    .map(g => ({ g, items: rows.filter(r => r.group === g) }))
    .filter(x => x.items.length> 0);
  const hiddenCount = rows.filter(r => r.group !== "space").length;

  return (
    /* ⚠️ ON A PANEL, LIKE EVERYTHING ELSE. 17 September 2026. The amenity groups were the last
       block of real content on this page still printed straight onto the page background, so
       after the head of the page got its panel, "THE SPACE" was the one heading left floating.
       Same `card` as its neighbours — nothing else about the section changed. */
    <section className="card mt-4">
      {/* ⚠️ THE HEADING IS GONE. Lee: *"Take that header off where it says what this place has.
          That's unnecessary — you already have The space, and then below that you have inside,
          outside, and the building."* A heading whose only job is to introduce headings is a line
          of type that tells a reader nothing they were not about to be told anyway. */}

      {groups.map(({ g, items }) => (
            <div key={g} className="mt-4 first:mt-0">
              <h3 className="text-[11.5px] font-black uppercase tracking-wide opacity-45">
                {GROUP_TITLE(g, lang)}
              </h3>
              {/* v76 · R30 · TWO COLUMNS AT EVERY WIDTH, NOT ONLY ON A LAPTOP.
                  This said `sm:grid-cols-2`, and `sm:` is 640 pixels — wider than any phone — so
                  the rule never fired and the right-hand half of the screen sat empty.
                  The gap between the COLUMNS is wider than the gap between the ROWS on purpose,
                  so the eye reads down a column instead of drifting across the gutter. */}
              <ul data-ow="amenity-grid" className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2">
                {items.map(r => <AmenityRow key={r.key} text={r.text} has={r.has} />)}
              </ul>
            </div>
          ))}

      {/* ⚠️ THE ATTRIBUTES WERE NEVER MISSING — THIS CONTROL WAS INVISIBLE. Lee, 20 September
          2026, after checking his own listing in the edit form: *"the building age is selected,
          total floors are selected, parking space is selected, air conditioning selected, sleeps
          three is selected, estrato one is selected… so I can verify that the information was
          selected, but somehow it's not showing on the listing."*

          It was showing. It was behind this button, and this button was thirteen pixels of
          underlined grey text at seventy percent opacity — the exact species of not-quite-a-
          control that the whole contrast pass in batch 44 existed to kill, and I left this one
          standing. A reader who cannot see the door concludes there is no room behind it, and
          that is precisely the conclusion Lee reached about his own data.

          It is a real button now, full width, with an edge, and it SAYS HOW MANY are behind it.
          "Show all property details" is a description of a control; "14 more details" is a
          reason to press it. The count also makes the collapse honest: if the number is small,
          the reader knows not to bother. */}
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setAll(v => !v)}
          aria-expanded={all}
          className="ow-tap ow-edge mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[13.5px] font-black">
          {all
            ? D(lang, "showLess")
            : hiddenCount === 1 ? D(lang, "oneMoreDetail") : D(lang, "moreDetails", { n: String(hiddenCount) })}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden
            className={`transition ${all ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </section>
  );
}

function AmenityRow({ text, has }: { text: string; has: boolean }) {
  return (
    <li className="flex min-w-0 items-start gap-2 text-[13.5px] leading-snug">
      <span className={`mt-0.5 shrink-0 ${has ? "text-brand" : "opacity-35"}`}>
        <IconCheck size={14} />
      </span>
      {/* v76 · `min-w-0` + `break-words` so a long label wraps inside its own column instead of
          widening it. Without this the two columns come out uneven and the change looks worse
          than the single column it replaced. */}
      <span className={`min-w-0 break-words ${has ? "opacity-85" : "line-through opacity-40"}`}>{text}</span>
    </li>
  );
}

function Promise({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-snug">
      <span className="mt-0.5 shrink-0 text-brand"><IconCheck size={14} /></span>
      <span className="opacity-85">{text}</span>
    </p>
  );
}

/* v77 · U12 · The screen's dead private Comments component is removed. It inserted
   into rental_property_comments, whose INSERT policy is broken, and nothing called it. */
