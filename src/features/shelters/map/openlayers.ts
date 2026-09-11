import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import type { Shelter } from '../overpass';

// Shelter markers: green discs with a light stroke (same contrast treatment
// as the hazard pins) so they read on any basemap.
export function createShelterLayer(shelters: Shelter[]): VectorLayer<VectorSource> {
  const features = shelters.map((shelter) => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([shelter.lon, shelter.lat])),
      shelterId: shelter.id,
    });
    feature.setStyle(
      new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: '#00d890' }),
          stroke: new Stroke({ color: '#f8fafc', width: 2 }),
        }),
      }),
    );
    return feature;
  });

  return new VectorLayer({
    source: new VectorSource({ features }),
    properties: { layerId: 'shelters' },
  });
}
