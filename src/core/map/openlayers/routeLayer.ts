import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import type { EvacRoute, EvacRoutePoint } from '../../../stores/routeStore';

// Evacuation route overlay: avoid-area polygon, route line, endpoints.
export function createRouteLayer(route: EvacRoute, avoidRing: EvacRoutePoint[]): VectorLayer<VectorSource> {
  const features: Feature[] = [];

  if (avoidRing.length >= 4) {
    const area = new Feature({
      geometry: new Polygon([avoidRing.map((point) => fromLonLat([point.lon, point.lat]))]),
    });
    area.setStyle(
      new Style({
        stroke: new Stroke({ color: '#E63946', width: 2, lineDash: [6, 4] }),
        fill: new Fill({ color: 'rgba(230, 57, 70, 0.12)' }),
      }),
    );
    features.push(area);
  }

  const line = new Feature({
    geometry: new LineString(route.path.map((point) => fromLonLat([point.lon, point.lat]))),
  });
  line.setStyle(
    new Style({
      stroke: new Stroke({ color: '#ffffff', width: 7 }),
    }),
  );
  const lineTop = new Feature({
    geometry: new LineString(route.path.map((point) => fromLonLat([point.lon, point.lat]))),
  });
  lineTop.setStyle(
    new Style({
      stroke: new Stroke({ color: route.avoidsArea ? '#00d890' : '#FF9F1C', width: 4 }),
    }),
  );
  features.push(line, lineTop);

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
