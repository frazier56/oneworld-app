import { useEffect, useState } from "react";

/** Loading, unavailable and empty are different business states. Never display stale business data. */
export function useBusinessLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  useEffect(() => {
    let active = true;
    Promise.resolve().then(load).then(data => {
      if (active) setResult({ key, data });
    }).catch(error => {
      if (active) setResult({ key, error: String(error?.message || "Unavailable") });
    });
    return () => { active = false; };
    // The caller supplies the request identity, not an unstable function reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result?.key === key ? result : { key, data: undefined, error: undefined };
}
