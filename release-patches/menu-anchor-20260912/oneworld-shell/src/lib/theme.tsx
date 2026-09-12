import { createContext, useContext, useEffect, useState } from "react";
import { readPref, writePref } from "./safeStorage";

/* One key for all eight products, so light/dark follows a person across the family the way the
   session does. It is NOT "onesocial-theme" — that name was carried over from the app this was
   extracted from, and a OneJob user having their theme stored under a OneSocial key is the kind
   of thing that is invisible until someone tries to reason about storage. */
const THEME_KEY = "oneworld-theme";

const Ctx = createContext<{ theme: string; toggle: () => void } | null>(null);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(() => readPref(THEME_KEY) || "light");
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    writePref(THEME_KEY, theme);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", theme === "dark" ? "#0B0F1A" : "#FAFAF8");
  }, [theme]);
  return <Ctx.Provider value={{ theme, toggle: () => setTheme(t => (t === "light" ? "dark" : "light")) }}>{children}</Ctx.Provider>;
}
export const useTheme = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("[oneworld-shell] useTheme() outside <ThemeProvider>. Mount <AppShell>.");
  return v;
};
