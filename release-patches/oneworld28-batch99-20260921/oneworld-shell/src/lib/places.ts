// Google Places (Maps JS) loader for client-side address autocomplete.
// The key is an HTTP-referrer-restricted BROWSER key (safe to ship in a static
// SPA). It must have the "Places API" enabled and the referrer allow-list must
// include the SINGLE ORIGIN this app now serves from — `app.oneworldlabs.ai`.
//
// ⚠ OPEN ITEM FOR LEE (9 Aug 2026): the allow-list was written for the old
// per-app hostnames. If `app.oneworldlabs.ai` is not on it, every address and
// profession autocomplete in OneJob silently falls back to plain typing — the
// screens still work, the suggestions just never appear. It is a Google Cloud
// Console change, not a code change, so it is flagged rather than attempted.
export const GOOGLE_MAPS_KEY = "AIzaSyBNmCKEpuHtfesCkAeOqigYCYarJ5E85gY";

let loader: Promise<any> | null = null;

/** Load the Maps JS "places" library once; resolves to window.google (or
 *  rejects if it can't load — callers fall back to plain manual entry). */
export function loadGoogleMaps(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.places) return Promise.resolve(w.google);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    // With loading=async, script.onload fires BEFORE window.google is
    // initialized — checking there rejected the singleton forever and no
    // component ever got predictions. The official ready signal is the
    // `callback` URL param: Google invokes it after full init (incl. the
    // libraries=places preload). On failure, reset `loader` so a later
    // mount can retry instead of inheriting a dead promise.
    const fail = (e: Error) => { loader = null; reject(e); };
    const cb = "__owlGmapsReady";
    (w as any)[cb] = () => {
      delete (w as any)[cb];
      if (w.google?.maps?.places) return resolve(w.google);
      if (w.google?.maps?.importLibrary) {
        w.google.maps.importLibrary("places")
          .then(() => resolve(w.google), () => fail(new Error("places-missing")));
      } else fail(new Error("places-missing"));
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => fail(new Error("maps-load-failed"));
    document.head.appendChild(s);
  });
  return loader;
}
