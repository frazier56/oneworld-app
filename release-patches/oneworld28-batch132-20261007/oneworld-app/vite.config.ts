import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

/**
 * EMIT `404.html` AS PART OF THE BUILD, NOT BY HAND.
 * ============================================================================================
 * GitHub Pages serves static files and knows nothing about client-side routes. A deep link —
 * `/job/messages`, which is what every share link, advert doorway and bookmark produces — asks
 * Pages for a file at that path. There isn't one, so Pages serves `404.html`. Making that a copy
 * of `index.html` boots the app, which then reads the URL and routes correctly.
 *
 * It was being copied by hand after each build, so every build silently deleted it again and
 * every deep link in production was dead. Nothing caught it, and here is the nasty part: the
 * smoke test runs against `vite preview`, which does SPA fallback NATIVELY. So the one test built
 * to prove deep links work passed while production 404'd. A test that cannot observe the failure
 * mode it is named after is worse than no test.
 *
 * Making it a build step is the fix. A human step that must be remembered every time is not a
 * step, it is a future outage.
 */
function spaFallback(): Plugin {
  return {
    name: "oneworld-404-fallback",
    apply: "build",
    closeBundle() {
      const out = path.resolve(__dirname, "dist");
      const index = path.join(out, "index.html");
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, path.join(out, "404.html"));
        this.info?.("404.html written from index.html — deep links will resolve on GitHub Pages");
      }
    },
  };
}

/**
 * ONE ORIGIN, EIGHT PRODUCTS — the build for `app.oneworldlabs.ai`.
 *
 * `base: "/"` because this serves from the ROOT of its own subdomain, not from a sub-path. That
 * is the whole point of the single-origin decision: `/job`, `/event`, `/onescore` are ROUTES in
 * one app, not eight deployments under eight prefixes.
 */
export default defineConfig({
  plugins: [react(), spaFallback()],
  base: "/",
  /**
   * FLAT OUTPUT — everything at the root, no `assets/` directory.
   *
   * Not a style preference. This repo is published through GitHub's WEB uploader, which places
   * every file at the root of whatever folder you drop it in and cannot create a nested
   * directory from a file list. A build that emits `assets/index-<hash>.js` therefore uploads as
   * `index-<hash>.js` at the root, and `index.html` — which still asks for `/assets/…` — loads a
   * white page with a 404 in the console.
   *
   * Hashes are kept, so cache-busting still works. Only the directory is gone.
   */
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "[name]-[hash].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "dompurify": path.resolve(__dirname, "../../security-deps/node_modules/dompurify/dist/purify.es.mjs"),
      "tus-js-client": path.resolve(__dirname, "../../build-deps/node_modules/tus-js-client/lib.esm/browser/index.js"),
      "jspdf": path.resolve(__dirname, "../../security-deps/node_modules/jspdf/dist/jspdf.es.min.js"),
      "@oneworld/shell": path.resolve(__dirname, "../oneworld-shell/src"),
      "@evt": path.resolve(__dirname, "src/products/oneevent"),
      "@job": path.resolve(__dirname, "src/products/onejob"),
    },
    /**
     * DEDUPE, OR THE CHROME RENDERS OUTSIDE THE ROUTER.
     *
     * The shell package carries its own copies of react, react-dom and react-router-dom for its
     * tests. Without this, Vite resolves the shell's imports to THOSE copies — so the app's
     * <BrowserRouter> populates one router context and the shell's <TopBar>/<Chrome> read a
     * different, empty one. React Router throws "useLocation() may be used only in the context of
     * a <Router>" and the whole tree unmounts to a blank page.
     *
     * It hid beautifully: signed-out routes render Splash, which uses no router hooks, so
     * everything LOOKED fine. Only the public profile path — the one route that reaches the
     * chrome while signed out — went white. A single wrong route out of five.
     *
     * Same class for react/react-dom: two React copies break hooks entirely.
     */
    dedupe: ["react", "react-dom", "react-router-dom", "@supabase/supabase-js"],
  },
});

/**
 * GITHUB PAGES SERVES STATIC FILES AND KNOWS NOTHING ABOUT CLIENT-SIDE ROUTES.
 *
 * A deep link — `app.oneworldlabs.ai/job/messages`, which is what every share link, every advert
 * doorway and every bookmark produces — asks Pages for a file at that path. There isn't one, so
 * Pages serves `404.html`. Copying `index.html` to `404.html` makes that 404 boot the app, which
 * then reads the URL and routes correctly. Without it EVERY route except `/` is dead, and only
 * on the deployed site — it works perfectly in dev, which is how it reaches production.
 *
 * `.nojekyll` stops Pages running the file tree through Jekyll, which silently drops any
 * directory beginning with an underscore — Vite does not emit one today, but a future plugin
 * that does would fail in a way nobody would think to look for.
 */
