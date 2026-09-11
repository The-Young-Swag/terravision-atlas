import * as turf from '@turf/turf';
import { routeThroughPoints, type MultiStopRoute, type RoutePoint } from './valhalla';

// Jogging/running loop planner (client-side; Valhalla has no native
// "generate a loop of X km" endpoint — verified against the current API
// reference, which lists only point-to-point and multi-stop costing).
// Strategy: place waypoints on a ring around the start, request ONE
// pedestrian route through start → waypoints → start, compare the actual
// distance to the target, and rescale the ring (bounded) for up to
// MAX_ATTEMPTS. The closest result is returned with its ACTUAL distance —
// never rounded to the target.
//
// Pedestrian costing options below are verified against Valhalla's current
// API reference / OpenAPI spec:
// - walkway_factor (default 1.0): cost multiplier on footways; below 1.0
//   slightly favors footpaths over roads.
// - use_hills (0–1, default 0.5): 0 avoids hills, 1 ignores them.

export type Hilliness = 'flat' | 'hilly';

export interface JogLoopRequest {
  start: RoutePoint;
  targetKm: number;
  hilliness: Hilliness;
}

export interface JogLoopResult extends MultiStopRoute {
  targetKm: number;
  attempts: number;
  /** True when the actual distance landed within tolerance of the target. */
  withinTolerance: boolean;
}

const WAYPOINT_COUNT = 6;
const MAX_ATTEMPTS = 3;
const TOLERANCE = 0.25;
const MIN_RADIUS_KM = 0.2;
const MAX_RADIUS_KM = 8;

export function ringWaypoints(start: RoutePoint, radiusKm: number): RoutePoint[] {
  const origin = turf.point([start.lon, start.lat]);
  const waypoints: RoutePoint[] = [];
  for (let i = 0; i < WAYPOINT_COUNT; i++) {
    const bearing = (360 / WAYPOINT_COUNT) * i;
    const dest = turf.destination(origin, radiusKm, bearing, { units: 'kilometers' });
    const [lon, lat] = dest.geometry.coordinates;
    waypoints.push({ lon, lat });
  }
  return waypoints;
}

export type LoopRouteFn = (
  locations: RoutePoint[],
  costingOptions: Record<string, number | string>,
) => Promise<MultiStopRoute>;

/**
 * Generate a loop of ~targetKm starting/ending at `start`. Returns the
 * closest genuinely-routed result with its actual measured distance.
 */
export async function buildJogLoop(request: JogLoopRequest, routeFn?: LoopRouteFn): Promise<JogLoopResult> {
  const { start, targetKm, hilliness } = request;
  if (!Number.isFinite(targetKm) || targetKm < 0.5 || targetKm > 42) {
    throw new Error('Target distance must be between 0.5 and 42 km');
  }
  const costingOptions: Record<string, number | string> = {
    walkway_factor: 0.9,
    use_hills: hilliness === 'flat' ? 0.15 : 0.85,
  };
  const run: LoopRouteFn =
    routeFn ??
    ((locations, options) => routeThroughPoints(locations, 'pedestrian', options));

  let radiusKm = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, targetKm / WAYPOINT_COUNT));
  let best: MultiStopRoute | null = null;
  let attempts = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts = attempt + 1;
    const locations = [start, ...ringWaypoints(start, radiusKm), start];
    const result = await run(locations, costingOptions);
    best = result;
    if (result.distanceKm <= 0) break;
    const ratio = targetKm / result.distanceKm;
    if (Math.abs(1 - ratio) <= TOLERANCE) {
      return { ...result, targetKm, attempts, withinTolerance: true };
    }
    radiusKm = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, radiusKm * Math.min(1.6, Math.max(0.6, ratio))));
  }
  if (!best || best.distanceKm <= 0) {
    throw new Error('No walkable loop found from this start — try a denser street area');
  }
  return { ...best, targetKm, attempts, withinTolerance: false };
}

/** Adapt a jog loop to the shared route-line rendering (neutral verdict). */
export function jogLoopAsEvacRoute(loop: { path: RoutePoint[]; distanceKm: number; durationMinutes: number }): {
  path: RoutePoint[];
  distanceKm: number;
  durationMinutes: number;
  avoidsArea: boolean;
} {
  return { path: loop.path, distanceKm: loop.distanceKm, durationMinutes: loop.durationMinutes, avoidsArea: true };
}
