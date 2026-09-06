import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { DISASTER_SEVERITY_COLORS } from '../disasterStyle';

export interface HazardFeature {
  id: string;
  lon: number;
  lat: number;
  severity: 'high' | 'medium' | 'low';
  type: string;
}

const severityColor = DISASTER_SEVERITY_COLORS;

// Vector layer for live hazard pins with adaptive stroke for basemap contrast
export function createHazardLayer(
  hazards: HazardFeature[],
  markerStrokeColor: string = '#f8fafc', // default light stroke for dark basemaps
): VectorLayer<VectorSource> {
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
          stroke: new Stroke({ color: markerStrokeColor, width: 2 }),
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
