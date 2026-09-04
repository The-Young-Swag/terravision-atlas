import type { Map as MapLibreMap } from 'maplibre-gl';

// Geodesic measurement overlay for the Vector map: line plus endpoint dots
// for the picked points. Distances are computed with turf (shared with the
// 2D view) and shown in the survey dock, not on the map — MapLibre has no
// text halo styling as cheap as OpenLayers' midpoint label.
export const MEASURE_SOURCE_ID = 'survey-measure';
export const MEASURE_LINE_LAYER_ID = 'survey-measure-line';
export const MEASURE_POINT_LAYER_ID = 'survey-measure-points';

export function setMeasureVisible(map: MapLibreMap, points: [number, number][]): void {
  removeMeasureLayers(map);
  if (points.length === 0) return;
  const features: GeoJSON.Feature[] = [
    ...(points.length === 2
      ? [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: points },
            properties: {},
          } as GeoJSON.Feature,
        ]
      : []),
    ...points.map(
      ([lon, lat]): GeoJSON.Feature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {},
      }),
    ),
  ];
  map.addSource(MEASURE_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });
  if (points.length === 2) {
    map.addLayer({
      id: MEASURE_LINE_LAYER_ID,
      type: 'line',
      source: MEASURE_SOURCE_ID,
      filter: ['==', '$type', 'LineString'],
      paint: { 'line-color': '#5500a4', 'line-width': 3 },
    });
  }
  map.addLayer({
    id: MEASURE_POINT_LAYER_ID,
    type: 'circle',
    source: MEASURE_SOURCE_ID,
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': '#5500a4',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
}

export function removeMeasureLayers(map: MapLibreMap): void {
  if (map.getLayer(MEASURE_LINE_LAYER_ID)) {
    map.removeLayer(MEASURE_LINE_LAYER_ID);
  }
  if (map.getLayer(MEASURE_POINT_LAYER_ID)) {
    map.removeLayer(MEASURE_POINT_LAYER_ID);
  }
  if (map.getSource(MEASURE_SOURCE_ID)) {
    map.removeSource(MEASURE_SOURCE_ID);
  }
}
