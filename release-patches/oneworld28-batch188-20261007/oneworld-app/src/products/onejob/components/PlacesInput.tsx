/**
 * MOVED TO THE SHELL — 11 Aug 2026. See `components/Pickers.tsx` for why.
 *
 * Lee asked three separate times for Google Places on OneHome's address fields while a working,
 * hardened implementation — portal dropdown (FIX-C), silent fallback to manual typing,
 * `onSelectParts` name/address split — sat in this folder where only OneJob could reach it.
 *
 * Re-export only. New code imports `PlacesInput` from `@oneworld/shell`.
 */
export { PlacesInput as default } from "@oneworld/shell";
