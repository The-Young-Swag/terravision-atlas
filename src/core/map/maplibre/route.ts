import type { Map as MapLibreMap } from 'maplibre-gl';
import type { EvacRoute } from '../../../stores/routeStore';

// Evacuation route line for the Vector map: white casing with a verdict
// colored line on top (green = avoids the area, amber = enters it),
// mirroring the 2D overlay. Added after the avoid hatch layer (see the
// MapLibreMap effect ordering) so the route draws above it.
export const ROUTE_SOURCE_ID = 'evac-route';
export const ROUTE_CASING_LAYER_ID = 'evac-route-casing';
export const ROUTE_LINE_LAYER_ID = 'evac-route-line';

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
    paint: { 'line-color': '#ffffff', 'line-width': 7 },
  });
  map.addLayer({
    id: ROUTE_LINE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: { 'line-color': route.avoidsArea ? '#00d890' : '#FF9F1C', 'line-width': 4 },
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
