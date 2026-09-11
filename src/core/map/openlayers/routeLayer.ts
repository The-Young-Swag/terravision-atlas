import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import type { EvacRoute } from '../../../stores/routeStore';
import type { FlowSample } from '../../../features/traffic/flowEta';
import { flowStatusColor } from '../../../features/traffic/flowStatus';
import {
  ROUTE_CASING_WIDTH,
  ROUTE_LINE_WIDTH,
  ROUTE_LINE_COLOR,
  ROUTE_CASING_COLOR,
} from '../../../features/map/routeStyle';

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