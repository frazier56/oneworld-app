import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Gallery, ListingEngagement, appDoorway, fmtMoney, ScreenHeading,
  Avatar, ScoreDonut, useI18n, useOneId, useAsync, supabase, productHref, W,
  IconPin, IconCheck, IconChat, IconCalendar, startConversation,
  PropertyHistoryPanel, SimilarUnits, CurrencyPicker, useViewerCcy, fetchTrm, type Trm,
  BookingBar, HostTrust, drawPrice, type StayRules, type Booked,
  /* The tenant's half of the deposit decision, and the two covers. Same constants the host's
     form used, so the two sides of the same listing cannot describe the same money differently. */
  COVER_LIVE, PENDING_NOTE, DAMAGE_COVER, LIABILITY_COPY, coverFee, coverLimits,
  ShowingRequest,
} from "@oneworld/shell";
import {
  type Property, PROPERTY_COLUMNS, priceLabel, cop, usd2, rentalError, PAYOUT_FIRST_DAYS, PAYOUT_LATER_DAYS,
} from "../lib/rental";
import { amenityRows, GROUP_TITLE } from "../lib/amenities";
import { Info, X } from "lucide-react";
import RentalRequestSheet, { type RentalRequestDetails } from "../components/RentalRequestSheet";
import MyRequestCard from "../components/MyRequestCard";
import PublicVideoViewer from "../components/PublicVideoViewer";
import { orderedPhotos } from "../lib/media";
import MonthlyRentalPanel from "../components/MonthlyRentalPanel";
import { monthlyTerms } from '../lib/monthly';

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
export default function PropertyDetail() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [sending, setSending] = useState(false);
  const [showingOpen, setShowingOpen] = useState(false);
  const [depositLawOpen, setDepositLawOpen] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  /* The reader's currency, and the official rate to draw it at. */
  const [viewCcy] = useViewerCcy();
  const [trm, setTrm] = useState<Trm | null>(null);
  useEffect(() => { void fetchTrm().then(setTrm); }, []);

  const p = useAsync(async () => {
    const { data } = await supabase.from("rental_properties")
      .select(PROPERTY_COLUMNS).eq("id", id).maybeSingle();
    return (data as unknown as Property) ?? null;
  }, [id]);

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
        setErr(W(lang, "Stripe returned, but the authorization could not be verified. Your card will not be captured until this is resolved.", "Stripe regresó, pero no se pudo verificar la autorización. Su tarjeta no se cobrará hasta resolverlo."));
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
      W(lang, `Hi — is "${p.title}" still available?`, `Hola — ¿"${p.title}" sigue disponible?`);
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
    const request = (Array.isArray(requestData) ? requestData[0] : requestData) as { id: string } | null;
    if (error) { setErr(rentalError(error as any, lang)); setBooking(false); return; }
    if (!request) { setErr(W(lang, "The request could not be saved. Try again.", "No se pudo guardar la solicitud. Reintente.")); setBooking(false); return; }

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
          ? W(lang, "Your ID could not be uploaded, and OneHome could not confirm that the draft request was removed. Do not submit again; reopen this listing and check the existing request first.", "No se pudo cargar su identificación y OneHome no pudo confirmar que se eliminó la solicitud en borrador. No vuelva a enviarla; abra de nuevo este anuncio y revise primero la solicitud existente.")
          : W(lang, "Your ID could not be uploaded, so the request was not submitted. Please try again.", "No se pudo cargar su identificación, por lo que la solicitud no se envió. Inténtelo de nuevo."));
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
        setErr(W(lang, "Your request was saved, but OneHome could not confirm the ID record. The private upload was preserved. Do not submit again; reopen this listing and check the existing request first.", "Su solicitud se guardó, pero OneHome no pudo confirmar el registro de identificación. Se conservó la carga privada. No vuelva a enviarla; abra de nuevo este anuncio y revise primero la solicitud existente."));
        setBooking(false);
        return;
      }
      const { error: submittedError } = await supabase.rpc("mark_rental_identity_submitted", { p_request_id: request.id });
      if (submittedError) {
        /* The request row, exact document row and private object are already saved. A transport
           failure here is ambiguous: the state transition may have committed. Preserve all three
           so no retained metadata can point at a deleted identity object, and tell the guest not
           to create a duplicate request. */
        setErr(W(lang, "Your request and private ID were saved, but OneHome could not confirm that identity review started. Do not submit again; reopen this listing and check the existing request.", "Su solicitud y su identificación privada se guardaron, pero OneHome no pudo confirmar que inició la revisión de identidad. No vuelva a enviarla; abra de nuevo este anuncio y revise la solicitud existente."));
        setBooking(false);
        return;
      }
    }

    // The database creates the request message and selected channel alerts atomically.
    setBooking(false);
    setPendingStay(null);
    nav(productHref("onerental", `/r/${p.id}?request=${request.id}`));
    } catch {
      setErr(W(lang, "OneHome could not confirm the request's latest state. Do not submit again; reopen this listing and check for the existing request first.", "OneHome no pudo confirmar el estado actual de la solicitud. No vuelva a enviarla; abra de nuevo este anuncio y revise primero si existe la solicitud."));
    } finally {
      setBooking(false);
    }
  }

  /** Nightly listings use the stay calendar. Monthly listings use MonthlyRentalPanel below so a
   * 31- or 32-day calendar span can never inflate one agreed calendar month's rent. */
  const stayRules: StayRules = useMemo(() => ({
    base: p?.price ?? 0,
    minNights: p?.min_term_days && p.min_term_days > 1 ? p.min_term_days : null,
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
        <p className="text-sm font-bold">{W(lang, "This listing is gone.", "Este anuncio ya no está.")}</p>
        <Link to={productHref("onerental")} className="btn-ghost mt-4 inline-block">
          {W(lang, "Back to the feed", "Volver al feed")}
        </Link>
      </div>
    );
  }

  const where = [p.neighbourhood, p.city].filter(Boolean).join(", ");
  const depositCurrency = (p.deposit_currency || (p.currency === "COP" ? "COP" : "USD")).toUpperCase();
  const depositOpposite = p.deposit_required && p.deposit_amount != null && trm?.rate
    ? depositCurrency === "COP"
      ? `≈ ${fmtMoney(Number(p.deposit_amount) / trm.rate, "USD", { cents: true })} USD`
      : `≈ ${fmtMoney(Number(p.deposit_amount) * trm.rate, "COP", { cents: false })} COP`
    : null;

  return (
    <div className="space-y-4">
      <ScreenHeading>{W(lang, "Home details", "Alojamiento")}</ScreenHeading>
      {booked?.some(b=>b.starts_on<=new Date().toISOString().slice(0,10)&&b.ends_on>new Date().toISOString().slice(0,10)) && <p className="rounded-xl border border-brand/20 bg-brand/10 p-3 text-sm font-bold">{W(lang,'Currently reserved — ask the host about future availability. Existing reservations remain protected.','Actualmente reservado — consulte al anfitrión por disponibilidad futura. Las reservas existentes siguen protegidas.')}</p>}
      {userId && !mine && <MyRequestCard propertyId={p.id} userId={userId} lang={lang} />}

      {/* ── VIDEO FIRST (7 Sep 2026, media lane) ──────────────────────────────────────────────
          When the host uploaded public videos they lead the page: a walk-through says more in
          ten seconds than forty stills, and a reader who came from a video lead in the feed
          expects to land on the video, not scroll past a gallery to find it. Listings with no
          video render exactly as before — the viewer returns null and the gallery leads. */}
      {(p.videos?.length ?? 0) > 0 && (
        <PublicVideoViewer videos={p.videos ?? []} title={p.title} lang={lang}
          contactHref={userId ? productHref("onerental", `/messages?property=${p.id}`) : productHref("onerental", "/profile")} />
      )}
      {/* ── PHOTOS ───────────────────────────────────────────────────────────────────────────
          The shared `Gallery`, which is where Lee's three viewing states live: one cover photo,
          "See all" at a density the reader picks, and a fullscreen swipe reached by tapping any
          of them. The old version here was a single horizontal strip — the one shape he said was
          not enough on its own for *"twenty, thirty or forty pictures"*.

          The engagement row is passed IN as the gallery's footer so it travels into the fullscreen
          viewer too: somebody should be able to like or send a place while they are looking at the
          photographs, not only after closing them. */}
      <Gallery
        /* Cover first: the host's chosen still leads the strip and is what "See all" opens on.
           `orderedPhotos` is every photo, reordered — nothing is hidden. */
        photos={orderedPhotos(p)} lang={lang} alt={p.title}
        footer={
          /* v92.3 · U37 · Lee: *"you don't need the comment section. You just need the like
               and share button."* Share STAYS on the listing — it is the CARD that loses it, v90.
               ⚠️ onComments is still passed with the button gone: inside ListingEngagement that
               prop is what makes the count query SKIP media_comments. Drop it and this screen
               runs a count for a button nobody draws. Max's note, from the rent card.
               ⚠️ BARE — no braces — because this sits inside `footer={ … }`.
               Comment syntax in a .tsx file depends on position. v92 put a braced one in the
               ATTRIBUTE position, where JSX reads it as a child, and tsc failed with TS1005. */
          <ListingEngagement
            itemId={p.id} source="rental_property"
            shareUrl={`${appDoorway("onehome")}/r/${p.id}`}
            shareTitle={p.title}
            allowShare={(p as any).allow_public_share !== false}
            hideComments
            onComments={() => {}}
            lang={lang} />
        } />

      {ownerView && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/45 bg-white/40 p-2.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
          <span className={`rounded-full border px-3 py-1 text-[11.5px] font-black ${p.status === "published" ? "border-brand/35 bg-brand/10 text-brand" : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
            {p.status === "published"
              ? W(lang, "Published · Live", "Publicado · Visible")
              : W(lang, "Draft · Private", "Borrador · Privado")}
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <Link to={productHref("onerental", `/list?form=1&edit=${p.id}`)} className="btn-ghost inline-flex items-center gap-2 px-4">
              {W(lang, "Edit", "Editar")}
            </Link>
            {p.status === "published" ? (
              <button type="button" disabled={ownerActionBusy} onClick={() => void unpublishOwnedListing()}
                className="btn-ghost inline-flex items-center gap-2 px-4 disabled:opacity-55">
                {ownerActionBusy ? "…" : W(lang, "Unpublish", "Retirar")}
              </button>
            ) : (
              <Link to={productHref("onerental", `/list?form=1&edit=${p.id}&publish=1`)} className="btn-primary inline-flex items-center gap-2 px-4">
                {W(lang, "Review & publish", "Revisar y publicar")}
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
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {(p as any).listing_no && (
          <span className="rounded-md bg-ink/[0.06] px-2 py-0.5 text-[11.5px] font-black tabular-nums tracking-wide opacity-70 dark:bg-white/10">
            #{(p as any).listing_no}
          </span>
        )}
        {(p as any).updated_at && (p as any).created_at
          && new Date((p as any).updated_at).getTime() - new Date((p as any).created_at).getTime() > 60_000 && (
          <span className="text-[11.5px] font-semibold opacity-45">
            {W(lang, "Edited", "Editado")}{" "}
            {new Date((p as any).updated_at).toLocaleDateString(lang === "en" ? "en-US" : "es-CO",
              { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>
      <h1 className="mt-1 text-[22px] font-black leading-tight tracking-tight">{p.title}</h1>
      {where && (
        <p className="mt-1 flex items-center gap-1.5 text-[13px] opacity-65">
          <IconPin size={13} />{where}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="whitespace-nowrap text-[24px] font-black tracking-tight text-brand">
          {priceLabel(p, lang, viewCcy, trm?.rate)}
        </span>
        {p.display_currency === "COP" && p.display_fx_rate && (
          <span className="text-[12.5px] opacity-55">
            ≈ {cop(p.price, p.display_fx_rate)} · {W(lang, "charged in USD", "se cobra en USD")}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {/* Guests leads the row. A bedroom count does not answer "will the six of us fit". */}
        {p.max_guests != null && (
          <Fact>{p.max_guests} {W(lang, "guests", "huéspedes")}</Fact>
        )}
        {p.bedrooms != null && <Fact>{p.bedrooms} {W(lang, "bedrooms", "habitaciones")}</Fact>}
        {p.bathrooms != null && <Fact>{p.bathrooms} {W(lang, "bathrooms", "baños")}</Fact>}
        {p.area_m2 != null && <Fact>{p.area_m2} m²</Fact>}
        <Fact>{p.furnished ? W(lang, "Furnished", "Amoblado") : W(lang, "Unfurnished", "Sin amoblar")}</Fact>
        {p.available_from && (
          <Fact><IconCalendar size={11} /> {W(lang, "From", "Desde")} {p.available_from}</Fact>
        )}
        {p.min_term_days > 1 && (
          <Fact>{W(lang, `${p.min_term_days} nights minimum`, `mínimo ${p.min_term_days} noches`)}</Fact>
        )}
      </div>

      {/* ── WHAT THIS PLACE HAS (Airbnb audit A4, 14 Aug 2026) ──────────────────────────────
             We filter on twenty-six attributes and used to display none of them: somebody could
             narrow a search to "air conditioning in the master bedroom", open the result, and find
             no mention of air conditioning anywhere on the page.

             Six rows, then the rest behind a tap — their shape, and it is right, because the list
             is long and the first six are the ones people scan for. Anything the host said this
             place does NOT have is struck through rather than left out, so silence never has to
             be interpreted. */}
      <Amenities p={p} lang={lang} />

      {/* The prose sits AFTER the facts now. Airbnb puts the description ninth, because a
          description is for somebody who has already half decided; the facts are what let you
          decide. Ours had it seventh, ahead of everything that helps. */}
      {p.description && (
        <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed">{p.description}</p>
      )}

      {/* ── WHAT PROTECTS BOTH SIDES. This block is the product. ─────────────────────────── */}
      <section className="card mt-5 space-y-2.5 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "How this is protected", "Cómo se protege esto")}
        </h2>
        <Promise text={W(lang,
          "You both sign a real contract in the app, and both of you can pull up the signed copy at any time.",
          "Ambos firman un contrato real en la app, y los dos pueden abrir la copia firmada cuando quieran.")} />
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
            <Promise text={W(lang,
              `This host asks for a ${fmtMoney(p.deposit_amount, p.deposit_currency || (p.currency === "COP" ? "COP" : "USD"), { cents: (p.deposit_currency || p.currency) !== "COP" })} ${(p.deposit_currency || p.currency || "USD").toUpperCase()} deposit. You pay it to them directly — it does not go through OneHome, and OneHome does not hold it or return it.`,
              `Este arrendador pide un depósito de ${fmtMoney(p.deposit_amount, p.deposit_currency || (p.currency === "COP" ? "COP" : "USD"), { cents: (p.deposit_currency || p.currency) !== "COP" })} ${(p.deposit_currency || p.currency || "USD").toUpperCase()}. Usted se lo paga directamente a él — no pasa por OneHome, y OneHome no lo custodia ni lo devuelve.`)} />
            {depositOpposite && (
              <p className="pl-6 text-[12px] font-semibold tabular-nums opacity-60" aria-label={W(lang, "Deposit conversion", "Conversión del depósito")}>
                {depositOpposite}
              </p>
            )}
            <button type="button" onClick={() => setDepositLawOpen(true)} className="ow-tap flex w-full items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3 text-left text-[12px] font-bold">
              <Info size={17} className="shrink-0" />{W(lang,"Important information about deposits in Colombia","Información importante sobre depósitos en Colombia")}
            </button>
          </>
        )}

        {depositLawOpen && (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-5" role="dialog" aria-modal="true" aria-labelledby="deposit-law-title">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3"><h2 id="deposit-law-title" className="text-lg font-black">{W(lang,"Deposits on Colombian home rentals","Depósitos en arriendos de vivienda en Colombia")}</h2><button type="button" onClick={() => setDepositLawOpen(false)} aria-label={W(lang,"Close","Cerrar")}><X/></button></div>
              <p className="mt-3 text-sm leading-relaxed opacity-75">{W(lang,"On a stay of 30 days or more this is a home lease, and Colombian law (Ley 820 de 2003, Article 16) does not allow a cash deposit to be required. You can ask for it back at any time and the clause has no force. OneHome does not collect, hold or return it.","En una estadía de 30 días o más esto es un arriendo de vivienda, y la ley colombiana (Ley 820 de 2003, artículo 16) no permite exigir un depósito en dinero. Usted puede pedir su devolución en cualquier momento y la cláusula no tiene efecto. OneHome no lo cobra, custodia ni devuelve.")}</p>
              <button type="button" onClick={() => setDepositLawOpen(false)} className="btn-brand mt-5 w-full">{W(lang,"Got it","Entendido")}</button>
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
              {W(lang, "No deposit on this one. ", "Sin depósito en este. ")}
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
                ? W(lang, ` Insurer: ${(p as any).liability_insurer}.`, ` Aseguradora: ${(p as any).liability_insurer}.`)
                : "")
            + ((p as any).liability_amount_usd
                ? W(lang, ` Stated cover: ${usd2(Number((p as any).liability_amount_usd))}.`,
                          ` Cobertura declarada: ${usd2(Number((p as any).liability_amount_usd))}.`)
                : "")
          } />
        )}

        {/* Lee's differentiator, stated to the tenant in the words that matter to them. The
            sentence used to end "…out of your deposit", which stopped being true the moment a
            listing could be secured three different ways. It is the PHOTOS that are the promise,
            not the instrument. */}
        <Promise text={W(lang,
          "Before you move in you both agree the photos of the place. If damage is not in those photos, it cannot be charged to you at the end.",
          "Antes de entrar, ambos aceptan las fotos del inmueble. Si un daño no está en esas fotos, no se le puede cobrar al final.")} />
      </section>

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

      {/* ── ASK ABOUT IT (Phase 2) ───────────────────────────────────────────────────────── */}
      {!mine && userId && (
        <section className="card mt-3 space-y-2 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "Ask about this place", "Preguntar por este inmueble")}
          </h2>
          <textarea className="input min-h-[84px] w-full" value={note} onChange={e => setNote(e.target.value)}
            placeholder={W(lang,
              `Hi — is "${p.title}" still available?`,
              `Hola — ¿"${p.title}" sigue disponible?`)} />
          <button type="button" className="btn-primary w-full" disabled={sending} onClick={ask}>
            <span className="inline-flex items-center gap-2">
              <IconChat size={15} />
              {sending ? "…" : W(lang, "Send message", "Enviar mensaje")}
            </span>
          </button>

          {/* ── ⚠️ "REQUEST A SHOWING" IS A REAL BUTTON NOW ─────────────────────────────────
              Until today it existed in exactly one place: DISABLED, in the listing preview, with
              no table, no screen and no flow behind it. Lee described the whole feature — host
              designates weekly blocks, sets how much notice they need, guest books inside that.

              It appears only when the host has switched showings on AND set a notice period.
              A "request a showing" button that leads to an empty calendar is worse than no
              button: the guest has already decided to act and we have nothing to give them.
              Where it is off, the message route above is the whole answer, which is why the two
              sit together rather than on opposite sides of the screen. */}
          {(p as any).showings_enabled && (p as any).showing_notice_hours != null && (
            <button type="button" className="btn-ghost w-full" onClick={() => setShowingOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <IconCalendar size={15} />
                {W(lang, "Request a showing", "Solicitar una visita")}
              </span>
            </button>
          )}
          <p className="text-[11px] leading-relaxed opacity-50">
            {W(lang,
              "This opens a thread with the agent and tags it with this place, so you both always know which unit you are talking about.",
              "Esto abre una conversación con el agente y la marca con este inmueble, para que ambos sepan siempre de cuál se está hablando.")}
          </p>
          {err && <p className="text-[12px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
        </section>
      )}

      {!mine && !userId && (
        <section className="card mt-3 space-y-2 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "Contact the agent", "Contactar al agente")}
          </h2>
          <p className="text-[13px] leading-relaxed opacity-65">
            {W(lang,
              "Sign in with One ID to message the agent or request a showing. We tag the conversation with this place so nobody has to ask which listing you mean.",
              "Inicie sesión con One ID para escribirle al agente o solicitar una visita. Marcamos la conversación con este inmueble para que nadie tenga que preguntar de cuál se trata.")}
          </p>
          <Link to={productHref("onerental", "/profile")} className="btn-primary block w-full text-center">
            {W(lang, "Sign in to contact agent", "Iniciar sesión para contactar")}
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

      {p.price_unit === "month" && p.status === "published" && <MonthlyRentalPanel
        propertyId={p.id} userId={userId} hostId={p.agent_id} amount={p.price} currency={p.currency || 'COP'} lang={lang}
        onRequestMonth={stay=>{setMonthlyRequest(true);setPendingStay(stay);setErr(null);}}
      />}
      {pendingStay && (
        <RentalRequestSheet
          lang={lang} stay={pendingStay} money={n => monthlyRequest ? new Intl.NumberFormat(lang==='es'?'es-CO':'en-US',{style:'currency',currency:p.currency || 'COP'}).format(n) : drawPrice(n, viewCcy, trm?.rate)} monthly={monthlyRequest}
          hostPaysGuestFee={p.host_pays_guest_fee}
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
            {W(lang, "Review requests & create tenant contract", "Revisar solicitudes y crear contrato")}
          </Link>
        </div>
      )}

      {ownerView && (
        /* Separate row rather than a third button on the pair above: three across is where labels
           start wrapping again, which is the defect Lee flagged twice. */
        <Link to={productHref("onerental", `/r/${p.id}/payments`)}
          className="ow-tap mt-2 flex w-full items-center justify-between gap-2 rounded-2xl border border-ink/12 px-4 py-3 dark:border-white/15">
          <span className="min-w-0">
            <span className="block text-[13.5px] font-bold">
              {W(lang, "Set up rent payments", "Configurar el pago del arriendo")}
            </span>
            <span className="block text-[11.5px] leading-snug opacity-55">
              {W(lang, "Agree the amounts with the tenant before anything is charged.",
                       "Acuerde los montos con el arrendatario antes de cobrar nada.")}
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
      <PropertyHistoryPanel
        listingKind="rental" listingId={p.id}
        matricula={p.matricula_inmobiliaria}
        areaM2={p.area_m2} currency={p.currency} lang={lang} />

      {/* Comparables — stamped "coming soon" rather than filled with places that are not
          actually comparable. Lee, 12 Aug 2026. */}
      <SimilarUnits neighbourhood={p.neighbourhood} city={p.city} lang={lang} />

      {/* v77 · U12 · Comments removed from property listings. Reviews take this space. */}

      <p className="mt-6 text-center text-[11px] leading-relaxed opacity-45">
        {W(lang,
          `Payouts to the manager arrive in about ${PAYOUT_FIRST_DAYS} days the first time, then about ${PAYOUT_LATER_DAYS} days.`,
          `Los pagos al administrador llegan en unos ${PAYOUT_FIRST_DAYS} días la primera vez, y luego en unos ${PAYOUT_LATER_DAYS} días.`)}
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
          existingStayNote={p.id === "b8334d28-9200-4abb-b37a-716241ac09cb" && ["eeb6bced-c34b-4c73-8e3a-bd0498fe1b6c", "95692fe9-e1d3-4f89-9c50-b50e276b738d"].includes(userId ?? "") ? W(lang,
            "Existing stay: August 29 onward is available. For September rent, select September 1 and October 1 (checkout). August proration is separate.",
            "Estadía existente: disponible desde el 29 de agosto. Para septiembre, seleccione el 1 de septiembre y el 1 de octubre (salida). El prorrateo de agosto es aparte.") : undefined}
          rules={stayRules}
          booked={booked ?? []}
          restingLabel={priceLabel(p, lang, viewCcy, trm?.rate)}
          money={n => drawPrice(n, viewCcy, trm?.rate)}
          mode="request"
          cancelLine={W(lang,
            "Everything back if you cancel at least five days before you arrive. Half back up to the day before.",
            "Todo de vuelta si cancela al menos cinco días antes de llegar. La mitad hasta el día anterior.")}
          busy={booking}
          onReserve={requestToBook}
        />
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
  const [all, setAll] = useState(true);
  const rows = amenityRows(p, lang);
  if (rows.length === 0) return null;

  const shown = all ? rows : rows.slice(0, 6);
  const groups = all
    ? (["space", "inside", "outside", "building", "rules"] as const)
        .map(g => ({ g, items: rows.filter(r => r.group === g) }))
        .filter(x => x.items.length > 0)
    : null;

  return (
    <section className="mt-5">
      <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
        {W(lang, "What this place has", "Lo que tiene este inmueble")}
      </h2>

      {groups
        ? groups.map(({ g, items }) => (
            <div key={g} className="mt-4">
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
          ))
        : (
          <ul data-ow="amenity-grid" className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-2">
            {shown.map(r => <AmenityRow key={r.key} text={r.text} has={r.has} />)}
          </ul>
        )}

      {rows.length > 6 && (
        <button type="button" onClick={() => setAll(v => !v)}
          className="mt-3 text-[13px] font-bold underline underline-offset-2 opacity-70">
          {all
            ? W(lang, "Show less", "Ver menos")
            : W(lang, `Show all ${rows.length}`, `Ver los ${rows.length}`)}
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
