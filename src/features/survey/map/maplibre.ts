import type { Map as MapLibreMap } from 'maplibre-gl';

// Geodesic measurement overlay for the Vector map: path line plus vertex
// dots for the picked points, or a filled polygon once an area measurement
// is closed. Distances are computed with turf (shared with the 2D view)
// and shown in the survey dock, not on the map — MapLibre has no
// text halo styling as cheap as OpenLayers' midpoint label.
export const MEASURE_SOURCE_ID = 'survey-measure';
export const MEASURE_LINE_LAYER_ID = 'survey-measure-line';
export const MEASURE_POINT_LAYER_ID = 'survey-measure-points';
export const MEASURE_FILL_LAYER_ID = 'survey-measure-fill';

export function setMeasureVisible(map: MapLibreMap, points: [number, number][], closed = false): void {
  removeMeasureLayers(map);
  if (points.length === 0) return;
  const ring: [number, number][] = [...points, points[0]];
  const features: GeoJSON.Feature[] = [
    ...(points.length >= 2
      ? [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: closed && points.length >= 3 ? ring : points,
            },
            properties: {},
          } as GeoJSON.Feature,
        ]
      : []),
    ...(closed && points.length >= 3
      ? [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: {},
          } as GeoJSON.Feature,
        ]
      : []),
    ...points.map(
      ([lon, lat], index): GeoJSON.Feature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { vertexIndex: index },
      }),
    ),
  ];
  map.addSource(MEASURE_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });
  if (closed && points.length >= 3) {
    map.addLayer({
      id: MEASURE_FILL_LAYER_ID,
      type: 'fill',
      source: MEASURE_SOURCE_ID,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'fill-color': '#5500a4', 'fill-opacity': 0.15 },
    });
  }
  if (points.length >= 2) {
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
  if (map.getLayer(MEASURE_FILL_LAYER_ID)) {
    map.removeLayer(MEASURE_FILL_LAYER_ID);
  }
  if (map.getLayer(MEASURE_POINT_LAYER_ID)) {
    map.removeLayer(MEASURE_POINT_LAYER_ID);
  }
  if (map.getSource(MEASURE_SOURCE_ID)) {
    map.removeSource(MEASURE_SOURCE_ID);
  }
}
