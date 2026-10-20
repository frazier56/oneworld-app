import { supabase } from "@oneworld/shell";

export type HostRole = "owner" | "property_manager" | "agent";
export type HostDocumentKind = "passport" | "national_id" | "residence_permit" | "nit";
/* `vault` joined these on 15 Sep 2026, when the payout chooser was replaced by the shared
   vault surface. The four older values are NOT removed: rows written before that batch still
   carry them, and a type that cannot represent a row that exists is a type that lies. Nothing
   writes `remitly`, `wise` or `bank_transfer` any more. The database CHECK was widened to
   match in `onehome_host_payout_uses_the_shared_vault`. */
export type HostPayoutMethod = "stripe" | "vault" | "remitly" | "wise" | "bank_transfer" | "paypal";

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
