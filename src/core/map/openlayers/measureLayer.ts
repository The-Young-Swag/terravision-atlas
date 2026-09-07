import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle, Text } from 'ol/style';

// Geodesic measurement overlay: path line through all picked points with
// vertex markers and a running-total distance label. Distances come from
// turf computed by the caller so both map views report identical numbers.
export function createMeasureLayer(points: [number, number][], distanceText: string): VectorLayer<VectorSource> {
  const features: Feature[] = [];

  if (points.length >= 2) {
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

  for (const [lon, lat] of points) {
    const marker = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
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
