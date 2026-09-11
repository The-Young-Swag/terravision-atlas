import axios from 'axios';

// Evacuation routing through the FOSSGIS public Valhalla demo server.
// Valhalla — not OSRM — because only Valhalla supports avoid-polygon
// routing via `exclude_polygons` (OSRM cannot route around areas).
// Fair-use rules per the operator: max 1 request/sec per user and an
// X-Client-Id header identifying the app.
// Costing models and option names below were verified against Valhalla's
// current API reference + OpenAPI spec (openapi.yaml):
// - costing: 'auto' | 'bicycle' | 'pedestrian' (CostingType enum)
// - costing_options keyed by costing name, e.g.
//   { pedestrian: { walking_speed, walkway_factor, use_hills } }
// - pedestrian.walkway_factor (default 1.0) slightly favors footways;
//   use_hills 0 avoids hills, 1 ignores them (default 0.5)
// - bicycle.bicycle_type: road|hybrid|city|cross|mountain
// Valhalla has no native "generate a loop of X km" endpoint, so jogging
// loops are built client-side (see joggingLoop.ts) on top of this module.

export const VALHALLA_ROUTE_URL = 'https://valhalla1.openstreetmap.de/route';
export const VALHALLA_CLIENT_ID = 'terravision-atlas';
const MIN_REQUEST_GAP_MS = 1000;
const REQUEST_TIMEOUT_MS = 20000;

let lastRequestAt = 0;

async function respectRateLimit(): Promise<void> {
  const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

export interface RoutePoint {
  lon: number;
  lat: number;
}

export interface AvoidanceRoute {
  path: RoutePoint[]; // decoded route geometry, lon/lat
  distanceKm: number;
  durationMinutes: number;
  maneuverCount: number;
}

/** Decode a polyline6-encoded shape (Valhalla's shape format) to lon/lat. */
export function decodePolyline6(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lon: lon / 1e6, lat: lat / 1e6 });
  }
  return points;
}

interface ValhallaLeg {
  shape?: string;
  maneuvers?: unknown[];
}

export interface ValhallaResponse {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: ValhallaLeg[];
    status_message?: string;
    status?: number;
  };
  error?: string;
}

export interface AvoidanceRequestBody {
  locations: { lat: number; lon: number }[];
  costing: string;
  costing_options?: Record<string, Record<string, number | string>>;
  exclude_polygons?: [number, number][][];
  directions_options: { units: string };
}

export type TravelCosting = 'auto' | 'bicycle' | 'pedestrian';

export const TRAVEL_COSTINGS: { id: TravelCosting; label: string; durationNoun: string }[] = [
  { id: 'auto', label: 'Driving', durationNoun: 'by car' },
  { id: 'bicycle', label: 'Cycling', durationNoun: 'by bike' },
  { id: 'pedestrian', label: 'Walking', durationNoun: 'on foot' },
];

/** Pure request builder, exported for unit tests. */
export function buildAvoidanceRequestBody(
  from: RoutePoint,
  to: RoutePoint,
  avoidRing: RoutePoint[] | null,
  costing: TravelCosting = 'auto',
  costingOptions?: Record<string, number | string>,
): AvoidanceRequestBody {
  return {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing,
    ...(costingOptions ? { costing_options: { [costing]: costingOptions } } : {}),
    // NOTE: exclusion polygons are GeoJSON-style [lon, lat] pairs, NOT the
    // {lat, lon} objects that locations use. Sending objects fails with
    // "Failed to parse polygon: IsArray()".
    ...(avoidRing ? { exclude_polygons: [avoidRing.map((point) => [point.lon, point.lat])] } : {}),
    directions_options: { units: 'kilometers' },
  };
}

export interface RouteRequestOptions {
  costing?: TravelCosting;
  costingOptions?: Record<string, number | string>;
  avoidRing?: RoutePoint[] | null;
}

/**
 * General point-to-point routing with any costing. Throws with a
 * plain-language message on any failure — callers show it, never a
 * fabricated fallback route.
 */
export async function routeWithOptions(
  from: RoutePoint,
  to: RoutePoint,
  options: RouteRequestOptions = {},
): Promise<AvoidanceRoute> {
  const { costing = 'auto', costingOptions, avoidRing = null } = options;
  if (avoidRing && avoidRing.length < 4) {
    throw new Error('Avoidance area needs at least 3 distinct points plus closure');
  }
  await respectRateLimit();
  let data: ValhallaResponse;
  try {
    const response = await axios.post<ValhallaResponse>(
      VALHALLA_ROUTE_URL,
      buildAvoidanceRequestBody(from, to, avoidRing, costing, costingOptions),
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'X-Client-Id': VALHALLA_CLIENT_ID, 'Content-Type': 'application/json' },
      },
    );
    data = response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        const rateLimited = new Error('Routing server is rate-limited right now — wait a few seconds and retry');
        (rateLimited as { cause?: unknown }).cause = error;
        throw rateLimited;
      }
      const failed = new Error(
        status !== undefined ? `Routing server returned HTTP ${status}` : `Routing server unreachable: ${error.message}`,
      );
      (failed as { cause?: unknown }).cause = error;
      throw failed;
    }
    throw error;
  }

  return parseAvoidanceResponse(data);
}

/**
 * Route from A to B while avoiding a closed polygon ring. Throws with a
 * plain-language message on any failure — callers show it, never a
 * fabricated fallback route.
 */
export async function routeAvoidingArea(
  from: RoutePoint,
  to: RoutePoint,
  avoidRing: RoutePoint[] | null,
): Promise<AvoidanceRoute> {
  return routeWithOptions(from, to, { avoidRing });
}

export interface MultiStopRoute {
  path: RoutePoint[];
  distanceKm: number;
  durationMinutes: number;
  maneuverCount: number;
}

/**
 * Route through an ordered list of stops (3+ locations) with any costing.
 * Leg shapes are concatenated (shared endpoints de-duplicated) and the
 * summary totals the whole itinerary. Same rate limit, timeout, client id,
 * and honest errors as point-to-point routing.
 */
export async function routeThroughPoints(
  locations: RoutePoint[],
  costing: TravelCosting = 'pedestrian',
  costingOptions?: Record<string, number | string>,
): Promise<MultiStopRoute> {
  if (locations.length < 3) {
    throw new Error('A multi-stop route needs at least 3 locations');
  }
  await respectRateLimit();
  let data: ValhallaResponse;
  try {
    const response = await axios.post<ValhallaResponse>(
      VALHALLA_ROUTE_URL,
      {
        locations: locations.map((point) => ({ lat: point.lat, lon: point.lon })),
        costing,
        ...(costingOptions ? { costing_options: { [costing]: costingOptions } } : {}),
        directions_options: { units: 'kilometers' },
      },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'X-Client-Id': VALHALLA_CLIENT_ID, 'Content-Type': 'application/json' },
      },
    );
    data = response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        const rateLimited = new Error('Routing server is rate-limited right now — wait a few seconds and retry');
        (rateLimited as { cause?: unknown }).cause = error;
        throw rateLimited;
      }
      const failed = new Error(
        status !== undefined ? `Routing server returned HTTP ${status}` : `Routing server unreachable: ${error.message}`,
      );
      (failed as { cause?: unknown }).cause = error;
      throw failed;
    }
    throw error;
  }
  const trip = data.trip;
  if (!trip || data.error) {
    throw new Error(data.error ?? 'Routing server returned no route');
  }
  if (trip.status !== undefined && trip.status !== 0) {
    throw new Error(trip.status_message ?? `Route not found (status ${trip.status}) — try road points closer together`);
  }
  const legs = trip.legs ?? [];
  if (legs.length === 0 || !legs[0].shape) {
    throw new Error('Routing server returned a route without geometry');
  }
  const path: RoutePoint[] = [];
  let maneuverCount = 0;
  for (const leg of legs) {
    if (!leg.shape) continue;
    const points = decodePolyline6(leg.shape);
    if (path.length > 0) points.shift();
    path.push(...points);
    maneuverCount += leg.maneuvers?.length ?? 0;
  }
  return {
    path,
    distanceKm: trip.summary?.length ?? 0,
    durationMinutes: (trip.summary?.time ?? 0) / 60,
    maneuverCount,
  };
}

/** Pure response transform, exported for unit tests. */
export function parseAvoidanceResponse(data: ValhallaResponse): AvoidanceRoute {
  const trip = data.trip;
  if (!trip || data.error) {
    throw new Error(data.error ?? 'Routing server returned no route');
  }
  if (trip.status !== undefined && trip.status !== 0) {
    throw new Error(trip.status_message ?? `Route not found (status ${trip.status}) — try road points closer together`);
  }
  const leg = trip.legs?.[0];
  if (!leg?.shape) {
    throw new Error('Routing server returned a route without geometry');
  }
  return {
    path: decodePolyline6(leg.shape),
    distanceKm: trip.summary?.length ?? 0,
    durationMinutes: (trip.summary?.time ?? 0) / 60,
    maneuverCount: leg.maneuvers?.length ?? 0,
  };
}
