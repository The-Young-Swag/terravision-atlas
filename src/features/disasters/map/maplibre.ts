import type { Map as MapLibreMap } from 'maplibre-gl';
import { GeoJSONSource } from 'maplibre-gl';
import type { DisasterEvent } from '../../../shared/types';
import { DISASTER_SEVERITY_COLORS } from '../../map/disasterStyle';

// Live disaster pins for the Vector (MapLibre) map — the 2D map already
// renders these via the OpenLayers hazard layer, so Vector needs its own
// here. Colors carry the same severity meaning as the 2D pins
// (high red / medium amber / low teal); radius grows slightly for high.
export const DISASTER_SOURCE_ID = 'live-disasters';
export const DISASTER_LAYER_ID = 'live-disasters-layer';

function disastersToGeoJson(events: DisasterEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [event.longitude, event.latitude] },
      properties: { disasterId: event.id, severity: event.severity },
    })),
  };
}

export function setDisastersVisible(map: MapLibreMap, events: DisasterEvent[], visible: boolean): void {
  const source = map.getSource(DISASTER_SOURCE_ID);
  if (!visible) {
    if (map.getLayer(DISASTER_LAYER_ID)) map.removeLayer(DISASTER_LAYER_ID);
    if (source) map.removeSource(DISASTER_SOURCE_ID);
    return;
  }
  if (source instanceof GeoJSONSource) {
    source.setData(disastersToGeoJson(events));
  } else if (!source) {
    map.addSource(DISASTER_SOURCE_ID, { type: 'geojson', data: disastersToGeoJson(events) });
  }
  if (!map.getLayer(DISASTER_LAYER_ID)) {
    const high = DISASTER_SEVERITY_COLORS.high;
    const medium = DISASTER_SEVERITY_COLORS.medium;
    const low = DISASTER_SEVERITY_COLORS.low;
    map.addLayer({
      id: DISASTER_LAYER_ID,
      type: 'circle',
      source: DISASTER_SOURCE_ID,
      paint: {
        'circle-radius': ['match', ['get', 'severity'], 'high', 7, 'medium', 6, 5],
        'circle-color': ['match', ['get', 'severity'], 'high', high, 'medium', medium, low],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }
}
