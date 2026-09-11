import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import type Map from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import DragPan from 'ol/interaction/DragPan';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle, Text } from 'ol/style';
import { useSurveyStore, MEASURE_CLOSE_TOLERANCE_PX } from '../store';
import { useMapStore } from '../../../features/map';
import { niceMeterStep, snapToUtmGrid } from '../geodetic/grid/snap';

// Geodesic measurement overlay: path line through all picked points with
// vertex markers and a running-total distance label, or a filled polygon
// once an area measurement is closed. Values come from turf computed by the
// caller so both map views report identical numbers.
export function createMeasureLayer(
  points: [number, number][],
  distanceText: string,
  closed = false,
): VectorLayer<VectorSource> {
  const features: Feature[] = [];

  if (closed && points.length >= 3) {
    const ring = [...points.map(([lon, lat]) => fromLonLat([lon, lat])), fromLonLat(points[0])];
    const polygon = new Feature({ geometry: new Polygon([ring]) });
    polygon.setStyle(
      new Style({
        stroke: new Stroke({ color: '#5500a4', width: 3 }),
        fill: new Fill({ color: 'rgba(85, 0, 164, 0.15)' }),
        text: new Text({
          text: distanceText,
          font: '11px monospace',
          fill: new Fill({ color: '#ffffff' }),
          backgroundFill: new Fill({ color: 'rgba(13, 27, 42, 0.85)' }),
          padding: [3, 6, 3, 6],
          overflow: true,
        }),
      }),
    );
    features.push(polygon);
  } else if (points.length >= 2) {
    const line = new Feature({
      geometry: new LineString(points.map(([lon, lat]) => fromLonLat([lon, lat]))),
    });
    line.setStyle(
      new Style({
        stroke: new Stroke({ color: '#5500a4', width: 3 }),
        text: new Text({
          text: distanceText,
          font: '11px monospace',
          fill: new Fill({ color: '#ffffff' }),
          backgroundFill: new Fill({ color: 'rgba(13, 27, 42, 0.85)' }),
          padding: [3, 6, 3, 6],
          overflow: true,
        }),
      }),
    );
    features.push(line);
  }

  for (const [index, [lon, lat]] of points.entries()) {
    const marker = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
    marker.set('vertexIndex', index);
    marker.setStyle(
      new Style({
        image: new Circle({
          radius: 5,
          fill: new Fill({ color: '#5500a4' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      }),
    );
    features.push(marker);
  }

  return new VectorLayer({
    source: new VectorSource({ features }),
    properties: { layerId: 'measure' },
  });
}

// Geodesic measure tool: picks points while armed, with vertex dragging.
// Extracted verbatim from the 2D view's map-creation effect — click
// handler, raw-viewport pointer handlers (OpenLayers has no
// pointerdown/pointerup map events), and snap logic are unchanged; store
// reads target the survey store, which now owns measure state.
export function attachMeasureInteraction(map: Map): () => void {
  let dragState: { index: number; startPixel: [number, number] } | null = null;
  let dragSuppress = false;

  // Picks points while armed. With snap-to-grid armed, vertices land on
  // the same UTM grid as the reported center.
  map.on('click', (event: MapBrowserEvent) => {
    if (dragSuppress) {
      dragSuppress = false;
      return;
    }
    const state = useSurveyStore.getState();
    if (!state.measureActive) return;
    const [lon, lat] = toLonLat(event.coordinate);
    const resolution = map.getView().getResolution() ?? 0;
    const snapped =
      useMapStore.getState().snapToGrid && resolution > 0
        ? snapToUtmGrid(lon, lat, niceMeterStep(resolution))
        : { lon, lat };
    const first = state.measureMode === 'area' && !state.measureClosed ? state.measurePoints[0] : undefined;
    if (first && state.measurePoints.length >= 3) {
      const firstPx = map.getPixelFromCoordinate(fromLonLat(first));
      const dx = event.pixel[0] - firstPx[0];
      const dy = event.pixel[1] - firstPx[1];
      if (Math.hypot(dx, dy) <= MEASURE_CLOSE_TOLERANCE_PX) {
        state.setMeasureClosed(true);
        return;
      }
    }
    state.pushMeasurePoint([snapped.lon, snapped.lat]);
  });

  // Measure vertex dragging: press-drag-release on a vertex repositions it
  // with live recalculation in the dock; a plain click still appends.
  // Raw viewport pointer events (not map.on) — OpenLayers has no
  // pointerdown/pointerup map events, only pointermove/pointerdrag.
  const measureViewport = map.getViewport();
  const viewportPixel = (event: PointerEvent): [number, number] => {
    const rect = measureViewport.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const onMeasurePointerDown = (event: PointerEvent) => {
    const state = useSurveyStore.getState();
    if (!state.measureActive || event.button !== 0) return;
    const pixel = viewportPixel(event);
    const feature = map.forEachFeatureAtPixel(pixel, (found) => found, {
      layerFilter: (layer) => layer.get('layerId') === 'measure',
    });
    const index = feature?.get('vertexIndex');
    if (typeof index !== 'number') return;
    dragState = { index, startPixel: pixel };
    const pan = map
      .getInteractions()
      .getArray()
      .find((interaction): interaction is DragPan => interaction instanceof DragPan);
    if (pan) pan.setActive(false);
  };
  const onMeasurePointerMove = (event: PointerEvent) => {
    if (!dragState || event.buttons === 0) return;
    const state = useSurveyStore.getState();
    const coordinate = map.getCoordinateFromPixel(viewportPixel(event));
    if (!coordinate) return;
    const [lon, lat] = toLonLat(coordinate);
    const resolution = map.getView().getResolution() ?? 0;
    const snapped =
      useMapStore.getState().snapToGrid && resolution > 0
        ? snapToUtmGrid(lon, lat, niceMeterStep(resolution))
        : { lon, lat };
    state.setMeasurePoint(dragState.index, [snapped.lon, snapped.lat]);
  };
  const onMeasurePointerUp = (event: PointerEvent) => {
    if (!dragState) return;
    const pixel = viewportPixel(event);
    const dx = pixel[0] - dragState.startPixel[0];
    const dy = pixel[1] - dragState.startPixel[1];
    dragState = null;
    if (Math.hypot(dx, dy) > 4) dragSuppress = true;
    const pan = map
      .getInteractions()
      .getArray()
      .find((interaction): interaction is DragPan => interaction instanceof DragPan);
    if (pan) pan.setActive(true);
  };
  measureViewport.addEventListener('pointerdown', onMeasurePointerDown);
  measureViewport.addEventListener('pointermove', onMeasurePointerMove);
  measureViewport.addEventListener('pointerup', onMeasurePointerUp);

  return () => {
    measureViewport.removeEventListener('pointerdown', onMeasurePointerDown);
    measureViewport.removeEventListener('pointermove', onMeasurePointerMove);
    measureViewport.removeEventListener('pointerup', onMeasurePointerUp);
  };
}
