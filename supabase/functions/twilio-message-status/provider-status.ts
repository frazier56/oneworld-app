export const providerStatusRank: Record<string, number> = {
  accepted: 10,
  scheduled: 15,
  queued: 20,
  sending: 30,
  sent: 40,
  undelivered: 50,
  failed: 50,
  canceled: 50,
  delivered: 60,
  read: 70,
};

export const isSupportedProviderStatus = (status: string) => status in providerStatusRank;

export const shouldApplyProviderStatus = (currentStatus: string | null | undefined, nextStatus: string) => {
  const current = String(currentStatus || "").toLowerCase();
  if (!current) return true;
  if (current === nextStatus) return false;
  return (providerStatusRank[nextStatus] || 0) > (providerStatusRank[current] || 0);
};
