import { useEffect, useState } from "react";
import { useOneId } from "@oneworld/shell";
import { myMerchants, readMerchantId, writeMerchantId, type Merchant } from "./data";

/**
 * THE MERCHANT THIS DEVICE IS CHARGING FOR. Membership is a database fact (onepay_members); the
 * choice among a person's businesses is a per-device convenience. No merchant → `none`, and the
 * screens send the person to Setup rather than rendering an empty till.
 */
export function useMerchant() {
  const { userId } = useOneId();
  const [state, setState] = useState<{ status: "loading" | "none" | "ready" | "error"; merchants: Merchant[]; merchant: Merchant | null; error?: string }>({ status: "loading", merchants: [], merchant: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!userId) { setState({ status: "none", merchants: [], merchant: null }); return; }
    let alive = true;
    myMerchants().then(list => {
      if (!alive) return;
      if (!list.length) { setState({ status: "none", merchants: [], merchant: null }); return; }
      const wanted = readMerchantId();
      const m = list.find(x => x.id === wanted) ?? list[0];
      writeMerchantId(m.id);
      setState({ status: "ready", merchants: list, merchant: m });
    }).catch(e => { if (alive) setState({ status: "error", merchants: [], merchant: null, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, [userId, tick]);
  const select = (id: string) => { writeMerchantId(id); setTick(t => t + 1); };
  const refresh = () => setTick(t => t + 1);
  return { ...state, userId, select, refresh };
}
