-- ============================================================================================
-- DRAFT — NOT APPLIED. Deploys and migrations are LEE-ONLY.
-- ============================================================================================
-- OneAgent's four NEW agent-owned tables. Nothing here touches existing tables (contracts,
-- jobs, notifications, profiles are all untouched). RLS is declared on these NEW tables only;
-- owner = the agent user (agent_id = auth.uid()), with roster members able to READ their own
-- row and their own deals once member_user_id is linked.
--
-- NO MONEY MOVES THROUGH THESE TABLES. `rate_amount` / `agent_cut_pct` are the recorded terms
-- of a deal, not a ledger — payments run through OneJob's money layer when consent review
-- completes (Lee, 8 Aug 2026). The agent's cut is a percentage INSIDE the talent's rate,
-- visible to talent and agent only; the platform's 5.99% fee is separate and unchanged.
-- ============================================================================================

-- ── agent_roster — the represented people, carrying the PARTNER LADDER ──────────────────────
-- Lee's ruling, 9 Aug 2026 (replaces the loose "consent" framing): a deliberate ladder, and a
-- rung can never be skipped:
--   invited → accepted invite = 'connected' → agent may send a representation CONTRACT
--           → contract accepted = 'partnered'.
-- Rules the schema must uphold (app-side today, trigger-enforced at apply time):
--   · a contract can ONLY be sent to a row at partner_status = 'connected' — never a stranger;
--   · either side may DISCONNECT at any time → partner_status = 'ended', and the SAME
--     transaction must set any active agent_rep_contracts row for this member to 'ended'
--     (draft trigger note below — transactional, so server-side, never two client writes);
--   · rung advances beyond 'invited' (accepting an invite, accepting a contract) happen on the
--     MEMBER's side / server-side — the agent's client only creates invites.
create table if not exists public.agent_roster (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references auth.users (id) on delete cascade,
  -- Null until the person signs up / is matched to a One ID; then their own reads light up.
  member_user_id  uuid references auth.users (id),
  full_name       text not null,
  email           text not null,
  category        text,
  notes           text,
  partner_status  text not null default 'invited'
                  check (partner_status in ('invited', 'connected', 'partnered', 'ended')),
  -- Recorded (COUNSEL-GATED) scopes — subset of {apply, negotiate, sign}. Not binding until
  -- legal sign-off; expected to ride the representation contract once counsel settles it.
  consent_scopes  text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── agent_deals — the pipeline ──────────────────────────────────────────────────────────────
create table if not exists public.agent_deals (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references auth.users (id) on delete cascade,
  roster_member_id  uuid references public.agent_roster (id),
  -- 'talent'  = the agent represents talent looking for work
  -- 'company' = the agent represents a company looking for talent
  direction         text not null check (direction in ('talent', 'company')),
  counterpart_name  text,
  title             text not null,
  rate_amount       numeric,          -- the ONE total the client sees
  rate_currency     text not null default 'USD',
  agent_cut_pct     numeric,          -- INSIDE the rate; talent/agent eyes only
  stage             text not null default 'intake'
                    check (stage in ('intake','matched','negotiating','signed','in-progress','closed')),
  start_date        date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── agent_rep_contracts — the STANDING representation contract (spec/display only) ──────────
-- Lee's clarified model, 9 Aug 2026: agent and client sign a standing contract — begin date,
-- end date, commission % (adjustable per deal via agent_deals.agent_cut_pct) — NO money at
-- signing; it is held on the profile. When deals flow through OneJob, Stripe pays the
-- professional AND the agent from the hirer's one payment (OneJob money-layer work, not here).
-- The OneAgent client only READS these rows; there is no propose/agree write path until
-- counsel signs off. Commission stays talent/agent-visible only, like agent_cut_pct.
create table if not exists public.agent_rep_contracts (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references auth.users (id) on delete cascade,
  roster_member_id  uuid references public.agent_roster (id),
  direction         text not null check (direction in ('talent', 'company')),
  commission_pct    numeric,
  starts_on         date,
  ends_on           date,
  status            text not null default 'proposed'
                    check (status in ('proposed', 'active', 'ended', 'revoked')),
  agreed_at         timestamptz,
  created_at        timestamptz not null default now()
);

-- ── agent_activity — the home feed ──────────────────────────────────────────────────────────
create table if not exists public.agent_activity (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references auth.users (id) on delete cascade,
  deal_id           uuid references public.agent_deals (id),
  roster_member_id  uuid references public.agent_roster (id),
  kind              text not null,   -- deal_created | deal_stage | roster_added | roster_removed | consent
  summary           text not null,
  created_at        timestamptz not null default now()
);

create index if not exists agent_roster_agent_idx   on public.agent_roster (agent_id);
create index if not exists agent_roster_member_idx  on public.agent_roster (member_user_id);
create index if not exists agent_deals_agent_idx    on public.agent_deals (agent_id, stage);
create index if not exists agent_deals_member_idx   on public.agent_deals (roster_member_id);
create index if not exists agent_deals_date_idx     on public.agent_deals (agent_id, start_date);
create index if not exists agent_activity_agent_idx on public.agent_activity (agent_id, created_at desc);
create index if not exists agent_rep_agent_idx      on public.agent_rep_contracts (agent_id);
create index if not exists agent_rep_member_idx     on public.agent_rep_contracts (roster_member_id);

-- ── RLS (DRAFT) — these NEW tables only; owner = agent user ────────────────────────────────
alter table public.agent_roster        enable row level security;
alter table public.agent_deals         enable row level security;
alter table public.agent_activity      enable row level security;
alter table public.agent_rep_contracts enable row level security;

-- The agent sees and manages only their own rows.
create policy "agent owns roster"
  on public.agent_roster for all
  using (agent_id = auth.uid()) with check (agent_id = auth.uid());

-- A roster member reads THEIR OWN row (never the rest of the roster).
create policy "member reads own roster row"
  on public.agent_roster for select
  using (member_user_id = auth.uid());

-- MEMBER-SIDE DISCONNECT RIGHT (draft — enable with the trigger below at apply time):
-- a represented person can disconnect their agent AT ANY TIME. The narrow update policy would
-- be:
--   create policy "member disconnects own row"
--     on public.agent_roster for update
--     using (member_user_id = auth.uid())
--     with check (member_user_id = auth.uid() and partner_status = 'ended');
-- paired with a BEFORE UPDATE trigger that (a) rejects any member-side change other than
-- partner_status → 'ended', and (b) on ANY transition to 'ended' — agent- or member-initiated —
-- sets every 'active'/'proposed' agent_rep_contracts row for this member to status 'ended' in
-- the same transaction. Disconnecting ends the contract; the two writes are one fact.
-- A second trigger enforces the ladder: agent_rep_contracts may only be INSERTED when the
-- member's partner_status = 'connected' (contracts never go to strangers), and partner_status
-- may only reach 'partnered' via a contract row moving to 'active'.

create policy "agent owns deals"
  on public.agent_deals for all
  using (agent_id = auth.uid()) with check (agent_id = auth.uid());

-- A roster member reads deals worked FOR them — this is what makes the cut-visibility rule
-- real at the data layer: talent + agent can read rate/cut, and no client-side role ever can.
create policy "member reads own deals"
  on public.agent_deals for select
  using (roster_member_id in
    (select id from public.agent_roster where member_user_id = auth.uid()));

create policy "agent owns activity"
  on public.agent_activity for all
  using (agent_id = auth.uid()) with check (agent_id = auth.uid());

-- Representation contracts: agent reads own; member reads own. NO insert/update policy for the
-- client on purpose — proposing/agreeing is counsel-gated and will arrive as a server-side
-- flow, not a browser write.
create policy "agent reads own rep contracts"
  on public.agent_rep_contracts for select
  using (agent_id = auth.uid());

create policy "member reads own rep contract"
  on public.agent_rep_contracts for select
  using (roster_member_id in
    (select id from public.agent_roster where member_user_id = auth.uid()));

-- ── SIGNUP-SIDE CAPTURE (SHELL-LANE WORK — deliberately NOT built in this product) ──────────
-- Grow-the-book invite links look like:  <origin>/join?agent=<agent_user_id>
-- The shell's entryContext (oneworld-shell/src/lib/entryContext.ts) already captures query
-- params on first load and flushes them to the profile after sign-in. The intended mechanism:
--   1. entryContext learns the `agent` param (capture ?agent= alongside qr/campaign/intent);
--   2. on flush, a server-side hook matches the new user to the agent — writing
--      agent_roster.member_user_id on the invite row, or inserting a roster row with
--      partner_status 'invited', so the person appears in the agent's dashboard — and their
--      accepting the invite is what advances the row to 'connected';
--   3. their OneJob role (professional/payee vs hirer/payer) is THEIR choice at signup and
--      lives in OneJob — this schema only records the representation tie.
-- None of that is client-writable from OneAgent, and the shell change is a separate lane.

-- updated_at maintenance (same trigger convention as existing tables — confirm at apply time).
-- create trigger set_agent_roster_updated_at before update on public.agent_roster
--   for each row execute function public.set_updated_at();
-- create trigger set_agent_deals_updated_at before update on public.agent_deals
--   for each row execute function public.set_updated_at();
