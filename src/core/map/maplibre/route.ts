import type { Map as MapLibreMap } from 'maplibre-gl';
import type { EvacRoute } from '../../../stores/routeStore';
import type { FlowSample } from '../../../features/traffic/flowEta';
import {
  ROUTE_CASING_WIDTH,
  ROUTE_LINE_WIDTH,
} from '../routeStyle';
import { flowStatusColor } from '../../../features/traffic/flowStatus';

// Evacuation route line for the Vector map (Item 15 Part A).
//
// The route is a SINGLE LineString (not multiple per-segment features) so
// the casing and line layers render as one continuous stroke with smooth
// color transitions along its length. Color is driven by a
// 'line-progress' expression (0..1) mapped through 'interpolate' stops
// derived from real per-sample Flow Segment Data — confirmed against
// MapLibre's documented line-gradient support for the line-color paint.
//
// With no usable flow samples the line falls back to a single
// brand-blue color and the casing to a single static color, exactly as
// before. The traffic-aware ETA (which uses the same samples) stays
// independent and keeps working — we only changed how the line is
// drawn, not the data or the routing request.
export const ROUTE_SOURCE_ID = 'evac-route';
export const ROUTE_CASING_LAYER_ID = 'evac-route-casing';
export const ROUTE_LINE_LAYER_ID = 'evac-route-line';
export const ROUTE_DIRECTION_LAYER_ID = 'evac-route-direction';
const ROUTE_CHEVRON_IMAGE_ID = 'evac-route-chevron';

const FALLBACK_LINE_COLOR = '#209dd7';
const FALLBACK_CASING_COLOR = '#0b3d55';

/** Test-only export of the fallback line color so the test can assert the
 * no-flows case without depending on the production routeStyle token. */
export const FALLBACK_LINE_COLOR_FOR_TEST = FALLBACK_LINE_COLOR;

/** Build the casing + line color stop arrays that drive the line-gradient
 * expression along the route's normalized length (0..1). */
function buildColorStops(samples: FlowSample[], pathLength: number, fallback: string): { value: number; color: string }[] {
  if (samples.length === 0 || pathLength < 2) return [{ value: 0, color: fallback }];
  const ordered = [...samples]
    .filter((s) => Number.isInteger(s.pathIndex) && s.pathIndex >= 0 && s.pathIndex < pathLength)
    .sort((a, b) => a.pathIndex - b.pathIndex);
  if (ordered.length === 0) return [{ value: 0, color: fallback }];
  return ordered.map((sample) => ({
    value: sample.pathIndex / (pathLength - 1),
    color: flowStatusColor(sample.currentSpeed),
  }));
}

function ensureChevronImage(map: MapLibreMap): void {
  // Guarded for unit-test doubles, which only stub source/layer methods,
  // and for non-DOM environments (vitest runs in node without jsdom).
  if (typeof document === 'undefined') return;
  if (typeof map.hasImage !== 'function' || typeof map.addImage !== 'function') return;
  if (map.hasImage(ROUTE_CHEVRON_IMAGE_ID)) return;
  const size = 28;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  // Dark halo first, then the white chevron on top.
  context.strokeStyle = '#0b3d55';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(8, 5);
  context.lineTo(20, 14);
  context.lineTo(8, 23);
  context.stroke();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 3.5;
  context.beginPath();
  context.moveTo(8, 5);
  context.lineTo(20, 14);
  context.lineTo(8, 23);
  context.stroke();
  map.addImage(ROUTE_CHEVRON_IMAGE_ID, context.getImageData(0, 0, size, size));
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
  });

  // One continuous casing layer under one continuous line layer; both use
  // 'line-progress' interpolation so the color transitions are inherent
  // to the geometry, not a series of adjacent segments.
  const lineStops = buildColorStops(samples, route.path.length, FALLBACK_LINE_COLOR);
  const casingStops = buildColorStops(samples, route.path.length, FALLBACK_CASING_COLOR);

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
        : FALLBACK_CASING_COLOR,
      'line-width': ROUTE_CASING_WIDTH,
    },
  });
  map.addLayer({
    id: ROUTE_LINE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: {
      'line-color': samples.length > 0
        ? [
            'interpolate',
            ['linear'],
            ['line-progress'],
            ...lineStops.flatMap((stop) => [stop.value, stop.color]),
          ]
        : FALLBACK_LINE_COLOR,
      'line-width': ROUTE_LINE_WIDTH,
    },
  });
  ensureChevronImage(map);
  if (typeof map.hasImage === 'function' && map.hasImage(ROUTE_CHEVRON_IMAGE_ID)) {
    map.addLayer({
      id: ROUTE_DIRECTION_LAYER_ID,
      type: 'symbol',
      source: ROUTE_SOURCE_ID,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 90,
        'icon-image': ROUTE_CHEVRON_IMAGE_ID,
        'icon-size': 0.85,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
    });
  }
}

export function removeRouteLayers(map: MapLibreMap): void {
  if (map.getLayer(ROUTE_DIRECTION_LAYER_ID)) {
    map.removeLayer(ROUTE_DIRECTION_LAYER_ID);
  }
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
