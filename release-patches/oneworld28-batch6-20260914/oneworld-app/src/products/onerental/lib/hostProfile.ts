import { supabase } from "@oneworld/shell";

export type HostRole = "owner" | "property_manager" | "agent";
export type HostDocumentKind = "passport" | "national_id" | "residence_permit" | "nit";
export type HostPayoutMethod = "stripe" | "remitly" | "wise" | "bank_transfer";

export type HostReadiness = {
  profile_ready: boolean;
  identity_ready: boolean;
  address_ready: boolean;
  payout_ready: boolean;
  payout_method: HostPayoutMethod | null;
};

export async function getHostReadiness(): Promise<HostReadiness> {
  const { data, error } = await supabase.rpc("rental_host_profile_readiness");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    profile_ready: !!row?.profile_ready,
    identity_ready: !!row?.identity_ready,
    address_ready: !!row?.address_ready,
    payout_ready: !!row?.payout_ready,
    payout_method: row?.payout_method ?? null,
  };
}
