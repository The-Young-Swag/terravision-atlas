import type { Map as MapLibreMap } from 'maplibre-gl';
import type { EvacRoute } from '../../../stores/routeStore';
import { ROUTE_CASING_WIDTH, ROUTE_LINE_COLOR, ROUTE_LINE_WIDTH } from '../routeStyle';

// Evacuation route line for the Vector map: white casing with a unified
// brand-blue line on top (a hue outside the TomTom traffic-speed palette),
// mirroring the 2D overlay. Verdict semantics live in the panel chip, not
// the line color. Direction chevrons use a canvas-drawn image (no glyph
// server is configured, so text symbols would not render) placed along the
// line, rotating with it.
export const ROUTE_SOURCE_ID = 'evac-route';
export const ROUTE_CASING_LAYER_ID = 'evac-route-casing';
export const ROUTE_LINE_LAYER_ID = 'evac-route-line';
export const ROUTE_DIRECTION_LAYER_ID = 'evac-route-direction';
const ROUTE_CHEVRON_IMAGE_ID = 'evac-route-chevron';

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

export function setRouteVisible(map: MapLibreMap, route: EvacRoute | null): void {
  removeRouteLayers(map);
  if (!route || route.path.length === 0) return;
  const coordinates = route.path.map((point) => [point.lon, point.lat]);
  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }],
    },
  });
  map.addLayer({
    id: ROUTE_CASING_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: { 'line-color': '#ffffff', 'line-width': ROUTE_CASING_WIDTH },
  });
  map.addLayer({
    id: ROUTE_LINE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: { 'line-color': ROUTE_LINE_COLOR, 'line-width': ROUTE_LINE_WIDTH },
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
