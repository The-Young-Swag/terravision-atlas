import type { Map as MapLibreMap } from 'maplibre-gl';

// Waymarked Trails hiking overlay for the Vector (MapLibre) map: named
// hiking routes from live OSM data as transparent raster tiles over any
// basemap (free, keyless). Blank where OSM has no mapped routes. Max zoom
// 17 per the provider's documented range.
export const TRAILS_SOURCE_ID = 'hiking-trails';
export const TRAILS_LAYER_ID = 'hiking-trails-layer';

const TRAILS_TILES = ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'];
const TRAILS_ATTRIBUTION = 'Hiking routes © waymarkedtrails.org (CC-BY-SA) · © OpenStreetMap contributors';

export function setTrailsVisible(map: MapLibreMap, visible: boolean): void {
  const source = map.getSource(TRAILS_SOURCE_ID);
  if (visible) {
    if (!source) {
      map.addSource(TRAILS_SOURCE_ID, {
        type: 'raster',
        tiles: TRAILS_TILES,
        tileSize: 256,
        maxzoom: 17,
        attribution: TRAILS_ATTRIBUTION,
      });
      map.addLayer({
        id: TRAILS_LAYER_ID,
        type: 'raster',
        source: TRAILS_SOURCE_ID,
        paint: { 'raster-opacity': 0.9 },
      });
    } else if (!map.getLayer(TRAILS_LAYER_ID)) {
      map.addLayer({
        id: TRAILS_LAYER_ID,
        type: 'raster',
        source: TRAILS_SOURCE_ID,
        paint: { 'raster-opacity': 0.9 },
      });
    }
    return;
  }
  if (map.getLayer(TRAILS_LAYER_ID)) map.removeLayer(TRAILS_LAYER_ID);
  if (map.getSource(TRAILS_SOURCE_ID)) map.removeSource(TRAILS_SOURCE_ID);
}
