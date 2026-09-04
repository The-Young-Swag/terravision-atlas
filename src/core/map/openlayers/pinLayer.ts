import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import type { EvacPin } from '../../../stores/routeStore';

// Evacuation pins: green start, red destination (standard Maps convention).
// Features carry pinRole so the drag handler knows which pin moved.
export const EVAC_PIN_COLORS = { start: '#22c55e', destination: '#ef4444' } as const;

export function createEvacPinLayer(start: EvacPin | null, destination: EvacPin | null): VectorLayer<VectorSource> {
  const features: Feature[] = [];
  for (const [pin, role] of [
    [start, 'start'],
    [destination, 'destination'],
  ] as const) {
    if (!pin) continue;
    const feature = new Feature({
      geometry: new Point(fromLonLat([pin.lon, pin.lat])),
      pinRole: role,
    });
    feature.setStyle(
      new Style({
        image: new Circle({
          radius: 7,
          fill: new Fill({ color: EVAC_PIN_COLORS[role] }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      }),
    );
    features.push(feature);
  }

  return new VectorLayer({
    source: new VectorSource({ features }),
    properties: { layerId: 'evac-pins' },
  });
}
