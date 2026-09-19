import { createRoot } from "react-dom/client";
import App from "./App";
import { stripCacheBuster } from "@oneworld/shell";

/* The shell's stylesheet is the ONLY CSS entry point — it carries the @tailwind directives. */
import "@oneworld/shell/tokens.css";

/* ── TAKE THE CACHE-BUSTER BACK OUT OF THE ADDRESS BAR ──────────────────────────────────────
   When a screen fails to load because a deploy replaced its chunk, `lazyScreen` reloads to the
   same path with a throwaway `_v` parameter — a different url, so the browser cannot answer it
   from the cached copy of the old shell. That is the only lever available while the host serves
   `index.html` with `Cache-Control: max-age=600` and will not let us change it.
   This removes the parameter immediately, without navigating, so nobody ever sees it, nobody
   bookmarks it, and it never reaches an analytics or share url. */
stripCacheBuster();

/* Marketing doorways carry an explicit display-language choice across origins.
   Scope each hint to its exact entry and the two verified doorway languages. Other product defaults,
   phone country and currency preferences remain independent. */
const languageHint = /^\/business\/?$/.test(window.location.pathname) ? "business_lang"
  : /^\/home\/?$/.test(window.location.pathname) ? "home_lang"
  : /^\/jobs\/?$/.test(window.location.pathname) ? "job_lang" : null;
if (languageHint) {
  const url = new URL(window.location.href);
  const language = url.searchParams.get(languageHint);
  if (language === "en" || language === "co") {
    try {
      localStorage.setItem("oneworld-lang", language);
      url.searchParams.delete(languageHint);
      window.history.replaceState(window.history.state, "", url);
    } catch { /* Restricted storage must not prevent the app or account setup from opening. */ }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
