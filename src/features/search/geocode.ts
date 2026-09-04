import axios from 'axios';

// Two-tier geocoding on OpenStreetMap data, no keys, no registration:
// - Photon (photon.komoot.io) for search-as-you-type autocomplete.
// - Nominatim for final structured geocoding and reverse geocoding.
// Fair-use: Nominatim allows 1 request/sec — enforced below with a shared
// gate so forward, reverse, and drag-re-geocode calls never overlap.
// Photon has no hard limit; callers debounce keystrokes (300 ms).
// NOTE on headers: browsers forbid scripts from setting User-Agent, so it
// cannot be sent from this client. The browser always sends Referer
// (localhost in dev, the deployed origin in prod), which identifies the app
// to both services; both responses also require on-screen OSM attribution,
// handled where results render.

export interface PlaceSuggestion {
  label: string;
  sublabel: string | null;
  lon: number;
  lat: number;
}

export interface GeocodedPlace {
  lon: number;
  lat: number;
  displayName: string;
}

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const AUTOCOMPLETE_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 15000;
const NOMINATIM_MIN_GAP_MS = 1000;

let lastNominatimAt = 0;

async function respectNominatimRateLimit(): Promise<void> {
  const wait = NOMINATIM_MIN_GAP_MS - (Date.now() - lastNominatimAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastNominatimAt = Date.now();
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/** Pure Photon response transform, exported for unit tests. */
export function parsePhotonSuggestions(data: { features?: PhotonFeature[] }): PlaceSuggestion[] {
  const suggestions: PlaceSuggestion[] = [];
  for (const feature of data.features ?? []) {
    const [lon, lat] = feature.geometry?.coordinates ?? [];
    const name = feature.properties?.name;
    if (typeof lon !== 'number' || typeof lat !== 'number' || !name) continue;
    const area = feature.properties?.city ?? feature.properties?.county ?? feature.properties?.state ?? null;
    const country = feature.properties?.country ?? null;
    const sublabel = [area, country].filter((part): part is string => part !== null).join(', ') || null;
    suggestions.push({ label: name, sublabel, lon, lat });
    if (suggestions.length >= AUTOCOMPLETE_LIMIT) break;
  }
  return suggestions;
}

export async function searchPhoton(query: string, centerLat: number, centerLon: number): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language.split('-')[0] : 'en';
  const { data } = await axios.get<{ features?: PhotonFeature[] }>(PHOTON_URL, {
    params: { q: trimmed, limit: AUTOCOMPLETE_LIMIT, lang, lat: centerLat, lon: centerLon },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return parsePhotonSuggestions(data);
}

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
}

/** Pure Nominatim forward-response transform, exported for unit tests. */
export function parseNominatimResult(data: NominatimResult[]): GeocodedPlace | null {
  const first = data[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !first.display_name) return null;
  return { lon, lat, displayName: first.display_name };
}

export async function geocodeNominatim(query: string): Promise<GeocodedPlace | null> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;
  await respectNominatimRateLimit();
  try {
    const { data } = await axios.get<NominatimResult[]>(NOMINATIM_SEARCH_URL, {
      params: { q: trimmed, format: 'json', limit: 1, addressdetails: 1 },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return parseNominatimResult(data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const failed = new Error(
        `Search failed: ${error.response ? `HTTP ${error.response.status}` : 'service unreachable'}`,
      );
      (failed as { cause?: unknown }).cause = error;
      throw failed;
    }
    throw error;
  }
}

/** Pure Nominatim reverse-response transform, exported for unit tests. */
export function parseReverseResult(data: { display_name?: string; lat?: string; lon?: string }): GeocodedPlace | null {
  if (!data.display_name) return null;
  const lat = Number(data.lat);
  const lon = Number(data.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lon, lat, displayName: data.display_name };
}

export async function reverseNominatim(lat: number, lon: number): Promise<GeocodedPlace | null> {
  await respectNominatimRateLimit();
  try {
    const { data } = await axios.get<{ display_name?: string; lat?: string; lon?: string }>(NOMINATIM_REVERSE_URL, {
      params: { lat, lon, format: 'json', addressdetails: 1 },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return parseReverseResult(data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const failed = new Error(
        `Reverse lookup failed: ${error.response ? `HTTP ${error.response.status}` : 'service unreachable'}`,
      );
      (failed as { cause?: unknown }).cause = error;
      throw failed;
    }
    throw error;
  }
}
