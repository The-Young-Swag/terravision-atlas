import type { Map as MapLibreMap } from 'maplibre-gl';
import { GeoJSONSource } from 'maplibre-gl';
import { flowTileUrl, type TrafficIncident } from '../tomtom';
import { TRAFFIC_FLOW_OPACITY_ML } from '../../../features/map/routeStyle';

// TomTom traffic flow raster overlay for the Vector (MapLibre) map.
// Same tiles as the 2D overlay; MapLibre caches them per session.
export const TRAFFIC_SOURCE_ID = 'tomtom-traffic-flow';
export const TRAFFIC_LAYER_ID = 'tomtom-traffic-flow-layer';
export const TRAFFIC_INCIDENT_SOURCE_ID = 'tomtom-traffic-incidents';
export const TRAFFIC_INCIDENT_LAYER_ID = 'tomtom-traffic-incidents-layer';

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
      paint: { 'raster-opacity': TRAFFIC_FLOW_OPACITY_ML },
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
  removeIncidentLayers(map);
}

export function addIncidentLayers(map: MapLibreMap, incidents: TrafficIncident[]): void {
  const source = map.getSource(TRAFFIC_INCIDENT_SOURCE_ID);
  if (source instanceof GeoJSONSource) {
    source.setData(incidentsToGeoJson(incidents));
  } else if (!source) {
    map.addSource(TRAFFIC_INCIDENT_SOURCE_ID, {
      type: 'geojson',
      data: incidentsToGeoJson(incidents),
    });
  }
  if (!map.getLayer(TRAFFIC_INCIDENT_LAYER_ID)) {
    map.addLayer({
      id: TRAFFIC_INCIDENT_LAYER_ID,
      type: 'circle',
      source: TRAFFIC_INCIDENT_SOURCE_ID,
      paint: {
        'circle-radius': 6,
        'circle-color': '#FF9F1C',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }
}

export function removeIncidentLayers(map: MapLibreMap): void {
  if (map.getLayer(TRAFFIC_INCIDENT_LAYER_ID)) {
    map.removeLayer(TRAFFIC_INCIDENT_LAYER_ID);
  }
  if (map.getSource(TRAFFIC_INCIDENT_SOURCE_ID)) {
    map.removeSource(TRAFFIC_INCIDENT_SOURCE_ID);
  }
}

function incidentsToGeoJson(incidents: TrafficIncident[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: incidents.map((incident) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [incident.lon, incident.lat] },
      properties: { incidentId: incident.id },
    })),
  };
}

export function setTrafficVisible(map: MapLibreMap, visible: boolean, apiKey: string | null): void {
  if (visible && apiKey) {
    addTrafficLayers(map, apiKey);
  } else {
    removeTrafficLayers(map);
  }
}
