import type { Map as MapLibreMap } from 'maplibre-gl';
import { flowTileUrl } from '../../../features/traffic/tomtom';

// TomTom traffic flow raster overlay for the Vector (MapLibre) map.
// Same tiles as the 2D overlay; MapLibre caches them per session.
export const TRAFFIC_SOURCE_ID = 'tomtom-traffic-flow';
export const TRAFFIC_LAYER_ID = 'tomtom-traffic-flow-layer';

export function addTrafficLayers(map: MapLibreMap, apiKey: string): void {
  if (!map.getSource(TRAFFIC_SOURCE_ID)) {
    map.addSource(TRAFFIC_SOURCE_ID, {
      type: 'raster',
      tiles: [flowTileUrl(apiKey)],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© TomTom',
    });
  }
  if (!map.getLayer(TRAFFIC_LAYER_ID)) {
    map.addLayer({
      id: TRAFFIC_LAYER_ID,
      type: 'raster',
      source: TRAFFIC_SOURCE_ID,
      paint: { 'raster-opacity': 0.85 },
    });
  }
}

export function removeTrafficLayers(map: MapLibreMap): void {
  if (map.getLayer(TRAFFIC_LAYER_ID)) {
    map.removeLayer(TRAFFIC_LAYER_ID);
  }
  if (map.getSource(TRAFFIC_SOURCE_ID)) {
    map.removeSource(TRAFFIC_SOURCE_ID);
  }
}

export function setTrafficVisible(map: MapLibreMap, visible: boolean, apiKey: string | null): void {
  if (visible && apiKey) {
    addTrafficLayers(map, apiKey);
  } else {
    removeTrafficLayers(map);
  }
}
