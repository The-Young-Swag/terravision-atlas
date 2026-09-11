import type { Map as MapLibreMap } from 'maplibre-gl';
import { useSurveyStore, MEASURE_CLOSE_TOLERANCE_PX } from '../store';
import { useMapStore } from '../../../features/map';
import { niceMeterStep, snapToUtmGrid } from '../geodetic/grid/snap';

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

// Geodesic measure tool: picks points while armed, with vertex dragging.
// Extracted verbatim from the Vector view's map-creation effect — click,
// mousedown/mousemove/mouseup handlers and snap logic are unchanged
// (including the anonymous map.on handlers, which the original never
// unregistered); store reads target the survey store, which now owns
// measure state.
export function attachMeasureInteraction(map: MapLibreMap): void {
  let dragState: { index: number; startPoint: { x: number; y: number } } | null = null;
  let dragSuppress = false;

  // Picks points while armed. With snap-to-grid armed, vertices land on
  // the same UTM grid as the reported center.
  map.on('click', (event) => {
    if (dragSuppress) {
      dragSuppress = false;
      return;
    }
    const state = useSurveyStore.getState();
    if (!state.measureActive) return;
    const z = map.getZoom();
    const center = map.getCenter();
    const resolution = (156543.03392804097 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** z;
    const snapped = useMapStore.getState().snapToGrid
      ? snapToUtmGrid(event.lngLat.lng, event.lngLat.lat, niceMeterStep(resolution))
      : { lon: event.lngLat.lng, lat: event.lngLat.lat };
    const first = state.measureMode === 'area' && !state.measureClosed ? state.measurePoints[0] : undefined;
    if (first && state.measurePoints.length >= 3) {
      const firstPx = map.project([first[0], first[1]]);
      const dx = event.point.x - firstPx.x;
      const dy = event.point.y - firstPx.y;
      if (Math.hypot(dx, dy) <= MEASURE_CLOSE_TOLERANCE_PX) {
        state.setMeasureClosed(true);
        return;
      }
    }
    state.pushMeasurePoint([snapped.lon, snapped.lat]);
  });

  // Measure vertex dragging: press-drag-release on a vertex repositions it
  // with live recalculation in the dock; a plain click still appends.
  // Panning is suspended mid-drag so the gesture moves the vertex instead.
  map.on('mousedown', (event) => {
    const state = useSurveyStore.getState();
    if (!state.measureActive || event.originalEvent.button !== 0) return;
    const hits = map.queryRenderedFeatures(event.point, { layers: [MEASURE_POINT_LAYER_ID] });
    const index = (hits[0]?.properties as { vertexIndex?: unknown } | undefined)?.vertexIndex;
    if (typeof index !== 'number') return;
    dragState = { index, startPoint: { x: event.point.x, y: event.point.y } };
    map.dragPan.disable();
  });
  map.on('mousemove', (event) => {
    if (!dragState) return;
    const state = useSurveyStore.getState();
    const z = map.getZoom();
    const center = map.getCenter();
    const resolution = (156543.03392804097 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** z;
    const snapped = useMapStore.getState().snapToGrid
      ? snapToUtmGrid(event.lngLat.lng, event.lngLat.lat, niceMeterStep(resolution))
      : { lon: event.lngLat.lng, lat: event.lngLat.lat };
    state.setMeasurePoint(dragState.index, [snapped.lon, snapped.lat]);
  });
  const endMeasureDrag = (dragged: boolean) => {
    if (!dragState) return;
    dragState = null;
    if (dragged) dragSuppress = true;
    map.dragPan.enable();
  };
  map.on('mouseup', (event) => {
    if (!dragState) return;
    const dx = event.point.x - dragState.startPoint.x;
    const dy = event.point.y - dragState.startPoint.y;
    endMeasureDrag(Math.hypot(dx, dy) > 4);
  });
}
