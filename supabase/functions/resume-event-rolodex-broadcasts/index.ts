import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: secretRow, error: secretError } = await admin
    .from("app_secrets")
    .select("value")
    .eq("key", "ONEEVENT_BROADCAST_RECOVERY_SECRET")
    .maybeSingle();
  const suppliedSecret = req.headers.get("x-oneevent-recovery-secret") || "";
  if (secretError || !secretRow?.value || suppliedSecret !== secretRow.value) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Close work that has remained unavailable beyond the recovery window. This
  // prevents an accepted broadcast from retrying forever or replaying much
  // later without the host's knowledge.
  const { data: staleClosed, error: staleError } = await admin.rpc(
    "fail_stale_event_rolodex_broadcasts",
    { p_stale_after: "30 minutes" },
  );
  if (staleError) {
    return json({ error: `Stale broadcast check failed: ${staleError.message}` }, 500);
  }

  const { data: pending, error } = await admin
    .from("event_rolodex_broadcast_recipients")
    .select("broadcast_id, event_rolodex_broadcasts!inner(status, processing_lock_until)")
    .eq("processing_status", "pending")
    .eq("event_rolodex_broadcasts.status", "processing")
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const candidate = (pending || []).find((row: any) => {
    const lockUntil = row.event_rolodex_broadcasts?.processing_lock_until;
    return !lockUntil || new Date(lockUntil).getTime() < now;
  });

  if (!candidate?.broadcast_id) {
    return json({
      ok: true,
      kicked: false,
      reason: "no_unlocked_pending_broadcast",
      stale_closed: staleClosed,
    });
  }

  const workerResponse = await fetch(
    `${supabaseUrl}/functions/v1/process-event-rolodex-broadcast`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        broadcastId: candidate.broadcast_id,
        trigger: "cron_recovery",
      }),
    },
  );

  const workerBody = await workerResponse.json().catch(() => ({}));
  if (!workerResponse.ok) {
    await admin
      .from("event_rolodex_broadcasts")
      .update({
        processing_lock_until: null,
        processing_error: `Recovery worker HTTP ${workerResponse.status}`,
      })
      .eq("id", candidate.broadcast_id);
  }

  return json(
    {
      ok: workerResponse.ok,
      kicked: true,
      broadcast_id: candidate.broadcast_id,
      worker_status: workerResponse.status,
      worker: workerBody,
      stale_closed: staleClosed,
    },
    workerResponse.ok ? 200 : 502,
  );
});
