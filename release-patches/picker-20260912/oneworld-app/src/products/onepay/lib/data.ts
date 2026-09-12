import { supabase } from "@oneworld/shell";

/**
 * ONEPAY DATA — typed reads and RPC writes. Money is INTEGER CENTAVOS end to end; the server
 * computes every total and the browser only ever displays what it read back.
 */
export type Merchant = {
  id: string; owner_id: string; name: string; legal_name: string | null; tax_id: string | null;
  currency: string; city: string | null; provider: string | null;
  tap_enabled: boolean; link_enabled: boolean; qr_enabled: boolean; created_at: string;
};
export type CatalogItem = { id: string; merchant_id: string; name: string; price_minor: number; active: boolean; sort: number };
export type Order = {
  id: string; merchant_id: string; order_no: number; currency: string; subtotal_minor: number; discount_minor: number;
  tax_minor: number; tip_minor: number; total_minor: number; status: "open" | "paid" | "partially_refunded" | "refunded" | "void";
  note: string | null; customer_name: string | null; created_at: string;
};
export type Attempt = {
  id: string; order_id: string; merchant_id: string; method: Method; provider: string | null; provider_ref: string | null;
  amount_minor: number; state: "pending" | "paid" | "failed" | "unresolved" | "voided"; failure_reason: string | null;
  reference: string | null; created_at: string; paid_at: string | null;
};
export type Method = "cash" | "transfer" | "link" | "qr" | "tap";
export type ActivityRow = {
  order_id: string; order_no: number; created_at: string; total_minor: number; currency: string; status: Order["status"];
  customer_name: string | null; note: string | null; attempt_id: string | null; method: Method | null;
  attempt_state: Attempt["state"] | null; paid_at: string | null; reference: string | null; receipt_no: number | null;
};
export type DaySummary = {
  business_date: string; sales_minor: number; refunds_minor: number; net_minor: number; count_sales: number;
  by_method: Record<string, number>; pending_count: number; closed: boolean;
};
export type Member = { merchant_id: string; user_id: string; role: "owner" | "manager" | "staff"; active: boolean; full_name?: string | null };
export type Device = { id: string; merchant_id: string; user_id: string; label: string; platform: string; tap_capable: boolean; registered_at: string; active: boolean };
export type Receipt = { id: string; merchant_id: string; order_id: string; attempt_id: string | null; receipt_no: number; snapshot: Record<string, unknown>; issued_at: string };

const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
};

/** Which business this device is working for. Per device, never a fact about the person. */
const KEY = "onepay.merchant";
export const readMerchantId = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const writeMerchantId = (id: string | null) => { try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

export const myMerchants = () => rpc<Merchant[]>("onepay_my_merchants", {});
export const createMerchant = (name: string, city: string, legal: string, taxId: string) =>
  rpc<Merchant>("onepay_create_merchant", { p_name: name, p_city: city || null, p_legal_name: legal || null, p_tax_id: taxId || null });

export async function listCatalog(merchant: string): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from("onepay_catalog_items" as never).select("*").eq("merchant_id", merchant).order("sort").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogItem[];
}
export const upsertCatalogItem = (merchant: string, id: string | null, name: string, priceMinor: number, active: boolean) =>
  rpc<CatalogItem>("onepay_upsert_catalog_item", { p_merchant: merchant, p_id: id, p_name: name, p_price_minor: priceMinor, p_active: active });

export type LineInput = { catalog_item_id?: string; name?: string; unit_minor?: number; qty: number };
export const openOrder = (merchant: string, lines: LineInput[], discountMinor: number, tipMinor: number, note: string, customer: string) =>
  rpc<Order>("onepay_open_order", { p_merchant: merchant, p_lines: lines, p_discount_minor: discountMinor, p_tip_minor: tipMinor, p_note: note || null, p_customer_name: customer || null, p_customer_contact: null });
export const startAttempt = (order: string, method: Method, key: string, reference?: string) =>
  rpc<Attempt>("onepay_start_attempt", { p_order: order, p_method: method, p_idempotency_key: key, p_reference: reference || null });
export const confirmTransfer = (attempt: string, reference?: string) => rpc<Attempt>("onepay_confirm_transfer", { p_attempt: attempt, p_reference: reference || null });
export const cancelAttempt = (attempt: string, reason?: string) => rpc<Attempt>("onepay_cancel_attempt", { p_attempt: attempt, p_reason: reason || null });
export const voidOrder = (order: string, reason?: string) => rpc<Order>("onepay_void_order", { p_order: order, p_reason: reason || null });
export const refund = (attempt: string, amountMinor: number, reason?: string) => rpc<unknown>("onepay_refund", { p_attempt: attempt, p_amount_minor: amountMinor, p_reason: reason || null });
export const daySummary = (merchant: string, date?: string) => rpc<DaySummary>("onepay_day_summary", { p_merchant: merchant, p_date: date ?? null });
export const closeDay = (merchant: string, date?: string) => rpc<unknown>("onepay_close_day", { p_merchant: merchant, p_date: date ?? null });
export const activity = (merchant: string, before?: string) => rpc<ActivityRow[]>("onepay_activity", { p_merchant: merchant, p_limit: 50, p_before: before ?? null });

export async function fetchAttempt(id: string): Promise<Attempt | null> {
  const { data } = await supabase.from("onepay_attempts" as never).select("*").eq("id", id).maybeSingle();
  return (data as Attempt | null) ?? null;
}
export async function fetchOrderAttempts(order: string): Promise<Attempt[]> {
  const { data } = await supabase.from("onepay_attempts" as never).select("*").eq("order_id", order).order("created_at", { ascending: false });
  return (data ?? []) as Attempt[];
}
export async function fetchReceipt(order: string): Promise<Receipt | null> {
  const { data } = await supabase.from("onepay_receipts" as never).select("*").eq("order_id", order).maybeSingle();
  return (data as Receipt | null) ?? null;
}
export async function listMembers(merchant: string): Promise<Member[]> {
  const { data, error } = await supabase.from("onepay_members" as never).select("merchant_id, user_id, role, active").eq("merchant_id", merchant);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Member[];
  if (rows.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", rows.map(r => r.user_id));
    const names = new Map((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
    for (const r of rows) r.full_name = names.get(r.user_id) ?? null;
  }
  return rows;
}
export const addMember = (merchant: string, user: string, role: "manager" | "staff") => rpc<void>("onepay_add_member", { p_merchant: merchant, p_user: user, p_role: role });
export const setMemberActive = (merchant: string, user: string, active: boolean) => rpc<void>("onepay_set_member_active", { p_merchant: merchant, p_user: user, p_active: active });
export async function listDevices(merchant: string): Promise<Device[]> {
  const { data, error } = await supabase.from("onepay_devices" as never).select("*").eq("merchant_id", merchant).order("registered_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Device[];
}
export const registerDevice = (merchant: string, label: string) => {
  const ua = navigator.userAgent; const platform = /android/i.test(ua) ? "android" : /iphone|ipad/i.test(ua) ? "ios" : "web";
  return rpc<Device>("onepay_register_device", { p_merchant: merchant, p_label: label, p_platform: platform });
};

/** COP centavos → "COP 9.000.000" (es) / "COP 9,000,000" (en). Never a float in the middle. */
export const money = (minor: number, lang: "en" | "es", currency = "COP") =>
  new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 0 }).format(Math.round(minor / 100));
/** "12.500" typed by a person → 1250000 centavos. Thousands separators of either convention are dropped. */
export const parsePesos = (s: string): number => {
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  const n = Number(digits); return Number.isSafeInteger(n * 100) ? n * 100 : 0;
};
export const idem = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
