const assert = require("assert");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const pgBin = "C:/Users/frazi/.codex/visualizations/2026/09/07/01a07e2a-de79-7b11-9d32-17241d3292c3/postgres-runtime/unpacked/pgsql/bin";
const root = path.resolve(__dirname, "..");
const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "t095-fallback-"));
const dataDir = path.join(runDir, "data");
const port = String(55500 + Math.floor(Math.random() * 300));
const psqlArgs = ["-X", "-q", "-A", "-t", "-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
let started = false;

function run(exe, args, options = {}) {
  return cp.execFileSync(path.join(pgBin, exe + ".exe"), args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4e6,
    ...options,
  });
}
function sql(statement) {
  return run("psql", [...psqlArgs, "-c", statement]).trim();
}
function asyncSql(statement) {
  return new Promise((resolve, reject) => {
    cp.execFile(path.join(pgBin, "psql.exe"), [...psqlArgs, "-c", statement], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4e6,
    }, (error, stdout, stderr) => error ? reject(new Error(stderr)) : resolve(stdout.trim()));
  });
}
function statusCall(id, status) {
  return `select applied,kick_sms_fallback from oneevent_apply_twilio_recipient_status('${id}','${status}',clock_timestamp(),null,null);`;
}
function claimCall(id, broadcastId) {
  return `select should_send,state from oneevent_claim_sms_provider_dispatch('${id}','${broadcastId}','${broadcastId}:${id}:sms',180,3);`;
}
function authorizeCall(id, broadcastId) {
  return `select authorized,state from oneevent_authorize_sms_provider_attempt('${id}','${broadcastId}','${broadcastId}:${id}:sms');`;
}
function fixture(serial) {
  const suffix = String(serial).padStart(12, "0");
  const broadcastId = `10000000-0000-4000-8000-${suffix}`;
  const primaryId = `20000000-0000-4000-8000-${suffix}`;
  const fallbackId = `30000000-0000-4000-8000-${suffix}`;
  const rolodexId = `40000000-0000-4000-8000-${suffix}`;
  sql(`
    insert into event_rolodex_broadcasts(id) values ('${broadcastId}');
    insert into event_rolodex_broadcast_recipients
      (id,broadcast_id,rolodex_id,channel,status,processing_status,provider_status)
    values
      ('${primaryId}','${broadcastId}','${rolodexId}','whatsapp','queued','done','queued'),
      ('${fallbackId}','${broadcastId}','${rolodexId}','sms','queued','done','waiting_for_whatsapp');
  `);
  return { broadcastId, primaryId, fallbackId };
}
async function heldFirst(firstSql, secondSql) {
  let signalLocked;
  const locked = new Promise((resolve) => { signalLocked = resolve; });
  const first = new Promise((resolve, reject) => {
    const child = cp.spawn(path.join(pgBin, "psql.exe"), psqlArgs, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes("LOCKED")) signalLocked();
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => code ? reject(new Error(stderr)) : resolve(stdout));
    child.stdin.end(`begin;${firstSql}\n\\echo LOCKED\nselect pg_sleep(0.18);commit;\n`);
  });
  await locked;
  const startedAt = Date.now();
  const second = await asyncSql(secondSql);
  const blockedMs = Date.now() - startedAt;
  await first;
  assert(blockedMs >= 100, "second transaction did not wait for the row lock");
  return { second, blockedMs };
}

(async () => {
  try {
    run("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--no-locale"]);
    run("pg_ctl", ["-D", dataDir, "-l", path.join(runDir, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"], { stdio: "ignore" });
    started = true;
    sql(`
      create role anon; create role authenticated; create role service_role;
      create table outbound_messages(
        id uuid primary key, status text, provider_status text, provider_status_at timestamptz,
        provider_error_code text, sent_at timestamptz, delivered_at timestamptz,
        failed_at timestamptz, last_error text
      );
      create table event_reminder_deliveries(
        id uuid primary key, status text, provider_status text, provider_status_at timestamptz,
        provider_error_code text, updated_at timestamptz, sent_at timestamptz,
        delivered_at timestamptz, read_at timestamptz, failure_reason text
      );
      create table event_rolodex_broadcasts(
        id uuid primary key, sent_count integer default 0, queued_count integer default 0,
        skipped_count integer default 0, failed_count integer default 0,
        whatsapp_pending_count integer default 0, processed_count integer default 0,
        status text default 'processing', completed_at timestamptz, cancel_requested_at timestamptz
      );
      create table event_rolodex_broadcast_recipients(
        id uuid primary key, broadcast_id uuid not null, rolodex_id uuid not null,
        channel text not null, status text not null, provider_sid text,
        provider_message_id text, error_message text, skipped_reason text,
        queued_at timestamptz, sent_at timestamptz, delivered_at timestamptz,
        opened_at timestamptz, undelivered_at timestamptz,
        processing_status text not null, processed_at timestamptz,
        provider_status text, provider_status_at timestamptz, provider_error_code text
      );
      create table event_rolodex_provider_dispatches(
        id uuid primary key default gen_random_uuid(), recipient_id uuid, broadcast_id uuid,
        channel text not null, idempotency_key text not null unique, state text not null default 'new',
        attempt_count integer not null default 0, lock_until timestamptz, provider_sid text,
        provider_status text, provider_request_id text, last_http_status integer,
        last_error_code text, last_error_redacted text, accepted_at timestamptz,
        reconciled_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
      );
      create unique index on event_rolodex_provider_dispatches(recipient_id,channel);
      create or replace function claim_event_rolodex_provider_dispatch(
        p_recipient_id uuid,p_broadcast_id uuid,p_channel text,p_idempotency_key text,
        p_lock_seconds integer default 180,p_max_attempts integer default 3
      ) returns table(should_send boolean,state text,attempt_count integer,provider_sid text)
      language plpgsql set search_path='' as $$
      declare current_row public.event_rolodex_provider_dispatches%rowtype;
      begin
        insert into public.event_rolodex_provider_dispatches(recipient_id,broadcast_id,channel,idempotency_key)
        values(p_recipient_id,p_broadcast_id,p_channel,p_idempotency_key)
        on conflict(idempotency_key) do nothing;
        select * into current_row from public.event_rolodex_provider_dispatches
        where idempotency_key=p_idempotency_key for update;
        if current_row.state in ('accepted','ambiguous','cancelled')
          or (current_row.state='processing' and current_row.lock_until>now())
          or current_row.attempt_count>=least(greatest(p_max_attempts,1),3) then
          return query select false,current_row.state,current_row.attempt_count,current_row.provider_sid; return;
        end if;
        update public.event_rolodex_provider_dispatches set state='processing',
          attempt_count=event_rolodex_provider_dispatches.attempt_count+1,
          lock_until=now()+make_interval(secs=>least(greatest(p_lock_seconds,30),900)),updated_at=now()
        where id=current_row.id returning * into current_row;
        return query select true,current_row.state,current_row.attempt_count,current_row.provider_sid;
      end $$;
    `);
    for (const migration of [
      "20260911170000_oneevent_atomic_provider_status.sql",
      "20260911180000_oneevent_atomic_whatsapp_fallback.sql",
    ]) sql(fs.readFileSync(path.join(root, "supabase", "migrations", migration), "utf8"));

    const results = [];

    const a = fixture(1);
    const aRace = await heldFirst(statusCall(a.primaryId, "delivered"), statusCall(a.primaryId, "failed"));
    assert.equal(sql(`select provider_status||'|'||status from event_rolodex_broadcast_recipients where id='${a.primaryId}'`), "delivered|sent");
    assert.equal(sql(`select provider_status||'|'||status from event_rolodex_broadcast_recipients where id='${a.fallbackId}'`), "not_needed|skipped");
    results.push({ case: "delivery_then_failure", blockedMs: aRace.blockedMs, second: aRace.second });

    const b = fixture(2);
    const bRace = await heldFirst(statusCall(b.primaryId, "failed"), statusCall(b.primaryId, "delivered"));
    assert.equal(sql(`select provider_status||'|'||status from event_rolodex_broadcast_recipients where id='${b.fallbackId}'`), "not_needed|skipped");
    results.push({ case: "failure_then_delivery", blockedMs: bRace.blockedMs, second: bRace.second });

    const c = fixture(3);
    assert.match(sql(statusCall(c.primaryId, "failed")), /t\|t/);
    assert.match(sql(statusCall(c.primaryId, "failed")), /f\|t/);
    const cRace = await heldFirst(statusCall(c.primaryId, "delivered"), claimCall(c.fallbackId, c.broadcastId));
    assert.match(cRace.second, /f\|cancelled/);
    assert.equal(sql(`select provider_status||'|'||status from event_rolodex_broadcast_recipients where id='${c.fallbackId}'`), "not_needed|skipped");
    results.push({ case: "retry_then_delivery_before_worker_claim", blockedMs: cRace.blockedMs, claim: cRace.second });

    const d = fixture(4);
    assert.match(sql(statusCall(d.primaryId, "failed")), /t\|t/);
    const dRace = await heldFirst(claimCall(d.fallbackId, d.broadcastId), statusCall(d.primaryId, "delivered"));
    assert.match(sql(`select state from event_rolodex_provider_dispatches where recipient_id='${d.fallbackId}'`), /cancelled/);
    assert.equal(sql(`select provider_status||'|'||status from event_rolodex_broadcast_recipients where id='${d.fallbackId}'`), "not_needed|skipped");
    results.push({ case: "worker_claim_then_delivery", blockedMs: dRace.blockedMs, delivery: dRace.second });

    const d2 = fixture(7);
    assert.match(sql(statusCall(d2.primaryId, "failed")), /t\|t/);
    assert.match(sql(claimCall(d2.fallbackId, d2.broadcastId)), /t\|processing/);
    const d2Race = await heldFirst(
      statusCall(d2.primaryId, "delivered"),
      authorizeCall(d2.fallbackId, d2.broadcastId),
    );
    assert.match(d2Race.second, /f\|cancelled/);
    results.push({ case: "delivery_then_provider_authorization", blockedMs: d2Race.blockedMs, authorization: d2Race.second });

    const d3 = fixture(8);
    assert.match(sql(statusCall(d3.primaryId, "failed")), /t\|t/);
    assert.match(sql(claimCall(d3.fallbackId, d3.broadcastId)), /t\|processing/);
    const d3Race = await heldFirst(
      authorizeCall(d3.fallbackId, d3.broadcastId),
      statusCall(d3.primaryId, "delivered"),
    );
    assert.equal(sql(`select state from event_rolodex_provider_dispatches where recipient_id='${d3.fallbackId}'`), "in_flight");
    assert.equal(sql(`select status from event_rolodex_broadcast_recipients where id='${d3.fallbackId}'`), "queued");
    assert.match(sql(claimCall(d3.fallbackId, d3.broadcastId)), /f\|in_flight/);
    assert.equal(sql(`select state from event_rolodex_provider_dispatches where recipient_id='${d3.fallbackId}'`), "in_flight");
    results.push({ case: "provider_authorization_then_delivery_then_reclaim", blockedMs: d3Race.blockedMs, delivery: d3Race.second, dispatch: "in_flight" });

    for (const [serial, terminalState] of [[13, "ambiguous"], [14, "accepted"]]) {
      const x = fixture(serial);
      assert.match(sql(statusCall(x.primaryId, "failed")), /t\|t/);
      assert.match(sql(claimCall(x.fallbackId, x.broadcastId)), /t\|processing/);
      assert.match(sql(authorizeCall(x.fallbackId, x.broadcastId)), /t\|in_flight/);
      sql(`
        update event_rolodex_provider_dispatches
        set state='${terminalState}', provider_sid=${terminalState === "accepted" ? "'SM00000000000000000000000000000951'" : "null"}
        where recipient_id='${x.fallbackId}';
      `);
      assert.match(sql(statusCall(x.primaryId, "delivered")), /t\|f/);
      assert.match(sql(claimCall(x.fallbackId, x.broadcastId)), new RegExp(`f\\|${terminalState}`));
      assert.equal(sql(`select state from event_rolodex_provider_dispatches where recipient_id='${x.fallbackId}'`), terminalState);
      assert.equal(sql(`select status from event_rolodex_broadcast_recipients where id='${x.fallbackId}'`), "queued");
      results.push({ case: `reclaim_preserves_${terminalState}`, dispatch: terminalState, fallback: "queued" });
    }

    const e = fixture(5);
    const secondPrimary = "20000000-0000-4000-8000-000000000006";
    const secondFallback = "30000000-0000-4000-8000-000000000006";
    const secondRolodex = "40000000-0000-4000-8000-000000000006";
    sql(`
      insert into event_rolodex_broadcast_recipients
        (id,broadcast_id,rolodex_id,channel,status,processing_status,provider_status)
      values
        ('${secondPrimary}','${e.broadcastId}','${secondRolodex}','whatsapp','queued','done','queued'),
        ('${secondFallback}','${e.broadcastId}','${secondRolodex}','sms','queued','done','waiting_for_whatsapp');
    `);
    const eRace = await heldFirst(
      statusCall(e.primaryId, "delivered"),
      statusCall(secondPrimary, "delivered"),
    );
    const summary = sql(`
      select sent_count||'|'||queued_count||'|'||skipped_count||'|'||failed_count||'|'||status
      from event_rolodex_broadcasts where id='${e.broadcastId}'
    `);
    assert.equal(summary, "2|0|2|0|completed");
    results.push({ case: "concurrent_summary_publication", blockedMs: eRace.blockedMs, summary });

    const f = fixture(9);
    const fPrimary = "20000000-0000-4000-8000-000000000011";
    const fFallback = "30000000-0000-4000-8000-000000000011";
    const fRolodex = "40000000-0000-4000-8000-000000000011";
    sql(`
      insert into event_rolodex_broadcast_recipients
        (id,broadcast_id,rolodex_id,channel,status,processing_status,provider_status)
      values
        ('${fPrimary}','${f.broadcastId}','${fRolodex}','whatsapp','queued','done','queued'),
        ('${fFallback}','${f.broadcastId}','${fRolodex}','sms','queued','done','waiting_for_whatsapp');
    `);
    const workerSummaryCall = `select * from oneevent_refresh_broadcast_delivery_summary('${f.broadcastId}',clock_timestamp());`;
    const fRace = await heldFirst(workerSummaryCall, statusCall(fPrimary, "delivered"));
    const fSummary = sql(`select sent_count||'|'||queued_count||'|'||skipped_count from event_rolodex_broadcasts where id='${f.broadcastId}'`);
    assert.equal(fSummary, "1|2|1");
    results.push({ case: "worker_summary_then_callback_summary", blockedMs: fRace.blockedMs, summary: fSummary });

    const g = fixture(10);
    const gPrimary = "20000000-0000-4000-8000-000000000012";
    const gFallback = "30000000-0000-4000-8000-000000000012";
    const gRolodex = "40000000-0000-4000-8000-000000000012";
    sql(`
      insert into event_rolodex_broadcast_recipients
        (id,broadcast_id,rolodex_id,channel,status,processing_status,provider_status)
      values
        ('${gPrimary}','${g.broadcastId}','${gRolodex}','whatsapp','queued','done','queued'),
        ('${gFallback}','${g.broadcastId}','${gRolodex}','sms','queued','done','waiting_for_whatsapp');
    `);
    const gRace = await heldFirst(
      statusCall(gPrimary, "delivered"),
      `select * from oneevent_refresh_broadcast_delivery_summary('${g.broadcastId}',clock_timestamp());`,
    );
    const gSummary = sql(`select sent_count||'|'||queued_count||'|'||skipped_count from event_rolodex_broadcasts where id='${g.broadcastId}'`);
    assert.equal(gSummary, "1|2|1");
    results.push({ case: "callback_summary_then_worker_summary", blockedMs: gRace.blockedMs, summary: gSummary });

    const grants = sql(`
      select has_function_privilege('anon','public.oneevent_apply_twilio_recipient_status(uuid,text,timestamptz,text,text)','execute'),
        has_function_privilege('authenticated','public.oneevent_apply_twilio_recipient_status(uuid,text,timestamptz,text,text)','execute'),
        has_function_privilege('service_role','public.oneevent_apply_twilio_recipient_status(uuid,text,timestamptz,text,text)','execute'),
        has_function_privilege('anon','public.oneevent_claim_sms_provider_dispatch(uuid,uuid,text,integer,integer)','execute'),
        has_function_privilege('authenticated','public.oneevent_claim_sms_provider_dispatch(uuid,uuid,text,integer,integer)','execute'),
        has_function_privilege('service_role','public.oneevent_claim_sms_provider_dispatch(uuid,uuid,text,integer,integer)','execute'),
        has_function_privilege('anon','public.oneevent_authorize_sms_provider_attempt(uuid,uuid,text)','execute'),
        has_function_privilege('authenticated','public.oneevent_authorize_sms_provider_attempt(uuid,uuid,text)','execute'),
        has_function_privilege('service_role','public.oneevent_authorize_sms_provider_attempt(uuid,uuid,text)','execute'),
        has_function_privilege('service_role','public.oneevent_refresh_broadcast_delivery_summary(uuid,timestamptz)','execute')
    `);
    assert.equal(grants, "f|f|t|f|f|t|f|f|t|t");

    sql(fs.readFileSync(
      path.join(root, "supabase", "rollbacks", "20260911180000_oneevent_atomic_whatsapp_fallback.sql"),
      "utf8",
    ));
    assert.equal(sql(`select coalesce(to_regprocedure('public.oneevent_apply_twilio_recipient_status(uuid,text,timestamptz,text,text)')::text,'')`), "");
    assert.equal(sql(`select coalesce(to_regprocedure('public.oneevent_authorize_sms_provider_attempt(uuid,uuid,text)')::text,'')`), "");
    sql(fs.readFileSync(
      path.join(root, "supabase", "rollbacks", "20260911170000_oneevent_atomic_provider_status.sql"),
      "utf8",
    ));
    assert.equal(sql(`select coalesce(to_regprocedure('public.oneevent_apply_twilio_provider_status(text,uuid,text,timestamptz,text,text)')::text,'')`), "");

    const output = {
      localOnly: true,
      productionWrites: false,
      exactMigrationsCompiled: true,
      exactRollbacksCompiled: true,
      cases: results,
      grants,
    };
    const resultsPath = path.join(root, "artifacts", "T095-FALLBACK-ATOMICITY-RESULTS.json");
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(output, null, 2) + "\n");
    console.log("PASS", JSON.stringify(output));
  } finally {
    if (started) run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
    fs.rmSync(runDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
