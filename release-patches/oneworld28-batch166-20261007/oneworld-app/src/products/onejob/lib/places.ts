/**
 * MOVED TO THE SHELL — 11 Aug 2026. See `components/Pickers.tsx` for why.
 * One Maps JS loader for the whole family: six products loading the script six times would race
 * on `window.google` and burn the referrer-restricted key's quota six ways.
 * Re-export only.
 */
export { loadGoogleMaps, GOOGLE_MAPS_KEY } from "@oneworld/shell";
