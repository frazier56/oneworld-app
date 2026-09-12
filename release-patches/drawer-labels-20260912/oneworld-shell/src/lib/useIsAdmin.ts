import { supabase } from "./supabase";
import { useAsync } from "./useAsync";
import { useOneId } from "./oneId";

/**
 * AM I AN ADMIN — asked ONCE, in the shell, and answered by the DATABASE.
 * ============================================================================================
 * Lee, on the Admin entry that disappeared from the hamburger: *"restore it… gated to
 * frazierlee@gmail.com (and to a real is_admin / role check, not an email string literal buried
 * in a component — put the check in the shell, one place)."*
 *
 * Three rules fall out of that and all three matter:
 *
 * 1. NO EMAIL LITERAL, ANYWHERE IN THE CLIENT. A comparison in a component is not a permission —
 *    anyone can read the bundle, and anyone can set a variable in a console. It also drifts: the
 *    day a second admin exists you are editing components.
 * 2. THE ANSWER COMES FROM THE SERVER. `is_platform_admin()` reads `platform_admins`, a real
 *    membership table (migration 10 Aug 2026 — it used to be a literal inside the function too,
 *    so adding an admin meant a migration). Granting admin is now a row, and nothing a browser
 *    can write.
 * 3. THIS IS FOR SHOWING THE DOOR, NOT FOR GUARDING THE ROOM. Hiding a menu item is a courtesy.
 *    Every admin RPC re-checks `is_platform_admin()` on the server and raises 42501 to anybody
 *    else, so a person who forges a `true` here gets a menu entry and a screen full of errors,
 *    which is exactly what should happen.
 */
export function useIsAdmin(): boolean {
  const { userId } = useOneId();
  /* A fixture-only visual review path. Vite replaces DEV with false in production builds, so
     this cannot open either the menu or the server RPCs in a released bundle. */
  const preview = import.meta.env.DEV && typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("adminPreview") === "1";
  const isAdmin = useAsync(async () => {
    const { data, error } = await supabase.rpc("is_platform_admin");
    if (error) {
      /* Fail CLOSED. An unreachable check must never open the admin door. */
      console.error("[useIsAdmin] check failed:", error.message);
      return false;
    }
    return data === true;
  }, [userId, preview], !!userId && !preview);
  return preview || isAdmin === true;
}
