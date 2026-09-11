import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import type Map from 'ol/Map';
import DragPan from 'ol/interaction/DragPan';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import { useRouteStore } from '../store';
import type { EvacRoute, EvacRoutePoint, EvacCircle } from '../store';
import { circleToRing, previewCircle, MIN_AVOID_RADIUS_KM } from '../avoidZone';
import type { FlowSample } from '../../traffic';
import { flowStatusColor } from '../../traffic';
import {
  ROUTE_CASING_WIDTH,
  ROUTE_LINE_WIDTH,
  ROUTE_LINE_COLOR,
  ROUTE_CASING_COLOR,
} from '../../../features/map';

// Standalone avoid-zone overlay: red dashed outline with translucent fill.
// Renders whenever an avoid circle exists, with or without a route.
export function createAvoidLayer(ring: EvacRoutePoint[]): VectorLayer<VectorSource> {
  const feature = new Feature({
    geometry: new Polygon([ring.map((point) => fromLonLat([point.lon, point.lat]))]),
  });
  feature.setStyle(
    new Style({
      stroke: new Stroke({ color: '#E63946', width: 2, lineDash: [6, 4] }),
      fill: new Fill({ color: 'rgba(230, 57, 70, 0.12)' }),
    }),
  );

  return new VectorLayer({
    source: new VectorSource({ features: [feature] }),
    properties: { layerId: 'evac-avoid' },
  });
}

// Evacuation route overlay for the 2D map (Item 15 Part A).
//
// The route is a SINGLE LineString rendered as TWO layers per segment:
//   - Core line (bottom): ALWAYS solid brand-blue (#209dd7), width 4
//   - Casing/outline (top): White when no traffic; traffic-status bands when
//     flow samples exist, width 7. Color interpolated per-vertex from real
//     per-sample Flow Segment Data.
// Direction chevrons removed — the solid core + traffic outline is the visual
// identity. Traffic flow raster stays at FULL OPACITY underneath.

/** Build a per-coordinate casing color array (length === coords.length) by
 * interpolating the band color of each sample across its leading segment.
 * Without samples, the array is the single white fallback color. */
function perVertexCasingColors(samples: FlowSample[], pathLength: number): string[] {
  const colors: string[] = new Array(pathLength).fill(ROUTE_CASING_COLOR);
  if (samples.length === 0 || pathLength < 2) return colors;
  const ordered = [...samples]
    .filter((s) => Number.isInteger(s.pathIndex) && s.pathIndex >= 0 && s.pathIndex < pathLength)
    .sort((a, b) => a.pathIndex - b.pathIndex);
  for (let i = 0; i < ordered.length; i++) {
    const sample = ordered[i];
    const fromIndex = sample.pathIndex;
    const toIndex = i + 1 < ordered.length ? ordered[i + 1].pathIndex : pathLength - 1;
    const band = flowStatusColor(sample.currentSpeed);
    for (let k = fromIndex; k <= toIndex && k < pathLength; k++) colors[k] = band;
  }
  return colors;
}

export function createRouteLayer(route: EvacRoute, samples: FlowSample[] = []): VectorLayer<VectorSource> {
  const features: Feature[] = [];

  const coords = route.path.map((point) => fromLonLat([point.lon, point.lat]));
  const casingColors = perVertexCasingColors(samples, route.path.length);
  // One feature per color step (segments where casing color is constant).
  // The core line is always one continuous feature in brand blue.
  for (let i = 0; i < coords.length - 1; i++) {
    const casingColor = casingColors[i] ?? ROUTE_CASING_COLOR;
    if (casingColor === casingColors[i + 1]) continue;
    const part = [coords[i], coords[i + 1]];
    const casing = new Feature({ geometry: new LineString(part) });
    casing.setStyle(new Style({ stroke: new Stroke({ color: casingColor, width: ROUTE_CASING_WIDTH }) }));
    features.push(casing);
  }
  // If the whole route has one casing color, emit a single casing feature.
  if (features.length === 0) {
    const casing = new Feature({ geometry: new LineString(coords) });
    casing.setStyle(new Style({ stroke: new Stroke({ color: ROUTE_CASING_COLOR, width: ROUTE_CASING_WIDTH }) }));
    features.push(casing);
  }

  // Core line (single continuous feature, always brand blue).
  const coreLine = new Feature({ geometry: new LineString(coords) });
  coreLine.setStyle(new Style({ stroke: new Stroke({ color: ROUTE_LINE_COLOR, width: ROUTE_LINE_WIDTH }) }));
  features.push(coreLine);

  // Start/end markers.
  const [start, end] = [route.path[0], route.path[route.path.length - 1]];
  for (const [point, color] of [
    [start, '#00d890'],
    [end, '#E63946'],
  ] as const) {
    if (!point) continue;
    const marker = new Feature({ geometry: new Point(fromLonLat([point.lon, point.lat])) });
    marker.setStyle(
      new Style({
        image: new Circle({ radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#ffffff', width: 2 }) }),
      }),
    );
    features.push(marker);
  }

  return new VectorLayer({
    source: new VectorSource({ features }),
    properties: { layerId: 'evac-route' },
  });
}

// Avoid-zone draw tool: press-drag-release sketches a circle while armed.
// Extracted verbatim from the 2D view's map-creation effect (handlers,
// tooltip, and preview management are unchanged); the only difference is
// that teardown is now a returned cleanup instead of inline effect code.
export function attachAvoidDraw(map: Map): () => void {
  // The live radius comes from turf; release finalizes the same circle
  // object the Valhalla request will use.
  const drawTooltip = document.createElement('div');
  drawTooltip.style.cssText =
    'position:absolute;display:none;pointer-events:none;background:rgba(13,27,42,.92);' +
    'border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:4px 8px;' +
    'font:11px monospace;color:#f8fafc;white-space:nowrap;z-index:30;';
  map.getTargetElement().appendChild(drawTooltip);

  let drawCenter: [number, number] | null = null;
  let drawPreviewLayer: VectorLayer<VectorSource> | null = null;

  const hideDrawPreview = () => {
    if (drawPreviewLayer) {
      map.removeLayer(drawPreviewLayer);
      drawPreviewLayer = null;
    }
    drawCenter = null;
    drawTooltip.style.display = 'none';
  };

  const onDrawDown = (event: MouseEvent) => {
    if (!useRouteStore.getState().drawAvoidArmed || event.button !== 0) {
      // Not drawing: clear any leftover preview (e.g. after Escape).
      hideDrawPreview();
      return;
    }
    const pixel = map.getEventPixel(event);
    const [lon, lat] = toLonLat(map.getCoordinateFromPixel(pixel));
    drawCenter = [lon, lat];
  };
  const onDrawMove = (event: MouseEvent) => {
    if (!drawCenter || !useRouteStore.getState().drawAvoidArmed) return;
    const pixel = map.getEventPixel(event);
    const [lon, lat] = toLonLat(map.getCoordinateFromPixel(pixel));
    const { circle, atCap } = previewCircle(drawCenter[0], drawCenter[1], lon, lat);
    if (drawPreviewLayer) {
      map.removeLayer(drawPreviewLayer);
    }
    const preview = createAvoidLayer(circleToRing(circle));
    map.addLayer(preview);
    drawPreviewLayer = preview;
    drawTooltip.textContent = atCap
      ? `${circle.radiusKm.toFixed(1)} km (max) — release to set`
      : `${circle.radiusKm.toFixed(1)} km — release to set`;
    drawTooltip.style.display = 'block';
    drawTooltip.style.left = `${pixel[0] + 14}px`;
    drawTooltip.style.top = `${pixel[1] - 10}px`;
  };
  const onDrawUp = (event: MouseEvent) => {
    const center = drawCenter;
    drawCenter = null;
    if (!center || !useRouteStore.getState().drawAvoidArmed) {
      hideDrawPreview();
      return;
    }
    const pixel = map.getEventPixel(event);
    const [lon, lat] = toLonLat(map.getCoordinateFromPixel(pixel));
    const { circle } = previewCircle(center[0], center[1], lon, lat);
    const store = useRouteStore.getState();
    hideDrawPreview();
    if (circle.radiusKm >= MIN_AVOID_RADIUS_KM) {
      store.setAvoidCircle(circle);
    }
    store.setDrawAvoidArmed(false);
  };
  const viewport = map.getViewport();
  viewport.addEventListener('mousedown', onDrawDown);
  viewport.addEventListener('mousemove', onDrawMove);
  viewport.addEventListener('mouseup', onDrawUp);

  // Escape cancels an in-progress draw immediately.
  const onDrawKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !useRouteStore.getState().drawAvoidArmed) return;
    hideDrawPreview();
    useRouteStore.getState().setDrawAvoidArmed(false);
  };
  window.addEventListener('keydown', onDrawKey);

  return () => {
    viewport.removeEventListener('mousedown', onDrawDown);
    viewport.removeEventListener('mousemove', onDrawMove);
    viewport.removeEventListener('mouseup', onDrawUp);
    window.removeEventListener('keydown', onDrawKey);
    drawTooltip.remove();
  };
}

/** Finalized avoid-zone layer sync: red dashed overlay whenever a circle
 * exists, with or without a route. Extracted verbatim from the 2D view's
 * avoidCircle effect; the caller keeps the layer holder + subscription. */
export function renderAvoidCircle(
  map: Map,
  holder: { current: VectorLayer<VectorSource> | null },
  circle: EvacCircle | null,
): void {
  if (holder.current) {
    map.removeLayer(holder.current);
    holder.current = null;
  }

  if (circle) {
    const layer = createAvoidLayer(circleToRing(circle));
    layer.setZIndex(9);
    map.addLayer(layer);
    holder.current = layer;
  }
}

// Avoid-draw arming: crosshair cursor and pan-drag state. Stale previews
// are discarded lazily by the next pointer-down (see onDrawDown).
// Extracted verbatim from the 2D view's drawAvoidArmed effect, including
// its cleanup, which re-enables pan.
export function applyAvoidCursor(map: Map, armed: boolean): () => void {
  const viewport = map.getViewport();
  viewport.style.cursor = armed ? 'crosshair' : '';
  const pan = map
    .getInteractions()
    .getArray()
    .find((interaction): interaction is DragPan => interaction instanceof DragPan);
  if (pan) pan.setActive(!armed);
  return () => {
    if (pan) pan.setActive(true);
  };
}
