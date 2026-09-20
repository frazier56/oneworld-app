import { useEffect, useState } from "react";
import { useOneId } from "@oneworld/shell";
import { myBusinesses, readBusinessId, writeBusinessId, type Business } from "./data";

/** The business this device is looking at. Membership is a database fact; the pick is per device. */
export function useBusiness() {
  const { userId } = useOneId();
  const [state, setState] = useState<{ userId?: string | null; status: "loading" | "none" | "ready" | "error"; businesses: Business[]; business: Business | null; error?: string }>({ status: "loading", businesses: [], business: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!userId) { setState({ userId, status: "none", businesses: [], business: null }); return; }
    let alive = true;
    myBusinesses().then(list => {
      if (!alive) return;
      if (!list.length) { setState({ userId, status: "none", businesses: [], business: null }); return; }
      const wanted = readBusinessId(); const b = list.find(x => x.id === wanted) ?? list[0];
      writeBusinessId(b.id); setState({ userId, status: "ready", businesses: list, business: b });
    }).catch(e => { if (alive) setState({ userId, status: "error", businesses: [], business: null, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, [userId, tick]);
  const current = state.userId === userId ? state : { status: userId ? "loading" as const : "none" as const, businesses: [], business: null, error: undefined };
  return { ...current, userId, select: (id: string) => { writeBusinessId(id); setTick(t => t + 1); }, refresh: () => setTick(t => t + 1) };
}
