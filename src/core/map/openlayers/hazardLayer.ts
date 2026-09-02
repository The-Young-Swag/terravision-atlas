import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';

export interface HazardFeature {
  id: string;
  lon: number;
  lat: number;
  severity: 'high' | 'medium' | 'low';
  type: string;
}

const severityColor: Record<HazardFeature['severity'], string> = {
  high: '#E63946',
  medium: '#FF9F1C',
  low: '#2EC4B6',
};

// Vector layer for live hazard pins with subtle glow.
export function createHazardLayer(hazards: HazardFeature[]): VectorLayer<VectorSource> {
  const features = hazards.map((hazard) => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([hazard.lon, hazard.lat])),
      hazardId: hazard.id,
      severity: hazard.severity,
    });

    const color = severityColor[hazard.severity];

    feature.setStyle(
      new Style({
        image: new Circle({
          radius: hazard.severity === 'high' ? 7 : 5,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: 'rgba(255,255,255,0.9)', width: 2 }),
        }),
      }),
    );

    return feature;
  });

  const source = new VectorSource({ features });

  return new VectorLayer({
    source,
    properties: { layerId: 'hazards' },
  });
}
