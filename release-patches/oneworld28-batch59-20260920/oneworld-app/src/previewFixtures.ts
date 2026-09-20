/**
 * PREVIEW FIXTURES — only ever bundled when `VITE_PREVIEW=1` (the double-clickable UAT file).
 * ============================================================================================
 * The preview build is a SINGLE HTML file Lee opens from his own disk: no server, no deploy, no
 * live database. This module makes that honest and safe — it seeds a demo session and answers
 * every network call the app would make with local demo data, so nothing ever reaches the real
 * backend from a preview. The production build never imports this file (see main.tsx).
 */
const ME = "00000000-0000-4000-8000-000000000abc";
const KEY = "sb-wseblryyqxawvbjmylbo-auth-token";
const PROP = "33333333-0000-4000-8000-000000000001";
const REQ = "44444444-0000-4000-8000-000000000001";
const PROP_THEIRS = "33333333-0000-4000-8000-000000000002";
const PROP_BOOKED = "33333333-0000-4000-8000-000000000003";
/* ⚠️ THE SALE LISTING PAGE HAD NO FIXTURE AT ALL, so it could not be photographed once — and a
   screen the harness cannot show is a screen the harness cannot catch a defect on. That is how
   the head rework (panel, description box, grouped facts) shipped on the rent page in batch 53
   and was still missing here in batch 55. */
const SALE_PROP = "55555555-0000-4000-8000-000000000001";
const REQ_MINE = "44444444-0000-4000-8000-000000000002";
export const SHOT_IDS = { PROP, REQ, PROP_THEIRS, PROP_BOOKED, REQ_MINE, SALE_PROP };

const PEOPLE = [
  { id: "11111111-0000-4000-8000-000000000001", full_name: "Maria Alvarez", photo_url: null, job_title: "Event Planner", industry: "Events", location: "Atlanta, GA", score_v9_snapshot: 79.5, is_public: true, bio: "Weddings, galas, launches." },
  { id: "11111111-0000-4000-8000-000000000002", full_name: "James Carter", photo_url: null, job_title: "Master Plumber", industry: "Trades", location: "Jackson, MS", score_v9_snapshot: 80.5, is_public: true, bio: "Licensed & bonded, 15 years." },
  { id: "11111111-0000-4000-8000-000000000003", full_name: "Kayla Nguyen", photo_url: null, job_title: "Creator", industry: "Technology", location: "Austin, TX", score_v9_snapshot: 84.3, is_public: true, bio: "Build vlogs & product reviews." },
  { id: "11111111-0000-4000-8000-000000000004", full_name: "Devon Brooks", photo_url: null, job_title: "Photographer", industry: "Media", location: "Chicago, IL", score_v9_snapshot: 62.1, is_public: true, bio: "Portraits, events, editorial." },
  { id: ME, full_name: "Lee Frazier", photo_url: null, job_title: "Founder", industry: "Technology", location: "Atlanta, GA", score_v9_snapshot: 72.5, is_public: true, bio: "Building One World Labs." },
];

const POSTS = [
  { id: "22222222-0000-4000-8000-000000000001", user_id: PEOPLE[2].id, media_type: "VIDEO", media_url: null, thumbnail_url: null, caption: "New build vlog is up — three cities, one week.", likes_count: 214, comments_count: 31, shares_count: 8, saves_count: 2, created_at: new Date().toISOString(), source: "import", source_platform: "youtube", moderation_status: "visible" },
  { id: "22222222-0000-4000-8000-000000000002", user_id: PEOPLE[0].id, media_type: "PHOTO", media_url: null, thumbnail_url: null, caption: "200-seat gala, done and dusted.", likes_count: 89, comments_count: 12, shares_count: 3, saves_count: 1, created_at: new Date().toISOString(), source: "import", source_platform: "tiktok", moderation_status: "visible" },
  { id: "22222222-0000-4000-8000-000000000003", user_id: PEOPLE[3].id, media_type: "TEXT", media_url: null, thumbnail_url: null, caption: "Booked out through October. Grateful.", likes_count: 45, comments_count: 6, shares_count: 1, saves_count: 0, created_at: new Date().toISOString(), source: "upload", source_platform: null, moderation_status: "visible" },
];

const TABLES: Record<string, unknown[]> = {
  profiles: PEOPLE,
  media_posts: POSTS,
  one_world_products: [{ product: "onescore" }, { product: "onesocial" }, { product: "onejob" }, { product: "oneevent" }],
  /* ── ONEEVENT MEDIA (OneEvent 30, 20 Sep 2026) — one event in the new shape (photos, a video
     that leads the feed, a vertical-flyer cover) and one saved before the columns existed, so the
     preview photographs both the strip and the legacy fallback. Media is served by the preview
     server itself under /pm/, never from a live bucket. */
  events: [{
    id: "66666666-0000-4000-8000-000000000001", host_id: ME, title: "Medellín Founders Rooftop Social",
    description: "<p>Founders, operators and investors. Rooftop, sunset, live DJ. Bring a card.</p>",
    category: "Networking", event_type: "networking", visibility: "public", location_type: "in-person",
    location: "Carrera 37 #8A-25, El Poblado, Medellín", venue_name: "Rooftop Provenza",
    start_date: new Date(Date.now() + 5 * 864e5).toISOString(), end_date: new Date(Date.now() + 5 * 864e5 + 4 * 36e5).toISOString(),
    timezone: "America/Bogota", ticket_type: "paid", ticket_price: 25, ga_ticket_price: 25, ga_ticket_qty: 120, ga_sold: 41,
    has_vip_ticket: true, vip_ticket_price: 60, vip_ticket_qty: 20, vip_sold: 6, currency: "USD",
    status: "published", attendee_count: 47, revenue: 0, max_attendees: 140, min_score: 0,
    cover_image_url: "/pm/flyer.png", cover_aspect_ratio: "4:5",
    photos: ["/pm/flyer.png", "/pm/p2.png", "/pm/p3.png"], videos: ["/pm/v1.webm"],
    cover_photo: "/pm/flyer.png", feed_preview: { kind: "video", url: "/pm/v1.webm" }, feed_visible: true,
    attachment_urls: [{ name: "menu.pdf", url: "/pm/menu.pdf" }], address_visible: true, slug: "rooftop-social",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, {
    id: "66666666-0000-4000-8000-000000000002", host_id: "11111111-0000-4000-8000-000000000001", title: "Atlanta Wedding Vendors Mixer",
    description: "<p>Planners, florists, DJs and photographers. Free.</p>",
    category: "Meetup", event_type: "meetup", visibility: "public", location_type: "in-person",
    location: "Ponce City Market, Atlanta, GA", venue_name: "Ponce City Market",
    start_date: new Date(Date.now() + 9 * 864e5).toISOString(), end_date: null, timezone: "America/New_York",
    ticket_type: "free", ticket_price: 0, ga_ticket_price: 0, ga_ticket_qty: null, ga_sold: 0, has_vip_ticket: false,
    vip_ticket_price: 0, vip_ticket_qty: null, vip_sold: 0, currency: "USD",
    status: "published", attendee_count: 12, revenue: 0, max_attendees: null, min_score: 0,
    /* LEGACY: cover only, no media columns filled — must still show the flyer as its one slide. */
    cover_image_url: "/pm/p2.png", cover_aspect_ratio: "16:9", photos: [], videos: [], cover_photo: null, feed_preview: null,
    attachment_urls: [], address_visible: true, slug: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }],
  verified_assets: [
    { id: "va-seed-1", user_id: ME, platform: "identity", asset_class: "identity", proof_level: "oauth", handle: "ID verified", revoked_at: null },
    { id: "va-seed-2", user_id: ME, platform: "linkedin", asset_class: "presence", proof_level: "handle_match", handle: "linkedin.com/in/leefrazier", revoked_at: null },
  ],
  proven_deals: [],
  endorsements: [{ endorser_score_at_time: 70, retracted_at: null }],
  user_connections: [{ requester_id: ME, recipient_id: PEOPLE[1].id, status: "accepted" }],
  social_connections: [
    { id: "x1", platform: "youtube", username: "leefrazier", is_verified: true, is_active: true },
    { id: "x2", platform: "instagram", username: "lee.builds", is_verified: false, is_active: true },
  ],
  job_reviews: [],
  /* ⚠️ PREVIEW ONLY — invented stars so Lee can see the rating row filled in. Lee, 18 Sep 2026:
     *"let's make some fake reviews… four and a half stars and a 4.6… for the host three and a
     half and a 3.8, just so we can see how it looks."* These live in the PREVIEW fixture and
     nowhere else: inventing reviews in the real database would put praise in the mouths of
     people who never wrote it, on a marketplace whose whole pitch is that its reputation
     numbers are real. */
  property_rating_summary: [{ property_id: PROP_THEIRS, score: 4.6, reviews: 27 }],
  host_rating_summary: [{ user_id: PEOPLE[1].id, score: 3.8, reviews: 12 }],
  conversations: [],
  one_world_app_links: [],
  /* ── ONEHOME (14 Sep 2026) ────────────────────────────────────────────────────────────────
     Added so the rental screens can be PHOTOGRAPHED before a release instead of described. A
     host with a finished profile and one live listing is the state Lee reviews from. */
  /* ── THE SHARED VAULT (15 Sep 2026) ───────────────────────────────────────────────────
     Where a person is paid, across every One World product. EMPTY on purpose: the first thing
     Lee should see is the state a brand-new host is in, because that is the state the Save
     button has to refuse. Seed a row here to photograph the opposite. */
  payment_methods: [{ id: "pm-1", user_id: ME, provider: "wise", method_type: "wise", handle: "https://wise.com/pay/me/anarestrepo", alias: null, is_primary: false, created_at: new Date().toISOString() }],
  stripe_connect_accounts: [],
  rental_host_profiles: [
    { user_id: ME, legal_name: "Ana María Restrepo", document_kind: "national_id", document_number: "1017 234 567",
      role: "owner", private_address_line: "Carrera 43A #7-50", private_city: "Medellín",
      private_region: "Antioquia", private_postal_code: "050021", private_country: "CO",
      payout_method: "remitly", manual_payout_confirmed_at: null,
      identity_storage_path: null, identity_mime_type: null, identity_byte_size: null,
      profile_ready: true },
  ],
  /* ⚠️ THE VIEWINGS LIST HAD NO FIXTURE, so the one screen Lee asked about could only ever be
     photographed in its empty state — the same gap that let the sale listing page drift for two
     batches. Two rows: one waiting on the host (which is what puts a number on the tab) and one
     already agreed, so both states of the card can be seen at once. */
  property_showings: [
    { id: "66666666-0000-4000-8000-000000000001", property_id: PROP, guest_id: PEOPLE[0].id,
      host_id: ME, state: "requested",
      starts_at: new Date(Date.now() + 26 * 3600e3).toISOString(),
      ends_at:   new Date(Date.now() + 26.5 * 3600e3).toISOString(),
      guest_note: "Could I bring my partner? We are both on the application.", host_note: null },
    { id: "66666666-0000-4000-8000-000000000002", property_id: PROP, guest_id: PEOPLE[2].id,
      host_id: ME, state: "accepted",
      starts_at: new Date(Date.now() + 74 * 3600e3).toISOString(),
      ends_at:   new Date(Date.now() + 74.5 * 3600e3).toISOString(),
      guest_note: null, host_note: "Buzzer is 302. I will be there." },
  ],
  sale_properties: [{
    id: SALE_PROP, agent_id: ME, feed_visible: true, status: "published", is_public: true,
    title: "Penthouse in Provenza, two terraces",
    description: "Top floor, north-facing, two private terraces and a view down the valley. "
      + "Sold furnished if you want it that way.",
    photos: [], asking_price: 385000, currency: "USD", display_currency: "COP", display_fx_rate: 3100.45,
    commission_pct: 3, commission_paid_by: "seller", earnest_money: 15000, kind: "apartment",
    country: "CO", city: "Medellín", neighbourhood: "El Poblado", address_is_public: false,
    bedrooms: 3, bathrooms: 3, area_m2: 184, parking_spaces: 2, year_built: 2019, estrato: 6,
    admin_fee_monthly: 320, property_type: "apartment", floor_number: 11, floors_in_building: 11,
    listing_no: 10427, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }],
  rental_properties: [{
    /* An unfinished draft, so the hub's "continue where you left off" path can be photographed. */
    id: "33333333-0000-4000-8000-0000000000d1", agent_id: ME, status: "draft",
    title: "Sunny studio near Parque Lleras", price: 0, currency: "COP", price_unit: "month",
    photos: [], videos: [], city: "Medellín", region: "Antioquia", neighbourhood: "El Poblado", country: "CO",
    updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
  }, {
    /* ⚠️ `feed_visible` WAS MISSING AND THE DISCOVER FEED PHOTOGRAPHED AS EMPTY — the feed
       filters `.eq("feed_visible", true)` and an absent field is not true. The preview said
       "No places here yet" while a published listing sat right there, which is a fixture gap
       that looks exactly like a product fault. */
    id: PROP, agent_id: ME, feed_visible: true, title: "Bright two-bedroom in El Poblado",
    price: 4200000, currency: "COP", price_unit: "month", deposit_required: true, deposit_amount: 4200000,
    deposit_currency: "COP", deposit_basis: "months", deposit_months: 1, deposit_return_days: 30,
    city: "Medellín", region: "Antioquia", neighbourhood: "El Poblado", country: "CO", address_line: "Carrera 43A #7-50",
    address_is_public: false, bedrooms: 2, bathrooms: 2, area_m2: 88, property_type: "apartment",
    status: "published", is_public: true, host_pays_guest_fee: false, min_term_days: 180,
    available_from: "2026-10-01", furnished: true, created_at: new Date().toISOString(),
    display_currency: "COP", display_fx_rate: 1, owner_terms_enabled: true,
  }, {
    /* ── TWO LISTINGS OWNED BY SOMEBODY ELSE, so the GUEST side can be photographed at all.
       Every rental fixture until now belonged to ME, which meant `!mine` was false on every
       listing and the entire guest half of the product — the three action rows, the request
       pill, the request sheet — could not be rendered in the preview even once. A harness that
       cannot show a screen is a harness that cannot catch a defect on it. */
    id: PROP_THEIRS, agent_id: PEOPLE[1].id, feed_visible: true,
    title: "Quiet one-bedroom in Laureles",
    price: 3100000, currency: "COP", price_unit: "month", deposit_required: false,
    city: "Medellín", region: "Antioquia", neighbourhood: "Laureles", country: "CO",
    address_is_public: false, bedrooms: 1, bathrooms: 1, area_m2: 54, property_type: "apartment",
    status: "published", is_public: true, host_pays_guest_fee: false, min_term_days: 30,
    available_from: "2026-10-01", furnished: true, created_at: new Date().toISOString(),
    display_currency: "COP", display_fx_rate: 1, max_guests: 2,
    showings_enabled: true, showing_notice_hours: 24, showing_slot_minutes: 30,
    owner_terms_enabled: true, lease_notice_days: 30, payment_window_business_days: 5, breach_penalty_months: 1,
    check_in_time: null, check_out_time: null, cleaning_fee: 150000,
    /* ⚠️ ATTRIBUTES, BECAUSE WITHOUT THEM THE HARNESS CANNOT SEE THE CONTROL THAT HIDES THEM.
       20 September 2026: Lee reported his attributes were missing from the listing page. They
       were not — they were behind a "show all" button that did not look like a button. The
       preview listing had no attributes set at all, so `hiddenCount` was zero, the button never
       rendered, and every screenshot I had taken of this page was of the one case where the bug
       is invisible. A fixture that exercises only the empty state is a fixture that certifies
       nothing. These are the same columns a real host fills in on the form. */
    floor_number: 3, floors_in_building: 12, parking_spaces: 1, estrato: 4,
    master_bed: "queen", walk_in_closet: true, dual_vanities: false,
    laundry: "in_unit_separate", air_conditioning_units: 2,
    has_balcony: true, has_patio: false, has_backyard: false, has_grill: false,
    security_level: "24_7", pets_allowed: "both", schools_nearby: true,
  }, {
    id: PROP_BOOKED, agent_id: PEOPLE[1].id, feed_visible: true,
    title: "Two-bedroom with balcony in Envigado",
    price: 3800000, currency: "COP", price_unit: "month", deposit_required: false,
    city: "Envigado", region: "Antioquia", neighbourhood: "Zúñiga", country: "CO",
    address_is_public: false, bedrooms: 2, bathrooms: 2, area_m2: 76, property_type: "apartment",
    status: "published", is_public: true, host_pays_guest_fee: false, min_term_days: 30,
    available_from: "2026-10-01", furnished: true, created_at: new Date().toISOString(),
    display_currency: "COP", display_fx_rate: 1, max_guests: 4,
    showings_enabled: true, showing_notice_hours: 24, showing_slot_minutes: 30,
    owner_terms_enabled: true, lease_notice_days: 30, payment_window_business_days: 5, breach_penalty_months: 1,
    check_in_time: "15:00", check_out_time: "11:00", cleaning_fee: 180000,
    house_rules: ["No smoking anywhere inside the apartment.", "No parties or events.", "Quiet hours are 10pm to 7am.", "Please take the rubbish out on Tuesdays."],
  }],
  rental_booking_requests: [{
    id: REQ, property_id: PROP, guest_id: PEOPLE[0].id, agent_id: ME,
    state: "requested", approval_stage: "requested",
    starts_on: "2026-10-01", ends_on: "2027-09-30",
    quoted_total: 50400000, guest_total: 54180000, host_net: 45870960,
    host_fee_rate: 0.015, guest_fee_rate: 0.075, currency: "COP",
    identity_status: "submitted", payment_status: "pending", payment_rail: "stripe",
    payment_declared_at: null, preapproval_expires_at: new Date(Date.now() + 864e5).toISOString(),
    expires_at: new Date(Date.now() + 1728e5).toISOString(), created_at: new Date().toISOString(),
  }, {
    /* MY OWN live request, on somebody else's listing — the one the pill and the pop-up render
       from. Pre-approved on an external rail, so the steps show the real payment instruction
       rather than only "wait". */
    id: REQ_MINE, property_id: PROP_BOOKED, guest_id: ME, agent_id: PEOPLE[1].id,
    state: "requested", approval_stage: "preapproved_ready",
    starts_on: "2026-10-01", ends_on: "2026-11-01", nights: 31,
    quoted_total: 3800000, guest_total: 4085000, host_net: 3458380,
    host_fee_rate: 0.0599, guest_fee_rate: 0.03, currency: "COP",
    identity_status: "submitted", payment_status: "payment_pending", payment_rail: "remitly",
    payment_declared_at: null, payment_received_at: null,
    check_in_time: "15:00", check_out_time: "11:00",
    rental_properties: { cleaning_fee: 180000 },
    preapproval_expires_at: new Date(Date.now() + 864e5).toISOString(),
    expires_at: new Date(Date.now() + 1728e5).toISOString(), created_at: new Date().toISOString(),
  }],
  rental_request_identity_documents: [],
  rental_contracts: [],
  renter_profiles: [],
  saved_items: [],
};

/* RPC answers. The interceptor used to return `null` for every RPC it did not know, and a null is
   indistinguishable from a failure to a caller that checks for a row — which is why the harness
   opened on "We couldn't check your One ID" instead of on the app. An RPC that is not listed here
   still returns null; one that a screen GATES on belongs here. */
export const RPCS: Record<string, unknown> = {
  my_onboarding_status: [{ is_required: false, is_complete: true }],
  /* The demo host is VIP on OneEvent so the preview draws the Videos section and the 5 / 10 caps. */
  my_app_plan: [{ plan: "vip", plan_interval: "month", current_period_end: new Date(Date.now() + 30 * 864e5).toISOString() }],
  /* The rails this demo host can actually receive. Mirrors what the real function returns:
     NAMES only, never a handle. The seeded host has a Wise link and no bank payouts, so the
     request sheet should offer Wise and nothing else — that is the whole point of the fix. */
  rental_property_payout_rails: ["wise"],
  /* Where a pre-approved guest sends the rent. Mirrors the real function: ONE rail — the one
     already chosen on this request — never the host's other destinations, never a card. */
  rental_request_payment_instructions: [{
    rail: "wise", handle: "https://wise.com/pay/me/anarestrepo",
    host_name: "Ana María Restrepo", amount: 54180000, currency: "COP",
    state: "requested", payable: true, reason: "ok",
  }],
  rental_host_profile_readiness: [{
    profile_ready: true, identity_ready: true, payout_ready: true,
    missing: [], legal_name: "Ana María Restrepo",
  }],
  rental_property_address: null,
  set_rental_property_address: null,
};

export function installPreviewFixtures() {
  const session = {
    access_token: "preview", token_type: "bearer", expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "preview",
    user: { id: ME, email: "lee@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    localStorage.setItem(`ow.setup.${ME}`, "1");
  } catch { /* private mode — the app's safeStorage copes */ }

  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    /* ⚠️ `content-range` USED TO BE THE CONSTANT "0-9/10" FOR EVERY ANSWER, and
       `supabase-js` reads `count` from exactly that header. So any screen asking
       `.select("id", { count: "exact", head: true })` was told TEN whatever the table held —
       including zero. The OneHome host profile asks that question about payout destinations, so
       an empty vault photographed as a host who is ready to be paid: the preview would have
       proved the opposite of the truth. The count is now derived from the rows being returned,
       and a caller that did not ask for one gets no range header at all. */
    const json = (body: unknown, status = 200, count?: number) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "content-type": "application/json",
          ...(count === undefined ? {} : { "content-range": count ? `0-${count - 1}/${count}` : `*/0` }),
        },
      });

    if (/supabase\.co\/auth\/v1\/user/.test(url)) return json(session.user);
    if (/supabase\.co\/auth\/v1\//.test(url)) return json({});
    if (/supabase\.co\/storage\/v1\//.test(url)) return json({ Key: "preview" });
    /* ── EDGE FUNCTIONS ───────────────────────────────────────────────────────────────────
       Unmodelled, these 404 and the screen shows an ERROR where a real member would see a
       plain "not connected" — so the preview photographs a fault that does not exist and hides
       the state Lee actually needs to review. `stripe-connect-status` is answered from the
       fixture table, so seeding a row there photographs a connected bank account and leaving it
       empty photographs a new host. The two onboarding calls answer with no URL: a preview must
       never send anybody to a real payment processor. */
    if (/supabase\.co\/functions\/v1\/stripe-connect-status/.test(url)) {
      const row = (TABLES.stripe_connect_accounts as Record<string, unknown>[])[0];
      return json({
        has_account: !!row,
        payouts_enabled: !!row?.payouts_enabled,
        charges_enabled: !!row?.charges_enabled,
        details_submitted: !!row?.details_submitted,
        requirements_currently_due: [],
        country: (row?.country as string) ?? null,
        default_currency: (row?.default_currency as string) ?? null,
        bank_last4: (row?.bank_last4 as string) ?? null,
        bank_name: (row?.bank_name as string) ?? null,
      });
    }
    if (/supabase\.co\/functions\/v1\/stripe-connect-/.test(url)) return json({ url: null });
    if (/supabase\.co\/functions\/v1\//.test(url)) return json({});
    const m = /supabase\.co\/rest\/v1\/(rpc\/)?([a-z_]+)/.exec(url);
    if (m) {
      if (m[1]) {
        /* RPCs behave for real IN MEMORY so the preview's flows complete end-to-end. */
        const rpc = url.split("/rpc/")[1]?.split("?")[0];
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (rpc === "claim_platform_asset") {
          const id = `va-${Math.random().toString(36).slice(2, 8)}`;
          (TABLES.verified_assets as object[]).push({
            id, user_id: ME, platform: String(body.p_platform || "").toLowerCase(),
            asset_class: body.p_class, proof_level: "self_asserted",
            handle: body.p_handle, revoked_at: null,
          });
          return json(id);
        }
        if (rpc === "revoke_platform_asset") {
          TABLES.verified_assets = (TABLES.verified_assets as { id?: string }[])
            .filter(r => r.id !== body.p_id);
          return json(true);
        }
        if (rpc && rpc in RPCS) return json(RPCS[rpc]);
        return json(null);
      }
      const table = m[2];
      const rows = TABLES[table] ?? [];
      const method = (init?.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        /* Writes in the preview succeed LOCALLY so flows can be clicked end-to-end, and are
           loudly not-real: they live only in this tab. */
        try {
          const payload = init?.body ? JSON.parse(String(init.body)) : {};
          if (table === "media_posts") { TABLES.media_posts = [{ id: `p-${Date.now()}`, likes_count: 0, comments_count: 0, shares_count: 0, saves_count: 0, created_at: new Date().toISOString(), moderation_status: "visible", source: "upload", source_platform: null, thumbnail_url: null, media_url: null, ...payload }, ...(TABLES.media_posts as object[])] as unknown[]; return json([{ id: `p-${Date.now()}` }], 201); }
          if (table === "social_connections") { (TABLES.social_connections as object[]).push({ id: `s-${Date.now()}`, is_verified: false, is_active: true, ...payload }); return json([{ id: `s-${Date.now()}` }], 201); }
          if (table === "user_connections") { (TABLES.user_connections as object[]).push({ status: "pending", ...payload }); return json([], 201); }
          if (table === "one_world_app_links") {
            /* Persist toggle writes so the public-profile switches WORK in the preview —
               Lee's "the toggles don't work" was partly this stub swallowing them. */
            const rows = TABLES.one_world_app_links as { user_id?: string; app?: string; visible?: boolean }[];
            const items = Array.isArray(payload) ? payload : [payload];
            for (const it of items) {
              const hit = rows.find(r => r.user_id === it.user_id && r.app === it.app);
              if (hit) hit.visible = it.visible; else rows.push(it);
            }
            return json(items, 201);
          }
          /* A write to a table the preview does not model returns an empty array, and a caller
             doing `.select("id").single()` then reads `undefined` for the id it just created —
             which looks exactly like a failed save. Rental writes answer with a row. */
          if (table === "rental_properties") {
            const id = (payload as { id?: string }).id ?? `draft-${Date.now()}`;
            const rows = TABLES.rental_properties as Record<string, unknown>[];
            const hit = rows.find(r => r.id === id);
            if (hit) Object.assign(hit, payload); else rows.unshift({ id, ...payload });
            /* `.select("id").single()` asks for an OBJECT, not an array. Answering with an array
               makes `data.id` undefined, which the caller reads as a save that produced no row —
               the preview's own version of a silent failure. */
            const wantsObject = /vnd\.pgrst\.object/.test(String(
              (init?.headers as Record<string, string> | undefined)?.["Accept"]
              ?? (init?.headers instanceof Headers ? init.headers.get("Accept") : "") ?? ""));
            return json(wantsObject ? { id } : [{ id }], 201);
          }
        } catch { /* fall through */ }
        return json([], 201);
      }
      /* Tiny PostgREST-ish filter: id=eq., id=in.(…), user_id=eq., eq filters on a few columns. */
      const u = new URL(url);
      let out = [...rows] as Record<string, unknown>[];
      for (const [k, v] of u.searchParams.entries()) {
        if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) continue;
        if (k === "or") continue;
        if (v.startsWith("eq.")) out = out.filter(r => String(r[k]) === v.slice(3));
        else if (v.startsWith("in.")) {
          const set = v.slice(4, -1).split(",").map(s => s.replace(/^"|"$/g, ""));
          out = out.filter(r => set.includes(String(r[k])));
        } else if (v.startsWith("is.") && v.endsWith("null")) out = out.filter(r => r[k] == null);
        else if (v.startsWith("gt.")) out = out.filter(r => Number(r[k]) > Number(v.slice(3)));
      }
      /* maybeSingle sends Accept: application/vnd.pgrst.object — return an object, not array. */
      const accept = (init?.headers as Record<string, string> | undefined)?.["Accept"]
        ?? (init?.headers instanceof Headers ? init.headers.get("Accept") : "") ?? "";
      if (/vnd\.pgrst\.object/.test(String(accept))) return json(out[0] ?? null, out[0] ? 200 : 406, out.length);
      /* HEAD + `Prefer: count=exact` wants the number and no body — the shape
         `.select(…, { count: "exact", head: true })` sends. */
      if (method === "HEAD") return json(null, 200, out.length);
      return json(out, 200, out.length);
    }
    return real(input as RequestInfo, init);
  };
}
