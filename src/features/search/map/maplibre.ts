import type { Map as MapLibreMap } from 'maplibre-gl';
import type { SearchMarker } from '../store';

export const SEARCH_SOURCE_ID = 'place-search-marker';
export const SEARCH_LAYER_ID = 'place-search-marker-layer';

export function setSearchMarkerVisible(map: MapLibreMap, marker: SearchMarker | null): void {
  if (map.getLayer(SEARCH_LAYER_ID)) {
    map.removeLayer(SEARCH_LAYER_ID);
  }
  if (map.getSource(SEARCH_SOURCE_ID)) {
    map.removeSource(SEARCH_SOURCE_ID);
  }
  if (!marker) return;
  map.addSource(SEARCH_SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [marker.lon, marker.lat] },
          properties: {},
        },
      ],
    },
  });
  map.addLayer({
    id: SEARCH_LAYER_ID,
    type: 'circle',
    source: SEARCH_SOURCE_ID,
    paint: {
      'circle-radius': 7,
      'circle-color': '#5500a4',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
}
