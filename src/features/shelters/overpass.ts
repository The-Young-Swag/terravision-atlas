import axios from 'axios';

// Shelter locator: queries OpenStreetMap via the Overpass API for every
// tagging scheme OSM uses for emergency shelter in ONE union query — there
// is no single standard global tag, so all four are needed together:
// amenity=shelter, social_facility=shelter, emergency=assembly_point and
// evacuation_center=yes. Coverage is community-sourced and varies enormously
// by region; the UI carries that caveat next to the results, always.

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const REQUEST_TIMEOUT_MS = 25000;

export interface Shelter {
  id: string;
  lon: number;
  lat: number;
  name: string | null;
  matchedTag: string;
}

export interface ShelterBBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const TAG_FILTERS: { key: string; value: string }[] = [
  { key: 'amenity', value: 'shelter' },
  { key: 'social_facility', value: 'shelter' },
  { key: 'emergency', value: 'assembly_point' },
  { key: 'evacuation_center', value: 'yes' },
];

/** Pure query builder, exported for unit tests. */
export function buildShelterQuery(bbox: ShelterBBox): string {
  const box = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
  const union = TAG_FILTERS.map(({ key, value }) => `  nwr["${key}"="${value}"](${box});`).join('\n');
  return `[out:json][timeout:25];\n(\n${union}\n);\nout center tags;`;
}

function matchedTag(tags: Record<string, string>): string | null {
  for (const { key, value } of TAG_FILTERS) {
    if (tags[key] === value) return `${key}=${value}`;
  }
  return null;
}

/** Pure response transform, exported for unit tests. */
export function parseShelters(data: { elements?: OverpassElement[] }): Shelter[] {
  const shelters: Shelter[] = [];
  for (const element of data.elements ?? []) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const tag = matchedTag(tags);
    if (lat === undefined || lon === undefined || tag === null) continue;
    shelters.push({
      id: `${element.type}/${element.id}`,
      lon,
      lat,
      name: tags.name ?? null,
      matchedTag: tag,
    });
  }
  return shelters;
}

async function postQuery(endpoint: string, query: string): Promise<{ elements?: OverpassElement[] }> {
  const { data } = await axios.post<{ elements?: OverpassElement[] }>(endpoint, `data=${encodeURIComponent(query)}`, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

/**
 * Find shelters in a bounding box. Tries the main Overpass instance, then
 * the Kumi fallback — Overpass frequently answers 429/504 under load, and
 * a fallback is standard practice, not a different data source. Throws with
 * a plain-language message when both fail; callers show it, never invented
 * shelter locations.
 */
export async function fetchShelters(bbox: ShelterBBox): Promise<Shelter[]> {
  const query = buildShelterQuery(bbox);
  const failures: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return parseShelters(await postQuery(endpoint, query));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        failures.push(status !== undefined ? `HTTP ${status}` : error.message);
      } else {
        failures.push(String(error));
      }
    }
  }
  throw new Error(`Shelter lookup failed on all Overpass servers (${failures.join('; ')})`);
}
