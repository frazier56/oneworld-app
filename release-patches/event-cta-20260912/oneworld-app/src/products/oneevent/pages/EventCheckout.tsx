import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import QuickHirePhoneInput from "@evt/components/quick-hire/QuickHirePhoneInput";
import { findCountryByIso } from "@evt/lib/country-phone-data";
import MapsPin from "@evt/components/events/MapsPin";
import { readContact } from "@evt/lib/contactCapture";
import { useAuth } from "@evt/hooks/useAuth";
import { supabase } from "@evt/integrations/supabase/client";
import { Navbar } from "@evt/components/Navbar";
import { Footer } from "@evt/components/Footer";
import { ArrowLeft, Ticket, Minus, Plus, CreditCard, Loader2, Shield, Calendar, MapPin, Clock, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { currencySymbol } from "@evt/lib/currencies";
import { FEE_RATE, ScreenHeading } from "@oneworld/shell";
import ExpressJoin, { BiometricsOffer } from "@evt/components/ExpressJoin";
import { isConfirmedRegistration } from "@evt/lib/eventTicketing";
import { manualPaymentUrl } from "@evt/lib/manualPayment";

const applicationDraftKey = (eventId: string) => `evt-apply-draft-${eventId}`;
const applicationDraftTokenKey = (eventId: string) => `evt-apply-token-${eventId}`;
type CheckoutApplicationDraft = {
  t?: number;
  answers?: Record<string, string | string[] | number | null>;
};
const readApplicationDraft = (eventId?: string): CheckoutApplicationDraft | null => {
  if (!eventId) return null;
  try {
    const raw = localStorage.getItem(applicationDraftKey(eventId)) || sessionStorage.getItem(applicationDraftKey(eventId));
    return raw ? JSON.parse(raw) as CheckoutApplicationDraft : null;
  } catch { return null; }
};
const clearApplicationDraft = (eventId?: string) => {
  if (!eventId) return;
  try {
    localStorage.removeItem(applicationDraftKey(eventId));
    sessionStorage.removeItem(applicationDraftKey(eventId));
  } catch { /* payment completion is authoritative even when storage is unavailable */ }
};

export default function EventCheckout() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, formatMoney, lang } = useLanguage();
  const [event, setEvent] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [completedTicketPath, setCompletedTicketPath] = useState<string | null>(null);

  // Ticket selection
  const [ticketType, setTicketType] = useState<"ga" | "vip">("ga");
  const [quantity, setQuantity] = useState(1);

  // Guest checkout form
  const [guestName, setGuestName] = useState(readContact().name || "");
  /* Express-join completion strip (name when the email path gave none, phone always) */
  const [detailsName, setDetailsName] = useState("");
  const [detailsPhone, setDetailsPhone] = useState(readContact().phone || "");
  const [smsConsent, setSmsConsent] = useState(false);
  const [detailsPhoneCountry, setDetailsPhoneCountry] = useState(readContact().phoneCountry || "US");
  const [guestEmail, setGuestEmail] = useState(readContact().email || "");
  const [guestPhone, setGuestPhone] = useState(readContact().phone || "");

  // Promo codes. Applied only when the user taps "Apply" so the price adjusts
  // in-place before proceeding. DEMO0001 = free (client bypass); FOUNDER100 = $1
  // real charge (goes through Stripe so the full flow is exercised). (Lee, Jul 23)
  const [promoCode, setPromoCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [promoError, setPromoError] = useState("");
  /* FOUNDER CODES (Lee, 18 Aug 2026): HIS codes, working on ANY event on his platform.
     FOUNDER0001 = completely free · FOUNDER0002 = immediate $1 Stripe charge ·
     FOUNDER0003 = $1 authorization held until host approval. DEMO0001/FOUNDER100 are aliases.
     The $1 path is enforced server-side in create-event-checkout v15 (same allowlist). */
  const isDemoPromo = appliedCode === "FOUNDER0001" || appliedCode === "DEMO0001";
  const isFounderPromo = ["FOUNDER0002", "FOUNDER0003", "FOUNDER100"].includes(appliedCode);
  const isApprovalFounderPromo = appliedCode === "FOUNDER0003";

  // Payment rail: 'stripe' (default) or 'wise' (if event accepts Wise)
  const [paymentRail, setPaymentRail] = useState<"stripe" | "wise" | "paypal">("stripe");
  const [intlOpen, setIntlOpen] = useState(false);
  /* v23 CP pending state — MUST live up here with the other hooks: v23's first cut declared
     it below the loading early-returns, which changes the hook count between renders and
     crashes the screen the moment loading completes (v24 DG fix). */
  const [pendingInfo, setPendingInfo] = useState<null |
    { kind: "free" | "authorized" } |
    { kind: "manual"; rail: "wise" | "paypal"; amount: number }
  >(null);
  const autoPendingRan = useRef(false);
  /* v27 EG (Forrest Harris, 18 Aug 2026): a real applicant on a $97 gated event landed
     here signed-out, found no payment button — only a quiet grey sentence — and left.
     Stripe was never reached. The guest bottom slot is now a REAL primary button that
     walks them to the express-join card. */
  const expressRef = useRef<HTMLDivElement | null>(null);

  const isGuest = !user?.id;
  const userMetadata = ((user as any)?.user_metadata || {}) as Record<string, string | undefined>;

  /* NEVER run the onboarding tour in the middle of a purchase (Lee, 17 Aug 2026): a Google
     express joiner returns here with a brand-new session, and the setup interstitial would
     otherwise swallow the checkout. The stamp marks the tour done; biometrics are offered
     inline, stay-signed-in is the session default already. */
  useEffect(() => {
    if (user?.id) { try { localStorage.setItem(`ow.setup.${user.id}`, "1"); } catch { /* private mode */ } }
  }, [user?.id]);

  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id");
  const hasApplicationHandoff = searchParams.get("applicationDraft") === "1" && Boolean(readApplicationDraft(id)?.answers);

  /* v24 DG-UX (Lee): landing here from the apply form on a FREE gated event, the
     confirmation is AUTOMATIC — no second "Confirm free ticket" tap. The server stamps
     the application (none_required / promo_free) and the pending screen renders with the
     full what-happens-next story. */
  useEffect(() => {
    if (autoPendingRan.current || pendingInfo || !event || !user?.id) return;
    const appIdParam = searchParams.get("applicationId");
    if (searchParams.get("pending") !== "1" || !appIdParam) return;
    if (!(event.requires_application && event.application_requires_approval)) return;
    autoPendingRan.current = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("create-event-checkout", {
        body: { eventId: id, ticketType: "ga", quantity: 1, applicationId: appIdParam },
      });
      if (!error && (data as any)?.pending) setPendingInfo({ kind: "free" });
    })();
  }, [event, user?.id, pendingInfo, searchParams, id]);

  // Handle Stripe return
  useEffect(() => {
    if (status === "success" && sessionId) {
      setVerifying(true);
      const verify = async () => {
        try {
          // For guests, use anon invocation without auth
          const { data, error } = await supabase.functions.invoke("verify-event-payment", {
            body: { sessionId, isGuest: !user?.id },
          });
          if (error) throw new Error(error.message || "Verification failed");
          if (data?.error) throw new Error(data.error);

          if (data?.authorized) {
            clearApplicationDraft(id);
            /* v27 EI (Lee's own $20×2 buy, 18 Aug 2026): this used to be a 2-second toast
               and a bounce to the event page — which still said "Request to Join", so the
               buyer stood there wondering if their money did anything. The v23 pending
               screen already says everything perfectly — RENDER IT. No navigation. */
            setVerifying(false);
            setPendingInfo({ kind: "authorized" });
            return;
          }

          clearApplicationDraft(id);
          if (data?.claimToken) {
            /* Guest purchase: their ticket lives at the tokenized URL (no account), with
               the QR, save options and the optional create-account sheet. (Lee, 17 Aug) */
            setCompletedTicketPath(`/events/gt/${data.claimToken}`);
          } else if (data?.registrationId) {
            setCompletedTicketPath(`/events/e/${id}/receipt/${data.registrationId}`);
          } else {
            setCompletedTicketPath(`/events/e/${id}`);
          }
          setVerifying(false);
        } catch (err: any) {
          console.error("Payment verification error:", err);
          toast.error(err.message || "Failed to verify payment. Please contact support.");
          setVerifying(false);
        }
      };
      verify();
    } else if (status === "cancelled") {
      toast.dismiss();
      toast.info("Checkout cancelled — no charge was made.");
      setSubmitting(false);
      const returnParams = new URLSearchParams(searchParams);
      returnParams.delete("status");
      returnParams.delete("session_id");
      returnParams.set("step", "payment");
      navigate(`/events/e/${id}/checkout?${returnParams.toString()}`, { replace: true });
    }
  }, [status, sessionId, user?.id]);

  // If the user clicks the browser Back button from Stripe (or the page is
  // restored from bfcache), reset the "Redirecting to payment..." state so
  // the Pay button is usable again and the loading toast goes away.
  useEffect(() => {
    const reset = () => {
      toast.dismiss();
      setSubmitting(false);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") reset();
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id!).single();
      if (!ev) { navigate("/events"); return; }

      // If this event requires an application form and the user hasn't completed one yet,
      // bounce them to the /apply page first. They come back here with ?applicationId=xxx.
      const applicationId = searchParams.get("applicationId");
      const applicationDraftReady = searchParams.get("applicationDraft") === "1" && Boolean(readApplicationDraft(id!)?.answers);
      /* AG (Claude UAT, 18 Aug 2026): ticket_type='free' with a nonzero GA price made the CLIENT
         say Free while the SERVER would charge — the price fields are the truth, same
         precedence as create-event-checkout. */
      const isFreeEvent = (((ev as any).ga_ticket_price || (ev as any).ticket_price || 0) === 0) && (((ev as any).vip_ticket_price || 0) === 0);
      if (
        (ev as any).requires_application &&
        !isFreeEvent &&
        !applicationId &&
        !applicationDraftReady &&
        status !== "success" &&
        status !== "cancelled"
      ) {
        // Only bounce to /apply when there's actually an active form WITH questions.
        // Otherwise we'd ping-pong between /apply and /checkout forever (each bounces
        // to the other), which surfaces as an endless spinner on the buy-ticket page.
        const { data: f } = await supabase
          .from("event_application_forms")
          .select("questions, is_active")
          .eq("event_id", id!)
          .maybeSingle();
        const hasActiveForm =
          !!f &&
          (f as any).is_active === true &&
          Array.isArray((f as any).questions) &&
          (f as any).questions.length > 0;
        if (hasActiveForm) {
          navigate(`/events/e/${id}/apply`, { replace: true });
          return;
        }
        // Otherwise fall through to normal checkout — application gate is effectively off.
      }

      setEvent(ev);
      if (user?.id) {
        /* Granted columns only — select("*") on profiles throws 42501. The attendee's e-mail
           comes off the One ID session (user.email). */
        const { data: prof } = await supabase.from("profiles").select("id, full_name, photo_url").eq("id", user.id).single();
        /* v14: profiles.phone is deliberately NOT a granted column (public-read policy would
           leak every member's number) — the owner reads their own via the my_contact RPC.
           Without this the "finish your details" strip asked for a phone the profile HAD. */
        const { data: mine } = await supabase.rpc("my_contact" as any);
        const contact = Array.isArray(mine) ? mine[0] : mine;
        setProfile(contact ? { ...prof, phone: contact.phone, sms_optin: contact.sms_optin } : prof);
      }
      // Pre-fill guest fields from /apply hand-off
      const gName = searchParams.get("guestName");
      const gEmail = searchParams.get("guestEmail");
      const gPhone = searchParams.get("guestPhone");
      if (gName) setGuestName(gName);
      if (gEmail) setGuestEmail(gEmail);
      if (gPhone) setGuestPhone(gPhone);
      setLoading(false);
    };
    load();
  }, [id, user, searchParams, status]);

  if (verifying) {
    return (
      <div>
        <Navbar />
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (completedTicketPath) {
    return (
      <div>
        <Navbar />
        <div className="pb-8">
          <ScreenHeading>{t("checkout.complete_heading", "Purchase complete")}</ScreenHeading>
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15">
              <ShieldCheck className="h-7 w-7 text-emerald-600" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-foreground">Congratulations — your purchase is complete.</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your ticket is confirmed. Select below to view your ticket and QR code. A copy is also being emailed to you.
            </p>
            <button onClick={() => navigate(completedTicketPath, { replace: true })}
              className="ow-btn-espresso mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold">
              <Ticket className="mr-2 inline h-4 w-4" /> View my ticket
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading || !event) {
    return (
      <div>
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const baseFree = ((event.ga_ticket_price || event.ticket_price || 0) === 0) && ((event.vip_ticket_price || 0) === 0); // AG: price fields are the truth, never ticket_type alone
  // DEMO0001 zero-cost test code — bypasses Stripe and routes through the free flow
  const isFree = baseFree || isDemoPromo;
  const gaPrice = event.ga_ticket_price || event.ticket_price || 0;
  const vipPrice = event.vip_ticket_price || 0;
  const hasVip = event.has_vip_ticket && vipPrice > 0;
  const gaRemaining = Math.max(0, (event.ga_ticket_qty || event.max_attendees || 999) - (event.ga_sold || 0));
  const vipRemaining = hasVip ? Math.max(0, (event.vip_ticket_qty || 0) - (event.vip_sold || 0)) : 0;

  const selectedPrice = ticketType === "vip" ? vipPrice : gaPrice;
  const subtotal = isFree ? 0 : selectedPrice * quantity;
  /* The ONE fee number — FEE_RATE (5.99%) from the shell. The old 8.99% literal was a bug:
     the label already said 5.99% while the math charged 8.99%. */
  const serviceFee = (isFree || isFounderPromo) ? 0 : Math.round(subtotal * FEE_RATE * 100) / 100;
  // FOUNDER100 = flat $1 real charge (a genuine Stripe transaction for testing).
  const total = isFree ? 0 : (isFounderPromo ? 1 : subtotal + serviceFee);
  const manualRail = !isFree && (paymentRail === "wise" || paymentRail === "paypal");
  const checkoutFee = manualRail ? 0 : serviceFee;
  const checkoutTotal = manualRail ? subtotal : total;

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (["FOUNDER0001", "DEMO0001", "FOUNDER0002", "FOUNDER0003", "FOUNDER100"].includes(code)) {
      if (code === "FOUNDER0003" && !(event.requires_application && event.application_requires_approval && (searchParams.get("applicationId") || hasApplicationHandoff))) {
        setPromoError("FOUNDER0003 is only for a submitted application awaiting host approval.");
        return;
      }
      setAppliedCode(code);
      setPromoError("");
      const isDollar = ["FOUNDER0002", "FOUNDER0003", "FOUNDER100"].includes(code);
      toast.success(isDollar ? `${code} applied — total is $1.00` : `${code} applied — this ticket is free.`);
    } else {
      setPromoError("That code isn't valid for this event.");
    }
  };
  const clearPromo = () => { setAppliedCode(""); setPromoCode(""); setPromoError(""); };
  const maxQty = ticketType === "vip" ? Math.min(vipRemaining, 10) : Math.min(gaRemaining, 10);

  const locale = lang === "es" ? "es-CO" : "en-US";
  const startDate = event.start_date ? new Date(event.start_date) : null;
  const dateDisplay = startDate
    ? startDate.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })
    : "Date TBD";

  const eventCurrency = ((event as any).currency as string) || "USD";
  const eventSymbol = currencySymbol(eventCurrency);
  const eventCurrencyLabel = eventCurrency.toUpperCase();
  const fmtEvent = (amount: number) => `${eventSymbol}${amount.toFixed(2)} ${eventCurrencyLabel}`;
  const fmtTicketPrice = (amt: number) => isFree ? t("checkout.free") : fmtEvent(amt);
  const applicationId = searchParams.get("applicationId");
  const approvalRequired = Boolean((applicationId || hasApplicationHandoff) && event.requires_application && event.application_requires_approval && !isFree);
  const appBase = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const paymentQuery = new URLSearchParams();
  if (applicationId) paymentQuery.set("applicationId", applicationId);
  else if (hasApplicationHandoff) paymentQuery.set("applicationDraft", "1");
  paymentQuery.set("step", "payment");
  const paymentCheckoutPath = `${appBase}/events/e/${id}/checkout?${paymentQuery.toString()}`;
  const displayName = profile?.full_name || userMetadata.full_name || userMetadata.name || "One World member";
  const initials = String(displayName)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "OW";

  /* v23 CP (Lee's founder-ticket P0, 18 Aug 2026): the old approval gate bounced EVERY
     unapproved applicant back to the event page with only a 2-second toast — free tickets
     looked broken, and paid applicants could never reach the card-authorize step the host
     toggle promises. Now the pending state is a real screen, and paid applicants proceed
     to Stripe (authorize-now, capture-on-approval). (pendingInfo state lives with the
     hooks at the top — see v24 DG note there.) */
  const handleConfirm = async (joinedNow = false) => {
    if (!id) return;
    /* ExpressJoin can finish authentication before React's auth hook has rerendered this
       checkout. Read the live session so the first click reliably continues to Stripe. */
    let checkoutUser = user;
    if (joinedNow || !checkoutUser?.id) {
      const { data } = await supabase.auth.getUser();
      checkoutUser = data.user;
    }
    const checkoutIsGuest = !checkoutUser?.id;
    const checkoutMetadata = ((checkoutUser as any)?.user_metadata || {}) as Record<string, string | undefined>;
    // Card/free checkout keeps the fast One ID join. Manual rails may create a secure
    // guest claim row because the host still has to confirm before a ticket exists.
    if (checkoutIsGuest && !manualRail) {
      toast.error("Finish the quick sign up above first — it takes about 20 seconds.");
      return;
    }
    let appIdForCheckout: string | null = applicationId;

    const identityName = profile?.full_name || checkoutMetadata.full_name || checkoutMetadata.name || detailsName.trim();
    const enteredPhone = detailsPhone.trim()
      ? `${findCountryByIso(detailsPhoneCountry)?.code || "+1"} ${detailsPhone.trim()}`
      : "";
    const identityPhone = profile?.phone || checkoutMetadata.phone || enteredPhone;
    if (!checkoutIsGuest && (!identityName || !identityPhone)) {
      toast.error("Add your name and phone above before continuing to payment.");
      return;
    }

    // Persist completion-strip details so the ticket and notifications carry them.
    if (checkoutUser?.id && ((!profile?.full_name && identityName) || (!profile?.phone && identityPhone))) {
      const patch: Record<string, string> = {};
      if (!profile?.full_name && identityName) patch.full_name = identityName;
      if (!profile?.phone && identityPhone) patch.phone = identityPhone;
      if (smsConsent) { (patch as any).sms_optin = true; (patch as any).sms_optin_at = new Date().toISOString(); }
      if (Object.keys(patch).length) {
        await supabase.from("profiles").update(patch).eq("id", checkoutUser.id).then(({ error }) => {
          if (error) console.warn("[checkout] details save skipped:", error.message);
        });
      }
    }
    setSubmitting(true);
    try {
      /* The guest questionnaire becomes a real, user-linked application only after the
         person chooses Google or Email. This is the single identity capture point. */
      if (!checkoutIsGuest && event.requires_application && !appIdForCheckout) {
        const draft = readApplicationDraft(id);
        if (!draft?.answers) {
          toast.error("Your saved application could not be found. Please review it once more.");
          navigate(`/events/e/${id}/apply`, { replace: true });
          setSubmitting(false);
          return;
        }
        const { data: createdApplicationId, error: applicationError } = await supabase.rpc("submit_event_application", {
          p_event_id: id,
          p_name: identityName || checkoutUser!.email || "Applicant",
          p_email: checkoutUser!.email || "",
          p_phone: identityPhone || null,
          p_answers: draft.answers as any,
          p_ticket_type: ticketType,
          p_quantity: quantity,
        });
        if (applicationError) throw applicationError;
        appIdForCheckout = createdApplicationId as string;
        if (!appIdForCheckout) throw new Error("Could not save your application. Please try again.");

        try {
          const resumeToken = localStorage.getItem(applicationDraftTokenKey(id));
          if (resumeToken) {
            void (supabase as any).rpc("complete_event_application_draft", {
              p_event_id: id,
              p_resume_token: resumeToken,
              p_application_id: appIdForCheckout,
            });
          }
        } catch { /* the linked application is already the durable copy */ }
        void supabase.functions
          .invoke("score-event-application", { body: { applicationId: appIdForCheckout } })
          .catch(error => console.warn("[score-event-application] async error:", error));
      }

      // Signed-in user: check if already registered
      if (!checkoutIsGuest) {
        const { data: existing } = await supabase
          .from("event_registrations")
          .select("id, status, registration_source, payment_status, amount_paid")
          .eq("event_id", id)
          .eq("user_id", checkoutUser!.id)
          .limit(1);

        const confirmed = existing?.find((registration: any) => isConfirmedRegistration(registration));
        if (confirmed) {
          toast.info("You're already registered for this event!");
          navigate(`/events/e/${id}/receipt/${confirmed.id}`);
          return;
        }
      }

      /* v19 BM (Lee's 3-vs-5 mystery): an application-gated event had TWO doors — apply
         (waits for host approval) and this direct registration path. The second door is
         now closed: on gated events the ONLY way a registration comes to exist is host
         approval (approve-event-application creates it). */
      if (event.requires_application && event.application_requires_approval && !checkoutIsGuest) {
        const { data: myApp } = await supabase
          .from("event_applications")
          .select("id, approval_status, payment_status")
          .eq("event_id", id)
          .eq("applicant_user_id", checkoutUser!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const approved = myApp && ((myApp as any).approval_status === "approved" || (myApp as any).approval_status === "auto_approved");
        if (!approved) {
          /* v24 DG: a guest-created application is INVISIBLE to this RLS lookup even after
             the person signs in (applicant_user_id was NULL). If the URL is carrying an
             applicationId — we came straight from the apply form — trust it: the server
             (create-event-checkout v18) validates ownership and claims the guest row by
             email. Bouncing back to /apply here is what created Lee's infinite loop. */
          if (!myApp && !appIdForCheckout) {
            navigate(`/events/e/${id}/apply`, { replace: true });
            return;
          }
          appIdForCheckout = (myApp as any)?.id || appIdForCheckout;
          /* Free ticket (free event or 100%-free founder code): nothing to authorize.
             Stamp it server-side so the host's approval knows this ticket is legitimately
             free, then show the pending screen — never a silent bounce. */
          if (isFree) {
            const { data: pend, error: pendErr } = await supabase.functions.invoke("create-event-checkout", {
              body: {
                eventId: id, ticketType, quantity,
                promoCode: appliedCode || undefined,
                applicationId: appIdForCheckout,
              },
            });
            if (pendErr) throw new Error(pendErr.message || "Could not submit your request");
            if ((pend as any)?.error) throw new Error((pend as any).error);
            setPendingInfo({ kind: "free" });
            setSubmitting(false);
            return;
          }
          /* Card already authorized on a previous pass — the request is simply waiting. */
          if (myApp && (myApp as any).payment_status === "authorized") {
            setPendingInfo({ kind: "authorized" });
            setSubmitting(false);
            return;
          }
          /* Paid & not yet authorized → fall through to Stripe with the applicationId:
             authorize now, host approval captures. (This is the flow the host toggle
             copy promises — "authorize payment before host review".) */
        }
      }

      if (isFree && !checkoutIsGuest) {
        // Free ticket for signed-in user — register directly
        const qrCode = `OS-EVT-${id.slice(0, 8)}-${checkoutUser!.id.slice(0, 8)}-${Date.now()}`;
        const { data: reg, error } = await supabase
          .from("event_registrations")
          .insert({
            event_id: id,
            user_id: checkoutUser!.id,
            status: "registered",
            qr_code: qrCode,
            qr_valid: true,
            quantity,
            ticket_type: ticketType,
            registration_source: appliedCode ? "promo" : "free",
            payment_status: "free",
            amount_paid: 0,
            /* v13: the ticket doubles as a receipt — stamp what was paid and when. */
            amount_paid_cents: 0,
            currency: String(event.currency || "USD").toUpperCase(),
            paid_at: new Date().toISOString(),
            ...(smsConsent ? { sms_optin: true } : {}),
          })
          .select("id")
          .single();

        if (error) throw error;

        // Send receipt email
        const confirmationId = `OS-${reg.id.slice(0, 10).toUpperCase()}-${reg.id.slice(-3).toUpperCase()}`;
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "ticket-receipt",
            recipientEmail: checkoutUser!.email,
            idempotencyKey: `ticket-receipt-${reg.id}`,
            templateData: {
              userName: profile?.full_name || "Attendee",
              eventTitle: event.title,
              eventDate: startDate
                ? startDate.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })
                : "TBD",
              ticketType: ticketType === "vip" ? "VIP Access" : "General Admission",
              quantity,
              total: "Free",
              confirmationId,
            },
          },
        }).catch(console.error);

        // Add to calendar
        if (event.start_date) {
          await supabase.from("calendar_events").insert({
            user_id: checkoutUser!.id,
            event_id: id,
            title: event.title,
            start_at: event.start_date,
            end_at: event.end_date || event.start_date,
            description: `Event: ${event.title}`,
            color: "#2EE6D6",
          });
        }

        toast.success("Ticket confirmed!");
        navigate(`/events/e/${id}/receipt/${reg.id}`);
      } else if (isFree && checkoutIsGuest) {
        /* LUMA-STYLE GUEST TICKET (Lee, 17 Aug 2026): a free event needs NOTHING but the
           form above. The RPC creates the guest registration + QR and emails the tokenized
           ticket link; the account is offered AFTER, on the ticket screen. This branch was
           the gap — a guest on a free event used to fall through to Stripe with $0. */
        const { data: guestReg, error: guestErr } = await supabase.rpc("guest_register_free_event", {
          p_event_id: id,
          p_name: guestName.trim(),
          p_email: guestEmail.trim(),
          p_phone: guestPhone.trim() || null,
        });
        if (guestErr) throw guestErr;
        const row = Array.isArray(guestReg) ? guestReg[0] : guestReg;
        if (!row?.claim_token) throw new Error("Couldn't create your ticket. Please try again.");
        toast.success("Ticket confirmed! We've emailed it to you too.");
        navigate(`/events/gt/${row.claim_token}`);
      } else if (manualRail && !(event.requires_application && event.application_requires_approval)) {
        const rail = paymentRail as "wise" | "paypal";
        const { data, error } = await supabase.functions.invoke("event-manual-payment", {
          body: {
            action: "create",
            eventId: id,
            rail,
            ticketType,
            quantity,
            ...(checkoutIsGuest ? {
              guestName: guestName.trim(),
              guestEmail: guestEmail.trim(),
              guestPhone: guestPhone.trim(),
            } : {}),
          },
        });
        if (error) throw new Error((data as any)?.error || error.message || "Could not record the payment claim");
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success("Payment submitted — the host will confirm receipt before your ticket is released.");
        if ((data as any)?.claimToken) {
          navigate(`/events/ticket/claim/${(data as any).claimToken}`);
        } else {
          setPendingInfo({ kind: "manual", rail, amount: Number((data as any)?.amount ?? checkoutTotal) });
          setSubmitting(false);
        }
      } else {
        // Paid ticket or guest — redirect to Stripe Checkout
        toast.loading("Redirecting to secure payment...");
        const { data, error } = await supabase.functions.invoke("create-event-checkout", {
          body: {
            eventId: id,
            ticketType,
            quantity,
            promoCode: appliedCode || undefined,
            // Full app origin INCLUDING the /oneevents-preview/ base so Stripe returns
            // into the app, not oneworldlabs.ai root (which fell to the old homepage). (Lee, Jul 23)
            returnOrigin: window.location.origin + (import.meta.env.BASE_URL || "/").replace(/\/$/, ""),
            ...(appIdForCheckout ? { applicationId: appIdForCheckout } : {}),
            ...(checkoutIsGuest ? { guestName: guestName.trim(), guestEmail: guestEmail.trim(), guestPhone: guestPhone.trim() } : {}),
          },
        });

        if (error) throw new Error(error.message || "Failed to create checkout");
        if (data?.error) throw new Error(data.error);

        if (data?.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL received");
        }
      }
    } catch (err: any) {
      toast.dismiss();
      if (err.code === "23505") {
        toast.info("You're already registered!");
        navigate(`/events/e/${id}`);
      } else if (err.code === "23503" || /foreign key|user_id_fkey|JWT/i.test(err.message || "")) {
        /* v13 (18 Aug 2026): a session can outlive its account (account deleted while the tab
           was open). Every write then fails with an FK error and the button reads as "dead".
           Say what happened and restart the session cleanly instead. */
        toast.error("Your session is no longer valid — sign in again and you're right back here.");
        await supabase.auth.signOut();
        navigate(`/events/join-express?next=${encodeURIComponent(`/events/e/${id}/checkout`)}`);
      } else {
        toast.error(err.message || "Failed to complete checkout.");
      }
      setSubmitting(false);
    }
  };

  /* v23 CP: the pending screen — a real destination, not a toast. */
  if (pendingInfo) {
    return (
      <div>
        <Navbar />
        <div className="pb-8">
          <ScreenHeading>{t("checkout.title", "Checkout")}</ScreenHeading>
          <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/15">
              <Clock className="h-7 w-7 text-amber-600" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-foreground">
              {pendingInfo.kind === "manual"
                ? t("checkout.manual_pending_title", "Payment submitted — awaiting host confirmation")
                : t("checkout.pending_title2", "Request sent — the host has to approve you")}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {pendingInfo.kind === "manual"
                ? t("checkout.manual_pending_body", `You reported a ${pendingInfo.rail === "wise" ? "Wise" : "PayPal"} payment of ${fmtEvent(pendingInfo.amount)}. Your ticket remains inactive until the host confirms the money arrived.`)
                : pendingInfo.kind === "authorized"
                ? t("checkout.pending_authorized2", "Your card is authorized — a hold, not a charge. If the host approves you, it's charged and your ticket arrives here in the app and in your email. If not, the hold is released automatically.")
                : t("checkout.pending_free2", "Nothing to pay. The moment the host approves you, your ticket lands right here in the app and in your email. Most hosts respond within a day.")}
            </p>
            {pendingInfo.kind === "authorized" && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> {t("checkout.card_authorized_chip", "Card authorized — not charged")}
              </p>
            )}
            <p className="mx-auto mt-3 max-w-sm rounded-xl bg-secondary/60 border border-border px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
              {pendingInfo.kind === "manual"
                ? t("checkout.manual_pending_track", "We notified the host. You’ll receive an in-app notification and ticket email after confirmation; this pending claim cannot be checked in.")
                : t("checkout.pending_track", "Track it anytime: My Events → Attending → \"Requested\". We'll also notify you here and by email the moment the host decides.")}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={() => navigate(`/events/e/${id}`)}
                className="ow-btn-espresso w-full rounded-2xl px-4 py-3 text-sm font-bold">
                {t("checkout.back_to_event", "Back to the event")}
              </button>
              <button onClick={() => navigate(`/events/events?tab=attending`)}
                className="w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-bold text-foreground">
                {t("checkout.see_my_events", "See it under My Events")}
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  /* Application checkout is intentionally three distinct screens: application, account,
     then ticket/payment review. Creating an account only advances to the payment screen;
     Stripe is opened solely by the final payment CTA. */
  if (isGuest && event.requires_application && !manualRail) {
    return (
      <div>
        <Navbar />
        <div className="pb-8">
          <ScreenHeading>{t("checkout.create_account", "Create account")}</ScreenHeading>
          <button
            onClick={() => navigate(`/events/e/${id}/apply`)}
            className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("checkout.back_to_application", "Back to application")}
          </button>
          <div ref={expressRef}>
            <ExpressJoin
              eventCheckoutPath={paymentCheckoutPath}
              onContinue={async () => window.location.replace(paymentCheckoutPath)}
            />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      {/* AppShell provides the max-w-lg column — old page chrome removed. */}
      <div className="pb-8">
        {/* Page title on the VAIA row (Lee, 18 Aug 2026): every screen carries its name. */}
        <ScreenHeading>{t("checkout.title", "Checkout")}</ScreenHeading>
        <button onClick={() => navigate(`/events/e/${id}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("checkout.back")}
        </button>

        {/* Event context leads the payment screen. */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h1 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{event.title}</h1>
          <div className="flex items-start gap-2 text-xs text-muted-foreground mb-1.5">
            <span className="grid w-6 shrink-0 place-items-center pt-px"><Calendar className="w-4 h-4" /></span>
            <span className="pt-0.5">{dateDisplay}</span>
          </div>
          {event.location && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
               target="_blank" rel="noopener noreferrer"
               className="flex items-start gap-2 text-xs text-muted-foreground hover:text-primary">
              <span className="grid w-6 shrink-0 place-items-center"><MapsPin size={20} /></span>
              <span className="pt-0.5 text-left">{event.location}</span>
            </a>
          )}
        </div>

        {/* Identity follows the event context, then ticket and payment choices. */}
        {isGuest && manualRail ? (
          <div className="rounded-2xl bg-card border border-border p-5 mb-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Ticket contact</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">No account required. We’ll email a secure claim link now and activate it only after the host confirms payment.</p>
            </div>
            <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                   autoComplete="name" placeholder="Full name"
                   className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)}
                   autoComplete="email" placeholder="Email address"
                   className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
                   autoComplete="tel" placeholder="Phone (optional)"
                   className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        ) : isGuest ? null : (
          <div className="rounded-2xl bg-card border border-border p-5 mb-4">
            <h2 className="text-sm font-bold text-foreground mb-3">Your ticket details</h2>
            <div className="flex items-center gap-3">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{initials}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <BiometricsOffer />
            {(!profile?.full_name || !profile?.phone) && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">Add anything Google could not provide:</p>
                {!profile?.full_name && !userMetadata.full_name && !userMetadata.name && (
                  <input type="text" value={detailsName} onChange={(e) => setDetailsName(e.target.value)}
                         placeholder="Your full name"
                         className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                )}
                {!profile?.phone && (
                  <QuickHirePhoneInput
                    countryCode={detailsPhoneCountry}
                    phone={detailsPhone}
                    onCountryChange={setDetailsPhoneCountry}
                    onPhoneChange={setDetailsPhone}
                  />
                )}
                <label className="flex items-start gap-2 pt-1 text-[11px] leading-snug text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)}
                         className="mt-0.5 accent-primary" />
                  <span>{t("checkout.sms_consent", "Text me updates about this event and related One World events at this number. Message rates may apply.")}</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Ticket type selection */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-3">{t("checkout.select_ticket")}</h2>
          <div className="space-y-2">
            <button
              onClick={() => { setTicketType("ga"); if (quantity > Math.min(gaRemaining, 10)) setQuantity(1); }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${ticketType === "ga" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">{t("checkout.ga")}</p>
                <p className="text-xs text-muted-foreground">{t("checkout.tickets_remaining").replace("{n}", String(gaRemaining))}</p>
              </div>
              <span className="text-lg font-bold text-primary">
                {fmtTicketPrice(gaPrice)}
              </span>
            </button>

            {hasVip && (
              <button
                onClick={() => { setTicketType("vip"); if (quantity > Math.min(vipRemaining, 10)) setQuantity(1); }}
                disabled={vipRemaining === 0}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${ticketType === "vip" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"} disabled:opacity-50`}
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{t("checkout.vip")}</p>
                  <p className="text-xs text-muted-foreground">{vipRemaining > 0 ? t("checkout.tickets_remaining").replace("{n}", String(vipRemaining)) : t("checkout.sold_out")}</p>
                </div>
                <span className="text-lg font-bold text-primary">{fmtEvent(vipPrice)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quantity */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-3">{t("checkout.quantity")}</h2>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-full flex items-center justify-center border border-border hover:bg-muted transition-colors"
            >
              <Minus className="w-4 h-4 text-foreground" />
            </button>
            <span className="text-2xl font-bold text-foreground w-12 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
              disabled={quantity >= maxQty}
              className="w-10 h-10 rounded-full flex items-center justify-center border border-border hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-3">{t("checkout.order_summary")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{ticketType === "vip" ? t("checkout.vip") : t("checkout.ga")} × {quantity}</span>
              <span>{isFree ? t("checkout.free") : fmtEvent(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("checkout.service_fee")}</span>
              <span>{isFree ? t("checkout.free") : manualRail ? t("checkout.manual_no_fee", "No fee") : fmtEvent(checkoutFee)}</span>
            </div>
            {!baseFree && (
              <div className="pt-2">
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Promo code (optional)</label>
                {/* min-w-0 + shrink-0 (Lee, 18 Aug 2026): the input was pushing Apply off the
                    right edge on phones — the button is now pinned, the input yields. */}
                <div className="flex min-w-0 items-stretch gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value); setPromoError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                    placeholder="Enter promo code"
                    className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                  />
                  {appliedCode ? (
                    <button type="button" onClick={clearPromo}
                      className="px-3 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary">
                      Remove
                    </button>
                  ) : (
                    <button type="button" onClick={applyPromo} disabled={!promoCode.trim()}
                      className="shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
                      Apply
                    </button>
                  )}
                </div>
                {promoError && <p className="text-[11px] text-destructive mt-1.5 font-medium">{promoError}</p>}
                {isDemoPromo && <p className="text-[11px] text-primary mt-1.5 font-medium">✓ Code applied — ticket is free</p>}
                {isFounderPromo && <p className="text-[11px] text-primary mt-1.5 font-medium">✓ {appliedCode} applied — $1.00 {isApprovalFounderPromo ? "authorization, charged only after approval" : "total"}</p>}
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
              <span>{t("checkout.total")}</span>
              <span>{isFree ? t("checkout.free") : fmtEvent(checkoutTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment method info */}
        {!isFree && (
          <div className="rounded-2xl bg-card border border-border p-5 mb-4">
            <h2 className="text-sm font-bold text-foreground mb-3">{t("checkout.payment")}</h2>

            {/* Primary: Stripe card (always) */}
            <button
              onClick={() => setPaymentRail("stripe")}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${paymentRail === "stripe" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Card via Stripe</p>
                <p className="text-[10px] text-muted-foreground">{approvalRequired ? "Continue to Stripe. Your card is charged only if the host approves you." : "Standard secure checkout."}</p>
              </div>
            </button>

            {/* Secondary: international / no-card options (Wise, PayPal) — collapsed until opened */}
            {/* v24 DF: manual rails are hidden on approval-gated events — approval must
                capture the authorized card; a Wise/PayPal "I paid" would skip the gate. */}
            {((event as any).accept_wise || (event as any).accept_paypal) &&
              !(event.requires_application && event.application_requires_approval) && (
              <div className="mt-3 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => { const n = !intlOpen; setIntlOpen(n); if (!n) setPaymentRail("stripe"); }}
                  className="w-full flex items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>Live in Colombia or can't use an international card?</span>
                  <span className="shrink-0">{intlOpen ? "▲" : "▼"}</span>
                </button>
                {intlOpen && (
                  <div className="mt-2 space-y-2">
                    {(event as any).accept_wise && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setPaymentRail("wise")}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${paymentRail === "wise" ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <Shield className="w-5 h-5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Wise (direct to host)</p>
                            <p className="text-[10px] text-muted-foreground">Pay the host directly via Wise.</p>
                          </div>
                        </button>
                        {paymentRail === "wise" && (
                          <div className="rounded-xl bg-secondary/40 border border-border p-3 text-xs space-y-2">
                            <p className="text-foreground font-semibold">Send {fmtEvent(checkoutTotal)} via Wise — no OneEvent fee:</p>
                            {manualPaymentUrl((event as any).host_wise_handle, "wise") ? (
                              <a href={manualPaymentUrl((event as any).host_wise_handle, "wise")!} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2">
                                Open Wise to pay <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <p className="font-mono text-primary break-all">{(event as any).host_wise_handle || "Host hasn't added a Wise link yet — pick Stripe or contact host."}</p>
                            )}
                            <p className="text-muted-foreground leading-relaxed">After sending, tap "I paid via Wise" below. Your ticket is held until the host confirms receipt (usually within 24h). OneEvent doesn't hold these funds and can't mediate disputes.</p>
                          </div>
                        )}
                      </div>
                    )}
                    {(event as any).accept_paypal && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setPaymentRail("paypal")}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${paymentRail === "paypal" ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <Shield className="w-5 h-5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">PayPal (direct to host)</p>
                            <p className="text-[10px] text-muted-foreground">Pay the host directly via PayPal.</p>
                          </div>
                        </button>
                        {paymentRail === "paypal" && (
                          <div className="rounded-xl bg-secondary/40 border border-border p-3 text-xs space-y-2">
                            <p className="text-foreground font-semibold">Send {fmtEvent(checkoutTotal)} via PayPal — no OneEvent fee:</p>
                            {manualPaymentUrl((event as any).host_paypal_handle, "paypal") ? (
                              <a href={manualPaymentUrl((event as any).host_paypal_handle, "paypal")!} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2">
                                Open PayPal to pay <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <p className="font-mono text-primary break-all">{(event as any).host_paypal_handle || "Host hasn't added a PayPal link yet — pick Stripe or contact host."}</p>
                            )}
                            <p className="text-muted-foreground leading-relaxed">After sending, tap "I paid via PayPal" below. Your ticket is held until the host confirms receipt (usually within 24h). OneEvent doesn't hold these funds and can't mediate disputes.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Confirm — hidden until the express join is done: the payment step comes AFTER
            the 20-second account, never alongside it. (Lee, 17 Aug 2026) */}
        {isGuest && manualRail ? (
          <button
            onClick={() => handleConfirm()}
            disabled={submitting || !guestName.trim() || !guestEmail.trim()}
            className="w-full py-3.5 rounded-2xl font-semibold text-base text-primary-foreground bg-gradient-to-b from-primary to-primary/85 shadow-lg shadow-primary/25 ring-1 ring-black/5 hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2.5"
          >
            {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Recording payment...</> :
              <><Ticket className="w-5 h-5" /> I paid {fmtEvent(checkoutTotal)} via {paymentRail === "wise" ? "Wise" : "PayPal"}</>}
          </button>
        ) : isGuest ? null : (
        <button
          onClick={() => handleConfirm()}
          disabled={submitting}
          /* POLISHED CTA (Lee, 18 Aug 2026): soft gradient, deeper shadow, pressed state —
             and the approval case reads as TWO lines: the money big, the ask smaller. */
          className="w-full py-3.5 rounded-2xl font-semibold text-base text-primary-foreground bg-gradient-to-b from-primary to-primary/85 shadow-lg shadow-primary/25 ring-1 ring-black/5 hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2.5"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> {isFree ? "Registering..." : paymentRail === "wise" ? "Logging Wise payment..." : paymentRail === "paypal" ? "Logging PayPal payment..." : "Opening secure payment..."}</>
          ) : approvalRequired && !isFree && paymentRail === "stripe" ? (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15"><Ticket className="w-5 h-5" /></span>
              <span className="text-left leading-tight">
                <span className="block text-lg font-bold">Proceed to payment</span>
                <span className="block text-[12.5px] font-medium opacity-85">&amp; Request to Join</span>
              </span>
            </>
          ) : (
            <><Ticket className="w-5 h-5" /> {isFree ? t("checkout.confirm_free") : paymentRail === "wise" ? `I paid ${fmtEvent(checkoutTotal)} via Wise` : paymentRail === "paypal" ? `I paid ${fmtEvent(checkoutTotal)} via PayPal` : `Pay ${fmtEvent(checkoutTotal)}`}</>
          )}
        </button>
        )}

        <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <Shield className="w-3 h-3" /> {t("checkout.secured")}
        </div>
      </div>
      <Footer />
    </div>
  );
}
