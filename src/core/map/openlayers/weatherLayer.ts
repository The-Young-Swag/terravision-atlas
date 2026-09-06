import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';

// Weather location marker (2D map): brand-purple disc with a light stroke,
// visually distinct from incident (amber), shelter (green), and hazard
// (severity-colored) pins.
export function createWeatherLayer(lon: number, lat: number): VectorLayer<VectorSource> {
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    weatherMarker: true,
  });
  feature.setStyle(
    new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({ color: '#5500a4' }),
        stroke: new Stroke({ color: '#f8fafc', width: 2 }),
      }),
    }),
  );
  return new VectorLayer({
    source: new VectorSource({ features: [feature] }),
    properties: { layerId: 'weather' },
  });
}
