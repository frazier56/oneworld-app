import { PlaceMap } from "@oneworld/shell";

/**
 * LocationMap — OneEvent's event-page map.
 *
 * ⚠️ THE IMPLEMENTATION MOVED TO THE SHELL, 28 September 2026, AND NOTHING HERE CHANGED.
 * ============================================================================================
 * Lee asked for this same map on the OneHome property page — *"same type of code, it should look
 * the same… let's not reinvent the wheel"* — so rather than OneHome growing a second copy that
 * drifts from this one, the body of this file became `@oneworld/shell`'s `PlaceMap` and this is
 * the adapter that keeps OneEvent's own prop names and appearance.
 *
 * `EventDetail.tsx` was not touched, and nothing about the event page changes: `panelClass="card"`
 * and `spacingClass=""` are here precisely so that promoting a component out of OneEvent cannot
 * silently restyle a live page in somebody else's lane.
 *
 * ── THE ONE THING WORTH KNOWING IF YOU EDIT THIS ────────────────────────────────────────────
 * `PlaceMap` takes a `precision` prop, and this passes "exact" — a marker on the venue, exactly
 * as before. That is right for an event, because a venue is a public fact; it is the whole point
 * of a ticket. It is NOT right for a home, and OneHome passes "approximate" for that reason. If
 * events ever gain a private-address case (a house party at somebody's address, say), that case
 * passes "approximate" and gets a circle — do not reach for a marker.
 */
export function LocationMap({ latitude, longitude, location, venueName, addressVisible }: {
  latitude?: any; longitude?: any; location?: string | null; addressVisible?: boolean; venueName?: string | null;
}) {
  const label = venueName || location || "Location";
  return (
    <PlaceMap
      lat={latitude}
      lng={longitude}
      precision="exact"
      label={label}
      sublabel={addressVisible !== false ? location : null}
      query={[venueName, location].filter(Boolean).join(", ") || label}
      panelClass="card"
      /* OneEvent keeps its venue chip and its height (shell defaults changed 2 Oct 2026 for OneHome). */
      labelChip
      heightClass="h-60"
      spacingClass=""
    />
  );
}
export default LocationMap;
