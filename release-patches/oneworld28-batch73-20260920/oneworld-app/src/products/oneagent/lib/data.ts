import { supabase, FEE_RATE } from "@oneworld/shell";

/**
 * ONEAGENT DATA — typed reads/writes for the agent-owned tables, and nothing else.
 * ============================================================================================
 * Three tables, all NEW, all agent-owned: `agent_roster`, `agent_deals`, `agent_activity`.
 * The draft DDL lives beside the product in AGENT_TABLES_DRAFT.sql — NOT APPLIED; deploys and
 * migrations are Lee-only. That means every read here can fail with "relation does not exist"
 * TODAY, and that failure is a normal state, not a crash:
 *
 *   · every helper returns `pending: true` when the query errors, and the screen shows its
 *     empty/onboarding state plus the honest one-line note ("Lovable Cloud tables pending…");
 *   · the server's literal error text is logged to the console — never swallowed.
 *
 * NO TRANSACTION CODE (Lee, 8 Aug 2026): no Stripe, no payment capture, no writes to
 * contracts/jobs tables. Payments arrive later through OneJob's money layer. The one shared
 * table read here is `notifications` — READ-ONLY.
 *
 * Table names are cast `as any` on `.from()` because the generated types predate these tables.
 */

/* ── Types ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * THE PARTNER LADDER (Lee's ruling, 9 Aug 2026 — replaces the loose "consent" framing).
 * A deliberate ladder; a rung can never be skipped:
 *   invited → accepted invite = CONNECTED → agent may send a representation CONTRACT
 *           → contract accepted = PARTNERED.   Disconnect (either side, any time) = ENDED,
 * and ending the connection also ENDS any active rep contract. Contracts can ONLY be sent to
 * people already connected — never to strangers. All rung ADVANCES beyond 'invited' happen on
 * the member's side / server-side (accepting an invite, accepting a contract) — this client
 * only creates invites and displays the rung.
 */
export type PartnerStatus = "invited" | "connected" | "partnered" | "ended";
export type ConsentScope = "apply" | "negotiate" | "sign";
export type DealDirection = "talent" | "company";

export const AGENT_STAGES = [
  "intake", "matched", "negotiating", "signed", "in-progress", "closed",
] as const;
export type DealStage = (typeof AGENT_STAGES)[number];

export const nextStage = (s: DealStage): DealStage | null => {
  const i = AGENT_STAGES.indexOf(s);
  return i >= 0 && i < AGENT_STAGES.length - 1 ? AGENT_STAGES[i + 1] : null;
};

export interface RosterRow {
  id: string;
  agent_id: string;
  member_user_id: string | null;
  full_name: string;
  email: string;
  category: string | null;
  notes: string | null;
  /** The ladder rung — see PartnerStatus. */
  partner_status: PartnerStatus;
  /** Recorded (counsel-gated) scopes — will ride the rep contract once counsel signs off. */
  consent_scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface DealRow {
  id: string;
  agent_id: string;
  roster_member_id: string | null;
  direction: DealDirection;
  counterpart_name: string | null;
  title: string;
  rate_amount: number | null;
  rate_currency: string;
  agent_cut_pct: number | null;
  stage: DealStage;
  start_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: string;
  agent_id: string;
  deal_id: string | null;
  roster_member_id: string | null;
  kind: string; // 'deal_created' | 'deal_stage' | 'roster_added' | 'roster_removed' | 'consent'
  summary: string;
  created_at: string;
}

/**
 * STANDING REPRESENTATION CONTRACT (Lee's clarified model, 9 Aug 2026) — SPEC/DISPLAY ONLY.
 * Begin date, end date, commission % (adjustable per deal via agent_deals.agent_cut_pct), no
 * money at signing, held on the profile. When deals later flow through OneJob, Stripe splits
 * the hirer's ONE payment between professional and agent — that machinery lives in OneJob's
 * money layer, never here. This product only READS these rows; there is no write path for
 * proposing/agreeing until counsel signs off on the consent model.
 */
export type RepContractStatus = "proposed" | "active" | "ended" | "revoked";
export interface RepContractRow {
  id: string;
  agent_id: string;
  roster_member_id: string | null;
  direction: DealDirection;
  commission_pct: number | null;
  starts_on: string | null;
  ends_on: string | null;
  status: RepContractStatus;
  agreed_at: string | null;
  created_at: string;
}

/** Shared `notifications` table (existing) — read-only from OneAgent. */
export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

/** Every read resolves to this — `pending` means the query failed (tables not migrated yet). */
export interface Fetched<T> { rows: T[]; pending: boolean; }
export interface WriteResult { ok: boolean; pending: boolean; }

/* ── Internals ─────────────────────────────────────────────────────────────────────────────── */

const from = (table: string) => supabase.from(table as any);

/** Never swallow: the server's literal text goes to the console, every time. */
const logErr = (table: string, error: { message?: string } | null) => {
  console.error(`[oneagent] ${table} query failed: ${error?.message ?? "unknown error"}`);
};

/* ── Roster ────────────────────────────────────────────────────────────────────────────────── */

export async function fetchRoster(agentId: string): Promise<Fetched<RosterRow>> {
  const { data, error } = await from("agent_roster")
    .select("*").eq("agent_id", agentId).neq("partner_status", "ended")
    .order("created_at", { ascending: false });
  if (error) { logErr("agent_roster", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as RosterRow[], pending: false };
}

export async function fetchRosterMember(id: string): Promise<{ row: RosterRow | null; pending: boolean }> {
  const { data, error } = await from("agent_roster").select("*").eq("id", id).maybeSingle();
  if (error) { logErr("agent_roster", error); return { row: null, pending: true }; }
  return { row: (data as unknown as RosterRow) ?? null, pending: false };
}

export async function addRosterMember(
  agentId: string,
  m: { full_name: string; email: string; category?: string; notes?: string },
): Promise<WriteResult> {
  const { error } = await from("agent_roster").insert({
    agent_id: agentId,
    full_name: m.full_name,
    email: m.email,
    category: m.category || null,
    notes: m.notes || null,
    partner_status: "invited",
  } as any);
  if (error) { logErr("agent_roster", error); return { ok: false, pending: true }; }
  /* Activity is best-effort — a failed feed row must not fail the add. */
  await from("agent_activity").insert({
    agent_id: agentId, kind: "roster_added", summary: m.full_name,
  } as any);
  return { ok: true, pending: false };
}

export async function bulkAddRoster(
  agentId: string,
  members: { full_name: string; email: string; category?: string }[],
): Promise<WriteResult> {
  if (members.length === 0) return { ok: false, pending: false };
  const { error } = await from("agent_roster").insert(
    members.map(m => ({
      agent_id: agentId,
      full_name: m.full_name,
      email: m.email,
      category: m.category || null,
      partner_status: "invited",
    })) as any,
  );
  if (error) { logErr("agent_roster", error); return { ok: false, pending: true }; }
  await from("agent_activity").insert(
    members.map(m => ({ agent_id: agentId, kind: "roster_added", summary: m.full_name })) as any,
  );
  return { ok: true, pending: false };
}

/** "Resend invite" is, for now, honestly just a timestamp touch — no mail machinery yet. */
export async function resendInvite(id: string): Promise<WriteResult> {
  const { error } = await from("agent_roster")
    .update({ updated_at: new Date().toISOString() } as any).eq("id", id);
  if (error) { logErr("agent_roster", error); return { ok: false, pending: true }; }
  return { ok: true, pending: false };
}

/**
 * DISCONNECT — the ladder's exit, soft always: partner_status → 'ended'; the row survives.
 * Ending the connection also ends any active rep contract; that pairing is transactional and
 * therefore SERVER-SIDE (see the draft SQL's trigger note) — the display logic treats a
 * contract on an 'ended' row as ended regardless. NOT WIRED to any button yet: the disconnect
 * affordance is display-only until counsel signs off; this helper exists for that wiring.
 */
export async function disconnectMember(member: RosterRow): Promise<WriteResult> {
  const { error } = await from("agent_roster")
    .update({ partner_status: "ended", updated_at: new Date().toISOString() } as any)
    .eq("id", member.id);
  if (error) { logErr("agent_roster", error); return { ok: false, pending: true }; }
  await from("agent_activity").insert({
    agent_id: member.agent_id, roster_member_id: member.id,
    kind: "disconnected", summary: member.full_name,
  } as any);
  return { ok: true, pending: false };
}

/* ── Deals ─────────────────────────────────────────────────────────────────────────────────── */

export async function fetchDeals(agentId: string): Promise<Fetched<DealRow>> {
  const { data, error } = await from("agent_deals")
    .select("*").eq("agent_id", agentId).order("updated_at", { ascending: false });
  if (error) { logErr("agent_deals", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as DealRow[], pending: false };
}

export async function fetchDealsForMember(memberId: string): Promise<Fetched<DealRow>> {
  const { data, error } = await from("agent_deals")
    .select("*").eq("roster_member_id", memberId).order("updated_at", { ascending: false });
  if (error) { logErr("agent_deals", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as DealRow[], pending: false };
}

export async function createDeal(
  agentId: string,
  d: {
    direction: DealDirection; title: string; counterpart_name?: string;
    rate_amount?: number | null; agent_cut_pct?: number | null;
    roster_member_id?: string | null; start_date?: string | null; notes?: string;
  },
): Promise<WriteResult> {
  const { data, error } = await from("agent_deals").insert({
    agent_id: agentId,
    direction: d.direction,
    title: d.title,
    counterpart_name: d.counterpart_name || null,
    rate_amount: d.rate_amount ?? null,
    agent_cut_pct: d.agent_cut_pct ?? null,
    roster_member_id: d.roster_member_id ?? null,
    start_date: d.start_date ?? null,
    notes: d.notes || null,
    stage: "intake",
  } as any).select("id").maybeSingle();
  if (error) { logErr("agent_deals", error); return { ok: false, pending: true }; }
  await from("agent_activity").insert({
    agent_id: agentId,
    deal_id: (data as any)?.id ?? null,
    roster_member_id: d.roster_member_id ?? null,
    kind: "deal_created",
    summary: d.title,
  } as any);
  return { ok: true, pending: false };
}

/** Stage advance = the stage write + an activity row. Stage only ever moves FORWARD here. */
export async function advanceDeal(deal: DealRow): Promise<WriteResult> {
  const to = nextStage(deal.stage);
  if (!to) return { ok: false, pending: false };
  const { error } = await from("agent_deals")
    .update({ stage: to, updated_at: new Date().toISOString() } as any).eq("id", deal.id);
  if (error) { logErr("agent_deals", error); return { ok: false, pending: true }; }
  await from("agent_activity").insert({
    agent_id: deal.agent_id, deal_id: deal.id, roster_member_id: deal.roster_member_id,
    kind: "deal_stage", summary: `${deal.title} → ${to}`,
  } as any);
  return { ok: true, pending: false };
}

/** Upcoming = deals with a start_date from today forward, soonest first. */
export async function fetchUpcoming(agentId: string): Promise<Fetched<DealRow>> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await from("agent_deals")
    .select("*").eq("agent_id", agentId).gte("start_date", today)
    .order("start_date", { ascending: true });
  if (error) { logErr("agent_deals", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as DealRow[], pending: false };
}

/* ── Representation contracts (display only — NO write path by ruling) ─────────────────────── */

/** All of this agent's rep contracts — feeds the Contracts section of the Deals tab. */
export async function fetchRepContracts(agentId: string): Promise<Fetched<RepContractRow>> {
  const { data, error } = await from("agent_rep_contracts")
    .select("*").eq("agent_id", agentId).order("created_at", { ascending: false });
  if (error) { logErr("agent_rep_contracts", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as RepContractRow[], pending: false };
}

export async function fetchRepContractForMember(
  memberId: string,
): Promise<{ row: RepContractRow | null; pending: boolean }> {
  const { data, error } = await from("agent_rep_contracts")
    .select("*").eq("roster_member_id", memberId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) { logErr("agent_rep_contracts", error); return { row: null, pending: true }; }
  return { row: (data as unknown as RepContractRow) ?? null, pending: false };
}

/* ── Activity & notifications ──────────────────────────────────────────────────────────────── */

export async function fetchActivity(agentId: string, limit = 30): Promise<Fetched<ActivityRow>> {
  const { data, error } = await from("agent_activity")
    .select("*").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit);
  if (error) { logErr("agent_activity", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as ActivityRow[], pending: false };
}

/** Shared table, READ-ONLY from OneAgent. */
export async function fetchNotifications(userId: string): Promise<Fetched<NotificationRow>> {
  const { data, error } = await from("notifications")
    .select("id, user_id, type, title, body, action_url, read_at, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) { logErr("notifications", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as NotificationRow[], pending: false };
}

/* ── People search (shared `profiles` table — GRANTED COLUMNS ONLY, never select *) ────────── */

export interface ProfileHit {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  job_title: string | null;
  location: string | null;
}

/**
 * "Partner with someone on the platform" — agents can partner with people ALREADY here, not
 * just QR/link invitees. Name columns explicitly (profiles grant: full_name, photo_url,
 * job_title, location among others); `select('*')` on profiles is banned family-wide.
 */
export async function searchProfiles(q: string): Promise<Fetched<ProfileHit>> {
  const needle = q.trim();
  if (needle.length < 2) return { rows: [], pending: false };
  const { data, error } = await from("profiles")
    .select("id, full_name, photo_url, job_title, location")
    .ilike("full_name", `%${needle}%`)
    .limit(8);
  if (error) { logErr("profiles", error); return { rows: [], pending: true }; }
  return { rows: (data ?? []) as unknown as ProfileHit[], pending: false };
}

/* ── Money (display math only — NO transaction code lives in this product) ─────────────────── */

/**
 * THE CUT-VISIBILITY RULE (Lee, 8 Aug 2026), enforced at the call sites:
 *   · CLIENT-facing UI shows `total` and nothing else — one price.
 *   · TALENT/AGENT UI shows total − agent cut − platform fee (5.99%, shared FEE_RATE) → net.
 * This helper computes the private breakdown; a client-facing surface must never call it.
 */
export function dealMoney(rate: number, cutPct: number | null) {
  const cut = rate * ((cutPct ?? 0) / 100);
  const fee = rate * FEE_RATE;
  return { total: rate, cut, fee, net: rate - cut - fee };
}

export function fmtMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: currency || "USD", maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

/* ── CSV — the "bring your roster" promise. Parses client-side, previews, then inserts. ────── */

export interface CsvRow { full_name: string; email: string; category?: string }

/**
 * Columns: name, email, category (category optional). Accepts comma / semicolon / tab
 * separators and skips a header row if it sees one. Manual entry for 40 people means no agent
 * finishes onboarding — this box is the channel strategy in code.
 */
export function parseRosterCsv(text: string): { rows: CsvRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: CsvRow[] = [];
  let skipped = 0;
  lines.forEach((line, i) => {
    const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^"|"$/g, ""));
    const [name, email, category] = parts;
    if (i === 0 && /name/i.test(name ?? "") && !/@/.test(email ?? "")) return; // header row
    if (!name || !email || !/\S+@\S+\.\S+/.test(email)) { skipped++; return; }
    rows.push({ full_name: name, email, category: category || undefined });
  });
  return { rows, skipped };
}
