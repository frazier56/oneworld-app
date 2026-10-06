import { supabase } from "@oneworld/shell";

export type Business = { id: string; owner_id: string; name: string; industry: string | null; phone: string | null; email: string | null; website: string | null; city: string | null; timezone: string; created_at: string };
export type Service = { key: string; name: string; brand: string | null; blurb_en: string; blurb_es: string; pricing_model: "plan" | "quote" | "addon" | "reporting"; marketing_url: string | null; flagship: boolean; sort: number; active: boolean };
export type SubState = "requested" | "awaiting_info" | "quoted" | "building" | "ready_for_review" | "active" | "paused" | "failed" | "cancelled";
export type Subscription = { id: string; business_id: string; service_key: string; state: SubState; plan_key: string | null; quote_note: string | null; requested_at: string; activated_at: string | null; updated_at: string };
export type ExternalAccount = { id: string; business_id: string; provider: string; status: "not_connected" | "connected" | "error" | "disconnected"; last_sync_at: string | null; last_error: string | null };
export type Stage = { id: string; business_id: string; key: string; label: string; sort: number; terminal: "won" | "lost" | null };
export type Lead = { id: string; business_id: string; source: "call" | "form" | "chat" | "ads" | "manual" | "other"; name: string | null; phone: string | null; email: string | null; stage_key: string; owner_user_id: string | null; value_minor: number | null; currency: string; outcome: "won" | "lost" | null; next_action: string | null; next_action_on: string | null; first_seen_at: string; last_activity_at: string };
export type LeadEvent = { id: string; lead_id: string; kind: string; occurred_at: string; payload: Record<string, unknown> };
export type Call = { id: string; business_id: string; direction: "inbound" | "outbound"; from_number: string | null; started_at: string; duration_s: number | null; missed: boolean; summary: string | null; recording_url: string | null; lead_id: string | null; urgency: "high" | "normal" | "low" | null; urgency_reason: string | null };
export type VoiceSummary = { entitled: boolean; connected: boolean; connection_status: string; last_sync_at: string | null; from: string; to: string; timezone: string; calls: number; missed: number; inbound: number; with_lead: number; high_urgency: number; appointments: number; follow_up_due: number };
export type Funnel = { stages: { key: string; label: string; terminal: string | null; count: number; value_minor: number }[]; total: number; won: number; attribution_note: string };
export type MetricSnapshot = { id: string; service_key: string; period_start: string; period_end: string; metrics: Record<string, unknown>; source: string; fetched_at: string };

const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
};
const KEY = "onebusiness.business";
export const readBusinessId = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const writeBusinessId = (id: string | null) => { try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

export const myBusinesses = () => rpc<Business[]>("ob_my_businesses", {});
export const createBusiness = (name: string, industry: string, phone: string, email: string, website: string, city: string) =>
  rpc<Business>("ob_create_business", { p_name: name, p_industry: industry || null, p_phone: phone || null, p_email: email || null, p_website: website || null, p_city: city || null });
export const updateBusiness = (id: string, name: string, industry: string, phone: string, email: string, website: string, city: string) =>
  rpc<Business>("ob_update_business", { p_business: id, p_name: name, p_industry: industry || null, p_phone: phone || null, p_email: email || null, p_website: website || null, p_city: city || null });
export const canEditBusiness = (id: string) => rpc<boolean>("ob_is_member", { p_business: id, p_min_role: "admin" });
export async function listServices(): Promise<Service[]> {
  const { data, error } = await supabase.from("ob_service_catalog" as never).select("*").eq("active", true).order("sort");
  if (error) throw new Error(error.message); return (data ?? []) as Service[];
}
export async function listSubscriptions(business: string): Promise<Subscription[]> {
  const { data, error } = await supabase.from("ob_subscriptions" as never).select("*").eq("business_id", business).order("requested_at");
  if (error) throw new Error(error.message); return (data ?? []) as Subscription[];
}
export async function listAccounts(business: string): Promise<ExternalAccount[]> {
  const { data, error } = await supabase.from("ob_external_accounts" as never).select("*").eq("business_id", business);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExternalAccount[];
}
export const requestService = (business: string, key: string, note: string) => rpc<Subscription>("ob_request_service", { p_business: business, p_service: key, p_note: note || null });
export const cancelRequest = (sub: string) => rpc<Subscription>("ob_cancel_service_request", { p_subscription: sub });
export const hasEntitlement = (business: string, key: string) => rpc<boolean>("ob_has_entitlement", { p_business: business, p_service: key });
export async function listStages(business: string): Promise<Stage[]> {
  const { data } = await supabase.from("ob_pipeline_stages" as never).select("*").eq("business_id", business).order("sort");
  return (data ?? []) as Stage[];
}
export const setStages = (business: string, stages: { key: string; label: string; terminal?: string | null }[]) => rpc<void>("ob_set_stages", { p_business: business, p_stages: stages });
export async function listLeads(business: string): Promise<Lead[]> {
  const { data, error } = await supabase.from("ob_leads" as never).select("*").eq("business_id", business).order("last_activity_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message); return (data ?? []) as Lead[];
}
export async function fetchLead(id: string): Promise<Lead | null> {
  const { data } = await supabase.from("ob_leads" as never).select("*").eq("id", id).maybeSingle(); return (data as Lead | null) ?? null;
}
export async function leadEvents(lead: string): Promise<LeadEvent[]> {
  const { data } = await supabase.from("ob_lead_events" as never).select("*").eq("lead_id", lead).order("occurred_at", { ascending: false }).limit(100);
  return (data ?? []) as LeadEvent[];
}
export const upsertLead = (business: string, source: Lead["source"], name: string, phone: string, email: string) =>
  rpc<Lead>("ob_upsert_lead", { p_business: business, p_source: source, p_name: name || null, p_phone: phone || null, p_email: email || null, p_dedupe_key: null, p_event: { kind: "note", note: "added by hand" } });
export const moveLead = (lead: string, stage: string, note: string, valueMinor: number | null) => rpc<Lead>("ob_move_lead", { p_lead: lead, p_stage: stage, p_note: note || null, p_value_minor: valueMinor });
export const addNote = (lead: string, note: string, nextAction: string, nextOn: string) => rpc<void>("ob_add_lead_note", { p_lead: lead, p_note: note, p_next_action: nextAction || null, p_next_on: nextOn || null });
export const funnel = (business: string) => rpc<Funnel>("ob_funnel", { p_business: business, p_from: null, p_to: null });
export const voiceSummary = (business: string, from: string, to: string) => rpc<VoiceSummary>("ob_voice_summary", { p_business: business, p_from: from, p_to: to });
export async function listCalls(business: string, from: string, to: string): Promise<Call[]> {
  const { data, error } = await supabase.from("ob_calls" as never).select("*").eq("business_id", business).gte("started_at", from + "T00:00:00-05:00").lte("started_at", to + "T23:59:59-05:00").order("started_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Call[];
}
export async function listMetrics(business: string): Promise<MetricSnapshot[]> {
  const { data, error } = await supabase.from("ob_metric_snapshots" as never).select("*").eq("business_id", business).order("fetched_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as MetricSnapshot[];
}
export const money = (minor: number, lang: "en" | "es") =>
  new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { style: "currency", currency: "COP", currencyDisplay: "code", maximumFractionDigits: 0 }).format(Math.round(minor / 100));
export const bogota = (d = new Date()) => new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
