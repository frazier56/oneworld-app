/**
 * useGeoLocation — Detects the visitor's city via a chain of IP-geo providers.
 *
 * Strategy (in order, fail-fast on each):
 *   1. ipwho.is        — free, no key, returns city + country + region (high accuracy in LATAM)
 *   2. geojs.io        — free, no key, fallback (city + country)
 *   3. ipapi.co        — original provider (rate-limited but accurate)
 *   4. Timezone match  — last-resort heuristic
 *
 * We require AGREEMENT between at least two providers (or one provider + matching
 * timezone country) before showing a city. If providers disagree on country, we
 * suppress the badge entirely rather than show the wrong city — this prevents
 * the "Now hiring in Bogotá" issue when the user is actually in Medellín or Miami.
 *
 * Cached for 24h in localStorage. Cache cleared if app version bumps.
 */
import { useEffect, useState } from "react";

interface GeoData {
  city: string | null;
  country: string | null;
  source: "ip-consensus" | "ip-single" | "browser-geolocation" | null;
}

const TZ_TO_CITY: Record<string, { city: string; country: string }> = {
  "America/New_York": { city: "New York", country: "US" },
  "America/Los_Angeles": { city: "Los Angeles", country: "US" },
  "America/Chicago": { city: "Chicago", country: "US" },
  "America/Denver": { city: "Denver", country: "US" },
  "America/Phoenix": { city: "Phoenix", country: "US" },
  "America/Bogota": { city: "Bogotá", country: "CO" },
  "America/Mexico_City": { city: "Mexico City", country: "MX" },
  "America/Buenos_Aires": { city: "Buenos Aires", country: "AR" },
  "America/Sao_Paulo": { city: "São Paulo", country: "BR" },
  "Europe/London": { city: "London", country: "UK" },
  "Europe/Berlin": { city: "Berlin", country: "DE" },
  "Europe/Madrid": { city: "Madrid", country: "ES" },
  "Asia/Manila": { city: "Manila", country: "PH" },
};

// Bump this if you change geo logic to invalidate stale caches.
const STORAGE_KEY = "os_geo_v4";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 3500;

interface ProviderResult {
  city: string;
  country: string; // ISO-2
  region?: string;
  org?: string;
}

const SUSPICIOUS_NETWORK_KEYWORDS = [
  "packethub",
  "vpn",
  "proxy",
  "hosting",
  "datacenter",
  "data center",
  "cloud",
  "digitalocean",
  "amazon",
  "aws",
  "google",
  "microsoft",
  "azure",
  "linode",
  "vultr",
  "ovh",
  "hetzner",
  "contabo",
];

function normalizeCity(raw: string, country: string): string {
  const lower = raw.toLowerCase().trim();
  // Common ASCII spellings → properly accented versions for LATAM
  const map: Record<string, string> = {
    medellin: "Medellín",
    bogota: "Bogotá",
    "san jose": country === "CR" ? "San José" : "San Jose",
    cancun: "Cancún",
    "mexico city": "Mexico City",
    "ciudad de mexico": "Mexico City",
    "ciudad de méxico": "Mexico City",
    "sao paulo": "São Paulo",
  };
  return map[lower] ?? raw;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

async function fromIpwhois(): Promise<ProviderResult | null> {
  const res = await fetchWithTimeout("https://ipwho.is/?fields=city,country_code,region,success");
  if (!res) return null;
  try {
    const d = await res.json();
    if (d?.success && d.city && d.country_code) {
      return { city: d.city, country: d.country_code, region: d.region };
    }
  } catch {}
  return null;
}

async function fromGeojs(): Promise<ProviderResult | null> {
  const res = await fetchWithTimeout("https://get.geojs.io/v1/ip/geo.json");
  if (!res) return null;
  try {
    const d = await res.json();
    if (d?.city && d?.country_code) {
      return { city: d.city, country: d.country_code, region: d.region, org: d.organization_name ?? d.organization };
    }
  } catch {}
  return null;
}

async function fromIpapi(): Promise<ProviderResult | null> {
  const res = await fetchWithTimeout("https://ipapi.co/json/");
  if (!res) return null;
  try {
    const d = await res.json();
    if (d?.city && d?.country_code) {
      return { city: d.city, country: d.country_code, region: d.region, org: d.org };
    }
  } catch {}
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<ProviderResult | null> {
  const res = await fetchWithTimeout(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
  if (!res) return null;
  try {
    const d = await res.json();
    const city = d?.city || d?.locality || d?.principalSubdivision || null;
    const country = d?.countryCode || null;
    if (city && country) {
      return { city, country, region: d?.principalSubdivision };
    }
  } catch {}
  return null;
}

async function fromBrowserGeolocation(): Promise<ProviderResult | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        resolve(await reverseGeocode(coords.latitude, coords.longitude));
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  });
}

function isSuspiciousNetwork(result: ProviderResult): boolean {
  const haystack = `${result.org ?? ""} ${result.region ?? ""}`.toLowerCase();
  return SUSPICIOUS_NETWORK_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function useGeoLocation() {
  const [geo, setGeo] = useState<GeoData>({ city: null, country: null, source: null });

  useEffect(() => {
    let cancelled = false;

    // Cached?
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.expires > Date.now()) {
          setGeo({ city: parsed.city, country: parsed.country, source: parsed.source });
          return;
        }
      }
    } catch {}

    (async () => {
      // Run providers in parallel — first 2 results decide consensus
      const [a, b, c] = await Promise.all([fromIpwhois(), fromGeojs(), fromIpapi()]);
      if (cancelled) return;

      const results = [a, b, c].filter((r): r is ProviderResult => r !== null);

      const trustworthyResults = results.filter((result) => !isSuspiciousNetwork(result));

      // Look for consensus: 2+ providers agreeing on city (case-insensitive).
      const cityVotes = new Map<string, ProviderResult[]>();
      for (const r of trustworthyResults) {
        const key = `${r.city.toLowerCase()}|${r.country}`;
        const arr = cityVotes.get(key) ?? [];
        arr.push(r);
        cityVotes.set(key, arr);
      }

      let chosen: ProviderResult | null = null;
      let source: GeoData["source"] = null;

      // Prefer consensus (2+ agree)
      for (const [, arr] of cityVotes) {
        if (arr.length >= 2) {
          chosen = arr[0];
          source = "ip-consensus";
          break;
        }
      }

      // No consensus → use single provider ONLY if its country matches the timezone country.
      // We intentionally do not infer city from timezone because Medellín and Bogotá share one.
      if (!chosen) {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const tzMatch = TZ_TO_CITY[tz];
          const single = trustworthyResults.find((r) => tzMatch && r.country === tzMatch.country);
          if (single) {
            chosen = single;
            source = "ip-single";
          }
        } catch {}
      }

      // If IP data looks like a VPN/datacenter (for example PacketHub resolving to Bogotá),
      // ask the browser for real device location and reverse-geocode it.
      if (!chosen) {
        const browserLocation = await fromBrowserGeolocation();
        if (cancelled) return;
        if (browserLocation) {
          chosen = browserLocation;
          source = "browser-geolocation";
        }
      }

      // Still nothing trustworthy → suppress the badge entirely.
      if (!chosen || !source) return;

      const city = normalizeCity(chosen.city, chosen.country);
      const next: GeoData = { city, country: chosen.country, source };
      setGeo(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, expires: Date.now() + TTL_MS }));
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return geo;
}
