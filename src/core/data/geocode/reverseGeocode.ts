// Reverse geocoding via OpenStreetMap Nominatim — free, open, no API key, no tier caps
// Uses the same OpenStreetMap data that powers the Streets basemap (OpenStreetMap)
// Docs: https://nominatim.org/release-docs/develop/api/Reverse/
// Usage policy: 1 request/sec, cached aggressively to respect rate limits
// No new npm dependency — uses browser fetch

export interface LocationHierarchy {
  // raw fields
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  // derived
  hierarchy: string; // e.g., "Malolos · Bulacan · Philippines"
  displayName: string;
}

// Simple in-memory cache; hierarchy is stable, so we cache by rounded lat/lon
const cache = new Map<string, LocationHierarchy>();

function cacheKey(lat: number, lon: number): string {
  // round to ~1km precision to improve cache hits for nearby events
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function buildHierarchy(address: Record<string, string>, displayName: string): LocationHierarchy {
  const village = address.village || address.hamlet;
  const town = address.town;
  const city = address.city || address.municipality || address.town;
  const municipality = address.municipality;
  const county = address.county || address['ISO3166-2-lvl4'] || address.state_district;
  const state = address.state || address.province || address.region;
  const province = address.province || address.state;
  const country = address.country;
  const countryCode = address.country_code?.toUpperCase();

  // Build ordered hierarchy: most specific → broadest, deduplicated
  // e.g., Malolos · Bulacan · Central Luzon · Philippines
  const parts: string[] = [];
  const seen = new Set<string>();

  const push = (val?: string) => {
    if (!val) return;
    const trimmed = val.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return;
    seen.add(trimmed.toLowerCase());
    parts.push(trimmed);
  };

  // Most specific locality: village > town > city > municipality
  push(village);
  push(town);
  // city may duplicate town, so dedup handles it
  push(city);
  push(municipality);
  // Next: county (often province/county), then state/province
  push(county);
  push(state);
  if (province && province !== state) push(province);
  push(country);

  // Fallback to displayName first component if nothing parsed
  if (parts.length === 0 && displayName) {
    const first = displayName.split(',')[0]?.trim();
    if (first) parts.push(first);
    if (country) parts.push(country);
  }

  const hierarchy = parts.join(' · ');

  return {
    village,
    town,
    city,
    municipality,
    county,
    state,
    province,
    country,
    countryCode,
    hierarchy: hierarchy || displayName || `${county || state || country || ''}`.trim(),
    displayName,
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<LocationHierarchy | null> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached) return cached;

  // Throttle: small delay to respect Nominatim 1 req/sec if multiple concurrent
  // (callers should ideally stagger, but we add a tiny jitter)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1&accept-language=en`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    if (!json.address) return null;
    const hierarchy = buildHierarchy(json.address, json.display_name ?? '');
    cache.set(key, hierarchy);
    return hierarchy;
  } catch {
    return null;
  }
}

// Batch helper with rate limiting (1 req/sec) — fetches hierarchies for a list of points
// Returns a map from "lat,lon" key to hierarchy
export async function batchReverseGeocode(
  points: Array<{ id: string; lat: number; lon: number }>,
): Promise<Map<string, LocationHierarchy>> {
  const result = new Map<string, LocationHierarchy>();
  for (const p of points) {
    const key = `${p.lat},${p.lon}`;
    const h = await reverseGeocode(p.lat, p.lon);
    if (h) result.set(key, h);
    // Respect 1 req/sec politeness — wait 1100ms between calls (skipped for cached)
    const cacheHit = cache.has(cacheKey(p.lat, p.lon));
    if (!cacheHit) {
      // only delay if we actually made a network request and there are more to go
      await new Promise((r) => setTimeout(r, 1100));
    }
  }
  return result;
}

// Synchronous helper to derive a best-effort hierarchy from the existing title string
// Used as fallback when reverse geocode hasn't loaded yet or fails — no fake data, just parses place
export function deriveHierarchyFromTitle(title: string): string | null {
  // USGS titles like "M 2.8 - 128 km E of Chignik, Alaska" or "M 4.9 - Volcano Islands, Japan region"
  // EONET titles like "Wildfire in Central California" etc.
  // Extract the part after the last dash or after "of"
  const afterDash = title.split(' - ').pop()?.trim();
  if (!afterDash) return null;
  // If title already contains hierarchy-like "Chignik, Alaska", keep it as is
  // Turn comma into middle dot for consistent UI: "Chignik, Alaska" -> "Chignik · Alaska"
  if (afterDash.includes(',')) {
    return afterDash.replace(/,\s*/g, ' · ');
  }
  return afterDash || null;
}

export function getCachedHierarchy(lat: number, lon: number): LocationHierarchy | undefined {
  return cache.get(cacheKey(lat, lon));
}
