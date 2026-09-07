import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle, Text } from 'ol/style';
import * as turf from '@turf/turf';
import type { EvacRoute } from '../../../stores/routeStore';
import type { FlowSample } from '../../../features/traffic/flowEta';
import { flowStatusColor } from '../../../features/traffic/flowStatus';
import { ROUTE_CASING_WIDTH, ROUTE_LINE_WIDTH } from '../routeStyle';

// Evacuation route overlay for the 2D map (Item 15 Part A).
//
// One continuous LineString rendered as a casing + line stroke. With live
// flow samples the per-vertex stroke color is interpolated between the
// real per-sample traffic bands, so the casing and line both transition
// smoothly with no visible seams between segments. With no usable flow
// data the route falls back to the brand-blue line + dark casing
// (the same fallback MapLibre uses), no fake speed values, no gap-render.
const FALLBACK_LINE_COLOR = '#209dd7';
const FALLBACK_CASING_COLOR = '#0b3d55';

/** Build a per-coordinate color array (length === coords.length) by
 * interpolating the band color of each sample across its leading segment.
 * Without samples, the array is the single fallback color. */
function perVertexColors(samples: FlowSample[], pathLength: number, fallback: string): string[] {
  const colors: string[] = new Array(pathLength).fill(fallback);
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
  const lineColors = perVertexColors(samples, route.path.length, FALLBACK_LINE_COLOR);
  const casingColors = perVertexColors(samples, route.path.length, FALLBACK_CASING_COLOR);
  // One feature per color step (segments where color is constant). The
  // strokes abut exactly, so the result is visually one continuous line.
  for (let i = 0; i < coords.length - 1; i++) {
    const lineColor = lineColors[i] ?? FALLBACK_LINE_COLOR;
    const casingColor = casingColors[i] ?? FALLBACK_CASING_COLOR;
    if (lineColor === lineColors[i + 1] && casingColor === casingColors[i + 1]) continue;
    const part = [coords[i], coords[i + 1]];
    const casing = new Feature({ geometry: new LineString(part) });
    casing.setStyle(new Style({ stroke: new Stroke({ color: casingColor, width: ROUTE_CASING_WIDTH }) }));
    const line = new Feature({ geometry: new LineString(part) });
    line.setStyle(new Style({ stroke: new Stroke({ color: lineColor, width: ROUTE_LINE_WIDTH }) }));
    features.push(casing, line);
  }
  // If the whole route has one color, emit a single feature pair.
  if (features.length === 0) {
    const casing = new Feature({ geometry: new LineString(coords) });
    casing.setStyle(new Style({ stroke: new Stroke({ color: FALLBACK_CASING_COLOR, width: ROUTE_CASING_WIDTH }) }));
    const line = new Feature({ geometry: new LineString(coords) });
    line.setStyle(new Style({ stroke: new Stroke({ color: FALLBACK_LINE_COLOR, width: ROUTE_LINE_WIDTH }) }));
    features.push(casing, line);
  }

  // Direction chevrons along the line: turf stations the points and angles
  // them to the local bearing. '▶' points east at rotation 0; OpenLayers
  // rotates clockwise in radians, so (bearing − 90°) aims it along travel.
  try {
    const geoLine = turf.lineString(route.path.map((point) => [point.lon, point.lat]));
    const lengthKm = turf.length(geoLine, { units: 'kilometers' });
    if (lengthKm > 0) {
      for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
        const along = turf.along(geoLine, Math.max(0, fraction * lengthKm), { units: 'kilometers' });
        const before = turf.along(geoLine, Math.max(0, fraction * lengthKm - lengthKm * 0.01), {
          units: 'kilometers',
        });
        const after = turf.along(
          geoLine,
          Math.min(lengthKm, fraction * lengthKm + lengthKm * 0.01),
          { units: 'kilometers' },
        );
        const bearing = turf.bearing(before, after);
        const [lon, lat] = along.geometry.coordinates;
        const chevron = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
        chevron.setStyle(
          new Style({
            text: new Text({
              text: '▶',
              font: 'bold 13px sans-serif',
              fill: new Fill({ color: '#ffffff' }),
              stroke: new Stroke({ color: '#0b3d55', width: 2.5 }),
              rotation: ((bearing - 90) * Math.PI) / 180,
              overflow: true,
            }),
          }),
        );
        features.push(chevron);
      }
    }
  } catch {
    // Chevron placement is decorative — a failed computation never blocks
    // the route line itself.
  }

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
