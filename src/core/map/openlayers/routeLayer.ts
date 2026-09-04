import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import type { EvacRoute } from '../../../stores/routeStore';

// Evacuation route overlay: white-cased line (green when it avoids the area,
// amber when it enters it) plus green start / red end markers. The avoid
// zone itself renders in a dedicated layer so it stays visible with or
// without a route.
export function createRouteLayer(route: EvacRoute): VectorLayer<VectorSource> {
  const features: Feature[] = [];

  const casing = new Feature({
    geometry: new LineString(route.path.map((point) => fromLonLat([point.lon, point.lat]))),
  });
  casing.setStyle(
    new Style({
      stroke: new Stroke({ color: '#ffffff', width: 7 }),
    }),
  );
  const line = new Feature({
    geometry: new LineString(route.path.map((point) => fromLonLat([point.lon, point.lat]))),
  });
  line.setStyle(
    new Style({
      stroke: new Stroke({ color: route.avoidsArea ? '#00d890' : '#FF9F1C', width: 4 }),
    }),
  );
  features.push(casing, line);

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
