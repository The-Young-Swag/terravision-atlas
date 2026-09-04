import * as turf from '@turf/turf';
import type { EvacRoutePoint } from '../../stores/routeStore';

// The avoid zone is a single circle {center, radiusKm} everywhere in the
// app. Its turf.circle polygon is the single source of truth: the same
// object is drawn on screen (both maps) and handed to Valhalla's
// exclude_polygons — never a separate visual/request copy.
export interface EvacCircle {
  lon: number;
  lat: number;
  radiusKm: number;
}

export const AVOID_CIRCLE_STEPS = 32;

export function circlePolygon(circle: EvacCircle): GeoJSON.Feature<GeoJSON.Polygon> {
  return turf.circle([circle.lon, circle.lat], circle.radiusKm, {
    steps: AVOID_CIRCLE_STEPS,
    units: 'kilometers',
  }) as GeoJSON.Feature<GeoJSON.Polygon>;
}

/** Smallest drawable radius — a plain click without drag draws nothing. */
export const MIN_AVOID_RADIUS_KM = 0.1;

/** Live preview circle from a drag: anchor center plus current cursor point. */
export function previewCircle(centerLon: number, centerLat: number, cursorLon: number, cursorLat: number): EvacCircle {
  const radiusKm = turf.distance([centerLon, centerLat], [cursorLon, cursorLat], { units: 'kilometers' });
  return { lon: centerLon, lat: centerLat, radiusKm };
}

export function circleToRing(circle: EvacCircle): EvacRoutePoint[] {
  const polygon = circlePolygon(circle);
  return (polygon.geometry.coordinates[0] as [number, number][]).map(([lon, lat]) => ({ lon, lat }));
}

export type EvacStep = 'start' | 'destination' | 'avoid' | 'ready';

/** Derived step — never stored, always computed from pins + route. */
export function evacStep(
  start: { lon: number; lat: number } | null,
  destination: { lon: number; lat: number } | null,
  hasRoute: boolean,
): EvacStep {
  if (!start) return 'start';
  if (!destination) return 'destination';
  if (!hasRoute) return 'avoid';
  return 'ready';
}

export const EVAC_STEP_INSTRUCTIONS: Record<EvacStep, string> = {
  start: 'Click the map or search to set the start',
  destination: 'Click the map or search to set the destination',
  avoid: 'Optionally draw an area to avoid, then find route',
  ready: 'Route found — edit pins or redraw to plan again',
};
