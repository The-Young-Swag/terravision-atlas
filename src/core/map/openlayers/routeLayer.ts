import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle, Text } from 'ol/style';
import * as turf from '@turf/turf';
import type { EvacRoute } from '../../../stores/routeStore';
import { ROUTE_CASING_COLOR, ROUTE_CASING_WIDTH, ROUTE_LINE_COLOR, ROUTE_LINE_WIDTH } from '../routeStyle';

// Evacuation route overlay: white-cased brand-blue line (a hue outside the
// TomTom traffic-speed palette, so it never reads as a traffic segment)
// plus direction chevrons at intervals and green start / red end markers.
// Verdict semantics (avoids vs enters) live in the panel chip, not the
// line color. The avoid zone itself renders in a dedicated layer so it
// stays visible with or without a route.
export function createRouteLayer(route: EvacRoute): VectorLayer<VectorSource> {
  const features: Feature[] = [];

  const coords = route.path.map((point) => fromLonLat([point.lon, point.lat]));
  const casing = new Feature({
    geometry: new LineString(coords),
  });
  casing.setStyle(
    new Style({
      stroke: new Stroke({ color: ROUTE_CASING_COLOR, width: ROUTE_CASING_WIDTH }),
    }),
  );
  const line = new Feature({
    geometry: new LineString(coords),
  });
  line.setStyle(
    new Style({
      stroke: new Stroke({ color: ROUTE_LINE_COLOR, width: ROUTE_LINE_WIDTH }),
    }),
  );
  features.push(casing, line);

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
