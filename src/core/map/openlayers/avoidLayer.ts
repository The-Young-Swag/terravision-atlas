import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill } from 'ol/style';
import type { EvacRoutePoint } from '../../../stores/routeStore';

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
