import type { Map as MapLibreMap } from 'maplibre-gl';
import { GeoJSONSource } from 'maplibre-gl';

// Weather location pin for the Vector (MapLibre) map: brand-purple disc,
// visually distinct from disaster (severity), incident (amber), and route
// (blue) symbology. A circle layer — not a Marker element — so it follows
// the same lifecycle and click handling as the disaster pins.
export const WEATHER_SOURCE_ID = 'weather-location';
export const WEATHER_LAYER_ID = 'weather-location-layer';

export function setWeatherVisible(map: MapLibreMap, lon: number | null, lat: number | null): void {
  const source = map.getSource(WEATHER_SOURCE_ID);
  if (lon === null || lat === null) {
    if (map.getLayer(WEATHER_LAYER_ID)) map.removeLayer(WEATHER_LAYER_ID);
    if (source) map.removeSource(WEATHER_SOURCE_ID);
    return;
  }
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {},
      },
    ],
  };
  if (source instanceof GeoJSONSource) {
    source.setData(data);
  } else if (!source) {
    map.addSource(WEATHER_SOURCE_ID, { type: 'geojson', data });
  }
  if (!map.getLayer(WEATHER_LAYER_ID)) {
    map.addLayer({
      id: WEATHER_LAYER_ID,
      type: 'circle',
      source: WEATHER_SOURCE_ID,
      paint: {
        'circle-radius': 7,
        'circle-color': '#5500a4',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }
}
