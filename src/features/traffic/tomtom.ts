import axios from 'axios';
import * as turf from '@turf/turf';

// Live traffic overlay via TomTom (Freemium: shared daily quota across all
// users of the app). Two APIs, exactly as specified:
// - Traffic Flow map tiles (raster, colored by congestion) as the overlay.
// - Traffic Incidents details (vector markers) for the current view.
// TomTom key for the traffic overlay: read from .env as
// VITE_TOMTOM_API_KEY via Vite's import.meta.env mechanism.
// See .env.example for expected variable names. .env is gitignored
// and never committed.
// Tile requests are cached by OpenLayers and the browser HTTP cache;
// incident responses are cached below by rounded bounding box with a TTL so
// panning back over the same area never re-fetches.

export type TrafficStatus = 'idle' | 'loading' | 'ok' | 'unavailable' | 'no-key';

export interface TrafficIncident {
  id: string;
  lon: number;
  lat: number;
  category: string;
  description: string | null;
  delaySeconds: number;
  severity: string | null;
  from: string | null;
  to: string | null;
  lengthMeters: number | null;
  startTime: string | null;
  endTime: string | null;
}

// Display labels straight from the TomTom Incident Details documentation:
// iconCategory codes and magnitudeOfDelay codes. Unlisted codes fall back to
// a neutral label — never invented.
const INCIDENT_CATEGORY_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'Accident',
  2: 'Fog',
  3: 'Dangerous conditions',
  4: 'Rain',
  5: 'Ice',
  6: 'Jam',
  7: 'Lane closed',
  8: 'Road closed',
  9: 'Road works',
  10: 'Wind',
  11: 'Flooding',
  14: 'Broken-down vehicle',
};

const DELAY_SEVERITY_LABELS: Record<number, string> = {
  0: 'Unknown severity',
  1: 'Minor delay',
  2: 'Moderate delay',
  3: 'Major delay',
  4: 'Indefinite delay',
};

export function incidentCategoryLabel(code: number | undefined, fallbackType: string | undefined): string {
  if (code !== undefined && INCIDENT_CATEGORY_LABELS[code] !== undefined) {
    return INCIDENT_CATEGORY_LABELS[code];
  }
  return fallbackType ?? 'Incident';
}

export function delaySeverityLabel(code: number | undefined): string | null {
  if (code === undefined) return null;
  return DELAY_SEVERITY_LABELS[code] ?? null;
}

export interface TrafficBBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export function tomtomApiKey(): string | null {
  const key = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}

/** Raster flow-tile URL template for OpenLayers XYZ and MapLibre raster.
 * The `thickness` parameter is the canonical TomTom thickness control
 * (1..20, default 10). Set to 5 for a thinner, less-cluttered overlay at
 * normal zoom — the visual density change is documented in Item 15 Part B.
 * Confirmed against TomTom's Raster Flow Tiles docs: thickness is accepted
 * for `absolute`, `relative`, `relative-delay`, and `reduced-sensitivity`
 * styles (the four styles the app uses). */
export function flowTileUrl(key: string, thickness = FLOW_TILE_THICKNESS): string {
  const safeThickness = Math.max(1, Math.min(20, Math.round(thickness)));
  return `https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=${key}&thickness=${safeThickness}`;
}

/** Default thickness passed to flowTileUrl — lower than TomTom's 10 to
 * reduce clutter at normal zoom without giving up legibility. */
export const FLOW_TILE_THICKNESS = 5;

const INCIDENTS_URL = 'https://api.tomtom.com/traffic/services/5/incidentDetails';
const INCIDENTS_TTL_MS = 120000;
const MAX_INCIDENTS = 50;

interface CachedIncidents {
  fetchedAt: number;
  incidents: TrafficIncident[];
}

const incidentsCache = new Map<string, CachedIncidents>();

function bboxCacheKey(bbox: TrafficBBox): string {
  const round = (value: number): string => value.toFixed(2);
  return [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].map(round).join(',');
}

interface TomTomIncident {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    id?: string | number;
    iconCategory?: number;
    delay?: number;
    magnitudeOfDelay?: number;
    events?: { description?: string }[];
    from?: string;
    to?: string;
    length?: number;
    startTime?: string;
    endTime?: string;
  };
}

function pointOfGeometry(geometry: TomTomIncident['geometry']): { lon: number; lat: number } | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates as [number, number];
    if (typeof lon === 'number' && typeof lat === 'number') return { lon, lat };
    return null;
  }
  try {
    const centroid = turf.centroid(geometry as never);
    const [lon, lat] = centroid.geometry.coordinates;
    if (typeof lon === 'number' && typeof lat === 'number') return { lon, lat };
  } catch {
    return null;
  }
  return null;
}

/** Pure response transform, exported for unit tests. */
export function parseIncidents(data: { incidents?: TomTomIncident[] }): TrafficIncident[] {
  const incidents: TrafficIncident[] = [];
  for (const item of data.incidents ?? []) {
    const point = pointOfGeometry(item.geometry);
    if (!point) continue;
    const properties = item.properties ?? {};
    incidents.push({
      id: String(properties.id ?? `${point.lon},${point.lat}`),
      lon: point.lon,
      lat: point.lat,
      category: incidentCategoryLabel(properties.iconCategory, item.type),
      description: properties.events?.[0]?.description ?? null,
      delaySeconds: properties.delay ?? 0,
      severity: delaySeverityLabel(properties.magnitudeOfDelay),
      from: properties.from ?? null,
      to: properties.to ?? null,
      lengthMeters: properties.length ?? null,
      startTime: properties.startTime ?? null,
      endTime: properties.endTime ?? null,
    });
    if (incidents.length >= MAX_INCIDENTS) break;
  }
  return incidents;
}

/**
 * Fetch active incidents for a bounding box. Throws 'unavailable' failures
 * (quota/HTTP/network) for the caller to translate into the UI fallback —
 * never invented incidents.
 */
export async function fetchTrafficIncidents(bbox: TrafficBBox): Promise<TrafficIncident[]> {
  const key = tomtomApiKey();
  if (!key) {
    throw new Error('no-key');
  }
  const cacheKey = bboxCacheKey(bbox);
  const cached = incidentsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < INCIDENTS_TTL_MS) {
    return cached.incidents;
  }
  const params = new URLSearchParams({
    key,
    bbox: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
    fields:
      '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,delay,events{description},from,to,length,startTime,endTime}}}',
    language: 'en-US',
    timeValidityFilter: 'present',
  });
  try {
    const { data } = await axios.get<{ incidents?: TomTomIncident[] }>(`${INCIDENTS_URL}?${params}`, {
      timeout: 15000,
    });
    const incidents = parseIncidents(data);
    incidentsCache.set(cacheKey, { fetchedAt: Date.now(), incidents });
    return incidents;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const failed =
        status === 429
          ? new Error('unavailable: quota exceeded (HTTP 429)')
          : new Error(status !== undefined ? `unavailable: HTTP ${status}` : `unavailable: ${error.message}`);
      (failed as { cause?: unknown }).cause = error;
      throw failed;
    }
    throw error;
  }
}
