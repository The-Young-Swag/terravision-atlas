import type { Map as MapLibreMap } from 'maplibre-gl';
import type { EvacRoute } from '../../../stores/routeStore';
import type { FlowSample } from '../../../features/traffic/flowEta';
import {
  ROUTE_CASING_WIDTH,
  ROUTE_LINE_WIDTH,
  ROUTE_LINE_COLOR,
  ROUTE_CASING_COLOR,
} from '../../../features/map/routeStyle';
import { flowStatusColor } from '../../../features/traffic/flowStatus';

// Evacuation route line for the Vector map (Item 15 Part A).
//
// The route is a SINGLE LineString with TWO layers:
//   - Core line (bottom): ALWAYS solid brand-blue (#209dd7), width 4
//   - Casing/outline (top): White when no traffic; traffic-status bands when
//     flow samples exist, width 7. Color driven by 'line-progress' interpolation
//     from real per-sample Flow Segment Data.
// Direction chevrons removed — the solid core + traffic outline is the visual
// identity. Traffic flow raster stays at FULL OPACITY underneath.
export const ROUTE_SOURCE_ID = 'evac-route';
export const ROUTE_CASING_LAYER_ID = 'evac-route-casing';
export const ROUTE_LINE_LAYER_ID = 'evac-route-line';

/** Build the casing color stop array that drives the line-gradient
 * expression along the route's normalized length (0..1). */
function buildCasingStops(samples: FlowSample[], pathLength: number): { value: number; color: string }[] {
  if (samples.length === 0 || pathLength < 2) return [{ value: 0, color: ROUTE_CASING_COLOR }];
  const ordered = [...samples]
    .filter((s) => Number.isInteger(s.pathIndex) && s.pathIndex >= 0 && s.pathIndex < pathLength)
    .sort((a, b) => a.pathIndex - b.pathIndex);
  if (ordered.length === 0) return [{ value: 0, color: ROUTE_CASING_COLOR }];
  return ordered.map((sample) => ({
    value: sample.pathIndex / (pathLength - 1),
    color: flowStatusColor(sample.currentSpeed),
  }));
}

export function setRouteVisible(
  map: MapLibreMap,
  route: EvacRoute | null,
  samples: FlowSample[] = [],
): void {
  removeRouteLayers(map);
  if (!route || route.path.length === 0) return;
  const coordinates = route.path.map((point) => [point.lon, point.lat]);
  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} },
    lineMetrics: true,
  });

  // Core line (bottom): ALWAYS solid brand-blue
  map.addLayer({
    id: ROUTE_LINE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: {
      'line-color': ROUTE_LINE_COLOR,
      'line-width': ROUTE_LINE_WIDTH,
    },
  });

  // Casing/outline (top): White when no traffic; traffic-status bands when samples exist
  const casingStops = buildCasingStops(samples, route.path.length);
  map.addLayer({
    id: ROUTE_CASING_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: {
      'line-color': samples.length > 0
        ? [
            'interpolate',
            ['linear'],
            ['line-progress'],
            ...casingStops.flatMap((stop) => [stop.value, stop.color]),
          ]
        : ROUTE_CASING_COLOR,
      'line-width': ROUTE_CASING_WIDTH,
    },
  });
}

export function removeRouteLayers(map: MapLibreMap): void {
  if (map.getLayer(ROUTE_LINE_LAYER_ID)) {
    map.removeLayer(ROUTE_LINE_LAYER_ID);
  }
  if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.removeLayer(ROUTE_CASING_LAYER_ID);
  }
  if (map.getSource(ROUTE_SOURCE_ID)) {
    map.removeSource(ROUTE_SOURCE_ID);
  }
}