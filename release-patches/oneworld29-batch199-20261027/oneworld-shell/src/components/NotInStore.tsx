import { Navigate } from "react-router-dom";
import { isStoreBuild } from "../lib/storeBuild";

/**
 * NOT IN THE STORE BUILD — one wrapper for every route that must not exist in the App Store /
 * Google Play build (APPSTORE 1 P1, ONEWORLD 31 overlay 6, 22 Oct 2026): digital plan/pricing
 * screens and parked products. In a store build it sends the visitor to `to` (default: the
 * product's own home, or "/"), replacing history so Back does not bounce them into it again.
 * On the web it renders its children unchanged.
 *
 *     <Route path="pricing" element={<NotInStore to="/events"><PricingScreen /></NotInStore>} />
 *
 * A BUTTON that leads to such a screen should not render at all in a store build —
 * `{!isStoreBuild() && <Button…>}` — rather than lead here and bounce.
 */
export default function NotInStore({ to = "/", children }: { to?: string; children: React.ReactNode }) {
  if (isStoreBuild()) return <Navigate to={to} replace />;
  return <>{children}</>;
}
