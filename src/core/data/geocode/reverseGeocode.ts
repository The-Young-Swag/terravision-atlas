// Reverse geocoding via OpenStreetMap Nominatim — free, open, no API key, no tier caps
// OpenStreetMap data powers the Streets basemap (default source)
// Docs: https://nominatim.org/release-docs/develop/api/Reverse/
// Usage policy: 1 request/sec — enforced through the shared throttle in
// features/search/geocode so reverse lookups (weather, event list) and
// forward search-box geocoding never overlap and throttle each other.
// Concurrent lookups for the same point share one in-flight request.
// No new npm dependency — uses browser fetch
import { respectNominatimRateLimit } from '../../../features/search/geocode';

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
// In-flight requests by cache key: concurrent lookups for the same point
// (e.g. weather header + event list re-rendering on one map move) share
// a single network call instead of firing duplicates.
const inflight = new Map<string, Promise<LocationHierarchy | null>>();

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
  const ongoing = inflight.get(key);
  if (ongoing) return ongoing;

  const task = (async (): Promise<LocationHierarchy | null> => {
    try {
      // Shared throttle: reverse lookups queue behind forward searches
      // (and vice versa) instead of bursting past Nominatim's 1 req/sec.
      await respectNominatimRateLimit();
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
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, task);
  return task;
}

// Batch helper — fetches hierarchies for a list of points sequentially.
// Spacing comes from the shared throttle inside reverseGeocode, so batch
// traffic and search-box traffic coordinate through one gate.
export async function batchReverseGeocode(
  points: Array<{ id: string; lat: number; lon: number }>,
): Promise<Map<string, LocationHierarchy>> {
  const result = new Map<string, LocationHierarchy>();
  for (const p of points) {
    const key = `${p.lat},${p.lon}`;
    const h = await reverseGeocode(p.lat, p.lon);
    if (h) result.set(key, h);
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
