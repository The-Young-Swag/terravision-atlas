import axios from 'axios';

// Evacuation routing through the FOSSGIS public Valhalla demo server.
// Valhalla — not OSRM — because only Valhalla supports avoid-polygon
// routing via `exclude_polygons` (OSRM cannot route around areas).
// Fair-use rules per the operator: max 1 request/sec per user and an
// X-Client-Id header identifying the app. Normal (non-avoidance) routing
// stays wherever it already is; only avoidance requests go here.

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
  exclude_polygons: { lat: number; lon: number }[][];
  directions_options: { units: string };
}

/** Pure request builder, exported for unit tests. */
export function buildAvoidanceRequestBody(
  from: RoutePoint,
  to: RoutePoint,
  avoidRing: RoutePoint[],
): AvoidanceRequestBody {
  return {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing: 'auto',
    exclude_polygons: [avoidRing.map((point) => ({ lat: point.lat, lon: point.lon }))],
    directions_options: { units: 'kilometers' },
  };
}

/**
 * Route from A to B while avoiding a closed polygon ring. Throws with a
 * plain-language message on any failure — callers show it, never a
 * fabricated fallback route.
 */
export async function routeAvoidingArea(
  from: RoutePoint,
  to: RoutePoint,
  avoidRing: RoutePoint[],
): Promise<AvoidanceRoute> {
  if (avoidRing.length < 4) {
    throw new Error('Avoidance area needs at least 3 distinct points plus closure');
  }
  await respectRateLimit();
  let data: ValhallaResponse;
  try {
    const response = await axios.post<ValhallaResponse>(
      VALHALLA_ROUTE_URL,
      buildAvoidanceRequestBody(from, to, avoidRing),
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
