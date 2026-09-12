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
  one_world_products: [{ product: "onescore" }, { product: "onesocial" }, { product: "onejob" }],
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
  conversations: [],
  one_world_app_links: [],
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
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "content-range": "0-9/10" } });

    if (/supabase\.co\/auth\/v1\/user/.test(url)) return json(session.user);
    if (/supabase\.co\/auth\/v1\//.test(url)) return json({});
    if (/supabase\.co\/storage\/v1\//.test(url)) return json({ Key: "preview" });
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
      if (/vnd\.pgrst\.object/.test(String(accept))) return json(out[0] ?? null, out[0] ? 200 : 406);
      return json(out);
    }
    return real(input as RequestInfo, init);
  };
}
