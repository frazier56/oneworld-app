type OwnerTermsRecord = {
  owner_terms_enabled?: unknown;
  imported_doc_kind?: unknown;
  imported_contract_terms?: unknown;
  imported_contract_unmapped?: unknown;
};

/**
 * Honor an explicit saved choice, including false. The imported-data fallback exists only for
 * rows loaded before the owner_terms_enabled column was introduced; the migration backfills those
 * rows, but this keeps old fixtures and rolling clients safe during deployment.
 */
export function ownerTermsEnabledFromProperty(data: OwnerTermsRecord): boolean {
  if (typeof data.owner_terms_enabled === "boolean") return data.owner_terms_enabled;
  const terms = data.imported_contract_terms;
  return !!data.imported_doc_kind
    || (!!terms && typeof terms === "object" && Object.keys(terms as object).length > 0)
    || (Array.isArray(data.imported_contract_unmapped) && data.imported_contract_unmapped.length > 0);
}
