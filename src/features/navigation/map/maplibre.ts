import type { Map as MapLibreMap } from 'maplibre-gl';
import { circlePolygon } from '../avoidZone';
import type { EvacCircle } from '../store';
import type { EvacRoute } from '../store';
import type { FlowSample } from '../../traffic';
import {
  ROUTE_CASING_WIDTH,
  ROUTE_LINE_WIDTH,
  ROUTE_LINE_COLOR,
  ROUTE_CASING_COLOR,
} from '../../map/routeStyle';
import { flowStatusColor } from '../../traffic';

// Standalone avoid-zone overlay for the Vector map: hatched red fill plus
// outline, rendered whenever an avoid circle exists, with or without a
// route. The hatch marks the area as excluded rather than selected.
export const AVOID_SOURCE_ID = 'evac-avoid';
export const AVOID_FILL_LAYER_ID = 'evac-avoid-fill';
export const AVOID_LINE_LAYER_ID = 'evac-avoid-line';
const AVOID_HATCH_IMAGE_ID = 'evac-hatch';

function ensureHatchImage(map: MapLibreMap): void {
  if (map.hasImage(AVOID_HATCH_IMAGE_ID)) return;
  const size = 12;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.strokeStyle = 'rgba(230, 57, 70, 0.9)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-2, size + 2);
  context.lineTo(size + 2, -2);
  context.moveTo(-2, 2);
  context.lineTo(2, -2);
  context.moveTo(size - 2, size + 2);
  context.lineTo(size + 2, size - 2);
  context.stroke();
  map.addImage(AVOID_HATCH_IMAGE_ID, context.getImageData(0, 0, size, size));
}

export function setAvoidVisible(map: MapLibreMap, circle: EvacCircle | null): void {
  removeAvoidLayers(map);
  if (!circle) return;
  ensureHatchImage(map);
  if (!map.hasImage(AVOID_HATCH_IMAGE_ID)) return;
  map.addSource(AVOID_SOURCE_ID, {
    type: 'geojson',
    data: circlePolygon(circle),
  });
  map.addLayer({
    id: AVOID_FILL_LAYER_ID,
    type: 'fill',
    source: AVOID_SOURCE_ID,
    paint: {
      'fill-pattern': AVOID_HATCH_IMAGE_ID,
      'fill-opacity': 0.55,
    },
  });
  map.addLayer({
    id: AVOID_LINE_LAYER_ID,
    type: 'line',
    source: AVOID_SOURCE_ID,
    paint: {
      'line-color': '#E63946',
      'line-width': 2,
      'line-dasharray': [3, 2],
    },
  });
}

export const AVOID_PREVIEW_SOURCE_ID = 'evac-avoid-preview';
export const AVOID_PREVIEW_LAYER_ID = 'evac-avoid-preview-layer';

/** Ephemeral drag preview: dashed outline, no hatch (the hatch marks final zones). */
export function setAvoidPreview(map: MapLibreMap, circle: EvacCircle | null): void {
  if (map.getLayer(AVOID_PREVIEW_LAYER_ID)) {
    map.removeLayer(AVOID_PREVIEW_LAYER_ID);
  }
  if (map.getSource(AVOID_PREVIEW_SOURCE_ID)) {
    map.removeSource(AVOID_PREVIEW_SOURCE_ID);
  }
  if (!circle) return;
  map.addSource(AVOID_PREVIEW_SOURCE_ID, {
    type: 'geojson',
    data: circlePolygon(circle),
  });
  map.addLayer({
    id: AVOID_PREVIEW_LAYER_ID,
    type: 'line',
    source: AVOID_PREVIEW_SOURCE_ID,
    paint: {
      'line-color': '#E63946',
      'line-width': 2,
      'line-dasharray': [2, 2],
    },
  });
}

export function removeAvoidLayers(map: MapLibreMap): void {
  setAvoidPreview(map, null);
  if (map.getLayer(AVOID_LINE_LAYER_ID)) {
    map.removeLayer(AVOID_LINE_LAYER_ID);
  }
  if (map.getLayer(AVOID_FILL_LAYER_ID)) {
    map.removeLayer(AVOID_FILL_LAYER_ID);
  }
  if (map.getSource(AVOID_SOURCE_ID)) {
    map.removeSource(AVOID_SOURCE_ID);
  }
}

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
