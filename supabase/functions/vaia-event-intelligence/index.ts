/**
 * vaia-event-intelligence — VAIA's host-side brain.
 *
 * v1 (18 Aug 2026): action "applicant_score" — scores applicants 0–100 against the
 * host's ICP. See below.
 *
 * v2 (19 Aug 2026, Lee's Rolodex UAT): action "rolodex_search" — the "Ask VAIA about
 * your Rolodex" box has invoked this action since the Rolodex shipped, but v1 only
 * knew applicant_score, so every ask failed with "Unknown action". Natural-language
 * search over the caller's OWN host_rolodex (name/occupation/location/tags +
 * custom_fields captured from event applications + the host's notes). One Gemini call
 * returns strict JSON {matches:[{rolodex_id,name,reason}],summary}. Pro+ feature
 * (pro/vip and legacy scout/monster); free plans get {error, upgrade_to:"pro"}.
 *
 * v19 (12 Nov 2026, release nov12-orch2) — FREE MODE. The Pro gate read the legacy
 * `profiles.plan` column directly, so while One World runs in free mode
 * (system_settings.member_plans_free_mode = true) every member still got "AI Rolodex search
 * is a Pro feature." The gate now asks the database's own resolver, public.one_world_plan(),
 * which answers "vip" for every signed-in member while free mode is on, and otherwise reads
 * app_subscriptions + the legacy column exactly as before. If that call fails, it falls back
 * to the old profiles.plan read (never wider than v18). Nothing else in this file changed.
 *
 * Auth: applicant_score → caller must host the event. rolodex_search → caller only
 * ever sees their own rolodex (query is scoped host_id = caller).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { PRO_PLUS, rolodexPlan } from "./plan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];

async function askGemini(geminiKey: string, system: string, user: string, maxTokens = 3000): Promise<{ content: string; lastStatus: number }> {
  let content = "";
  let lastStatus = 0;
  for (const model of MODELS) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${geminiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });
    if (r.ok) {
      const data = await r.json();
      content = data?.choices?.[0]?.message?.content || "";
      break;
    }
    lastStatus = r.status;
    if (r.status !== 400 && r.status !== 404 && r.status !== 429) break;
  }
  return { content, lastStatus };
}

function parseJson(content: string): any | null {
  try {
    return JSON.parse(content.replace(/^```json\s*/i, "").replace(/```\s*$/, ""));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  const authClient = createClient(supabaseUrl, supabaseAnon);
  const serviceClient = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
    const { data: { user }, error: authErr } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const action = String(body?.action || "");
    if (!geminiKey) return json({ error: "AI not configured" }, 503);

    /* ── rolodex_search (v2) ─────────────────────────────────────────────── */
    if (action === "rolodex_search") {
      const query = String(body?.query || "").trim().slice(0, 400);
      if (!query) return json({ error: "query required" }, 400);

      // v19: free mode aware (one_world_plan answers "vip" while member_plans_free_mode is on).
      const plan = await rolodexPlan(
        async () => await serviceClient.rpc("one_world_plan", { p_user: user.id, p_app: "oneevent" }),
        async () => {
          const { data: prof } = await serviceClient.from("profiles").select("plan").eq("id", user.id).maybeSingle();
          return String((prof as any)?.plan || "free");
        },
      );
      const isProPlus = PRO_PLUS.includes(plan);
      if (!isProPlus) return json({ error: "AI Rolodex search is a Pro feature.", upgrade_to: "pro" });

      const { data: rows } = await serviceClient
        .from("host_rolodex")
        .select("id, name, email, occupation, location, tags, custom_fields")
        .eq("host_id", user.id)
        .limit(300);
      const contacts = (rows || []).filter((r: any) => r);
      if (contacts.length === 0) {
        return json({ matches: [], summary: "Your Rolodex is empty — contacts appear here automatically when people apply to or register for your events." });
      }

      const { data: noteRows } = await serviceClient
        .from("rolodex_notes")
        .select("rolodex_id, body")
        .eq("host_id", user.id)
        .limit(500);
      const notesById = new Map<string, string[]>();
      (noteRows || []).forEach((n: any) => {
        const arr = notesById.get(n.rolodex_id) || [];
        arr.push(String(n.body || "").slice(0, 200));
        notesById.set(n.rolodex_id, arr);
      });

      const lines = contacts.map((c: any, i: number) => {
        const cf = c.custom_fields && typeof c.custom_fields === "object"
          ? Object.entries(c.custom_fields).map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`).join("; ")
          : "";
        const notes = (notesById.get(c.id) || []).join(" | ");
        return `${i + 1}. id=${c.id} name=${c.name || "(no name)"}` +
          (c.occupation ? ` occupation=${c.occupation}` : "") +
          (c.location ? ` location=${c.location}` : "") +
          ((c.tags || []).length ? ` tags=${(c.tags || []).join(",")}` : "") +
          (cf ? `\n    details: ${cf}` : "") +
          (notes ? `\n    host notes: ${notes}` : "");
      }).join("\n");

      const SYSTEM =
        `You search a host's private contact list (their "Rolodex") using a natural-language question. ` +
        `Return STRICT JSON only — no markdown fences. Shape:\n` +
        `{"matches":[{"rolodex_id":"<id>","name":"<name>","reason":"<1 short sentence: why this contact matches>"}],` +
        `"summary":"<1-2 sentences answering the question overall; if nothing matches, say so plainly>"}\n` +
        `Match ONLY on the evidence given (occupation, location, tags, details, host notes). ` +
        `Never invent facts. Order matches best-first. At most 10 matches.`;

      const userMsg = `QUESTION: ${query}\n\nCONTACTS:\n${lines}`;
      const { content, lastStatus } = await askGemini(geminiKey, SYSTEM, userMsg, 1500);
      if (!content) return json({ error: "VAIA is temporarily unavailable — try again in a moment.", status: lastStatus }, 502);
      const parsed = parseJson(content);
      if (!parsed) return json({ error: "VAIA returned a malformed answer — try again." }, 502);

      const validIds = new Set(contacts.map((c: any) => c.id));
      const matches = (Array.isArray(parsed?.matches) ? parsed.matches : [])
        .filter((m: any) => validIds.has(m?.rolodex_id))
        .slice(0, 10)
        .map((m: any) => ({
          rolodex_id: String(m.rolodex_id),
          name: String(m.name || "").slice(0, 120),
          reason: String(m.reason || "").slice(0, 300),
        }));
      return json({ matches, summary: typeof parsed?.summary === "string" ? parsed.summary.slice(0, 600) : "" });
    }

    /* ── applicant_score (v1, unchanged) ─────────────────────────────────── */
    const eventId = String(body?.eventId || "");
    const force = !!body?.force;
    if (action !== "applicant_score") return json({ error: `Unknown action: ${action}` }, 400);
    if (!eventId) return json({ error: "eventId required" }, 400);

    const { data: event, error: evErr } = await serviceClient
      .from("events")
      .select("id, title, category, host_id, application_icp_description")
      .eq("id", eventId)
      .single();
    if (evErr || !event) return json({ error: "Event not found" }, 404);
    if (event.host_id !== user.id) return json({ error: "Only the host can score applicants" }, 403);
    const icp = (event.application_icp_description || "").trim();
    if (icp.length < 10) return json({ error: "Define your ICP first" }, 400);

    const { data: form } = await serviceClient
      .from("event_application_forms")
      .select("questions")
      .eq("event_id", eventId)
      .maybeSingle();
    const questions: { id: string; label: string }[] = Array.isArray((form as any)?.questions) ? (form as any).questions : [];
    const labelFor = (qid: string) => questions.find((q) => q.id === qid)?.label || qid;

    let q = serviceClient
      .from("event_applications")
      .select("id, applicant_name, answers, vaia_fit_score")
      .eq("event_id", eventId)
      .limit(50);
    if (!force) q = q.is("vaia_fit_score", null);
    const { data: apps } = await q;
    if (!apps || apps.length === 0) return json({ scored: 0, proactive: null });

    const lines = apps.map((a: any, i: number) => {
      const answers = Object.entries(a.answers || {})
        .map(([k, v]) => `    - ${labelFor(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join("\n");
      return `${i + 1}. id=${a.id} name=${a.applicant_name || "(no name)"}\n${answers || "    (no answers)"}`;
    }).join("\n\n");

    const SYSTEM =
      `You score event applicants against the host's Ideal Candidate Profile (ICP). ` +
      `Return STRICT JSON only — no markdown fences, no commentary. Shape:\n` +
      `{"scores":[{"id":"<application id>","score":<integer 0-100>,"reason":"<1-2 plain sentences>"}],` +
      `"proactive":"<3-5 sentences: your read on this batch — who stands out and why, any pattern worth the host's attention>"}\n` +
      `Scoring: 80+ = clearly matches the ICP on the evidence given; 60-79 = decent partial match; ` +
      `40-59 = weak signal either way; below 40 = evidence points away from the ICP. Thin answers ` +
      `(one-word, test data) can never score above 50 — absence of evidence is not a match. ` +
      `Judge ONLY from the answers; never invent facts about an applicant.`;

    const userMsg =
      `EVENT: ${event.title}${event.category ? ` (${event.category})` : ""}\n\n` +
      `HOST'S ICP:\n${icp}\n\nAPPLICANTS:\n${lines}`;

    const { content, lastStatus } = await askGemini(geminiKey, SYSTEM, userMsg, 3000);
    if (!content) return json({ error: "Scoring temporarily unavailable", status: lastStatus }, 502);

    const parsed = parseJson(content);
    if (!parsed) return json({ error: "Scorer returned malformed output — try again" }, 502);
    const scores: { id: string; score: number; reason: string }[] = Array.isArray(parsed?.scores) ? parsed.scores : [];
    const validIds = new Set(apps.map((a: any) => a.id));
    const now = new Date().toISOString();
    let scored = 0;
    for (const s of scores) {
      if (!validIds.has(s.id)) continue;
      const score = Math.max(0, Math.min(100, Math.round(Number(s.score) || 0)));
      const { error: upErr } = await serviceClient
        .from("event_applications")
        .update({ vaia_fit_score: score, vaia_reasoning: String(s.reason || "").slice(0, 600), vaia_scored_at: now })
        .eq("id", s.id);
      if (!upErr) scored++;
    }

    return json({ scored, proactive: typeof parsed?.proactive === "string" ? parsed.proactive.slice(0, 1500) : null });
  } catch (e) {
    console.error("[vaia-event-intelligence] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
